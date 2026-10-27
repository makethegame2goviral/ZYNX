import {setSoundEnabled} from './audio.js';
export let activeInput=null;
export function setupDesktopControls(input){
 activeInput=input;const keys=new Set();input.touchX=0;input.touchY=0;
 const editing=()=>['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName);
 window.addEventListener('keydown',e=>{if(editing())return;keys.add(e.code);if(e.code==='Space'){e.preventDefault();input.jumpRequested=true;}if(e.code==='KeyE')input.interactRequested=true;});
 window.addEventListener('keyup',e=>keys.delete(e.code));
 window.addEventListener('blur',()=>{keys.clear();input.touchX=input.touchY=0;input.moveInput.set(0,0);});
 input.updateFromKeyboard=()=>{const modal=[...document.querySelectorAll('.panel')].some(p=>!p.classList.contains('hidden')&&!p.closest('.hidden'));if(editing()||modal){input.moveInput.set(0,0);return;}input.moveInput.set((keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+input.touchX,(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)+input.touchY);};
}
export function setupMouseCamera(canvas,state){let id=null,x=0;canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch')return;id=e.pointerId;x=e.clientX;canvas.setPointerCapture(id);});canvas.addEventListener('pointermove',e=>{if(e.pointerId!==id)return;state.yaw-=(e.clientX-x)*.004;x=e.clientX;});for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>id=null);}
export function setupTouchControls(input,state){
 const zone=document.getElementById('joystick-zone'),knob=document.getElementById('joystick-knob'),canvas=document.getElementById('game-canvas');
 zone.style.touchAction='none';zone.style.userSelect='none';zone.style.webkitUserSelect='none';zone.style.webkitTouchCallout='none';let id=null,cameraId=null,x=0;
 const move=e=>{if(e.pointerId!==id)return;e.preventDefault();const r=zone.getBoundingClientRect(),max=45;let dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2;const scale=Math.min(1,max/(Math.hypot(dx,dy)||1));dx*=scale;dy*=scale;knob.style.transform=`translate(${dx}px,${dy}px)`;input.touchX=dx/max;input.touchY=-dy/max;};
 zone.addEventListener('pointerdown',e=>{id=e.pointerId;zone.setPointerCapture(id);move(e);});zone.addEventListener('pointermove',move);
 for(const event of ['pointerup','pointercancel','lostpointercapture'])zone.addEventListener(event,()=>{id=null;input.touchX=input.touchY=0;knob.style.transform='';});
 canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'||cameraId!==null)return;cameraId=e.pointerId;x=e.clientX;canvas.setPointerCapture(cameraId);});
 canvas.addEventListener('pointermove',e=>{if(e.pointerId!==cameraId)return;state.yaw-=(e.clientX-x)*.005;x=e.clientX;});
 for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,e=>{if(e.pointerId===cameraId)cameraId=null;});
 for(const [id,key] of [['jump-button','jumpRequested'],['interact-button','interactRequested']]){const button=document.getElementById(id);button.style.touchAction='none';button.style.userSelect='none';button.style.webkitTouchCallout='none';button.addEventListener('pointerdown',e=>{e.preventDefault();input[key]=true;});}
}
export function setupPanels(){for(const name of ['inventory','settings'])document.getElementById(`${name}-button`).onclick=()=>document.getElementById(`${name}-panel`).classList.toggle('hidden');document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>document.getElementById(b.dataset.close).classList.add('hidden'));document.getElementById('sound-toggle').onchange=e=>setSoundEnabled(e.target.checked);}
