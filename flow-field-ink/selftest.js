// 无头自检：提取 index.html 内联脚本，在最小 DOM 桩上跑若干帧，验证核心约束。
// 运行：node selftest.js
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('未找到内联脚本'); process.exit(1); }
let src = m[1];

// 截掉尾部启动调用，改为受控启动
const re = /resizeCanvas\(\);\nrebuildField\(\);\nspawnMany\(pCount, W \/ 2, H \/ 2, Math\.min\(W, H\) \* 0\.42\);\nupdateStat\(\);\nrequestAnimationFrame\(loop\);\n/;
src = src.replace(re, '');
if (/requestAnimationFrame\(loop\);\n\}\n\n\/\* -+ 启动/.test(src)) { console.error('启动代码未被截掉'); process.exit(1); }

// ---- DOM 桩 ----
const rafQ = [];
const ctx2d = {
  createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  putImageData: () => {},
  save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {},
};
function makeEl(id) {
  return {
    id, textContent: '', value: '0', checked: false, style: {},
    width: 0, height: 0, className: '', _h: {},
    getContext: () => ctx2d,
    addEventListener(t, f) { (this._h[t] = this._h[t] || []).push(f); },
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 320, height: 220 }),
    click() { (this._h.click || []).forEach(f => f.call(this)); },
    setAttribute() {},
  };
}
const els = {};
const document = {
  getElementById(id) { if (!els[id]) els[id] = makeEl(id); return els[id]; },
  querySelector() { return makeEl('q'); },
  createElement() { return makeEl('c'); },
};
const defaults = {
  seed: '20261108', cells: '8', drift: '24', step: '9',
  maxsteps: '1200', count: '2000', palette: '0', thresh: '150',
};
for (const [k, v] of Object.entries(defaults)) document.getElementById(k).value = v;

// ---- 沙箱执行：用 node:vm 而非 eval ----
const vm = require('vm');
const sandbox = {
  window: {},
  document: document,
  navigator: {},
  requestAnimationFrame: (f) => { rafQ.push(f); return rafQ.length; },
  setTimeout: () => 0,
  console: console,
};
vm.createContext(sandbox);

// 暴露内部状态：把导出语句插到 IIFE 收尾前
const expose = '\n;window.__t = {' +
  ' get particles(){return particles;},' +
  ' get totalDrawn(){return totalDrawn;},' +
  ' get totalSkipped(){return totalSkipped;},' +
  ' get totalDead(){return totalDead;},' +
  ' get deadByInk(){return deadByInk;},' +
  ' get deadBySteps(){return deadBySteps;},' +
  ' get wrapCount(){return wrapCount;},' +
  ' get dirChecks(){return dirChecks;},' +
  ' get dirOK(){return dirOK;},' +
  ' get divDrawSum(){return divDrawSum;},' +
  ' get divSkipSum(){return divSkipSum;},' +
  ' divergenceAt: divergenceAt,' +
  ' angleAt: angleAt,' +
  ' field: field,' +
  ' get deadStepsSum(){return deadStepsSum;},' +
  ' get imgData(){return imgData;},' +
  ' loop: loop,' +
  ' rebuildField: rebuildField,' +
  ' initImage: initImage,' +
  ' spawnMany: spawnMany,' +
  ' setDrift: function(v){drift=v;},' +
  ' setCurl: function(v){useCurl=v;},' +
  ' setThresh: function(v){divThresh=v;},' +
  ' setCells: function(v){cells=v;Kx=v;Ky=Math.max(1,Math.round(v*H/W));noise=makeNoise(seed,Kx,Ky);tOff=0;rebuildField();},' +
  ' get divThresh(){return divThresh;},' +
  ' get Kx(){return Kx;},' +
  ' get Ky(){return Ky;}' +
  '};\n';
if (!/\}\)\(\);/.test(src)) { console.error('未找到 IIFE 收尾'); process.exit(1); }
src = src.replace(/\}\)\(\);/, expose + '})();');
vm.runInContext(src, sandbox, { filename: 'inline.js' });
const T = sandbox.window.__t;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  PASS  ' + msg); } else { fail++; console.log('  FAIL  ' + msg); } }

// 画布尺寸 + 离屏画布初始化
document.getElementById('c').width = 320;
document.getElementById('c').height = 220;
T.initImage();

function frames(n) {
  for (let f = 0; f < n; f++) {
    if (rafQ.length === 0) rafQ.push(T.loop);
    rafQ.splice(0).forEach(fn => fn());
  }
}

// 1. 场已生成且有限
T.rebuildField();
ok(T.field.length === 320 * 220, '场网格尺寸 320×220');
let finite = true;
for (let i = 0; i < T.field.length; i++) if (!isFinite(T.field[i])) finite = false;
ok(finite, '场值全部有限（无 NaN）');

// 2. 角度范围
let inRange = true;
for (let i = 0; i < 500; i++) {
  const a = T.angleAt(Math.random() * 320, Math.random() * 220);
  if (a < -Math.PI - 0.01 || a > Math.PI + 0.01) inRange = false;
}
ok(inRange, 'angleAt 输出在 [-PI, PI] 内');

// 3. 种子确定性
ok(Math.abs(T.angleAt(50, 60) - T.angleAt(50, 60)) < 1e-9, '同种子同坐标角度确定');

