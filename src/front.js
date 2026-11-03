/* ---------- front end ---------- */
const SIZES=[5000,10000,25000,50000,100000];
function outs(){ const v=$("s0").value; document.querySelectorAll("#sizeQuick button").forEach(b=>b.setAttribute("aria-pressed",b.dataset.v===v)); }
function bindControls(){
  $("sizeQuick").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; $("s0").value=b.dataset.v; sizeOptions(); renderLadder(); schedule(); });
  document.querySelectorAll(".st-b").forEach(b=>b.addEventListener("click",()=>{ const i=$(b.dataset.for); const d=parseFloat(b.dataset.d);
    let v=Math.round(((parseFloat(i.value)||0)+d)*100)/100; v=Math.max(parseFloat(i.min),Math.min(parseFloat(i.max),v)); i.value=v; schedule(); }));
}
function chart(P,S){
  const W=640,H=260,pl=50,pr=10,pt=12,pb=28; const weeks=S[0].sim.weeks;
  const ymax=P.target*1.15; const x=i=>pl+(W-pl-pr)*i/weeks; const y=v=>pt+(H-pt-pb)*(1-Math.min(v,ymax)/ymax);
  let g="";
  for(let k=0;k<=4;k++){ const v=ymax*k/4; g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--hair)" stroke-width="1"/><text x="${pl-8}" y="${y(v)+4}" text-anchor="end" font-size="11" fill="var(--muted)">${fmt(v)}</text>`; }
  const step=P.horizon<=24?6:12;
  for(let m=0;m<=P.horizon;m+=step){ g+=`<text x="${x(Math.round(m*4.33))}" y="${H-8}" text-anchor="middle" font-size="11" fill="var(--muted)">${m===0?"Now":m+" mo"}</text>`; }
  g+=`<line x1="${pl}" x2="${W-pr}" y1="${y(P.target)}" y2="${y(P.target)}" stroke="var(--muted)" stroke-dasharray="3 4"/><text x="${W-pr}" y="${y(P.target)-7}" text-anchor="end" font-size="11" font-weight="600" fill="var(--ink)">Goal ${fmt(P.target)}</text>`;
  const real=S[1].sim; let band="";
  for(let i=0;i<=weeks;i++) band+=(i?"L":"M")+x(i).toFixed(1)+","+y(real.p90[i]).toFixed(1);
  for(let i=weeks;i>=0;i--) band+="L"+x(i).toFixed(1)+","+y(real.p10[i]).toFixed(1);
  g+=`<path class="bd" d="${band}Z" fill="var(--t2)" fill-opacity=".14"/>`;
  const line=(arr,c,cls)=>{ let d=""; arr.forEach((v,i)=>d+=(i?"L":"M")+x(i).toFixed(1)+","+y(v).toFixed(1)); return `<path class="ln ${cls}" pathLength="1" d="${d}" fill="none" stroke="${c}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`; };
  g+=line(S[2].sim.median,"var(--bad)","l3")+line(real.median,"var(--t2)","l2")+line(S[0].sim.median,"var(--t1)","l1");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Funded capital over time for three scenarios">${g}</svg>`;
}

