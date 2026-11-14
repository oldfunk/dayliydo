// 无头自检：提取 index.html 内联脚本，在最小 DOM 桩上验证模型与视图约束。
// 运行：node selftest.js
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('未找到内联脚本'); process.exit(1); }
let src = m[1];

// 截掉尾部启动调用，改为受控启动
const boot = /buildAll\(\);\nsyncLabels\(\);\ndraw\(\);\nrequestAnimationFrame\(loop\);/;
if (!boot.test(src)) { console.error('启动代码未被识别，无法截断'); process.exit(1); }
src = src.replace(boot, '');

// ---- DOM 桩 ----
const ctx2d = {
  clearRect() {}, fillRect() {}, strokeRect() {}, beginPath() {}, closePath() {},
  arc() {}, clip() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {},
  save() {}, restore() {}, fillText() {}, setLineDash() {},
  createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  putImageData() {},
};
function makeEl(id) {
  return {
    id, textContent: '', className: '', value: '0', checked: true, style: {},
    width: 900, height: 640, _h: {},
    getContext: () => ctx2d,
    addEventListener(t, f) { (this._h[t] = this._h[t] || []).push(f); },
    click() { (this._h.click || []).forEach(f => f.call(this)); },
    setAttribute() {},
    appendChild() {}, removeChild() {},
    toDataURL: () => 'data:image/png;base64,',
  };
}
const els = {};
const document = {
  getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
  createElement() { return makeEl('c'); },
  body: makeEl('body'),
  addEventListener() {},
};
const defaults = {
  K: '0.8', W: '0.5', N: '400', seed: '20261115', spd: '6',
  dist: 'lorentz', topo: 'all', init: 'random', trails: '1',
};
for (const [k, v] of Object.entries(defaults)) document.getElementById(k).value = v;

const vm = require('vm');
const sandbox = {
  window: { setTimeout: () => 0 },
  document,
  navigator: {},
  requestAnimationFrame: () => 1,
  setTimeout: () => 0,
  console,
};
vm.createContext(sandbox);
vm.runInContext(src, sandbox);

const T = sandbox.window.__t;
if (!T) { console.error('未暴露 __t'); process.exit(1); }

// ---- 断言工具 ----
let pass = 0, fail = 0;
function ok(cond, name, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  -> ' + detail : '')); }
}
function section(s) { console.log('\n== ' + s + ' =='); }

// 直方图：返回每桶计数与（峰值、谷值）结构
function histOf(arr, n) {
  const h = new Array(n).fill(0);
  for (const v of arr) { let b = Math.floor(v / T.TAU * n); if (b >= n) b = n - 1; h[b]++; }
  return h;
}

// ---------- 模型层 ----------
section('模型层');

T.dist = 'lorentz'; T.gam = 0.5; T.topo = 'all'; T.N = 400; T.K = 0.8; T.seed = 20261115;
T.buildAll();
ok(T.th.length === 400 && T.om.length === 400, 'buildAll 生成 N 个相位与频率');
let inRange = true;
for (let i = 0; i < T.N; i++) if (!(T.th[i] >= 0 && T.th[i] < T.TAU)) inRange = false;
ok(inRange, '全部相位落在 [0, 2π)');
ok(T.r >= 0 && T.r <= 1, '序参量 r ∈ [0,1]', 'r=' + T.r);

// A3 无序相
T.K = 0; T.buildAll(); T.step(600);
ok(T.r < 0.12, 'K=0 无序相 r<0.12（理论 r~1/√N）', 'r=' + T.r.toFixed(4));

// A4 强耦合锁相
T.dist = 'gauss'; T.gam = 0.5; T.K = 8; T.N = 400; T.seed = 999;
T.buildAll(); T.step(800);
ok(T.r > 0.95, 'K=8 强耦合锁相 r>0.95', 'r=' + T.r.toFixed(4));

// A5 转变点 vs 解析 Kc=2γ
section('临界转变点 vs 解析 Kc');
T.dist = 'lorentz'; T.gam = 0.5; T.topo = 'all'; T.N = 256; T.seed = 4242;
const theory = T.theoryKc();
ok(Math.abs(theory - 1.0) < 1e-12, '洛伦兹 γ=0.5 的解析 Kc=2γ=1.0', 'Kc=' + theory);
let kStart = null;
const scan = [];
for (const k of [0.8, 1.0, 1.2, 1.4, 1.6]) {
  T.K = k;
  T.buildAll();
  T.step(1400);
  scan.push([T.K, T.r]);
  if (kStart === null && T.r > 0.15) kStart = T.K;
}
console.log('   扫描 ' + scan.map(p => p[0].toFixed(1) + ':' + p[1].toFixed(3)).join(' '));
ok(kStart !== null && kStart >= 0.85 && kStart <= 1.35,
   '实测转变起点 K_start 落在 [0.85,1.35]×解析 Kc 内', 'K_start=' + kStart);
const rLow = scan.find(p => p[0] <= 0.9)[1];
const rHigh = scan.find(p => p[0] >= 1.4)[1];
ok(rLow < 0.15 && rHigh > 0.3, '转变陡峭：K≤0.8 时 r<0.15，K≥1.4 时 r>0.3',
   'r(0.8)=' + rLow.toFixed(3) + ' r(1.4)=' + rHigh.toFixed(3));

