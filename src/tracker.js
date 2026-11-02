/* ---------- live tracker ---------- */
const TK={state:null, store:null, ready:false, test:false, testDay:null};
const DAY=86400000;
const todayStr=()=>{ const d=TK.testDay?new Date(TK.testDay+"T12:00:00"):new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const dnum=s=>Math.floor(new Date(s+"T12:00:00").getTime()/DAY);
const fmtDate=s=>new Date(s+"T12:00:00").toLocaleDateString("en-GB",{day:"numeric",month:"short"});
const uid=()=>Math.random().toString(36).slice(2,9);
const PH={1:"Pipeline · Phase 1",2:"Backup · Phase 2",3:"Funded"};
const PHC={1:"t3",2:"t2",3:"t1"};

/* storage: private per-trader doc in db, else this browser */
async function tkStoreInit(){
  if(window.TSAuth&&window.TSAuthReady){ try{ await window.TSAuthReady; }catch(e){} if(window.TSAuth.user&&window.TSAuth.ok){ TK.store=window.TSAuth.store(); return; } }
  let db=null,user=null;
  try{ if(window.claude&&window.claude.use){ [db,user]=await Promise.all([window.claude.use("db"),window.claude.use("user")]); } }catch(e){}
  if(db&&user){ try{ const id=await user.id(); if(id){ const ref=db.collection("data/users/"+id).doc("tracker");
    TK.store={kind:"cloud",async load(){ const s=await ref.get(); const d=s.data(); return d&&typeof d.json==="string"?JSON.parse(d.json):null; },async save(o){ await ref.set({json:JSON.stringify(o),updated:Date.now()}); }}; return; } }catch(e){} }
  TK.store={kind:"local",async load(){ try{ const t=localStorage.getItem("ts-tracker"); return t?JSON.parse(t):null; }catch(e){ return null; } },async save(o){ try{ localStorage.setItem("ts-tracker",JSON.stringify(o)); }catch(e){} }};
}
let saveT=null;
function tkSave(){ clearTimeout(saveT); saveT=setTimeout(async()=>{ try{ await TK.store.save(TK.state); tkSaved(true); }catch(e){ tkSaved(false); } },400); }
function tkSaved(ok){ const el=$("tkSave"); if(el) el.textContent=ok?(TK.store.kind==="test"?"Test data only":TK.store.kind==="cloud"?"Saved to your account":"Saved in this browser"):"Couldn't save. Check your connection."; }
function log(text){ TK.state.log.unshift({d:todayStr(),t:text}); TK.state.log=TK.state.log.slice(0,200); }

/* create from plan */
function tkFromPlan(Pin){
  const P=Pin&&Pin.s0?Pin:readParams();
  const keep=["s0","n0","target","wr","rr","riskE","riskF","split","p1t","p2t","maxdd","daily","tpd","mindays","lock","c1","c2","c3","k1","k2","k3","reserve","risklvl","scale","buy","reinv","lockMax"];
  const p={}; keep.forEach(k=>{ if(P[k]!==undefined) p[k]=P[k]; });
  p.ladder=P.ladder.map(r=>({size:r.size,fee:r.fee,unlockT1:r.unlockT1,unlockPay:r.unlockPay}));
  p.firm=typeof firmApplied!=="undefined"&&firmApplied?firmApplied:"";
  const st={v:2,start:todayStr(),p,pool:P.reserve,personal:0,spent:P.n0*P.ladder[0].fee,payouts:[],accounts:[],log:[],trades:[],cuts:[]};
  for(let i=0;i<P.n0;i++) st.accounts.push(newAcct(P.s0,1,st));
  TK.state=st; log(`Plan started: ${P.n0} × ${fmt(P.s0)} evaluations, goal ${fmt(P.target)} funded.`); if(P.n0>1) log(`Evaluations take turns by week (#1 this week, #2 next week), so one bad week can't hit both.`);
  if(TK.test){ st.testDay=todayStr(); st.p.mindays=0; log("Test mode: the minimum trading days rule is off, so accounts move the moment they hit target."); }
  tkSave(); location.hash=TK.test?"lab":"track"; tkRender();
}
function newAcct(size,phase,st){ const n=(st.accounts.length+1); return {id:uid(),name:`#${n} ${fmt(size)}`,size,phase,bal:size,dayStart:size,days:[],rec:-1,recUsed:false,off:0,lane:freeLane(st),cyc:{s:todayStr(),b:size},offUntil:"",status:"active",created:todayStr(),hist:[]}; }
/* evals take turns by week (2 lanes) so two evals never trade the same window */
function freeLane(st){ const c=[0,0]; st.accounts.forEach(x=>{ if(x.status==="active"&&x.phase!==3&&x.lane!=null) c[x.lane]++; }); return c[0]<=c[1]?0:1; }
function tkMigrate(st){ if(!st) return st; st.trades=st.trades||[]; st.cuts=st.cuts||[];
  let i=0; st.accounts.forEach(a=>{ if(a.lane==null) a.lane=(i++)%2; if(!a.cyc) a.cyc={s:a.created||st.start,b:a.size}; if(a.offUntil==null) a.offUntil=""; }); return st; }
/* guide: a 4-week cycle that ends in a loss puts the account offline for 1 week */
function tkTick(st){ let ch=false; const t=todayStr(); if(!TK.test&&TK.state===st&&promoteReady(st)) ch=true;
  st.accounts.forEach(a=>{ if(a.status!=="active") return; if(dnum(t)-dnum(a.cyc.s)>=28){ if(a.bal<a.cyc.b){ const u=new Date(new Date(t+"T12:00:00").getTime()+7*DAY).toISOString().slice(0,10); a.offUntil=u; log(`${a.name} lost money over its 4-week cycle. Offline until ${fmtDate(u)}.`); } a.cyc={s:t,b:a.bal}; ch=true; } });
  return ch; }
const offline=a=>a.offUntil&&todayStr()<a.offUntil;

/* rules per account */
function rulesFor(a,p){ const ph=a.phase;
  return {tgt:ph===1?p.p1t:ph===2?p.p2t:(a.pt||p.lock), cut:ph===1?p.c3:ph===2?p.c2:p.c1, K:ph===1?p.k3:ph===2?p.k2:p.k1, risk:ph===3?p.riskF:p.riskE}; }
function weekIdx(st){ return Math.floor((dnum(todayStr())-dnum(st.start))/7); }
function evalLane(st){ const w=weekIdx(st);
  if(st.laneWeek&&st.laneWeek.w===w) return st.laneWeek.lane; // fixed for the whole week
  const busy=[false,false]; st.accounts.forEach(x=>{ if(x.status==="active"&&x.phase!==3&&!offline(x)) busy[x.lane]=true; });
  const lane=busy[w%2]?w%2:1-(w%2); st.laneWeek={w,lane}; return lane; }
function isOn(a,st){ if(offline(a)) return false; return a.phase===3 ? (weekIdx(st)%3)===a.off : a.lane===evalLane(st); }
function nextOnDate(a,st){ if(offline(a)) return a.offUntil; const w=weekIdx(st), m=a.phase===3?3:2, o=a.phase===3?a.off:a.lane; let k=1; while(((w+k)%m)!==o) k++; const d=new Date(new Date(st.start+"T12:00:00").getTime()+(w+k)*7*DAY); return d.toISOString().slice(0,10); }

function advise(a,st){
  const p=st.p, r=rulesFor(a,p), pct=(a.bal-a.size)/a.size*100;
  const riskUsd=a.size*r.risk/100, tgtUsd=a.size*(1+r.tgt/100), cutUsd=a.size*(1-r.cut/100);
  const dailyStop=a.dayStart-a.size*Math.min(p.daily,r.cut)/100*0.8;
  const daysDone=a.days.length, needDays=a.phase===3?p.mindays:p.mindays;
  const base={riskUsd,tgtUsd,cutUsd,pct,dailyStop,r};
  if(a.ready&&a.phase===2) return {...base,kind:"bench",pill:"BENCH",title:"Passed. Waiting on the Tier 2 bench",text:`Don't trade it. It goes live the moment a funded account is cut, or when Tier 1 can grow: 3 payouts in a row, no cut in 14 days, and Tier 2 = 60% and Tier 3 = 40% of the bigger Tier 1.`};
  if(pct<=-r.cut){
    if(a.rec<0&&!a.recUsed&&r.K>0) return {...base,kind:"recover",pill:"RECOVERY",title:`Recovery: up to ${r.K} trades`,text:`It's down ${Math.abs(pct).toFixed(1)}%. Take at most ${r.K} trades at the normal ${fmtFull(riskUsd)} risk to get back above ${fmtFull(cutUsd)}. Never bigger. Log the balance after each trade.`,act:"startRec"};
    if(a.rec>0) return {...base,kind:"recover",pill:"RECOVERY",title:`${a.rec} recovery trade${a.rec>1?"s":""} left`,text:`Risk ${fmtFull(riskUsd)} per trade. Get above ${fmtFull(cutUsd)} or close it. Log the balance after each trade.`,act:"recTrade"};
    return {...base,kind:"cut",pill:"CUT IT",title:"Close this account",text:a.phase===3?`It didn't recover. Close it. Your best backup account replaces it as soon as it passes, and buy a new Phase 1 evaluation.`:`It didn't recover. Close it and buy a new evaluation from Reinvestment.`,act:"cut"};
  }
  if(pct>=r.tgt){
    if(daysDone<needDays) return {...base,kind:"wait",pill:"HOLD",title:`Target hit. ${needDays-daysDone} more trading day${needDays-daysDone>1?"s":""} to pass`,text:`The firm needs ${needDays} trading days (you have ${daysDone}). Take one tiny trade a day and log the balance. It moves to ${a.phase===1?"Tier 2 (Phase 2)":"Tier 1 (funded)"} by itself on day ${needDays}.`};
    if(a.phase===3){ const pay=(a.bal-a.size)*(p.split>1?p.split/100:p.split), hi=Math.max(p.lock,p.lockMax||p.lock), win=hi>p.lock&&!a.pt&&pct<hi;
      return {...base,kind:"payout",pill:"PAYOUT",title:`Request your payout: about ${fmtFull(pay)}`,text:win?`It's up ${pct.toFixed(1)}%, inside your +${p.lock}–${hi}% window. Ask now, or keep trading to at most +${hi}%. Log the payout here when you take it.`:`It's up ${pct.toFixed(1)}%. Ask the firm for the payout now, then log it here.`,act:"payout",pay}; }
    return {...base,kind:"pass",pill:"PASSED",title:a.phase===1?"Passed Phase 1":"Passed Phase 2, now funded",text:a.phase===1?"Mark it passed. It moves to Backup (Phase 2).":"Mark it passed. It joins your funded accounts.",act:"pass"};
  }
  if(!isOn(a,st)){ if(offline(a)) return {...base,kind:"rest",pill:"OFFLINE",title:"Offline week, don't trade",text:`Its last 4 weeks ended in a loss. Rule: rest it 1 full week. Back on ${fmtDate(a.offUntil)}.`};
    if(a.phase===3) return {...base,kind:"rest",pill:"REST",title:"Rest week, don't trade",text:`Funded accounts trade 1 week, rest 2. Next trading week starts ${fmtDate(nextOnDate(a,st))}.`};
    return {...base,kind:"rest",pill:"WAIT",title:"Not its turn yet",text:`Your other evaluation trades this week. Two evals never trade the same week, so one bad week can't hit both. Its turn starts ${fmtDate(nextOnDate(a,st))}.`}; }
  const toGo=tgtUsd-a.bal;
  return {...base,kind:"trade",pill:"TRADE",title:`Trade today: risk ${fmtFull(riskUsd)} per trade`,text:`Aim for 1 : ${p.rr}. ${fmtFull(toGo)} to go to ${a.phase===3?"payout":"pass"}. Stop for the day if it drops to ${fmtFull(dailyStop)}.`};
}

function portfolio(st){
  const act=st.accounts.filter(a=>a.status==="active");
  const T1=act.filter(a=>a.phase===3).reduce((s,a)=>s+a.size,0), T2=act.filter(a=>a.phase===2).reduce((s,a)=>s+a.size,0), T3=act.filter(a=>a.phase===1).reduce((s,a)=>s+a.size,0);
  const p=st.p, L=p.ladder, pays=st.payouts.length;
  const lastCut=st.cuts.filter(c=>c.phase===3).map(c=>c.d).sort().pop()||"";
  const consec=st.payouts.filter(x=>!lastCut||x.d>=lastCut).length, last20=st.trades.slice(-20), wr20=last20.length?last20.filter(Boolean).length/last20.length:0;
  const grow=[[consec>=3,`3 payouts in a row (${consec})`],[!lastCut||dnum(todayStr())-dnum(lastCut)>=14,"No funded account cut in 14 days"],[last20.length>=20&&wr20>=0.4,`Win rate 40%+ over last 20 trades (${last20.length?Math.round(wr20*100)+"% of "+last20.length:"none yet"})`],[T1>0&&T2>=0.6*T1-1,"Backup = 60% of funded"],[T1>0&&T3>=0.4*T1-1,"Pipeline = 40% of funded"]];
  if(p.scale==="simple") grow.splice(2); /* lab option: 3 payouts in a row + no cut, like the planner */
  const growOk=grow.every(g=>g[0]);
  let lvl=0; while(growOk&&lvl<L.length-1&&T1>=L[lvl+1].unlockT1&&pays>=L[lvl+1].unlockPay) lvl++;
  const provenMax=Math.max(0,...st.accounts.filter(a=>a.phase===3||a.status==="paid").map(a=>L.findIndex(r=>r.size===a.size)));
  let buySize=L[lvl].size; let note="";
  if(p.buy&&p.buy!=="auto"){ buySize=+p.buy; note=`You chose to reinvest into ${fmt(buySize)} accounts.`; }
  else if(lvl>provenMax){ const outNew=act.some(a=>a.size===L[lvl].size&&a.phase!==3); if(outNew){ buySize=L[provenMax].size; note=`Wait for your first ${fmt(L[lvl].size)} account to get funded before buying more of that size.`; } else note=`You unlocked ${fmt(L[lvl].size)} accounts. Buy just ONE first.`; }
  const fee=(L.find(r=>r.size===buySize)||{fee:guessFee(buySize)}).fee;
  /* guide: Tier 2 = 60% and Tier 3 = 40% of Tier 1 before Tier 1 grows, so while growing stock the bench for one more account */
  const growS=T1>0&&T1<p.target?buySize:0, base1=Math.min(T1,p.target);
  const pipeTarget=Math.max(base1+2*growS,p.n0*p.s0);
  const needT3=T1>0?Math.max(0,0.4*(base1+growS)-T3):0, needPipe=Math.max(0,pipeTarget-T2-T3);
  const stocked=T1>0&&T2>=0.6*T1-1&&T3>=0.4*T1-1;
  const rate=reinvRate(p,T1,stocked);
  return {T1,T2,T3,lvl,buySize,fee,need:Math.max(needT3,needPipe),stocked,rate,note,pays,done:T1>=p.target,grow,growOk};
}

/* ---------- daily reminder: calendar alarm + WhatsApp share (no account needed) ---------- */
const SITE_URL="https://faheemgulzarclf-prog.github.io/tierstack/#track";
function todayText(st,adv){
  const p=st.p, lines=[`TierStack · ${fmtDate(todayStr())}`];
  adv.forEach(({a,v})=>{
    if(v.kind==="trade") lines.push(`TRADE ${a.name}: risk ${fmtFull(v.riskUsd)} per trade, aim 1:${p.rr}, stop for the day at ${fmtFull(v.dailyStop)}.`);
    else if(v.kind==="recover") lines.push(`RECOVERY ${a.name}: ${v.title}, risk ${fmtFull(v.riskUsd)}.`);
    else if(v.kind==="rest") lines.push(`${v.pill} ${a.name}: ${v.title.toLowerCase()}.`);
    else lines.push(`${v.pill} ${a.name}: ${v.title}.`);
  });
  lines.push(`Coach: ${SITE_URL}`);
  return lines.join("\n");
}
function calLinks(time){
  const [hh,mm]=(time||"08:00").split(":").map(Number); const d=new Date(); d.setDate(d.getDate()+1); d.setHours(hh||8,mm||0,0,0);
  const e=new Date(d.getTime()+15*60000), z=x=>x.toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"");
  const title="TierStack: open your daily coach", det="Log yesterday's balances, then follow today's moves: "+SITE_URL;
  const g=`https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&details=${encodeURIComponent(det)}&dates=${z(d)}/${z(e)}&recur=${encodeURIComponent("RRULE:FREQ=DAILY")}`;
  const ics=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//TierStack//Coach//EN","BEGIN:VEVENT",`UID:tierstack-coach-${Date.now()}@tierstack`,`DTSTAMP:${z(new Date())}`,`DTSTART:${z(d)}`,`DTEND:${z(e)}`,"RRULE:FREQ=DAILY",`SUMMARY:${title}`,`DESCRIPTION:${det}`,`URL:${SITE_URL}`,"BEGIN:VALARM","TRIGGER:PT0M","ACTION:DISPLAY",`DESCRIPTION:${title}`,"END:VALARM","END:VEVENT","END:VCALENDAR"].join("\r\n");
  return {g, ics:"data:text/calendar;charset=utf-8,"+encodeURIComponent(ics)};
}

