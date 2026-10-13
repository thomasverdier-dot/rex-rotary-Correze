/* Commentaire hebdomadaire du vendeur, distinct des notes du responsable. */
(()=>{
  const drafts=new Map(),loaded=new Map();
  let week='',busy=false;
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function db(){try{return sb}catch(e){return null}}
  function profileData(){try{return profile||currentProfile||null}catch(e){return null}}
  function currentUid(){try{return user?.id||currentUser?.id||''}catch(e){return ''}}
  function cards(){return [...document.querySelectorAll('#fpCards > .fp-seller')]}
  function id(card){return card.querySelector('[data-fpc]')?.dataset.fpc||card.querySelector('[data-fpa]')?.dataset.fpa||card.querySelector('.fp-form .fp-main-save')?.dataset.uid||card.querySelector('[data-fps]')?.dataset.fps||''}
  function style(){if(document.getElementById('fpSellerCommentStyle'))return;
    let el=document.createElement('style');el.id='fpSellerCommentStyle';el.textContent=`
      #rexFridayPage .fp-week-comment{margin:14px 0;padding:15px;border:1px solid #bfd4ed;border-radius:13px;background:#f7fbff}
      #rexFridayPage .fp-week-comment h4{margin:0 0 5px;font-size:14px;color:#12315f}
      #rexFridayPage .fp-week-comment p{font-size:11px;color:#64748b;margin:0 0 10px}
      #rexFridayPage .fp-week-comment textarea{width:100%;box-sizing:border-box;min-height:120px;resize:vertical;padding:12px;border:1px solid #cbd5e1;border-radius:10px;font:13px/1.5 Segoe UI,Arial,sans-serif;color:#0f172a;background:#fff}
      #rexFridayPage .fp-week-comment textarea[readonly]{background:#f8fafc}
      #rexFridayPage .fp-week-comment-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:9px}
      #rexFridayPage .fp-week-comment-save{border:0;background:#0e2f68;color:white;border-radius:9px;padding:10px 15px;font-weight:800;cursor:pointer}
      #rexFridayPage .fp-week-comment-status{font-size:11px;color:#64748b}
      #rexFridayPage .fp-week-comment-status.error{color:#b42318}
    `;document.head.appendChild(el)}
  function key(uid){return week+'|'+uid}
  function box(card,uid){
    const body=card.querySelector('.fp-body');if(!body)return;
    let node=body.querySelector('.fp-week-comment');
    if(!node){
      const editable=profileData()?.role!=='admin'&&currentUid()===uid;
      node=document.createElement('section');node.className='fp-week-comment';node.dataset.fpPanel='activity';node.dataset.fpCommentUid=uid;
      node.innerHTML='<h4>💬 Commentaire sur ma semaine</h4><p>Le vendeur peut partager son ressenti, ses réussites, ses difficultés ou un besoin d’accompagnement.</p><textarea class="fp-week-comment-text" '+(editable?'placeholder="Comment s’est passée votre semaine ? (facultatif)"':'readonly placeholder="Aucun commentaire du vendeur pour cette semaine."')+'></textarea><div class="fp-week-comment-actions">'+(editable?'<button type="button" class="fp-week-comment-save">Enregistrer mon commentaire</button>':'')+'<span class="fp-week-comment-status"></span></div>';
      const insert=body.querySelector(':scope > .fp-form')||body.querySelector(':scope > .fp-analysis');
      if(insert)insert.insertAdjacentElement('afterend',node);else body.appendChild(node);
      if(editable){
        const textarea=node.querySelector('textarea');
        textarea.addEventListener('input',()=>drafts.set(key(uid),textarea.value));
        node.querySelector('button').addEventListener('click',()=>save(uid,node));
      }
    }
    const area=node.querySelector('textarea'),k=key(uid);
    if(drafts.has(k)&&document.activeElement!==area){if(area.value!==drafts.get(k))area.value=drafts.get(k)}
    else if(loaded.has(k)&&document.activeElement!==area&&!drafts.has(k)){if(area.value!==loaded.get(k))area.value=loaded.get(k)}
  }
  async function save(uid,node){
    const client=db(),current=document.getElementById('fpWeek')?.value||'',text=node.querySelector('textarea').value.trim();
    const status=node.querySelector('.fp-week-comment-status'),btn=node.querySelector('button');
    if(!client||!current||currentUid()!==uid||profileData()?.role==='admin')return;
    btn.disabled=true;status.classList.remove('error');status.textContent='Enregistrement…';
    try{
      const r=await client.from('friday_activity').upsert({user_id:uid,week_start:current,seller_week_comment:text,updated_at:new Date().toISOString()},{onConflict:'user_id,week_start'});
      if(r.error)throw r.error;
      loaded.set(current+'|'+uid,text);drafts.delete(current+'|'+uid);
      status.textContent='Commentaire enregistré pour cette semaine.';
    }catch(err){status.textContent='Erreur : '+(err?.message||err);status.classList.add('error')}
    finally{btn.disabled=false}
  }
  async function fetchComments(){
    const current=document.getElementById('fpWeek')?.value||'',client=db(),list=cards(),ids=list.map(id).filter(Boolean);
    if(!client||!current||!ids.length||busy)return;
    busy=true;try{
      const r=await client.from('friday_activity').select('user_id,seller_week_comment').eq('week_start',current).in('user_id',ids);
      if(r.error)throw r.error;
      for(const uid of ids)loaded.set(current+'|'+uid,'');
      for(const row of r.data||[])loaded.set(current+'|'+row.user_id,row.seller_week_comment||'');
    }catch(err){
      for(const card of list){const status=card.querySelector('.fp-week-comment-status');if(status){status.classList.add('error');status.textContent='Chargement indisponible : '+(err?.message||err)}}
    }finally{busy=false}
  }
  let lastSignature='',lastFetch=0;
  async function tick(){
    const page=document.getElementById('rexFridayPage');if(!page)return;
    const current=document.getElementById('fpWeek')?.value||'';if(!current)return;
    style();
    if(current!==week){week=current;drafts.clear();loaded.clear();lastSignature='';lastFetch=0}
    const list=cards();
    list.forEach(card=>{const uid=id(card);if(uid)box(card,uid)});
    const sig=current+'|'+list.map(id).join(',');
    const now=Date.now();
    if(sig!==lastSignature||now-lastFetch>30000){
      lastSignature=sig;lastFetch=now;await fetchComments();
      list.forEach(card=>{const uid=id(card);if(uid)box(card,uid)});
    }
  }
  setInterval(tick,1200);
  window.addEventListener('load',()=>setTimeout(tick,1600));
})();
