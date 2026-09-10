(()=>{
  const API='https://recherche-entreprises.api.gouv.fr/search';
  const PAGE_SIZE=25;
  const API_PAGE_SIZE=25;
  const EFFECTIFS={NN:'Non employeur','00':'0 salarié','01':'1 à 2','02':'3 à 5','03':'6 à 9','11':'10 à 19','12':'20 à 49','21':'50 à 99','22':'100 à 199','31':'200 à 249','32':'250 à 499','41':'500 à 999','42':'1 000 à 1 999','51':'2 000 à 4 999','52':'5 000 à 9 999','53':'10 000 et +'};
  const rank={NN:0,'00':0,'01':1,'02':3,'03':6,'11':10,'12':20,'21':50,'22':100,'31':200,'32':250,'41':500,'42':1000,'51':2000,'52':5000,'53':10000};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();

  let apiPage=1,apiDone=false,rows=[],seen=new Set(),currentPage=1,lastCriteria=null,loading=false;

  function getProfile(){try{return profile}catch(e){return null}}
  function getOwnCp(cp){try{return typeof ownCp==='function'?ownCp(String(cp)):true}catch(e){return true}}
  function cpOf(x){return String(x?.siege?.code_postal||'')}
  function cityOf(x){return x?.siege?.libelle_commune||x?.siege?.commune||''}
  function addressOf(x){const s=x?.siege||{};return s.adresse||[s.numero_voie,s.indice_repetition,s.type_voie,s.libelle_voie,s.code_postal,s.libelle_commune].filter(Boolean).join(' ')||''}
  function apeOf(x){return String(x?.activite_principale||x?.siege?.activite_principale||'').replace(/\./g,'')}
  function apeLabelOf(x){return x?.libelle_activite_principale||x?.siege?.libelle_activite_principale||''}
  function effectifCodeOf(x){return String(x?.tranche_effectif_salarie||x?.tranche_effectif_salarie_unite_legale||x?.siege?.tranche_effectif_salarie||'')}
  function effectifOf(x){const c=effectifCodeOf(x);return EFFECTIFS[c]||c||'Non renseigné'}
  function phoneOf(x){const s=x?.siege||{};return x?.telephone||x?.telephone1||x?.numero_telephone||s.telephone||s.telephone1||s.numero_telephone||''}
  function isKnownTerritoryCp(cp){
    if(!cp)return false;
    try{if(typeof groups!=='undefined'&&groups&&Object.keys(groups).length)return !!groups[String(cp)]}catch(e){}
    return /^19\d{3}$/.test(String(cp));
  }
  function allowedHeadOffice(x){
    const cp=cpOf(x);if(!x?.siege||!cp||!isKnownTerritoryCp(cp))return false;
    const p=getProfile();if(p?.role==='seller'&&!getOwnCp(cp))return false;
    return true;
  }
  function leadersOf(x){
    const a=Array.isArray(x?.dirigeants)?x.dirigeants:[];
    if(!a.length)return 'Non renseigné';
    return a.slice(0,3).map(d=>{
      const n=[d.prenoms||d.prenom,d.nom].filter(Boolean).join(' ').trim()||d.denomination||d.raison_sociale||'Dirigeant';
      const q=d.qualite||d.fonction||d.role||'';
      return q?`${n} — ${q}`:n;
    }).join(' · ');
  }
  function webPhoneUrl(x){const name=x.nom_complet||x.nom_raison_sociale||x.denomination||'';return 'https://www.google.com/search?q='+encodeURIComponent(`${name} ${cityOf(x)} téléphone ${x.siren||''}`)}
  function annuaireUrl(x){return 'https://annuaire-entreprises.data.gouv.fr/entreprise/'+encodeURIComponent(x.siren||'')}

  function addStyle(){if(document.getElementById('prospectionStyle'))return;const s=document.createElement('style');s.id='prospectionStyle';s.textContent=`
    .pro-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;box-shadow:0 18px 45px rgba(15,23,42,.06)}
    .pro-form{display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:9px;align-items:end}.pro-field label{display:block;font-size:10px;font-weight:800;color:#64748b;margin:0 0 5px}.pro-field input,.pro-field select{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}.pro-search{background:#d71920;color:#fff;border-color:#d71920;padding:10px 16px}.pro-meta{font-size:11px;color:#64748b;margin:12px 0}.pro-wrap{overflow:auto}.pro-table{width:100%;border-collapse:collapse;font-size:11px;min-width:1120px}.pro-table th,.pro-table td{padding:9px;border-bottom:1px solid #edf2f7;text-align:left;vertical-align:top}.pro-table th{background:#f8fafc;color:#475569;position:sticky;top:0}.pro-name{font-size:12px;color:#0f172a}.pro-ape{white-space:nowrap}.pro-actions{display:flex;gap:5px;flex-wrap:wrap}.pro-actions a{display:inline-block;text-decoration:none;border:1px solid #cbd5e1;border-radius:8px;padding:6px 8px;color:#0f172a;background:#fff;font-weight:700}.pro-actions a.phone{background:#0f6b47;color:#fff;border-color:#0f6b47}.pro-phone{font-weight:800;color:#0f6b47}.pro-empty{text-align:center;padding:28px!important;color:#64748b}.pro-check{display:flex;gap:7px;align-items:center;font-size:11px;margin-top:9px}.pro-check input{width:auto}.pro-note{margin-top:12px;padding:10px 12px;border-radius:10px;background:#f8fafc;color:#64748b;font-size:10px;line-height:1.45}.pro-pager{display:flex;justify-content:center;align-items:center;gap:8px;margin-top:14px}.pro-pager button{padding:8px 12px}.pro-pager button:disabled{opacity:.4;cursor:not-allowed}.pro-page{font-weight:800;color:#0f172a;min-width:70px;text-align:center}
    @media(max-width:1100px){.pro-form{grid-template-columns:1fr 1fr}.pro-search{width:100%}}
  `;document.head.appendChild(s)}

  function switchTo(){document.querySelectorAll('.rex-page').forEach(p=>p.classList.toggle('active',p.dataset.page==='prospection'));document.querySelectorAll('.rex-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='prospection'))}
  function mount(){
    const shell=document.getElementById('rexShellV3'),nav=shell?.querySelector('.rex-nav'),content=shell?.querySelector('.rex-content');
    if(!shell||!nav||!content)return false;if(document.getElementById('rexProspectionPage'))return true;addStyle();
    const btn=document.createElement('button');btn.dataset.page='prospection';btn.innerHTML='🔎 Prospection';btn.onclick=switchTo;const weekly=nav.querySelector('[data-page="weekly"]');nav.insertBefore(btn,weekly||null);
    const page=document.createElement('section');page.className='rex-page';page.dataset.page='prospection';page.id='rexProspectionPage';page.innerHTML=`
      <div class="rex-page-head"><div><h2>Prospection entreprises</h2><p>Uniquement les sièges sociaux situés dans les codes postaux du territoire.</p></div></div>
      <div class="pro-card">
        <div class="pro-form">
          <div class="pro-field"><label>Nom de l’entreprise ou SIREN</label><input id="proQ" placeholder="Ex. Dupont BTP ou 123456789"></div>
          <div class="pro-field"><label>Commune ou code postal du siège</label><input id="proPlace" placeholder="Ex. Brive ou 19100"></div>
          <div class="pro-field"><label>Code APE</label><input id="proApe" placeholder="Ex. 4321A"></div>
          <div class="pro-field"><label>Effectif minimum</label><select id="proEffectif"><option value="">Tous</option><option value="01">1 salarié +</option><option value="02">3 salariés +</option><option value="03">6 salariés +</option><option value="11">10 salariés +</option><option value="12">20 salariés +</option><option value="21">50 salariés +</option><option value="22">100 salariés +</option></select></div>
          <button id="proSearch" class="pro-search">Rechercher</button>
        </div>
        <label class="pro-check"><input id="proPhoneOnly" type="checkbox"> Afficher uniquement les entreprises avec téléphone déjà disponible</label>
        <div id="proStatus" class="pro-meta">Renseigne au moins un critère de recherche.</div>
        <div class="pro-wrap"><table class="pro-table"><thead><tr><th>Entreprise</th><th>SIREN</th><th>Effectif</th><th>Code APE</th><th>Siège social</th><th>Dirigeant</th><th>Téléphone</th><th>Actions</th></tr></thead><tbody id="proBody"><tr><td colspan="8" class="pro-empty">Aucune recherche lancée.</td></tr></tbody></table></div>
        <div id="proPager" class="pro-pager" style="display:none"><button id="proPrev">← Précédent</button><span id="proPage" class="pro-page">Page 1</span><button id="proNext">Suivant →</button></div>
        <div class="pro-note">25 sièges sociaux maximum sont affichés par page. L’application parcourt automatiquement les pages de l’annuaire jusqu’à remplir la page avec des entreprises réellement éligibles.</div>
      </div>`;
    content.appendChild(page);
    const go=()=>startSearch();page.querySelector('#proSearch').onclick=go;['#proQ','#proPlace','#proApe'].forEach(sel=>page.querySelector(sel).onkeydown=e=>{if(e.key==='Enter')go()});
    page.querySelector('#proPrev').onclick=()=>changePage(currentPage-1);page.querySelector('#proNext').onclick=()=>changePage(currentPage+1);
    return true;
  }

  function readCriteria(){return{q:proQ.value.trim(),place:proPlace.value.trim(),ape:proApe.value.trim().toUpperCase().replace(/\./g,''),minCode:proEffectif.value,phoneOnly:proPhoneOnly.checked}}
  function buildParams(c,page){const params=new URLSearchParams({page:String(page),per_page:String(API_PAGE_SIZE),etat_administratif:'A'});if(c.q){const digits=c.q.replace(/\s/g,'');params.set('q',/^\d{9}$/.test(digits)?'siren:'+digits:c.q)}if(/^\d{5}$/.test(c.place))params.set('code_postal',c.place);if(c.ape)params.set('code_naf',c.ape.length===5?c.ape.slice(0,2)+'.'+c.ape.slice(2):c.ape);return params}
  function matchesFilters(x,c){
    if(!allowedHeadOffice(x))return false;
    if(/^\d{5}$/.test(c.place)&&cpOf(x)!==c.place)return false;
    if(c.place&&!/^\d{5}$/.test(c.place)){const p=norm(c.place);if(!norm(cityOf(x)).includes(p)&&!norm(addressOf(x)).includes(p))return false}
    if(c.ape&&apeOf(x)!==c.ape)return false;
    if(c.minCode&&(rank[effectifCodeOf(x)]||0)<(rank[c.minCode]||0))return false;
    if(c.phoneOnly&&!phoneOf(x))return false;
    return true;
  }
  async function fetchOneApiPage(){
    if(apiDone||loading)return;loading=true;
    try{
      const r=await fetch(API+'?'+buildParams(lastCriteria,apiPage).toString());if(!r.ok)throw new Error('Erreur API '+r.status);const d=await r.json();const raw=d.results||[];
      raw.forEach(x=>{const siren=String(x.siren||'');if(!siren||seen.has(siren)||!matchesFilters(x,lastCriteria))return;seen.add(siren);rows.push(x)});
      const totalPages=Number(d.total_pages||d.totalPages||0);if(raw.length<API_PAGE_SIZE||(totalPages&&apiPage>=totalPages))apiDone=true;apiPage++;
    }finally{loading=false}
  }
  async function ensureRows(count){let guard=0;while(rows.length<count&&!apiDone&&guard<100){guard++;await fetchOneApiPage()}}
  async function startSearch(){
    const c=readCriteria();if(!c.q&&!c.place&&!c.ape){proStatus.textContent='Renseigne au moins un nom/SIREN, une commune/code postal ou un code APE.';return}
    lastCriteria=c;apiPage=1;apiDone=false;rows=[];seen=new Set();currentPage=1;proBody.innerHTML='<tr><td colspan="8" class="pro-empty">Chargement…</td></tr>';proStatus.textContent='Recherche des sièges sociaux en cours…';
    try{await ensureRows(PAGE_SIZE+1);renderPage()}catch(e){proStatus.textContent='Erreur : '+e.message;proBody.innerHTML='<tr><td colspan="8" class="pro-empty">Impossible de charger les résultats.</td></tr>'}
  }
  async function changePage(page){if(page<1||loading)return;currentPage=page;proBody.innerHTML='<tr><td colspan="8" class="pro-empty">Chargement de la page…</td></tr>';proStatus.textContent='Recherche des sièges sociaux suivants…';try{await ensureRows(currentPage*PAGE_SIZE+1);if((currentPage-1)*PAGE_SIZE>=rows.length&&apiDone)currentPage=Math.max(1,currentPage-1);renderPage()}catch(e){proStatus.textContent='Erreur : '+e.message}}
  function renderPage(){
    const start=(currentPage-1)*PAGE_SIZE,end=start+PAGE_SIZE,list=rows.slice(start,end),hasNext=rows.length>end||!apiDone,p=getProfile();
    proStatus.textContent=`${list.length} entreprise${list.length>1?'s':''} affichée${list.length>1?'s':''} — page ${currentPage}${p?.role==='seller'?' — sièges de ton secteur':' — sièges du territoire'}.`;
    proBody.innerHTML=list.length?list.map(x=>{const name=x.nom_complet||x.nom_raison_sociale||x.denomination||'Entreprise',phone=phoneOf(x),ape=apeOf(x),apeLabel=apeLabelOf(x);return `<tr><td><b class="pro-name">${esc(name)}</b><br><span style="color:#64748b">${esc(cityOf(x))}</span></td><td>${esc(x.siren||'—')}</td><td>${esc(effectifOf(x))}</td><td class="pro-ape"><b>${esc(ape||'—')}</b>${apeLabel?'<br><span style="color:#64748b">'+esc(apeLabel)+'</span>':''}</td><td>${esc(addressOf(x)||'Non renseignée')}</td><td>${esc(leadersOf(x))}</td><td>${phone?'<span class="pro-phone">'+esc(phone)+'</span>':'Non disponible'}</td><td><div class="pro-actions"><a href="${annuaireUrl(x)}" target="_blank" rel="noopener">Fiche officielle</a><a class="phone" href="${webPhoneUrl(x)}" target="_blank" rel="noopener">${phone?'Vérifier':'Trouver'} téléphone</a></div></td></tr>`}).join(''):'<tr><td colspan="8" class="pro-empty">Aucun siège social correspondant aux filtres.</td></tr>';
    proPager.style.display=(currentPage>1||hasNext)?'flex':'none';proPage.textContent='Page '+currentPage;proPrev.disabled=currentPage<=1;proNext.disabled=!hasNext;
  }

  let tries=0;const timer=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(timer)},250);window.addEventListener('load',()=>setTimeout(mount,800));
})();