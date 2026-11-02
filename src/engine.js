const $=id=>document.getElementById(id);
const STD=[5000,10000,25000,50000,100000,150000,200000,300000,400000];
const DEFAULT_FEE={5000:60,10000:100,25000:180,50000:300,100000:520,150000:750,200000:1000,300000:1400,400000:1800};
const feeMemo={};
/* reinvest ladder (guide default 80/65/50/30 at 20%/60%/100% of the goal), editable */
function defaultReinv(t){ return [{upto:0.2*t,rate:0.8,name:"Seed"},{upto:0.6*t,rate:0.65,name:"Build"},{upto:t,rate:0.5,name:"Scale"},{upto:null,rate:0.3,name:"Sustain"}]; }
function reinvRate(P,T1,stocked){ if(!stocked) return 1; const R=P.reinv&&P.reinv.length?P.reinv:defaultReinv(P.target); for(const r of R) if(r.upto==null||T1<r.upto) return r.rate; return R[R.length-1].rate; }
/* payout window: fixed at +lock%, or anywhere from +lock% to +lockMax% per cycle */
function lockPick(P,rnd){ const lo=P.lock, hi=Math.max(lo,P.lockMax||lo); return hi>lo?Math.round((lo+rnd*(hi-lo))*100)/100:lo; }
function lockTxt(P){ const hi=Math.max(P.lock,P.lockMax||P.lock); return hi>P.lock?`+${P.lock}–${hi}%`:`+${P.lock}%`; }
function lockMid(P){ return (P.lock+Math.max(P.lock,P.lockMax||P.lock))/2; }
function guessFee(s){ if(DEFAULT_FEE[s]) return DEFAULT_FEE[s]; return Math.round(Math.max(40, s*0.0055)/10)*10; }
const fmt=(v,d)=>{ if(!isFinite(v)) return "—"; const a=Math.abs(v), sg=v<0?"−":"";
  if(a>=1e6) return sg+"$"+(a/1e6).toFixed(a>=1e7?1:2).replace(/\.0+$/,"")+"M";
  if(a>=1e4) return sg+"$"+(a/1e3).toFixed(a>=1e5?0:1).replace(/\.0$/,"")+"K";
  return sg+"$"+a.toLocaleString("en-US",{maximumFractionDigits:d??0}); };
const fmtFull=v=>(v<0?"−":"")+"$"+Math.round(Math.abs(v)).toLocaleString("en-US");
const pct=(v,d=0)=>isFinite(v)?(v*100).toFixed(d)+"%":"—";
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
function weeksTxt(w){ if(w==null||!isFinite(w)) return "not reached"; if(w<9) return Math.round(w)+" wk"; return (w/4.33).toFixed(w<44?1:0).replace(/\.0$/,"")+" mo"; }
function quant(arr,q){ if(!arr.length) return NaN; const a=[...arr].sort((x,y)=>x-y); const i=(a.length-1)*q, lo=Math.floor(i), hi=Math.ceil(i); return a[lo]+(a[hi]-a[lo])*(i-lo); }
function mulberry(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;}}

/* ---------- risk styles (all stay inside prop rules) ---------- */
// k = recovery trades [funded, backup, evaluation]; High uses the low end of the guide's ranges so bigger risk can't break the firm limit
const RISK_LV={low:{name:"Low",base:0.5,k:[3,4,3],line:"Slow and steady. Survives long losing streaks."},
  med:{name:"Medium",base:1,k:[3,4,3],line:"The guide's pace. Balanced speed and safety."},
  high:{name:"High",base:2,k:[2,3,2],line:"Faster passes, more failed tests. Fewer recovery trades, so you never break the limit."}};
// biggest % per trade so that: 2+ losses before the cut, cut + all recovery losses stays under the firm max loss, and a day's trades stay under the daily limit
// deepest a balance can be when recovery ends: the loss that crosses the cut can overshoot it, then K more losses
function riskWorst(r,cut,K,rr){ const den=Math.abs(rr-Math.round(rr))<1e-9?1:2, g=r/den; const depth=Math.ceil(cut/g-1e-9)*g-g+r; return depth+K*r; }
function riskCap(maxdd,daily,tpd,cut,K,rr){ const lim=Math.min(maxdd*0.95,daily*0.8/Math.max(1,tpd)*1e9); let r=2;
  while(r>0.25&&(riskWorst(r,cut,K,rr||3)>lim||r*Math.max(1,tpd)>daily*0.8||r>cut/2)) r-=0.25; return r; }
