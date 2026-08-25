(() => {
  const originalFetch = window.fetch.bind(window);
  const extraCatalogs = [
    './data/aubergine-candidates-v1.json',
    './data/p019-work-in-progress-v1.json'
  ];

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.endsWith('/data/catalog-v1.json') && !url.endsWith('data/catalog-v1.json')) return originalFetch(input, init);

    const responses = await Promise.all([
      originalFetch(input, init),
      ...extraCatalogs.map(path => originalFetch(path, { cache: 'no-store' }).catch(() => null))
    ]);

    const baseResponse = responses[0];
    if (!baseResponse.ok) return baseResponse;

    const baseCatalog = await baseResponse.clone().json();
    const recipes = Array.isArray(baseCatalog.recipes) ? [...baseCatalog.recipes] : [];
    const ids = new Set(recipes.map(r => r.id));
    const extensions = [...((baseCatalog.meta || {}).preview_extensions || [])];

    for (let i = 1; i < responses.length; i++) {
      const response = responses[i];
      if (!response?.ok) continue;
      const catalog = await response.json();
      for (const recipe of catalog.recipes || []) {
        if (!ids.has(recipe.id)) {
          recipes.push(recipe);
          ids.add(recipe.id);
        }
      }
      const source = catalog.meta?.source || extraCatalogs[i - 1];
      extensions.push(source);
    }

    return new Response(JSON.stringify({
      ...baseCatalog,
      meta: { ...(baseCatalog.meta || {}), preview_extensions: extensions },
      recipes
    }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  };
})();
