const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];

let mergeMode=false;
const selected=new Set();

function waitForScene(){
  const card=$('.scene-background-card');
  const gallery=$('#sceneBgGallery');
  const actions=$('.scene-actions',card||document);
  if(!card||!gallery||!actions){setTimeout(waitForScene,80);return}
  if($('#sceneMergeToggle',card))return;
  install(card,gallery,actions);
}

function install(card,gallery,actions){
  const toggle=document.createElement('button');
  toggle.id='sceneMergeToggle';
  toggle.type='button';
  toggle.className='scene-merge-toggle';
  toggle.innerHTML='<span aria-hidden="true">▦</span> Birleştir';
  toggle.title='Ana arka plan sabit kalır, diğerlerini sen yerleştirirsin';
  actions.append(toggle);

  const bar=document.createElement('div');
  bar.className='scene-merge-bar';
  bar.hidden=true;
  bar.innerHTML=`
    <div class="scene-merge-info"><strong>Arka Plan Birleştir</strong><small id="sceneMergeHint">Önce ANA arka planı seç</small></div>
    <b id="sceneMergeCount">0/5</b>
    <button id="sceneMergeCreate" type="button" disabled>Yerleştir</button>
    <button id="sceneMergeCancel" type="button">İptal</button>`;
  gallery.insertAdjacentElement('afterend',bar);

  toggle.addEventListener('click',()=>setMergeMode(!mergeMode));
  $('#sceneMergeCancel',bar).addEventListener('click',()=>setMergeMode(false));
  $('#sceneMergeCreate',bar).addEventListener('click',openSelectedLayers);

  gallery.addEventListener('click',event=>{
    if(!mergeMode)return;
    const thumb=event.target.closest('.scene-bg-thumb');
    if(!thumb)return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    toggleSelection(thumb);
  },true);

  const observer=new MutationObserver(()=>{
    if(!mergeMode)return;
    const liveIds=new Set($$('.scene-bg-thumb',gallery).map(el=>el.dataset.bgId));
    [...selected].forEach(id=>{if(!liveIds.has(id))selected.delete(id)});
    syncUi();
  });
  observer.observe(gallery,{childList:true});
}

function setMergeMode(on){
  mergeMode=Boolean(on);
  selected.clear();
  const gallery=$('#sceneBgGallery');
  gallery?.classList.toggle('merge-mode',mergeMode);
  $$('.scene-bg-thumb',gallery||document).forEach(el=>{
    el.classList.remove('merge-selected');
    el.querySelector('.scene-merge-role')?.remove();
  });
  const bar=$('.scene-merge-bar');if(bar)bar.hidden=!mergeMode;
  const toggle=$('#sceneMergeToggle');if(toggle){
    toggle.classList.toggle('active',mergeMode);
    toggle.innerHTML=mergeMode?'<span aria-hidden="true">✓</span> Seçiliyor':'<span aria-hidden="true">▦</span> Birleştir';
  }
  syncUi();
}

function toggleSelection(thumb){
  const id=thumb.dataset.bgId;
  if(!id)return;
  if(selected.has(id))selected.delete(id);
  else if(selected.size<5)selected.add(id);
  syncUi();
  try{navigator.vibrate?.(10)}catch{}
}

function syncUi(message=''){
  const count=$('#sceneMergeCount');
  const hint=$('#sceneMergeHint');
  const create=$('#sceneMergeCreate');
  const ids=[...selected];
  const gallery=$('#sceneBgGallery');

  $$('.scene-bg-thumb',gallery||document).forEach(thumb=>{
    const order=ids.indexOf(thumb.dataset.bgId);
    const isSelected=order>=0;
    thumb.classList.toggle('merge-selected',isSelected);
    let badge=thumb.querySelector('.scene-merge-role');
    if(!isSelected){badge?.remove();return}
    if(!badge){badge=document.createElement('em');badge.className='scene-merge-role';thumb.append(badge)}
    badge.textContent=order===0?'ANA':`K${order+1}`;
    badge.classList.toggle('main',order===0);
  });

  if(count)count.textContent=`${ids.length}/5`;
  if(create)create.disabled=ids.length<2||ids.length>5;
  if(hint){
    hint.textContent=message||(
      ids.length===0?'Önce ANA arka planı seç':
      ids.length===1?'ANA sabitlendi · üstüne eklenecek görselleri seç':
      ids.length===5?'ANA + 4 katman hazır · Yerleştir':
      `ANA + ${ids.length-1} katman seçildi · Yerleştir`
    );
  }
}

