// Drives the REAL daily coach through its buttons (not the lab) and re-checks every number with independent math.
const {chromium}=require('playwright');
const runs=[{seed:11,wr:.40,rr:3},{seed:23,wr:.40,rr:3},{seed:5,wr:.30,rr:3},{seed:77,wr:.50,rr:3}];
(async()=>{const b=await chromium.launch();
for(const R of runs){const pg=await b.newPage();const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto('file:///home/claude/tier-plan/index.html#build');await pg.waitForTimeout(800);
await pg.evaluate(()=>{localStorage.clear();});await pg.goto('file:///home/claude/tier-plan/index.html#build');await pg.waitForTimeout(2200);
await pg.click('#startTrack');await pg.waitForTimeout(500);
const res=await pg.evaluate(async(R)=>{
 const T=window.__tk, TK=T.TK, st0=TK.state; const E=[]; let n=0;
 const err=(m)=>{ if(E.length<25) E.push(T.todayStr()+" "+m); }; const ok=()=>n++;
 let a=R.seed>>>0; const rng=()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
 const p=TK.state.p; const split=p.split>1?p.split/100:p.split; const fees=s=>(p.ladder.find(r=>r.size===s)||{}).fee;
 // independent ledger
 let pool=p.reserve, home=0, peak=0; const fail={1:0,2:0,3:0};
 const sum=(st,ph)=>st.accounts.filter(x=>x.status==="active"&&x.phase===ph).reduce((s,x)=>s+x.size,0);
 const gate=(st)=>{ const cutF=st.cuts.filter(c=>c.phase===3).map(c=>c.d).sort().pop()||""; const consec=st.payouts.filter(x=>!cutF||x.d>=cutF).length; const t=st.trades.slice(-20);
   return consec>=3&&(!cutF||T.dnum(T.todayStr())-T.dnum(cutF)>=14)&&t.length>=20&&t.filter(Boolean).length/t.length>=0.4; };
 const canGo=(st,acc)=>{ const T1=sum(st,3),T2=sum(st,2)-acc.size,T3=sum(st,1),nT1=T1+acc.size; if(T1>=st.p.target) return false; if(nT1<=Math.max(st.p.n0*st.p.s0,peak)) return true; return gate(st)&&T2>=0.6*nT1-1&&T3>=0.4*nT1-1; };
 const expRate=(st)=>{ const T1=sum(st,3),T2=sum(st,2),T3=sum(st,1); if(!(T1>0&&T2>=0.6*T1-1&&T3>=0.4*T1-1)) return 1; const t=st.p.target; return T1<0.2*t?0.8:T1<0.6*t?0.65:T1<t?0.5:0.3; };
 const click=sel=>{ const el=document.querySelector(sel); if(!el) return false; el.click(); return true; };
 const start=new Date(st0.start+"T12:00:00"); let goal=null, bust=false;
 for(let day=0; day<900; day++){
  const d=new Date(start.getTime()+day*86400000); TK.testDay=d.toISOString().slice(0,10);
  const st=TK.state;
  // morning: app opens, daily tick (bench refills after cuts)
  const ready=st.accounts.filter(x=>x.status==="active"&&x.ready&&x.phase===2);
  const exp=[]; { const sim=JSON.parse(JSON.stringify(st)); ready.forEach(r=>{ const x=sim.accounts.find(y=>y.id===r.id); if(canGo(sim,x)){ x.phase=3; exp.push(x.id); peak=Math.max(peak,sum(sim,3)); } }); }
  T.tkTick(st); T.tkRender();
  const got=st.accounts.filter(x=>ready.some(r=>r.id===x.id)&&x.phase===3).map(x=>x.id);
  if(JSON.stringify(exp.sort())!==JSON.stringify(got.sort())) err(`bench refill: expected ${exp} got ${got}`); else ok();
  peak=Math.max(peak,sum(st,3));
  const dow=d.getDay(); if(dow===0||dow===6) continue;
  for(const acc of st.accounts.filter(x=>x.status==="active")){
   if(acc.status!=="active") continue;
   const v=T.advise(acc,st), pct=(acc.bal-acc.size)/acc.size*100;
   if(v.kind==="payout"){ const want=(acc.bal-acc.size)*split, r=expRate(st);
     if(Math.abs(v.pay-want)>0.01) err(`payout ${v.pay} vs ${want}`); else ok();
     const amt=Math.round(v.pay*100)/100; click(`[data-tk="payout"][data-id="${acc.id}"]`);
     const pr=st.payouts[st.payouts.length-1]; if(Math.abs(pr.amt-amt)>0.001||Math.abs(pr.rate-r)>1e-9) err(`payout split ${pr.rate} vs ${r}`); else ok();
     pool+=amt*r; home+=amt*(1-r); continue; }
   if(v.kind==="cut"){ const c=acc.phase===1?p.c3:acc.phase===2?p.c2:p.c1; if(!(pct<=-c+1e-9)) err(`cut at ${pct}`); else ok(); fail[acc.phase]++; click(`[data-tk="cut"][data-id="${acc.id}"]`); if(acc.status!=="failed") err("cut did nothing"); continue; }
   if(v.kind==="pass"){ err(`${acc.name} needed Mark passed (auto pass missed)`); click(`[data-tk="pass"][data-id="${acc.id}"]`); continue; }
   if(v.kind==="rest"||v.kind==="bench") { if(v.kind==="bench") ok(); continue; }
   if(v.kind==="wait"){ const ph=acc.phase; let allowed=null; if(ph===2&&acc.days.length+ (acc.days.includes(T.todayStr())?0:1)>=p.mindays){ const sim=JSON.parse(JSON.stringify(st)); const x=sim.accounts.find(y=>y.id===acc.id); allowed=canGo(sim,x); }
     const inp=document.querySelector(`[data-bal="${acc.id}"]`); inp.value=String(acc.bal); click(`[data-tk="log"][data-id="${acc.id}"]`);
     if(allowed!==null){ const live=acc.phase===3; if(live!==allowed) err(`${acc.name} bench rule (after min days): live=${live} expected ${allowed}`); else ok(); if(!live&&!acc.ready) err(`${acc.name} passed P2 but not on bench`); }
     if(ph===1&&acc.days.length>=p.mindays&&acc.phase!==2) err(`${acc.name} Phase 1 not moved after min days`);
     continue; }
   if(v.kind==="trade"||v.kind==="recover"){
     const risk=acc.size*(acc.phase===3?p.riskF:p.riskE)/100; if(Math.abs(v.riskUsd-risk)>0.5) err(`risk ${v.riskUsd} vs ${risk}`); else ok();
     let bal=acc.bal; const nT=v.kind==="recover"?1:(p.tpd||1);
     for(let i=0;i<nT;i++){ bal+= rng()<R.wr? v.riskUsd*p.rr : -v.riskUsd; if(bal<=v.dailyStop||bal>=v.tgtUsd) break; }
     bal=Math.round(bal*100)/100; const ph=acc.phase, tg=ph===1?p.p1t:ph===2?p.p2t:p.lock, dn=acc.days.length+(acc.days.includes(T.todayStr())?0:1), hit=(bal-acc.size)/acc.size*100>=tg-1e-9&&ph<3&&dn>=p.mindays;
     let allowed=null; if(hit&&ph===2){ const sim=JSON.parse(JSON.stringify(st)); const x=sim.accounts.find(y=>y.id===acc.id); x.bal=bal; x.days.push(T.todayStr()); allowed=canGo(sim,x); }
     const inp=document.querySelector(`[data-bal="${acc.id}"]`); if(!inp){ err(`no balance box for ${acc.name}`); continue; } inp.value=String(bal); click(`[data-tk="log"][data-id="${acc.id}"]`);
     if(acc.phase===ph&&!acc.ready&&acc.bal!==bal) err(`balance not saved`); else ok();
     if(hit&&ph===1){ if(acc.phase!==2) err(`${acc.name} hit Phase 1 target, not moved`); else ok(); }
     if(hit&&ph===2){ const live=acc.phase===3; if(live!==allowed) err(`${acc.name} bench rule: live=${live} expected ${allowed}`); else ok(); if(!live&&!acc.ready) err(`${acc.name} passed P2 but not on bench`); }
     if((acc.bal-acc.size)/acc.size*100<=-p.maxdd) err(`${acc.name} broke max loss`);
     peak=Math.max(peak,sum(st,3));
   }
  }
  // buy what the coach says, with its own button
  let g=0; while(g++<8){ const btn=document.querySelector('[data-tk="buy"]'); if(!btn) break; const size=+btn.dataset.size, fee=+btn.dataset.fee;
    if(fee!==fees(size)) err(`fee ${fee} for ${size}`); else ok(); if(TK.state.pool<fee-1e-9) err(`buy shown without Reinvestment`); btn.click(); pool-=fee; }
  if(Math.abs(TK.state.pool-pool)>0.01||Math.abs(TK.state.personal-home)>0.01) err(`ledger: Reinvestment ${TK.state.pool.toFixed(2)} vs ${pool.toFixed(2)}, home ${TK.state.personal.toFixed(2)} vs ${home.toFixed(2)}`); else ok();
  const T1=sum(st,3); if(T1>=p.target){ goal=day+1; break; }
  if(!st.accounts.some(x=>x.status==="active")&&TK.state.pool<Math.min(...p.ladder.map(r=>r.fee))){ bust=true; goal=day+1; break; }
 }
 const st=TK.state; const sizes={}; st.accounts.forEach(x=>sizes[x.size]=(sizes[x.size]||0)+1);
 return {checks:n,errors:E,end:goal,bust,payouts:st.payouts.length,home:Math.round(st.personal),reinv:Math.round(st.pool),failed:fail,tests:st.accounts.length,sizes,next:document.querySelector('.tk-next b')&&document.querySelector('.tk-next b').textContent};
},R);
console.log(JSON.stringify(R),JSON.stringify(res),errs);await pg.close();}
await b.close();})();
