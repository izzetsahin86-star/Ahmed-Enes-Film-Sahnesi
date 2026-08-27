const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

const ICONS={
  sliders:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/></svg>',
  camera:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h3l1.4-2h5.2l1.4 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  assist:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="7"/></svg>',
  film:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="M8 5v14M16 5v14M4 9h4M16 9h4M4 15h4M16 15h4"/></svg>',
  color:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-.6-.3-1.1-.6-1.6-.4-.5-.6-1-.3-1.6.3-.7 1-.9 1.8-.9H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="10" r="1"/><circle cx="10" cy="6.8" r="1"/><circle cx="15" cy="7.2" r="1"/></svg>',
  image:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="m6.5 17 4-4 3 3 2-2 2.5 3"/></svg>',
  key:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="12" r="4"/><path d="M12 12h8M17 12v3M20 12v2"/></svg>',
  move:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/></svg>',
  photo:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="2"/><path d="m6 16 4-4 3 3 2-2 3 3"/><circle cx="9" cy="9" r="1.5"/></svg>',
  video:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="6" width="12" height="12" rx="2"/><path d="m16 10 4-2v8l-4-2z"/></svg>',
  copy:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  trash:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>',
  left:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  right:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  music:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18V7l9-2v11"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="15.5" cy="16" r="2.5"/></svg>',
  plus:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  mic:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v4M9 21h6"/></svg>',
  folderPlus:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h6l1.5 2H20v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM4 8V6a2 2 0 0 1 2-2h4l1.5 2H18"/><path d="M12 13v5M9.5 15.5h5"/></svg>',
  folderOpen:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h7l2 2h9l-2 9H5z"/><path d="M5 8V5h6l2 2h6v3"/></svg>',
  save:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5z"/><path d="M8 4v6h8V4M8 20v-6h8v6"/></svg>',
  mp4:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="m10 9 5 3-5 3z"/></svg>',
  gif:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><path d="M8 10h3v4H8zM14 10v4M14 10h3"/></svg>',
  webm:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6l3 12 3-8 3 8 3-12 4 12"/></svg>',
  file:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5"/></svg>',
  frame:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V5h4M16 5h4v4M20 15v4h-4M8 19H4v-4"/><rect x="8" y="8" width="8" height="8" rx="1"/></svg>',
  shield:'<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="m9 12 2 2 4-5"/></svg>'
};

function haptic(ms=6){try{navigator.vibrate?.(ms)}catch{}}
function segment(className,items,onChange,initial){
  const nav=document.createElement('div');nav.className=`smart-panel-segment ${className}`;
  items.forEach(item=>{
    const button=document.createElement('button');button.type='button';button.dataset.smartView=item.id;
    button.innerHTML=`${ICONS[item.icon]||''}<span>${item.label}</span>`;
    button.classList.toggle('active',item.id===initial);
    button.addEventListener('click',()=>{nav.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));haptic();onChange(item.id)});
    nav.append(button);
  });
  return nav;
}
function setStored(key,value){try{localStorage.setItem(key,value)}catch{}}
function getStored(key,fallback,allowed){try{const value=localStorage.getItem(key);return allowed.includes(value)?value:fallback}catch{return fallback}}

function setupShoot(){
  const pane=$('#sidePanel');const strip=$('.control-strip',pane);if(!pane||!strip||$('.smart-shoot-nav',pane))return;
  const group=(selector,name)=>{const el=$(selector,pane)?.closest('.dock-control,.dock-toggle,.lock-control-group');if(el)el.dataset.smartShootGroup=name};
  ['#resolutionSelect','#aspectSelect','#fpsInput','#onionInput','#timerSelect'].forEach(s=>group(s,'basic'));
  ['#intervalSelect','#zoomInput','#exposureLockBtn'].forEach(s=>group(s,'camera'));
  ['#gridToggle','#mirrorToggle'].forEach(s=>group(s,'assist'));
  const allowed=['basic','camera','assist'];const initial=getStored('aefs-smart-shoot-view','basic',allowed);pane.dataset.smartShootView=initial;
  const nav=segment('smart-shoot-nav',[{id:'basic',label:'Temel',icon:'sliders'},{id:'camera',label:'Kamera',icon:'camera'},{id:'assist',label:'Yardımcı',icon:'assist'}],view=>{pane.dataset.smartShootView=view;setStored('aefs-smart-shoot-view',view)},initial);
  pane.insertBefore(nav,strip);
}

function setupFrames(){
  const pane=$('.frames-pane');const layout=$('.frames-layout',pane);if(!pane||!layout||$('.smart-frames-nav',pane))return;
  const allowed=['film','color'];const initial=getStored('aefs-smart-frames-view','film',allowed);pane.dataset.smartFramesView=initial;
  const nav=segment('smart-frames-nav',[{id:'film',label:'Film',icon:'film'},{id:'color',label:'Renk',icon:'color'}],view=>{pane.dataset.smartFramesView=view;setStored('aefs-smart-frames-view',view)},initial);
  pane.insertBefore(nav,layout);

  const actionIcons={importPhotosBtn:'photo',videoImportBtn:'video',duplicateBtn:'copy',deleteFrameBtn:'trash',deleteAllFramesBtn:'trash',moveLeftBtn:'left',moveRightBtn:'right'};
  Object.entries(actionIcons).forEach(([id,name])=>{const button=$('#'+id);const span=button?.querySelector('span');if(span)span.innerHTML=ICONS[name]||''});
}