function levelRisk(lv,R){ const L=RISK_LV[lv]||RISK_LV.med, k=L.k;
  const capE=Math.min(riskCap(R.maxdd,R.daily,R.tpd,R.c3,k[2],R.rr),riskCap(R.maxdd,R.daily,R.tpd,R.c2,k[1],R.rr)), capF=riskCap(R.maxdd,R.daily,R.tpd,R.c1,k[0],R.rr);
  return {riskE:Math.min(L.base,capE),riskF:Math.min(L.base,capF),k1:k[0],k2:k[1],k3:k[2]}; }
function ruleNums(){ return {rr:num("rr")||3,maxdd:num("maxdd"),daily:num("daily")||5,tpd:Math.max(1,Math.round(num("tpd"))),c1:num("c1"),c2:num("c2"),c3:num("c3")}; }
function applyLevel(lv){ if(!RISK_LV[lv]) return; const r=levelRisk(lv,ruleNums()); ["riskE","riskF","k1","k2","k3"].forEach(k=>$(k).value=r[k]); $("risklvl").value=lv; riskUI(); }
function riskUI(){ const R=ruleNums(), s0=num("s0"), cur=$("risklvl").value;
  Object.keys(RISK_LV).forEach(lv=>{ const r=levelRisk(lv,R); const el=$("rs_"+lv); if(el) el.textContent=fmtFull(s0*r.riskE/100); });
  document.querySelectorAll("#riskSeg [data-lvl]").forEach(b=>b.setAttribute("aria-checked",b.dataset.lvl===cur?"true":"false"));
  const rE=num("riskE"), rF=num("riskF"), L=RISK_LV[cur];
  $("riskHelp").textContent=L?`${L.line} ${rE}% per test trade, ${rF}% when funded.`:`Custom: ${rE}% per test trade, ${rF}% funded (More settings).`;
  const rr=num("rr"); $("rrHelp").innerHTML=rr<3?`<span class="warnt">The guide says at least 1 : 3. Below that, one win can't cover the losses.</span>`:"3 means you risk $1 to make $3."; }

