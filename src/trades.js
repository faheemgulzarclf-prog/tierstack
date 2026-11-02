/* ---------- real trades: import a CSV / pasted list, read win rate, reward, trades a day and the edge ---------- */
// edge from a list of results in R (win = +reward, loss = -1). One-sided 90% lower bound on the average.
function edgeOf(R){
  const n=R.length; if(!n) return {n:0,state:"few",ev:0,lo:0,wr:0};
  const ev=R.reduce((s,x)=>s+x,0)/n, sd=Math.sqrt(R.reduce((s,x)=>s+(x-ev)**2,0)/Math.max(1,n-1)), lo=ev-1.28*sd/Math.sqrt(n), hi=ev+1.28*sd/Math.sqrt(n);
  const wr=R.filter(x=>x>0).length/n;
  /* none = losing and very unlikely to be bad luck (blocks new tests); weak = losing lately but could be luck */
  const state=n<30?"few":hi<0?"none":ev<=0?"weak":lo<=0?"unclear":"proven";
  return {n,ev,lo,hi,sd,wr,state};
}
const EDGE_TXT={few:"Not enough trades yet",none:"No edge",weak:"Losing lately",unclear:"Edge not proven yet",proven:"Edge proven"};
function edgeLine(e){ const k=e.state;
  if(k==="few") return `${e.n} trades. You need at least 30 to know if your edge is real.`;
  if(k==="none") return `Over your last ${e.n} trades you lost ${Math.abs(e.ev).toFixed(2)}× your risk per trade on average. Do not buy new tests until this turns positive. Practise on demo first.`;
  if(k==="weak") return `Your last ${e.n} trades lost ${Math.abs(e.ev).toFixed(2)}× your risk per trade on average. It could still be bad luck, so keep risk small and review your trades before buying more tests.`;
  if(k==="unclear") return `You make ${e.ev.toFixed(2)}× your risk per trade, but ${e.n} trades is not enough to rule out luck. Keep going with small size.`;
  return `You make ${e.ev.toFixed(2)}× your risk per trade over ${e.n} trades, and that is very unlikely to be luck.`;
}
function tsNum(v){ if(v==null) return NaN; let s=String(v).trim(); if(!s) return NaN; let neg=false;
  if(/^\(.*\)$/.test(s)){ neg=true; s=s.slice(1,-1); }
  s=s.replace(/[$€£\s]/g,"").replace(/[^\d.,\-+eE]/g,"");
  if(/,\d{1,2}$/.test(s)&&!/\.\d/.test(s)) s=s.replace(/\./g,"").replace(",","."); else s=s.replace(/,/g,"");
  const x=parseFloat(s); return isFinite(x)?(neg?-Math.abs(x):x):NaN; }
function tsSplit(line,d){ const out=[]; let cur="", q=false; for(let i=0;i<line.length;i++){ const c=line[i];
  if(c==='"'){ if(q&&line[i+1]==='"'){cur+='"';i++;} else q=!q; } else if(c===d&&!q){ out.push(cur); cur=""; } else cur+=c; } out.push(cur); return out.map(x=>x.trim()); }
