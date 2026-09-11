(()=>{
  const WORK_MONTHS=11.25;
  const AUGUST_WEIGHT=0.25;
  let lastSig='';

  function num(v){
    const s=String(v??'').trim().replace(/\s/g,'').replace(',','.');
    const n=Number(s);return Number.isFinite(n)?n:0;
  }
  function fmt(v){return num(v).toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:2})}
  function fullMonth(target){return num(target)/WORK_MONTHS}
  function august(target){return fullMonth(target)*AUGUST_WEIGHT}
  function addStyle(){
    if(document.getElementById('fiscal1125Style'))return;
    const s=document.createElement('style');s.id='fiscal1125Style';s.textContent=`
      .fst-1125-note{margin:0 0 14px;padding:10px 12px;border:1px solid #bfdbfe;background:#eff6ff;border-radius:12px;color:#0e2f68;font-size:10px;font-weight:800}
      .fst-1125-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(15,23,42,.055);margin-bottom:14px}
      .fst-1125-card h3{margin:0 0 4px;color:#10233f;font-size:17px}.fst-1125-sub{font-size:10px;color:#64748b;margin-bottom:12px}.fst-1125-wrap{overflow:auto}
      .fst-1125-table{width:100%;border-collapse:collapse;min-width:760px;font-size:11px}.fst-1125-table th,.fst-1125-table td{padding:8px;border-bottom:1px solid #edf2f7;text-align:right}.fst-1125-table th{background:#f8fafc;color:#475569;font-weight:900}.fst-1125-table th:first-child,.fst-1125-table td:first-child{text-align:left}.fst-1125-aug{color:#b45309;font-weight:900}
    `;document.head.appendChild(s)
  }
  function targetRows(){
    const body=document.getElementById('fstTargetBody');if(!body)return[];
    return [...body.querySelectorAll('tr')].map(tr=>{
      const first=tr.querySelector('td')?.textContent?.trim()||'Objectif';
      const vals={};tr.querySelectorAll('input[data-field]').forEach(i=>vals[i.dataset.field]=num(i.value));
      return {name:first,ca:vals.ca_target||0,nc:vals.nc_target||0,up:vals.upcross_target||0};
    }).filter(x=>x.name)
  }
  function signature(rows){return rows.map(r=>[r.name,r.ca,r.nc,r.up].join('|')).join('§')}
  function ensureNote(page){
    let note=document.getElementById('fst1125Note');if(note)return note;
    note=document.createElement('div');note.id='fst1125Note';note.className='fst-1125-note';
    note.textContent='Base de calcul commerciale : 11,25 mois productifs par exercice. Août compte pour 0,25 mois, correspondant à 3 semaines de congés.';
    const toolbar=page.querySelector('.fst-toolbar');
    if(toolbar)toolbar.insertAdjacentElement('afterend',note);else page.prepend(note);
    return note
  }
  function ensureCard(page){
    let card=document.getElementById('fst1125Card');if(card)return card;
    card=document.createElement('div');card.id='fst1125Card';card.className='fst-1125-card';
    card.innerHTML=`<h3>📐 Rythme de référence — 11,25 mois</h3><div class="fst-1125-sub">Un mois complet vaut 1. Août vaut 0,25. L’objectif annuel reste inchangé : cette zone montre simplement le rythme de production correspondant.</div><div class="fst-1125-wrap"><table class="fst-1125-table"><thead><tr><th>Objectif</th><th>CA / mois plein</th><th>CA août</th><th>NC / mois plein</th><th>NC août</th><th>UP/CROSS / mois plein</th><th>UP/CROSS août</th></tr></thead><tbody id="fst1125Body"></tbody></table></div>`;
    const agency=page.querySelector('#fstAgencyKpis')?.closest('.fst-card');
    if(agency)agency.insertAdjacentElement('afterend',card);else page.appendChild(card);
    return card
  }
  function render(){
    const page=document.getElementById('rexFiscalSalesPage');if(!page)return false;addStyle();ensureNote(page);ensureCard(page);
    const rows=targetRows();if(!rows.length)return true;const sig=signature(rows);if(sig===lastSig)return true;lastSig=sig;
    const body=document.getElementById('fst1125Body');if(!body)return true;
    body.innerHTML=rows.map(r=>`<tr><td><b>${String(r.name).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</b></td><td>${fmt(fullMonth(r.ca))}</td><td class="fst-1125-aug">${fmt(august(r.ca))}</td><td>${fmt(fullMonth(r.nc))}</td><td class="fst-1125-aug">${fmt(august(r.nc))}</td><td>${fmt(fullMonth(r.up))}</td><td class="fst-1125-aug">${fmt(august(r.up))}</td></tr>`).join('');
    return true
  }
  let tries=0;const t=setInterval(()=>{tries++;render();if(tries>240)clearInterval(t)},500);
  document.addEventListener('input',e=>{if(e.target?.closest?.('#fstTargetBody')){lastSig='';setTimeout(render,0)}});
  document.addEventListener('change',e=>{if(e.target?.id==='fstYear'){lastSig='';setTimeout(render,700)}});
  window.addEventListener('load',()=>setTimeout(render,1500));
})();