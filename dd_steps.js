/* dd_steps.js — REAL pedometer for the web (emulating native as far as a browser allows).
   Counts actual footsteps from the device accelerometer (DeviceMotion), not from GPS distance.
   Works even when standing still, indoors, or where GPS is poor — a genuine step counter.

   Hard limits it can't cross (these are the native-app drivers, logged in ROADMAP):
     • runs only while the page is foreground + awake (pair with the Screen Wake Lock in dd_gps.js)
     • iOS requires a one-time motion permission granted FROM A USER GESTURE (a tap)

   API (window.DDSteps):
     supported() -> bool      active() -> bool       count() -> int
     start(cb)  cb(ok)  — call from a tap; requests iOS permission, then listens
     stop()     reset()
*/
(function (w) {
  if (w.DDSteps) return;
  var listening = false, steps = 0, lastStepT = 0, baseline = 0, filt = 0, prevFilt = 0, armed = false;
  var THRESH = 1.15;   // m/s^2 above the moving baseline that marks a heel-strike peak
  var MIN_DT = 270;    // ms minimum between steps → caps ~3.7 steps/s, rejects jitter

  function onMotion(e) {
    var a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
    var m = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    baseline = baseline ? (baseline * 0.92 + m * 0.08) : m;   // slow EMA = gravity + drift
    var dev = m - baseline;                                    // linear-ish motion signal
    filt = filt * 0.6 + dev * 0.4;                            // light smoothing
    var now = Date.now();
    if (prevFilt <= THRESH && filt > THRESH && (now - lastStepT) > MIN_DT) { steps++; lastStepT = now; }
    prevFilt = filt;
  }
  function iosPerm() { return typeof w.DeviceMotionEvent !== "undefined" && typeof w.DeviceMotionEvent.requestPermission === "function"; }

  var API = {
    supported: function () { return typeof w.DeviceMotionEvent !== "undefined"; },
    active: function () { return listening; },
    count: function () { return steps; },
    reset: function () { steps = 0; lastStepT = 0; },
    start: function (cb) {
      if (listening) { if (cb) cb(true); return; }
      if (!API.supported()) { if (cb) cb(false); return; }
      function go(ok) { if (ok && !listening) { try { w.addEventListener("devicemotion", onMotion, { passive: true }); listening = true; } catch (e) {} } if (cb) cb(!!ok && listening); }
      if (iosPerm()) {
        try { w.DeviceMotionEvent.requestPermission().then(function (r) { go(r === "granted"); }, function () { go(false); }); }
        catch (e) { go(false); }
      } else { go(true); }   // Android / desktop: no prompt needed
    },
    stop: function () { if (!listening) return; try { w.removeEventListener("devicemotion", onMotion); } catch (e) {} listening = false; }
  };
  w.DDSteps = API;
})(window);
