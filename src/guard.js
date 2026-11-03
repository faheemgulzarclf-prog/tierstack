/* ---------- Risk manager: discipline guard, firm rules guard, multi-firm, plan drift, same-trade risk, money view ---------- */
const GUARD_W={rest:15,oversize:20,afterstop:20,nochk:3};
const GUARD_TXT={rest:"Traded in a rest week",oversize:"Lost more than the plan allows",afterstop:"Traded after the daily stop",nochk:"Traded without the checklist"};
const CHK_Q=["My setup is in my plan","Risk is the amount the coach shows","No big news on my market in the next hour"];
/* daily stop: 2 losing trades on an account in one day ends that account's day (the same trade copied to many accounts counts once per account) */
function guardLossesToday(st,a){ const t=todayStr(); return (st.dayLoss&&st.dayLoss.d===t&&st.dayLoss.by&&a)?(st.dayLoss.by[a.id]||0):0; }
function guardStopped(st,a){ return st.p.dstop!==false&&!!a&&guardLossesToday(st,a)>=2; }
/* last day a funded account was allowed to trade (end of its most recent ON week, or before it went offline) */
function lastOnEnd(a,st){ if(a.phase!==3) return null; const w=weekIdx(st); let k=w; while(k>=0&&(k%3)!==a.off) k--; if(k<0) return null; if(k===w) return null;
  return new Date(new Date(st.start+"T12:00:00").getTime()+(k*7+6)*DAY).toISOString().slice(0,10); }
function guardViol(st,a,type,extra){ st.viol=st.viol||[]; st.viol.unshift({d:todayStr(),id:a?a.id:"",name:a?a.name:"",type,x:extra||""}); st.viol=st.viol.slice(0,200);
  log(`Discipline: ${GUARD_TXT[type]}${a?" on "+a.name:""}${extra?" ("+extra+")":""}.`); }
/* called by doLog before the balance changes */
function guardOnLog(st,a,bal){
  const t=todayStr(), prev=a.bal, lost=prev-bal; if(bal===prev) return;
  const v=advise(a,st), lastLog=(a.hist.length?a.hist[a.hist.length-1][0]:a.created)||t;
  if(a.phase===3&&v.kind==="rest"&&!offline(a)){ const e=lastOnEnd(a,st); if(e&&lastLog>e) guardViol(st,a,"rest"); }
  else if(offline(a)&&v.kind==="rest"){ const s=new Date(new Date(a.offUntil+"T12:00:00").getTime()-7*DAY).toISOString().slice(0,10); if(lastLog>=s) guardViol(st,a,"rest","offline week"); }
  if(lost>0){ const r=rulesFor(a,st.p), gap=Math.max(1,Math.min(5,dnum(t)-dnum(lastLog))), n=a.rec>0?1:(st.p.tpd||1), allow=a.size*r.risk/100*n*gap*1.05+1;
    if(lost>allow) guardViol(st,a,"oversize",`lost ${fmtFull(lost)}, plan max ${fmtFull(allow)}`);
    if(!st.dayLoss||st.dayLoss.d!==t||!st.dayLoss.by) st.dayLoss={d:t,by:{}}; st.dayLoss.by[a.id]=(st.dayLoss.by[a.id]||0)+1;
    if(st.dayLoss.by[a.id]===2&&st.p.dstop!==false) log(`Daily stop on ${a.name}: 2 losing trades today. No more trades on it until tomorrow.`); }
  if(!TK.test&&["trade","recover"].includes(v.kind)){ const c=(st.chk||{})[t]; if((!c||!c.every(Boolean))&&!(st.viol||[]).some(x=>x.d===t&&x.type==="nochk")) guardViol(st,a,"nochk"); }
}
function guardScore(st){ const t=dnum(todayStr()); const v=(st.viol||[]).filter(x=>t-dnum(x.d)<30); return {score:Math.max(0,100-v.reduce((s,x)=>s+(GUARD_W[x.type]||5),0)),v}; }

