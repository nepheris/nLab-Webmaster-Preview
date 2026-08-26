(() => {
  const migrationKey='cuisinex.preview.integration.v2';
  const migrationValue='2026-08-26-ciqual-v72';
  try {
    if (localStorage.getItem(migrationKey)!==migrationValue) {
      localStorage.removeItem('cuisinex.preview.data.v4');
      localStorage.setItem(migrationKey,migrationValue);
    }
  } catch (e) {
    console.warn('CuisineX cache migration unavailable',e);
  }
})();
