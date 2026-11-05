/* AOTC Golden Ticket: the client-access card in the menu, the slim pass in the top bar, and the gate
   that admits people to the live route room (route.html). Tickets are checked by /api/route; nothing
   in this file knows what a valid one looks like. */
(function () {
  "use strict";
  // Where the route room's data lives: the local preview server, or the free Cloudflare Worker on the live site.
  var WORKER = "https://aotc-route.weathered-lab-b15b.workers.dev/api/route";
  var API = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? "/api/route" : WORKER;
  var ROOT = ((document.currentScript && document.currentScript.src) || "").replace(/assets\/[^\/]*$/, "");   // the site's root, wherever it is hosted
  var ROOM = ROOT + "route.html", HANDOFF = "aotcRouteHandoff", CLIENT = "aotcRouteClient";
  var LINES = ["Your truck, live.", "Every turn, on the map.", "Every photo, as it's shot.", "Your reach, counted."];
  var SMS = "sms:+17737081400?&body=" + encodeURIComponent("Golden Ticket request: I'd like my brand on the truck.");
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var pulseP = null, gateEl = null, lastFocus = null;

  /* ---- how many routes are running right now (a count, nothing else) ---- */
  function pulse() {
    if (!pulseP) pulseP = fetch(API + "?a=pulse", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : { live: 0 }; }).catch(function () { return { live: 0 }; });
    return pulseP;
  }
  function paintPulse(root) {
    pulse().then(function (p) {
      var n = (p && p.live) || 0;
      root.querySelectorAll("[data-gt-pulse]").forEach(function (el) {
        el.textContent = n ? (n === 1 ? "1 route live now" : n + " routes live now") : el.getAttribute("data-gt-pulse");
      });
      root.querySelectorAll("[data-gt-live]").forEach(function (el) { el.classList.toggle("is-live", !!n); });
      root.querySelectorAll("[data-gt-quote]").forEach(function (el) {
        el.innerHTML = n ? "Right now a truck is <em>on the map</em>, and its brand is watching every turn."
                         : "Where the truck is. What the street saw. <em>Visible only to the brand that booked it.</em>";
      });
    });
  }

  /* ---- the blurred glimpse: a route being driven somewhere you can't quite see ---- */
  var scenes = [], lastTs = 0, looping = false;
  function glimpse(c, k) {
    var seed = 11, s = [], i;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (i = 0; i < (k > 1 ? 12 : 6); i++) s.push({ v: rnd() < .5, p: .04 + rnd() * .92, w: 1 });
    // the route turns only at corners, and every leg of it is a street on this little map: GPS follows roads, never cuts through a block
    var R = [[.16, .74], [.16, .3], [.44, .3], [.44, .16], [.82, .16], [.82, .56], [.6, .56], [.6, .84], [.16, .84], [.16, .74]];
    R.forEach(function (p) { s.push({ v: true, p: p[0], w: 2.2 }, { v: false, p: p[1], w: 2.2 }); });
    var W = c.width, H = c.height, segs = [], len = 0;
    for (i = 1; i < R.length; i++) { var d = Math.hypot((R[i][0] - R[i - 1][0]) * W, (R[i][1] - R[i - 1][1]) * H); segs.push([R[i - 1], R[i], len, d]); len += d; }
    var g = { c: c, x: c.getContext("2d"), W: W, H: H, k: k, s: s, R: R, segs: segs, len: len, t: rnd(), v: k > 1 ? .045 : .07 };
    scenes.push(g); draw(g);
    if (!still && !looping) { looping = true; requestAnimationFrame(loop); }
  }
  function at(g, t) {
    var m = t * g.len;
    for (var i = 0; i < g.segs.length; i++) { var q = g.segs[i]; if (m <= q[2] + q[3]) { var f = (m - q[2]) / q[3]; return [(q[0][0] + (q[1][0] - q[0][0]) * f) * g.W, (q[0][1] + (q[1][1] - q[0][1]) * f) * g.H]; } }
    return [g.R[0][0] * g.W, g.R[0][1] * g.H];
  }
  function draw(g) {
    var x = g.x, W = g.W, H = g.H, k = g.k;
    x.fillStyle = "#07080a"; x.fillRect(0, 0, W, H); x.lineCap = "round"; x.lineJoin = "round";
    g.s.forEach(function (s) {
      x.strokeStyle = "rgba(240,215,140," + (s.w > 1 ? .24 : .12) + ")"; x.lineWidth = s.w * k; x.beginPath();
      if (s.v) { x.moveTo(s.p * W, 0); x.lineTo(s.p * W, H); } else { x.moveTo(0, s.p * H); x.lineTo(W, s.p * H); }
      x.stroke();
    });
    x.strokeStyle = "rgba(255,21,32,.62)"; x.lineWidth = 2.8 * k; x.beginPath();
    g.R.forEach(function (p, i) { if (i) x.lineTo(p[0] * W, p[1] * H); else x.moveTo(p[0] * W, p[1] * H); }); x.stroke();
    x.fillStyle = "rgba(243,214,119,.95)";
    [g.R[2], g.R[5], g.R[7]].forEach(function (p) { x.fillRect(p[0] * W - 2.5 * k, p[1] * H - 2.5 * k, 5 * k, 5 * k); });
    var q = at(g, g.t), r = 15 * k, gr = x.createRadialGradient(q[0], q[1], 0, q[0], q[1], r);
    gr.addColorStop(0, "rgba(255,70,70,.95)"); gr.addColorStop(1, "rgba(255,21,32,0)");
    x.fillStyle = gr; x.beginPath(); x.arc(q[0], q[1], r, 0, 7); x.fill();
    x.fillStyle = "#fff"; x.beginPath(); x.arc(q[0], q[1], 2.8 * k, 0, 7); x.fill();
  }
  function loop(ts) {
    scenes = scenes.filter(function (g) { return g.c.isConnected; });
    if (!scenes.length) { looping = false; return; }
    requestAnimationFrame(loop);
    if (ts - lastTs < 40) return;
    var dt = Math.min(.1, (ts - lastTs) / 1000); lastTs = ts;
    scenes.forEach(function (g) {
      var r = g.c.getBoundingClientRect();
      if (!r.width || r.bottom < 0 || r.top > innerHeight || getComputedStyle(g.c).visibility === "hidden") return;
      g.t = (g.t + dt * g.v) % 1; draw(g);
    });
  }

  /* ---- the menu card and the top-bar pass ---- */
  function cardHTML() {
    return '<button class="gt" type="button" data-gt-open aria-haspopup="dialog" aria-label="Golden Ticket: enter the live route room">' +
      '<span class="gt-sheen" aria-hidden="true"></span><span class="gt-perf" aria-hidden="true"></span>' +
      '<span class="gt-top"><span>' +
        '<span class="gt-row" data-gt-live><i class="gt-dot"></i><span data-gt-pulse="Brands only">Brands only</span></span>' +
        '<span class="gt-title">Golden<br>Ticket</span><span class="gt-sub">The live route room</span>' +
      '</span><span class="gt-window" aria-hidden="true"><canvas width="172" height="132"></canvas><b>INSIDE</b></span></span>' +
      '<span class="gt-lines" aria-hidden="true">' + LINES.concat(LINES[0]).map(function (l) { return "<span>" + l + "</span>"; }).join("") + '</span>' +
      '<span class="gt-stub" aria-hidden="true"><span class="gt-redact"><i style="width:34%"></i><i style="width:20%"></i><i style="width:28%"></i></span><span class="gt-cta">Present ticket &rarr;</span></span>' +
      '</button><button class="gt-none" type="button" data-gt-book>No ticket yet? <b>Golden Ticket access comes with every booking.</b></button>';
  }
  function mountCards() {
    document.querySelectorAll("[data-gt-slot]:not([data-gt-on])").forEach(function (slot) {
      slot.setAttribute("data-gt-on", ""); slot.innerHTML = cardHTML();
      slot.querySelectorAll("canvas").forEach(function (c) { glimpse(c, 2); });
      paintPulse(slot);
    });
  }
  function mountPass() {
    var brand = document.querySelector(".nav-inner > .brand");
    if (!brand || document.querySelector(".gt-pass")) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "gt-pass"; b.setAttribute("data-gt-open", ""); b.setAttribute("data-gt-live", "");
    b.setAttribute("aria-label", "Golden Ticket: the live route room");
    b.innerHTML = '<span class="gt-gem" aria-hidden="true"></span><b>Golden Ticket</b><small><i></i><span data-gt-pulse="Live route room &middot; brands only">Live route room &middot; brands only</span></small>';
    brand.insertAdjacentElement("afterend", b);
    paintPulse(b.parentNode);
  }

  /* ---- the gate ---- */
  function gateHTML(inline) {
    return '<div class="gt-box">' +
      '<div class="gt-glimpse" aria-hidden="true"><canvas width="560" height="540"></canvas>' +
        '<div class="gt-hud"><span class="gt-live" data-gt-live><i class="gt-dot"></i><span data-gt-pulse="Private">Private</span></span>' +
        '<span>Distance <i style="width:34px"></i></span><span>Photos <i style="width:16px"></i></span><span>Last seen <i style="width:24px"></i></span></div>' +
        '<div class="gt-lock"><em></em><small>Brands only</small></div>' +
        '<p class="gt-quote" data-gt-quote>Where the truck is. What the street saw. <em>Visible only to the brand that booked it.</em></p></div>' +
      '<form class="gt-form" novalidate>' + (inline ? "" : '<button class="gt-x" type="button" data-gt-close aria-label="Close">&times;</button>') +
        '<p class="gt-eyebrow">Golden Ticket &middot; Live route room</p>' +
        '<h2 id="gtH">Present your <em>ticket.</em></h2>' +
        '<p class="gt-lede">Behind this door: the truck live on the map, every turn it takes, and photos from the street the hour they&rsquo;re shot. Open to the brands on the screens. No one else.</p>' +
        '<label class="gt-field"><span class="gt-sr">Your ticket</span><input name="pw" type="password" autocomplete="current-password" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="Track record required" required></label>' +
        '<button class="gt-enter" type="submit">Enter</button>' +
        '<p class="gt-small">Your ticket arrives with your booking.</p>' +
        '<div class="gt-denied" role="alert"><b data-gt-dh>Not on the list. Yet.</b><p data-gt-dp></p>' +
          '<div><button type="button" data-gt-book>Get my ticket</button><a href="' + SMS + '">Text (773) 708-1400</a></div></div>' +
      '</form><div class="gt-admit" aria-hidden="true"><b>Admitted.</b></div></div>';
  }
  var DENY = {
    no: ["Not on the list. Yet.", "This room opens for brands on the screens. Put yours on them and the door opens for you."],
    closed: ["This ticket has expired.", "Route views close 7 days after the run. Your photos are still with us: text us and we'll send them over."],
    down: ["The room can't be reached.", "Check your connection and try again in a minute."]
  };
  function deny(form, why) {
    var d = DENY[why] || DENY.no;
    form.querySelector("[data-gt-dh]").textContent = d[0]; form.querySelector("[data-gt-dp]").textContent = d[1];
    form.classList.remove("shake"); void form.offsetWidth; form.classList.add("denied", "shake");
    var i = form.querySelector("input"); i.select();
  }
  function submit(form, onIn) {
    var input = form.querySelector("input"), btn = form.querySelector(".gt-enter"), pw = input.value.trim();
    if (!pw) { input.focus(); return; }
    btn.disabled = true; form.classList.remove("denied");
    fetch(API + "?a=login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pw: pw }) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; }); })
      .then(function (j) {
        btn.disabled = false;
        if (j.status === 200 && j.token) {
          input.value = ""; form.closest(".gt-box").classList.add("admitted");
          setTimeout(function () {
            if (onIn) { onIn(j); return; }
            try { sessionStorage.setItem(HANDOFF, JSON.stringify(j)); } catch (e) {}
            location.href = ROOM;
          }, 700);
          return;
        }
        deny(form, j.status === 403 && j.error === "closed" ? "closed" : j.status === 401 ? "no" : "down");
      })
      .catch(function () { btn.disabled = false; deny(form, "down"); });
  }
  function wire(root, onIn) {
    var form = root.querySelector(".gt-form");
    form.addEventListener("submit", function (e) { e.preventDefault(); submit(form, onIn); });
    root.querySelectorAll("canvas").forEach(function (c) { glimpse(c, 2); });
    paintPulse(root);
  }
  function open() {
    try { if (sessionStorage.getItem(CLIENT)) { location.href = ROOM; return; } } catch (e) {}
    if (gateEl) return;
    lastFocus = document.activeElement;
    document.querySelectorAll(".aotc-nav.open").forEach(function (n) { n.classList.remove("open"); });
    gateEl = document.createElement("div");
    gateEl.className = "gt-gate"; gateEl.setAttribute("role", "dialog"); gateEl.setAttribute("aria-modal", "true"); gateEl.setAttribute("aria-labelledby", "gtH");
    gateEl.innerHTML = gateHTML(false); document.body.appendChild(gateEl); wire(gateEl);
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(function () { if (gateEl) gateEl.classList.add("on"); });
    setTimeout(function () { var i = gateEl && gateEl.querySelector("input"); if (i) i.focus(); }, 80);
  }
  function close() {
    if (!gateEl) return;
    var g = gateEl; gateEl = null; g.classList.remove("on");
    setTimeout(function () { g.remove(); }, 320);
    document.documentElement.style.overflow = "";
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function book() {
    close();
    if (window.openAOTCPanel) window.openAOTCPanel(); else location.href = SMS;
  }
  function mountInline(el, onIn) { el.classList.add("gt-gate", "gt-gate--inline"); el.innerHTML = gateHTML(true); wire(el, onIn); }

  // capture phase: the menu panel stops click propagation for its own reasons
  document.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-gt-open],[data-gt-book],[data-gt-close]");
    if (t) { e.preventDefault(); if (t.hasAttribute("data-gt-open")) open(); else if (t.hasAttribute("data-gt-book")) book(); else close(); return; }
    if (gateEl && e.target === gateEl) close();
  }, true);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && gateEl) close(); });

  function init() {
    mountCards(); mountPass(); if (document.querySelector(".sn-gt [data-gt-pulse]")) paintPulse(document.querySelector(".sn-gt"));
    document.querySelectorAll(".aotc-panel").forEach(function (p) { new MutationObserver(mountCards).observe(p, { childList: true }); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(init, 0); });
  else init();

  window.AOTCTicket = { open: open, close: close, mountInline: mountInline, pulse: pulse, api: API };
})();
