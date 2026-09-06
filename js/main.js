/*
  EtherCraft - main.js
  Comportamentos globais leves e compativeis com GitHub Pages.
*/
document.addEventListener("DOMContentLoaded", () => {
  initHeaderFade();
  initSmoothAnchors();
  initProfileShortcut();
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

function getSitePrefix() {
  const path = window.location.pathname;
  if (path.includes('/pages/wiki/')) return '../../';
  if (path.includes('/pages/')) return '../';
  return './';
}

function getInitials(name, email) {
  const source = (name || email || 'J').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

async function initProfileShortcut() {
  try {
    const prefix = getSitePrefix();
    const firebaseUrl = new URL(`${prefix}js/firebase.js`, window.location.href).href;
    const { auth, firebaseConfigured } = await import(firebaseUrl);
    if (!firebaseConfigured || !auth) return;

    const authModule = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');

    authModule.onAuthStateChanged(auth, (user) => {
      let shortcut = document.getElementById('profile-shortcut');

      if (!user) {
        shortcut?.remove();
        return;
      }

      if (!shortcut) {
        shortcut = document.createElement('a');
        shortcut.id = 'profile-shortcut';
        shortcut.className = 'profile-shortcut';
        shortcut.href = new URL(`${prefix}pages/perfil.html`, window.location.href).href;
        shortcut.setAttribute('aria-label', 'Abrir meu perfil');
        shortcut.title = 'Meu perfil';
        document.body.appendChild(shortcut);
      }

      shortcut.replaceChildren();

      const fallback = document.createElement('span');
      fallback.className = 'profile-shortcut-fallback';
      fallback.textContent = getInitials(user.displayName, user.email);

      if (user.photoURL) {
        const image = document.createElement('img');
        image.src = user.photoURL;
        image.alt = '';
        image.addEventListener('error', () => {
          image.remove();
          if (!shortcut.contains(fallback)) shortcut.appendChild(fallback);
        });
        shortcut.appendChild(image);
      } else {
        shortcut.appendChild(fallback);
      }
    });
  } catch (error) {
    console.warn('EtherCraft: não foi possível carregar o atalho de perfil.', error);
  }
}