function render(P,S){
  const L=P.ladder, top=L[L.length-1], tgt=P.target, best=S[0].sim, sim=S[1].sim, lose=S[2].sim;
  const n1=Math.ceil(tgt/top.size), n2=Math.ceil(tgt*.6/top.size), n3=Math.ceil(tgt*.4/top.size);
  const startCost=P.n0*L[0].fee+P.reserve;
  const last=a=>a[a.length-1];
  const bR=last(best.reach), rR=last(sim.reach);
  const bestT=bR.length>best.runs*0.5?weeksTxt(quant(bR,0.5)):null;
  const realT=rR.length>sim.runs*0.5?weeksTxt(quant(rR,0.5)):null;
  const reachedIncome=(m)=>{ const v=m.monthlyEnd.filter((_,i)=>m.reachedFlags[i]); return v.length?quant(v,0.5):0; };
  const income=reachedIncome(best);
  const bust=sim.bust/sim.runs;
  const ev=S[0].ue.ev, be=1/(1+P.rr);
  const long=w=>w.replace(" mo"," months").replace(" wk"," weeks");
  const u0t=S[0].ue, TN=S.tn||[], me=TN.find(r=>r.tpd===P.tpd)||tradeRow(P,best,P.tpd), need=TN.find(r=>r.ok&&r.mo<=P.horizon);
  const n0f=x=>x==null||!isFinite(x)?"—":Math.round(x).toLocaleString("en-US");
  const tradesCard=`<div class="card trn"><h3 class="ct">Trades you need</h3>
    <p class="sub2">From your win rate (${pct(P.wr)}), reward (1 : ${P.rr}), risk and targets. ${P.corr?"One trade copied to all your accounts counts once.":"Each account takes its own trades."}</p>
    <div class="kpis">
      <div class="kpi"><span class="v">${me.ok?"~"+n0f(me.perMo):"—"}</span><span class="k">trades a month</span></div>
      <div class="kpi"><span class="v">${me.ok?long(weeksTxt(me.wk)):"Not reached"}</span><span class="k">to reach ${fmt(tgt)}</span></div>
      <div class="kpi"><span class="v">${me.ok?"~"+n0f(me.setG):"—"}</span><span class="k">trades in total</span></div>
    </div>
    <div class="flow">
      ${isInst(P)?"":`<div class="fl"><span class="k">Pass Phase 1</span><span class="v">~${n0f(u0t.tP1)}</span><p>trades on average to make +${P.p1t}%.</p></div>
      <div class="fl"><span class="k">Pass Phase 2</span><span class="v">~${n0f(u0t.tP2)}</span><p>trades on average to make +${P.p2t}%.</p></div>`}
      <div class="fl"><span class="k">One payout</span><span class="v">~${n0f(u0t.tradesPay)}</span><p>trades to reach ${lockTxt(P)} on a funded account.</p></div>
    </div>
    <div class="tbl"><table class="data"><thead><tr><th>Trades a day</th><th>Trades a month</th><th>Time to goal</th><th>Reach goal</th><th>${isInst(P)?"Risk per trade":"Risk on tests"}</th></tr></thead><tbody>${TN.map(r=>`<tr${r.tpd===P.tpd?' class="me"':""}><td>${r.tpd}${r.tpd===P.tpd?" (you)":""}</td><td>~${n0f(r.perMo)}</td><td>${r.ok?weeksTxt(r.wk):"Not in "+P.horizon+" mo"}</td><td>${pct(r.reach)}</td><td>${isInst(P)?r.riskF:r.riskE}%</td></tr>`).join("")}</tbody></table></div>
    <p class="hint">${need?(need.tpd<=P.tpd?`At ${P.tpd} a day you reach the goal inside ${P.horizon} months.`:`To reach the goal inside ${P.horizon} months you need about <b>${need.tpd} trades a day</b> (~${n0f(need.perMo)} a month).`):`No trade count up to ${TN.length?TN[TN.length-1].tpd:5} a day reaches the goal inside ${P.horizon} months at these numbers.`} If more trades a day would break the ${P.daily}% daily limit, risk per trade is lowered, so the goal does not always get faster. Funded accounts trade 1 week in 3${isInst(P)?"":", so many trades go to tests"}.${P.corr?` Orders placed across all accounts: about ${n0f(me.ordMo)} a month.`:""} Middle result of ${best.runs} simulated runs.</p>
  </div>`;

  let head;
  if(bestT) head=`<h3>${fmt(tgt)} funded in about <em>${long(bestT)}</em>.</h3><p class="sub">${realT?`If your real win rate is a little lower, plan for about ${long(realT)}.`:`If your real win rate is a little lower, it may take longer than ${P.horizon} months.`}</p>`;
  else head=`<h3>${fmt(tgt)} is out of reach at these numbers.</h3><p class="sub">Raise your win rate or reward, or lower the goal.</p>`;

  let vc,vt,vp;
  if(ev<=0){vc="bad";vt="Your trading loses money.";vp=`At 1 : ${P.rr} you need to win more than ${pct(be)} of trades. Fix that before buying evaluations.`;}
  else if(bust>0.25){vc="warn";vt="Works, but the start is fragile.";vp=`In ${pct(bust)} of realistic runs, every account is lost before payouts start. Starting with more tests or a lower risk style lowers this.`;}
  else {vc="good";vt="The numbers work.";vp=`You make ${ev.toFixed(2)}× your risk per trade on average. Keep logging trades to make sure your win rate holds.`;}

  const inst=isInst(P);
  const stops=[{t:"Start",g:fmt(P.n0*P.s0),s:`${P.n0} × ${fmt(P.s0)} ${inst?"instant accounts":"evaluations"}`,w:"Now"}];
  for(let i=1;i<L.length;i++){ const r=best.reach[i-1]; stops.push({t:`Move to ${fmt(L[i].size)}`,g:fmt(L[i].unlockT1),s:`funded, ${L[i].unlockPay}+ payouts`,w:r.length?"~"+weeksTxt(quant(r,0.5)):"—"}); }
  stops.push({t:"Goal",g:fmt(tgt),s:`${n1} × ${fmt(top.size)} funded`,w:bestT?"~"+bestT:"—"});

  const stepsArr=inst?[
    [`Buy ${P.n0} × ${fmt(P.s0)} instant accounts`,`Cost ${fmtFull(P.n0*L[0].fee)}. They are funded the same day, no tests. No rebuy money: every new account after these is paid from payouts. Risk ${P.riskF}% per trade (${fmtFull(P.s0*P.riskF/100)}), never more after a loss.`],
    [`Start cycling your funded accounts`,`Each account trades one week, then rests two. Start dates are staggered so a bad week only touches a third of them. Any account that loses over 4 weeks rests 1 week.`],
    [`Take payouts at ${lockTxt(P)}`,`On ${fmt(P.s0)} that is ${P.lockMax>P.lock?fmtFull(P.s0*P.lock/100*P.split)+"–"+fmtFull(P.s0*P.lockMax/100*P.split):fmtFull(P.s0*P.lock/100*P.split)} to you. Cut a funded account at −${P.c1}% if ${P.k1} trades do not bring it back.`],
    [`Reinvest every payout until the backup is full`,`Buy backup instant accounts and keep them waiting (not trading) until they hold 60% of funded. When a funded account is cut, a backup goes live that day.`],
  ]:[
    [`Buy ${P.n0} × ${fmt(P.s0)} evaluations`,`Cost ${fmtFull(P.n0*L[0].fee)}. No rebuy money: every new test after these is paid from payouts (guide rule). Risk ${P.riskE}% per trade (${fmtFull(P.s0*P.riskE/100)}), never more after a loss.`],
    [`Pass Phase 1 (+${P.p1t}%) and Phase 2 (+${P.p2t}%)`,`About ${pct(S[0].ue.pFund)} of evaluations make it to funded at your numbers. ${P.n0>1?"Evaluations take turns by week, never the same trade on two at once. ":""}Stop and rebuy if one falls ${P.c3}% and does not recover in ${P.k3} trades.`],
    [`Start cycling your funded accounts`,`Each account trades one week, then rests two. Start dates are staggered so a bad week only touches a third of them. Any account that loses over 4 weeks rests 1 week.`],
    [`Take payouts at ${lockTxt(P)}`,`On ${fmt(P.s0)} that is ${P.lockMax>P.lock?fmtFull(P.s0*P.lock/100*P.split)+"–"+fmtFull(P.s0*P.lockMax/100*P.split):fmtFull(P.s0*P.lock/100*P.split)} to you. Cut a funded account at −${P.c1}% if ${P.k1} trades do not bring it back.`],
    [`Reinvest every payout until the tiers are full`,`Backup must reach 60% and evaluation 40% of funded. Spend in this order: evaluation, backup, funded, then yourself.`],
  ];
  for(let i=1;i<L.length;i++) stepsArr.push([`Move up to ${fmt(L[i].size)} accounts`,`When funded reaches ${fmt(L[i].unlockT1)} with ${L[i].unlockPay}+ payouts, 3 in a row and no funded cut in 14 days. ${inst?"Put one":"Pass one"} ${fmt(L[i].size)} account ${inst?"live":""} first, then buy more.`]);
  stepsArr.push([`Reach ${fmt(tgt)} and switch to income`,`${n1} funded, ${n2} backup${inst?"":`, ${n3} evaluation`} accounts of ${fmt(top.size)}. Reinvest 30% for replacements and keep 70%.`]);

  const sc=(s,label)=>{ const m=s.sim, r=last(m.reach); return `<div class="sc"><span class="n">${label}</span><span class="v">${r.length>m.runs*0.5?weeksTxt(quant(r,0.5)):"Not reached"}</span><span class="s">${pct(s.wr)} win rate · ${pct(m.bust/m.runs)} lose it all</span></div>`; };
  const row=s=>{ const u=s.ue,m=s.sim; return `<tr><td>${s.name}</td><td>${pct(s.wr)}</td><td>${u.ev>=0?"+":""}${u.ev.toFixed(2)}R</td><td>${pct(u.pFund)}</td><td>${fmt(u.feePerFunded)}</td><td>${pct(u.pCycle)}</td><td>${u.ePays.toFixed(1)}</td><td>${pct(m.reached/m.runs)}</td><td>${pct(m.bust/m.runs)}</td><td>${fmt(quant(m.fees,0.5))}</td><td>${fmt(quant(m.net,0.5))}</td></tr>`; };

  const u0=S[0].ue; const w10=Math.round(P.wr*10); const W100=Math.round(P.wr*100), L100=100-W100; const netR=W100*P.rr-L100;
  const tradesHtml=Array.from({length:10},(_,i)=>i<w10?`<span class="tr w" style="animation-delay:${i*70}ms">+${P.rr}</span>`:`<span class="tr l" style="animation-delay:${i*70}ms">−1</span>`).join("");
  const mult=u0.feePerFunded>0&&isFinite(u0.feePerFunded)?(u0.ePays*u0.payout)/u0.feePerFunded:0;
  const tot=sim.runs; let rc=0,bc=0; for(let i=0;i<tot;i++){ if(sim.reachedFlags[i]) rc++; else if(sim.bustFlags[i]) bc++; }
  const wc=[Math.round(rc/tot*100),0,Math.round(bc/tot*100)]; wc[1]=100-wc[0]-wc[2];
  const waffle=Array.from({length:100},(_,i)=>`<i style="animation-delay:${(i%20)*25+Math.floor(i/20)*60}ms;background:${i<wc[0]?"var(--gold)":i<wc[0]+wc[1]?"var(--dim)":"var(--bad)"}"></i>`).join("");

  $("out").innerHTML=`
  <div class="card headline"><span class="k">Your result</span>${head}
    <div class="kpis">
      <div class="kpi"><span class="v">${fmtFull(startCost)}</span><span class="k">to get started</span></div>
      <div class="kpi"><span class="v">${income>0?fmt(income):"—"}</span><span class="k">a month once you reach the goal</span></div>
      <div class="kpi"><span class="v" style="color:${bust>0.25?"var(--bad)":"inherit"}">${pct(bust)}</span><span class="k">chance of losing it all</span></div>
  </div>
    ${TS_IMPORT&&Math.round(TS_IMPORT.wr*100)===Math.round(P.wr*100)?(()=>{ const e=TS_IMPORT.edge, c=e.state==="proven"?"good":e.state==="none"?"bad":"warn"; return `<div class="verdict ${c}"><span class="ic">${c==="good"?"✓":"!"}</span><div><b>Your real trades: ${EDGE_TXT[e.state].toLowerCase()}</b><p>${edgeLine(e)}</p></div></div>`; })():""}
    ${vc!=="good"?`<div class="verdict ${vc}"><span class="ic">!</span><div><b>${vt}</b><p>${vp}</p></div></div>`:""}
    <div class="fx-cta"><button type="button" class="btn gold" id="startTrack">Start tracking this plan <span class="arr">→</span></button><a class="btn ghost" href="#road" data-nav="road">Week-by-week roadmap</a><a class="btn ghost" href="#check" data-nav="check">Check it against the guide</a><span class="hint">Your daily coach: which account to trade, how much to risk, what to do next.</span></div>
  </div>

  <div class="prem-zone">
  <div class="prem-gate"><span class="prem-chip">Premium</span><h3>Unlock your full plan</h3><p>Your road to the goal, the growth chart, your daily rules and the full math. Then the daily coach runs it with you.</p><button type="button" class="btn gold" data-signup="up" data-gate="premium">Unlock Premium <span class="arr">→</span></button><span class="prem-fine">Free during launch. No card needed.</span></div>
  <div class="card"><h3 class="ct">The road there</h3>
    <div class="road">${stops.map((s,k)=>`<div class="stop" style="animation-delay:${k*120}ms"><div class="node"><b></b><i></i></div><span class="t">${s.t}</span><span class="g">${s.g}</span><span class="s">${s.s}</span><span class="w">${s.w}</span></div>`).join("")}</div>
  </div>

  <div class="card"><h3 class="ct">Growth over time</h3>
    ${chart(P,S)}
    <div class="legend"><span><i class="sw" style="background:var(--t1)"></i>Your numbers</span><span><i class="sw" style="background:var(--t2)"></i>Win rate 20% lower</span><span><i class="sw" style="background:var(--bad)"></i>Losing trader</span></div>
  </div>

  <div class="card"><h3 class="ct">Your rules, every day</h3>
    <div class="rules">
      <div class="rule"><span class="big">${fmtFull(P.s0*(inst?P.riskF:P.riskE)/100)}</span><p>Risk per trade on a ${fmt(P.s0)} ${inst?"account":"test"}${RISK_LV[P.risklvl]?" ("+RISK_LV[P.risklvl].name+")":""}. Same size after a loss.${P.capped?" Lowered to stay inside the firm\u2019s limits.":""}</p></div>
      <div class="rule"><span class="big">1 : ${P.rr}</span><p>Every trade aims for at least ${P.rr}× what it risks.</p></div>
      ${P.n0>1&&!inst?`<div class="rule"><span class="big">Take turns</span><p>Your tests trade in different weeks, never the same trade on two.</p></div>`:""}
      <div class="rule"><span class="big">${lockTxt(P)}</span><p>Ask for the payout the moment a funded account is up ${P.lockMax>P.lock?`${P.lock}% (latest ${P.lockMax}%)`:P.lock+"%"}.</p></div>
      ${inst?`<div class="rule"><span class="big">−${P.c1}%</span><p>Cut a funded account at −${P.c1}% if ${P.k1} recovery trades fail.</p></div>`:`<div class="rule"><span class="big">−${P.c1}% · −${P.c3}%</span><p>Cut a funded account at −${P.c1}%, a test at −${P.c3}%, if ${P.k3} recovery trades fail.</p></div>`}
      <div class="rule"><span class="big">1 on · 2 off</span><p>Each funded account trades one week, then rests two.</p></div>
    </div>
  </div>

  ${tradesCard}

  <details class="full card"><summary>See the math, odds and full plan</summary>
  <div class="sub-card"><h3 class="ct">Your portfolio at the goal</h3>
    <div class="tierbar"><i style="flex:5;background:var(--t1)"></i><i style="flex:3;background:var(--t2)"></i>${inst?"":`<i style="flex:2;background:var(--t3)"></i>`}</div>
    <div class="tierkey">
      <div><span><i class="dotl" style="background:var(--t1)"></i>Funded</span><b>${fmt(tgt)}</b><span>${n1} × ${fmt(top.size)}</span></div>
      <div><span><i class="dotl" style="background:var(--t2)"></i>Backup</span><b>${fmt(tgt*.6)}</b><span>${n2} × ${fmt(top.size)}</span></div>
      ${inst?"":`<div><span><i class="dotl" style="background:var(--t3)"></i>Evaluation</span><b>${fmt(tgt*.4)}</b><span>${n3} × ${fmt(top.size)}</span></div>`}
    </div>
  </div>

  <div class="sub-card"><h3 class="ct">The math, with your numbers</h3>
    <p class="sub2">Out of 10 trades, you win about ${w10}.</p>
    <div class="trades">${tradesHtml}</div>
    <div class="eq"><span>${W100} wins × ${P.rr}</span><span class="op">−</span><span>${L100} losses × 1</span><span class="op">=</span><span class="res ${ev<=0?"neg":""}">${netR>=0?"+":""}${netR.toFixed(0)}</span></div>
    <p class="hint">For every 100 trades you ${netR>=0?"gain":"lose"} ${Math.abs(netR).toFixed(0)} times your risk. You risk ${fmtFull(P.s0*P.riskE/100)} per trade, so that is about ${fmtFull(Math.abs(netR)*P.s0*P.riskE/100)} ${netR>=0?"profit":"loss"} per 100 trades on one ${fmt(P.s0)} account.</p>
    <div class="flow">
      <div class="fl"><span class="k">One funded account costs</span><span class="v">${fmtFull(u0.feePerFunded)}</span><p>${inst?`${fmtFull(L[0].fee)} instant account fee. No tests to fail.`:`${fmtFull(L[0].fee)} test fee, and ${pct(u0.pFund)} of tests pass both phases.`}</p></div>
      <div class="fl"><span class="k">It pays you back</span><span class="v">${fmtFull(u0.ePays*u0.payout)}</span><p>About ${u0.ePays.toFixed(1)} payouts of ${fmtFull(u0.payout)} before it is lost.</p></div>
      <div class="fl"><span class="k">So every $1 you spend</span><span class="v" style="color:${mult>=1?"var(--gold)":"var(--bad)"}">${isFinite(mult)?"$"+mult.toFixed(mult<10?1:0):"$0"}</span><p>comes back on average.</p></div>
    </div>
  </div>

  <div class="sub-card"><h3 class="ct">We played your plan 100 times</h3>
    <p class="sub2">To be safe, we lowered your win rate by 20% (to ${pct(S[1].wr)}). Each square is one possible future over ${P.horizon} months.</p>
    <div class="waffle">${waffle}</div>
    <div class="wkey"><span><i class="dotl" style="background:var(--gold)"></i>Reached the goal <b>${wc[0]}</b></span><span><i class="dotl" style="background:var(--dim)"></i>Still growing <b>${wc[1]}</b></span><span><i class="dotl" style="background:var(--bad)"></i>Lost everything <b>${wc[2]}</b></span></div>
    <p class="hint">At your exact numbers (${pct(P.wr)}): ${Math.round(best.reached/best.runs*100)} reach the goal, ${Math.round(best.bust/best.runs*100)} lose everything.</p>
  </div>

  <div class="sub-card"><h3 class="ct">Reality check</h3>
    <div class="verdict ${vc}"><span class="ic">${vc==="good"?"✓":"!"}</span><div><b>${vt}</b><p>${vp}</p></div></div>
    <p class="hint">Losing trader test (${pct(S[2].wr)} win rate): ${Math.round(lose.bust/lose.runs*100)} out of 100 lose everything. A losing trader almost always runs out of money. This system multiplies an edge you already have. It does not create one.</p>
  </div>

    <h3 class="ct">Step by step</h3>

    <ol class="steps">${stepsArr.map((s,i)=>`<li><span class="no">${i+1}</span><div><h4>${s[0]}</h4><p>${s[1]}</p></div></li>`).join("")}</ol>
    <div class="tbl"><table class="data"><thead><tr><th>Scenario</th><th>Win rate</th><th>Edge</th><th>Eval → funded</th><th>Fees per funded</th><th>Payout cycle wins</th><th>Payouts per account</th><th>Reach goal</th><th>Lose it all</th><th>Fees paid</th><th>Net result</th></tr></thead><tbody>${S.map(row).join("")}</tbody></table></div>
    <p class="hint">Medians from ${sim.runs} simulated runs per scenario over ${P.horizon} months. Net result = money taken home + cash left − money put in.</p>
  </details>
  </div>`;
}

