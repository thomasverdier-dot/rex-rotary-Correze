(()=>{
  function addStyle(){
    if(document.getElementById('fridayWeeklyEntryStyle'))return;
    const s=document.createElement('style');s.id='fridayWeeklyEntryStyle';s.textContent=`
      #rexFridayPage .fp-form{margin-top:14px!important;padding:15px!important;border:2px solid #bfdbfe!important;border-radius:16px!important;background:#f8fbff!important}
      #rexFridayPage .fp-form> b{display:block!important;font-size:15px!important;color:#0f2f5f!important;margin-bottom:3px!important}
      #rexFridayPage .fp-weekly-help{font-size:11px;color:#64748b;margin-bottom:11px;line-height:1.35}
      #rexFridayPage .fp-form-grid{display:grid!important;grid-template-columns:repeat(3,minmax(160px,1fr))!important;gap:10px!important;align-items:end!important}
      #rexFridayPage .fp-form-grid label{font-size:10px!important;color:#475569!important;margin-bottom:6px!important}
      #rexFridayPage .fp-form-grid input{box-sizing:border-box;width:100%!important;min-height:44px!important;padding:10px 12px!important;border:1px solid #cbd5e1!important;border-radius:10px!important;background:#fff!important;font-size:14px!important}
      #rexFridayPage .fp-main-save{grid-column:1/-1!important;min-height:44px!important;border-radius:10px!important;font-size:13px!important;background:#0e2f68!important;color:#fff!important}
      @media(max-width:850px){#rexFridayPage .fp-form-grid{grid-template-columns:repeat(2,minmax(130px,1fr))!important}}
      @media(max-width:560px){#rexFridayPage .fp-form-grid{grid-template-columns:1fr!important}}
    `;document.head.appendChild(s);
  }

  function enhance(){
    addStyle();
    document.querySelectorAll('#rexFridayPage .fp-form').forEach(form=>{
      if(form.dataset.weeklyEntryEnhanced==='1')return;
      form.dataset.weeklyEntryEnhanced='1';
      const title=form.querySelector(':scope > b');
      if(title){
        title.textContent='Mes chiffres de la semaine';
        title.insertAdjacentHTML('afterend','<div class="fp-weekly-help">À remplir par le vendeur avant le point du vendredi. Indique le réalisé de la semaine, pas l’objectif.</div>');
      }
      const fields=[
        ['.physical','Prospection physique'],
        ['.appointments','Rendez-vous réalisés'],
        ['.calls','Appels effectués'],
        ['.deals','Affaires créées'],
        ['.nc','Dont nouveaux clients (NC)'],
        ['.month','Créations dans le mois']
      ];
      fields.forEach(([sel,label])=>{
        const input=form.querySelector(sel),wrap=input?.parentElement,l=wrap?.querySelector('label');
        if(l)l.textContent=label;
      });
      const btn=form.querySelector('.fp-main-save');
      if(btn)btn.textContent='Enregistrer mes chiffres de la semaine';
    });
  }

  let tries=0;const timer=setInterval(()=>{tries++;enhance();if(tries>240)clearInterval(timer)},500);
  window.addEventListener('load',()=>setTimeout(enhance,1200));
})();