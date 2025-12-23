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
  item: null,
  mensagem: null,
  finalizado: false
};

function salvarEstado() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(estado));
}

function carregarEstado() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) estado = JSON.parse(data);
}

function resetEstado() {
  estado = {
    nome: null,
    nomeNormalizado: null,
    sorteado: null,
    sorteadoId: null,
    escolha: null,
    item: null,
    mensagem: null,
    finalizado: false
  };
  salvarEstado();
  location.reload();
}

/* ================= UTIL ================= */
function normalizarNome(nome) {
  return nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function mostrarPasso(id) {
  document.querySelectorAll(".step").forEach(s => s.style.display = "none");
  document.getElementById(id).style.display = "block";
}

function showToast(msg, duration = 2500) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 50);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* ================= INICIAL ================= */
carregarEstado();
const usuarioDocRef = estado.nomeNormalizado ? doc(db, "usuarios", estado.nomeNormalizado) : null;

if (estado.finalizado) {
  mostrarPasso("step-blocked");
} else if (estado.sorteado) {
  document.getElementById("resultado-sorteio").innerText = estado.sorteado;
  mostrarPasso("step-3");
} else {
  mostrarPasso("step-1");
}

/* ================= PASSO 1 ================= */
document.getElementById("btn-nome").onclick = () => {
  const nome = document.getElementById("input-nome").value.trim();
  if (!nome) return showToast("Digite seu nome!");

  estado.nome = nome;
  estado.nomeNormalizado = normalizarNome(nome);
  salvarEstado();

  mostrarPasso("step-2");
};

/* ================= PASSO 2 — SORTEIO ================= */
document.getElementById("btn-sortear").onclick = async () => {
  if (estado.sorteado) return;

  const q = query(collection(db, "participantes"), where("status", "==", "livre"));
  const snapshot = await getDocs(q);

  let candidatos = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.nomeNormalizado !== estado.nomeNormalizado) {
      candidatos.push({ id: docSnap.id, nome: data.nomeOriginal });
    }
  });

  if (candidatos.length === 0) {
    showToast("Nenhum participante disponível!");
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

import { doc, setDoc } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

/* ================= PASSO 4 — ESCOLHA ================= */
const step4Container = document.querySelector("#step-4");
const choices = step4Container.querySelectorAll(".choice");
const btnEscolha = document.getElementById("btn-escolha");

let escolhaSelecionada = estado.escolha || null;

// Atualiza visualmente se já houver escolha salva
choices.forEach(c => {
  if (c.dataset.id === escolhaSelecionada) c.classList.add("active");
});

// Seleção visual e atualização de estado
choices.forEach(btn => {
  btn.addEventListener("click", () => {
    choices.forEach(c => c.classList.remove("active"));
    btn.classList.add("active");

    escolhaSelecionada = btn.dataset.id;
    estado.escolha = escolhaSelecionada;
    salvarEstado();

    btnEscolha.disabled = false;
    showToast("🎉 Escolha selecionada!");
  });
});

// Clique do botão continuar — salva no Firebase e vai para Step 5
btnEscolha.addEventListener("click", async () => {
  if (!escolhaSelecionada) {
    showToast("⚠️ Escolha uma opção antes de continuar");
    return;
  }

  const usuarioDocRef = doc(db, "usuarios", estado.nomeNormalizado);

  // Cria ou atualiza documento com merge
  await setDoc(usuarioDocRef, { escolha: escolhaSelecionada }, { merge: true });

  btnEscolha.disabled = true;
  showToast("✅ Escolha salva com sucesso!");

  // Transição para Step 5
  mostrarPasso("step-5");
});

/* ================= PASSO 5 — NOME DO ITEM + MENSAGEM ================= */
const step5Container = document.querySelector("#step-5");
const inputItem = step5Container.querySelector("#nome-item");
const textareaMsg = step5Container.querySelector("#mensagem");
const btnConfirmar = step5Container.querySelector("#btn-confirmar");

// Carregar valores anteriores se houver (persistência localStorage)
if (estado.item) inputItem.value = estado.item;
if (estado.mensagem) textareaMsg.value = estado.mensagem;

btnConfirmar.addEventListener("click", async () => {
  const item = inputItem.value.trim();
  const msg = textareaMsg.value.trim();

  if (!item || !msg) {
    showToast("⚠️ Preencha o nome do item e a mensagem!");
    return;
  }

  // Atualiza estado local
  estado.item = item;
  estado.mensagem = msg;
  estado.finalizado = true;
  salvarEstado();

  const usuarioDocRef = doc(db, "usuarios", estado.nomeNormalizado);

  // Cria ou atualiza documento no Firebase com merge
  await setDoc(usuarioDocRef, {
    item: item,
    mensagem: msg,
    finalizado: true,
    escolha: estado.escolha,
    sorteado: estado.sorteado
  }, { merge: true });

  showToast("🎁 Item e mensagem salvos!");
  mostrarPasso("step-6"); // Step 6 = tela de confirmação final
});


/* ================= BOTÃO RESET ADM ================= */
document.getElementById("btn-reset").onclick = () => {
  localStorage.clear();
  resetStep4();
  resetEstado(); // reinicia todo o app
  showToast("🔄 Sistema reiniciado pelo administrador!", 3000);
};
