(()=>{
  let sellers=[],rows=[],week='',busy=false,lastSig='',lastLoad=0;
  const drafts=new Map();
  let monthStatuses=new Map(),monthStatusError='';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const euro=n=>new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(n||0))+' €';
  const eurosSigned=row=>row.signed_amount_eur===null||row.signed_amount_eur===undefined?Number(row.amount||0)*1000:Number(row.signed_amount_eur);
  function getSb(){try{return sb}catch(e){return null}}
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  function frDate(iso){if(!iso)return'';return new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}
  function addStyle(){
    if(document.getElementById('fridaySignedStyle'))return;
    const s=document.createElement('style');s.id='fridaySignedStyle';s.textContent=`
      .fps-box{margin-top:14px;padding:14px;border:1px solid #dfe6ee;border-radius:14px;background:#fff}.fps-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px}.fps-head h4{margin:0;color:#10233f;font-size:15px}.fps-date{font-size:10px;color:#64748b;font-weight:800}.fps-kpis{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.fps-pill{background:#ecfdf5;border:1px solid #bbf7d0;border-radius:999px;padding:6px 10px;font-size:10px;color:#166534}.fps-pill b{color:#14532d}.fps-form{display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin:10px 0 12px;padding:10px;background:#f8fafc;border-radius:12px}.fps-field label{display:block;font-size:9px;font-weight:800;color:#64748b;margin-bottom:4px}.fps-field input,.fps-field select{width:100%;box-sizing:border-box;padding:9px;border:1px solid #d7dee8;border-radius:9px;background:#fff}.fps-add{border:0;border-radius:9px;background:#15803d;color:#fff;padding:10px 14px;font-weight:900;cursor:pointer;white-space:nowrap}.fps-table{width:100%;border-collapse:collapse;font-size:11px}.fps-table th,.fps-table td{padding:9px 8px;border-bottom:1px solid #edf1f5;text-align:left}.fps-table th{font-size:9px;text-transform:uppercase;color:#64748b}.fps-del{border:0;background:#fee2e2;color:#991b1b;border-radius:7px;padding:6px 8px;font-weight:900;cursor:pointer}.fps-empty{padding:14px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b;font-size:11px;background:#f8fafc}.fps-form.is-new-client .fps-sale-field{display:none!important}.fps-month-link{display:inline-flex;align-items:center;gap:6px;white-space:nowrap;font-size:11px;font-weight:700;color:#334155}.fps-month-link input{width:16px;height:16px;accent-color:#0f6b47}.fps-month-link input:disabled{cursor:not-allowed}.fps-linked-info{font-size:10px;color:#0f6b47;white-space:nowrap;font-weight:700}.fps-msg{font-size:10px;color:#64748b;min-height:14px;margin-top:6px}@media(max-width:1000px){.fps-form{grid-template-columns:1fr 1fr}}@media(max-width:620px){.fps-form{grid-template-columns:1fr}.fps-table{font-size:10px}}
    `;document.head.appendChild(s);
  }
  function draftKey(uid){return week+'|'+uid}
  function readDraft(uid){return drafts.get(draftKey(uid))||{company:'',amount:'',clientType:'client',saleType:'classique'}}
  function saveDraft(uid,box){
    if(!uid||!box)return;
    drafts.set(draftKey(uid),{
      company:box.querySelector('.fps-company')?.value||'',
      amount:box.querySelector('.fps-amount')?.value||'',
      clientType:box.querySelector('.fps-client')?.value||'client',
      saleType:box.querySelector('.fps-sale')?.value||'classique'
    });
  }
  function saveAllDrafts(){
    document.querySelectorAll('.fps-form[id^="fpsf_"]').forEach(box=>{
      const btn=box.querySelector('.fps-add[data-uid]');if(btn)saveDraft(btn.dataset.uid,box);
    });
  }
  function isEditing(){return !!document.activeElement?.closest?.('.fps-form')}
  function hasDraft(){
    let dirty=false;
    document.querySelectorAll('.fps-form').forEach(box=>{
      if((box.querySelector('.fps-company')?.value||'').trim()||(box.querySelector('.fps-amount')?.value||'').trim())dirty=true;
    });
    return dirty;
  }
  async function load(){
    const client=getSb(),p=getProfile(),u=getUser(),w=document.getElementById('fpWeek')?.value||'';if(!client||!p||!u||!w)return;
    saveAllDrafts();week=w;
    if(p.role==='admin'){
      const q=await client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id');sellers=q.data||[];
    }else sellers=[{user_id:u.id,display_name:p.display_name||u.email,sector_id:p.sector_id}];
    const ids=sellers.map(s=>s.user_id);if(!ids.length){rows=[];render();return}
    const q=await client.from('friday_signed_deals').select('id,user_id,week_start,company_name,amount,signed_amount_eur,client_type,sale_type,signature_date,source_kind,monthly_forecast_id,created_at').eq('week_start',week).in('user_id',ids).order('created_at');
    rows=q.data||[];
    monthStatusError='';monthStatuses=new Map();
    try{
      if(!window.rexMonthlyMembership)throw Error('Chargement du module mensuel en cours');
      monthStatuses=await window.rexMonthlyMembership(rows,week,'signed');
    }catch(e){monthStatusError=e?.message||'Statut mensuel indisponible'}
    render();
  }
  function canEdit(uid){return isAdmin()||getUser()?.id===uid}
  function blockHtml(s){
    const list=rows.filter(r=>r.user_id===s.user_id);let cl=0,nc=0,total=0;
    list.forEach(r=>{const a=Number(eurosSigned(r))/1000;total+=a;if(r.client_type==='nouveau')nc+=a;else cl+=a});
    const editable=canEdit(s.user_id),id=s.user_id.replaceAll('-',''),d=readDraft(s.user_id);
    const form=editable?`<div class="fps-form" id="fpsf_${id}"><div class="fps-field"><label>Entreprise signée</label><input class="fps-company" placeholder="Nom de l'entreprise" value="${esc(d.company)}"></div><div class="fps-field"><label>Montant signé (€)</label><input class="fps-amount" type="number" min="0.01" step="0.01" placeholder="1398.88" value="${esc(d.amount)}"></div><div class="fps-field"><label>Type de client</label><select class="fps-client"><option value="client"${d.clientType==='client'?' selected':''}>Client acquis (CL)</option><option value="nouveau"${d.clientType==='nouveau'?' selected':''}>Nouveau client (NC)</option></select></div><div class="fps-field fps-sale-field"><label>Type de vente</label><select class="fps-sale"><option value="classique"${d.saleType==='classique'?' selected':''}>RNV (renouvellement)</option><option value="up_sell"${['up','cross','up_sell','cross_sell'].includes(d.saleType)?' selected':''}>UC (Up/Cross)</option></select></div><button class="fps-add" data-uid="${s.user_id}">+ Ajouter</button></div>`:'';
    const table=list.length?`<table class="fps-table"><thead><tr><th>Entreprise</th><th>Montant</th><th>Client</th><th>Vente</th><th>Date de signature</th><th>Prévisionnel mois</th>${editable?'<th></th>':''}</tr></thead><tbody>${list.map(r=>`<tr><td><b>${esc(r.company_name)}</b></td><td>${euro(eurosSigned(r))}</td><td>${r.client_type==='nouveau'?'NC':'CL'}</td><td>${r.client_type==='nouveau'?'—':['up','cross','up_sell','cross_sell'].includes(r.sale_type)?'UC':'RNV'}</td><td>${r.signature_date?frDate(r.signature_date):'—'}</td><td><label class="fps-month-link" title="${esc(monthStatuses.get(r.id)?.message||monthStatusError)}"><input type="checkbox" class="fps-to-month" data-id="${r.id}" ${r.source_kind==='monthly'||monthStatuses.get(r.id)?.checked?'checked':''} ${(!editable||r.source_kind==='monthly'||monthStatuses.get(r.id)?.locked||monthStatusError)?'disabled':''}> ${r.source_kind==='monthly'?'Depuis le mois':'Intégrer au mois'}</label></td>${editable?`<td>${r.source_kind==='monthly'?'<span class="fps-linked-info">Modifiable dans Prévisionnel mois</span>':`<button class="fps-del" data-id="${r.id}">Supprimer</button>`}</td>`:''}</tr>`).join('')}</tbody></table>`:`<div class="fps-empty">Aucune affaire signée renseignée pour cette semaine.</div>`;
    return `<div class="fps-box" data-fps="${s.user_id}"><div class="fps-head"><div><h4>✅ Affaires signées cette semaine</h4><div class="fps-date">Semaine du ${frDate(week)}</div></div></div><div class="fps-kpis"><span class="fps-pill">CL <b>${euro(cl*1000)}</b></span><span class="fps-pill">NC <b>${euro(nc*1000)}</b></span><span class="fps-pill">Total signé <b>${euro(total*1000)}</b></span><span class="fps-pill"><b>${list.length}</b> affaire${list.length>1?'s':''}</span></div>${form}${table}<div class="fps-msg">${esc(monthStatusError)}</div></div>`;
  }
  function render(){
    saveAllDrafts();addStyle();const cards=[...document.querySelectorAll('#fpCards .fp-seller')];if(!cards.length)return;
    cards.forEach((card,i)=>{
      const s=sellers[i];if(!s)return;card.querySelector('[data-fps]')?.remove();
      const next=card.querySelector('.fp-nextweek');
      if(next)next.insertAdjacentHTML('beforebegin',blockHtml(s));
      else {const anchor=card.querySelector('.fp-form')||card.querySelector('[data-fpc]')||card.querySelector('[data-fpa]')||card.querySelector('.fp-analysis');if(anchor)anchor.insertAdjacentHTML('afterend',blockHtml(s));else card.querySelector('.fp-body')?.insertAdjacentHTML('beforeend',blockHtml(s));}
    });
    document.querySelectorAll('.fps-add').forEach(b=>b.onclick=()=>addDeal(b.dataset.uid));
    document.querySelectorAll('.fps-del').forEach(b=>b.onclick=()=>deleteDeal(b.dataset.id));
    document.querySelectorAll('.fps-to-month').forEach(b=>b.onchange=()=>promoteSigned(b.dataset.id,b));
    document.querySelectorAll('.fps-form').forEach(box=>{
      const uid=box.querySelector('.fps-add[data-uid]')?.dataset.uid;if(!uid)return;
      const syncClient=()=>{const isNew=box.querySelector('.fps-client')?.value==='nouveau';box.classList.toggle('is-new-client',isNew);if(isNew)box.querySelector('.fps-sale').value='classique'};
      box.querySelectorAll('input,select').forEach(el=>{el.addEventListener('input',()=>saveDraft(uid,box));el.addEventListener('change',()=>{syncClient();saveDraft(uid,box)})});
      syncClient();
    });
  }
  async function promoteSigned(recordId,checkbox){
    const row=rows.find(x=>x.id===recordId);
    const previous=monthStatuses.get(recordId)?.checked||false;
    if(!row||!canEdit(row.user_id)||!window.rexSetMonthlyMembership){checkbox.checked=previous;return}
    checkbox.disabled=true;
    let result;
    try{result=await window.rexSetMonthlyMembership(row,row.week_start,'signed',checkbox.checked)}
    catch(e){result={ok:false,message:String(e?.message||e)}}
    const msg=checkbox.closest('.fps-box')?.querySelector('.fps-msg');
    if(msg)msg.textContent=result.message||'';
    if(result.ok){
      monthStatuses.set(recordId,{checked:!!result.checked,locked:!!result.locked,message:result.locked?result.message:''});
    }
    checkbox.checked=result.ok?!!result.checked:previous;
    checkbox.disabled=!!monthStatuses.get(recordId)?.locked||!!monthStatusError;
  }
  async function addDeal(uid){
    const box=document.getElementById('fpsf_'+uid.replaceAll('-','')),client=getSb();if(!box||!client)return;
    const company=box.querySelector('.fps-company')?.value.trim()||'',enteredEuros=Number(box.querySelector('.fps-amount')?.value||0),signedAmountEuros=Math.round(enteredEuros*100)/100,clientType=box.querySelector('.fps-client')?.value||'client',saleType=clientType==='nouveau'?'classique':box.querySelector('.fps-sale')?.value||'classique';
    if(!company){alert("Renseigne le nom de l'entreprise signée.");return}if(!Number.isFinite(enteredEuros)||enteredEuros<=0||Math.abs(enteredEuros*100-Math.round(enteredEuros*100))>0.00001){alert('Renseigne un montant en euros, au centime près.');return}
    const r=await client.from('friday_signed_deals').insert({user_id:uid,week_start:week,company_name:company,signed_amount_eur:signedAmountEuros,client_type:clientType,sale_type:saleType,updated_at:new Date().toISOString()}).select().single();
    if(r.error){alert(r.error.message);return}rows.push(r.data);drafts.delete(draftKey(uid));render();
  }
  async function deleteDeal(id){
    if(!confirm('Supprimer cette affaire signée ?'))return;const client=getSb();if(!client)return;const r=await client.from('friday_signed_deals').delete().eq('id',id);if(r.error){alert(r.error.message);return}rows=rows.filter(x=>x.id!==id);render();
  }
  async function tick(){
    if(!document.getElementById('rexFridayPage'))return;
    const w=document.getElementById('fpWeek')?.value||'',cards=document.querySelectorAll('#fpCards .fp-seller').length,role=getProfile()?.role||'',sig=w+'|'+cards+'|'+role;
    const structuralChange=sig!==lastSig||!document.querySelector('[data-fps]');
    if(isEditing()||hasDraft())return;
    if(!busy&&(structuralChange||(document.getElementById('rexFridayPage')?.classList.contains('active')&&Date.now()-lastLoad>30000))){busy=true;try{await load();lastSig=sig;lastLoad=Date.now()}finally{busy=false}}
  }
  window.addEventListener('rex:monthly-sale-synced',()=>{lastSig='';setTimeout(tick,100)});
  setInterval(tick,1000);window.addEventListener('load',()=>setTimeout(tick,1900));
})();