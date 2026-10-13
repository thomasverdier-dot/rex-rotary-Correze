(()=>{
  const euro=n=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:1}).format(Number(n||0))+' k€';
  // La base conserve les k€ pour le calcul global ; les montants signés sont saisis en €.
  const signedEuros=n=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.round(Number(n||0)*100000)/100)+' €';
  const signedInput=d=>d.signed_amount_eur==null?'':Number(d.signed_amount_eur).toFixed(2);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const monthValue=d=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')};
  const monthStart=v=>`${v}-01`;
  const monthLabel=v=>{const [y,m]=v.split('-').map(Number);return new Intl.DateTimeFormat('fr-FR',{month:'long',year:'numeric'}).format(new Date(y,m-1,1))};
  let selectedMonth=monthValue(new Date()),sellers=[],deals=[];
  // Mémoriser les volets ouverts lors des actualisations (montant, signature, ajout...).
  const expandedSellers=new Set(),collapsedSellers=new Set();
  function sellerExpanded(uid){
    if(expandedSellers.has(uid))return true;
    if(collapsedSellers.has(uid))return false;
    return getProfile()?.role!=='admin'; // Administrateur : tout replié ; vendeur : son volet ouvert.
  }

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
      .mm-form{margin-top:14px;padding:14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px}.mm-form-grid{display:grid;grid-template-columns:2fr 1fr 1.15fr 1.15fr;gap:10px}.mm-field label{display:block;font-size:10px;font-weight:900;color:#64748b;margin:0 0 5px}.mm-field input,.mm-field select{width:100%;min-height:43px;padding:9px 10px;border:1px solid #cbd5e1;border-radius:9px;background:#fff} .mm-form-grid.nouveau-client{grid-template-columns:2fr 1fr 1.15fr}.mm-form-grid.nouveau-client .mm-sale-field{display:none!important}.mm-form-row2{display:grid;grid-template-columns:1fr 1.2fr auto;gap:10px;margin-top:10px;align-items:end}.mm-check{min-height:43px;display:flex;align-items:center;gap:8px;padding:9px 11px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;font-size:12px}.mm-add{min-height:43px;background:#0f6b47;color:#fff;border:0;border-radius:9px;padding:9px 18px;font-weight:900;cursor:pointer}.mm-add:disabled{opacity:.6;cursor:wait}
      .mm-totals{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.mm-pill{font-size:11px;background:#f4f7fb;border:1px solid #d7e0eb;border-radius:999px;padding:6px 9px}
      .mm-status{font-size:11px;color:#64748b;margin-bottom:10px}.mm-amount-edit{display:flex;align-items:center;gap:5px;white-space:nowrap}.mm-amount-unit{font-size:11px;color:#475569;font-weight:800;min-width:18px}.mm-amount-input{width:88px;min-width:70px;padding:7px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;font:inherit}.mm-amount-save{border:1px solid #b6d8c3;background:#e9f9ef;border-radius:8px;color:#166534;font-weight:800;padding:7px 9px;cursor:pointer}.mm-amount-save:disabled{opacity:.6;cursor:wait}.mm-table tr.mm-completed{background:#dcfce7!important}.mm-table tr.mm-completed td{border-color:#bbf7d0}.mm-complete-checkbox{width:18px;height:18px;accent-color:#15803d;cursor:pointer}.mm-sale-status{font-size:11px;color:#166534;font-weight:800}
      .mm-sign-panel{margin-top:10px;padding:11px;border:1px solid #86efac;border-radius:11px;background:#f0fdf4;min-width:206px}
      .mm-sign-panel[hidden]{display:none!important}
      .mm-sign-panel label{display:block;font-size:11px;font-weight:900;color:#166534;margin-bottom:7px}
      .mm-sign-panel small{display:block;color:#475569;font-size:10px;margin-top:7px;line-height:1.35}
      .mm-sign-amount{box-sizing:border-box;width:100%;padding:8px;border:1px solid #86bca4;border-radius:8px;background:#fff;font-size:13px}
      .mm-sign-save{width:100%;border:0;border-radius:8px;margin-top:7px;background:#15803d;color:white;font-weight:900;padding:9px;cursor:pointer}
      .mm-sign-save:disabled{opacity:.6;cursor:wait}
      .mm-sign-pending{background:#fffdf0!important}
      .mm-touched-info{font-size:10px;color:#047857;margin-top:5px;font-weight:800}
      .mm-date-signature{min-height:36px;padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;background:#fff;color:#1e293b;font:inherit}
      .mm-date-help{display:block;margin-top:5px;max-width:155px;color:#92400e;font-size:10px;line-height:1.3}
      .mm-saved-indicator{display:block;margin-top:4px;font-size:10px;color:#166534}
      @media(max-width:1100px){.mm-grid{grid-template-columns:1fr}.mm-agency{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:800px){.mm-form-grid{grid-template-columns:1fr 1fr}.mm-form-grid.nouveau-client{grid-template-columns:1fr 1fr}.mm-form-row2{grid-template-columns:1fr 1fr}.mm-add{grid-column:1/-1}.mm-agency{grid-template-columns:1fr 1fr}}
      @media(max-width:520px){.mm-form-grid,.mm-form-row2{grid-template-columns:1fr}.mm-form-grid.nouveau-client{grid-template-columns:1fr}.mm-agency{grid-template-columns:1fr}.mm-add{grid-column:auto}}
    `;document.head.appendChild(s);
  }

  function sums(list){let cl=0,nc=0,upcross=0,total=0;for(const d of list){const a=Number(d.amount||0);total+=a;if(d.client_type==='acquis')cl+=a;else if(d.client_type==='nouveau')nc+=a;if(d.client_type==='acquis'&&(d.sale_type==='up_sell'||d.sale_type==='cross_sell'))upcross+=a}return{cl,nc,upcross,total}}

  function syncSale(form){const isNew=form.querySelector('.client')?.value==='nouveau';form.querySelector('.mm-form-grid')?.classList.toggle('nouveau-client',isNew);const sale=form.querySelector('.sale');if(isNew&&sale)sale.value='classique'}

  function mount(){
    const page=document.querySelector('.rex-page[data-page="monthly"]');if(!page)return false;
    if(page.dataset.monthlyManualMounted==='1')return true;
    addStyle();page.dataset.monthlyManualMounted='1';page.dataset.monthlyMounted='1';
    page.innerHTML=`
      <div class="mm-head"><div><h2>Prévisionnel mois</h2><p>Prévisions mensuelles : ajoutez des affaires manuellement ou depuis les signatures et S+1.</p></div><div class="mm-month"><label>Mois</label><input id="mmMonth" type="month" value="${selectedMonth}"></div></div>
      <div class="mm-note"><b>Signatures de la semaine.</b> Le montant prévisionnel reste en k€, même après signature. Cochez « Vente réalisée » pour ouvrir un champ séparé « Montant exact signé (€) », à renseigner au centime. Le responsable et le commercial peuvent enregistrer ou corriger ce montant. La date de signature du lundi au vendredi permet sa remontée dans le Point du vendredi.</div>
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
    // Conserver l'état réel avant de reconstruire les lignes (ex. après enregistrement).
    cards.querySelectorAll('details.mm-seller-details').forEach(detail=>{
      if(detail.open){expandedSellers.add(detail.dataset.seller);collapsedSellers.delete(detail.dataset.seller)}
      else {collapsedSellers.add(detail.dataset.seller);expandedSellers.delete(detail.dataset.seller)}
    });
    cards.innerHTML=sellers.length?sellers.map(card).join(''):'<div class="mm-card mm-empty">Aucun vendeur attribué.</div>';
    cards.querySelectorAll('details.mm-seller-details').forEach(detail=>{
      detail.addEventListener('toggle',()=>{
        if(detail.open){expandedSellers.add(detail.dataset.seller);collapsedSellers.delete(detail.dataset.seller)}
        else {collapsedSellers.add(detail.dataset.seller);expandedSellers.delete(detail.dataset.seller)}
      });
    });
    cards.querySelectorAll('.mm-add').forEach(b=>b.onclick=()=>addDeal(b.dataset.uid,b));
    cards.querySelectorAll('.mm-del').forEach(b=>b.onclick=()=>delDeal(b.dataset.id));
    cards.querySelectorAll('.mm-amount-save').forEach(b=>b.onclick=()=>saveAmount(b.dataset.id,b));
    cards.querySelectorAll('.mm-amount-input').forEach(input=>input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();input.closest('td').querySelector('.mm-amount-save')?.click()}});
    cards.querySelectorAll('.mm-complete-checkbox').forEach(b=>b.onchange=()=>setCompleted(b.dataset.id,b.checked,b));
    cards.querySelectorAll('.mm-sign-save').forEach(b=>b.onclick=()=>saveExactSale(b.dataset.id,b));
    cards.querySelectorAll('.mm-sign-amount').forEach(input=>input.onkeydown=e=>{
      if(e.key==='Enter'){e.preventDefault();input.closest('.mm-sign-panel')?.querySelector('.mm-sign-save')?.click()}
    });
    cards.querySelectorAll('.mm-date-signature').forEach(input=>input.onchange=()=>changeSignatureDate(input.dataset.id,input));
    cards.querySelectorAll('.mm-form').forEach(form=>{form.querySelector('.client').addEventListener('change',()=>syncSale(form));syncSale(form)});
  }

  function card(s){
    const list=deals.filter(d=>d.user_id===s.user_id),t=sums(list),id='mmf'+String(s.user_id).replaceAll('-','');
    const rows=list.length?list.map(d=>`<tr class="${d.sale_completed?'mm-completed':''}"><td><b>${esc(d.company_name||'Entreprise')}</b></td><td><div class="mm-amount-edit"><input class="mm-amount-input" type="number" min="0.1" step="0.1" value="${Number(d.amount||0)}" data-id="${d.id}" aria-label="Prévision en k€ pour ${esc(d.company_name||'Entreprise')}"><span class="mm-amount-unit">k€</span><button type="button" class="mm-amount-save" data-id="${d.id}" title="Enregistrer la prévision en k€">Enregistrer</button></div></td><td>${d.client_type==='nouveau'?'NC':'CL'}</td><td>${d.client_type==='nouveau'?'—':d.sale_type==='up_sell'||d.sale_type==='cross_sell'?'UC':'RNV'}</td><td>${Number(d.probability||0)}%</td><td>${d.negotiation_meeting_scheduled?'✅':'—'}</td><td><input class="mm-date-signature" type="date" data-id="${d.id}" value="${esc(d.signature_date||'')}" aria-label="Date de signature de ${esc(d.company_name)}"><span class="mm-date-help">${d.sale_completed&&!d.signature_date?'Date requise pour intégrer aux signatures':''}</span></td><td><label class="mm-sale-status"><input class="mm-complete-checkbox" type="checkbox" data-id="${d.id}" ${d.sale_completed?'checked':''}> Vente réalisée</label><div class="mm-sign-panel" data-id="${d.id}" ${d.sale_completed?'':'hidden'}><label for="mmSign_${d.id}">Montant exact signé (€)</label><input id="mmSign_${d.id}" class="mm-sign-amount" data-id="${d.id}" type="text" inputmode="decimal" autocomplete="off" placeholder="Ex. 1 398,88" value="${esc(signedInput(d))}"><button type="button" class="mm-sign-save" data-id="${d.id}">${d.sale_completed?'Modifier le montant signé':'Enregistrer la vente'}</button><small>En euros, avec les centimes. La prévision en k€ ne change pas.</small></div></td><td><button class="mm-del" data-id="${d.id}" title="Supprimer">✕</button></td></tr>`).join(''):'<tr><td colspan="9" class="mm-empty">Aucune affaire saisie pour ce mois.</td></tr>';
    return `<details class="mm-card mm-seller-details" data-seller="${esc(s.user_id)}" ${sellerExpanded(s.user_id)?'open':''}><summary class="mm-title"><span class="mm-seller-name"><h3>${esc(s.display_name||'Vendeur')}</h3><span>Secteur ${esc(s.sector_id||'—')}</span></span><span class="mm-seller-overview"><span class="mm-seller-count">${list.length} affaire${list.length>1?'s':''}</span><strong class="mm-seller-total">${euro(t.total)}</strong><span class="mm-chevron" aria-hidden="true">⌄</span></span></summary><div class="mm-seller-content"><div class="mm-wrap"><table class="mm-table"><thead><tr><th>Entreprise</th><th>Prévision (k€)</th><th>Client</th><th>Vente</th><th>Chance</th><th>RDV négo</th><th>Date de signature</th><th>Signature</th><th></th></tr></thead><tbody>${rows}</tbody></table></div><div class="mm-form" id="${id}"><div class="mm-form-grid"><div class="mm-field"><label>Entreprise</label><input class="company" placeholder="Nom de l’entreprise"></div><div class="mm-field"><label>Montant (k€)</label><input class="amount" type="number" min="0" step="0.1" placeholder="Ex. 12,5"></div><div class="mm-field"><label>Type de client</label><select class="client"><option value="acquis">Client acquis (CL)</option><option value="nouveau">Nouveau client (NC)</option></select></div><div class="mm-field mm-sale-field"><label>Type de vente</label><select class="sale"><option value="classique">RNV (renouvellement)</option><option value="up_sell">UC (Up/Cross)</option></select></div></div><div class="mm-form-row2"><div class="mm-field"><label>Probabilité (%)</label><input class="prob" type="number" min="0" max="100" value="50"></div><label class="mm-check"><input class="rdv" type="checkbox"> RDV négociation prévu</label><button class="mm-add" data-uid="${s.user_id}">Ajouter au mois</button></div></div><div class="mm-totals"><span class="mm-pill">CL : <b>${euro(t.cl)}</b></span><span class="mm-pill">NC : <b>${euro(t.nc)}</b></span><span class="mm-pill">Up/Cross : <b>${euro(t.upcross)}</b></span><span class="mm-pill">Total : <b>${euro(t.total)}</b></span></div></div></details>`;
  }

  async function addDeal(uid,button){
    const client=getSb(),box=document.getElementById('mmf'+String(uid).replaceAll('-',''));if(!client||!box)return;
    const company=box.querySelector('.company').value.trim(),amount=Number(box.querySelector('.amount').value),prob=Number(box.querySelector('.prob').value);
    if(!company||!Number.isFinite(amount)||amount<=0||prob<0||prob>100){alert('Renseigne l’entreprise, un montant supérieur à 0 et une probabilité entre 0 et 100 %.');return}
    button.disabled=true;
    const row={user_id:uid,month_start:monthStart(selectedMonth),company_name:company,amount,client_type:box.querySelector('.client').value,sale_type:box.querySelector('.client').value==='nouveau'?'classique':box.querySelector('.sale').value,probability:prob,negotiation_meeting_scheduled:box.querySelector('.rdv').checked};
    const r=await client.from('monthly_forecasts').insert(row);button.disabled=false;
    if(r.error){alert(r.error.message);return}await load();
  }

  async function saveAmount(id,button){
    const client=getSb(),deal=deals.find(x=>x.id===id);
    if(!client||!ownDeal(deal))return;
    const input=button.closest('td')?.querySelector('.mm-amount-input');
    if(!input)return;
    const entered=Number(input.value);
    if(input.value.trim()===''||!Number.isFinite(entered)||entered<=0){
      alert('Saisis un montant prévisionnel supérieur à 0, en k€.');input.focus();return
    }
    button.disabled=true;input.disabled=true;
    // Le montant exact signé, stocké en euros, ne doit JAMAIS être modifié ici.
    const result=await client.from('monthly_forecasts')
      .update({amount:entered,updated_at:new Date().toISOString()})
      .eq('id',id).eq('user_id',deal.user_id).eq('month_start',deal.month_start)
      .select('id,amount').maybeSingle();
    button.disabled=false;input.disabled=false;
    if(result.error||!result.data){
      alert('Impossible de modifier la prévision : '+(result.error?.message||'Modification non confirmée.'));
      return;
    }
    deal.amount=Number(result.data.amount);
    render();
  }
  // La semaine commerciale commence lundi et s'acheve vendredi.
  function validSignatureDate(date){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return false;
    const day=new Date(date+'T12:00:00').getDay();
    return day>=1&&day<=5;
  }
  function ownDeal(deal){
    const p=getProfile(),u=getUser();
    return !!deal&&!!p&&!!u&&(p.role==='admin'||deal.user_id===u.id);
  }
  async function saveSignature(id,changes,refresh=true){
    const deal=deals.find(d=>d.id===id),client=getSb();
    if(!deal||!client||!ownDeal(deal))return {ok:false,message:'Modification non autorisée.'};
    const result=await client.from('monthly_forecasts')
      .update({...changes,updated_at:new Date().toISOString()})
      .eq('id',id).eq('user_id',deal.user_id).eq('month_start',deal.month_start)
      .select('id,sale_completed,signature_date,amount,signed_amount_eur').maybeSingle();
    if(result.error||!result.data)return {ok:false,message:result.error?.message||'Enregistrement non confirmé.'};
    Object.assign(deal,result.data);
    window.dispatchEvent(new Event('rex:monthly-sale-synced'));
    if(refresh)render();
    return {ok:true};
  }
  function readSignedEuros(raw){
    const normalized=String(raw||'').trim().replace(/[\s\u00a0\u202f]/g,'').replace(',','.');
    if(!/^\d+(?:\.\d{1,2})?$/.test(normalized))return null;
    const amount=Number(normalized);
    return Number.isFinite(amount)&&amount>0?Math.round(amount*100)/100:null;
  }
  async function saveExactSale(id,button){
    const deal=deals.find(d=>d.id===id);
    if(!ownDeal(deal))return;
    const row=button.closest('tr'),input=row?.querySelector('.mm-sign-amount');
    const dateField=row?.querySelector('.mm-date-signature');
    const check=row?.querySelector('.mm-complete-checkbox');
    if(!input||!check||!check.checked)return;
    const signedEuro=readSignedEuros(input.value);
    if(signedEuro===null){
      alert('Entre le montant exact en euros, avec 2 décimales maximum. Exemple : 1 398,88 €.');
      input.focus();return;
    }
    const date=dateField?.value||deal.signature_date||'';
    if(date&&!validSignatureDate(date)){
      alert('La date de signature doit être du lundi au vendredi.');dateField?.focus();return;
    }
    if(signedEuro>100000&&!confirm('Confirmer la vente de '+signedEuro.toLocaleString('fr-FR',{style:'currency',currency:'EUR'})+' ?'))return;
    button.disabled=true;input.disabled=true;
    // Aucun UPDATE du montant prévisionnel (amount en k€).
    const result=await saveSignature(id,{
      sale_completed:true,
      signed_amount_eur:signedEuro,
      signature_date:date||null
    });
    if(!result.ok){
      button.disabled=false;input.disabled=false;
      alert('Montant signé non enregistré : '+result.message);
    }
  }
  async function setCompleted(id,checked,checkbox){
    const deal=deals.find(d=>d.id===id);
    if(!ownDeal(deal)){checkbox.checked=!!deal?.sale_completed;return}
    const panel=checkbox.closest('td')?.querySelector('.mm-sign-panel');
    const row=checkbox.closest('tr');
    if(checked){
      // La coche affiche le formulaire. L'affaire n'est réellement validée
      // que lorsque le montant exact en euros est enregistré.
      if(panel)panel.hidden=false;
      row?.classList.add('mm-sign-pending');
      panel?.querySelector('.mm-sign-amount')?.focus();
      return;
    }
    if(!deal.sale_completed){
      if(panel)panel.hidden=true;
      row?.classList.remove('mm-sign-pending');
      return;
    }
    if(!confirm('Annuler cette vente réalisée ? Sa signature automatique sera retirée du Point du vendredi, sans changer la prévision mensuelle.')){
      checkbox.checked=true;return;
    }
    checkbox.disabled=true;
    const result=await saveSignature(id,{sale_completed:false,signed_amount_eur:null,signature_date:null});
    if(!result.ok){checkbox.checked=true;checkbox.disabled=false;alert('Impossible d’annuler la vente : '+result.message)}
  }
  async function changeSignatureDate(id,input){
    const deal=deals.find(d=>d.id===id);
    if(!ownDeal(deal)){input.value=deal?.signature_date||'';return}
    if(input.value&&!validSignatureDate(input.value)){
      alert('Les signatures doivent être datées du lundi au vendredi (hors week-end).');
      input.value=deal.signature_date||'';return;
    }
    if(!deal.sale_completed)return; // La date est enregistrée à la validation.
    if(!input.value){
      alert('Décoche « Vente réalisée » avant de retirer sa date de signature.');
      input.value=deal.signature_date||'';return;
    }
    input.disabled=true;
    const result=await saveSignature(id,{signature_date:input.value});
    if(!result.ok){input.value=deal.signature_date||'';input.disabled=false;alert('Date non enregistrée : '+result.message)}
  }
  async function delDeal(id){
    if(!confirm('Supprimer cette affaire du prévisionnel mensuel ?'))return;
    const client=getSb();if(!client)return;const r=await client.from('monthly_forecasts').delete().eq('id',id);if(r.error){alert(r.error.message);return}window.dispatchEvent(new Event('rex:monthly-sale-synced'));await load();
  }

  window.loadMonthlyForecast=load;
  let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>160)clearInterval(timer)},250);window.addEventListener('load',()=>setTimeout(mount,900));
})();