function selectedThumbs(){
  const gallery=$('#sceneBgGallery');
  return [...selected].map(id=>$$('.scene-bg-thumb',gallery).find(el=>el.dataset.bgId===id)).filter(Boolean);
}

async function openSelectedLayers(){
  const thumbs=selectedThumbs();
  if(thumbs.length<2||thumbs.length>5)return;
  const create=$('#sceneMergeCreate');
  if(create){create.disabled=true;create.textContent='Açılıyor…'}
  try{
    const sources=thumbs.map((thumb,index)=>({
      src:$('img',thumb)?.src||'',
      number:String(thumb.querySelector(':scope > span')?.textContent||index+1).trim(),
      name:thumb.title||`Arka Plan ${index+1}`
    }));
    await Promise.all(sources.map(item=>loadImage(item.src)));
    openLayerEditor(sources);
  }catch(error){
    console.warn('Katman düzenleyici açılamadı',error);
    syncUi('Görseller açılamadı, tekrar dene');
  }finally{
    if(create){create.textContent='Yerleştir';create.disabled=selected.size<2}
  }
}

function openLayerEditor(sources){
  document.querySelector('.scene-layer-editor')?.remove();
  const overlay=document.createElement('div');
  overlay.className='scene-layer-editor';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','Arka plan katmanlarını yerleştir');
  overlay.tabIndex=-1;

  const layers=sources.slice(1).map((source,index)=>({
    ...source,
    x:50,
    y:50,
    size:Math.max(22,Math.min(48,42-index*4))
  }));
  let activeIndex=0;

  const sheet=document.createElement('div');sheet.className='scene-layer-editor-sheet';
  const head=document.createElement('div');head.className='scene-layer-editor-head';
  head.innerHTML=`<div><small>MANUEL YERLEŞİM</small><strong>Ana arka plan sabit</strong><span>Üst katmanları parmağınla sürükle.</span></div><button type="button" class="scene-layer-editor-x" aria-label="Kapat">×</button>`;

  const stageWrap=document.createElement('div');stageWrap.className='scene-layer-stage-wrap';
  const stage=document.createElement('div');stage.className='scene-layer-stage';
  const main=document.createElement('img');main.className='scene-layer-main';main.src=sources[0].src;main.alt='';main.draggable=false;
  const mainBadge=document.createElement('span');mainBadge.className='scene-layer-main-badge';mainBadge.textContent='ANA · SABİT';
  stage.append(main,mainBadge);

  const layerEls=layers.map((layer,index)=>{
    const img=document.createElement('img');
    img.className='scene-layer-item';img.src=layer.src;img.alt='';img.draggable=false;img.dataset.layerIndex=String(index);
    img.setAttribute('aria-label',`Katman ${index+2}`);
    stage.append(img);
    bindLayerDrag(img,index,stage,layers,()=>{activeIndex=index;syncEditor()});
    return img;
  });
  stageWrap.append(stage);

  const controls=document.createElement('div');controls.className='scene-layer-controls';
  const chips=document.createElement('div');chips.className='scene-layer-chips';
  layers.forEach((layer,index)=>{
    const chip=document.createElement('button');chip.type='button';chip.dataset.layerIndex=String(index);chip.textContent=`K${index+2}`;chip.title=layer.name;
    chip.addEventListener('click',()=>{activeIndex=index;syncEditor()});chips.append(chip);
  });

  const sizeRow=document.createElement('label');sizeRow.className='scene-layer-size';
  sizeRow.innerHTML='<span>Seçili katman boyutu</span><input type="range" min="10" max="100" step="1"><b>42%</b>';
  const sizeInput=$('input',sizeRow);const sizeValue=$('b',sizeRow);
  sizeInput.addEventListener('input',()=>{layers[activeIndex].size=Number(sizeInput.value);syncEditor(false)});

  const center=document.createElement('button');center.type='button';center.className='scene-layer-center';center.textContent='Ortala';
  center.addEventListener('click',()=>{layers[activeIndex].x=50;layers[activeIndex].y=50;syncEditor(false)});
  controls.append(chips,sizeRow,center);

  const footer=document.createElement('div');footer.className='scene-layer-editor-footer';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='scene-layer-cancel';cancel.textContent='Geri';
  const save=document.createElement('button');save.type='button';save.className='scene-layer-save';save.textContent='Birleştir ve Kaydet';
  footer.append(cancel,save);

  sheet.append(head,stageWrap,controls,footer);overlay.append(sheet);document.body.append(overlay);

  function syncEditor(updateInputs=true){
    layerEls.forEach((el,index)=>{
      const layer=layers[index];
      el.style.left=`${layer.x}%`;el.style.top=`${layer.y}%`;el.style.width=`${layer.size}%`;
      el.classList.toggle('active',index===activeIndex);
      el.style.zIndex=String(10+index);
    });
    $$('button[data-layer-index]',chips).forEach((chip,index)=>chip.classList.toggle('active',index===activeIndex));
    if(updateInputs)sizeInput.value=String(layers[activeIndex].size);
    sizeValue.textContent=`${Math.round(layers[activeIndex].size)}%`;
  }

  const close=()=>overlay.remove();
  $('.scene-layer-editor-x',head).addEventListener('click',close);
  cancel.addEventListener('click',close);
  overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();close()}});
  save.addEventListener('click',async()=>{
    save.disabled=true;cancel.disabled=true;save.textContent='Kaydediliyor…';
    try{
      await saveLayerComposition(sources[0],layers);
      overlay.remove();
      setMergeMode(false);
    }catch(error){
      console.warn('Katmanlı arka plan kaydedilemedi',error);
      save.textContent='Tekrar Dene';save.disabled=false;cancel.disabled=false;
    }
  });
  syncEditor();
  requestAnimationFrame(()=>overlay.focus());
}

