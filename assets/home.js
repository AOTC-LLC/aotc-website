/* AOTC homepage behaviour: the live adsofthecentury.net homepage scripts, in page order, with fixes noted inline. */

/* ---- 01-script ---- */
(function(){
  var KEY="aotc_cookie_consent";
  var el=document.getElementById("aotc-cookie");
  function saved(){try{return JSON.parse(localStorage.getItem(KEY)||"null");}catch(e){return null;}}
  function store(v){try{localStorage.setItem(KEY,JSON.stringify(Object.assign({t:Date.now()},v)));}catch(e){}}
  function apply(c){window.AOTC_CONSENT=c;window.dispatchEvent(new CustomEvent("aotc-consent",{detail:c}));}
  function notify(){ /* choices stay on this device */ }
  function render(){
    el.innerHTML=''+
      '<div class="ck-wrap">'+
        '<div class="ck-copy"><b>We use cookies.</b>AOTC uses strictly necessary cookies to run this site, and — only with your consent — analytics and marketing cookies. See our <a href="disclosures.html#cookies">Disclosures</a>.</div>'+
        '<div class="ck-btns">'+
          '<button class="ck-btn ghost" data-act="prefs" type="button">Preferences</button>'+
          '<button class="ck-btn ghost" data-act="reject" type="button">Reject non-essential</button>'+
          '<button class="ck-btn primary" data-act="accept" type="button">Accept all</button>'+
        '</div>'+
        '<div class="ck-prefs">'+
          '<div class="ck-row"><input type="checkbox" checked disabled /><span><b>Strictly necessary</b>Required for the site to function. Always on.</span></div>'+
          '<div class="ck-row"><input type="checkbox" id="ck-analytics" /><span><b>Analytics</b>Help us understand usage.</span></div>'+
          '<div class="ck-row"><input type="checkbox" id="ck-marketing" /><span><b>Marketing</b>Support advertising and retargeting.</span></div>'+
          '<div class="ck-btns" style="margin-top:8px"><button class="ck-btn primary" data-act="save" type="button">Save choices</button></div>'+
        '</div>'+
      '</div>';
    el.querySelectorAll("[data-act]").forEach(function(b){
      b.addEventListener("click",function(){
        var a=b.getAttribute("data-act");
        if(a==="accept"){store({necessary:true,analytics:true,marketing:true});apply({necessary:true,analytics:true,marketing:true});notify("Accept all",{analytics:true,marketing:true});hide();}
        else if(a==="reject"){store({necessary:true,analytics:false,marketing:false});apply({necessary:true,analytics:false,marketing:false});notify("Reject non-essential",{analytics:false,marketing:false});hide();}
        else if(a==="prefs"){el.classList.add("prefs-open");}
        else if(a==="save"){var an=document.getElementById("ck-analytics").checked,mk=document.getElementById("ck-marketing").checked;store({necessary:true,analytics:an,marketing:mk});apply({necessary:true,analytics:an,marketing:mk});notify("Saved preferences",{analytics:an,marketing:mk});hide();}
      });
    });
  }
  function show(){el.classList.add("show");}
  function hide(){el.classList.remove("show","prefs-open");}
  window.AOTC_openCookiePrefs=function(){render();show();el.classList.add("prefs-open");var s=saved();if(s){var a=document.getElementById("ck-analytics"),m=document.getElementById("ck-marketing");if(a)a.checked=!!s.analytics;if(m)m.checked=!!s.marketing;}};
  var s=saved();
  if(s){apply(s);}else{render();show();}
})();

/* (03 the docked booking form, 06 its sizing and 07 the old hero video were removed: every booking button opens the pop-up form in assets/site.js) */

