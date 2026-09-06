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
const nameText = document.getElementById('profile-name');
const emailText = document.getElementById('profile-email');
const verificationText = document.getElementById('profile-verification');
const form = document.getElementById('profile-form');
const nameInput = document.getElementById('profile-display-name');
const photoInput = document.getElementById('profile-photo-url');
const logoutButton = document.getElementById('profile-logout');
const removePhotoButton = document.getElementById('remove-photo');
const favoritesContainer = document.getElementById('profile-favorites');
const recentContainer = document.getElementById('profile-recent');

const RECENT_KEY = 'ethercraftRecentPages';
const FAVORITES_KEY = 'ethercraftFavoritePages';
const ACTIVITY_KEY = 'ethercraftLastActivity';

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

function initials(name, email) {
  const source = (name || email || 'J').trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

function renderAvatar(user) {
  avatarFallback.textContent = initials(user.displayName, user.email);

  if (user.photoURL) {
    avatar.src = user.photoURL;
    avatar.alt = `Foto de perfil de ${user.displayName || 'jogador'}`;
    avatar.hidden = false;
    avatarFallback.hidden = true;
  } else {
    avatar.removeAttribute('src');
    avatar.hidden = true;
    avatarFallback.hidden = false;
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
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(timestamp));
}

function isFavorite(url) {
  return readList(FAVORITES_KEY).some(item => item?.url === url);
}

function toggleFavorite(item) {
  let favorites = readList(FAVORITES_KEY).filter(entry => entry?.url);
  const exists = favorites.some(entry => entry.url === item.url);

  if (exists) {
    favorites = favorites.filter(entry => entry.url !== item.url);
  } else {
    favorites.unshift({
      title: item.title || 'Página do EtherCraft',
      url: item.url,
      addedAt: Date.now()
    });
  }

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
    favoriteButton.title = favoriteButton.getAttribute('aria-label');
    favoriteButton.addEventListener('click', () => toggleFavorite(item));

    row.append(link, favoriteButton);
    container.appendChild(row);
  });
}

function renderNavigationData() {
  const favorites = readList(FAVORITES_KEY);
  const recent = readList(RECENT_KEY).slice(0, 6);

  renderPageList(favoritesContainer, favorites, 'Você ainda não favoritou nenhuma página.');
  renderPageList(recentContainer, recent, 'Nenhuma página recente registrada ainda.', true);
}

function renderUser(user) {
  nameText.textContent = user.displayName || 'Jogador';
  emailText.textContent = user.email || '';
  verificationText.textContent = user.emailVerified
    ? 'E-mail verificado ✓'
    : 'E-mail ainda não verificado';
  verificationText.classList.toggle('is-verified', user.emailVerified);

  nameInput.value = user.displayName || '';
  photoInput.value = user.photoURL || '';
  renderAvatar(user);
  renderNavigationData();

  profileLoading.hidden = true;
  profileShell.hidden = false;
  if (profileDashboard) profileDashboard.hidden = false;
}

avatar?.addEventListener('error', () => {
  avatar.hidden = true;
  avatarFallback.hidden = false;
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

    try {
      await reload(user);
    } catch (_) {
      // Mantém os dados em cache caso a atualização remota falhe momentaneamente.
    }

    renderUser(auth.currentUser || user);
  });
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!auth?.currentUser) return;

  clearMessage();
  const displayName = nameInput.value.trim();
  const photoURL = photoInput.value.trim();
  const submitButton = form.querySelector('button[type="submit"]');

  submitButton.disabled = true;
  try {
    await updateProfile(auth.currentUser, {
      displayName,
      photoURL: photoURL || null
    });
    await reload(auth.currentUser);
    renderUser(auth.currentUser);
    showMessage('Perfil atualizado com sucesso.', 'success');
  } catch (error) {
    showMessage(`Não foi possível atualizar o perfil. (${error?.code || 'erro desconhecido'})`, 'error');
  } finally {
    submitButton.disabled = false;
  }
});

removePhotoButton?.addEventListener('click', async () => {
  if (!auth?.currentUser) return;

  clearMessage();
  removePhotoButton.disabled = true;
  try {
    await updateProfile(auth.currentUser, { photoURL: null });
    photoInput.value = '';
    renderUser(auth.currentUser);
    showMessage('Foto de perfil removida.', 'success');
  } catch (error) {
    showMessage(`Não foi possível remover a foto. (${error?.code || 'erro desconhecido'})`, 'error');
  } finally {
    removePhotoButton.disabled = false;
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
