(()=>{
  'use strict';
  const groups=[
    {id:'results',title:'Résultats & santé commerciale',desc:'CA, objectifs et évolution',targets:['dashboardSalesKpis','rexHistoryComparison']},
    {id:'forecast',title:'Ventes & fiabilité des prévisions',desc:'Signatures, prévisions et écarts',targets:['rexLiveSalesPerformance','rexManagerForecastReliability']},
    {id:'friday',title:'Contrôle du point du vendredi',desc:'Activité hebdomadaire et qualité du reporting',targets:['rexFridayCrmReport']}
  ];
  const expanded={results:true,forecast:false,friday:false};
  const PAGE='.rex-page[data-page="dashboard"]';
  const isManager=()=>{try{return (profile||currentProfile)?.role==='admin'}catch(e){return false}};
  function style(){
    if(document.getElementById('rxManagerFoldersStyle'))return;
    const s=document.createElement('style');s.id='rxManagerFoldersStyle';s.textContent=`
      #rxManagerFolders{margin:16px 0;padding:15px;background:#fff;border:1px solid #dce7f3;border-radius:14px;box-shadow:0 3px 16px #0f172a09}
      #rxManagerFolders h3{margin:0 0 5px;font-size:18px;color:#102d55}
      #rxManagerFolders p{margin:0 0 13px;font-size:11px;color:#64748b}
      #rxManagerFolders .rxmf-list{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:9px}
      #rxManagerFolders .rxmf-btn{display:flex;flex-direction:column;align-items:flex-start;text-align:left;gap:5px;width:100%;min-height:77px;padding:13px;border:1px solid #d9e4f1;border-radius:10px;background:#f8fbff;color:#173c66;cursor:pointer}
      #rxManagerFolders .rxmf-btn:hover{background:#eef5fd}
      #rxManagerFolders .rxmf-btn[aria-expanded="true"]{border-color:#2468ae;background:#eaf4ff}
      #rxManagerFolders .rxmf-btn strong{font-size:13px}
      #rxManagerFolders .rxmf-btn small{font-size:10px;color:#65809d;line-height:1.4}
      #rxManagerFolders .rxmf-note{margin-top:10px;font-size:11px;color:#627a95}
      .rxmf-collapsed{display:none!important}
    `;document.head.appendChild(s);
  }
  function mount(){
    const page=document.querySelector(PAGE);
    if(!page||!isManager())return;
    style();
    let nav=document.getElementById('rxManagerFolders');
    if(!nav){
      nav=document.createElement('section');nav.id='rxManagerFolders';
      nav.innerHTML='<h3>Pilotage de mon agence</h3><p>Choisis une rubrique pour consulter ses indicateurs. Une seule source de données par analyse.</p><div class="rxmf-list"></div><div class="rxmf-note">Les affaires détectées ne sont pas des signatures.</div>';
      const anchor=page.querySelector('.rex-page-head');
      if(anchor)anchor.insertAdjacentElement('afterend',nav);else page.prepend(nav);
      const list=nav.querySelector('.rxmf-list');
      const labels=[...groups,{id:'portfolio',title:'Affaires créées · RNV / NC / UC',desc:'Nombre et potentiel en k€ par vendeur'}];
      labels.forEach(g=>{
        const btn=document.createElement('button');btn.type='button';btn.className='rxmf-btn';btn.dataset.group=g.id;
        btn.innerHTML='<strong></strong><small></small>';
        btn.querySelector('strong').textContent=(g.id==='results'?'▾ ':'▸ ')+g.title;
        btn.querySelector('small').textContent=g.desc;
        btn.setAttribute('aria-expanded',g.id==='results'?'true':'false');
        btn.addEventListener('click',()=>{
          if(g.id==='portfolio'){
            expanded.results=true;
            sync();
            const portfolio=document.getElementById('rxAgencyPortfolio');
            if(portfolio){portfolio.open=true;portfolio.scrollIntoView({behavior:'smooth',block:'start'});}
            else alert('Le suivi des affaires créées n’est pas encore disponible. Vérifie les droits responsable et le chargement des données.');
            return;
          }
          expanded[g.id]=!expanded[g.id];
          sync();
          if(expanded[g.id])document.getElementById(g.targets[0])?.scrollIntoView({behavior:'smooth',block:'start'});
        });
        list.appendChild(btn);
      });
    }
    sync();
  }
  function sync(){
    const nav=document.getElementById('rxManagerFolders');
    if(!nav||!isManager())return;
    groups.forEach(g=>{
      g.targets.forEach(id=>document.getElementById(id)?.classList.toggle('rxmf-collapsed',!expanded[g.id]));
      const btn=nav.querySelector('[data-group="'+g.id+'"]');
      if(btn){btn.setAttribute('aria-expanded',String(expanded[g.id]));btn.querySelector('strong').textContent=(expanded[g.id]?'▾ ':'▸ ')+g.title;}
    });
  }
  let count=0;
  const timer=setInterval(()=>{mount();if(++count>=240)clearInterval(timer)},1000);
  window.addEventListener('load',mount);
})();
