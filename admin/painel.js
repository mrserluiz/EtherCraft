import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* 🔐 FIREBASE CONFIG — MESMO DO RESET */
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

/* 🔑 ELEMENTOS */
const senhaInput = document.getElementById("senha");
const btnLogin = document.getElementById("btn-login");
const loginDiv = document.getElementById("login");
const painelDiv = document.getElementById("painel");
const tabela = document.getElementById("tabela");
const btnCopiar = document.getElementById("copiar");
const btnReset = document.getElementById("ir-reset");

/* 🔐 SENHA ADM (simples, local) */
const SENHA_ADM = "admin123";

/* 🔓 LOGIN */
btnLogin.onclick = () => {
  if (senhaInput.value === SENHA_ADM) {
    loginDiv.style.display = "none";
    painelDiv.style.display = "block";
    iniciarAtualizacaoTempoReal();
  } else {
    alert("Senha incorreta");
  }
};

/* 🔄 ATUALIZAÇÃO EM TEMPO REAL */
function iniciarAtualizacaoTempoReal() {
  const usuariosCol = collection(db, "usuarios");

  onSnapshot(usuariosCol, snap => {
    const tbody = tabela.querySelector("tbody");
    tbody.innerHTML = ""; // limpa tabela

    let sorteioCompleto = true;

    snap.forEach(doc => {
      const u = doc.data();
      if (!u.sorteado) sorteioCompleto = false;

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${u.nome || "-"}</td>
        <td>${u.sorteado || "-"}</td>
        <td>${u.escolha || "-"}</td>
        <td>${u.item || "-"}</td>
        <td>${u.mensagem || "-"}</td>
      `;

      // 🔴 Indicador visual
      if (u.finalizado) {
        tr.style.backgroundColor = "#d4edda"; // verde claro → finalizado
      } else if (u.sorteado) {
        tr.style.backgroundColor = "#fff3cd"; // amarelo → sorteado, mas não finalizou
      } else {
        tr.style.backgroundColor = ""; // padrão → ainda não sorteado
      }

      tbody.appendChild(tr);
    });

    // Atualiza status do sorteio
    let statusEvento = document.getElementById("status-evento");
    if (!statusEvento) {
      statusEvento = document.createElement("p");
      statusEvento.id = "status-evento";
      statusEvento.style.marginTop = "15px";
      statusEvento.style.fontWeight = "bold";
      painelDiv.insertBefore(statusEvento, tabela);
    }

    statusEvento.textContent = sorteioCompleto
      ? "🟢 Sorteio CONCLUÍDO"
      : "🟡 Sorteio INCOMPLETO";
  });
}

/* 📋 COPIAR TABELA */
btnCopiar.onclick = () => {
  let texto = "";
  tabela.querySelectorAll("tr").forEach(tr => {
    const linha = [...tr.children].map(td => td.innerText).join("\t");
    texto += linha + "\n";
  });

  navigator.clipboard.writeText(texto);
  alert("Tabela copiada!");
};

/* 🔁 IR PARA RESET */
btnReset.onclick = () => {
  window.location.href = "reset-evento.html";
};
