/* ---------- Test Lab auto-play: trades every day by itself with the coach's own rules, and checks each move against the guide ---------- */
const LAB={instant:true,timer:null,seed:1,rng:null,speed:200,checks:{},errors:[],lanes:{},recCount:{},done:false};
function labRng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function labReset(){ LAB.ms=[]; LAB.phSeen={}; LAB.cnt={p1:0,p2:0,bench:0}; LAB.lastRate=null; LAB.showRep=false; LAB.bust=false; LAB.peak=0; LAB.inPool=0; LAB.outPool=0; LAB.home=0; LAB.orders=0; LAB.setups=0; LAB.tdays=0; LAB.checks={}; LAB.errors=[]; LAB.lanes={}; LAB.recCount={}; LAB.done=false; LAB.rng=labRng(LAB.seed); }
const LAB_RULES=[
  ["risk","Fixed risk per trade","Same % risk every trade: tests "+"and funded use your risk style."],
  ["turns","Tests take turns by week","Never trade all evaluations in the same window."],
  ["cycle","Funded: 1 week on, 2 off","Only trade funded accounts in their ON week."],
  ["pass","Pass at target + min days","Phase 1 → Tier 2 at the Phase 1 target, Phase 2 → Tier 1 at the Phase 2 target."],
  ["payout","Payout at your target","Request the payout the moment a funded account reaches its target (fixed %, or a target inside your window)."],
  ["split","Reinvest ladder","100% to Reinvestment until T2 = 60% and T3 = 40% of T1, then 80 / 65 / 50 / 30%."],
  ["recovery","Recovery once, limited trades","2–3 trades on T1, 3–4 on T2, 2–3 on T3. Never twice."],
  ["cut","Cut levels","T1 −6%, T2 −4%, T3 −4% after recovery fails."],
  ["buy","Buy order","No buying before the first funded account; then refill the Evaluation tier (T2 + T3 = T1)."],
  ["maxdd","Inside the firm's max loss","No account ever breaks the firm's max drawdown."],
  ["bench","Tier 2 bench","A passed Phase 2 account waits on the bench. It goes live to refill Tier 1, or to grow it only when the checklist passes and Tier 2 / Tier 3 stay at 60% / 40%."],
  ["money","Reinvestment and take-home math","Reinvestment = payout × reinvest % − test fees (no rebuy money, per the guide). Taken home = payout × (100 − reinvest %)."],
  ["scale","Right size and fee","Each buy is the size you chose (or the biggest unlocked size), at that size's fee."]];
function labCheck(k,ok,msg){ const c=LAB.checks[k]||(LAB.checks[k]={ok:0,bad:0}); if(ok) c.ok++; else { c.bad++; if(LAB.errors.length<40) LAB.errors.push({d:todayStr(),k,msg}); } }
/* the guide's reinvest ladder, worked out on its own from the accounts (not from portfolio()) */
function labExpRate(st,p){ const act=st.accounts.filter(a=>a.status==="active"), sum=ph=>act.filter(a=>a.phase===ph).reduce((s,a)=>s+a.size,0);
  const T1=sum(3), T2=sum(2), T3=sum(1); if(!(T1>0&&T2>=0.6*T1-1&&T2+T3>=T1-1)) return 1;
  const R=p.reinv&&p.reinv.length?p.reinv:[{upto:0.2*p.target,rate:0.8},{upto:0.6*p.target,rate:0.65},{upto:p.target,rate:0.5},{upto:null,rate:0.3}];
  for(const r of R) if(r.upto==null||T1<r.upto) return r.rate; return R[R.length-1].rate; }
/* independent bench rule from the guide */
function labCanPromote(st,a){ const p=st.p, act=st.accounts.filter(x=>x.status==="active"), sum=ph=>act.filter(x=>x.phase===ph).reduce((s,x)=>s+x.size,0);
  const T1=sum(3), T2=sum(2)-a.size, T3=sum(1), nT1=T1+a.size; LAB.peak=Math.max(LAB.peak||0,T1); if(T1>=p.target) return false;
  if(nT1<=Math.max(p.n0*p.s0,LAB.peak)) return true;
  const cutF=st.cuts.filter(c=>c.phase===3).map(c=>c.d).sort().pop()||"", consec=st.payouts.filter(x=>!cutF||x.d>=cutF).length;
  let gate=consec>=3&&(!cutF||dnum(todayStr())-dnum(cutF)>=14);
  if(p.scale!=="simple"){ const t=st.trades.slice(-20); gate=gate&&t.length>=20&&t.filter(Boolean).length/t.length>=0.4; }
  return gate&&T2>=0.6*nT1-1&&T2+T3>=nT1-1; }
function labBenchTry(st,a){ const allowed=labCanPromote(st,a); const was=a.phase; promoteOne(a); const live=a.phase===3&&was===2;
  labCheck("bench",live===allowed,live?`${a.name} went live but the bench rule says wait`:`${a.name} stayed on the bench but the rule says it can go live`); if(live) LAB.peak=Math.max(LAB.peak,portfolio(st).T1); }
