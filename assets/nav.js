/* The navigation bar (assets/nav.css): Services, Markets and Contact open on hover or click; under 1280px the whole
   list folds into one menu where those three open as accordions. Escape and a click outside close everything. */
(function () {
  "use strict";
  var bar = document.querySelector("[data-sn]"); if (!bar) return;
  var small = window.matchMedia("(max-width: 1279px)"), hover = window.matchMedia("(hover: hover) and (pointer: fine)");
  var dds = Array.prototype.slice.call(bar.querySelectorAll(".sn-dd")), burger = bar.querySelector(".sn-burger"), t = 0;
  function set(dd, on) { dd.classList.toggle("open", on); dd.querySelector(".sn-a").setAttribute("aria-expanded", on ? "true" : "false"); }
  function closeAll(except) { dds.forEach(function (d) { if (d !== except) set(d, false); }); }
  dds.forEach(function (dd) {
    dd.querySelector(".sn-a").addEventListener("click", function (e) {
      e.stopPropagation(); var on = !dd.classList.contains("open"); if (!small.matches) closeAll(dd); set(dd, on);
    });
    dd.addEventListener("mouseenter", function () { if (small.matches || !hover.matches) return; clearTimeout(t); closeAll(dd); set(dd, true); });
    dd.addEventListener("mouseleave", function () { if (small.matches || !hover.matches) return; t = setTimeout(function () { set(dd, false); }, 180); });
  });
  function menu(on) {
    bar.classList.toggle("open", on); burger.setAttribute("aria-expanded", on ? "true" : "false");
    burger.setAttribute("aria-label", on ? "Close the menu" : "Open the menu"); document.documentElement.classList.toggle("sn-lock", on);
    if (!on) closeAll();
  }
  burger.addEventListener("click", function () { menu(!bar.classList.contains("open")); });
  document.addEventListener("click", function (e) { if (!small.matches && !bar.contains(e.target)) closeAll(); });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var o = bar.querySelector(".sn-dd.open"); closeAll(); if (o) o.querySelector(".sn-a").focus();
    if (bar.classList.contains("open")) { menu(false); burger.focus(); }
  });
  // following a link, or opening the booking form or the Golden Ticket, closes the menu
  bar.addEventListener("click", function (e) { if (e.target.closest("a[href], [data-book], [data-gt-open]")) { closeAll(); if (bar.classList.contains("open")) menu(false); } });
  (small.addEventListener ? small.addEventListener.bind(small, "change") : small.addListener.bind(small))(function () { menu(false); });
  // the panel photos load when the visitor reaches for the menu, or once the page has settled
  var got = false;
  function photos() {
    if (got) return; got = true;
    Array.prototype.forEach.call(bar.querySelectorAll("img[data-src]"), function (im) { im.src = im.getAttribute("data-src"); im.removeAttribute("data-src"); });
  }
  ["pointerover", "focusin", "touchstart"].forEach(function (ev) { bar.addEventListener(ev, photos, { passive: true, once: true }); });
  addEventListener("load", function () { setTimeout(function () { (window.requestIdleCallback || function (f) { f(); })(photos); }, 2500); });
  // the bright segment of the light tube: under the current page at rest, gliding under whatever the pointer is on
  var glide = bar.querySelector(".sn-glide");
  function light(el) {
    if (!glide) return;
    var at = el || bar.querySelector(".sn-a[aria-current]");
    if (!at || small.matches) { glide.classList.remove("on"); return; }
    var r = at.getBoundingClientRect(), o = bar.getBoundingClientRect(), pad = 10;
    glide.style.setProperty("--x", (r.left - o.left + pad) + "px"); glide.style.setProperty("--w", Math.max(8, r.width - pad * 2) + "px"); glide.classList.add("on");
  }
  Array.prototype.forEach.call(bar.querySelectorAll(".sn-list > li > .sn-a"), function (a) { a.addEventListener("pointerenter", function () { light(a); }); a.addEventListener("focus", function () { light(a); }); });
  bar.querySelector(".sn-list").addEventListener("pointerleave", function () { setTimeout(function () { var o = bar.querySelector(".sn-dd.open > .sn-a"); light(o); }, 200); });
  addEventListener("resize", function () { light(bar.querySelector(".sn-dd.open > .sn-a")); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { light(); }); else light();
  var was = null;
  function onScroll() { var s = window.scrollY > 8; if (s !== was) { was = s; bar.classList.toggle("scrolled", s); } }
  addEventListener("scroll", onScroll, { passive: true }); onScroll();
})();
