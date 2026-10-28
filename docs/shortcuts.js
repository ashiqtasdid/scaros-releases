(() => {
'use strict';
const S=window.ScarOS,d=document.querySelector('#desktop'),dock=document.querySelector('#dock'),zone=document.querySelector('#dock-zone');
const $=(selector,root=document)=>root.querySelector(selector),$$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const app=id=>S.catalog.find(item=>item.id===id),key='scaros-preview-desktop-shortcuts';
let shortcuts=[],drag=null,suppressClickUntil=0,menuInvoker=null;
try{const saved=JSON.parse(localStorage.getItem(key));if(Array.isArray(saved)){const seen=new Set();shortcuts=saved.filter(item=>item&&app(item.id)&&!seen.has(item.id)&&seen.add(item.id)).map(item=>({id:item.id,col:Math.max(0,Math.min(50,Math.floor(Number(item.col)||0))),row:Math.max(0,Math.min(50,Math.floor(Number(item.row)||0)))}));}}catch{}
const layer=document.createElement('section');layer.id='desktop-shortcuts';layer.setAttribute('aria-label','Desktop app shortcuts');d.insertBefore(layer,$('#windows'));
const dropTarget=document.createElement('div');dropTarget.id='desktop-drop-target';dropTarget.setAttribute('aria-hidden','true');dropTarget.innerHTML='<strong>Create desktop shortcut</strong><span>Drop an app here or on the wallpaper</span>';d.append(dropTarget);
const dockDropTarget=document.createElement('div');dockDropTarget.id='dock-drop-target';dockDropTarget.setAttribute('aria-hidden','true');dockDropTarget.innerHTML='<span>Drop to pin to Dock</span>';zone.prepend(dockDropTarget);
function save(){try{localStorage.setItem(key,JSON.stringify(shortcuts));}catch{S.toast('Shortcuts will last for this visit. Browser storage is unavailable.');}}
function metrics(){return {cols:Math.max(1,Math.floor(layer.clientWidth/96)),rows:Math.max(1,Math.floor(layer.clientHeight/100))};}
function positions(items=shortcuts){const {cols,rows}=metrics(),used=new Set(),result=new Map(),height=Math.max(rows,Math.ceil((items.length+1)/cols));for(const item of items){const col=Math.min(item.col,cols-1),row=Math.min(item.row,height-1);let choice=null,distance=Infinity;for(let y=0;y<height;y++)for(let x=0;x<cols;x++){const slot=y*cols+x,dist=Math.abs(x-col)+Math.abs(y-row);if(!used.has(slot)&&dist<distance){choice={col:x,row:y};distance=dist;}}used.add(choice.row*cols+choice.col);result.set(item.id,choice);}return result;}
function render(){
 const focus=$('[data-desktop-app]:focus')?.dataset.desktopApp;
 const layout=positions();layer.innerHTML='<div class="desktop-shortcut-canvas">'+shortcuts.map(item=>{const entry=app(item.id),at=layout.get(item.id);return `<button class="desktop-item desktop-app" data-desktop-app="${item.id}" data-shortcut-app="${item.id}" data-launch-app="${item.id}" draggable="true" style="left:${at.col*96}px;top:${at.row*100}px" aria-label="Open ${escape(entry.name)} shortcut" aria-description="Drag to move or pin to the dock. Delete removes the shortcut; Shift F10 opens shortcut actions."><span class="desktop-app-art">${S.artwork(entry)}<svg class="shortcut-arrow" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 11V8a3 3 0 0 1 3-3h4M7 2l3 3-3 3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg></span><span>${escape(entry.name)}</span></button>`;}).join('')+'</div>';
 $('.desktop-shortcut-canvas',layer).style.height=Math.max(layer.clientHeight,...[...layout.values()].map(at=>(at.row+1)*100))+'px';
 if(focus)$(`[data-desktop-app="${focus}"]`,layer)?.focus({preventScroll:true});
}
function create(id,point){
 if(!app(id))return;const existing=shortcuts.find(item=>item.id===id),others=shortcuts.filter(item=>item.id!==id),rect=layer.getBoundingClientRect();
 const desired=point?{col:Math.max(0,Math.floor((point.x-rect.left+layer.scrollLeft)/96)),row:Math.max(0,Math.floor((point.y-rect.top+layer.scrollTop)/100))}:existing||{col:0,row:0};
 const at=positions([...others,{id,...desired}]).get(id);
 shortcuts=[...others,{id,...at}];save();render();const el=$(`[data-desktop-app="${id}"]`,layer);if(!S.prefs.reduceMotion&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate([{opacity:.55,transform:'scale(.94)'},{opacity:1,transform:'none'}],{duration:180,easing:'cubic-bezier(.16,1,.3,1)'});S.toast(existing?'Moved '+app(id).name+' shortcut.':'Created '+app(id).name+' desktop shortcut.');
}
function remove(id){const old=shortcuts.find(item=>item.id===id);if(!old)return;shortcuts=shortcuts.filter(item=>item.id!==id);save();render();S.toast('Removed the '+app(id).name+' shortcut. The app is still available.',()=>{if(!shortcuts.some(item=>item.id===id)){shortcuts.push(old);save();render();}});$('#desktop-shortcuts button')?.focus({preventScroll:true});}
function unpin(id){const previous=S.pins();S.setPins(previous.filter(item=>item!==id));S.toast('Removed '+app(id).name+' from the dock.',()=>S.setPins(previous));}
function options(id,anchor,point){
 const entry=app(id);if(!entry)return;menuInvoker=anchor;
 const pins=S.pins(),index=pins.indexOf(id),desktop=shortcuts.some(item=>item.id===id);
 const button=(label,action)=>`<button class="menu-entry" data-shortcut-action="${action}" data-shortcut-id="${id}">${label}</button>`;
 const html=`<div class="shortcut-menu-title">${escape(entry.name)}</div>`+button(desktop?'Remove Desktop Shortcut':'Create Desktop Shortcut',desktop?'remove':'desktop')+button(index>=0?'Remove from Dock':'Pin to Dock',index>=0?'unpin':'pin')+(index>0?button('Move Earlier in Dock','earlier'):'')+(index>=0&&index<pins.length-1?button('Move Later in Dock','later'):'');
 const el=S.popup('shortcuts',html,point||anchor);$('button',el)?.focus();
}
function clear(){drag?.element?.classList.remove('shortcut-drag-source');drag=null;d.classList.remove('app-dragging','desktop-drop-active','dock-drop-active');$$('.dock-insert-before,.dock-insert-after').forEach(el=>el.classList.remove('dock-insert-before','dock-insert-after'));}
function targetAt(event){const target=event.target instanceof Element?event.target:null;if(!target)return null;if(target.closest('#dock-zone'))return 'dock';if(target.closest('#desktop-drop-target,#desktop-shortcuts,#desktop-items')||target===d||target.closest('#wallpaper')||target.id==='windows')return 'desktop';return null;}
function dockBefore(event){const vertical=S.prefs.dockPosition!=='bottom',coordinate=vertical?event.clientY:event.clientX;return $$('[data-shortcut-app]',dock).find(el=>{if(el.dataset.shortcutApp===drag.id)return false;const r=el.getBoundingClientRect();return coordinate<(vertical?r.top+r.height/2:r.left+r.width/2);})||null;}
document.addEventListener('dragstart',event=>{
 const source=event.target.closest?.('[data-shortcut-app]'),id=source?.dataset.shortcutApp;if(!app(id)||!event.dataTransfer)return;
 if($('#modal-root').firstElementChild){event.preventDefault();return;}
 drag={id,element:source};event.dataTransfer.effectAllowed='copyMove';event.dataTransfer.setData('application/x-scaros-app',id);event.dataTransfer.setData('text/plain',app(id).name);
 d.classList.add('app-dragging');source.classList.add('shortcut-drag-source');$$('.dock-item').forEach(el=>el.style.setProperty('--lift','0'));
 dropTarget.querySelector('strong').textContent='Create '+app(id).name+' shortcut';
 dockDropTarget.querySelector('span').textContent=S.pins().includes(id)?'Already pinned · drop to reorder':'Drop to pin '+app(id).name;
});
document.addEventListener('dragover',event=>{
 if(!drag)return;const target=targetAt(event);d.classList.toggle('desktop-drop-active',target==='desktop');d.classList.toggle('dock-drop-active',target==='dock');
 $$('.dock-insert-before,.dock-insert-after').forEach(el=>el.classList.remove('dock-insert-before','dock-insert-after'));
 if(!target)return;event.preventDefault();event.dataTransfer.dropEffect=target==='desktop'&&drag.element.hasAttribute('data-desktop-app')||target==='dock'&&S.pins().includes(drag.id)?'move':'copy';
 if(target==='dock'){const before=dockBefore(event);if(before)before.classList.add('dock-insert-before');else $('[data-action="trash"]',dock).classList.add('dock-insert-before');}
});
document.addEventListener('drop',event=>{
 if(!drag)return;const target=targetAt(event),id=drag.id;if(target){event.preventDefault();if(target==='dock'){const before=dockBefore(event)?.dataset.shortcutApp,previous=S.pins(),wasPinned=previous.includes(id);S.pin(id,before);const unchanged=previous.join()===S.pins().join();S.toast(wasPinned?(unchanged?app(id).name+' is already pinned to the dock.':'Moved '+app(id).name+' in the dock.'):'Pinned '+app(id).name+' to the dock.');}else create(id,event.target.closest('#desktop-drop-target')?null:{x:event.clientX,y:event.clientY});S.closePopup();suppressClickUntil=performance.now()+250;}clear();
});
document.addEventListener('dragend',clear);window.addEventListener('blur',clear);
document.addEventListener('click',event=>{if(performance.now()<suppressClickUntil){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('click',event=>{
 const control=event.target.closest('[data-app-options],[data-shortcut-action]');if(!control)return;
 if(control.dataset.appOptions){options(control.dataset.appOptions,control);return;}
 const id=control.dataset.shortcutId,action=control.dataset.shortcutAction;if(!app(id))return;S.closePopup();
 if(action==='desktop')create(id);if(action==='remove')remove(id);if(action==='unpin')unpin(id);if(action==='pin'){S.pin(id);S.toast('Pinned '+app(id).name+' to the dock.');}
 if(action==='earlier'||action==='later'){const pins=S.pins(),from=pins.indexOf(id),to=from+(action==='earlier'?-1:1);if(from>=0&&to>=0&&to<pins.length){[pins[from],pins[to]]=[pins[to],pins[from]];S.setPins(pins);}}
 if(menuInvoker?.isConnected)menuInvoker.focus({preventScroll:true});else $(`[data-shortcut-app="${id}"]`,dock)?.focus({preventScroll:true});
});
document.addEventListener('contextmenu',event=>{const source=event.target.closest('[data-shortcut-app]');if(!source||!app(source.dataset.shortcutApp))return;event.preventDefault();const r=d.getBoundingClientRect();options(source.dataset.shortcutApp,source,{x:event.clientX-r.left,y:event.clientY-r.top});});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'){clear();if(menuInvoker?.isConnected&&event.target.closest('[data-shortcut-action]'))menuInvoker.focus({preventScroll:true});}
 const source=event.target.closest?.('[data-shortcut-app]');if(!source)return;
 if(event.key==='ContextMenu'||event.shiftKey&&event.key==='F10'){event.preventDefault();options(source.dataset.shortcutApp,source);}
 if((event.key==='Delete'||event.key==='Backspace')&&source.hasAttribute('data-desktop-app')){event.preventDefault();remove(source.dataset.desktopApp);}
});
d.addEventListener('scaros-workarea',render);window.addEventListener('resize',render);render();
S.shortcuts={items:()=>shortcuts.map(item=>({...item})),create,remove,options};
})();