/* ---------- inputs ---------- */
function num(id){ const v=parseFloat($(id).value); return isFinite(v)?v:0; }
function sizeOptions(){
  const s0=num("s0"), tgt=num("target"); const sel=$("maxsize"); const prev=sel.value;
  const opts=[s0, ...STD.filter(s=>s>s0)].filter((s,i,a)=>a.indexOf(s)===i && s<=Math.max(s0,tgt));
  const auto=autoMax(s0,tgt);
  sel.innerHTML=`<option value="auto">Auto (${fmt(auto)}, about 5 funded accounts at target)</option>`+opts.map(s=>`<option value="${s}">${fmt(s)}</option>`).join("");
  if([...sel.options].some(o=>o.value===prev)) sel.value=prev;
}
function autoMax(s0,tgt){ const cap=tgt/5; const c=[s0,...STD.filter(s=>s>s0&&s<=cap)]; return c[c.length-1]; }
function buildLadder(){
  const s0=num("s0"), tgt=num("target"); const mx=$("maxsize").value==="auto"?autoMax(s0,tgt):parseFloat($("maxsize").value);
  const sizes=[s0,...STD.filter(s=>s>s0&&s<=mx)];
  const k=sizes.length;
  return sizes.map((s,i)=>{
    let unlockT1=0, unlockPay=0;
    if(i>0){ const f=k===2?0.3:0.2+0.4*(i-1)/(k-2); unlockT1=Math.round(tgt*f/1000)*1000; unlockPay=10+15*(i-1); }
    return {size:s, fee:feeMemo[s]??guessFee(s), unlockT1, unlockPay};
  });
}
function renderLadder(){
  const L=buildLadder(); const tb=$("ladderTbl").tBodies[0];
  tb.innerHTML=L.map((r,i)=>`<tr><td class="mono">${fmt(r.size)}</td><td><input type="number" id="fee_${r.size}" data-size="${r.size}" value="${r.fee}" min="0" step="10" aria-label="Eval fee for ${fmt(r.size)}"></td><td class="hint">${i===0?"start":`T1 ≥ ${fmt(r.unlockT1)}, ${r.unlockPay}+ payouts`}</td></tr>`).join("");
  tb.querySelectorAll("input").forEach(inp=>inp.addEventListener("input",()=>{feeMemo[inp.dataset.size]=parseFloat(inp.value)||0;}));
}
function readParams(){
  const P={s0:num("s0"), n0:Math.max(1,Math.round(num("n0"))), target:num("target"),
    wr:num("wr")/100, rr:num("rr"), riskE:num("riskE"), riskF:num("riskF"), tpd:Math.max(1,Math.round(num("tpd"))),
    split:num("split")/100, approve:num("approve")/100, reserve:num("reserve"), topup:num("topup"),
    p1t:num("p1t"), p2t:num("p2t"), maxdd:num("maxdd"), mindays:Math.round(num("mindays")),
    lock:num("lock"), lockMax:num("lockMax"), horizon:num("horizon"), c1:num("c1"), c2:num("c2"), c3:num("c3"),
    k1:Math.round(num("k1")), k2:Math.round(num("k2")), k3:Math.round(num("k3")), corr:$("corr").checked, daily:num("daily")||5, risklvl:$("risklvl").value};
  // hard guard: never let risk break the firm's limits, whatever was typed
  const capE=Math.min(riskCap(P.maxdd,P.daily,P.tpd,P.c3,P.k3,P.rr),riskCap(P.maxdd,P.daily,P.tpd,P.c2,P.k2,P.rr)), capF=riskCap(P.maxdd,P.daily,P.tpd,P.c1,P.k1,P.rr);
  P.capped=P.riskE>capE||P.riskF>capF; P.riskE=Math.min(P.riskE,capE); P.riskF=Math.min(P.riskF,capF);
  P.ladder=buildLadder().map(r=>({...r, fee:feeMemo[r.size]??r.fee}));
  if(P.target<P.s0*P.n0) P.target=P.s0*P.n0;
  P.lockMax=Math.max(P.lock,P.lockMax||P.lock);
  { const d=defaultReinv(P.target), rv=i=>{ const v=parseFloat(($("ri_r"+i)||{}).value); return isFinite(v)?Math.max(0,Math.min(100,v))/100:d[i-1].rate; }, up=i=>{ const v=parseFloat(($("ri_u"+i)||{}).value); return isFinite(v)&&v>0?v:d[i-1].upto; };
    const u1=up(1), u2=Math.max(u1,up(2)), u3=Math.max(u2,up(3));
    P.reinv=[{upto:u1,rate:rv(1),name:"Seed"},{upto:u2,rate:rv(2),name:"Build"},{upto:u3,rate:rv(3),name:"Scale"},{upto:null,rate:rv(4),name:"Sustain"}]; }
  return P;
}

/* ---------- single-account Monte Carlo (unit economics) ---------- */
function phaseSim(rng,wr,rr,risk,tgt,cut,K,maxdd,maxTrades){
  let b=0,rec=-1,used=false,n=0;
  while(n<maxTrades){
    n++; b+= rng()<wr? risk*rr : -risk;
    if(b<=-maxdd) return {ok:false,n};
    if(rec>=0){ rec--; if(b>-cut){rec=-1;used=true;} else if(rec<=0) return {ok:false,n}; }
    else if(b<=-cut){ if(used||K===0) return {ok:false,n}; rec=K; }
    if(b>=tgt) return {ok:true,n};
  }
  return {ok:false,n};
}
function unitEcon(P,wr){
  const rng=mulberry(1234567); const N=12000;
  let p1=0,p2=0,t1n=0,t2n=0; for(let i=0;i<N;i++){ const a=phaseSim(rng,wr,P.rr,P.riskE,P.p1t,P.c3,P.k3,P.maxdd,400); if(a.ok){p1++;t1n+=a.n;
    const b=phaseSim(rng,wr,P.rr,P.riskE,P.p2t,P.c2,P.k2,P.maxdd,400); if(b.ok){p2++;t2n+=b.n;}}}
  const pP1=p1/N, pP2=p1?p2/p1:0, pFund=p2/N;
  // funded lifetime: count payouts until cut
  let totPay=0, cyc=0, cycOk=0, totPctPaid=0, payN=0;
  const M=4000;
  for(let i=0;i<M;i++){ let pays=0; for(let j=0;j<300;j++){ cyc++; const r=phaseSim(rng,wr,P.rr,P.riskF,lockMid(P),P.c1,P.k1,P.maxdd,500);
      if(r.ok && rng()<P.approve){ pays++; cycOk++; payN+=r.n; } else break; } totPay+=pays; }
  const pCycle=cycOk/cyc, ePays=totPay/M;
  const fee=P.ladder[0].fee, size=P.s0;
  const payout=size*lockMid(P)/100*P.split;
  const feePerFunded=pFund>0?fee/pFund:Infinity;
  const netPerFunded=ePays*payout-feePerFunded;
  const tradesFund=(p1?t1n/p1:0)+(p2?t2n/p2:0), tP1=p1?t1n/p1:0, tP2=p2?t2n/p2:0, tradesPay=cycOk?payN/cycOk:0;
  return {pP1,pP2,pFund,pCycle,ePays,payout,feePerFunded,netPerFunded,tradesFund,tP1,tP2,tradesPay,
    ev:wr*P.rr-(1-wr)};
}

