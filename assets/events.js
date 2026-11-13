/* AOTC — the homepage event rotations (src\data\events.json, built into the page by build-site.ps1).
   Drops events that have ended since the build, slides one card at a time with the arrows, and moves on by itself every
   5 seconds while it is on screen and nobody is touching it. Each card's link opens the booking form (assets/site.js). */
(function () {
  "use strict";
  var root = document.querySelector("[data-ev]"); if (!root) return;
  var track = root.querySelector(".ev-track"), sec = root.closest("section");
  var now = new Date(), today = now.getFullYear() + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
  Array.prototype.forEach.call(track.querySelectorAll(".ev-c"), function (c) { if ((c.getAttribute("data-end") || "9999") < today) c.remove(); });
  var cards = track.querySelectorAll(".ev-c");
  if (!cards.length) { if (sec) sec.hidden = true; return; }
  var prev = root.querySelector(".ev-prev"), next = root.querySelector(".ev-next"), count = root.querySelector(".ev-count");
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  function step() { var gap = parseFloat(getComputedStyle(track).columnGap) || 18; return cards[0].getBoundingClientRect().width + gap; }
  function update() {
    var s = step(), i = Math.round(track.scrollLeft / s), shown = Math.max(1, Math.round((track.clientWidth + 18) / s)), last = Math.min(cards.length, i + shown);
    count.textContent = (shown > 1 ? (i + 1) + "–" + last : (i + 1)) + " of " + cards.length + " events";
    prev.disabled = track.scrollLeft <= 4;
    next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
  }
  function go(d) { track.scrollBy({ left: d * step(), behavior: still ? "auto" : "smooth" }); }
  prev.addEventListener("click", function () { go(-1); });
  next.addEventListener("click", function () { go(1); });
  var raf = 0;
  track.addEventListener("scroll", function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(update); }, { passive: true });
  addEventListener("resize", update);

  var hold = false, seen = false, timer = 0;
  root.addEventListener("mouseenter", function () { hold = true; });
  root.addEventListener("mouseleave", function () { hold = false; });
  root.addEventListener("focusin", function () { hold = true; });
  root.addEventListener("focusout", function () { hold = false; });
  root.addEventListener("pointerdown", function () { clearInterval(timer); });   // once someone touches it, it stays where they put it
  if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; }, { threshold: .4 }).observe(root);
  else seen = true;
  if (!still) timer = setInterval(function () {
    if (hold || !seen || document.hidden) return;
    if (next.disabled) track.scrollTo({ left: 0, behavior: "smooth" }); else go(1);
  }, 5000);
  update();
})();