// A6 O(N) 序参量技巧 vs 直接求和
T.dist = 'gauss'; T.gam = 0.5; T.topo = 'all'; T.N = 64; T.K = 1.3; T.seed = 3;
T.buildAll();
{
  const th = T.th, N = T.N;
  let re = 0, im = 0;
  for (let i = 0; i < N; i++) { re += Math.cos(th[i]); im += Math.sin(th[i]); }
  re /= N; im /= N;
  const r = Math.hypot(re, im), psi = Math.atan2(im, re);
  let maxd = 0;
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let j = 0; j < N; j++) s += Math.sin(th[j] - th[i]);
    s /= N;
    maxd = Math.max(maxd, Math.abs(s - r * Math.sin(psi - th[i])));
  }
  ok(maxd < 1e-12, 'O(N) 序参量形式与直接求和等价', 'max|diff|=' + maxd.toExponential(3));
  let s = 0;
  for (let i = 0; i < N; i++) s += Math.sin(psi - th[i]);
  ok(Math.abs(s) < 1e-9, '序参量自洽 Σsin(ψ−θ)=0', 'sum=' + s.toExponential(3));
}

// A8 双峰簇同步 vs 单峰
section('双峰簇同步');
function clusterTest(kind) {
  T.dist = kind; T.gam = 0.6; T.topo = 'all'; T.N = 600; T.K = 1.2; T.seed = 777;
  T.buildAll(); T.step(900);
  const h = histOf(T.th, 16);
  // 环形连续非空段
  let segs = [], cur = 0, start = -1;
  for (let i = 0; i < 16; i++) if (h[i] === 0) { start = i; break; }
  if (start === -1) { segs = [h.reduce((a, b) => a + b, 0)]; }
  else {
    let idx = (start + 1) % 16;
    for (let k = 0; k < 16; k++) {
      if (h[idx] > 0) cur += h[idx];
      else if (cur > 0) { segs.push(cur); cur = 0; }
      idx = (idx + 1) % 16;
    }
    if (cur > 0) segs.push(cur);
  }
  const peak = Math.max(...h);
  return { r: T.r, peak, segs, hist: h.join(',') };
}
const bi = clusterTest('bimodal');
const uni = clusterTest('gauss');
const biTop2 = bi.segs.sort((a, b) => b - a).slice(0, 2).reduce((a, b) => a + b, 0);
const uniTop1 = Math.max(...uni.segs);
console.log('   双峰 r=' + bi.r.toFixed(3) + ' 段=' + bi.segs.join('+') + ' hist=' + bi.hist);
console.log('   单峰 r=' + uni.r.toFixed(3) + ' 段=' + uni.segs.join('+') + ' hist=' + uni.hist);
ok(bi.segs.length >= 2 && biTop2 / 600 > 0.8, '双峰分布分裂为两个分离相位簇', '段数=' + bi.segs.length);
ok(uniTop1 / 600 > 0.9, '单峰分布保持单一连续相位团（对照）', '最大段=' + uniTop1);

// A9 拓扑对比：小世界 vs 纯环
section('拓扑决定同步');
function topoRun(topo) {
  T.dist = 'gauss'; T.gam = 0.5; T.topo = topo; T.N = 400; T.K = 2.0; T.seed = 5;
  T.buildAll(); T.step(1200);
  return T.r;
}
const rSW = topoRun('sw');
const rRing = topoRun('ring');
console.log('   小世界 r=' + rSW.toFixed(3) + '  纯环 r=' + rRing.toFixed(3));
ok(rSW > 0.75, '小世界（长程边）K=2 高度同步 r>0.75', 'r=' + rSW.toFixed(3));
ok(rRing < 0.45, '纯环（一维局部）同参数下难以同步 r<0.45', 'r=' + rRing.toFixed(3));

// A10 确定性
section('确定性');
T.dist = 'lorentz'; T.gam = 0.5; T.topo = 'all'; T.N = 200; T.K = 1.5; T.seed = 4242;
T.buildAll(); T.step(300);
const snap = Array.from(T.th);
T.buildAll(); T.step(300);
let maxd = 0;
for (let i = 0; i < 200; i++) maxd = Math.max(maxd, Math.abs(T.th[i] - snap[i]));
ok(maxd === 0, '同种子两次运行相位逐格相同', 'max|Δ|=' + maxd);

// A11 环邻接首尾相接
T.topo = 'ring'; T.N = 12; T.buildAll();
const a0 = T.adj[0];
ok(a0.indexOf(11) >= 0 && a0.indexOf(1) >= 0, '环拓扑 adj[0] 含 N-1 与 1', 'adj[0]=' + a0.join(','));

// A12 解析 Kc 公式
T.dist = 'gauss'; T.gam = 0.5;
ok(Math.abs(T.theoryKc() - 2 * Math.sqrt(2 / Math.PI) * 0.5) < 1e-12, '高斯 Kc=2√(2/π)·γ');
T.dist = 'bimodal';
ok(Number.isNaN(T.theoryKc()), '双峰无解析 Kc（返回 NaN）');

// ---------- 视图层 ----------
section('视图层冒烟');
let threw = null;
try {
  T.dist = 'lorentz'; T.gam = 0.5; T.topo = 'all'; T.N = 300; T.K = 1.1; T.seed = 99;
  T.buildAll(); T.step(40);
  T.draw();
  T.updateStat();
  T.syncLabels();
} catch (e) { threw = e; }
ok(!threw, 'draw/updateStat/syncLabels 无异常', threw ? String(threw) : '');
const statEl = document.getElementById('stat');
ok(statEl.textContent.indexOf('序参量') >= 0 && statEl.textContent.indexOf('Kc') >= 0,
   '统计面板写入 r 与 Kc', JSON.stringify(statEl.textContent.slice(0, 40)));
ok(document.getElementById('vK').textContent.length > 0, '滑杆数值标签同步');
ok(document.getElementById('badge').textContent.length > 0, '状态徽章有文本');
const thLen = T.th.length;
T.N = 120; T.buildAll();
ok(T.th.length === 120 && T.om.length === 120, '改 N 后重建数组');

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
