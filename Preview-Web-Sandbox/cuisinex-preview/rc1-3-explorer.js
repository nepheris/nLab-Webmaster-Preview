import {state,esc,text,normalize} from './core.js';
import {render} from './app.js';

const BUILD='V1 RC1.3 FR';
const UPDATED='2026-08-26 19:47 Europe/Paris';
const CIQUAL_DATASET='https://doi.org/10.57745/RDMHWY';
const CIQUAL_FOODS='https://entrepot.recherche.data.gouv.fr/api/access/datafile/:persistentId?persistentId=doi:10.57745/OH8KXC';
const CIQUAL_GROUPS='https://entrepot.recherche.data.gouv.fr/api/access/datafile/:persistentId?persistentId=doi:10.57745/FMNIUZ';
const CIQUAL_HOME='https://ciqual.anses.fr/cms/fr/la-table-ciqual-2025';
const CIQUAL_ITEM=code=>`https://ciqual.anses.fr/#/aliments/${encodeURIComponent(code)}`;

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const localText=v=>text(v)||String(v??'');
const find=(type,id)=>(state.data?.[type]||[]).find(x=>x.id===id)||null;
const fmtDate=v=>v?String(v).replace(/^([0-9]{4})-([0-9]{2})-([0-9]{2}).*$/,'$3/$2/$1'):'À_VALIDER';

function installStyle(){
  if(document.getElementById('rc13-style'))return;
  const s=document.createElement('style');s.id='rc13-style';s.textContent=`
    #catchupRecipeFilters{display:none!important}
    .rc13-filter-panel{margin:12px 0}.rc13-filter-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
    .rc13-filter-row .btn.active{font-weight:700;box-shadow:inset 0 0 0 2px currentColor}
    .rc13-filter-row .btn .count{opacity:.7;margin-left:4px}
    .rc13-ciqual-state{margin:10px 0;padding:10px 12px;border:1px solid var(--border,#ddd);border-radius:10px}
    .rc13-links{display:flex;flex-wrap:wrap;gap:8px}.rc13-meta{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px}
    .rc13-meta>div{border:1px solid var(--border,#ddd);border-radius:10px;padding:10px}
    .rc13-source-note{margin-top:8px;font-size:.9rem;opacity:.8}
  `;document.head.appendChild(s);
}

function updateBuildIdentity(){
  document.title=`CuisineX — ${BUILD}`;
  const versionMeta=document.querySelector('meta[name="cuisinex-version"]');if(versionMeta)versionMeta.content=BUILD;
  const updatedMeta=document.querySelector('meta[name="cuisinex-updated-at"]');if(updatedMeta)updatedMeta.content=UPDATED;
  document.querySelectorAll('#siteHeader .brand .badge').forEach(b=>{if(/V1 RC/i.test(b.textContent||''))b.textContent=BUILD});
  const f=document.querySelector('#siteFooter p');if(f)f.textContent=`CuisineX ${BUILD} · mise à jour ${UPDATED}`;
}

function recipeStatuses(){
  const counts={};for(const r of state.data?.recipes||[]){const k=r.status||'sans_statut';counts[k]=(counts[k]||0)+1}
  const order=['canonical','validated','tested','candidate','draft','reference','experiment_candidate','À_VALIDER','sans_statut'];
  return [...new Set([...order.filter(x=>counts[x]),...Object.keys(counts).filter(x=>!order.includes(x))])].map(k=>({key:k,count:counts[k]}));
}
const STATUS_LABELS={canonical:'Canonical',validated:'Validée',tested:'Testée',candidate:'Candidate',draft:'Draft',reference:'Référence',experiment_candidate:'Expérimentale',À_VALIDER:'À valider',sans_statut:'Sans statut'};