function tsDay(v){ if(!v) return null; const s=String(v).trim();
  let m=s.match(/(\d{4})[.\-\/](\d{1,2})[.\-\/](\d{1,2})/); if(m) return `${m[1]}-${m[2].padStart(2,"0")}-${m[3].padStart(2,"0")}`;
  m=s.match(/(\d{1,2})[.\-\/](\d{1,2})[.\-\/](\d{4})/); if(m) return `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;
  const d=new Date(s); return isNaN(d)?null:d.toISOString().slice(0,10); }
/* returns {trades:[{v,r,day}], wins, losses, wr, rr, tpd, days, R:[...], edge, col, err} */
function parseTrades(text){
  const lines=String(text||"").replace(/\r/g,"").split("\n").map(l=>l.trim()).filter(Boolean);
  if(!lines.length) return {err:"Nothing to read. Paste your trades or choose a file."};
  const d=[",",";","\t","|"].map(c=>[c,(lines[0].match(new RegExp(c==="|"?"\\|":c,"g"))||[]).length]).sort((a,b)=>b[1]-a[1])[0];
  const delim=d[1]>0?d[0]:null;
  let rows=lines.map(l=>delim?tsSplit(l,delim):[l]);
  const head=rows[0].map(h=>h.toLowerCase().replace(/[^a-z&%]/g,""));
  const hasHead=rows[0].some(c=>isNaN(tsNum(c))&&/[a-z]/i.test(c));
  let pi=-1, ri=-1, di=-1;
  if(hasHead){
    const find=keys=>{ for(const k of keys){ const i=head.findIndex(h=>h===k); if(i>=0) return i; } for(const k of keys){ const i=head.findIndex(h=>h.includes(k)); if(i>=0) return i; } return -1; };
    ri=head.findIndex(h=>/^(r|rr|rmultiple|rmult|rmultiplier|rvalue)$/.test(h));
    pi=find(["netprofit","netp&l","netpnl","realizedpnl","pnl","p&l","profit","netpl","pl","result","gain","return"]);
    di=find(["closetime","closedate","exittime","exitdate","close","date","time","opentime","opendate"]);
    rows=rows.slice(1);
  } else { // no header: last numeric column is the result
    const c=rows[0].length; for(let i=c-1;i>=0;i--) if(!isNaN(tsNum(rows[0][i]))){ pi=i; break; }
    for(let i=0;i<c;i++) if(tsDay(rows[0][i])&&isNaN(Number(rows[0][i]))){ di=i; break; }
  }
  if(pi<0&&ri<0) return {err:"Could not find a profit or P&L column. Name one column Profit, P&L or R."};
  const trades=[]; for(const r of rows){ const v=pi>=0?tsNum(r[pi]):NaN, rr=ri>=0?tsNum(r[ri]):NaN; const x=ri>=0&&isFinite(rr)?rr:v; if(!isFinite(x)||x===0) continue; trades.push({v:x,day:di>=0?tsDay(r[di]):null}); }
  if(trades.length<5) return {err:`Only ${trades.length} trades found. Add at least 5 (30+ is better).`};
  const W=trades.filter(t=>t.v>0), Lo=trades.filter(t=>t.v<0);
  const avgW=W.length?W.reduce((s,t)=>s+t.v,0)/W.length:0, avgL=Lo.length?Lo.reduce((s,t)=>s-t.v,0)/Lo.length:0;
  const wr=W.length/trades.length, rr=avgL>0?avgW/avgL:avgW>0?99:0;
  const R=avgL>0?trades.map(t=>t.v/avgL):trades.map(t=>t.v>0?rr:-1);
  const days=new Set(trades.map(t=>t.day).filter(Boolean)).size;
  const tpd=days?trades.length/days:null;
  return {trades,wins:W.length,losses:Lo.length,wr,rr,avgW,avgL,tpd,days,R,edge:edgeOf(R),col:ri>=0?"R":"profit"};
}
let TS_IMPORT=null;
try{ const s=JSON.parse(localStorage.getItem("ts-import")||"null"); if(s&&s.R) TS_IMPORT=s; }catch(e){}
function importBoxInit(){
  const box=$("impBox"); if(!box) return;
  const show=r=>{ const o=$("impOut");
    if(!r){ o.innerHTML=""; return; }
    if(r.err){ o.innerHTML=`<p class="imp-err">${esc(r.err)}</p>`; return; }
    const e=r.edge, cls=e.state==="proven"?"good":e.state==="none"?"bad":"warn";
    o.innerHTML=`<div class="imp-stats"><span><b>${r.trades.length}</b>trades</span><span><b>${Math.round(r.wr*100)}%</b>win rate</span><span><b>1 : ${r.rr.toFixed(1)}</b>reward</span><span><b>${r.tpd?r.tpd.toFixed(1):"—"}</b>a day</span></div>
      <div class="verdict ${cls}"><span class="ic">${cls==="good"?"✓":"!"}</span><div><b>${EDGE_TXT[e.state]}</b><p>${edgeLine(e)}</p></div></div>
      <button type="button" class="btn gold sm" id="impUse">Use these numbers <span class="arr">→</span></button>`;
    $("impUse").onclick=()=>{ $("wr").value=Math.max(5,Math.min(90,Math.round(r.wr*100))); $("rr").value=Math.max(0.5,Math.min(10,Math.round(r.rr*10)/10));
      if(r.tpd) $("tpd").value=Math.max(1,Math.min(5,Math.round(r.tpd)));
      TS_IMPORT={n:r.trades.length,wr:r.wr,rr:r.rr,tpd:r.tpd,R:r.R,edge:r.edge,at:todayStr()}; try{localStorage.setItem("ts-import",JSON.stringify(TS_IMPORT));}catch(e){}
      $("f").dispatchEvent(new Event("input",{bubbles:true})); box.open=false; };
  };
  $("impRead").onclick=()=>show(parseTrades($("impText").value));
  $("impFile").onchange=ev=>{ const f=ev.target.files&&ev.target.files[0]; if(!f) return; const rd=new FileReader(); rd.onload=()=>{ $("impText").value=String(rd.result).slice(0,400000); show(parseTrades(rd.result)); }; rd.readAsText(f); };
  if(TS_IMPORT) $("impNote").textContent=`Using ${TS_IMPORT.n} real trades (${Math.round(TS_IMPORT.wr*100)}% · 1 : ${TS_IMPORT.rr.toFixed(1)}).`;
}
