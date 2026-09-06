(() => {
  const searchInput = document.getElementById('wiki-search-input');
  const clearButton = document.getElementById('wiki-search-clear');
  const cards = Array.from(document.querySelectorAll('.wiki-card'));
  const filters = Array.from(document.querySelectorAll('.wiki-filter'));
  const emptyState = document.getElementById('wiki-empty');
  const randomButton = document.getElementById('wiki-random-btn');

  if (!searchInput || cards.length === 0) return;

  let activeFilter = 'todos';

  const normalize = (value) =>
    value
      .toLocaleLowerCase('pt-BR')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  function updateCards() {
    const query = normalize(searchInput.value);
    let visibleCount = 0;

    cards.forEach((card) => {
      const title = normalize(card.dataset.title || '');
      const keywords = normalize(card.dataset.keywords || '');
      const categories = normalize(card.dataset.category || '').split(/\s+/);

      const matchesSearch = !query || title.includes(query) || keywords.includes(query);
      const matchesFilter = activeFilter === 'todos' || categories.includes(activeFilter);
      const visible = matchesSearch && matchesFilter;

      card.classList.toggle('is-hidden', !visible);
      if (visible) visibleCount += 1;
    });

    if (emptyState) emptyState.hidden = visibleCount !== 0;
  }

  searchInput.addEventListener('input', updateCards);

  clearButton?.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.focus();
    updateCards();
  });

  filters.forEach((filter) => {
    filter.addEventListener('click', () => {
      activeFilter = filter.dataset.filter || 'todos';

      filters.forEach((button) => {
        const isActive = button === filter;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
      });

      updateCards();
    });
  });

  randomButton?.addEventListener('click', () => {
    const visibleCards = cards.filter((card) => !card.classList.contains('is-hidden'));
    const pool = visibleCards.length > 0 ? visibleCards : cards;
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    if (!chosen) return;

    chosen.scrollIntoView({ behavior: 'smooth', block: 'center' });
    chosen.classList.add('is-random-pick');
    window.setTimeout(() => chosen.classList.remove('is-random-pick'), 1200);
  });

  updateCards();
})();