/* ---------- render ---------- */
function tkTestBar(){
  if(!TK.test) return "";
  const st=TK.state, d=st&&st.start?dnum(todayStr())-dnum(st.start)+1:0;
  const wd=new Date(todayStr()+"T12:00:00").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short"});
  return `<div class="tk-test"><div class="tt-l"><span class="tt-chip">Test mode</span><b>${st?`Day ${d} · Week ${Math.floor((d-1)/7)+1} · ${wd}`:"No test plan yet"}</b><span>Practice data only. Your real coach is not touched.</span></div>
  <div class="tt-r">${st&&!(typeof LAB!=="undefined"&&LAB.setup)?`<button type="button" class="btn ghost sm" data-lab="setup">New plan</button>`:""}<button type="button" class="btn ghost sm" data-tt="exit">Exit test</button></div></div>`;
}
const TK_TEST_KEY="ts-tracker-test";
async function tkTestEnter(){
  if(TK.test) { tkRender(); return; }
  TK.real={state:TK.state,store:TK.store}; TK.test=true;
  TK.store={kind:"test",async load(){ try{ const t=localStorage.getItem(TK_TEST_KEY); return t?JSON.parse(t):null; }catch(e){ return null; } },async save(o){ try{ if(o===null) localStorage.removeItem(TK_TEST_KEY); else localStorage.setItem(TK_TEST_KEY,JSON.stringify(o)); }catch(e){} }};
  let t=null; try{ t=await TK.store.load(); }catch(e){}
  TK.testDay=t&&t.testDay||null; TK.state=t?tkMigrate(t):null; if(TK.state) TK.state.p.mindays=0; tkRender();
}
function tkTestExit(){ if(!TK.test) return; if(typeof labPlay==="function"&&LAB.timer){ clearInterval(LAB.timer); LAB.timer=null; } TK.test=false; TK.testDay=null; if(TK.real){ TK.state=TK.real.state; TK.store=TK.real.store; TK.real=null; } tkRender(); }
document.addEventListener("click",e=>{ const b=e.target.closest("[data-tt]"); if(!b||!TK.test) return; const k=b.dataset.tt;
  if(k==="exit"){ location.hash="track"; return; }
  if(k==="new"){ if(typeof labReset==="function") labReset(); tkFromPlan(); return; }
  if(k==="reset"){ if(!b.dataset.sure){ b.dataset.sure="1"; b.textContent="Tap again to restart"; return; } TK.state=null; TK.testDay=null; TK.store.save(null); if(typeof labReset==="function"){ if(LAB.timer) clearInterval(LAB.timer); LAB.timer=null; labReset(); } tkRender(); return; }
  const n=parseInt(k,10); if(!(n>0)||!TK.state) return;
  const d=new Date(todayStr()+"T12:00:00"); d.setDate(d.getDate()+n);
  TK.testDay=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
  TK.state.testDay=TK.testDay; tkTick(TK.state); tkSave(); tkRender(); });