function setupAudioIcons(){
  const actionIcons={musicImportBtn:'music',soundImportBtn:'plus',micRecordBtn:'mic'};
  Object.entries(actionIcons).forEach(([id,name])=>{const span=$('#'+id)?.querySelector('span');if(span)span.innerHTML=ICONS[name]||''});
  const nav=$('.audio-workspace-nav');if(nav){
    const map={sources:['plus','Ekle'],timeline:['film','Zaman'],library:['assist','Efekt']};
    Object.entries(map).forEach(([view,[icon,label]])=>{const b=$(`[data-audio-jump="${view}"]`,nav);if(b&&!b.dataset.smartIcon){b.dataset.smartIcon='1';b.innerHTML=`${ICONS[icon]}<span>${label}</span>`}});
  }
}

function setupScene(){
  const pane=$('.scene-pane');const layout=$('.scene-layout',pane);if(!pane||!layout||$('.smart-scene-nav',pane))return;
  const cards=$$('.scene-card',layout);const groups=['background','chroma','placement'];cards.slice(0,3).forEach((card,index)=>card.dataset.smartSceneGroup=groups[index]);
  const allowed=[...groups];const initial=getStored('aefs-smart-scene-view','background',allowed);pane.dataset.smartSceneView=initial;
  const nav=segment('smart-scene-nav',[{id:'background',label:'Arka Plan',icon:'image'},{id:'chroma',label:'Chroma',icon:'key'},{id:'placement',label:'Yerleşim',icon:'move'}],view=>{pane.dataset.smartSceneView=view;setStored('aefs-smart-scene-view',view)},initial);
  pane.insertBefore(nav,layout);
}

function setupProject(){
  const actionIcons={newProjectBtn:'folderPlus',openProjectBtn:'folderOpen',saveProjectBtn:'save'};
  Object.entries(actionIcons).forEach(([id,name])=>{const span=$('#'+id)?.querySelector(':scope > span');if(span)span.innerHTML=ICONS[name]||''});
}

function setupExport(){
  const pane=$('.export-pane');if(!pane||$('.smart-export-panel',pane))return;
  const panel=document.createElement('div');panel.className='smart-export-panel';
  const head=document.createElement('div');head.className='smart-export-head';head.innerHTML='<div><strong>Filmi hazırla</strong><small>İstediğin çıktı türünü doğrudan seç</small></div>';
  const shortcuts=document.createElement('button');shortcuts.type='button';shortcuts.textContent='Kısayollar';shortcuts.addEventListener('click',()=>{haptic();$('#shortcutsBtn')?.click()});head.append(shortcuts);
  const grid=document.createElement('div');grid.className='smart-export-grid';
  const items=[
    {target:'exportMp4Btn',label:'MP4 Video',desc:'Ses + müzik + efekt',icon:'mp4',primary:true},
    {target:'exportGifBtn',label:'GIF',desc:'Hızlı animasyon · sessiz',icon:'gif',primary:true},
    {target:'exportWebmBtn',label:'WebM',desc:'Sesli alternatif video',icon:'webm'},
    {target:'exportProjectBtn',label:'Proje',desc:'Düzenlenebilir .aefs.json',icon:'file'},
    {target:'exportFrameBtn',label:'Seçili Kare',desc:'JPEG fotoğraf çıktısı',icon:'frame'}
  ];
  items.forEach(item=>{
    const button=document.createElement('button');button.type='button';button.className=`smart-export-option${item.primary?' primary':''}`;button.dataset.exportTarget=item.target;
    button.innerHTML=`<span class="smart-export-icon">${ICONS[item.icon]}</span><div><b>${item.label}</b><small>${item.desc}</small></div>`;
    const target=$('#'+item.target);const sync=()=>button.disabled=Boolean(target?.disabled);sync();
    button.addEventListener('click',()=>{if(button.disabled)return;haptic(8);target?.click()});
    if(target)new MutationObserver(sync).observe(target,{attributes:true,attributeFilter:['disabled']});
    grid.append(button);
  });
  const foot=document.createElement('div');foot.className='smart-export-foot';foot.innerHTML=`${ICONS.shield}<span>Görüntü ve sesler cihazında işlenir.</span>`;
  panel.append(head,grid,foot);pane.append(panel);
}

function syncToggleCards(){
  $$('.dock-toggle input[type="checkbox"]').forEach(input=>input.closest('.dock-toggle')?.classList.toggle('smart-active',input.checked));
}
function setupToggleSync(){
  document.addEventListener('change',event=>{if(event.target?.matches?.('.dock-toggle input[type="checkbox"]'))syncToggleCards()});syncToggleCards();
}

function setupDynamicReapply(){
  const nav=$('.dock-tabs');if(nav)new MutationObserver(()=>{setupScene();setupAudioIcons()}).observe(nav,{childList:true,subtree:true});
  const frames=$('#timelineTrack');if(frames)new MutationObserver(()=>requestAnimationFrame(addFrameSceneBadges)).observe(frames,{childList:true,subtree:true});
}
function addFrameSceneBadges(){
  // timeline.js yeni karelerde bu bilgiyi doğrudan üretir; eski DOM için güvenli yedek.
  $$('#timelineTrack .frame-card').forEach(card=>{if(card.querySelector('.frame-scene-badge'))return;const number=Number(card.dataset.sceneBackgroundNumber||0);if(number>0){const badge=document.createElement('span');badge.className='frame-scene-badge';badge.textContent=`BG${number}`;card.append(badge)}});
}

setupShoot();
setupFrames();
setupAudioIcons();
setupScene();
setupProject();
setupExport();
setupToggleSync();
setupDynamicReapply();
