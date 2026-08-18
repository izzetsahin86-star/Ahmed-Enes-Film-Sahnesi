const $=(selector,root=document)=>root.querySelector(selector);
const dock=$('#timelineDock');
const collapse=$('#collapseTimelineBtn');
const tabs=[...document.querySelectorAll('[data-dock-tab]')];

const css='./modern-sheet.css';
if(!document.querySelector(`link[href="${css}"]`)){
  const link=document.createElement('link');link.rel='stylesheet';link.href=css;document.head.append(link);
}

function activeName(){return $('[data-dock-tab].active')?.dataset.dockTab||'shoot'}
function sync(){
  const open=Boolean(dock&&!dock.classList.contains('collapsed'));
  document.body.classList.toggle('studio-sheet-open',open);
  document.body.dataset.studioPanel=activeName();
  if(collapse){
    collapse.textContent=open?'⌄':'⌃';
    collapse.setAttribute('aria-label',open?'Alt paneli kapat':'Alt paneli aç');
  }
}

function ensureScrim(){
  if($('.modern-sheet-scrim'))return;
  const scrim=document.createElement('div');
  scrim.className='modern-sheet-scrim';
  scrim.setAttribute('aria-hidden','true');
  scrim.addEventListener('click',()=>{if(dock&&!dock.classList.contains('collapsed'))collapse?.click()});
  document.body.append(scrim);
}

/* Clicking the active tab again closes the sheet. */
tabs.forEach(tab=>tab.addEventListener('click',event=>{
  const alreadyActive=tab.classList.contains('active');
  const open=Boolean(dock&&!dock.classList.contains('collapsed'));
  if(alreadyActive&&open){
    event.preventDefault();
    event.stopImmediatePropagation();
    collapse?.click();
    try{navigator.vibrate?.(8)}catch{}
    return;
  }
  requestAnimationFrame(sync);
},{capture:true}));

collapse?.addEventListener('click',()=>requestAnimationFrame(sync));

/* Drag down on the sheet header to close, drag up on collapsed nav to reopen. */
const header=dock?.querySelector('.studio-dock-header');
if(header){
  let startY=0,startX=0;
  header.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    startY=event.clientY;startX=event.clientX;
  },{passive:true});
  header.addEventListener('pointerup',event=>{
    const dy=event.clientY-startY;
    const dx=Math.abs(event.clientX-startX);
    if(dx>60||Math.abs(dy)<36)return;
    const open=Boolean(dock&&!dock.classList.contains('collapsed'));
    if(dy>0&&open)collapse?.click();
    else if(dy<0&&!open)document.querySelector(`[data-dock-tab="${activeName()}"]`)?.click();
  },{passive:true});
}

ensureScrim();
sync();
if(dock)new MutationObserver(sync).observe(dock,{attributes:true,attributeFilter:['class']});
tabs.forEach(tab=>new MutationObserver(sync).observe(tab,{attributes:true,attributeFilter:['class']}));
