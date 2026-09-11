(()=>{
  let sellers=[],rows=[],week='',busy=false,lastSig='';
  function getSb(){try{return sb}catch(e){return null}}
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function getUser(){try{return user||currentUser||null}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  function addStyle(){
    if(document.getElementById('fridayChecklistStyle'))return;
    const s=document.createElement('style');s.id='fridayChecklistStyle';s.textContent=`
      .fpc-box{margin-top:10px;padding:11px 12px;border:1px solid #dfe6ee;border-radius:12px;background:#f8fafc}.fpc-title{font-size:11px;font-weight:900;color:#10233f;margin-bottom:8px}.fpc-list{display:flex;flex-wrap:wrap;gap:8px}.fpc-check{display:flex;align-items:center;gap:7px;padding:8px 10px;border:1px solid #d7dee8;border-radius:10px;background:#fff;font-size:11px;font-weight:800;color:#334155;cursor:pointer}.fpc-check input{width:18px;height:18px;accent-color:#16a34a;cursor:pointer}.fpc-check.done{background:#ecfdf5;border-color:#86efac;color:#166534}.fpc-check.readonly{cursor:default}.fpc-check.readonly input{pointer-events:none}.fpc-msg{font-size:9px;color:#64748b;margin-top:7px;min-height:12px}
    `;document.head.appendChild(s);
  }
  function currentFor(uid){return rows.find(r=>r.user_id===uid)||{}}
  function blockHtml(s){
    const cur=currentFor(s.user_id),editable=isAdmin()||getUser()?.id===s.user_id;
    const agenda=!!cur.agenda_up_to_date,portfolio=!!cur.portfolio_up_to_date,km=!!cur.km_up_to_date;
    const item=(key,label,checked,disabled=false)=>`<label class="fpc-check ${checked?'done':''} ${disabled?'readonly':''}" data-key="${key}"><input type="checkbox" ${checked?'checked':''} ${disabled?'disabled':''}> <span>${label}</span></label>`;
    return `<div class="fpc-box" data-fpc="${s.user_id}"><div class="fpc-title">✓ Contrôles du vendredi</div><div class="fpc-list">${item('agenda_up_to_date','Agenda à jour',agenda,!editable)}${item('portfolio_up_to_date','Portefeuille à jour',portfolio,!editable)}${item('km_up_to_date','KM',km,!editable)}</div><div class="fpc-msg"></div></div>`;
  }
  async function loadData(){
    const client=getSb(),p=getProfile(),u=getUser(),w=document.getElementById('fpWeek')?.value||'';if(!client||!p||!u||!w)return;
    week=w;
    if(p.role==='admin'){
      const q=await client.from('profiles').select('user_id,display_name,sector_id').eq('role','seller').order('sector_id');sellers=q.data||[];
    }else sellers=[{user_id:u.id,display_name:p.display_name||u.email,sector_id:p.sector_id}];
    const ids=sellers.map(s=>s.user_id);if(!ids.length){rows=[];render();return}
    const a=await client.from('friday_activity').select('user_id,week_start,agenda_up_to_date,portfolio_up_to_date,km_up_to_date').eq('week_start',w).in('user_id',ids);
    rows=a.data||[];render();
  }
  function render(){
    addStyle();const cards=[...document.querySelectorAll('#fpCards .fp-seller')];if(!cards.length)return;
    cards.forEach((card,i)=>{
      const s=sellers[i];if(!s)return;
      card.querySelector('[data-fpc]')?.remove();
      const anchor=card.querySelector('[data-fpa]')||card.querySelector('.fp-analysis');if(!anchor)return;
      anchor.insertAdjacentHTML('afterend',blockHtml(s));
    });
    document.querySelectorAll('[data-fpc] .fpc-check input').forEach(input=>{if(input.disabled)return;input.onchange=()=>save(input)});
  }
  async function save(input){
    const box=input.closest('[data-fpc]'),label=input.closest('.fpc-check'),uid=box?.dataset.fpc,key=label?.dataset.key,client=getSb();if(!box||!uid||!key||!client)return;
    const msg=box.querySelector('.fpc-msg');msg.textContent='Enregistrement…';
    const row={user_id:uid,week_start:week,updated_at:new Date().toISOString()};row[key]=!!input.checked;
    const r=await client.from('friday_activity').upsert(row,{onConflict:'user_id,week_start'});
    if(r.error){input.checked=!input.checked;msg.textContent='Erreur : '+r.error.message;return}
    let cur=rows.find(x=>x.user_id===uid);if(!cur){cur={user_id:uid,week_start:week};rows.push(cur)}Object.assign(cur,row);
    label.classList.toggle('done',input.checked);msg.textContent='Enregistré';setTimeout(()=>{if(msg.textContent==='Enregistré')msg.textContent=''},1200);
  }
  async function tick(){
    const page=document.getElementById('rexFridayPage');if(!page)return;
    const w=document.getElementById('fpWeek')?.value||'',cards=document.querySelectorAll('#fpCards .fp-seller').length,sig=w+'|'+cards+'|'+(getProfile()?.role||'');
    if((sig!==lastSig||!document.querySelector('[data-fpc]'))&&!busy){busy=true;try{await loadData();lastSig=sig}finally{busy=false}}
  }
  setInterval(tick,900);window.addEventListener('load',()=>setTimeout(tick,1800));
})();