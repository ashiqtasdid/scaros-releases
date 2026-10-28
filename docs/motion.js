/* ScarOS motion: analytic critical damping, matching crates/scaros-motion. */
(function(root){
'use strict';
function falloff(distance){if(!Number.isFinite(distance))return 0;const d=Math.min(1,Math.abs(distance)/100);return (1-d*d)**2;}
function spring(value=0,response=180){
 let x=Number.isFinite(value)?value:0,target=x,velocity=0,previous=null;const omega=5/Math.max(.001,response/1000);
 const active=()=>Math.abs(x-target)>.001||Math.abs(velocity)>.01;
 function sample(now){if(previous!==null){const dt=Math.max(0,now-previous)/1000,offset=x-target,c=velocity+omega*offset,decay=Math.exp(-omega*dt);x=target+(offset+c*dt)*decay;velocity=(velocity-omega*c*dt)*decay;if(!active()){x=target;velocity=0;}previous=Math.max(now,previous);}return x;}
 return {sample,active,target(now,next){if(!Number.isFinite(next))return;sample(now);target=next;previous=previous===null?now:Math.max(now,previous);},jump(next=0){x=target=Number.isFinite(next)?next:0;velocity=0;previous=null;}};
}
function dock(element,readState){
 const items=new Map();let frame=0,frames=0;
 function clear(){if(frame)cancelAnimationFrame(frame);frame=0;for(const [el,state]of items){state.jump();el.style.setProperty('--lift','0');}items.clear();}
 function disabled(){const s=readState();return !s.enabled||element.closest('.app-dragging')||!element.isConnected;}
 function tick(now){frame=0;if(disabled()){clear();return;}frames++;let moving=false;for(const [el,state]of items){if(!el.isConnected){items.delete(el);continue;}el.style.setProperty('--lift',state.sample(now).toFixed(5));moving||=state.active();}if(moving)frame=requestAnimationFrame(tick);}
 function schedule(){if(!frame)frame=requestAnimationFrame(tick);}
 function move(event){if(disabled()){clear();return;}const s=readState(),box=element.getBoundingClientRect(),pointer=s.vertical?event.clientY-box.top-element.clientTop:event.clientX-box.left-element.clientLeft,now=performance.now();
  // offset geometry is stable: magnification only transforms the artwork.
  for(const el of element.querySelectorAll('.dock-item')){const center=s.vertical?el.offsetTop+el.offsetHeight/2:el.offsetLeft+el.offsetWidth/2;let state=items.get(el);if(!state){state=spring();items.set(el,state);}state.target(now,falloff(pointer-center));}schedule();
 }
 function leave(){if(disabled()){clear();return;}const now=performance.now();for(const state of items.values())state.target(now,0);schedule();}
 element.addEventListener('pointermove',move);element.addEventListener('pointerleave',leave);
 return {reset:clear,stats:()=>({frames,pending:!!frame,items:items.size}),dispose(){clear();element.removeEventListener('pointermove',move);element.removeEventListener('pointerleave',leave);}};
}
const api={falloff,spring,dock};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.ScarOSMotion=api;
})(typeof window==='undefined'?globalThis:window);
