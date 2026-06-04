/*
  EtherCraft - main.js
  Comportamentos globais leves e compativeis com GitHub Pages.
*/
document.addEventListener("DOMContentLoaded", () => {
  initHeaderFade();
  initSmoothAnchors();
});

/*
  HEADER COM FADE
  Para alterar quando a logo desaparece, ajuste fadeLimitRatio.
  0.25 significa aproximadamente 25% da altura visivel da tela.
  Quando a logo some, a classe body.is-header-hidden faz o menu subir para o topo.
*/
function initHeaderFade() {
  const header = document.querySelector("[data-scroll-header]");
  if (!header) return;

  const fadeLimitRatio = 0.25;
  let ticking = false;

  function updateHeaderState() {
    const fadeLimit = window.innerHeight * fadeLimitRatio;
    const shouldHide = window.scrollY > fadeLimit;

    header.classList.toggle("is-hidden", shouldHide);
    document.body.classList.toggle("is-header-hidden", shouldHide);
    ticking = false;
  }

  function requestHeaderUpdate() {
    if (ticking) return;

    ticking = true;
    window.requestAnimationFrame(updateHeaderState);
  }

  updateHeaderState();
  window.addEventListener("scroll", requestHeaderUpdate, { passive: true });
  window.addEventListener("resize", requestHeaderUpdate);
}

/*
  ROLAGEM SUAVE
  Para adicionar novos links internos, use href="#id-da-secao" no HTML.
  O deslocamento do alvo e definido no reset.css com :target.
*/
function initSmoothAnchors() {
  const internalLinks = document.querySelectorAll('a[href^="#"]');

  internalLinks.forEach(link => {
    link.addEventListener("click", event => {
      const targetId = link.getAttribute("href");
      if (!targetId || targetId === "#") return;

      const target = document.querySelector(targetId);
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      history.pushState(null, "", targetId);
    });
  });
}
