import * as THREE from 'three';
import {GAME,RARITIES} from './config.js';
import {createWorld} from './world.js';
import {Player} from './player.js';
import {GuardianSystem,EggSystem} from './gameplay.js';
import {initSession} from './session.js';
import {initAuth,showAuth} from './auth.js';
import {initAdmin} from './admin.js';
import {api} from './api.js';
import {getSupabase} from './supabase.js';
import {sounds} from './audio.js';
import {setMoney,setSpeed,setZone,setPlayerName,setHint,renderInventory,showToast,currentZone} from './ui.js';
import {setupDesktopControls,setupMouseCamera,setupTouchControls,setupPanels} from './controls.js';
const el=id=>document.getElementById(id);
function showFatalError(message){let box=el('fatal-error');if(!box){box=document.createElement('div');box.id='fatal-error';box.style.cssText='position:fixed;bottom:12px;left:12px;right:12px;z-index:9999;padding:12px;background:#2a0b12;color:#ffd7dd;white-space:pre-wrap';document.body.appendChild(box);}box.textContent='ZYNX-Fehler: '+message;}
window.addEventListener('error',e=>showFatalError(e.message));window.addEventListener('unhandledrejection',e=>showFatalError(e.reason?.message||String(e.reason)));
const canvas=el('game-canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'default'});
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,1,.1,400),cameraState={yaw:0,pitch:.35},input={moveInput:new THREE.Vector2(),jumpRequested:false,interactRequested:false};
createWorld(scene);const player=new Player(scene),guardians=new GuardianSystem(scene),eggs=new EggSystem(scene);
for(const g of guardians.guardians.values()){const tier=RARITIES.findIndex(z=>z.id===g.id);g.group.scale.setScalar(1+Math.max(0,tier)*GAME.guardian.scalePerTier);}
const inventory=[];let carriedEgg=null,profile=null,roomId=null,running=false,loadingProfile=false,adminReady=false;
setupDesktopControls(input);setupMouseCamera(canvas,cameraState);if(matchMedia('(pointer: coarse)').matches){el('touch-controls').classList.remove('hidden');setupTouchControls(input,cameraState);}setupPanels();
function resize(){renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight,false);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();}addEventListener('resize',resize);resize();
function applyProfile(next){
 if(!next)throw Error('Profil fehlt in der Serverantwort');profile=next;
 const shop=THREE.MathUtils.clamp(Number(next.speed_shop_level)||0,0,GAME.player.maxShopLevel),training=THREE.MathUtils.clamp(Number(next.training_level)||0,0,GAME.player.maxTrainingLevel);
 player.speed=GAME.player.baseSpeed+shop*GAME.player.speedPerShopLevel;player.trainingSpeedBonus=training*GAME.player.speedPerTrainingLevel;
 setPlayerName(next.username);setMoney(Number(next.money)||0);setSpeed(player.currentSpeed);
 el('speed-level').textContent=`Level ${shop}/${GAME.player.maxShopLevel} · ${player.currentSpeed.toFixed(2)} m/s`;
 el('training-level').textContent=`Level ${training} · +${player.trainingSpeedBonus.toFixed(2)} m/s`;el('rebirth-count').textContent=String(next.rebirth_count);
 const cost=Math.round(GAME.shop.baseCost*Math.pow(GAME.shop.costMultiplier,shop)),button=el('buy-speed');
 button.textContent=shop>=GAME.player.maxShopLevel?'Maximales Shop-Level erreicht':`Speed kaufen · ${cost.toLocaleString('de-DE')} · danach ${Math.min(GAME.player.maxShopSpeed,player.speed+GAME.player.speedPerShopLevel+player.trainingSpeedBonus).toFixed(2)} m/s`;
 button.disabled=shop>=GAME.player.maxShopLevel||Number(next.money)<cost;
 el('rebirth-button').disabled=Number(next.money)<GAME.rebirth.moneyRequirement;
 if(next.is_admin&&!adminReady){initAdmin(roomId);adminReady=true;}
}
function startRender(){if(running)return;running=true;el('loading').classList.add('hidden');el('hud').classList.remove('hidden');const clock=new THREE.Clock();function animate(){requestAnimationFrame(animate);try{const dt=Math.min(clock.getDelta(),.05);input.updateFromKeyboard?.();player.update(dt,cameraState.yaw);guardians.update(dt,player,onGuardianCatch);eggs.update(dt,player,pickupEgg);handleSafeZone();const target=player.group.position.clone().add(new THREE.Vector3(0,1.5,0));const offset=new THREE.Vector3(Math.sin(cameraState.yaw)*Math.cos(cameraState.pitch),Math.sin(cameraState.pitch),Math.cos(cameraState.yaw)*Math.cos(cameraState.pitch)).multiplyScalar(GAME.camera.distance);camera.position.copy(target).add(offset);camera.lookAt(target);if(profile)setMoney(Number(profile.money));setSpeed(player.currentSpeed);const zone=currentZone(player.group.position);setZone(zone.label,zone.color);setHint(carriedEgg?'Fliehe zur Safe Zone!':'Sammle ein Ei in einer Seltenheitszone.');renderer.render(scene,camera);}catch(e){showFatalError(e.message);}}animate();}
function pickupEgg(egg){if(inventory.length>=GAME.egg.inventorySlots)return false;inventory.push({zoneId:egg.zoneId,id:egg.id});carriedEgg=egg;renderInventory(inventory);guardians.startChase(egg.zoneId,player);sounds.alert();api.pickupEgg(egg.id).catch(e=>showToast(e.message,'error'));return true;}
function onGuardianCatch(id){if(!carriedEgg||carriedEgg.zoneId!==id)return;eggs.releaseEgg(carriedEgg);carriedEgg=null;inventory.pop();renderInventory(inventory);guardians.endChase();sounds.caught();showToast('Der Wächter hat dich erwischt!','error');}
function handleSafeZone(){if(!carriedEgg||Math.hypot(player.group.position.x,player.group.position.z)>=13)return;const secured=carriedEgg;secured.state='secured';carriedEgg=null;guardians.endChase();inventory.pop();renderInventory(inventory);sounds.safe();api.secureEgg(secured.id).then(()=>showToast('Ei gesichert.','success')).catch(e=>showToast(e.message,'error'));}
async function loadGame(){if(loadingProfile)return;loadingProfile=true;try{const session=await initSession();if(!session.user){showAuth();return;}el('auth-overlay').classList.add('hidden');startRender();const result=await api.profile();applyProfile(result.profile);}catch(e){showToast('Profil: '+e.message,'error');}finally{loadingProfile=false;}}
function setupRebirth(){
 const hud=el('settings-button').parentElement,menu=document.createElement('button');menu.id='rebirth-menu-button';menu.textContent='↻ Rebirth';menu.className='icon-button';menu.style.cssText='width:auto;padding:8px 14px;background:linear-gradient(130deg,#5835a1,#265a8a);color:white;border:1px solid #aa89ff';hud.insertBefore(menu,el('settings-button'));
 const panel=document.createElement('section');panel.id='rebirth-panel';panel.className='panel hidden';panel.style.cssText='background:linear-gradient(140deg,#17132e,#101d35);border-color:#8d73cf';panel.innerHTML='<div class="panel-header"><h2>Wiedergeburt</h2><button type="button" data-close-rebirth>✕</button></div><p>Voraussetzung: 250.000 Geld.</p><p>Zurückgesetzt: Geld, Speed-Shop-Level, Trainingslevel und Trainingspunkte.</p><p>Erhalten: Roboter und bisheriger Rebirth-Zähler. Der Einkommensbonus ist noch nicht vollständig angeschlossen.</p>';
 const count=el('rebirth-count'),row=count.closest('.progress-row');if(row)panel.appendChild(row);panel.appendChild(el('rebirth-button'));document.getElementById('app').appendChild(panel);
 const shopTitle=el('shop-panel').querySelector('h2');if(shopTitle)shopTitle.textContent='Speed Shop & Training';
 menu.onclick=()=>{el('shop-panel').classList.add('hidden');panel.classList.toggle('hidden');};panel.querySelector('[data-close-rebirth]').onclick=()=>panel.classList.add('hidden');
 const speedStat=el('speed-value').parentElement;speedStat.title='Aktuelle Laufgeschwindigkeit in Metern pro Sekunde';speedStat.style.borderColor='#38cfff';
 const caption=document.createElement('small');caption.textContent=' m/s';speedStat.appendChild(caption);
}
function setupProgression(){
 el('rooms-button').onclick=()=>el('rooms-panel').classList.toggle('hidden');el('shop-button').onclick=()=>el('shop-panel').classList.toggle('hidden');
 const bind=(id,task)=>el(id).addEventListener('click',async()=>{const b=el(id);if(b.dataset.busy)return;b.dataset.busy='1';b.disabled=true;try{await task();}catch(e){showToast(e.message,'error');}finally{delete b.dataset.busy;b.disabled=false;if(profile)applyProfile(profile);}});
 bind('create-room',async()=>{const {room}=await api.createRoom(el('room-name').value);roomId=room.id;if(profile?.is_admin)initAdmin(roomId);showToast('Raumcode: '+room.join_code,'success');});
 bind('join-room',async()=>{const {room}=await api.joinRoom(el('join-code').value);roomId=room.id;if(profile?.is_admin)initAdmin(roomId);showToast('Raum beigetreten.','success');});
 bind('buy-speed',async()=>{const {profile:next}=await api.buySpeed();applyProfile(next);showToast(`Speed: ${player.currentSpeed.toFixed(2)} m/s`,'success');});
 bind('train-button',async()=>{const result=await api.train(1);applyProfile(result.profile);if(result.levelUp)showToast('Trainingslevel erhöht.','success');});
 bind('rebirth-button',async()=>{if(!window.confirm('Wiedergeburt ausführen? Geld, Speed-Shop und Training werden zurückgesetzt. Roboter bleiben erhalten.'))return;const result=await api.rebirth();applyProfile(result.profile);showToast('Wiedergeburt abgeschlossen.','success');});
 el('logout-button').onclick=async()=>{await getSupabase()?.auth.signOut();location.reload();};
}
setupRebirth();setupProgression();renderInventory(inventory);initAuth(loadGame);loadGame();
