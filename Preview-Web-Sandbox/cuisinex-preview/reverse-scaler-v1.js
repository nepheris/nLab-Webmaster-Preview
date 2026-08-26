import {state,text} from './core.js';

const fmt=n=>{const v=Number(n);if(!Number.isFinite(v))return'—';if(Math.abs(v-Math.round(v))<0.01)return String(Math.round(v));return v<10?v.toFixed(2).replace(/0+$/,'').replace(/\.$/,''):v.toFixed(1).replace(/\.0$/,'')};
const recipe=()=>state.detail?.type==='recipes'?(state.data?.recipes||[]).find(r=>r.id===state.detail.id):null;

function svgTarget(){return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>`}

function scalableValue(i){
  const value=Number(i.scale_value ?? i.mass_g);
  const unit=i.scale_unit || (Number.isFinite(Number(i.mass_g))?'g':null);
  return Number.isFinite(value)&&value>0&&unit?{value,unit}:null;
}

function enhance(){
  const r=recipe();
  const tool=document.querySelector('.portion-tool');
  const rows=[...document.querySelectorAll('.ingredient-row')];
  if(!r||!tool||!rows.length||tool.dataset.reverseScaler==='1')return;
  const refServings=Number(r.servings||r.portions?.reference||0);
  if(!(refServings>0))return;
  const ingredients=r.ingredients||[];
  const pairs=[];
  rows.forEach((row,idx)=>{
    const ing=ingredients[idx];if(!ing)return;
    const sv=scalableValue(ing);if(!sv)return;
    row.dataset.scaleBase=String(sv.value);row.dataset.scaleUnit=sv.unit;row.dataset.scaleIndex=String(idx);
    const mass=row.querySelector('.ingredient-mass');
    if(mass)mass.textContent=`${fmt(sv.value)} ${sv.unit}`;
    const actions=row.querySelector('.ingredient-actions')||row;
    const b=document.createElement('button');b.type='button';b.className='source-icon reverse-anchor-btn no-print';b.title='Fixer cet ingrédient comme quantité de référence';b.dataset.reverseAnchor=String(idx);b.innerHTML=svgTarget();actions.append(b);
    pairs.push({row,ing,sv,button:b});
  });
  if(!pairs.length)return;
  tool.dataset.reverseScaler='1';
  const box=document.createElement('div');box.className='reverse-scaler-box no-print';
  box.innerHTML=`<div class="reverse-scaler-head"><strong>Ou fixer un ingrédient</strong><span class="muted">Choisis une quantité disponible : CuisineX recalcule les autres ingrédients et les portions.</span></div><div class="reverse-scaler-controls"><select id="reverseIngredientSelect" aria-label="Ingrédient de référence"></select><input id="reverseIngredientValue" type="number" min="0.01" step="0.1" aria-label="Quantité disponible"><span id="reverseIngredientUnit" class="badge"></span><button id="reverseApply" class="btn" type="button">Recalculer</button><button id="reverseReset" class="btn" type="button">Référence</button></div><p class="muted" id="reverseResult"></p>`;
  tool.append(box);
  const select=box.querySelector('#reverseIngredientSelect'),value=box.querySelector('#reverseIngredientValue'),unit=box.querySelector('#reverseIngredientUnit'),result=box.querySelector('#reverseResult');
  for(const p of pairs){const o=document.createElement('option');o.value=p.row.dataset.scaleIndex;o.textContent=text(p.ing.label)||p.ing.id||`Ingrédient ${Number(o.value)+1}`;select.append(o)}
  const servingInput=document.querySelector('#servingInput');
  if(servingInput){servingInput.step='0.1';servingInput.min='0.1'}
  let factor=1;
  function applyFactor(f){
    factor=f;
    for(const p of pairs){const out=p.row.querySelector('.ingredient-mass');if(out)out.textContent=`${fmt(p.sv.value*f)} ${p.sv.unit}`}
    document.querySelectorAll('[data-base-mass]').forEach(el=>{const row=el.closest('.ingredient-row');if(row?.dataset.scaleBase)return;const base=Number(el.dataset.baseMass);if(Number.isFinite(base))el.textContent=`${fmt(base*f)} g`});
    if(servingInput)servingInput.value=fmt(refServings*f);
    const total=document.querySelector('#scaledTotalMass');
    if(total){const baseTotal=Number(tool.dataset.referenceTotal)||0;total.textContent=baseTotal?`${fmt(baseTotal*f)} g`:'—'}
    result.textContent=`Équivalent : ${fmt(refServings*f)} portion(s) de référence.`;
  }
  function syncAnchor(){const p=pairs.find(x=>x.row.dataset.scaleIndex===select.value)||pairs[0];value.value=fmt(p.sv.value*factor);unit.textContent=p.sv.unit;pairs.forEach(x=>x.button.classList.toggle('active',x===p))}
  function choose(idx){select.value=String(idx);syncAnchor();box.scrollIntoView({block:'nearest',behavior:'smooth'});value.focus();value.select()}
  pairs.forEach(p=>p.button.onclick=e=>{e.stopPropagation();choose(Number(p.row.dataset.scaleIndex))});
  select.onchange=syncAnchor;
  box.querySelector('#reverseApply').onclick=()=>{const p=pairs.find(x=>x.row.dataset.scaleIndex===select.value)||pairs[0],v=Number(value.value);if(!(v>0))return;applyFactor(v/p.sv.value);syncAnchor()};
  value.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();box.querySelector('#reverseApply').click()}};
  box.querySelector('#reverseReset').onclick=()=>{applyFactor(1);syncAnchor()};
  if(servingInput){servingInput.addEventListener('input',()=>{const s=Number(servingInput.value);if(s>0){factor=s/refServings;for(const p of pairs){const out=p.row.querySelector('.ingredient-mass');if(out)out.textContent=`${fmt(p.sv.value*factor)} ${p.sv.unit}`};syncAnchor();result.textContent=`Équivalent : ${fmt(s)} portion(s) de référence.`}})}
  syncAnchor();result.textContent=`Base recette : ${fmt(refServings)} portion(s). Les deux modes de recalcul restent disponibles.`;
}

const style=document.createElement('style');style.textContent=`.reverse-scaler-box{margin-top:14px;padding-top:14px;border-top:1px solid var(--border,#ddd)}.reverse-scaler-head{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.reverse-scaler-controls{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.reverse-scaler-controls select,.reverse-scaler-controls input{min-height:38px;padding:6px 8px}.reverse-anchor-btn.active{outline:2px solid currentColor}.reverse-anchor-btn svg{width:18px;height:18px}.ingredient-row .ingredient-actions{display:inline-flex;gap:4px;align-items:center}`;document.head.append(style);
new MutationObserver(()=>queueMicrotask(enhance)).observe(document.documentElement,{subtree:true,childList:true});
document.addEventListener('DOMContentLoaded',enhance);enhance();
