let passoAtual = 1;
let escolhaAtiva = null;

function mostrarPasso(numero) {
  document.querySelectorAll(".step").forEach(step => {
    step.classList.remove("step-active");
  });

  document.getElementById(`step-${numero}`).classList.add("step-active");
  passoAtual = numero;
}

// PASSO 1 → 2
document.getElementById("btn-nome").onclick = () => {
  const nome = document.getElementById("input-nome").value.trim();
  if (!nome) {
    alert("Digite seu nome");
    return;
  }
  mostrarPasso(2);
};

// PASSO 2 → 3 (sorteio fake por enquanto)
document.getElementById("btn-sortear").onclick = () => {
  document.getElementById("resultado-sorteio").innerText = "NOME SORTEADO";
  mostrarPasso(3);
};

// PASSO 3 → 4
document.getElementById("btn-continuar-escolha").onclick = () => {
  mostrarPasso(4);
};

// PASSO 4 — escolha
document.querySelectorAll(".choice").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".choice").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    escolhaAtiva = btn.innerText;
  };
});

document.getElementById("btn-escolha").onclick = () => {
  if (!escolhaAtiva) {
    alert("Escolha uma opção");
    return;
  }
  mostrarPasso(5);
};

// PASSO 5 → 6
document.getElementById("btn-confirmar").onclick = () => {
  const nomeItem = document.getElementById("nome-item").value.trim();
  const mensagem = document.getElementById("mensagem").value.trim();

  if (!nomeItem || !mensagem) {
    alert("Preencha todos os campos");
    return;
  }

  mostrarPasso(6);
};
