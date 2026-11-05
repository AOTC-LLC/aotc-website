/* AOTC Display Studio — photoreal scenes.
   Real photos of the AOTC truck. Each LED screen's boundary was detected in the
   photo to sub-pixel precision (dev/refine.html): four corners for perspective
   plus a per-edge bow for lens curvature. Designs are drawn onto that surface on
   the GPU (perspective + curvature mesh), graded and lit to match the photo.
   mountScene(el, { getSlides, getHold, scene, onFrame, onScene }) → api */
(function (global) {
  "use strict";
  var A = global.AOTCStudio;
  var BASE = (document.currentScript && document.currentScript.src.replace(/[^/]*$/, "")) || "assets/";

  /* How an LED screen reads in each light: brightness, contrast, saturation,
     glass sheen, edge falloff, and glow spill onto the truck body. */
  var LIGHT = {
    sun:      { b: .92, c: .84, s: .88, sheen: .14, inner: .34, glow: 0 },
    day:      { b: .92, c: .90, s: .92, sheen: .10, inner: .30, glow: 0 },
    overcast: { b: .88, c: .86, s: .86, sheen: .07, inner: .30, glow: .05 },
    washed:   { b: .74, c: .74, s: .78, sheen: .20, inner: .30, glow: 0 },
    dusk:     { b: 1.02, c: .98, s: 1.05, sheen: .05, inner: .22, glow: .4 },
    night:    { b: 1.10, c: 1.02, s: 1.14, sheen: .03, inner: .16, glow: .75 }
  };

  /* Screen geometry in the photo's own pixels. quad = TL, TR, BR, BL of the lit area;
     bow = outward bulge (px) at the middle of the top, right, bottom and left edges. */
  var SCENES = [
    { id: "wrigley", name: "Wrigley Field", sub: "Wrigleyville · Blue hour", w: 1800, h: 1010, light: "dusk", lock: { front: [2] },
      screens: { side: { quad: [[114.4, 461.3], [565.7, 444.3], [553.7, 754.3], [96.5, 732.9]], bow: [0.45, 0, 0, 0] }, front: { quad: [[613.4, 440.1], [740.8, 477.9], [739.46, 593.23], [608.58, 599.07]], bow: [-0.58, -1.08, 0, 0] } },
      // the cab roof in front of the front screen, traced 0.5px inside the roof edge
      occlude: [[[668, 640], [670.6, 597.4], [671.8, 594], [676, 593.7], [680, 592.5], [685, 592], [690, 591.6], [694, 590.6], [698, 590.2], [704, 590.2], [710, 589.85], [720, 589.8], [726, 590.4], [732, 590.6], [736, 590.75], [740, 591.2], [748, 592], [760, 596], [764, 600], [764, 640]]] },
    { id: "downtown-day", name: "The Loop", sub: "Downtown · Daytime", w: 1112, h: 695, light: "overcast",
      screens: { rear: { quad: [[180.6, 167.2], [364.3, 95.6], [340.9, 450.8], [156.2, 444.8]], bow: [0, -1.33, 0, 0.75] }, side: { quad: [[423.3, 76.9], [741.9, 223.9], [742, 453.7], [401.1, 430.9]], bow: [0, 0.41, 0.52, 0.81] } } },
    { id: "downtown-night", name: "Downtown", sub: "Night run", w: 1179, h: 689, light: "night",
      screens: { side: { quad: [[510.8, 369.5], [583.3, 277.8], [576.4, 497.9], [508.1, 493.9]], bow: [4.6, 1.21, 0, 0.5] }, rear: { quad: [[617.3, 290.7], [800.7, 316.6], [809.9, 511.3], [613.3, 516.9]], bow: [1.64, 2.32, 0.33, 0] } } },
    { id: "skyline-sunset", name: "Chicago Skyline", sub: "Sunset · Willis Tower", w: 1280, h: 720, light: "dusk", lock: { front: [2] },
      screens: { side: { quad: [[152.9, 239], [387.7, 171.1], [376.4, 429.3], [138.8, 425.5]], bow: [0, 0, 0, -0.67] }, front: { quad: [[429.8, 170.2], [580.4, 240.4], [580.25, 335.46], [425.81, 302.86]], bow: [-0.38, 0, 0, 0] } },
      // the pickup's roof in front of the front screen, traced 0.5px inside the roof edge
      occlude: [[[470, 352], [472.2, 313.4], [474.6, 306.4], [476, 306.3], [480, 305.8], [488, 305.2], [496, 304.4], [504, 303.7], [512, 303.3], [520, 302.5], [528, 301.7], [536, 301.5], [544, 301.6], [548, 302.8], [552, 304], [560, 304.3], [568, 304.9], [576, 305.6], [584, 307.2], [592, 307.9], [600, 308.5], [600, 352]]] },
  ];
  SCENES.forEach(function (s) { s.img = BASE + "scenes/" + s.id + ".jpg"; s.thumb = BASE + "scenes/" + s.id + "-thumb.jpg"; });

  /* ───────── Geometry ───────── */
  function solve(A8, b) {
    var n = 8, M = A8.map(function (r, i) { return r.concat([b[i]]); });
    for (var c = 0; c < n; c++) {
      var p = c; for (var r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      var t = M[c]; M[c] = M[p]; M[p] = t;
      for (r = 0; r < n; r++) if (r !== c) { var f = M[r][c] / M[c][c]; for (var k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map(function (r, i) { return r[n] / r[i]; });
  }
  function homography(src, dst) {
    var Am = [], b = [];
    for (var i = 0; i < 4; i++) {
      var x = src[i][0], y = src[i][1], u = dst[i][0], v = dst[i][1];
      Am.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      Am.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    var h = solve(Am, b); h.push(1); return h;
  }
  function project(H, x, y) { var w = H[6] * x + H[7] * y + 1; return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w]; }
  function matrix3d(H) { return "matrix3d(" + [H[0], H[3], 0, H[6], H[1], H[4], 0, H[7], 0, 0, 1, 0, H[2], H[5], 0, 1].join(",") + ")"; }
  function centroid(q) { return [(q[0][0] + q[1][0] + q[2][0] + q[3][0]) / 4, (q[0][1] + q[1][1] + q[2][1] + q[3][1]) / 4]; }
  function grow(q, px) {
    var c = centroid(q);
    return q.map(function (p) { var dx = p[0] - c[0], dy = p[1] - c[1], l = Math.hypot(dx, dy) || 1; return [p[0] + dx / l * px, p[1] + dy / l * px]; });
  }
  function quadOf(s) { return s.quad || s; }
  function quadH(q) { return (Math.hypot(q[3][0] - q[0][0], q[3][1] - q[0][1]) + Math.hypot(q[2][0] - q[1][0], q[2][1] - q[1][1])) / 2; }
  function bbox(scene) {
    var xs = [], ys = [];
    Object.keys(scene.screens).forEach(function (k) { quadOf(scene.screens[k]).forEach(function (p) { xs.push(p[0]); ys.push(p[1]); }); });
    return { x0: Math.min.apply(0, xs), y0: Math.min.apply(0, ys), x1: Math.max.apply(0, xs), y1: Math.max.apply(0, ys) };
  }
  /* Perspective + lens curvature: point on the screen surface for (u, v) ∈ [0,1]². */
  function surface(scr, N, growPx) {
    var q = grow(quadOf(scr), growPx == null ? 1.6 : growPx), bow = scr.bow || [0, 0, 0, 0], H = homography([[0, 0], [1, 0], [1, 1], [0, 1]], q), c = centroid(q);
    var n = [0, 1, 2, 3].map(function (k) {
      var a = q[k], b = q[(k + 1) % 4], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
      if ((nx * ((a[0] + b[0]) / 2 - c[0]) + ny * ((a[1] + b[1]) / 2 - c[1])) < 0) { nx = -nx; ny = -ny; }
      return [nx, ny];
    });
    function frac(p, a, b) { var dx = b[0] - a[0], dy = b[1] - a[1]; return Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy))); }
    function g(t) { return 4 * t * (1 - t); }
    var pos = [];
    for (var j = 0; j <= N; j++) for (var i = 0; i <= N; i++) {
      var u = i / N, v = j / N, p = project(H, u, v);
      var wT = (1 - v) * bow[0] * g(frac(project(H, u, 0), q[0], q[1])),
          wR = u * bow[1] * g(frac(project(H, 1, v), q[1], q[2])),
          wB = v * bow[2] * g(frac(project(H, u, 1), q[2], q[3])),
          wL = (1 - u) * bow[3] * g(frac(project(H, 0, v), q[3], q[0]));
      pos.push(p[0] + n[0][0] * wT + n[1][0] * wR + n[2][0] * wB + n[3][0] * wL,
               p[1] + n[0][1] * wT + n[1][1] * wR + n[2][1] * wB + n[3][1] * wL);
    }
    return pos;
  }

  /* ───────── GPU renderer ───────── */
  var VS = "attribute vec2 aPos;attribute vec2 aUV;uniform vec2 uRes;varying vec2 vUV;varying vec2 vPh;" +
    "void main(){vUV=aUV;vPh=aPos/uRes;gl_Position=vec4(vPh.x*2.0-1.0,1.0-vPh.y*2.0,0.0,1.0);}";
  /* The design is graded to the photo's light, but nothing is sampled from the
     photo's original screen — so no trace of the old ad can show through. */
  function FS(deriv) {
    return (deriv ? "#extension GL_OES_standard_derivatives : enable\n" : "") +
      "precision mediump float;uniform sampler2D uTex;" +
      "uniform float uB,uC,uS,uSheen,uInner,uAspect;varying vec2 vUV;varying vec2 vPh;" +
      "void main(){vec3 c=texture2D(uTex,vUV).rgb;c=(c-0.5)*uC+0.5;c*=uB;" +
      "float l=dot(c,vec3(0.2126,0.7152,0.0722));c=clamp(mix(vec3(l),c,uS),0.0,1.0);" +
      "float e=min(min(vUV.x,1.0-vUV.x)*uAspect,min(vUV.y,1.0-vUV.y));c*=mix(1.0-uInner,1.0,smoothstep(0.0,0.1,e));" +
      "float g=clamp(1.0-(vUV.x*0.55+vUV.y*0.85),0.0,1.0);c=1.0-(1.0-c)*(1.0-uSheen*g*g);" +
      (deriv ? "vec2 fw=max(fwidth(vUV),vec2(1e-5));float px=min(min(vUV.x,1.0-vUV.x)/fw.x,min(vUV.y,1.0-vUV.y)/fw.y);float a=clamp(px/0.8,0.0,1.0);"
             : "float a=1.0;") +
      "gl_FragColor=vec4(c*a,a);}";
  }
  var STAGE = { live: { side: [1024, 512], rear: [512, 512], front: [512, 256] }, export: { side: [2048, 1024], rear: [1024, 1024], front: [1024, 512] } };

  function GL(canvas, preserve) {
    var gl = canvas.getContext("webgl", { premultipliedAlpha: true, antialias: true, alpha: true, preserveDrawingBuffer: !!preserve });
    if (!gl) return null;
    var deriv = !!gl.getExtension("OES_standard_derivatives"), aniso = gl.getExtension("EXT_texture_filter_anisotropic");
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }
    var pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS(deriv))); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return null;
    gl.useProgram(pr);
    var U = {}; ["uRes", "uTex", "uB", "uC", "uS", "uSheen", "uInner", "uAspect"].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    var aPos = gl.getAttribLocation(pr, "aPos"), aUV = gl.getAttribLocation(pr, "aUV");
    gl.uniform1i(U.uTex, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    function tex(mip) {
      var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      if (mip && aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
      return t;
    }
    var N = 32, uv = [], idx = [];
    for (var j = 0; j <= N; j++) for (var i = 0; i <= N; i++) uv.push(i / N, j / N);
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) { var a = j * (N + 1) + i; idx.push(a, a + 1, a + N + 2, a, a + N + 2, a + N + 1); }
    var uvBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uv), gl.STATIC_DRAW);
    var idxBuf = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    var self = { gl: gl, screens: [], light: null, staging: {} };

    self.setScene = function (scene, kind) {
      var L = LIGHT[scene.light];
      self.scene = scene; self.L = L; self.size = STAGE[kind || "live"];
      self.screens = Object.keys(scene.screens).map(function (k) {
        var s = scene.screens[k], b = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(surface(s, N)), gl.STATIC_DRAW);
        var d = A.SCREENS[k].ft;
        return { key: k, buf: b, tex: tex(true), aspect: d[0] / d[1] };
      });
    };
    self.draw = function (sources) {
      var L = self.L; if (!L) return;
      gl.viewport(0, 0, canvas.width, canvas.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uRes, self.scene.w, self.scene.h);
      gl.uniform1f(U.uB, L.b); gl.uniform1f(U.uC, L.c); gl.uniform1f(U.uS, L.s);
      gl.uniform1f(U.uSheen, L.sheen); gl.uniform1f(U.uInner, L.inner);
      self.screens.forEach(function (s) {
        var src = sources[s.key]; if (!src) return;
        var sz = self.size[s.key], st = self.staging[s.key];
        if (!st) { st = self.staging[s.key] = document.createElement("canvas"); st.width = sz[0]; st.height = sz[1]; }
        var sx = st.getContext("2d"); sx.imageSmoothingQuality = "high"; sx.drawImage(src, 0, 0, sz[0], sz[1]);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, st); gl.generateMipmap(gl.TEXTURE_2D);
        gl.uniform1f(U.uAspect, s.aspect);
        gl.bindBuffer(gl.ARRAY_BUFFER, s.buf); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, uvBuf); gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, idxBuf); gl.drawElements(gl.TRIANGLES, idx.length, gl.UNSIGNED_SHORT, 0);
      });
    };
    self.dispose = function () { var x = gl.getExtension("WEBGL_lose_context"); if (x) x.loseContext(); };
    return self;
  }

  var IMGS = {};
  function loadImg(src) {
    if (IMGS[src]) return IMGS[src];
    IMGS[src] = new Promise(function (res, rej) { var i = new Image(); i.crossOrigin = "anonymous"; i.onload = function () { res(i); }; i.onerror = rej; i.src = src; });
    return IMGS[src];
  }
  function polyPath(ctx, p) { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (var i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); ctx.closePath(); }

  /* Clean plate: the photo with every original screen blanked out in the colour of
     its own bezel, a few pixels wider than the screen. The new design is drawn on
     top, so not a trace of the old ad (glow, outline or content) can show. */
  function perimeter(scr, growPx) {
    var N = 16, p = surface(scr, N, growPx), at = function (i, j) { var k = (j * (N + 1) + i) * 2; return [p[k], p[k + 1]]; }, out = [];
    for (var i = 0; i < N; i++) out.push(at(i, 0));
    for (var j = 0; j < N; j++) out.push(at(N, j));
    for (i = N; i > 0; i--) out.push(at(i, N));
    for (j = N; j > 0; j--) out.push(at(0, j));
    return out;
  }
  function bezelColor(ctx, scr) {
    var ring = perimeter(scr, 5.5), px = [];
    ring.forEach(function (p) {
      try { var d = ctx.getImageData(Math.round(p[0]), Math.round(p[1]), 1, 1).data; px.push([d[0], d[1], d[2], 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2]]); } catch (e) {}
    });
    px.sort(function (a, b) { return a[3] - b[3]; });
    var m = px[Math.floor(px.length * 0.1)] || [12, 12, 14, 12];          // darkest part of the frame = an unlit LED panel
    if (m[3] > 34) { var k = 34 / m[3]; m = [m[0] * k, m[1] * k, m[2] * k, 34].map(Math.round); }
    return "rgb(" + m[0] + "," + m[1] + "," + m[2] + ")";
  }
  var PLATES = {};
  function plate(scene) {
    if (PLATES[scene.id]) return PLATES[scene.id];
    PLATES[scene.id] = loadImg(scene.img).then(function (img) {
      var c = document.createElement("canvas"); c.width = scene.w; c.height = scene.h;
      var x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, scene.w, scene.h);
      Object.keys(scene.screens).forEach(function (k) {
        var s = scene.screens[k], col = bezelColor(x, s);
        var R = Math.max(2.5, Math.min(7, quadH(quadOf(s)) * 0.02)) * (scene.light === "night" || scene.light === "dusk" ? 1.4 : 1);
        x.save(); if ("filter" in x) x.filter = "blur(" + (R * 0.6).toFixed(1) + "px)"; x.globalAlpha = 0.85;
        polyPath(x, perimeter(s, 3 + R * 0.6)); x.fillStyle = col; x.fill(); x.restore();
        x.save(); polyPath(x, perimeter(s, 3)); x.fillStyle = col; x.fill();
        x.lineJoin = "round"; x.strokeStyle = col; x.lineWidth = 1.2; x.stroke(); x.restore();
      });
      return c;
    });
    return PLATES[scene.id];
  }

  /* Full-resolution photo of the scene with the design on the truck. */
  function exportScene(scene, sources) {
    return Promise.all([loadImg(scene.img), plate(scene)]).then(function (res) {
      var img = res[0], clean = res[1];
      var L = LIGHT[scene.light], gc = document.createElement("canvas"); gc.width = scene.w; gc.height = scene.h;
      var r = GL(gc, true); if (!r) throw new Error("WebGL unavailable");
      r.setScene(scene, "export"); r.draw(sources);
      var c = document.createElement("canvas"); c.width = scene.w; c.height = scene.h;
      var x = c.getContext("2d"); x.drawImage(clean, 0, 0);
      if (L.glow && "filter" in x) {
        var hs = Object.keys(scene.screens).map(function (k) { return quadH(quadOf(scene.screens[k])); });
        x.save(); x.globalCompositeOperation = "screen"; x.globalAlpha = L.glow * 0.75;
        x.filter = "blur(" + Math.round(Math.max.apply(0, hs) * 0.12) + "px)"; x.drawImage(gc, 0, 0); x.restore();
      }
      x.drawImage(gc, 0, 0);
      (scene.occlude || []).forEach(function (poly) { x.save(); polyPath(x, poly); x.clip(); x.drawImage(img, 0, 0, scene.w, scene.h); x.restore(); });
      r.dispose();
      return c;
    });
  }

  /* ───────── Live scene viewer ───────── */
  var MASTER = {};
  function master(key) {
    if (!MASTER[key]) { var d = A.SCREENS[key].preview, c = document.createElement("canvas"); c.width = d[0]; c.height = d[1]; MASTER[key] = c; }
    return MASTER[key];
  }

  function mountScene(stage, o) {
    o = o || {};
    stage.classList.add("sc-stage");
    var view = document.createElement("div"); view.className = "sc-view"; stage.insertBefore(view, stage.firstChild);
    var api = { stage: stage, safe: false, closeup: false, running: true, t0: performance.now(), current: 0, scene: null, masters: { side: master("side"), rear: master("rear"), front: master("front") } };
    var world = null, visible = true, avgT = 0;
    if ("IntersectionObserver" in global) new IntersectionObserver(function (es) { visible = es[es.length - 1].isIntersecting; }).observe(stage);

    function build(scene) {
      var w = document.createElement("div"); w.className = "sc-world"; w.style.width = scene.w + "px"; w.style.height = scene.h + "px";
      var im = document.createElement("canvas"); im.className = "sc-photo"; im.width = scene.w; im.height = scene.h;
      im.setAttribute("role", "img"); im.setAttribute("aria-label", "AOTC LED billboard truck — " + scene.name + ", " + scene.sub);
      w.appendChild(im);
      plate(scene).then(function (c) { im.getContext("2d").drawImage(c, 0, 0); });
      var L = LIGHT[scene.light];
      // glow spill (soft, so a straight perspective box is plenty)
      if (L.glow) Object.keys(scene.screens).forEach(function (k) {
        var d = A.SCREENS[k].preview, gd = document.createElement("i"); gd.className = "sc-glow";
        gd.style.width = d[0] + "px"; gd.style.height = d[1] + "px"; gd.style.setProperty("--glowA", L.glow);
        gd.style.transform = matrix3d(homography([[0, 0], [d[0], 0], [d[0], d[1]], [0, d[1]]], quadOf(scene.screens[k])));
        w.appendChild(gd);
      });
      var gc = document.createElement("canvas"); gc.className = "sc-gl"; w.appendChild(gc);
      var r = GL(gc, false);
      var rec = { el: w, scene: scene, canvas: gc, gl: r, ready: false, rf: 0 };
      if (r) { r.setScene(scene, "live"); rec.ready = true; }
      (scene.occlude || []).forEach(function (poly) {
        var oc = document.createElement("img"); oc.className = "sc-occlude"; oc.src = scene.img; oc.alt = ""; oc.draggable = false;
        oc.style.clipPath = "polygon(" + poly.map(function (p) { return p[0] + "px " + p[1] + "px"; }).join(",") + ")";
        w.appendChild(oc);
      });
      return rec;
    }

    function fit() {
      if (!world) return;
      var s = world.scene, rc = stage.getBoundingClientRect(), W = rc.width, Hh = rc.height;
      var k = Math.max(W / s.w, Hh / s.h), b = bbox(s);
      if (api.closeup) k = Math.max(k, Math.min(W / ((b.x1 - b.x0) * 1.3), Hh / ((b.y1 - b.y0) * 1.45)));
      var tx = W / 2 - (b.x0 + b.x1) / 2 * k, ty = Hh / 2 - (b.y0 + b.y1) / 2 * k;
      tx = Math.min(0, Math.max(W - s.w * k, tx)); ty = Math.min(0, Math.max(Hh - s.h * k, ty));
      world.el.style.transform = "translate(" + tx + "px," + ty + "px) scale(" + k + ")";
      // render the screens at the pixel density they're actually shown at
      var rf = Math.max(0.5, Math.min(2, k * (global.devicePixelRatio || 1)));
      if (Math.abs(rf - world.rf) > 0.05) { world.rf = rf; world.canvas.width = Math.round(s.w * rf); world.canvas.height = Math.round(s.h * rf); }
    }
    addEventListener("resize", fit);

    api.setScene = function (id) {
      var s = SCENES.filter(function (x) { return x.id === id; })[0] || SCENES[0];
      if (world && world.scene === s) return;
      var next = build(s); next.el.style.opacity = "0"; view.appendChild(next.el);
      var prev = world; world = next; api.scene = s; fit();
      plate(s).then(function () {
        requestAnimationFrame(function () { next.el.style.opacity = "1"; });
        if (prev) setTimeout(function () { prev.el.remove(); if (prev.gl) prev.gl.dispose(); }, 700);
      });
      stage.setAttribute("data-light", s.light);
      if (o.onScene) o.onScene(s);
    };
    api.setCloseup = function (on) {
      api.closeup = !!on; stage.classList.toggle("closeup", api.closeup); stage.classList.add("anim"); fit();
      clearTimeout(api._animT); api._animT = setTimeout(function () { stage.classList.remove("anim"); }, 1000);
    };
    api.restart = function () { api.t0 = performance.now(); };
    api.time = function () { return (performance.now() - api.t0) / 1000; };
    api.export = function () {
      var t = api.time(), slides = o.getSlides(), hold = o.getHold ? o.getHold() : null, src = {};
      ["side", "rear", "front"].forEach(function (k) {
        var d = A.SCREENS[k].exp, c = document.createElement("canvas"); c.width = d[0]; c.height = d[1];
        A.render(c, k, slides, t, hold != null ? { slideIndex: hold, freezeAt: 99 } : {}); src[k] = c;
      });
      return exportScene(api.scene, src);
    };

    function paint(t) {
      var slides = o.getSlides(); if (!slides || !slides.length) return;
      var hold = o.getHold ? o.getHold() : null, opts = { safe: api.safe };
      if (hold != null) { opts.slideIndex = hold; opts.freezeAt = t % Math.max(1, +slides[hold].dur || 6); }
      var r = A.render(api.masters.side, "side", slides, t, opts);
      A.render(api.masters.rear, "rear", slides, t, opts);
      A.render(api.masters.front, "front", slides, t, { slideIndex: opts.slideIndex, freezeAt: opts.freezeAt });
      [world, api._prev].forEach(function (wd) { if (wd && wd.ready && wd.gl) wd.gl.draw(api.masters); });
      if (r) api.current = r.slide;
      if (t - avgT > 0.5) { avgT = t; glowColor(); }
      if (o.onFrame) o.onFrame(t, api.current);
    }
    var tiny = document.createElement("canvas"); tiny.width = tiny.height = 6;
    function glowColor() {
      try {
        var tx = tiny.getContext("2d"); tx.drawImage(api.masters.side, 0, 0, 6, 6);
        var d = tx.getImageData(0, 0, 6, 6).data, r = 0, g = 0, b = 0;
        for (var i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        var n = d.length / 4; stage.style.setProperty("--glow", "rgb(" + Math.round(r / n) + "," + Math.round(g / n) + "," + Math.round(b / n) + ")");
      } catch (e) {}
    }
    function frame() {
      requestAnimationFrame(frame);
      if (!visible || !api.running) return;
      paint(api.time());
    }
    api.setScene(o.scene || SCENES[0].id);
    api.ready = true;
    requestAnimationFrame(frame);
    return api;
  }

  A.SCENES = SCENES;
  A.LIGHT = LIGHT;
  A.mountScene = mountScene;
  A.exportScene = exportScene;
  A.homography = homography;
  A.surface = surface;
})(window);
