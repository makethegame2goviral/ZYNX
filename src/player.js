import * as THREE from 'three';
import {GAME} from './config.js';
import {activeInput} from './controls.js';
export class Player{
 constructor(scene){
  this.velocity=new THREE.Vector3();this.speed=GAME.player.baseSpeed;this.trainingSpeedBonus=0;this.eventSpeedMultiplier=1;this.onGround=true;this.moveInput=new THREE.Vector2();this.jumpRequested=false;this.phase=0;
  this.group=new THREE.Group();this.group.position.set(0,0,8);scene.add(this.group);
  const material=color=>new THREE.MeshStandardMaterial({color,roughness:.65});
  const skin=material('#f0e7d9'),jacket=material('#192335'),shirt=material('#08a8df'),pants=material('#20364a'),shoe=material('#eef7ff'),hair=material('#513126');
  const box=(parent,size,pos,mat)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...pos);parent.add(m);return m;};
  box(this.group,[.72,.7,.38],[0,1.17,0],shirt);
  for(const side of [-1,1])box(this.group,[.19,.72,.43],[side*.28,1.18,0],jacket);
  box(this.group,[.55,.53,.49],[0,1.83,0],skin);
  box(this.group,[.59,.16,.53],[0,2.13,0],hair);
  for(let i=0;i<5;i++){const lock=box(this.group,[.12,.22,.13],[-.25+i*.12,2.05,.23],hair);lock.rotation.z=(i-2)*.15;}
  const ink=material('#17202b');for(const side of [-1,1])box(this.group,[.035,.065,.015],[side*.105,1.88,.253],ink);
  const smile=new THREE.Mesh(new THREE.TorusGeometry(.105,.012,6,16,Math.PI),ink);smile.rotation.z=Math.PI;smile.position.set(0,1.79,.255);this.group.add(smile);
  this.arms=[];this.legs=[];
  for(const side of [-1,1]){
   const arm=new THREE.Group();arm.position.set(side*.53,1.49,0);this.group.add(arm);box(arm,[.28,.3,.33],[0,-.14,0],jacket);box(arm,[.25,.31,.28],[0,-.43,0],skin);box(arm,[.27,.19,.29],[0,-.66,0],skin);this.arms.push(arm);
   const leg=new THREE.Group();leg.position.set(side*.19,.84,0);this.group.add(leg);box(leg,[.32,.63,.35],[0,-.3,0],pants);box(leg,[.35,.16,.5],[0,-.75,.06],shoe);this.legs.push(leg);
  }
 }
 get currentSpeed(){return Math.min(GAME.player.maxShopSpeed,this.speed+this.trainingSpeedBonus)*this.eventSpeedMultiplier;}
 update(dt,yaw){
  if(activeInput){this.moveInput.copy(activeInput.moveInput);this.jumpRequested=activeInput.jumpRequested;activeInput.jumpRequested=false;}
  const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw));
  const direction=forward.multiplyScalar(this.moveInput.y).addScaledVector(right,this.moveInput.x);if(direction.lengthSq()>1)direction.normalize();
  this.velocity.x=direction.x*this.currentSpeed;this.velocity.z=direction.z*this.currentSpeed;this.velocity.y+=GAME.gravity*dt;
  if(this.jumpRequested&&this.onGround){this.velocity.y=GAME.player.jumpVelocity;this.onGround=false;}this.jumpRequested=false;
  this.group.position.addScaledVector(this.velocity,dt);const limit=GAME.worldSize/2-2;this.group.position.x=THREE.MathUtils.clamp(this.group.position.x,-limit,limit);this.group.position.z=THREE.MathUtils.clamp(this.group.position.z,-limit,limit);
  if(this.group.position.y<=0){this.group.position.y=0;this.velocity.y=0;this.onGround=true;}
  const moving=direction.lengthSq()>.01;this.phase+=dt*10;
  if(moving){const angle=Math.atan2(direction.x,direction.z);this.group.rotation.y+=Math.atan2(Math.sin(angle-this.group.rotation.y),Math.cos(angle-this.group.rotation.y))*Math.min(1,dt*14);}
  for(let i=0;i<2;i++){const swing=moving&&this.onGround?Math.sin(this.phase+i*Math.PI)*.6:0;this.legs[i].rotation.x=swing;this.arms[i].rotation.x=-swing;}
 }
}
