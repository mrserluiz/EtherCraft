// EtherCraft - Firebase
// Etapa 1: Authentication por e-mail e senha.
//
// IMPORTANTE:
// 1. No Firebase Console, registre um aplicativo Web para o projeto EtherCraft.
// 2. Copie SOMENTE os valores do objeto firebaseConfig fornecido pelo Firebase.
// 3. Substitua os valores abaixo. O Firebase Web config não é uma senha de administrador.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

export const firebaseConfig = {
  apiKey: 'COLE_AQUI',
  authDomain: 'COLE_AQUI',
  projectId: 'COLE_AQUI',
  storageBucket: 'COLE_AQUI',
  messagingSenderId: 'COLE_AQUI',
  appId: 'COLE_AQUI'
};

export const firebaseConfigured = Object.values(firebaseConfig).every(
  (value) => value && value !== 'COLE_AQUI'
);

export const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;

if (auth) {
  auth.useDeviceLanguage();
}
