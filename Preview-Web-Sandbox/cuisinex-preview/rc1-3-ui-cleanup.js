import {state} from './core.js';

const BUILD='V1 RC1.3 FR';
const UPDATED='2026-08-26 19:47 Europe/Paris';

function clean(){
  const heroBadge=document.querySelector('#home-hero .hero .panel:first-child .badge');
  if(heroBadge&&/V1 RC/i.test(heroBadge.textContent||''))heroBadge.textContent=BUILD;
  const headerBadges=[...document.querySelectorAll('#siteHeader .brand .badge')];
  for(const b of headerBadges)if(/V1 RC/i.test(b.textContent||''))b.textContent=BUILD;
  const footer=document.querySelector('#siteFooter p');if(footer)footer.textContent=`CuisineX ${BUILD} · mise à jour ${UPDATED}`;
  if(state.detail?.type==='ingredients'){
    const legacy=document.getElementById(`ingredient-${state.detail.id}-culinary`);
    const enriched=document.getElementById(`catchup-ing-${state.detail.id}-properties`);
    if(legacy&&enriched)legacy.remove();
  }
  if(state.statusFilter&&!Array.isArray(state.recipeStatusFilters)){
    state.recipeStatusFilters=[state.statusFilter];state.statusFilter=null;
  }
  document.querySelectorAll('#app .section.collapsed').forEach(s=>s.classList.remove('collapsed'));
}

const boot=()=>{clean();const app=document.getElementById('app');if(app)new MutationObserver(()=>queueMicrotask(clean)).observe(app,{childList:true,subtree:true})};
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
