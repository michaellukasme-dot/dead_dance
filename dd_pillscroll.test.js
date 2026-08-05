/* dd_pillscroll.test.js — proves the PURE arrow logic of dd_pillscroll.js.
   Run: node dd_pillscroll.test.js   (exit 0 = green). Zero deps.
   Proves the MATH only; the on-device visual (chevrons appear/hide at the true edges,
   don't fight the curtain drag) is device-validated-later — a browser can't run here. */
var P = require("./dd_pillscroll.js");
var A = P.arrowState;

var pass = 0, fail = 0;
function ok(name, cond) { if (cond) { pass++; } else { fail++; console.error("  ✗ " + name); } }
function eq(name, got, exp) {
  ok(name + " (L=" + exp.left + ",R=" + exp.right + ")",
     got && got.left === exp.left && got.right === exp.right);
}

// A bar 800px wide holding 2000px of pills → 1200px of overscroll room.
var CW = 800, SW = 2000; // maxScroll = 1200

/* 1. fully scrolled LEFT (start) → RIGHT arrow only */
eq("fully-left start", A(0, SW, CW, 1), { left: false, right: true });

/* 2. partially scrolled (middle) → BOTH arrows */
eq("middle", A(600, SW, CW, 1), { left: true, right: true });

/* 3. fully scrolled RIGHT (end) → LEFT arrow only */
eq("fully-right end", A(1200, SW, CW, 1), { left: true, right: false });

/* 4. no overflow (content fits exactly) → NEITHER arrow */
eq("no overflow (equal)", A(0, CW, CW, 1), { left: false, right: false });

/* 5. content SMALLER than the viewport → NEITHER (maxScroll negative) */
eq("content smaller than viewport", A(0, 500, CW, 1), { left: false, right: false });

/* 6. epsilon tolerance at the START edge: 0.5px in from 0, eps 1 → still "at start" */
eq("epsilon absorbs start jitter", A(0.5, SW, CW, 1), { left: false, right: true });

/* 7. epsilon tolerance at the END edge: 0.4px short of max, eps 1 → still "at end" */
eq("epsilon absorbs end jitter", A(1199.6, SW, CW, 1), { left: true, right: false });

/* 8. just PAST the start threshold (2px in, eps 1) → left arrow appears */
eq("2px in from start shows left", A(2, SW, CW, 1), { left: true, right: true });

/* 9. just BEFORE the end threshold (2px short, eps 1) → right arrow still shown */
eq("2px short of end shows right", A(1198, SW, CW, 1), { left: true, right: true });

/* 10. clientWidth == scrollWidth exactly (the equal edge) → NEITHER */
eq("clientWidth==scrollWidth", A(0, 1234, 1234, 1), { left: false, right: false });

/* 11. tiny overflow just over epsilon → arrows engage (right at start) */
eq("tiny overflow over eps", A(0, CW + 2, CW, 1), { left: false, right: true });

/* 12. overflow smaller than epsilon → treated as no-overflow (no flicker on 1px rounding) */
eq("sub-epsilon overflow hidden", A(0, CW + 0.5, CW, 1), { left: false, right: false });

/* 13. default epsilon (omitted) behaves like eps=1 at the start edge */
eq("default epsilon at start", A(0.9, SW, CW), { left: false, right: true });

/* 14. custom larger epsilon widens the dead-zone at the end */
eq("custom eps=5 near end", A(1196, SW, CW, 5), { left: true, right: false });

/* 15. NaN / bad input → safe: show nothing rather than a wrong arrow */
eq("NaN scrollLeft is safe", A(NaN, SW, CW, 1), { left: false, right: false });

/* 16. exact-max scroll with zero epsilon → left only (strict edge) */
eq("exact end, eps 0", A(1200, SW, CW, 0), { left: true, right: false });

/* 17. exact start with zero epsilon → right only (strict edge) */
eq("exact start, eps 0", A(0, SW, CW, 0), { left: false, right: true });

/* 18. negative epsilon is coerced to the 1px default (no crash / no inversion) */
eq("negative epsilon coerced", A(0, SW, CW, -3), { left: false, right: true });

console.log((fail === 0 ? "✓ PASS" : "✗ FAIL") + " — dd_pillscroll: " + pass + " ok, " + fail + " failed");
process.exit(fail === 0 ? 0 : 1);