function countUp(ms){
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  document.querySelectorAll("#out .kpi .v, #out .fl .v, #out .headline em, #out .stop .g, #out .tierkey b").forEach(el=>{
    if(el._cu&&el.dataset.final) el.textContent=el.dataset.final; /* never read a half-animated number */
    const txt=el.textContent; el.dataset.final=txt; const tok=el._cu=(el._cu||0)+1; const m=txt.match(/[0-9][0-9,]*\.?[0-9]*/); if(!m) return;
    const raw=m[0], target=parseFloat(raw.replace(/,/g,"")), dec=(raw.split(".")[1]||"").length, comma=raw.includes(",");
    const t0=performance.now();
    const step=now=>{ if(el._cu!==tok) return; const k=Math.min(1,(now-t0)/ms), e=1-Math.pow(1-k,3); let v=(target*e).toFixed(dec);
      if(comma) v=Number(v).toLocaleString("en-US",{minimumFractionDigits:dec,maximumFractionDigits:dec});
      el.textContent=txt.replace(raw,v); if(k<1) requestAnimationFrame(step); else { el.textContent=txt; el._cu=0; } };
    requestAnimationFrame(step);
  });
}
let timer=null, busy=false, again=false;
function schedule(){ outs(); $("out").classList.add("loading"); clearTimeout(timer); timer=setTimeout(run,350); }
function run(){
  if(busy){again=true;return;} busy=true;
  setTimeout(()=>{
    try{
      const P=readParams(); const be=1/(1+P.rr);
      const S=[{name:"Your numbers",wr:P.wr},{name:"Win rate 20% lower",wr:P.wr*0.8},{name:"Losing trader",wr:Math.max(0.01,be-0.03)}];
      const runs=P.horizon>48?150:220;
      S.forEach((s,i)=>{ s.ue=unitEcon(P,s.wr); s.sim=portfolioSim(P,s.wr,runs,9001+i*7); }); S.tn=tradesNeeded(P,P.wr,70).map(r=>r.tpd===P.tpd?tradeRow(P,S[0].sim,P.tpd):r);
      const first=!$("out").dataset.done; render(P,S); $("out").dataset.done="1"; if(first&&window.fillHome) window.fillHome(P,S); if(typeof firmApplied!=="undefined"&&firmApplied){ const k=$("out").querySelector(".headline>.k"); if(k) k.insertAdjacentHTML("afterend",`<span class="fbadge" style="width:max-content">Using ${esc(firmApplied)} rules</span>`); }
      const o=$("out"); o.classList.remove("anim"); void o.offsetWidth; o.classList.add("anim"); countUp(first?1100:500);
    }catch(e){ $("out").innerHTML=`<div class="card"><p>These settings could not be calculated: ${esc(e.message)}</p></div>`; console.error(e); }
    $("out").classList.remove("loading"); busy=false; if(again){again=false;run();}
  },20);
}
(function(){ const root=document.documentElement; const mq=window.matchMedia("(prefers-color-scheme: dark)");
  const isDark=()=>root.dataset.theme?root.dataset.theme==="dark":mq.matches;
  const sync=()=>{ document.body.classList.toggle("isdark",isDark()); $("themeBtn").setAttribute("aria-label",isDark()?"Switch to light mode":"Switch to dark mode"); };
  try{ const t=localStorage.getItem("tp-theme"); if(t==="dark"||t==="light") root.dataset.theme=t; }catch(e){}
  $("themeBtn").addEventListener("click",()=>{ const t=isDark()?"light":"dark"; root.dataset.theme=t; try{localStorage.setItem("tp-theme",t);}catch(e){} sync(); });
  mq.addEventListener&&mq.addEventListener("change",sync); sync(); })();
