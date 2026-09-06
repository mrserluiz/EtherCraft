/* EtherCraft - comportamentos globais + conta Firebase */
document.addEventListener('DOMContentLoaded', () => {
  initHeaderFade();
  initSmoothAnchors();
  initLocalVisitHistory();
  initAccountSystem();
});

const ETHERCRAFT_INACTIVITY_LIMIT = 12 * 60 * 60 * 1000;
const ETHERCRAFT_ACTIVITY_KEY = 'ethercraftLastActivity';
const ETHERCRAFT_RECENT_KEY = 'ethercraftRecentPages';
const ETHERCRAFT_FAVORITES_KEY = 'ethercraftFavoritePages';
const ETHERCRAFT_PROFILE_PREFIX = 'ethercraftUserProfile:';

function initHeaderFade() {
  const header = document.querySelector('[data-scroll-header]');
  if (!header) return;
  const fadeLimitRatio = 0.25;
  let ticking = false;
  function update() {
    header.classList.toggle('is-hidden', window.scrollY > window.innerHeight * fadeLimitRatio);
    document.body.classList.toggle('is-header-hidden', window.scrollY > window.innerHeight * fadeLimitRatio);
    ticking = false;
  }
  function requestUpdate() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }
  update();
  addEventListener('scroll', requestUpdate, { passive: true });
  addEventListener('resize', requestUpdate);
}

function initSmoothAnchors() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', id);
    });
  });
}

function getSitePrefix() {
  const path = location.pathname;
  if (path.includes('/pages/wiki/')) return '../../';
  if (path.includes('/pages/')) return '../';
  return './';
}

function readJson(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
  catch (_) { return fallback; }
}

function getFriendlyPageTitle() {
  const raw = document.title.replace(/\s*\|\s*EtherCraft\s*/i, '').replace(/EtherCraft\s*\|\s*/i, '').trim();
  return raw || 'EtherCraft';
}

function currentVisit() {
  const url = new URL(location.href);
  if (!url.pathname.includes('/EtherCraft/')) return null;
  if (url.pathname.endsWith('/login.html') || url.pathname.endsWith('/perfil.html')) return null;
  return { title: getFriendlyPageTitle(), url: `${url.pathname}${url.hash || ''}`, visitedAt: Date.now() };
}

function initLocalVisitHistory() {
  const item = currentVisit();
  if (!item) return;
  const recent = readJson(ETHERCRAFT_RECENT_KEY, []).filter(entry => entry?.url && entry.url !== item.url);
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
  const check = async () => {
    if (!auth.currentUser) return;
    const last = Number(localStorage.getItem(ETHERCRAFT_ACTIVITY_KEY) || 0);
    if (!last) return markActivity();
    if (Date.now() - last >= ETHERCRAFT_INACTIVITY_LIMIT) {
      localStorage.removeItem(ETHERCRAFT_ACTIVITY_KEY);
      await signOut(auth);
    }
  };
  ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach(name => addEventListener(name, markActivity, { passive: true }));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(check, 5 * 60 * 1000);
  check();
}