function recipeMultiFilters(){
  if(state.section!=='recipes'||state.detail)return;
  document.getElementById('catchupRecipeFilters')?.remove();
  if(document.getElementById('rc13RecipeFilters'))return;
  const heading=document.querySelector('.collection-heading');if(!heading)return;
  const statuses=recipeStatuses();if(!statuses.length)return;
  const allKeys=statuses.map(x=>x.key);
  const selected=Array.isArray(state.recipeStatusFilters)?new Set(state.recipeStatusFilters):new Set(allKeys);
  const panel=document.createElement('div');panel.id='rc13RecipeFilters';panel.className='panel rc13-filter-panel no-print';
  panel.innerHTML=`<strong>Statut des recettes</strong><p class="muted">Tous les statuts sont sélectionnés par défaut. Cliquez sur un statut pour l'inclure ou l'exclure.</p><div class="rc13-filter-row"><button class="btn ${selected.size===allKeys.length?'active':''}" data-rstatus-all>Tous</button><button class="btn ${selected.size===0?'active':''}" data-rstatus-none>Aucun</button>${statuses.map(s=>`<button class="btn ${selected.has(s.key)?'active':''}" data-rstatus="${esc(s.key)}">${esc(STATUS_LABELS[s.key]||s.key)} <span class="count">${s.count}</span></button>`).join('')}</div>`;
  const search=document.getElementById('collectionSearch');(search||heading).insertAdjacentElement('afterend',panel);
  panel.querySelector('[data-rstatus-all]').onclick=()=>{state.recipeStatusFilters=null;state.statusFilter=null;state.page=1;render()};
  panel.querySelector('[data-rstatus-none]').onclick=()=>{state.recipeStatusFilters=[];state.statusFilter=null;state.page=1;render()};
  panel.querySelectorAll('[data-rstatus]').forEach(b=>b.onclick=()=>{
    const all=new Set(allKeys),cur=Array.isArray(state.recipeStatusFilters)?new Set(state.recipeStatusFilters):all;
    const key=b.dataset.rstatus;cur.has(key)?cur.delete(key):cur.add(key);
    state.recipeStatusFilters=cur.size===all.size?null:[...cur];state.statusFilter=null;state.page=1;render();
  });
}

function childText(node,...names){for(const name of names){for(const tag of [name,name.toUpperCase()]){const el=node.getElementsByTagName(tag)?.[0];const v=el?.textContent?.trim();if(v)return v}}return''}
function parseXml(txt){const doc=new DOMParser().parseFromString(txt,'application/xml');if(doc.querySelector('parsererror'))throw new Error('XML Ciqual invalide');return doc}
function nodesWith(doc,selector,field){let n=[...doc.querySelectorAll(selector)];if(n.length)return n;return [...doc.documentElement.children].filter(x=>childText(x,field))}
function groupMap(doc){const out=new Map();for(const n of nodesWith(doc,'ALIM_GRP, alim_grp','alim_grp_code')){const code=childText(n,'alim_grp_code');if(!code)continue;out.set(code,{code,name_fr:childText(n,'alim_grp_nom_fr','alim_grp_nom'),name_en:childText(n,'alim_grp_nom_eng'),level:childText(n,'alim_grp_niveau')})}return out}
function cleanCiqualDemo(){state.data.ingredients=(state.data.ingredients||[]).filter(x=>!(x.id==='CIQUAL-0001'&&(!x.ciqual_code||x.ciqual_code==='00000')))}
function mergeCiqualFoods(foodDoc,groupDoc){
  cleanCiqualDemo();const groups=groupMap(groupDoc),byCode=new Map();for(const x of state.data.ingredients||[])if(x.ciqual_code)byCode.set(String(x.ciqual_code),x);
  let parsed=0;
  for(const n of nodesWith(foodDoc,'ALIM, alim','alim_code')){
    const code=childText(n,'alim_code');const name=childText(n,'alim_nom_fr');if(!code||!name)continue;parsed++;
    const grpCode=childText(n,'alim_grp_code'),ssgrpCode=childText(n,'alim_ssgrp_code'),sssgrpCode=childText(n,'alim_ssssgrp_code','alim_sssgrp_code');
    const item={id:`CIQUAL-${code}`,source_type:'ciqual',source_status:'official_ciqual_2025',mapping_status:'official_reference',ciqual_code:code,name:{fr:name},scientific_name:childText(n,'alim_nom_sci')||null,english_name:childText(n,'alim_nom_eng')||null,group:{code:grpCode||null,name_fr:groups.get(grpCode)?.name_fr||null,subgroup_code:ssgrpCode||null,subsubgroup_code:sssgrpCode||null},external_url:CIQUAL_ITEM(code),dataset_url:CIQUAL_DATASET,nutrition:{status:'available_in_official_ciqual_2025'},culinary_properties:{status:'not_provided_by_ciqual',summary:{fr:'La table Ciqual documente la composition nutritionnelle, pas les propriétés de procédé CuisineX (fusion, coagulation, gélification, comportement thermique). Ces propriétés sont enrichies séparément lorsqu’une source dédiée existe.'}},conservation:{status:'not_provided_by_ciqual'},seasonality:{status:'not_provided_by_ciqual'},last_updated:'2025-11-19',tags:['Ciqual','Anses','2025',groups.get(grpCode)?.name_fr].filter(Boolean)};
    const existing=byCode.get(code);if(existing){Object.assign(existing,{...item,...existing,id:existing.id||item.id,external_url:item.external_url,dataset_url:CIQUAL_DATASET,source_type:'ciqual',ciqual_code:code});}else{state.data.ingredients.push(item);byCode.set(code,item)}
  }
  const unique=new Set((state.data.ingredients||[]).filter(x=>x.source_type==='ciqual'&&x.ciqual_code).map(x=>String(x.ciqual_code))).size;
  state.data.meta=state.data.meta||{};state.data.meta.ciqual_2025_index={status:'loaded',parsed_rows:parsed,unique_codes:unique,expected_count:3484,dataset:CIQUAL_DATASET,loaded_at:new Date().toISOString()};
  return {parsed,unique};
}

