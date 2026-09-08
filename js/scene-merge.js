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
  toggle.title='İlk seçim ana arka plan, diğerleri üst katman olur';
  actions.append(toggle);

  const bar=document.createElement('div');
  bar.className='scene-merge-bar';
  bar.hidden=true;
  bar.innerHTML=`
    <div class="scene-merge-info"><strong>Arka Plan Birleştir</strong><small id="sceneMergeHint">Önce ANA arka planı seç</small></div>
    <b id="sceneMergeCount">0/5</b>
    <button id="sceneMergeCreate" type="button" disabled>Birleştir</button>
    <button id="sceneMergeCancel" type="button">İptal</button>`;
  gallery.insertAdjacentElement('afterend',bar);

  toggle.addEventListener('click',()=>setMergeMode(!mergeMode));
  $('#sceneMergeCancel',bar).addEventListener('click',()=>setMergeMode(false));
  $('#sceneMergeCreate',bar).addEventListener('click',createMergedBackground);

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
      ids.length===1?'ANA sabitlendi · şimdi üst katman seç':
      ids.length===5?'ANA + 4 katman hazır':
      `ANA + ${ids.length-1} katman seçildi`
    );
  }
}

async function createMergedBackground(){
  const ids=[...selected];
  if(ids.length<2||ids.length>5)return;
  const gallery=$('#sceneBgGallery');
  const thumbs=ids.map(id=>$$('.scene-bg-thumb',gallery).find(el=>el.dataset.bgId===id)).filter(Boolean);
  if(thumbs.length!==ids.length){syncUi('Seçim yenilendi, tekrar dene');return}
  const create=$('#sceneMergeCreate');
  if(create){create.disabled=true;create.textContent='Hazırlanıyor…'}
  try{
    const images=await Promise.all(thumbs.map(thumb=>loadImage($('img',thumb)?.src)));
    const canvas=document.createElement('canvas');canvas.width=1920;canvas.height=1080;
    const ctx=canvas.getContext('2d',{alpha:false});

    // 1. seçim her zaman sabit ANA arka plandır ve tüm sahneyi doldurur.
    drawCover(ctx,images[0],{x:0,y:0,w:canvas.width,h:canvas.height});

    // Diğer seçimler ana arka planın üstünde katman olarak yerleşir.
    const overlays=overlayCells(images.length-1,canvas.width,canvas.height);
    images.slice(1).forEach((img,index)=>drawOverlay(ctx,img,overlays[index]));

    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Birleşik görsel oluşturulamadı.')),'image/jpeg',.95));
    const numbers=thumbs.map(thumb=>String(thumb.querySelector(':scope > span')?.textContent||'').trim()).filter(Boolean);
    const file=new File([blob],`ANA-BG-${numbers.join('-')}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
    const input=$('#sceneBgInput');
    if(!input)throw new Error('Arka plan ekleme alanı bulunamadı.');
    const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    setMergeMode(false);
  }catch(error){console.warn('Arka planlar birleştirilemedi',error);syncUi('Birleştirme tamamlanamadı');}
  finally{if(create){create.textContent='Birleştir';create.disabled=selected.size<2}}
}

function overlayCells(count,w,h){
  // Ana arka plan görünür kalacak şekilde üst katman alanları.
  if(count===1)return [{x:w*.20,y:h*.17,w:w*.60,h:h*.66}];
  if(count===2)return [
    {x:w*.035,y:h*.20,w:w*.45,h:h*.60},
    {x:w*.515,y:h*.20,w:w*.45,h:h*.60}
  ];
  if(count===3)return [
    {x:w*.04,y:h*.055,w:w*.44,h:h*.43},
    {x:w*.52,y:h*.055,w:w*.44,h:h*.43},
    {x:w*.28,y:h*.515,w:w*.44,h:h*.43}
  ];
  if(count===4)return [
    {x:w*.035,y:h*.045,w:w*.45,h:h*.43},
    {x:w*.515,y:h*.045,w:w*.45,h:h*.43},
    {x:w*.035,y:h*.525,w:w*.45,h:h*.43},
    {x:w*.515,y:h*.525,w:w*.45,h:h*.43}
  ];
  return [];
}

function drawCover(ctx,img,cell){
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
  const scale=Math.max(cell.w/iw,cell.h/ih);const dw=iw*scale,dh=ih*scale;
  const dx=cell.x+(cell.w-dw)/2,dy=cell.y+(cell.h-dh)/2;
  ctx.save();ctx.beginPath();ctx.rect(cell.x,cell.y,cell.w,cell.h);ctx.clip();ctx.drawImage(img,dx,dy,dw,dh);ctx.restore();
}

function drawOverlay(ctx,img,cell){
  if(!cell)return;
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
  // Üst katmanda görselin tamamını koru; ana arka plan kenarlarda görünmeye devam eder.
  const scale=Math.min(cell.w/iw,cell.h/ih);const dw=iw*scale,dh=ih*scale;
  const dx=cell.x+(cell.w-dw)/2,dy=cell.y+(cell.h-dh)/2;
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,.28)';ctx.shadowBlur=18;ctx.shadowOffsetY=6;
  ctx.drawImage(img,dx,dy,dw,dh);
  ctx.restore();
}

function loadImage(src){
  return new Promise((resolve,reject)=>{
    if(!src){reject(new Error('Arka plan görseli bulunamadı.'));return}
    const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Arka plan okunamadı.'));img.src=src;
    if(img.complete&&img.naturalWidth)resolve(img);
  });
}

waitForScene();
