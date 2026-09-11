(()=>{
  const MONTHS=['Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre','Janvier','Février','Mars'];
  let sellers=[],sellerTargets=new Map(),monthly=new Map(),agencyTarget={ca_target:0,nc_target:0,upcross_target:0},loadedYear=null,busy=false;

  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function getSb(){try{return sb}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function num(v){const n=Number(String(v??'').replace(',','.'));return Number.isFinite(n)&&n>=0?n:0}
  function fmt(v){return num(v).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2})}
  function currentFY(){const d=new Date();return d.getMonth()>=3?d.getFullYear():d.getFullYear()-1}
  function currentMonthIndex(){const m=new Date().getMonth();return m>=3?m-2:m+10}
  function fyLabel(y){return `FY${String(y).slice(-2)}-${String(y+1).slice(-2)}`}
  function key(uid,mi){return `${uid}|${mi}`}
  function sumRows(rows,field){return rows.reduce((a,r)=>a+num(r[field]),0)}
  function sellerRows(uid){return [...monthly.values()].filter(r=>r.user_id===uid)}
  function remain(target,done){return Math.max(0,num(target)-num(done))}
  function pct(done,target){return num(target)>0?Math.round(num(done)/num(target)*100):0}

  function addStyle(){
    if(document.getElementById('fiscalSalesStyle'))return;
    const s=document.createElement('style');s.id='fiscalSalesStyle';s.textContent=`
      .fst-toolbar{display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:14px}.fst-field label{display:block;font-size:10px;font-weight:900;color:#64748b;margin:0 0 5px}.fst-field select,.fst-field input{padding:10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;box-sizing:border-box}.fst-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(15,23,42,.055);margin-bottom:14px}.fst-card h3{margin:0 0 4px;color:#10233f;font-size:17px}.fst-sub{font-size:10px;color:#64748b;margin-bottom:12px}.fst-btn{border:0;border-radius:9px;padding:10px 14px;font-weight:900;cursor:pointer}.fst-primary{background:#10233f;color:#fff}.fst-save{background:#d71920;color:#fff}.fst-table-wrap{overflow:auto}.fst-table{width:100%;border-collapse:collapse;min-width:760px;font-size:11px}.fst-table th,.fst-table td{padding:8px;border-bottom:1px solid #edf2f7;text-align:right;vertical-align:middle}.fst-table th{background:#f8fafc;color:#475569;font-weight:900}.fst-table th:first-child,.fst-table td:first-child{text-align:left}.fst-table input{width:92px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;text-align:right}.fst-agency-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:10px 0 0}.fst-kpi{border:1px solid #e2e8f0;border-radius:14px;padding:12px;background:#f8fafc}.fst-kpi b{display:block;color:#10233f;font-size:12px;margin-bottom:5px}.fst-kpi strong{font-size:23px;color:#10233f}.fst-kpi small{display:block;margin-top:5px;color:#64748b}.fst-bar{height:7px;background:#e2e8f0;border-radius:99px;overflow:hidden;margin-top:8px}.fst-bar i{display:block;height:100%;background:#16a34a;border-radius:99px}.fst-remain{font-weight:900;color:#b45309}.fst-ok{font-weight:900;color:#166534}.fst-details{border:1px solid #e2e8f0;border-radius:14px;padding:11px;margin-top:10px}.fst-details summary{cursor:pointer;font-weight:900;color:#10233f}.fst-msg{font-size:10px;color:#64748b;min-height:14px;margin-top:8px}.fst-badge{display:inline-block;padding:4px 7px;border-radius:999px;background:#eff6ff;color:#0e2f68;font-weight:900;font-size:9px}@media(max-width:850px){.fst-agency-grid{grid-template-columns:1fr}.fst-toolbar{align-items:stretch}.fst-field{flex:1 1 180px}.fst-field select,.fst-field input{width:100%}}
    `;document.head.appendChild(s)
  }

  function switchTo(){
    document.querySelectorAll('.rex-page').forEach(p=>p.classList.toggle('active',p.dataset.page==='fiscal-sales'));
    document.querySelectorAll('.rex-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='fiscal-sales'));
    const y=Number(document.getElementById('fstYear')?.value||currentFY());load(y);
  }

  function mount(){
    if(!isAdmin())return false;
    const shell=document.getElementById('rexShellV3'),nav=shell?.querySelector('.rex-nav'),content=shell?.querySelector('.rex-content');
    if(!shell||!nav||!content)return false;
    if(document.getElementById('rexFiscalSalesPage'))return true;
    addStyle();
    const btn=document.createElement('button');btn.dataset.page='fiscal-sales';btn.id='fiscalSalesNav';btn.innerHTML='💶 Suivi CA fiscal';btn.onclick=switchTo;
    const ticket=document.getElementById('ticketNavBtn');nav.insertBefore(btn,ticket||null);
    const fy=currentFY();
    const years=[fy-2,fy-1,fy,fy+1];
    const page=document.createElement('section');page.className='rex-page';page.dataset.page='fiscal-sales';page.id='rexFiscalSalesPage';page.innerHTML=`
      <div class="rex-page-head"><div><h2>Suivi CA fiscal</h2><p>Suivi mensuel du 1er avril au 31 mars — montants en k€.</p></div></div>
      <div class="fst-toolbar">
        <div class="fst-field"><label>Exercice fiscal</label><select id="fstYear">${years.map(y=>`<option value="${y}" ${y===fy?'selected':''}>${fyLabel(y)} · avril ${y} → mars ${y+1}</option>`).join('')}</select></div>
        <button id="fstReload" class="fst-btn fst-primary" type="button">Actualiser</button>
        <span class="fst-badge">Objectifs + réalisé + reste à faire</span>
      </div>

      <div class="fst-card">
        <h3>🏢 Agence</h3><div class="fst-sub">Cumul de tous les vendeurs sur l’exercice sélectionné.</div>
        <div id="fstAgencyKpis" class="fst-agency-grid"></div>
      </div>

      <div class="fst-card">
        <h3>🗓️ Saisie mensuelle</h3><div class="fst-sub">Choisis le mois puis saisis CA, NC et UP/CROSS pour chaque vendeur.</div>
        <div class="fst-toolbar"><div class="fst-field"><label>Mois</label><select id="fstMonth">${MONTHS.map((m,i)=>`<option value="${i+1}">${m}</option>`).join('')}</select></div><button id="fstSaveMonth" class="fst-btn fst-save" type="button">Enregistrer le mois</button></div>
        <div class="fst-table-wrap"><table class="fst-table"><thead><tr><th>Vendeur</th><th>CA</th><th>NC</th><th>UP/CROSS</th></tr></thead><tbody id="fstMonthBody"></tbody></table></div>
        <div id="fstMonthMsg" class="fst-msg"></div>
      </div>

      <div class="fst-card">
        <h3>🎯 Récapitulatif par vendeur</h3><div class="fst-sub">Le reste à faire se recalcule automatiquement après chaque saisie.</div>
        <div class="fst-table-wrap"><table class="fst-table"><thead><tr><th rowspan="2">Vendeur</th><th colspan="4">CA</th><th colspan="4">NC</th><th colspan="4">UP/CROSS</th></tr><tr><th>Réalisé</th><th>Objectif</th><th>Reste</th><th>%</th><th>Réalisé</th><th>Objectif</th><th>Reste</th><th>%</th><th>Réalisé</th><th>Objectif</th><th>Reste</th><th>%</th></tr></thead><tbody id="fstSummaryBody"></tbody></table></div>
      </div>

      <div class="fst-card">
        <details class="fst-details" id="fstTargetsDetails"><summary>⚙️ Modifier les objectifs de l’exercice</summary>
          <div class="fst-sub" style="margin-top:10px">L’objectif agence peut être différent de la somme des objectifs vendeurs, comme dans ton fichier Excel.</div>
          <div class="fst-table-wrap"><table class="fst-table"><thead><tr><th>Objectif</th><th>CA</th><th>NC</th><th>UP/CROSS</th></tr></thead><tbody id="fstTargetBody"></tbody></table></div>
          <button id="fstSaveTargets" class="fst-btn fst-save" type="button" style="margin-top:10px">Enregistrer les objectifs</button><div id="fstTargetMsg" class="fst-msg"></div>
        </details>
      </div>`;
    content.appendChild(page);
    page.querySelector('#fstYear').onchange=()=>{loadedYear=null;load(Number(page.querySelector('#fstYear').value),true)};
    page.querySelector('#fstReload').onclick=()=>load(Number(page.querySelector('#fstYear').value),true);
    page.querySelector('#fstMonth').onchange=renderMonth;
    page.querySelector('#fstSaveMonth').onclick=saveMonth;
    page.querySelector('#fstSaveTargets').onclick=saveTargets;
    page.querySelector('#fstMonth').value=String(currentMonthIndex());
    return true;
  }

  async function load(year,force=false){
    if(!isAdmin()||busy||(!force&&loadedYear===year))return;
    const client=getSb();if(!client)return;busy=true;setMsg('fstMonthMsg','Chargement…');
    try{
      const [pr,ar,tr,mr]=await Promise.all([
        client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id'),
        client.from('agency_sales_targets').select('*').eq('fiscal_start_year',year).maybeSingle(),
        client.from('seller_sales_targets').select('*').eq('fiscal_start_year',year),
        client.from('seller_monthly_sales').select('*').eq('fiscal_start_year',year)
      ]);
      if(pr.error)throw pr.error;if(ar.error)throw ar.error;if(tr.error)throw tr.error;if(mr.error)throw mr.error;
      sellers=pr.data||[];agencyTarget=ar.data||{fiscal_start_year:year,ca_target:0,nc_target:0,upcross_target:0};
      sellerTargets=new Map((tr.data||[]).map(x=>[x.user_id,x]));monthly=new Map((mr.data||[]).map(x=>[key(x.user_id,x.month_index),x]));loadedYear=year;
      renderAll();setMsg('fstMonthMsg','');
    }catch(e){setMsg('fstMonthMsg','Erreur : '+(e?.message||e))}finally{busy=false}
  }

  function renderAll(){renderAgency();renderMonth();renderSummary();renderTargets()}

  function agencyTotals(){const rows=[...monthly.values()];return{ca:sumRows(rows,'ca'),nc:sumRows(rows,'nc'),upcross:sumRows(rows,'upcross')}}
  function sellerTotals(uid){const rows=sellerRows(uid);return{ca:sumRows(rows,'ca'),nc:sumRows(rows,'nc'),upcross:sumRows(rows,'upcross')}}

  function kpiHtml(label,done,target){const p=pct(done,target),r=remain(target,done);return `<div class="fst-kpi"><b>${label}</b><strong>${fmt(done)} / ${fmt(target)}</strong><small>Reste à faire : <span class="${r===0?'fst-ok':'fst-remain'}">${fmt(r)}</span> · ${p}% atteint</small><div class="fst-bar"><i style="width:${Math.min(100,p)}%"></i></div></div>`}
  function renderAgency(){const el=document.getElementById('fstAgencyKpis');if(!el)return;const t=agencyTotals();el.innerHTML=kpiHtml('CA',t.ca,agencyTarget.ca_target)+kpiHtml('NC',t.nc,agencyTarget.nc_target)+kpiHtml('UP/CROSS',t.upcross,agencyTarget.upcross_target)}

  function renderMonth(){
    const body=document.getElementById('fstMonthBody'),sel=document.getElementById('fstMonth');if(!body||!sel)return;const mi=Number(sel.value||1);
    body.innerHTML=sellers.map(s=>{const r=monthly.get(key(s.user_id,mi))||{};return `<tr data-user="${s.user_id}"><td><b>${esc(s.display_name||'Vendeur')}</b>${s.sector_id?`<br><span style="color:#64748b">Secteur ${esc(s.sector_id)}</span>`:''}</td><td><input data-field="ca" inputmode="decimal" value="${esc(fmt(r.ca||0))}"></td><td><input data-field="nc" inputmode="decimal" value="${esc(fmt(r.nc||0))}"></td><td><input data-field="upcross" inputmode="decimal" value="${esc(fmt(r.upcross||0))}"></td></tr>`}).join('')||'<tr><td colspan="4">Aucun vendeur.</td></tr>';
  }

  function metricCells(done,target){const r=remain(target,done),p=pct(done,target);return `<td>${fmt(done)}</td><td>${fmt(target)}</td><td class="${r===0?'fst-ok':'fst-remain'}">${fmt(r)}</td><td>${p}%</td>`}
  function renderSummary(){const body=document.getElementById('fstSummaryBody');if(!body)return;body.innerHTML=sellers.map(s=>{const d=sellerTotals(s.user_id),t=sellerTargets.get(s.user_id)||{};return `<tr><td><b>${esc(s.display_name||'Vendeur')}</b>${s.sector_id?`<br><span style="color:#64748b">S${esc(s.sector_id)}</span>`:''}</td>${metricCells(d.ca,t.ca_target)}${metricCells(d.nc,t.nc_target)}${metricCells(d.upcross,t.upcross_target)}</tr>`}).join('')||'<tr><td colspan="13">Aucun vendeur.</td></tr>'}

  function renderTargets(){
    const body=document.getElementById('fstTargetBody');if(!body)return;
    const agency=`<tr data-agency="1"><td><b>Agence</b></td><td><input data-field="ca_target" inputmode="decimal" value="${esc(fmt(agencyTarget.ca_target))}"></td><td><input data-field="nc_target" inputmode="decimal" value="${esc(fmt(agencyTarget.nc_target))}"></td><td><input data-field="upcross_target" inputmode="decimal" value="${esc(fmt(agencyTarget.upcross_target))}"></td></tr>`;
    const sellerRowsHtml=sellers.map(s=>{const t=sellerTargets.get(s.user_id)||{};return `<tr data-user="${s.user_id}"><td>${esc(s.display_name||'Vendeur')}</td><td><input data-field="ca_target" inputmode="decimal" value="${esc(fmt(t.ca_target||0))}"></td><td><input data-field="nc_target" inputmode="decimal" value="${esc(fmt(t.nc_target||0))}"></td><td><input data-field="upcross_target" inputmode="decimal" value="${esc(fmt(t.upcross_target||0))}"></td></tr>`}).join('');
    body.innerHTML=agency+sellerRowsHtml;
  }

  async function saveMonth(){
    const client=getSb(),u=getUser(),year=Number(document.getElementById('fstYear')?.value||currentFY()),mi=Number(document.getElementById('fstMonth')?.value||1),body=document.getElementById('fstMonthBody');if(!client||!u||!body)return;
    const rows=[...body.querySelectorAll('tr[data-user]')].map(tr=>{const val=f=>num(tr.querySelector(`[data-field="${f}"]`)?.value);return{fiscal_start_year:year,user_id:tr.dataset.user,month_index:mi,ca:val('ca'),nc:val('nc'),upcross:val('upcross'),updated_at:new Date().toISOString(),updated_by:u.id}});
    if(!rows.length)return;setMsg('fstMonthMsg','Enregistrement…');
    const r=await client.from('seller_monthly_sales').upsert(rows,{onConflict:'fiscal_start_year,user_id,month_index'});if(r.error){setMsg('fstMonthMsg','Erreur : '+r.error.message);return}
    rows.forEach(x=>monthly.set(key(x.user_id,x.month_index),x));renderAgency();renderSummary();setMsg('fstMonthMsg',`${MONTHS[mi-1]} enregistré.`)
  }

  async function saveTargets(){
    const client=getSb(),u=getUser(),year=Number(document.getElementById('fstYear')?.value||currentFY()),body=document.getElementById('fstTargetBody');if(!client||!u||!body)return;
    const ar=body.querySelector('tr[data-agency]'),val=(tr,f)=>num(tr?.querySelector(`[data-field="${f}"]`)?.value);
    const agency={fiscal_start_year:year,ca_target:val(ar,'ca_target'),nc_target:val(ar,'nc_target'),upcross_target:val(ar,'upcross_target'),updated_at:new Date().toISOString(),updated_by:u.id};
    const sellerRows=[...body.querySelectorAll('tr[data-user]')].map(tr=>({fiscal_start_year:year,user_id:tr.dataset.user,ca_target:val(tr,'ca_target'),nc_target:val(tr,'nc_target'),upcross_target:val(tr,'upcross_target'),updated_at:new Date().toISOString(),updated_by:u.id}));
    setMsg('fstTargetMsg','Enregistrement…');
    const a=await client.from('agency_sales_targets').upsert(agency,{onConflict:'fiscal_start_year'});if(a.error){setMsg('fstTargetMsg','Erreur : '+a.error.message);return}
    if(sellerRows.length){const s=await client.from('seller_sales_targets').upsert(sellerRows,{onConflict:'fiscal_start_year,user_id'});if(s.error){setMsg('fstTargetMsg','Erreur : '+s.error.message);return}}
    agencyTarget=agency;sellerRows.forEach(x=>sellerTargets.set(x.user_id,x));renderAgency();renderSummary();setMsg('fstTargetMsg','Objectifs enregistrés.')
  }

  function setMsg(id,text){const el=document.getElementById(id);if(el)el.textContent=text||''}

  let tries=0;const t=setInterval(()=>{tries++;if(mount()){load(currentFY());clearInterval(t)}else if(tries>120)clearInterval(t)},500);
  window.addEventListener('load',()=>setTimeout(()=>{if(mount())load(currentFY())},1200));
})();