let ciqualStarted=false;
async function loadCiqualIndex(){
  if(ciqualStarted)return;ciqualStarted=true;state.data.meta=state.data.meta||{};state.data.meta.ciqual_2025_index={status:'loading',expected_count:3484,dataset:CIQUAL_DATASET};
  if(state.section==='ingredients'&&!state.detail)render();
  try{
    const [fr,gr]=await Promise.all([fetch(CIQUAL_FOODS,{cache:'force-cache'}),fetch(CIQUAL_GROUPS,{cache:'force-cache'})]);
    if(!fr.ok||!gr.ok)throw new Error(`HTTP aliments ${fr.status}, groupes ${gr.status}`);
    const result=mergeCiqualFoods(parseXml(await fr.text()),parseXml(await gr.text()));
    if(result.parsed!==3484)state.data.meta.ciqual_2025_index.warning=`${result.parsed} lignes parsées pour 3484 attendues`;
    if(state.section==='ingredients'||state.section==='home'||state.section==='library')render();
  }catch(e){state.data.meta.ciqual_2025_index={status:'unavailable',expected_count:3484,dataset:CIQUAL_DATASET,message:String(e)};console.warn('Ciqual 2025 index unavailable',e);if(state.section==='ingredients')render()}
}

function ciqualStatusPanel(){
  if(state.section!=='ingredients'||state.detail||document.getElementById('rc13CiqualState'))return;
  const heading=document.querySelector('.collection-heading');if(!heading)return;const m=state.data?.meta?.ciqual_2025_index||{status:'loading',expected_count:3484};
  const p=document.createElement('div');p.id='rc13CiqualState';p.className='rc13-ciqual-state';
  if(m.status==='loaded')p.innerHTML=`<strong>Ciqual 2025 : ${m.unique_codes} aliments référencés</strong><p class="muted">Référentiel officiel Anses. ${m.unique_codes===m.expected_count?'Index complet chargé.':`Contrôle attendu : ${m.expected_count}.`}</p><div class="rc13-links"><a class="btn" href="${CIQUAL_HOME}" target="_blank" rel="noopener">Table Ciqual ↗</a><a class="btn" href="${CIQUAL_DATASET}" target="_blank" rel="noopener">Open data / DOI ↗</a></div>`;
  else if(m.status==='unavailable')p.innerHTML=`<strong>Ciqual 2025 : chargement externe indisponible</strong><p class="muted">${esc(m.message||'Le navigateur n’a pas pu charger l’index.')}</p><div class="rc13-links"><a class="btn" href="${CIQUAL_HOME}" target="_blank" rel="noopener">Consulter Ciqual ↗</a><a class="btn" href="${CIQUAL_DATASET}" target="_blank" rel="noopener">Jeu open data ↗</a></div>`;
  else p.innerHTML=`<strong>Ciqual 2025 : chargement de l’index officiel…</strong><p class="muted">3 484 aliments attendus. Le fichier d’identité aliments fait environ 1,5 Mo.</p>`;
  heading.insertAdjacentElement('afterend',p);
}

