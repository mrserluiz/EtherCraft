/*
  EtherCraft - main.js
  Comportamentos globais leves e compativeis com GitHub Pages.
*/
document.addEventListener("DOMContentLoaded", () => {
  initHeaderFade();
  initSmoothAnchors();
  initVisitHistory();
  initProfileShortcut();
});

const ETHERCRAFT_INACTIVITY_LIMIT = 12 * 60 * 60 * 1000;
const ETHERCRAFT_ACTIVITY_KEY = 'ethercraftLastActivity';
const ETHERCRAFT_RECENT_KEY = 'ethercraftRecentPages';
const ETHERCRAFT_FAVORITES_KEY = 'ethercraftFavoritePages';

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

function readJsonStorage(key, fallback = []) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return Array.isArray(value) ? value : fallback;
  } catch (_) {
    return fallback;
  }
}

function getFriendlyPageTitle() {
  const raw = document.title.replace(/\s*\|\s*EtherCraft\s*/i, '').replace(/EtherCraft\s*\|\s*/i, '').trim();
  return raw || 'EtherCraft';
}

function initVisitHistory() {
  const url = new URL(window.location.href);
  if (!url.pathname.includes('/EtherCraft/')) return;
  if (url.pathname.endsWith('/login.html') || url.pathname.endsWith('/perfil.html')) return;

  const item = {
    title: getFriendlyPageTitle(),
    url: `${url.pathname}${url.hash || ''}`,
    visitedAt: Date.now()
  };

  const recent = readJsonStorage(ETHERCRAFT_RECENT_KEY)
    .filter(entry => entry?.url && entry.url !== item.url);

  recent.unshift(item);
  localStorage.setItem(ETHERCRAFT_RECENT_KEY, JSON.stringify(recent.slice(0, 12)));
}

function registerActivityTracking(auth, signOut) {
  let lastWrite = 0;

  const markActivity = () => {
    const now = Date.now();
    if (now - lastWrite < 30000) return;
    lastWrite = now;
    localStorage.setItem(ETHERCRAFT_ACTIVITY_KEY, String(now));
  };

  const checkInactivity = async () => {
    if (!auth.currentUser) return;
    const lastActivity = Number(localStorage.getItem(ETHERCRAFT_ACTIVITY_KEY) || 0);

    if (!lastActivity) {
      markActivity();
      return;
    }

    if (Date.now() - lastActivity >= ETHERCRAFT_INACTIVITY_LIMIT) {
      localStorage.removeItem(ETHERCRAFT_ACTIVITY_KEY);
      await signOut(auth);
      return;
    }
  };

  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(eventName => {
    window.addEventListener(eventName, markActivity, { passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) checkInactivity();
  });

  window.setInterval(checkInactivity, 5 * 60 * 1000);
  checkInactivity();
}

async function initProfileShortcut() {
  try {
    const prefix = getSitePrefix();
    const firebaseUrl = new URL(`${prefix}js/firebase.js`, window.location.href).href;
    const { auth, firebaseConfigured, authPersistenceReady } = await import(firebaseUrl);
    if (!firebaseConfigured || !auth) return;

    await authPersistenceReady;

    const authModule = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');
    registerActivityTracking(auth, authModule.signOut);

    authModule.onAuthStateChanged(auth, (user) => {
      let shortcut = document.getElementById('profile-shortcut');

      if (!user) {
        shortcut?.remove();
        return;
      }

      if (!localStorage.getItem(ETHERCRAFT_ACTIVITY_KEY)) {
        localStorage.setItem(ETHERCRAFT_ACTIVITY_KEY, String(Date.now()));
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

window.EtherCraftProfileData = {
  recentKey: ETHERCRAFT_RECENT_KEY,
  favoritesKey: ETHERCRAFT_FAVORITES_KEY
};
