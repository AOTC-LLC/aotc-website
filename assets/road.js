/* The road between the close and the footer (assets/road.css): three trucks a lane, built once the road is near the screen and
   running only while it's on screen. Each time a truck leaves one side and comes back on the other, it carries the next logo. */
(function () {
  "use strict";
  var road = document.querySelector("[data-road]"); if (!road) return;
  var ROOT = ((document.currentScript && document.currentScript.src) || "").replace(/assets\/[^\/]*$/, "");   // the site's root, wherever it is hosted
  function lane(cls, attr, flip, offset) {
    var logos = (road.getAttribute("data-" + attr) || "").split("|"), bgs = (road.getAttribute("data-" + attr + "-bgs") || "").split("|"), fits = (road.getAttribute("data-" + attr + "-fits") || "").split("|");
    var el = document.createElement("div"), next = 0; el.className = "road-lane " + cls;
    function show(scr) {
      var k = next++ % logos.length; scr.style.setProperty("--c", bgs[k] || "#000"); scr.parentNode.parentNode.style.setProperty("--c", bgs[k] || "#000");
      scr.className = "rt-scr " + (fits[k] === "fill" ? "fill" : "pad"); scr.firstChild.src = logos[k];
    }
    for (var i = 0; i < 3; i++) {
      var t = document.createElement("div"); t.className = "rt" + (flip ? " flip" : ""); t.style.setProperty("--i", i + offset);
      t.innerHTML = '<i class="rt-shade"></i><i class="rt-spill"></i><div class="rt-body"><img class="rt-truck" src="' + ROOT + 'assets/road/truck.webp" alt="" width="660" height="303" decoding="async"><div class="rt-scr"><img alt="" decoding="async"></div></div>' +
        '<img class="rt-wheel f" src="' + ROOT + 'assets/road/wheel-front.webp" alt="" width="120" height="120" decoding="async"><img class="rt-wheel r" src="' + ROOT + 'assets/road/wheel-rear.webp" alt="" width="120" height="120" decoding="async">';
      var scr = t.querySelector(".rt-scr"); show(scr);
      t.addEventListener("animationiteration", function (e) { if (e.animationName === "rtDrive") show(e.currentTarget.querySelector(".rt-scr")); });
      el.appendChild(t);
    }
    road.appendChild(el);
  }
  var built = false;
  function build() { if (built) return; built = true; lane("road-far", "far", false, .4); lane("road-near", "near", true, 0); }
  if (!("IntersectionObserver" in window)) { build(); road.classList.add("on"); return; }
  new IntersectionObserver(function (es) { if (es[es.length - 1].isIntersecting) build(); }, { rootMargin: "600px" }).observe(road);
  new IntersectionObserver(function (es) { road.classList.toggle("on", es[es.length - 1].isIntersecting); }).observe(road);
})();
