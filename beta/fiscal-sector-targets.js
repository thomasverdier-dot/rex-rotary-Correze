(()=>{
  const SECTORS=[1,2,3,4];
  const MONTHS=['Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre','Janvier','Février','Mars'];
  let sellers=[],sellerTargets=new Map(),monthly=[],agency={ca_target:0,nc_target:0,upcross_target:0},loadedYear=null,busy=false;
  const n=v=>{const x=Number(String(v??'').replace(',','.'));return Number.isFinite(x)&&x>=0?x:0};
  const fmt=v=>n(v).toLocaleString('fr-FR',{maximumFractionDigits:2});
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function getSb(){try{return sb}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function year(){return Number(document.getElementById('fstYear')?.value||new Date().getFullYear())}
  function monthIndex(){return Number(document.getElementById('fstMonth')?.value||1)}
  function target(uid){return sellerTargets.get(uid)||null}
  function remain(t,d){return Math.max(0,n(t)-n(d))}
  function pct(d,t){return n(t)>0?Math.round(n(d)/n(t)*100):0}
  function totals(rows){return{ca:rows.reduce((a,r)=>a+n(r.ca),0),nc:rows.reduce((a,r)=>a+n(r.nc),0),upcross:rows.reduce((a,r)=>a+n(r.upcross),0)}}
  function sectorTotals(sec){return totals(monthly.filter(r=>Number(r.sector_id)===Number(sec)))}
  function agencyTotals(){return totals(monthly)}
  function monthRow(sec,mi){return monthly.find(r=>Number(r.sector_id)===Number(sec)&&Number(r.month_index)===Number(mi))||{ca:0,nc:0,upcross:0}}
  function assigned(sec){return sellers.filter(s=>Number(s.sector_id)===Number(sec))}
  function metric(done,t){const r=remain(t,done),p=pct(done,t);return `<td>${fmt(done)}</td><td>${fmt(t)}</td><td class="${r===0?'fst-ok':'fst-remain'}">${fmt(r)}</td><td>${p}%</td>`}

  function addStyle(){if(document.getElementById('fiscalSectorStyle'))return;const s=document.createElement('style');s.id='fiscalSectorStyle';s.textContent=`
    .fst-sector-empty{color:#94a3b8;font-style:italic}.fst-sector-note{margin-top:6px;color:#64748b;font-size:10px}
    .fst-sector-month-row td:first-child{min-width:180px}.fst-sector-month-row input{width:100px}
  `;document.head.appendChild(s)}

  function ensureSectorCard(){
    const page=document.getElementById('rexFiscalSalesPage');if(!page)return null;
    let card=document.getElementById('fstSectorCard');if(card)return card;
    card=document.createElement('div');card.id='fstSectorCard';card.className='fst-card';
    card.innerHTML=`<h3>🗺️ Réalisé fiscal par secteur</h3><div class="fst-sub">Chiffres CA / NC / UC saisis par secteur. Les objectifs CA / NC / UC sont individuels et restent attachés à chaque commercial, même s'il change de secteur.</div>
      <div class="fst-table-wrap"><table class="fst-table"><thead><tr><th>Secteur / affectation actuelle</th><th>CA réalisé</th><th>NC réalisé</th><th>UC réalisé</th></tr></thead><tbody id="fstSectorSummaryBody"></tbody></table></div>`;
    const agencyCard=document.getElementById('fstAgencyKpis')?.closest('.fst-card');
    agencyCard?.insertAdjacentElement('afterend',card);return card;
  }

  function renderAgency(){
    const el=document.getElementById('fstAgencyKpis');if(!el)return;
    const caption=el.closest('.fst-card')?.querySelector('.fst-sub');
    if(caption)caption.textContent='CA / NC / UC fiscal cumulés par secteur, comparés à l’objectif indépendant de l’agence.';
    const d=agencyTotals();
    const k=(label,done,t)=>{const p=pct(done,t),r=remain(t,done);return `<div class="fst-kpi"><b>${label}</b><strong>${fmt(done)} / ${fmt(t)}</strong><small>Reste à faire : <span class="${r===0?'fst-ok':'fst-remain'}">${fmt(r)}</span> · ${p}% atteint</small><div class="fst-bar"><i style="width:${Math.min(100,p)}%"></i></div></div>`};
    el.innerHTML=k('CA',d.ca,agency.ca_target)+k('NC',d.nc,agency.nc_target)+k('UP/CROSS',d.upcross,agency.upcross_target);
  }

  function renderSectorSummary(){
    ensureSectorCard();const body=document.getElementById('fstSectorSummaryBody');if(!body)return;
    body.innerHTML=SECTORS.map(sec=>{
      const amount=sectorTotals(sec),names=assigned(sec).map(x=>x.display_name||'Commercial').join(', ');
      return `<tr><td><b>Secteur ${sec}</b><br><span class="fst-sector-note">${names?esc(names):'Non affecté actuellement'}</span></td><td>${fmt(amount.ca)}</td><td>${fmt(amount.nc)}</td><td>${fmt(amount.upcross)}</td></tr>`;
    }).join('');
  }

  function renderSellerSummary(){
    const body=document.getElementById('fstSummaryBody');if(!body)return;
    const card=body.closest('.fst-card');
    const caption=card?.querySelector('.fst-sub');
    if(caption)caption.textContent='Objectifs personnels par commercial. Les réalisations fiscales saisies par secteur figurent séparément et ne sont pas attribuées artificiellement aux vendeurs.';
    const head=body.closest('table')?.querySelector('thead');
    if(head)head.innerHTML='<tr><th>Commercial</th><th>Objectif CA</th><th>Objectif NC</th><th>Objectif UC</th><th>Secteur actuel</th></tr>';
    body.innerHTML=sellers.map(person=>{
      const goals=target(person.user_id),sec=person.sector_id;
      const f=k=>goals?fmt(goals[k]):'<span class="fst-sector-empty">Non renseigné</span>';
      return `<tr data-personal-summary="1"><td><b>${esc(person.display_name||'Commercial')}</b></td><td>${f('ca_target')}</td><td>${f('nc_target')}</td><td>${f('upcross_target')}</td><td>${sec?'S'+esc(sec):'—'}</td></tr>`;
    }).join('')||'<tr data-personal-summary="1"><td colspan="5">Aucun vendeur.</td></tr>';
  }

  function renderMonth(){
    const body=document.getElementById('fstMonthBody');if(!body)return;const mi=monthIndex();
    const head=body.closest('table')?.querySelector('thead tr');if(head)head.innerHTML='<th>Secteur / affectation</th><th>CA</th><th>NC</th><th>UP/CROSS</th>';
    body.innerHTML=SECTORS.map(sec=>{const r=monthRow(sec,mi),names=assigned(sec).map(s=>s.display_name||'Vendeur').join(', ');return `<tr class="fst-sector-month-row" data-sector="${sec}"><td><b>Secteur ${sec}</b><br>${names?`<span style="color:#64748b">${esc(names)}</span>`:'<span class="fst-sector-empty">Non affecté</span>'}</td><td><input data-field="ca" inputmode="decimal" value="${esc(fmt(r.ca))}"></td><td><input data-field="nc" inputmode="decimal" value="${esc(fmt(r.nc))}"></td><td><input data-field="upcross" inputmode="decimal" value="${esc(fmt(r.upcross))}"></td></tr>`}).join('');
    const sub=body.closest('.fst-card')?.querySelector('.fst-sub');if(sub)sub.textContent=`${MONTHS[mi-1]} : saisis CA, NC et UP/CROSS pour les 4 secteurs, même si un secteur est temporairement non affecté.`;
  }

  function renderTargets(){
    const body=document.getElementById('fstTargetBody');if(!body)return;
    const agencyRow=`<tr data-agency="1"><td><b>Agence</b></td><td><input data-field="ca_target" inputmode="decimal" value="${esc(fmt(agency.ca_target))}"></td><td><input data-field="nc_target" inputmode="decimal" value="${esc(fmt(agency.nc_target))}"></td><td><input data-field="upcross_target" inputmode="decimal" value="${esc(fmt(agency.upcross_target))}"></td></tr>`;
    const sellerRows=sellers.map(person=>{
      const goal=target(person.user_id);
      const field=k=>goal?esc(fmt(goal[k])):'';
      return `<tr data-user="${esc(person.user_id)}" data-personal-target="1"><td><b>${esc(person.display_name||'Commercial')}</b><br><span class="fst-sector-note">${person.sector_id?'Actuellement S'+esc(person.sector_id):'Sans secteur'}</span></td><td><input data-field="ca_target" inputmode="decimal" placeholder="Non renseigné" value="${field('ca_target')}"></td><td><input data-field="nc_target" inputmode="decimal" placeholder="Non renseigné" value="${field('nc_target')}"></td><td><input data-field="upcross_target" inputmode="decimal" placeholder="Non renseigné" value="${field('upcross_target')}"></td></tr>`;
    }).join('');
    body.innerHTML=agencyRow+sellerRows;
    const sub=document.querySelector('#fstTargetsDetails .fst-sub');
    if(sub)sub.textContent='Chaque vendeur dispose de ses propres objectifs CA / NC / UC, indépendamment de son secteur. L’objectif agence peut être différent de la somme des objectifs individuels.';
  }

  async function saveMonth(){
    const client=getSb(),u=getUser(),body=document.getElementById('fstMonthBody');if(!client||!u||!body)return;const fy=year(),mi=monthIndex();
    const val=(tr,f)=>n(tr.querySelector(`[data-field="${f}"]`)?.value);
    const rows=SECTORS.map(sec=>{const tr=body.querySelector(`tr[data-sector="${sec}"]`);return{fiscal_start_year:fy,sector_id:sec,month_index:mi,ca:val(tr,'ca'),nc:val(tr,'nc'),upcross:val(tr,'upcross'),updated_at:new Date().toISOString(),updated_by:u.id}});
    const msg=document.getElementById('fstMonthMsg');if(msg)msg.textContent='Enregistrement des 4 secteurs…';
    const r=await client.from('sector_monthly_sales').upsert(rows,{onConflict:'fiscal_start_year,sector_id,month_index'});if(r.error){if(msg)msg.textContent='Erreur : '+r.error.message;return}
    rows.forEach(row=>{const i=monthly.findIndex(x=>Number(x.sector_id)===row.sector_id&&Number(x.month_index)===mi);if(i>=0)monthly[i]=row;else monthly.push(row)});
    renderAgency();renderSectorSummary();renderSellerSummary();window.dispatchEvent(new Event('rex:fiscal-monthly-synced'));if(msg)msg.textContent=`${MONTHS[mi-1]} enregistré pour S1, S2, S3 et S4.`;
  }

  async function saveTargets(){
    const client=getSb(),u=getUser(),body=document.getElementById('fstTargetBody');
    if(!client||!u||!body)return;
    const fy=year(),msg=document.getElementById('fstTargetMsg'),ar=body.querySelector('tr[data-agency]');
    const parse=raw=>{const value=String(raw??'').trim().replace(/\s/g,'').replace(',','.');return /^\d+(\.\d{1,2})?$/.test(value)&&Number(value)<=100000000?Number(value):null};
    const get=(tr,k)=>parse(tr?.querySelector(`[data-field="${k}"]`)?.value);
    const keys=['ca_target','nc_target','upcross_target'];
    const agencyValues=Object.fromEntries(keys.map(k=>[k,get(ar,k)]));
    if(keys.some(k=>agencyValues[k]===null)){if(msg)msg.textContent='Objectif agence : renseigne trois montants CA, NC et UC valides.';return}
    const sellerRows=[];
    for(const tr of body.querySelectorAll('tr[data-personal-target]')){
      const values=Object.fromEntries(keys.map(k=>[k,String(tr.querySelector(`[data-field="${k}"]`)?.value||'').trim()]));
      const filled=keys.filter(k=>values[k]!=='');
      if(!filled.length)continue; // Un vendeur non renseigné ne devient pas un objectif zéro.
      const parsed=Object.fromEntries(keys.map(k=>[k,parse(values[k])]));
      if(keys.some(k=>parsed[k]===null)){if(msg)msg.textContent='Complète les trois objectifs CA, NC et UC pour chaque vendeur commencé (0 accepté).';return}
      sellerRows.push({fiscal_start_year:fy,user_id:tr.dataset.user,...parsed,updated_at:new Date().toISOString(),updated_by:u.id});
    }
    if(msg)msg.textContent='Enregistrement des objectifs individuels…';
    const agencyRow={fiscal_start_year:fy,...agencyValues,updated_at:new Date().toISOString(),updated_by:u.id};
    try{
      const a=await client.from('agency_sales_targets').upsert(agencyRow,{onConflict:'fiscal_start_year'});
      if(a.error)throw a.error;
      if(sellerRows.length){
        const r=await client.from('seller_sales_targets').upsert(sellerRows,{onConflict:'fiscal_start_year,user_id'});
        if(r.error)throw r.error;
      }
      agency=agencyRow;sellerRows.forEach(x=>sellerTargets.set(x.user_id,x));
      renderAgency();renderSellerSummary();renderTargets();
      window.dispatchEvent(new Event('rex:fiscal-targets-synced'));
      if(msg)msg.textContent='Objectifs agence et commerciaux enregistrés.';
    }catch(e){if(msg)msg.textContent='Erreur lors de la sauvegarde des objectifs : '+(e?.message||e)}
  }

  async function load(force=false){
    const client=getSb(),fy=year();if(!client||busy||(!force&&loadedYear===fy))return;busy=true;
    try{
      const [pr,tr,mr,ar]=await Promise.all([
        client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id'),
        client.from('seller_sales_targets').select('*').eq('fiscal_start_year',fy),
        client.from('sector_monthly_sales').select('*').eq('fiscal_start_year',fy),
        client.from('agency_sales_targets').select('*').eq('fiscal_start_year',fy).maybeSingle()
      ]);
      if(pr.error)throw pr.error;if(tr.error)throw tr.error;if(mr.error)throw mr.error;if(ar.error)throw ar.error;
      sellers=pr.data||[];monthly=mr.data||[];sellerTargets=new Map((tr.data||[]).map(x=>[x.user_id,x]));agency=ar.data||{fiscal_start_year:fy,ca_target:0,nc_target:0,upcross_target:0};loadedYear=fy;
      renderAgency();renderSectorSummary();renderSellerSummary();renderTargets();renderMonth();wire();
    }catch(e){const msg=document.getElementById('fstTargetMsg')||document.getElementById('fstMonthMsg');if(msg)msg.textContent='Erreur secteurs : '+(e?.message||e)}finally{busy=false}
  }

  function wire(){
    addStyle();ensureSectorCard();
    const saveT=document.getElementById('fstSaveTargets');if(saveT){saveT.dataset.sectorWired='1';saveT.onclick=saveTargets}
    const saveM=document.getElementById('fstSaveMonth');if(saveM){saveM.dataset.sectorMonthWired='1';saveM.onclick=saveMonth}
    const month=document.getElementById('fstMonth');if(month){month.dataset.sectorMonthWired='1';month.onchange=renderMonth}
    const tb=document.getElementById('fstTargetBody');if(tb&&!tb.dataset.sectorObserved){tb.dataset.sectorObserved='1';new MutationObserver(()=>{if(!tb.querySelector('tr[data-personal-target]'))renderTargets()}).observe(tb,{childList:true})}
    const sb=document.getElementById('fstSummaryBody');if(sb&&!sb.dataset.sectorObserved){sb.dataset.sectorObserved='1';new MutationObserver(()=>{if(!sb.querySelector('tr[data-personal-summary]'))renderSellerSummary()}).observe(sb,{childList:true})}
    const mb=document.getElementById('fstMonthBody');if(mb&&!mb.dataset.sectorObserved){mb.dataset.sectorObserved='1';new MutationObserver(()=>{if(!mb.querySelector('tr.fst-sector-month-row'))renderMonth()}).observe(mb,{childList:true})}
  }

  function boot(){if(!document.getElementById('rexFiscalSalesPage'))return false;wire();load();return true}
  document.addEventListener('click',e=>{
    if(e.target?.id==='fiscalSalesNav')setTimeout(()=>load(true),350);
    if(e.target?.id==='fstReload')setTimeout(()=>load(true),500);
  });
  document.addEventListener('change',e=>{if(e.target?.id==='fstYear'){loadedYear=null;setTimeout(()=>load(true),600)}});
  let tries=0;const t=setInterval(()=>{tries++;if(boot()||tries>120)clearInterval(t)},500);window.addEventListener('load',()=>setTimeout(boot,1500));
})();