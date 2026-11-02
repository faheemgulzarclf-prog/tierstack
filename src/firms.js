/* ---------- firm rules library (checked 2 Nov 2026) ---------- */
const FIRMS=[
{id:"ftmo",name:"FTMO",program:"2-Step Challenge",aliases:["ftmo"],checked:"2 Nov 2026",
 sources:[{l:"PropRuleGuard (checked vs FTMO, 25 Oct 2026)",u:"https://propruleguard.com/firms/ftmo"},{l:"StonkJournal FTMO review (13 Oct 2026)",u:"https://stonkjournal.com/articles/ftmo-review"}],
 plan:{p1t:10,p2t:5,maxdd:10,daily:5,mindays:4,split:80,fees:{100000:540},cur:"€"},
 rules:[
  ["Price","€540 for $100K","Other sizes ($10K to $200K) are priced on ftmo.com. You get the fee back with your first payout.","info"],
  ["Phase 1 goal","+10%","Make $10,000 on a $100K account to pass the first test.","info"],
  ["Phase 2 goal","+5%","Then make $5,000 more on the second test.","info"],
  ["Daily loss limit","5%","In one day you can't drop $5,000 below where you started that day. Open losing trades count too. Resets at midnight Central Europe time.","danger"],
  ["Total loss limit","10%, fixed","Your account must never fall below $90,000. This line never moves.","danger"],
  ["Minimum days","4 days","Trade on at least 4 different days in each phase, even if you hit the goal earlier.","info"],
  ["Time limit","None","Take as long as you need.","good"],
  ["Your share","80%","You keep 80% of the profit. It can rise to 90% with scaling.","good"],
  ["First payout","14 days","You can ask for your first payout 14 days after your first trade. Approval takes 1 to 2 business days.","info"],
  ["News trading","Limited when funded","Fine during the tests. On a funded account, no trades 2 minutes before or after big news on that market.","warn"],
  ["Weekends","Close on Friday when funded","Fine during the tests. On a standard funded account, close everything before the weekend.","warn"],
  ["Robots (EAs)","Allowed","Allowed, unless they send more than 2,000 server requests a day.","good"],
  ["Someone else trading","Not allowed","Only you may trade your account.","danger"],
  ["Copy trading","Allowed with limits","Check FTMO's exact limits before copying trades across accounts.","warn"],
  ["Consistency rule","None","No rule about one big day.","good"],
  ["Growing your account","+25% every 4 months","If you're up 10% and have had 2 payouts, the account grows by 25%, up to $2M.","good"]],
 traps:["Open losing trades count toward the 5% daily limit, so a floating loss can end the account.","Weekend holding is banned on standard funded accounts.","The fee shown here is in euros."],
 fit:[["check","Copying the same trade across your accounts is allowed with limits. Read them first."],["no","Funded accounts must close before the weekend, so plan your ON weeks to end on Friday."],["yes","No time limit fits the 1 week on, 2 weeks off rhythm."]]},

{id:"fundednext",name:"FundedNext",program:"Stellar 2-Step",aliases:["fundednext","funded next","stellar"],checked:"2 Nov 2026",
 sources:[{l:"FundedNext Help Center (2 Oct 2026)",u:"https://help.fundednext.com/en/articles/17255124-stellar-2-step-challenge"}],
 plan:{p1t:8,p2t:5,maxdd:10,daily:5,mindays:5,split:80,fees:{6000:59.99,15000:119.99,25000:199.99,50000:299.99,100000:549.99,200000:999.99},cur:"$"},
 rules:[
  ["Price","$59.99 to $999.99","$25K costs $199.99, $50K $299.99, $100K $549.99. You get the fee back with your first payout.","info"],
  ["Phase 1 goal","+8%","Make $8,000 on a $100K account.","info"],
  ["Phase 2 goal","+5%","Then make $5,000 more.","info"],
  ["Daily loss limit","5%","Never lose more than $5,000 in one day on a $100K account.","danger"],
  ["Total loss limit","10%","Your balance or equity must never go below $90,000.","danger"],
  ["Minimum days","5 days","Trade on at least 5 different days in each phase, with at least 1 trade each day.","info"],
  ["Time limit","None","No deadline in either phase.","good"],
  ["Your share","80%","80% on the normal 21-day cycle. Other options: 60% after 3 profitable days, or 90% on demand.","good"],
  ["Payouts","21 days, then every 14","First payout after 21 days, then every 14 days if you're in profit. Paid within 24 hours of approval.","info"],
  ["News trading","Only 40% counts","Profit from trades placed 5 minutes before or after big news on a related pair only counts 40%. Losses count fully.","warn"],
  ["Quick trades","Under 30%","Profit from trades closed within 30 seconds must stay under 30% of your profit.","warn"],
  ["Robots (EAs)","Under $50K only","EAs are allowed on accounts below $50K. Not allowed on $50K and up.","warn"],
  ["Copy trading","Tests only","You may copy between your own challenge accounts, not with funded accounts or other people.","danger"],
  ["Weekends","Not stated","The help page doesn't cover it. Ask support.","warn"],
  ["Growing your account","+25% each time","Scale-Up adds 25% to the balance each time you qualify, and your share rises to 90%.","good"]],
 traps:["News profits only count 40%, so trading big news can quietly cut your payout.","No EAs on $50K or bigger accounts.","Copy trading isn't allowed across funded accounts."],
 fit:[["no","Copying the same trade across funded accounts isn't allowed. Trade each funded account by hand."],["yes","No time limit fits the cycling rhythm."],["check","5 minimum days per phase makes each test take at least a week."]]},

{id:"fundingpips",name:"FundingPips",program:"2-Step",aliases:["fundingpips","funding pips"],checked:"2 Nov 2026",
 sources:[{l:"Tanto rules guide (9 May 2026, third party)",u:"https://tradetanto.com/learn/fundingpips-rules"}],
 plan:{p1t:8,p2t:5,maxdd:10,daily:5,mindays:3,split:80,fees:{},cur:"$"},
 rules:[
  ["Price","See website","Sizes from $5K to $100K. One-time fee, no monthly charge.","info"],
  ["Phase 1 goal","+8% (or 10%)","Make 8% to pass. You can pick 10% at checkout for a lower price.","info"],
  ["Phase 2 goal","+5%","Then make 5% more.","info"],
  ["Daily loss limit","5%","In one day, don't lose more than 5% of your start-of-day balance or equity, whichever is higher. Open trades count. Resets at midnight (UTC+3).","danger"],
  ["Total loss limit","10%, fixed","Never fall more than 10% below your starting size. This line never moves.","danger"],
  ["Minimum days","3 days","Trade on at least 3 days in each phase.","info"],
  ["Time limit","Not stated","No deadline is listed.","good"],
  ["Your share","60% to 100%","Weekly payouts pay 60%, every 2 weeks 80%, on demand 90%, monthly 100%.","good"],
  ["First payout","7 days","On the weekly plan you can ask 7 days after your first trade. Minimum payout is 1% of the account.","info"],
  ["News trading","Profit doesn't count","On funded accounts, profit from trades opened or closed 5 minutes around big news doesn't count.","warn"],
  ["Weekends","Auto-close Friday","On funded accounts, trades close automatically at Friday's close (for now).","warn"],
  ["Copy trading","Own accounts only","Copying between your own accounts is fine. Not with other people.","good"],
  ["Robots (EAs)","Managers only","Only EAs that manage trades or risk are allowed.","warn"],
  ["Consistency rule","On-demand only","Only the 90% on-demand option needs no single day above 35% of total profit.","info"],
  ["Inactivity","30 days","30 days without a closed trade breaks the account.","danger"]],
 traps:["The daily limit uses the higher of balance or equity, so a winning open trade raises the bar.","A rest week is fine, but don't leave an account untouched for 30 days.","This summary comes from a third-party guide (May 2026). Confirm on fundingpips.com."],
 fit:[["yes","Copying trades across your own accounts is allowed."],["check","The 30-day inactivity rule means every account needs at least one closed trade each month. 2 weeks off is fine."],["no","Funded trades close on Friday, so don't plan to hold over weekends."]]},

{id:"the5ers",name:"The5ers",program:"High Stakes (2-step)",aliases:["the5ers","5ers","the 5ers","five percenters","the5%ers"],checked:"2 Nov 2026",
 sources:[{l:"The5ers official blog (25 Jun 2026)",u:"https://the5ers.com/challenge-programs-bootcamp-high-stakes-hyper-growth-explained/"}],
 plan:{p1t:8,p2t:5,maxdd:10,daily:5,mindays:3,split:80,fees:{},cur:"$"},
 rules:[
  ["Price","See website","Several sizes. You can hold more than one at a time.","info"],
  ["Phase 1 goal","+8% (check)","The official page says 8% in one place and 10% in another. Confirm before buying.","warn"],
  ["Phase 2 goal","+5%","Then make 5% more.","info"],
  ["Daily loss limit","5%","Lose 5% in one day and the account ends right away, with no second chance.","danger"],
  ["Total loss limit","10%","Never fall more than 10% below your starting balance.","danger"],
  ["Minimum days","3 profitable days","You need 3 days in each step where you closed at least 0.5% profit.","info"],
  ["Time limit","None","No deadline, as long as you trade at least once every 30 days.","good"],
  ["Your share","80% to 100%","Starts at 80% and can grow to 100% as the account scales.","good"],
  ["Payouts","Every 2 weeks","Paid every two weeks. Minimum payout is $150.","info"],
  ["News trading","2-minute pause","No orders 2 minutes before or after big news.","warn"],
  ["Weekends","Allowed","You can hold overnight and over the weekend. Index swaps cost more.","good"],
  ["Robots (EAs)","Allowed","Allowed, but no latency, tick or rollover scalping.","good"],
  ["Copy trading","Own accounts only","Copying between your own accounts is fine. Copying outside signals is not.","good"],
  ["Hedging","Allowed","Allowed, with a stop-loss on each position.","info"],
  ["Inactivity","30 days","An account with no trades for 30 days closes automatically.","danger"],
  ["Growing your account","Every +10%","The account scales each time you make 10%, up to $500K.","good"]],
 traps:["The daily limit ends the account instantly. There's no recovery.","Profitable days must be at least +0.5% each, not just any green day.","The official page shows both 8% and 10% for Step 1."],
 fit:[["yes","Copying trades across your own accounts is allowed."],["yes","Weekend holding is allowed."],["check","Trade each account at least once every 30 days. 2 weeks off is fine."]]},

{id:"alpha",name:"Alpha Capital",program:"Alpha Pro 8%",aliases:["alpha capital","alpha capital group","alpha","acg","alpha pro"],checked:"2 Nov 2026",
 sources:[{l:"Alpha Capital Help Center (22 Jul 2026)",u:"https://help.alphacapitalgroup.uk/en/articles/8420429-alpha-pro-8-10"}],
 plan:{p1t:8,p2t:5,maxdd:8,daily:4,mindays:3,split:80,fees:{},cur:"$"},
 rules:[
  ["Price","See website","Sizes from $5K to $300K. Prices aren't on the rules page.","info"],
  ["Phase 1 goal","+8%","Make $8,000 on a $100K account. (Pro 10% asks for 10%.)","info"],
  ["Phase 2 goal","+5%","Then make $5,000 more.","info"],
  ["Daily loss limit","4%","Never lose more than $4,000 in one day on $100K. Based on your balance. (Pro 10%: 5%.)","danger"],
  ["Total loss limit","8%, fixed","Never fall below $92,000 on $100K. (Pro 10%: 10%.)","danger"],
  ["Minimum days","3 days","Trade on at least 3 days in each phase.","info"],
  ["Lot limit","40 lots on $100K","Max open size: 10 lots on $25K, 20 on $50K, 40 on $100K. Going over twice closes the funded account.","danger"],
  ["News trading","5-minute pause","Don't open or close trades on that market 5 minutes before or after big news.","warn"],
  ["Weekends","Not when funded","Allowed during the tests, not on the funded account.","warn"],
  ["Leverage","1:100 forex","Forex 1:100, metals 1:30, indices 1:20, oil 1:10.","info"],
  ["Most you can hold","$400K total","All your Alpha accounts together can't go above $400K.","danger"],
  ["Your share","Not on this page","Check alphacapitalgroup.uk for split and payout timing.","warn"]],
 traps:["The daily limit is 4%, tighter than most firms.","Too many lots is only checked when you ask for a payout, and it can cost the payout.","Your total across all accounts is capped at $400K."],
 fit:[["no","The $400K cap means a TierStack goal above $400K can't be done at this firm alone."],["check","Copy trading isn't covered on the rules page. Ask support."],["check","Max loss is 8%, so keep the funded cut rule at −6% or lower."]]}
];