function labStageName(p,T1){ const R=p.reinv&&p.reinv.length?p.reinv:null; if(!R) return T1<0.2*p.target?"Seed":T1<0.6*p.target?"Build":T1<p.target?"Scale":"Sustain"; const r=R.find(x=>x.upto==null||T1<x.upto)||R[R.length-1]; return r.name||""; }
function labStage(st,pf){ return pf.done?3:pf.T1===0?0:st.payouts.length?2:1; }
function labStepDay(){
  const st=TK.state; if(!st||LAB.done) return;
  if(!LAB.rng) labReset();
  const p=st.p, t=todayStr(), dow=new Date(t+"T12:00:00").getDay();
  if(dow!==0&&dow!==6){
    const w=weekIdx(st); let dMax=0;
    st.accounts.filter(a=>a.status==="active").forEach(a=>{
      if(a.status!=="active") return;
      const v=advise(a,st), r=rulesFor(a,p), pct=(a.bal-a.size)/a.size*100;
      if(v.kind==="payout"){
        labCheck("payout",pct>=p.lock-1e-9&&pct>=(a.pt||p.lock)-1e-9&&(!a.pt||(a.pt>=p.lock-1e-9&&a.pt<=Math.max(p.lock,p.lockMax||p.lock)+1e-9))&&a.days.length>=p.mindays,`${a.name} payout asked at ${pct.toFixed(2)}% (target ${a.pt||p.lock}%)`);
        const split=p.split>1?p.split/100:p.split, exp=(a.bal-a.size)*split; labCheck("payout",Math.abs(v.pay-exp)<0.5,`${a.name} payout ${fmtFull(v.pay)} but profit × split = ${fmtFull(exp)}`);
        const pf=portfolio(st), expRate=labExpRate(st,p);
        LAB.inPool+=v.pay*expRate; LAB.home+=v.pay*(1-expRate);
        const res=doPayout(a,v.pay); labCheck("split",Math.abs(res.rate-expRate)<1e-9,`Payout split ${Math.round(res.rate*100)}% but the guide says ${Math.round(expRate*100)}%`);
        return; }
      if(v.kind==="cut"){ labCheck("cut",pct<=-r.cut+1e-9&&(a.recUsed||a.rec===0||r.K===0),`${a.name} cut at ${pct.toFixed(2)}%`); doCut(a); return; }
      if(v.kind==="rest") return;
      if(v.kind==="bench"){ labBenchTry(st,a); return; }
      if(v.kind==="wait"){ doLog(a,a.bal); const ph=a.phase; autoPass(a); if(a.phase!==ph) labCheck("pass",true,""); return; }
      if(v.kind==="trade"||v.kind==="recover"){
        labCheck(a.phase===3?"cycle":"turns",isOn(a,st)||v.kind==="recover",`${a.name} told to trade in its rest week`);
        if(a.phase!==3&&v.kind==="trade"){ const k="w"+w; (LAB.lanes[k]=LAB.lanes[k]||new Set()).add(a.lane); labCheck("turns",LAB.lanes[k].size<=1,`Week ${w+1}: two test lanes traded`); }
        if(a.phase===3&&v.kind==="trade") labCheck("cycle",(w%3)===a.off,`${a.name} traded in week ${w+1} but its ON week is ${a.off}`);
        const expRisk=a.size*(a.phase===3?p.riskF:p.riskE)/100; labCheck("risk",Math.abs(v.riskUsd-expRisk)<0.5,`${a.name} risk ${fmtFull(v.riskUsd)} vs ${fmtFull(expRisk)}`);
        let bal=a.bal; const n=v.kind==="recover"?1:(p.tpd||1);
        if(LAB.instant) bal=Math.max(bal,v.tgtUsd); else for(let i=0;i<n;i++){ LAB.orders++; if(i+1>dMax) dMax=i+1; const win=LAB.rng()<p.wr; bal+=win?v.riskUsd*p.rr:-v.riskUsd; if(bal<=v.dailyStop||bal>=v.tgtUsd) break; }
        if(v.kind==="recover"){ LAB.recCount[a.id]=(LAB.recCount[a.id]||0)+1; labCheck("recovery",LAB.recCount[a.id]<=r.K,`${a.name} took ${LAB.recCount[a.id]} recovery trades (max ${r.K})`); }
        const wasUsed=a.recUsed, ph=a.phase, pct2=(Math.round(bal)-a.size)/a.size*100;
        doLog(a,Math.round(bal));
        if(a.rec>0&&wasUsed&&ph===a.phase) labCheck("recovery",false,`${a.name} got a second recovery`);
        if(a.status==="active"){ const days=a.days.length, hit=pct2>=r.tgt-1e-9&&days>=p.mindays, allowed=a.phase===2&&hit?labCanPromote(st,a):null;
          autoPass(a); const moved=a.phase!==ph||(ph===2&&a.ready);
          if(moved) labCheck("pass",hit,`${a.name} passed at ${pct2.toFixed(2)}% after ${days} days`); else if(hit&&ph<3) labCheck("pass",false,`${a.name} hit target but did not pass`);
          if(allowed!==null){ const live=a.phase===3; labCheck("bench",live===allowed,live?`${a.name} went live but the bench rule says wait`:`${a.name} went to the bench but the rule says it can go live`); if(live) LAB.peak=Math.max(LAB.peak,portfolio(st).T1); } }
        if(a.rec<0) delete LAB.recCount[a.id];
        labCheck("maxdd",(a.bal-a.size)/a.size*100>-p.maxdd,`${a.name} broke the firm's max loss`);
      }
    });
    if(dMax>0) LAB.tdays++;
    // bench: after cuts and payouts, a waiting account may go live
    st.accounts.filter(a=>a.status==="active"&&a.ready&&a.phase===2).forEach(a=>labBenchTry(st,a));
    // buying: follow the coach's next step
    let guard=0, pf=portfolio(st);
    if(pf.lvl>(LAB.lvl||0)){ log(`Unlocked ${fmt(p.ladder[pf.lvl].size)} accounts: Tier 1 is ${fmt(pf.T1)} after ${pf.pays} payouts.`); LAB.lvl=pf.lvl; }
    while(pf.need>0&&st.pool>=pf.fee&&guard++<6){ labCheck("buy",pf.T1>0||st.accounts.filter(a=>a.status==="active").length<p.n0,`Bought a test before the first funded account`); labBuyCheck(st,pf); LAB.outPool+=pf.fee; doBuy(pf.buySize,pf.fee); pf=portfolio(st); }
    const expPool=p.reserve+LAB.inPool-LAB.outPool;
    labCheck("money",Math.abs(st.pool-expPool)<0.01&&Math.abs(st.personal-LAB.home)<0.01,`Reinvestment ${fmtFull(st.pool)} vs ${fmtFull(expPool)}, taken home ${fmtFull(st.personal)} vs ${fmtFull(LAB.home)}`);
    const minFee=Math.min(...p.ladder.map(r=>r.fee));
    if(!st.accounts.some(a=>a.status==="active")&&st.pool<minFee){ LAB.done=true; LAB.bust=true; log(`Plan ended: every test failed and Reinvestment (${fmtFull(st.pool)}) can't buy a new one. The guide says no new personal money, so the plan stops here.`); }
    if(!LAB.done&&!st.accounts.some(a=>a.status==="active")&&pf.noEdge){ LAB.done=true; LAB.bust=true; log(`Plan stopped: every account is gone and your last ${pf.edge.n} trades lose money on average (${pf.edge.ev.toFixed(2)}R). The edge check blocks new tests until your trading is positive again.`); }
    if(pf.done){ LAB.done=true; log(`Goal reached: ${fmt(pf.T1)} funded.`); }
    labTrack(st,pf);
  }
  const d=new Date(t+"T12:00:00"); d.setDate(d.getDate()+1);
  TK.testDay=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); st.testDay=TK.testDay; tkTick(st);
}
/* independent check of the buy size: fixed choice, or the biggest size the table unlocks (one new size at a time) */
function labBuyCheck(st,pf){
  const p=st.p, L=p.ladder, row=L.find(r=>r.size===pf.buySize), expFee=row?row.fee:guessFee(pf.buySize);
  labCheck("scale",Math.abs(pf.fee-expFee)<0.01,`${fmt(pf.buySize)} bought for ${fmtFull(pf.fee)} but its fee is ${fmtFull(expFee)}`);
  if(p.buy&&p.buy!=="auto"){ labCheck("scale",pf.buySize===+p.buy,`Bought ${fmt(pf.buySize)} but you chose ${fmt(+p.buy)}`); return; }
  const cutF=st.cuts.filter(c=>c.phase===3).map(c=>c.d).sort().pop()||"", consec=st.payouts.filter(x=>!cutF||x.d>=cutF).length;
  let gate=consec>=3&&(!cutF||dnum(todayStr())-dnum(cutF)>=14);
  if(p.scale!=="simple"){ const t=st.trades.slice(-20); gate=gate&&t.length>=20&&t.filter(Boolean).length/t.length>=0.4&&pf.T2>=0.6*pf.T1-1&&pf.T2+pf.T3>=pf.T1-1; }
  let lv=0; while(gate&&lv<L.length-1&&pf.T1>=L[lv+1].unlockT1&&pf.pays>=L[lv+1].unlockPay) lv++;
  const proven=Math.max(0,...st.accounts.filter(a=>a.phase===3||a.status==="paid").map(a=>L.findIndex(r=>r.size===a.size)));
  const waiting=lv>proven&&st.accounts.some(a=>a.status==="active"&&a.size===L[lv].size&&a.phase!==3);
  const exp=waiting?L[proven].size:L[lv].size;
  labCheck("scale",pf.buySize===exp,`Bought ${fmt(pf.buySize)} but the size table says ${fmt(exp)} (Tier 1 ${fmt(pf.T1)}, ${pf.pays} payouts)`);
}
function labNewFromCfg(){ const r=labCfgToP(labCfg()); LAB.lvl=0; if(r.err){ LAB.setup=true; tkRender(); return false; } tkFromPlan(r.P); (r.warn||[]).forEach(w=>log(w)); return true; }
/* milestones for the report */
function labMs(t){ const st=TK.state, d=dnum(todayStr())-dnum(st.start)+1; LAB.ms.push({d,t}); }
function labTrack(st,pf){ LAB.ms=LAB.ms||[]; LAB.phSeen=LAB.phSeen||{}; LAB.cnt=LAB.cnt||{p1:0,p2:0,bench:0};
  st.accounts.forEach(a=>{ const was=LAB.phSeen[a.id]||{ph:1,b:false}; if(a.phase>was.ph){ for(let k=was.ph;k<a.phase;k++){ if(k===1){ LAB.cnt.p1++; if(LAB.cnt.p1===1) labMs(`First Phase 1 pass (${a.name}). It moves to Tier 2.`); } if(k===2){ LAB.cnt.p2++; if(LAB.cnt.p2===1) labMs(`First funded account (${a.name}). Tier 1 starts.`); } } }
    if(a.ready&&!was.b){ LAB.cnt.bench++; if(LAB.cnt.bench===1) labMs(`First account waits on the Tier 2 bench (${a.name}).`); }
    LAB.phSeen[a.id]={ph:Math.max(was.ph,a.phase),b:was.b||!!a.ready}; });
  const n=st.payouts.length, last=n?st.payouts[n-1]:null;
  if(n===1&&!LAB.ms.some(m=>m.k==="pay")){ labMs(`First payout: ${fmtFull(last.amt)}.`); LAB.ms[LAB.ms.length-1].k="pay"; }
  if(last&&last.rate!==LAB.lastRate){ labMs(last.rate===1?`Payouts go 100% to Reinvestment (Tier 2 / Tier 3 not full).`:`Reinvest drops to ${Math.round(last.rate*100)}% (${labStageName(st.p,last.T1)} stage). You keep ${Math.round((1-last.rate)*100)}%.`); LAB.lastRate=last.rate; }
  if(pf.lvl>(LAB.msLvl||0)){ labMs(`${fmt(st.p.ladder[pf.lvl].size)} accounts unlocked.`); LAB.msLvl=pf.lvl; }
  const T=pf.T1; [0.25,0.5,0.75].forEach(f=>{ const v=st.p.target*f, k="t"+f; if(T>=v&&!LAB.ms.some(m=>m.k===k)){ labMs(`Tier 1 passes ${fmt(v)}.`); LAB.ms[LAB.ms.length-1].k=k; } });
  if(LAB.done&&!LAB.ms.some(m=>m.k==="end")){ labMs(LAB.bust?"Plan ended: no tests left and no Reinvestment to buy one.":`Goal reached: ${fmt(pf.T1)} funded.`); LAB.ms[LAB.ms.length-1].k="end"; } }