function tkRender(){
  const o=$("tkOut"); if(!o) return;
  if(TK.test&&typeof labSetupHtml==="function"&&(!TK.state||LAB.setup)){ o.innerHTML=tkTestBar()+labSetupHtml(); return; }
  tkRenderInner(); if(TK.test){ if(TK.state&&typeof labBoard==="function") o.insertAdjacentHTML("afterbegin",labBoard()); o.insertAdjacentHTML("afterbegin",tkTestBar()); }
}
function tkRenderInner(){
  const o=$("tkOut"); if(!o) return;
  if(!TK.ready){ o.innerHTML=`<div class="card"><p class="sub2" style="margin:0"><span class="spin"></span> Loading your tracker…</p></div>`; return; }
  const st=TK.state;
  if(!st){ o.innerHTML=`<div class="fx tk-empty"><span class="kicker">Live tracker</span><h2 style="font-size:clamp(26px,3.4vw,38px)">Your daily coach, from first test to goal.</h2>
    <p class="sub2" style="margin:0;max-width:560px">Build your plan, then tap "Start tracking". Every day you log your balances and TierStack tells you which account to trade, how much to risk, and what to do with the rest.</p>
    <div class="tk-how"><div><b>1</b>Build your plan</div><div><b>2</b>Log balances daily</div><div><b>3</b>Follow today's moves</div></div>
    <div class="fx-cta"><a class="btn gold" href="#build" data-nav="build">Build my plan <span class="arr">→</span></a></div></div>`; return; }
  const p=st.p, pf=portfolio(st), act=st.accounts.filter(a=>a.status==="active");
  const adv=act.map(a=>({a,v:advise(a,st)}));
  const order={cut:0,recover:1,payout:2,pass:3,trade:4,wait:5,rest:6,bench:7};
  adv.sort((x,y)=>order[x.v.kind]-order[y.v.kind]||y.a.phase-x.a.phase);
  const nTrade=adv.filter(x=>["trade","recover"].includes(x.v.kind)).length, nRest=adv.filter(x=>x.v.kind==="rest").length, nAct=adv.filter(x=>["payout","pass","cut"].includes(x.v.kind)).length;
  const prog=Math.min(100,pf.T1/p.target*100);
  let next;
  if(pf.done) next=pf.stocked?{t:"Goal reached. Switch to income mode.",s:`Keep 70% of payouts. Use 30% to replace any account you lose.`}:{t:"Goal reached. Finish stocking the bench.",s:`Payouts keep going to Reinvestment until Tier 2 = 60% and Tier 3 = 40% of Tier 1. Then you keep 70%.`};
  else if(!st.accounts.some(a=>a.status==="active")&&st.pool<Math.min(...p.ladder.map(r=>r.fee))) next={t:"Every test failed and Reinvestment is empty",s:"The guide says no new personal money after the first tests. Stop, review your trades, and only start again with a fresh plan."};
  else if(pf.need>0){ const can=st.pool>=pf.fee; next={t:`Buy 1 × ${fmt(pf.buySize)} evaluation (${fmtFull(pf.fee)})`,s:(can?`You have ${fmtFull(st.pool)} in Reinvestment. Buy it now.`:`Reinvestment has ${fmtFull(st.pool)}. You need ${fmtFull(pf.fee-st.pool)} more from your next payout.`)+(pf.note?" "+pf.note:""),btn:can}; }
  else if(pf.T1===0) next={t:"Step 1: pass your evaluations",s:"No new buys yet. Trade only the account marked TRADE, at the risk shown. When one passes Phase 2 it becomes funded."};
  else next={t:"Keep trading. Your tiers are full.",s:pf.note||`Payouts now split ${Math.round(pf.rate*100)}% back into Reinvestment, ${Math.round((1-pf.rate)*100)}% to you.`};
  const tiers=[["Funded",pf.T1,p.target,"t1"],["Backup",pf.T2,Math.max(pf.T1,p.n0*p.s0)*0.6,"t2"],["Pipeline",pf.T3,Math.max(pf.T1,p.n0*p.s0)*0.4,"t3"]];
  o.innerHTML=`
  <div class="fx">
    <div class="fx-head"><div><span class="kicker">Today · ${fmtDate(todayStr())}${p.firm?" · "+esc(p.firm):""}</span><h2 style="font-size:clamp(26px,3.4vw,40px);margin-top:6px">${nAct?`${nAct} thing${nAct>1?"s":""} to do first`:nTrade===1?`Trade only ${esc(adv.find(x=>["trade","recover"].includes(x.v.kind)).a.name)} today`:nTrade?`Trade ${nTrade} accounts today`:"Rest day. No trades today."}</h2></div><span class="tk-savew"><span class="fbadge" id="tkSave">${TK.store.kind==="test"?"Test data only":TK.store.kind==="cloud"?"Saved to your account":"Saved in this browser"}</span>${TK.store.kind==="local"&&!TK.test&&window.TSAuth&&window.TSAuth.sb?`<button type="button" class="tk-cloud" data-signup="up">Save to a free account</button>`:""}</span></div>
    <div class="tk-goal"><div class="tk-gtop"><span>Funded <b>${fmt(pf.T1)}</b> of ${fmt(p.target)}</span><span>${prog.toFixed(0)}%</span></div><div class="tk-bar"><i style="width:${prog}%"></i></div></div>
    <div class="fx-big">
      <div><span class="v t1">${nTrade}</span><span class="k">trade today</span></div>
      <div><span class="v t1">${nRest}</span><span class="k">resting</span></div>
      <div><span class="v t1">${fmt(st.pool)}</span><span class="k">in Reinvestment</span></div>
      <div><span class="v t1">${fmt(st.personal)}</span><span class="k">taken home</span></div>
    </div>
  </div>

  <div class="card tk-risk"><span class="kicker">Risk style</span><div class="riskseg">${Object.keys(RISK_LV).map(lv=>{ const r=levelRisk(lv,{rr:p.rr,maxdd:p.maxdd,daily:p.daily||5,tpd:p.tpd||1,c1:p.c1,c2:p.c2,c3:p.c3}); return `<button type="button" role="radio" aria-checked="${p.risklvl===lv}" data-tk="risk" data-lvl="${lv}"><b>${RISK_LV[lv].name}</b><span class="rs-v">${r.riskE}%</span><span class="rs-s">${r.riskE===r.riskF?"tests and funded":`tests, ${r.riskF}% funded`}</span></button>`; }).join("")}</div></div>

  <div class="tk-next"><span class="kicker">Next step to your goal</span><b>${next.t}</b><p>${next.s}</p>${next.btn?`<button class="btn gold sm" data-tk="buy" data-size="${pf.buySize}" data-fee="${pf.fee}">I bought it</button>`:""}</div>

  <div class="sec"><h3>Your accounts</h3>
  <div class="tk-list">${adv.map(({a,v})=>{
    const lo=v.cutUsd, hi=v.tgtUsd, pos=Math.max(0,Math.min(100,(a.bal-lo)/(hi-lo)*100)), zero=Math.max(0,Math.min(100,(a.size-lo)/(hi-lo)*100));
    return `<div class="tk-acc k-${v.kind}" data-id="${a.id}">
      <div class="tk-a1"><span class="tk-tier" style="background:var(--${PHC[a.phase]});color:var(--${PHC[a.phase]}-ink)">${a.phase===3?"T1":a.phase===2?"T2":"T3"}</span><div class="tk-nm"><b>${esc(a.name)}</b><span>${PH[a.phase]} · ${a.days.length}/${p.mindays} days</span></div><span class="tk-pill">${v.pill}</span></div>
      <div class="tk-do"><b>${v.title}</b><p>${v.text}</p></div>
      <div class="tk-meter"><div class="tk-track"><i class="z" style="left:${zero}%"></i><i class="m" style="left:${pos}%"></i></div><div class="tk-ends"><span>Cut ${fmt(lo)}</span><span class="${v.pct>=0?"up":"dn"}">${fmtFull(a.bal)} (${v.pct>=0?"+":""}${v.pct.toFixed(1)}%)</span><span>${a.phase===3?"Payout":"Pass"} ${fmt(hi)}</span></div></div>
      <div class="tk-acts">
        <input type="number" inputmode="decimal" aria-label="New balance for ${esc(a.name)}" placeholder="New balance" class="tk-in" data-bal="${a.id}">
        <button class="btn gold sm" data-tk="log" data-id="${a.id}">Log balance</button>
        ${v.act==="pass"?`<button class="btn ghost sm" data-tk="pass" data-id="${a.id}">Mark passed</button>`:""}
        ${v.act==="payout"?`<button class="btn ghost sm" data-tk="payout" data-id="${a.id}" data-pay="${Math.round(v.pay*100)/100}">Log payout</button>`:""}
        ${v.act==="cut"?`<button class="btn ghost sm" data-tk="cut" data-id="${a.id}">Close account</button>`:""}
        <button class="linkbtn tk-more" data-tk="close" data-id="${a.id}">Account failed</button>
      </div>
    </div>`; }).join("")}</div></div>

  <div class="g2f">
    <div class="card"><h3 class="ct">Tier balance</h3>${tiers.map(t=>{ const w=t[2]>0?Math.min(100,t[1]/t[2]*100):0; return `<div class="tk-tb"><div class="tk-gtop"><span><i class="dotl" style="background:var(--${t[3]})"></i>${t[0]}</span><span>${fmt(t[1])} / ${fmt(t[2])}</span></div><div class="tk-bar sm"><i style="width:${w}%;background:var(--${t[3]})"></i></div></div>`; }).join("")}
      <p class="hint">Backup must reach 60% and Pipeline 40% of Funded before you take money home.</p>
      ${pf.T1>0?`<div class="tk-grow"><b>Ready to grow to bigger accounts? ${pf.growOk?"Yes":"Not yet"}</b><ul>${pf.grow.map(g=>`<li class="${g[0]?"ok":"no"}">${g[0]?"✓":"✗"} ${esc(g[1])}</li>`).join("")}</ul></div>`:""}
      <div class="tk-add"><select id="tkAddSize" aria-label="Evaluation size">${p.ladder.map(r=>`<option value="${r.size}" data-fee="${r.fee}">${fmt(r.size)} · ${fmtFull(r.fee)}</option>`).join("")}</select><button class="btn ghost sm" data-tk="add">Add evaluation</button></div></div>
    <div class="card tk-remind"><h3 class="ct">Daily reminder</h3><p class="hint" style="margin-top:-6px">Get an alarm every morning that opens this coach. No account needed.</p>
      <label class="f" for="tkTime">Remind me at<input type="time" id="tkTime" value="${esc(st.remind||"08:00")}"></label>
      <div class="tk-rbtns"><a class="btn gold sm" id="tkCalG" href="${calLinks(st.remind).g}" target="_blank" rel="noopener">Add to Google Calendar</a>${window.claude&&window.claude.use?"":`<a class="btn ghost sm" id="tkCalI" href="${calLinks(st.remind).ics}" download="tierstack-coach.ics">Apple / Outlook calendar</a>`}</div>
      <a class="btn ghost sm tk-wa" href="https://wa.me/?text=${encodeURIComponent(todayText(st,adv))}" target="_blank" rel="noopener">Send today's plan to WhatsApp</a>
      <p class="hint">WhatsApp and Telegram messages that arrive by themselves come with accounts, soon.</p></div>
    <div class="card"><h3 class="ct">Activity log</h3><ul class="tk-log">${st.log.slice(0,14).map(l=>`<li><span>${fmtDate(l.d)}</span>${esc(l.t)}</li>`).join("")}</ul>
      <button class="linkbtn" data-tk="reset">Start over</button></div>
  </div>`;
}

