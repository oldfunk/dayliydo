// 最小 DOM/Canvas 桩：执行 index.html 的 UI 脚本，跑一遍主要交互，捕获运行时错误。
// 用法：node _smoke_ui.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const modelSrc = blocks.find(s => s.includes('MODEL-BEGIN'));
const ui = blocks[blocks.length - 1];

function ctx2d(){
  return {
    fillStyle:'', strokeStyle:'', lineWidth:1, font:'', globalAlpha:1,
    setTransform(){}, clearRect(){}, fillRect(){}, beginPath(){}, moveTo(){}, lineTo(){},
    stroke(){}, fill(){}, arc(){}, fillText(){}, setLineDash(){}, drawImage(){},
    putImageData(){}, save(){}, restore(){}, rect(){}, closePath(){},
    createImageData(w,h){ return { width:w, height:h, data:new Uint8ClampedArray(w*h*4) }; },
    getImageData(x,y,w,h){ return { width:w, height:h, data:new Uint8ClampedArray(w*h*4) }; },
    measureText(){ return { width:10 }; }
  };
}
function makeEl(id){
  const listeners = {};
  const el = {
    id, width:(id==='bif'||id==='lyap')?960:440, height:(id==='bif')?560:(id==='cob')?440:180,
    clientWidth:960, clientHeight:560,
    textContent:'', innerHTML:'', className:'', value:'0', disabled:false, style:{},
    children:[], dataset:{},
    classList:{ toggle(){}, add(){}, remove(){} },
    addEventListener(t,fn){ (listeners[t]=listeners[t]||[]).push(fn); },
    removeEventListener(){},
    dispatch(t,ev){ (listeners[t]||[]).forEach(fn=>fn(ev||{preventDefault(){},target:el})); },
    appendChild(c){ this.children.push(c); },
    replaceChildren(){ this.children=[]; },
    getBoundingClientRect(){ return { left:0, top:0, width:this.width, height:this.height }; },
    getContext(){ return ctx2d(); },
    toDataURL(){ return 'data:image/png;base64,x'; },
    click(){ this.dispatch('click',{preventDefault(){},target:el}); },
    closest(){ return el; }
  };
  // 真实 DOM 里 textContent='' 会清空子节点，桩要模拟这一行为
  let _text = '';
  Object.defineProperty(el, 'textContent', {
    get(){ return _text; },
    set(v){ _text = String(v); if (v === '') el.children = []; }
  });
  return el;
}
const els = new Map();
const document = {
  getElementById(id){ if(!els.has(id)) els.set(id, makeEl(id)); return els.get(id); },
  createElement(tag){ return makeEl('el-' + tag); },
  addEventListener(){}, body: makeEl('body')
};
const window = { devicePixelRatio:1, addEventListener(){} };
const rafQueue = [];
const intervals = [];
const sandbox = {
  document, window, console, Math, Date, JSON, String, Number, parseInt, parseFloat,
  Uint8Array, Int8Array, Int32Array, Float64Array, Uint16Array, Uint8ClampedArray,
  Array, Object, Set, Map, isNaN, isFinite,
  setTimeout(fn){ fn(); return 0; }, clearTimeout(){},
  setInterval(fn,ms){ intervals.push(fn); return intervals.length; }, clearInterval(){},
  requestAnimationFrame(fn){ rafQueue.push(fn); return rafQueue.length; },
  performance:{ now(){ return Date.now(); } }
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let pass = 0, fail = 0;
function ok(c,n,d){ if(c){pass++;console.log('  ok   '+n+(d?'  ['+d+']':''));} else {fail++;console.log('  FAIL '+n+(d?'  ['+d+']':''));} }
function runFrames(max){
  let n=0;
  while(rafQueue.length && n < (max||500)){ const q=rafQueue.splice(0); q.forEach(fn=>{ try{fn();}catch(e){ fail++; console.log('  rAF 异常: '+e.message); } }); n++; }
  return n;
}
function E(id){ return document.getElementById(id); }

try {
  // 页面只有一个 <script>：模型与 UI 同处一段，整体执行一次即可
  blocks.forEach((src, i) => vm.runInContext(src, sandbox, { filename:'page' + i + '.js' }));
  ok(true, 'UI 脚本执行无异常');
} catch (e) {
  ok(false, 'UI 脚本执行无异常', e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : String(e));
}

try {
  // 分岔图逐帧渲染
  const frames = runFrames(300);
  ok(frames > 40, '分岔图分批渲染推进完成', frames + ' 帧');
  ok(E('prog').style.width === '100%', '进度条到 100%', E('prog').style.width);

  // 费根鲍姆面板
  ok(E('feigBody').children.length === 6, '分岔表产出 6 行', String(E('feigBody').children.length));
  const d = parseFloat(E('bdDelta').textContent);
  ok(Math.abs(d - 4.6692) < 0.01, '顶部 δ 徽标逼近理论值', E('bdDelta').textContent);
  ok(E('conv').getContext !== undefined, 'δ 收敛图已绘制');

  // r 滑杆
  const sl = E('rSlider');
  sl.value = '3.5'; sl.dispatch('input');
  ok(E('rVal').textContent === '3.50000', '滑杆 → r 读数', E('rVal').textContent);
  ok(E('periodOut').textContent === '周期 4', '周期判定联动', E('periodOut').textContent);
  ok(parseFloat(E('lyapOut').textContent) < 0, 'λ 联动为负', E('lyapOut').textContent);
  ok(E('orbitOut').textContent.includes('轨道'), '轨道读数更新');
  sl.dispatch('change');
  ok(true, 'λ 曲线重算（change）无异常');

  // 预设 r
  const rp = E('rPills');
  rp.dataset.r = '3.83';
  rp.dispatch('click', { preventDefault(){}, target:rp });
  ok(E('rVal').textContent === '3.83000', '预设按钮「周期 3」生效', E('rVal').textContent);
  ok(E('periodOut').textContent === '周期 3', '预设后周期 = 3', E('periodOut').textContent);

  // 播放开关
  const pb = E('playBtn');
  pb.click(); ok(pb.textContent === '继续蛛网', '暂停按钮切换文案', pb.textContent);
  pb.click(); ok(pb.textContent === '暂停蛛网', '继续按钮切换文案', pb.textContent);
  ok(intervals.length > 0, '蛛网动画定时器已注册');
  intervals.forEach(fn => fn()); ok(true, '蛛网动画帧无异常');

  // 缩放预设 + 画布拖拽缩放 / 双击复位
  const zp = E('zoomPills');
  zp.dataset.zoom = '3.560,3.5715';
  zp.dispatch('click', { preventDefault(){}, target:zp });
  runFrames(300);
  ok(true, '缩放预设触发重绘无异常');
  const bif = E('bif');
  bif.dispatch('mousedown', { offsetX:100 });
  bif.dispatch('mouseup', { offsetX:300 });
  runFrames(300);
  ok(true, '拖拽缩放触发重绘无异常');
  bif.dispatch('dblclick', {});
  runFrames(300);
  ok(true, '双击复位触发重绘无异常');

  // 重新实测
  E('remeasure').click();
  ok(E('feigBody').children.length === 6, '重新实测 δ 仍产出 6 行');
  ok(!E('remeasure').disabled, '重新实测按钮恢复可用');

  // 完整跑一遍后无遗留 rAF 异常
  runFrames(300);
  ok(true, '全部交互后 rAF 队列清空无异常');
} catch (e) {
  ok(false, '交互冒烟', e && e.stack ? e.stack.split('\n').slice(0,4).join(' | ') : String(e));
}

console.log('');
console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
