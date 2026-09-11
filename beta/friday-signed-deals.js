(()=>{
  let sellers=[],rows=[],week='',busy=false,lastSig='',lastLoad=0;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const euro=n=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(Number(n||0))+' k€';
  function getSb(){try{return sb}catch(e){return null}}
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  function frDate(iso){if(!iso)return'';return new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'})}
  function addStyle(){
    if(document.getElementById('fridaySignedStyle'))return;
    const s=document.createElement('style');s.id='fridaySignedStyle';s.textContent=`
      .fps-box{margin-top:14px;padding:14px;border:1px solid #dfe6ee;border-radius:14px;background:#fff}.fps-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px}.fps-head h4{margin:0;color:#10233f;font-size:15px}.fps-date{font-size:10px;color:#64748b;font-weight:800}.fps-kpis{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}.fps-pill{background:#ecfdf5;border:1px solid #bbf7d0;border-radius:999px;padding:6px 10px;font-size:10px;color:#166534}.fps-pill b{color:#14532d}.fps-form{display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:end;margin:10px 0 12px;padding:10px;background:#f8fafc;border-radius:12px}.fps-field label{display:block;font-size:9px;font-weight:800;color:#64748b;margin-bottom:4px}.fps-field input,.fps-field select{width:100%;box-sizing:border-box;padding:9px;border:1px solid #d7dee8;border-radius:9px;background:#fff}.fps-add{border:0;border-radius:9px;background:#15803d;color:#fff;padding:10px 14px;font-weight:900;cursor:pointer;white-space:nowrap}.fps-table{width:100%;border-collapse:collapse;font-size:11px}.fps-table th,.fps-table td{padding:9px 8px;border-bottom:1px solid #edf1f5;text-align:left}.fps-table th{font-size:9px;text-transform:uppercase;color:#64748b}.fps-del{border:0;background:#fee2e2;color:#991b1b;border-radius:7px;padding:6px 8px;font-weight:900;cursor:pointer}.fps-empty{padding:14px;border:1px dashed #cbd5e1;border-radius:10px;color:#64748b;font-size:11px;background:#f8fafc}.fps-msg{font-size:10px;color:#64748b;min-height:14px;margin-top:6px}@media(max-width:1000px){.fps-form{grid-template-columns:1fr 1fr}}@media(max-width:620px){.fps-form{grid-template-columns:1fr}.fps-table{font-size:10px}}
    `;document.head.appendChild(s);
  }
  async function load(){
    const client=getSb(),p=getProfile(),u=getUser(),w=document.getElementById('fpWeek')?.value||'';if(!client||!p||!u||!w)return;
    week=w;
    if(p.role==='admin'){
      const q=await client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id');sellers=q.data||[];
    }else sellers=[{user_id:u.id,display_name:p.display_name||u.email,sector_id:p.sector_id}];
    const ids=sellers.map(s=>s.user_id);if(!ids.length){rows=[];render();return}
    const q=await client.from('friday_signed_deals').select('id,user_id,week_start,company_name,amount,client_type,sale_type,created_at').eq('week_start',week).in('user_id',ids).order('created_at');
    rows=q.data||[];render();
  }
  function canEdit(uid){return isAdmin()||getUser()?.id===uid}
  function blockHtml(s){
    const list=rows.filter(r=>r.user_id===s.user_id);let cl=0,nc=0,total=0;
    list.forEach(r=>{const a=Number(r.amount||0);total+=a;if(r.client_type==='nouveau')nc+=a;else cl+=a});
    const editable=canEdit(s.user_id),id=s.user_id.replaceAll('-','');
    const form=editable?`<div class="fps-form" id="fpsf_${id}"><div class="fps-field"><label>Entreprise signée</label><input class="fps-company" placeholder="Nom de l'entreprise"></div><div class="fps-field"><label>Montant (k€)</label><input class="fps-amount" type="number" min="0" step="0.1" placeholder="0"></div><div class="fps-field"><label>Client</label><select class="fps-client"><option value="client">CL</option><option value="nouveau">NC</option></select></div><div class="fps-field"><label>Type de vente</label><select class="fps-sale"><option value="classique">Classique</option><option value="up">Up</option><option value="cross">Cross</option></select></div><button class="fps-add" data-uid="${s.user_id}">+ Ajouter</button></div>`:'';
    const table=list.length?`<table class="fps-table"><thead><tr><th>Entreprise</th><th>Montant</th><th>Client</th><th>Vente</th>${editable?'<th></th>':''}</tr></thead><tbody>${list.map(r=>`<tr><td><b>${esc(r.company_name)}</b></td><td>${euro(r.amount)}</td><td>${r.client_type==='nouveau'?'NC':'CL'}</td><td>${esc((r.sale_type||'classique').replace(/^./,m=>m.toUpperCase()))}</td>${editable?`<td><button class="fps-del" data-id="${r.id}">Supprimer</button></td>`:''}</tr>`).join('')}</tbody></table>`:`<div class="fps-empty">Aucune affaire signée renseignée pour cette semaine.</div>`;
    return `<div class="fps-box" data-fps="${s.user_id}"><div class="fps-head"><div><h4>✅ Affaires signées cette semaine</h4><div class="fps-date">Semaine du ${frDate(week)}</div></div></div><div class="fps-kpis"><span class="fps-pill">CL <b>${euro(cl)}</b></span><span class="fps-pill">NC <b>${euro(nc)}</b></span><span class="fps-pill">Total signé <b>${euro(total)}</b></span><span class="fps-pill"><b>${list.length}</b> affaire${list.length>1?'s':''}</span></div>${form}${table}<div class="fps-msg"></div></div>`;
  }
  function render(){
    addStyle();const cards=[...document.querySelectorAll('#fpCards .fp-seller')];if(!cards.length)return;
    cards.forEach((card,i)=>{
      const s=sellers[i];if(!s)return;card.querySelector('[data-fps]')?.remove();
      const next=card.querySelector('.fp-nextweek');
      if(next)next.insertAdjacentHTML('beforebegin',blockHtml(s));
      else {const anchor=card.querySelector('.fp-form')||card.querySelector('[data-fpc]')||card.querySelector('[data-fpa]')||card.querySelector('.fp-analysis');if(anchor)anchor.insertAdjacentHTML('afterend',blockHtml(s));else card.querySelector('.fp-body')?.insertAdjacentHTML('beforeend',blockHtml(s));}
    });
    document.querySelectorAll('.fps-add').forEach(b=>b.onclick=()=>addDeal(b.dataset.uid));
    document.querySelectorAll('.fps-del').forEach(b=>b.onclick=()=>deleteDeal(b.dataset.id));
  }
  async function addDeal(uid){
    const box=document.getElementById('fpsf_'+uid.replaceAll('-','')),client=getSb();if(!box||!client)return;
    const company=box.querySelector('.fps-company')?.value.trim()||'',amount=Number(box.querySelector('.fps-amount')?.value||0),clientType=box.querySelector('.fps-client')?.value||'client',saleType=box.querySelector('.fps-sale')?.value||'classique';
    if(!company){alert("Renseigne le nom de l'entreprise signée.");return}if(amount<=0){alert('Renseigne un montant supérieur à 0.');return}
    const r=await client.from('friday_signed_deals').insert({user_id:uid,week_start:week,company_name:company,amount,client_type:clientType,sale_type:saleType,updated_at:new Date().toISOString()}).select().single();
    if(r.error){alert(r.error.message);return}rows.push(r.data);render();
  }
  async function deleteDeal(id){
    if(!confirm('Supprimer cette affaire signée ?'))return;const client=getSb();if(!client)return;const r=await client.from('friday_signed_deals').delete().eq('id',id);if(r.error){alert(r.error.message);return}rows=rows.filter(x=>x.id!==id);render();
  }
  async function tick(){
    if(!document.getElementById('rexFridayPage'))return;const w=document.getElementById('fpWeek')?.value||'',cards=document.querySelectorAll('#fpCards .fp-seller').length,role=getProfile()?.role||'',sig=w+'|'+cards+'|'+role,due=Date.now()-lastLoad>12000;
    if(!busy&&(sig!==lastSig||!document.querySelector('[data-fps]')||due)){busy=true;try{await load();lastSig=sig;lastLoad=Date.now()}finally{busy=false}}
  }
  setInterval(tick,1000);window.addEventListener('load',()=>setTimeout(tick,1900));
})();