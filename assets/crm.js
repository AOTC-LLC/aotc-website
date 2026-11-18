/* AOTC rep home + call log, in front of the sales console (book.html).
   Sign in (each rep has their own password) -> home: today's calls meter, this week's calendar, who you're working on ->
   Log a call (initial or follow-up) -> Voicemail / Real conversation / No access.
   Voicemail and No access lead to a ready-made email (cc info@); Real conversation opens the console with the client filled in.
   Calls, quotes and calendar events live in the Google Apps Script set in assets/crm-config.js (dev/sales-crm/Code.js).
   On localhost with no script URL (or ?demo=1), dev/sales-crm/mock.js + Code.js run in the browser instead: nothing reaches Google. */
(function () {
  "use strict";
  var doc = document, body = doc.body, me = doc.currentScript;
  var ROOT = me && me.src ? me.src.replace(/assets\/crm\.js(\?.*)?$/, "") : "";
  var API = String(window.AOTC_CRM_URL || "").trim();
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var DEMO = LOCAL && (!API || /[?&]demo=1/.test(location.search));
  var REPS = DEMO ? [{ id: "demo", name: "Jordan Demo" }] : [
    { id: "xavier", name: "Xavier J Alvarez" }, { id: "isaiah", name: "Isaiah Crespo-Doherty" }, { id: "mikell", name: "Mikell Everett" },
    { id: "julio", name: "Julio Trejo" }, { id: "dennis", name: "Dennis Morson" }, { id: "anthony", name: "Anthony Macias" }];
  var INFO = "info@adsofthecentury.net", PHONE = "(773) 708-1400";
  var LEGACY_H = "4dcab0d82ccb503fea0f6f7a4d63440981cf2755d9fba55733489e8c8091fdf5";   /* the old staff passphrase: only used until the call log is connected */
  var SK = { token: "aotc_crm_token", view: "aotc_crm_view", call: "aotc_crm_call", who: "aotc_crm_who" };
  var OUT = { voicemail: "Voicemail", noaccess: "No access", convo: "Real conversation" };
  var host = doc.getElementById("crm");
  if (!host || !window.AOTCConsole) return;

  /* ================= helpers ================= */
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function ss(k, v) { try { if (v === undefined) return sessionStorage.getItem(k); if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { return null; } }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function first(n) { return String(n || "").trim().split(/\s+/)[0] || "there"; }
  function money(n) { return "$" + Math.round(+n || 0).toLocaleString("en-US"); }
  function dayStart(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function monday(d) { var x = dayStart(d), w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function tm(ms) { return new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function dy(ms) { return new Date(ms).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
  function dyLong(ms) { return new Date(ms).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }); }
  function when(ms) { return dy(ms) + " at " + tm(ms); }
  var toastEl, toastT;
  function toast(msg, ms) { if (!toastEl) { toastEl = doc.createElement("div"); toastEl.className = "crm-toast"; toastEl.setAttribute("role", "status"); body.appendChild(toastEl); } toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, ms || 4200); }

  /* ================= talking to the call log ================= */
  var mockReady = null;
  function loadScript(src) { return new Promise(function (ok, no) { var s = doc.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; doc.head.appendChild(s); }); }
  function api(action, data) {
    var req = Object.assign({ action: action, token: state.token || "" }, data || {});
    var p;
    if (DEMO) {
      mockReady = mockReady || loadScript(ROOT + "dev/sales-crm/mock.js").then(function () { return loadScript(ROOT + "dev/sales-crm/Code.js"); });
      p = mockReady.then(function () { return new Promise(function (ok) { setTimeout(function () { ok(JSON.parse(JSON.stringify(window.handle_(req)))); }, 220); }); });
    } else {
      /* text/plain keeps this a simple request: Apps Script answers it with open CORS */
      p = fetch(API, { method: "POST", body: JSON.stringify(req) }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    }
    return p.then(function (j) { if (j && j.signin && action !== "login") { signOut(j.error); throw new Error(j.error); } return j || {}; },
      function (e) { return { ok: false, error: "Couldn’t reach the call log. Check the connection and try again.", net: true }; });
  }

  /* ================= state ================= */
  var state = { token: ss(SK.token), rep: null, home: null, week: monday(new Date()), call: null, flow: null, busy: false };
  try { state.rep = JSON.parse(ss(SK.who) || "null"); } catch (e) {}
  try { state.call = JSON.parse(ss(SK.call) || "null"); } catch (e) {}
  function setView(v) {
    body.setAttribute("data-view", v); ss(SK.view, v);
    $("#crmHomeBtn") && ($("#crmHomeBtn").hidden = !(v === "console" && state.rep));
    if (v === "console") { setTimeout(function () { dispatchEvent(new Event("resize")); }, 30); }
    window.scrollTo(0, 0);
  }

  /* ================= sign in ================= */
  function renderSignin(msg) {
    var pre = (location.search.match(/[?&]rep=([a-z]+)/) || [])[1] || ls("aotc_crm_last") || "";
    var connected = DEMO || !!API;
    host.innerHTML = '<div class="crm-wrap crm-center"><div class="crm-card crm-login">' +
      '<img class="crm-logo" src="' + ROOT + 'aotc_final.gif" alt="AOTC">' +
      "<h1>Sales console</h1>" +
      (connected ? '<p class="crm-sub">Sign in to log your calls and open the console.</p>' +
        '<label class="crm-l" for="crmWho">Who&rsquo;s signing in?</label><select id="crmWho">' + REPS.map(function (r) { return '<option value="' + r.id + '"' + (r.id === pre ? " selected" : "") + ">" + esc(r.name) + "</option>"; }).join("") + "</select>" +
        '<label class="crm-l" for="crmPw">Your password</label><input type="password" id="crmPw" autocomplete="current-password" autocapitalize="off" spellcheck="false">' +
        '<button type="button" class="crm-btn p wide" id="crmGo">Sign in</button>'
        : '<p class="crm-sub">The call log isn&rsquo;t connected yet. Enter the staff passphrase to open the console on its own.</p>' +
        '<label class="crm-l" for="crmPw">Staff passphrase</label><input type="password" id="crmPw" autocomplete="off" autocapitalize="off" spellcheck="false">' +
        '<button type="button" class="crm-btn p wide" id="crmGo">Open the console</button>') +
      '<p class="crm-err" id="crmErr" role="alert">' + esc(msg || "") + "</p>" +
      '<p class="crm-fine">AOTC staff only. <a href="' + ROOT + 'admin.html">AOTC admin data viewer</a></p>' +
      (DEMO ? '<p class="crm-demo">Local demo: sign in as Jordan Demo with the password <b>demo</b>. Nothing here reaches Google.</p>' : "") +
      "</div></div>";
    setView("signin");
    var pw = $("#crmPw"), go = $("#crmGo");
    setTimeout(function () { pw.focus(); }, 60);
    function tryIt() {
      if (state.busy) return;
      var err = $("#crmErr"); err.textContent = "";
      if (!connected) { sha(pw.value.trim()).then(function (h) { if (h === LEGACY_H) { state.rep = null; setView("console"); } else { err.textContent = "That passphrase doesn’t match."; pw.select(); } }); return; }
      if (!pw.value) { err.textContent = "Type your password."; pw.focus(); return; }
      state.busy = true; go.disabled = true; go.textContent = "Signing in…";
      var rep = $("#crmWho").value;
      api("login", { rep: rep, password: pw.value }).then(function (j) {
        state.busy = false; go.disabled = false; go.textContent = "Sign in";
        if (!j.ok) { err.textContent = j.error || "That didn’t work."; pw.select(); return; }
        state.token = j.token; state.rep = j.rep; ss(SK.token, j.token); ss(SK.who, JSON.stringify(j.rep)); ls("aotc_crm_last", rep);
        startHome();
      });
    }
    go.addEventListener("click", tryIt);
    pw.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); tryIt(); } });
  }
  function sha(s) { if (!(window.crypto && crypto.subtle)) return Promise.resolve(""); return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); }); }
  function signOut(msg) {
    closeModal(); state.busy = false;
    state.token = null; state.rep = null; state.home = null; state.call = null;
    ss(SK.token, null); ss(SK.who, null); ss(SK.call, null);
    renderSignin(msg);
  }

  /* ================= home ================= */
  function startHome() {
    window.AOTCConsole.rep(state.rep.name);
    renderHomeShell(); setView("home"); refresh();
  }
  function refresh() {
    var ws = state.week, we = addDays(ws, 7), t0 = dayStart(new Date());
    return api("home", { weekStart: ws.getTime(), weekEnd: we.getTime(), dayStart: t0.getTime(), dayEnd: addDays(t0, 1).getTime() }).then(function (j) {
      if (!j.ok) { toast(j.error || "Couldn’t load your home."); return; }
      state.home = j; paintHome();
    });
  }
  function renderHomeShell() {
    var r = state.rep;
    host.innerHTML = '<div class="crm-wrap">' +
      '<header class="crm-top"><a class="crm-brand" href="' + ROOT + 'index.html" data-site-logo><img src="' + ROOT + 'aotc_final.gif" alt="AOTC"><span><b>' + esc(r.name) + "</b><small>OOH-Vantage Strategist &middot; AOTC</small></span></a>" +
      '<div class="crm-top-r">' + (DEMO ? '<span class="crm-pill demo">Local demo</span>' : "") + '<button type="button" class="crm-btn ghost" id="crmOut">Sign out</button></div></header>' +
      '<section class="crm-hero">' +
      '<div class="crm-card crm-goal" id="crmGoal"></div>' +
      '<div class="crm-acts"><button type="button" class="crm-btn p big" id="crmLog"><span>+</span> Log a call</button>' +
      '<button type="button" class="crm-btn" id="crmInbound">Someone called us? Open the console</button></div></section>' +
      '<section class="crm-card crm-week"><div class="crm-week-h"><div><h2>Your week</h2><p class="crm-sub">Your calls, follow-ups and quotes. They&rsquo;re on the AOTC Google Calendar too.</p></div>' +
      '<div class="crm-nav"><button type="button" class="crm-btn ghost sm" data-wk="-1" aria-label="Last week">&#8249;</button><b id="crmWkLbl"></b><button type="button" class="crm-btn ghost sm" data-wk="1" aria-label="Next week">&#8250;</button><button type="button" class="crm-btn ghost sm" data-wk="0">Today</button></div></div>' +
      '<div class="crm-days" id="crmDays"><p class="crm-sub">Loading your week&hellip;</p></div>' +
      '<p class="crm-legend"><i class="k-call"></i>Call logged <i class="k-followup"></i>Follow-up due <i class="k-quote"></i>Quote &amp; confirm (Basil)</p><p class="crm-note" id="crmCalNote"></p></section>' +
      '<section class="crm-card"><h2>Who you&rsquo;re working on</h2><p class="crm-sub">Follow-ups due first. After one follow-up with no answer, the contact goes to the AOTC admins.</p><div class="crm-pros" id="crmPros"></div></section>' +
      "</div>";
    paintGoal(state.home ? state.home.today : 0, state.home ? state.home.goal : 10);
  }
  function paintGoal(n, goal, preview) {
    var g = $("#crmGoal"); if (!g) return;
    g.innerHTML = meterHtml(n, goal, preview) + '<p class="crm-sub">Initial calls you&rsquo;ve logged today. Follow-up calls don&rsquo;t count toward your ' + goal + ".</p>";
  }
  function meterHtml(n, goal, preview) {
    goal = goal || 10; var pct = Math.min(100, n / goal * 100), pv = preview ? Math.min(100, (n + 1) / goal * 100) : pct, done = n >= goal;
    var ticks = ""; for (var i = 1; i < goal; i++) ticks += '<span style="left:' + (i / goal * 100) + '%"></span>';
    return '<div class="crm-goal-h"><b>Today&rsquo;s calls</b><span class="crm-count' + (done ? " done" : "") + '">' + n + " of " + goal + (done ? " &#10003;" : "") + "</span></div>" +
      '<div class="crm-meter' + (done ? " done" : "") + '" role="meter" aria-valuemin="0" aria-valuemax="' + goal + '" aria-valuenow="' + n + '" aria-label="Initial calls today"><b style="width:' + pv + '%"></b><i style="width:' + pct + '%"></i>' + ticks + "</div>";
  }
  function paintHome() {
    var h = state.home;
    paintGoal(h.today, h.goal);
    var ws = state.week, we = addDays(ws, 6);
    $("#crmWkLbl").textContent = ws.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " – " + we.toLocaleDateString("en-US", { month: ws.getMonth() === we.getMonth() ? undefined : "short", day: "numeric" });
    var t0 = dayStart(new Date()).getTime(), html = "";
    for (var i = 0; i < 7; i++) {
      var d = addDays(ws, i), a = d.getTime(), b = addDays(d, 1).getTime();
      var evs = h.events.filter(function (e) { return e.start >= a && e.start < b; }).sort(function (x, y) { return x.start - y.start; });
      html += '<div class="crm-day' + (a === t0 ? " today" : "") + (a < t0 ? " past" : "") + (evs.length ? "" : " empty") + '"><div class="crm-dh"><b>' + d.toLocaleDateString("en-US", { weekday: "short" }) + "</b><span>" + d.getDate() + "</span></div>" +
        (evs.length ? evs.map(function (e) { return '<button type="button" class="crm-ev k-' + esc(kindOf(e)) + '" data-cev="' + esc(e.id) + '"><small>' + tm(e.start) + "</small>" + esc(shortTitle(e)) + "</button>"; }).join("") : '<p class="crm-none">Nothing yet</p>') + "</div>";
    }
    $("#crmDays").innerHTML = html;
    $("#crmCalNote").textContent = h.note || "";
    var pros = h.prospects || [];
    $("#crmPros").innerHTML = pros.length ? pros.map(prospectRow).join("") : '<p class="crm-sub">No calls logged yet. Press <b>Log a call</b> to start your day.</p>';
  }
  function kindOf(e) { return e.kind === "confirm" ? "quote" : e.kind || "call"; }
  function shortTitle(e) { return String(e.title || "").replace(/\s·\s[^·]+$/, "").replace(/^Follow-up call due · /, "Follow up: "); }
  var STATUS = { followup: "Follow-up due", conversation: "Spoke with them", quoted: "Quote sent", handedoff: "With the admins" };
  function statusLine(p) {
    if (p.status === "followup") { var late = p.followUpAt < Date.now(); return '<span class="crm-badge ' + (late ? "late" : "due") + '">' + (late ? "Overdue: " : "Call ") + esc(when(p.followUpAt)) + "</span>"; }
    if (p.status === "quoted") { var q = p.quotes[p.quotes.length - 1]; return '<span class="crm-badge quote">Quote sent ' + money(q.total) + " &middot; confirm by " + esc(when(q.confirmAt)) + "</span>"; }
    return '<span class="crm-badge ' + p.status + '">' + STATUS[p.status] + "</span>";
  }
  function prospectRow(p) {
    var can = p.status === "followup" || p.status === "conversation";
    return '<details class="crm-pro"><summary><span class="crm-pro-t"><b>' + esc(p.company) + "</b><small>" + esc(p.name) + " &middot; " + esc(p.phone) + "</small></span>" + statusLine(p) +
      (can ? '<button type="button" class="crm-btn sm p" data-follow="' + esc(p.id) + '">Follow-up call</button>' : "") + "</summary>" + historyHtml(p) + "</details>";
  }
  function historyHtml(p) {
    return '<ol class="crm-hist">' + p.calls.map(function (c) {
      return "<li><b>" + esc(when(c.ts)) + "</b> &middot; " + (c.type === "initial" ? "Initial call" : "Follow-up call") + " &middot; " + esc(OUT[c.outcome] || c.outcome) + (c.reason ? " (" + esc(c.reason) + ")" : "") +
        (c.notes ? '<p>' + esc(c.notes) + "</p>" : "") + (c.followUpAt ? '<p class="crm-fine">Follow-up docketed for ' + esc(when(c.followUpAt)) + "</p>" : "") + "</li>";
    }).join("") + p.quotes.map(function (q) { return "<li><b>" + esc(when(q.ts)) + "</b> &middot; Quote sent: " + esc(q.mode) + ", " + money(q.total) + "</li>"; }).join("") +
      "</ol><p class=\"crm-fine\">" + esc(p.email) + "</p>";
  }
  function prospectById(id) { var l = state.home && state.home.prospects || []; for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }

  /* ================= the log-a-call window ================= */
  var modal = null;
  function openModal(html, cls) {
    closeModal();
    modal = doc.createElement("div"); modal.className = "crm-modal";
    modal.innerHTML = '<div class="crm-modal-in ' + (cls || "") + '" role="dialog" aria-modal="true"><button type="button" class="crm-x" data-x aria-label="Close">&times;</button><div class="crm-mbody">' + html + "</div></div>";
    body.appendChild(modal); doc.documentElement.style.overflow = "hidden";
    modal.addEventListener("click", function (e) { if (e.target === modal || e.target.closest("[data-x]")) { if (!state.busy) closeModal(); } });
    var f = modal.querySelector("input,button.crm-btn.p,textarea"); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 60);
    return modal;
  }
  function paint(html) { if (!modal) return openModal(html); $(".crm-mbody", modal).innerHTML = html; $(".crm-modal-in", modal).scrollTop = 0; var f = modal.querySelector("input,textarea"); if (f) f.focus({ preventScroll: true }); return modal; }
  function closeModal() { if (modal) { modal.remove(); modal = null; doc.documentElement.style.overflow = ""; } }

  function logCall() {
    state.flow = { type: null, prospect: null, form: {} };
    openModal('<h2>Log a call</h2><p class="crm-sub">Which call is this?</p><div class="crm-types">' +
      '<button type="button" class="crm-type" data-type="initial"><b>Initial call</b><span>Someone new from your lead list. Counts toward your 10.</span></button>' +
      '<button type="button" class="crm-type" data-type="followup"><b>Follow-up call</b><span>Someone you&rsquo;ve called before. Doesn&rsquo;t count toward your 10.</span></button></div>');
  }
  function pickProspect() {
    var l = (state.home && state.home.prospects || []).filter(function (p) { return p.status === "followup" || p.status === "conversation"; });
    paint('<button type="button" class="crm-back" data-back="type">&#8249; Back</button><h2>Who are you following up with?</h2>' +
      (l.length ? '<input type="search" class="crm-in" id="crmFind" placeholder="Search a name or company" aria-label="Search your prospects"><div class="crm-pick" id="crmPick">' + l.map(function (p) {
        return '<button type="button" class="crm-pickrow" data-pick="' + esc(p.id) + '" data-find="' + esc((p.company + " " + p.name).toLowerCase()) + '"><span><b>' + esc(p.company) + "</b><small>" + esc(p.name) + " &middot; last call " + esc(dy(p.calls[p.calls.length - 1].ts)) + ": " + esc(OUT[p.lastOutcome] || "") + "</small></span>" + statusLine(p) + "</button>"; }).join("") + "</div>"
        : '<p class="crm-sub">No follow-ups are waiting. Follow-ups appear here after a voicemail or no-access call.</p>'));
    var f = $("#crmFind"); if (f) f.addEventListener("input", function () { var q = f.value.trim().toLowerCase(); $$("[data-find]").forEach(function (b) { b.hidden = q && b.getAttribute("data-find").indexOf(q) < 0; }); });
  }
  function formStep() {
    var fl = state.flow, p = fl.prospect, v = fl.form, now = Date.now(), h = state.home || { today: 0, goal: 10 };
    if (p && !v.name) v = fl.form = { name: p.name, company: p.company, phone: p.phone, email: p.email, notes: "" };
    var init = fl.type === "initial";
    paint('<button type="button" class="crm-back" data-back="' + (init ? "type" : "pick") + '">&#8249; Back</button>' +
      '<div class="crm-step-h"><span class="crm-pill ' + (init ? "init" : "fu") + '">' + (init ? "Initial call" : "Follow-up call") + '</span><span class="crm-stamp">' + esc(dyLong(now)) + ", " + esc(tm(now)) + " &middot; saved automatically</span></div>" +
      '<div class="crm-goal mini">' + meterHtml(h.today, h.goal, init) + '<p class="crm-sub">' + (init ? "Logging this makes it <b>" + (h.today + 1) + " of " + h.goal + "</b> today." : "Follow-ups don&rsquo;t count toward your " + h.goal + ".") + "</p></div>" +
      (p ? '<p class="crm-tip"><b>Last time</b> ' + esc(when(p.calls[p.calls.length - 1].ts)) + ": " + esc(OUT[p.lastOutcome] || "") + (p.calls[p.calls.length - 1].notes ? ". " + esc(p.calls[p.calls.length - 1].notes) : "") + "</p>" :
        '<p class="crm-tip"><b>Gatekeeper?</b> Ask for the manager or the marketing director, and keep the reason short. Get their name, direct number and email. If you can&rsquo;t, fill in who you&rsquo;re trying to reach and say so in the notes.</p>') +
      '<div class="crm-grid">' +
      field("name", "Name", "First and last name", v.name, "text", "Who you called or are trying to reach") +
      field("company", "Company", "The business or brand", v.company, "text") +
      field("phone", "Phone", "(773) 000-0000", v.phone, "tel") +
      field("email", "Email", "name@business.com", v.email, "email") +
      '<div class="crm-f full"><label class="crm-l" for="cfNotes">Notes <span class="crm-opt">what happened, who you spoke with, best time to call back</span></label><textarea id="cfNotes" data-f="notes" rows="3">' + esc(v.notes) + "</textarea></div></div>" +
      '<p class="crm-err" id="cfErr" role="alert"></p>' +
      '<div class="crm-outs"><button type="button" class="crm-out vm" data-out="voicemail"><b>Voicemail</b><span>Script, then an email</span></button>' +
      '<button type="button" class="crm-out convo" data-out="convo"><b>Real conversation</b><span>Opens the Sales Console</span></button>' +
      '<button type="button" class="crm-out na" data-out="noaccess"><b>No access</b><span>Note it, then an email</span></button></div>');
  }
  function field(k, label, ph, val, type, hint) {
    return '<div class="crm-f"><label class="crm-l" for="cf' + k + '">' + label + ' <i>*</i>' + (hint ? ' <span class="crm-opt">' + hint + "</span>" : "") + '</label><input type="' + type + '" id="cf' + k + '" data-f="' + k + '" value="' + esc(val || "") + '" placeholder="' + esc(ph) + '" autocomplete="off"></div>';
  }
  function readForm() { $$("[data-f]", modal).forEach(function (el) { state.flow.form[el.getAttribute("data-f")] = el.value.trim(); }); return state.flow.form; }
  function checkForm() {
    var f = readForm(), bad = [];
    if (f.name.length < 2) bad.push(["name", "the name"]);
    if (!f.company) bad.push(["company", "the company"]);
    if (f.phone.replace(/\D/g, "").length < 7) bad.push(["phone", "a phone number"]);
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(f.email)) bad.push(["email", "a valid email"]);
    $$(".crm-f input", modal).forEach(function (i) { i.classList.remove("bad"); });
    if (bad.length) {
      bad.forEach(function (b) { $("#cf" + b[0]).classList.add("bad"); });
      $("#cfErr").textContent = "Still needed: " + bad.map(function (b) { return b[1]; }).join(", ") + ". If the gatekeeper wouldn’t share it, fill in who you were trying to reach and note it.";
      $("#cf" + bad[0][0]).focus(); return null;
    }
    return f;
  }

  /* ---------- the voicemail ---------- */
  function lastCallDay() { var p = state.flow.prospect; return p ? dyLong(p.calls[p.calls.length - 1].ts) : ""; }
  function vmText(reason) {
    var f = state.flow.form, n = first(f.name), r = state.rep.name;
    if (state.flow.type === "followup") return "Hi " + n + ", it’s " + r + " with AOTC, following up on my call from " + lastCallDay() + ". I’d still like a few minutes to see whether AOTC fits what " + f.company + " has planned. My number is " + PHONE + ". That’s " + PHONE + ". Talk soon.";
    return "Hi " + n + ", this is " + r + " with AOTC. I’m calling about " + reason + ", and I’d love a few minutes with you. You can reach me at " + PHONE + ". Again, that’s " + PHONE + ". Thanks, " + n + ".";
  }
  function vmStep() {
    var f = state.flow.form, init = state.flow.type === "initial", reason = state.flow.reasonVm || f.company + "’s marketing plans this year";
    paint('<button type="button" class="crm-back" data-back="form">&#8249; Back</button><span class="crm-pill vm">Voicemail</span><h2>Leave this voicemail</h2>' +
      '<p class="crm-sub">Under 25 seconds: your name, AOTC, one reason and the number twice. Two voicemails per prospect at most' + (init ? "." : ": this is the second.") + "</p>" +
      (init ? '<label class="crm-l" for="crmReason">Your one real reason for calling <span class="crm-opt">an opening, an event, a new location</span></label><input class="crm-in" id="crmReason" value="' + esc(reason) + '">' : "") +
      '<blockquote class="crm-script" id="crmScript">' + esc(vmText(reason)) + "</blockquote>" +
      '<p class="crm-fine">Talking points, not a script: say it in your own words.</p>' +
      '<div class="crm-row"><button type="button" class="crm-btn p" id="crmVmDone">I left the voicemail: next, the email</button></div>');
    var ri = $("#crmReason");
    if (ri) ri.addEventListener("input", function () { state.flow.reasonVm = ri.value; $("#crmScript").textContent = vmText(ri.value.trim() || f.company + "’s marketing plans this year"); });
  }

  /* ---------- no access ---------- */
  var NA = ["Gatekeeper wouldn’t connect me", "No voicemail box", "No answer", "Wrong or disconnected number"];
  function naStep() {
    var fl = state.flow;
    paint('<button type="button" class="crm-back" data-back="form">&#8249; Back</button><span class="crm-pill na">No access</span><h2>What happened?</h2>' +
      '<p class="crm-sub">Note why you couldn&rsquo;t reach ' + esc(first(fl.form.name)) + ". It goes on the calendar with your follow-up.</p>" +
      '<div class="crm-chips">' + NA.map(function (r) { return '<button type="button" class="crm-chip' + (fl.reason === r ? " on" : "") + '" data-reason="' + esc(r) + '">' + esc(r) + "</button>"; }).join("") + "</div>" +
      '<label class="crm-l" for="crmNaNote">Notes <span class="crm-opt">who you spoke with, best time to try again</span></label><textarea class="crm-in" id="crmNaNote" rows="3">' + esc(fl.form.notes) + "</textarea>" +
      '<p class="crm-err" id="naErr" role="alert"></p><div class="crm-row"><button type="button" class="crm-btn p" id="crmNaDone">Next: the email</button></div>');
  }

  /* ---------- the email ---------- */
  function signature() { return "Best regards,\n\n" + state.rep.name + "\nOOH-Vantage Strategist\nAOTC, LLC · 49 Markets Nationwide\nDirect / Text: " + PHONE + " | adsofthecentury.net\nReal brands. Real streets."; }
  function buildMail(outcome) {
    var f = state.flow.form, n = first(f.name), co = f.company, r = first(state.rep.name), fu = state.flow.type === "followup", subj, txt;
    if (!fu && outcome === "voicemail") { subj = "Quick question for " + co; txt = "I just left you a voicemail. I’m " + r + " with AOTC, and I’d like a few minutes to see whether there’s room to add something effective to " + co + "’s upcoming marketing plans: your brand, out in the real world where your audience lives, works and gathers.\n\nWhen is a good time this week for a quick call?"; }
    else if (!fu) { subj = "Connecting with " + co; txt = "I tried to reach you by phone today. I’m " + r + " with AOTC, and I’d like a few minutes to see whether there’s room to add something effective to " + co + "’s upcoming marketing plans.\n\nIs there a moment in your schedule this week for a quick call?"; }
    else if (outcome === "voicemail") { subj = "Following up: " + co; txt = "Following up on my note from " + lastCallDay() + "; I just left you another voicemail. I’d still value a few minutes to see whether AOTC could strengthen what " + co + " already has planned.\n\nWhat does your availability look like over the next week?"; }
    else { subj = "Following up: " + co; txt = "I tried you again today and I know your schedule is full, so I’ll keep this short: I’d value 10 minutes to see whether AOTC fits " + co + "’s marketing plans this year.\n\nIs there a time that works? If someone else handles your marketing, I’m glad to connect with them instead."; }
    return { to: f.email, cc: INFO, subject: subj, body: "Hi " + n + ",\n\n" + txt + "\n\n" + signature() };
  }
  function mailLinks(m) {
    var e = encodeURIComponent;
    return { gmail: "https://mail.google.com/mail/?view=cm&fs=1&to=" + e(m.to) + "&cc=" + e(m.cc) + "&su=" + e(m.subject) + "&body=" + e(m.body),
      mailto: "mailto:" + m.to + "?cc=" + e(m.cc) + "&subject=" + e(m.subject) + "&body=" + e(m.body) };
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).then(function () { return true; }, legacy);
    return Promise.resolve(legacy());
    function legacy() { var a = doc.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;left:-9999px"; body.appendChild(a); a.select(); var ok = false; try { ok = doc.execCommand("copy"); } catch (e) {} a.remove(); return ok; }
  }
  function submitCall(outcome, extra) {
    if (state.busy) return Promise.resolve(null);
    var fl = state.flow, f = fl.form, mail = outcome === "convo" ? null : buildMail(outcome);
    state.busy = true;
    var t0 = dayStart(new Date());
    return api("logCall", { dayStart: t0.getTime(), dayEnd: addDays(t0, 1).getTime(), call: Object.assign({ type: fl.type, prospectId: fl.prospect ? fl.prospect.id : "", outcome: outcome,
      name: f.name, company: f.company, phone: f.phone, email: f.email, notes: f.notes, mail: mail ? { subject: mail.subject, body: mail.body } : null }, extra || {}) })
      .then(function (j) {
        state.busy = false;
        if (!j.ok) { toast(j.error || "That call didn’t save. Try again.", 6000); return null; }
        if (state.home) state.home.today = j.today;
        fl.result = j; fl.mail = mail;
        return j;
      });
  }
  function mailStep() {
    var fl = state.flow, j = fl.result, m = fl.mail, L = mailLinks(m);
    var next = j.followUpAt ? "Follow-up call on <b>" + esc(when(j.followUpAt)) + "</b> is on your calendar." : j.handedOff ? "That was the last docketed follow-up: the contact now goes to the AOTC admins&rsquo; marketing sequence." : "";
    paint('<span class="crm-ok">&#10003; Logged' + (fl.type === "initial" ? " &middot; " + state.home.today + " of " + state.home.goal + " today" : "") + "</span>" +
      '<h2>Send this email now</h2><p class="crm-sub">' + next + (j.calendar !== "added" ? ' <span class="crm-warn">The calendar didn&rsquo;t take it (' + esc(j.calendar) + "); the call is still saved.</span>" : "") + "</p>" +
      '<div class="crm-mail"><div class="crm-mail-h"><span><small>To</small>' + esc(m.to) + "</span><span><small>CC</small>" + esc(m.cc) + "</span><span><small>Subject</small>" + esc(m.subject) + "</span></div>" +
      '<textarea id="crmBody" rows="12" aria-label="Email text">' + esc(m.body) + "</textarea></div>" +
      '<div class="crm-row wrap"><a class="crm-btn p" id="crmGmail" href="' + esc(L.gmail) + '" target="_blank" rel="noopener">Open in Gmail</a>' +
      '<a class="crm-btn" id="crmMailto" href="' + esc(L.mailto) + '">Open in my email app</a><button type="button" class="crm-btn" id="crmCopy">Copy all</button></div>' +
      '<p class="crm-fine">Everything is filled in: To, CC and the message. Read it, then press Send.</p>' +
      '<div class="crm-row end"><button type="button" class="crm-btn ghost" id="crmDone">Done: back to my home</button></div>');
    $("#crmBody").addEventListener("input", function () { m.body = this.value; var l = mailLinks(m); $("#crmGmail").href = l.gmail; $("#crmMailto").href = l.mailto; });
  }

  /* ---------- real conversation: into the console ---------- */
  function intoConsole(j) {
    var f = state.flow.form;
    state.call = { prospectId: j ? j.prospectId : "", callId: j && j.call ? j.call.id : "", name: f.name, company: f.company, phone: f.phone, email: f.email, notes: f.notes };
    ss(SK.call, JSON.stringify(state.call));
    closeModal();
    window.AOTCConsole.start({ name: f.name, company: f.company, email: f.email, phone: f.phone, notes: f.notes ? "From the call log: " + f.notes : "" });
    setView("console");
    toast("Logged. Work down the console as you talk with " + first(f.name) + ".");
  }
  function inbound() {
    state.call = { prospectId: "", callId: "", inbound: true }; ss(SK.call, JSON.stringify(state.call));
    window.AOTCConsole.start({ inbound: true }); setView("console");
  }
  function backHome() {
    var c = state.call, sentNow = window.AOTCConsole.sent();
    if (sentNow || !window.AOTCConsole.dirty() || !c || !c.prospectId) { goHome(); return; }
    openModal('<h2>Leaving without a quote?</h2><p class="crm-sub">Nothing was sent for ' + esc(c.company) + ". Put a follow-up call on your calendar for 3 business days from now?</p>" +
      '<label class="crm-l" for="crmAfter">Where did it land? <span class="crm-opt">goes into the calendar event</span></label><textarea class="crm-in" id="crmAfter" rows="3" placeholder="They want to talk to their partner, call back after the 1st&hellip;"></textarea>' +
      '<div class="crm-row wrap"><button type="button" class="crm-btn p" id="crmDocket">Put the follow-up on my calendar</button><button type="button" class="crm-btn" id="crmJustHome">Just go home</button><button type="button" class="crm-btn ghost" data-x>Stay in the console</button></div>');
  }
  function goHome() {
    closeModal(); state.call = null; ss(SK.call, null);
    window.AOTCConsole.reset(); setView("home"); refresh();
  }
  window.addEventListener("aotc:quote", function (e) {
    if (!state.rep) return;
    var d = e.detail || {}, c = state.call || {}, line = $("#snCal");
    if (line) { line.hidden = false; line.textContent = "Adding the quote and a 24-hour reminder to your calendar…"; }
    api("quote", { quote: Object.assign({}, d, { prospectId: c.prospectId || "", callId: c.callId || "" }) }).then(function (j) {
      if (!line) return;
      line.innerHTML = j.ok ? "&#10003; On your calendar: this quote, and a reminder on <b>" + esc(when(j.confirmAt)) + "</b> to confirm with the AOTC admins so you can close it." + (j.calendar !== "added" ? " (The calendar had a problem: " + esc(j.calendar) + ". The quote is still saved.)" : "")
        : "The quote went to info@, but it didn’t reach your call log: " + esc(j.error || "") + " Tell leadership.";
    });
  });
  window.AOTCCrmHome = function () { if (state.rep) goHome(); };

  /* ================= clicks ================= */
  host.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    if (t.id === "crmOut") { signOut(); return; }
    if (t.id === "crmLog") { logCall(); return; }
    if (t.id === "crmInbound") { inbound(); return; }
    if (t.hasAttribute("data-wk")) { var w = +t.getAttribute("data-wk"); state.week = w ? addDays(state.week, 7 * w) : monday(new Date()); $("#crmDays").classList.add("loading"); refresh().then(function () { $("#crmDays").classList.remove("loading"); }); return; }
    if (t.hasAttribute("data-follow")) { e.preventDefault(); startFollow(t.getAttribute("data-follow")); return; }
    if (t.hasAttribute("data-cev")) { showEvent(t.getAttribute("data-cev")); return; }   /* not data-ev: the console's own click handler uses data-ev for its event cards */
  });
  function startFollow(pid) { var p = prospectById(pid); if (!p) return; state.flow = { type: "followup", prospect: p, form: {} }; openModal(""); formStep(); }
  function showEvent(id) {
    var e = (state.home.events || []).filter(function (x) { return x.id === id; })[0]; if (!e) return;
    var p = prospectById(e.prospectId), can = p && (p.status === "followup" || p.status === "conversation");
    openModal('<span class="crm-pill k-' + esc(kindOf(e)) + '">' + esc({ call: "Call logged", followup: "Follow-up due", quote: "Quote submitted", confirm: "Confirm with AOTC admins" }[e.kind] || "Event") + "</span>" +
      "<h2>" + esc(e.title) + '</h2><p class="crm-sub">' + esc(when(e.start)) + "</p>" +
      (p ? '<div class="crm-card flat"><b>' + esc(p.company) + "</b><p>" + esc(p.name) + " &middot; " + esc(p.phone) + " &middot; " + esc(p.email) + "</p>" + historyHtml(p) + "</div>" : "") +
      (can ? '<div class="crm-row"><button type="button" class="crm-btn p" data-follow="' + esc(p.id) + '">Log the follow-up call</button></div>' : ""));
  }
  doc.addEventListener("click", function (e) {
    if (!modal || !modal.contains(e.target)) return;
    var t = e.target.closest("button"); if (!t) return;
    var fl = state.flow;
    if (t.hasAttribute("data-follow")) { startFollow(t.getAttribute("data-follow")); return; }
    if (t.hasAttribute("data-type")) { fl.type = t.getAttribute("data-type"); fl.prospect = null; fl.form = {}; if (fl.type === "followup") pickProspect(); else formStep(); return; }
    if (t.hasAttribute("data-pick")) { fl.prospect = prospectById(t.getAttribute("data-pick")); fl.form = {}; formStep(); return; }
    if (t.hasAttribute("data-back")) { var b = t.getAttribute("data-back"); if (b === "form") formStep(); else if (b === "pick") pickProspect(); else logCall(); return; }
    if (t.hasAttribute("data-out")) {
      var out = t.getAttribute("data-out"); if (!checkForm()) return;
      if (out === "voicemail") { vmStep(); return; }
      if (out === "noaccess") { fl.reason = fl.reason || ""; naStep(); return; }
      t.disabled = true; t.querySelector("span").textContent = "Saving…";
      submitCall("convo").then(function (j) { if (j) intoConsole(j); else { t.disabled = false; t.querySelector("span").textContent = "Opens the Sales Console"; } });
      return;
    }
    if (t.hasAttribute("data-reason")) { var r = t.getAttribute("data-reason"); fl.reason = fl.reason === r ? "" : r; $$("[data-reason]", modal).forEach(function (c) { c.classList.toggle("on", c.getAttribute("data-reason") === fl.reason); }); return; }
    if (t.id === "crmVmDone") { t.disabled = true; t.textContent = "Saving…"; submitCall("voicemail", { reason: "" }).then(function (j) { if (j) mailStep(); else { t.disabled = false; t.textContent = "I left the voicemail: next, the email"; } }); return; }
    if (t.id === "crmNaDone") {
      var note = $("#crmNaNote").value.trim();
      if (!fl.reason && !note) { $("#naErr").textContent = "Pick what happened or add a note."; return; }
      fl.form.notes = note; t.disabled = true; t.textContent = "Saving…";
      submitCall("noaccess", { reason: fl.reason }).then(function (j) { if (j) mailStep(); else { t.disabled = false; t.textContent = "Next: the email"; } }); return;
    }
    if (t.id === "crmCopy") { var m = fl.mail; copyText("To: " + m.to + "\nCC: " + m.cc + "\nSubject: " + m.subject + "\n\n" + m.body).then(function (ok) { toast(ok ? "Copied: To, CC, subject and message." : "Couldn’t copy: select the text and copy it.", 5000); }); return; }
    if (t.id === "crmDone") { closeModal(); refresh(); toast(fl.result && fl.result.followUpAt ? "Saved. Follow-up on " + when(fl.result.followUpAt) + "." : "Saved."); return; }
    if (t.id === "crmDocket") {
      var c = state.call; t.disabled = true; t.textContent = "Saving…";
      api("docket", { prospectId: c.prospectId, notes: $("#crmAfter").value.trim() }).then(function (j) { if (!j.ok) { toast(j.error || "That didn’t save.", 6000); t.disabled = false; t.textContent = "Put the follow-up on my calendar"; return; } toast("Follow-up on " + when(j.followUpAt) + " is on your calendar."); goHome(); });
      return;
    }
    if (t.id === "crmJustHome") { goHome(); return; }
  });
  doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal && !state.busy) closeModal(); });
  var hb = $("#crmHomeBtn"); if (hb) hb.addEventListener("click", backHome);

  /* ================= start ================= */
  if (state.token && state.rep) {
    window.AOTCConsole.rep(state.rep.name);
    if (ss(SK.view) === "console") { setView("console"); renderHomeShell(); refresh(); }
    else startHome();
  } else renderSignin();
})();
