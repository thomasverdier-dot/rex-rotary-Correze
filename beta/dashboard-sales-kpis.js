(()=>{
  let busy=false,lastSig='';
  const n=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)?x:0};
  const fmt=v=>n(v).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2});
  function getSb(){try{return sb}catch(e){return null}}
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  function currentFY(){const d=new Date();return d.getMonth()>=3?d.getFullYear():d.getFullYear()-1}
  function fyLabel(y){return `FY${String(y).slice(-2)}-${String(y+1).slice(-2)}`}
  function totals(rows){return{ca:(rows||[]).reduce((a,r)=>a+n(r.ca),0),nc:(rows||[]).reduce((a,r)=>a+n(r.nc),0),upcross:(rows||[]).reduce((a,r)=>a+n(r.upcross),0)}}
  function remain(t,d){return Math.max(0,n(t)-n(d))}
  function pct(d,t){return n(t)>0?Math.round(n(d)/n(t)*100):0}

  function addStyle(){
    if(document.getElementById('dashboardSalesKpisStyle'))return;
    const s=document.createElement('style');s.id='dashboardSalesKpisStyle';s.textContent=`
      .dsk-wrap{margin:0 0 16px;background:#fff;border:1px solid #dfe6ee;border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(15,23,42,.055)}
      .dsk-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}.dsk-head h3{margin:0;color:#10233f;font-size:18px}.dsk-head small{display:block;margin-top:4px;color:#64748b;font-size:10px}.dsk-refresh{border:0;border-radius:9px;background:#f1f5f9;color:#334155;padding:8px 11px;font-size:10px;font-weight:900;cursor:pointer}
      .dsk-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.dsk-kpi{border:1px solid #dce5ee;background:#f8fafc;border-radius:15px;padding:13px}.dsk-label{font-size:11px;font-weight:900;color:#10233f;margin-bottom:8px}.dsk-value{font-size:23px;line-height:1.05;font-weight:900;color:#08214a}.dsk-meta{font-size:10px;color:#64748b;margin-top:9px}.dsk-remain{font-weight:900;color:#b45309}.dsk-bar{height:7px;background:#dfe6ee;border-radius:999px;overflow:hidden;margin-top:9px}.dsk-bar i{display:block;height:100%;background:#16a34a;border-radius:999px}.dsk-error{padding:10px;border-radius:10px;background:#fff7ed;color:#9a3412;font-size:11px;font-weight:700}
      @media(max-width:850px){.dsk-grid{grid-template-columns:1fr}.dsk-value{font-size:21px}}
    `;document.head.appendChild(s)
  }

  function dashboard(){return document.querySelector('.rex-page[data-page="dashboard"]')}
  function hideBasePlaceholders(page){
    const grid=page?.querySelector('.rex-grid-note');if(grid)grid.style.display='none';
    [...(page?.children||[])].forEach(x=>{if(x.classList?.contains('rex-placeholder')&&/tableau de bord/i.test(x.textContent||''))x.style.display='none'})
  }
  function placeFirst(){
    const page=dashboard(),box=document.getElementById('dashboardSalesKpis'),head=page?.querySelector('.rex-page-head');if(!page||!box||!head)return;
    if(head.nextElementSibling!==box)head.insertAdjacentElement('afterend',box)
  }
  function ensureBox(){
    const page=dashboard();if(!page)return null;addStyle();hideBasePlaceholders(page);
    let box=document.getElementById('dashboardSalesKpis');
    if(!box){
      box=document.createElement('div');box.id='dashboardSalesKpis';box.className='dsk-wrap';box.innerHTML='<div class="dsk-error">Chargement des chiffres…</div>';
      const head=page.querySelector('.rex-page-head');if(head)head.insertAdjacentElement('afterend',box);else page.prepend(box);
      const obs=new MutationObserver(()=>placeFirst());obs.observe(page,{childList:true});
    }
    placeFirst();return box
  }
  function card(label,done,target){const p=pct(done,target),r=remain(target,done);return `<div class="dsk-kpi"><div class="dsk-label">${label}</div><div class="dsk-value">${fmt(done)} / ${fmt(target)}</div><div class="dsk-meta">Reste à faire : <span class="dsk-remain">${fmt(r)}</span> · ${p}% atteint</div><div class="dsk-bar"><i style="width:${Math.min(100,p)}%"></i></div></div>`}
  function render(box,title,sub,done,target){
    const sig=[title,sub,done.ca,done.nc,done.upcross,target.ca_target,target.nc_target,target.upcross_target].join('|');if(sig===lastSig&&box.querySelector('.dsk-grid'))return;lastSig=sig;
    box.innerHTML=`<div class="dsk-head"><div><h3>🏢 ${title}</h3><small>${sub}</small></div><button id="dskRefresh" class="dsk-refresh" type="button">Actualiser</button></div><div class="dsk-grid">${card('CA',done.ca,target.ca_target)}${card('NC',done.nc,target.nc_target)}${card('UP/CROSS',done.upcross,target.upcross_target)}</div>`;
    box.querySelector('#dskRefresh').onclick=()=>load(true)
  }

  async function latestOwnProfile(client,u,p){
    if(!u)return p||{};
    try{const r=await client.from('profiles').select('user_id,display_name,role,sector_id').eq('user_id',u.id).maybeSingle();if(!r.error&&r.data)return r.data}catch(e){}
    return p||{}
  }

  async function load(force=false){
    const box=ensureBox(),client=getSb(),p=getProfile(),u=getUser();if(!box||!client||!p||!u||busy)return;busy=true;
    try{
      const fy=currentFY();
      if(isAdmin()){
        const [tr,mr]=await Promise.all([
          client.from('agency_sales_targets').select('ca_target,nc_target,upcross_target').eq('fiscal_start_year',fy).maybeSingle(),
          client.from('sector_monthly_sales').select('ca,nc,upcross').eq('fiscal_start_year',fy)
        ]);
        if(tr.error)throw tr.error;if(mr.error)throw mr.error;
        render(box,'Agence',`Cumul de tous les secteurs · ${fyLabel(fy)} · avril ${fy} → mars ${fy+1}`,totals(mr.data||[]),tr.data||{ca_target:0,nc_target:0,upcross_target:0});
      }else{
        const fresh=await latestOwnProfile(client,u,p),sec=Number(fresh?.sector_id||0);
        if(!sec){box.innerHTML='<div class="dsk-error">Aucun secteur ne t’est affecté pour le moment.</div>';return}
        const [tr,mr]=await Promise.all([
          client.from('sector_sales_targets').select('ca_target,nc_target,upcross_target').eq('fiscal_start_year',fy).eq('sector_id',sec).maybeSingle(),
          client.from('sector_monthly_sales').select('ca,nc,upcross').eq('fiscal_start_year',fy).eq('sector_id',sec)
        ]);
        if(tr.error)throw tr.error;if(mr.error)throw mr.error;
        const name=fresh?.display_name||p?.display_name||'Vendeur';
        render(box,`Mes chiffres — Secteur ${sec}`,`${name} · ${fyLabel(fy)} · objectif du secteur`,totals(mr.data||[]),tr.data||{ca_target:0,nc_target:0,upcross_target:0});
      }
    }catch(e){box.innerHTML=`<div class="dsk-error">Impossible de charger les chiffres : ${String(e?.message||e).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</div>`}finally{busy=false;placeFirst()}
  }

  function boot(){const box=ensureBox(),p=getProfile(),u=getUser();if(box&&p&&u){load();return true}return false}
  document.addEventListener('click',e=>{if(e.target?.closest?.('button[data-page="dashboard"]'))setTimeout(()=>load(true),120)});
  let tries=0;const t=setInterval(()=>{tries++;if(boot()||tries>120)clearInterval(t)},500);window.addEventListener('load',()=>setTimeout(boot,1200));
})();