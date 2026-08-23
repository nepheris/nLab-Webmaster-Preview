import {esc,text,icon} from './core.js';
import {section,L} from './ui.js';

export function mergeEquipmentCatalog(data,catalog){
  if(!catalog?.equipment)return data;
  data.equipment=data.equipment||[];
  const byId=new Map(data.equipment.map((x,i)=>[x.id,i]));
  for(const item of catalog.equipment){
    const normalized={...item,__type:'equipment'};
    if(byId.has(item.id)) data.equipment[byId.get(item.id)]={...data.equipment[byId.get(item.id)],...normalized};
    else {data.equipment.push(normalized);byId.set(item.id,data.equipment.length-1)}
  }
  return data;
}

function fmtDate(v){if(!v)return'—';try{return new Intl.DateTimeFormat('fr-FR',{dateStyle:'long'}).format(new Date(`${v}T12:00:00`))}catch{return v}}
function fmtPrice(v){return v==null?'—':new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(Number(v))}
function yearsOwned(date){if(!date)return null;const d=new Date(`${date}T12:00:00`),now=new Date();return Math.max(0,(now-d)/(365.2425*24*3600*1000))}
function scalarRows(obj={}){return Object.entries(obj).filter(([,v])=>v!=null&&!Array.isArray(v)&&typeof v!=='object').map(([k,v])=>`<tr><th>${esc(k.replaceAll('_',' '))}</th><td>${esc(String(v))}</td></tr>`).join('')}
function technicalBlock(t={}){const rows=scalarRows(t),zones=Array.isArray(t.zones)?`<h3>Zones / sous-ensembles</h3><div class="table-wrap"><table class="table"><thead><tr><th>Position</th><th>Nominal</th><th>Booster</th><th>Durée booster</th><th>Diamètre récipient</th></tr></thead><tbody>${t.zones.map(z=>`<tr><td>${esc(z.position||'—')}</td><td>${z.nominal_w!=null?`${esc(z.nominal_w)} W`:'—'}</td><td>${z.booster_w!=null?`${esc(z.booster_w)} W`:'—'}</td><td>${z.booster_max_min!=null?`${esc(z.booster_max_min)} min`:'—'}</td><td>${z.pan_diameter_mm?`${esc(z.pan_diameter_mm)} mm`:'—'}</td></tr>`).join('')}</tbody></table></div>`:'',functions=Array.isArray(t.functions)?`<p><strong>Fonctions :</strong> ${t.functions.map(esc).join(' · ')}</p>`:'';return `${rows?`<div class="table-wrap"><table class="table"><tbody>${rows}</tbody></table></div>`:''}${functions}${zones}`||'<p class="muted">Caractéristiques techniques non documentées.</p>'}

export function equipmentDetail(x){
  const p=x.purchase||{},m=x.manufacturer||{},manual=x.manual||{},age=yearsOwned(p.acquired_date),costPerYear=age&&p.price_eur!=null?Number(p.price_eur)/age:null;
  const acquisition=`<div class="safety-grid"><div class="safety-card"><strong>Date d'achat</strong><p>${fmtDate(p.date)}</p></div><div class="safety-card"><strong>Acquisition / livraison</strong><p>${fmtDate(p.acquired_date)}</p></div><div class="safety-card"><strong>Prix d'achat</strong><p>${fmtPrice(p.price_eur)}</p></div><div class="safety-card"><strong>Enseigne</strong><p>${esc(p.retailer||'—')}</p></div><div class="safety-card"><strong>Garantie connue jusqu'au</strong><p>${fmtDate(p.warranty_end)}</p></div><div class="safety-card"><strong>Durée de possession</strong><p>${age==null?'—':`${age.toFixed(1)} an(s)`}</p>${costPerYear==null?'':`<small>Coût d'achat ≈ ${fmtPrice(costPerYear)}/an</small>`}</div></div>${p.delivery_window?`<p><strong>Fenêtre de livraison :</strong> ${esc(p.delivery_window)}</p>`:''}${p.retailer_url?`<p><a class="btn" href="${esc(p.retailer_url)}" target="_blank" rel="noopener">Site d'achat ${icon('external')}</a></p>`:''}`;
  const manufacturer=`<p><strong>${esc(m.name||x.brand||'Fabricant non documenté')}</strong></p><div class="filter-row">${m.url?`<a class="btn" href="${esc(m.url)}" target="_blank" rel="noopener">Site fabricant ${icon('external')}</a>`:''}${m.support_url?`<a class="btn" href="${esc(m.support_url)}" target="_blank" rel="noopener">Support / produit ${icon('external')}</a>`:''}${m.product_url?`<a class="btn" href="${esc(m.product_url)}" target="_blank" rel="noopener">Page produit ${icon('external')}</a>`:''}</div>`;
  const docs=`<p><strong>Statut notice :</strong> ${esc(manual.status||'non documenté')}</p><div class="filter-row">${manual.official_url?`<a class="btn" href="${esc(manual.official_url)}" target="_blank" rel="noopener">Notice / documentation officielle ${icon('external')}</a>`:''}</div><p class="muted">Les notices importées dans une conversation ne sont considérées comme durables dans CuisineX qu'après leur dépôt dans les assets du projet.</p>`;
  return `<button class="btn no-print" id="backToList">← ${L('back')}</button><div class="panel detail-head"><div><span class="badge">${esc(x.id)}</span>${x.status?`<span class="badge ${x.status==='owned'?'ok':'warn'}">${esc(x.status)}</span>`:''}<h1>${esc(text(x.name||x.title))}</h1><p>${esc(text(x.summary)||'')}</p><p class="muted">${esc(x.brand||'')} ${esc(x.model||'')}</p></div><div class="detail-actions"><button class="btn" data-open-qr>${icon('qr')} QR</button><button class="btn" onclick="window.print()">PDF / Imprimer</button></div></div>${section(`equipment-${x.id}-acquisition`,'Acquisition & cycle de vie',acquisition,{helpShort:'Données d’achat documentées. Une valeur inconnue reste vide plutôt que déduite.'})}${section(`equipment-${x.id}-manufacturer`,'Fabricant & support',manufacturer,{helpShort:'Liens fabricant, support et page produit lorsque disponibles.'})}${section(`equipment-${x.id}-technical`,'Caractéristiques techniques',technicalBlock(x.technical),{helpShort:'Données synthétisées depuis la notice ou une source fabricant.'})}${section(`equipment-${x.id}-manual`,'Notice & documentation',docs,{open:false,helpShort:'Accès aux notices et statut de persistance documentaire.'})}`;
}
