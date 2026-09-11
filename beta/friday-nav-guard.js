(()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  function goFriday(){
    document.querySelectorAll('.rex-page').forEach(p=>p.classList.toggle('active',p.dataset.page==='friday'));
    document.querySelectorAll('.rex-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='friday'));
    if(typeof window.loadFridayPoint==='function')window.loadFridayPoint();
    else document.getElementById('rexFridayPage')?.scrollIntoView({block:'start'});
  }
  function ensure(){
    const nav=document.querySelector('#rexShellV3 .rex-nav');
    if(!nav)return false;
    let btn=nav.querySelector('[data-page="friday"]');
    if(!btn){
      btn=document.createElement('button');
      btn.dataset.page='friday';
      btn.innerHTML='📊 Point vendredi';
      const improvements=nav.querySelector('[data-page="tickets"]')||document.getElementById('ticketNavBtn');
      if(improvements&&improvements.parentElement===nav)nav.insertBefore(btn,improvements);else nav.appendChild(btn);
    }
    btn.onclick=goFriday;
    return true;
  }
  function reorderReport(text){
    const m=String(text||'').match(/\n5\. COMMENTAIRE MANAGER\n([\s\S]*?)(?=\n6\. ACTION À MENER\n)/);
    if(!m)return null;
    const comment=(m[1]||'').trim()||'Aucun commentaire manager renseigné.';
    let out=String(text).replace(m[0],'');
    out=out.replace(/\n6\. ACTION À MENER\n/g,'\n5. ACTION À MENER\n');
    out=out.replace(/\n7\. PRÉVISIONNEL SEMAINE PROCHAINE/g,'\n6. PRÉVISIONNEL SEMAINE PROCHAINE');
    out=out.replace(/\n8\. SYNTHÈSE AUTOMATIQUE\n/g,'\n7. SYNTHÈSE AUTOMATIQUE\n');
    out=out.trimEnd()+`\n\n8. COMMENTAIRE MANAGER\n${comment}`;
    return out;
  }
  document.addEventListener('click',async e=>{
    const btn=e.target.closest?.('.fpr-generate');if(!btn)return;
    const box=btn.closest('[data-fpr]');if(!box)return;
    for(let i=0;i<100&&btn.disabled;i++)await sleep(120);
    const ta=box.querySelector('.fpr-text');if(!ta?.value)return;
    const reordered=reorderReport(ta.value);if(!reordered||reordered===ta.value)return;
    ta.value=reordered;
    try{
      const uid=box.dataset.fpr||btn.dataset.uid||'',week=document.getElementById('fpWeek')?.value||'';
      if(typeof sb!=='undefined'&&uid&&week)await sb.from('friday_activity').upsert({user_id:uid,week_start:week,crm_summary:reordered,summary_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'user_id,week_start'});
    }catch(err){}
  });
  let tries=0;const t=setInterval(()=>{tries++;if(ensure()||tries>120)clearInterval(t)},250);
  setInterval(ensure,2500);
  window.addEventListener('load',()=>setTimeout(ensure,1200));
})();
