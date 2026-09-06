import { auth, db, firebaseConfigured, authPersistenceReady } from './firebase.js';
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  reload
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const profileShell = document.getElementById('profile-shell');
const profileDashboard = document.getElementById('profile-dashboard');
const profileLoading = document.getElementById('profile-loading');
const profileMessage = document.getElementById('profile-message');
const avatar = document.getElementById('profile-avatar');
const avatarFallback = document.getElementById('profile-avatar-fallback');
const editAvatarButton = document.getElementById('edit-avatar');
const avatarDialog = document.getElementById('avatar-dialog');
const avatarEmojiGrid = document.getElementById('avatar-emoji-grid');
const avatarPhotoGrid = document.getElementById('avatar-photo-grid');
const avatarPhotoEmpty = document.getElementById('avatar-photo-empty');
const avatarCloseButton = document.getElementById('avatar-close');
const adminLink = document.getElementById('profile-admin-link');
const profileIdentity = document.getElementById('profile-identity');
const nameText = document.getElementById('profile-name');
const minecraftNameText = document.getElementById('profile-minecraft-name');
const emailText = document.getElementById('profile-email');
const verificationText = document.getElementById('profile-verification');
const form = document.getElementById('profile-form');
const nameInput = document.getElementById('profile-display-name');
const minecraftNameInput = document.getElementById('profile-minecraft-input');
const logoutButton = document.getElementById('profile-logout');
const favoritesContainer = document.getElementById('profile-favorites');
const recentContainer = document.getElementById('profile-recent');

document.querySelector('.profile-link[href="wiki.html"]')?.remove();

const RECENT_KEY = 'ethercraftRecentPages';
const FAVORITES_KEY = 'ethercraftFavoritePages';
const ACTIVITY_KEY = 'ethercraftLastActivity';
const PROFILE_KEY_PREFIX = 'ethercraftUserProfile:';
const EMOJI_AVATARS = ['🧙','⚔️','🛡️','🏹','🪄','🐉','🐺','🦊','🐱','🐸','👑','💎','🔥','❄️','🌿','⚡','🌙','⭐','☁️','🧪'];
const PHOTO_AVATARS = [];

let currentProfile = null;
let pendingAvatar = null;

function showMessage(text, kind = 'info') {
  if (!profileMessage) return;
  profileMessage.textContent = text;
  profileMessage.hidden = false;
  profileMessage.classList.remove('is-error', 'is-success');
  if (kind === 'error') profileMessage.classList.add('is-error');
  if (kind === 'success') profileMessage.classList.add('is-success');
}

function clearMessage() {
  if (!profileMessage) return;
  profileMessage.hidden = true;
  profileMessage.textContent = '';
  profileMessage.classList.remove('is-error', 'is-success');
}

function readLocalJson(key, fallback) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || 'null');
    return parsed ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function localProfile(uid) {
  return readLocalJson(`${PROFILE_KEY_PREFIX}${uid}`, {});
}

async function ensureFirestoreProfile(user) {
  const ref = doc(db, 'usuarios', user.uid);
  const snap = await getDoc(ref);
  if (snap.exists()) return snap.data();

  const legacy = localProfile(user.uid);
  const data = {
    nome: user.displayName || 'Jogador',
    email: user.email || '',
    minecraftNick: legacy.minecraftName || '',
    avatar: legacy.avatar || { type: 'emoji', value: '🧙' },
    role: 'player',
    favoritos: readLocalJson(FAVORITES_KEY, []),
    recentes: readLocalJson(RECENT_KEY, []),
    criadoEm: serverTimestamp()
  };
  await setDoc(ref, data);
  const created = await getDoc(ref);
  return created.data();
}

function renderAvatarChoice(choice) {
  const selected = choice || { type: 'emoji', value: '🧙' };
  if (selected.type === 'photo' && selected.value) {
    avatar.src = selected.value;
    avatar.alt = 'Avatar do jogador';
    avatar.hidden = false;
    avatarFallback.hidden = true;
  } else {
    avatar.removeAttribute('src');
    avatar.hidden = true;
    avatarFallback.hidden = false;
    avatarFallback.textContent = selected.value || '🧙';
  }
}

