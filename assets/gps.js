/* AOTC GPS clean-up for the live route room (route.html). A phone's GPS is good to a few
   metres and wanders while it sits still, so raw fixes can't be drawn or added up as they arrive:
   - fixes the phone itself rates worse than 50 m are dropped once better ones exist
   - a jump faster than a truck can drive (about 90 mph) is dropped, unless the next fix agrees with it (the signal came back)
   - drift around where the truck is sitting is held on one spot: a parked truck adds no phantom miles, and its time still counts.
     Each new fix is compared with the average of the fixes since it stopped, which settles on the true spot; moving distance is
     measured from the last real position, so a slow crawl still adds up
   A fix is [time in ms, lat, lng, accuracy in metres]. */
window.AOTCGps = (function () {
  "use strict";
  var MAX_ACC = 50, MAX_SPEED = 40, MIN_MOVE = 15, MAX_HOLD = 40, GAP = 300;
  function meters(a, b) {
    var r = Math.PI / 180, dLa = (b[1] - a[1]) * r, dLo = (b[2] - a[2]) * r;
    var x = Math.sin(dLa / 2) * Math.sin(dLa / 2) + Math.cos(a[1] * r) * Math.cos(b[1] * r) * Math.sin(dLo / 2) * Math.sin(dLo / 2);
    return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function speed(a, b) { var dt = (b[0] - a[0]) / 1000; return dt > 0 ? meters(a, b) / dt : Infinity; }
  function track(raw) {
    var pts = raw.slice().sort(function (a, b) { return a[0] - b[0]; });
    var good = pts.filter(function (p) { return !p[3] || p[3] <= MAX_ACC; });
    var out = [], last = null, jump = null, mid = null, n = 0;
    (good.length >= 2 ? good : pts).forEach(function (p) {
      if (!last) { last = p; mid = [0, p[1], p[2]]; n = 1; out.push(p); return; }
      var dt = (p[0] - last[0]) / 1000; if (dt <= 0) return;
      if (dt <= GAP && meters(last, p) / dt > MAX_SPEED) {
        if (jump && speed(jump, p) <= MAX_SPEED) { out.push(jump, p); last = p; mid = [0, p[1], p[2]]; n = 1; jump = null; } else jump = p;
        return;
      }
      jump = null;
      var margin = Math.min(MAX_HOLD, Math.max(MIN_MOVE, (p[3] || 0) * 1.5));
      if (meters(mid, p) < margin) {   // same place, later time
        n++; mid[1] += (p[1] - mid[1]) / n; mid[2] += (p[2] - mid[2]) / n;
        last = [p[0], last[1], last[2], p[3]]; out.push(last); return;
      }
      last = p; mid = [0, p[1], p[2]]; n = 1; out.push(p);
    });
    return out;
  }
  function distance(pts) { var d = 0; for (var i = 1; i < pts.length; i++) d += meters(pts[i - 1], pts[i]); return d; }
  // when a fix was actually taken: the phone's own timestamp, unless its clock is clearly off
  function fixTime(pos) { var t = pos && pos.timestamp, now = Date.now(); return t && Math.abs(t - now) < 120000 ? t : now; }
  return { track: track, distance: distance, meters: meters, fixTime: fixTime };
})();
