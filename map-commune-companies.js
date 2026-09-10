(()=>{
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const esc2=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getGeo(){try{return geo||null}catch(e){return null}}
  function getSectorFor(){try{return typeof sectorFor==='function'?sectorFor:null}catch(e){return null}}
  function getGroups(){try{return groups||{} }catch(e){return {}}}

  async function companiesForCommune(feature){
    const p=getProfile(), sf=getSectorFor();
    if(!p||!feature||!sf)return;
    const sector=sf(feature);
    if(!sector)return;
    if(p.role==='seller' && +sector!==+p.sector_id)return;

    const commune=feature.properties?.nom||'Commune';
    const cpList=(feature.properties?.codesPostaux||[]).filter(Boolean);
    const modalEl=document.getElementById('modal');
    const title=document.getElementById('mTitle');
    const sub=document.getElementById('mSub');
    const status=document.getElementById('companyStatus');
    const body=document.getElementById('companyBody');
    const chips=document.getElementById('chips');
    if(!modalEl||!title||!sub||!status||!body)return;

    title.textContent=commune;
    sub.textContent=`Secteur ${sector} • ${cpList.join(', ')}`;
    if(chips) chips.innerHTML='';
    body.innerHTML='';
    status.textContent='Chargement des entreprises de la commune…';
    modalEl.classList.add('open');

    if(!navigator.onLine){status.textContent='Recherche indisponible hors ligne.';return}
    try{
      const rows=new Map();
      for(const cp of cpList){
        let page=1,pages=1;
        do{
          const q=new URLSearchParams({code_postal:cp,etat_administratif:'A',categorie_entreprise:'PME,ETI,GE',page:String(page),per_page:'25'});
          const r=await fetch(ENTERPRISE+'?'+q);
          if(!r.ok)throw Error('HTTP '+r.status);
          const d=await r.json();
          (d.results||[]).forEach(x=>{
            const sj=x.siege||{}, legal=String(x.nature_juridique||'');
            if(x.etat_administratif!=='A'||!['PME','ETI','GE'].includes(x.categorie_entreprise)||['6540','6541','6542','6543'].includes(legal)||String(x.activite_principale||'').toUpperCase()==='64.20Z'||String(sj.code_postal)!==String(cp)||!x.siren)return;
            if(norm(sj.libelle_commune)!==norm(commune))return;
            rows.set(x.siren,{n:x.nom_complet||x.nom_raison_sociale||x.denomination||'Entreprise',s:x.siren,p:x.telephone||sj.telephone||'',a:sj.adresse||[sj.numero_voie,sj.type_voie,sj.libelle_voie,sj.code_postal,sj.libelle_commune].filter(Boolean).join(' ')});
          });
          pages=+d.total_pages||1;page++;
        }while(page<=pages);
      }
      const arr=[...rows.values()].sort((a,b)=>a.n.localeCompare(b.n,'fr'));
      status.textContent=`${arr.length} entreprise(s) qualifiée(s) à ${commune}`;
      body.innerHTML=arr.map(x=>`<tr><td><b>${esc2(x.n)}</b></td><td>${esc2(x.s)}</td><td>${esc2(x.p||'Non disponible')}</td><td>${esc2(x.a||'Adresse non disponible')}</td></tr>`).join('')||'<tr><td colspan="4">Aucune entreprise qualifiée dans cette commune.</td></tr>';
    }catch(e){status.textContent='Erreur : '+e.message}
  }

  function wire(){
    const svg=document.getElementById('mapSvg'), g=getGeo(), sf=getSectorFor(), p=getProfile();
    if(!svg||!g||!sf||!p)return false;
    const paths=[...svg.querySelectorAll('path.commune')];
    if(!paths.length)return false;
    paths.forEach((path,i)=>{
      const f=g.features[i]; if(!f)return;
      const s=sf(f), allowed=s && (p.role==='admin' || +s===+p.sector_id);
      path.style.cursor=allowed?'pointer':'default';
      path.style.transition='opacity .12s, stroke-width .12s';
      path.onclick=allowed?()=>companiesForCommune(f):null;
      if(allowed){
        path.onmouseenter=()=>{path.style.opacity='.82';path.style.strokeWidth='2'};
        path.onmouseleave=()=>{path.style.opacity='1';path.style.strokeWidth='0.8'};
      }
    });
    return true;
  }

  let tries=0;
  const timer=setInterval(()=>{tries++; if(wire()||tries>120)clearInterval(timer)},250);
  const obs=new MutationObserver(()=>setTimeout(wire,20));
  window.addEventListener('load',()=>{const svg=document.getElementById('mapSvg');if(svg)obs.observe(svg,{childList:true})});
})();