function makeAbsoluteSiteUrl(path) {
  try { return new URL(path, `${window.location.origin}/`).href; }
  catch (_) { return path; }
}

function formatVisit(timestamp) {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(timestamp));
}

function isFavorite(url) {
  return (currentProfile?.favoritos || []).some(item => item?.url === url);
}

async function toggleFavorite(item) {
  if (!auth?.currentUser || !currentProfile) return;
  let favorites = (currentProfile.favoritos || []).filter(entry => entry?.url);
  const exists = favorites.some(entry => entry.url === item.url);
  favorites = exists
    ? favorites.filter(entry => entry.url !== item.url)
    : [{ title: item.title || 'Página do EtherCraft', url: item.url, addedAt: Date.now() }, ...favorites];
  favorites = favorites.slice(0, 12);
  await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { favoritos: favorites });
  currentProfile.favoritos = favorites;
  renderNavigationData();
}

function renderPageList(container, items, emptyText, showVisitedAt = false) {
  if (!container) return;
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'profile-empty';
    empty.textContent = emptyText;
    container.appendChild(empty);
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'profile-page-item';
    const link = document.createElement('a');
    link.href = makeAbsoluteSiteUrl(item.url);
    link.textContent = item.title || 'Página do EtherCraft';
    if (showVisitedAt && item.visitedAt) {
      const meta = document.createElement('small');
      meta.textContent = `Visitada em ${formatVisit(item.visitedAt)}`;
      link.appendChild(meta);
    }
    const favoriteButton = document.createElement('button');
    favoriteButton.type = 'button';
    favoriteButton.className = 'profile-favorite-toggle';
    favoriteButton.textContent = isFavorite(item.url) ? '★' : '☆';
    favoriteButton.setAttribute('aria-label', isFavorite(item.url) ? 'Remover dos favoritos' : 'Adicionar aos favoritos');
    favoriteButton.addEventListener('click', async () => {
      favoriteButton.disabled = true;
      try { await toggleFavorite(item); }
      catch (error) { showMessage(`Não foi possível atualizar favoritos. (${error?.code || 'erro'})`, 'error'); }
      finally { favoriteButton.disabled = false; }
    });
    row.append(link, favoriteButton);
    container.appendChild(row);
  });
}

function renderNavigationData() {
  renderPageList(favoritesContainer, currentProfile?.favoritos || [], 'Você ainda não favoritou nenhuma página.');
  renderPageList(recentContainer, (currentProfile?.recentes || []).slice(0, 6), 'Nenhuma página recente registrada ainda.', true);
}

function renderAvatarOptions() {
  avatarEmojiGrid.replaceChildren();
  EMOJI_AVATARS.forEach(value => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'avatar-option';
    button.textContent = value;
    if (pendingAvatar?.type === 'emoji' && pendingAvatar.value === value) button.classList.add('is-selected');
    button.addEventListener('click', () => {
      pendingAvatar = { type: 'emoji', value };
      renderAvatarOptions();
    });
    avatarEmojiGrid.appendChild(button);
  });

  avatarPhotoGrid.replaceChildren();
  PHOTO_AVATARS.forEach(path => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'avatar-option';
    if (pendingAvatar?.type === 'photo' && pendingAvatar.value === path) button.classList.add('is-selected');
    const image = document.createElement('img');
    image.src = path;
    image.alt = 'Avatar oficial do EtherCraft';
    button.appendChild(image);
    button.addEventListener('click', () => {
      pendingAvatar = { type: 'photo', value: path };
      renderAvatarOptions();
    });
    avatarPhotoGrid.appendChild(button);
  });
  avatarPhotoEmpty.hidden = PHOTO_AVATARS.length > 0;
}

