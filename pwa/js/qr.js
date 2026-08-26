/**
 * Générateur de code QR minimal — mode octet, niveau de correction L,
 * versions 1 à 10 (jusqu'à 274 octets). Implémentation autonome : aucune
 * bibliothèque externe, donc aucun appel réseau et rien à installer.
 *
 * Sert à imprimer un code QR pointant vers la fiche partagée d'un exercice.
 */

/* ---------- Corps de Galois GF(256) ---------- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
(function initGf() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1; if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gMul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

function rsGenPoly(deg) {
  let poly = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= gMul(poly[j], 1);
      next[j + 1] ^= gMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function rsEncode(data, ecLen) {
  const gen = rsGenPoly(ecLen);
  const res = new Array(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ res[0];
    res.shift(); res.push(0);
    if (factor !== 0) for (let i = 0; i < ecLen; i++) res[i] ^= gMul(gen[i + 1], factor);
  }
  return res;
}

/* ---------- Tables (niveau L, versions 1 à 10) ---------- */
// [nb total de codets de données, nb de codets de correction par bloc, [ [nbBlocs, donnéesParBloc], … ] ]
const SPEC = {
  1:  [19,  7,  [[1, 19]]],
  2:  [34, 10,  [[1, 34]]],
  3:  [55, 15,  [[1, 55]]],
  4:  [80, 20,  [[1, 80]]],
  5:  [108, 26, [[1, 108]]],
  6:  [136, 18, [[2, 68]]],
  7:  [156, 20, [[2, 78]]],
  8:  [194, 24, [[2, 97]]],
  9:  [232, 30, [[2, 116]]],
  10: [274, 18, [[2, 68], [2, 69]]],
};
const ALIGN = {
  1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
  6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
};

function pickVersion(byteLen) {
  for (let v = 1; v <= 10; v++) {
    const [dataCw] = SPEC[v];
    const lenBits = v <= 9 ? 8 : 16;
    const need = Math.ceil((4 + lenBits + byteLen * 8) / 8);
    if (need <= dataCw) return v;
  }
  return null;
}

/* ---------- Construction ---------- */
function buildData(bytes, version) {
  const [dataCw] = SPEC[version];
  const lenBits = version <= 9 ? 8 : 16;
  const bits = [];
  const push = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); };
  push(0b0100, 4);
  push(bytes.length, lenBits);
  for (const b of bytes) push(b, 8);
  const cap = dataCw * 8;
  for (let i = 0; i < 4 && bits.length < cap; i++) bits.push(0);
  while (bits.length % 8) bits.push(0);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) {
    cw.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }
  const pads = [0xec, 0x11];
  let k = 0;
  while (cw.length < dataCw) cw.push(pads[k++ % 2]);
  return cw;
}

function interleave(cw, version) {
  const [, ecLen, groups] = SPEC[version];
  const blocks = [];
  let pos = 0;
  for (const [count, size] of groups) {
    for (let i = 0; i < count; i++) {
      const d = cw.slice(pos, pos + size); pos += size;
      blocks.push({ d, e: rsEncode(d, ecLen) });
    }
  }
  const out = [];
  const maxD = Math.max(...blocks.map((b) => b.d.length));
  for (let i = 0; i < maxD; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ecLen; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

function newMatrix(size) {
  return { size, m: Array.from({ length: size }, () => new Int8Array(size).fill(-1)) };
}

function placeFunction(mx, version) {
  const n = mx.size, m = mx.m;
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) for (let c = -1; c <= 7; c++) {
      const rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
      const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
      m[rr][cc] = (inRing || inCore) ? 1 : 0;
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
  for (let i = 8; i < n - 8; i++) {
    m[6][i] = i % 2 === 0 ? 1 : 0;
    m[i][6] = i % 2 === 0 ? 1 : 0;
  }
  const centers = ALIGN[version];
  for (const r of centers) for (const c of centers) {
    if ((r <= 8 && c <= 8) || (r <= 8 && c >= n - 9) || (r >= n - 9 && c <= 8)) continue;
    for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) {
      m[r + dr][c + dc] = (Math.max(Math.abs(dr), Math.abs(dc)) !== 1) ? 1 : 0;
    }
  }
  m[n - 8][8] = 1;                                   // module toujours noir
  for (let i = 0; i < 9; i++) {                      // réservation format
    if (m[8][i] === -1) m[8][i] = 0;
    if (m[i][8] === -1) m[i][8] = 0;
  }
  for (let i = 0; i < 8; i++) {
    if (m[8][n - 1 - i] === -1) m[8][n - 1 - i] = 0;
    if (m[n - 1 - i][8] === -1) m[n - 1 - i][8] = 0;
  }
  if (version >= 7) {
    for (let i = 0; i < 6; i++) for (let j = 0; j < 3; j++) {
      m[n - 11 + j][i] = 0; m[i][n - 11 + j] = 0;
    }
  }
}

function isFunctionModule(reserved, r, c) { return reserved[r][c] === 1; }

function placeData(mx, reserved, data) {
  const n = mx.size, m = mx.m;
  let bit = 0;
  const total = data.length * 8;
  const getBit = (i) => (i < total ? (data[i >> 3] >> (7 - (i & 7))) & 1 : 0);
  let up = true;
  for (let colPair = n - 1; colPair > 0; colPair -= 2) {
    if (colPair === 6) colPair = 5;                  // colonne de synchronisation ignorée
    for (let i = 0; i < n; i++) {
      const row = up ? n - 1 - i : i;
      for (let k = 0; k < 2; k++) {
        const col = colPair - k;
        if (isFunctionModule(reserved, row, col)) continue;
        m[row][col] = getBit(bit++);
      }
    }
    up = !up;
  }
}

const MASKS = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (r, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
];

function penalty(m, n) {
  let p = 0;
  // Règle 1 : suites de 5 modules ou plus
  for (let r = 0; r < n; r++) {
    let runC = 1, runR = 1;
    for (let c = 1; c < n; c++) {
      runC = m[r][c] === m[r][c - 1] ? runC + 1 : 1;
      if (runC === 5) p += 3; else if (runC > 5) p += 1;
      runR = m[c][r] === m[c - 1][r] ? runR + 1 : 1;
      if (runR === 5) p += 3; else if (runR > 5) p += 1;
    }
  }
  // Règle 2 : blocs 2×2
  for (let r = 0; r < n - 1; r++) for (let c = 0; c < n - 1; c++) {
    const v = m[r][c];
    if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
  }
  // Règle 3 : motif 1011101 entouré de blanc
  const pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  const patR = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  const scan = (get) => {
    for (let r = 0; r < n; r++) for (let c = 0; c + 11 <= n; c++) {
      let ok1 = true, ok2 = true;
      for (let i = 0; i < 11; i++) {
        const v = get(r, c + i);
        if (v !== pat[i]) ok1 = false;
        if (v !== patR[i]) ok2 = false;
      }
      if (ok1) p += 40;
      if (ok2) p += 40;
    }
  };
  scan((r, c) => m[r][c]);
  scan((r, c) => m[c][r]);
  // Règle 4 : proportion de modules noirs
  let dark = 0;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) dark += m[r][c];
  const ratio = (dark * 100) / (n * n);
  p += Math.floor(Math.abs(ratio - 50) / 5) * 10;
  return p;
}

