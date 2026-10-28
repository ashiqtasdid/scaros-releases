(() => {
'use strict';
const S=window.ScarOS,d=document.querySelector('#desktop'),$=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const actions={none:'No action',overview:'Window Overview',desktop:'Show Desktop',applications:'Applications',search:'Search',control:'Control Center',lock:'Lock Preview'};
const cornerNames={topLeft:'Top left',topRight:'Top right',bottomLeft:'Bottom left',bottomRight:'Bottom right'};
const base={topLeft:'overview',topRight:'none',bottomLeft:'none',bottomRight:'desktop',delay:450,requireCtrl:false};
const keys=[['Window Overview','Ctrl Alt O'],['Show / restore desktop','Ctrl Alt D'],['Lock preview','Ctrl Shift L'],['Tile left / right','Ctrl Alt ← / →'],['Desktop shortcut guide','Ctrl Alt H']];
function normalize(){const value=S.prefs.hotCorners;if(!value||typeof value!=='object'||Array.isArray(value))S.prefs.hotCorners={...base};const prefs=S.prefs.hotCorners;for(const key of Object.keys(cornerNames))if(!Object.hasOwn(actions,prefs[key]))prefs[key]=base[key];prefs.delay=[200,450,800].includes(Number(prefs.delay))?Number(prefs.delay):450;prefs.requireCtrl=prefs.requireCtrl===true;}
normalize();S.applyPrefs();
const root=document.createElement('div');root.id='essentials-root';d.append(root);
const hint=document.createElement('div');hint.id='corner-hint';hint.setAttribute('aria-hidden','true');d.append(hint);
const restore=document.createElement('button');restore.id='desktop-restore';restore.className='button glass';restore.dataset.essential='desktop';restore.textContent='Restore windows';restore.setAttribute('aria-label','Restore desktop windows');d.append(restore);
let previousFocus=null,desktopFocus=null,inertBefore=new Map(),mode='',query='',timer=null,pending=null,latched=null,pointer=null,restartTimer=null;
const snapped=new Map();
function cancelCorner(){clearTimeout(timer);timer=null;pending=null;hint.classList.remove('visible');}
function cornerAt(x,y){const r=d.getBoundingClientRect();if(x<r.left||y<r.top||x>=r.right||y>=r.bottom)return null;const left=x-r.left<8,right=r.right-x<=8,top=y-r.top<8,bottom=r.bottom-y<=8;return top?(left?'topLeft':right?'topRight':null):bottom?(left?'bottomLeft':right?'bottomRight':null):null;}
function blocked(){return document.hidden||root.hasChildNodes()||$('#modal-root').hasChildNodes()||d.classList.contains('app-dragging');}
function inspectPointer(event){
 if(event.pointerType==='touch')return;pointer={x:event.clientX,y:event.clientY,ctrl:!!event.ctrlKey,buttons:event.buttons||0};
 const corner=cornerAt(pointer.x,pointer.y);if(corner!==latched)latched=null;
 if(!corner||blocked()||pointer.buttons||S.prefs.hotCorners.requireCtrl&&!pointer.ctrl){cancelCorner();return;}
 const action=S.prefs.hotCorners[corner];if(action==='none'||corner===latched){cancelCorner();return;}if(pending===corner)return;
 cancelCorner();pending=corner;hint.dataset.corner=corner;hint.textContent=actions[action];hint.classList.add('visible');
 timer=setTimeout(()=>{if(pending!==corner||blocked()||!pointer||cornerAt(pointer.x,pointer.y)!==corner||S.prefs.hotCorners.requireCtrl&&!pointer.ctrl){cancelCorner();return;}latched=corner;cancelCorner();run(action);},S.prefs.hotCorners.delay);
}
function setBackgroundInert(value){
 if(value){inertBefore=new Map();for(const el of $$('#windows,#dock-zone,#menubar,#desktop-items,#desktop-shortcuts,#preview-toggle,#desktop-restore')){inertBefore.set(el,el.inert);el.inert=true;}}
 else{for(const [el,old]of inertBefore)el.inert=old;inertBefore.clear();}
}
function closeOverlay(focus=true){clearTimeout(restartTimer);restartTimer=null;const wasOpen=root.hasChildNodes();root.replaceChildren();mode='';query='';if(wasOpen){setBackgroundInert(false);if(focus){if(previousFocus?.isConnected&&!previousFocus.closest('[inert]'))previousFocus.focus({preventScroll:true});else{d.tabIndex=-1;d.focus({preventScroll:true});}}}previousFocus=null;}
function mount(kind,title,content,extra=''){
 const opening=!root.hasChildNodes();if(opening){previousFocus=document.activeElement;S.closePopup();setBackgroundInert(true);}cancelCorner();mode=kind;
 root.innerHTML=`<div class="essential-shade" data-essential="dismiss"></div><section class="essential-panel ${extra} glass" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header class="essential-header"><h2>${esc(title)}</h2><button class="icon-button" data-essential="dismiss" aria-label="Close ${esc(title)}">${S.artwork?'<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M6 18 18 6"/></svg>':'Close'}</button></header>${content}</section>`;
 ($('input',root)||$('button',root))?.focus({preventScroll:true});
}
function revealWindows(){if(!d.classList.contains('desktop-revealed'))return;d.classList.remove('desktop-revealed');$('#windows').inert=false;if(desktopFocus?.isConnected)desktopFocus.focus({preventScroll:true});desktopFocus=null;}
function showDesktop(){const wasVisible=d.classList.contains('desktop-revealed'),invoker=root.hasChildNodes()?previousFocus:document.activeElement;closeOverlay(false);S.closePopup();if(wasVisible){revealWindows();return;}desktopFocus=invoker;d.classList.add('desktop-revealed');$('#windows').inert=true;restore.focus({preventScroll:true});}
function windowArt(info){return S.artwork(S.catalog.find(app=>app.id===info.id)||{art:'applications'});}
function renderOverview(){
 const container=$('#overview-windows',root);if(!container)return;const windows=S.windowInfo().filter(info=>info.name.toLowerCase().includes(query.toLowerCase()));
 $('#overview-count',root).textContent=windows.length+' '+(windows.length===1?'window':'windows');
 const tileAvailability=info=>{const el=$(`.window[data-app="${info.id}"]`),minimum=Math.max(360,parseFloat(getComputedStyle(el).minWidth)||0);return d.clientWidth>760&&(d.clientWidth-S.workArea.left-S.workArea.right)/2>=minimum?'':'disabled title="Make the preview wider to tile windows"';};
 container.innerHTML=windows.length?windows.map(info=>`<article class="overview-window ${info.active?'is-current':''}"><button class="overview-open" data-window-target="${info.id}">${windowArt(info)}<span><strong>${esc(info.name)}</strong><small>${info.minimized||info.hidden?'Minimized':info.active?'Current window':'Open window'}</small></span></button><div class="overview-actions"><button data-tile-target="${info.id}" data-tile-side="left" aria-label="Tile ${esc(info.name)} left" ${tileAvailability(info)}>Tile left</button><button data-tile-target="${info.id}" data-tile-side="right" aria-label="Tile ${esc(info.name)} right" ${tileAvailability(info)}>Tile right</button><button data-close-target="${info.id}" aria-label="Close ${esc(info.name)}">Close</button></div></article>`).join(''):`<div class="essential-empty"><h3>${query?'No matching windows':'Your desktop is clear'}</h3><p>${query?'Try another app name.':'Open an app to see it here.'}</p><button class="button" data-essential="${query?'clear-overview':'applications'}">${query?'Clear search':'Open Applications'}</button></div>`;
}
function overview(){closeOverlay(false);mount('overview','Window Overview',`<div class="overview-toolbar"><input id="overview-query" aria-label="Find an open window" placeholder="Find an open window" autocomplete="off"><span id="overview-count" aria-live="polite"></span></div><div id="overview-windows" class="overview-windows"></div><footer class="essential-footer"><button class="button" data-essential="desktop">Show Desktop</button><button class="button" data-essential="applications">Applications</button><span>Choose a window to return to it</span></footer>`,'overview-panel');renderOverview();}
function tile(id,side){
 const el=$(`.window[data-app="${id}"]`);if(!el)return;closeOverlay(false);revealWindows();S.open(id);
 const width=(d.clientWidth-S.workArea.left-S.workArea.right)/2,height=d.clientHeight-30-S.workArea.bottom;
 if(d.clientWidth<=760||width<Math.max(360,parseFloat(getComputedStyle(el).minWidth)||0)){S.toast('Make the preview wider to tile windows side by side.');return;}
 if(snapped.get(id)?.element!==el)snapped.set(id,{element:el,left:el.style.left,top:el.style.top,width:el.style.width,height:el.style.height,maximized:el.classList.contains('maximized')});
 el.classList.remove('maximized');el.dataset.tile=side;el.style.left=(S.workArea.left+(side==='right'?width:0))+'px';el.style.top='0px';el.style.width=width+'px';el.style.height=height+'px';
 $('.maximize',el)?.setAttribute('aria-label','Maximize window');
}
function restoreTile(id){const el=$(`.window[data-app="${id}"]`),saved=snapped.get(id);if(!el||!saved||saved.element!==el)return;for(const key of ['left','top','width','height'])el.style[key]=saved[key];el.classList.toggle('maximized',saved.maximized);$('.maximize',el)?.setAttribute('aria-label',saved.maximized?'Restore window':'Maximize window');delete el.dataset.tile;snapped.delete(id);S.open(id);}
function shortcuts(){mount('help','Desktop Shortcuts',`<p class="essential-intro">Keyboard access to the desktop. Host shortcuts remain with your computer.</p><div class="essential-key-list">${keys.map(([label,key])=>`<div><span>${label}</span><kbd>${key}</kbd></div>`).join('')}</div><footer class="essential-footer"><button class="button" data-essential="corners">Configure Hot Corners</button></footer>`);}
function session(){mount('session','Session & Power',`<p class="essential-intro">Preview account · scaros<br>These actions demonstrate the session UI without operating your host or VM.</p><div class="session-actions">${[['lock','Lock preview','Show the sign-in screen'],['sleep','Sleep preview','Dim the desktop until you wake it'],['logout','Log out preview','Show the sample sign-in flow'],['restart','Restart preview','Keep saved notes and preferences'],['shutdown','Shut down preview','Show the powered-off state']].map(([id,title,description])=>`<button data-essential="${id}"><strong>${title}</strong><small>${description}</small><span aria-hidden="true"><svg class="icon" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg></span></button>`).join('')}</div>`,'session-panel');}
function confirmPower(action){const label={sleep:'Sleep',logout:'Log out',restart:'Restart',shutdown:'Shut down'}[action];if(!label)return;mount('confirm',label+' preview?',`<p class="essential-intro">Your sample notes, shortcuts and preferences stay saved. This only changes the browser demonstration.</p><footer class="essential-footer"><button class="button" data-essential="session">Cancel</button><button class="button primary" data-power-confirm="${action}">${label} preview</button></footer>`,'confirm-panel');$('[data-essential=session]',root)?.focus();}
function power(action){
 if(action==='logout'){closeOverlay(false);S.login();return;}
 const restart=action==='restart',sleep=action==='sleep';mount('power',restart?'Restarting preview':sleep?'Preview asleep':'Preview powered off',`<div class="power-state"><svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v9M7 5a9 9 0 1 0 10 0"/></svg><p>${restart?'Saved browser data stays available.':sleep?'Wake to return to your open windows.':'The host computer and VM are still running.'}</p><button class="button primary" data-essential="resume" ${restart?'disabled':''}>${restart?'Restarting…':sleep?'Wake preview':'Start preview'}</button></div>`,'power-panel');
 if(restart)restartTimer=setTimeout(()=>{closeOverlay();S.toast('Preview restarted. Your open windows and saved data were kept.');},450);
}
function run(action){if(['sleep','logout','restart','shutdown'].includes(action)){confirmPower(action);return;}if(action==='overview'){overview();return;}if(action==='desktop'){showDesktop();return;}if(action==='resume'){closeOverlay();return;}if(action==='session'){session();return;}closeOverlay(false);S.closePopup();if(action==='applications')S.open('applications');if(action==='search')S.search();if(action==='control')S.control();if(action==='lock')S.login();if(action==='corners')S.settings('Desktop & Dock');if(action==='help')shortcuts();}
function settingsHTML(){normalize();const prefs=S.prefs.hotCorners;return `<section class="settings-section hot-corners-section"><h3 class="section-label">Hot Corners</h3><p class="setting-note">Move into a screen corner and pause to run its action. Defaults: top left opens Overview; bottom right shows the desktop.</p><div class="hot-corner-map">${Object.entries(cornerNames).map(([id,label])=>`<label class="corner-setting" data-corner-position="${id}"><span>${label}</span><select data-hot-corner="${id}" aria-label="${label} hot corner">${Object.entries(actions).map(([action,name])=>`<option value="${action}" ${prefs[id]===action?'selected':''}>${name}</option>`).join('')}</select></label>`).join('')}</div><div class="setting-group"><label class="setting-row"><span>Activation delay</span><select data-corner-option="delay" aria-label="Hot corner activation delay">${[[200,'Quick · 200 ms'],[450,'Balanced · 450 ms'],[800,'Deliberate · 800 ms']].map(([value,label])=>`<option value="${value}" ${prefs.delay===value?'selected':''}>${label}</option>`).join('')}</select></label><label class="setting-row"><span>Require Ctrl at the corner</span><input type="checkbox" data-corner-option="requireCtrl" ${prefs.requireCtrl?'checked':''}></label></div><button class="button" data-essential="disable-corners">Turn all corners off</button></section>`;}
function shortcutsHTML(){return '<section class="settings-section"><h3 class="section-label">Desktop navigation</h3>'+keys.map(([label,key])=>`<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`).join('')+'</section>';}
function menuHTML(name){const entry=(label,action,key='')=>`<button class="menu-entry" data-essential="${action}"><span>${label}</span>${key?`<span class="shortcut">${key}</span>`:''}</button>`;if(name==='system')return '<div class="menu-divider"></div>'+entry('Lock Preview','lock','Ctrl Shift L')+entry('Session & Power…','session');if(name==='window')return '<div class="menu-divider"></div>'+entry('Window Overview','overview','Ctrl Alt O')+entry('Show / Restore Desktop','desktop','Ctrl Alt D')+entry('Tile Window Left','tile-left')+entry('Tile Window Right','tile-right')+entry('Restore Tiled Window','restore-tile');if(name==='tools')return '<div class="menu-divider"></div>'+entry('Hot Corners…','corners')+entry('Desktop Shortcuts…','help');return '';}
document.addEventListener('pointermove',inspectPointer,{passive:true});
document.addEventListener('pointerdown',event=>{cancelCorner();const el=event.target.closest?.('.window');if(!el?.dataset.tile||event.button!==0)return;const r=el.getBoundingClientRect(),bar=event.target.closest('[data-drag]'),resizing=event.clientX>=r.right-18&&event.clientY>=r.bottom-18;if((bar&&!event.target.closest('button,input,select'))||resizing){delete el.dataset.tile;snapped.delete(el.dataset.app);}},{capture:true});document.addEventListener('dragstart',cancelCorner,{capture:true});document.addEventListener('pointerleave',event=>{if(event.target===document.documentElement||event.target===d){cancelCorner();latched=null;}},{capture:true});
window.addEventListener('blur',()=>{cancelCorner();latched=null;pointer=null;});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelCorner();latched=null;pointer=null;}});
document.addEventListener('change',event=>{const el=event.target;if(el.dataset.hotCorner){S.prefs.hotCorners[el.dataset.hotCorner]=el.value;normalize();cancelCorner();S.applyPrefs();}if(el.dataset.cornerOption){S.prefs.hotCorners[el.dataset.cornerOption]=el.type==='checkbox'?el.checked:Number(el.value);normalize();cancelCorner();S.applyPrefs();}});
document.addEventListener('input',event=>{if(event.target.id==='overview-query'){query=event.target.value;renderOverview();}});
document.addEventListener('click',event=>{
 const el=event.target.closest('button,[data-essential]');if(!el)return;
 if(el.dataset.windowTarget){const id=el.dataset.windowTarget;closeOverlay(false);S.open(id);return;}
 if(el.dataset.tileTarget){tile(el.dataset.tileTarget,el.dataset.tileSide);return;}
 if(el.dataset.closeTarget){S.closeWindow(el.dataset.closeTarget);renderOverview();$('#overview-query')?.focus();return;}
 if(el.dataset.powerConfirm){power(el.dataset.powerConfirm);return;}
 const action=el.dataset.essential;if(!action)return;
 if(action==='dismiss'){closeOverlay();return;}if(action==='clear-overview'){query='';$('#overview-query').value='';renderOverview();$('#overview-query').focus();return;}
 if(action==='disable-corners'){for(const key of Object.keys(cornerNames))S.prefs.hotCorners[key]='none';cancelCorner();S.applyPrefs();S.settings('Desktop & Dock');return;}
 if(action.startsWith('tile-')){tile(S.activeWindow(),action.slice(5));return;}if(action==='restore-tile'){S.closePopup();restoreTile(S.activeWindow());return;}run(action);
});
document.addEventListener('keydown',event=>{
 if(root.hasChildNodes()){
  if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();if(mode!=='power'||!restartTimer)closeOverlay();return;}
  if(event.key==='Tab'){const controls=$$('button:not(:disabled),input,select,[tabindex="0"]',root),first=controls[0],last=controls.at(-1);if(!root.contains(document.activeElement)||event.shiftKey&&document.activeElement===first||!event.shiftKey&&document.activeElement===last){event.preventDefault();(event.shiftKey?last:first)?.focus();}}
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){const buttons=$$('.overview-open',root);if(buttons.length&&event.target.id!=='overview-query'){event.preventDefault();const index=buttons.indexOf(document.activeElement);buttons[(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length].focus();}}
  event.stopImmediatePropagation();return;
 }
 if(event.key==='Control'&&pointer){inspectPointer({clientX:pointer.x,clientY:pointer.y,ctrlKey:true,buttons:pointer.buttons});}
 if(event.repeat||event.getModifierState?.('AltGraph')||$('#modal-root').hasChildNodes())return;
 let action;if(event.ctrlKey&&event.altKey){action=({o:'overview',d:'desktop',h:'help',ArrowLeft:'tile-left',ArrowRight:'tile-right'})[event.key.length===1?event.key.toLowerCase():event.key];}else if(event.ctrlKey&&event.shiftKey&&event.key.toLowerCase()==='l')action='lock';
 if(action){event.preventDefault();event.stopImmediatePropagation();if(action.startsWith('tile-'))tile(S.activeWindow(),action.slice(5));else run(action);}
},true);
document.addEventListener('keyup',event=>{if(event.key==='Control'&&pointer){pointer.ctrl=false;if(S.prefs.hotCorners.requireCtrl)cancelCorner();}},true);
window.addEventListener('resize',()=>{cancelCorner();latched=null;});
d.addEventListener('scaros-workarea',()=>{for(const info of S.windowInfo()){const el=$(`.window[data-app="${info.id}"]`);if(!el?.dataset.tile)continue;const width=(d.clientWidth-S.workArea.left-S.workArea.right)/2;if(d.clientWidth<=760||width<Math.max(360,parseFloat(getComputedStyle(el).minWidth)||0)){restoreTile(info.id);continue;}el.style.width=width+'px';el.style.height=(d.clientHeight-30-S.workArea.bottom)+'px';el.style.left=(S.workArea.left+(el.dataset.tile==='right'?width:0))+'px';}});
S.essentials={run,overview,showDesktop,revealWindows,tile,restoreTile,session,settingsHTML,shortcutsHTML,menuHTML,close:closeOverlay,defaults:{...base},get desktopVisible(){return d.classList.contains('desktop-revealed');},get pendingCorner(){return pending;},get overlay(){return mode;}};
})();