function updateAccountNavigation(user, prefix) {
  document.querySelectorAll('.nav-shell').forEach(nav => {
    const links = [...nav.querySelectorAll('.nav-link')];
    const account = links.find(link => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent.trim().toLowerCase();
      return /(?:login|perfil)\.html(?:$|[?#])/.test(href) || text === 'login' || text === 'perfil';
    });
    if (!account) return;
    const wiki = links.find(link => /wiki\.html(?:$|[?#])/.test(link.getAttribute('href') || ''));
    account.textContent = user ? 'Perfil' : 'Login';
    account.href = new URL(`${prefix}pages/${user ? 'perfil.html' : 'login.html'}`, location.href).href;
    const current = location.pathname.toLowerCase();
    const selected = user ? current.endsWith('/perfil.html') : current.endsWith('/login.html');
    if (selected) account.setAttribute('aria-current', 'page');
    else account.removeAttribute('aria-current');
    if (wiki) nav.appendChild(wiki);
    nav.appendChild(account);
  });
}

function renderProfileShortcut(shortcut, profile) {
  shortcut.replaceChildren();
  const choice = profile?.avatar || { type: 'emoji', value: '🧙' };
  if (choice.type === 'photo' && choice.value) {
    const image = document.createElement('img');
    image.src = choice.value;
    image.alt = '';
    image.addEventListener('error', () => {
      shortcut.replaceChildren();
      const span = document.createElement('span');
      span.className = 'profile-shortcut-fallback';
      span.textContent = '🧙';
      shortcut.appendChild(span);
    });
    shortcut.appendChild(image);
  } else {
    const span = document.createElement('span');
    span.className = 'profile-shortcut-fallback';
    span.textContent = choice.value || '🧙';
    shortcut.appendChild(span);
  }
}

async function initAccountSystem() {
  try {
    const prefix = getSitePrefix();
    const firebaseUrl = new URL(`${prefix}js/firebase.js`, location.href).href;
    const { auth, db, firebaseConfigured, authPersistenceReady } = await import(firebaseUrl);
    if (!firebaseConfigured || !auth || !db) return;
    await authPersistenceReady;

    const authModule = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js');
    const fs = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');
    registerActivityTracking(auth, authModule.signOut);

    window.EtherCraftAuth = window.EtherCraftAuth || { currentUser: null };

    async function ensureProfile(user) {
      const ref = fs.doc(db, 'usuarios', user.uid);
      let snap = await fs.getDoc(ref);
      if (!snap.exists()) {
        const legacy = readJson(`${ETHERCRAFT_PROFILE_PREFIX}${user.uid}`, {});
        await fs.setDoc(ref, {
          nome: user.displayName || 'Jogador',
          email: user.email || '',
          minecraftNick: legacy.minecraftName || '',
          avatar: legacy.avatar || { type: 'emoji', value: '🧙' },
          role: 'player',
          favoritos: readJson(ETHERCRAFT_FAVORITES_KEY, []),
          recentes: readJson(ETHERCRAFT_RECENT_KEY, []),
          criadoEm: fs.serverTimestamp()
        });
        snap = await fs.getDoc(ref);
      }
      return { ref, data: snap.data() };
    }

    async function syncVisit(ref, profile) {
      const item = currentVisit();
      if (!item) return profile;
      const recentes = (profile.recentes || []).filter(entry => entry?.url && entry.url !== item.url);
      recentes.unshift(item);
      const trimmed = recentes.slice(0, 12);
      await fs.updateDoc(ref, { recentes: trimmed });
      return { ...profile, recentes: trimmed };
    }

    authModule.onAuthStateChanged(auth, async user => {
      updateAccountNavigation(user, prefix);
      let shortcut = document.getElementById('profile-shortcut');
      if (!user) {
        window.EtherCraftAuth.currentUser = null;
        window.dispatchEvent(new CustomEvent('ethercraft:auth-changed', { detail: null }));
        shortcut?.remove();
        return;
      }

      if (!localStorage.getItem(ETHERCRAFT_ACTIVITY_KEY)) localStorage.setItem(ETHERCRAFT_ACTIVITY_KEY, String(Date.now()));

      let profileInfo;
      try {
        profileInfo = await ensureProfile(user);
        profileInfo.data = await syncVisit(profileInfo.ref, profileInfo.data);
      } catch (error) {
        console.warn('EtherCraft: falha ao carregar perfil Firestore.', error);
        profileInfo = { data: { role: 'player', avatar: { type: 'emoji', value: '🧙' } } };
      }

      window.EtherCraftAuth.currentUser = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || '',
        emailVerified: user.emailVerified,
        role: profileInfo.data.role || 'player'
      };
      window.dispatchEvent(new CustomEvent('ethercraft:auth-changed', { detail: window.EtherCraftAuth.currentUser }));

      if (!shortcut) {
        shortcut = document.createElement('a');
        shortcut.id = 'profile-shortcut';
        shortcut.className = 'profile-shortcut';
        shortcut.href = new URL(`${prefix}pages/perfil.html`, location.href).href;
        shortcut.setAttribute('aria-label', 'Abrir meu perfil');
        shortcut.title = 'Meu perfil';
        document.body.appendChild(shortcut);
      }
      renderProfileShortcut(shortcut, profileInfo.data);
    });
  } catch (error) {
    console.warn('EtherCraft: não foi possível inicializar a conta global.', error);
  }
}

window.EtherCraftProfileData = {
  recentKey: ETHERCRAFT_RECENT_KEY,
  favoritesKey: ETHERCRAFT_FAVORITES_KEY
};
