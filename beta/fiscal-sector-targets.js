(()=>{
  const SECTORS=[1,2,3,4];
  let sellers=[],targets=new Map(),monthly=[],agency={ca_target:0,nc_target:0,upcross_target:0},loadedYear=null,busy=false;
  const n=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)&&x>=0?x:0};
  const fmt=v=>n(v).toLocaleString('fr-FR',{maximumFractionDigits:2});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getSb(){try{return sb}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function year(){return Number(document.getElementById('fstYear')?.value||new Date().getFullYear())}
  function target(sec){return targets.get(Number(sec))||{ca_target:0,nc_target:0,upcross_target:0}}
  function remain(t,d){return Math.max(0,n(t)-n(d))}
  function pct(d,t){return n(t)>0?Math.round(n(d)/n(t)*100):0}
  function totals(rows){return{ca:rows.reduce((a,r)=>a+n(r.ca),0),nc:rows.reduce((a,r)=>a+n(r.nc),0),upcross:rows.reduce((a,r)=>a+n(r.upcross),0)}}
  function sectorTotals(sec){return totals(monthly.filter(r=>Number(r.sector_id)===Number(sec)))}
  function sellerTotals(uid){return totals(monthly.filter(r=>r.user_id===uid))}
  function assigned(sec){return sellers.filter(s=>Number(s.sector_id)===Number(sec))}
  function metric(done,t){const r=remain(t,done),p=pct(done,t);return `<td>${fmt(done)}</td><td>${fmt(t)}</td><td class="${r===0?'fst-ok':'fst-remain'}">${fmt(r)}</td><td>${p}%</td>`}

  function addStyle(){if(document.getElementById('fiscalSectorStyle'))return;const s=document.createElement('style');s.id='fiscalSectorStyle';s.textContent=`.fst-sector-empty{color:#94a3b8;font-style:italic}.fst-sector-note{margin-top:6px;color:#64748b;font-size:10px}`;document.head.appendChild(s)}

  function ensureSectorCard(){
    const page=document.getElementById('rexFiscalSalesPage');if(!page)return null;
    let card=document.getElementById('fstSectorCard');if(card)return card;
    card=document.createElement('div');card.id='fstSectorCard';card.className='fst-card';
    card.innerHTML=`<h3>🗺️ Récapitulatif par secteur</h3><div class="fst-sub">Les secteurs 1 à 4 conservent leurs objectifs même sans vendeur affecté. L’affectation d’un vendeur lui fait automatiquement hériter de l’objectif du secteur.</div><div class="fst-table-wrap"><table class="fst-table"><thead><tr><th rowspan="2">Secteur / affectation</th><th colspan="4">CA</th><th colspan="4">NC</th><th colspan="4">UP/CROSS</th></tr><tr><th>Réalisé</th><th>Objectif</th><th>Reste</th><th>%</th><th>Réalisé</th><th>Objectif</th><th>Reste</th><th>%</th><th>Réalisé</th><th>Objectif</th><th>Reste</th><th>%</th></tr></thead><tbody id="fstSectorSummaryBody"></tbody></table></div>`;
    const agencyCard=document.getElementById('fstAgencyKpis')?.closest('.fst-card');
    agencyCard?.insertAdjacentElement('afterend',card);return card;
  }

  function renderSectorSummary(){
    ensureSectorCard();const body=document.getElementById('fstSectorSummaryBody');if(!body)return;
    body.innerHTML=SECTORS.map(sec=>{const d=sectorTotals(sec),t=target(sec),names=assigned(sec).map(s=>s.display_name||'Vendeur').join(', ');return `<tr><td><b>Secteur ${sec}</b><br>${names?`<span style="color:#64748b">${esc(names)}</span>`:'<span class="fst-sector-empty">Non affecté</span>'}</td>${metric(d.ca,t.ca_target)}${metric(d.nc,t.nc_target)}${metric(d.upcross,t.upcross_target)}</tr>`}).join('');
  }

  function renderSellerSummary(){
    const body=document.getElementById('fstSummaryBody');if(!body)return;
    body.innerHTML=sellers.map(s=>{const d=sellerTotals(s.user_id),t=target(s.sector_id);return `<tr data-sector-aware="1"><td><b>${esc(s.display_name||'Vendeur')}</b>${s.sector_id?`<br><span style="color:#64748b">Objectif Secteur ${esc(s.sector_id)}</span>`:'<br><span class="fst-sector-empty">Aucun secteur affecté</span>'}</td>${metric(d.ca,t.ca_target)}${metric(d.nc,t.nc_target)}${metric(d.upcross,t.upcross_target)}</tr>`}).join('')||'<tr data-sector-aware="1"><td colspan="13">Aucun vendeur.</td></tr>';
  }

  function renderTargets(){
    const body=document.getElementById('fstTargetBody');if(!body)return;
    const ar=`<tr data-agency="1"><td><b>Agence</b></td><td><input data-field="ca_target" inputmode="decimal" value="${esc(fmt(agency.ca_target))}"></td><td><input data-field="nc_target" inputmode="decimal" value="${esc(fmt(agency.nc_target))}"></td><td><input data-field="upcross_target" inputmode="decimal" value="${esc(fmt(agency.upcross_target))}"></td></tr>`;
    const sr=SECTORS.map(sec=>{const t=target(sec),names=assigned(sec).map(s=>s.display_name||'Vendeur').join(', ');return `<tr data-sector="${sec}"><td><b>Secteur ${sec}</b>${names?`<br><span style="color:#64748b">${esc(names)}</span>`:'<br><span class="fst-sector-empty">Non affecté</span>'}</td><td><input data-field="ca_target" inputmode="decimal" value="${esc(fmt(t.ca_target))}"></td><td><input data-field="nc_target" inputmode="decimal" value="${esc(fmt(t.nc_target))}"></td><td><input data-field="upcross_target" inputmode="decimal" value="${esc(fmt(t.upcross_target))}"></td></tr>`}).join('');
    body.innerHTML=ar+sr;
    const sub=document.querySelector('#fstTargetsDetails .fst-sub');if(sub)sub.textContent='Les objectifs sont enregistrés par secteur. S3 et S4 restent disponibles même sans vendeur affecté.';
  }

  async function saveTargets(){
    const client=getSb(),u=getUser(),body=document.getElementById('fstTargetBody');if(!client||!u||!body)return;
    const val=(tr,f)=>n(tr?.querySelector(`[data-field="${f}"]`)?.value),ar=body.querySelector('tr[data-agency]'),fy=year();
    const agencyRow={fiscal_start_year:fy,ca_target:val(ar,'ca_target'),nc_target:val(ar,'nc_target'),upcross_target:val(ar,'upcross_target'),updated_at:new Date().toISOString(),updated_by:u.id};
    const sectorRows=[...body.querySelectorAll('tr[data-sector]')].map(tr=>({fiscal_start_year:fy,sector_id:Number(tr.dataset.sector),ca_target:val(tr,'ca_target'),nc_target:val(tr,'nc_target'),upcross_target:val(tr,'upcross_target'),updated_at:new Date().toISOString(),updated_by:u.id}));
    const msg=document.getElementById('fstTargetMsg');if(msg)msg.textContent='Enregistrement…';
    const a=await client.from('agency_sales_targets').upsert(agencyRow,{onConflict:'fiscal_start_year'});if(a.error){if(msg)msg.textContent='Erreur : '+a.error.message;return}
    const s=await client.from('sector_sales_targets').upsert(sectorRows,{onConflict:'fiscal_start_year,sector_id'});if(s.error){if(msg)msg.textContent='Erreur : '+s.error.message;return}
    agency=agencyRow;sectorRows.forEach(x=>targets.set(Number(x.sector_id),x));renderSectorSummary();renderSellerSummary();if(msg)msg.textContent='Objectifs agence et secteurs enregistrés.';
  }

  async function load(force=false){
    const client=getSb(),fy=year();if(!client||busy||(!force&&loadedYear===fy))return;busy=true;
    try{
      const [pr,tr,mr,ar]=await Promise.all([
        client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id'),
        client.from('sector_sales_targets').select('*').eq('fiscal_start_year',fy).order('sector_id'),
        client.from('seller_monthly_sales').select('*').eq('fiscal_start_year',fy),
        client.from('agency_sales_targets').select('*').eq('fiscal_start_year',fy).maybeSingle()
      ]);
      if(pr.error)throw pr.error;if(tr.error)throw tr.error;if(mr.error)throw mr.error;if(ar.error)throw ar.error;
      sellers=pr.data||[];monthly=mr.data||[];targets=new Map((tr.data||[]).map(x=>[Number(x.sector_id),x]));SECTORS.forEach(sec=>{if(!targets.has(sec))targets.set(sec,{fiscal_start_year:fy,sector_id:sec,ca_target:0,nc_target:0,upcross_target:0})});agency=ar.data||{fiscal_start_year:fy,ca_target:0,nc_target:0,upcross_target:0};loadedYear=fy;
      renderSectorSummary();renderSellerSummary();renderTargets();wire();
    }catch(e){const msg=document.getElementById('fstTargetMsg');if(msg)msg.textContent='Erreur secteurs : '+(e?.message||e)}finally{busy=false}
  }

  function wire(){
    addStyle();ensureSectorCard();
    const save=document.getElementById('fstSaveTargets');if(save&&!save.dataset.sectorWired){save.dataset.sectorWired='1';save.onclick=saveTargets}
    const tb=document.getElementById('fstTargetBody');if(tb&&!tb.dataset.sectorObserved){tb.dataset.sectorObserved='1';new MutationObserver(()=>{if(!tb.querySelector('tr[data-sector]'))renderTargets()}).observe(tb,{childList:true})}
    const sb=document.getElementById('fstSummaryBody');if(sb&&!sb.dataset.sectorObserved){sb.dataset.sectorObserved='1';new MutationObserver(()=>{if(!sb.querySelector('tr[data-sector-aware]'))renderSellerSummary()}).observe(sb,{childList:true})}
  }

  function boot(){if(!document.getElementById('rexFiscalSalesPage'))return false;wire();load();return true}
  document.addEventListener('click',e=>{
    if(e.target?.id==='fiscalSalesNav')setTimeout(()=>load(true),350);
    if(e.target?.id==='fstReload')setTimeout(()=>load(true),500);
    if(e.target?.id==='fstSaveMonth')setTimeout(()=>load(true),900);
  });
  document.addEventListener('change',e=>{if(e.target?.id==='fstYear'){loadedYear=null;setTimeout(()=>load(true),600)}});
  let tries=0;const t=setInterval(()=>{tries++;if(boot()||tries>120)clearInterval(t)},500);window.addEventListener('load',()=>setTimeout(boot,1500));
})();