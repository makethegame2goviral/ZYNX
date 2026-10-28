import {api} from './api.js';
import {GAME} from './config.js';
let installed=false;
export function installTrainingProgress(){if(installed)return;installed=true;for(const name of ['profile','train','buySpeed','rebirth']){const original=api[name];api[name]=async(...args)=>{const result=await original(...args);if(result.profile)requestAnimationFrame(()=>renderTraining(result.profile));return result;};}}
function renderTraining(profile){
 const panel=document.getElementById('shop-panel');if(!panel)return;let section=document.getElementById('training-progress-card');
 if(!section){section=document.createElement('section');section.id='training-progress-card';section.style.cssText='margin:18px 0;padding:16px;border-radius:14px;border:1px solid #7659ba;background:linear-gradient(135deg,#20183d,#102438);color:#eef8ff';const title=document.createElement('h3');title.textContent='Trainingsfortschritt';const description=document.createElement('p');description.dataset.trainingDescription='';const bar=document.createElement('progress');bar.style.cssText='width:100%;height:18px;accent-color:#a878ff';const note=document.createElement('p');note.textContent='Training gibt pro vollem Level einen zusätzlichen Speed-Bonus. Beim Rebirth wird Training zurückgesetzt.';section.append(title,description,bar,note);panel.appendChild(section);}
 const level=Math.min(GAME.player.maxTrainingLevel,Math.max(0,Number(profile.training_level)||0)),points=Math.max(0,Number(profile.training_points)||0),requirement=Math.round(25*Math.pow(1.35,level)),bonus=level*GAME.player.speedPerTrainingLevel,maximum=level>=GAME.player.maxTrainingLevel;
 section.querySelector('[data-training-description]').textContent=maximum?`Maximales Trainingslevel · +${bonus.toFixed(2)} m/s`:`Level ${level} · ${points.toFixed(0)} / ${requirement} Punkte · aktuell +${bonus.toFixed(2)} m/s · nächster Bonus +${GAME.player.speedPerTrainingLevel.toFixed(2)} m/s`;
 const bar=section.querySelector('progress');bar.max=maximum?1:requirement;bar.value=maximum?1:Math.min(points,requirement);
 const train=document.getElementById('train-button');if(train){train.disabled=maximum;train.textContent=maximum?'Training abgeschlossen':'1 Trainingspunkt sammeln';}
 const shop=Math.max(0,Math.min(GAME.player.maxShopLevel,Number(profile.speed_shop_level)||0)),button=document.getElementById('buy-speed');
 if(button&&shop<GAME.player.maxShopLevel){const speed=Math.min(GAME.player.maxShopSpeed,GAME.player.baseSpeed+(shop+1)*GAME.player.speedPerShopLevel)+bonus,cost=Math.round(GAME.shop.baseCost*Math.pow(GAME.shop.costMultiplier,shop));button.textContent=`Speed kaufen · ${cost.toLocaleString('de-DE')} · danach ${speed.toFixed(2)} m/s`;}
}
