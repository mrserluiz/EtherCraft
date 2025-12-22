let estado = {
  nome: null,
  sorteado: null,
  escolha: null,
  finalizado: false
};

const STORAGE_KEY = "amigoSecretoEstado";

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

// 🔒 Verificação inicial
carregarEstado();

if (estado.finalizado) {
  mostrarPasso("step-blocked");
} else {
  mostrarPasso("step-1");
}

// PASSO 1
document.getElementById("btn-nome").onclick = () => {
  const nome = document.getElementById("input-nome").value.trim();
  if (!nome) return alert("Digite seu nome");

  estado.nome = nome;
  salvarEstado();
  mostrarPasso("step-2");
};

// PASSO 2 — sorteio fake
document.getElementById("btn-sortear").onclick = () => {
  estado.sorteado = "NOME SORTEADO";
  salvarEstado();

  document.getElementById("resultado-sorteio").innerText = estado.sorteado;
  mostrarPasso("step-3");
};

// PASSO 3
document.getElementById("btn-continuar-escolha").onclick = () => {
  mostrarPasso("step-4");
};

// PASSO 4 — escolha
document.querySelectorAll(".choice").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".choice").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    estado.escolha = btn.innerText;
    salvarEstado();
  };
});

document.getElementById("btn-escolha").onclick = () => {
  if (!estado.escolha) return alert("Escolha uma opção");
  mostrarPasso("step-5");
};

// PASSO 5 — FINALIZA
document.getElementById("btn-confirmar").onclick = () => {
  const item = document.getElementById("nome-item").value.trim();
  const msg = document.getElementById("mensagem").value.trim();

  if (!item || !msg) return alert("Preencha tudo");

  estado.finalizado = true;
  salvarEstado();
  mostrarPasso("step-6");
};
