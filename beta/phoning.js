(()=>{
  const API='https://recherche-entreprises.api.gouv.fr/search';
  const EFFECTIFS={NN:'Non employeur','00':'0 salarié','01':'1 à 2','02':'3 à 5','03':'6 à 9','11':'10 à 19','12':'20 à 49','21':'50 à 99','22':'100 à 199','31':'200 à 249','32':'250 à 499','41':'500 à 999','42':'1 000 à 1 999','51':'2 000 à 4 999','52':'5 000 à 9 999','53':'10 000 et +'};
  const rank={NN:0,'00':0,'01':1,'02':3,'03':6,'11':10,'12':20,'21':50,'22':100,'31':200,'32':250,'41':500,'42':1000,'51':2000,'52':5000,'53':10000};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let generated=[];
  function getProfile(){try{return profile}catch(e){return null}}
  function getAssign(){try{return assign||{}}catch(e){return {}}}
  function cpOf(x){return String(x?.siege?.code_postal||'')}
  function cityOf(x){return x?.siege?.libelle_commune||''}
  function apeOf(x){return String(x?.activite_principale||x?.siege?.activite_principale||'').replace(/\./g,'')}
  function effectifCodeOf(x){return String(x?.tranche_effectif_salarie||x?.tranche_effectif_salarie_unite_legale||x?.siege?.tranche_effectif_salarie||'')}
  function effectifOf(x){const c=effectifCodeOf(x);return EFFECTIFS[c]||c||'Non renseigné'}
  function leadersOf(x){const a=Array.isArray(x?.dirigeants)?x.dirigeants:[];if(!a.length)return 'Non renseigné';const d=a[0];return [d.prenoms||d.prenom,d.nom].filter(Boolean).join(' ').trim()||d.denomination||'Non renseigné'}
  function phoneUrl(x){const n=x.nom_complet||x.nom_raison_sociale||x.denomination||'';return 'https://www.google.com/search?q='+encodeURIComponent(`${n} ${cityOf(x)} téléphone ${x.siren||''}`)}
  function annuaireUrl(x){return 'https://annuaire-entreprises.data.gouv.fr/entreprise/'+encodeURIComponent(x.siren||'')}
  function shuffle(a){return a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(x=>x[1])}
  function addStyle(){if(document.getElementById('phoningStyle'))return;const s=document.createElement('style');s.id='phoningStyle';s.textContent=`
    .ph-card{background:#fff;border:1px solid #e7ebf1;border-radius:18px;padding:17px;box-shadow:0 8px 28px rgba(16,35,63,.055);margin-bottom:12px}.ph-form{display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr auto;gap:9px;align-items:end}.ph-field label{display:block;font-size:10px;font-weight:800;color:#64748b;margin-bottom:5px}.ph-field select,.ph-field input{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:10px;background:#fff}.ph-go{background:#d71920;color:#fff;border-color:#d71920;padding:10px 15px}.ph-status{font-size:11px;color:#64748b;margin:10px 0}.ph-wrap{overflow:auto}.ph-table{width:100%;border-collapse:collapse;font-size:11px;min-width:1000px}.ph-table th,.ph-table td{padding:9px;border-bottom:1px solid #edf2f7;text-align:left;vertical-align:top}.ph-table th{background:#f8fafc;color:#475569}.ph-actions{display:flex;gap:5px;flex-wrap:wrap}.ph-actions a{padding:6px 8px;border:1px solid #cbd5e1;border-radius:8px;text-decoration:none;color:#10233f;font-weight:800;background:#fff}.ph-actions a.call{background:#0f6b47;color:#fff;border-color:#0f6b47}.ph-index{font-weight:900;color:#94a3b8}.ph-empty{text-align:center!important;padding:25px!important;color:#64748b}.ph-tip{padding:10px 12px;background:#f8fafc;border-radius:11px;color:#64748b;font-size:10px;line-height:1.45;margin-top:12px}@media(max-width:1250px){.ph-form{grid-template-columns:1fr 1fr 1fr}.ph-go{width:100%}}@media(max-width:750px){.ph-form{grid-template-columns:1fr 1fr}}
  `;document.head.appendChild(s)}
  function switchTo(){document.querySelectorAll('.rex-page').forEach(p=>p.classList.toggle('active',p.dataset.page==='phoning'));document.querySelectorAll('.rex-nav button').forEach(b=>b.classList.toggle('active',b.dataset.page==='phoning'))}
  function postalCodesForSector(sector){
    sector=Number(sector);const set=new Set();
    try{if(typeof territory==='function'){(territory(sector)||[]).forEach(cp=>{cp=String(cp);if(/^\d{5}$/.test(cp))set.add(cp)})}}catch(e){}
    const a=getAssign();Object.keys(a).forEach(cp=>{if(Number(a[cp])===sector&&/^\d{5}$/.test(cp))set.add(cp)});
    if(sector===1){
      try{if(typeof geo!=='undefined'&&geo?.features&&typeof locked==='function'&&typeof cps==='function'){geo.features.filter(f=>locked(f)).forEach(f=>cps(f).forEach(cp=>{cp=String(cp);if(/^\d{5}$/.test(cp))set.add(cp)}))}}catch(e){}
    }
    return [...set].sort();
  }
  function updatePostalOptions(){const list=document.getElementById('phPostalList'),input=document.getElementById('phPostal');if(!list||!input)return;const cpsList=postalCodesForSector(document.getElementById('phSector')?.value);list.innerHTML=cpsList.map(cp=>`<option value="${esc(cp)}"></option>`).join('')}
  function mount(){const shell=document.getElementById('rexShellV3'),nav=shell?.querySelector('.rex-nav'),content=shell?.querySelector('.rex-content');if(!shell||!nav||!content)return false;if(document.getElementById('rexPhoningPage'))return true;addStyle();const btn=document.createElement('button');btn.dataset.page='phoning';btn.innerHTML='☎ Session phoning';btn.onclick=switchTo;nav.appendChild(btn);const p=getProfile(),seller=p?.role==='seller';const page=document.createElement('section');page.className='rex-page';page.dataset.page='phoning';page.id='rexPhoningPage';page.innerHTML=`<div class="rex-page-head"><div><h2>Session de phoning</h2><p>Prépare une liste ciblée pour environ une heure d’appels, sans créer un CRM parallèle.</p></div></div><div class="ph-card"><div class="ph-form"><div class="ph-field"><label>Secteur</label><select id="phSector" ${seller?'disabled':''}>${[1,2,3,4].map(s=>`<option value="${s}" ${Number(p?.sector_id)===s?'selected':''}>Secteur ${s}</option>`).join('')}</select></div><div class="ph-field"><label>Code postal (optionnel)</label><input id="phPostal" list="phPostalList" inputmode="numeric" maxlength="5" placeholder="Tous les CP"><datalist id="phPostalList"></datalist></div><div class="ph-field"><label>Nombre d’entreprises</label><select id="phCount"><option value="15">15</option><option value="20">20</option><option value="25" selected>25</option><option value="30">30</option></select></div><div class="ph-field"><label>Effectif minimum</label><select id="phMin"><option value="">Tous</option><option value="01">1 salarié +</option><option value="02">3 salariés +</option><option value="03">6 salariés +</option><option value="11">10 salariés +</option><option value="12">20 salariés +</option><option value="21">50 salariés +</option></select></div><div class="ph-field"><label>Code APE (optionnel)</label><input id="phApe" placeholder="Ex. 4321A"></div><button id="phGenerate" class="ph-go">Générer la session</button></div><div id="phStatus" class="ph-status">Choisis ton secteur, éventuellement un code postal précis, puis génère ta session.</div><div class="ph-wrap"><table class="ph-table"><thead><tr><th>#</th><th>Entreprise</th><th>CP</th><th>Effectif</th><th>APE</th><th>Dirigeant</th><th>Actions</th></tr></thead><tbody id="phBody"><tr><td colspan="7" class="ph-empty">Aucune session générée.</td></tr></tbody></table></div><div class="ph-tip">Administrateur : un code postal saisi lance directement la recherche sur ce CP. Vendeur : le CP doit appartenir à son secteur. Le secteur 1 inclut automatiquement les communes verrouillées comme Brive / 19100. Les comptes-rendus restent à saisir dans le CRM officiel.</div></div>`;content.appendChild(page);page.querySelector('#phGenerate').onclick=generate;page.querySelector('#phSector').onchange=updatePostalOptions;updatePostalOptions();return true}
  async function generate(){
    const p=getProfile(),sector=Number(document.getElementById('phSector').value),count=Number(document.getElementById('phCount').value),min=document.getElementById('phMin').value,ape=document.getElementById('phApe').value.trim().toUpperCase().replace(/\./g,''),postal=document.getElementById('phPostal').value.trim();
    let cpsList=postalCodesForSector(sector);
    if(postal){
      if(!/^19\d{3}$/.test(postal)){phStatus.textContent='Saisis un code postal de Corrèze sur 5 chiffres (ex. 19100).';return}
      if(p?.role==='seller'&&!cpsList.includes(postal)){phStatus.textContent=`Le code postal ${postal} n’appartient pas à ton secteur.`;return}
      cpsList=[postal];
    }else if(!cpsList.length){phStatus.textContent='Aucun code postal attribué à ce secteur.';return}
    cpsList=shuffle(cpsList);phGenerate.disabled=true;phStatus.textContent=postal?`Préparation de la session sur le ${postal}…`:'Préparation de la session sur tout le secteur…';phBody.innerHTML='<tr><td colspan="7" class="ph-empty">Recherche des entreprises…</td></tr>';const out=[],seen=new Set();
    try{
      for(const cp of cpsList){
        for(let pg=1;pg<=8&&out.length<count;pg++){
          const params=new URLSearchParams({page:String(pg),per_page:'25',etat_administratif:'A',code_postal:cp});if(ape)params.set('code_naf',ape.length===5?ape.slice(0,2)+'.'+ape.slice(2):ape);
          const r=await fetch(API+'?'+params.toString());if(!r.ok)continue;const d=await r.json(),raw=d.results||[];
          for(const x of raw){const siren=String(x.siren||'');if(!siren||seen.has(siren)||cpOf(x)!==cp)continue;if(ape&&apeOf(x)!==ape)continue;if(min&&(rank[effectifCodeOf(x)]||0)<(rank[min]||0))continue;seen.add(siren);out.push(x);if(out.length>=count)break}
          if(raw.length<25)break;
        }
        if(out.length>=count)break;
      }
      generated=shuffle(out).slice(0,count);render();phStatus.textContent=`Session prête : ${generated.length} entreprise${generated.length>1?'s':''} — ${postal?'CP '+postal:'Secteur '+sector}.`;
    }catch(e){phStatus.textContent='Erreur pendant la préparation : '+e.message;phBody.innerHTML='<tr><td colspan="7" class="ph-empty">Impossible de générer la session.</td></tr>'}
    phGenerate.disabled=false;
  }
  function render(){phBody.innerHTML=generated.length?generated.map((x,i)=>{const name=x.nom_complet||x.nom_raison_sociale||x.denomination||'Entreprise';return `<tr><td class="ph-index">${i+1}</td><td><b>${esc(name)}</b><br><span style="color:#64748b">${esc(cityOf(x))}</span></td><td>${esc(cpOf(x))}</td><td>${esc(effectifOf(x))}</td><td>${esc(apeOf(x)||'—')}</td><td>${esc(leadersOf(x))}</td><td><div class="ph-actions"><a class="call" target="_blank" rel="noopener" href="${phoneUrl(x)}">Trouver téléphone</a><a target="_blank" rel="noopener" href="${annuaireUrl(x)}">Fiche officielle</a></div></td></tr>`}).join(''):'<tr><td colspan="7" class="ph-empty">Aucune entreprise trouvée avec ces critères.</td></tr>'}
  let tries=0;const t=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(t)},250);window.addEventListener('load',()=>setTimeout(mount,900));
})();