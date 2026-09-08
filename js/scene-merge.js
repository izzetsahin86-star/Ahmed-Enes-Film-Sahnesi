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
  toggle.title='2–5 arka planı tek sahnede birleştir';
  actions.append(toggle);

  const bar=document.createElement('div');
  bar.className='scene-merge-bar';
  bar.hidden=true;
  bar.innerHTML=`
    <div class="scene-merge-info"><strong>Arka Plan Birleştir</strong><small id="sceneMergeHint">2–5 arka plan seç</small></div>
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
  $$('.scene-bg-thumb',gallery||document).forEach(el=>el.classList.remove('merge-selected'));
  const bar=$('.scene-merge-bar');if(bar)bar.hidden=!mergeMode;
  const toggle=$('#sceneMergeToggle');if(toggle){toggle.classList.toggle('active',mergeMode);toggle.innerHTML=mergeMode?'<span aria-hidden="true">✓</span> Seçiliyor':'<span aria-hidden="true">▦</span> Birleştir'}
  syncUi();
}

function toggleSelection(thumb){
  const id=thumb.dataset.bgId;
  if(!id)return;
  if(selected.has(id))selected.delete(id);
  else if(selected.size<5)selected.add(id);
  thumb.classList.toggle('merge-selected',selected.has(id));
  syncUi();
  try{navigator.vibrate?.(10)}catch{}
}

function syncUi(message=''){
  const count=$('#sceneMergeCount');
  const hint=$('#sceneMergeHint');
  const create=$('#sceneMergeCreate');
  if(count)count.textContent=`${selected.size}/5`;
  if(create)create.disabled=selected.size<2||selected.size>5;
  if(hint)hint.textContent=message||(selected.size<2?'En az 2 arka plan seç':selected.size===5?'5 arka plan seçildi · hazır':'İstersen daha fazla seç veya birleştir');
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
    const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);
    const cells=layoutCells(images.length,canvas.width,canvas.height);
    images.forEach((img,index)=>drawCover(ctx,img,cells[index]));
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('Birleşik görsel oluşturulamadı.')),'image/jpeg',.94));
    const numbers=thumbs.map(thumb=>String($('span',thumb)?.textContent||'').trim()).filter(Boolean);
    const file=new File([blob],`Birlesik-BG-${numbers.join('-')}.jpg`,{type:'image/jpeg',lastModified:Date.now()});
    const input=$('#sceneBgInput');
    if(!input)throw new Error('Arka plan ekleme alanı bulunamadı.');
    const transfer=new DataTransfer();transfer.items.add(file);input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    setMergeMode(false);
  }catch(error){console.warn('Arka planlar birleştirilemedi',error);syncUi('Birleştirme tamamlanamadı');}
  finally{if(create){create.textContent='Birleştir';create.disabled=selected.size<2}}
}

function layoutCells(count,w,h){
  if(count===2)return [{x:0,y:0,w:w/2,h},{x:w/2,y:0,w:w/2,h}];
  if(count===3)return [0,1,2].map(i=>({x:i*w/3,y:0,w:w/3,h}));
  if(count===4)return [0,1,2,3].map(i=>({x:(i%2)*w/2,y:Math.floor(i/2)*h/2,w:w/2,h:h/2}));
  if(count===5)return [
    {x:0,y:0,w:w/3,h:h/2},{x:w/3,y:0,w:w/3,h:h/2},{x:2*w/3,y:0,w:w/3,h:h/2},
    {x:0,y:h/2,w:w/2,h:h/2},{x:w/2,y:h/2,w:w/2,h:h/2}
  ];
  return [{x:0,y:0,w,h}];
}

function drawCover(ctx,img,cell){
  const iw=img.naturalWidth||img.width,ih=img.naturalHeight||img.height;
  const scale=Math.max(cell.w/iw,cell.h/ih);const dw=iw*scale,dh=ih*scale;
  const dx=cell.x+(cell.w-dw)/2,dy=cell.y+(cell.h-dh)/2;
  ctx.save();ctx.beginPath();ctx.rect(cell.x,cell.y,cell.w,cell.h);ctx.clip();ctx.drawImage(img,dx,dy,dw,dh);ctx.restore();
}

function loadImage(src){
  return new Promise((resolve,reject)=>{
    if(!src){reject(new Error('Arka plan görseli bulunamadı.'));return}
    const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Arka plan okunamadı.'));img.src=src;
    if(img.complete&&img.naturalWidth)resolve(img);
  });
}

waitForScene();
