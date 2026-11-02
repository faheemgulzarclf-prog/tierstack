/* ---------- firm rules controller ---------- */
let currentFirm=null, samplePromise=null;
function getSample(){ if(!samplePromise) samplePromise=(window.claude&&window.claude.use)?window.claude.use("sample").catch(()=>null):Promise.resolve(null); return samplePromise; }
const RULE_TOPICS="Price, Phase 1 goal, Phase 2 goal, Daily loss limit, Total loss limit, Minimum days, Time limit, Your share, Payouts, News trading, Weekends, Robots (EAs), Copy trading, Consistency rule, Inactivity, Fee refund, Growing your account";
function aiPrompt(name,text){
  return `You explain prop trading firm rules to complete beginners, in words a 10-year-old understands.
${text?`Use ONLY the rules text below, copied from the firm's website. If a topic is not in the text, use value "Not stated".`:`Use what you know about this firm. If you are not sure about a rule, use value "Not sure" and say "Check the firm's website" in the sentence.`}
Firm: ${name}
Reply with only one JSON object, no other text:
{"name":string,"program":string (the 2-step program these rules describe, or ""),
"plan":{"p1t":number|null,"p2t":number|null,"daily":number|null,"maxdd":number|null,"mindays":number|null,"split":number|null} (percent numbers, e.g. 8 for 8%),
"rules":[[topic,value,sentence,tag]] one entry per topic in this order: ${RULE_TOPICS}. value is short (e.g. "+8%", "5%", "None"). sentence is one plain sentence with an example on a $100K account where it helps. tag is "danger" if breaking it ends the account, "warn" if it can cost money, "good" if it helps the trader, else "info".
"traps":[3 short sentences about the easiest rules to break],
"fit":[["yes"|"no"|"check", sentence]] for exactly these 3 checks: copying the same trade across your own accounts; holding trades over the weekend on a funded account; owning many accounts at once (total capital limit)}
${text?`\nRULES TEXT:\n"""\n${text.slice(0,30000)}\n"""`:""}`;
}
function cleanAI(o,name){
  if(!o||typeof o!=="object") throw new Error("Unexpected answer");
  const str=v=>typeof v==="string"?v.slice(0,400):"";
  const num=v=>typeof v==="number"&&isFinite(v)&&v>0&&v<=100?v:null;
  const p=o.plan||{};
  const tags=["danger","warn","good","info"];
  return {name:str(o.name)||name,program:str(o.program),plan:{p1t:num(p.p1t),p2t:num(p.p2t),daily:num(p.daily),maxdd:num(p.maxdd),mindays:typeof p.mindays==="number"&&p.mindays>=0&&p.mindays<60?Math.round(p.mindays):null,split:num(p.split),fees:{}},
    rules:(Array.isArray(o.rules)?o.rules:[]).slice(0,26).filter(r=>Array.isArray(r)&&r.length>=3).map(r=>[str(r[0]),str(r[1]),str(r[2]),tags.includes(r[3])?r[3]:"info"]),
    traps:(Array.isArray(o.traps)?o.traps:[]).slice(0,5).map(str).filter(Boolean),
    fit:(Array.isArray(o.fit)?o.fit:[]).slice(0,5).filter(f=>Array.isArray(f)).map(f=>[["yes","no","check"].includes(f[0])?f[0]:"check",str(f[1])]),
    sources:[]};
}
const FREE_FIRMS=3;
function firmLocked(F){ return document.body.classList.contains("ts-locked")&&(!F||FIRMS.indexOf(F)>=FREE_FIRMS); }
function premFirmHtml(name){ return `<div class="fx prem-firm"><span class="prem-chip">Premium</span><h2 style="font-size:clamp(24px,3vw,34px)">${esc(name)} rules are a Premium feature</h2><p>Free accounts see ${FIRMS.slice(0,FREE_FIRMS).map(f=>esc(f.name)).join(", ")}. Unlock Premium for every firm, weekly rule checks and one tap to use any firm in your plan.</p><div class="fx-cta"><button type="button" class="btn gold" data-signup="up" data-gate="premium">Unlock Premium <span class="arr">→</span></button></div><span class="prem-fine">Free during launch. No card needed.</span></div>`; }
function showFirm(F,opts){
  currentFirm=F; const o=$("firmOut");
  if(firmLocked(F)){ o.innerHTML=premFirmHtml(F.name); o.classList.remove("fanim"); void o.offsetWidth; o.classList.add("fanim"); return; }
  o.innerHTML=firmHtml(F,opts); o.classList.remove("fanim"); void o.offsetWidth; o.classList.add("fanim");
  $("useFirm").addEventListener("click",()=>useFirm(F));
}
function useFirm(F){
  const p=F.plan||{}; const set=(id,v)=>{ if(v!=null&&isFinite(v)) $(id).value=v; };
  set("p1t",p.p1t); set("p2t",p.p2t); set("maxdd",p.maxdd); set("mindays",p.mindays); set("split",p.split); set("daily",p.daily);
  if(p.maxdd!=null){ const c1=parseFloat($("c1").value); if(c1>=p.maxdd) $("c1").value=Math.max(1,p.maxdd-2); ["c2","c3"].forEach(id=>{ if(parseFloat($(id).value)>=p.maxdd) $(id).value=Math.max(1,p.maxdd-4); }); }
  if(p.fees) Object.entries(p.fees).forEach(([k,v])=>{ feeMemo[k]=Math.round(v); });
  const s0=parseFloat($("s0").value); if(p.fees&&!p.fees[s0]){ const sizes=Object.keys(p.fees).map(Number); if(sizes.includes(25000)) $("s0").value=25000; }
  sizeOptions(); renderLadder(); if(RISK_LV[$("risklvl").value]) applyLevel($("risklvl").value); else riskUI();
  try{ sessionStorage.setItem("ts-firm",F.name); }catch(e){}
  firmApplied=F.name+(F.program?" "+F.program:"");
  location.hash="build"; schedule();
}
let firmApplied=null;
function unknownFirm(name){
  currentFirm=null;
  const o=$("firmOut");
  if(firmLocked(null)){ o.innerHTML=premFirmHtml(name); return; }
  if(!(window.claude&&window.claude.use)){ o.innerHTML=`<div class="fx unk"><span class="kicker">Not checked yet</span><h2 style="font-size:clamp(24px,3vw,32px)">We haven't checked ${esc(name)} yet</h2>
    <p class="sub2" style="margin-top:0">Right now TierStack has hand-checked rules for ${FIRMS.map(f=>esc(f.name)).join(", ")}. Pick one above. Until we add ${esc(name)}, read its rules page and type its numbers into More settings on your plan.</p></div>`; return; }
  o.innerHTML=`<div class="fx unk"><span class="kicker">New firm</span><h2 style="font-size:clamp(24px,3vw,32px)">We haven't checked ${esc(name)} yet</h2>
    <p class="sub2" style="margin-top:0">Copy the text from ${esc(name)}'s rules page, paste it below, and get the rules in simple words in a few seconds.</p>
    <textarea id="pasteRules" placeholder="Paste ${esc(name)}'s rules here"></textarea>
    <div class="fx-cta"><button type="button" class="btn gold" id="btnPaste">Make it simple</button><button type="button" class="linkbtn" id="btnAsk">No text? Explain ${esc(name)} from memory</button></div>
    <p class="err" id="aiErr" hidden></p></div>`;
  getSample().then(sample=>{
    if(!sample){ $("btnPaste").disabled=true; $("btnAsk").disabled=true; const e=$("aiErr"); e.hidden=false; e.textContent="This needs you to be signed in on claude.ai. Meanwhile, pick one of the checked firms above."; return; }
    const go=async(btn,text)=>{
      const label=btn.innerHTML; btn.disabled=true; btn.innerHTML=`<span class="spin"></span> Reading the rules…`; $("aiErr").hidden=true;
      try{
        const res=await sample.json(aiPrompt(name,text),{modelTier:"default"});
        const AF=cleanAI(res,name); AF._ai=true; showFirm(AF,{ai:text?"Simplified from your text":"From memory · may be outdated"});
      }catch(err){ btn.disabled=false; btn.innerHTML=label; const e=$("aiErr"); e.hidden=false;
        e.textContent=err&&err.code==="rate_limited"?"Too many requests right now. Try again in a minute.":err&&err.code==="not_granted"?"Permission to use Claude was declined.":"That didn't work. Try again, or paste the rules text."; }
    };
    $("btnPaste").addEventListener("click",()=>{ const t=$("pasteRules").value.trim(); if(t.length<80){ const e=$("aiErr"); e.hidden=false; e.textContent="Paste the full rules text first (a few sentences at least)."; return; } go($("btnPaste"),t); });
    $("btnAsk").addEventListener("click",()=>go($("btnAsk"),null));
  });
}
function searchFirm(q){
  q=(q||"").trim(); if(!q) return;
  const F=findFirm(q);
  if(F) showFirm(F); else unknownFirm(q.slice(0,60));
}
function renderChips(){ $("firmChips").innerHTML=FIRMS.map(f=>`<button type="button" data-f="${esc(f.id)}"${firmLocked(f)?' class="lkd"':""}>${esc(f.name)}${firmLocked(f)?'<i class="lk" aria-label="Premium"></i>':""}</button>`).join(""); const u=$("firmFresh"); if(u) u.textContent=firmsUpdated?`Rules auto-checked weekly · last check ${firmsUpdated}`:`Rules checked ${FIRMS[0].checked} · auto-checked weekly`; }
renderChips();
$("firmChips").addEventListener("click",e=>{ const b=e.target.closest("button"); if(!b) return; const F=FIRMS.find(f=>f.id===b.dataset.f); if(!F) return; $("firmQ").value=F.name; showFirm(F); });
$("firmForm").addEventListener("submit",e=>{ e.preventDefault(); searchFirm($("firmQ").value); });
document.querySelectorAll('form.fsearch[data-go="rules"]').forEach(f=>f.addEventListener("submit",e=>{ e.preventDefault(); const q=f.querySelector("input").value; $("firmQ").value=q; location.hash="rules"; setTimeout(()=>searchFirm(q),60); }));
$("firmQ").value=FIRMS[0].name; showFirm(FIRMS[0]);
loadLiveFirms(()=>{ renderChips(); if(currentFirm&&!currentFirm._ai){ const F=FIRMS.find(f=>f.id===currentFirm.id); if(F) showFirm(F); } });

if(window.TSAuth) window.TSAuth.onChange(()=>{ renderChips(); if(currentFirm) showFirm(currentFirm); });
if(window.TSAuth&&window.TSAuthReady&&window.TSAuth.sb) window.TSAuthReady.then(()=>{ document.body.classList.toggle("ts-locked",!window.TSAuth.user); renderChips(); if(currentFirm) showFirm(currentFirm); });
