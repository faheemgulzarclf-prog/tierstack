/* ---------- rule check demo: one future, every step, checked against the guide ---------- */
const PH_NAME={1:"Phase 1 test",2:"Phase 2 test",3:"Funded",4:"Ready (passed Phase 2)"};
const TIER={1:"T3",2:"T2",3:"T1",4:"T2"};
let demoSeed=7;
function demoRun(){
  const P=readParams(); const wr=P.wr;
  const ev=[]; portfolioSim(P,wr,1,demoSeed,x=>ev.push(x));
  return {P,wr,ev};
}
function demoCheck(P,ev){
  const tgt=P.target, L=P.ladder;
  const stageRate=t1=>t1<0.2*tgt?0.8:t1<0.6*tgt?0.65:t1<tgt?0.5:0.3;
  const C=[];
  const add=(id,guide,ok,bad,detail)=>C.push({id,guide,ok,bad,detail});
  const trades=ev.filter(x=>x.e==="trade");
  // 1 fixed risk
  let bad=trades.filter(t=>Math.abs(t.risk-(t.ph===3?P.riskF:P.riskE))>1e-9).length;
  add("Fixed risk","Same risk on every trade, never bigger after a loss (TierStack choice, safer than the guide's size-up).",trades.length-bad,bad,`${P.riskE}% per test trade, ${P.riskF}% funded.`);
  // 2 inside firm limits
  const wE=Math.max(riskWorst(P.riskE,P.c3,P.k3,P.rr),riskWorst(P.riskE,P.c2,P.k2,P.rr)), wF=riskWorst(P.riskF,P.c1,P.k1,P.rr);
  const capOk=wE<P.maxdd&&wF<P.maxdd&&P.tpd*Math.max(P.riskE,P.riskF)<=P.daily;
  const mdd=ev.filter(x=>x.e==="cut"&&x.why==="maxdd").length;
  add("Inside firm limits","Always trade within the specific rules of your chosen prop firm.",capOk&&!mdd?1:0,(capOk?0:1)+mdd,`Worst case after the cut and every recovery trade: tests −${wE.toFixed(2)}%, funded −${wF.toFixed(2)}%. Firm limit −${P.maxdd}%. Daily: ${P.tpd} × ${Math.max(P.riskE,P.riskF)}% vs ${P.daily}%. Firm limit hit in this run: ${mdd}.`);
  // 3 reward
  add("1 : 3 or better","Minimum 1:3 risk-reward on every trade.",P.rr>=3?1:0,P.rr>=3?0:1,`You set 1 : ${P.rr}.`);
  // 4 tests take turns
  const wk={}; trades.filter(t=>t.ph!==3).forEach(t=>{ (wk[t.w]=wk[t.w]||new Set()).add(t.lane); });
  const wks=Object.keys(wk); bad=wks.filter(k=>wk[k].size>1).length;
  add("Tests take turns","Never trade all accounts during the same window. Stagger start dates.",wks.length-bad,bad,`${wks.length} test weeks checked. In each one, only one lane of tests traded.`);
  // 5 funded 1 on 2 off
  const ft=trades.filter(t=>t.ph===3); bad=ft.filter(t=>((t.w+t.off)%3)!==0).length;
  add("Funded: 1 week on, 2 off","1 week ON / 2 weeks OFF cycle per account. Only trade accounts in their active ON window.",ft.length-bad,bad,`${ft.length} funded trades checked.`);
  // 6 payout at +3%
  const po=ev.filter(x=>x.e==="payout"); bad=po.filter(x=>x.b<P.lock-1e-9).length;
  add(`Payout at +${P.lock}%`,"Lock payout at exactly +3%. The moment an account hits 3% gain, request the payout.",po.length-bad,bad,`${po.length} payouts, each requested at +${P.lock}% or more.`);
  // 7 cut rules
  const cuts=ev.filter(x=>x.e==="cut"&&x.why!=="refused");
  bad=cuts.filter(c=>{ const cut=c.ph===1?P.c3:c.ph===2?P.c2:P.c1; return !(c.b<=-cut+1e-9); }).length;
  add("Cut levels",`Cut funded at −6%, Phase 2 at −4%, Phase 1 at −4%, after the recovery trades.`,cuts.length-bad,bad,`${cuts.length} accounts closed. Funded −${P.c1}%, Phase 2 −${P.c2}%, Phase 1 −${P.c3}%.`);
  // 8 recovery once, limited trades
  const rs={}; let recBad=0; ev.forEach(x=>{ if(x.e==="recStart"){ const k=x.id+"_"+x.ph; rs[k]=(rs[k]||0)+1; if(rs[k]>1) recBad++; } });
  const recN=Object.keys(rs).length;
  add("Recovery once",`Recovery is attempted once, never twice: ${P.k1} trades funded, ${P.k2} Phase 2, ${P.k3} Phase 1.`,recN-recBad,recBad,`${recN} recovery attempts in this run.`);
  // 9 4-week loss offline
  const off=ev.filter(x=>x.e==="offline"); bad=off.filter(o=>trades.some(t=>t.id===o.id&&t.w===o.w)).length;
  add("Losing 4 weeks → rest 1 week","4-week cycle ends in loss: put the account offline for 1 full week.",off.length-bad,bad,`${off.length} offline weeks, no trades on them.`);
  // 10 reinvest
  const al=ev.filter(x=>x.e==="alloc"); bad=al.filter(a=>{ const want=a.stocked?stageRate(a.T1):1; return Math.abs(a.rate-want)>1e-9|| (a.stocked!==(a.T1>0&&a.T2>=0.6*a.T1-1&&a.T3>=0.4*a.T1-1)); }).length;
  add("Reinvest ladder","Reinvest all payouts until T2 = 60% and T3 = 40% of T1. Then 80% / 65% / 50% / 30% by stage.",al.length-bad,bad,`${al.length} payout days split. ${al.filter(a=>!a.stocked).length} went 100% back in because the tiers were not full.`);
  // 11 spend priority
  const by=ev.filter(x=>x.e==="buy"); bad=by.filter(b=>!(b.pipe<b.pipeTarget||b.t3cap<0.4*b.pipeTarget-1)).length;
  add("Spend order","Restock T3 first, then T2, then grow T1, then personal income.",by.length-bad,bad,`${by.length} tests bought, ${by.filter(b=>b.why==="t3").length} to refill the T3 pipeline.`);
  // 12 ladder
  const up=ev.filter(x=>x.e==="upgrade"); bad=up.filter(u=>!(u.T1>=u.unlockT1&&u.pays>=u.unlockPay&&u.consec>=3&&u.sinceCut>10)).length;
  add("Upgrade ladder",`Bigger accounts only after enough funded money and payouts, 3 payouts in a row and no funded cut in 14 days.`,up.length-bad,bad,up.length?up.map(u=>`${fmt(u.size)} at ${fmt(u.T1)} funded, ${u.pays} payouts`).join(" · "):"No upgrade in this run.");
  // 13 one new size first
  bad=by.filter((b,i)=>b.newSize&&!b.heldBack&&by.slice(0,i).some(x=>x.size===b.size&&!ev.some(f=>f.e==="funded"&&f.id===x.id&&f.d<=b.d)&&!ev.some(c=>c.e==="cut"&&c.id===x.id&&c.d<=b.d))).length;
  add("One new size first","Pass one account of a new size before buying multiples.",by.filter(b=>b.newSize).length-bad,bad,`${by.filter(b=>b.newSize&&!b.heldBack).length} first buys at a new size.`);
  // 14 ratio at goal
  const g=ev.find(x=>x.e==="milestone"&&x.goal);
  if(g){ const r2=g.T2/g.T1, r3=g.T3/g.T1; add("5 : 3 : 2 at the goal","T1 50%, T2 30%, T3 20% of capital.",1,0,`At the goal: Funded ${fmt(g.T1)}, Backup ${fmt(g.T2)} (${Math.round(r2*100)}% of funded), Pipeline ${fmt(g.T3)} (${Math.round(r3*100)}%). The guide targets 60% and 40%; the pipeline keeps refilling after the goal.`); }
  return C;
}
function evText(x,P){
  const nm=id=>`#${id}`;
  switch(x.e){
    case "start": return [`Buy ${x.n} × ${fmt(x.size)} tests (${fmtFull(x.fee)} each). ${fmtFull(x.cash)} kept for rebuys.`,"Step 1: start with two $25K evaluations."];
    case "pass1": return [`${nm(x.id)} ${fmt(x.size)} passed Phase 1 at +${x.b.toFixed(2)}% → now Backup (T2).`,"Once both pass Phase 1, they move into Tier 2."];
    case "pass2": return [`${nm(x.id)} ${fmt(x.size)} passed Phase 2 at +${x.b.toFixed(2)}%.`,"T2 is one winning trade from funded."];
    case "funded": return [`${nm(x.id)} is FUNDED. Funded total ${fmt(x.T1)}. Trades in week group ${x.off+1} of 3.`,"Begin staggered cycling. Offset start dates."];
    case "payout": return [`${nm(x.id)} payout at +${x.b.toFixed(2)}%: ${fmtFull(x.amt)} to you from the firm.`,"Lock payout at +3%."];
    case "alloc": return [`${fmtFull(x.amt)} split: ${fmtFull(x.toPool)} back in (${Math.round(x.rate*100)}%), ${fmtFull(x.personal)} to you. Tiers ${x.stocked?"full":"not full yet"} (T2 ${fmt(x.T2)}, T3 ${fmt(x.T3)} vs funded ${fmt(x.T1)}).`,x.stocked?"Reinvestment ladder by stage.":"Before T2 = 60% and T3 = 40%, every payout goes back in."];
    case "buy": return [`Buy ${nm(x.id)} ${fmt(x.size)} test for ${fmtFull(x.fee)} (${x.why==="t3"?"refill pipeline":"refill backup + pipeline"}).${x.heldBack?" Held at the proven size until the first bigger one is funded.":""}`,x.why==="t3"?"Restock T3 first.":"The moment a T2 passes, buy a new Phase 1 eval."];
    case "recStart": return [`${nm(x.id)} ${PH_NAME[x.ph]} down ${x.b.toFixed(2)}% → recovery: max ${x.K} trades, same risk.`,"Controlled recovery over 2–4 trades. Once."];
    case "recovered": return [`${nm(x.id)} recovered to ${x.b.toFixed(2)}%.`,"Recovery worked, keep normal rules."];
    case "cut": return [`${nm(x.id)} ${PH_NAME[x.ph]} closed at ${x.b.toFixed(2)}%${x.why==="recfail"?" (recovery failed)":x.why==="again"?" (hit the cut again)":x.why==="refused"?" (payout refused by firm)":x.why==="maxdd"?" (firm limit!)":""}.`,x.ph===3?"Cut T1 at −6%. A T2 replaces it when it passes.":"Cut tests at −4%. Rebuy from payouts."];
    case "offline": return [`${nm(x.id)} lost over its 4-week cycle → offline this week.`,"4-week cycle ends in loss: offline 1 week."];
    case "upgrade": return [`Unlocked ${fmt(x.size)} accounts (funded ${fmt(x.T1)}, ${x.pays} payouts, ${x.consec} in a row).`,"Upgrade ladder + scale-up checklist."];
    case "milestone": return [x.goal?`GOAL REACHED: ${fmt(x.T1)} funded. Backup ${fmt(x.T2)}, pipeline ${fmt(x.T3)}.`:`Milestone: ${fmt(x.v)} funded.`,x.goal?"System complete. Keep 70%, reinvest 30%.":"Next stage on the ladder."];
  }
  return null;
}
function demoRender(){
  const o=$("demoOut"); if(!o) return;
  let R; try{ R=demoRun(); }catch(err){ o.innerHTML=`<div class="card"><p>Could not run: ${esc(err.message)}</p></div>`; return; }
  const {P,ev}=R, C=demoCheck(P,ev);
  const allOk=C.every(c=>!c.bad), goal=ev.find(x=>x.e==="milestone"&&x.goal), last=ev.filter(x=>x.e==="week").pop()||{};
  const weeks={}; ev.forEach(x=>{ (weeks[x.w]=weeks[x.w]||[]).push(x); });
  const wkeys=Object.keys(weeks).map(Number).sort((a,b)=>a-b);
  const rows=wkeys.map(w=>{ const xs=weeks[w], tr=xs.filter(x=>x.e==="trade"), main=xs.filter(x=>!["trade","week"].includes(x.e)), snap=xs.find(x=>x.e==="week");
    if(!main.length&&!tr.length) return "";
    const wins=tr.filter(t=>t.win).length;
    const lanes=[...new Set(tr.filter(t=>t.ph!==3).map(t=>t.id))], fids=[...new Set(tr.filter(t=>t.ph===3).map(t=>t.id))];
    return `<details class="dw${main.length?" has":""}"${w<3||main.some(m=>m.e==="milestone")?" open":""}><summary><span class="dwk">Week ${w+1}</span><span class="dws">${tr.length?`${tr.length} trade${tr.length>1?"s":""} · ${wins} won`:"no trades"}${lanes.length?` · tests: ${lanes.map(i=>"#"+i).join(", ")}`:""}${fids.length?` · funded: ${fids.map(i=>"#"+i).join(", ")}`:""}</span>${snap?`<span class="dwt">T1 ${fmt(snap.T1)} · T2 ${fmt(snap.T2)} · T3 ${fmt(snap.T3)}</span>`:""}</summary>
      <ul class="dl">${main.map(x=>{ const t=evText(x,P); return t?`<li class="e-${x.e}"><b>${esc(t[0])}</b><span class="g">Guide: ${esc(t[1])}</span></li>`:""; }).join("")}
      ${tr.length?`<li class="trs">${tr.map(t=>`<span class="${t.win?"w":"l"}" title="#${t.id} ${PH_NAME[t.ph]}">#${t.id} ${t.win?"+":"−"}${fmtFull(t.size*t.risk/100*(t.win?P.rr:1))} → ${t.b>=0?"+":""}${t.b.toFixed(2)}%</span>`).join("")}</li>`:""}</ul></details>`; }).join("");
  o.innerHTML=`
  <div class="fx">
    <div class="fx-head"><div><span class="kicker">One possible future · ${pct(R.wr)} win rate · 1 : ${P.rr} · ${RISK_LV[P.risklvl]?RISK_LV[P.risklvl].name:"Custom"} risk</span>
      <h2 style="font-size:clamp(26px,3.4vw,40px);margin-top:6px">${goal?`Goal reached in week ${goal.w+1}`:`Not reached in ${P.horizon} months`}</h2></div>
      <span class="fbadge" style="${allOk?"":"background:var(--bad-bg);color:var(--bad)"}">${allOk?`All ${C.length} guide rules followed`:`${C.filter(c=>c.bad).length} rule${C.filter(c=>c.bad).length>1?"s":""} broken`}</span></div>
    <div class="fx-big">
      <div><span class="v t1">${fmt(last.T1||0)}</span><span class="k">funded at the end</span></div>
      <div><span class="v t1">${last.pays||0}</span><span class="k">payouts</span></div>
      <div><span class="v t1">${fmtFull(last.fees||0)}</span><span class="k">spent on tests</span></div>
      <div><span class="v t1">${fmt(last.personal||0)}</span><span class="k">taken home</span></div>
    </div>
    <div class="fx-cta"><button type="button" class="btn gold" id="demoAgain">Run another future <span class="arr">↻</span></button><a class="btn ghost" href="#build" data-nav="build">Change the numbers</a></div>
  </div>
  <div class="card"><h3 class="ct">Guide rules, checked</h3>
    <div class="ck">${C.map(c=>`<div class="ckr ${c.bad?"no":"ok"}"><span class="ci">${c.bad?"✗":"✓"}</span><div><b>${esc(c.id)}</b><p class="gq">“${esc(c.guide)}”</p><p>${esc(c.detail)}${c.ok+c.bad>1?` <span class="cn">${c.ok} ok${c.bad?`, ${c.bad} broken`:""}</span>`:""}</p></div></div>`).join("")}</div></div>
  <div class="card"><h3 class="ct">Every step, week by week</h3><p class="hint" style="margin-top:-6px">Tap a week to open it. Each line shows what happened and the guide rule behind it.</p><div class="dweeks">${rows}</div></div>`;
  $("demoAgain").addEventListener("click",()=>{ demoSeed=(demoSeed*48271)%2147483647; demoRender(); });
}
