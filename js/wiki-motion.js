(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const turn = document.createElement('div');
  turn.className = 'wiki-page-turn';
  turn.setAttribute('aria-hidden', 'true');
  document.body.appendChild(turn);

  if (!reduceMotion) {
    document.body.classList.add('wiki-page-entering');
    window.setTimeout(() => document.body.classList.remove('wiki-page-entering'), 520);
  }

  const isInternalWikiLink = (anchor) => {
    if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return false;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) return false;

    try {
      const url = new URL(anchor.href, window.location.href);
      return url.origin === window.location.origin && url.pathname.includes('/EtherCraft/pages/wiki');
    } catch {
      return false;
    }
  };

  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[href]');
    if (!isInternalWikiLink(anchor) || reduceMotion) return;

    event.preventDefault();
    document.body.classList.remove('wiki-page-entering');
    document.body.classList.add('wiki-page-leaving');
    const destination = anchor.href;
    window.setTimeout(() => { window.location.href = destination; }, 380);
  });

  if (!document.body.classList.contains('wiki-detail-page')) return;

  const home = document.createElement('a');
  home.className = 'wiki-home-float';
  home.href = '../wiki.html';
  home.setAttribute('aria-label', 'Voltar ao início da Wiki');
  home.innerHTML = '<span class="wiki-home-float-icon" aria-hidden="true">📖</span><span>Início da Wiki</span>';
  document.body.appendChild(home);

  let idleTimer;
  const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'touchmove', 'scroll'];

  const showButton = () => {
    home.classList.remove('is-idle');
    window.clearTimeout(idleTimer);
    idleTimer = window.setTimeout(() => home.classList.add('is-idle'), 2400);
  };

  activityEvents.forEach((eventName) => {
    window.addEventListener(eventName, showButton, { passive: true });
  });

  home.addEventListener('focus', () => {
    window.clearTimeout(idleTimer);
    home.classList.remove('is-idle');
  });

  home.addEventListener('blur', showButton);
  showButton();
})();