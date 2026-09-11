(()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function getSb(){try{return sb}catch(e){return null}}
  function currentWeek(){return document.getElementById('fpWeek')?.value||''}

  function reorder(text){
    text=String(text||'');
    const m=text.match(/\n5\. COMMENTAIRE MANAGER\n([\s\S]*?)(?=\n6\. ACTION À MENER\n)/);
    if(!m)return {text,missing:false,changed:false};
    const comment=(m[1]||'').trim()||'Aucun commentaire manager renseigné.';
    const missing=comment==='Aucun commentaire manager renseigné.';
    let out=text.replace(m[0],'');
    out=out.replace(/\n6\. ACTION À MENER\n/g,'\n5. ACTION À MENER\n');
    out=out.replace(/\n7\. PRÉVISIONNEL SEMAINE PROCHAINE/g,'\n6. PRÉVISIONNEL SEMAINE PROCHAINE');
    out=out.replace(/\n8\. SYNTHÈSE AUTOMATIQUE\n/g,'\n7. SYNTHÈSE AUTOMATIQUE\n');

    if(missing){
      if(/Éléments à compléter : [^\n]+\./.test(out)){
        out=out.replace(/Éléments à compléter : ([^\n]+)\./,(_,x)=>`Éléments à compléter : ${x.includes('commentaire manager')?x:x+', commentaire manager'}.`);
      }else{
        out=out.replace('Point du vendredi complet.','Éléments à compléter : commentaire manager.');
      }
    }
    out=out.trimEnd()+`\n\n8. COMMENTAIRE MANAGER\n${comment}`;
    return {text:out,missing,changed:out!==text};
  }

  async function persist(uid,text){
    const client=getSb(),week=currentWeek();if(!client||!week||!uid)return;
    await client.from('friday_activity').upsert({user_id:uid,week_start:week,crm_summary:text,summary_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'user_id,week_start'});
  }

  document.addEventListener('click',async e=>{
    const btn=e.target.closest?.('.fpr-generate');if(!btn)return;
    const box=btn.closest('[data-fpr]');if(!box)return;
    const uid=box.dataset.fpr||btn.dataset.uid||'';
    for(let i=0;i<100&&btn.disabled;i++)await sleep(120);
    const ta=box.querySelector('.fpr-text');if(!ta?.value)return;
    const r=reorder(ta.value);if(!r.changed)return;
    ta.value=r.text;
    await persist(uid,r.text);
    const status=box.querySelector('.fpr-status');
    if(status&&r.missing){
      status.className='fpr-status warn';
      status.textContent='Compte rendu généré — commentaire manager à compléter.';
    }
  });
})();