/* ---------- actions ---------- */
function acct(id){ return TK.state.accounts.find(a=>a.id===id); }
function doLog(a,bal){
  const st=TK.state, t=todayStr(), r=rulesFor(a,st.p);
  if(!a.days.includes(t)){ a.days.push(t); a.dayStart=a.bal; }
  if(a.rec>0){ a.rec--; }
  if(bal!==a.bal) st.trades.push(bal>a.bal?1:0); st.trades=st.trades.slice(-100);
  a.bal=bal; a.hist.push([t,bal]); a.hist=a.hist.slice(-120);
  const pct=(bal-a.size)/a.size*100;
  if(a.rec>=0 && pct>-r.cut){ a.rec=-1; a.recUsed=true; log(`${a.name} recovered to ${fmtFull(bal)}.`); }
  else if(pct<=-r.cut && a.rec<0 && !a.recUsed && r.K>0){ a.rec=r.K; log(`${a.name} hit −${r.cut}%. Recovery: ${r.K} trades.`); }
  else log(`${a.name}: balance ${fmtFull(bal)} (${pct>=0?"+":""}${pct.toFixed(1)}%).`);
  if(pct<=-st.p.maxdd){ a.status="failed"; st.cuts.push({d:t,phase:a.phase}); log(`${a.name} broke the firm's max loss and is closed.`); }
}
/* guide: pass Phase 1 → Tier 2 (Phase 2); pass Phase 2 → Tier 1 (funded). Moves by itself once the target and the firm's minimum days are met. */
function passAcct(a){ const st=TK.state; if(!a||a.status!=="active"||a.phase>=3) return;
  a.phase++; a.bal=a.size; a.dayStart=a.size; a.days=[]; a.rec=-1; a.recUsed=false; a.cyc={s:todayStr(),b:a.size}; a.offUntil="";
  if(a.phase===3){ a.pt=TK.test?lockPick(st.p,Math.random()):0; const cnt=[0,1,2].map(o=>st.accounts.filter(x=>x.status==="active"&&x.phase===3&&x!==a&&x.off===o).length); a.off=cnt.indexOf(Math.min(...cnt));
    log(`${a.name} passed Phase 2 and is now FUNDED (Tier 1). Its trading weeks start ${fmtDate(isOn(a,st)?todayStr():nextOnDate(a,st))}. Buy a new Phase 1 evaluation to refill the pipeline.`); }
  else log(`${a.name} passed Phase 1. It moves to Tier 2 as a backup (Phase 2). Same risk, same turns.`); }
