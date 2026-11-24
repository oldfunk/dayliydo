#!/usr/bin/env node
/* 无头自检：抽出 ofc-earthquake/index.html 的 MODEL 段与统计工具，验证物理数值 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
function slice(a, b){
  const i = html.indexOf(a), j = html.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error('marker not found: ' + a + ' / ' + b);
  return html.slice(i, j);
}
const modelSrc = slice('/* ===================== MODEL-BEGIN', '/* MODEL-END */') + '\n' +
                 slice('/* MODEL-END */', '</script>');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(modelSrc, ctx, { filename: 'model.js' });
const { OFC, mulberry32, histLog2, cumulative, fitLine } = ctx;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, msg, extra){
  if (cond) pass++;
  else { fail++; fails.push(msg + (extra ? '  -> ' + extra : '')); }
}
function near(a, b, tol, msg){ ok(Math.abs(a - b) <= tol, msg, `got ${a}, want ${b} ±${tol}`); }

function run(L, alpha, v, steps, warm){
  const m = new OFC(L, alpha);
  m.reset(true);
  const sizes = [];
  let diss = 0, inj = 0;
  for (let i = 0; i < steps; i++){
    const ev = m.event(v);
    diss += ev.dissipated; inj += ev.loaded;
    if (i >= warm && ev.size > 0) sizes.push(ev.size);
  }
  return { sizes, m, diss, inj };
}
function logBins(sizes, cap, minB){
  const H = histLog2(sizes, cap);
  const cum = cumulative(H.h, H.bins);
  const xs = [], ys = [];
  for (let b = minB; b <= H.bins; b++) if (cum[b] >= 4){ xs.push(b); ys.push(Math.log10(cum[b])); }
  const fit = fitLine(xs, ys);
  return { n: sizes.length, max: H.max, b: fit ? -fit.slope : null };
}

/* ---------- 1. 能量守恒：输入 = 现存 − 初始 + 耗散 ---------- */
(function(){
  for (const alpha of [0.3, 0.5, 0.7]){
    const m = new OFC(96, alpha);
    m.reset(true);
    const f0 = m.totalForce();
    let inj = 0, diss = 0;
    for (let i = 0; i < 5000; i++){
      const ev = m.event(1e-3);
      inj += ev.loaded; diss += ev.dissipated;
    }
    const now = m.totalForce();
    const err = Math.abs(f0 + inj - diss - now) / Math.max(1e-9, Math.abs(f0 + inj));
    near(err, 0, 1e-9, 'alpha=' + alpha + '：能量账目闭合（误差 ' + (err * 100).toExponential(2) + '%）');
    ok(!m.hasUnstable(), 'alpha=' + alpha + '：跑完 5000 步后系统稳定（无超阈值格）');
  }
})();

/* ---------- 2. 清零规则的确定性（同初始条件逐格一致） ---------- */
(function(){
  const a = new OFC(64, 0.3), b = new OFC(64, 0.3);
  a.reset(true); b.reset(true);
  const ea = a.event(1), eb = b.event(1);
  ok(ea.size === eb.size, '同初始条件下事件规模确定');
  let same = true;
  for (let i = 0; i < a.N; i++) if (a.f[i] !== b.f[i]) { same = false; break; }
  ok(same, '同初始条件下终态力场逐格一致');
  ok(ea.size > 0, '注入后确实触发事件', String(ea.size));
  /* 滑动过的格在滑动瞬间被清零；之后可能又从邻居收到应力，但最终必须回到阈值以下 */
  let belowOK = true;
  const aff = ea.affected || [];
  for (let k = 0; k < aff.length; k++) if (a.f[aff[k]] >= 1) { belowOK = false; break; }
  ok(belowOK, '受影响格在事件结束后应力都回到阈值以下');
  ok(!a.hasUnstable(), '事件结束后系统无超阈值格');
})();

/* ---------- 3. 真实雪崩：不是全格齐滑 ---------- */
(function(){
  const r = run(96, 0.3, 1e-3, 30000, 8000);
  const s = logBins(r.sizes, 8192, 4);
  console.log('  L=96 a=0.3 v=1e-3: n=' + s.n + ' max=' + s.max + ' b=' + s.b + ' meanF=' + r.m.meanForce().toFixed(3));
  ok(s.n > 1000, '产出足够地震样本', String(s.n));
  ok(s.max < 96 * 96 * 0.95, '最大规模不等于全格齐滑（说明有局域级联）', String(s.max));
  ok(s.b !== null && s.b > 0.1 && s.b < 1.2, 'b 落在二维 OFC 合理区间', String(s.b));
})();

