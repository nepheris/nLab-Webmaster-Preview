import {state,normalize,text} from './core.js';
import {render} from './app.js';

const SQL_URL='./data/cuisinex-v1.sql';
const NUTRIENTS=[
  ['energy_kcal',['energy_kcal','energie_kcal']],
  ['protein_g',['protein_g','proteines_g']],
  ['carbs_g',['carbs_g','glucides_g']],
  ['sugars_g',['sugars_g','sucres_g']],
  ['fat_g',['fat_g','lipides_g']],
  ['saturates_g',['saturates_g','acides_gras_satures_g']],
  ['fiber_g',['fiber_g','fibres_g']],
  ['salt_g',['salt_g','sel_g']]
];

const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const localText=v=>text(v)||String(v??'');
const norm=s=>normalize(String(s||'')).replace(/[^a-z0-9]+/g,' ').trim();
const number=v=>{const n=Number(v);return Number.isFinite(n)?n:null};

function first(obj,keys){for(const k of keys){const v=obj?.[k];if(v!=null&&v!==''){const n=number(v);if(n!=null)return n}}return null}
function per100(ing){
  const n=ing?.nutrition||{};
  return n.per_100g||n.pour_100g||n.values?.per_100g||n.valeurs_100g||null;
}
function ingredientIndexes(){
  const byId=new Map(),byName=new Map();
  for(const ing of state.data?.ingredients||[]){
    if(ing.id)byId.set(ing.id,ing);
    const name=norm(localText(ing.name||ing.title));if(name&&!byName.has(name))byName.set(name,ing);
  }
  return {byId,byName};
}
function resolveIngredient(row,index){
  if(row?.id&&index.byId.has(row.id))return index.byId.get(row.id);
  const name=norm(localText(row?.label)||row?.name||row?.id);return name?index.byName.get(name)||null:null;
}
function massFor(row,ing){
  const direct=number(row?.mass_g);if(direct!=null)return {mass_g:direct,status:'mass_structured'};
  const value=number(row?.scale_value),unit=String(row?.scale_unit||'').toLowerCase();
  if(value==null)return {mass_g:null,status:'quantity_unstructured'};
  if(unit==='g')return {mass_g:value,status:'mass_structured'};
  if(unit==='kg')return {mass_g:value*1000,status:'mass_structured'};
  if(unit==='ml'){
    const rho=number(ing?.density_g_ml);if(rho!=null&&rho>0)return {mass_g:value*rho,status:'volume_converted_with_density'};
    return {mass_g:null,status:'density_missing'};
  }
  if(unit==='l'){
    const rho=number(ing?.density_g_ml);if(rho!=null&&rho>0)return {mass_g:value*1000*rho,status:'volume_converted_with_density'};
    return {mass_g:null,status:'density_missing'};
  }
  return {mass_g:null,status:`unsupported_unit_${unit||'none'}`};
}
function emptyTotals(){const out={};for(const [k] of NUTRIENTS)out[k]=0;return out}
function round(v,d=2){return Math.round((v+Number.EPSILON)*10**d)/10**d}

function computeRecipe(recipe,index){
  const rows=recipe.ingredients||[];if(!rows.length)return null;
  let totalMass=0,coveredMass=0;const totals=emptyTotals(),blockers=[],sources=[];
  for(const row of rows){
    const ing=resolveIngredient(row,index),mass=massFor(row,ing);
    if(mass.mass_g!=null)totalMass+=mass.mass_g;
    if(!ing){blockers.push({ingredient_id:row.id||null,label:localText(row.label)||row.id||'Ingrédient',reason:'ingredient_not_found'});continue}
    const p=per100(ing);if(mass.mass_g==null){blockers.push({ingredient_id:ing.id,label:localText(ing.name),reason:mass.status});continue}
    if(!p){blockers.push({ingredient_id:ing.id,label:localText(ing.name),reason:'nutrition_missing'});continue}
    let hasAny=false;
    for(const [outKey,aliases] of NUTRIENTS){const v=first(p,aliases);if(v==null)continue;totals[outKey]+=v*mass.mass_g/100;hasAny=true}
    if(hasAny){coveredMass+=mass.mass_g;sources.push({ingredient_id:ing.id,source_type:ing.source_type||'unknown',ciqual_code:ing.ciqual_code||null,nutrition_source:ing.nutrition?.source||ing.ciqual_reference?.source||ing.source_status||null})}
    else blockers.push({ingredient_id:ing.id,label:localText(ing.name),reason:'nutrition_fields_missing'});
  }
  if(totalMass<=0)return null;
  const completeness=round(100*coveredMass/totalMass,1),per100g={},servings=number(recipe.servings||recipe.portions?.reference),perServing={};
  for(const [k] of NUTRIENTS){per100g[k]=round(totals[k]*100/totalMass,k==='energy_kcal'?0:2);if(servings&&servings>0)perServing[k]=round(totals[k]/servings,k==='energy_kcal'?0:2)}
  const portionMass=servings&&servings>0?totalMass/servings:null;
  return {
    status:completeness===100?'calculated_dynamic':'calculated_partial',
    calculation_mode:'runtime_from_ingredient_sources',
    source_status:completeness===100?'ingredient_sources_complete':'ingredient_sources_partial',
    completeness_pct:completeness,
    mass_total_g:round(totalMass,1),
    portion_mass_g:portionMass!=null?round(portionMass,1):null,
    per_100g:per100g,
    per_serving:servings&&servings>0?perServing:null,
    blocking_ingredients:blockers.map(x=>x.ingredient_id||x.label),
    blockers,
    source_refs:sources,
    generated_at:new Date().toISOString()
  };
}

