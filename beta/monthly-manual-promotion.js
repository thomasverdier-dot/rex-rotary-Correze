/* Promotion explicite au prévisionnel mensuel, sans remonter automatiquement les semaines. */
(()=>{
 const db=()=>{try{return sb}catch(e){return null}};
 const role=()=>{try{return (profile||currentProfile)?.role}catch(e){return ''}};
 const own=()=>{try{return (user||currentUser)?.id}catch(e){return ''}};
 const start=date=>String(date||'').slice(0,7)+'-01';
 const norm=v=>String(v||'').trim().replace(/\s+/g,' ').toLowerCase();
 function normalize(type){return type==='nouveau'?'nouveau':'acquis'}
 function sale(type){return type==='up'||type==='up_sell'||type==='cross'||type==='cross_sell'?'up_sell':'classique'}
 async function importDeal(data,sourceDate,mode='forecast'){
   const client=db(),uid=data.user_id;
   if(!client||!uid||!sourceDate)return {ok:false,message:'Session ou date indisponible.'};
   if(role()!=='admin'&&own()!==uid)return {ok:false,message:'Droits insuffisants.'};
   const month_start=start(sourceDate);
   const company_name=String(data.company_name||'').trim();
   if(!company_name||!Number.isFinite(Number(data.amount))||Number(data.amount)<=0)return {ok:false,message:'Entreprise ou montant incorrect.'};
   // Vérification côté client pour un message lisible ; la contrainte unique Supabase protège aussi des courses.
   const existing=await client.from('monthly_forecasts').select('id,company_name').eq('user_id',uid).eq('month_start',month_start);
   if(existing.error)return {ok:false,message:existing.error.message};
   if((existing.data||[]).some(x=>norm(x.company_name)===norm(company_name)))return {ok:false,already:true,message:'Cette affaire figure déjà dans le prévisionnel du mois.'};
   const row={user_id:uid,month_start,company_name,amount:Number(data.amount),client_type:normalize(data.client_type),sale_type:normalize(data.client_type)==='nouveau'?'classique':sale(data.sale_type),probability:mode==='signed'?100:Number(data.probability??50),negotiation_meeting_scheduled:mode==='signed'?false:!!data.negotiation_meeting_scheduled,sale_completed:mode==='signed'};
   const result=await client.from('monthly_forecasts').insert(row);
   if(result.error)return {ok:false,already:result.error.code==='23505',message:result.error.code==='23505'?'Cette affaire figure déjà dans le prévisionnel du mois.':result.error.message};
   return {ok:true,message:'Ajouté au prévisionnel de '+month_start.slice(0,7)+(mode==='signed'?' (vente réalisée).':'.')};
 }
 window.rexPromoteToMonth=importDeal;
})();
