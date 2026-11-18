/* AOTC admin data viewer (admin.html): every rep's calls, outcomes, quotes and commission, read from the AOTC Sales Call Log
   (Google Apps Script in assets/crm-config.js; dev/sales-crm/Code.js). Read only. On localhost with no script URL (or ?demo=1)
   it reads the browser mock instead (dev/sales-crm/mock.js), like the console. */
(function () {
  "use strict";
  var doc = document, host = doc.getElementById("adm"), me = doc.currentScript;
  var ROOT = me && me.src ? me.src.replace(/assets\/admin\.js(\?.*)?$/, "") : "";
  var API = String(window.AOTC_CRM_URL || "").trim();
  var LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var DEMO = LOCAL && (!API || /[?&]demo=1/.test(location.search));
  var KEY = "aotc_admin_token", OUT = { voicemail: "Voicemail", noaccess: "No access", convo: "Conversation" };
  var st = { token: get(KEY), data: null, period: "week", open: {} };

  function get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function put(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "$" + Math.round(+n || 0).toLocaleString("en-US"); }
  function when(ms) { return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" }) + ", " + new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
  function dayStart(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

  var mock = null;
  function load(src) { return new Promise(function (ok, no) { var s = doc.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; doc.head.appendChild(s); }); }
  function api(action, data) {
    var req = Object.assign({ action: action, token: st.token || "" }, data || {}), p;
    if (DEMO) { mock = mock || load(ROOT + "dev/sales-crm/mock.js").then(function () { return load(ROOT + "dev/sales-crm/Code.js"); }); p = mock.then(function () { return JSON.parse(JSON.stringify(window.handle_(req))); }); }
    else p = fetch(API, { method: "POST", body: JSON.stringify(req) }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    return p.then(function (j) { return j || {}; }, function () { return { ok: false, error: "Couldn’t reach the call log. Check the connection and try again." }; });
  }

  /* ================= sign in ================= */
  function signin(msg) {
    host.innerHTML = '<div class="a-center"><div class="a-card a-login"><img class="a-logo" src="' + ROOT + 'aotc_final.gif" alt="AOTC"><h2 class="a-ttl">AOTC admin</h2><p class="a-sub">The sales team&rsquo;s calls, quotes and commission. Read only.</p>' +
      (API || DEMO ? '<label class="a-l" for="aPw">Admin password</label><input type="password" id="aPw" autocomplete="current-password" autocapitalize="off" spellcheck="false"><button type="button" class="a-btn p wide" id="aGo">Open the data</button>'
        : '<p class="a-warn">The call log isn&rsquo;t connected yet: add the Apps Script web app URL to <b>assets/crm-config.js</b>.</p>') +
      '<p class="a-err" id="aErr" role="alert">' + esc(msg || "") + '</p>' + (DEMO ? '<p class="a-demo">Local demo: the password is <b>demo</b>. Nothing here reaches Google.</p>' : "") +
      '<p class="a-fine"><a href="' + ROOT + 'book.html">&#8249; Sales console</a></p></div></div>';
    var pw = doc.getElementById("aPw"); if (!pw) return;
    setTimeout(function () { pw.focus(); }, 60);
    function go() {
      var b = doc.getElementById("aGo"); b.disabled = true; b.textContent = "Opening…";
      api("login", { rep: "admin", password: pw.value }).then(function (j) {
        b.disabled = false; b.textContent = "Open the data";
        if (!j.ok) { doc.getElementById("aErr").textContent = j.error || "That didn’t work."; pw.select(); return; }
        st.token = j.token; put(KEY, j.token); refresh();
      });
    }
    doc.getElementById("aGo").addEventListener("click", go);
    pw.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
  }

  /* ================= the data ================= */
  function refresh() {
    if (!st.data) host.innerHTML = '<div class="a-center"><p class="a-sub">Loading the call log&hellip;</p></div>';
    return api("admin").then(function (j) {
      if (!j.ok) { if (j.signin) { st.token = null; put(KEY, null); } signin(j.error); return; }
      st.data = j; paint();
    });
  }
  function range() {
    var now = new Date(), t0 = dayStart(now);
    if (st.period === "today") return [t0.getTime(), Infinity];
    if (st.period === "week") { var w = new Date(t0); w.setDate(w.getDate() - (w.getDay() + 6) % 7); return [w.getTime(), Infinity]; }
    if (st.period === "month") return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), Infinity];
    return [0, Infinity];
  }
  function statsFor(r) {
    var a = range(), calls = [], quotes = [];
    r.prospects.forEach(function (p) { p.calls.forEach(function (c) { if (c.ts >= a[0] && c.ts < a[1]) calls.push(c); }); p.quotes.forEach(function (q) { if (q.ts >= a[0] && q.ts < a[1]) quotes.push(q); }); });
    var init = calls.filter(function (c) { return c.type === "initial"; }), days = {};
    init.forEach(function (c) { var k = dayStart(c.ts).getTime(); days[k] = (days[k] || 0) + 1; });
    var nd = Object.keys(days).length, sales = quotes.reduce(function (s, q) { return s + (+q.total || 0); }, 0);
    return { calls: calls.length, initial: init.length, followups: calls.length - init.length, avg: nd ? Math.round(init.length / nd * 10) / 10 : 0,
      voicemail: calls.filter(function (c) { return c.outcome === "voicemail"; }).length, noaccess: calls.filter(function (c) { return c.outcome === "noaccess"; }).length,
      convo: calls.filter(function (c) { return c.outcome === "convo"; }).length, quotes: quotes.length, sales: sales, commission: sales * 0.2 };
  }
  function paint() {
    var d = st.data, goal = d.goal || 10, reps = d.reps.map(function (r) { return { r: r, s: statsFor(r) }; });
    var T = { calls: 0, initial: 0, voicemail: 0, noaccess: 0, convo: 0, quotes: 0, sales: 0, commission: 0 };
    reps.forEach(function (x) { Object.keys(T).forEach(function (k) { T[k] += x.s[k]; }); });
    var today = reps.reduce(function (s, x) { return s + (x.r.today || 0); }, 0);
    var P = { today: "Today", week: "This week", month: "This month", all: "All time" };
    host.innerHTML = '<div class="a-wrap">' +
      '<header class="a-top"><div class="a-brand"><img src="' + ROOT + 'aotc_final.gif" alt="AOTC"><span><b>AOTC admin &middot; Sales data</b><small>Updated ' + esc(d.generated) + "</small></span></div>" +
      '<div class="a-top-r">' + (d.sheet ? '<a class="a-btn sm" href="' + esc(d.sheet) + '" target="_blank" rel="noopener">Open the Google Sheet</a>' : "") + (DEMO ? '<span class="a-pill">Local demo</span>' : "") +
      '<button type="button" class="a-btn sm" id="aRef">Refresh</button><button type="button" class="a-btn sm ghost" id="aOut">Sign out</button></div></header>' +
      '<div class="a-seg" role="radiogroup" aria-label="Period">' + Object.keys(P).map(function (k) { return '<button type="button" role="radio" aria-checked="' + (st.period === k) + '" data-p="' + k + '">' + P[k] + "</button>"; }).join("") + "</div>" +
      '<section class="a-kpis">' +
      kpi("Calls today", today + ' <small>of ' + goal * d.reps.length + "</small>", "initial calls, every rep") +
      kpi("Total calls", T.calls, T.initial + " initial &middot; " + (T.calls - T.initial) + " follow-up") +
      kpi("Voicemails", T.voicemail, "") + kpi("No access", T.noaccess, "") + kpi("Conversations", T.convo, "with a decision-maker") +
      kpi("Quotes submitted", T.quotes, "from the Sales Console") + kpi("Quoted sales", money(T.sales), "total of submitted quotes") + kpi("Commission", money(T.commission), "20% of quoted sales") +
      "</section>" +
      '<section class="a-card"><div class="a-h"><h2>The reps</h2><p class="a-sub">' + P[st.period] + '. Click a rep to see every call they logged.</p></div><div class="a-reps">' +
      reps.sort(function (a, b) { return b.s.initial - a.s.initial || b.s.sales - a.s.sales; }).map(function (x) { return repRow(x.r, x.s, goal, d); }).join("") + "</div></section>" +
      '<p class="a-fine">Calls per day counts initial calls only; follow-ups don&rsquo;t count toward the ' + goal + " a day. Quoted sales are submitted quotes, before the admins approve them; commission is earned when AOTC collects payment.</p></div>";
  }
  function kpi(label, val, sub) { return '<div class="a-kpi"><small>' + label + "</small><b>" + val + "</b>" + (sub ? "<span>" + sub + "</span>" : "") + "</div>"; }
  function repRow(r, s, goal, d) {
    var max = Math.max(goal, Math.max.apply(null, r.perDay.map(function (x) { return x.n; })));
    var bars = r.perDay.map(function (x) { var dt = new Date(x.d + "T12:00:00"); return '<i title="' + esc(dt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })) + ": " + x.n + ' calls" style="height:' + Math.max(4, x.n / max * 100) + '%"' + (x.n >= goal ? ' class="hit"' : "") + "></i>"; }).join("");
    var open = !!st.open[r.id], pct = Math.min(100, (r.today || 0) / goal * 100);
    return '<div class="a-rep' + (open ? " open" : "") + '"><button type="button" class="a-rep-h" data-rep="' + r.id + '" aria-expanded="' + open + '">' +
      '<span class="a-rep-n"><b>' + esc(r.name) + "</b><small>" + (r.lastCall ? "Last call " + esc(r.lastCall) : "No calls yet") + "</small></span>" +
      '<span class="a-today"><small>Today</small><b>' + (r.today || 0) + "/" + goal + '</b><span class="a-bar"><i style="width:' + pct + '%"' + (r.today >= goal ? ' class="hit"' : "") + "></i></span></span>" +
      '<span class="a-n"><small>Calls</small><b>' + s.calls + "</b></span>" + '<span class="a-n"><small>Per day</small><b>' + s.avg + "</b></span>" +
      '<span class="a-n"><small>Voicemail</small><b>' + s.voicemail + "</b></span>" + '<span class="a-n"><small>No access</small><b>' + s.noaccess + "</b></span>" +
      '<span class="a-n"><small>Convos</small><b>' + s.convo + "</b></span>" + '<span class="a-n"><small>Quotes</small><b>' + s.quotes + "</b></span>" +
      '<span class="a-n"><small>Sales</small><b>' + money(s.sales) + "</b></span>" + '<span class="a-n"><small>Commission</small><b>' + money(s.commission) + "</b></span>" +
      '<span class="a-spark" aria-label="Initial calls per day, last 14 days">' + bars + "</span><span class=\"a-chev\" aria-hidden=\"true\">&#8964;</span></button>" +
      (open ? detail(r) : "") + "</div>";
  }
  function outCell(c) {
    if (!c) return '<span class="a-muted">&mdash;</span>';
    return '<span class="a-out ' + c.outcome + '">' + OUT[c.outcome] + "</span>" + (c.reason ? '<small class="a-muted">' + esc(c.reason) + "</small>" : "") + '<small class="a-muted">' + esc(when(c.ts)) + "</small>";
  }
  function detail(r) {
    var a = range(), pros = r.prospects.filter(function (p) { return p.calls.concat(p.quotes).some(function (x) { return x.ts >= a[0]; }); });
    if (!pros.length) return '<div class="a-detail"><p class="a-sub">No calls logged in this period.</p></div>';
    return '<div class="a-detail"><div class="a-tbl-wrap"><table class="a-tbl"><thead><tr><th>First call</th><th>Name</th><th>Brand</th><th>Number</th><th>Email</th><th>Notes</th><th>Initial call</th><th>Follow-up</th><th>Next step</th></tr></thead><tbody>' +
      pros.map(function (p) {
        var c0 = p.calls.filter(function (c) { return c.type === "initial"; })[0] || p.calls[0], fu = p.calls.filter(function (c) { return c.type === "followup"; }).pop(), q = p.quotes[p.quotes.length - 1];
        var next = q ? '<span class="a-out quote">Quote ' + money(q.total) + "</span><small class=\"a-muted\">" + esc(q.mode) + ", confirm " + esc(when(q.confirmAt)) + "</small>" :
          p.status === "followup" ? '<span class="a-out due">Follow-up ' + esc(when(p.followUpAt)) + "</span>" : p.status === "conversation" ? '<span class="a-muted">Spoke with them</span>' : '<span class="a-muted">To the admins&rsquo; sequence</span>';
        var notes = p.calls.map(function (c) { return c.notes; }).filter(Boolean).join(" / ");
        return "<tr><td>" + (c0 ? esc(when(c0.ts)) : "&mdash;") + "</td><td>" + esc(p.name) + "</td><td><b>" + esc(p.company) + '</b></td><td><a href="tel:' + esc(String(p.phone).replace(/[^\d+]/g, "")) + '">' + esc(p.phone) + '</a></td><td><a href="mailto:' + esc(p.email) + '">' + esc(p.email) + "</a></td>" +
          '<td class="a-notes">' + esc(notes) + "</td><td>" + (c0 && c0.type === "initial" ? outCell(c0) : '<span class="a-muted">Inbound</span>') + "</td><td>" + outCell(fu) + "</td><td>" + next + "</td></tr>";
      }).join("") + "</tbody></table></div></div>";
  }

  host.addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    if (t.id === "aRef") { t.textContent = "Refreshing…"; refresh(); return; }
    if (t.id === "aOut") { st.token = null; st.data = null; put(KEY, null); signin(); return; }
    if (t.hasAttribute("data-p")) { st.period = t.getAttribute("data-p"); paint(); return; }
    if (t.hasAttribute("data-rep")) { var id = t.getAttribute("data-rep"); st.open[id] = !st.open[id]; paint(); return; }
  });
  if (st.token) refresh(); else signin();
})();
