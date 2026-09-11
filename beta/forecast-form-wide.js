(()=>{
  const STYLE_ID='betaWideForecastStyle';

  function addStyle(){
    if(document.getElementById(STYLE_ID))return;
    const s=document.createElement('style');
    s.id=STYLE_ID;
    s.textContent=`
      body.seller #weeklyForecast.open{padding:24px 28px 34px!important}
      body.seller #weeklyForecast .wf-grid{grid-template-columns:minmax(0,1fr)!important}
      body.seller #weeklyForecast .wf-card{padding:20px!important;border-radius:18px!important}
      body.seller #weeklyForecast .wf-title{margin-bottom:14px!important}
      body.seller #weeklyForecast .wf-title h2{font-size:19px!important}
      body.seller #weeklyForecast .wf-table{min-width:900px!important;font-size:12px!important}
      body.seller #weeklyForecast .wf-table th,
      body.seller #weeklyForecast .wf-table td{padding:10px!important}

      body.seller #weeklyForecast .wf-form.wf-wide-form{
        display:grid!important;
        grid-template-columns:minmax(220px,2fr) minmax(135px,1fr) minmax(135px,1fr) minmax(145px,1fr)!important;
        grid-template-areas:
          "company company amount probability"
          "client sale rdv add";
        gap:12px!important;
        margin-top:16px!important;
        padding:16px!important;
        border:1px solid #dbe4ef;
        border-radius:14px;
        background:#f8fafc;
        align-items:end;
      }
      body.seller #weeklyForecast .wf-wide-field{display:flex;flex-direction:column;gap:6px;min-width:0}
      body.seller #weeklyForecast .wf-wide-label{font-size:11px;font-weight:800;color:#475569;line-height:1.2}
      body.seller #weeklyForecast .wf-wide-field input,
      body.seller #weeklyForecast .wf-wide-field select{
        width:100%!important;
        min-width:0!important;
        height:44px!important;
        padding:10px 12px!important;
        border:1px solid #cbd5e1!important;
        border-radius:10px!important;
        background:#fff!important;
        font-size:14px!important;
      }
      body.seller #weeklyForecast .wf-wide-company{grid-area:company}
      body.seller #weeklyForecast .wf-wide-amount{grid-area:amount}
      body.seller #weeklyForecast .wf-wide-client{grid-area:client}
      body.seller #weeklyForecast .wf-wide-sale{grid-area:sale}
      body.seller #weeklyForecast .wf-wide-probability{grid-area:probability}
      body.seller #weeklyForecast .wf-check.wf-wide-rdv{
        grid-area:rdv;
        height:44px!important;
        padding:0 12px!important;
        display:flex!important;
        align-items:center!important;
        justify-content:flex-start!important;
        gap:8px!important;
        border-radius:10px!important;
        background:#fff!important;
        font-size:13px!important;
        font-weight:700!important;
      }
      body.seller #weeklyForecast .wf-check.wf-wide-rdv input{width:18px!important;height:18px!important;margin:0!important}
      body.seller #weeklyForecast .wf-add.wf-wide-add{
        grid-area:add;
        height:44px!important;
        padding:10px 18px!important;
        border-radius:10px!important;
        font-size:14px!important;
        align-self:end;
      }
      body.seller #weeklyForecast .wf-totals{margin-top:14px!important;gap:9px!important}
      body.seller #weeklyForecast .wf-pill{padding:7px 11px!important;font-size:12px!important}

      @media(max-width:900px){
        body.seller #weeklyForecast.open{padding:18px!important}
        body.seller #weeklyForecast .wf-form.wf-wide-form{
          grid-template-columns:1fr 1fr!important;
          grid-template-areas:none!important;
        }
        body.seller #weeklyForecast .wf-wide-field,
        body.seller #weeklyForecast .wf-check.wf-wide-rdv,
        body.seller #weeklyForecast .wf-add.wf-wide-add{grid-area:auto!important}
        body.seller #weeklyForecast .wf-wide-company{grid-column:1/-1!important}
      }
      @media(max-width:560px){
        body.seller #weeklyForecast .wf-form.wf-wide-form{grid-template-columns:1fr!important}
        body.seller #weeklyForecast .wf-wide-company{grid-column:auto!important}
      }
    `;
    document.head.appendChild(s);
  }

  function wrapField(form,selector,label,className){
    const el=form.querySelector(selector);
    if(!el||el.closest('.wf-wide-field'))return;
    const w=document.createElement('label');
    w.className='wf-wide-field '+className;
    const t=document.createElement('span');
    t.className='wf-wide-label';
    t.textContent=label;
    el.parentNode.insertBefore(w,el);
    w.appendChild(t);
    w.appendChild(el);
  }

  function enhanceForm(form){
    if(!document.body.classList.contains('seller'))return;
    if(form.dataset.wideForecast==='1')return;
    form.dataset.wideForecast='1';
    form.classList.add('wf-wide-form');
    wrapField(form,'.company','Entreprise','wf-wide-company');
    wrapField(form,'.amount','Montant (k€)','wf-wide-amount');
    wrapField(form,'.client','Type de client','wf-wide-client');
    wrapField(form,'.sale','Type de vente','wf-wide-sale');
    wrapField(form,'.prob','Probabilité (%)','wf-wide-probability');
    const rdv=form.querySelector('.wf-check');
    if(rdv){rdv.classList.add('wf-wide-rdv');rdv.title='RDV négociation calé'}
    const add=form.querySelector('.wf-add');
    if(add)add.classList.add('wf-wide-add');
  }

  function enhanceAll(){
    addStyle();
    if(!document.body.classList.contains('seller'))return;
    document.querySelectorAll('#weeklyForecast .wf-form').forEach(enhanceForm);
  }

  let tries=0;
  const timer=setInterval(()=>{
    tries++;
    enhanceAll();
    if(tries>600)clearInterval(timer);
  },500);
  window.addEventListener('load',()=>setTimeout(enhanceAll,700));
})();