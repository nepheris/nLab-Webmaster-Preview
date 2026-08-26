(() => {
  const style = document.createElement('style');
  style.textContent = `
    .cx-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:8px 0 12px}
    .cx-kpi{display:block;padding:12px;border:1px solid var(--border,#d8d8d8);border-radius:12px;text-decoration:none;color:inherit;background:var(--panel,#fff)}
    .cx-kpi strong{display:block;font-size:1.65rem;line-height:1;margin-bottom:4px}
    .cx-kpi span{font-size:.9rem;opacity:.78}
    .cx-statuses{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .cx-statuses .badge{font-size:.78rem}
    @media(max-width:760px){.cx-kpis{grid-template-columns:1fr 1fr}}
  `;
  document.head.appendChild(style);

  let statsPromise;
  const loadStats = () => statsPromise ||= Promise.all([
    fetch('./data/demo.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('./data/catalog-v1.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null),
    fetch('./data/equipment-v1.json', {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null)
  ]).then(([demo, catalog, equipmentCatalog]) => {
    const recipeMap = new Map();
    for (const r of demo?.recipes || []) recipeMap.set(r.id, r);
    for (const r of catalog?.recipes || []) recipeMap.set(r.id, r);
    const recipes = [...recipeMap.values()];
    const equipmentMap = new Map();
    for (const e of demo?.equipment || []) equipmentMap.set(e.id, e);
    for (const e of equipmentCatalog?.equipment || []) equipmentMap.set(e.id, e);
    const byStatus = recipes.reduce((acc, r) => {
      const k = r.status || 'sans_statut';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {});
    return {
      recipes: recipes.length,
      ingredients: demo?.ingredients?.length || 0,
      techniques: demo?.techniques?.length || 0,
      equipment: equipmentMap.size,
      byStatus
    };
  });

  async function enhance(){
    const panel = document.querySelector('#home-hero .hero .panel:nth-child(2)');
    if (!panel || panel.dataset.cxStatsReady === '1') return;
    const s = await loadStats();
    if (!document.body.contains(panel)) return;
    panel.dataset.cxStatsReady = '1';
    const order = ['canonical','validated','tested','candidate','draft','reference','À_VALIDER'];
    const labels = {canonical:'canoniques',validated:'validées',tested:'testées',candidate:'candidates',draft:'drafts',reference:'références','À_VALIDER':'à valider'};
    const statusHtml = order.filter(k => s.byStatus[k]).map(k => `<span class="badge">${s.byStatus[k]} ${labels[k]}</span>`).join('');
    panel.innerHTML = `
      <h2>Catalogue CuisineX</h2>
      <div class="cx-kpis">
        <a class="cx-kpi" href="?section=recipes&lang=fr"><strong>${s.recipes}</strong><span>recettes au total</span></a>
        <a class="cx-kpi" href="?section=ingredients&lang=fr"><strong>${s.ingredients}</strong><span>ingrédients au total</span></a>
        <a class="cx-kpi" href="?section=techniques&lang=fr"><strong>${s.techniques}</strong><span>techniques</span></a>
        <a class="cx-kpi" href="?section=equipment&lang=fr"><strong>${s.equipment}</strong><span>matériels / ustensiles</span></a>
      </div>
      <div class="cx-statuses">${statusHtml}</div>
      <p class="muted">Les totaux sont calculés depuis les données réellement chargées. Les candidates, drafts et matériels à identifier restent distincts des objets validés.</p>
      <p><a class="btn" href="./database.html">Base SQL V1</a></p>`;
  }

  const observer = new MutationObserver(() => enhance());
  observer.observe(document.documentElement, {subtree:true, childList:true});
  window.addEventListener('DOMContentLoaded', enhance);
  enhance();
})();