function doPayout(a,amt){ const st=TK.state, pf=portfolio(st);
  const re=amt*pf.rate; st.pool+=re; st.personal+=amt-re; st.payouts.push({d:todayStr(),id:a.id,amt,rate:pf.rate,stocked:pf.stocked,T1:pf.T1}); a.bal=a.size; a.dayStart=a.size; a.days=[]; a.rec=-1; a.cyc={s:todayStr(),b:a.size}; a.pt=TK.test?lockPick(st.p,Math.random()):0;
  log(`Payout ${fmtFull(amt)} from ${a.name}: ${fmtFull(re)} to Reinvestment, ${fmtFull(amt-re)} for you.`); return {re,home:amt-re,rate:pf.rate,stocked:pf.stocked}; }
function doCut(a){ const st=TK.state; a.status="failed"; st.cuts.push({d:todayStr(),phase:a.phase,id:a.id,size:a.size,pct:Math.round((a.bal-a.size)/a.size*1000)/10}); log(`${a.name} closed${a.phase===3?". A passed account on the bench goes live in its place.":". Buy a new evaluation when Reinvestment allows."}`); if(a.phase===3&&!TK.test) promoteReady(st); }
function doBuy(size,fee){ const st=TK.state; const fromPool=Math.min(st.pool,fee); st.pool-=fromPool; st.spent+=fee; const a=newAcct(size,1,st); st.accounts.push(a);
  log(`Bought ${a.name} evaluation for ${fmtFull(fee)}${fromPool<fee?` (${fmtFull(fee-fromPool)} from your pocket)`:" from Reinvestment"}.`); return a; }
