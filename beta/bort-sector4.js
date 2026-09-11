(()=>{
  const BORT='Bort-les-Orgues';
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const isBort=f=>norm(f?.properties?.nom)===norm(BORT);

  function patchSectorFor(){
    try{
      if(typeof sectorFor!=='function'||sectorFor.__bortS4)return false;
      const base=sectorFor;
      const wrapped=function(feature){
        if(isBort(feature))return 4;
        return base(feature);
      };
      wrapped.__bortS4=true;
      sectorFor=wrapped;
      if(typeof render==='function')setTimeout(()=>{try{render()}catch(e){}},50);
      return true;
    }catch(e){return false}
  }

  function mountGuard(){
    try{
      if(!mapSvg||mapSvg.dataset.bortS4Guard==='1')return !!mapSvg;
      mapSvg.dataset.bortS4Guard='1';
      mapSvg.addEventListener('click',e=>{
        if(!profile||profile.role!=='admin')return;
        const path=e.target.closest?.('path.commune');
        if(!path)return;
        const paths=[...mapSvg.querySelectorAll('path.commune')];
        const i=paths.indexOf(path),feature=i>=0&&geo?.features?.[i]?geo.features[i]:null;
        if(!isBort(feature))return;
        e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
        const old=document.getElementById('bortS4Notice');if(old)old.remove();
        const n=document.createElement('div');n.id='bortS4Notice';
        n.style.cssText='position:fixed;left:50%;top:22px;transform:translateX(-50%);z-index:30000;background:#6f3ca5;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 12px 35px rgba(15,23,42,.22);font:800 12px Segoe UI,Arial';
        n.textContent='Bort-les-Orgues est verrouillée au Secteur 4.';document.body.appendChild(n);setTimeout(()=>n.remove(),2600);
      },true);
      return true;
    }catch(e){return false}
  }

  function boot(){const a=patchSectorFor(),b=mountGuard();return a&&b}
  let tries=0;const t=setInterval(()=>{tries++;if(boot()||tries>120)clearInterval(t)},250);
  window.addEventListener('load',()=>setTimeout(boot,500));
})();