/* ---------- full portfolio Monte Carlo ---------- */
function portfolioSim(P,wr,runs,seed,lg){
  const rng=mulberry(seed);
  const L=P.ladder, tgt=P.target;
  const days=Math.round(P.horizon*4.33)*5, weeks=Math.round(P.horizon*4.33);
  const milestones=[...L.slice(1).map(r=>r.unlockT1), tgt];
  const minFee=Math.min(...L.map(r=>r.fee));
  const out={weekly:[],reach:milestones.map(()=>[]),feesAt:milestones.map(()=>[]),fees:[],personal:[],capIn:[],net:[],bust:0,reached:0,
    pays:[],setupsGoal:[],ordersGoal:[],setupsAll:[],ordersAll:[],daysAll:[],reachedFlags:[],bustFlags:[],cutsT1:[],evals:[],monthlyEnd:[],grossPaid:[],endT1:[],reachMonths:[],milestones};
  for(let r=0;r<runs;r++){
    let accts=[], cash=P.reserve, capIn=P.reserve+P.n0*L[0].fee, fees=P.n0*L[0].fee, personal=0, gross=0;
    let lvl=0, proven=0, pays=0, cuts=0, evals=P.n0, fundedCtr=0, busted=false, lastCut=-99, consec=0, idc=0, peak=0; const last20=[]; const wr20=()=>last20.length>=20&&last20.filter(Boolean).length/last20.length>=0.4;
    const snap=()=>({T1:accts.reduce((s,a)=>s+(a.ph===3?a.size:0),0),T2:accts.reduce((s,a)=>s+((a.ph===2||a.ph===4)?a.size:0),0),T3:accts.reduce((s,a)=>s+(a.ph===1?a.size:0),0)});
    const laneOf=()=>{ const c=[0,0]; for(const x of accts) if(x.ph!==3&&x.ph!==4) c[x.lane]++; return c[0]<=c[1]?0:1; };
    const weekly=new Float32Array(weeks+1); const reach=milestones.map(()=>null); const feesAt=milestones.map(()=>null);
    const persWeek=new Float32Array(weeks+1);
    for(let i=0;i<P.n0;i++) accts.push({id:++idc,size:L[0].size,li:0,ph:1,b:0,d:0,rec:-1,used:false,off:0,lane:i%2,cs:0,cb:0,offW:-1});
    if(lg) lg({e:"start",d:0,w:0,n:P.n0,size:L[0].size,fee:L[0].fee,cash});
    let T1=0, evalLane=0, setups=0, orders=0, sGoal=null, oGoal=null, dRun=0;
    for(let d=0; d<days; d++){
      const w=Math.floor(d/5);
      if(P.topup>0 && d>0 && d%21===0){ cash+=P.topup; capIn+=P.topup; }
      // shared trade outcomes for the day
      const shared=[]; for(let t=0;t<P.tpd;t++) shared.push(rng()<wr);
      let dayPay=0; const promote=[]; let dMax=0, dSum=0;
      // guide: any account whose 4-week cycle ends in a loss goes offline for 1 week
      if(d%5===0) for(const a of accts){ if(w-a.cs>=4){ if(a.b<a.cb){ a.offW=w; if(lg) lg({e:"offline",d,w,id:a.id,ph:a.ph,b:a.b,cb:a.cb}); } a.cs=w; a.cb=a.b; } }
      // stagger evaluations: two lanes take turns by week, so two evals never trade the same window
      if(d%5===0){ const laneBusy=[false,false]; for(const a of accts) if((a.ph===1||a.ph===2)&&a.offW!==w) laneBusy[a.lane]=true; evalLane=laneBusy[w%2]?w%2:1-(w%2); } // fixed for the whole week
      for(const a of accts){
        if(a.ph===4) continue; // ready (passed P2, waiting for a T1 slot)
        const funded=a.ph===3;
        if(a.offW===w) continue; // offline week after a losing 4-week cycle
        if(funded && ((w+a.off)%3)!==0) continue; // OFF weeks
        if(!funded && a.lane!==evalLane) continue; // other eval's turn
        const tg=a.ph===1?P.p1t:a.ph===2?P.p2t:(a.pt||P.lock);
        const cut=a.ph===1?P.c3:a.ph===2?P.c2:P.c1;
        const K=a.ph===1?P.k3:a.ph===2?P.k2:P.k1;
        const risk=funded?P.riskF:P.riskE;
        a.d++; let nT=0;
        for(let t=0;t<P.tpd && a.b<tg && !a.dead;t++){ nT++;
          const win=P.corr?shared[t]:rng()<wr;
          a.b+= win? risk*P.rr : -risk; last20.push(win?1:0); if(last20.length>20) last20.shift();
          if(lg) lg({e:"trade",d,w,id:a.id,ph:a.ph,size:a.size,risk,win,b:a.b,lane:a.lane,off:a.off,offW:a.offW,rec:a.rec,tg,cut,K});
          if(a.b<=-P.maxdd){a.dead=true;a.why="maxdd";break;}
          if(a.rec>=0){ a.rec--; if(a.b>-cut){a.rec=-1;a.used=true; if(lg) lg({e:"recovered",d,w,id:a.id,ph:a.ph,b:a.b});} else if(a.rec<=0){a.dead=true;a.why="recfail";break;} }
          else if(a.b<=-cut){ if(a.used||K===0){a.dead=true;a.why="again";break;} a.rec=K; if(lg) lg({e:"recStart",d,w,id:a.id,ph:a.ph,b:a.b,K,cut}); }
        }
        dSum+=nT; if(nT>dMax) dMax=nT;
        if(a.dead) continue;
        if(a.b>=tg && a.d>=P.mindays){
          if(a.ph===1){ if(lg) lg({e:"pass1",d,w,id:a.id,size:a.size,b:a.b,days:a.d}); a.ph=2; a.b=0;a.d=0;a.rec=-1;a.used=false;a.cs=w;a.cb=0; }
          else if(a.ph===2){ if(lg) lg({e:"pass2",d,w,id:a.id,size:a.size,b:a.b,days:a.d}); a.ph=4; a.b=0;a.d=0;a.rec=-1;a.used=false; promote.push(a); }
          else { if(rng()<P.approve){ const amt=a.size*a.b/100*P.split; if(lg) lg({e:"payout",d,w,id:a.id,size:a.size,b:a.b,amt,pt:a.pt||P.lock}); a.pt=lockPick(P,rng()); dayPay+=amt; pays++; consec++; a.b=0;a.d=0;a.rec=-1;a.cs=w;a.cb=0; /* recovery stays used: once per funded account */ } else { a.dead=true; a.why="refused"; } }
        }
      }
      setups+=P.corr?dMax:dSum; orders+=dSum; dRun=d+1;
      // remove dead
      for(const a of accts) if(a.dead){ if(lg) lg({e:"cut",d,w,id:a.id,ph:a.ph,size:a.size,b:a.b,why:a.why}); if(a.ph===3){ cuts++; lastCut=d; consec=0; } }
      accts=accts.filter(a=>!a.dead);
      // promotions into T1 while below target
      T1=accts.reduce((s,a)=>s+(a.ph===3?a.size:0),0);
      // guide: a passed Phase 2 account waits on the Tier 2 bench. It goes live to refill Tier 1 (start or after a cut),
      // or to grow Tier 1 only when 3 payouts in a row, no cut in 14 days, and Tier 2 = 60% / Tier 3 = 40% of the NEW Tier 1 stay stocked.
      for(const a of accts){ if(a.ph!==4||T1>=tgt) continue; const nT1=T1+a.size;
        const T2b=accts.reduce((s,x)=>s+((x.ph===2||x.ph===4)?x.size:0),0)-a.size, T3b=accts.reduce((s,x)=>s+(x.ph===1?x.size:0),0);
        const refill=nT1<=Math.max(P.n0*P.s0,peak), gate=consec>=3&&d-lastCut>10&&wr20(), ok=refill||(gate&&T2b>=0.6*nT1-1&&T2b+T3b>=nT1-1);
        if(ok){ const T1b=T1, pk=peak; a.ph=3; a.pt=lockPick(P,rng()); a.off=(fundedCtr++)%3; a.cs=w; a.cb=0; T1+=a.size; if(a.li>proven) proven=a.li; peak=Math.max(peak,T1); if(lg) lg({e:"funded",d,w,id:a.id,size:a.size,off:a.off,T1,T1b,nT1,T2b,T3b,peak:pk,base:P.n0*P.s0,consec,sinceCut:d-lastCut,wr:wr20(),refill}); } }
      // allocate payouts
      if(dayPay>0){
        gross+=dayPay;
        const T2=accts.reduce((s,a)=>s+((a.ph===2||a.ph===4)?a.size:0),0), T3=accts.reduce((s,a)=>s+(a.ph===1?a.size:0),0);
        const stocked=T1>0 && T2>=0.6*T1-1&&T2+T3>=T1-1;
        const rate=reinvRate(P,T1,stocked);
        cash+=dayPay*rate; personal+=dayPay*(1-rate); persWeek[w]+=dayPay*(1-rate);
        if(lg) lg({e:"alloc",d,w,amt:dayPay,rate,stocked,T1,T2,T3,toPool:dayPay*rate,personal:dayPay*(1-rate),cash});
      }
      // upgrade ladder
      // guide scale-up checklist: 3+ payouts in a row and no funded cut in the last 14 days (10 trading days)
      // guide: all five must be true (3 payouts in a row, no cut in 14 days, win rate 40%+ over 20 trades, T2 = 60% and T3 = 40% of T1)
      const uT2=accts.reduce((s,a)=>s+((a.ph===2||a.ph===4)?a.size:0),0), uT3=accts.reduce((s,a)=>s+(a.ph===1?a.size:0),0);
      const growOk=consec>=3 && d-lastCut>10 && wr20() && T1>0 && uT2>=0.6*T1-1&&uT2+uT3>=T1-1;
      while(growOk && lvl<L.length-1 && T1>=L[lvl+1].unlockT1 && pays>=L[lvl+1].unlockPay){ lvl++; if(lg) lg({e:"upgrade",d,w,size:L[lvl].size,T1,pays,consec,unlockT1:L[lvl].unlockT1,unlockPay:L[lvl].unlockPay,sinceCut:d-lastCut,wr:wr20(),T2:uT2,T3:uT3}); }
      // buy evals (restock T3 first; T2 only refills by passing T3)
      let pipe=accts.reduce((s,a)=>s+(a.ph!==3?a.size:0),0);
      let t3cap=accts.reduce((s,a)=>s+(a.ph===1?a.size:0),0);
      // growing: stock the bench for the NEXT Tier 1 account too (T2 60% + T3 40% of T1 + one more account)
      const growS=T1>0&&T1<tgt?L[lvl].size:0, base1=Math.min(T1,tgt);
      const tgtB=base1+growS, pipeTarget=Math.max(base1+2*growS, P.n0*P.s0), t3Target=Math.max(0,0.4*tgtB-Math.max(0,(pipe-t3cap)-(0.6*tgtB+growS))); /* extra Phase 2 accounts count for the Evaluation tier */
      let guard=0;
      while((pipe<pipeTarget || (T1>0 && t3cap<t3Target-1)) && guard++<50){
        let li=lvl; let outNew=false;
        if(lvl>proven){ outNew=accts.some(a=>a.li===lvl && a.ph!==3); if(outNew) li=proven; }
        const fee=L[li].fee; if(cash<fee) break;
        const why=T1>0&&t3cap<t3Target-1?"t3":"pipe";
        cash-=fee; fees+=fee; evals++;
        const nb={id:++idc,size:L[li].size,li,ph:1,b:0,d:0,rec:-1,used:false,off:0,lane:laneOf(),cs:w,cb:0,offW:-1}; accts.push(nb); if(lg) lg({e:"buy",d,w,id:nb.id,size:nb.size,fee,why,pipe,t3cap,pipeTarget,t3Target,cash,lane:nb.lane,newSize:lvl>proven,heldBack:outNew,T1}); pipe+=L[li].size; t3cap+=L[li].size;
      }
      // milestones
      for(let m=0;m<milestones.length;m++) if(reach[m]==null && T1>=milestones[m]){ reach[m]=(d+1)/5; feesAt[m]=fees; if(m===milestones.length-1){ sGoal=setups; oGoal=orders; } if(lg) lg({e:"milestone",d,w,v:milestones[m],goal:m===milestones.length-1,...snap()}); }
      if(lg&&(d+1)%5===0) lg({e:"week",d,w,...snap(),cash,personal,fees,pays,lvl});
      if(lg&&reach[reach.length-1]!=null) break;
      if((d+1)%5===0) weekly[w+1]=T1;
      if(accts.length===0 && cash<minFee && P.topup<=0){ busted=true; break; }
    }
    out.weekly.push(weekly);
    reach.forEach((v,m)=>{ if(v!=null){ out.reach[m].push(v); out.feesAt[m].push(feesAt[m]); } });
    if(reach[reach.length-1]!=null){ out.reached++; out.setupsGoal.push(sGoal); out.ordersGoal.push(oGoal); }
    out.setupsAll.push(setups); out.ordersAll.push(orders); out.daysAll.push(dRun);
    if(busted) out.bust++; out.bustFlags.push(busted);
    out.fees.push(fees); out.personal.push(personal); out.capIn.push(capIn);
    out.net.push(personal+cash-capIn); out.pays.push(pays); out.cutsT1.push(cuts); out.evals.push(evals); out.grossPaid.push(gross);
    out.endT1.push(T1); out.reachedFlags.push(reach[reach.length-1]!=null);
    let last=0; for(let k=Math.max(0,weeks-13);k<=weeks;k++) last+=persWeek[k]; out.monthlyEnd.push(last/3);
  }
  out.runs=runs; out.weeks=weeks;
  out.median=new Array(weeks+1).fill(0).map((_,i)=>quant(out.weekly.map(x=>x[i]),0.5));
  out.p10=new Array(weeks+1).fill(0).map((_,i)=>quant(out.weekly.map(x=>x[i]),0.1));
  out.p90=new Array(weeks+1).fill(0).map((_,i)=>quant(out.weekly.map(x=>x[i]),0.9));
  return out;
}


