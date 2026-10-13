/* Previsions S+1 directement dans la fiche du Point vendredi. */
(()=>{
 const ROOT='#fpCards > .fp-seller', TABLE='weekly_forecasts';
 let busy=false,lastKey='',refreshAt=0;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const db=()=>{try{return sb}catch(e){return null}};
 const profileData=()=>{try{return profile||currentProfile||null}catch(e){return null}};
 const currentUid=()=>{try{return user?.id||currentUser?.id||''}catch(e){return ''}};
 const nextDate=()=>{const w=document.getElementById('fpWeek')?.value;if(!w)return'';const d=new Date(w+'T12:00:00');d.setDate(d.getDate()+7);return d.toISOString().slice(0,10)};
 const uid=card=>card.querySelector('.fp-manager[id^="fpm_"]')?.id.slice(4)||card.querySelector('.fp-form .fp-main-save')?.dataset.uid||card.querySelector('[data-fpc]')?.dataset.fpc||card.querySelector('[data-fpa]')?.dataset.fpa||'';
 const euro=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(v||0))+' k€';
 let items=new Map(),editing=new Map();
 function style(){if(document.getElementById('fridayForecastEditorStyle'))return;const s=document.createElement('style');s.id='fridayForecastEditorStyle';s.textContent=`
  #rexFridayPage .fp-nextweek{display:none!important}
  #rexFridayPage .fp-nextweek-editor{margin-top:10px;padding:15px;background:#f8fafc;border:1px solid #dbe5f1;border-radius:13px}
  #rexFridayPage .fp-nextweek-editor h4{font-size:16px;margin:0 0 6px;color:#10233f}
  #rexFridayPage .fp-edit-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr 1fr;gap:9px;align-items:end;margin-top:13px}
  #rexFridayPage .fp-edit-field{display:flex;flex-direction:column;gap:5px;font-size:11px;font-weight:800;color:#475569}
  #rexFridayPage .fp-edit-field input,#rexFridayPage .fp-edit-field select{min-width:0;min-height:40px;padding:8px;border:1px solid #cbd5e1;border-radius:8px;background:white;font-size:12px;width:100%;box-sizing:border-box}
  #rexFridayPage .fp-edit-new .fp-edit-sale{display:none}
  #rexFridayPage .fp-edit-footer{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px}
  #rexFridayPage .fp-edit-save{border:0;border-radius:9px;background:#0f6b47;color:#fff;padding:11px 15px;font-weight:800}
  #rexFridayPage .fp-edit-cancel{border:1px solid #cbd5e1;border-radius:9px;background:white;padding:10px}
  #rexFridayPage .fp-edit-status{font-size:11px;color:#64748b}
  #rexFridayPage .fp-edit-status.error{color:#b42318}
  #rexFridayPage .fp-edit-wrap{overflow:auto;margin-top:12px}
  #rexFridayPage .fp-edit-table{width:100%;border-collapse:collapse;font-size:12px;min-width:710px}
  #rexFridayPage .fp-edit-table td,#rexFridayPage .fp-edit-table th{padding:9px 8px;border-bottom:1px solid #e2e8f0;text-align:left}
  #rexFridayPage .fp-edit-table button{padding:6px 9px;background:white;border:1px solid #cbd5e1;border-radius:7px;margin-right:5px}
  #rexFridayPage .fp-edit-totals{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;font-size:12px;font-weight:800}
  @media(max-width:1000px){#rexFridayPage .fp-edit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  @media(max-width:560px){#rexFridayPage .fp-edit-grid{grid-template-columns:1fr}}
 `;document.head.appendChild(s)}
 function boxes(){return [...document.querySelectorAll(ROOT)].map(card=>({card,uid:uid(card)})).filter(x=>x.uid)}
 function canEdit(id){return profileData()?.role==='admin'||currentUid()===id}
 function formHtml(){
 return `<form class="fp-edit-form"><div class="fp-edit-grid">
  <label class="fp-edit-field">Entreprise<input name="company" required maxlength="250" placeholder="Entreprise"></label>
  <label class="fp-edit-field">Montant (k€)<input name="amount" type="number" min="0.1" step="0.1" required></label>
  <label class="fp-edit-field">Type de client<select name="client"><option value="acquis">Client acquis</option><option value="nouveau">Nouveau client</option></select></label>
  <label class="fp-edit-field fp-edit-sale">Vente<select name="sale"><option value="classique">RNV</option><option value="up_sell">UC</option></select></label>
  <label class="fp-edit-field">Probabilité (%)<input name="prob" type="number" min="0" max="100" value="50" required></label>
 </div><div class="fp-edit-footer"><label><input name="rdv" type="checkbox"> RDV négociation prévu</label><button class="fp-edit-save" type="submit">Ajouter l'affaire</button><button class="fp-edit-cancel" type="button" hidden>Annuler</button><span class="fp-edit-status" role="status"></span></div></form>`;
 }
 function attach({card,uid:id}){
  let body=card.querySelector('.fp-body');if(!body)return null;
  let el=body.querySelector(':scope > .fp-nextweek-editor');
  if(!el){
   el=document.createElement('section');el.className='fp-nextweek-editor';el.dataset.fpPanel='forecast';el.dataset.uid=id;
   el.innerHTML='<h4>Prévisions de signatures — S+1</h4><div class="fp-edit-week"></div><div class="fp-edit-totals"></div><div class="fp-edit-wrap"></div>'+(canEdit(id)?formHtml():'');
   body.appendChild(el);
   if(canEdit(id)){
    const form=el.querySelector('form');
    form.elements.client.addEventListener('change',()=>form.classList.toggle('fp-edit-new',form.elements.client.value==='nouveau'));
    form.querySelector('.fp-edit-cancel').addEventListener('click',()=>{editing.delete(id);form.reset();form.classList.remove('fp-edit-new');form.querySelector('.fp-edit-save').textContent="Ajouter l'affaire";form.querySelector('.fp-edit-cancel').hidden=true});
    form.addEventListener('submit',e=>{e.preventDefault();save(id,el)});
   }
   el.querySelector('.fp-edit-wrap').addEventListener('click',e=>{
    const btn=e.target.closest('button[data-action][data-id]');if(!btn)return;
    if(btn.dataset.action==='edit')startEdit(id,el,btn.dataset.id);
    if(btn.dataset.action==='delete')remove(id,el,btn.dataset.id);
   });
  }
  return el;
 }
 function render(el,id,date){
  const list=items.get(id)||[],cl=list.filter(x=>x.client_type==='acquis').reduce((sum,x)=>sum+Number(x.amount||0),0),nc=list.filter(x=>x.client_type==='nouveau').reduce((sum,x)=>sum+Number(x.amount||0),0);
  el.querySelector('.fp-edit-week').textContent='Semaine du '+new Date(date+'T12:00:00').toLocaleDateString('fr-FR');
  el.querySelector('.fp-edit-totals').innerHTML=`<span>CL : ${euro(cl)}</span><span>NC : ${euro(nc)}</span><span>Total : ${euro(cl+nc)}</span>`;
  el.querySelector('.fp-edit-wrap').innerHTML=list.length?`<table class="fp-edit-table"><thead><tr><th>Entreprise</th><th>Montant</th><th>Client</th><th>Vente</th><th>Prob.</th><th>RDV</th><th>Actions</th></tr></thead><tbody>${list.map(x=>`<tr data-id="${esc(x.id)}"><td>${esc(x.company_name)}</td><td>${euro(x.amount)}</td><td>${x.client_type==='nouveau'?'NC':'CL'}</td><td>${x.client_type==='nouveau'?'—':x.sale_type==='up_sell'||x.sale_type==='cross_sell'?'UC':'RNV'}</td><td>${Number(x.probability)||0}%</td><td>${x.negotiation_meeting_scheduled?'Oui':'—'}</td><td>${canEdit(id)?`<button type="button" data-action="edit" data-id="${esc(x.id)}">Modifier</button><button type="button" data-action="delete" data-id="${esc(x.id)}">Supprimer</button>`:''}</td></tr>`).join('')}</tbody></table>`:'<div style="padding:14px;color:#64748b">Aucune affaire prévue pour S+1.</div>';
 }
 function startEdit(id,el,recordId){
  const row=(items.get(id)||[]).find(x=>x.id===recordId),form=el.querySelector('form');if(!row||!form)return;
  editing.set(id,recordId);form.elements.company.value=row.company_name;form.elements.amount.value=row.amount;form.elements.client.value=row.client_type;
  form.elements.sale.value=row.sale_type==='cross_sell'?'up_sell':row.sale_type;form.elements.prob.value=row.probability;form.elements.rdv.checked=!!row.negotiation_meeting_scheduled;
  form.classList.toggle('fp-edit-new',row.client_type==='nouveau');form.querySelector('.fp-edit-save').textContent="Enregistrer les modifications";form.querySelector('.fp-edit-cancel').hidden=false;form.scrollIntoView({behavior:'smooth',block:'nearest'});
 }
 async function save(id,el){
  if(!canEdit(id))return;const client=db(),date=nextDate(),form=el.querySelector('form'),msg=el.querySelector('.fp-edit-status');if(!client||!date||!form)return;
  const name=form.elements.company.value.trim(),amount=Number(form.elements.amount.value),probability=Number(form.elements.prob.value),newClient=form.elements.client.value==='nouveau';
  if(!name||!Number.isFinite(amount)||amount<=0||!Number.isInteger(probability)||probability<0||probability>100){msg.textContent='Vérifie le nom, le montant et la probabilité.';msg.classList.add('error');return}
  const values={company_name:name,amount,client_type:newClient?'nouveau':'acquis',sale_type:newClient?'classique':form.elements.sale.value,probability,negotiation_meeting_scheduled:form.elements.rdv.checked,updated_at:new Date().toISOString()};
  const recordId=editing.get(id),btn=form.querySelector('.fp-edit-save');btn.disabled=true;msg.classList.remove('error');msg.textContent='Enregistrement…';
  try{
   const q=recordId?await client.from(TABLE).update(values).eq('id',recordId).eq('user_id',id).eq('week_start',date):await client.from(TABLE).insert({...values,user_id:id,week_start:date});
   if(q.error)throw q.error;
   msg.textContent='Affaire enregistrée.';editing.delete(id);form.reset();form.classList.remove('fp-edit-new');btn.textContent="Ajouter l'affaire";form.querySelector('.fp-edit-cancel').hidden=true;await load();
  }catch(e){msg.textContent='Erreur : '+(e?.message||e);msg.classList.add('error')}finally{btn.disabled=false}
 }
 async function remove(id,el,recordId){
  if(!canEdit(id)||!confirm('Supprimer cette prévision S+1 ?'))return;
  const client=db(),date=nextDate();if(!client||!date)return;
  const r=await client.from(TABLE).delete().eq('id',recordId).eq('user_id',id).eq('week_start',date);
  if(r.error){const msg=el.querySelector('.fp-edit-status');if(msg){msg.textContent=r.error.message;msg.classList.add('error')}return}
  if(editing.get(id)===recordId)el.querySelector('.fp-edit-cancel')?.click();await load();
 }
 async function load(){
  const date=nextDate(),list=boxes(),client=db();if(!date||!list.length||!client||busy)return;
  busy=true;try{
   const ids=list.map(x=>x.uid);
   const q=await client.from(TABLE).select('*').eq('week_start',date).in('user_id',ids).order('created_at');
   if(q.error)throw q.error;
   items=new Map(ids.map(id=>[id,[]]));for(const row of q.data||[]){if(items.has(row.user_id))items.get(row.user_id).push(row)}
   for(const item of list){const el=attach(item);if(el)render(el,item.uid,date)}
   lastKey=date+'|'+ids.join(',');refreshAt=Date.now();
  }catch(e){
   for(const item of list){const el=attach(item),msg=el?.querySelector('.fp-edit-status');if(msg){msg.textContent='Erreur de chargement : '+(e?.message||e);msg.classList.add('error')}}
  }finally{busy=false}
 }
 function tick(){
  const date=nextDate();if(!date)return;style();
  const list=boxes();let newCard=false;
  for(const item of list){if(!item.card.querySelector('.fp-nextweek-editor'))newCard=true;attach(item)}
  const sig=date+'|'+list.map(x=>x.uid).join(',');
  if(newCard||sig!==lastKey||Date.now()-refreshAt>60000)load();
 }
 setInterval(tick,1200);window.addEventListener('load',()=>setTimeout(tick,1700));
})();
