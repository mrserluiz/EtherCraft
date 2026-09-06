import { auth, db, firebaseConfigured, authPersistenceReady } from './firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js';

const message = document.getElementById('admin-message');
const usersCard = document.getElementById('admin-users-card');
const usersBody = document.getElementById('admin-users-body');
const usersEmpty = document.getElementById('admin-users-empty');
const userCount = document.getElementById('admin-user-count');

function showMessage(text, kind = 'info') {
  if (!message) return;
  message.textContent = text;
  message.hidden = false;
  message.classList.toggle('is-error', kind === 'error');
}

function hideMessage() {
  if (message) message.hidden = true;
}

function roleLabel(role) {
  return role === 'admin' ? 'Admin' : 'Player';
}

function addUserRow(userData) {
  const row = document.createElement('tr');

  const minecraftCell = document.createElement('td');
  minecraftCell.className = 'minecraft-cell';
  minecraftCell.textContent = userData.minecraftNick || '—';

  const nameCell = document.createElement('td');
  nameCell.textContent = userData.nome || 'Jogador';

  const roleCell = document.createElement('td');
  const badge = document.createElement('span');
  const isAdmin = userData.role === 'admin';
  badge.className = `role-badge ${isAdmin ? 'is-admin' : 'is-player'}`;
  badge.textContent = roleLabel(userData.role);
  roleCell.appendChild(badge);

  row.append(minecraftCell, nameCell, roleCell);
  usersBody.appendChild(row);
}

async function loadUsers() {
  usersBody.replaceChildren();

  let snapshot;
  try {
    snapshot = await getDocs(query(collection(db, 'usuarios'), orderBy('minecraftNick')));
  } catch (_) {
    // Perfis antigos podem não ter o campo minecraftNick; nesse caso carregamos sem ordenação.
    snapshot = await getDocs(collection(db, 'usuarios'));
  }

  const users = snapshot.docs
    .map(userDoc => ({ id: userDoc.id, ...userDoc.data() }))
    .sort((a, b) => String(a.minecraftNick || '').localeCompare(String(b.minecraftNick || ''), 'pt-BR', { sensitivity: 'base' }));

  userCount.textContent = `${users.length} ${users.length === 1 ? 'usuário' : 'usuários'}`;
  usersEmpty.hidden = users.length > 0;

  users.forEach(addUserRow);
  usersCard.hidden = false;
}

async function verifyAdmin(user) {
  const profileSnapshot = await getDoc(doc(db, 'usuarios', user.uid));
  if (!profileSnapshot.exists()) return false;
  return profileSnapshot.data()?.role === 'admin';
}

if (!firebaseConfigured || !auth || !db) {
  showMessage('Não foi possível conectar ao Firebase/Firestore.', 'error');
} else {
  await authPersistenceReady;

  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.replace('login.html');
      return;
    }

    try {
      const allowed = await verifyAdmin(user);
      if (!allowed) {
        window.location.replace('perfil.html');
        return;
      }

      await loadUsers();
      hideMessage();
    } catch (error) {
      showMessage(`Não foi possível carregar a área administrativa. (${error?.code || 'erro'})`, 'error');
    }
  });
}
