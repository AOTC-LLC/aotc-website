/* The cursor and the click (assets/cursor.css). The pointer is a lit LED with a ring of LEDs trailing it: the ring opens over
   anything clickable and turns gold on the Golden Ticket. Every click ripples through the page like a wave across an LED wall:
   square pixels on a grid, lit by a ring spreading out from the click. Touch screens get the ripple only. Visitors who prefer
   reduced motion keep their normal cursor and no ripple. */
(function () {
  "use strict";
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var doc = document, root = doc.documentElement, RM = Math.min, PX = 8, SIZE = 6;

  /* ---- the ripple ---- */
  var cv = doc.createElement("canvas"), x = cv.getContext("2d"), waves = [], raf = 0, dpr = 1;
  cv.className = "ax-ripple"; cv.setAttribute("aria-hidden", "true");
  function fit() { dpr = RM(2, window.devicePixelRatio || 1); cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; }
  function draw(now) {
    raf = 0; x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, innerWidth, innerHeight);
    waves = waves.filter(function (w) { return now - w.t < w.life; });
    waves.forEach(function (w) {
      var p = (now - w.t) / w.life, ease = 1 - Math.pow(1 - p, 2.4), r = w.max * ease, band = 15 + 16 * (1 - p), fade = 1 - p;
      var gx = Math.floor((w.x - w.max - band) / PX) * PX, gy = Math.floor((w.y - w.max - band) / PX) * PX, end = (w.max + band) * 2;
      for (var i = 0; i <= end; i += PX) for (var j = 0; j <= end; j += PX) {
        var cx = gx + i + SIZE / 2, cy = gy + j + SIZE / 2, d = Math.sqrt((cx - w.x) * (cx - w.x) + (cy - w.y) * (cy - w.y)), near = 1 - Math.abs(d - r) / band;
        if (near <= 0) continue;
        var a = near * near * fade; if (a < .03) continue;
        x.fillStyle = "rgba(" + (near > .82 && p < .5 ? w.hot : w.rgb) + "," + a.toFixed(3) + ")"; x.fillRect(gx + i, gy + j, SIZE, SIZE);
      }
    });
    if (waves.length) raf = requestAnimationFrame(draw); else x.clearRect(0, 0, innerWidth, innerHeight);
  }
  function ripple(px, py, gold) {
    waves.push({ x: px, y: py, t: performance.now(), life: 620, max: 92, rgb: gold ? "243,201,84" : "255,35,48", hot: gold ? "255,244,204" : "255,214,216" });
    if (waves.length > 4) waves.shift();
    if (!raf) raf = requestAnimationFrame(draw);
  }
  function mount() { doc.body.appendChild(cv); fit(); addEventListener("resize", fit); }
  if (doc.body) mount(); else doc.addEventListener("DOMContentLoaded", mount);
  doc.addEventListener("pointerdown", function (e) {
    if (e.button) return;
    var t = e.target; ripple(e.clientX, e.clientY, !!(t.closest && t.closest("[data-gt-open],.gt,.gt-pass")));
  }, { passive: true, capture: true });

  /* ---- the cursor ---- */
  if (!(window.matchMedia && matchMedia("(hover: hover) and (pointer: fine)").matches)) return;
  var dot = doc.createElement("i"), ring = doc.createElement("i"), mx = -100, my = -100, rx = -100, ry = -100, scale = 1, want = 1, loop = 0, shown = false;
  dot.className = "ax-dot"; ring.className = "ax-ring"; dot.setAttribute("aria-hidden", "true"); ring.setAttribute("aria-hidden", "true");
  var CLICK = "a[href],button,summary,label,select,[role=button],[role=tab],[data-book],[data-gt-open],input[type=range],input[type=radio],input[type=checkbox],input[type=file],.gal-s,.leaflet-marker-icon";
  var TYPE = "input:not([type=range]):not([type=radio]):not([type=checkbox]):not([type=file]):not([type=button]):not([type=submit]),textarea,[contenteditable=true]";
  function tick() {
    loop = 0; rx += (mx - rx) * .2; ry += (my - ry) * .2; scale += (want - scale) * .22;
    dot.style.transform = "translate3d(" + mx + "px," + my + "px,0)";
    ring.style.transform = "translate3d(" + rx + "px," + ry + "px,0) scale(" + scale.toFixed(3) + ")";
    if (Math.abs(mx - rx) + Math.abs(my - ry) > .1 || Math.abs(want - scale) > .004) loop = requestAnimationFrame(tick);
  }
  function kick() { if (!loop) loop = requestAnimationFrame(tick); }
  function state(t) {
    if (!t || !t.closest) return;
    var type = !!t.closest(TYPE), click = !type && !!t.closest(CLICK), gold = !!t.closest("[data-gt-open],.gt,.gt-pass,.gt-box");
    root.classList.toggle("ax-type", type); ring.classList.toggle("is-on", click); ring.classList.toggle("is-gold", gold); dot.classList.toggle("is-gold", gold);
    want = click ? 1.5 : 1;
  }
  function start() {
    doc.body.appendChild(ring); doc.body.appendChild(dot); root.classList.add("ax-cursor");
    doc.addEventListener("pointermove", function (e) {
      if (e.pointerType && e.pointerType !== "mouse") return;
      mx = e.clientX; my = e.clientY;
      if (!shown) { shown = true; rx = mx; ry = my; root.classList.add("ax-live"); }
      kick();
    }, { passive: true });
    doc.addEventListener("pointerover", function (e) { state(e.target); }, { passive: true });
    doc.addEventListener("pointerdown", function () { want = .72; kick(); }, { passive: true });
    doc.addEventListener("pointerup", function (e) { state(e.target); kick(); }, { passive: true });
    root.addEventListener("mouseleave", function () { shown = false; root.classList.remove("ax-live"); });
  }
  if (doc.body) start(); else doc.addEventListener("DOMContentLoaded", start);
})();
