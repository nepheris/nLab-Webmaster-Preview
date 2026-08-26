(() => {
  const originalFetch = window.fetch.bind(window);
  const extraCatalogs = [
    './data/aubergine-candidates-v1.json',
    './data/p019-work-in-progress-v1.json'
  ];
  const extraEquipment = './data/equipment-catchup-v1.json';

  async function mergeRecipeCatalog(input, init) {
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
      extensions.push(catalog.meta?.source || extraCatalogs[i - 1]);
    }
    return new Response(JSON.stringify({
      ...baseCatalog,
      meta: { ...(baseCatalog.meta || {}), preview_extensions: extensions },
      recipes
    }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  async function mergeEquipmentCatalog(input, init) {
    const [baseResponse, extraResponse] = await Promise.all([
      originalFetch(input, init),
      originalFetch(extraEquipment, { cache: 'no-store' }).catch(() => null)
    ]);
    if (!baseResponse.ok || !extraResponse?.ok) return baseResponse;
    const [baseCatalog, extraCatalog] = await Promise.all([
      baseResponse.clone().json(),
      extraResponse.json()
    ]);
    const equipment = Array.isArray(baseCatalog.equipment) ? [...baseCatalog.equipment] : [];
    const ids = new Set(equipment.map(x => x.id));
    for (const item of extraCatalog.equipment || []) {
      if (!ids.has(item.id)) {
        equipment.push(item);
        ids.add(item.id);
      }
    }
    return new Response(JSON.stringify({
      ...baseCatalog,
      preview_extension: extraEquipment,
      equipment
    }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.endsWith('/data/catalog-v1.json') || url.endsWith('data/catalog-v1.json')) {
      return mergeRecipeCatalog(input, init);
    }
    if (url.endsWith('/data/equipment-v1.json') || url.endsWith('data/equipment-v1.json')) {
      return mergeEquipmentCatalog(input, init);
    }
    return originalFetch(input, init);
  };
})();
