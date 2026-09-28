// Ice-field puzzle generator. Places rocks, stop pads and gems on an ice
// field, then keeps fields where: the exit is reachable, every gem can be
// collected, no reachable spot is a dead end, and the shortest route that
// collects every gem is long.
//   node tools/icegen.js <width> <height> <gems> [tries] [seed]
// Prints the best field as map rows (W rock, I ice, . pad, G gem on ice,
// H start pad, X exit in the bottom wall).

const [, , Warg = '9', Harg = '7', Garg = '5', triesArg = '3000', seedArg = '1', targetArg = '0'] = process.argv;
const TARGET = Number(targetArg); // preferred route length (0 = as long as possible)
const W = Number(Warg);
const H = Number(Harg);
const NG = Number(Garg);
let seed = Number(seedArg);
const rnd = () => {
  seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

function generate() {
  // Field cells inside a wall frame: 0 ice, 1 rock, 2 pad.
  const g = [];
  for (let y = 0; y < H; y++) {
    const row = [];
    for (let x = 0; x < W; x++) {
      const r = rnd();
      row.push(r < 0.2 ? 1 : r < 0.27 ? 2 : 0);
    }
    g.push(row);
  }
  const start = [Math.floor(rnd() * W), 0];
  g[start[1]][start[0]] = 2;
  const exit = [Math.floor(rnd() * W), H]; // in the bottom wall
  if (g[H - 1][exit[0]] === 1) g[H - 1][exit[0]] = 0;
  const gems = [];
  for (let tries = 0; gems.length < NG && tries < 200; tries++) {
    const x = Math.floor(rnd() * W);
    const y = Math.floor(rnd() * H);
    if (g[y][x] !== 0) continue;
    const below = y + 1 >= H ? 1 : g[y + 1][x];
    if (below !== 1) continue; // gems need solid ground under them
    if (gems.some(([a, b]) => a === x && b === y)) continue;
    gems.push([x, y]);
  }
  return { g, start, exit, gems };
}

function cell(f, x, y) {
  if (x === f.exit[0] && y === f.exit[1]) return 3; // exit
  if (x < 0 || y < 0 || x >= W || y >= H) return 1;
  return f.g[y][x];
}

// Slide from (x,y) in direction d. Returns [endX, endY, passedCells] or null.
function slide(f, x, y, [dx, dy]) {
  let cx = x;
  let cy = y;
  const passed = [];
  for (;;) {
    const nx = cx + dx;
    const ny = cy + dy;
    const c = cell(f, nx, ny);
    if (c === 1) break;
    cx = nx;
    cy = ny;
    passed.push(cy * W + cx);
    if (c === 2 || c === 3) break;
  }
  if (cx === x && cy === y) return null;
  return [cx, cy, passed];
}

function evaluate(f) {
  const key = (x, y) => y * (W + 1) + x;
  const gemIdx = new Map(f.gems.map(([x, y], i) => [y * W + x, i]));
  // Reachable stop positions.
  const seen = new Set([key(...f.start)]);
  const q = [f.start];
  const edges = new Map();
  while (q.length) {
    const [x, y] = q.shift();
    const out = [];
    if (cell(f, x, y) === 3) {
      edges.set(key(x, y), out);
      continue;
    }
    for (const d of DIRS) {
      const r = slide(f, x, y, d);
      if (!r) continue;
      let mask = 0;
      for (const c of r[2]) if (gemIdx.has(c)) mask |= 1 << gemIdx.get(c);
      out.push([r[0], r[1], mask]);
      const k = key(r[0], r[1]);
      if (!seen.has(k)) {
        seen.add(k);
        q.push([r[0], r[1]]);
      }
    }
    edges.set(key(x, y), out);
  }
  const exitK = key(...f.exit);
  if (!seen.has(exitK)) return null;
  // No traps: from every reachable spot the exit must still be reachable.
  const rev = new Map();
  for (const [k, out] of edges) for (const [x, y] of out) {
    const t = key(x, y);
    if (!rev.has(t)) rev.set(t, []);
    rev.get(t).push(k);
  }
  const canExit = new Set([exitK]);
  const rq = [exitK];
  while (rq.length) {
    const k = rq.shift();
    for (const p of rev.get(k) || []) if (!canExit.has(p)) { canExit.add(p); rq.push(p); }
  }
  for (const k of seen) if (!canExit.has(k)) return null;
  // Shortest route collecting every gem, then reaching the exit.
  const full = (1 << f.gems.length) - 1;
  const sk = (k, m) => k * 256 + m;
  const dist = new Map([[sk(key(...f.start), 0), 0]]);
  const bq = [[key(...f.start), 0]];
  while (bq.length) {
    const [k, m] = bq.shift();
    const dcur = dist.get(sk(k, m));
    if (k === exitK) {
      if (m === full) return { len: dcur, stops: seen.size };
      continue;
    }
    for (const [x, y, gm] of edges.get(k) || []) {
      const nk = key(x, y);
      const nm = m | gm;
      const s2 = sk(nk, nm);
      if (dist.has(s2)) continue;
      dist.set(s2, dcur + 1);
      bq.push([nk, nm]);
    }
  }
  return null;
}

let best = null;
for (let t = 0; t < Number(triesArg); t++) {
  const f = generate();
  if (f.gems.length < NG) continue;
  const e = evaluate(f);
  if (!e) continue;
  const score = TARGET ? -Math.abs(e.len - TARGET) * 100 + e.stops : e.len * 10 + e.stops;
  if (!best || score > best.score) best = { f, e, score };
}
if (!best) {
  console.error('no valid field found');
  process.exit(1);
}
const { f, e } = best;
const rows = [];
rows.push('W'.repeat(W + 2));
for (let y = 0; y < H; y++) {
  let r = 'W';
  for (let x = 0; x < W; x++) {
    const gem = f.gems.some(([a, b]) => a === x && b === y);
    if (x === f.start[0] && y === f.start[1]) r += 'H';
    else if (gem) r += 'g';
    else r += ['I', 'W', '.'][f.g[y][x]];
  }
  rows.push(`${r}W`);
}
let bottom = 'W';
for (let x = 0; x < W; x++) bottom += x === f.exit[0] ? 'X' : 'W';
rows.push(`${bottom}W`);
console.log(rows.map((r) => `      '${r}',`).join('\n'));
console.log(`// shortest full route: ${e.len} slides, ${e.stops} stop points`);