function upsertLibrary(){
  const lib=state.data.library=state.data.library||[];
  state.data.library=lib.filter(x=>x.id!=='RES-CIQUAL');
  let ciq=find('library','RES-CIQUAL-2025');if(!ciq){ciq={id:'RES-CIQUAL-2025',category:'institutionnel',title:'Anses — Table Ciqual 2025'};state.data.library.push(ciq)}
  Object.assign(ciq,{summary:{fr:'Référentiel français de composition nutritionnelle publié par l’Anses. CuisineX l’utilise comme source de référence pour identifier les aliments génériques et documenter leur composition nutritionnelle moyenne.'},description_long:{fr:'La version 2025 décrit 3 484 aliments pour 74 constituants. Elle est disponible en libre accès en Excel et XML. Dans CuisineX, le code aliment (alim_code) sert d’identifiant de liaison vers la fiche officielle ; les propriétés culinaires de procédé restent une couche CuisineX séparée.'},key_points:['3 484 aliments dans la version 2025','74 constituants nutritionnels','données ouvertes sous licence Etalab 2.0','formats Excel et XML','liaison CuisineX par alim_code'],url:CIQUAL_HOME,links:[{label:'Consulter la Table Ciqual',url:CIQUAL_HOME},{label:'Jeu de données officiel / DOI',url:CIQUAL_DATASET},{label:'Index XML des aliments',url:'https://doi.org/10.57745/OH8KXC'},{label:'Index XML des groupes',url:'https://doi.org/10.57745/FMNIUZ'},{label:'Documentation Ciqual 2025',url:'https://ciqual.anses.fr/cms/sites/default/files/inline-files/Table%20Ciqual%202025%20doc%20FR_2025_11_19.pdf'}],open_data:{status:'open',license:'Etalab Open License 2.0',formats:['XLSX','XLS','XML'],dataset_doi:'10.57745/RDMHWY'},last_updated:'2026-08-26'});
  let rnm=find('library','RES-FRANCEAGRIMER-RNM');if(!rnm){rnm={id:'RES-FRANCEAGRIMER-RNM',category:'institutionnel',title:'FranceAgriMer — RNM & données fruits/légumes'};state.data.library.push(rnm)}
  Object.assign(rnm,{summary:{fr:'FranceAgriMer et le Réseau des nouvelles des marchés (RNM) fournissent des cotations, analyses de campagne et indicateurs économiques utiles pour contextualiser les fruits, légumes et pommes de terre.'},description_long:{fr:'CuisineX peut exploiter ces ressources pour documenter le contexte économique et commercial d’un produit : période de campagne, prix/cotations, offre, demande, échanges extérieurs et consommation. Une cotation RNM doit toujours conserver sa date, son unité et son stade de marché ; elle ne doit pas être présentée automatiquement comme un prix consommateur.'},key_points:['cotations et prix de marché','offre, demande et consommation','échanges extérieurs','bilans et campagnes fruits/légumes','mise en perspective française, européenne et mondiale'],url:'https://rnm.franceagrimer.fr/',links:[{label:'RNM — cotations',url:'https://rnm.franceagrimer.fr/'},{label:'Filière fruits, légumes et pommes de terre',url:'https://www.franceagrimer.fr/fili%C3%A8res-et-thematiques/fili%C3%A8re/fruits-legumes-et-pommes-de-terre'},{label:'Info Fruits et Légumes',url:'https://www.franceagrimer.fr/index.php/chiffre-et-analyses-economiques/info-fruits-et-legumes'}],open_data:{status:'public_information',note:'Les modalités de réutilisation varient selon les jeux et publications ; conserver la provenance et les métadonnées de cotation.'},last_updated:'2026-08-26'});
  const choc=find('library','RES-CHOC-PERSPECTIVE');if(choc)Object.assign(choc,{summary:{fr:'Article scientifique de synthèse sur le tempérage du chocolat comme processus de cristallisation multi-échelle, au-delà de la seule présence de la forme V du beurre de cacao.'},description_long:{fr:'La publication relie polymorphisme, nucléation, homogénéité structurale et organisation microstructurale aux propriétés recherchées et au risque de bloom. CuisineX l’utilise comme source scientifique de contexte pour la fiche de tempérage.'},key_points:['tempérage = cristallisation contrôlée du beurre de cacao','la forme V est importante mais ne suffit pas à décrire toute la qualité','la microstructure influence stabilité mécanique et bloom'],links:[{label:'Article scientifique (PMC)',url:'https://pmc.ncbi.nlm.nih.gov/articles/PMC12063059/'}],last_updated:'2026-08-26'});
  const val=find('library','RES-VALRHONA');if(val)Object.assign(val,{summary:{fr:'Ressource professionnelle présentant l’objectif du tempérage, les principales méthodes et des courbes de température opérationnelles selon le type de chocolat.'},description_long:{fr:'Cette ressource est utile comme repère pratique de pâtisserie : bain-marie, ensemencement, tablage, température de fonte, cristallisation et travail. Les courbes doivent être adaptées au chocolat réellement utilisé et à sa composition.'},key_points:['brillance, démoulage et cassure propre sont des objectifs du tempérage','courbes distinctes pour chocolat noir, lait et blanc','thermomètre et maîtrise de l’eau sont essentiels'],links:[{label:'Valrhona — tempérage du chocolat',url:'https://www.valrhona.com/fr-FR/l-ecole-valrhona/decouvrir-l-ecole-valrhona/lexique-du-chocolat/temperage-du-chocolat'}],last_updated:'2026-08-26'});
}

