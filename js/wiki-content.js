(() => {
  const root = document.getElementById('wiki-content-list');
  if (!root) return;

  const type = document.body.dataset.wikiType;
  const dataUrl = document.body.dataset.wikiData;
  const toolbar = document.getElementById('wiki-admin-toolbar');
  const addButton = document.getElementById('wiki-admin-add');
  const editor = document.getElementById('wiki-editor');
  const editorForm = document.getElementById('wiki-editor-form');
  const editorFields = document.getElementById('wiki-editor-fields');
  const editorCancel = document.getElementById('wiki-editor-cancel');
  const editorTitle = document.getElementById('wiki-editor-title');

  let entries = [];
  let editingId = null;

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  const imageOrFallback = (src, alt, fallback) => {
    if (!src) return `<span class="${fallback.className}">${fallback.text}</span>`;
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${fallback.className}',textContent:'${fallback.text}'}))">`;
  };

  function getDraftKey() {
    return `ethercraft-wiki-draft-${type}`;
  }

  function loadDraft() {
    try {
      const saved = localStorage.getItem(getDraftKey());
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  }

  function saveDraft() {
    localStorage.setItem(getDraftKey(), JSON.stringify(entries));
  }

  async function loadEntries() {
    const draft = loadDraft();
    if (Array.isArray(draft)) {
      entries = draft;
      render();
      return;
    }

    try {
      const response = await fetch(dataUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('Falha ao carregar dados da Wiki.');
      entries = await response.json();
      render();
    } catch (error) {
      root.innerHTML = `<p class="wiki-empty">${escapeHtml(error.message)}</p>`;
    }
  }

  function renderRecipe(entry) {
    const ingredients = entry.ingredientes || {};
    const slots = Array.from({ length: 9 }, (_, index) => {
      const key = entry.grade?.[index];
      const item = key ? ingredients[key] : null;
      return `<div class="crafting-slot" title="${escapeHtml(item?.nome || 'Slot vazio')}">${item ? imageOrFallback(item.icone, item.nome, { className: 'crafting-empty', text: '◆' }) : '<span class="crafting-empty">·</span>'}</div>`;
    }).join('');

    const result = entry.resultado || {};
    return `
      <article class="wiki-entry recipe-entry" data-entry-id="${escapeHtml(entry.id)}">
        <div class="crafting-table" aria-label="Receita de ${escapeHtml(entry.titulo)}">
          <div class="crafting-title">Crafting</div>
          <div class="crafting-layout">
            <div class="crafting-grid">${slots}</div>
            <div class="crafting-arrow" aria-hidden="true">➜</div>
            <div class="crafting-result" title="${escapeHtml(result.nome || 'Resultado')}">${imageOrFallback(result.icone, result.nome || 'Resultado', { className: 'crafting-empty', text: '★' })}</div>
          </div>
        </div>
        <div class="recipe-copy">
          <h2>${escapeHtml(entry.titulo)}</h2>
          <p>${escapeHtml(entry.descricao)}</p>
          <p class="recipe-result-name">Resultado: ${escapeHtml(result.nome || 'Item')}</p>
          ${adminEditButton(entry.id)}
        </div>
      </article>`;
  }

  function renderMob(entry) {
    const drop = entry.drop || {};
    return `
      <article class="wiki-entry bestiary-entry" data-entry-id="${escapeHtml(entry.id)}">
        <div class="mob-image-box">${imageOrFallback(entry.imagem, entry.nome, { className: 'mob-placeholder', text: '🐲' })}</div>
        <div class="mob-copy">
          <h2>${escapeHtml(entry.nome)}</h2>
          <p>${escapeHtml(entry.descricao)}</p>
          <div class="mob-drop" aria-label="Drop de ${escapeHtml(entry.nome)}">
            <span class="mob-drop-icon">${imageOrFallback(drop.icone, drop.nome || 'Drop', { className: 'crafting-empty', text: '◆' })}</span>
            <span>${escapeHtml(drop.nome || 'Sem drop cadastrado')}</span>
          </div>
          ${adminEditButton(entry.id)}
        </div>
      </article>`;
  }

  function adminEditButton(id) {
    return isAdmin() ? `<button class="wiki-entry-edit" type="button" data-edit-id="${escapeHtml(id)}">✏️ Editar</button>` : '';
  }

  function render() {
    root.innerHTML = entries.map((entry) => type === 'receitas' ? renderRecipe(entry) : renderMob(entry)).join('');
    root.querySelectorAll('[data-edit-id]').forEach((button) => {
      button.addEventListener('click', () => openEditor(button.dataset.editId));
    });
  }

  function isAdmin() {
    return window.EtherCraftAuth?.currentUser?.role === 'admin';
  }

  function syncAdminState() {
    const admin = isAdmin();
    toolbar?.classList.toggle('is-visible', admin);
    render();
  }

  function fieldsFor(entry = {}) {
    if (type === 'receitas') {
      const grid = entry.grade || Array(9).fill('');
      const ingredients = entry.ingredientes || {};
      const slotNames = grid.map((key) => key ? (ingredients[key]?.nome || key) : '');
      return `
        <label>Título<input name="titulo" required value="${escapeHtml(entry.titulo || '')}"></label>
        <label>Descrição<textarea name="descricao" required>${escapeHtml(entry.descricao || '')}</textarea></label>
        <label>Nome do resultado<input name="resultadoNome" required value="${escapeHtml(entry.resultado?.nome || '')}"></label>
        <label>URL/ caminho da imagem do resultado<input name="resultadoIcone" value="${escapeHtml(entry.resultado?.icone || '')}"></label>
        <fieldset><legend>Grade 3x3 — nome dos ingredientes</legend><div class="wiki-editor-grid">${slotNames.map((name, i) => `<label>Slot ${i + 1}<input name="slot${i}" value="${escapeHtml(name)}"></label>`).join('')}</div></fieldset>`;
    }

    return `
      <label>Nome do mob<input name="nome" required value="${escapeHtml(entry.nome || '')}"></label>
      <label>Imagem do mob (URL/caminho)<input name="imagem" value="${escapeHtml(entry.imagem || '')}"></label>
      <label>Descrição<textarea name="descricao" required>${escapeHtml(entry.descricao || '')}</textarea></label>
      <label>Nome do drop<input name="dropNome" value="${escapeHtml(entry.drop?.nome || '')}"></label>
      <label>Ícone do drop (URL/caminho)<input name="dropIcone" value="${escapeHtml(entry.drop?.icone || '')}"></label>`;
  }

  function openEditor(id = null) {
    if (!isAdmin() || !editor || !editorFields) return;
    editingId = id;
    const entry = id ? entries.find((item) => item.id === id) : {};
    editorTitle.textContent = id ? 'Editar conteúdo' : 'Adicionar conteúdo';
    editorFields.innerHTML = fieldsFor(entry);
    editor.hidden = false;
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function closeEditor() {
    if (editor) editor.hidden = true;
    editingId = null;
  }

  function slugify(value) {
    return String(value || 'item').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function formToEntry(formData) {
    if (type === 'receitas') {
      const title = formData.get('titulo');
      const grade = [];
      const ingredients = {};
      for (let i = 0; i < 9; i += 1) {
        const name = String(formData.get(`slot${i}`) || '').trim();
        if (!name) { grade.push(null); continue; }
        const key = `${slugify(name)}-${i}`;
        grade.push(key);
        ingredients[key] = { nome: name, icone: '' };
      }
      return {
        id: editingId || `${slugify(title)}-${Date.now()}`,
        titulo: title,
        descricao: formData.get('descricao'),
        resultado: { nome: formData.get('resultadoNome'), icone: formData.get('resultadoIcone') },
        grade,
        ingredientes: ingredients
      };
    }

    const name = formData.get('nome');
    return {
      id: editingId || `${slugify(name)}-${Date.now()}`,
      nome: name,
      imagem: formData.get('imagem'),
      descricao: formData.get('descricao'),
      drop: { nome: formData.get('dropNome'), icone: formData.get('dropIcone') },
      tags: []
    };
  }

  async function persistEntry(entry) {
    const index = entries.findIndex((item) => item.id === entry.id);
    if (index >= 0) entries[index] = entry;
    else entries.unshift(entry);

    if (window.EtherCraftWikiStorage?.saveEntry) {
      await window.EtherCraftWikiStorage.saveEntry(type, entry);
    } else {
      saveDraft();
      alert('Salvo como rascunho neste navegador. Quando o login/Firebase da Wiki for conectado, este mesmo editor poderá publicar para todos os jogadores.');
    }
    render();
  }

  addButton?.addEventListener('click', () => openEditor());
  editorCancel?.addEventListener('click', closeEditor);
  editorForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!isAdmin()) return;
    const entry = formToEntry(new FormData(editorForm));
    await persistEntry(entry);
    closeEditor();
  });

  window.addEventListener('ethercraft:auth-changed', syncAdminState);
  window.EtherCraftWiki = { refreshAdmin: syncAdminState };

  loadEntries().then(syncAdminState);
})();
