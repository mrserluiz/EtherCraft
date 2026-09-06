import { auth, firebaseConfigured } from './firebase.js';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

const guestPanel = document.getElementById('auth-guest-panel');
const accountPanel = document.getElementById('auth-account-panel');
const messageBox = document.getElementById('auth-message');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabLogin = document.getElementById('tab-login');
const tabRegister = document.getElementById('tab-register');
const forgotButton = document.getElementById('forgot-password');
const logoutButton = document.getElementById('logout-button');
const resendVerificationButton = document.getElementById('resend-verification');
const accountName = document.getElementById('account-name');
const accountEmail = document.getElementById('account-email');
const accountVerification = document.getElementById('account-verification');

window.EtherCraftAuth = window.EtherCraftAuth || { currentUser: null };

function showMessage(text, kind = 'info') {
  if (!messageBox) return;
  messageBox.textContent = text;
  messageBox.hidden = false;
  messageBox.classList.remove('is-error', 'is-success');
  if (kind === 'error') messageBox.classList.add('is-error');
  if (kind === 'success') messageBox.classList.add('is-success');
}

function clearMessage() {
  if (!messageBox) return;
  messageBox.hidden = true;
  messageBox.textContent = '';
  messageBox.classList.remove('is-error', 'is-success');
}

function setBusy(form, busy) {
  form?.querySelectorAll('button, input').forEach((element) => {
    element.disabled = busy;
  });
}

function switchTab(mode) {
  const loginMode = mode === 'login';
  loginForm.hidden = !loginMode;
  registerForm.hidden = loginMode;
  tabLogin.classList.toggle('is-active', loginMode);
  tabRegister.classList.toggle('is-active', !loginMode);
  tabLogin.setAttribute('aria-selected', String(loginMode));
  tabRegister.setAttribute('aria-selected', String(!loginMode));
  clearMessage();
}

function friendlyError(error) {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'Digite um e-mail válido.',
    'auth/email-already-in-use': 'Este e-mail já possui uma conta.',
    'auth/weak-password': 'A senha é muito fraca.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
    'auth/network-request-failed': 'Falha de conexão. Verifique sua internet.'
  };
  return messages[code] || `Não foi possível concluir a operação. (${code || 'erro desconhecido'})`;
}

function publishAuthState(user) {
  window.EtherCraftAuth.currentUser = user ? {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    emailVerified: user.emailVerified
  } : null;

  window.dispatchEvent(new CustomEvent('ethercraft:auth-changed', {
    detail: window.EtherCraftAuth.currentUser
  }));
}

function renderUser(user) {
  const logged = Boolean(user);
  if (guestPanel) guestPanel.hidden = logged;
  if (accountPanel) accountPanel.hidden = !logged;

  if (!user) return;

  accountName.textContent = user.displayName || 'Jogador';
  accountEmail.textContent = user.email || '';
  accountVerification.textContent = user.emailVerified
    ? 'E-mail verificado ✓'
    : 'E-mail ainda não verificado';

  if (resendVerificationButton) {
    resendVerificationButton.hidden = user.emailVerified;
  }
}

function goToProfile() {
  window.location.href = 'perfil.html';
}

if (!firebaseConfigured || !auth) {
  showMessage('Firebase ainda não foi conectado a esta página. Conclua o cadastro do aplicativo Web no Firebase Console e preencha js/firebase.js.', 'error');
} else {
  onAuthStateChanged(auth, (user) => {
    publishAuthState(user);
    renderUser(user);
  });
}

tabLogin?.addEventListener('click', () => switchTab('login'));
tabRegister?.addEventListener('click', () => switchTab('register'));

document.querySelectorAll('[data-password-toggle]').forEach((button) => {
  button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.passwordToggle);
    if (!target) return;
    const showing = target.type === 'text';
    target.type = showing ? 'password' : 'text';
    button.setAttribute('aria-label', showing ? 'Mostrar senha' : 'Ocultar senha');
  });
});

loginForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!auth) return;

  clearMessage();
  const data = new FormData(loginForm);
  const email = String(data.get('email') || '').trim();
  const password = String(data.get('password') || '');

  setBusy(loginForm, true);
  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
    goToProfile();
  } catch (error) {
    showMessage(friendlyError(error), 'error');
  } finally {
    setBusy(loginForm, false);
  }
});

registerForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!auth) return;

  clearMessage();
  const data = new FormData(registerForm);
  const name = String(data.get('name') || '').trim();
  const email = String(data.get('email') || '').trim();
  const password = String(data.get('password') || '');
  const confirmation = String(data.get('passwordConfirm') || '');

  if (password !== confirmation) {
    showMessage('As duas senhas precisam ser iguais.', 'error');
    return;
  }

  setBusy(registerForm, true);
  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(credential.user, { displayName: name });
    await sendEmailVerification(credential.user);
    await credential.user.reload();
    publishAuthState(auth.currentUser);
    renderUser(auth.currentUser);
    registerForm.reset();
    goToProfile();
  } catch (error) {
    showMessage(friendlyError(error), 'error');
  } finally {
    setBusy(registerForm, false);
  }
});

forgotButton?.addEventListener('click', async () => {
  if (!auth) return;
  const email = String(document.getElementById('login-email')?.value || '').trim();

  if (!email) {
    showMessage('Digite seu e-mail no campo de login antes de solicitar a recuperação.', 'error');
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage('Enviamos um e-mail para redefinir sua senha.', 'success');
  } catch (error) {
    showMessage(friendlyError(error), 'error');
  }
});

resendVerificationButton?.addEventListener('click', async () => {
  if (!auth?.currentUser) return;
  try {
    await sendEmailVerification(auth.currentUser);
    showMessage('Novo e-mail de verificação enviado.', 'success');
  } catch (error) {
    showMessage(friendlyError(error), 'error');
  }
});

logoutButton?.addEventListener('click', async () => {
  if (!auth) return;
  try {
    await signOut(auth);
    switchTab('login');
  } catch (error) {
    showMessage(friendlyError(error), 'error');
  }
});
