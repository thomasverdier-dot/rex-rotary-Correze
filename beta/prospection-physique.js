(()=>{
  const ENTERPRISE_API='https://recherche-entreprises.api.gouv.fr/near_point';
  const GEOCODE_API='https://data.geopf.fr/geocodage/search';
  const GEO_API='https://geo.api.gouv.fr/communes';
  const RADII=[1,2,5,10,20,35,50];
  const TARGET=20;
  const EFFECTIFS={NN:'Non employeur','00':'0 salarié','01':'1 à 2','02':'3 à 5','03':'6 à 9','11':'10 à 19','12':'20 à 49','21':'50 à 99','22':'100 à 199','31':'200 à 249','32':'250 à 499','41':'500 à 999','42':'1 000 à 1 999','51':'2 000 à 4 999','52':'5 000 à 9 999','53':'10 000 et +'};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  let startPoint=null,results=[];

  function getProfile(){try{return profile||currentProfile||null}catch(e){return null}}
  function ownPostal(cp){try{return typeof ownCp==='function'?ownCp(String(cp)):true}catch(e){return true}}
  function isKnownCp(cp){
    if(!/^\d{5}$/.test(String(cp||'')))return false;
    try{if(typeof groups!=='undefined'&&groups&&Object.keys(groups).length)return !!groups[String(cp)]}catch(e){}
    return /^19\d{3}$/.test(String(cp));
  }
  function companyEligible(x){
    if(x?.etat_administratif&&x.etat_administratif!=='A')return false;
    if(x?.categorie_entreprise&&!['PME','ETI','GE'].includes(x.categorie_entreprise))return false;
    const legal=String(x?.nature_juridique||'');
    if(['6540','6541','6542','6543'].includes(legal))return false;
    if(String(x?.activite_principale||'').toUpperCase()==='64.20Z')return false;
    return true;
  }
  function estabEligible(e){
    const cp=String(e?.code_postal||'');
    if(!e||!isKnownCp(cp))return false;
    if(e.etat_administratif&&e.etat_administratif!=='A')return false;
    const p=getProfile();if(p?.role==='seller'&&!ownPostal(cp))return false;
    const lat=Number(e.latitude),lon=Number(e.longitude);return Number.isFinite(lat)&&Number.isFinite(lon);
  }
  function distanceKm(a,b){
    const R=6371,toRad=v=>v*Math.PI/180,dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon),la1=toRad(a.lat),la2=toRad(b.lat);
    const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  }
  function addressOf(e){return e?.adresse||[e?.numero_voie,e?.indice_repetition,e?.type_voie,e?.libelle_voie,e?.code_postal,e?.libelle_commune].filter(Boolean).join(' ')||[e?.code_postal,e?.libelle_commune].filter(Boolean).join(' ')}
  function effectifOf(x,e){const c=String(e?.tranche_effectif_salarie||x?.tranche_effectif_salarie||x?.tranche_effectif_salarie_unite_legale||'');return EFFECTIFS[c]||c||'Non renseigné'}
  function apeOf(x,e){return String(e?.activite_principale||x?.activite_principale||'').toUpperCase()||'—'}
  function nameOf(x){return x?.nom_complet||x?.nom_raison_sociale||x?.denomination||'Entreprise'}
  function annuaireUrl(x,e){const id=e?.siret||x?.siren||'';return 'https://annuaire-entreprises.data.gouv.fr/entreprise/'+encodeURIComponent(id)}
  function phoneUrl(x,e){return 'https://www.google.com/search?q='+encodeURIComponent(`${nameOf(x)} ${e?.libelle_commune||''} téléphone ${x?.siren||''}`)}
  function routeUrl(e){return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(startPoint.lat+','+startPoint.lon)}&destination=${encodeURIComponent(e.latitude+','+e.longitude)}`}

  function addStyle(){if(document.getElementById('physicalProspectionStyle'))return;const s=document.createElement('style');s.id='physicalProspectionStyle';s.textContent=`
    .pp-card{background:#fff;border:1px solid #e2e8f0;border-radius:18px;padding:18px;box-shadow:0 18px 45px rgba(15,23,42,.06)}
    .pp-form{display:grid;grid-template-columns:minmax(280px,2fr) auto;gap:10px;align-items:end}.pp-field label{display:block;font-size:10px;font-weight:800;color:#64748b;margin:0 0 5px}.pp-field input{width:100%;padding:11px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}.pp-go{background:#d71920;color:#fff;border-color:#d71920;padding:11px 16px;white-space:nowrap}.pp-status{font-size:11px;color:#64748b;margin:12px 0}.pp-origin{display:none;margin:0 0 12px;padding:10px 12px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;font-size:11px;color:#475569}.pp-wrap{overflow:auto}.pp-table{width:100%;border-collapse:collapse;font-size:11px;min-width:1080px}.pp-table th,.pp-table td{padding:9px;border-bottom:1px solid #edf2f7;text-align:left;vertical-align:top}.pp-table th{background:#f8fafc;color:#475569}.pp-index{font-weight:900;color:#94a3b8}.pp-distance{font-weight:900;color:#0f6b47;white-space:nowrap}.pp-actions{display:flex;gap:5px;flex-wrap:wrap}.pp-actions a{padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;text-decoration:none;color:#10233f;font-weight:800;background:#fff;white-space:nowrap}.pp-actions a.route{background:#0f6b47;color:#fff;border-color:#0f6b47}.pp-empty{text-align:center!important;padding:28px!important;color:#64748b}.pp-note{margin-top:12px;padding:10px 12px;background:#f8fafc;border-radius:11px;color:#64748b;font-size:10px;line-height:1.45}@media(max-width:700px){.pp-form{grid-template-columns:1fr}.pp-go{width:100%}}
  `;document.head.appendChild(s)}

  function switchTo(){document.querySelectorAll('.rex-page').forEach(p=>p.classList.toggle('active',p.dataset.page==='prospection'));document.querySelectorAll('.rex-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='prospection'))}

  function mount(){
    const shell=document.getElementById('rexShellV3'),nav=shell?.querySelector('.rex-nav'),content=shell?.querySelector('.rex-content');if(!shell||!nav||!content)return false;if(document.getElementById('rexPhysicalProspectionPage'))return true;addStyle();
    const btn=document.createElement('button');btn.dataset.page='prospection';btn.id='physicalProspectionNav';btn.innerHTML='🚶 Prospection physique';btn.onclick=switchTo;const forecast=nav.querySelector('[data-page="forecasts"],#forecastMainNav,[data-page="weekly"]');nav.insertBefore(btn,forecast||nav.querySelector('[data-page="admin"]')||null);
    const page=document.createElement('section');page.className='rex-page';page.dataset.page='prospection';page.id='rexPhysicalProspectionPage';page.innerHTML=`
      <div class="rex-page-head"><div><h2>Prospection physique</h2><p>Trouve 20 établissements à visiter autour d’un code postal ou d’une adresse.</p></div></div>
      <div class="pp-card">
        <div class="pp-form"><div class="pp-field"><label>Code postal ou adresse de départ</label><input id="ppPlace" placeholder="Ex. 19100 ou 10 avenue de Paris, Brive-la-Gaillarde"></div><button id="ppSearch" class="pp-go">Trouver 20 entreprises</button></div>
        <div id="ppStatus" class="pp-status">Saisis ton point de départ. Le rayon s’élargira automatiquement jusqu’à trouver 20 établissements pertinents.</div>
        <div id="ppOrigin" class="pp-origin"></div>
        <div class="pp-wrap"><table class="pp-table"><thead><tr><th>#</th><th>Entreprise</th><th>Distance</th><th>Adresse à visiter</th><th>Effectif</th><th>APE</th><th>Actions</th></tr></thead><tbody id="ppBody"><tr><td colspan="7" class="pp-empty">Aucune recherche lancée.</td></tr></tbody></table></div>
        <div class="pp-note">Recherche basée sur les établissements géolocalisés de l’Annuaire des Entreprises. Les résultats sont triés par distance à vol d’oiseau depuis le point de départ. Pour un code postal, le point de départ est le centre de la commune correspondante. Les vendeurs restent limités à leur territoire.</div>
      </div>`;
    content.appendChild(page);page.querySelector('#ppSearch').onclick=run;page.querySelector('#ppPlace').onkeydown=e=>{if(e.key==='Enter')run()};return true;
  }

  function coordsFromFeature(f){const c=f?.centre?.coordinates||f?.geometry?.coordinates;if(!Array.isArray(c)||c.length<2)return null;return{lon:Number(c[0]),lat:Number(c[1])}}
  async function geocodePostal(cp){
    try{
      const u=new URL(GEO_API);u.searchParams.set('codePostal',cp);u.searchParams.set('fields','nom,centre,codesPostaux');u.searchParams.set('format','json');u.searchParams.set('geometry','centre');const r=await fetch(u);if(r.ok){const a=await r.json();const x=Array.isArray(a)?a[0]:null,c=coordsFromFeature(x);if(c&&Number.isFinite(c.lat)&&Number.isFinite(c.lon))return{...c,label:`${cp} — ${x.nom}`}}
    }catch(e){}
    return geocodeAddress(cp);
  }
  async function geocodeAddress(q){
    const u=new URL(GEOCODE_API);u.searchParams.set('q',q);u.searchParams.set('limit','1');u.searchParams.set('index','address');const r=await fetch(u);if(!r.ok)throw new Error('Adresse introuvable (géocodage HTTP '+r.status+').');const d=await r.json(),f=d?.features?.[0],c=f?.geometry?.coordinates;if(!f||!Array.isArray(c))throw new Error('Adresse introuvable.');return{lon:Number(c[0]),lat:Number(c[1]),label:f.properties?.label||q}
  }
  async function locate(q){return /^\d{5}$/.test(q)?geocodePostal(q):geocodeAddress(q)}

  function bestLocalEstablishment(x){
    const arr=Array.isArray(x?.matching_etablissements)?x.matching_etablissements:[];let best=null;
    for(const e of arr){if(!estabEligible(e))continue;const d=distanceKm(startPoint,{lat:Number(e.latitude),lon:Number(e.longitude)});if(!best||d<best.distance)best={e,distance:d}}
    return best;
  }
  async function fetchRadius(radius){
    const bySiren=new Map();let page=1,totalPages=1,guard=0;
    while(page<=totalPages&&bySiren.size<TARGET&&guard<40){guard++;ppStatus.textContent=`Recherche autour de ${startPoint.label} — rayon ${radius} km — ${bySiren.size}/${TARGET} trouvées…`;const u=new URL(ENTERPRISE_API);u.searchParams.set('lat',String(startPoint.lat));u.searchParams.set('long',String(startPoint.lon));u.searchParams.set('radius',String(radius));u.searchParams.set('page',String(page));u.searchParams.set('per_page','25');const r=await fetch(u);if(r.status===429){const wait=Math.max(1,Number(r.headers.get('Retry-After')||2));ppStatus.textContent=`Annuaire temporairement ralenti — reprise dans ${wait}s…`;await sleep(wait*1000);continue}if(!r.ok)throw new Error('Annuaire des Entreprises HTTP '+r.status);const d=await r.json();totalPages=Math.max(1,Number(d.total_pages||1));for(const x of d.results||[]){if(!companyEligible(x)||!x.siren)continue;const best=bestLocalEstablishment(x);if(!best)continue;const existing=bySiren.get(String(x.siren));if(!existing||best.distance<existing.distance)bySiren.set(String(x.siren),{company:x,estab:best.e,distance:best.distance})}page++;if(page<=totalPages)await sleep(170)}
    return [...bySiren.values()].sort((a,b)=>a.distance-b.distance).slice(0,TARGET);
  }

  async function run(){
    const q=document.getElementById('ppPlace').value.trim();if(!q){ppStatus.textContent='Saisis un code postal ou une adresse.';return}ppSearch.disabled=true;ppBody.innerHTML='<tr><td colspan="7" class="pp-empty">Localisation du point de départ…</td></tr>';results=[];
    try{
      startPoint=await locate(q);if(!Number.isFinite(startPoint.lat)||!Number.isFinite(startPoint.lon))throw new Error('Coordonnées de départ invalides.');ppOrigin.style.display='block';ppOrigin.innerHTML=`<b>Point de départ :</b> ${esc(startPoint.label)}`;
      let usedRadius=RADII[0];for(const radius of RADII){usedRadius=radius;results=await fetchRadius(radius);if(results.length>=TARGET)break}
      render();ppStatus.textContent=`${results.length} établissement${results.length>1?'s':''} trouvé${results.length>1?'s':''}, trié${results.length>1?'s':''} par proximité — rayon utilisé : ${usedRadius} km.`;
    }catch(e){ppStatus.textContent='Erreur : '+(e?.message||e);ppBody.innerHTML='<tr><td colspan="7" class="pp-empty">Impossible de préparer la tournée.</td></tr>'}
    ppSearch.disabled=false;
  }
  function render(){ppBody.innerHTML=results.length?results.map((r,i)=>{const x=r.company,e=r.estab;return `<tr><td class="pp-index">${i+1}</td><td><b>${esc(nameOf(x))}</b><br><span style="color:#64748b">SIREN ${esc(x.siren||'—')} · SIRET ${esc(e.siret||'—')}</span></td><td class="pp-distance">${r.distance<1?Math.round(r.distance*1000)+' m':r.distance.toFixed(1).replace('.',',')+' km'}</td><td>${esc(addressOf(e)||'Adresse non renseignée')}</td><td>${esc(effectifOf(x,e))}</td><td>${esc(apeOf(x,e))}</td><td><div class="pp-actions"><a class="route" target="_blank" rel="noopener" href="${routeUrl(e)}">Itinéraire</a><a target="_blank" rel="noopener" href="${annuaireUrl(x,e)}">Fiche officielle</a><a target="_blank" rel="noopener" href="${phoneUrl(x,e)}">Téléphone</a></div></td></tr>`}).join(''):'<tr><td colspan="7" class="pp-empty">Aucun établissement pertinent trouvé à proximité.</td></tr>'}

  let tries=0;const t=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(t)},250);window.addEventListener('load',()=>setTimeout(mount,900));
})();