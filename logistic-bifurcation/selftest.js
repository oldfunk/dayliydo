// logistic-bifurcation 无头自检：从 index.html 抽取 MODEL 块，在 node 中执行。
// 用法：node selftest.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/\/\* MODEL-BEGIN \*\/([\s\S]*?)\/\* MODEL-END \*\//);
if (!m) { console.error('未找到 MODEL-BEGIN/END 标记'); process.exit(1); }
vm.runInThisContext(m[1]);
const M = globalThis.ChaosModel;

let pass = 0, fail = 0;
const fails = [];
function ok(cond, name, detail){
  if (cond){ pass++; console.log('  ok   ' + name + (detail ? '  [' + detail + ']' : '')); }
  else { fail++; fails.push(name + (detail ? '  [' + detail + ']' : '')); console.log('  FAIL ' + name + (detail ? '  [' + detail + ']' : '')); }
}
function near(a, b, tol){ return Math.abs(a - b) <= tol; }

console.log('logistic-bifurcation 自检');
console.log('--- 1. 映射与迭代原语 ---');
{
  ok(M.logisticStep(0.5, 2) === 0.5, 'r=2 时 0.5 是不动点');
  ok(M.logisticStep(0, 4) === 0 && M.logisticStep(1, 4) === 0, '边界 0/1 恒为 0');
  ok(M.iterP(0.5, 2, 1)[1] === 0, 'r=2 不动点导数为 0（超稳定）');
  let x = 0.12345, r = 3.7;
  const [y, d] = M.iterP(x, r, 5);
  let xm = x, dm = 1;
  for (let i = 0; i < 5; i++){ dm *= r * (1 - 2 * xm); xm = r * xm * (1 - xm); }
  ok(near(y, xm, 1e-14) && near(d, dm, 1e-12), 'iterP 与手写迭代逐项一致',
     'dx=' + Math.abs(y - xm).toExponential(1));
}

console.log('--- 2. 轨道乘子（解析参照） ---');
{
  ok(near(M.orbitMultiplier(3, 1), -1, 1e-9), '不动点在 r=3 乘子 = -1（解析 2-r）',
     M.orbitMultiplier(3, 1).toFixed(9));
  ok(near(M.orbitMultiplier(3.2, 2), 0.16, 1e-4), 'r=3.2 周期2乘子 ≈ 0.16',
     M.orbitMultiplier(3.2, 2).toFixed(6));
  ok(near(M.orbitMultiplier(2.5, 1), -0.5, 1e-9), '不动点乘子 = 2-r（r=2.5 时 -0.5）',
     M.orbitMultiplier(2.5, 1).toFixed(9));
}

console.log('--- 3. 分岔点实测（对照文献值 1e-6） ---');
const truth = [3, 3.449489743, 3.544090350, 3.564407270, 3.568759420, 3.569691609];
const rs = [];
for (let n = 1; n <= 6; n++){
  const r = M.findBifurcation(n); rs.push(r);
  ok(near(r, truth[n-1], 1e-6), 'r' + n + ' = ' + r.toFixed(9),
     '文献 ' + truth[n-1].toFixed(9) + ' 误差 ' + (r - truth[n-1]).toExponential(2));
}

console.log('--- 4. 费根鲍姆 δ 收敛 ---');
{
  const t0 = Date.now();
  const res = M.computeFeigenbaum();
  const dt = Date.now() - t0;
  ok(res.rs.length === 6 && res.gaps.length === 5 && res.ratios.length === 4,
     '结构完整：6 个分岔点 / 5 个间距 / 4 个比值');
  const d = res.ratios;
  ok(near(d[0], 4.7514, 0.002), 'δ1 ≈ 4.751', d[0].toFixed(6));
  ok(near(d[1], 4.6563, 0.002), 'δ2 ≈ 4.656', d[1].toFixed(6));
  ok(near(d[3], M.FEIGENBAUM_DELTA, 0.01), 'δ4 逼近理论 4.6692（误差 < 0.01）',
     d[3].toFixed(6) + ' vs ' + M.FEIGENBAUM_DELTA.toFixed(6));
  ok(near(res.rInfEst, M.R_INF, 0.0005), 'r∞ 外推命中 3.569945672',
     res.rInfEst.toFixed(9));
  ok(dt < 5000, '现场实测足够快（< 5 s）', dt + ' ms');
}

console.log('--- 5. 李雅普诺夫指数判读 ---');
{
  const p2 = M.lyapunov(3.2, 2000, 2000);
  const ch = M.lyapunov(4.0, 2000, 2000);
  const w3 = M.lyapunov(3.83, 2000, 2000);
  ok(p2 < -0.05, 'r=3.2 周期2：λ 显著为负', p2.toFixed(6));
  ok(near(ch, Math.LN2, 0.01), 'r=4：λ ≈ ln2', ch.toFixed(6) + ' vs ' + Math.LN2.toFixed(6));
  ok(w3 < 0, 'r=3.83 周期3窗口：λ 回落到负（混沌中的孤岛）', w3.toFixed(6));
  // λ 首次显著翻正的位置应落在 r∞ 附近（之后有周期窗口，不能取「最后一次为负」）
  let firstPos = 0;
  for (let r = 3.50; r <= 3.60; r += 0.0005){
    if (M.lyapunov(r, 800, 600) > 0.005){ firstPos = r; break; }
  }
  ok(near(firstPos, M.R_INF, 0.003), 'λ 首次翻正 ≈ r∞', firstPos.toFixed(6));
}

console.log('--- 6. 吸引子周期判定 ---');
{
  ok(M.detectPeriod(2.5) === 1, 'r=2.5 → 周期1');
  ok(M.detectPeriod(3.2) === 2, 'r=3.2 → 周期2');
  ok(M.detectPeriod(3.5) === 4, 'r=3.5 → 周期4');
  ok(M.detectPeriod(3.55) === 8, 'r=3.55 → 周期8');
  ok(M.detectPeriod(3.83) === 3, 'r=3.83 → 周期3');
  ok(M.detectPeriod(4.0) === 0, 'r=4 → 精度内不重复（混沌）');
}

console.log('\n结果：' + pass + ' 通过 / ' + fail + ' 失败');
if (fail){ console.log('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
