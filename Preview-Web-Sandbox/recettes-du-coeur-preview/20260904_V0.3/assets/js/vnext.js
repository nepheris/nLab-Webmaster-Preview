
(() => {
  const PROD = 'https://recettesducoeur.github.io/';
  const isProd = location.hostname === 'recettesducoeur.github.io';
  const dataUrl = (p) => isProd ? '/' + p.replace(/^\/+/,'') : PROD + p.replace(/^\/+/,'');
  const assetUrl = (p) => isProd ? '/' + p.replace(/^\/+/,'') : PROD + p.replace(/^\/+/,'');
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const escapeHtml = (s='') => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const norm = (s='') => String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu,' ').replace(/\s+/g,' ').trim();

  function mountChrome(){
    const current = document.body.dataset.page || '';
    const header = `
      <header class="site-header">
        <div class="container nav">
          <a class="brand notranslate" translate="no" href="index.html"><span class="brand-mark">💚</span><span>Les Recettes du Cœur</span></a>
          <button class="mobile-menu" type="button" aria-expanded="false" aria-label="Ouvrir le menu">Menu</button>
          <nav class="nav-links" aria-label="Navigation principale">
            <a href="recettes.html" ${current==='recettes'?'aria-current="page"':''}>Recettes</a>
            <a href="astuces.html" ${current==='astuces'?'aria-current="page"':''}>Astuces</a>
            <a href="ingredients.html" ${current==='ingredients'?'aria-current="page"':''}>Ingrédients</a>
            <a href="presentation-projet.html" ${current==='projet'?'aria-current="page"':''}>Le projet</a>
            <a href="contact.html" ${current==='contact'?'aria-current="page"':''}>Participer</a>
            <a class="nav-cta" href="recettes.html#frigo">J’ai ces ingrédients</a>
          </nav>
        </div>
      </header><div class="translate-strip"><div class="container"><div id="nlab-auto-translate" aria-label="Traduction automatique"></div></div></div>`;
    const footer = `
      <footer class="footer"><div class="container footer-grid">
        <div><strong>💚 Les Recettes du Cœur</strong><br><small>Cuisine simple, utile et anti-gaspillage.</small></div>
        <div><a href="presentation-projet.html">Le projet</a> · <a href="ressources.html">Ressources</a> · <a href="contact.html">Contact & participation</a></div>
      </div></footer>`;
    const h = $('[data-site-header]'); if(h) h.innerHTML = header;
    const f = $('[data-site-footer]'); if(f) f.innerHTML = footer;
    const b = $('.mobile-menu'); if(b){ b.addEventListener('click',()=>{const n=$('.nav-links'); const open=n.classList.toggle('is-open'); b.setAttribute('aria-expanded',String(open));}); }
  }

  function mountTranslation(){
    try{
      if(globalThis.nLabAutoTranslateBar){
        globalThis.nLabAutoTranslateBar.mount({sourceLanguage:'fr',languages:['en','es','de','it','nl','pt'],notice:'Traduction automatique'});
      }
    }catch(e){ console.warn('[P002] translation POC unavailable', e); }
  }

  function parseFrontmatter(text){
    const out={meta:{},body:text};
    if(text.startsWith('---')){
      const end=text.indexOf('\n---',3);
      if(end>-1){
        const fm=text.slice(4,end).trim().split(/\r?\n/);
        fm.forEach(line=>{const i=line.indexOf(':');if(i>0)out.meta[line.slice(0,i).trim()]=line.slice(i+1).trim().replace(/^["']|["']$/g,'');});
        out.body=text.slice(end+4).trim();
      }
    }
    return out;
  }

  function markdownToHtml(md){
    const lines=md.replace(/\r/g,'').split('\n'); let html='', inUl=false, inOl=false;
    const inline=(s)=>escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
      .replace(/\*(.+?)\*/g,'<em>$1</em>')
      .replace(/`([^`]+)`/g,'<code>$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
    const close=()=>{if(inUl){html+='</ul>';inUl=false} if(inOl){html+='</ol>';inOl=false}};
    for(const line of lines){
      if(/^### /.test(line)){close();html+='<h3>'+inline(line.slice(4))+'</h3>'}
      else if(/^## /.test(line)){close();html+='<h2>'+inline(line.slice(3))+'</h2>'}
      else if(/^# /.test(line)){close();html+='<h1>'+inline(line.slice(2))+'</h1>'}
      else if(/^> /.test(line)){close();html+='<blockquote>'+inline(line.slice(2))+'</blockquote>'}
      else if(/^- /.test(line)){if(!inUl){close();html+='<ul>';inUl=true} html+='<li>'+inline(line.slice(2))+'</li>'}
      else if(/^\d+\. /.test(line)){if(!inOl){close();html+='<ol>';inOl=true} html+='<li>'+inline(line.replace(/^\d+\.\s+/,''))+'</li>'}
      else if(!line.trim()){close()}
      else {close();html+='<p>'+inline(line)+'</p>'}
    } close(); return html;
  }

  async function renderMarkdownPage(){
    const host=$('[data-markdown-page]'); if(!host) return;
    const slug=host.dataset.markdownPage;
    try{
      const r=await fetch(`content/pages/${slug}.md`,{cache:'no-store'}); if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const {meta,body}=parseFrontmatter(await r.text());
      if(meta.title) document.title=`${meta.title} — Les Recettes du Cœur`;
      host.innerHTML=`<article class="markdown">${markdownToHtml(body)}</article>`;
    }catch(e){host.innerHTML='<div class="status error">Le contenu éditorial n’a pas pu être chargé.</div>'}
  }

  async function getRecipes(){
    const r=await fetch(dataUrl('data/public/recettes.json')); if(!r.ok) throw new Error('recettes');
    const j=await r.json(); return j.donnees || [];
  }
  async function getRecipeSource(){
    const r=await fetch(dataUrl('data/referentiels/recettes.json')); if(!r.ok) throw new Error('source recettes');
    const j=await r.json(); return (j.referentiel_recettes && j.referentiel_recettes.recettes) || [];
  }
  async function getTips(){
    const r=await fetch(dataUrl('data/public/astuces.json')); if(!r.ok) throw new Error('astuces');
    const j=await r.json(); return j.donnees || [];
  }
  async function getIngredients(){
    const r=await fetch(dataUrl('data/public/ingredients.json')); if(!r.ok) throw new Error('ingredients');
    const j=await r.json(); return j.donnees || [];
  }

  function recipeCard(x){
    const img=assetUrl(x.image || 'assets/images/recettes/REC_DEFAULT.webp');
    const main=(x.ingredients_principaux||[]).map(i=>i.libelle).join(', ');
    return `<article class="card recipe-card" data-search="${escapeHtml(norm([x.libelle_humain,main].join(' ')))}" data-id="${escapeHtml(x.recette_id)}">
      <div class="card-media"><img src="${img}" alt="${escapeHtml(x.libelle_humain)}" loading="lazy" onerror="this.style.display='none'"></div>
      <div class="card-body"><h3>${escapeHtml(x.libelle_humain)}</h3>
      <div class="badges">${x.vegetarien==='oui'?'<span class="badge">Végétarien</span>':''}${x.vegan==='oui'?'<span class="badge">Vegan</span>':''}</div>
      <p>${escapeHtml(main || 'Recette du catalogue')}</p>
      <div class="card-actions"><a class="button" href="fiche-recette.html?id=${encodeURIComponent(x.recette_id)}">Voir la recette</a></div></div></article>`;
  }

  async function renderRecipes(){
    const grid=$('[data-recipes-grid]'); if(!grid) return;
    const status=$('[data-recipes-status]');
    try{
      const recipes=await getRecipes(); window.__recipes=recipes;
      grid.innerHTML=recipes.map(recipeCard).join('');
      if(status) status.textContent=`${recipes.length} recettes disponibles`;
      bindRecipeSearch(recipes);
    }catch(e){grid.innerHTML='<div class="status error">Impossible de charger le catalogue pour le moment.</div>'}
  }

  function bindRecipeSearch(recipes){
    const q=$('[data-recipe-search]'), reset=$('[data-recipe-reset]'), fridge=$('[data-fridge-input]'), fbtn=$('[data-fridge-search]'), freset=$('[data-fridge-reset]');
    const dietBtns=$$('[data-diet]');
    const apply=()=>{
      const term=norm(q?.value||'');
      const diets=dietBtns.filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.dataset.diet);
      $$('.recipe-card').forEach(card=>{
        const r=recipes.find(x=>x.recette_id===card.dataset.id); if(!r)return;
        const text=card.dataset.search||'';
        let ok=!term || text.includes(term);
        if(diets.includes('vegetarien')) ok=ok && r.vegetarien==='oui';
        if(diets.includes('vegan')) ok=ok && r.vegan==='oui';
        card.hidden=!ok;
      });
    };
    q?.addEventListener('input',apply); reset?.addEventListener('click',()=>{q.value='';dietBtns.forEach(b=>b.setAttribute('aria-pressed','false'));apply()});
    dietBtns.forEach(b=>b.addEventListener('click',()=>{b.setAttribute('aria-pressed',b.getAttribute('aria-pressed')==='true'?'false':'true');apply()}));
    fbtn?.addEventListener('click',()=>{
      const have=norm(fridge.value).split(/\s*(?:,|;|\n)\s*/).filter(Boolean);
      $$('.recipe-card').forEach(card=>{
        const r=recipes.find(x=>x.recette_id===card.dataset.id); if(!r)return;
        const mains=(r.ingredients_principaux||[]).map(i=>norm(i.libelle));
        const second=(r.ingredients_secondaires||[]).map(i=>norm(i.libelle));
        const all=[...mains,...second];
        const hits=all.filter(ing=>have.some(h=>ing.includes(h)||h.includes(ing))).length;
        card.hidden=have.length>0 && hits===0;
        let badge=card.querySelector('.fridge-score');
        if(!badge){badge=document.createElement('div');badge.className='status fridge-score';card.querySelector('.card-body').prepend(badge)}
        badge.textContent=have.length?`${hits}/${all.length} ingrédients principaux/secondaires reconnus`:'';
        badge.hidden=!have.length;
      });
      location.hash='catalogue';
    });
    freset?.addEventListener('click',()=>{fridge.value='';$$('.recipe-card').forEach(c=>{c.hidden=false;const b=c.querySelector('.fridge-score');if(b)b.hidden=true})});
  }

  async function renderRecipeDetail(){
    const host=$('[data-recipe-detail]'); if(!host) return;
    const id=new URLSearchParams(location.search).get('id');
    if(!id){host.innerHTML='<div class="status error">Recette non précisée.</div>';return}
    try{
      const [publicRecipes, sourceRecipes]=await Promise.all([getRecipes(),getRecipeSource()]);
      const pub=publicRecipes.find(r=>r.recette_id===id); if(!pub) throw new Error('not found');
      const src=sourceRecipes.find(r=>norm(r?.contenu?.titre)===norm(pub.libelle_humain)) || sourceRecipes.find(r=>norm(r?.seo?.titre)===norm(pub.libelle_humain));
      if(!src) throw new Error('source not found');
      const c=src.contenu||{}, ing=src.ingredients||{}, prep=src.preparation||{}, advice=src.conseils||{}, tm=src.temps||{}, diff=src.difficulte||{}, budget=src.budget||{};
      const list=(arr=[])=>`<ul class="ingredient-list">${arr.map(i=>`<li><strong>${escapeHtml(i.quantite_affichee||'')}</strong> ${escapeHtml(i.libelle||'')}</li>`).join('')}</ul>`;
      const img=assetUrl(pub.image || ('assets/images/recettes/'+(src.image?.fichier||'')));
      document.title=`${pub.libelle_humain} — Les Recettes du Cœur`;
      host.innerHTML=`<article>
        <div class="recipe-hero"><div><p class="kicker">Recette</p><h1>${escapeHtml(pub.libelle_humain)}</h1><p class="lead">${escapeHtml(c.accroche||c.introduction||'')}</p>
          <div class="meta-row">${tm.total_minutes?`<span class="meta-pill">⏱ ${tm.total_minutes} min</span>`:''}${diff.label?`<span class="meta-pill">👌 ${escapeHtml(diff.label)}</span>`:''}${budget.label?`<span class="meta-pill">💶 ${escapeHtml(budget.label)}</span>`:''}${src.portions?.reference?`<span class="meta-pill">🍽 ${src.portions.reference} portions</span>`:''}</div>
        </div><img src="${img}" alt="${escapeHtml(pub.libelle_humain)}" onerror="this.style.display='none'"></div>
        <div class="recipe-layout">
          <div class="grid">
            <section class="panel"><h2>Ingrédients principaux</h2>${list(ing.principaux)}</section>
            ${(ing.secondaires||[]).length?`<section class="panel"><h2>À ajouter</h2>${list(ing.secondaires)}</section>`:''}
            ${(ing.optionnels||[]).length?`<section class="panel"><h2>Optionnels</h2>${list(ing.optionnels)}</section>`:''}
          </div>
          <div class="grid">
            <section class="panel"><h2>Préparation</h2><ol class="steps">${(prep.etapes||[]).map(s=>`<li><div>${escapeHtml(s)}</div></li>`).join('')}</ol></section>
            ${advice.astuce_anti_gaspi?`<section class="panel"><h2>💚 Astuce anti-gaspi</h2><p>${escapeHtml(advice.astuce_anti_gaspi)}</p></section>`:''}
            ${advice.variantes?`<section class="panel"><h2>Variantes</h2><p>${escapeHtml(advice.variantes)}</p></section>`:''}
          </div>
        </div>
      </article>`;
    }catch(e){host.innerHTML='<div class="status error">La fiche n’a pas pu être chargée. <a href="recettes.html">Retour au catalogue</a>.</div>'}
  }

  async function renderTips(){
    const grid=$('[data-tips-grid]'); if(!grid) return;
    try{
      const tips=await getTips(); const q=$('[data-tip-search]');
      const draw=(term='')=>{
        const n=norm(term); const rows=tips.filter(t=>!n || norm(JSON.stringify(t)).includes(n));
        grid.innerHTML=rows.map((t,i)=>{
          const title=t.libelle_humain||t.titre||t.nom||`Astuce ${i+1}`;
          const desc=t.description||t.resume||t.texte||'Astuce anti-gaspillage.';
          return `<article class="card"><div class="card-body"><div class="badges"><span class="badge">Astuce</span></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(String(desc).slice(0,260))}</p></div></article>`;
        }).join('') || '<div class="empty">Aucune astuce trouvée.</div>';
      }; draw(); q?.addEventListener('input',()=>draw(q.value));
    }catch(e){grid.innerHTML='<div class="status error">Impossible de charger les astuces.</div>'}
  }

  async function renderIngredients(){
    const grid=$('[data-ingredients-grid]'); if(!grid) return;
    try{
      const items=await getIngredients(); const q=$('[data-ingredient-search]');
      const draw=(term='')=>{
        const n=norm(term); const rows=items.filter(x=>!n||norm(x.libelle_humain).includes(n)).slice(0,60);
        grid.innerHTML=rows.map(x=>`<article class="card"><div class="card-body"><div class="badges"><span class="badge">${escapeHtml(x.ingredient_id)}</span></div><h3>${escapeHtml(x.libelle_humain)}</h3><p>Référentiel ingrédient du site.</p></div></article>`).join('');
      }; draw(); q?.addEventListener('input',()=>draw(q.value));
    }catch(e){grid.innerHTML='<div class="status error">Impossible de charger le référentiel ingrédients.</div>'}
  }

  function bindTabs(){
    $$('[data-tab]').forEach(btn=>btn.addEventListener('click',()=>{
      const key=btn.dataset.tab; $$('[data-tab]').forEach(b=>b.classList.toggle('is-active',b===btn));
      $$('[data-panel]').forEach(p=>p.classList.toggle('is-active',p.dataset.panel===key));
    }));
  }

  async function initHome(){
    const host=$('[data-home-recipes]'); if(!host) return;
    try{const r=await getRecipes();host.innerHTML=r.slice(0,3).map(recipeCard).join('')}catch(e){}
  }

  mountChrome(); mountTranslation(); bindTabs(); renderMarkdownPage(); renderRecipes(); renderRecipeDetail(); renderTips(); renderIngredients(); initHome();
})();
