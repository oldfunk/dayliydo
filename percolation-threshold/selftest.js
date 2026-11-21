// percolation-threshold 无头自检：从 index.html 提取模型块，在 node 中执行。
// 用法：node selftest.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\* MODEL-BEGIN \*\/([\s\S]*?)\/\* MODEL-END \*\//);
if (!m) { console.error('未找到 MODEL-BEGIN/END 标记'); process.exit(1); }

const ctx = { Math, Int8Array, Int32Array, Uint8Array, Float64Array, console, Date };
vm.createContext(ctx);
vm.runInContext(m[1], ctx);
const PercolationGrid = ctx.PercolationGrid;
const PC = ctx.PC_SITE;
const DF = ctx.EXP_DF;
const TAU = ctx.EXP_TAU;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, detail){
  if (cond){ pass++; console.log('  ok   ' + name + (detail ? '  [' + detail + ']' : '')); }
  else { fail++; fails.push(name + (detail ? '  [' + detail + ']' : '')); console.log('  FAIL ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function near(a, b, tol){ return Math.abs(a - b) <= tol; }

/* 在指定格点上手动构造构型 */
function manual(L, cells){
  const g = new PercolationGrid(L, 1);
  g.occ.fill(0);
  for (const [r, c] of cells) g.occ[r * L + c] = 1;
  return g.analyze();
}

console.log('percolation-threshold 自检  (p_c = ' + PC + ')');
console.log('--- 1. 极端占据 ---');
{
  const e = new PercolationGrid(16, 1);
  e.generate(0); const a = e.analyze();
  ok(a.occCount === 0 && a.count === 0 && a.largest === 0, 'p=0 全空',
     'occ=' + a.occCount + ' clusters=' + a.count);
  ok(!a.hasLR && !a.hasTB, 'p=0 无贯通');
  ok(a.chi === 0, 'p=0 时 S=0');

  e.generate(1); const b = e.analyze();
  ok(b.count === 1 && b.largest === e.N, 'p=1 单一团簇占满全格',
     'clusters=' + b.count + ' largest=' + b.largest + '/' + e.N);
  ok(b.hasLR && b.hasTB, 'p=1 左右/上下均贯通');
  ok(b.chi === 0, 'p=1 时 S=0（排除贯通的最大团簇后无有限团簇）', String(b.chi));
}

console.log('--- 2. 确定性 ---');
{
  const a = new PercolationGrid(64, 20261122);
  const b = new PercolationGrid(64, 20261122);
  a.generate(0.5927); b.generate(0.5927);
  let same = true;
  for (let i = 0; i < a.N; i++) if (a.occ[i] !== b.occ[i]) { same = false; break; }
  ok(same, '同种子同 p 逐格复现');
  const c = new PercolationGrid(64, 20261123);
  c.generate(0.5927);
  let diff = 0;
  for (let i = 0; i < a.N; i++) if (a.occ[i] !== c.occ[i]) diff++;
  ok(diff > 0, '换种子构型不同', '差异格数=' + diff);
}

console.log('--- 3. 手动构型的连通标记 ---');
{
  const L = 8;
  const row = [];
  for (let c = 0; c < L; c++) row.push([0, c]);
  const a = manual(L, row);
  ok(a.count === 1 && a.largest === L, '只占第一行 ⇒ 1 个团簇、尺寸 L',
     'count=' + a.count + ' size=' + a.largest);
  ok(a.hasLR && !a.hasTB, '第一行左右贯通、不上下贯通');

  const col = [];
  for (let r = 0; r < L; r++) col.push([r, 0]);
  const b = manual(L, col);
  ok(b.hasTB && !b.hasLR, '只占第一列 ⇒ 上下贯通、不左右贯通');

  const c = manual(L, [[2,2],[2,3],[5,5],[5,6],[6,5]]);
  ok(c.count === 2, '两个分离方块 ⇒ 2 个团簇', 'count=' + c.count);
  const sizes = [];
  for (let i = 0; i < c.count; i++) sizes.push(c.sizes[i]);
  sizes.sort((x, y) => x - y);
  ok(sizes[0] === 2 && sizes[1] === 3, '团簇尺寸 = {2, 3}', sizes.join(','));
  let hsum = 0;
  for (let s = 1; s <= L * L; s++) hsum += c.hist[s];
  ok(hsum === c.count, '尺寸直方图总数 = 团簇数', hsum + '/' + c.count);
}

console.log('--- 4. 临界凭证：P_LR=0.5 的交点落在 p_c ---');
{
  const L = 96, samples = 200;
  const g = new PercolationGrid(L, 4242);
  const pts = [];
  for (let k = 0; k < 41; k++){
    const p = 0.55 + 0.09 * k / 40;
    let lr = 0;
    for (let s = 0; s < samples; s++){
      g.generate(p);
      if (g.analyze().hasLR) lr++;
    }
    pts.push({ p: p, P: lr / samples });
  }
  let pstar = null;
  for (let i = 1; i < pts.length; i++){
    if (pts[i - 1].P < 0.5 && pts[i].P >= 0.5){
      const t = (0.5 - pts[i - 1].P) / (pts[i].P - pts[i - 1].P);
      pstar = pts[i - 1].p + t * (pts[i].p - pts[i - 1].p);
      break;
    }
  }
  ok(pstar !== null, 'P_LR 在扫描区间内跨过 0.5');
  ok(near(pstar, PC, 0.008), 'p* 与 p_c 之差 < 0.008',
     'p*=' + pstar.toFixed(4) + '  Δ=' + (pstar - PC).toFixed(4));
  const iPc = Math.round((PC - 0.55) / 0.09 * 40);
  ok(near(pts[iPc].P, 0.5, 0.08), 'p_c 处 P_LR ≈ 0.5', pts[iPc].P.toFixed(3));
}

console.log('--- 5. 平均团簇尺寸 S 在 p_c 发散 ---');
{
  function peakAt(L, samples){
    const g = new PercolationGrid(L, 777);
    let best = null;
    for (let k = 0; k < 21; k++){
      const p = 0.56 + 0.08 * k / 20;
      let sum = 0;
      for (let s = 0; s < samples; s++) sum += g.sample(p).chi;
      const chi = sum / samples;
      if (!best || chi > best.chi) best = { p: p, chi: chi };
    }
    return best;
  }
  const p48 = peakAt(48, 120), p96 = peakAt(96, 120), p160 = peakAt(160, 120);
  ok(near(p96.p, PC, 0.02), 'L=96 的 S 峰位落在 p_c 附近', p96.p.toFixed(3));
  ok(p96.chi > 150, 'L=96 的 S 峰高 > 150', p96.chi.toFixed(1));
  const ratio = p160.chi / p48.chi;
  ok(ratio > 5 && ratio < 10, 'S 峰高 ∝ L^(γ/ν)：L=160/48 峰高比在 5–10',
     p48.chi.toFixed(0) + '→' + p160.chi.toFixed(0) + ' 比=' + ratio.toFixed(2));
  const exp = Math.log(ratio) / Math.log(160 / 48);
  ok(exp > 1.4 && exp < 2.0, '峰高标度指数 ≈ γ/ν=1.792', exp.toFixed(2));
}

console.log('--- 6. 临界团簇分形维数 d_f = 91/48 ---');
{
  [64, 96, 160].forEach(function(L){
    const g = new PercolationGrid(L, 999);
    let sum = 0; const S = 100;
    for (let s = 0; s < S; s++) sum += g.sample(PC).largest;
    const m = sum / S;
    const scaled = m / Math.pow(L, DF);
    ok(scaled > 0.35 && scaled < 0.55, 'L=' + L + ' 时 s_max/L^(91/48) ≈ 常数',
       scaled.toFixed(3));
  });
}

console.log('--- 7. 团簇尺寸分布的幂律趋势 ---');
{
  const L = 256, S = 200;
  const g = new PercolationGrid(L, 31337);
  const H = new Float64Array(L * L + 1);
  for (let s = 0; s < S; s++){
    const a = g.sample(PC);
    for (let k = 1; k <= L * L; k++) H[k] += a.hist[k];
  }
  function slope(lo, hi){
    const xs = [], ys = [];
    for (let k = lo; k <= hi; k++) if (H[k] > 0){ xs.push(Math.log(k)); ys.push(Math.log(H[k] / S)); }
    const n = xs.length;
    let sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < n; i++){ sx += xs[i]; sy += ys[i]; sxx += xs[i] * xs[i]; sxy += xs[i] * ys[i]; }
    return (n * sxy - sx * sy) / (n * sxx - sx * sx);
  }
  const sSmall = slope(2, 8), sLarge = slope(100, 300);
  ok(sLarge < sSmall, '大 s 端斜率更负（向 τ=2.055 趋近）',
     sSmall.toFixed(3) + ' → ' + sLarge.toFixed(3));
  ok(Math.abs(sLarge) > 1.9, '大 s 端 |斜率| > 1.9', Math.abs(sLarge).toFixed(3));
  ok(Math.abs(Math.abs(sLarge) - TAU) < Math.abs(Math.abs(sSmall) - TAU),
     '大 s 端比小 s 端更接近理论 τ');
}

console.log('--- 8. 性能与涂擦 ---');
{
  const g = new PercolationGrid(96, 5);
  g.generate(0.5927);
  const t0 = Date.now();
  for (let i = 0; i < 100; i++) g.analyze();
  const per = (Date.now() - t0) / 100;
  ok(per < 6, 'L=96 单次标记 < 6 ms（保证实时）', per.toFixed(2) + ' ms');

  const before = g.last.occCount;
  g.occ[10 * 96 + 10] = 1 - g.occ[10 * 96 + 10];
  const after = g.analyze();
  ok(Math.abs(after.occCount - before) === 1, '点击涂/擦改变占据数 ±1',
     before + '→' + after.occCount);
}

console.log('');
console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
if (fail){ console.log('失败项：'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
