import * as THREE from 'three';
import {RARITIES} from './config.js';
import {mountBaseCollection} from './base-collection.js';
export function createWorld(scene){
 scene.background=new THREE.Color('#6ac9f5');scene.fog=new THREE.Fog('#a6dff1',110,250);
 scene.add(new THREE.HemisphereLight('#e2f5ff','#647e38',2.1));const sun=new THREE.DirectionalLight('#fff3dc',2);sun.position.set(-25,60,20);scene.add(sun);
 const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.8});
 const grass=mat('#67c73f'),wall=mat('#bc8060'),trim=mat('#46ac42'),stone=mat('#d5e0e9'),dark=mat('#27394c'),red=mat('#df4b53');
 const box=(g,s,p,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(...s),m);o.position.set(...p);g.add(o);return o;};
 const text=(g,value,p,color='#ffffff',width=8)=>{const c=document.createElement('canvas');c.width=1024;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#18334a';ctx.fillRect(0,0,1024,128);ctx.fillStyle=color;ctx.font='bold 62px sans-serif';ctx.textAlign='center';ctx.fillText(value,512,88);const t=new THREE.CanvasTexture(c);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t}));s.position.set(...p);s.scale.set(width,1,1);g.add(s);};
 box(scene,[60,.2,210],[0,-.15,-68],grass);
 for(const side of [-1,1]){box(scene,[2,16,210],[side*31,8,-68],wall);box(scene,[2.2,.5,210],[side*31,16.2,-68],trim);for(let z=-165;z<33;z+=5)box(scene,[.12,.06,3],[side*27,.01,z],trim);}
 for(let z=-170;z<35;z+=4)box(scene,[.13,.025,2],[0,.015,z],stone);
 const safe=new THREE.Mesh(new THREE.CylinderGeometry(12,12,.08,48),mat('#9eecac'));safe.position.y=.04;scene.add(safe);text(scene,'SAFE ZONE',[0,5,7],'#c5ffd5',9);
 for(const zone of RARITIES.filter(z=>z.enabled!==false)){const z=zone.position[2];const accent=mat(zone.color);box(scene,[58,.04,.4],[0,.04,z+9],accent);text(scene,zone.label.toUpperCase(),[0,6,z],zone.color,9);for(const side of [-1,1]){box(scene,[1,4,1],[side*25,2,z],dark);box(scene,[1.1,.3,1.1],[side*25,4.1,z],accent);}}
 for(const side of [-1,1])for(let i=0;i<2;i++){
  const g=new THREE.Group();g.position.set(side*19,0,15-i*18);g.rotation.y=side===1?-Math.PI/2:Math.PI/2;scene.add(g);
  box(g,[14,.3,12],[0,.15,0],stone);box(g,[3,.06,13],[0,.34,0],red);box(g,[14,.4,12],[0,5.8,0],stone);box(g,[14,5,.3],[0,3,-5.85],dark);
  for(const x of [-6.7,6.7]){box(g,[.6,5.6,.6],[x,3,5.7],dark);box(g,[.3,1.1,11.4],[x,1,0],stone);}
  const pad=new THREE.MeshStandardMaterial({color:'#8fff71',emissive:'#55ed40',emissiveIntensity:.5});
  for(const x of [-4.4,4.4])for(let j=0;j<5;j++){box(g,[2.5,.15,1.45],[x,.45,-4+j*2],dark);box(g,[1.2,.08,.55],[x,.58,-3.5+j*2],pad);}
  box(g,[3,.08,1.8],[0,.3,7],pad);text(g,side===-1&&i===0?'DEINE SAMMLUNG':'ZYNX BASE',[0,6.5,5.9],'#ffffff',10);
  if(side===-1&&i===0)mountBaseCollection(g);
 }
 text(scene,'OG',[0,10,-156],'#ffe086',14);
}
