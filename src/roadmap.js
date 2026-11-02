/* ---------- Premium roadmap: your plan as 4 stages, week by week, each unlocks when the last is done ---------- */
function roadParams(){
  const P=readParams();
  try{ if(typeof TK!=="undefined"&&TK.state&&TK.state.p){ const p=TK.state.p; Object.keys(p).forEach(k=>{ if(p[k]!=null&&k!=="firm") P[k]=p[k]; }); } }catch(e){}
  return P;
}
function roadTimeline(P){
  const runs=160, keys=["p1","p2","f1","po1","f2","up1","goal"], W={}, amt=[], rate=[];
  keys.forEach(k=>W[k]=[]);
  const ms={};
  for(let i=0;i<runs;i++){
    const seen={}; let funded=0;
    const hit=(k,w)=>{ if(seen[k]==null){ seen[k]=w; W[k].push(w+1); } };
    portfolioSim(P,P.wr,1,1000+i*7,x=>{
      if(x.e==="pass1") hit("p1",x.w);
      else if(x.e==="pass2") hit("p2",x.w);
      else if(x.e==="funded"){ funded++; hit("f1",x.w); if(funded>=2) hit("f2",x.w); }
      else if(x.e==="payout"){ if(seen.po1==null) amt.push(x.amt); hit("po1",x.w); }
      else if(x.e==="alloc"){ if(rate.length<runs) rate.push(x.rate); }
      else if(x.e==="upgrade") hit("up1",x.w);
      else if(x.e==="milestone"){ if(x.goal) hit("goal",x.w); else { (ms[x.v]=ms[x.v]||[]).push(x.w+1); } }
    });
  }
  const med=k=>W[k].length>=runs*0.3?Math.max(1,Math.round(quant(W[k],0.5))):null;
  const T={}; keys.forEach(k=>T[k]=med(k));
  T.payAmt=amt.length?quant(amt,0.5):P.s0*P.lock/100*P.split;
  T.rate=rate.length?quant(rate,0.5):0.8;
  T.miles=Object.keys(ms).map(Number).sort((a,b)=>a-b).filter(v=>ms[v].length>=runs*0.3).map(v=>({v,w:Math.round(quant(ms[v],0.5))}));
  T.reach=W.goal.length/runs;
  return T;
}
function roadProgress(){
  try{ const st=typeof TK!=="undefined"&&TK.state; if(!st) return 0;
    const fundedNow=st.accounts.filter(a=>a.ph===3);
    const total=fundedNow.reduce((s,a)=>s+a.size,0);
    if(total>=st.p.target) return 3;
    if(st.payouts&&st.payouts.length) return 2;
    if(fundedNow.length||st.accounts.some(a=>a.ph>=3)) return 1;
    return 0; }catch(e){ return 0; }
}
function roadRender(){
  const o=$("roadOut"); if(!o) return;
  let P; try{ P=roadParams(); }catch(e){ o.innerHTML=`<div class="card"><p>Build your plan first.</p></div>`; return; }
  o.innerHTML=`<div class="card"><p class="muted">Working out your weeks…</p></div>`;
  setTimeout(()=>{
    let T; try{ T=roadTimeline(P); }catch(e){ o.innerHTML=`<div class="card"><p>Could not build the roadmap: ${esc(e.message)}</p></div>`; return; }
    const cur=roadProgress(), L=P.ladder, s0=P.s0, n0=P.n0;
    const rE=s0*P.riskE/100, rF=s0*P.riskF/100, day=s0*P.daily/100;
    const wk=w=>w?`Week ${w}`:"Later";
    const about=w=>w?`about week ${w}`:"later in the plan";
    const yours=Math.round((1-T.rate)*100);
    const step=(w,t,p,kind)=>`<li class="rs ${kind||""}"><span class="rw">${w}</span><div><b>${t}</b>${p?`<p>${p}</p>`:""}</div></li>`;
    const S=[
      {tier:"Tier 3",name:"Pipeline",title:"Pass your first tests",from:1,to:T.f1,
       unlock:"Starts today",
       next:`Stage 2 unlocks when your first account is funded, ${about(T.f1)}.`,
       steps:[
        step("Week 1",`Buy ${n0} × ${fmt(s0)} tests (${fmtFull(L[0].fee)} each)`,`Trade test #1 only. Risk ${fmtFull(rE)} per trade, at most ${P.tpd} trade${P.tpd>1?"s":""} a day. Stop for the day if you are down ${fmtFull(s0*Math.min(P.daily,P.c3)/100*0.8)}.`),
        n0>1?step("Week 2",`Test #1 rests. Trade test #2`,`Tests take turns by week, so one bad week can't hit both.`):"",
        step("Every week",`Keep the same rhythm`,`Same ${fmtFull(rE)} risk after a loss. Aim for 1 : ${P.rr} on every trade.`),
        T.p1?step(wk(T.p1),`First Phase 1 pass (+${P.p1t}%)`,`That account moves to Phase 2. Same risk, same turns.`,"mile"):"",
        T.p2?step(wk(T.p2),`First Phase 2 pass (+${P.p2t}%)`,`It becomes a funded account.`,"mile"):"",
        step("Any week",`If a test falls to −${P.c3}%`,`Take up to ${P.k3} recovery trades. If they fail, close it and start a new one from Reinvestment.`,"warn")]},
      {tier:"Tier 1",name:"Funded",title:"First funded account and payout",from:T.f1,to:T.po1,
       unlock:`Unlocks ${about(T.f1)}`,
       next:`Stage 3 unlocks with your first payout, ${about(T.po1)}.`,
       steps:[
        step(wk(T.f1),`Your first funded account`,`Trade it 1 week, then rest 2 weeks. Risk ${fmtFull(rF)} per trade.`,"mile"),
        step("Every on-week",`Ask for a payout at +${P.lock}%`,`The moment it is up ${P.lock}% (${fmtFull(s0*P.lock/100)} on ${fmt(s0)}), request the payout. Don't wait for more.`),
        T.po1?step(wk(T.po1),`First payout, about ${fmtFull(T.payAmt)}`,`About ${Math.round(T.rate*100)}% goes to Reinvestment, ${yours}% is yours.`,"mile"):"",
        step("Right after",`Refill the pipeline`,`Reinvestment buys the next tests, so a new account is always on the way.`),
        step("Any week",`If a funded account falls to −${P.c1}%`,`Up to ${P.k1} recovery trades, once per account. If they fail, close it. Backups step in.`,"warn")]},
      {tier:"Tier 2",name:"Backup bench",title:"Build the bench and scale up",from:T.po1,to:T.goal,
       unlock:`Unlocks ${about(T.po1)}`,
       next:`Stage 4 unlocks when you reach ${fmt(P.target)} funded, ${about(T.goal)}.`,
       steps:[
        step("Always",`Keep a backup ready`,`For every funded account, keep one test passed or close behind it. Like a football bench.`),
        T.f2?step(wk(T.f2),`Second funded account`,`Funded accounts take turns: each one trades 1 week in 3.`,"mile"):"",
        T.up1&&L[1]?step(wk(T.up1),`Move up to ${fmt(L[1].size)} tests`,`Only after 3 payouts in a row and no cut in the last 10 days.`,"mile"):"",
        ...T.miles.slice(0,4).map(m=>step(wk(m.w),`${fmt(m.v)} funded`,`Next account size unlocks.`,"mile"))]},
      {tier:"Goal",name:"Funded team",title:`${fmt(P.target)} funded`,from:T.goal,to:null,
       unlock:T.goal?`Unlocks ${about(T.goal)}`:`Not reached in most futures. Try lower risk or a smaller goal.`,
       next:"",
       steps:[
        step(wk(T.goal),`Goal reached`,`${Math.round(T.reach*100)}% of simulated futures got here.`,"mile"),
        step("Every month",`Most payouts are now yours`,`As the team grows, more of each payout goes to you instead of Reinvestment.`),
        step("Always",`Same rules`,`Fixed risk, 1 week on and 2 off, payout at +${P.lock}%.`)]}
    ];
    o.innerHTML=`
    <div class="card road-sum"><div><span class="k">Your road</span><h2>${T.goal?`${fmt(P.target)} funded in about ${weeksTxt(T.goal)}`:`A long road to ${fmt(P.target)}`}</h2><p>${n0} × ${fmt(s0)} tests · ${Math.round(P.wr*100)}% win rate · 1 : ${P.rr} · ${RISK_LV[P.risklvl]?RISK_LV[P.risklvl].name+" risk":P.riskE+"% risk"}. Weeks are the middle of 160 simulated futures, so yours can be faster or slower.</p></div>
      <div class="road-bar">${S.map((s,i)=>`<span class="${i<cur?"done":i===cur?"now":""}"><i></i>${s.tier}</span>`).join("")}</div></div>
    ${S.map((s,i)=>{ const st=i<cur?"done":i===cur?"now":"locked";
      return `<section class="stage ${st}"><div class="sg-h"><span class="sg-n">${i+1}</span><div><span class="sg-t">Stage ${i+1} · ${s.tier} · ${s.name}</span><h3>${s.title}</h3><span class="sg-w">${s.from?`Week ${s.from}`:""}${s.to?` → ${s.to}`:s.from?" →":""}</span></div><span class="sg-st">${st==="done"?"Done":st==="now"?"You are here":`<i class="lk"></i>${esc(s.unlock)}`}</span></div>
        <ol class="sg-steps">${s.steps.join("")}</ol>
        ${s.next?`<div class="sg-next">${s.next}</div>`:""}</section>`; }).join("")}
    <p class="road-fine">Estimates from simulated trades with your numbers. Real markets differ. The coach moves you to the next stage when it really happens.</p>`;
  },30);
}
