/* Choix explicite et reversible d'integration dans le previsionnel mensuel. */
(()=>{
  const db=()=>{try{return sb}catch(e){return null}};
  const role=()=>{try{return (profile||currentProfile)?.role}catch(e){return ''}};
  const own=()=>{try{return (user||currentUser)?.id}catch(e){return ''}};
  const month=date=>String(date||'').slice(0,7)+'-01';
  const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toLowerCase();
  const canEdit=uid=>role()==='admin'||own()===uid;
  const clientType=v=>v==='nouveau'?'nouveau':'acquis';
  const saleType=v=>['up','up_sell','cross','cross_sell'].includes(v)?'up_sell':'classique';

  function matching(monthly,source,kind){
    const exact=monthly.find(row=>row.user_id===source.user_id&&row.source_type===kind&&row.source_id===source.id);
    const existing=exact||monthly.find(row=>row.user_id===source.user_id&&norm(row.company_name)===norm(source.company_name));
    return {
      checked:!!existing,
      locked:!!existing&&!(existing.source_type===kind&&existing.source_id===source.id),
      monthlyId:existing?.id||null,
      message:existing&&!exact?'Déjà présent au mois (autre saisie)':''
    };
  }

  async function status(deals,date,kind){
    const client=db(),period=month(date),ids=[...new Set((deals||[]).map(x=>x.user_id).filter(Boolean))];
    if(!client||!period||!ids.length)return new Map();
    const r=await client.from('monthly_forecasts')
      .select('id,user_id,company_name,source_type,source_id')
      .eq('month_start',period).in('user_id',ids);
    if(r.error)throw r.error;
    return new Map((deals||[]).map(x=>[x.id,matching(r.data||[],x,kind)]));
  }

  async function setMembership(source,date,kind,checked){
    if(!source?.id||!source.user_id||!date||!['weekly','signed'].includes(kind))
      return {ok:false,message:'Affaire non identifiée.'};
    if(!canEdit(source.user_id))
      return {ok:false,message:'Tu ne peux pas modifier les affaires de ce vendeur.'};
    const client=db(),period=month(date);
    if(!client)return {ok:false,message:'Connexion indisponible.'};
    try{
      const before=(await status([source],date,kind)).get(source.id);
      if(checked){
        if(before?.checked)return {ok:true,checked:true,locked:before.locked,message:before.message||'Cette affaire est déjà au mois.'};
        const name=String(source.company_name||'').trim(),amount=Number(source.amount);
        if(!name||!Number.isFinite(amount)||amount<=0)return {ok:false,message:'Nom ou montant invalide.'};
        const row={
          user_id:source.user_id,month_start:period,company_name:name,amount,
          client_type:clientType(source.client_type),
          sale_type:clientType(source.client_type)==='nouveau'?'classique':saleType(source.sale_type),
          probability:kind==='signed'?100:Number(source.probability??50),
          negotiation_meeting_scheduled:kind==='signed'?false:!!source.negotiation_meeting_scheduled,
          sale_completed:kind==='signed',
          source_type:kind,source_id:source.id
        };
        const r=await client.from('monthly_forecasts').insert(row).select('id').single();
        if(r.error){
          if(r.error.code==='23505'){
            const after=(await status([source],date,kind)).get(source.id);
            return {ok:!!after?.checked,checked:!!after?.checked,locked:!!after?.locked,message:after?.checked?'Déjà au prévisionnel mois.':r.error.message};
          }
          throw r.error;
        }
        return {ok:true,checked:true,locked:false,message:'Affaire intégrée au prévisionnel mois.'};
      }
      if(!before?.checked)return {ok:true,checked:false,locked:false,message:'Affaire non incluse dans le mois.'};
      if(before.locked)return {ok:false,checked:true,locked:true,message:'Cette affaire existait déjà dans le mois. Pour la retirer, passe par Prévisionnel mois.'};
      if(!confirm('Retirer cette affaire du prévisionnel mensuel ? La vente ou prévision de la semaine sera conservée.'))
        return {ok:false,cancelled:true,checked:true,locked:false,message:'Retrait annulé.'};
      const r=await client.from('monthly_forecasts').delete()
        .eq('id',before.monthlyId).eq('user_id',source.user_id)
        .eq('month_start',period).eq('source_type',kind).eq('source_id',source.id)
        .select('id');
      if(r.error)throw r.error;
      if(!r.data?.length)return {ok:false,checked:true,message:'Le retrait n’a pas été confirmé en base.'};
      return {ok:true,checked:false,locked:false,message:'Affaire retirée du prévisionnel mois.'};
    }catch(e){
      return {ok:false,message:'Erreur Supabase : '+(e?.message||e)};
    }
  }

  // Conservation de l'ancienne API pour d'eventuels modules historiques.
  window.rexPromoteToMonth=async(source,date,mode='forecast')=>{
    const r=await setMembership(source,date,mode==='signed'?'signed':'weekly',true);
    return {...r,already:!!r.locked};
  };
  window.rexMonthlyMembership=status;
  window.rexSetMonthlyMembership=setMembership;
})();