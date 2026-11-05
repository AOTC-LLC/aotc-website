/* AOTC LED signs and page motion.
   Draws the LED signs (cycling the brands AOTC has put on the street, or fixed text), runs the homepage's
   real-campaign scroll, lights up words as they're read, and drives the card rails, the Golden Ticket tilt
   and the opener photos. Everything degrades to plain readable pages without it.
   (Seeing your own brand on the truck lives in the Display Studio: assets/studio.js.) */
(function () {
  "use strict";
  var doc = document;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function $(s, r) { return (r || doc).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  var FONT = "'Barlow Condensed', Impact, 'Arial Narrow', sans-serif";
  var fontReady = doc.fonts && doc.fonts.load ? doc.fonts.load("900 40px 'Barlow Condensed'").catch(function () {}) : Promise.resolve();

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ an LED sign on a canvas: a grid of dots, lit by rasterising text â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  function LedSign(cv, opt) {
    opt = opt || {};
    var ctx = cv.getContext("2d"), off = doc.createElement("canvas"), octx = off.getContext("2d", { willReadFrequently: true });
    var COL = opt.color || "255,34,44", W = 0, H = 0, dpr = 1, P = 8, cols = 0, rows = 0, ox = 0, oy = 0;
    var lit, tgt, at, bg, dot, text = "", raf = 0, ready = false;
    function size() {
      var r = cv.getBoundingClientRect(); if (!r.width || !r.height) return false;
      W = r.width; H = r.height; dpr = Math.min(2, window.devicePixelRatio || 1);
      P = clamp(W / (opt.density || 150), 3.2, 11);
      cols = Math.floor(W / P); rows = Math.floor(H / P); ox = (W - cols * P) / 2; oy = (H - rows * P) / 2;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      lit = new Float32Array(cols * rows); tgt = new Float32Array(cols * rows); at = new Float64Array(cols * rows);
      bg = doc.createElement("canvas"); bg.width = cv.width; bg.height = cv.height;
      var b = bg.getContext("2d"); b.scale(dpr, dpr); b.fillStyle = "rgba(255,255,255,.06)"; b.beginPath();
      for (var y = 0; y < rows; y++) for (var x = 0; x < cols; x++) { var cx = ox + x * P + P / 2, cy = oy + y * P + P / 2; b.moveTo(cx + P * .26, cy); b.arc(cx, cy, P * .26, 0, 6.2832); }
      b.fill();
      var s = Math.ceil(P * 3.2 * dpr); dot = doc.createElement("canvas"); dot.width = dot.height = s;
      var d = dot.getContext("2d"), g = d.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, "rgba(255,214,206,1)"); g.addColorStop(.12, "rgba(" + COL + ",1)"); g.addColorStop(.17, "rgba(" + COL + ",.55)");
      g.addColorStop(.32, "rgba(" + COL + ",.14)"); g.addColorStop(.5, "rgba(" + COL + ",0)");
      d.fillStyle = g; d.fillRect(0, 0, s, s);
      ready = true; return true;
    }
    function raster(t) {
      var m = new Uint8Array(cols * rows), str = String(t || "").toUpperCase(); if (!str) return m;
      off.width = cols; off.height = rows; octx.clearRect(0, 0, cols, rows); octx.fillStyle = "#fff";
      octx.textAlign = "center"; octx.textBaseline = "middle";
      var lines = [str], fs = rows * .7;
      octx.font = "900 " + fs + "px " + FONT;
      var w = octx.measureText(str).width; if (w > cols * .9) fs *= cols * .9 / w;
      if (fs < rows * .3 && str.indexOf(" ") > 0) {   // long names: two lines read better than one tiny one
        var words = str.split(" "), best = null;
        for (var k = 1; k < words.length; k++) { var a = words.slice(0, k).join(" "), z = words.slice(k).join(" "), l = Math.max(a.length, z.length); if (!best || l < best[2]) best = [a, z, l]; }
        lines = [best[0], best[1]]; fs = rows * .4; octx.font = "900 " + fs + "px " + FONT;
        var mw = Math.max(octx.measureText(lines[0]).width, octx.measureText(lines[1]).width); if (mw > cols * .9) fs *= cols * .9 / mw;
      }
      octx.font = "900 " + fs + "px " + FONT;
      if (lines.length === 1) octx.fillText(lines[0], cols / 2, rows / 2 + fs * .05);
      else { octx.fillText(lines[0], cols / 2, rows / 2 - fs * .52); octx.fillText(lines[1], cols / 2, rows / 2 + fs * .58); }
      var data = octx.getImageData(0, 0, cols, rows).data;
      for (var i = 0; i < m.length; i++) m[i] = data[i * 4 + 3] > 105 ? 1 : 0;
      return m;
    }
    function show(t, mode) {
      text = t; if (!ready && !size()) return;
      var m = raster(t), now = performance.now(), sweep = mode === "type" ? 90 : mode === "now" ? 0 : (opt.sweep || 650);
      for (var i = 0; i < m.length; i++) {
        tgt[i] = m[i];
        var x = i % cols;
        at[i] = still || mode === "now" ? 0 : now + (x / cols) * sweep + Math.random() * (mode === "type" ? 40 : 110);
        if (still || mode === "now") lit[i] = m[i];
      }
      kick();
    }
    function frame(now) {
      raf = 0; if (!ready) return;
      var busy = false, ds = dot.width, half = ds / 2;
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(bg, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      for (var y = 0, i = 0; y < rows; y++) for (var x = 0; x < cols; x++, i++) {
        if (now >= at[i]) { var dlt = tgt[i] - lit[i]; if (dlt > .01 || dlt < -.01) { lit[i] += dlt * (dlt > 0 ? .55 : .3); busy = true; } else lit[i] = tgt[i]; }
        else busy = true;
        if (lit[i] > .03) { ctx.globalAlpha = lit[i]; ctx.drawImage(dot, (ox + x * P + P / 2) * dpr - half, (oy + y * P + P / 2) * dpr - half); }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
      if (busy) kick();
    }
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }
    var rt; addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(function () { ready = false; if (size()) show(text, "now"); }, 150); });
    return { show: show, get text() { return text; }, resize: function () { ready = false; if (size()) show(text, "now"); } };
  }
  window.AOTC_LED = LedSign;

  /* signs on any page: data-led="cycle" steps through data-names (only while on screen); data-led="text" shows data-text */
  $$("canvas[data-led]:not([data-led=logos])").forEach(function (cv) {
    var mode = cv.getAttribute("data-led"), s = LedSign(cv, { density: +cv.getAttribute("data-density") || 150, sweep: mode === "cycle" ? 700 : 900 });
    var names = mode === "cycle" ? (cv.getAttribute("data-names") || "").split("|").filter(Boolean) : [cv.getAttribute("data-text") || ""];
    var k = 0, timer = 0, on = false;
    function tick() { if (!on) return; s.show(names[k++ % names.length]); if (names.length > 1) timer = setTimeout(tick, 1900); }
    function seen(v) { on = v; clearTimeout(timer); if (on) fontReady.then(function () { clearTimeout(timer); tick(); }); }
    if (!("IntersectionObserver" in window)) return seen(true);
    new IntersectionObserver(function (es) { seen(es[es.length - 1].isIntersecting); }, { rootMargin: "120px" }).observe(cv);
  });

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ films play (muted) only while they're on screen, and never for visitors who prefer less motion â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  $$("video[data-film]").forEach(function (v) {
    var touched = false, btn = v.parentNode.querySelector("[data-film-toggle]");
    function mark() { if (btn) { btn.classList.toggle("paused", v.paused); btn.setAttribute("aria-label", v.paused ? "Play the film" : "Pause the film"); } }
    v.addEventListener("play", mark); v.addEventListener("pause", mark); mark();
    if (btn) btn.addEventListener("click", function () { if (v.paused) { touched = false; v.preload = "auto"; var p = v.play(); if (p && p.catch) p.catch(function () {}); } else { touched = true; v.dataset.auto = ""; v.pause(); } });
    if (still || !("IntersectionObserver" in window)) return;
    v.addEventListener("pause", function (e) { if (e.isTrusted && v.dataset.auto !== "1") touched = true; v.dataset.auto = ""; });
    new IntersectionObserver(function (es) {
      if (es[es.length - 1].isIntersecting) { if (!touched) { v.preload = "auto"; var p = v.play(); if (p && p.catch) p.catch(function () {}); } }
      else if (!v.paused) { v.dataset.auto = "1"; v.pause(); }
    }, { threshold: .35 }).observe(v);
  });

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ home: three real campaigns. Scrolling the pinned section steps through the job photos. â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var day = $(".day");
  if (day) (function () {
    var caps = $$(".day__caps li", day), bar = $$(".day__bar button", day), pics = $$(".day__stage img", day), cur = -1;
    function progress() { var r = day.getBoundingClientRect(), total = r.height - innerHeight; return clamp(-r.top / total, 0, 1); }
    function update() {
      var p = progress(), n = caps.length, idx = Math.min(n - 1, Math.floor(p * n)), f = p * n - idx;
      if (idx !== cur) {
        cur = idx;
        caps.forEach(function (li, k) { li.classList.toggle("on", k === idx); });
        pics.forEach(function (im, k) { im.classList.toggle("on", k === idx); });
        bar.forEach(function (b, k) { b.classList.toggle("on", k === idx); b.setAttribute("aria-pressed", k === idx ? "true" : "false"); });
      }
      bar.forEach(function (b, k) { b.style.setProperty("--f", k < idx ? 1 : k === idx ? f.toFixed(3) : 0); });
    }
    var tick = false;
    addEventListener("scroll", function () { if (tick) return; tick = true; requestAnimationFrame(function () { tick = false; update(); }); }, { passive: true });
    addEventListener("resize", update);
    bar.forEach(function (b, k) {
      b.addEventListener("click", function () {
        var r = day.getBoundingClientRect(), total = r.height - innerHeight;
        scrollTo({ top: r.top + scrollY + (k + .4) / caps.length * total, behavior: still ? "auto" : "smooth" });
      });
    });
    update();
  })();

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ words light up as you read (the manifesto) â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  $$("[data-lit]").forEach(function (el) {
    var words = [];
    (function walk(node, hot) {
      Array.prototype.slice.call(node.childNodes).forEach(function (ch) {
        if (ch.nodeType === 3) {
          var frag = doc.createDocumentFragment();
          ch.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(part)); return; }
            var s = doc.createElement("span"); s.className = "w"; s.textContent = part; if (hot) s.setAttribute("data-hot", ""); frag.appendChild(s); words.push(s);
          });
          node.replaceChild(frag, ch);
        } else if (ch.nodeType === 1) walk(ch, hot || ch.tagName === "EM");
      });
    })(el, false);
    $$("em", el).forEach(function (em) { em.style.fontStyle = "normal"; em.style.color = "inherit"; });
    if (still) { words.forEach(function (w) { w.classList.add("on"); if (w.hasAttribute("data-hot")) w.classList.add("hot"); }); return; }
    var t = false;
    function update() {
      var r = el.getBoundingClientRect(), vh = innerHeight;
      var p = clamp((vh * .82 - r.top) / (r.height + vh * .35), 0, 1), k = Math.round(p * words.length);
      words.forEach(function (w, i) { var on = i < k; w.classList.toggle("on", on); if (w.hasAttribute("data-hot")) w.classList.toggle("hot", on); });
    }
    addEventListener("scroll", function () { if (t) return; t = true; requestAnimationFrame(function () { t = false; update(); }); }, { passive: true });
    update();
  });

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ rails of cards: arrow buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  $$("[data-rail]").forEach(function (rail) {
    var wrap = rail.parentNode, prev = $("[data-rail-prev]", wrap), next = $("[data-rail-next]", wrap);
    function step(d) { var card = rail.firstElementChild; var w = card ? card.getBoundingClientRect().width + 20 : 400; rail.scrollBy({ left: d * w, behavior: still ? "auto" : "smooth" }); }
    function sync() { if (prev) prev.disabled = rail.scrollLeft < 8; if (next) next.disabled = rail.scrollLeft > rail.scrollWidth - rail.clientWidth - 8; }
    if (prev) prev.addEventListener("click", function () { step(-1); });
    if (next) next.addEventListener("click", function () { step(1); });
    rail.addEventListener("scroll", sync, { passive: true }); addEventListener("resize", sync); sync();
  });

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ the Golden Ticket tilts toward the pointer â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  $$("[data-tilt]").forEach(function (el) {
    if (still) return;
    var sec = el.closest("section") || el;
    sec.addEventListener("mousemove", function (e) {
      var r = el.getBoundingClientRect(), x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      el.style.setProperty("--ry", (x * 28).toFixed(2) + "deg"); el.style.setProperty("--rx", (-y * 22).toFixed(2) + "deg");
    });
    sec.addEventListener("mouseleave", function () { el.style.removeProperty("--ry"); el.style.removeProperty("--rx"); });
  });

  /* â”€â”€â”€â”€â”€â”€â”€â”€â”€ opener photos widen to the screen edges as they scroll into place â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
  var grows = $$(".grow");
  if (grows.length && !still) {
    var gt = false;
    var gupd = function () { grows.forEach(function (g) { var r = g.getBoundingClientRect(), p = clamp((innerHeight - r.top) / (innerHeight * .85), 0, 1); g.style.setProperty("--p", (p * p * (3 - 2 * p)).toFixed(3)); }); };
    addEventListener("scroll", function () { if (gt) return; gt = true; requestAnimationFrame(function () { gt = false; gupd(); }); }, { passive: true });
    addEventListener("resize", gupd); gupd();
  }
})();
