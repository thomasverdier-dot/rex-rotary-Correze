(()=>{
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const esc2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function globalsReady(){
    try{return !!(window.mapSvg && window.geo && typeof window.sectorFor==='function' && window.profile)}catch(e){return false}
  }

  function canOpenSector(s){
    try{
      if(!profile) return false;
      if(profile.role==='admin') return s>0;
      return s>0 && Number(profile.sector_id)===Number(s);
    }catch(e){return false}
  }

  function eligiblePathInfo(pathEl){
    try{
      const paths=[...mapSvg.querySelectorAll('path.commune')];
      const i=paths.indexOf(pathEl);
      if(i<0 || !geo?.features?.[i]) return null;
      const f=geo.features[i];
      const s=sectorFor(f);
      if(!canOpenSector(s)) return null;
      return {feature:f,sector:s};
    }catch(e){return null}
  }

  async function fetchCommuneCompanies(feature,sector){
    const commune=feature.properties.nom;
    const postalCodes=(feature.properties.codesPostaux||[]).map(String);
    const rows=new Map();

    companyStatus.textContent='Chargement des entreprises de '+commune+'…';
    companyBody.innerHTML='<tr><td colspan="4" style="color:#667085">Recherche des entreprises qualifiées…</td></tr>';

    for(const cp of postalCodes){
      let page=1,pages=1;
      do{
        const params=new URLSearchParams({code_postal:cp,etat_administratif:'A',categorie_entreprise:'PME,ETI,GE',page:String(page),per_page:'25'});
        const r=await fetch(ENTERPRISE+'?'+params.toString());
        if(!r.ok) throw new Error('HTTP '+r.status);
        const d=await r.json();
        (d.results||[]).forEach(x=>{
          const sj=x.siege||{};
          const legal=String(x.nature_juridique||'');
          const sameCommune=norm(sj.libelle_commune)===norm(commune);
          if(!sameCommune) return;
          if(x.etat_administratif!=='A') return;
          if(!['PME','ETI','GE'].includes(x.categorie_entreprise)) return;
          if(['6540','6541','6542','6543'].includes(legal)) return;
          if(String(x.activite_principale||'').toUpperCase()==='64.20Z') return;
          if(sj.etat_administratif && sj.etat_administratif!=='A') return;
          if(!x.siren) return;
          rows.set(x.siren,{
            n:x.nom_complet||x.nom_raison_sociale||x.denomination||'Entreprise',
            s:x.siren,
            p:x.telephone||x.telephone1||sj.telephone||sj.telephone1||'',
            a:sj.adresse||[sj.numero_voie,sj.indice_repetition,sj.type_voie,sj.libelle_voie,sj.code_postal,sj.libelle_commune].filter(Boolean).join(' ')
          });
        });
        pages=Number(d.total_pages||1); page++;
      }while(page<=pages);
    }

    const arr=[...rows.values()].sort((a,b)=>a.n.localeCompare(b.n,'fr'));
    companyStatus.textContent=arr.length+' entreprise'+(arr.length>1?'s':'')+' qualifiée'+(arr.length>1?'s':'')+' — '+commune;
    companyBody.innerHTML=arr.length?arr.map(x=>`<tr><td><b>${esc2(x.n)}</b></td><td>${esc2(x.s)}</td><td>${esc2(x.p||'Non disponible')}</td><td>${esc2(x.a||'Adresse non disponible')}</td></tr>`).join(''):'<tr><td colspan="4">Aucune entreprise qualifiée trouvée dans cette commune.</td></tr>';
  }

  async function openCommune(info){
    const {feature,sector}=info;
    const commune=feature.properties.nom;
    const postalCodes=(feature.properties.codesPostaux||[]).map(String);
    currentSector=sector;
    mTitle.textContent='Entreprises — '+commune;
    mSub.textContent='Secteur '+sector+' · '+(postalCodes.length?'CP '+postalCodes.join(', '):'sans code postal');
    try{seller.value=sectorData[sector]?.seller||'';seller.readOnly=profile.role!=='admin'}catch(e){}
    chips.innerHTML=postalCodes.map(cp=>`<button class="chip" disabled>${esc2(cp)}</button>`).join('');
    modal.classList.add('open');
    try{await fetchCommuneCompanies(feature,sector)}catch(e){companyStatus.textContent='Erreur : '+e.message;companyBody.innerHTML='<tr><td colspan="4">Impossible de charger les entreprises.</td></tr>'}
  }

  function refreshCursor(){
    if(!globalsReady()) return;
    const paths=[...mapSvg.querySelectorAll('path.commune')];
    paths.forEach((p,i)=>{
      const f=geo.features[i],s=f?sectorFor(f):0;
      const ok=canOpenSector(s);
      p.style.cursor=ok?'pointer':'default';
      p.style.transition='filter .12s, opacity .12s';
      p.dataset.mapCompanyEnabled=ok?'1':'0';
    });
  }

  function mount(){
    if(!globalsReady() || mapSvg.dataset.companyClickMounted==='1') return false;
    mapSvg.dataset.companyClickMounted='1';
    mapSvg.addEventListener('click',e=>{
      const p=e.target.closest?.('path.commune');
      if(!p) return;
      const info=eligiblePathInfo(p);
      if(!info) return;
      openCommune(info);
    });
    mapSvg.addEventListener('mouseover',e=>{const p=e.target.closest?.('path.commune');if(p?.dataset.mapCompanyEnabled==='1')p.style.filter='brightness(.92)'});
    mapSvg.addEventListener('mouseout',e=>{const p=e.target.closest?.('path.commune');if(p)p.style.filter=''});
    refreshCursor();
    const obs=new MutationObserver(()=>refreshCursor());
    obs.observe(mapSvg,{childList:true});
    return true;
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(timer)},250);
  window.addEventListener('load',()=>setTimeout(()=>{mount();refreshCursor()},600));
})();