function appendSection(id,title,body){if(document.getElementById(id))return;const s=document.createElement('section');s.id=id;s.className='section';s.innerHTML=`<div class="section-head"><h2>${esc(title)}</h2></div><div class="section-body">${body}</div>`;document.querySelector('#app')?.appendChild(s)}
function resourceDetail(){
  if(state.detail?.type!=='library')return;const x=find('library',state.detail.id);if(!x)return;
  if(x.description_long)appendSection(`rc13-lib-${x.id}-about`,'À quoi sert cette ressource ?',`<p>${esc(localText(x.description_long))}</p>`);
  if((x.links||[]).length)appendSection(`rc13-lib-${x.id}-links`,'Accès & liens utiles',`<div class="rc13-links">${x.links.map(l=>`<a class="btn" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} ↗</a>`).join('')}</div>`);
  if(x.open_data)appendSection(`rc13-lib-${x.id}-open`,'Données publiques / open data',`<div class="rc13-meta"><div><strong>Statut</strong><p>${esc(x.open_data.status||'—')}</p></div><div><strong>Licence</strong><p>${esc(x.open_data.license||'À vérifier selon le jeu')}</p></div><div><strong>Formats</strong><p>${esc((x.open_data.formats||[]).join(' · ')||'—')}</p></div></div>${x.open_data.note?`<p class="rc13-source-note">${esc(x.open_data.note)}</p>`:''}`);
}