function findFirm(q){ q=q.trim().toLowerCase().replace(/[^a-z0-9% ]/g,""); if(q.length<2) return null;
  return FIRMS.find(f=>f.aliases.some(a=>a===q||a.startsWith(q)||q.startsWith(a))) || null; }

const LETTERS="ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const safeUrl=u=>/^https:\/\/[^\s"'<>]+$/.test(u||"")?u:null;
function firmHtml(F,opts={}){
  const p=F.plan||{};
  const rules=F.rules||[];
  const danger=rules.filter(r=>r[3]==="danger");
  const fitIc={yes:"✓",no:"✕",check:"!"};
  const fits=F.fit||[];
  const nNo=fits.filter(f=>f[0]==="no").length, nChk=fits.filter(f=>f[0]==="check").length;
  const fitV=nNo?["no","Works, with changes"]:nChk?["check","Works, check "+nChk+" thing"+(nChk>1?"s":"")]:["yes","Works well"];
  const src=(F.sources||[]).map(s=>{const u=safeUrl(s.u);return u?`<a href="${esc(u)}" target="_blank" rel="noopener">${esc(s.l)}</a>`:esc(s.l||"");}).filter(Boolean).join(" · ");
  const big=[["Pass test 1",p.p1t!=null?"+"+p.p1t+"%":"—","t1"],["Pass test 2",p.p2t!=null?"+"+p.p2t+"%":"—","t1"],["Max loss / day",p.daily!=null?"−"+p.daily+"%":"—","bad"],["Max loss total",p.maxdd!=null?"−"+p.maxdd+"%":"—","bad"]];
  return `
  <div class="fx">
    <div class="fx-head">
      <div class="fx-id"><span class="fx-mono">${esc((F.name||"?").charAt(0).toUpperCase())}</span><div><h2>${esc(F.name)}</h2><span class="fx-prog">${esc(F.program||"")}</span></div></div>
      <span class="fbadge ${opts.ai?"ai":""}"><i></i>${opts.ai?esc(opts.ai):`Updated ${esc(F.checked||"")}`}</span>
    </div>
    <div class="fx-big">${big.map(b=>`<div><span class="v ${b[2]}">${b[1]}</span><span class="k">${b[0]}</span></div>`).join("")}</div>
    <div class="fx-cta"><button type="button" class="btn gold" id="useFirm">Use in my plan <span class="arr">→</span></button><span class="fitv ${fitV[0]}"><b>${fitIc[fitV[0]]}</b>TierStack: ${fitV[1]}</span></div>
  </div>

  ${danger.length?`<div class="sec"><h3>Break one of these and the account is gone</h3>
  <div class="kill">${danger.map((r,i)=>`<div class="kc" style="animation-delay:${i*70}ms"><span class="kv">${esc(r[1])}</span><b>${esc(r[0])}</b><p>${esc(r[2])}</p></div>`).join("")}</div></div>`:""}

  ${fits.length?`<div class="sec"><h3>Will it work with your plan?</h3><div class="fitrow">${fits.map(f=>`<div class="fc ${f[0]}"><span>${fitIc[f[0]]||"!"}</span><p>${esc(f[1])}</p></div>`).join("")}</div></div>`:""}

  <div class="sec"><h3>Every rule, A to Z</h3>
    <div class="azl">${rules.map((r,i)=>`<details class="azr ${r[3]||"info"}"><summary><span class="lt">${LETTERS[i]||"•"}</span><b>${esc(r[0])}</b><span class="azv">${esc(r[1])}</span></summary><p>${esc(r[2])}</p></details>`).join("")}</div>
    <p class="hint">Tap a rule to read it in one simple sentence.</p>
  </div>

  ${(F.traps||[]).length?`<div class="sec tips"><h3>Tips</h3><ul>${F.traps.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></div>`:""}
  ${src?`<p class="hint srcs">Sources: ${src}. Firms change rules. Always confirm on the firm's site before you pay.</p>`:""}`;
}

/* live library from the database (refreshed weekly); embedded list is the fallback */
let firmsUpdated=null;
function validFirm(o){ return o&&typeof o.id==="string"&&typeof o.name==="string"&&Array.isArray(o.rules)&&o.plan&&typeof o.plan==="object"; }
async function loadLiveFirms(onDone){
  if(!(window.claude&&window.claude.use)) return;
  let db=null; try{ db=await window.claude.use("db"); }catch(e){}
  if(!db) return;
  try{
    const snap=await Promise.race([db.collection("firms").get(),new Promise((_,r)=>setTimeout(()=>r(new Error("timeout")),10000))]);
    let n=0;
    snap.docs.forEach(d=>{ const x=d.data(); if(!x||typeof x.json!=="string") return; let o; try{o=JSON.parse(x.json);}catch(e){return;}
      if(!validFirm(o)) return; if(!Array.isArray(o.aliases)) o.aliases=[o.name.toLowerCase()];
      const i=FIRMS.findIndex(f=>f.id===o.id); if(i>=0) FIRMS[i]=o; else FIRMS.push(o); n++; });
    try{ const m=await db.doc("meta/status").get(); const md=m.data(); if(md&&typeof md.lastRun==="string") firmsUpdated=md.lastRun.slice(0,40); }catch(e){}
    if(n||firmsUpdated) onDone();
  }catch(e){}
}
