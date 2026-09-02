(() => {
  const originalFetch = window.fetch.bind(window);
  const authoringLive = './data/p019-authoring-live-v1.json';
  const authoringOverlay = './data/p019-authoring-overlay-v1.json';
  const legacyRecipeCatalogs = [
    './data/aubergine-candidates-v1.json',
    './data/p019-work-in-progress-v1.json',
    authoringLive,
    authoringOverlay
  ];
  const authoringIndexChunks = [1, 2, 3, 4, 5].map(n => `./data/p019-authoring-index-v2-${String(n).padStart(2, '0')}.json`);
  const extraEquipment = './data/equipment-catchup-v1.json';
  const authoringGitHubPrefix = 'https://github.com/nepheris/nLab/blob/main/';

  async function loadAuthoringIndex() {
    const responses = await Promise.all(authoringIndexChunks.map(path => originalFetch(path, { cache: 'no-store' }).catch(() => null)));
    if (responses.some(response => !response?.ok)) return null;
    const chunks = await Promise.all(responses.map(response => response.json()));
    const recipes = chunks.flatMap(chunk => chunk.recipes || []);
    const meta = chunks[0]?.meta || {};
    const ids = new Set(recipes.map(recipe => recipe.id));
    const expected = Number(meta.recipe_count || 0);
    if (!expected || recipes.length !== expected || ids.size !== recipes.length) return null;
    return { meta, recipes };
  }

  function authoringRecipe(recipe, legacy) {
    const sourceUrl = recipe.source_path ? `${authoringGitHubPrefix}${recipe.source_path}` : legacy?.source_url;
    return {
      ...(legacy || {}),
      ...recipe,
      summary: recipe.summary || legacy?.summary || { fr: 'Fiche auteur Markdown CuisineX. Ouvrir la source pour la formulation complète.' },
      source_url: sourceUrl,
      authoring_source: recipe.source_path || null,
      authoring_runtime: true
    };
  }

  async function mergeRecipeCatalog(input, init) {
    const [baseResponse, ...legacyResponses] = await Promise.all([
      originalFetch(input, init),
      ...legacyRecipeCatalogs.map(path => originalFetch(path, { cache: 'no-store' }).catch(() => null))
    ]);
    if (!baseResponse.ok) return baseResponse;
    const baseCatalog = await baseResponse.clone().json();

    // Build the old projection only as an enrichment/fallback layer. It no
    // longer controls which recipe IDs exist or which title/status is current.
    const legacyRecipes = Array.isArray(baseCatalog.recipes) ? [...baseCatalog.recipes] : [];
    const legacyById = new Map(legacyRecipes.map((recipe, index) => [recipe.id, index]));
    const legacyExtensions = [...((baseCatalog.meta || {}).preview_extensions || [])];
    for (let i = 0; i < legacyResponses.length; i++) {
      const response = legacyResponses[i];
      if (!response?.ok) continue;
      const catalog = await response.json();
      for (const recipe of catalog.recipes || []) {
        if (legacyById.has(recipe.id)) legacyRecipes[legacyById.get(recipe.id)] = recipe;
        else { legacyRecipes.push(recipe); legacyById.set(recipe.id, legacyRecipes.length - 1); }
      }
      legacyExtensions.push(catalog.meta?.source || legacyRecipeCatalogs[i]);
    }

    const authoring = await loadAuthoringIndex();
    if (authoring) {
      const enrichedLegacy = new Map(legacyRecipes.map(recipe => [recipe.id, recipe]));
      const recipes = authoring.recipes.map(recipe => authoringRecipe(recipe, enrichedLegacy.get(recipe.id)));
      return new Response(JSON.stringify({
        ...baseCatalog,
        meta: {
          ...(baseCatalog.meta || {}),
          schema: 'cuisinex-markdown-first-preview-v2',
          source: 'P019 compiled Markdown authoring index',
          source_commit: authoring.meta.source_commit,
          source_workflow_run: authoring.meta.source_workflow_run,
          recipe_count: recipes.length,
          business_object_count: authoring.meta.business_object_count,
          legacy_mode: 'fallback-and-enrichment-only',
          legacy_extensions: legacyExtensions,
          authoring_chunks: authoringIndexChunks
        },
        recipes
      }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
    }

    // Safety fallback: if the generated authoring index is incomplete or
    // unreachable, retain the previous preview rather than presenting a broken
    // empty catalogue. This path is explicitly non-authoritative.
    return new Response(JSON.stringify({
      ...baseCatalog,
      meta: {
        ...(baseCatalog.meta || {}),
        legacy_mode: 'fallback-active-authoring-index-unavailable',
        preview_extensions: legacyExtensions
      },
      recipes: legacyRecipes
    }), { status: 200, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
  }

  async function mergeAuthoringTechniques(input, init) {
    const [baseResponse, liveResponse] = await Promise.all([
      originalFetch(input, init),
      originalFetch(authoringLive, { cache: 'no-store' }).catch(() => null)
    ]);
    if (!baseResponse.ok || !liveResponse?.ok) return baseResponse;
    const [baseData, liveData] = await Promise.all([baseResponse.clone().json(), liveResponse.json()]);
    const techniques = Array.isArray(baseData.techniques) ? [...baseData.techniques] : [];
    const byId = new Map(techniques.map((x, i) => [x.id, i]));
    for (const item of liveData.techniques || []) {
      if (byId.has(item.id)) techniques[byId.get(item.id)] = { ...techniques[byId.get(item.id)], ...item };
      else { techniques.push(item); byId.set(item.id, techniques.length - 1); }
    }
    return new Response(JSON.stringify({ ...baseData, authoring_preview_extension: authoringLive, techniques }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  async function mergeEquipmentCatalog(input, init) {
    const [baseResponse, extraResponse] = await Promise.all([
      originalFetch(input, init),
      originalFetch(extraEquipment, { cache: 'no-store' }).catch(() => null)
    ]);
    if (!baseResponse.ok || !extraResponse?.ok) return baseResponse;
    const [baseCatalog, extraCatalog] = await Promise.all([baseResponse.clone().json(), extraResponse.json()]);
    const equipment = Array.isArray(baseCatalog.equipment) ? [...baseCatalog.equipment] : [];
    const byId = new Map(equipment.map((x, i) => [x.id, i]));
    for (const item of extraCatalog.equipment || []) {
      if (byId.has(item.id)) equipment[byId.get(item.id)] = { ...equipment[byId.get(item.id)], ...item };
      else { equipment.push(item); byId.set(item.id, equipment.length - 1); }
    }
    return new Response(JSON.stringify({ ...baseCatalog, preview_extension: extraEquipment, equipment }), {
      status: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' }
    });
  }

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url || '';
    if (url.endsWith('/data/demo.json') || url.endsWith('data/demo.json')) return mergeAuthoringTechniques(input, init);
    if (url.endsWith('/data/catalog-v1.json') || url.endsWith('data/catalog-v1.json')) return mergeRecipeCatalog(input, init);
    if (url.endsWith('/data/equipment-v1.json') || url.endsWith('data/equipment-v1.json')) return mergeEquipmentCatalog(input, init);
    return originalFetch(input, init);
  };
})();