function bindLayerDrag(el,index,stage,layers,onSelect){
  let drag=null;
  el.addEventListener('pointerdown',event=>{
    const rect=stage.getBoundingClientRect();
    drag={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,x:layers[index].x,y:layers[index].y,rect};
    try{el.setPointerCapture(event.pointerId)}catch{}
    onSelect();event.preventDefault();
  });
  el.addEventListener('pointermove',event=>{
    if(!drag||event.pointerId!==drag.pointerId)return;
    const dx=(event.clientX-drag.startX)/drag.rect.width*100;
    const dy=(event.clientY-drag.startY)/drag.rect.height*100;
    layers[index].x=clamp(drag.x+dx,-10,110);
    layers[index].y=clamp(drag.y+dy,-10,110);
    el.style.left=`${layers[index].x}%`;el.style.top=`${layers[index].y}%`;
    event.preventDefault();
  });
  const end=event=>{if(drag&&event.pointerId===drag.pointerId)drag=null};
  el.addEventListener('pointerup',end);el.addEventListener('pointercancel',end);
}

async function saveLayerComposition(mainSource,layers){
  const [mainImage,...layerImages]=await Promise.all([mainSource,...layers].map(item=>loadImage(item.src)));
  const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
  const ctx=canvas.getContext('2d',{alpha:false});
  drawCover(ctx,mainImage,{x:0,y:0,w:canvas.width,h:canvas.height});

  layers.forEach((layer,index)=>{
    const img=layerImages[index];
    const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
    const dw=canvas.width*(layer.size/100);const dh=dw*(ih/iw);
    const x=canvas.width*(layer.x/100)-dw/2;const y=canvas.height*(layer.y/100)-dh/2;
    ctx.drawImage(img,x,y,dw,dh);
  });

  const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Birleşik görsel oluşturulamadı.')),'image/jpeg',.95));
  const numbers=[mainSource.number,...layers.map(layer=>layer.number)].filter(Boolean);
  const file=new File([blob],`Manuel-BG-${numbers.join('-')}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
  const input=$('#sceneBgInput');if(!input)throw new Error('Arka plan ekleme alanı bulunamadı.');
  const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
}

function drawCover(ctx,img,cell){
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
  const scale=Math.max(cell.w/iw,cell.h/ih);const dw=iw*scale,dh=ih*scale;
  const dx=cell.x+(cell.w-dw)/2,dy=cell.y+(cell.h-dh)/2;
  ctx.save();ctx.beginPath();ctx.rect(cell.x,cell.y,cell.w,cell.h);ctx.clip();ctx.drawImage(img,dx,dy,dw,dh);ctx.restore();
}

function clamp(value,min,max){return Math.min(max,Math.max(min,value))}
function loadImage(src){
  return new Promise((resolve,reject)=>{
    if(!src){reject(new Error('Arka plan görseli bulunamadı.'));return}
    const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Arka plan okunamadı.'));img.src=src;
    if(img.complete&&img.naturalWidth)resolve(img);
  });
}

waitForScene();
