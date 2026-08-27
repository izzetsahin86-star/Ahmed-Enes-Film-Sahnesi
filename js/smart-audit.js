// Akıllı Mobil son kontrol: dinamik kontrolleri ve çıktı durumlarını senkron tutar.
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

const ICONS={
  photo:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="m6 16 4-4 3 3 2-2 3 3"/><circle cx="9" cy="9" r="1.5"/></svg>',
  video:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="12" height="12" rx="2"/><path d="m16 10 4-2v8l-4-2z"/></svg>',
  copy:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  trash:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  left:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  right:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
};

function haptic(ms=5){try{navigator.vibrate?.(ms)}catch{}}

function syncFrameActionIcons(){
  const map={importPhotosBtn:'photo',videoImportBtn:'video',duplicateBtn:'copy',deleteFrameBtn:'trash',deleteAllFramesBtn:'trash',moveLeftBtn:'left',moveRightBtn:'right'};
  Object.entries(map).forEach(([id,icon])=>{
    const button=$('#'+id);const span=button?.querySelector('span');
    if(!span||button.dataset.smartAuditIcon===icon)return;
    span.innerHTML=ICONS[icon]||'';
    button.dataset.smartAuditIcon=icon;
    if(id==='deleteAllFramesBtn')button.setAttribute('data-delete-all-frames','true');
  });
}

function syncExportOptions(){
  $$('.smart-export-option[data-export-target]').forEach(option=>{
    const target=$('#'+option.dataset.exportTarget);if(!target)return;
    const title=option.querySelector('b');
    if(title&&!option.dataset.defaultLabel)option.dataset.defaultLabel=title.textContent||'';
    const sync=()=>{
      const targetTitle=target.querySelector('strong')?.textContent?.trim()||'';
      const working=/hazırlanıyor|aktarılıyor|oluşturuluyor|%/i.test(targetTitle);
      option.disabled=Boolean(target.disabled)&&!working;
      option.classList.toggle('working',working);
      option.style.borderColor=working?'rgba(109,181,255,.62)':'';
      option.style.boxShadow=working?'0 0 0 1px rgba(47,140,255,.18),0 0 22px rgba(47,140,255,.18)':'';
      option.style.pointerEvents=working?'none':'';
      const nextTitle=working?targetTitle:(option.dataset.defaultLabel||title?.textContent||'');
      if(title&&title.textContent!==nextTitle)title.textContent=nextTitle;
      option.setAttribute('aria-busy',String(working));
    };
    sync();
    if(!target.dataset.smartAuditObserved){
      target.dataset.smartAuditObserved='1';
      new MutationObserver(sync).observe(target,{attributes:true,attributeFilter:['disabled'],childList:true,subtree:true,characterData:true});
    }
  });
}

function syncViewport(){
  const height=window.visualViewport?.height||window.innerHeight;
  if(height>0)document.documentElement.style.setProperty('--smart-viewport-h',`${Math.round(height)}px`);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content','#05080e');
}

function suppressStartupRestoreToast(){
  const toast=$('#toast');
  if(!toast)return;
  const hiddenMessage='Son proje otomatik olarak geri yüklendi.';
  const suppress=()=>{
    if((toast.textContent||'').trim()!==hiddenMessage)return;
    toast.classList.remove('show');
    toast.textContent='';
  };
  suppress();
  new MutationObserver(suppress).observe(toast,{childList:true,subtree:true,characterData:true});
}

function installOverlayFeedback(){
  if(document.documentElement.dataset.smartOverlayFeedback)return;
  document.documentElement.dataset.smartOverlayFeedback='1';
  document.addEventListener('click',event=>{
    const target=event.target?.closest?.('.scene-capture-choice,.scene-capture-footer button,.video-import-actions button,.video-import-close,.frame-photo-preview-close,.frame-photo-preview-nav,.audio-action,.sfx-pad,.ninja-sfx-pad');
    if(target&&!target.disabled)haptic();
  },{passive:true});
}

function installFullscreenDockExit(){
  if(document.documentElement.dataset.smartFullscreenDockExit)return;
  document.documentElement.dataset.smartFullscreenDockExit='1';
  document.addEventListener('click',event=>{
    if(!document.fullscreenElement)return;
    if(!event.target?.closest?.('.simple-gallery-button,.simple-panel-button'))return;
    document.exitFullscreen?.().catch(()=>{});
  },true);
}

function markReady(){
  document.body.classList.add('smart-ui-ready');
  syncFrameActionIcons();syncExportOptions();syncViewport();
}

const frameActions=$('.frame-action-buttons');
if(frameActions)new MutationObserver(()=>requestAnimationFrame(syncFrameActionIcons)).observe(frameActions,{childList:true});
const exportPane=$('.export-pane');
if(exportPane)new MutationObserver(()=>requestAnimationFrame(syncExportOptions)).observe(exportPane,{childList:true});

suppressStartupRestoreToast();
installOverlayFeedback();
installFullscreenDockExit();
markReady();
window.addEventListener('resize',syncViewport,{passive:true});
window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});
window.addEventListener('pageshow',markReady);