/* ---- 09-script ---- */
(function(){
  function load(v){
    /* phones get the 640-wide copy (data-src-small); data-saver and less-motion visitors keep the still poster */
    if((navigator.connection && navigator.connection.saveData) || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    var src = (v.dataset.srcSmall && window.matchMedia && matchMedia('(max-width: 900px)').matches) ? v.dataset.srcSmall : v.dataset.src;
    if(src && !v.getAttribute('src')){ v.setAttribute('src', src); v.load(); }
    v.muted = true;
    var p = v.play(); if(p && p.catch) p.catch(function(){});
  }
  function init(){
    var vids = [].slice.call(document.querySelectorAll('video[data-src]'));
    if(!vids.length) return;
    if(!('IntersectionObserver' in window)){ vids.forEach(load); return; }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(e){
        if(e.isIntersecting) load(e.target);
        else if(e.target.getAttribute('src')){ try{ e.target.pause(); }catch(err){} }
      });
    }, {rootMargin:'300px 0px'});
    vids.forEach(function(v){ io.observe(v); });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

/* ---- 11-aotc-internal-booking-form-gate-the ---- */
/* AOTC — internal booking-form gate.
   The booking form is a sales tool, not a public page: it is not in the nav.
   To open it: double-click the AOTC logo, then enter the passphrase.
   Access is per-page-load only — leaving or reloading the page re-locks it. */
(function () {
  var PASS_H = "4dcab0d82ccb503fea0f6f7a4d63440981cf2755d9fba55733489e8c8091fdf5";
  function sha(s){ if(!(window.crypto&&crypto.subtle&&window.TextEncoder)) return Promise.resolve(""); return crypto.subtle.digest("SHA-256",new TextEncoder().encode(s)).then(function(b){return Array.prototype.map.call(new Uint8Array(b),function(x){return ("0"+x.toString(16)).slice(-2);}).join("");}); }
  var DEST = "book.html";
  var clicks = 0, timer = null, box = null;

  /* book.html itself: refuse to render unless this load was granted a token */
  if (/book\.html(\?|#|$)/i.test(location.pathname + location.search + location.hash)) {
    var ok = false;
    try { ok = sessionStorage.getItem("aotc_gate_once") === "1"; } catch (e) {}
    if (ok) { try { sessionStorage.removeItem("aotc_gate_once"); } catch (e) {} }
    else { location.replace("index.html"); return; }
  }

  function css() {
    if (document.getElementById("aotcGateCss")) return;
    var s = document.createElement("style");
    s.id = "aotcGateCss";
    s.textContent =
      ".gate-scrim{position:fixed;inset:0;z-index:2147483200;display:flex;align-items:center;justify-content:center;padding:20px;" +
        "background:rgba(4,4,6,.9);backdrop-filter:blur(8px);opacity:0;transition:opacity .25s ease}" +
      ".gate-scrim.on{opacity:1}" +
      ".gate{width:min(380px,100%);background:linear-gradient(168deg,#15131a,#0b0a0d);border:1px solid rgba(255,255,255,.14);" +
        "border-radius:4px;box-shadow:0 30px 90px rgba(0,0,0,.8);padding:26px;font-family:'Barlow',system-ui,sans-serif;" +
        "transform:translateY(14px) scale(.98);transition:transform .3s cubic-bezier(.2,.8,.25,1)}" +
      ".gate-scrim.on .gate{transform:none}" +
      ".gate p.k{font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.26em;text-transform:uppercase;color:#ff3b48;margin:0 0 12px}" +
      ".gate h4{font-family:'Barlow Condensed',Impact,sans-serif;font-weight:800;text-transform:uppercase;font-size:23px;" +
        "letter-spacing:.02em;color:#fff;margin:0 0 6px;line-height:1}" +
      ".gate p.s{font-size:12.5px;line-height:1.5;color:#8b847a;margin:0 0 18px}" +
      ".gate input{width:100%;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.14);border-radius:3px;color:#fff;" +
        "padding:13px 14px;font:inherit;font-size:15px;letter-spacing:.12em;box-sizing:border-box}" +
      ".gate input:focus{outline:0;border-color:rgba(255,21,32,.7);background:rgba(255,255,255,.09)}" +
      ".gate input.bad{border-color:#ff1520;animation:gshake .32s}" +
      "@keyframes gshake{25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}" +
      ".gate-row{display:flex;gap:9px;margin-top:14px}" +
      ".gate-row button{flex:1;font-family:'Barlow Condensed',Impact,sans-serif;font-weight:800;text-transform:uppercase;" +
        "letter-spacing:.05em;font-size:15px;padding:13px;border:0;border-radius:3px;cursor:pointer;color:#fff;" +
        "background:linear-gradient(#ff1520,#b30009)}" +
      ".gate-row button.g{background:transparent;border:1px solid rgba(255,255,255,.2);color:#b8b2a8;flex:0 0 auto;padding:13px 18px}" +
      ".gate small{display:block;margin-top:14px;font-family:'IBM Plex Mono',monospace;font-size:9px;letter-spacing:.14em;" +
        "text-transform:uppercase;color:#6f6a62;line-height:1.7}";
    document.head.appendChild(s);
  }

  function prompt() {
    if (box) return;
    css();
    box = document.createElement("div");
    box.className = "gate-scrim";
    box.innerHTML =
      '<div class="gate" role="dialog" aria-modal="true" aria-label="Internal access">' +
        '<p class="k">AOTC internal</p>' +
        '<h4>Sales console</h4>' +
        '<p class="s">Booking form access. Staff only.</p>' +
        '<input type="password" id="gatePass" placeholder="Passphrase" autocomplete="off" autocapitalize="off" spellcheck="false" />' +
        '<div class="gate-row"><button type="button" id="gateGo">Unlock</button>' +
        '<button type="button" class="g" id="gateNo">Cancel</button></div>' +
        '<small>Access expires when this page is closed</small>' +
      '</div>';
    document.body.appendChild(box);
    void box.offsetWidth;
    box.classList.add("on");

    var inp = box.querySelector("#gatePass");
    setTimeout(function () { try { inp.focus(); } catch (e) {} }, 260);

    function bail() {
      if (!box) return;
      box.classList.remove("on");
      var b = box; box = null;
      setTimeout(function () { b.remove(); }, 260);
    }
    function tryIt() {
      sha(inp.value.trim()).then(function (h) {
        if (h === PASS_H) { try { sessionStorage.setItem("aotc_gate_once", "1"); } catch (e) {} window.location.href = "/" + DEST; }
        else { inp.classList.remove("bad"); void inp.offsetWidth; inp.classList.add("bad"); inp.select(); }
      });
    }
    box.querySelector("#gateGo").addEventListener("click", tryIt);
    box.querySelector("#gateNo").addEventListener("click", bail);
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); tryIt(); }
      if (e.key === "Escape") bail();
    });
    box.addEventListener("click", function (e) { if (e.target === box) bail(); });
  }

  /* two clicks on the logo inside 700ms */
  function arm() {
    var logo = document.querySelector(".brand");
    if (!logo) return;
    logo.addEventListener("click", function (e) {
      clicks++;
      if (clicks === 1) {
        timer = setTimeout(function () { clicks = 0; }, 700);
        return;   /* first click still navigates home as normal */
      }
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(timer);
      clicks = 0;
      prompt();
    });
  }

  window.AOTCStaffGate = prompt;   /* the logo's clicks are counted in assets/logo.js */
})();

/* ---- 12: the menu is wired by assets/site.js on every page ---- */
