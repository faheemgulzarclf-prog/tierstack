/* ---------- Test Lab auto-play: trades every day by itself with the coach's own rules, and checks each move against the guide ---------- */
const LAB={instant:true,timer:null,seed:1,rng:null,speed:200,checks:{},errors:[],lanes:{},recCount:{},done:false};
function labRng(seed){ let a=seed>>>0; return ()=>{ a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
function labReset(){ LAB.checks={}; LAB.errors=[]; LAB.lanes={}; LAB.recCount={}; LAB.done=false; LAB.rng=labRng(LAB.seed); }
const LAB_RULES=[
  ["risk","Fixed risk per trade","Same % risk every trade: tests "+"and funded use your risk style."],
  ["turns","Tests take turns by week","Never trade all evaluations in the same window."],
  ["cycle","Funded: 1 week on, 2 off","Only trade funded accounts in their ON week."],
  ["pass","Pass at target + min days","Phase 1 → Tier 2 at the Phase 1 target, Phase 2 → Tier 1 at the Phase 2 target."],
  ["payout","Payout at +lock%","Request the payout the moment a funded account is up the lock %."],
  ["split","Reinvest ladder","100% to the pool until T2 = 60% and T3 = 40% of T1, then 80 / 65 / 50 / 30%."],
  ["recovery","Recovery once, limited trades","2–3 trades on T1, 3–4 on T2, 2–3 on T3. Never twice."],
  ["cut","Cut levels","T1 −6%, T2 −4%, T3 −4% after recovery fails."],
  ["buy","Buy order","No buying before the first funded account; then refill the pipeline (T2 + T3 = T1)."],
  ["maxdd","Inside the firm's max loss","No account ever breaks the firm's max drawdown."]];
function labCheck(k,ok,msg){ const c=LAB.checks[k]||(LAB.checks[k]={ok:0,bad:0}); if(ok) c.ok++; else { c.bad++; if(LAB.errors.length<40) LAB.errors.push({d:todayStr(),k,msg}); } }
function labStage(st,pf){ return pf.done?3:pf.T1===0?0:st.payouts.length?2:1; }
function labStepDay(){
  const st=TK.state; if(!st||LAB.done) return;
  if(!LAB.rng) labReset();
  const p=st.p, t=todayStr(), dow=new Date(t+"T12:00:00").getDay();
  if(dow!==0&&dow!==6){
    const w=weekIdx(st);
    st.accounts.filter(a=>a.status==="active").forEach(a=>{
      if(a.status!=="active") return;
      const v=advise(a,st), r=rulesFor(a,p), pct=(a.bal-a.size)/a.size*100;
      if(v.kind==="payout"){
        labCheck("payout",pct>=p.lock-1e-9&&a.days.length>=p.mindays,`${a.name} payout asked at ${pct.toFixed(2)}%`);
        const split=p.split>1?p.split/100:p.split, exp=(a.bal-a.size)*split; labCheck("payout",Math.abs(v.pay-exp)<0.5,`${a.name} payout ${fmtFull(v.pay)} but profit × split = ${fmtFull(exp)}`);
        const pf=portfolio(st), expRate=!pf.stocked?1:pf.T1<0.2*p.target?0.8:pf.T1<0.6*p.target?0.65:pf.T1<p.target?0.5:0.3;
        const res=doPayout(a,v.pay); labCheck("split",Math.abs(res.rate-expRate)<1e-9,`Payout split ${Math.round(res.rate*100)}% but the guide says ${Math.round(expRate*100)}%`);
        return; }
      if(v.kind==="cut"){ labCheck("cut",pct<=-r.cut+1e-9&&(a.recUsed||a.rec===0||r.K===0),`${a.name} cut at ${pct.toFixed(2)}%`); doCut(a); return; }
      if(v.kind==="rest") return;
      if(v.kind==="wait"){ doLog(a,a.bal); const ph=a.phase; autoPass(a); if(a.phase!==ph) labCheck("pass",true,""); return; }
      if(v.kind==="trade"||v.kind==="recover"){
        labCheck(a.phase===3?"cycle":"turns",isOn(a,st)||v.kind==="recover",`${a.name} told to trade in its rest week`);
        if(a.phase!==3&&v.kind==="trade"){ const k="w"+w; (LAB.lanes[k]=LAB.lanes[k]||new Set()).add(a.lane); labCheck("turns",LAB.lanes[k].size<=1,`Week ${w+1}: two test lanes traded`); }
        if(a.phase===3&&v.kind==="trade") labCheck("cycle",(w%3)===a.off,`${a.name} traded in week ${w+1} but its ON week is ${a.off}`);
        const expRisk=a.size*(a.phase===3?p.riskF:p.riskE)/100; labCheck("risk",Math.abs(v.riskUsd-expRisk)<0.5,`${a.name} risk ${fmtFull(v.riskUsd)} vs ${fmtFull(expRisk)}`);
        let bal=a.bal; const n=v.kind==="recover"?1:(p.tpd||1);
        if(LAB.instant) bal=Math.max(bal,v.tgtUsd); else for(let i=0;i<n;i++){ const win=LAB.rng()<p.wr; bal+=win?v.riskUsd*p.rr:-v.riskUsd; if(bal<=v.dailyStop||bal>=v.tgtUsd) break; }
        if(v.kind==="recover"){ LAB.recCount[a.id]=(LAB.recCount[a.id]||0)+1; labCheck("recovery",LAB.recCount[a.id]<=r.K,`${a.name} took ${LAB.recCount[a.id]} recovery trades (max ${r.K})`); }
        const wasUsed=a.recUsed, ph=a.phase, pct2=(Math.round(bal)-a.size)/a.size*100;
        doLog(a,Math.round(bal));
        if(a.rec>0&&wasUsed&&ph===a.phase) labCheck("recovery",false,`${a.name} got a second recovery`);
        if(a.status==="active"){ const days=a.days.length; autoPass(a); if(a.phase!==ph) labCheck("pass",pct2>=r.tgt-1e-9&&days>=p.mindays,`${a.name} passed at ${pct2.toFixed(2)}% after ${days} days`); }
        if(a.rec<0) delete LAB.recCount[a.id];
        labCheck("maxdd",(a.bal-a.size)/a.size*100>-p.maxdd,`${a.name} broke the firm's max loss`);
      }
    });
    // buying: follow the coach's next step
    let guard=0, pf=portfolio(st);
    while(pf.need>0&&st.pool>=pf.fee&&guard++<6){ labCheck("buy",pf.T1>0||st.accounts.filter(a=>a.status==="active").length<p.n0,`Bought a test before the first funded account`); doBuy(pf.buySize,pf.fee); pf=portfolio(st); }
    if(pf.done){ LAB.done=true; log(`Goal reached: ${fmt(pf.T1)} funded.`); }
  }
  const d=new Date(t+"T12:00:00"); d.setDate(d.getDate()+1);
  TK.testDay=d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); st.testDay=TK.testDay; tkTick(st);
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
  let next; if(pf.done) next=pf.stocked?"Goal reached. Income mode: keep 70%.":"Goal reached. Payouts still go to the pool until Tier 2 = 60% and Tier 3 = 40% of Tier 1."; else if(pf.need>0) next=`Buy 1 × ${fmt(pf.buySize)} test (${fmtFull(pf.fee)}). Pool ${fmtFull(st.pool)}.`; else if(pf.T1===0) next="Pass the starting tests. No buying yet."; else next="Tiers full. Keep trading.";
  const tb=Object.values(LAB.checks).reduce((s,c)=>s+c.bad,0), tok=Object.values(LAB.checks).reduce((s,c)=>s+c.ok,0);
  const names=["Tier 3 · Pipeline","Tier 1 · First funded","Tier 2 · Bench & scale","Goal"];
  return `<div class="lab" id="labBoard">
    <div class="lab-top"><div><span class="kicker">Auto-play</span><h3>${LAB.done?`Goal reached on day ${d}`:`Day ${d} · Week ${Math.floor((d-1)/7)+1}`}</h3><span class="lab-sub">${LAB.instant?"Instant pass: every account hits its target on its first trading day":`Future #${LAB.seed} · ${Math.round(p.wr*100)}% win rate · 1 : ${p.rr}`} · trades Mon–Fri</span></div>
      <div class="lab-ctl"><button type="button" class="btn ${playing?"ghost":"gold"} sm" data-lab="${playing?"pause":"play"}">${playing?"Pause":"▶ Play"}</button><button type="button" class="btn ghost sm" data-lab="day">+1 day</button><button type="button" class="btn ghost sm" data-lab="week">+1 week</button>
      <select id="labSpeed" aria-label="Speed"><option value="600"${LAB.speed==600?" selected":""}>Slow</option><option value="200"${LAB.speed==200?" selected":""}>Normal</option><option value="40"${LAB.speed==40?" selected":""}>Fast</option></select><button type="button" class="btn ghost sm" data-lab="new">${LAB.instant?"Restart":"New future"}</button></div></div>
    <div class="lab-mode" role="radiogroup" aria-label="Pass mode"><button type="button" role="radio" aria-checked="${LAB.instant}" data-lab="instant" class="${LAB.instant?"on":""}"><b>Instant pass</b><span>No passing limits. See the whole structure fast.</span></button><button type="button" role="radio" aria-checked="${!LAB.instant}" data-lab="real" class="${LAB.instant?"":"on"}"><b>Real trading</b><span>Wins and losses at your win rate, with cuts and recovery.</span></button></div>
    <div class="road-bar lab-stages">${names.map((n,i)=>`<span class="${i<stg?"done":i===stg?"now":""}"><i></i>${n}</span>`).join("")}</div>
    <div class="lab-stats"><div><b>${fmt(pf.T1)}</b><span>Tier 1 live of ${fmt(p.target)}</span></div><div><b>${fmt(pf.T2)}</b><span>Tier 2 (need ${fmt(0.6*pf.T1)})</span></div><div><b>${fmt(pf.T3)}</b><span>Tier 3 (need ${fmt(0.4*pf.T1)})</span></div><div><b>${fmtFull(st.pool)}</b><span>pool</span></div><div><b>${fmtFull(st.personal)}</b><span>taken home</span></div><div><b>${st.payouts.length}</b><span>payouts</span></div></div>
    <div class="lab-next"><b>Next to buy:</b> ${next}</div>
    <div class="lab-cols">${col(1,"Tier 3 · Pipeline","Phase 1","t3")}${col(2,"Tier 2 · Backup","Phase 2","t2")}${col(3,"Tier 1 · Live","Funded","t1")}</div>
    ${closed.length?`<div class="lab-closed"><b>Closed (${closed.length}):</b> ${closed.slice(-12).map(a=>`${esc(a.name)} (${a.phase===3?"T1":a.phase===2?"T2":"T3"})`).join(", ")}</div>`:""}
    <div class="lab-g2"><div class="lab-checks"><h4>Guide check ${tb?`<span class="bad">${tb} error${tb>1?"s":""}</span>`:`<span class="ok">${tok} checks, 0 errors</span>`}</h4>${LAB_RULES.map(([k,n,g])=>{ const c=LAB.checks[k]||{ok:0,bad:0}; return `<div class="lab-ck ${c.bad?"bad":c.ok?"ok":""}"><span>${c.bad?"✗":c.ok?"✓":"·"}</span><div><b>${n}</b><p>${g}</p></div><em>${c.ok+c.bad}</em></div>`; }).join("")}
      ${LAB.errors.length?`<ul class="lab-err">${LAB.errors.slice(0,10).map(e=>`<li><span>${fmtDate(e.d)}</span>${esc(e.msg)}</li>`).join("")}</ul>`:""}</div>
      <div class="lab-feed"><h4>What happened</h4><ul class="tk-log">${st.log.slice(0,14).map(l=>`<li><span>${fmtDate(l.d)}</span>${esc(l.t)}</li>`).join("")}</ul></div></div>
  </div>`;
}
function labRenderBoard(){ const b=$("labBoard"); if(b) b.outerHTML=labBoard(); }
document.addEventListener("click",e=>{ const b=e.target.closest("[data-lab]"); if(!b||!TK.test||!TK.state) return; const k=b.dataset.lab;
  if(k==="instant"||k==="real"){ const want=k==="instant"; if(LAB.instant!==want){ LAB.instant=want; labPlay(false); labReset(); TK.testDay=null; TK.state.testDay=null; tkFromPlan(); labReset(); } tkRender(); return; }
  if(k==="play") labPlay(true); else if(k==="pause") labPlay(false);
  else if(k==="day"){ labStepDay(); tkSave(); tkRender(); }
  else if(k==="week"){ for(let i=0;i<7&&!LAB.done;i++) labStepDay(); tkSave(); tkRender(); }
  else if(k==="new"){ labPlay(false); LAB.seed=1+Math.floor(Math.random()*9999); labReset(); TK.testDay=null; TK.state.testDay=null; tkFromPlan(); labReset(); tkRender(); } });
document.addEventListener("change",e=>{ if(e.target.id!=="labSpeed") return; LAB.speed=+e.target.value; if(LAB.timer) labPlay(true); });
