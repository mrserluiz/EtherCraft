// EtherCraft - Firebase
// Etapa 1: Authentication por e-mail e senha.
//
// Este arquivo usa o SDK modular do Firebase diretamente pelo navegador.
// O objeto firebaseConfig identifica o projeto Web; a segurança real fica no
// Firebase Authentication e, na Etapa 2, nas regras do Firestore.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyBShJWCeG1Z82GXiGRBr6zwv_y568Sx88I',
  authDomain: 'ethercraft-378c3.firebaseapp.com',
  projectId: 'ethercraft-378c3',
  storageBucket: 'ethercraft-378c3.firebasestorage.app',
  messagingSenderId: '930179523246',
  appId: '1:930179523246:web:64e7323ef72ac05555833f',
  measurementId: 'G-76783CTPMB'
};

export const firebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

export const app = firebaseConfigured ? initializeApp(firebaseConfig) : null;
export const auth = app ? getAuth(app) : null;

if (auth) {
  auth.useDeviceLanguage();
}
