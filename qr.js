/* qr.js — self-contained QR encoder (byte mode, ECC level M, versions 1–10).
   No dependencies. Verified at build time by jsQR decode round-trip (same doctrine as qr_print.html).
   Exposes: QRLite.matrix(text) -> {size, modules:[[bool]]}  and  QRLite.drawCanvas(text, canvas, opts).
   Enough capacity for any dead.dance show URL. If text is too long for v10-M it throws. */
(function (root) {
  "use strict";
  // ---- Galois field (GF(256), primitive 0x11d) ----
  var EXP = new Array(512), LOG = new Array(256);
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; } for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255]; })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }
  function rsGen(deg) { var g = [1]; for (var i = 0; i < deg; i++) { var ng = new Array(g.length + 1); for (var k = 0; k < ng.length; k++) ng[k] = 0; for (var j = 0; j < g.length; j++) { ng[j] ^= gmul(g[j], EXP[i]); ng[j + 1] ^= g[j]; } g = ng; } return g.reverse(); /* leading-coefficient-first for the LFSR remainder */ }
  function rsEncode(data, deg) { var gen = rsGen(deg), res = new Array(deg); for (var i = 0; i < deg; i++) res[i] = 0; for (var d = 0; d < data.length; d++) { var factor = data[d] ^ res[0]; res.shift(); res.push(0); if (factor !== 0) for (var g = 0; g < deg; g++) res[g] ^= gmul(gen[g + 1], factor); } return res; }

  // ---- version tables (ECC level M) ----
  // total data codewords (M), and EC blocks layout for versions 1..10
  var DATA_CW_M = [0,16,28,44,64,86,108,124,154,182,216];         // [ver] usable data codewords (M)
  var ECC_PER_BLOCK_M = [0,10,16,26,18,24,16,18,22,22,26];        // EC codewords per block (M)
  // block counts (M): [group1blocks, group1datacw, group2blocks, group2datacw]
  var BLOCKS_M = {1:[1,16,0,0],2:[1,28,0,0],3:[1,44,0,0],4:[2,32,0,0],5:[2,43,0,0],
                  6:[4,27,0,0],7:[4,31,0,0],8:[2,38,2,39],9:[3,36,2,37],10:[4,43,1,44]};
  var ALIGN = {1:[],2:[6,18],3:[6,22],4:[6,26],5:[6,30],6:[6,34],7:[6,22,38],8:[6,24,42],9:[6,26,46],10:[6,28,50]};

  function bitsNeeded(ver, byteLen) { var cci = ver < 10 ? 8 : 16; return 4 + cci + byteLen * 8; }
  function pickVersion(byteLen) { for (var v = 1; v <= 10; v++) { if (bitsNeeded(v, byteLen) <= DATA_CW_M[v] * 8) return v; } throw new Error("QRLite: data too long for v10-M (" + byteLen + " bytes)"); }

  function toBytes(str) { var out = [], i, c; for (i = 0; i < str.length; i++) { c = str.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) { var c2 = str.charCodeAt(i + 1); if (c2 >= 0xdc00 && c2 <= 0xdfff) { var cp = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00); out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63)); i++; continue; } }
    if (c < 0x80) out.push(c); else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
    else { out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); } } return out; }

  function buildData(str) {
    var bytes = toBytes(str), ver = pickVersion(bytes.length);
    var bits = [];
    function put(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    put(0x4, 4);                                   // byte mode
    put(bytes.length, ver < 10 ? 8 : 16);          // char count
    for (var i = 0; i < bytes.length; i++) put(bytes[i], 8);
    var cap = DATA_CW_M[ver] * 8;
    if (bits.length > cap) throw new Error("QRLite: overflow");
    var term = Math.min(4, cap - bits.length); put(0, term);           // terminator
    while (bits.length % 8 !== 0) bits.push(0);                          // byte align
    var pad = [0xec, 0x11], p = 0;
    while (bits.length < cap) { put(pad[p % 2], 8); p++; }
    // to codewords
    var dcw = []; for (var b = 0; b < bits.length; b += 8) { var v = 0; for (var k = 0; k < 8; k++) v = (v << 1) | bits[b + k]; dcw.push(v); }
    // split into blocks, add ECC, interleave
    var layout = BLOCKS_M[ver], ecc = ECC_PER_BLOCK_M[ver];
    var blocks = [], idx = 0, g;
    for (g = 0; g < layout[0]; g++) { blocks.push(dcw.slice(idx, idx + layout[1])); idx += layout[1]; }
    for (g = 0; g < layout[2]; g++) { blocks.push(dcw.slice(idx, idx + layout[3])); idx += layout[3]; }
    var eccBlocks = blocks.map(function (bl) { return rsEncode(bl, ecc); });
    var result = [], maxData = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (var c = 0; c < maxData; c++) for (var bi = 0; bi < blocks.length; bi++) if (c < blocks[bi].length) result.push(blocks[bi][c]);
    for (var e = 0; e < ecc; e++) for (var bj = 0; bj < eccBlocks.length; bj++) result.push(eccBlocks[bj][e]);
    return { ver: ver, codewords: result };
  }

  // ---- matrix construction ----
  function newGrid(size) { var g = []; for (var i = 0; i < size; i++) { g.push([]); for (var j = 0; j < size; j++) g[i].push(null); } return g; }
  function placeFinder(g, r, c) { for (var i = -1; i <= 7; i++) for (var j = -1; j <= 7; j++) { var rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= g.length || cc >= g.length) continue;
    var on = (i >= 0 && i <= 6 && (j === 0 || j === 6)) || (j >= 0 && j <= 6 && (i === 0 || i === 6)) || (i >= 2 && i <= 4 && j >= 2 && j <= 4); g[rr][cc] = { v: on ? 1 : 0, fn: true }; } }
  function reserve(g, r, c, v) { g[r][c] = { v: v, fn: true }; }

  function buildMatrix(ver, codewords) {
    var size = 17 + ver * 4, g = newGrid(size);
    placeFinder(g, 0, 0); placeFinder(g, 0, size - 7); placeFinder(g, size - 7, 0);
    // timing
    for (var i = 8; i < size - 8; i++) { var b = (i % 2 === 0) ? 1 : 0; if (g[6][i] === null) g[6][i] = { v: b, fn: true }; if (g[i][6] === null) g[i][6] = { v: b, fn: true }; }
    // alignment
    var al = ALIGN[ver], first = al[0], last = al[al.length - 1];
    for (var a = 0; a < al.length; a++) for (var b2 = 0; b2 < al.length; b2++) { var ar = al[a], ac = al[b2];
      // skip ONLY the three alignment centers that coincide with the finder patterns
      if ((ar === first && ac === first) || (ar === first && ac === last) || (ar === last && ac === first)) continue;
      for (var di = -2; di <= 2; di++) for (var dj = -2; dj <= 2; dj++) { var on = Math.max(Math.abs(di), Math.abs(dj)) !== 1; g[ar + di][ac + dj] = { v: on ? 1 : 0, fn: true }; } }
    // dark module + reserve format/version areas
    reserve(g, size - 8, 8, 1);
    for (var k = 0; k <= 8; k++) { if (g[8][k] === null) g[8][k] = { v: 0, fn: true }; if (g[k][8] === null) g[k][8] = { v: 0, fn: true }; }
    for (var m = 0; m < 8; m++) { if (g[8][size - 1 - m] === null) g[8][size - 1 - m] = { v: 0, fn: true }; if (g[size - 1 - m][8] === null) g[size - 1 - m][8] = { v: 0, fn: true }; }
    if (ver >= 7) { for (var vi = 0; vi < 18; vi++) { var rr = Math.floor(vi / 3), cc = vi % 3; g[size - 11 + cc][rr] = { v: 0, fn: true }; g[rr][size - 11 + cc] = { v: 0, fn: true }; } }
    // place data (zig-zag)
    var bitsArr = []; for (var w = 0; w < codewords.length; w++) for (var q = 7; q >= 0; q--) bitsArr.push((codewords[w] >> q) & 1);
    var dir = -1, row = size - 1, col = size - 1, bp = 0;
    while (col > 0) { if (col === 6) col--; while (true) { for (var cx = 0; cx < 2; cx++) { var cc2 = col - cx; if (g[row][cc2] === null) { var bit = bp < bitsArr.length ? bitsArr[bp++] : 0; g[row][cc2] = { v: bit, fn: false }; } } row += dir; if (row < 0 || row >= size) { row -= dir; dir = -dir; break; } } col -= 2; }
    return { size: size, g: g };
  }

  function applyMask(g, mask) { var size = g.length, out = newGrid(size);
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) { var cell = g[r][c]; if (!cell) { out[r][c] = { v: 0, fn: false }; continue; }
      var v = cell.v; if (!cell.fn) { var m = false;
        switch (mask) { case 0: m = (r + c) % 2 === 0; break; case 1: m = r % 2 === 0; break; case 2: m = c % 3 === 0; break; case 3: m = (r + c) % 3 === 0; break;
          case 4: m = (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; break; case 5: m = ((r * c) % 2) + ((r * c) % 3) === 0; break;
          case 6: m = (((r * c) % 2) + ((r * c) % 3)) % 2 === 0; break; case 7: m = (((r + c) % 2) + ((r * c) % 3)) % 2 === 0; break; }
        if (m) v ^= 1; }
      out[r][c] = { v: v, fn: cell.fn }; }
    return out; }

  function fmtBits(mask) { // ECC level M = 0b00; BCH; XOR 0x5412
    var data = (0 << 3) | mask; var d = data << 10, g = 0x537;
    for (var i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= g << (i - 10);
    return ((data << 10) | d) ^ 0x5412; }
  function placeFormat(g, mask) { var size = g.length, bits = fmtBits(mask);
    for (var i = 0; i < 15; i++) { var b = (bits >> i) & 1;
      // around top-left
      if (i < 6) g[i][8].v = b; else if (i === 6) g[7][8].v = b; else if (i === 7) g[8][8].v = b; else if (i === 8) g[8][7].v = b; else g[8][14 - i].v = b;
      // duplicate
      if (i < 8) g[8][size - 1 - i].v = b; else g[size - 15 + i][8].v = b; } }
  function verBits(ver) { var d = ver << 12, g = 0x1f25; for (var i = 17; i >= 12; i--) if ((d >> i) & 1) d ^= g << (i - 12); return (ver << 12) | d; }
  function placeVersion(g, ver) { if (ver < 7) return; var size = g.length, bits = verBits(ver);
    for (var i = 0; i < 18; i++) { var b = (bits >> i) & 1, r = Math.floor(i / 3), c = i % 3; g[size - 11 + c][r].v = b; g[r][size - 11 + c].v = b; } }

  function penalty(g) { var size = g.length, p = 0, r, c, i;
    for (r = 0; r < size; r++) { var run = 1; for (c = 1; c < size; c++) { if (g[r][c].v === g[r][c - 1].v) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
    for (c = 0; c < size; c++) { var run2 = 1; for (r = 1; r < size; r++) { if (g[r][c].v === g[r - 1][c].v) { run2++; if (run2 === 5) p += 3; else if (run2 > 5) p++; } else run2 = 1; } }
    for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) { var v = g[r][c].v; if (v === g[r][c + 1].v && v === g[r + 1][c].v && v === g[r + 1][c + 1].v) p += 3; }
    var dark = 0; for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (g[r][c].v) dark++;
    var ratio = Math.abs(Math.round(dark * 100 / (size * size)) - 50); p += Math.floor(ratio / 5) * 10;
    return p; }

  function matrix(text, forceMask) {
    var d = buildData(text), base = buildMatrix(d.ver, d.codewords);
    var best = null, bestP = Infinity, bestMask = 0;
    for (var mask = 0; mask < 8; mask++) { if (forceMask != null && mask !== forceMask) continue; var m = applyMask(base.g, mask); placeFormat(m, mask); placeVersion(m, d.ver); var p = penalty(m); if (p < bestP) { bestP = p; best = m; bestMask = mask; } }
    var mods = []; for (var r = 0; r < base.size; r++) { mods.push([]); for (var c = 0; c < base.size; c++) mods[r].push(!!best[r][c].v); }
    return { size: base.size, version: d.ver, mask: bestMask, modules: mods };
  }

  function drawCanvas(text, canvas, opts) {
    opts = opts || {}; var q = matrix(text), quiet = opts.quiet == null ? 4 : opts.quiet;
    var total = q.size + quiet * 2, px = opts.px || Math.max(2, Math.floor((opts.size || 240) / total));
    canvas.width = total * px; canvas.height = total * px;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = opts.light || "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = opts.dark || "#000";
    for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) if (q.modules[r][c]) ctx.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
    return q;
  }

  root.QRLite = { matrix: matrix, drawCanvas: drawCanvas };
})(typeof window !== "undefined" ? window : this);
