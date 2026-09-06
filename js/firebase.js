// EtherCraft - Firebase
// Authentication + Cloud Firestore com sessão persistente no navegador.

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js';
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

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
export const db = app ? getFirestore(app) : null;

export const authPersistenceReady = auth
  ? setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('EtherCraft: não foi possível definir persistência local da sessão.', error);
    })
  : Promise.resolve();

if (auth) {
  auth.useDeviceLanguage();
}
