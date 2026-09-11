(()=>{
  let rows=[],week='',busy=false,lastSig='';
  function getSb(){try{return sb}catch(e){return null}}
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  function addStyle(){
    if(document.getElementById('fridayActionManagerStyle'))return;
    const s=document.createElement('style');s.id='fridayActionManagerStyle';s.textContent=`
      .fam-box{margin-top:9px;padding-top:9px;border-top:1px solid #edf1f5}.fam-check{display:flex;align-items:center;gap:8px;font-size:11px;font-weight:900;color:#10233f;cursor:pointer;width:max-content}.fam-check input{width:19px;height:19px;accent-color:#16a34a;cursor:pointer}.fam-explain{margin-top:8px}.fam-explain label{display:block;font-size:9px;font-weight:800;color:#64748b;margin-bottom:4px}.fam-explain textarea{width:100%;min-height:64px;padding:9px;border:1px solid #d7dee8;border-radius:9px;background:#fff;font:11px Segoe UI,Arial;resize:vertical}.fam-save{margin-top:8px;border:0;border-radius:9px;background:#10233f;color:#fff;padding:9px 13px;font-weight:800;cursor:pointer}.fam-msg{font-size:9px;color:#64748b;margin-left:8px}.fam-hidden{display:none}
    `;document.head.appendChild(s);
  }
  function rowFor(uid){return rows.find(r=>r.user_id===uid)||{}}
  function controls(uid){
    const r=rowFor(uid),done=r.previous_action_status==='done',comment=r.previous_action_comment||'';
    return `<div class="fam-box" data-fam="${uid}"><label class="fam-check"><input class="fam-done" type="checkbox" ${done?'checked':''}> Fait</label><div class="fam-explain ${done?'fam-hidden':''}"><label>Explication si non fait</label><textarea class="fam-comment" placeholder="Pourquoi l’action n’a pas été réalisée ?">${String(comment).replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]))}</textarea></div><button class="fam-save">Enregistrer</button><span class="fam-msg"></span></div>`;
  }
  function render(){
    addStyle();
    document.querySelectorAll('[data-fpa]').forEach(box=>{
      box.querySelector('.fpa-review')?.remove();
      box.querySelector('[data-fam]')?.remove();
      if(!isAdmin())return;
      const action=box.querySelector('.fpa-action');if(!action)return;
      const uid=box.dataset.fpa;if(!uid)return;
      action.insertAdjacentHTML('afterend',controls(uid));
      const c=box.querySelector('[data-fam]'),chk=c.querySelector('.fam-done'),explain=c.querySelector('.fam-explain');
      chk.onchange=()=>explain.classList.toggle('fam-hidden',chk.checked);
      c.querySelector('.fam-save').onclick=()=>save(uid,c,box);
    });
  }
  async function save(uid,c,box){
    const client=getSb();if(!client)return;
    const done=c.querySelector('.fam-done').checked,comment=c.querySelector('.fam-comment').value.trim(),msg=c.querySelector('.fam-msg');
    if(!done&&!comment){alert('Si l’action n’est pas faite, renseigne une explication.');c.querySelector('.fam-comment').focus();return}
    msg.textContent='Enregistrement…';
    const row={user_id:uid,week_start:week,previous_action_status:done?'done':'not_done',previous_action_comment:done?null:comment,previous_action_reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const r=await client.from('friday_activity').upsert(row,{onConflict:'user_id,week_start'});
    if(r.error){msg.textContent='Erreur : '+r.error.message;return}
    let cur=rows.find(x=>x.user_id===uid);if(!cur){cur={user_id:uid};rows.push(cur)}Object.assign(cur,row);
    const badge=box.querySelector('.fpa-badge');if(badge){badge.className='fpa-badge '+(done?'done':'miss');badge.textContent=done?'Fait':'Non fait'}
    msg.textContent='Enregistré';setTimeout(()=>{if(msg.textContent==='Enregistré')msg.textContent=''},1200);
  }
  async function load(){
    const client=getSb(),w=document.getElementById('fpWeek')?.value||'';if(!client||!w)return;week=w;
    const ids=[...document.querySelectorAll('[data-fpa]')].map(x=>x.dataset.fpa).filter(Boolean);if(!ids.length)return;
    const q=await client.from('friday_activity').select('user_id,week_start,previous_action_status,previous_action_comment').eq('week_start',w).in('user_id',ids);
    if(!q.error)rows=q.data||[];render();
  }
  async function tick(){
    if(!document.getElementById('rexFridayPage'))return;
    const w=document.getElementById('fpWeek')?.value||'',n=document.querySelectorAll('[data-fpa]').length,sig=w+'|'+n+'|'+(getProfile()?.role||'');
    if((sig!==lastSig||(isAdmin()&&!document.querySelector('[data-fam]')))&&!busy){busy=true;try{await load();lastSig=sig}finally{busy=false}}
  }
  setInterval(tick,800);window.addEventListener('load',()=>setTimeout(tick,1800));
})();