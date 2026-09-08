const $=(selector,root=document)=>root.querySelector(selector);

const AI_MODULE='https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.5.6/+esm';
let aiLoader=null;
let busy=false;

function waitForScene(){
  const card=$('.scene-background-card');
  const actions=$('.scene-actions',card||document);
  const gallery=$('#sceneBgGallery',card||document);
  if(!card||!actions||!gallery){setTimeout(waitForScene,100);return}
  if($('#sceneAiRemoveBg',card))return;
  install(card,actions,gallery);
}

function install(card,actions,gallery){
  const button=document.createElement('button');
  button.id='sceneAiRemoveBg';
  button.type='button';
  button.className='scene-ai-remove-bg';
  button.innerHTML='<span aria-hidden="true">✂</span> Arka Plan Sil';
  button.title='Seçili görselin arka planını AI ile şeffaflaştır';
  actions.append(button);

  button.addEventListener('click',removeSelectedBackground);

  const sync=()=>{
    if(busy)return;
    const hasActive=Boolean($('.scene-bg-thumb.active',gallery));
    button.disabled=!hasActive;
    button.title=hasActive?'Seçili görselin arka planını AI ile şeffaflaştır':'Önce bir arka plan seç';
  };
  gallery.addEventListener('click',()=>queueMicrotask(sync));
  new MutationObserver(sync).observe(gallery,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  sync();
}

async function getRemoveBackground(){
  if(!aiLoader){
    aiLoader=import(AI_MODULE).then(mod=>{
      const fn=mod.removeBackground||mod.default;
      if(typeof fn!=='function')throw new Error('AI arka plan silme modülü yüklenemedi.');
      return fn;
    }).catch(error=>{aiLoader=null;throw error});
  }
  return aiLoader;
}

async function removeSelectedBackground(){
  if(busy)return;
  const button=$('#sceneAiRemoveBg');
  const thumb=$('#sceneBgGallery .scene-bg-thumb.active');
  const image=$('img',thumb||document);
  const input=$('#sceneBgInput');
  if(!button||!thumb||!image?.src||!input)return;

  busy=true;
  button.disabled=true;
  const original=button.innerHTML;
  button.classList.add('working');
  setButton(button,'AI hazırlanıyor…');

  try{
    const sourceResponse=await fetch(image.src);
    if(!sourceResponse.ok)throw new Error('Seçili görsel okunamadı.');
    const sourceBlob=await sourceResponse.blob();
    const removeBackground=await getRemoveBackground();

    const result=await removeBackground(sourceBlob,{
      model:'small',
      output:{format:'image/png',quality:1},
      progress:(key,current,total)=>updateProgress(button,key,current,total)
    });

    if(!(result instanceof Blob)||!result.size)throw new Error('Şeffaf görsel oluşturulamadı.');
    setButton(button,'Galeriye ekleniyor…');

    const number=String(thumb.querySelector(':scope > span')?.textContent||'').trim()||'BG';
    const file=new File([result],`Kesilmis-${number}-${Date.now()}.png`,{type:'image/png',lastModified:Date.now()});
    const transfer=new DataTransfer();
    transfer.items.add(file);
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));

    await waitForNewActive(thumb.dataset.bgId);
    setButton(button,'✓ Arka plan silindi');
    try{navigator.vibrate?.(18)}catch{}
    setTimeout(()=>{if(!busy)return;button.innerHTML=original},900);
  }catch(error){
    console.warn('AI arka plan silme başarısız',error);
    setButton(button,'Tekrar dene');
    button.classList.add('error');
    setTimeout(()=>{button.classList.remove('error');button.innerHTML=original},1600);
  }finally{
    setTimeout(()=>{
      busy=false;
      button.classList.remove('working');
      button.disabled=!$('#sceneBgGallery .scene-bg-thumb.active');
    },950);
  }
}

function updateProgress(button,key,current,total){
  const ratio=total>0?Math.max(0,Math.min(1,current/total)):0;
  const percent=Math.round(ratio*100);
  if(String(key).startsWith('fetch:'))setButton(button,`AI modeli ${percent}%`);
  else if(String(key).includes('inference'))setButton(button,'AI nesneyi ayırıyor…');
  else if(String(key).includes('mask'))setButton(button,'Kenarlar işleniyor…');
  else if(String(key).includes('encode'))setButton(button,'Şeffaf PNG hazırlanıyor…');
}

function setButton(button,text){
  button.textContent=text;
}

function waitForNewActive(previousId){
  return new Promise(resolve=>{
    const started=Date.now();
    const check=()=>{
      const active=$('#sceneBgGallery .scene-bg-thumb.active');
      if(active&&active.dataset.bgId&&active.dataset.bgId!==previousId){resolve(active);return}
      if(Date.now()-started>5000){resolve(null);return}
      setTimeout(check,80);
    };
    check();
  });
}

waitForScene();