function autoPass(a){ const st=TK.state; if(a.status!=="active"||a.phase>=3) return false; const r=rulesFor(a,st.p), pct=(a.bal-a.size)/a.size*100;
  if(a.ready) return promoteOne(a);
  if(pct>=r.tgt-1e-9&&a.days.length>=st.p.mindays){
    if(a.phase===2){ a.ready=true; if(promoteOne(a)) return true; log(`${a.name} passed Phase 2. It waits on the Tier 2 bench (don't trade it) until a funded account is cut or Tier 1 can grow.`); return true; }
    passAcct(a); return true; } return false; }
/* bench → Tier 1: refill Tier 1 up to where it was (start or after a cut), or grow it when the guide allows */
function canPromote(st,a){ const p=st.p, act=st.accounts.filter(x=>x.status==="active"), sum=ph=>act.filter(x=>x.phase===ph).reduce((s,x)=>s+x.size,0);
  const T1=sum(3), T2=sum(2)-a.size, T3=sum(1), nT1=T1+a.size; if(T1>=p.target) return false;
  if(nT1<=Math.max(p.n0*p.s0,st.peak||0)) return true;
  const g=portfolio(st).grow, gate=g[0][0]&&g[1][0]&&(p.scale==="simple"||g[2][0]);
  return gate&&T2>=0.6*nT1-1&&T3>=0.4*nT1-1; }
