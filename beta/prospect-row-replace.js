(()=>{
  const MODES={physical:'physical',phoning:'phoning'};
  const excluded={physical:new Set(),phoning:new Set()};
  const temporary={physical:new Set(),phoning:new Set()};
  let loadedUser='',loading=null,replacing=false;
  const originalFetch=window.fetch.bind(window);

  function getSb(){try{return sb}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function currentUserId(){return getUser()?.id||''}
  function modeFromUrl(input){
    const u=typeof input==='string'?input:(input?.url||'');
    if(u.includes('recherche-entreprises.api.gouv.fr/near_point'))return MODES.physical;
    if(u.includes('recherche-entreprises.api.gouv.fr/search'))return MODES.phoning;
    return '';
  }
  async function ensureExclusions(){
    const uid=currentUserId(),client=getSb();
    if(!uid||!client)return;
    if(loadedUser===uid)return;
    if(loading)return loading;
    loading=(async()=>{
      const r=await client.from('prospect_exclusions').select('mode,siren').eq('user_id',uid);
      if(!r.error){
        excluded.physical.clear();excluded.phoning.clear();
        for(const x of r.data||[]){if(excluded[x.mode])excluded[x.mode].add(String(x.siren||''))}
        loadedUser=uid;
      }
    })();
    try{await loading}finally{loading=null}
  }
  function blocked(mode,siren){return excluded[mode]?.has(String(siren))||temporary[mode]?.has(String(siren))}

  window.fetch=async function(input,init){
    const mode=modeFromUrl(input);
    if(!mode)return originalFetch(input,init);
    await ensureExclusions();
    const r=await originalFetch(input,init);
    if(!r.ok)return r;
    try{
      const d=await r.clone().json();
      if(Array.isArray(d?.results))d.results=d.results.filter(x=>!blocked(mode,String(x?.siren||'')));
      const h=new Headers(r.headers);h.set('content-type','application/json; charset=utf-8');
      return new Response(JSON.stringify(d),{status:r.status,statusText:r.statusText,headers:h});
    }catch(e){return r}
  };

  function addStyle(){
    if(document.getElementById('prospectReplaceStyle'))return;
    const s=document.createElement('style');s.id='prospectReplaceStyle';s.textContent=`
      .prospect-remove{padding:6px 8px;border:1px solid #fecaca;border-radius:8px;background:#fff;color:#b91c1c;font-weight:900;cursor:pointer;white-space:nowrap}
      .prospect-remove:hover{background:#fee2e2}.prospect-remove:disabled{opacity:.55;cursor:wait}
    `;document.head.appendChild(s)
  }
  function sirenFromRow(row,mode){
    if(mode==='physical'){
      const m=row.textContent.match(/SIREN\s+(\d{9})/i);return m?.[1]||'';
    }
    const a=row.querySelector('a[href*="annuaire-entreprises.data.gouv.fr/entreprise/"]');
    if(!a)return'';
    try{return decodeURIComponent(new URL(a.href).pathname.split('/').filter(Boolean).pop()||'').match(/\d{9}/)?.[0]||''}catch(e){return''}
  }
  function decorateBody(id,mode){
    const body=document.getElementById(id);if(!body)return;
    body.querySelectorAll('tr').forEach(row=>{
      if(row.querySelector('.ph-empty,.pp-empty'))return;
      const siren=sirenFromRow(row,mode);if(!siren)return;
      row.dataset.prospectSiren=siren;row.dataset.prospectMode=mode;
      const actions=row.querySelector(mode==='physical'?'.pp-actions':'.ph-actions');if(!actions||actions.querySelector('.prospect-remove'))return;
      const b=document.createElement('button');b.type='button';b.className='prospect-remove';b.textContent='Retirer';b.title='Retirer cette société et la remplacer automatiquement';
      b.onclick=()=>removeAndReplace(row,mode,siren);actions.appendChild(b);
    })
  }
  function decorate(){addStyle();decorateBody('ppBody','physical');decorateBody('phBody','phoning')}
  function rowSirens(body,mode){return [...body.querySelectorAll('tr')].map(r=>sirenFromRow(r,mode)).filter(Boolean)}
  function cleanRowHtml(row){const clone=row.cloneNode(true);clone.querySelectorAll('.prospect-remove').forEach(x=>x.remove());return clone.outerHTML}
  function renumber(body){
    [...body.querySelectorAll('tr')].forEach((r,i)=>{const c=r.querySelector('.pp-index,.ph-index');if(c)c.textContent=String(i+1)});
    decorate();
  }
  async function persist(mode,siren){
    await ensureExclusions();
    const uid=currentUserId(),client=getSb();if(!uid||!client)throw new Error('Session utilisateur indisponible.');
    const r=await client.from('prospect_exclusions').upsert({user_id:uid,mode,siren},{onConflict:'user_id,mode,siren'});
    if(r.error)throw r.error;excluded[mode].add(String(siren));
  }
  function wait(ms){return new Promise(r=>setTimeout(r,ms))}
  async function waitGeneration(button,body,timeout=70000){
    const started=Date.now();
    await wait(30);
    while(Date.now()-started<timeout){
      if(!button.disabled&&body.querySelectorAll('tr').length){return true}
      await wait(180);
    }
    return false;
  }
  function statusEl(mode){return document.getElementById(mode==='physical'?'ppStatus':'phStatus')}

  async function removeAndReplace(row,mode,siren){
    if(replacing)return;
    replacing=true;const btn=row.querySelector('.prospect-remove');if(btn)btn.disabled=true;
    const body=document.getElementById(mode==='physical'?'ppBody':'phBody');
    const trigger=document.getElementById(mode==='physical'?'ppSearch':'phGenerate');
    const status=statusEl(mode);
    if(!body||!trigger){replacing=false;return}
    const kept=[...body.querySelectorAll('tr')].filter(r=>r!==row&&sirenFromRow(r,mode)).map(cleanRowHtml);
    try{
      if(status)status.textContent='Retrait de la société et recherche d’un remplacement…';
      await persist(mode,siren);
      temporary[mode]=new Set(rowSirens(body,mode));
      trigger.click();
      const ok=await waitGeneration(trigger,body);
      if(!ok)throw new Error('Le remplacement prend trop de temps.');
      decorate();
      const fresh=[...body.querySelectorAll('tr')].find(r=>{
        const s=sirenFromRow(r,mode);return s&&!excluded[mode].has(s)&&!temporary[mode].has(s)
      });
      const replacement=fresh?cleanRowHtml(fresh):'';
      temporary[mode].clear();
      body.innerHTML=kept.join('')+replacement;
      renumber(body);
      if(status)status.textContent=replacement?'Société retirée : une nouvelle entreprise a été ajoutée automatiquement.':'Société retirée. Aucun autre prospect correspondant n’a été trouvé pour la remplacer.';
    }catch(e){
      temporary[mode].clear();
      body.innerHTML=kept.join('');renumber(body);
      if(status)status.textContent='Erreur lors du remplacement : '+(e?.message||e);
    }finally{replacing=false}
  }

  const obs=new MutationObserver(()=>decorate());
  function boot(){
    decorate();
    const pp=document.getElementById('ppBody'),ph=document.getElementById('phBody');
    if(pp&&!pp.dataset.replaceObserved){pp.dataset.replaceObserved='1';obs.observe(pp,{childList:true})}
    if(ph&&!ph.dataset.replaceObserved){ph.dataset.replaceObserved='1';obs.observe(ph,{childList:true})}
  }
  let tries=0;const t=setInterval(()=>{tries++;boot();if(tries>120)clearInterval(t)},500);
  window.addEventListener('load',()=>setTimeout(boot,1200));
})();