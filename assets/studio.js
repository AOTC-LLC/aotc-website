/* AOTC Display Studio — editor.
   Tab 1 (default): upload a design per screen (side, back, front) — image or video.
   Tab 2: create a simple design from scratch. Nothing leaves the device until Send. */
(function () {
  "use strict";
  var A = window.AOTCStudio, $ = function (s, r) { return (r || document).querySelector(s); }, $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var root = $("#studio"); if (!root || !A || !A.mountScene) return;

  var SLOTS = ["side", "rear", "front"], LABEL = { side: "side screens", rear: "back screen", front: "front screen" };
  var RATIO = {}; SLOTS.forEach(function (k) { RATIO[k] = A.SCREENS[k].ft[0] / A.SCREENS[k].ft[1]; });
  var CKEY = "aotc_studio_create";
  var state = {
    tab: "upload",
    slots: { side: null, rear: null, front: null },        // { src, video, name, size, file, w, h, bg, fit }
    create: { brand: "", headline: "", sub: "", cta: "", logoSrc: null, color: "#0b0b0b" }
  };
  try { var saved = JSON.parse(localStorage.getItem(CKEY) || "null"); if (saved) Object.keys(state.create).forEach(function (k) { if (saved[k] != null) state.create[k] = saved[k]; }); } catch (e) {}
  var saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(function () {
      try { localStorage.setItem(CKEY, JSON.stringify(state.create)); }
      catch (e) { try { localStorage.setItem(CKEY, JSON.stringify(Object.assign({}, state.create, { logoSrc: null }))); } catch (e2) {} }
    }, 250);
  }

  /* ───────── What's on the truck ───────── */
  var PLACEHOLDER = (function () {
    var s = A.newSlide("aotc");
    s.brand = "AOTC"; s.headline = "Your design here"; s.sub = "Upload it to see it on the truck"; s.cta = "";
    s.bg = { type: "solid", c1: "#121212", c2: "#121212", angle: 0 }; s.pattern = "grid"; s.text = "#ffffff"; s.accent = "#d9000d"; s.motion = "none"; s.layout = "center";
    return s;
  })();
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; return "#" + [r, g, b].map(function (v) { return Math.round(v * f).toString(16).padStart(2, "0"); }).join(""); }
  function createSlide() {
    var c = state.create, s = A.newSlide("opening"), col = c.color || "#0b0b0b";
    s.tpl = "custom"; s.font = "condensed"; s.layout = "stack"; s.pattern = "none"; s.motion = "slide";
    s.bg = { type: "gradient", c1: col, c2: shade(col, 0.35), angle: 135 };
    s.text = A.onColor(col); s.accent = A.contrast("#ffb100", col) >= 1.8 ? "#ffb100" : "#d9000d";
    s.brand = c.brand || "Your business"; s.headline = c.headline || "Your headline here"; s.sub = c.sub || ""; s.cta = c.cta || "Your call to action";
    s.logoSrc = c.logoSrc || null;
    return s;
  }
  function mediaSlide() {
    var any = SLOTS.some(function (k) { return state.slots[k]; });
    if (!any) return PLACEHOLDER;
    var slots = {};
    SLOTS.forEach(function (k) { var r = state.slots[k]; slots[k] = r ? { src: r.src, video: r.video, fit: r.fit, bg: r.bg } : null; });
    return { kind: "media", dur: 6, slots: slots, placeholder: PLACEHOLDER };
  }
  var current = PLACEHOLDER;
  function rebuild() { current = state.tab === "upload" ? mediaSlide() : createSlide(); }

  /* ───────── The truck, in real locations ───────── */
  var SKEY = "aotc_studio_scene", startScene = "wrigley";
  try { startScene = localStorage.getItem(SKEY) || startScene; } catch (e) {}
  var m = /[?&]scene=([\w-]+)/.exec(location.search); if (m) startScene = m[1];
  var strip = $("#scStrip");
  var stage = A.mountScene($("#stStage"), {
    getSlides: function () { return [current]; },
    getHold: function () { return 0; },
    scene: startScene,
    onScene: syncScene
  });
  A.SCENES.forEach(function (s) {
    var b = document.createElement("button"); b.type = "button"; b.className = "sc-thumb"; b.dataset.scene = s.id;
    b.innerHTML = '<img alt="" loading="lazy"><b></b><small></small>';
    $("img", b).src = s.thumb; $("b", b).textContent = s.name; $("small", b).textContent = s.sub;
    b.addEventListener("click", function () { stage.setScene(s.id); });
    strip.appendChild(b);
  });
  function syncScene(s) {
    $("#scName").textContent = s.name; $("#scSub").textContent = s.sub;
    var vis = Object.keys(s.screens), names = { side: "Side", rear: "Back", front: "Front" };
    $("#scShows").textContent = "Screens in this photo: " + ["side", "rear", "front"].filter(function (k) { return vis.indexOf(k) > -1; }).map(function (k) { return names[k]; }).join(" + ");
    $$(".st-slot").forEach(function (el) { el.classList.toggle("unseen", vis.indexOf(el.dataset.slot) < 0); });
    $$(".sc-thumb").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.scene === s.id); });
    var on = $('.sc-thumb[data-scene="' + s.id + '"]');
    if (on && strip && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: on.offsetLeft - strip.clientWidth / 2 + on.clientWidth / 2, behavior: "smooth" });
    try { localStorage.setItem(SKEY, s.id); } catch (e) {}
  }
  syncScene(stage.scene);
  function step(d) { var i = A.SCENES.indexOf(stage.scene); stage.setScene(A.SCENES[(i + d + A.SCENES.length) % A.SCENES.length].id); }
  $("#scPrev").addEventListener("click", function () { step(-1); });
  $("#scNext").addEventListener("click", function () { step(1); });
  document.addEventListener("keydown", function (e) {
    if (/input|textarea|select/i.test(document.activeElement.tagName) || $("#stModal").classList.contains("on")) return;
    var r = root.getBoundingClientRect(); if (r.bottom < 0 || r.top > innerHeight) return;   // only while the Studio is on screen
    if (e.key === "ArrowRight") step(1); if (e.key === "ArrowLeft") step(-1);
  });

  /* ───────── Tabs ───────── */
  function setTab(t) {
    state.tab = t;
    $("#tabUpload").setAttribute("aria-selected", t === "upload"); $("#tabCreate").setAttribute("aria-selected", t === "create");
    $("#paneUpload").classList.toggle("on", t === "upload"); $("#paneCreate").classList.toggle("on", t === "create");
    changed();
  }
  $("#tabUpload").addEventListener("click", function () { setTab("upload"); });
  $("#tabCreate").addEventListener("click", function () { setTab("create"); });

  /* ───────── Upload: one file per screen ───────── */
  function fmtSize(n) { return n > 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.round(n / 1024) + " KB"; }
  function edgeColor(el) {
    try {
      var c = document.createElement("canvas"); c.width = c.height = 16; var x = c.getContext("2d"); x.drawImage(el, 0, 0, 16, 16);
      var d = x.getImageData(0, 0, 16, 16).data, r = 0, g = 0, b = 0, n = 0;
      for (var i = 0; i < 16; i++) for (var j = 0; j < 16; j++) if (i === 0 || j === 0 || i === 15 || j === 15) { var k = (j * 16 + i) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
      return "#" + [r, g, b].map(function (v) { return Math.round(v / n).toString(16).padStart(2, "0"); }).join("");
    } catch (e) { return "#000000"; }
  }
  function takeFile(file, slot) {
    if (!file) return;
    var isVideo = /^video\//.test(file.type) || /\.(mp4|m4v|mov|webm)$/i.test(file.name), isImage = /^image\//.test(file.type);
    if (!isVideo && !isImage) return toast("Please upload an image (JPG, PNG) or a video (MP4)");
    var url = URL.createObjectURL(file), rec = { src: url, video: isVideo, name: file.name, size: file.size, file: file, bg: "#000000", fit: "fill" };
    function done() {
      var old = state.slots[slot]; if (old) URL.revokeObjectURL(old.src);
      state.slots[slot] = rec; changed();
      var seen = Object.keys(stage.scene.screens).indexOf(slot) > -1;
      toast(seen ? "Your " + LABEL[slot] + " design is on the truck" : "Added. The " + LABEL[slot] + " isn't in this photo. Try another location.");
    }
    if (isVideo) {
      var v = document.createElement("video"); v.muted = true; v.preload = "auto"; v.playsInline = true;
      v.onloadeddata = function () { rec.w = v.videoWidth; rec.h = v.videoHeight; rec.bg = edgeColor(v); done(); };
      v.onerror = function () { URL.revokeObjectURL(url); toast("That video can't play in this browser. Try an MP4 (H.264)."); };
      v.src = url;
    } else {
      var img = new Image();
      img.onload = function () { rec.w = img.naturalWidth; rec.h = img.naturalHeight; rec.bg = edgeColor(img); done(); };
      img.onerror = function () { URL.revokeObjectURL(url); toast("Couldn't read that image. Try a JPG or PNG."); };
      img.src = url;
    }
  }
  $$(".st-slot").forEach(function (el) {
    var slot = el.dataset.slot, drop = $("[data-drop]", el), input = $("input[type=file]", el), row = $(".st-file", el);
    function open() { input.click(); }
    drop.addEventListener("click", open);
    drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
    input.addEventListener("change", function () { takeFile(input.files[0], slot); input.value = ""; });
    [drop, row].forEach(function (z) {
      ["dragover", "dragenter"].forEach(function (ev) { z.addEventListener(ev, function (e) { e.preventDefault(); z.classList.add("over"); }); });
      ["dragleave", "drop"].forEach(function (ev) { z.addEventListener(ev, function () { z.classList.remove("over"); }); });
      z.addEventListener("drop", function (e) { e.preventDefault(); takeFile(e.dataTransfer.files[0], slot); });
    });
    row.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]"); if (!b) return;
      var r = state.slots[slot];
      if (b.dataset.act === "replace") open();
      if (b.dataset.act === "remove" && r) { URL.revokeObjectURL(r.src); state.slots[slot] = null; changed(); }
      if (b.dataset.act === "fill" && r) { r.fit = "fill"; changed(); }
      if (b.dataset.act === "fit" && r) { r.fit = "fit"; changed(); }
    });
  });
  // dropping a file on the truck photo sets the side design
  var st = $("#stStage");
  ["dragover", "dragenter"].forEach(function (ev) { st.addEventListener(ev, function (e) { e.preventDefault(); st.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { st.addEventListener(ev, function () { st.classList.remove("over"); }); });
  st.addEventListener("drop", function (e) { e.preventDefault(); if (state.tab !== "upload") setTab("upload"); takeFile(e.dataTransfer.files[0], "side"); });

  function renderSlot(el) {
    var slot = el.dataset.slot, r = state.slots[slot], drop = $("[data-drop]", el), row = $(".st-file", el), hint = $(".st-hint", el);
    drop.hidden = !!r; row.hidden = !r; el.classList.toggle("filled", !!r);
    if (!r) { row.innerHTML = ""; hint.textContent = ""; return; }
    if (row.dataset.src !== r.src) {
      row.dataset.src = r.src;
      row.innerHTML = '<div class="slot"></div><div class="meta"><b></b><small></small></div>' +
        '<div class="st-file-ctl"><div class="st-fit" role="group" aria-label="Fit"><button type="button" data-act="fill">Fill screen</button><button type="button" data-act="fit">Show all</button></div>' +
        '<button type="button" class="st-mini" data-act="replace">Replace</button><button type="button" class="st-mini" data-act="remove" aria-label="Remove file">Remove</button></div>';
      var t = document.createElement(r.video ? "video" : "img"); t.src = r.src;
      if (r.video) { t.muted = true; t.loop = true; t.autoplay = true; t.playsInline = true; } else t.alt = "";
      $(".slot", row).appendChild(t); $(".slot", row).style.aspectRatio = RATIO[slot];
      $("b", row).textContent = r.name;
      $("small", row).textContent = (r.video ? "Video · " : "Image · ") + (r.w ? r.w + " × " + r.h + " · " : "") + fmtSize(r.size);
    }
    $$("[data-act=fill],[data-act=fit]", row).forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.act === r.fit); });
    var ratio = r.w / r.h, target = RATIO[slot], off = Math.abs(Math.log(ratio / target));
    if (off < 0.06) hint.textContent = "Perfect fit for the " + LABEL[slot] + ".";
    else if (r.fit === "fill") hint.textContent = "A little " + (ratio > target ? "wider" : "taller") + " than the " + LABEL[slot] + ", so the " + (ratio > target ? "sides are" : "top and bottom are") + " trimmed. Choose Fit to show all of it.";
    else hint.textContent = "Showing all of it; the extra space uses a colour from your design's edge.";
  }

  /* ───────── Create ───────── */
  $$("[data-bind]", root).forEach(function (el) {
    el.addEventListener("input", function () { state.create[el.dataset.bind] = el.value; changed(); });
  });
  function readImage(file, cb) {
    if (!file || !/^image\//.test(file.type)) return toast("Please choose an image file");
    var r = new FileReader();
    r.onload = function () {
      var img = new Image();
      img.onload = function () {
        var k = Math.min(1, 900 / Math.max(img.naturalWidth, img.naturalHeight));
        if (k >= 1) return cb(r.result);
        var c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); cb(c.toDataURL("image/png"));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  }
  var dropLogo = $("#dropLogo"), upLogo = $("#upLogo");
  function setLogo(u) { state.create.logoSrc = u; changed(); }
  dropLogo.addEventListener("click", function (e) { if (!e.target.closest(".x")) upLogo.click(); });
  dropLogo.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); upLogo.click(); } });
  upLogo.addEventListener("change", function () { if (upLogo.files[0]) readImage(upLogo.files[0], setLogo); upLogo.value = ""; });
  ["dragover", "dragenter"].forEach(function (ev) { dropLogo.addEventListener(ev, function (e) { e.preventDefault(); dropLogo.classList.add("over"); }); });
  ["dragleave", "drop"].forEach(function (ev) { dropLogo.addEventListener(ev, function () { dropLogo.classList.remove("over"); }); });
  dropLogo.addEventListener("drop", function (e) { e.preventDefault(); var f = e.dataTransfer.files[0]; if (f) readImage(f, setLogo); });
  $(".x", dropLogo).addEventListener("click", function (e) { e.stopPropagation(); setLogo(null); });
  var COLORS = ["#0b0b0b", "#d9000d", "#0b2a7a", "#7b1fa2", "#0e5e3a", "#ff7a18", "#f4efe6"], colBox = $("#stColors");
  COLORS.forEach(function (c) {
    var b = document.createElement("button"); b.type = "button"; b.className = "st-sw"; b.style.background = c; b.dataset.c = c; b.setAttribute("aria-label", "Background " + c);
    b.addEventListener("click", function () { state.create.color = c; changed(); }); colBox.appendChild(b);
  });
  var pick = document.createElement("label"); pick.className = "st-sw st-pick"; pick.title = "Custom color";
  pick.innerHTML = '<input type="color" aria-label="Custom background color">'; colBox.appendChild(pick);
  $("input", pick).addEventListener("input", function (e) { state.create.color = e.target.value; changed(); });

  /* ───────── Sync ───────── */
  function sync() {
    var c = state.create;
    $$(".st-slot").forEach(renderSlot);
    $$("[data-bind]", root).forEach(function (el) { if (document.activeElement !== el) el.value = c[el.dataset.bind] || ""; });
    $$(".st-sw[data-c]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.c.toLowerCase() === String(c.color).toLowerCase()); });
    var slot = $(".slot-img", dropLogo);
    slot.innerHTML = c.logoSrc ? '<img alt="">' : '<div class="ph">+</div>'; if (c.logoSrc) $("img", slot).src = c.logoSrc;
    $("b", dropLogo).textContent = c.logoSrc ? "Logo added" : "Add your logo";
    $("small", dropLogo).textContent = c.logoSrc ? "Click or drop to replace" : "PNG or JPG · optional";
    $(".x", dropLogo).style.display = c.logoSrc ? "" : "none";
  }
  function changed() { rebuild(); sync(); save(); announce(); }
  /* Let the rest of the page show the visitor's design (the "You're next" spot in the client wall) */
  var annT;
  function announce() {
    clearTimeout(annT);
    annT = setTimeout(function () {
      var has = state.tab === "upload" ? SLOTS.some(function (k) { return state.slots[k]; }) : !!(state.create.headline || state.create.brand);
      window.dispatchEvent(new CustomEvent("aotc-studio-change", { detail: { has: has, draw: function (c) { A.render(c, "side", [current], 0, { slideIndex: 0, freezeAt: 99 }); } } }));
    }, 250);
  }

  /* ───────── Download & send ───────── */
  function name() { return state.tab === "upload" ? (state.slots.side ? state.slots.side.name.replace(/\.[^.]+$/, "") : "") : state.create.brand; }
  function slug() { return (name() || "aotc-display").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "aotc-display"; }
  function ready() {
    if (state.tab === "upload" && !SLOTS.some(function (k) { return state.slots[k]; })) {
      toast("Upload your design first"); var d = $('.st-slot[data-slot="side"] [data-drop]'); d.classList.add("nudge"); d.focus(); setTimeout(function () { d.classList.remove("nudge"); }, 900); return false;
    }
    if (state.tab === "create" && !state.create.headline) { toast("Add a headline first"); $("#fHead").focus(); return false; }
    return true;
  }
  $("#exPhoto").addEventListener("click", function () {
    if (!ready()) return;
    var b = this; b.disabled = true; b.textContent = "Rendering photo…";
    stage.export().then(function (c) {
      var a = document.createElement("a"); a.download = slug() + "-" + stage.scene.id + ".jpg"; a.href = c.toDataURL("image/jpeg", 0.92);
      document.body.appendChild(a); a.click(); a.remove(); toast("Photo saved");
    }).catch(function () { toast("Couldn't render the photo. Please try again."); })
      .then(function () { b.disabled = false; b.textContent = "Download the photo"; });
  });

  var MAX_ATTACH = 9.5 * 1048576;
  var modal = $("#stModal"), sheet = $(".st-sheet", modal), photo = null;
  $("#exSend").addEventListener("click", function () {
    if (!ready()) return;
    photo = null; $("#stPreview").removeAttribute("src");
    var big = state.tab === "upload" && SLOTS.some(function (k) { var r = state.slots[k]; return r && r.size > MAX_ATTACH; });
    $("#sendNote").textContent = big ? "One of your files is over 10 MB, so we'll send the preview and ask you for the original." : "No payment. Same-day follow-up.";
    sheet.classList.remove("sent"); modal.classList.add("on"); setTimeout(function () { $("#sdName").focus(); }, 50);
    stage.export().then(function (c) { photo = c.toDataURL("image/jpeg", 0.88); $("#stPreview").src = photo; }).catch(function () {});
  });
  $$("[data-close]", modal).forEach(function (b) { b.addEventListener("click", function () { modal.classList.remove("on"); }); });
  modal.addEventListener("click", function (e) { if (e.target === modal) modal.classList.remove("on"); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") modal.classList.remove("on"); });
  $("#stSendForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var f = e.target, btn = $("button[type=submit]", f), fd = new FormData(f);
    if (!fd.get("name") || !fd.get("contact")) return;
    btn.disabled = true; btn.textContent = "Sending…";
    fd.append("_subject", "[AOTC] Display Studio design — " + fd.get("name"));
    fd.append("_template", "table"); fd.append("_captcha", "false");
    fd.append("Submission Type", state.tab === "upload" ? "Display Studio — uploaded design" : "Display Studio — created design");
    fd.append("Location previewed", stage.scene.name);
    fd.append("Page URL", location.href);
    var jobs = [];
    if (state.tab === "upload") {
      SLOTS.forEach(function (k) {
        var r = state.slots[k], field = k === "side" ? "attachment" : "attachment_" + k;
        if (!r) { fd.append("File: " + LABEL[k], k === "side" ? "(none)" : "(uses the side design)"); return; }
        fd.append("Fit: " + LABEL[k], r.fit === "fill" ? "Fill the screen" : "Show all of it");
        if (r.size <= MAX_ATTACH) fd.append(field, r.file, r.file.name);
        else fd.append("File: " + LABEL[k], r.name + " (" + fmtSize(r.size) + ") — too large to attach, please request it");
      });
    } else {
      var c = state.create;
      fd.append("Design", [c.brand, c.headline, c.sub, c.cta].filter(Boolean).join(" | "));
      var side = document.createElement("canvas"), d = A.SCREENS.side.exp; side.width = d[0]; side.height = d[1];
      A.render(side, "side", [current], 0, { slideIndex: 0, freezeAt: 99 });
      jobs.push(new Promise(function (r) { side.toBlob(r, "image/png"); }).then(function (b) { fd.append("attachment", b, slug() + "-side-screen.png"); }));
    }
    if (photo) jobs.push(fetch(photo).then(function (r) { return r.blob(); }).then(function (b) { fd.append("attachment_photo", b, slug() + "-on-the-truck.jpg"); }));
    Promise.all(jobs).then(function () {
      return fetch("https://formsubmit.co/ajax/info@adsofthecentury.net", { method: "POST", headers: { Accept: "application/json" }, body: fd });
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok || String(j.success) === "false") throw 0; }); })   // FormSubmit can answer 200 without sending
      .then(function () { sheet.classList.add("sent"); })
      .catch(function () { toast("Couldn't send. Text (773) 708-1400 instead."); })
      .then(function () { btn.disabled = false; btn.innerHTML = "Send to AOTC &rarr;"; });
  });

  var toastEl = document.createElement("div"); toastEl.className = "st-toast"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl);
  var toT;
  function toast(msg) { toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(toT); toT = setTimeout(function () { toastEl.classList.remove("on"); }, 2800); }

  changed();
})();
