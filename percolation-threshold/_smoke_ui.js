// 最小 DOM/Canvas 桩：执行 index.html 的 UI 脚本，跑一遍主要交互，捕获运行时错误。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const modelSrc = blocks.find(s => s.includes('MODEL-BEGIN'));
const ui = blocks[blocks.length - 1];

function ctx2d(){
  const p = {
    fillStyle:'', strokeStyle:'', lineWidth:1, font:'', imageSmoothingEnabled:true, globalAlpha:1,
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
const window = { devicePixelRatio:1, addEventListener(){}, };
const rafQueue = [];
const sandbox = {
  document, window, console, Math, Date, JSON, String, Number, parseInt, parseFloat,
  Uint8Array, Int8Array, Int32Array, Float64Array, Uint8ClampedArray, Array, Object, Set, Map,
  isNaN, isFinite,
  setTimeout(fn){ fn(); return 0; },
  clearTimeout(){},
  requestAnimationFrame(fn){ rafQueue.push(fn); return rafQueue.length; },
  Math
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

let pass = 0, fail = 0;
function ok(c,n,d){ if(c){pass++;console.log('  ok   '+n+(d?'  ['+d+']':''));} else {fail++;console.log('  FAIL '+n+(d?'  ['+d+']':''));} }

try {
  vm.runInContext(modelSrc, sandbox, { filename:'model.js' });
  vm.runInContext(ui, sandbox, { filename:'ui.js' });
  ok(true, 'UI 脚本执行无异常');
} catch (e) {
  ok(false, 'UI 脚本执行无异常', e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : String(e));
}

function run(){ const q = rafQueue.splice(0); q.forEach(fn => { try { fn(); } catch(e){ console.log('  rAF 异常: ' + e.message); fail++; } }); }

const P = document.getElementById('P');
const L = document.getElementById('L');
const S = document.getElementById('S');
const mode = document.getElementById('scanMode');

try {
  document.getElementById('btnGen').click();
  ok(true, '重新生成');
  run();

  P.value = '0.5000'; P.dispatch('input');
  ok(document.getElementById('vP').textContent.length > 0, 'p 滑块 → 重新生成', document.getElementById('vP').textContent);

  P.value = '0.5927'; P.dispatch('input');
  L.value = '64'; L.dispatch('input');
  ok(true, 'L 滑块 → 重建');
  run();

  S.value = '32'; S.dispatch('input');
  mode.value = 'single'; mode.dispatch('change');
  document.getElementById('btnScan').click();
  ok(document.getElementById('sPstar').textContent !== '—', '单尺寸扫描产出 p*', document.getElementById('sPstar').textContent);
  ok(document.getElementById('sPeak').textContent !== '—', '扫描产出 S 峰位', document.getElementById('sPeak').textContent);

  document.getElementById('btnClear').click();
  ok(document.getElementById('sPstar').textContent === '—', '清空曲线');

  mode.value = 'multi'; mode.dispatch('change');
  document.getElementById('btnScan').click();
  ok(true, '三尺寸对比扫描完成');

  document.getElementById('btnPC').click();
  ok(document.getElementById('vP').textContent.charAt(0) !== '', '跳到 p_c');

  document.getElementById('btnSeed').click();
  ok(document.getElementById('vSeed').textContent !== '', '随机种子');

  document.getElementById('btnReveal').click();
  run(); run(); run(); run(); run();
  ok(true, '逐格揭示推进');

  // 画布涂擦
  const st = document.getElementById('stage');
  st.dispatch('pointerdown', { clientX: 10, clientY: 10, pointerId: 1, preventDefault(){} });
  st.dispatch('pointerup', {});
  st.dispatch('pointerdown', { clientX: 200, clientY: 100, pointerId: 2, preventDefault(){} });
  st.dispatch('pointerup', {});
  ok(true, '画布点击涂/擦');

  document.getElementById('btnPNG').click();
  ok(true, '导出 PNG');

  run();
  ok(true, '连续 rAF 帧无异常');
} catch (e) {
  ok(false, '交互冒烟', e && e.stack ? e.stack.split('\n').slice(0,3).join(' | ') : String(e));
}

console.log('');
console.log('结果：' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
