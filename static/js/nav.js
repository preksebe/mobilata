// Categoriile stau pe un rând doar dacă încap întregi; altfel se strâng în butonul „Categorii”.
window.setupCategoryNav = function () {
  const header = document.querySelector('.site-header');
  const links = document.getElementById('nav-links');
  const toggle = document.getElementById('nav-toggle');
  if (!header || !links || !toggle) return function () {};

  function close() {
    header.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  function fit() {
    close();
    header.classList.remove('nav-collapsed');
    if (links.scrollWidth > links.clientWidth + 1) header.classList.add('nav-collapsed');
  }

  toggle.addEventListener('click', function () {
    const open = header.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function (e) {
    if (!header.contains(e.target) || e.target.closest('#nav-links a')) close();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && header.classList.contains('nav-open')) { close(); toggle.focus(); }
  });

  let lastWidth = 0;
  new ResizeObserver(function (entries) {
    const width = entries[0].contentRect.width;
    if (width !== lastWidth) { lastWidth = width; fit(); }
  }).observe(header);
  if (document.fonts) document.fonts.ready.then(fit);
  fit();
  return fit;
};
window.setupCategoryNav();