function bchFormat(fmt) {
  let d = fmt << 10;
  for (let i = 14; i >= 10; i--) if ((d >> i) & 1) d ^= 0x537 << (i - 10);
  return ((fmt << 10) | d) ^ 0x5412;
}
function bchVersion(v) {
  let d = v << 12;
  for (let i = 17; i >= 12; i--) if ((d >> i) & 1) d ^= 0x1f25 << (i - 12);
  return (v << 12) | d;
}

function applyFormat(m, n, maskId) {
  const bits = bchFormat((0b01 << 3) | maskId);       // 01 = niveau L
  for (let i = 0; i < 15; i++) {
    const b = (bits >> i) & 1;
    if (i < 6) m[8][i] = b;
    else if (i < 8) m[8][i + 1] = b;
    else if (i === 8) m[7][8] = b;
    else m[14 - i][8] = b;
    if (i < 8) m[n - 1 - i][8] = b;
    else m[8][n - 15 + i] = b;
  }
  m[n - 8][8] = 1;
}

function applyVersionInfo(m, n, version) {
  if (version < 7) return;
  const bits = bchVersion(version);
  for (let i = 0; i < 18; i++) {
    const b = (bits >> i) & 1;
    const r = Math.floor(i / 3), c = i % 3;
    m[n - 11 + c][r] = b;
    m[r][n - 11 + c] = b;
  }
}

/**
 * Construit la matrice d'un code QR.
 * @returns {{size:number, modules:number[][]}|null} null si le texte est trop long.
 */
export function qrMatrix(text) {
  const bytes = [...new TextEncoder().encode(String(text))];
  const version = pickVersion(bytes.length);
  if (!version) return null;
  const n = version * 4 + 17;

  const data = interleave(buildData(bytes, version), version);

  const base = newMatrix(n);
  placeFunction(base, version);
  const reserved = base.m.map((row) => Int8Array.from(row, (v) => (v === -1 ? 0 : 1)));

  let best = null;
  for (let maskId = 0; maskId < 8; maskId++) {
    const mx = newMatrix(n);
    placeFunction(mx, version);
    placeData(mx, reserved, data);
    const m = mx.m.map((r) => Array.from(r));
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!reserved[r][c] && MASKS[maskId](r, c)) m[r][c] ^= 1;
    }
    applyFormat(m, n, maskId);
    applyVersionInfo(m, n, version);
    const score = penalty(m, n);
    if (!best || score < best.score) best = { score, m };
  }
  return { size: n, modules: best.m };
}

/** Rendu SVG d'un code QR. Renvoie '' si le contenu est trop long. */
export function qrSvg(text, px = 160, quiet = 4) {
  const q = qrMatrix(text);
  if (!q) return '';
  const total = q.size + quiet * 2;
  let path = '';
  for (let r = 0; r < q.size; r++) {
    for (let c = 0; c < q.size; c++) {
      if (q.modules[r][c]) path += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}"
    viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges" role="img"
    aria-label="Code QR vers la fiche de l’exercice">
    <rect width="${total}" height="${total}" fill="#ffffff"/>
    <path d="${path}" fill="#000000"/></svg>`;
}
