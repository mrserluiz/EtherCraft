import { auth, firebaseConfigured } from './firebase.js';
import {
  onAuthStateChanged,
  signOut,
  updateProfile,
  reload
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const profileShell = document.getElementById('profile-shell');
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
  const fallbackText = initials(user.displayName, user.email);
  avatarFallback.textContent = fallbackText;

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

  profileLoading.hidden = true;
  profileShell.hidden = false;
}

avatar?.addEventListener('error', () => {
  avatar.hidden = true;
  avatarFallback.hidden = false;
});

if (!firebaseConfigured || !auth) {
  profileLoading.hidden = true;
  showMessage('Não foi possível conectar ao Firebase.', 'error');
} else {
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
    await signOut(auth);
    window.location.replace('login.html');
  } catch (error) {
    showMessage(`Não foi possível sair da conta. (${error?.code || 'erro desconhecido'})`, 'error');
  }
});
