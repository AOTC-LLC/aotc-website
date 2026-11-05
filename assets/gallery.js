/* The homepage gallery (home-plus.css .gal): one photo large with its neighbours showing at the sides. It rotates on its own only
   while on screen, stops while the visitor is on it, and each photo loads just before it is needed. */
(function () {
  "use strict";
  var root = document.querySelector("[data-gal]"); if (!root) return;
  var slides = Array.prototype.slice.call(root.querySelectorAll(".gal-s")), dots = Array.prototype.slice.call(root.querySelectorAll(".gal-dots button")), n = slides.length, k = 0;
  var cap = root.querySelector(".gal-cap b"), place = root.querySelector(".gal-cap span"), still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var EVERY = 4600, timer = 0, seen = false, hold = false;
  function load(i) { var im = slides[(i + n) % n].querySelector("img"); if (im.getAttribute("data-src")) { im.srcset = im.getAttribute("data-srcset"); im.src = im.getAttribute("data-src"); im.removeAttribute("data-src"); im.removeAttribute("data-srcset"); } }
  function go(i, user) {
    k = (i + n) % n;
    slides.forEach(function (s, j) {
      var d = (j - k + n) % n; if (d > n / 2) d -= n;   // how far from the middle, the short way round
      s.setAttribute("data-pos", d === 0 ? "0" : d === 1 ? "1" : d === -1 ? "-1" : d > 0 ? "2" : "-2");
      s.setAttribute("aria-hidden", d === 0 ? "false" : "true");
    });
    dots.forEach(function (b, j) { b.setAttribute("aria-current", j === k ? "true" : "false"); });
    cap.textContent = slides[k].getAttribute("data-cap"); place.textContent = slides[k].getAttribute("data-place");
    [k, k + 1, k - 1, k + 2].forEach(load);
    if (user) arm();
  }
  function arm() { clearTimeout(timer); if (!still && seen && !hold && !document.hidden) timer = setTimeout(function () { go(k + 1); arm(); }, EVERY); }
  root.querySelector(".gal-prev").addEventListener("click", function () { go(k - 1, true); });
  root.querySelector(".gal-next").addEventListener("click", function () { go(k + 1, true); });
  dots.forEach(function (b, j) { b.addEventListener("click", function () { go(j, true); }); });
  slides.forEach(function (s, j) { s.addEventListener("click", function () { if (j !== k) go(j, true); }); });
  root.addEventListener("pointerenter", function (e) { if (e.pointerType === "mouse") { hold = true; arm(); } });
  root.addEventListener("pointerleave", function () { hold = false; arm(); });
  root.addEventListener("focusin", function () { hold = true; arm(); });
  root.addEventListener("focusout", function () { hold = false; arm(); });
  root.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") go(k - 1, true); if (e.key === "ArrowRight") go(k + 1, true); });
  // a swipe on a phone
  var sx = null;
  root.addEventListener("touchstart", function (e) { sx = e.touches[0].clientX; }, { passive: true });
  root.addEventListener("touchend", function (e) { if (sx === null) return; var dx = e.changedTouches[0].clientX - sx; sx = null; if (Math.abs(dx) > 40) go(k + (dx < 0 ? 1 : -1), true); });
  document.addEventListener("visibilitychange", arm);
  go(0);
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; arm(); }, { threshold: .35 }).observe(root);
  else { seen = true; arm(); }
})();
