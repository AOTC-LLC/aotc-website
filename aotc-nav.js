/* AOTC unified navigation — wires the menu markup that ships in every page's HTML */
(function () {
  function wire(wrap) {
    if (!wrap || wrap.dataset.aotcWired) return;
    wrap.dataset.aotcWired = "1";

    var tab = wrap.querySelector(".aotc-tab");
    var scrim = wrap.querySelector(".aotc-scrim");
    var panel = wrap.querySelector(".aotc-panel");
    if (!tab || !panel) return;

    function clamp() {
      panel.style.left = ""; panel.style.right = "";
      if (window.matchMedia("(max-width: 720px)").matches) return; // bottom sheet handles itself
      var rc = panel.getBoundingClientRect(), wr = wrap.getBoundingClientRect();
      if (rc.left < 16) { panel.style.right = "auto"; panel.style.left = (16 - wr.left) + "px"; }
      else if (rc.right > innerWidth - 16) { panel.style.left = "auto"; panel.style.right = (wr.right - (innerWidth - 16)) + "px"; }
    }
    function open() { wrap.classList.add("open"); tab.setAttribute("aria-expanded", "true"); clamp(); }
    function close() { wrap.classList.remove("open"); tab.setAttribute("aria-expanded", "false"); }
    function toggle() { wrap.classList.contains("open") ? close() : open(); }

    var hoverDevice = window.matchMedia("(hover: hover) and (min-width: 721px)").matches;
    tab.addEventListener("click", function (e) {
      e.stopPropagation();
      if (hoverDevice) open(); else toggle();
    });
    if (scrim) scrim.addEventListener("click", close);
    panel.addEventListener("click", function (e) { e.stopPropagation(); });
    document.addEventListener("click", function () { if (wrap.classList.contains("open")) close(); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && wrap.classList.contains("open")) { close(); tab.focus(); }
    });

    if (hoverDevice) {
      var t;
      wrap.addEventListener("mouseenter", function () { clearTimeout(t); open(); });
      wrap.addEventListener("mouseleave", function () { t = setTimeout(close, 220); });
    }
  }

  function init() {
    var host = document.querySelector(".nav-links");
    if (host) host.classList.add("aotc-host");
    document.querySelectorAll(".aotc-nav").forEach(wire);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
