import * as THREE from 'three';
export class StaticCollisionWorld{
 constructor(scene){this.boxes=[];this.bounds=null;this.radius=.45;this.height=2.2;scene.updateMatrixWorld(true);scene.traverse(o=>{if(!o.isMesh||o.geometry?.type!=='BoxGeometry')return;const p=o.geometry.parameters,b=new THREE.Box3().setFromObject(o);if(p.width>40&&p.depth>100&&p.height<.5){this.bounds=b;return;}if(p.height>=.25)this.boxes.push(b);});}
 horizontal(p,b){return p.x+this.radius>b.min.x&&p.x-this.radius<b.max.x&&p.z+this.radius>b.min.z&&p.z-this.radius<b.max.z;}
 overlaps(p,b){return this.horizontal(p,b)&&p.y+this.height>b.min.y+.001&&p.y<b.max.y-.001;}
 fits(p){return !this.boxes.some(b=>this.overlaps(p,b));}
 move(position,velocity,dt){
  const count=Math.max(1,Math.ceil(Math.max(Math.abs(velocity.x),Math.abs(velocity.y),Math.abs(velocity.z))*dt/.12)),step=dt/count;let grounded=false;
  for(let i=0;i<count;i++){
   for(const axis of ['x','z']){const candidate=position.clone();candidate[axis]+=velocity[axis]*step;const blockers=this.boxes.filter(b=>this.overlaps(candidate,b));if(!blockers.length){position.copy(candidate);continue;}const top=Math.max(...blockers.map(b=>b.max.y));if(top-position.y<=.4&&velocity.y<=0){candidate.y=top;if(this.fits(candidate)){position.copy(candidate);grounded=true;}}}
   const before=position.y;let next=before+velocity.y*step;
   for(const b of this.boxes){if(!this.horizontal(position,b))continue;if(velocity.y<=0&&before>=b.max.y-.001&&next<b.max.y){next=Math.max(next,b.max.y);grounded=true;}else if(velocity.y>0&&before+this.height<=b.min.y+.001&&next+this.height>b.min.y){next=Math.min(next,b.min.y-this.height);velocity.y=0;}}
   if(next<=0){next=0;grounded=true;}position.y=next;if(grounded&&velocity.y<0)velocity.y=0;
   if(this.bounds){position.x=THREE.MathUtils.clamp(position.x,this.bounds.min.x+this.radius,this.bounds.max.x-this.radius);position.z=THREE.MathUtils.clamp(position.z,this.bounds.min.z+this.radius,this.bounds.max.z-this.radius);}
  }return grounded;
 }
}
