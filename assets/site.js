/* AOTC — behaviour for every page except the homepage (the homepage runs the live home.js).
   Menu, Book-the-truck drawer, one-answer-open FAQ, scroll reveal, the case-study ghost word and progress
   bar, the coverage map, the staff gate (double-click the logo) and privacy choices. Every page reads and
   works without it. */
(function () {
  "use strict";
  var doc = document, root = doc.documentElement;
  var ROOT = ((doc.currentScript && doc.currentScript.src) || "").replace(/assets\/[^\/]*$/, "");   // the site's root, wherever it is hosted
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  var FORM = "https://formsubmit.co/ajax/info@adsofthecentury.net";
  window.AOTC = window.AOTC || {};

  /* ───────── the "Got Ads?" menu (same behaviour as the live aotc-nav.js) ───────── */
  var HOME = doc.body.hasAttribute("data-home");   // the homepage runs the live home.js for its booking panel and gate
  $$(".aotc-nav").forEach(function (wrap) {
    if (wrap.dataset.aotcWired) return; wrap.dataset.aotcWired = "1";
    var tab = $(".aotc-tab", wrap), panel = $(".aotc-panel", wrap); if (!tab || !panel) return;
    function clamp() {
      panel.style.left = ""; panel.style.right = "";
      var rc = panel.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      if (rc.left < 16) { panel.style.right = "auto"; panel.style.left = (16 - wr.left) + "px"; }
      else if (rc.right > innerWidth - 16) { panel.style.left = "auto"; panel.style.right = (wr.right - (innerWidth - 16)) + "px"; }
    }
    function open() { wrap.classList.add("open"); tab.setAttribute("aria-expanded", "true"); clamp(); }
    function close() { wrap.classList.remove("open"); tab.setAttribute("aria-expanded", "false"); }
    var hover = window.matchMedia("(hover: hover) and (min-width: 721px)").matches;
    tab.addEventListener("click", function (e) { e.stopPropagation(); if (hover) open(); else (wrap.classList.contains("open") ? close : open)(); });
    panel.addEventListener("click", function (e) { e.stopPropagation(); });
    doc.addEventListener("click", function () { if (wrap.classList.contains("open")) close(); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && wrap.classList.contains("open")) { close(); tab.focus(); } });
    if (hover) { var t; wrap.addEventListener("mouseenter", function () { clearTimeout(t); open(); }); wrap.addEventListener("mouseleave", function () { t = setTimeout(close, 220); }); }
    window.AOTC.closeMenu = close;
  });

  /* ───────── toast ───────── */
  var toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = doc.createElement("div"); toastEl.className = "toast"; toastEl.setAttribute("role", "status"); doc.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove("on"); }, 3200);
  }

  /* ───────── Book the truck: the live booking panel's fields, as a drawer on every page ───────── */
  var bk = $("#bk"), form = bk && $("form", bk), last = null;
  function openBook(ctx) {
    if (!bk) { location.href = "/#book"; return; }
    if (window.AOTC.closeMenu) window.AOTC.closeMenu();
    bk.classList.remove("sent");
    var c = $("[name='Interested in']", bk); if (c && ctx) c.value = ctx;
    bk.classList.add("on"); bk.setAttribute("aria-hidden", "false"); root.style.overflow = "hidden"; last = doc.activeElement;
    setTimeout(function () { var f = $("input[name=Name]", bk); if (f) f.focus(); }, 380);
  }
  function closeBook() { if (!bk || !bk.classList.contains("on")) return; bk.classList.remove("on"); bk.setAttribute("aria-hidden", "true"); root.style.overflow = ""; if (last && last.focus) last.focus(); }
  if (bk) window.openAOTCPanel = function (ctx) { openBook(typeof ctx === "string" ? ctx : ""); };
  doc.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-book], a[href='/#book'], a[href='index.html#book']");
    if (!t) return;
    if (bk) { e.preventDefault(); openBook(t.getAttribute("data-book") || doc.body.getAttribute("data-context") || ""); }
    else if (window.openAOTCPanel) { e.preventDefault(); window.openAOTCPanel(); }
  });
  if (bk) {
    $$("[data-bk-close]", bk).forEach(function (b) { b.addEventListener("click", closeBook); });
    doc.addEventListener("keydown", function (e) { if (e.key === "Escape") closeBook(); });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var fd = new FormData(form), btn = $("button[type=submit]", form);
      if (fd.get("_honey")) return;
      if (!String(fd.get("Name") || "").trim() || !String(fd.get("Contact") || "").trim()) { toast("Add your name and a phone or email"); return; }
      var file = fd.get("attachment"); if (file && !file.size) fd.delete("attachment");
      if (file && file.size > 9.5 * 1048576) { toast("That file is over 10 MB. Text it to (773) 708-1400 instead."); return; }
      fd.delete("_honey");
      fd.append("_subject", "[AOTC] Call Request - " + String(fd.get("Name")).trim());
      fd.append("_template", "table"); fd.append("_captcha", "false");
      fd.append("Submission Type", "Call Request"); fd.append("Page", location.href);
      btn.disabled = true; var label = btn.innerHTML; btn.textContent = "Sending...";
      fetch(FORM, { method: "POST", headers: { Accept: "application/json" }, body: fd })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || String(j.success) === "false") throw 0; }); })   // FormSubmit can answer 200 without sending
        .then(function () { bk.classList.add("sent"); form.reset(); })
        .catch(function () { toast("That didn't send. Text (773) 708-1400 and we'll take it from there."); })
        .then(function () { btn.disabled = false; btn.innerHTML = label; });
    });
  }

  /* ───────── FAQ: one answer open at a time (live behaviour) ───────── */
  $$(".faq-grid, .hx-qa").forEach(function (g) {
    var qas = $$("details.qa", g);
    qas.forEach(function (d) { d.addEventListener("toggle", function () { if (d.open) qas.forEach(function (o) { if (o !== d) o.open = false; }); }); });
  });

  /* ───────── scroll reveal ───────── */
  var rv = $$("[data-reveal]");
  if (rv.length) {
    root.classList.add("js");
    if (still || !("IntersectionObserver" in window)) rv.forEach(function (el) { el.classList.add("in"); });
    else {
      var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }); }, { rootMargin: "0px 0px -8% 0px", threshold: .08 });
      rv.forEach(function (el) { io.observe(el); });
    }
  }

  /* ───────── the case-study backdrop: a ghost word that changes as you read, and a progress bar ───────── */
  var gw = doc.body.getAttribute("data-ghost");
  if (gw && !still) {
    var WORDS = gw.split("|"), bar = doc.createElement("div"), ghost = doc.createElement("div"), gb = doc.createElement("b");
    bar.className = "aotc-accentbar"; ghost.className = "aotc-ghost"; ghost.setAttribute("aria-hidden", "true"); gb.textContent = WORDS[0];
    ghost.appendChild(gb); doc.body.appendChild(bar); doc.body.insertBefore(ghost, doc.body.firstChild);
    var li = -1, tk = false;
    function onScroll() {
      var h = root.scrollHeight - innerHeight, p = h > 0 ? Math.min(1, Math.max(0, scrollY / h)) : 0;
      bar.style.width = (p * 100) + "%";
      var idx = Math.min(WORDS.length - 1, Math.floor(p * WORDS.length));
      if (idx !== li) { li = idx; gb.style.opacity = "0"; setTimeout(function () { gb.textContent = WORDS[idx]; gb.style.opacity = "1"; }, 180); }
      gb.style.transform = "translateY(" + (-p * 22) + "px)";
    }
    addEventListener("scroll", function () { if (tk) return; tk = true; requestAnimationFrame(function () { tk = false; onScroll(); }); }, { passive: true });
    onScroll();
  }

  /* ───────── coverage map: the lower 48 as an LED panel, lit outward from Chicago ───────── */
  (function () {
    var cv = $("canvas.led-map"); if (!cv || !cv.getContext || !window.atob) return;
    var G; try { G = JSON.parse(cv.getAttribute("data-grid")); } catch (e) { return; }
    var cols = G.cols, rows = G.rows, raw = atob(G.bits), land = [], dist = {}, maxD = 0, heat = {}, i;
    for (i = 0; i < cols * rows; i++) if ((raw.charCodeAt(i >> 3) >> (i & 7)) & 1) land.push(i);
    var hc = G.hub[0], hr = G.hub[1];
    function d(c, r) { return Math.sqrt((c - hc) * (c - hc) + (r - hr) * (r - hr)); }
    land.forEach(function (k) { var v = d(k % cols, Math.floor(k / cols)); dist[k] = v; if (v > maxD) maxD = v; });
    function bump(c, r, v) { if (c >= 0 && r >= 0 && c < cols && r < rows) { var k = r * cols + c; if (v < 1 && !(k in dist)) return; heat[k] = Math.max(heat[k] || 0, v); } }
    G.markets.forEach(function (m) { bump(m[0], m[1], 1); bump(m[0] + 1, m[1], .3); bump(m[0] - 1, m[1], .3); bump(m[0], m[1] + 1, .3); bump(m[0], m[1] - 1, .3); });
    var hot = Object.keys(heat).map(Number), ctx = cv.getContext("2d"), W = 0, p = 0, t0 = 0, visible = false, raf = 0, SPEED = 40;
    function size() { var dpr = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth || 600; p = W / cols; cv.style.height = (p * rows) + "px"; cv.width = Math.round(W * dpr); cv.height = Math.round(p * rows * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    function dots(list, rad) { ctx.beginPath(); list.forEach(function (k) { var x = (k % cols + .5) * p, y = (Math.floor(k / cols) + .5) * p; ctx.moveTo(x + rad, y); ctx.arc(x, y, rad, 0, 6.2832); }); ctx.fill(); }
    function label(text, c, r, big) {
      var x = (c + .5) * p, y = (r + .5) * p, fs = Math.max(9, p * (big ? 1.9 : 1.15)), right = c > cols - 14;
      ctx.font = (big ? "700 " : "500 ") + fs + "px 'IBM Plex Mono', monospace"; ctx.textAlign = big ? "center" : right ? "right" : "left"; ctx.textBaseline = "middle";
      var sub = Math.max(9, p * 1.3), subY = y - p * 1.3 - sub * .75, tx = big ? x : right ? x - p * 1.3 : x + p * 1.3, ty = big ? subY - sub * .6 - fs * .65 : y;
      ctx.lineWidth = 4; ctx.strokeStyle = "#070708"; ctx.lineJoin = "round"; ctx.strokeText(text, tx, ty); ctx.fillStyle = big ? "#fff" : "#a59f95"; ctx.fillText(text, tx, ty);
      if (big) { ctx.font = "600 " + sub + "px 'IBM Plex Mono', monospace"; ctx.strokeText("HOME BASE", x, subY); ctx.fillStyle = "#ff3b44"; ctx.fillText("HOME BASE", x, subY); }
    }
    function draw(now) {
      raf = 0;
      var t = t0 ? (now - t0) / 1000 : -1, front = still ? 1e9 : t < 0 ? -1 : t * SPEED, swept = front > maxD + 6, phase = swept ? ((t - (maxD + 6) / SPEED) * SPEED * .55) % (maxD + 45) : -99;
      ctx.clearRect(0, 0, W, p * rows);
      var lv = [[], [], [], [], [], []];
      land.forEach(function (k) { if (heat[k]) return; var w = Math.max(front > 0 && !swept ? Math.exp(-Math.pow(dist[k] - front, 2) / 9) : 0, Math.exp(-Math.pow(dist[k] - phase, 2) / 14) * .45); lv[Math.min(5, Math.round(w * 5))].push(k); });
      ctx.fillStyle = "rgba(255,255,255,.1)"; dots(lv[0], p * .3);
      for (i = 1; i < 6; i++) { ctx.fillStyle = "rgba(255," + (30 + i * 18) + "," + (30 + i * 12) + "," + (.1 + i * .16) + ")"; dots(lv[i], p * (.3 + i * .015)); }
      var lit = hot.filter(function (k) { return front >= (dist[k] || d(k % cols, Math.floor(k / cols))); });
      ctx.save(); ctx.shadowColor = "rgba(255,21,32,.9)"; ctx.shadowBlur = p * 1.4; ctx.fillStyle = "#ff1520"; dots(lit.filter(function (k) { return heat[k] >= 1; }), p * .4);
      ctx.fillStyle = "rgba(255,21,32,.45)"; dots(lit.filter(function (k) { return heat[k] < 1; }), p * .33); ctx.restore();
      var hx = (hc + .5) * p, hy = (hr + .5) * p;
      if (!still) { var ph = ((now || 0) / 2400) % 1; ctx.strokeStyle = "rgba(255,21,32," + (.8 * (1 - ph)) + ")"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(hx, hy, p * (.8 + 3.6 * ph), 0, 6.2832); ctx.stroke(); }
      ctx.save(); ctx.shadowColor = "#ff1520"; ctx.shadowBlur = p * 3; ctx.fillStyle = "#ff1520"; ctx.beginPath(); ctx.arc(hx, hy, p * .75, 0, 6.2832); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(hx, hy, p * .38, 0, 6.2832); ctx.fill();
      G.labels.forEach(function (l) { if (front >= d(l[1], l[2])) label(l[0], l[1], l[2], false); });
      label("CHICAGO", hc, hr, true);
      if (visible && !still) raf = requestAnimationFrame(draw);
    }
    function kick() { if (!raf) raf = requestAnimationFrame(draw); }
    size(); draw(performance.now());
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; if (visible) kick(); }).observe(cv);
      new IntersectionObserver(function (es) { if (es[es.length - 1].isIntersecting && !t0) { t0 = performance.now(); kick(); } }, { rootMargin: "0px 0px -25% 0px" }).observe(cv);
    } else { t0 = performance.now(); visible = true; kick(); }
    addEventListener("resize", function () { size(); draw(performance.now()); });
  })();

  /* ───────── staff gate: double-click the AOTC logo for the sales console (assets/logo.js counts the clicks).
     Only a SHA-256 fingerprint of the passphrase lives here; access lasts one page load. ───────── */
  var GATE = "4dcab0d82ccb503fea0f6f7a4d63440981cf2755d9fba55733489e8c8091fdf5", gateEl = null;
  function sha(s) {
    if (!(window.crypto && crypto.subtle && window.TextEncoder)) return Promise.resolve("");
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)).then(function (b) { return Array.prototype.map.call(new Uint8Array(b), function (x) { return ("0" + x.toString(16)).slice(-2); }).join(""); });
  }
  function staffGate() {
    if (gateEl) return;
    gateEl = doc.createElement("div"); gateEl.className = "dlg";
    gateEl.innerHTML = '<div class="dlg-box" role="dialog" aria-modal="true" aria-label="Internal access"><p class="k">AOTC internal</p><h2>Sales console</h2><p>Booking form access. Staff only.</p>' +
      '<input type="password" placeholder="Passphrase" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Passphrase"><div class="dlg-row"><button type="button" data-go>Unlock</button><button type="button" class="g" data-no>Cancel</button></div><small>Access expires when this page is closed</small></div>';
    doc.body.appendChild(gateEl); void gateEl.offsetWidth; gateEl.classList.add("on");
    var inp = $("input", gateEl); setTimeout(function () { inp.focus(); }, 200);
    function bail() { if (!gateEl) return; var g = gateEl; gateEl = null; g.classList.remove("on"); setTimeout(function () { g.remove(); }, 260); }
    function go() { sha(inp.value.trim()).then(function (h) { if (h === GATE) { try { sessionStorage.setItem("aotc_gate_once", "1"); } catch (e) {} location.href = ROOT + "book.html"; } else { inp.classList.remove("bad"); void inp.offsetWidth; inp.classList.add("bad"); inp.select(); } }); }
    $("[data-go]", gateEl).addEventListener("click", go); $("[data-no]", gateEl).addEventListener("click", bail);
    inp.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); if (e.key === "Escape") bail(); });
    gateEl.addEventListener("click", function (e) { if (e.target === gateEl) bail(); });
  }
  // the logo's clicks (one: home, two: this gate, three: the receipt tool) are counted in assets/logo.js
  if (!HOME) window.AOTCStaffGate = staffGate;

  /* ───────── privacy choices (footer) ───────── */
  doc.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-privacy]"); if (!t) return; e.preventDefault();
    var box = doc.createElement("div"); box.className = "dlg";
    box.innerHTML = '<div class="dlg-box" role="dialog" aria-modal="true" aria-label="Privacy choices"><p class="k">Privacy choices</p><h2>What this site keeps</h2><p>Your browser keeps a few small things for you: the brand name you typed, a Display Studio design in progress and your cookie choice. Nothing is sent to AOTC until you press send. See our <a href="' + ROOT + 'disclosures.html#cookies">Disclosures</a>.</p>' +
      '<div class="dlg-row"><button type="button" data-clear>Clear what this site saved</button><button type="button" class="g" data-no>Close</button></div></div>';
    doc.body.appendChild(box); void box.offsetWidth; box.classList.add("on");
    function bye() { box.classList.remove("on"); setTimeout(function () { box.remove(); }, 260); }
    $("[data-no]", box).addEventListener("click", bye); box.addEventListener("click", function (ev) { if (ev.target === box) bye(); });
    $("[data-clear]", box).addEventListener("click", function () { try { Object.keys(localStorage).forEach(function (k) { if (/^aotc/i.test(k)) localStorage.removeItem(k); }); } catch (err) {} bye(); toast("Cleared"); });
  });
  $$("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