const TECH={
  'TECH-001':{title:'Synthèse technique — tempérage du chocolat',body:`<p>Le tempérage est une cristallisation contrôlée du beurre de cacao destinée à obtenir un chocolat brillant, cassant et facile à démouler. La littérature scientifique récente souligne que la qualité dépend non seulement du polymorphe visé mais aussi de l'organisation microstructurale.</p><table class="table"><thead><tr><th>Chocolat</th><th>Fonte</th><th>Refroidissement</th><th>Travail</th></tr></thead><tbody><tr><td>Noir</td><td>50–55 °C</td><td>28–29 °C</td><td>31–32 °C</td></tr><tr><td>Lait</td><td>45–50 °C</td><td>27–28 °C</td><td>29–30 °C</td></tr><tr><td>Blanc / blond</td><td>45–50 °C</td><td>26–27 °C</td><td>28–29 °C</td></tr></tbody></table><p class="muted">Repères pratiques Valrhona ; vérifier la composition et les recommandations du chocolat réellement utilisé.</p><div class="rc13-links"><a class="btn" href="https://www.valrhona.com/fr-FR/l-ecole-valrhona/decouvrir-l-ecole-valrhona/lexique-du-chocolat/temperage-du-chocolat" target="_blank" rel="noopener">Valrhona ↗</a><a class="btn" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC12063059/" target="_blank" rel="noopener">Article scientifique ↗</a></div>`},
  'TIP-001':{title:'Synthèse — rattraper une ganache trop ferme',body:`<p>Cette fiche est une procédure interne CuisineX candidate. Elle doit décrire les corrections progressives, les quantités réellement ajoutées, la température de travail et le résultat après rematuration. Les paramètres non documentés ne sont pas complétés par supposition.</p>`},
  'TECH-002':{title:'Synthèse — crème fouettée',body:`<p>Fiche encore en statut draft. Les rubriques prévues sont : matière grasse, température, foisonnement, stabilité, acidité, signes de sur-battage et conditions de conservation. Les seuils techniques restent à documenter avec des sources adaptées avant canonisation.</p>`}
};
function techniqueDetail(){
  if(state.detail?.type!=='techniques')return;const x=find('techniques',state.detail.id);if(!x)return;const t=TECH[x.id];
  appendSection(`rc13-tech-${x.id}-summary`,t?.title||'Synthèse technique',t?.body||`<p>${esc(localText(x.summary)||'Synthèse technique à compléter.')}</p><p><strong>Statut :</strong> ${esc(x.status||'À_VALIDER')}</p>`);
  appendSection(`rc13-tech-${x.id}-usage`,'Application dans CuisineX',`<p>Cette fiche est reliée aux recettes et ingrédients par identifiants. Les valeurs opératoires ne deviennent canoniques qu’après vérification des sources et, lorsque nécessaire, essai réel documenté.</p>`);
}

function ciqualIngredientDetail(){
  if(state.detail?.type!=='ingredients')return;const x=find('ingredients',state.detail.id);if(!x||x.source_type!=='ciqual')return;
  appendSection(`rc13-ciqual-${x.id}-identity`,'Identité Ciqual 2025',`<div class="rc13-meta"><div><strong>alim_code</strong><p>${esc(x.ciqual_code||'À_VALIDER')}</p></div><div><strong>Groupe</strong><p>${esc(x.group?.name_fr||'À_VALIDER')}</p></div><div><strong>Nom scientifique</strong><p>${esc(x.scientific_name||'Non fourni / non disponible')}</p></div><div><strong>Référentiel</strong><p>Anses — Ciqual 2025</p></div></div><div class="rc13-links"><a class="btn" href="${esc(x.external_url||CIQUAL_HOME)}" target="_blank" rel="noopener">Fiche officielle Ciqual ↗</a><a class="btn" href="${CIQUAL_DATASET}" target="_blank" rel="noopener">Jeu open data ↗</a></div>`);
  appendSection(`rc13-ciqual-${x.id}-scope`,'Périmètre de la fiche',`<p><strong>Nutrition :</strong> disponible dans la source officielle Ciqual 2025.</p><p><strong>Propriétés culinaires :</strong> ${esc(x.culinary_properties?.status||'À_VALIDER')}. Ciqual ne doit pas être utilisé comme source unique pour fusion, coagulation, gélification, comportement thermique ou conservation.</p>`);
}

function conceptAllOpen(){document.querySelectorAll('#app .section.collapsed').forEach(s=>s.classList.remove('collapsed'))}
function enhance(){installStyle();updateBuildIdentity();document.getElementById('catchupRecipeFilters')?.remove();recipeMultiFilters();ciqualStatusPanel();resourceDetail();techniqueDetail();ciqualIngredientDetail();conceptAllOpen()}

async function boot(){
  for(let i=0;i<120&&!state.data;i++)await sleep(50);if(!state.data)return;
  for(let i=0;i<80&&!state.data?.meta?.integration_catchup;i++)await sleep(50);
  upsertLibrary();enhance();loadCiqualIndex();
  const app=document.getElementById('app');if(app)new MutationObserver(()=>queueMicrotask(enhance)).observe(app,{childList:true,subtree:true});
  document.addEventListener('cuisinex:ciqual-ready',()=>{upsertLibrary();enhance()});
}
boot();
