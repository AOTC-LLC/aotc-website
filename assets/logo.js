/* AOTC — the header logo, on every page.
   One click: the logo's normal action (home, or back to the top on the homepage).
   Two clicks: the staff sales-console gate (window.AOTCStaffGate, set by site.js, or by home.js on the homepage).
   Four clicks or taps: a small password box; the right password opens the private receipt tool in a new tab.
   Clicks count together when each comes within 600 ms of the last, so one to three clicks act once that window passes.
   Ctrl/Cmd/Shift/Alt and middle clicks are left alone (open home in a new tab, etc.).
   The receipt tool is a Google Apps Script web app that Google itself locks to one Google account; the password here
   (kept only as its SHA-256 fingerprint) is an extra step in front of it. Keep the link out of the nav, footer, sitemap
   and robots.txt. /receipts shows the same password box and then opens the tool in place. */
(function () {
  "use strict";
  var RECEIPT_TOOL_URL = "https://script.google.com/macros/s/AKfycbxgOfsKAMqnjn8vQgR9qFDoYA41ezHsp0Bl7FmiElI_0qFNX7BPKtrzqjZrmyNCfBhT1Q/exec";
  var RECEIPT_PASS_SHA256 = "0042d83f9e56e83de3604a76e494259bdbcc62cac54cec5caa298139a4f98a29";
  var CLICK_WINDOW_MS = 600, RECEIPT_CLICKS = 4;
  var still = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // SHA-256 worked out synchronously, so the new tab opens inside the tap itself (iOS Safari blocks it otherwise)
  var K = [], H0 = [];
  (function () { var n = 2, found = 0; function frac(x) { return (x - Math.floor(x)) * 4294967296 | 0; }
    while (found < 64) { for (var d = 2; d * d <= n; d++) if (n % d === 0) break; if (d * d > n) { if (found < 8) H0.push(frac(Math.pow(n, 1 / 2))); K.push(frac(Math.pow(n, 1 / 3))); found++; } n++; } })();
  function ror(x, n) { return (x >>> n) | (x << (32 - n)); }
  function sha256(str) {
    var b = new TextEncoder().encode(str), l = b.length, n = ((l + 9 + 63) >> 6) << 6, m = new Uint8Array(n), H = H0.slice(), w = [];
    m.set(b); m[l] = 0x80; for (var i = 0; i < 4; i++) m[n - 1 - i] = (l * 8 >>> (8 * i)) & 255;
    for (var o = 0; o < n; o += 64) {
      for (var t = 0; t < 16; t++) w[t] = (m[o + 4 * t] << 24) | (m[o + 4 * t + 1] << 16) | (m[o + 4 * t + 2] << 8) | m[o + 4 * t + 3];
      for (t = 16; t < 64; t++) { var a = w[t - 15], c = w[t - 2]; w[t] = (w[t - 16] + (ror(a, 7) ^ ror(a, 18) ^ (a >>> 3)) + w[t - 7] + (ror(c, 17) ^ ror(c, 19) ^ (c >>> 10))) | 0; }
      var A = H[0], B = H[1], C = H[2], D = H[3], E = H[4], F = H[5], G = H[6], Hh = H[7];
      for (t = 0; t < 64; t++) {
        var t1 = (Hh + (ror(E, 6) ^ ror(E, 11) ^ ror(E, 25)) + ((E & F) ^ (~E & G)) + K[t] + w[t]) | 0, t2 = ((ror(A, 2) ^ ror(A, 13) ^ ror(A, 22)) + ((A & B) ^ (A & C) ^ (B & C))) | 0;
        Hh = G; G = F; F = E; E = (D + t1) | 0; D = C; C = B; B = A; A = (t1 + t2) | 0;
      }
      H[0] = (H[0] + A) | 0; H[1] = (H[1] + B) | 0; H[2] = (H[2] + C) | 0; H[3] = (H[3] + D) | 0; H[4] = (H[4] + E) | 0; H[5] = (H[5] + F) | 0; H[6] = (H[6] + G) | 0; H[7] = (H[7] + Hh) | 0;
    }
    return H.map(function (x) { return ("0000000" + (x >>> 0).toString(16)).slice(-8); }).join("");
  }

  // the password box: built only when asked for, styled inline so no stylesheet on the site changes
  var box = null;
  function receiptGate(inPlace) {
    if (box) return;
    box = document.createElement("div");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-label", "Staff password");
    box.innerHTML = '<form style="width:min(340px,88vw);padding:22px;border-radius:14px;background:#111114;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 80px rgba(0,0,0,.6);font:500 15px/1.4 Barlow,system-ui,sans-serif;color:#e8e2d8">' +
      '<label style="display:block;margin-bottom:8px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;font-size:12px;color:#8d877e">Staff password</label>' +
      '<input type="password" autocomplete="current-password" style="box-sizing:border-box;width:100%;height:48px;padding:0 12px;border-radius:9px;border:1px solid rgba(255,255,255,.2);background:#050506;color:#fff;font:600 17px Barlow,system-ui,sans-serif">' +
      '<button type="submit" style="width:100%;height:48px;margin-top:12px;border:0;border-radius:9px;background:#d9000d;color:#fff;font:800 17px Barlow,system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;cursor:pointer">Open</button>' +
      '<p style="min-height:1.3em;margin:10px 0 0;color:#ff5a62;font-weight:700"></p></form>';
    box.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.62)";
    document.body.appendChild(box);
    var form = box.querySelector("form"), input = box.querySelector("input"), msg = box.querySelector("p");
    setTimeout(function () { input.focus(); }, 30);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (sha256(input.value) !== RECEIPT_PASS_SHA256) { msg.textContent = "Wrong password."; input.select(); return; }
      close();
      if (inPlace) location.replace(RECEIPT_TOOL_URL);
      else window.open(RECEIPT_TOOL_URL, "_blank", "noopener,noreferrer");   // still inside the tap that submitted
    });
    box.addEventListener("click", function (e) { if (e.target === box && !inPlace) close(); });
    document.addEventListener("keydown", esc);
  }
  function esc(e) { if (e.key === "Escape" && box && !document.documentElement.hasAttribute("data-receipts")) close(); }
  function close() { if (box) { box.remove(); box = null; } document.removeEventListener("keydown", esc); }

  function attach(logo) {
    if (logo.dataset.logoWired) return; logo.dataset.logoWired = "1";
    var count = 0, timer = 0;
    logo.style.touchAction = "manipulation";   // fast taps count as taps on iOS, not a double-tap zoom
    function normalAction() {
      if (document.body.hasAttribute("data-home")) { window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" }); return; }
      var link = logo.closest ? logo.closest("a") : null;
      if (link && link.href) window.location.href = link.href;
    }
    logo.addEventListener("click", function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      count += 1; clearTimeout(timer);
      if (count >= RECEIPT_CLICKS) { count = 0; receiptGate(false); return; }
      timer = setTimeout(function () {
        var n = count; count = 0;
        if (n === 2 && window.AOTCStaffGate) window.AOTCStaffGate(); else normalAction();
      }, CLICK_WINDOW_MS);
    });
  }

  function init() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-site-logo]"), attach);
    if (document.documentElement.hasAttribute("data-receipts")) receiptGate(true);   // the /receipts page
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
  window.AOTCSha256 = sha256;
})();
