/* TierStack accounts (site only): Supabase email signup + cloud save of the daily coach.
   The anon key is public by design; Row Level Security keeps each trader's rows private. */
(function(){
  var SB_URL="https://zsumgnfmbttrahzyjtkd.supabase.co";
  var SB_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzdW1nbmZtYnR0cmFoenlqdGtkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MTczMDcsImV4cCI6MjEwOTE5MzMwN30.CUsSZwwppJ_q4UjX3xVLTZw9JNbkFwemmNvNeHcwG58";
  var A=window.TSAuth={sb:null,user:null,name:"",status:"",admin:false,ok:false,listeners:[]};
  A.onChange=function(f){A.listeners.push(f)};
  function emit(){A.listeners.forEach(function(f){try{f(A.user)}catch(e){}});paint();
    if(A.ok&&A.wanted){var w=A.wanted;A.wanted=null;location.hash=w;}
    else if(!A.ok&&location.hash&&!/^#(home|build|rules)?$/.test(location.hash)){location.hash="home";}}
  if(!window.supabase||!window.supabase.createClient){window.TSAuthReady=Promise.resolve(null);return;}
  A.sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storageKey:"ts-auth"}});
  function setUser(u){A.user=u||null;A.name=u&&u.user_metadata&&u.user_metadata.name||"";if(!A.user){A.status="";A.admin=false;A.ok=false;}}
  A.loadProfile=async function(){if(!A.user){A.ok=false;return;}try{var r=await A.sb.from("profiles").select("name,status,is_admin").eq("id",A.user.id).maybeSingle();
    if(r.data){A.status=r.data.status||"pending";A.admin=!!r.data.is_admin;if(r.data.name)A.name=r.data.name;}else{A.status="pending";A.admin=false;}}catch(e){A.status=A.status||"pending";}
    A.ok=A.admin||A.status==="approved";};
  window.TSAuthReady=A.sb.auth.getSession().then(async function(r){setUser(r.data&&r.data.session&&r.data.session.user);await A.loadProfile();return A.user;}).catch(function(){return null;}).then(function(u){A.ready=true;if(A.after){var f=A.after;A.after=null;setTimeout(f,0);}return u;});
  var first=true;
  A.sb.auth.onAuthStateChange(function(ev,session){var before=A.user&&A.user.id;setUser(session&&session.user);
    if(first){first=false;paint();return;}
    if((A.user&&A.user.id)!==before||ev==="SIGNED_OUT"){setTimeout(async function(){await A.loadProfile();emit();var d=$("authDlg");if(A.user&&d&&d.open){if(A.ok)close();else acct();}},0);}else paint();});
  /* a pending member who comes back to the tab: check if they were approved */
  document.addEventListener("visibilitychange",async function(){if(document.visibilityState!=="visible"||!A.user||A.ok)return;await A.loadProfile();if(A.ok)emit();});

  /* cloud store used by the tracker */
  A.store=function(){var uid=A.user.id,sb=A.sb;return{kind:"cloud",
    load:async function(){var r=await sb.from("trackers").select("data").eq("user_id",uid).maybeSingle();if(r.error)throw r.error;return r.data?r.data.data:null;},
    save:async function(o){var r;if(o===null){r=await sb.from("trackers").delete().eq("user_id",uid);}else{r=await sb.from("trackers").upsert({user_id:uid,data:o,updated_at:new Date().toISOString()});
      if(o&&o.remind){sb.from("profiles").update({remind_time:o.remind,tz:tz()}).eq("id",uid).then(function(){});}}
      if(r.error)throw r.error;}};};
  function tz(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(e){return ""}}

  /* UI */
  function $(id){return document.getElementById(id)}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return{"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]})}
  function initials(){var n=(A.name||A.user&&A.user.email||"?").trim();var p=n.split(/\s+/);return((p[0]||"?")[0]+(p[1]?p[1][0]:"")).toUpperCase();}
  function paint(){document.body&&document.body.classList.toggle("ts-locked",!A.ok);var b=$("acctBtn");if(!b)return;b.hidden=false;
    if(A.user){b.classList.add("au-in");b.innerHTML='<span class="au-av">'+esc(initials())+'</span><span class="au-nm">'+esc((A.name||"Account").split(" ")[0])+'</span>';b.setAttribute("aria-label","Your account");}
    else{b.classList.remove("au-in");b.textContent="Sign in";b.setAttribute("aria-label","Sign in or create an account");}}
  var mode="up";
  function view(m,msg,bad){mode=m;var d=$("authDlg");if(!d)return;var f=$("authForm");
    d.querySelectorAll("[data-am]").forEach(function(t){t.classList.toggle("on",t.dataset.am===m)});
    $("auName").parentElement.hidden=m!=="up";$("auPass").parentElement.hidden=m==="reset";$("auEmail").parentElement.hidden=m==="new";
    $("auTitle").textContent=m==="up"?"Create your free account":m==="in"?"Welcome back":m==="new"?"Set a new password":"Reset your password";
    $("auSub").textContent=m==="up"?"Your plan and coach are saved to your account, on every device.":m==="in"?"Sign in to load your coach on this device.":m==="new"?"Type a new password with 6 or more characters.":"We'll email you a link to set a new password.";
    $("auGo").textContent=m==="up"?"Create account":m==="in"?"Sign in":m==="new"?"Save password":"Send reset link";
    $("auPass").setAttribute("autocomplete",m==="in"?"current-password":"new-password");
    $("auForgot").hidden=m!=="in";$("auPerks").hidden=m!=="up";$("auTabs").hidden=m==="reset"||m==="new";
    var e=$("auMsg");e.textContent=msg||"";e.className="au-msg"+(bad?" bad":msg?" ok":"");f.hidden=false;$("auAcct").hidden=true;}
  function acct(){var d=$("authDlg");$("authForm").hidden=true;$("auTabs").hidden=true;$("auPerks").hidden=true;var a=$("auAcct");a.hidden=false;
    $("auTitle").textContent=A.ok?"Hi "+(A.name||"trader").split(" ")[0]:A.status==="rejected"?"Request not approved":"You're on the list";
    $("auSub").textContent=A.ok?"Premium is unlocked. Your coach is saved to your account.":A.status==="rejected"?"Your Premium request was not approved. Reply to us if you think this is a mistake.":"Thanks "+(A.name||"").split(" ")[0]+"! Your Premium request is waiting for approval. You'll get full access as soon as it's approved.";
    var st=A.admin?"Admin":A.ok?"Premium":A.status==="rejected"?"Not approved":"Waiting for approval";
    a.innerHTML='<div class="au-row"><span>Name</span><b>'+esc(A.name||"-")+'</b></div><div class="au-row"><span>Email</span><b>'+esc(A.user.email)+'</b></div><div class="au-row"><span>Status</span><b class="au-st '+(A.ok?"ok":A.status)+'">'+st+'</b></div>'+(A.ok?'<a class="btn gold" href="#track" data-nav="track" id="auCoach">Open my coach</a>':'<button type="button" class="btn ghost" id="auRecheck">Check again</button>')+(A.admin?'<a class="btn ghost" href="#admin" id="auAdmin">Admin panel</a>':'')+'<button type="button" class="btn ghost" id="auOut">Sign out</button>';
    $("auMsg").textContent="";}
  function open(m,gate){var d=$("authDlg");if(!d)return;if(A.user&&m!=="new")acct();else{view(m||"up");if(gate)$("auSub").textContent=gate==="premium"?"Premium is free during launch. Make an account to unlock your full plan and daily coach.":"Premium is free during launch. Make an account to open your daily coach and firm rules.";if(gate)$("auTitle").textContent="Unlock TierStack Premium";}document.querySelectorAll("video").forEach(function(v){if(!v.paused){v.pause();v.dataset.auP="1";}});if(!d._cl){d._cl=1;d.addEventListener("close",function(){document.querySelectorAll("video[data-au-p]").forEach(function(v){delete v.dataset.auP;v.play().catch(function(){});});});}
    if(d.showModal&&!d.open)d.showModal();else d.setAttribute("open","");setTimeout(function(){var f=d.querySelector(".au-f:not([hidden]) input");if(f&&!A.user)f.focus();else{var b=d.querySelector(".au-acct .btn");if(b)b.focus();}},30);}
  function close(){var d=$("authDlg");if(d&&d.open){if(d.close)d.close();else d.removeAttribute("open");}}
  A.open=open;
  function friendly(err){var m=(err&&err.message)||"Something went wrong.";
    if(/Invalid login/i.test(m))return"Email or password is wrong.";
    if(/already registered/i.test(m))return"This email already has an account. Sign in instead.";
    if(/Password should be/i.test(m))return"Use a password with at least 6 characters.";
    if(/rate limit/i.test(m))return"Too many tries. Wait a few minutes and try again.";
    if(/Email not confirmed/i.test(m))return"Open the link in your email first, then sign in.";
    if(/Failed to fetch|NetworkError/i.test(m))return"No connection. Check your internet and try again.";
    return m;}
  async function submit(e){e.preventDefault();var go=$("auGo"),em=$("auEmail").value.trim(),pw=$("auPass").value,nm=$("auName").value.trim();
    if(mode==="new"){if(pw.length<6)return view(mode,"Use a password with at least 6 characters.",true);go.disabled=true;var u=await A.sb.auth.updateUser({password:pw});go.disabled=false;if(u.error)return view(mode,friendly(u.error),true);$("auPass").value="";return acct();}
    if(!em||!/@/.test(em))return view(mode,"Type your email.",true);
    if(mode==="up"&&!nm)return view(mode,"Type your name.",true);
    if(mode!=="reset"&&pw.length<6)return view(mode,"Use a password with at least 6 characters.",true);
    go.disabled=true;var back=location.href.split("#")[0];
    try{var r;
      if(mode==="up"){r=await A.sb.auth.signUp({email:em,password:pw,options:{data:{name:nm,tz:tz()},emailRedirectTo:back+"#track"}});if(r.error)throw r.error;
        if(!r.data.session){view("in","Almost done. Open the link we sent to "+em+", then sign in.");go.disabled=false;return;}}
      else if(mode==="in"){r=await A.sb.auth.signInWithPassword({email:em,password:pw});if(r.error)throw r.error;}
      else{r=await A.sb.auth.resetPasswordForEmail(em,{redirectTo:back+"#track"});if(r.error)throw r.error;view("in","Check your email for the reset link.");go.disabled=false;return;}
      $("auPass").value="";
    }catch(err){view(mode,friendly(err),true);}
    go.disabled=false;}
  document.addEventListener("click",function(e){var t=e.target.closest&&e.target.closest("#acctBtn,[data-am],#auForgot,#auOut,#auX,#auCoach,#auAdmin,#auRecheck,[data-signup]");if(!t)return;
    if(t.id==="acctBtn"||t.hasAttribute("data-signup")){e.preventDefault();open(t.getAttribute("data-signup")||"up",t.getAttribute("data-gate"));}
    else if(t.dataset.am)view(t.dataset.am);
    else if(t.id==="auForgot")view("reset");
    else if(t.id==="auX"||t.id==="auCoach"||t.id==="auAdmin")close();
    else if(t.id==="auRecheck"){t.disabled=true;A.loadProfile().then(function(){if(A.ok){emit();}acct();});}
    else if(t.id==="auOut"){A.sb.auth.signOut().then(close);}});
  document.addEventListener("submit",function(e){if(e.target.id==="authForm")submit(e);});
  /* password recovery link: let them type a new password */
  A.sb.auth.onAuthStateChange(function(ev){if(ev==="PASSWORD_RECOVERY"){setTimeout(function(){var d=$("authDlg");view("new");if(d&&d.showModal&&!d.open)d.showModal();},300);}});

  /* hidden admin panel (#admin): only renders for is_admin profiles; RLS + set_member_status() enforce it server side */
  var adTab="pending";
  A.renderAdmin=async function(){var o=$("adminOut");if(!o)return;if(!A.admin){o.innerHTML="";return;}
    o.innerHTML='<div class="ad-load">Loading members…</div>';
    var r=await A.sb.from("profiles").select("id,name,email,status,is_admin,created_at,decided_at").order("created_at",{ascending:false});
    if(r.error){o.innerHTML='<div class="card"><p>Could not load members: '+esc(r.error.message)+'</p></div>';return;}
    var all=r.data||[],c={pending:0,approved:0,rejected:0};all.forEach(function(m){c[m.status]=(c[m.status]||0)+1;});
    var list=all.filter(function(m){return m.status===adTab;});
    function d(x){return x?new Date(x).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}):"";}
    o.innerHTML='<div class="ad-stats"><div><b>'+all.length+'</b><span>members</span></div><div><b>'+c.pending+'</b><span>waiting</span></div><div><b>'+c.approved+'</b><span>approved</span></div><div><b>'+c.rejected+'</b><span>rejected</span></div></div>'+
      '<div class="ad-tabs">'+["pending","approved","rejected"].map(function(k){return '<button type="button" data-adtab="'+k+'"'+(k===adTab?' class="on"':'')+'>'+({pending:"Waiting",approved:"Approved",rejected:"Rejected"})[k]+' <i>'+c[k]+'</i></button>';}).join("")+'<button type="button" class="ad-ref" data-adref="1">Refresh</button></div>'+
      (list.length?'<div class="ad-list">'+list.map(function(m){return '<div class="ad-row"><div class="ad-av">'+esc(((m.name||m.email||"?").trim()[0]||"?").toUpperCase())+'</div><div class="ad-who"><b>'+esc(m.name||"(no name)")+(m.is_admin?' <span class="ad-badge">Admin</span>':'')+'</b><span>'+esc(m.email||"")+'</span><span class="ad-date">Joined '+d(m.created_at)+(m.decided_at?' · decided '+d(m.decided_at):'')+'</span></div><div class="ad-act">'+
        (m.is_admin?'':(m.status!=="approved"?'<button type="button" class="btn gold sm" data-adset="approved" data-uid="'+m.id+'">Approve</button>':'')+(m.status!=="rejected"?'<button type="button" class="btn ghost sm" data-adset="rejected" data-uid="'+m.id+'">'+(m.status==="approved"?"Remove access":"Reject")+'</button>':'')+(m.status==="rejected"?'<button type="button" class="btn ghost sm" data-adset="pending" data-uid="'+m.id+'">Move to waiting</button>':''))+'</div></div>';}).join("")+'</div>':'<div class="ad-empty">No one here yet.</div>');};
  document.addEventListener("click",async function(e){var t=e.target.closest&&e.target.closest("[data-adtab],[data-adset],[data-adref]");if(!t||!A.admin)return;
    if(t.dataset.adtab){adTab=t.dataset.adtab;A.renderAdmin();return;}
    if(t.dataset.adref){A.renderAdmin();return;}
    t.disabled=true;var r=await A.sb.rpc("set_member_status",{member:t.dataset.uid,new_status:t.dataset.adset});
    if(r.error){t.disabled=false;t.textContent="Failed: "+r.error.message;return;}A.renderAdmin();});
  if(document.readyState!=="loading")paint();else document.addEventListener("DOMContentLoaded",paint);
})();
