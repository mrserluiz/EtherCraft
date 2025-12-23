import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  setDoc,
  updateDoc
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
  if (!nome) return showToast("Digite seu nome!");

  const nomeNormalizado = normalizarNome(nome);

  // Verifica se o usuário está na lista de participantes
  const q = query(
    collection(db, "participantes"),
    where("nomeNormalizado", "==", nomeNormalizado)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    showToast("❌ Nome não encontrado na lista!");
    return;
  }

  estado.nome = nome;
  estado.nomeNormalizado = nomeNormalizado;
  salvarEstado();

  // Cria documento no Firebase se não existir
  const usuarioRef = doc(db, "usuarios", nomeNormalizado);
  const usuarioSnap = await getDocs(query(collection(db, "usuarios"), where("nomeNormalizado", "==", nomeNormalizado)));
  if (usuarioSnap.empty) {
    await setDoc(usuarioRef, {
      nome,
      nomeNormalizado,
      sorteado: null,
      escolha: null,
      item: null,
      mensagem: null,
      finalizado: false
    });
  }

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

/* ================= PASSO 4 — ESCOLHA ================= */
const choices = document.querySelectorAll("#step-4 .choice");
const btnEscolha = document.getElementById("btn-escolha");
let escolhaSelecionada = estado.escolha || null;

// Atualiza visualmente se já tiver escolha salva
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

    // libera o botão continuar
    btnEscolha.disabled = false;

    // mostra toast de confirmação da escolha
    showToast("🎉 Escolha selecionada!");
  });
});

// Clique do botão continuar — salva no Firebase e vai para Step 5
btnEscolha.addEventListener("click", async () => {
  if (!escolhaSelecionada) {
    showToast("Escolha uma opção antes de continuar!");
    return;
  }

  const usuarioRef = doc(db, "usuarios", estado.nomeNormalizado);
  await setDoc(
    usuarioRef,
    {
      escolha: escolhaSelecionada,
      sorteado: estado.sorteado,
      nome: estado.nome,
      nomeNormalizado: estado.nomeNormalizado,
      item: estado.item || null,
      mensagem: estado.mensagem || null,
      finalizado: estado.finalizado
    },
    { merge: true }
  );

  btnEscolha.disabled = true;
  showToast("✅ Escolha salva com sucesso!");
  mostrarPasso("step-5");
});

/* ================= PASSO 5 — NOME DO ITEM + MENSAGEM ================= */
const inputItem = document.getElementById("nome-item");
const textareaMsg = document.getElementById("mensagem");
const btnConfirmar = document.getElementById("btn-confirmar");

if (estado.item) inputItem.value = estado.item;
if (estado.mensagem) textareaMsg.value = estado.mensagem;

btnConfirmar.addEventListener("click", async () => {
  const item = inputItem.value.trim();
  const msg = textareaMsg.value.trim();

  if (!item || !msg) {
    showToast("Preencha o nome do item e a mensagem!");
    return;
  }

  estado.item = item;
  estado.mensagem = msg;
  estado.finalizado = true;
  salvarEstado();

  const usuarioRef = doc(db, "usuarios", estado.nomeNormalizado);
  await setDoc(
    usuarioRef,
    {
      item,
      mensagem: msg,
      finalizado: true,
      escolha: estado.escolha,
      sorteado: estado.sorteado,
      nome: estado.nome,
      nomeNormalizado: estado.nomeNormalizado
    },
    { merge: true }
  );

  showToast("Item e mensagem salvos!");
  mostrarPasso("step-6");
});

/* ================= STEP 6 — CONFIRMAÇÃO FINAL ================= */
