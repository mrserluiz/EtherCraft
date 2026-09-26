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
  let activeEntryId = null;
  let firestoreRole = 'guest';
  let bookResizeObserver = null;
  let pendingUploads = 0;
  let savingEntry = false;
  let noticeTimer = null;

  const BOOK_WIDTH = 1412;
  const BOOK_HEIGHT = 833;
  const desktopBookMedia = window.matchMedia('(min-width: 56rem)');

  const CLOUDINARY_CLOUD_NAME = 'uofznsju';
  const CLOUDINARY_UPLOAD_PRESET = 'ethercraft_wiki';
  const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`;
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
  const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/webp', 'image/jpeg']);

  const escapeHtml = (value = '') => String(value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function friendlyAdminError(error) {
    const code = error?.code || '';
    if (code === 'auth-required') return 'Entre na sua conta administrativa para alterar a Wiki.';
    if (code === 'permission-denied' || code === 'firestore/permission-denied') return 'O Firestore recusou a alteração. Confirme se esta conta possui o cargo admin.';
    if (code === 'unavailable' || code === 'firestore/unavailable') return 'O Firestore está temporariamente indisponível. Tente novamente.';
    return error?.message || 'Não foi possível concluir a alteração.';
  }

  function showWikiNotice(message, kind = 'info') {
    let notice = document.getElementById('wiki-system-notice');
    if (!notice) {
      notice = document.createElement('p');
      notice.id = 'wiki-system-notice';
      notice.className = 'wiki-system-notice';
      notice.setAttribute('role', 'status');
      notice.setAttribute('aria-live', 'polite');
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    notice.className = `wiki-system-notice is-visible is-${kind}`;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => notice.classList.remove('is-visible'), kind === 'error' ? 7000 : 4200);
  }

  function updateSaveButton() {
    const saveButton = editorForm?.querySelector('[type="submit"]');
    if (!saveButton) return;
    saveButton.disabled = savingEntry || pendingUploads > 0;
    saveButton.textContent = savingEntry ? 'Salvando…' : pendingUploads > 0 ? `Enviando ${pendingUploads} imagem(ns)…` : 'Salvar';
  }

  const imageOrFallback = (src, alt, fallback) => {
    if (!src) return `<span class="${fallback.className}">${fallback.text}</span>`;
    return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${fallback.className}',textContent:'${fallback.text}'}))">`;
  };

  const typeLabel = {
    receitas: 'receita', mobs: 'mob', encantamentos: 'encantamento',
    dimensoes: 'dimensão', economia: 'conteúdo', mecanicas: 'mecânica'
  }[type] || 'conteúdo';

  const categoryMeta = {
    mecanicas: { icon: '🧬', iconImage: 'assets/images/wiki/category-icons/mecanicas.png', title: 'MECÂNICAS', eyebrow: '', descriptionLines: ['Sistemas especiais, progressão e recursos', 'próprios do EtherCraft.'] },
    receitas: { icon: '🛠️', iconImage: 'assets/images/wiki/category-icons/receitas.png', title: 'RECEITAS', eyebrow: '', descriptionLines: ['Receitas especiais, materiais e formas', 'de criação de itens.'] },
    mobs: { icon: '🐲', iconImage: 'assets/images/wiki/category-icons/bestiario.png', title: 'BESTIÁRIO', eyebrow: '', descriptionLines: ['Criaturas, chefes, características e recompensas', 'encontradas pelo mundo.'] },
    dimensoes: { icon: '🌌', iconImage: 'assets/images/wiki/category-icons/dimensoes.png', title: 'Dimensões', eyebrow: '', descriptionLines: ['Mundos especiais, portais, perigos', 'e recursos exclusivos.'] },
    encantamentos: { icon: '✨', iconImage: 'assets/images/wiki/category-icons/encantamentos.png', title: 'Encantamentos', eyebrow: '', descriptionLines: ['Efeitos especiais e os equipamentos', 'em que podem ser aplicados.'] },
    economia: { icon: '💰', iconImage: 'assets/images/wiki/category-icons/economia.png', title: 'Economia', eyebrow: '', descriptionLines: ['Comércio, recompensas, moedas e circulação de recursos.'] }
  }[type] || { icon: '📖', title: 'Wiki', eyebrow: 'Categoria', description: 'Conteúdo oficial do EtherCraft.' };

  function getSitePrefix() {
    const path = window.location.pathname;
    if (path.includes('/pages/wiki/')) return '../../';
    if (path.includes('/pages/')) return '../';
    return './';
  }

  async function ensureWikiStorage() {
    if (window.EtherCraftWikiStorage) return window.EtherCraftWikiStorage;
    const script = document.createElement('script');
    script.src = new URL(`${getSitePrefix()}js/wiki-firestore.js?v=20260926-firestore2`, window.location.href).href;
    const loaded = new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = () => reject(new Error('Não foi possível carregar o módulo Firestore da Wiki.'));
    });
    document.head.appendChild(script);
    await loaded;
    return window.EtherCraftWikiStorage;
  }

  async function loadJsonFallback() {
    const response = await fetch(dataUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error('Falha ao carregar dados da Wiki.');
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async function loadEntries() {
    try {
      const storage = await ensureWikiStorage();
      entries = await storage.loadEntries(type, dataUrl);
      if (!entries.length) entries = await loadJsonFallback();
      render();
    } catch (error) {
      console.warn('EtherCraft Wiki: Firestore indisponível, usando JSON local.', error);
      try {
        entries = await loadJsonFallback();
        render();
      } catch (fallbackError) {
        root.innerHTML = `<p class="wiki-empty">${escapeHtml(fallbackError.message)}</p>`;
      }
    }
  }

  function isAdmin() {
    return firestoreRole === 'admin' || window.EtherCraftAuth?.currentUser?.role === 'admin';
  }

  function imageField(label, name, value = '') {
    const safeName = escapeHtml(name);
    return `<div class="wiki-image-field">
      <label>${escapeHtml(label)}<input name="${safeName}" value="${escapeHtml(value)}" placeholder="URL da imagem"></label>
      <label class="wiki-upload-picker">Enviar imagem
        <input type="file" accept=".png,.webp,.jpg,.jpeg,image/png,image/webp,image/jpeg" data-wiki-upload-for="${safeName}">
      </label>
      <p class="wiki-upload-status" data-wiki-upload-status="${safeName}" aria-live="polite">PNG, WEBP ou JPG, até 10 MB.</p>
    </div>`;
  }

  function imageCollectionField(label, name, value = '') {
    const safeName = escapeHtml(name);
    return `<div class="wiki-image-field">
      <label>${escapeHtml(label)}<input name="${safeName}" value="${escapeHtml(value)}" placeholder="URLs separadas por vírgula"></label>
      <label class="wiki-upload-picker">Enviar imagens
        <input type="file" multiple accept=".png,.webp,.jpg,.jpeg,image/png,image/webp,image/jpeg" data-wiki-upload-many-for="${safeName}">
      </label>
      <p class="wiki-upload-status" data-wiki-upload-status="${safeName}" aria-live="polite">Selecione uma imagem para cada item, na mesma ordem.</p>
    </div>`;
  }

  async function sendImage(file) {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) throw new Error('Formato não permitido. Use PNG, WEBP ou JPG.');
    if (file.size > MAX_IMAGE_SIZE) throw new Error('A imagem deve ter no máximo 10 MB.');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const response = await fetch(CLOUDINARY_UPLOAD_URL, { method: 'POST', body: formData });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.secure_url) {
      throw new Error(payload?.error?.message || 'O Cloudinary não concluiu o upload.');
    }
    return payload.secure_url;
  }

  function bindUploadFields() {
    editorFields?.querySelectorAll('[data-wiki-upload-for]').forEach(fileInput => {
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;

        const targetName = fileInput.dataset.wikiUploadFor;
        const targetInput = editorFields.querySelector(`[name="${targetName}"]`);
        const status = editorFields.querySelector(`[data-wiki-upload-status="${targetName}"]`);
        if (!targetInput || !status) return;

        fileInput.disabled = true;
        pendingUploads += 1;
        updateSaveButton();
        status.textContent = 'Enviando imagem…';
        status.classList.remove('is-error', 'is-success');
        try {
          targetInput.value = await sendImage(file);
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
          status.textContent = 'Imagem enviada e vinculada ao conteúdo.';
          status.classList.add('is-success');
        } catch (error) {
          console.error('EtherCraft Wiki: falha no upload da imagem.', error);
          status.textContent = error?.message || 'Não foi possível enviar a imagem.';
          status.classList.remove('is-success');
          status.classList.add('is-error');
        } finally {
          pendingUploads = Math.max(0, pendingUploads - 1);
          fileInput.disabled = false;
          fileInput.value = '';
          updateSaveButton();
        }
      });
    });

    editorFields?.querySelectorAll('[data-wiki-upload-many-for]').forEach(fileInput => {
      fileInput.addEventListener('change', async () => {
        const files = Array.from(fileInput.files || []);
        if (!files.length) return;

        const targetName = fileInput.dataset.wikiUploadManyFor;
        const targetInput = editorFields.querySelector(`[name="${targetName}"]`);
        const status = editorFields.querySelector(`[data-wiki-upload-status="${targetName}"]`);
        if (!targetInput || !status) return;

        fileInput.disabled = true;
        pendingUploads += 1;
        updateSaveButton();
        status.classList.remove('is-error', 'is-success');
        try {
          const uploadedUrls = [];
          for (let index = 0; index < files.length; index += 1) {
            status.textContent = `Enviando imagem ${index + 1} de ${files.length}…`;
            uploadedUrls.push(await sendImage(files[index]));
          }
          targetInput.value = uploadedUrls.join(', ');
          targetInput.dispatchEvent(new Event('change', { bubbles: true }));
          status.textContent = `${uploadedUrls.length} imagem(ns) enviada(s) e vinculada(s).`;
          status.classList.add('is-success');
        } catch (error) {
          console.error('EtherCraft Wiki: falha no upload das imagens.', error);
          status.textContent = error?.message || 'Não foi possível enviar as imagens.';
          status.classList.add('is-error');
        } finally {
          pendingUploads = Math.max(0, pendingUploads - 1);
          fileInput.disabled = false;
          fileInput.value = '';
          updateSaveButton();
        }
      });
    });
  }

  function adminEditButton(id) {
    if (!isAdmin()) return '';
    return `<div class="wiki-entry-admin-actions"><button class="wiki-entry-edit" type="button" data-edit-id="${escapeHtml(id)}">✏️ Editar</button><button class="wiki-entry-delete" type="button" data-delete-id="${escapeHtml(id)}">🗑️ Excluir</button></div>`;
  }

  function renderRecipe(entry) {
    const ingredients = entry.ingredientes || {};
    const slots = Array.from({ length: 9 }, (_, index) => {
      const key = entry.grade?.[index];
      const item = key ? ingredients[key] : null;
      return `<div class="crafting-slot" title="${escapeHtml(item?.nome || 'Slot vazio')}">${item ? imageOrFallback(item.icone, item.nome, { className: 'crafting-empty', text: '◆' }) : '<span class="crafting-empty">·</span>'}</div>`;
    }).join('');
    const result = entry.resultado || {};
    return `<article class="wiki-entry recipe-entry" data-entry-id="${escapeHtml(entry.id)}">
      <header class="wiki-entry-heading"><p class="article-kicker">Receita especial</p><h2>${escapeHtml(entry.titulo)}</h2></header>
      <div class="crafting-table" aria-label="Receita de ${escapeHtml(entry.titulo)}"><div class="crafting-title">Crafting</div><div class="crafting-layout"><div class="crafting-grid">${slots}</div><div class="crafting-arrow" aria-hidden="true">➜</div><div class="crafting-result" title="${escapeHtml(result.nome || 'Resultado')}">${imageOrFallback(result.icone, result.nome || 'Resultado', { className: 'crafting-empty', text: '★' })}</div></div></div>
      <div class="recipe-copy"><p>${escapeHtml(entry.descricao)}</p><p class="recipe-result-name">Resultado: ${escapeHtml(result.nome || 'Item')}</p>${adminEditButton(entry.id)}</div>
      <div class="wiki-entry-continuation" aria-hidden="true"></div>
    </article>`;
  }

  function renderMob(entry) {
    const drop = entry.drop || {};
    return `<article class="wiki-entry bestiary-entry" data-entry-id="${escapeHtml(entry.id)}">
      <header class="wiki-entry-heading"><p class="article-kicker">Criatura</p><h2>${escapeHtml(entry.nome)}</h2></header>
      <div class="mob-image-box">${imageOrFallback(entry.imagem, entry.nome, { className: 'mob-placeholder', text: '🐲' })}</div>
      <div class="mob-copy"><p>${escapeHtml(entry.descricao)}</p><div class="mob-drop"><span class="mob-drop-icon">${imageOrFallback(drop.icone, drop.nome || 'Drop', { className: 'crafting-empty', text: '◆' })}</span><span>${escapeHtml(drop.nome || 'Sem drop cadastrado')}</span></div>${adminEditButton(entry.id)}</div>
      <div class="wiki-entry-continuation" aria-hidden="true"></div>
    </article>`;
  }

  function renderEnchantment(entry) {
    const materials = Array.isArray(entry.materiais) ? entry.materiais : [];
    const materialIcons = materials.map(material => `<span class="enchant-material" title="${escapeHtml(material.nome || 'Equipamento')}">${imageOrFallback(material.icone, material.nome || 'Equipamento', { className: 'enchant-material-fallback', text: material.fallback || '◆' })}<span class="sr-only">${escapeHtml(material.nome || 'Equipamento')}</span></span>`).join('');
    return `<article class="wiki-entry enchant-entry" data-entry-id="${escapeHtml(entry.id)}"><header class="wiki-entry-heading"><p class="article-kicker">Encantamento</p><h2>${escapeHtml(entry.nome)}</h2></header><div class="enchant-image-box">${imageOrFallback(entry.imagem, entry.nome, { className: 'enchant-placeholder', text: '✨' })}</div><div class="enchant-copy"><p>${escapeHtml(entry.descricao)}</p><div class="enchant-materials">${materialIcons || '<span class="enchant-no-materials">Compatibilidade ainda não cadastrada.</span>'}</div>${adminEditButton(entry.id)}</div><div class="wiki-entry-continuation" aria-hidden="true"></div></article>`;
  }

  function renderArticle(entry) {
    const chips = (Array.isArray(entry.destaques) ? entry.destaques : []).map(fact => `<span class="article-chip">${escapeHtml(fact)}</span>`).join('');
    return `<article class="wiki-entry article-entry" data-entry-id="${escapeHtml(entry.id)}"><header class="wiki-entry-heading"><p class="article-kicker">${escapeHtml(entry.subtitulo || '')}</p><h2>${escapeHtml(entry.titulo)}</h2></header><div class="article-image-box">${imageOrFallback(entry.imagem, entry.titulo, { className: 'article-placeholder', text: entry.icone || '📖' })}</div><div class="article-copy"><p>${escapeHtml(entry.descricao)}</p>${chips ? `<div class="article-chips">${chips}</div>` : ''}${adminEditButton(entry.id)}</div><div class="wiki-entry-continuation" aria-hidden="true"></div></article>`;
  }

  function renderEntry(entry) {
    if (type === 'receitas') return renderRecipe(entry);
    if (type === 'mobs') return renderMob(entry);
    if (type === 'encantamentos') return renderEnchantment(entry);
    return renderArticle(entry);
  }

  function syncBookScale() {
    const frame = root.querySelector('.wiki-category-book-frame');
    const book = frame?.querySelector('.wiki-category-book');
    if (!frame || !book) return;

    if (!desktopBookMedia.matches) {
      frame.style.removeProperty('height');
      book.style.removeProperty('--wiki-book-scale');
      return;
    }

    const scale = frame.clientWidth / BOOK_WIDTH;
    book.style.setProperty('--wiki-book-scale', String(scale));
    frame.style.height = `${BOOK_HEIGHT * scale}px`;
  }

  function bindBookScale() {
    bookResizeObserver?.disconnect();
    const frame = root.querySelector('.wiki-category-book-frame');
    if (!frame) return;

    if ('ResizeObserver' in window) {
      bookResizeObserver = new ResizeObserver(syncBookScale);
      bookResizeObserver.observe(frame);
    }
    syncBookScale();
  }

  function render() {
    if (!entries.length) {
      root.innerHTML = '<div class="wiki-empty-panel"><span>📚</span><p>Nenhum conteúdo cadastrado nesta área ainda.</p></div>';
      return;
    }
    const hashId = decodeURIComponent(window.location.hash.replace(/^#/, ''));
    const hashEntry = entries.find(item => String(item.id) === hashId || slugify(item.nome || item.titulo) === hashId);
    const activeEntry = entries.find(item => String(item.id) === String(activeEntryId)) || hashEntry || entries[0];
    activeEntryId = activeEntry.id;
    const menuItems = entries.map(item => {
      const label = item.nome || item.titulo || 'Conteúdo';
      const slug = slugify(label);
      const isActive = String(item.id) === String(activeEntryId);
      return `<li><a href="#${escapeHtml(slug)}" class="wiki-category-menu-link${isActive ? ' is-active' : ''}" data-entry-select="${escapeHtml(item.id)}"${isActive ? ' aria-current="page"' : ''}>${escapeHtml(label)}</a></li>`;
    }).join('');

    root.innerHTML = `<div class="wiki-category-book-frame"><article class="wiki-category-book">
      <section class="wiki-category-page wiki-category-page-left" aria-label="Conteúdo de ${escapeHtml(categoryMeta.title)}">
        <header class="wiki-category-identity">
          <span class="wiki-category-icon" aria-hidden="true">${categoryMeta.iconImage ? `<img src="${getSitePrefix()}${escapeHtml(categoryMeta.iconImage)}" alt="">` : escapeHtml(categoryMeta.icon)}</span>
          <span class="wiki-category-title">${categoryMeta.eyebrow ? `<small>${escapeHtml(categoryMeta.eyebrow)}</small>` : ''}<strong>${escapeHtml(categoryMeta.title)}</strong><span>${(categoryMeta.descriptionLines || [categoryMeta.description]).map(line => escapeHtml(line)).join('<br>')}</span></span>
        </header>
        <div class="wiki-category-reading">${renderEntry(activeEntry)}</div>
      </section>
      <aside class="wiki-category-page wiki-category-page-right">
        <header class="wiki-category-menu-heading"><small>Índice da categoria</small><h2>Menu</h2></header>
        <nav class="wiki-category-menu" aria-label="Conteúdos de ${escapeHtml(categoryMeta.title)}"><ol>${menuItems}</ol></nav>
      </aside>
    </article></div>`;
    root.querySelectorAll('[data-entry-select]').forEach(link => link.addEventListener('click', event => {
      event.preventDefault();
      activeEntryId = link.dataset.entrySelect;
      const selected = entries.find(item => String(item.id) === String(activeEntryId));
      history.replaceState(null, '', `#${slugify(selected?.nome || selected?.titulo || activeEntryId)}`);
      render();
    }));
    root.querySelectorAll('[data-edit-id]').forEach(button => button.addEventListener('click', () => openEditor(button.dataset.editId)));
    root.querySelectorAll('[data-delete-id]').forEach(button => button.addEventListener('click', () => deleteEntry(button.dataset.deleteId)));
    bindBookScale();
  }

  async function syncAdminState() {
    try {
      const storage = await ensureWikiStorage();
      const api = await storage.ready;
      firestoreRole = await api.currentRole();
    } catch (error) {
      firestoreRole = String(window.EtherCraftAuth?.currentUser?.role || 'guest').trim().toLowerCase();
    }
    toolbar?.classList.toggle('is-visible', isAdmin());
    render();
  }

  async function deleteEntry(id) {
    if (!isAdmin()) return;
    const entry = entries.find(item => item.id === id);
    const label = entry?.nome || entry?.titulo || id;
    if (!window.confirm(`Excluir “${label}” da Wiki? Esta alteração será publicada para todos.`)) return;
    try {
      const storage = await ensureWikiStorage();
      await storage.deleteEntry(type, id);
      entries = entries.filter(item => item.id !== id);
      if (String(activeEntryId) === String(id)) activeEntryId = entries[0]?.id || null;
      render();
      showWikiNotice(`“${label}” foi excluído da Wiki.`, 'success');
    } catch (error) {
      console.error('EtherCraft Wiki: falha ao excluir.', error);
      showWikiNotice(friendlyAdminError(error), 'error');
    }
  }

  function fieldsFor(entry = {}) {
    if (type === 'receitas') {
      const grid = entry.grade || Array(9).fill('');
      const ingredients = entry.ingredientes || {};
      const slotNames = grid.map(key => key ? (ingredients[key]?.nome || key) : '');
      const slotIcons = grid.map(key => key ? (ingredients[key]?.icone || '') : '');
      return `<label>Título<input name="titulo" required value="${escapeHtml(entry.titulo || '')}"></label><label>Descrição<textarea name="descricao" required>${escapeHtml(entry.descricao || '')}</textarea></label><label>Nome do resultado<input name="resultadoNome" required value="${escapeHtml(entry.resultado?.nome || '')}"></label>${imageField('Imagem do resultado', 'resultadoIcone', entry.resultado?.icone || '')}<fieldset><legend>Grade 3x3</legend><div class="wiki-editor-grid">${slotNames.map((name, i) => `<div class="editor-slot-pair"><label>Slot ${i + 1} — item<input name="slot${i}" value="${escapeHtml(name)}"></label>${imageField('Imagem', `slotIcon${i}`, slotIcons[i])}</div>`).join('')}</div></fieldset>`;
    }
    if (type === 'mobs') return `<label>Nome do mob<input name="nome" required value="${escapeHtml(entry.nome || '')}"></label>${imageField('Imagem do mob', 'imagem', entry.imagem || '')}<label>Descrição<textarea name="descricao" required>${escapeHtml(entry.descricao || '')}</textarea></label><label>Nome do drop<input name="dropNome" value="${escapeHtml(entry.drop?.nome || '')}"></label>${imageField('Ícone do drop', 'dropIcone', entry.drop?.icone || '')}`;
    if (type === 'encantamentos') {
      const mats = Array.isArray(entry.materiais) ? entry.materiais : [];
      return `<label>Nome do encantamento<input name="nome" required value="${escapeHtml(entry.nome || '')}"></label>${imageField('Imagem/ícone principal', 'imagem', entry.imagem || '')}<label>Descrição<textarea name="descricao" required>${escapeHtml(entry.descricao || '')}</textarea></label><label>Equipamentos compatíveis — separados por vírgula<input name="materiais" value="${escapeHtml(mats.map(item => item.nome).join(', '))}"></label>${imageCollectionField('Ícones dos equipamentos — mesma ordem', 'materiaisIcones', mats.map(item => item.icone || '').join(', '))}`;
    }
    return `<label>Título<input name="titulo" required value="${escapeHtml(entry.titulo || '')}"></label><label>Subtítulo/categoria<input name="subtitulo" value="${escapeHtml(entry.subtitulo || '')}"></label>${imageField('Imagem', 'imagem', entry.imagem || '')}<label>Descrição<textarea name="descricao" required>${escapeHtml(entry.descricao || '')}</textarea></label><label>Destaques — separados por vírgula<input name="destaques" value="${escapeHtml((entry.destaques || []).join(', '))}"></label>`;
  }

  function openEditor(id = null) {
    if (!isAdmin() || !editor || !editorFields) return;
    editingId = id;
    const entry = id ? entries.find(item => item.id === id) : {};
    if (id && !entry) {
      showWikiNotice('Este conteúdo não foi encontrado. Recarregue a página e tente novamente.', 'error');
      return;
    }
    editorTitle.textContent = id ? `Editar ${typeLabel}` : `Adicionar ${typeLabel}`;
    editorFields.innerHTML = fieldsFor(entry);
    pendingUploads = 0;
    savingEntry = false;
    bindUploadFields();
    updateSaveButton();
    editor.setAttribute('role', 'dialog');
    editor.setAttribute('aria-modal', 'true');
    editor.setAttribute('aria-labelledby', 'wiki-editor-title');
    editor.hidden = false;
    document.body.classList.add('wiki-editor-open');
    editorFields.querySelector('input, textarea')?.focus();
  }

  function closeEditor() {
    if (savingEntry || pendingUploads > 0) return;
    if (editor) editor.hidden = true;
    if (editorFields) editorFields.innerHTML = '';
    document.body.classList.remove('wiki-editor-open');
    editingId = null;
  }
  function slugify(value) { return String(value || 'item').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function formValue(formData, name) { return String(formData.get(name) || '').trim(); }

  function formToEntry(formData) {
    if (type === 'receitas') {
      const title = formValue(formData, 'titulo'); const grade = []; const ingredients = {};
      for (let i = 0; i < 9; i += 1) {
        const name = formValue(formData, `slot${i}`); const icon = formValue(formData, `slotIcon${i}`);
        if (!name) { grade.push(null); continue; }
        const key = `${slugify(name)}-${i}`; grade.push(key); ingredients[key] = { nome: name, icone: icon };
      }
      return { id: editingId || `${slugify(title)}-${Date.now()}`, titulo: title, descricao: formValue(formData, 'descricao'), resultado: { nome: formValue(formData, 'resultadoNome'), icone: formValue(formData, 'resultadoIcone') }, grade, ingredientes: ingredients };
    }
    if (type === 'mobs') {
      const name = formValue(formData, 'nome');
      return { id: editingId || `${slugify(name)}-${Date.now()}`, nome: name, imagem: formValue(formData, 'imagem'), descricao: formValue(formData, 'descricao'), drop: { nome: formValue(formData, 'dropNome'), icone: formValue(formData, 'dropIcone') }, tags: [] };
    }
    if (type === 'encantamentos') {
      const name = formValue(formData, 'nome');
      const names = formValue(formData, 'materiais').split(',').map(item => item.trim()).filter(Boolean);
      const icons = formValue(formData, 'materiaisIcones').split(',').map(item => item.trim());
      return { id: editingId || `${slugify(name)}-${Date.now()}`, nome: name, imagem: formValue(formData, 'imagem'), descricao: formValue(formData, 'descricao'), materiais: names.map((material, index) => ({ nome: material, icone: icons[index] || '', fallback: '◆' })) };
    }
    const title = formValue(formData, 'titulo');
    return { id: editingId || `${slugify(title)}-${Date.now()}`, titulo: title, subtitulo: formValue(formData, 'subtitulo'), imagem: formValue(formData, 'imagem'), descricao: formValue(formData, 'descricao'), destaques: formValue(formData, 'destaques').split(',').map(item => item.trim()).filter(Boolean) };
  }

  async function persistEntry(entry) {
    const storage = await ensureWikiStorage();
    await storage.saveEntry(type, entry);
    const index = entries.findIndex(item => item.id === entry.id);
    if (index >= 0) entries[index] = entry; else entries.unshift(entry);
    activeEntryId = entry.id;
    render();
  }

  addButton?.addEventListener('click', () => openEditor());
  editorCancel?.addEventListener('click', closeEditor);
  editorForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!isAdmin()) return;
    if (pendingUploads > 0) {
      showWikiNotice('Aguarde o envio das imagens terminar antes de salvar.', 'error');
      return;
    }
    savingEntry = true;
    updateSaveButton();
    try {
      const entry = formToEntry(new FormData(editorForm));
      await persistEntry(entry);
      const label = entry.nome || entry.titulo || 'Conteúdo';
      savingEntry = false;
      closeEditor();
      showWikiNotice(`“${label}” foi publicado na Wiki.`, 'success');
    } catch (error) {
      console.error('EtherCraft Wiki: falha ao publicar.', error);
      showWikiNotice(friendlyAdminError(error), 'error');
    } finally {
      savingEntry = false;
      updateSaveButton();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && editor && !editor.hidden) closeEditor();
  });

  window.addEventListener('ethercraft:auth-changed', syncAdminState);
  window.addEventListener('resize', syncBookScale, { passive: true });
  desktopBookMedia.addEventListener?.('change', syncBookScale);
  window.EtherCraftWiki = { refreshAdmin: syncAdminState, reload: loadEntries };
  loadEntries().then(syncAdminState);
})();
