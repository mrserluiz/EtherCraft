import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  deleteDoc,
  doc,
  setDoc
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

const log = msg => {
  document.getElementById("log").textContent += msg + "\n";
};

const normalizar = nome =>
  nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");

document.getElementById("btn-reset").onclick = async () => {
  if (!confirm("Tem certeza que deseja RESETAR o evento?")) return;

  log("Iniciando reset...");

  // 🔥 LIMPAR PARTICIPANTES
  const participantesSnap = await getDocs(collection(db, "participantes"));
  for (const d of participantesSnap.docs) {
    await deleteDoc(doc(db, "participantes", d.id));
  }
  log("Participantes apagados.");

  // 🔥 LIMPAR USUÁRIOS
  const usuariosSnap = await getDocs(collection(db, "usuarios"));
  for (const d of usuariosSnap.docs) {
    await deleteDoc(doc(db, "usuarios", d.id));
  }
  log("Usuários apagados.");

  // 📥 CARREGAR JSON
  const resp = await fetch("../data/participantes.json");
  const lista = await resp.json();

  for (const nome of lista) {
    const id = normalizar(nome);
    await setDoc(doc(db, "participantes", id), {
      nomeOriginal: nome,
      nomeNormalizado: id,
      status: "livre"
    });
  }

  log("Participantes carregados com sucesso!");
  log("Evento pronto para uso.");
};
