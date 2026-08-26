import {state,normalize} from './core.js';

const BASE='https://raw.githubusercontent.com/recettesducoeur/recettesducoeur.github.io/main/data/referentiels_v72/';
const INGREDIENTS=`${BASE}ingredients.json`;
const MAPPINGS=`${BASE}ciqual_taxonomie_correspondances.json`;
const SOURCE_XLSX='https://raw.githubusercontent.com/recettesducoeur/recettesducoeur.github.io/main/assets/documents/references/ciqual/table-ciqual-2025.xlsx';
const textOf=v=>typeof v==='string'?v:(v?.fr||v?.en||Object.values(v||{})[0]||'');
const rows=x=>x?.referentiel?.donnees||x?.donnees||[];
const norm=s=>normalize(String(s||'')).replace(/[^a-z0-9]+/g,' ').trim();
function ciqualId(row){return row?.relations?.ciqual_id||row?.relations?.ciqual_code||row?.attributs_metier?.ciqual_id||row?.attributs_metier?.code_ciqual||null}
function projectId(row){return row?.identite?.ingredient_id||row?.relations?.ingredient_id||row?.ingredient_id||null}
function label(row){return row?.identite?.libelle_humain||row?.attributs_metier?.libelle_humain||row?.attributs_metier?.nom||row?.libelle_humain||''}
function nutrition(row){const a=row?.attributs_metier||{},c=row?.contenu||{},n=a.nutrition||c.nutrition||row?.nutrition||{};const p=n.per_100g||n.pour_100g||n.valeurs_100g||null;return p?{status:'documented',per_100g:p,source:'Base Ingrédients avec CIQUAL / référentiel V72'}:null}
async function fetchJson(url){const r=await fetch(url,{cache:'force-cache'});if(!r.ok)throw new Error(`${r.status} ${url}`);return r.json()}
const relevant=()=>state.section==='ingredients'||state.section==='recipes'||state.detail?.type==='ingredients'||state.detail?.type==='recipes';
let started=false;
async function bridge(){
  if(started||!state.data||!relevant())return;started=true;
  try{
    const [ingredients,mappings]=await Promise.all([fetchJson(INGREDIENTS),fetchJson(MAPPINGS)]);
    const sourceRows=rows(ingredients),mapRows=rows(mappings),byProject=new Map(),byName=new Map(),mappingByProject=new Map();
    for(const r of sourceRows){const id=projectId(r);if(id)byProject.set(id,r);const l=label(r);if(l&&!byName.has(norm(l)))byName.set(norm(l),r)}
    for(const m of mapRows){const id=m?.relations?.ingredient_id;if(id)mappingByProject.set(id,m)}
    let matched=0;
    for(const ing of state.data.ingredients||[]){
      const name=textOf(ing.name||ing.title),source=byProject.get(ing.project_ingredient_id||ing.id)||byName.get(norm(name));
      if(!source)continue;
      const pid=projectId(source),map=mappingByProject.get(pid),cid=ciqualId(map)||ciqualId(source),nut=nutrition(source);
      ing.project_ingredient_id=pid||ing.project_ingredient_id||null;
      ing.source_type='ciqual';ing.source_status='project_ciqual_v72';ing.mapping_status=cid?'project_mapping':'project_record';
      if(cid)ing.ciqual_code=cid;if(nut)ing.nutrition=nut;
      ing.ciqual_reference={source:'Base Ingrédients avec CIQUAL V2.1 / référentiel V72',source_repository:'recettesducoeur/recettesducoeur.github.io',ingredient_record_url:INGREDIENTS,mapping_url:MAPPINGS,official_source_file:SOURCE_XLSX,project_ingredient_id:pid||null,ciqual_id:cid||null,confidence:map?.attributs_metier?.niveau_confiance||null,validation_status:map?.validation?.statut_validation_id||null};
      matched++;
    }
    state.data.meta=state.data.meta||{};state.data.meta.ciqual_bridge={status:'connected',source:'P002 V72 — Base Ingrédients avec CIQUAL',matched_ingredients:matched,ingredient_records:sourceRows.length,mapping_records:mapRows.length,loaded_at:'2026-08-27',persistence:'memory_only'};
    document.dispatchEvent(new CustomEvent('cuisinex:ciqual-ready',{detail:state.data.meta.ciqual_bridge}));
  }catch(e){started=false;console.warn('Cuisine X Ciqual V72 bridge unavailable',e);state.data.meta=state.data.meta||{};state.data.meta.ciqual_bridge={status:'unavailable',message:String(e)}}
}
async function boot(){for(let i=0;i<100&&!state.data;i++)await new Promise(r=>setTimeout(r,50));if(!state.data)return;bridge();const app=document.getElementById('app');if(app)new MutationObserver(()=>bridge()).observe(app,{childList:true,subtree:true});}
boot();