function labReport(st){
  const p=st.p, pf=portfolio(st), d=dnum(todayStr())-dnum(st.start)+1, L=p.ladder;
  const pays=st.payouts, tot=pays.reduce((s,x)=>s+x.amt,0), re=pays.reduce((s,x)=>s+x.amt*x.rate,0), home=st.personal;
  const own=p.n0*L[0].fee, feesR=LAB.outPool||0;
  const bySize={}; st.accounts.forEach(a=>{ bySize[a.size]=(bySize[a.size]||0)+1; });
  const cuts=[1,2,3].map(ph=>st.cuts.filter(c=>c.phase===ph).length);
  const failed=st.accounts.filter(a=>a.status==="failed"), feeOf=sz=>(L.find(r=>r.size===sz)||{fee:guessFee(sz)}).fee, lostFees=failed.reduce((s,a)=>s+feeOf(a.size),0);
  const tierN=ph=>ph===3?"Tier 1 (funded)":ph===2?"Tier 2 (Phase 2)":"Tier 3 (Phase 1)";
  const groups={}; pays.forEach(x=>{ const k=Math.round(x.rate*100); const g=groups[k]||(groups[k]={n:0,amt:0,re:0}); g.n++; g.amt+=x.amt; g.re+=x.amt*x.rate; });
  const unst=groups[100]?groups[100].n:0;
  const tb=Object.values(LAB.checks).reduce((s,c)=>s+c.bad,0), tok=Object.values(LAB.checks).reduce((s,c)=>s+c.ok,0);
  const split=p.split>1?p.split/100:p.split, cyc=pf.T1*lockMid(p)/100*split*(52/12/3), keepR=(p.reinv&&p.reinv.length?p.reinv[p.reinv.length-1].rate:0.3);
  const stageName=k=>k===100?"Bench not full":labStageName(p,(pays.find(x=>Math.round(x.rate*100)===k)||{}).T1||0);
  return `<div class="lab-rep" id="labReport">
  <div class="lr-h"><div><span class="kicker">Test report</span><h3>${LAB.bust?`Plan ended on day ${d}`:LAB.done?`${fmt(pf.T1)} funded in ${d} days (week ${Math.ceil(d/7)})`:`Report so far · day ${d}`}</h3>
    <span class="lab-sub">${p.n0} × ${fmt(p.s0)} · goal ${fmt(p.target)} · ${LAB.instant?"Instant pass":"Real trading, "+Math.round(p.wr*100)+"% win rate · 1 : "+p.rr} · payouts buy ${p.buy&&p.buy!=="auto"?fmt(+p.buy):"the size table"}</span></div>
    <button type="button" class="btn ghost sm" data-lab="print">Print / save PDF</button></div>
  <div class="lr-k">
    <div><b>${fmtFull(own)}</b><span>your own money (first tests only)</span></div>
    <div><b>${fmtFull(tot)}</b><span>${pays.length} payouts in total</span></div>
    <div><b>${fmtFull(re)}</b><span>went back in (Reinvestment)</span></div>
    <div class="hl"><b>${fmtFull(home)}</b><span>taken home</span></div>
    <div><b>${fmtFull(feesR)}</b><span>test fees paid from Reinvestment</span></div>
    <div><b>${fmtFull(st.pool)}</b><span>Reinvestment left</span></div>
    <div class="${failed.length?"bd":""}"><b>${failed.length} of ${st.accounts.length}</b><span>accounts failed (cut)</span></div>
    <div><b>${fmtFull(lostFees)}</b><span>fees lost on failed tests</span></div>
    <div><b>${LAB.instant?"—":(LAB.orders||0).toLocaleString("en-US")}</b><span>${LAB.instant?"trades (not counted in instant pass)":"trades placed on all accounts"}</span></div>
    <div><b>${LAB.instant?"—":"~"+Math.round((LAB.orders||0)/Math.max(1,d/30.44))}</b><span>${LAB.instant?"trades a month":`trades a month, on ${LAB.tdays||0} trading days`}</span></div></div>
  <div class="lr-g">
    <section><h4>Where each payout went</h4><table class="lr-t"><thead><tr><th>Stage</th><th>Payouts</th><th>Total</th><th>Back in</th><th>You kept</th></tr></thead><tbody>
      ${Object.keys(groups).map(Number).sort((a,b)=>b-a).map(k=>{ const g=groups[k]; return `<tr><td><b>${k}% back in</b><span>${esc(stageName(k))}</span></td><td>${g.n}</td><td>${fmtFull(g.amt)}</td><td>${fmtFull(g.re)}</td><td>${fmtFull(g.amt-g.re)}</td></tr>`; }).join("")||`<tr><td colspan="5">No payouts yet.</td></tr>`}</tbody></table>
      <div class="lr-why"><b>Why the take-home is small</b><p>${pays.length?`${unst} of ${pays.length} payouts (${Math.round(unst/pays.length*100)}%) came while Tier 2 or Tier 3 was not full, so the guide sends 100% back in. The rest kept only ${Object.keys(groups).filter(k=>k<100).map(k=>100-k+"%").join(" / ")||"0%"}. `:""}This is the building phase: payouts buy the team first. The 70% take-home (Sustain stage) only starts after the goal, and the test stops at the goal.</p>
      ${pf.T1>0?`<p><b>After the goal</b>, best case if every funded account pays ${lockTxt(p)} each cycle: about ${fmtFull(cyc)} a month, you keep ${Math.round((1-keepR)*100)}% = <b>${fmtFull(cyc*(1-keepR))}</b>. Real months will be lower.</p>`:""}</div></section>
    <section><h4>Accounts</h4><ul class="lr-l">
      <li><span>Tests bought</span><b>${st.accounts.length} (${Object.keys(bySize).map(Number).sort((a,b)=>a-b).map(s=>`${bySize[s]} × ${fmt(s)}`).join(", ")})</b></li>
      <li><span>Passed Phase 1 → Tier 2</span><b>${LAB.cnt?LAB.cnt.p1:0}</b></li>
      <li><span>Passed Phase 2 → Tier 1</span><b>${LAB.cnt?LAB.cnt.p2:0}</b></li>
      <li><span>Waited on the bench</span><b>${LAB.cnt?LAB.cnt.bench:0}</b></li>
      <li><span>Cut (Tier 1 / 2 / 3)</span><b>${cuts[2]} / ${cuts[1]} / ${cuts[0]}</b></li>
      <li><span>Now: Tier 1 / Tier 2 / Tier 3</span><b>${fmt(pf.T1)} / ${fmt(pf.T2)} / ${fmt(pf.T3)}</b></li>
      <li><span>Guide checks</span><b class="${tb?"bad":"ok"}">${tok+tb} checks, ${tb} error${tb===1?"":"s"}</b></li></ul></section>
  </div>
  <section><h4>Failed accounts: ${failed.length}</h4>${failed.length?`<p class="ls-help" style="margin-bottom:8px">Tier 1: ${cuts[2]} · Tier 2: ${cuts[1]} · Tier 3: ${cuts[0]}. Each one hit its cut level and the one recovery try did not work, so the guide closed it.</p>
    <table class="lr-t"><thead><tr><th>Account</th><th>Tier when it failed</th><th>Day</th><th>Down</th><th>Fee lost</th></tr></thead><tbody>${failed.map(a=>{ const c=st.cuts.find(x=>x.id===a.id)||{}; return `<tr><td><b>${esc(a.name)}</b></td><td>${tierN(a.phase)}</td><td>${c.d?dnum(c.d)-dnum(st.start)+1:"—"}</td><td>${c.pct!=null?c.pct+"%":"—"}</td><td>${fmtFull(feeOf(a.size))}</td></tr>`; }).join("")}</tbody></table>`:`<p class="ls-help">No account failed in this test.${LAB.instant?" Instant pass never loses. Switch to Real trading to see failures.":""}</p>`}</section>
  <section><h4>Timeline</h4><ol class="lr-tl">${(LAB.ms||[]).map(m=>`<li><span>Day ${m.d}</span>${esc(m.t)}</li>`).join("")||"<li>Nothing yet.</li>"}</ol></section>
</div>`;
}
function labPlay(on){ clearInterval(LAB.timer); LAB.timer=null; if(on&&!LAB.done){ LAB.timer=setInterval(()=>{ labStepDay(); if(LAB.done){ labPlay(false); tkSave(); tkRender(); return; } labRenderBoard(); },LAB.speed); } tkSave(); tkRender(); }
function labBoard(){
  const st=TK.state; if(!st) return "";
  const p=st.p, pf=portfolio(st), stg=labStage(st,pf), act=st.accounts.filter(a=>a.status==="active");
  const d=dnum(todayStr())-dnum(st.start)+1, playing=!!LAB.timer;
  const chip=a=>{ const v=advise(a,st), pct=(a.bal-a.size)/a.size*100, r=rulesFor(a,p), pos=Math.max(0,Math.min(100,(pct+r.cut)/(r.tgt+r.cut)*100));
    return `<div class="lb-acc k-${v.kind}"><div class="lb-a1"><b>${esc(a.name)}</b><span class="tk-pill">${v.pill}</span></div><div class="lb-bar"><i style="width:${pos}%"></i></div><div class="lb-a2"><span class="${pct>=0?"up":"dn"}">${pct>=0?"+":""}${pct.toFixed(1)}%</span><span>${p.mindays?`${a.days.length}/${p.mindays} days`:`${a.days.length} days`}${a.rec>0?` · ${a.rec} rec`:""}</span></div></div>`; };
  const col=(ph,t,sub,c)=>{ const L=act.filter(a=>a.phase===ph); const tot=L.reduce((s,a)=>s+a.size,0);
    return `<div class="lb-col"><div class="lb-h"><i class="dotl" style="background:var(--${c})"></i><div><b>${t}</b><span>${sub} · ${fmt(tot)}</span></div></div>${L.length?L.map(chip).join(""):`<div class="lb-empty">Empty</div>`}</div>`; };
  const closed=st.accounts.filter(a=>a.status!=="active");
  let next; if(pf.done) next=pf.stocked?"Goal reached. Income mode: keep 70%.":"Goal reached. Payouts still go to Reinvestment until Tier 2 = 60% and Tier 3 = 40% of Tier 1."; else if(pf.need>0) next=`Buy 1 × ${fmt(pf.buySize)} test (${fmtFull(pf.fee)}). Reinvestment ${fmtFull(st.pool)}.`; else if(pf.T1===0) next="Pass the starting tests. No buying yet."; else next="Tiers full. Keep trading.";
  const tb=Object.values(LAB.checks).reduce((s,c)=>s+c.bad,0), tok=Object.values(LAB.checks).reduce((s,c)=>s+c.ok,0);
  const names=["Tier 3 · Evaluation","Tier 1 · First funded","Tier 2 · Bench & scale","Goal"];
  return `<div class="lab" id="labBoard">
    <div class="lab-top"><div><span class="kicker">Auto-play</span><h3>${LAB.bust?`Plan ended on day ${d}: all tests failed`:LAB.done?`Goal reached on day ${d}`:`Day ${d} · Week ${Math.floor((d-1)/7)+1}`}</h3><span class="lab-sub">${LAB.instant?"Instant pass: every account hits its target on its first trading day":`Future #${LAB.seed} · ${Math.round(p.wr*100)}% win rate · 1 : ${p.rr}`} · trades Mon–Fri</span></div>
      <div class="lab-ctl"><button type="button" class="btn ${playing?"ghost":"gold"} sm" data-lab="${playing?"pause":"play"}">${playing?"Pause":"▶ Play"}</button><button type="button" class="btn ghost sm" data-lab="day">+1 day</button><button type="button" class="btn ghost sm" data-lab="week">+1 week</button>
      <select id="labSpeed" aria-label="Speed"><option value="600"${LAB.speed==600?" selected":""}>Slow</option><option value="200"${LAB.speed==200?" selected":""}>Normal</option><option value="40"${LAB.speed==40?" selected":""}>Fast</option></select><button type="button" class="btn ghost sm" data-lab="new">${LAB.instant?"Restart":"New future"}</button><button type="button" class="btn ghost sm" data-lab="setup">Edit plan</button>${LAB.done?"":`<button type="button" class="btn ghost sm" data-lab="report">${LAB.showRep?"Hide report":"Report"}</button>`}</div></div>
    <div class="lab-plan"><span><b>Plan</b> ${p.n0} × ${fmt(p.s0)} · goal ${fmt(p.target)} · ${Math.round(p.wr*100)}% · 1 : ${p.rr} · risk ${p.riskE}% / ${p.riskF}%</span><span><b>Sizes</b> ${p.ladder.map((r,i)=>i===pf.lvl?`<u>${fmt(r.size)}</u>`:fmt(r.size)).join(" → ")}</span>
      <label class="lab-rb"><b>Payouts buy</b><select id="labBuy" aria-label="Payouts reinvest into">${["auto",...p.ladder.map(r=>r.size)].map(v=>`<option value="${v}"${String(p.buy||"auto")===String(v)?" selected":""}>${v==="auto"?"Auto (size table)":fmt(v)+" · "+fmtFull(p.ladder.find(r=>r.size===v).fee)}</option>`).join("")}</select></label></div>
    <div class="lab-mode" role="radiogroup" aria-label="Pass mode"><button type="button" role="radio" aria-checked="${LAB.instant}" data-lab="instant" class="${LAB.instant?"on":""}"><b>Instant pass</b><span>No passing limits. See the whole structure fast.</span></button><button type="button" role="radio" aria-checked="${!LAB.instant}" data-lab="real" class="${LAB.instant?"":"on"}"><b>Real trading</b><span>Wins and losses at your win rate, with cuts and recovery.</span></button></div>
    <div class="road-bar lab-stages">${names.map((n,i)=>`<span class="${i<stg?"done":i===stg?"now":""}"><i></i>${n}</span>`).join("")}</div>
    <div class="lab-stats"><div><b>${fmt(pf.T1)}</b><span>Tier 1 live of ${fmt(p.target)}</span></div><div><b>${fmt(pf.T2)}</b><span>Tier 2 (need ${fmt(0.6*pf.T1)})</span></div><div><b>${fmt(pf.T3)}</b><span>Tier 3 (need ${fmt(Math.max(0,pf.T1-Math.max(pf.T2,0.6*pf.T1)))})</span></div><div><b>${fmtFull(st.pool)}</b><span>Reinvestment left (unspent)</span></div><div><b>${fmtFull(st.personal)}</b><span>taken home</span></div><div><b>${st.payouts.length}</b><span>payouts</span></div><div class="lab-tot"><b>${fmtFull(st.payouts.reduce((s,x)=>s+x.amt,0))}</b><span>total payouts = ${fmtFull(st.payouts.reduce((s,x)=>s+x.amt*x.rate,0))} reinvested + ${fmtFull(st.personal)} taken home</span></div></div>
    ${LAB.done||LAB.showRep?labReport(st):""}
    <div class="lab-next"><b>Next to buy:</b> ${next}</div>
    <div class="lab-plan"><span><b>Reinvest now</b> ${Math.round(pf.rate*100)}% ${pf.stocked?`(${esc(labStageName(p,pf.T1))})`:"(Tier 2 / Tier 3 not full yet, so 100%)"}</span><span><b>Bigger size</b> ${pf.grow.map(g=>`<i class="${g[0]?"ok":"no"}" title="${esc(g[1])}">${g[0]?"✓":"✗"} ${esc(g[1])}</i>`).join(" ")}</span></div>
    <div class="lab-cols">${col(1,"Tier 3 · Evaluation","Phase 1","t3")}${col(2,"Tier 2 · Backup",`Phase 2 · ${act.filter(a=>a.ready).length} on bench`,"t2")}${col(3,"Tier 1 · Live","Funded","t1")}</div>
    ${closed.length?`<div class="lab-closed"><b>Closed (${closed.length}):</b> ${closed.slice(-12).map(a=>`${esc(a.name)} (${a.phase===3?"T1":a.phase===2?"T2":"T3"})`).join(", ")}</div>`:""}
    <div class="lab-g2"><div class="lab-checks"><h4>Guide check ${tb?`<span class="bad">${tb} error${tb>1?"s":""}</span>`:`<span class="ok">${tok} checks, 0 errors</span>`}</h4>${LAB_RULES.map(([k,n,g])=>{ const c=LAB.checks[k]||{ok:0,bad:0}; return `<div class="lab-ck ${c.bad?"bad":c.ok?"ok":""}"><span>${c.bad?"✗":c.ok?"✓":"·"}</span><div><b>${n}</b><p>${g}</p></div><em>${c.ok+c.bad}</em></div>`; }).join("")}
      ${LAB.errors.length?`<ul class="lab-err">${LAB.errors.slice(0,10).map(e=>`<li><span>${fmtDate(e.d)}</span>${esc(e.msg)}</li>`).join("")}</ul>`:""}</div>
      <div class="lab-feed"><h4>What happened</h4><ul class="tk-log">${st.log.slice(0,14).map(l=>`<li><span>${fmtDate(l.d)}</span>${esc(l.t)}</li>`).join("")}</ul></div></div>
  </div>`;
}
window.__lab={LAB,labCanPromote,labExpRate,labCheck,labBuyCheck,labReset};
function labRenderBoard(){ const b=$("labBoard"); if(b) b.outerHTML=labBoard(); }
document.addEventListener("click",e=>{ const b=e.target.closest("[data-lab]"); if(!b||!TK.test||!TK.state) return; const k=b.dataset.lab;
  if(k==="instant"||k==="real"){ const want=k==="instant"; if(LAB.instant!==want){ LAB.instant=want; labPlay(false); labReset(); TK.testDay=null; TK.state.testDay=null; labNewFromCfg(); labReset(); } tkRender(); return; }
  if(k==="play") labPlay(true); else if(k==="pause") labPlay(false);
  else if(k==="day"){ labStepDay(); tkSave(); tkRender(); }
  else if(k==="week"){ for(let i=0;i<7&&!LAB.done;i++) labStepDay(); tkSave(); tkRender(); }
  else if(k==="new"){ labPlay(false); LAB.seed=1+Math.floor(Math.random()*9999); labReset(); TK.testDay=null; TK.state.testDay=null; labNewFromCfg(); labReset(); tkRender(); } });
document.addEventListener("change",e=>{ if(e.target.id!=="labSpeed") return; LAB.speed=+e.target.value; if(LAB.timer) labPlay(true); });
/* ---------- Lab plan setup: type any plan, any account sizes, and choose what each payout buys ---------- */
const LAB_SIZES=[5000,10000,25000,50000,100000,200000];
const LAB_CFG_KEY="ts-lab-cfg2";
/* from the guide: size unlocks (share of the goal, payouts) and the reinvest ladder (Seed 80 / Build 65 / Scale 50 / Sustain 30) */
const LAB_GUIDE_UNLOCK={5000:[0,0],10000:[0.1,5],25000:[0.1,5],50000:[0.2,10],100000:[0.6,25],200000:[1,50]};
const LAB_GUIDE_REINV=[[0.2,80,"Seed"],[0.6,65,"Build"],[1,50,"Scale"],[null,30,"Sustain"]];
function labCfgDefault(){
  let P=null; try{ P=readParams(); }catch(e){}
  P=P||{s0:25000,n0:2,target:500000,wr:0.4,rr:3,riskE:1,riskF:1,tpd:1,split:0.8,reserve:500,p1t:8,p2t:5,maxdd:10,daily:5,lock:3,c1:6,c2:4,c3:4,k1:3,k2:4,k3:3,ladder:[]};
  const L=P.ladder||[];
  return {s0:P.s0,n0:P.n0,target:P.target,wr:Math.round(P.wr*100),rr:P.rr,riskE:P.riskE,riskF:P.riskF,tpd:P.tpd,split:Math.round((P.split>1?P.split/100:P.split)*100),reserve:P.reserve,
    p1t:P.p1t,p2t:P.p2t,maxdd:P.maxdd,daily:P.daily,lock:P.lock,lockMax:Math.max(P.lock,P.lockMax||P.lock),c1:P.c1,c2:P.c2,c3:P.c3,k1:P.k1,k2:P.k2,k3:P.k3,scale:"guide",buy:"auto",
    ladder:LAB_SIZES.map((size,i)=>{ const r=L.find(x=>x.size===size); return {size,on:!!r||size===P.s0,fee:r?r.fee:(typeof feeMemo!=="undefined"&&feeMemo[size])||guessFee(size),
      unlockT1:r?r.unlockT1:Math.round(P.target*(LAB_GUIDE_UNLOCK[size]||[0,0])[0]/1000)*1000,unlockPay:r?r.unlockPay:(LAB_GUIDE_UNLOCK[size]||[0,0])[1]}; }),
    reinv:P.reinv&&P.reinv.length?P.reinv.map(r=>({upto:r.upto==null?null:Math.round(r.upto/1000)*1000,rate:Math.round(r.rate*100),name:r.name})):LAB_GUIDE_REINV.map(([f,rate,name])=>({upto:f==null?null:Math.round(P.target*f/1000)*1000,rate,name}))};
}
function labCfg(){ if(LAB.cfg) return LAB.cfg; try{ const t=localStorage.getItem(LAB_CFG_KEY); if(t){ const c=JSON.parse(t); if(c&&c.ladder){ LAB.cfg=c; return c; } } }catch(e){} LAB.cfg=labCfgDefault(); return LAB.cfg; }
function labCfgSave(){ try{ localStorage.setItem(LAB_CFG_KEY,JSON.stringify(LAB.cfg)); }catch(e){} }
/* turn the typed plan into the same numbers the coach uses; returns {P} or {err} */
function labCfgToP(c){
  const n=(v,lo,hi)=>{ v=+v; return isFinite(v)&&v>=lo&&v<=hi; };
  const err=[];
  if(!n(c.n0,1,20)) err.push("Tests to start: 1 to 20.");
  if(!n(c.target,c.s0*c.n0,1e8)) err.push(`Goal must be at least ${fmt(c.s0*c.n0)} (your starting tests).`);
  if(!n(c.wr,5,95)) err.push("Win rate: 5 to 95%.");
  if(!n(c.rr,0.5,10)) err.push("Reward: 0.5 to 10.");
  if(!n(c.riskE,0.05,5)||!n(c.riskF,0.05,5)) err.push("Risk: 0.05 to 5% per trade.");
  if(!n(c.split,10,100)) err.push("Profit share: 10 to 100%.");
  if(!n(c.p1t,0.5,30)||!n(c.p2t,0.5,30)||!n(c.lock,0.5,20)) err.push("Targets and payout %: 0.5 to 30.");
  if(!n(c.maxdd,1,30)||!n(c.daily,0.5,30)) err.push("Loss limits: 0.5 to 30%.");
  if(!(c.c1<c.maxdd&&c.c2<c.maxdd&&c.c3<c.maxdd)) err.push("Cut levels must be smaller than the max drawdown.");
  const L=c.ladder.filter(r=>r.on||r.size===c.s0).filter(r=>r.size>=c.s0).sort((a,b)=>a.size-b.size).map((r,i)=>({size:r.size,fee:Math.max(0,+r.fee||0),unlockT1:i?Math.max(0,+r.unlockT1||0):0,unlockPay:i?Math.max(0,Math.round(+r.unlockPay||0)):0}));
  if(!L.length||L[0].size!==+c.s0) err.push("The start size must be one of the account sizes.");
  if(c.buy!=="auto"&&!L.some(r=>r.size===+c.buy)) err.push("Turn on the size you chose for reinvesting.");
  const RV=c.reinv||[]; for(let i=1;i<RV.length-1;i++) if(!(+RV[i].upto>+RV[i-1].upto)) err.push("Reinvest stages: each Tier 1 limit must be bigger than the one before.");
  if(err.length) return {err};
  const P={s0:+c.s0,n0:Math.round(c.n0),target:+c.target,wr:c.wr/100,rr:+c.rr,riskE:+c.riskE,riskF:+c.riskF,tpd:Math.max(1,Math.round(c.tpd)),split:c.split/100,reserve:0,
    reinv:(c.reinv||[]).map(r=>({upto:r.upto==null?null:+r.upto,rate:Math.max(0,Math.min(100,+r.rate))/100,name:r.name})),lockMax:Math.max(+c.lock,+c.lockMax||+c.lock),p1t:+c.p1t,p2t:+c.p2t,maxdd:+c.maxdd,daily:+c.daily,mindays:0,lock:+c.lock,c1:+c.c1,c2:+c.c2,c3:+c.c3,k1:Math.round(c.k1),k2:Math.round(c.k2),k3:Math.round(c.k3),risklvl:"custom",scale:c.scale,buy:c.buy==="auto"?"auto":+c.buy,ladder:L};
  const capE=Math.min(riskCap(P.maxdd,P.daily,P.tpd,P.c3,P.k3,P.rr),riskCap(P.maxdd,P.daily,P.tpd,P.c2,P.k2,P.rr)), capF=riskCap(P.maxdd,P.daily,P.tpd,P.c1,P.k1,P.rr);
  const warn=[]; if(P.riskE>capE){ warn.push(`Test risk lowered to ${capE}% so it stays inside the firm's limits.`); P.riskE=capE; } if(P.riskF>capF){ warn.push(`Funded risk lowered to ${capF}% so it stays inside the firm's limits.`); P.riskF=capF; }
  return {P,warn};
}
function labSetupHtml(){
  const c=labCfg();
  const f=(k,l,unit,step,pre)=>`<label class="ls-f"><span>${l}</span><div class="field">${pre?`<span class="pre">${pre}</span>`:""}<input type="number" data-lc="${k}" value="${c[k]}" step="${step||1}" inputmode="decimal">${unit?`<span class="post">${unit}</span>`:""}</div></label>`;
  const on=c.ladder.filter(r=>r.on||r.size===+c.s0).map(r=>r.size).filter(s=>s>=c.s0);
  return `<div class="lab lab-setup" id="labBoard">
  <div class="lab-top"><div><span class="kicker">Test lab</span><h3>Build a test plan</h3><span class="lab-sub">Type any plan. Nothing here touches your real coach.</span></div>${TK.state?`<div class="lab-ctl"><button type="button" class="btn ghost sm" data-lab="cancel">Back to test</button></div>`:""}</div>
  <div class="ls-g"><h4>Start</h4><div class="ls-row">
    <label class="ls-f"><span>Start size</span><div class="field"><select data-lc="s0">${LAB_SIZES.map(s=>`<option value="${s}"${s===+c.s0?" selected":""}>${fmt(s)}</option>`).join("")}</select></div></label>
    ${f("n0","Tests to start")}${f("target","Goal (funded)","",50000,"$")}<div class="ls-f"><span>Rebuy budget</span><div class="ls-auto"><b>$0</b> auto, from the guide: after the first tests, every new test is paid from payouts.</div></div></div></div>
  <div class="ls-g"><h4>Trading</h4><div class="ls-row">${f("wr","Win rate","%")}${f("rr","Reward per $1","",0.5)}${f("riskE","Risk on tests","%",0.1)}${f("riskF","Risk on funded","%",0.1)}${f("tpd","Trades a day")}${f("split","Your profit share","%",5)}</div></div>
  <div class="ls-g"><h4>Firm rules</h4><div class="ls-row">${f("p1t","Phase 1 target","%",0.5)}${f("p2t","Phase 2 target","%",0.5)}${f("maxdd","Max loss","%",0.5)}${f("daily","Daily loss","%",0.5)}${f("lock","Payout from","+%",0.5)}${f("lockMax","Payout up to","+%",0.5)}</div></div>
  <div class="ls-g"><h4>Cuts and recovery</h4><div class="ls-row">${f("c1","Funded cut","−%",0.5)}${f("c2","Phase 2 cut","−%",0.5)}${f("c3","Phase 1 cut","−%",0.5)}${f("k1","Funded retries")}${f("k2","Phase 2 retries")}${f("k3","Phase 1 retries")}</div></div>
  <div class="ls-g"><h4>Account sizes</h4><p class="ls-help">Turn on the sizes you want. A bigger size unlocks when Tier 1 and payouts reach these numbers.</p>
    <table class="ls-lad"><thead><tr><th>Use</th><th>Size</th><th>Fee</th><th>Tier 1 at least</th><th>Payouts at least</th></tr></thead><tbody>
    ${c.ladder.map((r,i)=>{ const start=r.size===+c.s0, below=r.size<c.s0; return `<tr class="${below?"off":""}"><td><input type="checkbox" data-ll="on" data-i="${i}"${(r.on||start)&&!below?" checked":""}${start||below?" disabled":""} aria-label="Use ${fmt(r.size)}"></td><td class="mono">${fmt(r.size)}</td>
      <td><input type="number" data-ll="fee" data-i="${i}" value="${r.fee}" step="10" aria-label="Fee ${fmt(r.size)}"></td>
      <td>${start?`<span class="muted">start</span>`:`<input type="number" data-ll="unlockT1" data-i="${i}" value="${r.unlockT1}" step="25000" aria-label="Unlock at Tier 1">`}</td>
      <td>${start?"":`<input type="number" data-ll="unlockPay" data-i="${i}" value="${r.unlockPay}" step="1" aria-label="Unlock after payouts">`}</td></tr>`; }).join("")}</tbody></table></div>
  <div class="ls-g"><h4>Reinvest ladder</h4><p class="ls-help">How much of each payout goes back in, by Tier 1 size. Until Tier 2 = 60% and Tier 3 = 40% of Tier 1, 100% goes back in. Numbers from the guide.</p>
    <table class="ls-lad"><thead><tr><th>Stage</th><th>Tier 1 up to</th><th>Reinvest</th><th>Take home</th></tr></thead><tbody>
    ${(c.reinv||[]).map((r,i,A)=>`<tr><td><b>${esc(r.name||"Stage "+(i+1))}</b></td><td>${r.upto==null?`<span class="muted">${fmt(A[i-1]?A[i-1].upto:0)}+</span>`:`<input type="number" data-lr="upto" data-i="${i}" value="${r.upto}" step="25000" aria-label="Tier 1 up to">`}</td><td><input type="number" data-lr="rate" data-i="${i}" value="${r.rate}" step="5" min="0" max="100" aria-label="Reinvest %"></td><td class="muted">${100-r.rate}%</td></tr>`).join("")}</tbody></table></div>
  <div class="ls-g"><h4>Each payout reinvests into</h4>
    <div class="ls-buy" role="radiogroup">${["auto",...on].map(v=>`<button type="button" role="radio" data-lb="${v}" aria-checked="${String(c.buy)===String(v)}" class="${String(c.buy)===String(v)?"on":""}">${v==="auto"?"<b>Auto</b><span>Follow the size table</span>":`<b>${fmt(v)}</b><span>${fmtFull((c.ladder.find(r=>r.size===v)||{}).fee||0)} each</span>`}</button>`).join("")}</div>
    <label class="chk"><input type="checkbox" data-lc="scale"${c.scale==="guide"?" checked":""}> Guide scale-up checklist (all 5: 3 payouts in a row, no cut in 14 days, win rate 40%+ over 20 trades, Tier 2 = 60% and Tier 3 = 40% of Tier 1). Off = only the first 2.</label></div>
  <div id="labErr"></div>
  <div class="ls-go"><button type="button" class="btn gold" data-lab="build">Build test plan</button><button type="button" class="btn ghost sm" data-lab="defaults">Reset to my plan</button></div>
</div>`;
}
function labBuild(){
  const r=labCfgToP(labCfg()); const box=$("labErr");
  if(r.err){ if(box) box.innerHTML=`<ul class="lab-err">${r.err.map(e=>`<li>${esc(e)}</li>`).join("")}</ul>`; return; }
  labPlay(false); LAB.setup=false; LAB.lvl=0; labReset(); TK.testDay=null; if(TK.state) TK.state.testDay=null;
  tkFromPlan(r.P); (r.warn||[]).forEach(w=>log(w)); log(`Account sizes: ${r.P.ladder.map(x=>fmt(x.size)).join(" → ")}. Payouts reinvest into ${r.P.buy==="auto"?"the size table":fmt(r.P.buy)+" accounts"}.`); labReset(); tkSave(); tkRender();
}
document.addEventListener("input",e=>{ const t=e.target; if(!TK.test) return;
  if(t.dataset.lc){ const c=labCfg(); c[t.dataset.lc]=t.type==="checkbox"?(t.checked?"guide":"simple"):+t.value; labCfgSave(); if(t.dataset.lc==="s0"){ c.ladder.forEach(r=>{ if(r.size===+t.value) r.on=true; }); if(c.buy!=="auto"&&+c.buy<+t.value) c.buy="auto"; tkRender(); } }
  else if(t.dataset.lr){ const c=labCfg(), r=c.reinv[+t.dataset.i]; if(!r) return; r[t.dataset.lr]=+t.value; labCfgSave(); if(t.dataset.lr==="rate"){ const td=t.closest("tr").lastElementChild; if(td) td.textContent=(100-r.rate)+"%"; } }
  else if(t.dataset.ll){ const c=labCfg(), r=c.ladder[+t.dataset.i]; if(!r) return; if(t.dataset.ll==="on"){ r.on=t.checked; if(!r.on&&+c.buy===r.size) c.buy="auto"; labCfgSave(); tkRender(); } else { r[t.dataset.ll]=+t.value; labCfgSave(); } } });
document.addEventListener("change",e=>{ const t=e.target; if(TK.test&&t.dataset.lc==="s0"){ const c=labCfg(); c.s0=+t.value; c.ladder.forEach(r=>{ if(r.size===c.s0) r.on=true; }); if(c.buy!=="auto"&&+c.buy<c.s0) c.buy="auto"; labCfgSave(); tkRender(); } });
document.addEventListener("click",e=>{ if(!TK.test) return; const lb=e.target.closest("[data-lb]"); if(lb){ const c=labCfg(); c.buy=lb.dataset.lb==="auto"?"auto":+lb.dataset.lb; labCfgSave(); tkRender(); return; }
  const b=e.target.closest("[data-lab]"); if(!b) return; const k=b.dataset.lab;
  if(k==="setup"){ labPlay(false); LAB.setup=true; tkRender(); }
  else if(k==="cancel"){ LAB.setup=false; tkRender(); }
  else if(k==="build") labBuild();
  else if(k==="defaults"){ LAB.cfg=labCfgDefault(); labCfgSave(); tkRender(); }
  else if(k==="report"){ LAB.showRep=!LAB.showRep; tkRender(); }
  else if(k==="print"){ document.body.classList.add("print-rep"); try{ window.print(); }catch(err){} setTimeout(()=>document.body.classList.remove("print-rep"),500); } });
document.addEventListener("change",e=>{ const t=e.target; if(t.id!=="labBuy"||!TK.test||!TK.state) return; const v=t.value==="auto"?"auto":+t.value; TK.state.p.buy=v; const c=labCfg(); c.buy=v; labCfgSave(); log(`From now on payouts reinvest into ${v==="auto"?"the size table":fmt(v)+" accounts"}.`); tkSave(); tkRender(); });
