(() => {
  const migrationKey='cuisinex.preview.integration.v2';
  const migrationValue='2026-08-27-rc1.6-ciqual-lazy';
  try {
    if (localStorage.getItem(migrationKey)!==migrationValue) {
      localStorage.removeItem('cuisinex.preview.data.v4');
      localStorage.setItem(migrationKey,migrationValue);
    }
  } catch (e) {
    console.warn('Cuisine X cache migration unavailable',e);
  }
})();