function splitSqlTuple(line){
  const out=[];let cur='',quoted=false;
  for(let i=0;i<line.length;i++){
    const c=line[i];
    if(c==="'"){
      if(quoted&&line[i+1]==="'"){cur+="'";i++;continue}
      quoted=!quoted;continue;
    }
    if(c===','&&!quoted){out.push(cur.trim());cur='';continue}
    cur+=c;
  }
  out.push(cur.trim());return out;
}
function parseSqlNutrition(sql){
  const out=new Map();
  const block=sql.match(/INSERT INTO nutrition_per_100g VALUES\s*([\s\S]*?);/i)?.[1];if(!block)return out;
  const tuples=[...block.matchAll(/\(([^\n]*?)\)(?:,|$)/g)];
  for(const m of tuples){const a=splitSqlTuple(m[1]);if(a.length<11)continue;const id=a[0];out.set(id,{status:'sql_fallback',calculation_mode:'loaded_from_sql_projection',source_status:a[10],completeness_pct:number(a[9]),per_100g:{energy_kcal:number(a[1]),protein_g:number(a[2]),carbs_g:number(a[3]),sugars_g:number(a[4]),fat_g:number(a[5]),saturates_g:number(a[6]),fiber_g:number(a[7]),salt_g:number(a[8])},generated_at:new Date().toISOString()})}
  return out;
}
let sqlFallback=new Map();
async function loadSqlFallback(){
  try{const r=await fetch(SQL_URL,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);sqlFallback=parseSqlNutrition(await r.text())}
  catch(e){console.warn('Cuisine X nutrition SQL fallback unavailable',e);sqlFallback=new Map()}
}
function applyNutrition(){
  if(!state.data)return {calculated:0,fallback:0,blocked:0};
  const index=ingredientIndexes();let calculated=0,fallback=0,blocked=0;
  for(const recipe of state.data.recipes||[]){
    const dynamic=computeRecipe(recipe,index);
    if(dynamic){recipe.nutrition=dynamic;calculated++;if(dynamic.completeness_pct<100)blocked++;continue}
    const sql=sqlFallback.get(recipe.id);if(sql){recipe.nutrition=sql;fallback++;continue}
    recipe.nutrition={status:'not_calculable',calculation_mode:'runtime',message:{fr:'Calcul indisponible : ingrédients structurés ou valeurs nutritionnelles sources manquants.'},blocking_ingredients:(recipe.ingredient_refs||[]).filter(Boolean)};blocked++;
  }
  state.data.meta=state.data.meta||{};state.data.meta.dynamic_nutrition={status:'ready',calculated_recipes:calculated,sql_fallback_recipes:fallback,blocked_recipes:blocked,source_priority:['ingredient_database','ciqual_mapping','sql_projection_fallback'],generated_at:new Date().toISOString()};
  document.dispatchEvent(new CustomEvent('cuisinex:nutrition-ready',{detail:state.data.meta.dynamic_nutrition}));
  return state.data.meta.dynamic_nutrition;
}
function refreshIfUseful(){const s=state.section;if(s==='recipes'||s==='ingredients'||state.detail?.type==='recipes'||state.detail?.type==='ingredients')render()}
let running=false;
async function recalc({rerender=true}={}){
  if(running||!state.data)return;running=true;try{applyNutrition();if(rerender)refreshIfUseful()}finally{running=false}
}
async function boot(){
  for(let i=0;i<120&&!state.data;i++)await sleep(50);if(!state.data)return;
  await loadSqlFallback();await recalc({rerender:true});
  document.addEventListener('cuisinex:ciqual-ready',()=>recalc({rerender:true}));
  document.addEventListener('cuisinex:ingredient-data-updated',()=>recalc({rerender:true}));
  setTimeout(()=>recalc({rerender:false}),1600);
}
boot();
