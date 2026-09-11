(()=>{
  function addStyle(){
    if(document.getElementById('prospectExcelStyle'))return;
    const s=document.createElement('style');s.id='prospectExcelStyle';s.textContent=`
      .prospect-excel{border:1px solid #15803d;background:#fff;color:#166534;border-radius:10px;padding:10px 14px;font-weight:900;cursor:pointer;white-space:nowrap}
      .prospect-excel:hover{background:#f0fdf4}.prospect-excel:disabled{opacity:.55;cursor:not-allowed}
      @media(max-width:700px){.prospect-excel{width:100%}}
    `;document.head.appendChild(s)
  }
  function txt(el){return (el?.textContent||'').replace(/\s+/g,' ').trim()}
  function href(row,selector){return row.querySelector(selector)?.href||''}
  function validRows(body){return [...(body?.querySelectorAll('tr')||[])].filter(r=>!r.querySelector('.pp-empty,.ph-empty')&&r.querySelectorAll('td').length>1)}
  function safeFilePart(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,60)||'listing'}
  function stamp(){const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}-${p(d.getMinutes())}`}
  function physicalRows(){
    const body=document.getElementById('ppBody');return validRows(body).map((r,i)=>{
      const c=r.querySelectorAll('td'),meta=txt(c[1]);
      const sm=meta.match(/SIREN\s+(\d{9})/i),stm=meta.match(/SIRET\s+(\d{14})/i);
      return {
        'N°':i+1,
        'Entreprise':txt(c[1]?.querySelector('b'))||meta.split('SIREN')[0].trim(),
        'SIREN':sm?.[1]||'',
        'SIRET':stm?.[1]||'',
        'Distance':txt(c[2]),
        'Adresse à visiter':txt(c[3]),
        'Effectif':txt(c[4]),
        'APE':txt(c[5]),
        'Itinéraire':href(r,'a.route'),
        'Fiche officielle':href(r,'a[href*="annuaire-entreprises.data.gouv.fr"]'),
        'Recherche téléphone':href(r,'a[href*="google.com/search"]')
      }
    })
  }
  function phoningRows(){
    const body=document.getElementById('phBody');return validRows(body).map((r,i)=>{
      const c=r.querySelectorAll('td'),official=href(r,'a[href*="annuaire-entreprises.data.gouv.fr"]');
      const siren=(official.match(/(\d{9})(?:\D*$)/)||[])[1]||'';
      return {
        'N°':i+1,
        'Entreprise':txt(c[1]?.querySelector('b'))||txt(c[1]),
        'Commune':txt(c[1]?.querySelector('span')),
        'Code postal':txt(c[2]),
        'Effectif':txt(c[3]),
        'APE':txt(c[4]),
        'Dirigeant':txt(c[5]),
        'SIREN':siren,
        'Recherche téléphone':href(r,'a.call'),
        'Fiche officielle':official
      }
    })
  }
  function criteriaPhysical(){return txt(document.getElementById('ppOrigin'))||txt(document.getElementById('ppStatus'))}
  function criteriaPhoning(){
    const sector=document.getElementById('phSector')?.value||'',cp=document.getElementById('phPostal')?.value.trim()||'',min=document.getElementById('phMin')?.selectedOptions?.[0]?.textContent||'',ape=document.getElementById('phApe')?.value.trim()||'';
    return [`Secteur ${sector}`,cp?`CP ${cp}`:'Tous les CP',min?`Effectif: ${min}`:'',ape?`APE: ${ape}`:''].filter(Boolean).join(' · ')
  }
  function exportXlsx(mode){
    if(typeof XLSX==='undefined'){alert('Le module Excel n’est pas encore chargé. Recharge la page puis réessaie.');return}
    const physical=mode==='physical',rows=physical?physicalRows():phoningRows();
    if(!rows.length){alert('Génère d’abord un listing avant de l’exporter.');return}
    const title=physical?'Prospection physique':'Session phoning',criteria=physical?criteriaPhysical():criteriaPhoning();
    const headers=Object.keys(rows[0]);
    const aoa=[[title],[`Exporté le ${new Date().toLocaleString('fr-FR')}`],[criteria],[],headers,...rows.map(r=>headers.map(h=>r[h]??''))];
    const ws=XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges']=[XLSX.utils.decode_range(`A1:${XLSX.utils.encode_col(headers.length-1)}1`),XLSX.utils.decode_range(`A2:${XLSX.utils.encode_col(headers.length-1)}2`),XLSX.utils.decode_range(`A3:${XLSX.utils.encode_col(headers.length-1)}3`)];
    ws['!autofilter']={ref:`A5:${XLSX.utils.encode_col(headers.length-1)}${rows.length+5}`};
    ws['!cols']=headers.map(h=>({wch:Math.min(42,Math.max(10,h.length+2,...rows.map(r=>String(r[h]??'').length+2)))}));
    ws['!freeze']={xSplit:0,ySplit:5,topLeftCell:'A6',activePane:'bottomLeft',state:'frozen'};
    const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,physical?'Prospection physique':'Phoning');
    wb.Props={Title:title,Subject:'Listing commercial Rex-Rotary Corrèze',Author:'Rex-Rotary Corrèze',CreatedDate:new Date()};
    const place=physical?(document.getElementById('ppPlace')?.value||'tournee'):(document.getElementById('phPostal')?.value||`secteur-${document.getElementById('phSector')?.value||''}`);
    XLSX.writeFile(wb,`${physical?'prospection-physique':'phoning'}_${safeFilePart(place)}_${stamp()}.xlsx`,{compression:true});
  }
  function addButton(triggerId,mode){
    const trigger=document.getElementById(triggerId);if(!trigger||document.getElementById(`excel-${mode}`))return false;
    addStyle();const b=document.createElement('button');b.type='button';b.id=`excel-${mode}`;b.className='prospect-excel';b.textContent='📊 Exporter Excel';b.title='Exporter le listing actuellement affiché au format Excel';b.onclick=()=>exportXlsx(mode);trigger.insertAdjacentElement('afterend',b);return true
  }
  function mount(){const a=addButton('ppSearch','physical'),b=addButton('phGenerate','phoning');return !!(document.getElementById('excel-physical')&&document.getElementById('excel-phoning'))}
  let tries=0;const t=setInterval(()=>{tries++;if(mount()||tries>120)clearInterval(t)},500);window.addEventListener('load',()=>setTimeout(mount,1200));
})();