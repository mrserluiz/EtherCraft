(() => {
  function getSitePrefix() {
    const path = window.location.pathname;
    if (path.includes('/pages/wiki/')) return '../../';
    if (path.includes('/pages/')) return '../';
    return './';
  }

  const ready = (async () => {
    const prefix = getSitePrefix();
    const firebaseUrl = new URL(`${prefix}js/firebase.js`, window.location.href).href;
    const { auth, db, firebaseConfigured, authPersistenceReady } = await import(firebaseUrl);
    if (!firebaseConfigured || !auth || !db) throw new Error('Firebase/Firestore não configurado.');

    await authPersistenceReady;
    const fs = await import('https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js');

    async function currentRole() {
      const user = auth.currentUser;
      if (!user) return 'guest';
      const snap = await fs.getDoc(fs.doc(db, 'usuarios', user.uid));
      return snap.exists() ? (snap.data().role || 'player') : 'player';
    }

    function entriesCollection(type) {
      return fs.collection(db, 'wiki', type, 'entries');
    }

    async function readEntries(type) {
      const snapshot = await fs.getDocs(entriesCollection(type));
      return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
    }

    async function seedFromJson(type, dataUrl) {
      const existing = await readEntries(type);
      if (existing.length) return existing;
      if (await currentRole() !== 'admin') return existing;

      const response = await fetch(dataUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('Não foi possível importar os dados iniciais da Wiki.');
      const initial = await response.json();
      if (!Array.isArray(initial) || !initial.length) return [];

      for (const entry of initial) {
        if (!entry?.id) continue;
        const { id, ...payload } = entry;
        await fs.setDoc(fs.doc(db, 'wiki', type, 'entries', id), {
          ...payload,
          atualizadoEm: fs.serverTimestamp(),
          atualizadoPor: auth.currentUser?.uid || null
        });
      }
      return readEntries(type);
    }

    async function loadEntries(type, dataUrl) {
      let entries = await readEntries(type);
      if (!entries.length) entries = await seedFromJson(type, dataUrl);
      return entries;
    }

    async function saveEntry(type, entry) {
      if (!entry?.id) throw new Error('Conteúdo da Wiki sem ID.');
      const { id, ...payload } = entry;
      await fs.setDoc(fs.doc(db, 'wiki', type, 'entries', id), {
        ...payload,
        atualizadoEm: fs.serverTimestamp(),
        atualizadoPor: auth.currentUser?.uid || null
      }, { merge: true });
      return { id, ...payload };
    }

    async function deleteEntry(type, id) {
      await fs.deleteDoc(fs.doc(db, 'wiki', type, 'entries', id));
    }

    return { auth, db, fs, loadEntries, saveEntry, deleteEntry, currentRole };
  })();

  window.EtherCraftWikiStorage = {
    ready,
    async loadEntries(type, dataUrl) {
      const api = await ready;
      return api.loadEntries(type, dataUrl);
    },
    async saveEntry(type, entry) {
      const api = await ready;
      return api.saveEntry(type, entry);
    },
    async deleteEntry(type, id) {
      const api = await ready;
      return api.deleteEntry(type, id);
    }
  };
})();
