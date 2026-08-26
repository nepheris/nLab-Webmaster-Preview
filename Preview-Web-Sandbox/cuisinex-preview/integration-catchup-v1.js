import {state,savePrefs,saveData,normalize,esc,text} from './core.js';
import {render} from './app.js';

const TODAY='2026-08-26';
const CIQUAL_HOME='https://ciqual.anses.fr/cms/';
const TYPES=['recipes','ingredients','techniques','equipment','library','trials'];

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function slug(s){return normalize(s).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,56)||'ingredient'}
function localText(v){return text(v)||String(v??'')}
function find(type,id){return (state.data?.[type]||[]).find(x=>x.id===id)||null}
function mergeUnique(type,items=[]){
  state.data[type]=state.data[type]||[];
  const byId=new Map(state.data[type].map(x=>[x.id,x]));
  for(const item of items){
    if(!item?.id)continue;
    const existing=byId.get(item.id);
    if(existing)Object.assign(existing,{...item,...existing,tags:[...new Set([...(item.tags||[]),...(existing.tags||[])])]});
    else{state.data[type].push(item);byId.set(item.id,item)}
  }
}
function normalizePublicMarketNames(){
  const rename={
    'PRD-MILKA-OREO':'Chocolat au lait fourré biscuit cacao — produit marché',
    'PRD-COTE-DOR-PRALINE':'Chocolat au lait praliné — produit marché'
  };
  for(const ing of state.data.ingredients||[]){
    if(rename[ing.id]){
      ing.internal_name=ing.name;
      ing.name={fr:rename[ing.id]};
      ing.public_brand_policy='brand_hidden';
    }
  }
  const titleRenames={
    'REC-001':'Ganache montée chocolat biscuit cacao — crème 35 %',
    'REC-002':'Ganache montée chocolat biscuit cacao — crème 30 %',
    'REC-003':'Mousse chocolat biscuit cacao aux œufs',
    'REC-005':'Ganache montée chocolat praliné — crème UHT 30 %'
  };
  for(const r of state.data.recipes||[])if(titleRenames[r.id]){r.internal_title=r.title;r.title={fr:titleRenames[r.id]}}
}
function ensureDates(){
  for(const type of TYPES)for(const obj of state.data[type]||[]){
    obj.last_updated=obj.last_updated||obj.updated_at||obj.derniere_mise_a_jour||TODAY;
    obj.derniere_mise_a_jour=obj.last_updated;
  }
}
function sanitizeDemoCiqual(){
  const demo=find('ingredients','CIQUAL-0001');
  if(demo){
    demo.ciqual_code=null;
    demo.name={fr:'Banane — mapping Ciqual à valider'};
    demo.source_status='À_VALIDER';
    demo.mapping_status='À_VALIDER';
    demo.external_url=CIQUAL_HOME;
    demo.notes={fr:'Ancienne entrée de démonstration : aucun code Ciqual n’est affiché tant que le mapping exact n’est pas vérifié.'};
  }
}
function ensureIngredient(name,idHint=null){
  const label=String(name||idHint||'Ingrédient').trim();
  const id=idHint||`ING-LEGACY-${slug(label).toUpperCase()}`;
  let ing=find('ingredients',id);
  if(!ing){
    ing={
      id,
      source_type:'personal',
      source_status:'project_reference',
      mapping_status:'À_VALIDER',
      name:{fr:label},
      tags:['utilisé-en-recette','mapping-à-valider'],
      last_updated:TODAY,
      density_g_ml:null,
      density_status:'À_VALIDER',
      nutrition:{status:'À_VALIDER'},
      culinary_properties:{status:'À_VALIDER'},
      conservation:{status:'À_VALIDER'},
      seasonality:{status:'À_VALIDER'}
    };
    state.data.ingredients.push(ing);
  }
  return ing;
}
function buildIngredientGraph(){
  state.data.ingredients=state.data.ingredients||[];
  for(const ing of state.data.ingredients){
    ing.used_in_recipes=[];
    ing.density_g_ml=Number.isFinite(Number(ing.density_g_ml))?Number(ing.density_g_ml):null;
    ing.density_status=ing.density_status|| (ing.density_g_ml!=null?'documented':'À_VALIDER');
    ing.culinary_properties=ing.culinary_properties||{status:'À_VALIDER'};
    ing.conservation=ing.conservation||{status:'À_VALIDER'};
    ing.seasonality=ing.seasonality||{status:'À_VALIDER'};
  }
  for(const r of state.data.recipes||[]){
    r.ingredient_refs=r.ingredient_refs||[];
    for(const i of r.ingredients||[]){
      const ing=ensureIngredient(localText(i.label)||i.id,i.id);
      if(!ing.used_in_recipes.includes(r.id))ing.used_in_recipes.push(r.id);
      if(!r.ingredient_refs.includes(ing.id))r.ingredient_refs.push(ing.id);
    }
    const groups=r.ingredient_groups||{};
    for(const role of ['primary','secondary','optional'])for(const raw of groups[role]||[]){
      const ing=ensureIngredient(localText(raw));
      if(!ing.used_in_recipes.includes(r.id))ing.used_in_recipes.push(r.id);
      if(!r.ingredient_refs.includes(ing.id))r.ingredient_refs.push(ing.id);
    }
  }
}
function buildRecipeRelations(){
  const byId=new Map((state.data.recipes||[]).map(r=>[r.id,r]));
  for(const r of byId.values()){
    r.relations=r.relations||{};
    const variants=[...(r.relations.variants||[])];
    for(const other of byId.values())if((other.relations?.variant_of||[]).includes(r.id)&&!variants.includes(other.id))variants.push(other.id);
    if(variants.length)r.relations.variants=variants;
    r.tags=[...new Set([...(r.tags||[]),r.status||''])].filter(Boolean);
  }
}
function enrichNutritionTrace(){
  for(const r of state.data.recipes||[]){
    const refs=(r.ingredient_refs||[]).map(id=>find('ingredients',id)).filter(Boolean);
    r.nutrition_trace=refs.map(ing=>({
      ingredient_id:ing.id,
      name:localText(ing.name),
      source_type:ing.source_type||'À_VALIDER',
      ciqual_code:ing.ciqual_code||null,
      nutrition_status:ing.nutrition?.status||ing.source_status||'À_VALIDER'
    }));
    if(!r.nutrition)r.nutrition={status:'not_calculable',message:{fr:'Données nutritionnelles non disponibles pour cette fiche.'}};
    if(r.nutrition.status==='incomplete'||r.nutrition.status==='not_calculable'){
      r.nutrition.blocking_ingredients=refs.filter(x=>!x.nutrition||x.nutrition.status==='À_VALIDER'||x.mapping_status==='À_VALIDER').map(x=>x.id);
    }
  }
}
function setFrenchOnly(){
  state.lang='fr';
  if(state.prefs){
    state.prefs.sourceLanguage='fr';state.prefs.defaultLanguage='fr';state.prefs.secondaryLanguage='en';
    state.prefs.languages={fr:true,en:false,es:false,ru:false,ar:false,ps:false};
    savePrefs();
  }
}
async function mergeCatchupData(){
  try{
    const r=await fetch('./data/integration-catchup-v1.json',{cache:'no-store'});
    if(!r.ok)return;
    const x=await r.json();
    mergeUnique('recipes',x.recipes||[]);
    mergeUnique('equipment',x.equipment||[]);
    mergeUnique('ingredients',x.ingredients||[]);
    mergeUnique('library',x.library||[]);
    mergeUnique('techniques',x.techniques||[]);
  }catch(e){console.warn('CuisineX catch-up data unavailable',e)}
}
async function prepareData(){
  await mergeCatchupData();
  setFrenchOnly();
  sanitizeDemoCiqual();
  normalizePublicMarketNames();
  ensureDates();
  buildIngredientGraph();
  buildRecipeRelations();
  enrichNutritionTrace();
  state.data.meta=state.data.meta||{};
  state.data.meta.language_master='fr';
  state.data.meta.translation_status='paused_until_fr_freeze';
  state.data.meta.integration_catchup='2026-08-26';
  saveData();
}
function fmtDate(s){if(!s)return'À_VALIDER';const [y,m,d]=String(s).split('-');return y&&m&&d?`${d}/${m}/${y}`:s}
function volumeText(mass,ing){
  const rho=Number(ing?.density_g_ml);const g=Number(mass);
  if(!Number.isFinite(rho)||rho<=0||!Number.isFinite(g))return'';
  const ml=g/rho;
  if(ml>=1000)return` ≈ ${(ml/1000).toFixed(2).replace('.',',')} L`;
  if(ml>=100)return` ≈ ${(ml/10).toFixed(1).replace('.',',')} cL`;
  return` ≈ ${ml.toFixed(0)} mL`;
}
function bindOpenButtons(root=document){
  root.querySelectorAll('[data-catchup-open-type]').forEach(b=>b.onclick=()=>document.dispatchEvent(new CustomEvent('cuisinex:open',{detail:{type:b.dataset.catchupOpenType,id:b.dataset.catchupOpenId}})));
}
function addUpdateDates(){
  document.querySelectorAll('[data-open-type][data-open-id]').forEach(card=>{
    if(card.querySelector('.catchup-date'))return;
    const obj=find(card.dataset.openType,card.dataset.openId);if(!obj)return;
    const n=document.createElement('small');n.className='muted catchup-date';n.textContent=`Mis à jour : ${fmtDate(obj.last_updated)}`;card.append(n);
  });
  if(state.detail){
    const obj=find(state.detail.type,state.detail.id),head=document.querySelector('.detail-head>div');
    if(obj&&head&&!head.querySelector('.catchup-detail-date')){
      const p=document.createElement('p');p.className='muted catchup-detail-date';p.textContent=`Dernière mise à jour : ${fmtDate(obj.last_updated)}`;head.append(p);
    }
  }
}
function expandSections(){
  document.querySelectorAll('#app .section.collapsed').forEach(s=>s.classList.remove('collapsed'));
}
function recipeFilters(){
  if(state.section!=='recipes'||state.detail||document.querySelector('#catchupRecipeFilters'))return;
  const heading=document.querySelector('.collection-heading');if(!heading)return;
  const bar=document.createElement('div');bar.id='catchupRecipeFilters';bar.className='panel catchup-filter-panel no-print';
  const statuses=[['Tous',''],['Validées','canonical'],['Candidats','candidate'],['Draft','draft'],['Expérimental','experiment_candidate'],['Références P002','reference']];
  const themes=[['Ninja','ninja'],['Aubergine','aubergine'],['P019','p019'],['Nouvelles','2026-08-26']];
  bar.innerHTML=`<strong>Filtres recettes</strong><div class="filter-row">${statuses.map(([l,v])=>`<button class="btn ${state.statusFilter===v||(v===''&&!state.statusFilter)?'active':''}" data-catchup-status="${esc(v)}">${esc(l)}</button>`).join('')}</div><div class="filter-row">${themes.map(([l,v])=>`<button class="btn ${normalize(state.query)===v?'active':''}" data-catchup-query="${esc(v)}">${esc(l)}</button>`).join('')}<button class="btn" data-catchup-clear>Effacer filtres</button></div>`;
  heading.insertAdjacentElement('afterend',bar);
  bar.querySelectorAll('[data-catchup-status]').forEach(b=>b.onclick=()=>{state.statusFilter=b.dataset.catchupStatus||null;state.page=1;render()});
  bar.querySelectorAll('[data-catchup-query]').forEach(b=>b.onclick=()=>{state.query=b.dataset.catchupQuery;state.searchContext='section';state.statusFilter=null;state.page=1;render()});
  bar.querySelector('[data-catchup-clear]').onclick=()=>{state.query='';state.tokens=[];state.statusFilter=null;state.page=1;render()};
}
function ingredientFilters(){
  if(state.section!=='ingredients'||state.detail||document.querySelector('#catchupIngredientFilters'))return;
  const heading=document.querySelector('.collection-heading');if(!heading)return;
  const a=state.prefs?.ingredientSources||['personal','ciqual'];
  const mode=a.includes('personal')&&a.includes('ciqual')?'all':a.includes('ciqual')?'ciqual':'personal';
  const bar=document.createElement('div');bar.id='catchupIngredientFilters';bar.className='panel catchup-filter-panel no-print';
  bar.innerHTML=`<strong>Source ingrédients</strong><div class="filter-row"><button class="btn ${mode==='all'?'active':''}" data-ing-mode="all">Tous</button><button class="btn ${mode==='ciqual'?'active':''}" data-ing-mode="ciqual">Base Ciqual</button><button class="btn ${mode==='personal'?'active':''}" data-ing-mode="personal">Perso / projet</button></div><p class="muted">Les mappings non vérifiés restent identifiés À_VALIDER ; aucun code Ciqual n’est inventé.</p>`;
  heading.insertAdjacentElement('afterend',bar);
  bar.querySelectorAll('[data-ing-mode]').forEach(b=>b.onclick=()=>{const m=b.dataset.ingMode;state.prefs.ingredientSources=m==='all'?['personal','ciqual']:[m];savePrefs();state.page=1;render()});
}
function appendSection(id,title,html){
  if(document.getElementById(id))return;
  const s=document.createElement('section');s.id=id;s.className='section catchup-section';s.innerHTML=`<div class="section-head"><h2>${esc(title)}</h2></div><div class="section-body">${html}</div>`;
  document.querySelector('#app')?.append(s);
}
function ingredientDetailEnhancement(){
  if(state.detail?.type!=='ingredients')return;
  const x=find('ingredients',state.detail.id);if(!x)return;
  const n=x.nutrition||{},p=n.per_100g||n.pour_100g||null;
  appendSection(`catchup-ing-${x.id}-nutrition`,'Valeurs nutritionnelles',p?`<table class="table"><tbody>${Object.entries(p).map(([k,v])=>`<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table><p class="muted">Source : ${esc(x.source_type||'À_VALIDER')} ${x.ciqual_code?`· code Ciqual ${esc(x.ciqual_code)}`:''}</p>`:`<p><strong>Statut :</strong> ${esc(n.status||'À_VALIDER')}</p><p class="muted">Aucune valeur n’est inventée. Cette fiche sera enrichie lorsque la source exacte sera validée.</p>`);
  const cp=x.culinary_properties||{};
  const propRows=[['Densité',x.density_g_ml!=null?`${x.density_g_ml} g/mL`:'À_VALIDER'],['Température de référence densité',x.density_temperature_c!=null?`${x.density_temperature_c} °C`:'À_VALIDER'],['pH',cp.ph??'À_VALIDER'],['Teneur en eau',cp.water_pct!=null?`${cp.water_pct} %`:'À_VALIDER'],['Fusion',cp.melting??'À_VALIDER'],['Congélation',cp.freezing??'À_VALIDER'],['Coagulation / gélification',cp.coagulation??cp.gelation??'À_VALIDER'],['Comportement thermique',cp.thermal_behavior??'À_VALIDER']];
  appendSection(`catchup-ing-${x.id}-properties`,'Propriétés culinaires',`<table class="table"><tbody>${propRows.map(([a,b])=>`<tr><th>${esc(a)}</th><td>${esc(b)}</td></tr>`).join('')}</tbody></table><p class="muted">Les plages dépendent du produit et du procédé ; les valeurs non sourcées restent À_VALIDER.</p>`);
  appendSection(`catchup-ing-${x.id}-storage`,'Cuisson & conservation',`<p><strong>Cuisson / usages :</strong> ${esc(localText(x.cooking?.summary)||'À_VALIDER')}</p><p><strong>Conservation :</strong> ${esc(localText(x.conservation?.summary)||x.conservation?.status||'À_VALIDER')}</p><p><strong>Points de vigilance :</strong> ${esc(localText(x.conservation?.warnings)||'À_VALIDER')}</p>`);
  appendSection(`catchup-ing-${x.id}-season`,'Saison, variétés & marché',`<p><strong>Saisonnalité :</strong> ${esc(localText(x.seasonality?.summary)||x.seasonality?.status||'À_VALIDER')}</p><p><strong>Variétés :</strong> ${esc(localText(x.varieties)||'À_VALIDER')}</p><p><strong>Marché / prix :</strong> ${esc(localText(x.market?.summary)||'À_VALIDER')}</p><p class="muted">Pour les fruits et légumes, FranceAgriMer/RNM est une source candidate pour les cotations et bilans de campagne.</p><p><a class="btn" href="https://rnm.franceagrimer.fr/" target="_blank" rel="noopener">FranceAgriMer RNM ↗</a></p>`);
  const used=(x.used_in_recipes||[]).map(id=>find('recipes',id)).filter(Boolean);
  appendSection(`catchup-ing-${x.id}-recipes`,'Recettes utilisant cet ingrédient',used.length?`<div class="catchup-link-grid">${used.map(r=>`<button class="btn" data-catchup-open-type="recipes" data-catchup-open-id="${esc(r.id)}">${esc(localText(r.title))} · ${esc(r.status||'')}</button>`).join('')}</div>`:`<p class="muted">Aucune recette structurée liée actuellement.</p>`);
  const ciqual=x.source_type==='ciqual'?`<p><a class="btn" href="${esc(x.external_url||CIQUAL_HOME)}" target="_blank" rel="noopener">Ouvrir Ciqual ↗</a>${x.ciqual_code?` <span class="badge">alim_code ${esc(x.ciqual_code)}</span>`:' <span class="badge warn">code À_VALIDER</span>'}</p>`:'';
  appendSection(`catchup-ing-${x.id}-sources`,'Sources & provenance',`${ciqual}<p><strong>Type :</strong> ${esc(x.source_type||'À_VALIDER')}</p><p><strong>Statut source :</strong> ${esc(x.source_status||x.mapping_status||'À_VALIDER')}</p>${x.manufacturer_url?`<p><a class="btn" href="${esc(x.manufacturer_url)}" target="_blank" rel="noopener">Fabricant / gamme ↗</a></p>`:''}<p class="muted">Une source externe doit être synthétisée dans la fiche ; le lien sert de provenance, pas de substitut au contenu.</p>`);
  bindOpenButtons(document);
}
function recipeDetailEnhancement(){
  if(state.detail?.type!=='recipes')return;
  const r=find('recipes',state.detail.id);if(!r)return;
  document.querySelectorAll('.ingredient-row').forEach(row=>{
    if(row.querySelector('.catchup-volume'))return;
    const btn=row.querySelector('[data-open-id]');if(!btn)return;const ing=find('ingredients',btn.dataset.openId);const massEl=row.querySelector('[data-base-mass]');if(!ing||!massEl)return;
    const extra=volumeText(Number(massEl.dataset.baseMass),ing);if(extra){const s=document.createElement('span');s.className='muted catchup-volume';s.textContent=extra;massEl.insertAdjacentElement('afterend',s)}
  });
  const trace=r.nutrition_trace||[];
  appendSection(`catchup-rec-${r.id}-nutrition-trace`,'Traçabilité nutritionnelle',trace.length?`<table class="table"><thead><tr><th>Ingrédient</th><th>Source</th><th>Référence</th><th>Statut</th></tr></thead><tbody>${trace.map(t=>`<tr><td>${esc(t.name)}</td><td>${esc(t.source_type)}</td><td>${t.ciqual_code?`Ciqual ${esc(t.ciqual_code)}`:esc(t.ingredient_id)}</td><td>${esc(t.nutrition_status)}</td></tr>`).join('')}</tbody></table>${r.nutrition?.blocking_ingredients?.length?`<p><strong>Blocage calcul :</strong> ${r.nutrition.blocking_ingredients.map(esc).join(', ')}</p>`:''}`:`<p class="muted">Traçabilité ingrédient non structurée pour cette recette legacy.</p>`);
  const rel=r.relations||{},ids=[...(rel.variant_of||[]),...(rel.variants||[])];
  appendSection(`catchup-rec-${r.id}-variants`,'Variantes & recettes liées',ids.length?`<div class="catchup-link-grid">${[...new Set(ids)].map(id=>{const rr=find('recipes',id);return rr?`<button class="btn" data-catchup-open-type="recipes" data-catchup-open-id="${esc(id)}">${esc(localText(rr.title))} · ${esc(rr.status||'')}</button>`:`<span class="badge">${esc(id)}</span>`}).join('')}</div>`:`<p class="muted">Aucune variante structurée actuellement.</p>`);
  if((r.equipment||[]).length)appendSection(`catchup-rec-${r.id}-equipment`,'Matériel lié',`<div class="catchup-link-grid">${r.equipment.map(id=>{const e=find('equipment',id);return e?`<button class="btn" data-catchup-open-type="equipment" data-catchup-open-id="${esc(id)}">${esc(localText(e.name))}</button>`:`<span class="badge">${esc(id)}</span>`}).join('')}</div>`);
  bindOpenButtons(document);
}
function libraryDetailEnhancement(){
  if(state.detail?.type!=='library')return;const x=find('library',state.detail.id);if(!x)return;
  appendSection(`catchup-lib-${x.id}-summary`,'Synthèse intégrée',`<p>${esc(localText(x.summary)||'Synthèse à compléter.')}</p>${(x.key_points||[]).length?`<ul>${x.key_points.map(k=>`<li>${esc(k)}</li>`).join('')}</ul>`:''}<p class="muted">Dernière mise à jour : ${fmtDate(x.last_updated)}</p>`);
}
function markFrenchOnly(){
  document.querySelectorAll('.alternate-language').forEach(x=>x.style.display='none');
  const top=document.querySelector('.topbar');if(top&&!document.querySelector('#frOnlyBadge')){const s=document.createElement('span');s.id='frOnlyBadge';s.className='badge';s.textContent='🇫🇷 FR · traductions en pause';top.insertBefore(s,document.querySelector('#openHelpHeader'))}
}
function enhancePage(){
  markFrenchOnly();expandSections();addUpdateDates();recipeFilters();ingredientFilters();ingredientDetailEnhancement();recipeDetailEnhancement();libraryDetailEnhancement();
}
async function boot(){
  for(let i=0;i<100&&!state.data;i++)await sleep(50);
  if(!state.data)return;
  await prepareData();
  render();
  enhancePage();
  const app=document.querySelector('#app');if(app)new MutationObserver(()=>queueMicrotask(enhancePage)).observe(app,{childList:true,subtree:true});
}
boot();