bindControls(); importBoxInit(); modeUI(); sizeOptions(); renderLadder(); outs();
$("f").addEventListener("input",e=>{ const id=e.target.id; if(id==="target"||id==="s0"){ sizeOptions(); renderLadder(); }
  if(["riskE","riskF","k1","k2","k3"].includes(id)) $("risklvl").value="custom";
  else if(["maxdd","daily","tpd","c1","c2","c3"].includes(id)&&RISK_LV[$("risklvl").value]) applyLevel($("risklvl").value);
  riskUI(); schedule(); });
$("modeSeg").addEventListener("click",e=>{ const b=e.target.closest("[data-mode]"); if(!b) return; const m=b.dataset.mode; if($("mode").value===m) return; $("mode").value=m; modeUI(); renderLadder(); schedule(); });
function modeUI(){ const m=$("mode").value, inst=m==="instant";
  document.querySelectorAll("#modeSeg [data-mode]").forEach(b=>b.setAttribute("aria-checked",String(b.dataset.mode===m)));
  $("modeHelp").textContent=inst?"No tests. You pay more, and the account is funded at once. Fees are estimates (4% of size): type your firm's price under More settings.":"Cheap tests you must pass first. Most traders start here.";
  $("n0Lbl").textContent=inst?"How many accounts to start":"How many tests to start";
  ["p1t","p2t","c2","c3","k2","k3"].forEach(id=>{ const el=$(id); const lab=el&&el.closest("label"); if(lab) lab.style.display=inst?"none":""; }); }
$("riskSeg").addEventListener("click",e=>{ const b=e.target.closest("[data-lvl]"); if(!b) return; applyLevel(b.dataset.lvl); schedule(); });
applyLevel("med");
$("f").addEventListener("change",e=>{ if(e.target.id==="maxsize"){ renderLadder(); schedule(); } });
$("f").addEventListener("submit",e=>e.preventDefault());
