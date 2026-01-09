/* =========================================================
   EtherCraft - main.js
   UI Global | Mobile Menu | Smooth Scroll | SPA Base
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  initMobileMenu();
  initSmoothScroll();
  initSpaNavigation(); // opcional, não quebra navegação normal
});

/* =========================================================
   MENU MOBILE
   ========================================================= */
function initMobileMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const nav = document.querySelector(".main-nav");

  if (!toggle || !nav) return;

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");
    toggle.classList.toggle("active", isOpen);
    toggle.setAttribute("aria-expanded", isOpen);
  });

  // Fecha menu ao clicar em link (mobile)
  nav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.classList.remove("active");
      toggle.setAttribute("aria-expanded", "false");
    });
  });
}

/* =========================================================
   SCROLL SUAVE PARA ÂNCORAS
   ========================================================= */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");

      if (targetId.length <= 1) return;

      const target = document.querySelector(targetId);
      if (!target) return;

      e.preventDefault();

      target.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });

      // Atualiza URL sem pular
      history.pushState(null, "", targetId);
    });
  });
}

/* =========================================================
   SPA LEVE (OPCIONAL)
   - Só funciona se data-spa="true" estiver no <body>
   - Fallback automático para navegação normal
   ========================================================= */
function initSpaNavigation() {
  const isSpaEnabled = document.body.dataset.spa === "true";
  if (!isSpaEnabled) return;

  const content = document.querySelector("#spa-content");
  if (!content) return;

  document.querySelectorAll("a[data-spa-link]").forEach(link => {
    link.addEventListener("click", async e => {
      const url = link.getAttribute("href");
      if (!url || url.startsWith("#")) return;

      e.preventDefault();
      loadSpaPage(url);
    });
  });

  window.addEventListener("popstate", () => {
    loadSpaPage(location.pathname, false);
  });
}

/* =========================================================
   CARREGAMENTO SPA
   ========================================================= */
async function loadSpaPage(url, pushState = true) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("Falha ao carregar página");

    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const newContent = doc.querySelector("#spa-content");
    if (!newContent) throw new Error("Conteúdo SPA não encontrado");

    document.querySelector("#spa-content").innerHTML = newContent.innerHTML;

    if (pushState) {
      history.pushState(null, "", url);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (err) {
    console.error("[SPA]", err);
    window.location.href = url; // fallback seguro
  }
}

