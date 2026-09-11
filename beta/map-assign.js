(()=>{
  const ID='rexBetaMapAssign';

  function esc(s){
    return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function ensureDialog(){
    let root=document.getElementById(ID);
    if(root)return root;
    const style=document.createElement('style');
    style.textContent=`
      #${ID}{display:none;position:fixed;inset:0;z-index:25000;background:rgba(12,25,45,.48);align-items:center;justify-content:center;padding:20px}
      #${ID}.open{display:flex}
      #${ID} .rex-card{width:min(520px,94vw);background:#fff;border-radius:16px;padding:18px;box-shadow:0 24px 70px rgba(20,36,59,.22);font-family:Segoe UI,Arial,sans-serif;color:#14243b}
      #${ID} .rex-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
      #${ID} h2{margin:0;color:#0e2f68;font-size:20px}
      #${ID} .rex-sub{margin-top:5px;color:#667085;font-size:12px;line-height:1.45}
      #${ID} .rex-current{margin:14px 0;padding:10px;border:1px solid #d9e2ec;border-radius:10px;background:#f8fbff;font-size:13px}
      #${ID} .rex-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      #${ID} button{border:1px solid #cbd5e1;border-radius:9px;padding:10px;cursor:pointer;font-weight:800;background:#fff}
      #${ID} button:disabled{opacity:.55;cursor:wait}
      #${ID} .s1{background:#58a9ff}.s2{background:#67c26f}.s3{background:#f6a04d}.s4{background:#b06adf}
      #${ID} .rex-remove{width:100%;margin-top:8px}
      #${ID} .rex-close{padding:6px 10px;font-size:18px;line-height:1;background:#fff}
      #${ID} .rex-note{font-size:11px;color:#667085;margin-top:10px;line-height:1.45}
      #${ID} .rex-error{font-size:12px;color:#b42318;margin-top:9px;min-height:16px}
    `;
    document.head.appendChild(style);

    root=document.createElement('div');
    root.id=ID;
    root.innerHTML=`<div class="rex-card">
      <div class="rex-head"><div><h2 id="rexAssignTitle">Affecter la commune</h2><div id="rexAssignSub" class="rex-sub"></div></div><button id="rexAssignClose" class="rex-close" type="button">×</button></div>
      <div id="rexAssignCurrent" class="rex-current"></div>
      <div id="rexAssignActions" class="rex-grid">
        <button class="s1" data-rex-sector="1" type="button">Secteur 1</button>
        <button class="s2" data-rex-sector="2" type="button">Secteur 2</button>
        <button class="s3" data-rex-sector="3" type="button">Secteur 3</button>
        <button class="s4" data-rex-sector="4" type="button">Secteur 4</button>
      </div>
      <button id="rexAssignRemove" class="rex-remove" type="button">Retirer l’affectation</button>
      <div id="rexAssignNote" class="rex-note"></div>
      <div id="rexAssignError" class="rex-error"></div>
    </div>`;
    document.body.appendChild(root);
    root.querySelector('#rexAssignClose').onclick=()=>root.classList.remove('open');
    root.addEventListener('click',e=>{if(e.target===root)root.classList.remove('open')});
    return root;
  }

  function featureForPath(pathEl){
    try{
      const paths=[...mapSvg.querySelectorAll('path.commune')];
      const i=paths.indexOf(pathEl);
      return i>=0&&geo?.features?.[i]?geo.features[i]:null;
    }catch(e){return null}
  }

  function currentLabel(feature){
    if(locked(feature))return 'Secteur 1 — commune verrouillée';
    const codes=(cps(feature)||[]).map(String);
    const vals=[...new Set(codes.map(cp=>Number(assign[cp]||0)))];
    if(!vals.length||vals.every(v=>v===0))return 'Non affectée';
    if(vals.length===1)return vals[0]?'Secteur '+vals[0]:'Non affectée';
    return 'Affectation mixte : '+vals.map(v=>v?'S'+v:'non affecté').join(' / ');
  }

  function openFor(feature){
    if(!feature||!profile||profile.role!=='admin')return;
    const root=ensureDialog();
    const name=feature.properties?.nom||'Commune';
    const codes=(cps(feature)||[]).map(String);
    root.dataset.featureCode=feature.properties?.code||'';
    root.querySelector('#rexAssignTitle').textContent=name;
    root.querySelector('#rexAssignSub').textContent=codes.length?'Code postal : '+codes.join(', '):'Aucun code postal disponible';
    root.querySelector('#rexAssignCurrent').innerHTML='<b>Affectation actuelle :</b> '+esc(currentLabel(feature));
    root.querySelector('#rexAssignError').textContent='';
    root.querySelector('#rexAssignNote').textContent=locked(feature)
      ?'Cette commune fait partie des 11 communes verrouillées du secteur 1.'
      :'L’affectation reste enregistrée par code postal. Si ce code postal est partagé par plusieurs communes, elles peuvent être impactées ensemble.';
    root.querySelector('#rexAssignActions').style.display=locked(feature)?'none':'grid';
    root.querySelector('#rexAssignRemove').style.display=locked(feature)?'none':'block';
    root.querySelectorAll('[data-rex-sector]').forEach(b=>b.onclick=()=>apply(feature,Number(b.dataset.rexSector)));
    root.querySelector('#rexAssignRemove').onclick=()=>apply(feature,0);
    root.classList.add('open');
  }

  async function apply(feature,sector){
    const root=ensureDialog();
    const codes=(cps(feature)||[]).map(String);
    if(!codes.length){root.querySelector('#rexAssignError').textContent='Aucun code postal à affecter.';return}
    const buttons=[...root.querySelectorAll('button')];
    buttons.forEach(b=>b.disabled=true);
    root.querySelector('#rexAssignError').textContent='Enregistrement…';
    try{
      for(const cp of codes){
        if(sector===0){
          const {error}=await sb.from('postal_sector_assignments').delete().eq('postal_code',cp);
          if(error)throw error;
          delete assign[cp];
        }else{
          const {error}=await sb.from('postal_sector_assignments').upsert({postal_code:cp,sector_id:sector,updated_by:user.id},{onConflict:'postal_code'});
          if(error)throw error;
          assign[cp]=sector;
        }
      }
      cache();
      render();
      root.classList.remove('open');
    }catch(e){
      root.querySelector('#rexAssignError').textContent='Erreur : '+(e?.message||e);
    }finally{
      buttons.forEach(b=>b.disabled=false);
    }
  }

  function mount(){
    try{
      if(!mapSvg)return false;
      if(mapSvg.dataset.rexAssignMounted==='1')return true;
      mapSvg.dataset.rexAssignMounted='1';
      mapSvg.addEventListener('click',e=>{
        if(!profile||profile.role!=='admin')return;
        const p=e.target.closest?.('path.commune');
        if(!p)return;
        const f=featureForPath(p);
        if(!f)return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        openFor(f);
      },true);
      return true;
    }catch(e){return false}
  }

  let tries=0;
  const timer=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(timer)},250);
  window.addEventListener('load',()=>setTimeout(mount,400));
})();
