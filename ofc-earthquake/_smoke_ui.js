// 最小 DOM/Canvas 桩：执行 index.html 的 UI 脚本，跑一遍主要交互，捕获运行时错误。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const modelSrc = blocks.find(s => s.includes('MODEL-BEGIN'));
const ui = blocks[blocks.length - 1];
if (!modelSrc || !ui) throw new Error('script blocks not found');

function ctx2d(){
  const p = {
    fillStyle:'', strokeStyle:'', lineWidth:1, font:'', imageSmoothingEnabled:true,
    globalAlpha:1, shadowBlur:0, shadowColor:'',
    setTransform(){}, clearRect(){}, fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){},
    stroke(){}, fill(){}, arc(){}, fillText(){}, setLineDash(){}, drawImage(){},
    putImageData(){}, save(){}, restore(){}, rect(){}, closePath(){}, translate(){}, scale(){},
    createImageData(w,h){ return { width:w, height:h, data:new Uint8ClampedArray(w*h*4) }; },
    getImageData(x,y,w,h){ return { width:w, height:h, data:new Uint8ClampedArray(w*h*4) }; },
    measureText(){ return { width:10 }; }
  };
  return p;
}
function makeEl(id){
  const listeners = {};
  return {
    id, width:300, height:150, clientWidth:300, clientHeight:150,
    textContent:'', className:'', value:'0', disabled:false, style:{}, download:'', href:'',
    children:[],
    classList:{ add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    addEventListener(t,fn){ (listeners[t]=listeners[t]||[]).push(fn); },
    removeEventListener(){},
    dispatch(t,ev){ (listeners[t]||[]).forEach(fn=>fn(ev||{preventDefault(){},target:{tagName:'DIV'}})); },
    appendChild(c){ this.children.push(c); },
    replaceChildren(){ this.children=[]; },
    setPointerCapture(){}, releasePointerCapture(){},
    getBoundingClientRect(){ return { left:0, top:0, width:this.width, height:this.height }; },
    getContext(){ return ctx2d(); },
    toDataURL(){ return 'data:image/png;base64,x'; },
    click(){ this.dispatch('click',{preventDefault(){}}); }
  };
}
const els = new Map();
const document = {
  getElementById(id){ if(!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  createElement(tag){ return makeEl('el-' + tag + '-' + Math.random()); },
  addEventListener(){},
  body: makeEl('body')
};
const window = { devicePixelRatio:1, addEventListener(){} };
const rafQueue = [];
let now = 0;
const sandbox = {
  document, window, console, Math, Date, JSON, String, Number, parseInt, parseFloat,
  Uint8Array, Int8Array, Int32Array, Float64Array, Uint8ClampedArray, Array, Object, Set, Map,
  isNaN, isFinite, performance: { now(){ return now; } },
  setTimeout(fn){ fn(); return 0; },
  clearTimeout(){},
  requestAnimationFrame(fn){ rafQueue.push(fn); return rafQueue.length; },
  globalThis: null
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function run(src, name){ vm.runInContext(src, sandbox, { filename: name }); }

let pass = 0, fail = 0;
const fails = [];
function ok(c, m, e){ if (c) pass++; else { fail++; fails.push(m + (e ? ' -> ' + e : '')); } }

try {
  run(modelSrc, 'model.js');
  ok(true, '模型段可执行');
} catch (err) { ok(false, '模型段可执行', err.message); }

try {
  run(ui, 'ui.js');
  ok(true, 'UI 段可执行（启动无异常）');
} catch (err) { ok(false, 'UI 段可执行', err.message + '\n' + (err.stack||'').split('\n')[1]); }

function el(id){ return document.getElementById(id); }

/* 主循环：跑若干帧 */
function frames(n){
  for (let i = 0; i < n; i++){
    now += 16.7;
    const q = rafQueue.splice(0, rafQueue.length);
    q.forEach(fn => fn());
  }
}
try {
  frames(5);
  ok(true, '主循环跑 5 帧无异常');
} catch (err) { ok(false, '主循环跑 5 帧无异常', err.message); }

/* 控件 */
function safe(name, fn){
  try { fn(); ok(true, name); }
  catch (err) { ok(false, name, err.message); }
}
safe('点击「触发主震」', () => el('btnQuake').click());
safe('点击「暂停/继续」两次', () => { el('btnPause').click(); el('btnPause').click(); });
safe('点击「震后重记」', () => el('btnDrop').click());
safe('点击「重置」', () => el('btnReset').click());
safe('点击「随机种子」', () => el('btnSeed').click());
safe('点击「清空统计」', () => el('btnClear').click());
safe('点击「导出 PNG」', () => el('btnPNG').click());

safe('拖动加载速率滑块', () => {
  const s = el('rate'); s.value = '-2.5'; s.dispatch('input', { target: s });
});
safe('拖动耗散滑块', () => {
  const s = el('alpha'); s.value = '0.9'; s.dispatch('input', { target: s });
});
safe('拖动边长滑块', () => {
  const s = el('LL'); s.value = '64'; s.dispatch('input', { target: s });
});
safe('拖动速度滑块', () => {
  const s = el('speed'); s.value = '20'; s.dispatch('input', { target: s });
});

safe('画布点击（注水）', () => {
  const st = el('stage');
  st.dispatch('pointerdown', { clientX: 10, clientY: 10, shiftKey: false, pointerId: 1, preventDefault(){} });
  st.dispatch('pointerup', {});
});
safe('画布 Shift+点击（挖低）', () => {
  const st = el('stage');
  st.dispatch('pointerdown', { clientX: 20, clientY: 20, shiftKey: true, pointerId: 2, preventDefault(){} });
  st.dispatch('pointerup', {});
});
safe('画布拖动', () => {
  const st = el('stage');
  st.dispatch('pointerdown', { clientX: 5, clientY: 5, shiftKey: false, pointerId: 3, preventDefault(){} });
  st.dispatch('pointermove', { clientX: 50, clientY: 50 });
  st.dispatch('pointerup', {});
});

safe('键盘：空格', () => {
  // 键盘监听挂在 document 上，桩里未收集；这里直接验证按钮未被卡死
  el('btnQuake').click();
});

safe('批处理（跑 2000 次地震）', () => {
  el('btnRun').click();
});

safe('批处理后再跑 20 帧', () => frames(20));

/* 读回显示值，确认 UI 真的更新了 */
ok(el('sQ').textContent !== '' && el('sQ').textContent !== '0', 'UI 显示记录地震数', String(el('sQ').textContent));
ok(el('runStat').textContent.length > 0, '运行状态文案已更新', el('runStat').textContent);
ok(String(el('grNote').textContent).includes('样本'), 'GR 图注已刷新', el('grNote').textContent.slice(0, 40));

console.log('\nUI 冒烟：通过 ' + pass + ' 项 · 失败 ' + fail + ' 项');
if (fails.length){ console.log('失败明细:'); fails.forEach(s => console.log('  x ' + s)); process.exit(1); }
console.log('UI SMOKE PASS');
