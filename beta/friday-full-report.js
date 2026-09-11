(()=>{
  const DEFAULTS={physical_prospecting_week:15,appointments_week:8,calls_week:35,deals_created_week:4,nc_deals_week:2,deals_created_month:16};
  const METRICS=[
    ['physical_prospecting','physical_prospecting_week','Prospection physique'],
    ['appointments','appointments_week','Rendez-vous'],
    ['calls','calls_week','Appels'],
    ['deals_created','deals_created_week','Affaires créées'],
    ['nc_deals','nc_deals_week','Dont NC']
  ];
  let mounting=false;
  function getSb(){try{return sb}catch(e){return null}}
  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function isAdmin(){return getProfile()?.role==='admin'}
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const n=v=>Number(v||0);
  const euro=v=>new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1}).format(n(v))+' k€';
  const pct=(v,t)=>n(t)?Math.round(n(v)/n(t)*100):(n(v)>0?100:0);
  function addDays(iso,days){const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
  function frDate(iso){return iso?new Date(iso+'T12:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}):''}
  function cap(s){s=String(s||'');return s?s.charAt(0).toUpperCase()+s.slice(1):''}
  function yes(v){return v?'Oui':'Non'}
  function statusLabel(v){return v==='done'?'Fait':v==='not_done'?'Non fait':v==='partial'?'Partiellement fait':'Non vérifié'}

  function addStyle(){
    if(document.getElementById('fridayFullReportStyle'))return;
    const st=document.createElement('style');st.id='fridayFullReportStyle';st.textContent=`
      #rexFridayPage .fp-summary-box{display:none!important}
      .fpr-box{margin-top:16px;padding:15px;border:2px solid #cbd5e1;border-radius:15px;background:#f8fafc}
      .fpr-head{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap}.fpr-head h4{margin:0;color:#10233f;font-size:15px}.fpr-sub{font-size:10px;color:#64748b;margin-top:3px}
      .fpr-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:11px}.fpr-generate,.fpr-copy{border:0;border-radius:9px;padding:10px 14px;font-weight:900;cursor:pointer}.fpr-generate{background:#0e2f68;color:#fff}.fpr-copy{background:#fff;color:#10233f;border:1px solid #cbd5e1}
      .fpr-status{font-size:10px;color:#64748b;margin-top:8px;min-height:14px}.fpr-status.warn{color:#b45309;font-weight:800}.fpr-status.ok{color:#166534;font-weight:800}
      .fpr-text{width:100%;box-sizing:border-box;min-height:330px;margin-top:10px;padding:13px;border:1px solid #cbd5e1;border-radius:11px;background:#fff;font:11px/1.55 Segoe UI,Arial;color:#1e293b;resize:vertical;display:none}.fpr-text.show{display:block}
    `;document.head.appendChild(st);
  }

  function uidForCard(card){
    return card.querySelector('[data-fpc]')?.dataset.fpc||card.querySelector('[data-fpa]')?.dataset.fpa||card.querySelector('[data-fps]')?.dataset.fps||'';
  }
  function reportHtml(uid){
    return `<div class="fpr-box" data-fpr="${uid}"><div class="fpr-head"><div><h4>📝 Compte rendu complet du Point du vendredi</h4><div class="fpr-sub">Généré à partir de toutes les informations enregistrées pour ce vendeur.</div></div></div><div class="fpr-actions"><button class="fpr-generate" data-uid="${uid}">Générer le compte rendu complet</button><button class="fpr-copy" data-uid="${uid}" style="display:none">Copier pour CRM</button></div><div class="fpr-status"></div><textarea class="fpr-text" readonly></textarea></div>`;
  }
  function ensure(){
    if(!isAdmin())return;
    addStyle();
    document.querySelectorAll('#fpCards .fp-seller').forEach(card=>{
      const uid=uidForCard(card);if(!uid||card.querySelector(`[data-fpr="${uid}"]`))return;
      const body=card.querySelector('.fp-body')||card;
      body.insertAdjacentHTML('beforeend',reportHtml(uid));
      const box=card.querySelector(`[data-fpr="${uid}"]`);
      box.querySelector('.fpr-generate').onclick=()=>generate(uid,box);
      box.querySelector('.fpr-copy').onclick=()=>copyReport(box);
      restoreSaved(uid,box);
    });
  }

  async function restoreSaved(uid,box){
    const client=getSb(),week=document.getElementById('fpWeek')?.value||'';if(!client||!week)return;
    const q=await client.from('friday_activity').select('crm_summary').eq('user_id',uid).eq('week_start',week).maybeSingle();
    const text=q.data?.crm_summary?.trim()||'';if(!text)return;
    const ta=box.querySelector('.fpr-text'),copy=box.querySelector('.fpr-copy');ta.value=text;ta.classList.add('show');copy.style.display='inline-block';
    box.querySelector('.fpr-status').textContent='Dernier compte rendu enregistré pour cette semaine.';
  }

  async function generate(uid,box){
    const client=getSb(),week=document.getElementById('fpWeek')?.value||'';if(!client||!week)return;
    const btn=box.querySelector('.fpr-generate'),status=box.querySelector('.fpr-status'),ta=box.querySelector('.fpr-text'),copy=box.querySelector('.fpr-copy');
    btn.disabled=true;status.className='fpr-status';status.textContent='Génération du compte rendu…';
    const prev=addDays(week,-7),next=addDays(week,7);
    try{
      const [pr,tg,ac,pv,sg,nf]=await Promise.all([
        client.from('profiles').select('user_id,display_name,sector_id').eq('user_id',uid).maybeSingle(),
        client.from('seller_activity_targets').select('*').eq('user_id',uid).maybeSingle(),
        client.from('friday_activity').select('*').eq('user_id',uid).eq('week_start',week).maybeSingle(),
        client.from('friday_activity').select('agreed_actions').eq('user_id',uid).eq('week_start',prev).maybeSingle(),
        client.from('friday_signed_deals').select('company_name,amount,client_type,sale_type,created_at').eq('user_id',uid).eq('week_start',week).order('created_at'),
        client.from('weekly_forecasts').select('company_name,amount,client_type,sale_type,probability,negotiation_meeting_scheduled,created_at').eq('user_id',uid).eq('week_start',next).order('created_at')
      ]);
      const errors=[pr,tg,ac,pv,sg,nf].map(x=>x.error).filter(Boolean);if(errors.length)throw errors[0];
      const seller=pr.data||{},target={...DEFAULTS,...(tg.data||{})},a=ac.data||{},previousAction=(pv.data?.agreed_actions||'').trim(),signed=sg.data||[],forecast=nf.data||[];
      const missing=[];
      if(!ac.data)missing.push('chiffres / contrôles de la semaine');
      if(previousAction&&!a.previous_action_status)missing.push('validation de l’action précédente');
      if(previousAction&&a.previous_action_status==='not_done'&&!String(a.previous_action_comment||'').trim())missing.push('explication de l’action non faite');
      if(!String(a.agreed_actions||'').trim())missing.push('nouvelle action à mener');

      let signedCL=0,signedNC=0,signedTotal=0;signed.forEach(r=>{const x=n(r.amount);signedTotal+=x;if(r.client_type==='nouveau')signedNC+=x;else signedCL+=x});
      let nextCL=0,nextNC=0,nextTotal=0;forecast.forEach(r=>{const x=n(r.amount);nextTotal+=x;if(r.client_type==='nouveau')nextNC+=x;else nextCL+=x});
      const metricLines=METRICS.map(([ak,tk,label])=>{const p=pct(a[ak],target[tk]);const state=p>=100?'Atteint':p>=80?'À surveiller':'À travailler';return `- ${label} : ${n(a[ak])} / objectif ${n(target[tk])} — ${p}% — ${state}`});
      const monthPct=pct(a.deals_created_month,target.deals_created_month);
      const goods=[],lows=[];METRICS.forEach(([ak,tk,label])=>{const p=pct(a[ak],target[tk]);if(p>=100)goods.push(label);else if(p<80)lows.push(label)});
      const signedLines=signed.length?signed.map(r=>`- ${r.company_name||'Entreprise'} — ${euro(r.amount)} — ${r.client_type==='nouveau'?'NC':'CL'} — ${cap(r.sale_type||'classique')}`):['- Aucune affaire signée renseignée.'];
      const forecastLines=forecast.length?forecast.map(r=>`- ${r.company_name||'Entreprise'} — ${euro(r.amount)} — ${r.client_type==='nouveau'?'NC':'CL'} — ${cap(r.sale_type||'classique')} — probabilité ${n(r.probability)}% — RDV négo : ${r.negotiation_meeting_scheduled?'Oui':'Non'}`):['- Aucune affaire renseignée pour la semaine prochaine.'];
      const automatic=[];if(goods.length)automatic.push(`Points atteints : ${goods.join(', ')}.`);if(lows.length)automatic.push(`Points à travailler : ${lows.join(', ')}.`);if(!goods.length&&!lows.length)automatic.push('Activité globalement proche des objectifs.');
      const text=[
        `COMPTE RENDU POINT DU VENDREDI — ${seller.display_name||'Vendeur'} — Secteur ${seller.sector_id||'—'}`,
        `Semaine du ${frDate(week)}`,
        '',
        '1. ACTIVITÉ DE LA SEMAINE',
        ...metricLines,
        `- Créations dans le mois : ${n(a.deals_created_month)} / objectif ${n(target.deals_created_month)} — ${monthPct}%`,
        '',
        '2. CONTRÔLES DU VENDREDI',
        `- Agenda à jour : ${yes(!!a.agenda_up_to_date)}`,
        `- Portefeuille à jour : ${yes(!!a.portfolio_up_to_date)}`,
        `- KM : ${yes(!!a.km_up_to_date)}`,
        '',
        '3. AFFAIRES SIGNÉES CETTE SEMAINE',
        `Total signé : ${euro(signedTotal)} — CL : ${euro(signedCL)} — NC : ${euro(signedNC)} — ${signed.length} affaire${signed.length>1?'s':''}`,
        ...signedLines,
        '',
        '4. ACTION DU POINT PRÉCÉDENT',
        `Action : ${previousAction||'Aucune action enregistrée la semaine précédente.'}`,
        previousAction?`Statut : ${statusLabel(a.previous_action_status)}`:'',
        previousAction&&a.previous_action_status!=='done'?`Explication : ${String(a.previous_action_comment||'Non renseignée')}`:'',
        '',
        '5. COMMENTAIRE MANAGER',
        String(a.manager_comment||'Aucun commentaire manager renseigné.'),
        '',
        '6. ACTION À MENER',
        String(a.agreed_actions||'Aucune nouvelle action renseignée.'),
        '',
        `7. PRÉVISIONNEL SEMAINE PROCHAINE — semaine du ${frDate(next)}`,
        `Prévisionnel total : ${euro(nextTotal)} — CL : ${euro(nextCL)} — NC : ${euro(nextNC)} — ${forecast.length} affaire${forecast.length>1?'s':''}`,
        ...forecastLines,
        '',
        '8. SYNTHÈSE AUTOMATIQUE',
        ...automatic,
        missing.length?`Éléments à compléter : ${missing.join(', ')}.`:'Point du vendredi complet.'
      ].filter(x=>x!==''||true).join('\n');

      const save=await client.from('friday_activity').upsert({user_id:uid,week_start:week,crm_summary:text,summary_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'user_id,week_start'});
      if(save.error)throw save.error;
      ta.value=text;ta.classList.add('show');copy.style.display='inline-block';
      status.className='fpr-status '+(missing.length?'warn':'ok');
      status.textContent=missing.length?'Compte rendu généré — à compléter : '+missing.join(', ')+'.':'Compte rendu complet généré et enregistré.';
    }catch(e){status.className='fpr-status warn';status.textContent='Erreur : '+(e?.message||e)}finally{btn.disabled=false}
  }

  async function copyReport(box){
    const ta=box.querySelector('.fpr-text'),status=box.querySelector('.fpr-status');if(!ta?.value)return;
    try{await navigator.clipboard.writeText(ta.value);status.className='fpr-status ok';status.textContent='Compte rendu copié pour le CRM.'}
    catch(e){ta.focus();ta.select();document.execCommand('copy');status.className='fpr-status ok';status.textContent='Compte rendu copié.'}
  }

  setInterval(()=>{if(!mounting){mounting=true;try{ensure()}finally{mounting=false}}},1200);
  window.addEventListener('load',()=>setTimeout(ensure,1800));
})();