function promoteOne(a){ const st=TK.state; if(!a.ready||a.status!=="active"||a.phase!==2||!canPromote(st,a)) return false;
  a.ready=false; passAcct(a); st.peak=Math.max(st.peak||0,st.accounts.filter(x=>x.status==="active"&&x.phase===3).reduce((s,x)=>s+x.size,0)); return true; }
function promoteReady(st){ let ch=false; st.accounts.filter(x=>x.ready&&x.status==="active"&&x.phase===2).forEach(x=>{ if(promoteOne(x)) ch=true; }); return ch; }
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-tk]"); if(!b||!TK.state&&b.dataset.tk!=="start") return;
  const k=b.dataset.tk, st=TK.state;
  if(k==="log"){ const a=acct(b.dataset.id); const inp=document.querySelector(`[data-bal="${a.id}"]`); const v=parseFloat(inp.value); if(!(v>0)){ inp.focus(); inp.classList.add("bad"); return; } doLog(a,v); if(a.status==="active") autoPass(a); }
  else if(k==="pass"){ const a=acct(b.dataset.id); if(a.phase===2){ a.ready=true; if(!promoteOne(a)) log(`${a.name} passed Phase 2. It waits on the Tier 2 bench until a funded account is cut or Tier 1 can grow.`); } else passAcct(a); }
  else if(k==="payout"){ doPayout(acct(b.dataset.id),parseFloat(b.dataset.pay)||0); }
  else if(k==="cut"||k==="close"){ const a=acct(b.dataset.id); if(k==="close"&&!b.dataset.sure){ b.dataset.sure="1"; b.textContent="Tap again to confirm"; return; } doCut(a); }
  else if(k==="buy"||k==="add"){ let size,fee; if(k==="buy"){ size=+b.dataset.size; fee=+b.dataset.fee; } else { const s=$("tkAddSize"); size=+s.value; fee=+s.selectedOptions[0].dataset.fee; } doBuy(size,fee); }
  else if(k==="risk"){ const lv=b.dataset.lvl; if(!RISK_LV[lv]||st.p.risklvl===lv) return; const r=levelRisk(lv,{rr:st.p.rr,maxdd:st.p.maxdd,daily:st.p.daily||5,tpd:st.p.tpd||1,c1:st.p.c1,c2:st.p.c2,c3:st.p.c3}); Object.assign(st.p,r); st.p.risklvl=lv;
    log(`Risk style set to ${RISK_LV[lv].name}: ${r.riskE}% per test trade, ${r.riskF}% funded, ${r.k3} recovery trades on tests.`); }
  else if(k==="reset"){ if(!b.dataset.sure){ b.dataset.sure="1"; b.textContent="Tap again to delete this tracker"; return; } TK.state=null; tkSave(); tkRender(); return; }
  else return;
  tkSave(); tkRender();
});
document.addEventListener("change",e=>{ if(e.target.id!=="tkTime"||!TK.state) return; TK.state.remind=e.target.value; const L=calLinks(e.target.value); $("tkCalG").href=L.g; if($("tkCalI")) $("tkCalI").href=L.ics; tkSave(); });
document.addEventListener("click",e=>{ if(e.target.closest("#startTrack")){ if(TK.state&&!e.target.closest("#startTrack").dataset.sure){ const b=e.target.closest("#startTrack"); b.dataset.sure="1"; b.innerHTML="This replaces your current tracker. Tap again"; return; } tkFromPlan(); } });
async function tkBoot(){ await tkStoreInit(); try{ TK.state=tkMigrate(await TK.store.load()); }catch(e){ TK.state=null; } TK.ready=true; if(TK.state&&tkTick(TK.state)) tkSave(); tkRender(); }
tkBoot();
/* account switch: on sign in, load the cloud coach; if the account has none yet, move this browser's coach into it */
if(window.TSAuth) window.TSAuth.onChange(async u=>{
  if(TK.test) tkTestExit();
  const local=TK.store&&TK.store.kind==="local"?TK.state:null;
  if(u&&window.TSAuth.ok){ TK.store=window.TSAuth.store(); let cloud=null; try{ cloud=await TK.store.load(); }catch(e){}
    if(cloud){ TK.state=tkMigrate(cloud); } else if(local){ TK.state=local; try{ await TK.store.save(local); }catch(e){} } else TK.state=null;
    if(TK.state&&tkTick(TK.state)) tkSave(); tkRender(); }
  else { await tkBoot(); }
});
window.__tk={TK,promoteOne,canPromote,promoteReady,doLog,autoPass,advise,portfolio,dnum,todayStr,tkSave,tkRender,doPayout,doCut,doBuy,rulesFor,isOn,weekIdx,offline,tkTick,tkFromPlan}; /* used by the test lab checks */
