(() => {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (!url.endsWith('/data/catalog-v1.json') && !url.endsWith('data/catalog-v1.json')) {
      return originalFetch(input, init);
    }
    const [baseResponse, aubergineResponse] = await Promise.all([
      originalFetch(input, init),
      originalFetch('./data/aubergine-candidates-v1.json', { cache: 'no-store' }).catch(() => null)
    ]);
    if (!baseResponse.ok || !aubergineResponse?.ok) return baseResponse;
    const [baseCatalog, aubergineCatalog] = await Promise.all([
      baseResponse.clone().json(),
      aubergineResponse.json()
    ]);
    const recipes = Array.isArray(baseCatalog.recipes) ? [...baseCatalog.recipes] : [];
    const ids = new Set(recipes.map(r => r.id));
    for (const recipe of aubergineCatalog.recipes || []) {
      if (!ids.has(recipe.id)) {
        recipes.push(recipe);
        ids.add(recipe.id);
      }
    }
    const merged = {
      ...baseCatalog,
      meta: {
        ...(baseCatalog.meta || {}),
        preview_extensions: [
          ...((baseCatalog.meta || {}).preview_extensions || []),
          'RF-AUBERGINE-PULPE:candidate_unvalidated'
        ]
      },
      recipes
    };
    return new Response(JSON.stringify(merged), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  };
})();