function renderUser(user) {
  const isAdmin = currentProfile?.role === 'admin';

  if (adminLink) adminLink.hidden = !isAdmin;
  profileIdentity?.classList.toggle('is-admin', isAdmin);

  nameText.textContent = user.displayName || currentProfile?.nome || 'Jogador';
  minecraftNameText.textContent = `Minecraft: ${currentProfile?.minecraftNick || '—'}`;
  emailText.textContent = user.email || '';
  verificationText.textContent = user.emailVerified ? 'E-mail verificado ✓' : 'E-mail ainda não verificado';
  verificationText.classList.toggle('is-verified', user.emailVerified);
  nameInput.value = user.displayName || currentProfile?.nome || '';
  minecraftNameInput.value = currentProfile?.minecraftNick || '';
  renderAvatarChoice(currentProfile?.avatar);
  renderNavigationData();
  profileLoading.hidden = true;
  profileShell.hidden = false;
  if (profileDashboard) profileDashboard.hidden = false;
}

avatar?.addEventListener('error', () => {
  avatar.hidden = true;
  avatarFallback.hidden = false;
  avatarFallback.textContent = '🧙';
});

editAvatarButton?.addEventListener('click', () => {
  if (!auth?.currentUser) return;
  pendingAvatar = currentProfile?.avatar || { type: 'emoji', value: '🧙' };
  renderAvatarOptions();
  avatarDialog.showModal();
});

avatarCloseButton?.addEventListener('click', async () => {
  if (!auth?.currentUser) return;
  const avatarChoice = pendingAvatar || { type: 'emoji', value: '🧙' };
  avatarCloseButton.disabled = true;
  try {
    await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), { avatar: avatarChoice });
    currentProfile.avatar = avatarChoice;
    renderAvatarChoice(avatarChoice);
    avatarDialog.close();
    window.dispatchEvent(new CustomEvent('ethercraft:profile-updated', { detail: currentProfile }));
    showMessage('Foto de perfil atualizada.', 'success');
  } catch (error) {
    showMessage(`Não foi possível salvar o avatar. (${error?.code || 'erro'})`, 'error');
  } finally {
    avatarCloseButton.disabled = false;
  }
});

if (!firebaseConfigured || !auth || !db) {
  profileLoading.hidden = true;
  showMessage('Não foi possível conectar ao Firebase/Firestore.', 'error');
} else {
  await authPersistenceReady;
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    try {
      await reload(user);
      currentProfile = await ensureFirestoreProfile(auth.currentUser || user);
      renderUser(auth.currentUser || user);
    } catch (error) {
      profileLoading.hidden = true;
      showMessage(`Não foi possível carregar seu perfil no Firestore. (${error?.code || 'erro'})`, 'error');
    }
  });
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!auth?.currentUser || !db) return;
  clearMessage();
  const displayName = nameInput.value.trim();
  const minecraftName = minecraftNameInput.value.trim();
  const submitButton = form.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    await updateProfile(auth.currentUser, { displayName, photoURL: null });
    await updateDoc(doc(db, 'usuarios', auth.currentUser.uid), {
      nome: displayName,
      email: auth.currentUser.email || '',
      minecraftNick: minecraftName
    });
    currentProfile.nome = displayName;
    currentProfile.minecraftNick = minecraftName;
    await reload(auth.currentUser);
    renderUser(auth.currentUser);
    showMessage('Perfil atualizado no Firebase.', 'success');
  } catch (error) {
    showMessage(`Não foi possível atualizar o perfil. (${error?.code || 'erro desconhecido'})`, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

logoutButton?.addEventListener('click', async () => {
  if (!auth) return;
  try {
    localStorage.removeItem(ACTIVITY_KEY);
    await signOut(auth);
    window.location.replace('login.html');
  } catch (error) {
    showMessage(`Não foi possível sair da conta. (${error?.code || 'erro desconhecido'})`, 'error');
  }
});
