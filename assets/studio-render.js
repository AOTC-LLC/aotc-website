/* AOTC Display Studio — rendering engine.
   Draws a design (one or more slides) onto any AOTC screen, and builds the
   CSS-3D truck the designs are previewed on. Shared by display.html and the
   homepage teaser. No dependencies except optional qrcode-generator. */
(function (global) {
  "use strict";

  /* ───────── Screens (from AOTC's published specs) ───────── */
  var SCREENS = {
    side:  { key: "side",  label: "Side screens (×2)", ft: [11.76, 6.30], m: [3.584, 1.92], preview: [960, 514], exp: [1920, 1029] },
    rear:  { key: "rear",  label: "Rear screen",       ft: [6.71, 6.30],  m: [2.045, 1.92], preview: [540, 507], exp: [1080, 1014] },
    front: { key: "front", label: "Front screen",      ft: [6.71, 3.36],  m: [2.048, 1.024], preview: [640, 320], exp: [1280, 641] }
  };

  var FONTS = {
    condensed: { family: '"Barlow Condensed", Impact, "Arial Narrow", sans-serif', weight: 800, upper: true, lh: 0.9, cap: 0.7 },
    sans:      { family: '"Barlow", system-ui, sans-serif', weight: 800, upper: false, lh: 1.0, cap: 0.7 },
    serif:     { family: 'Georgia, "Times New Roman", serif', weight: 700, upper: false, lh: 1.04, cap: 0.68 },
    mono:      { family: '"IBM Plex Mono", ui-monospace, monospace', weight: 600, upper: true, lh: 1.04, cap: 0.66 }
  };

  /* ───────── Templates ───────── */
  var TEMPLATES = [
    { id: "opening", name: "Grand Opening", brand: "YOUR BRAND", headline: "Now open", sub: "Free fries all weekend · 123 N Clark", cta: "Opening day · Sat 11AM", font: "condensed", layout: "stack", bg: { type: "gradient", c1: "#d9000d", c2: "#2b0003", angle: 135 }, pattern: "rays", text: "#ffffff", accent: "#ffb100", motion: "slide" },
    { id: "gameday", name: "Game Day", brand: "CORNER TAP", headline: "Game day starts here", sub: "$5 drafts till first pitch", cta: "Show this screen · 20% off", font: "condensed", layout: "stack", bg: { type: "gradient", c1: "#0b2a7a", c2: "#04102e", angle: 160 }, pattern: "stripes", text: "#ffffff", accent: "#ff1520", motion: "pulse" },
    { id: "festival", name: "Festival / Event", brand: "SUMMER FEST", headline: "This Saturday", sub: "Live music · Food trucks · 60 vendors", cta: "Free entry · Gates 12PM", font: "condensed", layout: "center", bg: { type: "gradient", c1: "#7b1fa2", c2: "#ff3d6e", angle: 120 }, pattern: "dots", text: "#ffffff", accent: "#ffe14d", motion: "ticker" },
    { id: "launch", name: "Product Launch", brand: "NEW DROP", headline: "It's here.", sub: "Scan to be first in line", cta: "Available today only", font: "mono", layout: "stack", bg: { type: "solid", c1: "#070707", c2: "#070707", angle: 0 }, pattern: "grid", text: "#f4efe6", accent: "#27d17f", motion: "flash", qr: true },
    { id: "realestate", name: "Real Estate", brand: "YOUR REALTY", headline: "Just listed", sub: "3 bed · 2 bath · Lincoln Park", cta: "Call (773) 555-0123", font: "serif", layout: "split", bg: { type: "solid", c1: "#f4efe6", c2: "#e8e1d4", angle: 0 }, pattern: "none", text: "#111111", accent: "#d9000d", motion: "slide" },
    { id: "cause", name: "Cause / Advocacy", brand: "LOCAL 7", headline: "Fair contract now", sub: "Stand with 800 workers", cta: "Learn more · yoursite.org", font: "condensed", layout: "bigcta", bg: { type: "solid", c1: "#0d0d0d", c2: "#0d0d0d", angle: 0 }, pattern: "stripes", text: "#ffffff", accent: "#ffb100", motion: "pulse" },
    { id: "party", name: "Private Event", brand: "THE CREW", headline: "Happy 30th, Maya!", sub: "Love, the whole crew", cta: "Tonight · 9PM", font: "sans", layout: "center", bg: { type: "gradient", c1: "#ff7a18", c2: "#c2185b", angle: 45 }, pattern: "rays", text: "#ffffff", accent: "#ffffff", motion: "ticker" },
    { id: "aotc", name: "Rent This Space", brand: "AOTC", headline: "Your ad here", sub: "4 screens · all yours", cta: "Text (773) 708-1400", font: "condensed", layout: "stack", bg: { type: "gradient", c1: "#d9000d", c2: "#070707", angle: 200 }, pattern: "grid", text: "#ffffff", accent: "#ffffff", motion: "pulse" }
  ];

  function newSlide(tplId) {
    var t = TEMPLATES.filter(function (x) { return x.id === tplId; })[0] || TEMPLATES[0];
    return {
      tpl: t.id, brand: t.brand, headline: t.headline, sub: t.sub, cta: t.cta,
      font: t.font, layout: t.layout,
      bg: { type: t.bg.type, c1: t.bg.c1, c2: t.bg.c2, angle: t.bg.angle },
      pattern: t.pattern, text: t.text, accent: t.accent, motion: t.motion,
      qr: !!t.qr, qrUrl: "https://adsofthecentury.net",
      imgSrc: null, imgDim: 0.45, logoSrc: null, dur: 6
    };
  }
  function applyTemplate(slide, tplId) {
    var n = newSlide(tplId);
    n.imgSrc = slide.imgSrc; n.logoSrc = slide.logoSrc; n.dur = slide.dur;
    if (slide.imgSrc && n.bg.type !== "image") n.imgDim = slide.imgDim;
    return n;
  }

  /* ───────── Image cache (data URLs → Image) ───────── */
  var IMG = {};
  function getImg(src) {
    if (!src) return null;
    var i = IMG[src];
    if (!i) { i = new Image(); i.src = src; IMG[src] = i; }
    return i.complete && i.naturalWidth ? i : null;
  }

  /* ───────── Helpers ───────── */
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function easeOut(p) { p = clamp(p, 0, 1); return 1 - Math.pow(1 - p, 3); }
  function hexRgb(h) {
    h = (h || "#000").replace("#", "");
    if (h.length === 3) h = h.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function lum(h) {
    var c = hexRgb(h).map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function contrast(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function mix(a, b, t) { var x = hexRgb(a), y = hexRgb(b); return "rgb(" + [0, 1, 2].map(function (i) { return Math.round(x[i] + (y[i] - x[i]) * t); }).join(",") + ")"; }
  function onColor(bg) { return lum(bg) > 0.42 ? "#0b0b0b" : "#ffffff"; }
  function rgba(h, a) { var c = hexRgb(h); return "rgba(" + c[0] + "," + c[1] + "," + c[2] + "," + a + ")"; }
  /* The colour the text effectively sits on (for contrast checks). */
  function effectiveBg(s) {
    if (s.bg.type === "image" && s.imgSrc) return s.imgDim > 0.55 ? "#111111" : "#555555";
    if (s.bg.type === "gradient") return mix(s.bg.c1, s.bg.c2, 0.5).replace(/rgb\((\d+),(\d+),(\d+)\)/, function (_, r, g, b) {
      return "#" + [r, g, b].map(function (v) { return (+v).toString(16).padStart(2, "0"); }).join("");
    });
    return s.bg.c1;
  }

  function font(f, size) { return f.weight + " " + Math.round(size) + "px " + f.family; }
  function wrapLines(ctx, text, maxW) {
    var words = String(text).split(/\s+/).filter(Boolean), lines = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var test = cur ? cur + " " + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = words[i]; } else cur = test;
    }
    if (cur) lines.push(cur);
    return lines;
  }
  /* Largest font size where text fits maxW × maxH in ≤ maxLines lines. */
  var FIT = {}, FITN = 0;
  function fit(ctx, text, f, maxW, maxH, maxLines, minS, maxS) {
    if (!text) return { size: 0, lines: [], h: 0 };
    var key = f.family + f.weight + "|" + text + "|" + (maxW | 0) + "|" + (maxH | 0) + "|" + maxLines + "|" + (minS | 0) + "|" + (maxS | 0);
    if (FIT[key]) return FIT[key];
    if (++FITN > 800) { FIT = {}; FITN = 0; }
    return (FIT[key] = fitRaw(ctx, text, f, maxW, maxH, maxLines, minS, maxS));
  }
  function fitRaw(ctx, text, f, maxW, maxH, maxLines, minS, maxS) {
    var lo = minS, hi = maxS, best = null;
    for (var k = 0; k < 14; k++) {
      var s = (lo + hi) / 2; ctx.font = font(f, s);
      var lines = wrapLines(ctx, text, maxW), ok = lines.length <= maxLines && lines.length * s * f.lh <= maxH;
      for (var j = 0; ok && j < lines.length; j++) if (ctx.measureText(lines[j]).width > maxW) ok = false;
      if (ok) { best = { size: s, lines: lines }; lo = s; } else hi = s;
    }
    if (!best) { ctx.font = font(f, minS); best = { size: minS, lines: wrapLines(ctx, text, maxW).slice(0, maxLines) }; }
    best.h = best.lines.length * best.size * f.lh;
    return best;
  }
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  /* AOTC's notched-corner shape (matches the site's clip-path buttons). */
  function notch(ctx, x, y, w, h, n) {
    ctx.beginPath(); ctx.moveTo(x + n, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + h - n); ctx.lineTo(x + w - n, y + h);
    ctx.lineTo(x, y + h); ctx.lineTo(x, y + n); ctx.closePath();
  }

  /* ───────── Background ───────── */
  function drawBg(ctx, w, h, s, lt) {
    var b = s.bg;
    if (b.type === "gradient") {
      var a = (b.angle || 0) * Math.PI / 180, cx = w / 2, cy = h / 2, r = Math.hypot(w, h) / 2;
      var g = ctx.createLinearGradient(cx - Math.cos(a) * r, cy - Math.sin(a) * r, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      g.addColorStop(0, b.c1); g.addColorStop(1, b.c2); ctx.fillStyle = g;
    } else ctx.fillStyle = b.c1;
    ctx.fillRect(0, 0, w, h);

    var img = s.bg.type === "image" ? getImg(s.imgSrc) : null;
    if (img) {
      var zoom = s.motion === "kenburns" ? 1 + 0.08 * clamp(lt / Math.max(s.dur, 1), 0, 1) : 1;
      var sc = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
      var iw = img.naturalWidth * sc, ih = img.naturalHeight * sc;
      ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      var g2 = ctx.createLinearGradient(0, 0, w, 0);
      g2.addColorStop(0, "rgba(0,0,0," + clamp(s.imgDim + 0.2, 0, 0.95) + ")"); g2.addColorStop(1, "rgba(0,0,0," + clamp(s.imgDim - 0.15, 0, 0.9) + ")");
      ctx.fillStyle = g2; ctx.fillRect(0, 0, w, h);
    }
    drawPattern(ctx, w, h, s, lt);
  }
  function drawPattern(ctx, w, h, s, lt) {
    var p = s.pattern, col = rgba(s.accent, 0.1);
    if (!p || p === "none") return;
    ctx.save();
    if (p === "rays") {
      var cx = w * 0.82, cy = h * 0.1, n = 18, rot = lt * 0.08;
      ctx.fillStyle = rgba(s.text, 0.07);
      for (var i = 0; i < n; i++) {
        var a0 = rot + i * Math.PI * 2 / n, a1 = a0 + Math.PI / n;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, Math.hypot(w, h), a0, a1); ctx.closePath(); ctx.fill();
      }
    } else if (p === "grid") {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, h / 300);
      var step = h / 9, off = (lt * step * 0.25) % step;
      for (var x = -step + off; x < w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (var y = 0; y < h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    } else if (p === "stripes") {
      ctx.fillStyle = rgba(s.accent, 0.12);
      var sw = h / 7, off2 = (lt * sw * 0.6) % (sw * 2);
      ctx.translate(off2, 0);
      for (var k = -h - sw * 2; k < w + h; k += sw * 2) {
        ctx.beginPath(); ctx.moveTo(k, h); ctx.lineTo(k + sw, h); ctx.lineTo(k + sw + h, 0); ctx.lineTo(k + h, 0); ctx.closePath(); ctx.fill();
      }
    } else if (p === "dots") {
      ctx.fillStyle = rgba(s.text, 0.12);
      var d = h / 14;
      for (var yy = d / 2; yy < h; yy += d) for (var xx = d / 2; xx < w; xx += d) {
        var r = d * 0.16 * (1 + 0.5 * Math.sin(lt * 2 + xx * 0.02 + yy * 0.03));
        ctx.beginPath(); ctx.arc(xx, yy, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  /* ───────── QR ───────── */
  var QRC = {};
  function qrMatrix(url) {
    if (QRC[url]) return QRC[url];
    if (!global.qrcode) return null;
    try { var q = global.qrcode(0, "M"); q.addData(url || " "); q.make(); QRC[url] = q; return q; } catch (e) { return null; }
  }
  function drawQR(ctx, x, y, size, url, accent) {
    ctx.fillStyle = "#ffffff"; roundRect(ctx, x, y, size, size, size * 0.06); ctx.fill();
    var q = qrMatrix(url), pad = size * 0.08, inner = size - pad * 2;
    if (!q) { ctx.fillStyle = "#000"; ctx.font = "700 " + size * 0.2 + "px monospace"; ctx.textAlign = "center"; ctx.fillText("QR", x + size / 2, y + size * 0.58); ctx.textAlign = "left"; return; }
    var n = q.getModuleCount(), m = inner / n;
    ctx.fillStyle = "#0b0b0b";
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (q.isDark(r, c)) ctx.fillRect(x + pad + c * m, y + pad + r * m, Math.ceil(m), Math.ceil(m));
    ctx.fillStyle = accent; ctx.fillRect(x, y + size + size * 0.04, size, Math.max(2, size * 0.03));
  }

  /* ───────── One slide on one screen ───────── */
  /* ───────── Uploaded designs (image or video) ───────── */
  var VID = {};
  function getMedia(m) {
    if (!m || !m.src) return null;
    if (!m.video) { var i = getImg(m.src); return i ? { el: i, w: i.naturalWidth, h: i.naturalHeight } : null; }
    var v = VID[m.src];
    if (!v) {
      v = document.createElement("video"); v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = true;
      v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.crossOrigin = "anonymous"; v.src = m.src;
      var p = v.play(); if (p && p.catch) p.catch(function () {});
      VID[m.src] = v;
    }
    return v.readyState >= 2 && v.videoWidth ? { el: v, w: v.videoWidth, h: v.videoHeight } : null;
  }
  /* s.slots = { side, rear, front } — each screen uses its own upload, else the side design. */
  function drawMedia(ctx, w, h, screen, s) {
    var sl = s.slots || { side: s.main, rear: s.rear }, m = sl[screen] || sl.side;
    if (!m) return s.placeholder ? drawSlide(ctx, w, h, screen, s.placeholder, 99) : {};
    var fit = m.fit || "fill";
    ctx.fillStyle = m.bg || "#000"; ctx.fillRect(0, 0, w, h);
    var g = getMedia(m); if (!g) return {};
    var k = fit === "fill" ? Math.max(w / g.w, h / g.h) : Math.min(w / g.w, h / g.h);
    ctx.drawImage(g.el, (w - g.w * k) / 2, (h - g.h * k) / 2, g.w * k, g.h * k);
    return {};
  }

  function drawSlide(ctx, w, h, screen, s, lt) {
    if (s.kind === "media") return drawMedia(ctx, w, h, screen, s);
    var f = FONTS[s.font] || FONTS.condensed, up = function (t) { return f.upper ? String(t || "").toUpperCase() : String(t || ""); };
    var isSide = screen === "side", isRear = screen === "rear", isFront = screen === "front";
    var pad = h * (isFront ? 0.1 : 0.075), motion = s.motion;
    ctx.save(); ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
    drawBg(ctx, w, h, s, lt);

    // Photo panel for split layout (side/rear)
    var img = getImg(s.imgSrc), contentR = w - pad, contentL = pad;
    if (s.layout === "split" && img && s.bg.type !== "image" && !isFront) {
      ctx.save();
      var px = isSide ? w * 0.52 : 0, py = 0, pw = isSide ? w - px : w, ph = isSide ? h : h * 0.42;
      ctx.beginPath();
      if (isSide) { ctx.moveTo(px + h * 0.18, 0); ctx.lineTo(w, 0); ctx.lineTo(w, h); ctx.lineTo(px, h); }
      else { ctx.rect(0, 0, w, ph); }
      ctx.closePath(); ctx.clip();
      var sc = Math.max(pw / img.naturalWidth, ph / img.naturalHeight) * (motion === "kenburns" ? 1 + 0.06 * clamp(lt / s.dur, 0, 1) : 1);
      ctx.drawImage(img, px + (pw - img.naturalWidth * sc) / 2, py + (ph - img.naturalHeight * sc) / 2, img.naturalWidth * sc, img.naturalHeight * sc);
      ctx.restore();
      ctx.fillStyle = s.accent;
      if (isSide) { ctx.beginPath(); ctx.moveTo(px + h * 0.18, 0); ctx.lineTo(px + h * 0.18 + h * 0.025, 0); ctx.lineTo(px + h * 0.025, h); ctx.lineTo(px, h); ctx.fill(); contentR = px - pad * 0.3; }
      else { ctx.fillRect(0, ph, w, h * 0.012); }
      if (isRear) pad = pad; // rear content goes below photo
    }
    var top = pad;
    if (s.layout === "split" && img && s.bg.type !== "image" && isRear) top = h * 0.42 + pad * 0.7;

    // CTA band
    var bandH = 0, ctaText = up(s.cta);
    if (ctaText && !isFront) bandH = h * (s.layout === "bigcta" ? 0.3 : isRear ? 0.17 : 0.16);
    var bandIn = motion === "slide" ? easeOut((lt - 0.35) / 0.6) : 1;

    // QR
    var qrS = 0;
    if (s.qr && !isFront) {
      qrS = isSide ? Math.min(h - bandH - pad * 2, w * 0.24) * 0.92 : Math.min((h - bandH) * 0.36, w * 0.36);
      if (s.layout === "split" && img && isSide) qrS = Math.min(qrS, h * 0.34);
    }

    // Logo / brand row
    var logo = getImg(s.logoSrc), brandH = 0;
    if (isFront) {
      // Front: logo/brand left, headline right — one glance
      var lx = pad;
      if (logo) {
        var lh = h - pad * 2, lw = Math.min(lh * logo.naturalWidth / logo.naturalHeight, w * 0.38);
        lh = lw * logo.naturalHeight / logo.naturalWidth;
        ctx.drawImage(logo, lx, (h - lh) / 2, lw, lh); lx += lw + pad;
      }
      var ftxt = up(s.headline || s.brand);
      var fr = fit(ctx, ftxt, f, w - lx - pad, h - pad * 2, 2, h * 0.12, h * 0.62);
      ctx.fillStyle = s.text; ctx.font = font(f, fr.size);
      var fy = (h - fr.h) / 2 + fr.size * f.cap + fr.size * (f.lh - f.cap) * 0.2;
      fr.lines.forEach(function (ln, i) { ctx.fillText(ln, lx, fy + i * fr.size * f.lh); });
      ctx.fillStyle = s.accent; ctx.fillRect(0, h - h * 0.05, w, h * 0.05);
      ctx.restore(); return { headSize: fr.size };
    }
    if (logo) {
      brandH = h * (isRear ? 0.13 : 0.15);
      var bw = Math.min(brandH * logo.naturalWidth / logo.naturalHeight, w * 0.32);
      var bh = bw * logo.naturalHeight / logo.naturalWidth;
      var bx = s.layout === "center" ? (w - bw) / 2 : contentL;
      ctx.drawImage(logo, bx, top, bw, bh); brandH = bh + pad * 0.45;
    } else if (s.brand) {
      var bs = h * (isRear ? 0.055 : 0.058);
      ctx.font = "600 " + bs + "px " + FONTS.mono.family; ctx.fillStyle = s.accent;
      // tracked-out label, drawn letter by letter (no reliance on fonts having hair spaces)
      var bt = String(s.brand).toUpperCase(), sp = bs * 0.18, chars = bt.split("");
      var btw = chars.reduce(function (a, ch) { return a + ctx.measureText(ch).width; }, 0) + sp * Math.max(0, chars.length - 1);
      var bxx = s.layout === "center" ? (w - btw) / 2 : contentL;
      if (s.layout !== "center") { ctx.fillRect(contentL, top + bs * 0.38, bs * 1.1, Math.max(2, bs * 0.12)); bxx = contentL + bs * 1.5; }
      chars.forEach(function (ch) { ctx.fillText(ch, bxx, top + bs * 0.8); bxx += ctx.measureText(ch).width + sp; });
      brandH = bs * 1.6;
    }

    // Text block
    var areaTop = top + brandH, areaBot = h - bandH - pad * 0.8;
    var areaR = contentR - (qrS && isSide ? qrS + pad * 0.6 : 0);
    var areaW = areaR - contentL, areaH = areaBot - areaTop;
    if (isRear && qrS) areaH -= qrS * 0.15;
    var subText = up(s.sub), hasSub = !!subText && motion !== "ticker";
    var headShare = s.layout === "bigcta" ? (hasSub ? 0.62 : 0.95) : (hasSub ? 0.7 : 0.95);
    var hr = fit(ctx, up(s.headline), f, areaW, areaH * headShare, isRear ? 3 : 2, h * 0.06, h * (s.layout === "bigcta" ? 0.26 : 0.4));
    var sr = hasSub ? fit(ctx, subText, FONTS[s.font === "mono" ? "mono" : "sans"], areaW, areaH * (1 - headShare) * 0.9, 2, h * 0.035, Math.min(h * 0.075, hr.size * 0.42)) : { size: 0, lines: [], h: 0 };
    var gap = hasSub ? hr.size * 0.25 : 0, blockH = hr.h + gap + sr.h;
    var by = areaTop + (areaH - blockH) * (s.layout === "center" ? 0.5 : 0.45);
    var center = s.layout === "center";

    var inH = motion === "slide" ? easeOut(lt / 0.7) : 1, inS = motion === "slide" ? easeOut((lt - 0.15) / 0.7) : 1;
    var flash = motion === "flash" && (lt < 0.6 ? Math.floor(lt * 10) % 2 === 0 : (lt % 3.2) < 0.08);

    ctx.save();
    ctx.globalAlpha = inH; ctx.translate((1 - inH) * -w * 0.12, 0);
    ctx.font = font(f, hr.size); ctx.fillStyle = flash ? s.accent : s.text;
    if (lum(effectiveBg(s)) < 0.5 && s.bg.type === "image") { ctx.shadowColor = "rgba(0,0,0,.55)"; ctx.shadowBlur = hr.size * 0.15; }
    hr.lines.forEach(function (ln, i) {
      var lx2 = center ? (w - ctx.measureText(ln).width) / 2 : contentL;
      ctx.fillText(ln, lx2, by + hr.size * f.cap + i * hr.size * f.lh + hr.size * (f.lh - f.cap) * 0.15);
    });
    ctx.restore();

    if (hasSub) {
      ctx.save(); ctx.globalAlpha = inS * 0.92; ctx.translate((1 - inS) * -w * 0.08, 0);
      var sf = FONTS[s.font === "mono" ? "mono" : "sans"];
      ctx.font = (s.font === "mono" ? 500 : 600) + " " + sr.size + "px " + sf.family; ctx.fillStyle = s.text;
      sr.lines.forEach(function (ln, i) {
        var lx3 = center ? (w - ctx.measureText(ln).width) / 2 : contentL;
        ctx.fillText(ln, lx3, by + hr.h + gap + sr.size * 0.85 + i * sr.size * 1.15);
      });
      ctx.restore();
    }

    // Ticker band (sub crawls above the CTA band)
    if (motion === "ticker" && subText) {
      var th = h * 0.1, ty = h - bandH - th;
      ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(0, ty, w, th);
      ctx.font = "700 " + th * 0.52 + "px " + FONTS.sans.family; ctx.fillStyle = s.text;
      var item = subText + "   ✦   ", iw = ctx.measureText(item).width, off = (lt * w * 0.18) % iw;
      for (var tx = -off; tx < w; tx += iw) ctx.fillText(item, tx, ty + th * 0.68);
    }

    // QR
    if (qrS) {
      var qx = isSide ? contentR - qrS : w - pad - qrS, qy = isSide ? pad + (h - bandH - pad * 2 - qrS) / 2 : h - bandH - pad * 0.6 - qrS;
      if (isRear) { qx = w - pad - qrS; qy = areaTop + (areaH - qrS) / 2; }
      drawQR(ctx, qx, qy, qrS, s.qrUrl, s.accent);
    }

    // CTA band
    if (bandH) {
      ctx.save();
      var bwid = w * bandIn, pulse = motion === "pulse" ? 1 + 0.035 * Math.sin(lt * 5) : 1;
      ctx.fillStyle = s.accent; ctx.fillRect(0, h - bandH, bwid, bandH);
      if (motion === "pulse") { ctx.fillStyle = rgba(onColor(s.accent), 0.08 + 0.08 * Math.sin(lt * 5)); ctx.fillRect(0, h - bandH, bwid, bandH); }
      ctx.beginPath(); ctx.rect(0, h - bandH, bwid, bandH); ctx.clip();
      var cf = s.layout === "bigcta" ? FONTS[s.font] : FONTS.condensed;
      var cr = fit(ctx, ctaText, cf, w - pad * 2, bandH * 0.78, 1, bandH * 0.25, bandH * 0.72);
      ctx.font = font(cf, cr.size * pulse); ctx.fillStyle = onColor(s.accent);
      var ctw = ctx.measureText(cr.lines[0] || "").width;
      var cx = center || isRear || s.layout === "bigcta" ? (w - ctw) / 2 : pad;
      ctx.fillText(cr.lines[0] || "", cx, h - bandH / 2 + cr.size * pulse * cf.cap / 2);
      ctx.restore();
    }
    ctx.restore();
    return { headSize: hr.size, headLines: hr.lines.length };
  }

  /* ───────── Slideshow with crossfade ───────── */
  var BUF = {};
  function buffer(w, h, id) {
    var k = id + w + "x" + h, b = BUF[k];
    if (!b) { b = document.createElement("canvas"); b.width = w; b.height = h; BUF[k] = b; }
    return b;
  }
  function totalDur(slides) { return slides.reduce(function (a, s) { return a + Math.max(1, +s.dur || 6); }, 0); }
  function slideAt(slides, t) {
    var T = totalDur(slides), tt = ((t % T) + T) % T, acc = 0;
    for (var i = 0; i < slides.length; i++) { var d = Math.max(1, +slides[i].dur || 6); if (tt < acc + d) return { i: i, lt: tt - acc, d: d }; acc += d; }
    return { i: 0, lt: 0, d: 6 };
  }
  var FADE = 0.45;
  function render(canvas, screen, slides, t, opts) {
    opts = opts || {};
    var ctx = canvas.getContext("2d"), w = canvas.width, h = canvas.height;
    if (!slides || !slides.length) return;
    var at = opts.slideIndex != null ? { i: opts.slideIndex, lt: opts.freezeAt != null ? opts.freezeAt : t, d: 99 } : slideAt(slides, t);
    var s = slides[at.i];
    var info = drawSlide(ctx, w, h, screen, s, at.lt);
    if (opts.slideIndex == null && slides.length > 1 && at.lt < FADE) {
      var prev = slides[(at.i - 1 + slides.length) % slides.length], b = buffer(w, h, screen);
      drawSlide(b.getContext("2d"), w, h, screen, prev, Math.max(1, +prev.dur || 6) - FADE + at.lt);
      ctx.save(); ctx.globalAlpha = 1 - at.lt / FADE; ctx.drawImage(b, 0, 0); ctx.restore();
    }
    if (opts.led) ledMesh(ctx, w, h);
    if (opts.safe) safeZone(ctx, w, h);
    return { slide: at.i, info: info };
  }
  var MESH = null;
  function ledMesh(ctx, w, h) {
    if (!MESH) {
      var m = document.createElement("canvas"); m.width = m.height = 4; var c = m.getContext("2d");
      c.fillStyle = "rgba(0,0,0,.28)"; c.fillRect(3, 0, 1, 4); c.fillRect(0, 3, 4, 1);
      MESH = m;
    }
    ctx.save(); ctx.fillStyle = ctx.createPattern(MESH, "repeat"); ctx.fillRect(0, 0, w, h); ctx.restore();
  }
  function safeZone(ctx, w, h) {
    var p = h * 0.06;
    ctx.save(); ctx.setLineDash([h * 0.02, h * 0.015]); ctx.lineWidth = Math.max(1.5, h / 260); ctx.strokeStyle = "rgba(39,209,127,.95)";
    ctx.strokeRect(p, p, w - p * 2, h - p * 2);
    ctx.fillStyle = "rgba(39,209,127,.95)"; ctx.font = "600 " + h * 0.035 + "px " + FONTS.mono.family; ctx.fillText("SAFE AREA", p + h * 0.015, p + h * 0.05);
    ctx.restore();
  }

  /* ───────── Glance test (legibility at street speed) ───────── */
  function analyze(slide) {
    var c = document.createElement("canvas"), dims = SCREENS.side.preview; c.width = dims[0]; c.height = dims[1];
    var info = drawSlide(c.getContext("2d"), dims[0], dims[1], "side", slide, 99) || {};
    var f = FONTS[slide.font] || FONTS.condensed;
    var inchPerPx = (SCREENS.side.ft[1] * 12) / dims[1];
    var letterIn = (info.headSize || 0) * f.cap * inchPerPx;
    var readFt = Math.round(letterIn * 30);            // ~30 ft of legibility per inch of letter height
    var mph35 = 35 * 5280 / 3600;                       // ft per second at 35 mph
    var glanceSec = readFt / mph35;
    var words = (slide.headline + " " + (slide.sub || "")).split(/\s+/).filter(function (w) { return /[A-Za-z0-9]/.test(w); }).length;
    var ratio = contrast(slide.text, effectiveBg(slide));
    var checks = [
      { k: "words", ok: words <= 9, warn: words <= 12, label: words + " words in the main message", tip: words <= 9 ? "Short enough to read in one glance." : "Aim for 7–9 words. Every extra word costs glance time." },
      { k: "size", ok: readFt >= 180, warn: readFt >= 110, label: "Headline readable to ~" + readFt + " ft", tip: "≈ " + glanceSec.toFixed(1) + " s of reading time for a driver at 35 mph." },
      { k: "contrast", ok: ratio >= 7, warn: ratio >= 4.5, label: "Contrast " + ratio.toFixed(1) + " : 1", tip: ratio >= 7 ? "Pops in daylight and at night." : "Push text and background further apart for daylight." },
      { k: "cta", ok: !!(slide.cta || slide.qr), warn: false, label: slide.cta || slide.qr ? "Clear next step" : "No call to action", tip: "Tell people exactly what to do: call, scan, show up." },
      { k: "brand", ok: !!(slide.logoSrc || slide.brand), warn: false, label: slide.logoSrc ? "Logo on screen" : slide.brand ? "Brand name on screen" : "No brand", tip: "Recall needs a name to attach to." }
    ];
    var score = checks.reduce(function (a, x) { return a + (x.ok ? 20 : x.warn ? 11 : 0); }, 0);
    var grade = score >= 90 ? "A" : score >= 78 ? "B" : score >= 62 ? "C" : score >= 45 ? "D" : "F";
    return { score: score, grade: grade, checks: checks, readFt: readFt, glanceSec: glanceSec, ratio: ratio };
  }

  /* Text measurements depend on web fonts — drop cached fits once they arrive. */
  if (document.fonts) {
    var reset = function () { FIT = {}; FITN = 0; };
    if (document.fonts.addEventListener) document.fonts.addEventListener("loadingdone", reset);
    if (document.fonts.ready) document.fonts.ready.then(reset);
    ["800 40px 'Barlow Condensed'", "800 40px Barlow", "600 40px Barlow", "600 40px 'IBM Plex Mono'"].forEach(function (f) { try { document.fonts.load(f); } catch (e) {} });
  }

  global.AOTCStudio = {
    SCREENS: SCREENS, FONTS: FONTS, TEMPLATES: TEMPLATES, newSlide: newSlide, applyTemplate: applyTemplate,
    render: render, drawSlide: drawSlide, analyze: analyze, totalDur: totalDur, slideAt: slideAt,
    getImg: getImg, getMedia: getMedia, contrast: contrast, onColor: onColor
  };
})(window);