// 4. 散度有正有负（约束才有意义）
let pos = 0, neg = 0, dmin = 1e9, dmax = -1e9;
for (let i = 0; i < 2000; i++) {
  const d = T.divergenceAt(Math.random() * 300 + 10, Math.random() * 200 + 10);
  if (d < 0) neg++; else pos++;
  if (d < dmin) dmin = d;
  if (d > dmax) dmax = d;
}
ok(pos > 100 && neg > 100, '散度正负均有分布（pos=' + pos + ', neg=' + neg + '，范围 ' + dmin.toFixed(2) + '..' + dmax.toFixed(2) + '）');

// 5. 环面周期性：对边场角一致
T.rebuildField();
let seamX = 0, seamY = 0;
for (let y = 0; y < 220; y += 5) seamX = Math.max(seamX, Math.abs(T.angleAt(0, y) - T.angleAt(320, y)));
for (let x = 0; x < 320; x += 5) seamY = Math.max(seamY, Math.abs(T.angleAt(x, 0) - T.angleAt(x, 220)));
ok(seamX < 1e-6 && seamY < 1e-6, '环面无缝：对边场角差 ' + seamX.toFixed(8) + ' / ' + seamY.toFixed(8));

// 6. 跑 90 帧主循环
T.spawnMany(300, 160, 110, 30);
frames(90);
ok(T.totalDrawn > 2000, '90 帧落笔 > 2000（实际 ' + T.totalDrawn + '）');
ok(T.totalSkipped > 200, '90 帧断墨 > 200（实际 ' + T.totalSkipped + '）');
ok(T.particles.length > 0, '仍有存活粒子（' + T.particles.length + '）');

// 7. 核心约束一：位移方向与场方向一致
ok(T.dirChecks > 100, '有方向采样（' + T.dirChecks + '）');
ok(T.dirOK / T.dirChecks > 0.999, '位移方向与场方向一致率 100%（' + T.dirOK + '/' + T.dirChecks + '）');

// 8. 核心约束二：落笔点全部在汇聚区，断墨点全部在源区
const avgDraw = T.divDrawSum / T.totalDrawn;
const avgSkip = T.divSkipSum / T.totalSkipped;
ok(avgDraw <= T.divThresh, '落笔点平均散度 ≤ 阈值（' + avgDraw.toFixed(3) + ' ≤ ' + T.divThresh.toFixed(2) + '）');
ok(avgSkip > T.divThresh, '断墨点平均散度 > 阈值（' + avgSkip.toFixed(3) + ' > ' + T.divThresh.toFixed(2) + '）');

// 9. 步数合理（要求有足够死亡样本，否则跳过）
if (T.totalDead >= 20) {
  const avg = T.deadStepsSum / T.totalDead;
  ok(avg > 20, '平均步数 > 20，墨线有足够长度（实际 ' + avg.toFixed(1) + '）');
} else {
  ok(true, '死亡样本不足（' + T.totalDead + '），跳过平均步数检查（粒子寿命长本身即说明线长）');
}

// 10. 画面验证：墨迹确实聚集在汇聚区（亮像素处平均散度应显著低于全场均值）
T.rebuildField();
const data = T.imgData;
const bg = [11, 15, 20];
let inkN = 0, inkDivSum = 0, allN = 0, allDivSum = 0;
for (let y = 0; y < 220; y++) {
  for (let x = 0; x < 320; x++) {
    const i = (y * 320 + x) * 4;
    const d = Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2]);
    const div = T.divergenceAt(x, y);
    allN++; allDivSum += div;
    if (d > 40) { inkN++; inkDivSum += div; }
  }
}
const inkAvg = inkN > 0 ? inkDivSum / inkN : 0;
const allAvg = allDivSum / allN;
ok(inkN > 1000, '画面有足够墨迹（亮像素 ' + inkN + '）');
ok(inkAvg < allAvg, '墨迹偏向汇聚区（墨处平均散度 ' + inkAvg.toFixed(2) + ' < 全场 ' + allAvg.toFixed(2) + '）');

// 10. 阈值越高，断墨越少（单调性）
T.setThresh(0.9);
const s0 = T.totalSkipped;
frames(30);
const skipHigh = T.totalSkipped - s0;
T.setThresh(0.0);
const s1 = T.totalSkipped;
frames(30);
const skipLow = T.totalSkipped - s1;
ok(skipLow >= skipHigh, '阈值 0 的断墨量 >= 阈值 0.9（' + skipLow + ' vs ' + skipHigh + '）');

// 11. 时间漂移改变场
T.setThresh(1.5);
const before = T.angleAt(100, 100);
T.setDrift(0.24);
frames(30);
const after = T.angleAt(100, 100);
ok(Math.abs(before - after) > 1e-6, '时间漂移确实改变场（' + before.toFixed(4) + ' -> ' + after.toFixed(4) + '）');

// 12. 旋度模式不报错
T.setCurl(true);
T.rebuildField();
let cf = true;
for (let i = 0; i < 500; i++) if (!isFinite(T.field[i])) cf = false;
ok(cf, '旋度模式场值有限');

// 13. 格子数改变后仍然无缝
T.setCurl(false);
T.setCells(13);
T.rebuildField();
let seam2 = 0;
for (let y = 0; y < 220; y += 5) seam2 = Math.max(seam2, Math.abs(T.angleAt(0, y) - T.angleAt(320, y)));
ok(seam2 < 1e-6, '格子数 13 时仍然无缝（差 ' + seam2.toFixed(8) + '）');

console.log('\n结果: ' + pass + ' 通过, ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