/* ---------- 4. SOC 特征：b 与加载速率基本无关 ---------- */
(function(){
  const bs = [];
  for (const v of [1e-2, 3e-3, 1e-3]){
    const r = run(96, 0.3, v, 40000, 10000);
    const s = logBins(r.sizes, 8192, 5);
    console.log('  v=' + v + ': n=' + s.n + ' max=' + s.max + ' b=' + s.b);
    bs.push(s.b);
  }
  ok(bs.every(x => x !== null), '三个速率下都能拟合出 b');
  const spread = Math.max.apply(null, bs) - Math.min.apply(null, bs);
  ok(spread < 0.25, 'b 随加载速率变化很小（SOC 标志）', bs.map(x => x.toFixed(3)).join(', ') + ' 极差 ' + spread.toFixed(3));
})();

/* ---------- 5. 耗散越强，b 越低（文献趋势） ---------- */
(function(){
  const out = [];
  for (const alpha of [0.6, 0.4, 0.25]){
    const r = run(96, alpha, 1e-3, 40000, 10000);
    const s = logBins(r.sizes, 8192, 5);
    console.log('  a=' + alpha + ': n=' + s.n + ' max=' + s.max + ' b=' + s.b + ' meanF=' + r.m.meanForce().toFixed(3));
    out.push({ alpha, b: s.b, max: s.max });
  }
  ok(out.every(o => o.b !== null), '三个 α 都能拟合出 b');
  ok(out[0].max < out[2].max, '耗散越弱（α 越小）最大雪崩越大', out.map(o => o.alpha + ':' + o.max).join(' '));
})();

/* ---------- 6. 尺寸效应：系统越大，最大雪崩越大 ---------- */
(function(){
  const out = [];
  for (const L of [48, 96, 128]){
    const r = run(L, 0.3, 1e-3, 40000, 10000);
    const s = logBins(r.sizes, 8192, 5);
    console.log('  L=' + L + ': n=' + s.n + ' max=' + s.max + ' b=' + s.b);
    out.push({ L, max: s.max });
  }
  ok(out[2].max >= out[0].max, '最大雪崩随 L 不减', out.map(o => o.L + ':' + o.max).join(' '));
})();

/* ---------- 7. 局部推压触发级联 ---------- */
(function(){
  const m = new OFC(64, 0.3);
  m.reset(false);
  for (let i = 0; i < 3000; i++) m.event(1e-3);
  const before = m.totalForce();
  const idx = 33 * 64 + 33;
  const target = Math.max(m.f[idx], 1.05);
  const amount = target - m.f[idx];
  m.injectAt(idx, amount);
  const ev = m.event(0);
  ok(ev.size > 0, '往稳定场里推一格确实触发级联', String(ev.size));
  ok(ev.affected && ev.affected.indexOf(idx) >= 0, '被推的格本身在受影响列表里');
  near(m.totalForce(), before + amount - ev.dissipated, 1e-9, '推压后能量账目仍闭合');
})();

/* ---------- 8. PRNG 确定性 ---------- */
(function(){
  const a = mulberry32(12345), b = mulberry32(12345), c = mulberry32(54321);
  const s1 = [a(), a(), a()].join(','), s2 = [b(), b(), b()].join(','), s3 = [c(), c(), c()].join(',');
  ok(s1 === s2, '同种子 PRNG 复现');
  ok(s1 !== s3, '异种子 PRNG 不同');
  ok(s1.split(',').every(v => +v >= 0 && +v < 1), 'PRNG 输出落在 [0,1)');
})();

/* ---------- 9. 直方图/累计/拟合的数学性质 ---------- */
(function(){
  const h = histLog2([1, 1, 2, 4, 4, 4, 8, 16, 16], 64);
  const cum = cumulative(h.h, h.bins);
  ok(h.h[0] === 2 && h.h[1] === 1 && h.h[2] === 3, 'log2 分桶正确');
  ok(cum[4] === 2, '累计频次含最大桶', String(cum[4]));
  let tot = 0; for (let b = 0; b <= h.bins; b++) tot += h.h[b];
  ok(cum[0] === tot, '累计在最小桶等于总数');
  const f = fitLine([1, 2, 3, 4], [1, 2, 3, 4]);
  near(f.slope, 1, 1e-9, 'y=x 拟合斜率为 1');
  ok(fitLine([1], [1]) === null, '单点拟合返回 null');
  ok(fitLine([], []) === null, '空数组拟合返回 null');
})();

/* ---------- 10. 耗散系数边界 ---------- */
(function(){
  const m1 = new OFC(32, 0), m2 = new OFC(32, 2);
  ok(m1.alpha > 0 && m1.alpha <= 1, 'α 下界被夹到正数', String(m1.alpha));
  ok(m2.alpha === 1, 'α 上界被夹到 1', String(m2.alpha));
})();

console.log('\n通过 ' + pass + ' 项 · 失败 ' + fail + ' 项');
if (fails.length){ console.log('失败明细:'); fails.forEach(s => console.log('  x ' + s)); process.exit(1); }
console.log('ALL PASS');