/* ---------- trades needed: same plan, 1..5 trades a day (risk re-capped to the firm limits for each) ---------- */
function tradesNeeded(P,wr,runs){
  const rows=[]; const top=Math.min(5,Math.max(P.tpd,3));
  for(let t=1;t<=top;t++){
    const Q={...P,tpd:t};
    const capE=Math.min(riskCap(Q.maxdd,Q.daily,t,Q.c3,Q.k3,Q.rr),riskCap(Q.maxdd,Q.daily,t,Q.c2,Q.k2,Q.rr)), capF=riskCap(Q.maxdd,Q.daily,t,Q.c1,Q.k1,Q.rr);
    Q.riskE=Math.min(Q.riskE,capE); Q.riskF=Math.min(Q.riskF,capF);
    const m=portfolioSim(Q,wr,runs||70,4242+t*13);
    rows.push(tradeRow(Q,m,t));
  }
  return rows;
}
function tradeRow(Q,m,t){
  const r=m.reach[m.reach.length-1], ok=r.length>m.runs*0.5, wk=ok?quant(r,0.5):null, mo=ok?wk/4.33:null;
  const setG=ok?quant(m.setupsGoal,0.5):null, ordG=ok?quant(m.ordersGoal,0.5):null;
  const perMo=ok?setG/mo:quant(m.setupsAll.map((v,i)=>v/Math.max(1,m.daysAll[i]/21.65)),0.5);
  return {tpd:t,riskE:Q.riskE,riskF:Q.riskF,ok,wk,mo,setG,ordG,perMo,ordMo:ok?ordG/mo:null,reach:m.reached/m.runs,bust:m.bust/m.runs};
}
