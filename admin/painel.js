import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// 🔐 CONFIG FIREBASE
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

// 🔑 SENHA ADM
const SENHA_ADM = "1234"; // <<< TROQUE

const loginDiv = document.getElementById("login");
const painelDiv = document.getElementById("painel");
const tbody = document.querySelector("#tabela tbody");

// 🔒 Se já estiver logado, pula login
if (localStorage.getItem("adm_autenticado") === "true") {
  loginDiv.style.display = "none";
  painelDiv.style.display = "block";
  carregarDados();
}

document.getElementById("btn-login").onclick = async () => {
  const senha = document.getElementById("senha").value;

  if (senha !== SENHA_ADM) {
    alert("Senha incorreta");
    return;
  }

  localStorage.setItem("adm_autenticado", "true");

  loginDiv.style.display = "none";
  painelDiv.style.display = "block";

  carregarDados();
};

// 🔁 Botão reset
document.getElementById("ir-reset").onclick = () => {
  window.location.href = "reset-evento.html";
};

async function carregarDados() {
  tbody.innerHTML = "";

  const snap = await getDocs(collection(db, "resultados"));

  for (const d of snap.docs) {
    const r = d.data();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${r.usuario}</td>
      <td>${r.sorteado}</td>
      <td>${r.escolha}</td>
      <td>${r.nomeItem}</td>
      <td>${r.mensagem}</td>
    `;
    tbody.appendChild(tr);
  }
}

document.getElementById("copiar").onclick = () => {
  let texto = "";
  document.querySelectorAll("#tabela tr").forEach(linha => {
    texto += [...linha.children].map(td => td.innerText).join(" | ") + "\n";
  });

  navigator.clipboard.writeText(texto);
  alert("Tabela copiada!");
};
