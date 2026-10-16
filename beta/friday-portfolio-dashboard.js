(function fridayPortfolioManager(){
  'use strict';
  const ID='rxAgencyPortfolioContent';
  const CATS=['nc','uc','rnv'];
  const LABEL={nc:'NC',uc:'UC',rnv:'RNV'};
  const kfmt=new Intl.NumberFormat('fr-FR',{minimumFractionDigits:2,maximumFractionDigits:2});
  const nfmt=new Intl.NumberFormat('fr-FR',{maximumFractionDigits:1});
  const money=v=>v==null?'—':kfmt.format(Number(v)/100000)+' k€';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getProfile=()=>{try{return profile||currentProfile||null}catch(e){return null}};
  const getSb=()=>{try{return sb}catch(e){return null}};
  const today=new Date();
  const monday=iso=>{
    const d=new Date(typeof iso==='string'?iso+'T12:00:00':iso);
    d.setHours(12,0,0,0);d.setDate(d.getDate()-(d.getDay()||7)+1);
    return d.toISOString().slice(0,10);
  };
  const previousMonday=(iso,weeks)=>{
    const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()-7*weeks);
    return d.toISOString().slice(0,10);
  };
  const currentMonday=monday(today);
  let weeks=12,rows=[],people=[],loaded=false,loading=false,lastLoaded=0,lastError='';
  const owner=()=>getProfile()?.role==='admin';
  const node=()=>document.getElementById(ID);
  const valid=r=>r&&CATS.every(k=>r['portfolio_'+k+'_count']!=null&&r['portfolio_'+k+'_cents']!=null);
  function aggregate(items){
    const res={weeks:items.length,counts:{nc:0,uc:0,rnv:0},cents:{nc:0,uc:0,rnv:0},count:0,centsTotal:0};
    for(const item of items){
      for(const k of CATS){
        const count=Number(item['portfolio_'+k+'_count']||0),cents=Number(item['portfolio_'+k+'_cents']||0);
        res.counts[k]+=count;res.cents[k]+=cents;res.count+=count;res.centsTotal+=cents;
      }
    }
    return res;
  }
  function analyze(allRows,profileRows,periodWeeks=12,reference=currentMonday){
    const start=previousMonday(reference,periodWeeks-1),priorEnd=previousMonday(start,1),
      priorStart=previousMonday(start,periodWeeks);
    const names=new Map(profileRows.map(p=>[p.user_id,p.display_name||'Commercial']));
    const userIds=[...new Set([...names.keys(),...allRows.map(r=>r.user_id)])];
    const list=userIds.map(userId=>{
      const mine=allRows.filter(r=>r.user_id===userId&&valid(r));
      const current=mine.filter(r=>r.week_start>=start&&r.week_start<=reference);
      const previous=mine.filter(r=>r.week_start>=priorStart&&r.week_start<=priorEnd);
      const currentStats=aggregate(current),oldStats=aggregate(previous);
      const fullCurrent=currentStats.weeks===periodWeeks,
        fullPrevious=oldStats.weeks===periodWeeks;
      const trend=fullCurrent&&fullPrevious&&oldStats.count>0?
        (currentStats.count/oldStats.count-1)*100:null;
      return {
        userId,name:names.get(userId)||'Ancien commercial (profil indisponible)',
        ...currentStats,previous:oldStats,trend,
        coverage:currentStats.weeks+'/'+periodWeeks,
        reliable:currentStats.weeks>=Math.min(4,periodWeeks),
        averageCount:currentStats.weeks?currentStats.count/currentStats.weeks:null,
        averageCents:currentStats.weeks?currentStats.centsTotal/currentStats.weeks:null,
        averageTicket:currentStats.count?currentStats.centsTotal/currentStats.count:null,
        complete:fullCurrent
      };
    });
    const team=aggregate(allRows.filter(r=>valid(r)&&r.week_start>=start&&r.week_start<=reference));
    return {list,team,start,end:reference,weeks:periodWeeks,completeSellers:list.filter(x=>x.complete).length};
  }
  function insight(x,benchmark){
    if(!x.weeks)return 'Aucun Point du vendredi catégorisé sur la période.';
    if(!x.reliable)return 'Premiers chiffres disponibles ; attendre au moins quatre semaines saisies pour tirer des conclusions.';
    const rank=[...CATS].sort((a,b)=>x.counts[b]-x.counts[a]);
    const best=rank[0],smallest=rank[rank.length-1];
    const main=x.count>0?'Catégorie la plus représentée : '+LABEL[best]+
      ' ('+x.counts[best]+' projets). ':'Aucun projet détecté sur les semaines renseignées. ';
    const mix=x.count>0&&x.counts[smallest]===0?
      'Aucune entrée '+LABEL[smallest]+' déclarée : vérifier si cela correspond au secteur. ':'';
    const incomplete=x.weeks<weeks?'Attention : '+x.coverage+' semaines renseignées seulement. ':'';
    let relative='';
    if(benchmark!=null&&benchmark>0){
      if(x.averageCount>=benchmark*1.25)relative='Volume de projets par semaine au-dessus de la moyenne des commerciaux disposant d’au moins 4 semaines saisies. ';
      else if(x.averageCount<=benchmark*.75)relative='Volume de projets par semaine sous la moyenne des commerciaux comparables : analyser le secteur et l’activité de détection. ';
      else relative='Rythme de création proche de la moyenne des commerciaux comparables. ';
    }
    return incomplete+main+mix+relative+
      'Rythme observé : '+nfmt.format(x.averageCount)+' projet(s) et '+money(x.averageCents)+' par semaine renseignée.';
  }
  function panel(){
    const el=node();if(!el)return;
    const data=analyze(rows,people,weeks);
    const first='<div class="rxpf-intro"><div><h4>Portefeuille détecté par commercial</h4>'+
      '<p>Projets trouvés, <b>pas des signatures</b>. Montants potentiels en k€.</p></div>'+
      '<div class="rxpf-controls"><label for="rxpfPeriod">Période</label><select id="rxpfPeriod">'+
        [[4,'4 semaines'],[12,'12 semaines'],[26,'26 semaines']].map(([n,t])=>
          '<option value="'+n+'" '+(weeks===n?'selected':'')+'>'+t+'</option>').join('')+'</select>'+
        '<button type="button" id="rxpfReload">↻ Actualiser</button></div></div>';
    if(lastError){
      el.innerHTML=first+'<div class="rxpf-error">Données indisponibles : '+esc(lastError)+
        '. Le reste du Tableau de bord fonctionne normalement.</div>';
    }else{
      const total=data.team;
      const empty=data.list.every(x=>!x.weeks);
      let body='<div class="rxpf-overview"><div><small>Projets détectés</small><strong>'+
          (total.weeks?String(total.count):'—')+'</strong></div>'+
        '<div><small>CA potentiel détecté</small><strong>'+money(total.weeks?total.centsTotal:null)+'</strong></div>'+
        '<div><small>NC · projets / k€</small><strong>'+(total.weeks?total.counts.nc+' / '+money(total.cents.nc):'—')+'</strong></div>'+
        '<div><small>UC · projets / k€</small><strong>'+(total.weeks?total.counts.uc+' / '+money(total.cents.uc):'—')+'</strong></div>'+
        '<div><small>RNV · projets / k€</small><strong>'+(total.weeks?total.counts.rnv+' / '+money(total.cents.rnv):'—')+'</strong></div></div>';
      if(empty)body+='<p class="rxpf-empty">Aucune affaire levée par catégorie n’a encore été renseignée pour cette période. Les anciennes « affaires créées » restent conservées mais ne sont pas réparties artificiellement entre NC, UC et RNV.</p>';
      const eligible=data.list.filter(x=>x.reliable);
      const benchmark=eligible.length>=2?eligible.reduce((v,x)=>v+x.averageCount,0)/eligible.length:null;
      body+='<div class="rxpf-scroll"><table class="rxpf-table"><thead><tr>'+
        '<th>Commercial</th><th>Semaines saisies</th><th>NC</th><th>UC</th><th>RNV</th>'+
        '<th>TOTAL</th><th>Rythme par semaine saisie</th><th>Montant moyen par projet</th><th>Évolution vs période précédente</th></tr></thead><tbody>'+
        data.list.map(x=>{
          const bucket=k=>x.weeks?x.counts[k]+' projet(s)<small>'+money(x.cents[k])+'</small>':'—';
          const trend=x.trend==null?'—':(x.trend>0?'+':'')+nfmt.format(x.trend)+' %';
          const cls=x.trend==null?'rxpf-neutral':x.trend>0?'rxpf-up':x.trend<0?'rxpf-down':'rxpf-neutral';
          return '<tr><th>'+esc(x.name)+'</th><td>'+x.coverage+(x.complete?'':' <small>partiel</small>')+'</td>'+
            CATS.map(k=>'<td>'+bucket(k)+'</td>').join('')+
            '<td>'+(x.weeks?'<b>'+x.count+' projet(s)</b><small>'+money(x.centsTotal)+'</small>':'—')+'</td>'+
            '<td>'+(x.weeks?nfmt.format(x.averageCount)+' projet(s)<small>'+money(x.averageCents)+'</small>':'—')+'</td>'+ 
            '<td>'+money(x.averageTicket)+'</td>'+
            '<td class="'+cls+'">'+trend+'</td></tr>';
        }).join('')+'</tbody></table></div>';
      if(!empty){
        body+='<div class="rxpf-insights"><h5>Forces et points à surveiller</h5>'+
          data.list.map(x=>'<p><b>'+esc(x.name)+' :</b> '+esc(insight(x,benchmark))+'</p>').join('')+'</div>';
      }
      body+='<p class="rxpf-note">Les semaines non renseignées ne sont jamais considérées comme des zéros. Les variations sur deux périodes sont affichées seulement si les deux périodes sont complètes. La comparaison entre commerciaux tient compte des semaines saisies, pas des différences de secteur ou de maturité commerciale. <b>Portefeuille créé ≠ CA signé</b> : ces chiffres mesurent la détection de projets.</p>';
      el.innerHTML=first+body;
    }
    const selector=el.querySelector('#rxpfPeriod');
    if(selector)selector.onchange=event=>{const n=Number(event.target.value);if(![4,12,26].includes(n))return;weeks=n;panel()};
    const reload=el.querySelector('#rxpfReload');if(reload)reload.onclick=()=>load(true);
  }
  async function load(force=false){
    if(!owner()||!node()||loading)return;
    if(loaded&&!force){panel();return}
    const client=getSb();if(!client){lastError='Connexion non initialisée';panel();return}
    loading=true;const el=node();el.textContent='Chargement des entrées portefeuille…';
    try{
      const [activity,profiles]=await Promise.all([
        client.from('friday_activity').select(
          'user_id,week_start,portfolio_nc_count,portfolio_nc_cents,portfolio_uc_count,portfolio_uc_cents,portfolio_rnv_count,portfolio_rnv_cents')
          .gte('week_start','2025-10-01').order('week_start'),
        client.from('profiles').select('user_id,display_name,role').eq('role','seller')
      ]);
      if(activity.error)throw activity.error;
      if(profiles.error)throw profiles.error;
      rows=activity.data||[];people=profiles.data||[];loaded=true;lastError='';lastLoaded=Date.now();
    }catch(error){lastError=String(error?.message||error)}
    finally{loading=false;panel()}
  }
  window.rexFridayPortfolioDashboard=function(){
    if(!owner()||!node())return false;
    if(!loaded&& !loading)load();
    else if(loaded)panel();
    return true;
  };
  // Exposé uniquement pour tests isolés, aucun chargement de données automatique.
  window.__rexPortfolioStats=Object.freeze({analyze,aggregate});
})();