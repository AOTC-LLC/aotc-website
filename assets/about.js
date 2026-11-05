/* About page: start each explainer animation when it scrolls into view (and pause it when it leaves), and count the
   numbers in the route-room animation up in step with its 8-second loop. */
(function () {
  "use strict";
  var arts = document.querySelectorAll(".ab-art"); if (!arts.length) return;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (still) return;
  var nums = Array.prototype.slice.call(document.querySelectorAll(".ab4 [data-count]")), route = document.querySelector(".ab4 .route"), t0 = 0, raf = 0, live = false;
  function count(now) {
    if (!t0) t0 = now;
    // read the clock of the route's own CSS animation, so the numbers stay in step even after pausing off screen
    var a = route && route.getAnimations && route.getAnimations()[0], ms = a && a.currentTime != null ? a.currentTime : now - t0;
    var p = Math.min(1, (ms % 8000) / 6000);   // counts for 6 s, holds for 2 s, like the route on the map
    nums.forEach(function (n) { n.textContent = Math.round(+n.getAttribute("data-count") * p).toLocaleString("en-US"); });
    raf = live ? requestAnimationFrame(count) : 0;
  }
  if (!("IntersectionObserver" in window)) { Array.prototype.forEach.call(arts, function (a) { a.classList.add("on"); }); return; }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      e.target.classList.toggle("on", e.isIntersecting);
      if (e.target.querySelector(".ab4")) {
        live = e.isIntersecting;
        if (live && !raf) { t0 = 0; raf = requestAnimationFrame(count); }
      }
    });
  }, { threshold: .25 });
  Array.prototype.forEach.call(arts, function (a) { io.observe(a); });
})();
