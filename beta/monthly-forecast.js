(()=>{
  const euro=n=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:1}).format(Number(n||0))+' k€';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monthValue=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')};
  const monthStart=v=>`${v}-01`;
  const monthLabel=v=>{const [y,m]=v.split('-').map(Number);return new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1))};
  let selectedMonth=monthValue(new Date()),sellers=[],deals=[];

  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function getSb(){try{return sb}catch(e){return null}}

  function addStyle(){
    if(document.getElementById('monthlyForecastManualStyle'))return;
    const s=document.createElement('style');s.id='monthlyForecastManualStyle';s.textContent=`
      .mm-head{display:flex;justify-content:space-between;align-items:end;gap:14px;flex-wrap:wrap;margin-bottom:14px}.mm-head h2{margin:0;color:#0f172a}.mm-head p{margin:5px 0 0;color:#64748b;font-size:12px}.mm-month label{display:block;font-size:10px;font-weight:800;color:#64748b;margin-bottom:5px}.mm-month input{padding:10px 12px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}
      .mm-note{font-size:11px;color:#475569;background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:11px 13px;margin-bottom:14px;line-height:1.45}.mm-note b{color:#9a3412}
      .mm-agency{display:grid;grid-template-columns:repeat(4,minmax(140px,1fr));gap:10px;margin-bottom:14px}.mm-kpi{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:14px;box-shadow:0 10px 28px rgba(15,23,42,.05)}.mm-kpi span{display:block;font-size:11px;color:#64748b}.mm-kpi strong{display:block;margin-top:4px;font-size:24px;color:#17355f}
      .mm-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.mm-grid.seller-view{grid-template-columns:1fr}.mm-card{background:#fff;border:1px solid #e2e8f0;border-radius:17px;padding:16px;box-shadow:0 12px 30px rgba(15,23,42,.05);overflow:hidden}.mm-title{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-bottom:10px}.mm-title h3{margin:0;color:#17355f;font-size:17px}.mm-title span{font-size:11px;color:#64748b}
      .mm-wrap{overflow:auto}.mm-table{width:100%;border-collapse:collapse;font-size:12px;min-width:760px}.mm-table th,.mm-table td{padding:9px;border-bottom:1px solid #edf2f7;text-align:left;vertical-align:middle}.mm-table th{background:#f8fafc;color:#475569}.mm-empty{text-align:center;color:#64748b;padding:24px}.mm-del{border:0;background:#fff;color:#b42318;padding:5px 8px;cursor:pointer}
      .mm-form{margin-top:14px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px}.mm-form-grid{display:grid;grid-template-columns:2fr 1fr 1.15fr 1.15fr;gap:10px}.mm-field label{display:block;font-size:10px;font-weight:900;color:#64748b;margin:0 0 5px}.mm-field input,.mm-field select{width:100%;min-height:43px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff}.mm-form-row2{display:grid;grid-template-columns:1fr 1.2fr auto;gap:10px;margin-top:10px;align-items:end}.mm-check{min-height:43px;display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;font-size:12px}.mm-add{min-height:43px;background:#0f6b47;color:#fff;border:0;border-radius:9px;padding:9px 18px;font-weight:900;cursor:pointer}.mm-add:disabled{opacity:.6;cursor:wait}
      .mm-totals{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.mm-pill{font-size:11px;background:#f4f7fb;border:1px solid #d7e0eb;border-radius:999px;padding:6px 9px}
      .mm-status{font-size:11px;color:#64748b;margin-bottom:10px}
      @media(max-width:1100px){.mm-grid{grid-template-columns:1fr}.mm-agency{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:800px){.mm-form-grid{grid-template-columns:1fr 1fr}.mm-form-row2{grid-template-columns:1fr 1fr}.mm-add{grid-column:1/-1}.mm-agency{grid-template-columns:1fr 1fr}}
      @media(max-width:520px){.mm-form-grid,.mm-form-row2{grid-template-columns:1fr}.mm-agency{grid-template-columns:1fr}.mm-add{grid-column:auto}}
    `;document.head.appendChild(s);
  }

  function sums(list){let cl=0,nc=0,upcross=0,total=0;for(const d of list){const a=Number(d.amount||0);total+=a;if(d.client_type==='acquis')cl+=a;else if(d.client_type==='nouveau')nc+=a;if(d.sale_type==='up_sell'||d.sale_type==='cross_sell')upcross+=a}return{cl,nc,upcross,total}}

  function mount(){
    const page=document.querySelector('.rex-page[data-page="monthly"]');if(!page)return false;
    if(page.dataset.monthlyManualMounted==='1')return true;
    addStyle();page.dataset.monthlyManualMounted='1';page.dataset.monthlyMounted='1';
    page.innerHTML=`
      <div class="mm-head"><div><h2>Prévisionnel mois</h2><p>Prévision initiale saisie manuellement par le vendeur en début de mois.</p></div><div class="mm-month"><label>Mois</label><input id="mmMonth" type="month" value="${selectedMonth}"></div></div>
      <div class="mm-note"><b>Indépendant du prévisionnel semaine.</b> Pour le moment, les affaires saisies chaque semaine ne sont ni ajoutées ni cumulées ici. Ce prévisionnel correspond à la vision du vendeur au début du mois.</div>
      <div id="mmAgency" class="mm-agency"></div>
      <div id="mmStatus" class="mm-status">Chargement…</div>
      <div id="mmCards" class="mm-grid"></div>`;
    page.querySelector('#mmMonth').onchange=e=>{selectedMonth=e.target.value||monthValue(new Date());load()};
    return true;
  }

  async function load(){
    if(!mount())return;
    const client=getSb(),p=getProfile(),u=getUser(),st=document.getElementById('mmStatus');
    if(!client||!p||!u){if(st)st.textContent='Session non disponible.';return}
    if(st)st.textContent='Chargement du prévisionnel de '+monthLabel(selectedMonth)+'…';
    if(p.role==='admin'){
      const q=await client.from('profiles').select('user_id,display_name,role,sector_id').eq('role','seller').order('sector_id');
      if(q.error){if(st)st.textContent='Erreur vendeurs : '+q.error.message;return}sellers=q.data||[];
    }else sellers=[{user_id:u.id,display_name:p.display_name||u.email,role:'seller',sector_id:p.sector_id}];
    const q=await client.from('monthly_forecasts').select('*').eq('month_start',monthStart(selectedMonth)).order('created_at');
    if(q.error){if(st)st.textContent='Erreur : '+q.error.message;return}
    deals=q.data||[];render();
  }

  function render(){
    const p=getProfile(),all=sums(deals),agency=document.getElementById('mmAgency'),cards=document.getElementById('mmCards'),st=document.getElementById('mmStatus');
    if(!agency||!cards)return;
    agency.innerHTML=`<div class="mm-kpi"><span>${p?.role==='admin'?'Prévision CL agence':'Prévision CL'}</span><strong>${euro(all.cl)}</strong></div><div class="mm-kpi"><span>${p?.role==='admin'?'Prévision NC agence':'Prévision NC'}</span><strong>${euro(all.nc)}</strong></div><div class="mm-kpi"><span>${p?.role==='admin'?'Up / Cross agence':'Up / Cross'}</span><strong>${euro(all.upcross)}</strong></div><div class="mm-kpi"><span>${p?.role==='admin'?'Prévision totale agence':'Prévision totale'}</span><strong>${euro(all.total)}</strong></div>`;
    cards.classList.toggle('seller-view',p?.role!=='admin');
    if(st)st.textContent=`${deals.length} affaire${deals.length>1?'s':''} saisie${deals.length>1?'s':''} pour ${monthLabel(selectedMonth)}.`;
    cards.innerHTML=sellers.length?sellers.map(card).join(''):'<div class="mm-card mm-empty">Aucun vendeur attribué.</div>';
    cards.querySelectorAll('.mm-add').forEach(b=>b.onclick=()=>addDeal(b.dataset.uid,b));
    cards.querySelectorAll('.mm-del').forEach(b=>b.onclick=()=>delDeal(b.dataset.id));
  }

  function card(s){
    const list=deals.filter(d=>d.user_id===s.user_id),t=sums(list),id='mmf'+String(s.user_id).replaceAll('-','');
    const rows=list.length?list.map(d=>`<tr><td><b>${esc(d.company_name||'Entreprise')}</b></td><td>${euro(d.amount)}</td><td>${d.client_type==='nouveau'?'NC':'CL'}</td><td>${d.sale_type==='up_sell'?'Up-sell':d.sale_type==='cross_sell'?'Cross-sell':'Classique'}</td><td>${Number(d.probability||0)}%</td><td>${d.negotiation_meeting_scheduled?'✅':'—'}</td><td><button class="mm-del" data-id="${d.id}" title="Supprimer">✕</button></td></tr>`).join(''):'<tr><td colspan="7" class="mm-empty">Aucune affaire saisie pour ce mois.</td></tr>';
    return `<div class="mm-card"><div class="mm-title"><h3>${esc(s.display_name||'Vendeur')}</h3><span>Secteur ${esc(s.sector_id||'—')}</span></div><div class="mm-wrap"><table class="mm-table"><thead><tr><th>Entreprise</th><th>Montant</th><th>Client</th><th>Vente</th><th>Chance</th><th>RDV négo</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="mm-form" id="${id}"><div class="mm-form-grid"><div class="mm-field"><label>Entreprise</label><input class="company" placeholder="Nom de l’entreprise"></div><div class="mm-field"><label>Montant (k€)</label><input class="amount" type="number" min="0" step="0.1" placeholder="Ex. 12,5"></div><div class="mm-field"><label>Type de client</label><select class="client"><option value="acquis">Client acquis (CL)</option><option value="nouveau">Nouveau client (NC)</option></select></div><div class="mm-field"><label>Type de vente</label><select class="sale"><option value="classique">Classique</option><option value="up_sell">Up-sell</option><option value="cross_sell">Cross-sell</option></select></div></div><div class="mm-form-row2"><div class="mm-field"><label>Probabilité (%)</label><input class="prob" type="number" min="0" max="100" value="50"></div><label class="mm-check"><input class="rdv" type="checkbox"> RDV négociation prévu</label><button class="mm-add" data-uid="${s.user_id}">Ajouter au mois</button></div></div><div class="mm-totals"><span class="mm-pill">CL : <b>${euro(t.cl)}</b></span><span class="mm-pill">NC : <b>${euro(t.nc)}</b></span><span class="mm-pill">Up/Cross : <b>${euro(t.upcross)}</b></span><span class="mm-pill">Total : <b>${euro(t.total)}</b></span></div></div>`;
  }

  async function addDeal(uid,button){
    const client=getSb(),box=document.getElementById('mmf'+String(uid).replaceAll('-',''));if(!client||!box)return;
    const company=box.querySelector('.company').value.trim(),amount=Number(box.querySelector('.amount').value),prob=Number(box.querySelector('.prob').value);
    if(!company||!Number.isFinite(amount)||amount<=0||prob<0||prob>100){alert('Renseigne l’entreprise, un montant supérieur à 0 et une probabilité entre 0 et 100 %.');return}
    button.disabled=true;
    const row={user_id:uid,month_start:monthStart(selectedMonth),company_name:company,amount,client_type:box.querySelector('.client').value,sale_type:box.querySelector('.sale').value,probability:prob,negotiation_meeting_scheduled:box.querySelector('.rdv').checked};
    const r=await client.from('monthly_forecasts').insert(row);button.disabled=false;
    if(r.error){alert(r.error.message);return}await load();
  }

  async function delDeal(id){
    if(!confirm('Supprimer cette affaire du prévisionnel mensuel ?'))return;
    const client=getSb();if(!client)return;const r=await client.from('monthly_forecasts').delete().eq('id',id);if(r.error){alert(r.error.message);return}await load();
  }

  window.loadMonthlyForecast=load;
  let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>160)clearInterval(timer)},250);window.addEventListener('load',()=>setTimeout(mount,900));
})();