(() => {
  const BRAND='Cuisine X';
  const VERSION='V1 RC1.5 FR';
  const UPDATED='2026-08-27 01:16 Europe/Paris';
  function apply(){
    document.title=`${BRAND} — ${VERSION}`;
    document.querySelectorAll('#siteHeader .brand').forEach(el=>{
      const spans=[...el.querySelectorAll('span')];
      const name=spans.find(s=>/CuisineX|Cuisine X/.test(s.textContent||''));
      if(name)name.textContent=BRAND;
      const badge=spans.find(s=>/V1 RC/i.test(s.textContent||''));
      if(badge)badge.textContent=VERSION;
      const maj=spans.find(s=>/MAJ /i.test(s.textContent||''));
      if(maj)maj.textContent=`MAJ ${UPDATED}`;
    });
    const footer=document.querySelector('#siteFooter p');
    if(footer)footer.textContent=`${BRAND} ${VERSION} · mise à jour ${UPDATED}`;
    document.querySelectorAll('h1').forEach(h=>{if((h.textContent||'').trim()==='CuisineX')h.textContent=BRAND});
  }
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
  apply();
})();
