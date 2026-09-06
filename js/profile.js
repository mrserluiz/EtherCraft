import { auth, firebaseConfigured, authPersistenceReady } from './firebase.js';
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  reload
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

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

const RECENT_KEY = 'ethercraftRecentPages';
const FAVORITES_KEY = 'ethercraftFavoritePages';
const ACTIVITY_KEY = 'ethercraftLastActivity';
const PROFILE_KEY_PREFIX = 'ethercraftUserProfile:';

const EMOJI_AVATARS = ['🧙','⚔️','🛡️','🏹','🪄','🐉','🐺','🦊','🐱','🐸','👑','💎','🔥','❄️','🌿','⚡','🌙','⭐','☁️','🧪'];

// Quando você adicionar PNGs oficiais, coloque os caminhos aqui.
// Exemplo: '../assets/images/avatars/mago.png'
const PHOTO_AVATARS = [];

let currentLocalProfile = null;
let pendingAvatar = null;

function profileStorageKey(uid) {
  return `${PROFILE_KEY_PREFIX}${uid}`;
}

function readLocalProfile(uid) {
  try {
    const parsed = JSON.parse(localStorage.getItem(profileStorageKey(uid)) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

function writeLocalProfile(uid, data) {
  const merged = { ...readLocalProfile(uid), ...data };
  localStorage.setItem(profileStorageKey(uid), JSON.stringify(merged));
  currentLocalProfile = merged;
  window.dispatchEvent(new CustomEvent('ethercraft:profile-updated', { detail: merged }));
  return merged;
}

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

function readList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

function writeList(key, list) {
  localStorage.setItem(key, JSON.stringify(list));
}

function makeAbsoluteSiteUrl(path) {
  try {
    return new URL(path, `${window.location.origin}/`).href;
  } catch (_) {
    return path;
  }
}

function formatVisit(timestamp) {
  if (!timestamp) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
  }).format(new Date(timestamp));
}

function isFavorite(url) {
  return readList(FAVORITES_KEY).some(item => item?.url === url);
}

function toggleFavorite(item) {
  let favorites = readList(FAVORITES_KEY).filter(entry => entry?.url);
  const exists = favorites.some(entry => entry.url === item.url);
  favorites = exists
    ? favorites.filter(entry => entry.url !== item.url)
    : [{ title: item.title || 'Página do EtherCraft', url: item.url, addedAt: Date.now() }, ...favorites];
  writeList(FAVORITES_KEY, favorites.slice(0, 12));
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
    favoriteButton.addEventListener('click', () => toggleFavorite(item));

    row.append(link, favoriteButton);
    container.appendChild(row);
  });
}

function renderNavigationData() {
  renderPageList(favoritesContainer, readList(FAVORITES_KEY), 'Você ainda não favoritou nenhuma página.');
  renderPageList(recentContainer, readList(RECENT_KEY).slice(0, 6), 'Nenhuma página recente registrada ainda.', true);
}

function renderAvatarOptions() {
  avatarEmojiGrid.replaceChildren();
  EMOJI_AVATARS.forEach(value => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'avatar-option';
    button.textContent = value;
    button.setAttribute('aria-label', `Usar ${value} como avatar`);
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
  currentLocalProfile = readLocalProfile(user.uid);
  if (!currentLocalProfile.avatar) {
    currentLocalProfile.avatar = { type: 'emoji', value: '🧙' };
    writeLocalProfile(user.uid, currentLocalProfile);
  }

  nameText.textContent = user.displayName || 'Jogador';
  minecraftNameText.textContent = `Minecraft: ${currentLocalProfile.minecraftName || '—'}`;
  emailText.textContent = user.email || '';
  verificationText.textContent = user.emailVerified ? 'E-mail verificado ✓' : 'E-mail ainda não verificado';
  verificationText.classList.toggle('is-verified', user.emailVerified);

  nameInput.value = user.displayName || '';
  minecraftNameInput.value = currentLocalProfile.minecraftName || '';
  renderAvatarChoice(currentLocalProfile.avatar);
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
  pendingAvatar = currentLocalProfile?.avatar || { type: 'emoji', value: '🧙' };
  renderAvatarOptions();
  avatarDialog.showModal();
});

avatarCloseButton?.addEventListener('click', () => {
  if (!auth?.currentUser) return;
  const avatarChoice = pendingAvatar || { type: 'emoji', value: '🧙' };
  currentLocalProfile = writeLocalProfile(auth.currentUser.uid, { avatar: avatarChoice });
  renderAvatarChoice(avatarChoice);
  avatarDialog.close();
  showMessage('Foto de perfil atualizada.', 'success');
});

if (!firebaseConfigured || !auth) {
  profileLoading.hidden = true;
  showMessage('Não foi possível conectar ao Firebase.', 'error');
} else {
  await authPersistenceReady;
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }

    try { await reload(user); } catch (_) {}
    renderUser(auth.currentUser || user);
  });
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!auth?.currentUser) return;

  clearMessage();
  const displayName = nameInput.value.trim();
  const minecraftName = minecraftNameInput.value.trim();
  const submitButton = form.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  try {
    await updateProfile(auth.currentUser, { displayName, photoURL: null });
    currentLocalProfile = writeLocalProfile(auth.currentUser.uid, { minecraftName });
    await reload(auth.currentUser);
    renderUser(auth.currentUser);
    showMessage('Perfil atualizado com sucesso.', 'success');
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
