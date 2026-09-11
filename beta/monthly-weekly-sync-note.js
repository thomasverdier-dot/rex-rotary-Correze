(()=>{
  function apply(){
    const page=document.querySelector('.rex-page[data-page="monthly"]');
    if(!page)return false;
    const note=page.querySelector('.mm-note');
    if(!note)return false;
    if(note.dataset.syncReady==='1')return true;
    note.dataset.syncReady='1';
    note.innerHTML='<b>Synchronisé avec le prévisionnel semaine.</b> Dès qu’un RDV négo est validé dans une prévision hebdomadaire, l’affaire est ajoutée automatiquement au mois correspondant. Une même société ne crée qu’une seule fiche par vendeur et par mois.';
    note.style.background='#eff6ff';
    note.style.borderColor='#bfdbfe';
    return true;
  }
  let tries=0;
  const timer=setInterval(()=>{tries++;if(apply()||tries>160)clearInterval(timer)},250);
  window.addEventListener('load',()=>setTimeout(apply,1000));
})();