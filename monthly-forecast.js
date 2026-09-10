(()=>{
  const euro=n=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:1}).format(Number(n||0))+' k€';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monthValue=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')};
  const monthLabel=v=>{const [y,m]=v.split('-').map(Number);return new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1))};
  const rangeFor=v=>{const [y,m]=v.split('-').map(Number);const start=`${y}-${String(m).padStart(2,'0')}-01`;const next=m===12?`${y+1}-01-01`:`${y}-${String(m+1).padStart(2,'0')}-01`;return{start,next}};
  let selectedMonth=monthValue(new Date()), sellers=[], deals=[];

  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function getSb(){try{return sb}catch(e){return null}}

  function addStyle(){if(document.getElementById('monthlyForecastStyle'))return;const s=document.createElement('style');s.id='monthlyForecastStyle';s.textContent=`
    .mf-head{display:flex;justify-content:space-between;align-items:end;gap:14px;flex-wrap:wrap;margin-bottom:14px}.mf-head h2{margin:0;color:#0f172a}.mf-head p{margin:5px 0 0;color:#64748b;font-size:12px}.mf-month label{display:block;font-size:10px;font-weight:800;color:#64748b;margin-bottom:5px}.mf-month input{padding:9px 11px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}
    .mf-agency{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:10px;margin-bottom:14px}.mf-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;box-shadow:0 10px 28px rgba(15,23,42,.05)}.mf-kpi span{display:block;font-size:11px;color:#64748b}.mf-kpi strong{display:block;margin-top:4px;font-size:24px;color:#17355f}
    .mf-note{font-size:10px;color:#64748b;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:14px}.mf-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mf-card{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:14px;box-shadow:0 12px 30px rgba(15,23,42,.05);overflow:hidden}.mf-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.mf-title h3{margin:0;color:#17355f;font-size:16px}.mf-title span{font-size:11px;color:#64748b}.mf-totals{display:flex;flex-wrap:wrap;gap:7px;margin:0 0 10px}.mf-pill{font-size:11px;background:#f4f7fb;border:1px solid #d7e0eb;border-radius:999px;padding:6px 9px}.mf-wrap{overflow:auto}.mf-table{width:100%;border-collapse:collapse;font-size:11px;min-width:690px}.mf-table th,.mf-table td{padding:8px;border-bottom:1px solid #edf2f7;text-align:left;vertical-align:middle}.mf-table th{background:#f8fafc;color:#475569}.mf-week{white-space:nowrap;color:#64748b}.mf-empty{text-align:center;color:#64748b;padding:24px}.mf-badge{display:inline-block;border-radius:999px;padding:3px 7px;background:#eef2ff;color:#334155;font-weight:800;font-size:10px}
    @media(max-width:1100px){.mf-grid{grid-template-columns:1fr}.mf-agency{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.mf-agency{grid-template-columns:1fr 1fr}.mf-kpi strong{font-size:19px}}
  `;document.head.appendChild(s)}

  function sums(list){let cl=0,nc=0,upcross=0,total=0;for(const d of list){const a=Number(d.amount||0);total+=a;if(d.client_type==='acquis')cl+=a;else if(d.client_type==='nouveau')nc+=a;if(d.sale_type==='up_sell'||d.sale_type==='cross_sell')upcross+=a}return{cl,nc,upcross,total}}
  function fmtWeek(v){if(!v)return '—';const d=new Date(v+'T12:00:00');return 'Semaine du '+new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'2-digit'}).format(d)}

  function mount(){
    const page=document.querySelector('.rex-page[data-page="monthly"]');if(!page)return false;if(page.dataset.monthlyMounted==='1')return true;addStyle();page.dataset.monthlyMounted='1';
    page.innerHTML=`<div class="mf-head"><div><h2>Prévisions mensuelles</h2><p>Consolidation automatique des affaires saisies dans les prévisions semaine.</p></div><div class="mf-month"><label>Mois</label><input id="mfMonth" type="month" value="${selectedMonth}"></div></div><div id="mfAgency" class="mf-agency"></div><div class="mf-note">Le mensuel reprend les affaires dont la <b>semaine de prévision commence dans le mois sélectionné</b>. Aucune double saisie : une affaire ajoutée ou supprimée dans « Prévisions semaine » met automatiquement à jour le mensuel.</div><div id="mfStatus" style="font-size:11px;color:#64748b;margin-bottom:10px">Chargement…</div><div id="mfCards" class="mf-grid"></div>`;
    page.querySelector('#mfMonth').onchange=e=>{selectedMonth=e.target.value||monthValue(new Date());load()};
    return true;
  }

  async function load(){
    if(!mount())return;const client=getSb(),p=getProfile(),u=getUser();if(!client||!p||!u){const st=document.getElementById('mfStatus');if(st)st.textContent='Session non disponible.';return}
    const st=document.getElementById('mfStatus');if(st)st.textContent='Chargement des prévisions de '+monthLabel(selectedMonth)+'…';
    if(p.role==='admin'){
      const q=await client.from('profiles').select('user_id,display_name,role,sector_id').eq('role','seller').order('sector_id');
      if(q.error){if(st)st.textContent='Erreur vendeurs : '+q.error.message;return}sellers=q.data||[];
    }else sellers=[{user_id:u.id,display_name:p.display_name||u.email,role:'seller',sector_id:p.sector_id}];
    const {start,next}=rangeFor(selectedMonth);
    let q=client.from('weekly_forecasts').select('*').gte('week_start',start).lt('week_start',next).order('week_start').order('created_at');
    const r=await q;if(r.error){if(st)st.textContent='Erreur : '+r.error.message;return}deals=r.data||[];render();
  }

  function render(){
    const p=getProfile(),all=sums(deals),agency=document.getElementById('mfAgency'),cards=document.getElementById('mfCards'),st=document.getElementById('mfStatus');if(!agency||!cards)return;
    agency.innerHTML=`<div class="mf-kpi"><span>${p?.role==='admin'?'Prévision CL agence':'Prévision CL'}</span><strong>${euro(all.cl)}</strong></div><div class="mf-kpi"><span>${p?.role==='admin'?'Prévision NC agence':'Prévision NC'}</span><strong>${euro(all.nc)}</strong></div><div class="mf-kpi"><span>${p?.role==='admin'?'Up / Cross agence':'Up / Cross'}</span><strong>${euro(all.upcross)}</strong></div><div class="mf-kpi"><span>${p?.role==='admin'?'Prévision totale agence':'Prévision totale'}</span><strong>${euro(all.total)}</strong></div>`;
    if(st)st.textContent=`${deals.length} affaire${deals.length>1?'s':''} prévue${deals.length>1?'s':''} — ${monthLabel(selectedMonth)}.`;
    cards.innerHTML=sellers.length?sellers.map(card).join(''):'<div class="mf-card mf-empty">Aucun vendeur attribué.</div>';
  }

  function card(s){
    const list=deals.filter(d=>d.user_id===s.user_id),t=sums(list);
    const rows=list.length?list.map(d=>`<tr><td class="mf-week">${esc(fmtWeek(d.week_start))}</td><td><b>${esc(d.company_name||'Entreprise')}</b></td><td>${euro(d.amount)}</td><td><span class="mf-badge">${d.client_type==='nouveau'?'NC':'CL'}</span></td><td>${d.sale_type==='up_sell'?'Up-sell':d.sale_type==='cross_sell'?'Cross-sell':'Classique'}</td><td>${Number(d.probability||0)}%</td><td>${d.negotiation_meeting_scheduled?'✅':'—'}</td></tr>`).join(''):'<tr><td colspan="7" class="mf-empty">Aucune affaire prévue ce mois.</td></tr>';
    return `<div class="mf-card"><div class="mf-title"><h3>${esc(s.display_name||'Vendeur')}</h3><span>Secteur ${esc(s.sector_id||'—')}</span></div><div class="mf-totals"><span class="mf-pill">CL : <b>${euro(t.cl)}</b></span><span class="mf-pill">NC : <b>${euro(t.nc)}</b></span><span class="mf-pill">Up/Cross : <b>${euro(t.upcross)}</b></span><span class="mf-pill">Total : <b>${euro(t.total)}</b></span></div><div class="mf-wrap"><table class="mf-table"><thead><tr><th>Semaine</th><th>Entreprise</th><th>Montant</th><th>Client</th><th>Vente</th><th>Chance</th><th>RDV négo</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }

  window.loadMonthlyForecast=load;
  let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(timer)},250);window.addEventListener('load',()=>setTimeout(mount,900));
})();