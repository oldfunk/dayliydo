// ising-domains 无头自检：从 index.html 提取模型块，在 node vm 中执行。
// 用法：node selftest.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\* MODEL-BEGIN \*\/([\s\S]*?)\/\* MODEL-END \*\//);
if (!m) { console.error('未找到 MODEL-BEGIN/END 标记'); process.exit(1); }

const ctx = {
  Math, Int8Array, Int32Array, Uint8Array, Float64Array,
  console, Date
};
/* 用 runInThisContext 让模型跑在与网页相同的普通上下文，
   否则 vm 隔离对象的属性访问会慢一个量级，测不准真实性能。 */
vm.runInThisContext(m[1]);
const IsingModel = globalThis.IsingModel;
const TC = globalThis.TC_EXACT;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, detail){
  if (cond){ pass++; console.log('  ok   ' + name + (detail ? '  [' + detail + ']' : '')); }
  else { fail++; fails.push(name + (detail ? '  [' + detail + ']' : '')); console.log('  FAIL ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function near(a, b, tol){ return Math.abs(a - b) <= tol; }

console.log('ising-domains 自检  (Tc = ' + TC.toFixed(6) + ')');
console.log('--- 1. 基态与序参量定义 ---');
{
  const M = new IsingModel(8, 1, 'ordered');
  ok(near(M.energyPerSpin(0), -2.0, 1e-12), '全铁磁基态 E=-2', M.energyPerSpin(0).toFixed(4));
  ok(near(M.magSigned(), 1, 1e-12), '全铁磁 m=+1');
  ok(near(M.maxDomain(), 1, 1e-12), '全铁磁最大畴=1');
}
{
  // 棋盘构型：每个自旋 4 个邻居全反向 ⇒ 最大畴 = 单格
  const M = new IsingModel(12, 1, 'ordered');
  for (let i = 0; i < M.N; i++){
    const r = (i / M.L) | 0, c = i % M.L;
    M.s[i] = ((r + c) & 1) ? 1 : -1;
  }
  ok(near(M.maxDomain(), 1 / M.N, 1e-12), '棋盘构型最大畴=1/N', M.maxDomain().toExponential(2));
}

console.log('--- 2. 周期性边界邻居表 ---');
{
  const L = 7, M = new IsingModel(L, 1, 'ordered');
  const La = M.L;   // 构造器把 L<8 夹到 8，按实际 L 校验
  let distinct = true, symmetric = true;
  for (let i = 0; i < M.N; i++){
    const ns = [M.nb[i*4], M.nb[i*4+1], M.nb[i*4+2], M.nb[i*4+3]];
    if (new Set(ns).size !== 4) distinct = false;
    for (const j of ns){
      const back = [M.nb[j*4], M.nb[j*4+1], M.nb[j*4+2], M.nb[j*4+3]];
      if (!back.includes(i)) symmetric = false;
    }
  }
  ok(distinct, '每格 4 个不同邻居');
  ok(symmetric, '邻居关系互为对称（周期性）');
  // 角点 (0,0) 的邻居应是 (La-1,0),(1,0),(0,La-1),(0,1)
  const corner = [M.nb[0], M.nb[1], M.nb[2], M.nb[3]].sort((a,b)=>a-b);
  const expect = [La-1, (La-1)*La, 1, La].sort((a,b)=>a-b);
  ok(JSON.stringify(corner) === JSON.stringify(expect), '角点邻居含跨边界回绕', corner.join(','));
}

console.log('--- 3. 低温长程序 vs 高温无序 ---');
{
  const M = new IsingModel(64, 5, 'random');
  for (let i = 0; i < 2500; i++) M.sweep(0.5 * TC, 0);
  const mLow = Math.abs(M.magSigned());
  ok(mLow > 0.8, 'T=0.5Tc 随机出发后 |m|>0.8', mLow.toFixed(3));

  const H = new IsingModel(64, 5, 'ordered');
  for (let i = 0; i < 2500; i++) H.sweep(3.5 * TC, 0);
  const mHigh = Math.abs(H.magSigned());
  ok(mHigh < 0.25, 'T=3.5Tc 有序出发后 |m|<0.25', mHigh.toFixed(3));
}

console.log('--- 4. 居里相变：序参量在 Tc 附近崩塌 ---');
{
  function domAt(L, tRel, sweeps){
    const M = new IsingModel(L, 11, 'ordered');
    for (let i = 0; i < sweeps; i++) M.sweep(tRel * TC, 0);
    return M.maxDomain();
  }
  const d09 = domAt(64, 0.90, 1200);
  const d15 = domAt(64, 1.50, 1200);
  ok(d09 > 0.8, 'T=0.9Tc 最大畴>0.8', d09.toFixed(3));
  ok(d15 < 0.4, 'T=1.5Tc 最大畴<0.4', d15.toFixed(3));
  ok(d09 - d15 > 0.4, '两相序参量差>0.4', (d09 - d15).toFixed(3));
}

console.log('--- 5. 能量随温度上升 ---');
{
  function eAt(L, tRel, sweeps){
    const M = new IsingModel(L, 13, 'ordered');
    for (let i = 0; i < sweeps; i++) M.sweep(tRel * TC, 0);
    return M.energyPerSpin(0);
  }
  const eLo = eAt(48, 0.5, 900), eHi = eAt(48, 3.0, 900);
  ok(eLo < eHi, 'E(0.5Tc) < E(3.0Tc)', eLo.toFixed(3) + ' < ' + eHi.toFixed(3));
  ok(near(eLo, -2, 0.15), '低温 E 接近基态 -2', eLo.toFixed(3));
}

console.log('--- 6. 外场显式破缺对称 ---');
{
  const M = new IsingModel(64, 17, 'random');
  for (let i = 0; i < 2500; i++) M.sweep(0.5 * TC, 1.0);
  ok(M.magSigned() > 0.95, 'h=+1, T=0.5Tc 时 m>0.95', M.magSigned().toFixed(3));
  const N2 = new IsingModel(64, 17, 'random');
  for (let i = 0; i < 2500; i++) N2.sweep(0.5 * TC, -1.0);
  ok(N2.magSigned() < -0.95, 'h=-1, T=0.5Tc 时 m<-0.95', N2.magSigned().toFixed(3));
}

console.log('--- 7. Metropolis 接受率与确定性 ---');
{
  const M = new IsingModel(48, 23, 'random');
  let minR = 1, maxR = 0;
  for (let i = 0; i < 200; i++){
    const r = M.sweep(1.0 * TC, 0);
    if (r < minR) minR = r;
    if (r > maxR) maxR = r;
  }
  ok(minR >= 0 && maxR <= 1, '接受率落在 [0,1]', minR.toFixed(3) + '..' + maxR.toFixed(3));
  ok(maxR > 0.05, 'Tc 处仍有可观接受率', maxR.toFixed(3));

  function snap(seed, mode, T, n){
    const A = new IsingModel(48, seed, mode);
    for (let i = 0; i < n; i++) A.sweep(T, 0);
    return Array.from(A.s);
  }
  const a = snap(99, 'random', 2.0, 120);
  const b = snap(99, 'random', 2.0, 120);
  let md = 0;
  for (let i = 0; i < a.length; i++) md = Math.max(md, Math.abs(a[i] - b[i]));
  ok(md === 0, '同种子逐格复现', 'max|Δ|=' + md);
}

console.log('--- 8. 点击翻转整个连通畴 ---');
{
  const M = new IsingModel(16, 29, 'ordered');
  const sz = M.flipDomainAt(0, 0);
  ok(sz === M.N, '全铁磁点一下翻转全格', sz + '/' + M.N);
  ok(near(M.magSigned(), -1, 1e-12), '翻转后 m=-1');

  const H = new IsingModel(16, 29, 'half');
  const before = Math.abs(H.magSigned());
  const sz2 = H.flipDomainAt(0, 0);   // 左半畴
  ok(sz2 === H.N / 2, '半畴点一侧只翻那一侧', sz2 + '/' + H.N);
  ok(Math.abs(before) < 1e-9 && Math.abs(H.magSigned()) > 0.99,
     '翻半畴后 |m| 由 0 变 1（两畴合并为一畴）',
     before.toFixed(2) + '->' + H.magSigned().toFixed(2));
}

console.log('--- 9. 网格规模与运行预算 ---');
{
  const t0 = Date.now();
  const M = new IsingModel(96, 31, 'random');
  for (let i = 0; i < 200; i++) M.sweep(1.0 * TC, 0);
  const dt = (Date.now() - t0) / 1000;
  const per = dt / 200 * 1000;
  ok(per < 12, 'L=96 单 sweep < 12 ms（保证实时）', per.toFixed(2) + ' ms');
  console.log('       L=96: ' + per.toFixed(2) + ' ms/sweep, 200 sweeps 共 ' + dt.toFixed(2) + ' s');
}

console.log('');
console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
if (fail){ console.log('失败项：'); fails.forEach(f => console.log('  - ' + f)); process.exit(1); }
