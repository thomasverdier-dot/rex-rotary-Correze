(()=>{
  function addStyle(){
    if(document.getElementById('forecastTabsStyle'))return;
    const s=document.createElement('style');s.id='forecastTabsStyle';s.textContent=`
      .forecast-tabs{display:flex;gap:8px;margin:0 0 14px;padding:6px;background:#e8eef5;border:1px solid #d8e1eb;border-radius:14px;width:max-content;max-width:100%}
      .forecast-tabs button{border:0;background:transparent;color:#475569;padding:9px 14px;border-radius:10px;font-weight:900;cursor:pointer}
      .forecast-tabs button.active{background:#fff;color:#0f172a;box-shadow:0 5px 14px rgba(15,23,42,.10)}
      @media(max-width:650px){.forecast-tabs{width:100%}.forecast-tabs button{flex:1}}
    `;document.head.appendChild(s);
  }
  function pages(){return{weekly:document.querySelector('.rex-page[data-page="weekly"]'),monthly:document.querySelector('.rex-page[data-page="monthly"]')}}
  function tabsHtml(){return '<div class="forecast-tabs"><button type="button" data-forecast-view="weekly">📅 Semaine</button><button type="button" data-forecast-view="monthly">📈 Mois</button></div>'}
  function ensureTabs(){
    addStyle();const p=pages();
    ['weekly','monthly'].forEach(k=>{const page=p[k];if(!page||page.querySelector('.forecast-tabs'))return;page.insertAdjacentHTML('afterbegin',tabsHtml());page.querySelectorAll('[data-forecast-view]').forEach(b=>b.onclick=()=>openView(b.dataset.forecastView))});
  }
  function setTabState(which){document.querySelectorAll('[data-forecast-view]').forEach(b=>b.classList.toggle('active',b.dataset.forecastView===which))}
  function openView(which='weekly'){
    ensureTabs();
    document.querySelectorAll('.rex-page').forEach(p=>p.classList.toggle('active',p.dataset.page===which));
    document.querySelectorAll('.rex-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='forecasts'));
    setTabState(which);
    if(which==='weekly'&&window.loadWeeklyForecast)setTimeout(()=>window.loadWeeklyForecast(),0);
    if(which==='monthly'&&window.loadMonthlyForecast)setTimeout(()=>window.loadMonthlyForecast(),0);
  }
  function mount(){
    const shell=document.getElementById('rexShellV3'),nav=shell?.querySelector('.rex-nav');if(!shell||!nav)return false;
    let group=nav.querySelector('[data-page="forecasts"]');
    const weeklyBtn=nav.querySelector('[data-page="weekly"]'),monthlyBtn=nav.querySelector('[data-page="monthly"]');
    if(!group){group=document.createElement('button');group.dataset.page='forecasts';group.innerHTML='📊 Prévisions';group.onclick=()=>openView('weekly');nav.insertBefore(group,weeklyBtn||monthlyBtn||nav.querySelector('[data-page="admin"]')||null)}
    weeklyBtn?.remove();monthlyBtn?.remove();ensureTabs();
    return true;
  }
  let tries=0;const t=setInterval(()=>{tries++;const ok=mount();ensureTabs();if(ok&&document.querySelector('.forecast-tabs')&&document.querySelector('.rex-page[data-page="monthly"]')?.dataset.monthlyMounted==='1'||tries>160)clearInterval(t)},250);
  window.addEventListener('load',()=>setTimeout(()=>{mount();ensureTabs()},700));
})();