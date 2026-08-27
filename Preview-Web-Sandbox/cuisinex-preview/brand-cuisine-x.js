(() => {
  const BRAND = 'Cuisine X';
  const VERSION = 'V1 RC1.6 FR';
  const UPDATED = '2026-08-27 01:20 Europe/Paris';
  let scheduled = false;

  function setText(node, value) {
    if (node && node.textContent !== value) node.textContent = value;
  }

  function apply() {
    scheduled = false;
    const expectedTitle = `${BRAND} — ${VERSION}`;
    if (document.title !== expectedTitle) document.title = expectedTitle;

    document.querySelectorAll('#siteHeader .brand').forEach(el => {
      const spans = [...el.querySelectorAll('span')];
      const name = spans.find(s => /CuisineX|Cuisine X/.test(s.textContent || ''));
      setText(name, BRAND);

      const badge = spans.find(s => /V1 RC/i.test(s.textContent || ''));
      setText(badge, VERSION);

      const maj = spans.find(s => /MAJ /i.test(s.textContent || ''));
      setText(maj, `MAJ ${UPDATED}`);
    });

    setText(
      document.querySelector('#siteFooter p'),
      `${BRAND} ${VERSION} · mise à jour ${UPDATED}`
    );

    document.querySelectorAll('h1').forEach(h => {
      if ((h.textContent || '').trim() === 'CuisineX') setText(h, BRAND);
    });
  }

  function scheduleApply() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(apply);
  }

  const observer = new MutationObserver(scheduleApply);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  apply();
})();
