const $=(selector,root=document)=>root.querySelector(selector);
const dock=$('#timelineDock');
const collapse=$('#collapseTimelineBtn');
const timelineTrack=$('#timelineTrack');
const galleryButton=$('.simple-gallery-button');

const NAV_ICONS={
  shoot:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.5"/></svg>',
  frames:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="6" width="14" height="12" rx="2"/><path d="M8 3h8M8 21h8"/></svg>',
  audio:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V7l9-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="15.5" cy="16" r="2.5"/></svg>',
  scene:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="m6.5 17 4-4 3 3 2-2 2.5 3"/></svg>',
  project:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5h6l1.5 2H20v8.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M4 7.5V6a2 2 0 0 1 2-2h4l1.5 2H18"/></svg>',
  export:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-8 8"/><path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5"/></svg>'
};

function haptic(ms=7){try{navigator.vibrate?.(ms)}catch{}}
function tabs(){return [...document.querySelectorAll('[data-dock-tab]')]}
function activeName(){return $('[data-dock-tab].active')?.dataset.dockTab||'shoot'}
function isOpen(){return Boolean(dock&&!dock.classList.contains('collapsed'))}

function installNavIcons(){
  tabs().forEach(tab=>{
    const icon=tab.querySelector('span');
    const name=tab.dataset.dockTab;
    if(!icon||!NAV_ICONS[name]||icon.dataset.smartIcon===name)return;
    icon.innerHTML=NAV_ICONS[name];
    icon.dataset.smartIcon=name;
  });
}

function sync(){
  const open=isOpen();
  document.body.classList.toggle('smart-sheet-open',open);
  document.body.dataset.studioPanel=activeName();
  if(collapse){
    collapse.textContent=open?'⌄':'⌃';
    collapse.setAttribute('aria-label',open?'Alt paneli kapat':'Alt paneli aç');
    collapse.setAttribute('aria-expanded',String(open));
  }
}

function ensureScrim(){
  if($('.smart-mobile-scrim'))return;
  const scrim=document.createElement('div');
  scrim.className='smart-mobile-scrim';
  scrim.setAttribute('aria-hidden','true');
  scrim.addEventListener('click',()=>{if(isOpen()){haptic();collapse?.click()}});
  document.body.append(scrim);
}

function latestFrameSource(){
  const cards=[...document.querySelectorAll('#timelineTrack .frame-card img')];
  return cards.at(-1)?.src||'';
}
function syncGalleryThumb(){
  if(!galleryButton)return;
  const src=latestFrameSource();
  let img=$('.last-frame-thumb',galleryButton);
  if(!src){galleryButton.classList.remove('has-frame');img?.remove();return}
  if(!img){img=document.createElement('img');img.className='last-frame-thumb';img.alt='Son çekilen kare';galleryButton.append(img)}
  if(img.src!==src)img.src=src;
  galleryButton.classList.add('has-frame');
}

function installActiveTabToggle(){
  tabs().forEach(tab=>{
    if(tab.dataset.smartMobileBound)return;
    tab.dataset.smartMobileBound='1';
    tab.addEventListener('click',event=>{
      const alreadyActive=tab.classList.contains('active');
      if(alreadyActive&&isOpen()){
        event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
        haptic();collapse?.click();return;
      }
      haptic();requestAnimationFrame(sync);
    },{capture:true});
  });
}

function installSheetGesture(){
  const header=dock?.querySelector('.studio-dock-header');
  if(!header||header.dataset.smartGesture)return;
  header.dataset.smartGesture='1';
  let startY=0,startX=0;
  header.addEventListener('pointerdown',event=>{
    if(event.pointerType==='mouse'&&event.button!==0)return;
    startY=event.clientY;startX=event.clientX;
  },{passive:true});
  header.addEventListener('pointerup',event=>{
    const dy=event.clientY-startY,dx=Math.abs(event.clientX-startX);
    if(dx>55||Math.abs(dy)<34)return;
    if(dy>0&&isOpen()){haptic();collapse?.click()}
    else if(dy<0&&!isOpen()){haptic();document.querySelector(`[data-dock-tab="${activeName()}"]`)?.click()}
  },{passive:true});
}

function installMicroFeedback(){
  document.addEventListener('pointerdown',event=>{
    const target=event.target?.closest?.('.simple-tool-button,.simple-square-button,.simple-gallery-button,.simple-panel-button,.dock-tab,.dock-collapse,.panel-btn,.lock-action,.mini-action,.project-action,.scene-bg-thumb,.scene-capture-choice,.smart-panel-segment button,.smart-export-option,.audio-action,.ninja-sfx-pad,.sfx-pad,.history-actions .icon-btn');
    if(!target||target.disabled)return;
    target.classList.add('smart-pressing');
  },{passive:true});
  const clear=event=>event.target?.closest?.('.smart-pressing')?.classList.remove('smart-pressing');
  document.addEventListener('pointerup',clear,{passive:true});
  document.addEventListener('pointercancel',clear,{passive:true});
}

installNavIcons();
ensureScrim();
installActiveTabToggle();
installSheetGesture();
installMicroFeedback();
sync();
syncGalleryThumb();

if(dock)new MutationObserver(()=>requestAnimationFrame(sync)).observe(dock,{attributes:true,attributeFilter:['class']});
if(timelineTrack)new MutationObserver(()=>requestAnimationFrame(syncGalleryThumb)).observe(timelineTrack,{childList:true,subtree:true,attributes:true,attributeFilter:['src']});
const navObserver=new MutationObserver(()=>{installNavIcons();installActiveTabToggle();sync()});
const nav=$('.dock-tabs');if(nav)navObserver.observe(nav,{childList:true,subtree:true});
collapse?.addEventListener('click',()=>requestAnimationFrame(sync));
window.addEventListener('pageshow',()=>{installNavIcons();sync();syncGalleryThumb()});