/* firm consistency rule: best day's profit must stay under X% of the account's total profit */
function consistency(a,p){ const lim=+p.cons||0; if(!lim||a.phase!==3) return {on:false,ok:true};
  const h=a.hist.filter(x=>x[0]>=(a.cyc&&a.cyc.s||"")); const byDay={}; h.forEach(x=>byDay[x[0]]=x[1]);
  const days=Object.keys(byDay).sort(); let prev=a.size, best=0; days.forEach(d=>{ best=Math.max(best,byDay[d]-prev); prev=byDay[d]; });
  const total=a.bal-a.size; if(total<=0) return {on:true,ok:true,best,total,share:0,lim};
  const share=best/total*100, ok=share<=lim+1e-9, need=ok?0:best/(lim/100)-total;
  return {on:true,ok,best,total,share,lim,need}; }

/* multi-firm: share of Tier 1 at each firm */
function firmMix(st){ const act=st.accounts.filter(a=>a.status==="active"); const T1=act.filter(a=>a.phase===3).reduce((s,a)=>s+a.size,0), all=act.reduce((s,a)=>s+a.size,0);
  const m={}; act.forEach(a=>{ const f=a.firm||st.p.firm||"My firm"; const o=m[f]||(m[f]={firm:f,t1:0,all:0,n:0}); o.n++; o.all+=a.size; if(a.phase===3) o.t1+=a.size; });
  const rows=Object.values(m).map(o=>({...o,share:T1>0?o.t1/T1:o.all/Math.max(1,all)})).sort((x,y)=>y.share-x.share);
  return {rows,T1,top:rows[0]||null,over:rows.length&&rows[0].share>0.4+1e-9}; }
function firmSuggest(st){ const mix=firmMix(st), list=st.p.firms&&st.p.firms.length?st.p.firms:[]; if(!list.length) return mix.rows.length?(mix.over&&mix.rows.length>1?mix.rows[mix.rows.length-1].firm:""):"";
  const by={}; list.forEach(f=>by[f]=0); mix.rows.forEach(r=>{ if(r.firm in by) by[r.firm]=r.all; }); return list.slice().sort((x,y)=>by[x]-by[y])[0]; }

/* plan drift: real win rate vs the plan, re-run the planner with the real number */
const DRIFT_CACHE={};
function planFromState(p,wr){ return {...p,wr,horizon:48,approve:0.95,topup:0,corr:true,reserve:0,mindays:p.mindays||0,lockMax:Math.max(p.lock,p.lockMax||p.lock),ladder:p.ladder.map(r=>({...r})),reinv:p.reinv}; }
function driftMonths(p,wr){ const k=[p.target,p.s0,p.n0,wr.toFixed(3),p.rr,p.riskE,p.riskF,p.tpd,p.lock].join("|"); if(DRIFT_CACHE[k]!==undefined) return DRIFT_CACHE[k];
  let mo=null; try{ const m=portfolioSim(planFromState(p,wr),wr,60,5151); const r=m.reach[m.reach.length-1]; mo=r.length>m.runs*0.5?quant(r,0.5)/4.33:null; }catch(e){}
  DRIFT_CACHE[k]=mo; return mo; }
function drift(st){ const T=st.trades||[]; if(T.length<20) return {n:T.length,ready:false};
  const wr=T.filter(Boolean).length/T.length, p=st.p, diff=wr-p.wr; const bad=diff<=-0.07, good=diff>=0.07;
  return {n:T.length,ready:true,wr,diff,bad,good,planMo:(bad||good)?driftMonths(p,p.wr):null,realMo:(bad||good)?driftMonths(p,wr):null}; }

/* money view */
function moneyView(st){ const p=st.p, own=st.own!=null?st.own:p.n0*p.ladder[0].fee, gross=st.payouts.reduce((s,x)=>s+x.amt,0);
  const net=st.personal+st.pool-own, days=Math.max(1,dnum(todayStr())-dnum(st.start)+1), t=dnum(todayStr());
  const last30=st.payouts.filter(x=>t-dnum(x.d)<30).reduce((s,x)=>s+x.amt*(1-x.rate),0);
  const split=p.split>1?p.split/100:p.split, keep=1-(p.reinv&&p.reinv.length?p.reinv[p.reinv.length-1].rate:0.3);
  const perFunded=lockMid(p)/100*split*(52/12/3)*keep; // take-home per $1 funded per month at the goal
  return {own,gross,net,fees:st.spent,last30,avgMo:st.personal/(days/30.44),atGoal:p.target*perFunded,perFunded,days}; }

