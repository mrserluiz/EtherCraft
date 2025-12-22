import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ================= FIREBASE ================= */

const firebaseConfig = {
  apiKey: "AIzaSyBlWw5nf8tNAX2BpnmxG7TmofIdUyyQ4Yw",
  authDomain: "amigosecreto-32194.firebaseapp.com",
  projectId: "amigosecreto-32194",
  storageBucket: "amigosecreto-32194.firebasestorage.app",
  messagingSenderId: "97403932190",
  appId: "1:97403932190:web:0a0e6d06c76c68b8c0680f"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

/* ================= ESTADO ================= */

const STORAGE_KEY = "amigoSecretoEstado";

let estado = {
  nome: null,
  nomeNormalizado: null,
  sorteado: null,
  sorteadoId: null,
  escolha: null,
  finalizado: false
};

function salvarEstado() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
}

function carregarEstado() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) estado = JSON.parse(data);
}

function mostrarPasso(id) {
  document.querySelectorAll(".step").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "block";
}

/* ================= UTIL ================= */

function normalizarNome(nome) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/* ================= INICIAL ================= */

carregarEstado();

if (estado.finalizado) {
  mostrarPasso("step-blocked");
} else if (estado.sorteado) {
  document.getElementById("resultado-sorteio").innerText = estado.sorteado;
  mostrarPasso("step-3");
} else {
  mostrarPasso("step-1");
}

/* ================= PASSO 1 ================= */

document.getElementById("btn-nome").onclick = async () => {
  const nome = document.getElementById("input-nome").value.trim();
  if (!nome) return alert("Digite seu nome");

  estado.nome = nome;
  estado.nomeNormalizado = normalizarNome(nome);
  salvarEstado();

  mostrarPasso("step-2");
};

/* ================= PASSO 2 — SORTEIO REAL ================= */

document.getElementById("btn-sortear").onclick = async () => {
  if (estado.sorteado) return;

  const q = query(
    collection(db, "participantes"),
    where("status", "==", "livre")
  );

  const snapshot = await getDocs(q);
  let candidatos = [];

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.nomeNormalizado !== estado.nomeNormalizado) {
      candidatos.push({
        id: docSnap.id,
        nome: data.nomeOriginal
      });
    }
  });

  if (candidatos.length === 0) {
    alert("Nenhum participante disponível");
    return;
  }

  const sorteado = candidatos[Math.floor(Math.random() * candidatos.length)];

  await updateDoc(doc(db, "participantes", sorteado.id), {
    status: "reservado",
    sorteadoPor: estado.nomeNormalizado
  });

  estado.sorteado = sorteado.nome;
  estado.sorteadoId = sorteado.id;
  salvarEstado();

  document.getElementById("resultado-sorteio").innerText = sorteado.nome;
  mostrarPasso("step-3");
};

/* ================= PASSO 3 ================= */

document.getElementById("btn-continuar-escolha").onclick = () => {
  mostrarPasso("step-4");
};

/* ================= PASSO 4 ================= */

const choices = document.querySelectorAll("#step-4 .choice");
const btnEscolha = document.getElementById("btn-escolha");
const usuarioDocRef = doc(db, "usuarios", estado.nomeNormalizado);

// Bloquear se já tiver escolha salva
async function carregarEscolha() {
  const docSnap = await getDoc(usuarioDocRef);
  if (docSnap.exists() && docSnap.data().escolha) {
    estado.escolha = docSnap.data().escolha;
    salvarEstado();
    btnEscolha.disabled = true;
    choices.forEach(c => {
      if (c.dataset.id === estado.escolha) c.classList.add("active");
    });
  }
}
carregarEscolha();

// Seleção visual
let escolhaSelecionada = estado.escolha || null;

choices.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btnEscolha.disabled) return;
    choices.forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    escolhaSelecionada = btn.dataset.id;
    estado.escolha = escolhaSelecionada;
    salvarEstado();
    btnEscolha.disabled = false;
  });
});

// Salvar no Firebase ao continuar
btnEscolha.addEventListener("click", async () => {
  if (!escolhaSelecionada) return alert("Escolha uma opção");
  await updateDoc(usuarioDocRef, { escolha: escolhaSelecionada });
  btnEscolha.disabled = true;
  alert("Escolha salva com sucesso!");
  mostrarPasso("step-5");
});

/* ================= PASSO 5 — FINALIZA ================= */

const inputItem = document.getElementById("nome-item");
const textareaMsg = document.getElementById("mensagem");
const btnConfirmar = document.getElementById("btn-confirmar");

// Carregar valores anteriores se houver (persistência localStorage)
if (estado.item) inputItem.value = estado.item;
if (estado.mensagem) textareaMsg.value = estado.mensagem;

btnConfirmar.addEventListener("click", async () => {
  const item = inputItem.value.trim();
  const msg = textareaMsg.value.trim();

  if (!item || !msg) {
    alert("Preencha o nome do item e a mensagem!");
    return;
  }

  // Atualizar estado local
  estado.item = item;
  estado.mensagem = msg;
  estado.finalizado = true;
  salvarEstado();

  // Atualizar Firebase
  const usuarioDocRef = doc(db, "usuarios", estado.nomeNormalizado);
  await updateDoc(usuarioDocRef, {
    item: item,
    mensagem: msg,
    finalizado: true
  });

  // Bloquear Steps futuros
  mostrarPasso("step-6"); // Step 6 = tela de confirmação/final
});