function guardCards(st,adv,pf){
  const p=st.p, g=guardScore(st), stopped=adv.filter(x=>guardStopped(st,x.a)), stop=stopped.length>0, t=todayStr(), chk=(st.chk||{})[t]||[false,false,false];
  const trading=adv.filter(x=>["trade","recover"].includes(x.v.kind));
  const risk=trading.reduce((s,x)=>s+x.v.riskUsd*(x.v.kind==="recover"?1:(p.tpd||1)),0);
  const tiersToday=[...new Set(trading.map(x=>x.a.phase))];
  const mix=firmMix(st), d=drift(st), mv=moneyView(st);
  const sc=g.score>=85?"good":g.score>=60?"warn":"bad";
  const salary=+st.salary||0, needF=salary>0&&mv.perFunded>0?salary/mv.perFunded:0;
  const fundedNow=adv.filter(x=>x.a.phase===3);
  return `<div class="gd">
  <div class="card gd-disc"><div class="gd-h"><h3 class="ct">Discipline</h3><span class="gd-score ${sc}"><b>${g.score}</b>/100</span></div>
    ${stop?`<div class="verdict bad"><span class="ic">!</span><div><b>Daily stop on ${stopped.map(x=>esc(x.a.name)).join(", ")}</b><p>2 losing trades today. No more trades on ${stopped.length>1?"them":"it"} until tomorrow. Trading after 2 losses is where most accounts are lost.</p></div></div>`:""}
    <p class="gd-sub">Before your first trade today</p>
    <div class="gd-chk">${CHK_Q.map((q,i)=>`<label><input type="checkbox" data-gchk="${i}"${chk[i]?" checked":""}> ${q}</label>`).join("")}</div>
    ${g.v.length?`<ul class="gd-v">${g.v.slice(0,4).map(x=>`<li><span>${fmtDate(x.d)}</span>${GUARD_TXT[x.type]}${x.name?" · "+esc(x.name):""} <b>−${GUARD_W[x.type]}</b></li>`).join("")}</ul>`:`<p class="hint">No rule broken in the last 30 days. Keep it that way.</p>`}
  </div>
  <div class="card gd-today"><h3 class="ct">Today's risk</h3>
    <div class="gd-big"><b>${fmtFull(risk)}</b><span>lost if every trade today goes wrong (${trading.length} account${trading.length===1?"":"s"})</span></div>
    ${tiersToday.includes(3)&&tiersToday.some(x=>x<3)?`<div class="verdict warn"><span class="ic">!</span><div><b>Funded and test accounts trade today</b><p>Don't copy the same trade to both. One bad trade should never hit Tier 1 and the tiers that refill it on the same day. Some firms also ban copying trades between accounts.</p></div></div>`:`<p class="hint">${trading.length>1?"These accounts are in the same tier, so one shared trade is expected. Never more than the risk shown.":"One trade can only hurt one tier today."}</p>`}
  </div>
  <div class="card gd-firm"><h3 class="ct">Firm risk</h3>
    ${mix.rows.map(r=>`<div class="tk-tb"><div class="tk-gtop"><span>${esc(r.firm)} · ${r.n} acct</span><span class="${r.share>0.4+1e-9?"dn":""}">${Math.round(r.share*100)}% ${mix.T1>0?"of funded":"of accounts"}</span></div><div class="tk-bar sm"><i style="width:${Math.min(100,r.share*100)}%;background:${r.share>0.4+1e-9?"var(--bad)":"var(--t1)"}"></i></div></div>`).join("")}
    <p class="hint">${mix.rows.length<=1?"All your accounts are at one firm. If it stops paying or closes, you lose everything at once. Buy your next account at a second firm.":mix.over?`${esc(mix.top.firm)} holds more than 40%. Buy the next account at another firm.`:"Good: no firm holds more than 40%."}</p>
    ${fundedNow.map(({a})=>{ const c=consistency(a,p); return c.on?`<p class="gd-cons ${c.ok?"ok":"no"}">${c.ok?"✓":"✗"} ${esc(a.name)}: best day ${c.total>0?Math.round(c.share)+"% of profit":"—"} (limit ${c.lim}%)${c.ok?"":`. Make ${fmtFull(c.need)} more with small trades before the payout.`}</p>`:""; }).join("")}
    <label class="f gd-cin">Firm consistency rule: best day max<input type="number" min="0" max="100" step="5" value="${+p.cons||0}" data-gset="cons"><span>% of profit (0 = none)</span></label>
  </div>
  <div class="card gd-drift"><h3 class="ct">Plan check</h3>
    ${!d.ready?`<p class="hint">After 20 logged trades (you have ${d.n}), we compare your real win rate with the plan every day.</p>`
    :`<div class="gd-big"><b>${Math.round(d.wr*100)}%</b><span>real win rate over ${d.n} trades · plan ${Math.round(p.wr*100)}%</span></div>
      ${d.bad?`<div class="verdict warn"><span class="ic">!</span><div><b>You are winning less than planned</b><p>${d.planMo&&d.realMo?`The goal moves from about ${Math.round(d.planMo)} to ${Math.round(d.realMo)} months.`:d.realMo===null?"At this win rate the goal is not reached within 4 years.":""} Review your last trades, or update the plan to your real numbers.</p><button type="button" class="btn ghost sm" data-gset="wr" data-v="${d.wr.toFixed(3)}">Use ${Math.round(d.wr*100)}% in my plan</button></div></div>`
      :d.good?`<p class="hint">You are winning more than planned${d.planMo&&d.realMo?`: about ${Math.round(d.realMo)} months instead of ${Math.round(d.planMo)}`:""}. Keep the same risk. Good runs end.</p>`
      :`<p class="hint">On plan. Real and planned win rate are within 7 points.</p>`}`}
  </div>
  <div class="card gd-money"><h3 class="ct">Your money</h3>
    <div class="gd-m"><div><b>${fmtFull(mv.own)}</b><span>your own money in</span></div><div><b>${fmtFull(mv.gross)}</b><span>payouts in total</span></div><div><b>${fmtFull(st.personal)}</b><span>taken home</span></div><div><b class="${mv.net>=0?"up":"dn"}">${mv.net>=0?"+":""}${fmtFull(mv.net)}</b><span>net (home + Reinvestment − your money)</span></div></div>
    <p class="hint">Last 30 days you took home ${fmtFull(mv.last30)}. At the goal (${fmt(p.target)} funded) a normal month is about ${fmtFull(mv.atGoal)}, best case.</p>
    <label class="f gd-cin">My salary target $<input type="number" min="0" step="100" value="${salary||""}" placeholder="e.g. 2000" data-gset="salary"></label>
    ${salary>0?`<p class="gd-sal">To take home ${fmtFull(salary)} a month you need about <b>${fmt(needF)}</b> funded. You have ${fmt(pf.T1)} (${Math.min(100,Math.round(pf.T1/needF*100))}%).</p>`:""}
  </div></div>`;
}
document.addEventListener("change",e=>{ const st=TK.state; if(!st) return;
  const c=e.target.closest("[data-gchk]"); if(c){ const t=todayStr(); st.chk=st.chk||{}; const a=st.chk[t]||[false,false,false]; a[+c.dataset.gchk]=c.checked; st.chk={[t]:a}; tkSave(); return; }
  const s=e.target.closest("input[data-gset]"); if(s){ const v=parseFloat(s.value)||0; if(s.dataset.gset==="cons") st.p.cons=Math.max(0,Math.min(100,v)); else if(s.dataset.gset==="salary") st.salary=Math.max(0,v); tkSave(); tkRender(); } });
document.addEventListener("click",e=>{ const b=e.target.closest("button[data-gset='wr']"); if(!b||!TK.state) return; const st=TK.state, v=parseFloat(b.dataset.v); if(!(v>0)) return;
  log(`Plan updated to your real win rate: ${Math.round(v*100)}% (was ${Math.round(st.p.wr*100)}%).`); st.p.wr=v; tkSave(); tkRender(); });
