import { CameraController } from './camera.js';

const $=(s,r=document)=>r.querySelector(s);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const SETTINGS_KEY='aefs-scene-settings-v1';
const ACTIVE_BG_KEY='aefs-scene-active-bg-v2';
const DB_NAME='aefs-scene-studio';
const STORE='backgrounds';
const MAX_BACKGROUNDS=24;

const defaults={enabled:false,keyMode:'green',customColor:'#00ff00',tolerance:105,feather:100,scale:100,x:0,y:0,blur:0,brightness:100};
let state={...defaults,...readSettings(),feather:100};
let backgrounds=[];
let activeBackgroundId='';
let backgroundImage=null;
let backgroundUrl='';
let backgroundName='Arka plan yok';

function readSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch{return {}}}
function saveSettings(){state.feather=100;try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(state))}catch{} updateUi()}
function readActiveId(){try{return localStorage.getItem(ACTIVE_BG_KEY)||''}catch{return ''}}
function saveActiveId(id){activeBackgroundId=id||'';try{if(id)localStorage.setItem(ACTIVE_BG_KEY,id);else localStorage.removeItem(ACTIVE_BG_KEY)}catch{}}
function makeId(){return globalThis.crypto?.randomUUID?.()||`bg-${Date.now()}-${Math.random().toString(36).slice(2,8)}`}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}

async function putBackground(record){
  const db=await openDb();
  return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({id:record.id,name:record.name,blob:record.blob,createdAt:record.createdAt},`bg:${record.id}`);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
}
async function deleteBackgroundRecord(id){
  const db=await openDb();
  return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(`bg:${id}`);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
}
async function deleteLegacyActive(){
  try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete('active');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch{}
}
async function readLegacyActive(){
  try{const db=await openDb();return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get('active');req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)})}catch{return null}
}
async function readAllBackgroundRecords(){
  const db=await openDb();
  return new Promise((resolve,reject)=>{
    const out=[];const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).openCursor();
    req.onsuccess=()=>{const cursor=req.result;if(!cursor)return;const key=String(cursor.key||'');if(key.startsWith('bg:')&&cursor.value?.blob)out.push(cursor.value);cursor.continue()};
    req.onerror=()=>reject(req.error);tx.oncomplete=()=>resolve(out.sort((a,b)=>(a.createdAt||0)-(b.createdAt||0)));tx.onerror=()=>reject(tx.error);
  });
}

function recordWithUrl(record){return {...record,url:URL.createObjectURL(record.blob)}}
function revokeRecord(record){try{if(record?.url)URL.revokeObjectURL(record.url)}catch{}}

async function loadBackgroundLibrary(){
  try{
    let records=await readAllBackgroundRecords();
    if(!records.length){
      const legacy=await readLegacyActive();
      if(legacy?.blob){
        const migrated={id:makeId(),name:legacy.name||'Arka plan',blob:legacy.blob,createdAt:Date.now()};
        await putBackground(migrated);await deleteLegacyActive();records=[migrated];
      }
    }
    backgrounds.forEach(revokeRecord);
    backgrounds=records.map(recordWithUrl);
    let wanted=readActiveId();
    if(!backgrounds.some(item=>item.id===wanted))wanted=backgrounds[0]?.id||'';
    if(wanted)await selectBackground(wanted,{persist:true});else clearActiveBackground();
    renderBackgroundGallery();
  }catch(error){console.warn('Arka plan galerisi yüklenemedi',error)}
}

async function addBackgroundFiles(fileList){
  const files=[...fileList].filter(file=>file?.type?.startsWith('image/'));
  if(!files.length)return;
  const room=Math.max(0,MAX_BACKGROUNDS-backgrounds.length);
  if(!room){toast(`En fazla ${MAX_BACKGROUNDS} arka plan saklanabilir.`);return}
  const accepted=files.slice(0,room);
  let lastId='';
  for(const file of accepted){
    const record={id:makeId(),name:file.name||'Arka plan',blob:file,createdAt:Date.now()+Math.random()};
    await putBackground(record);
    const withUrl=recordWithUrl(record);backgrounds.push(withUrl);lastId=record.id;
  }
  if(files.length>accepted.length)toast(`${accepted.length} arka plan eklendi. Sınır ${MAX_BACKGROUNDS}.`);
  if(lastId)await selectBackground(lastId,{persist:true});
  state.enabled=true;if(state.keyMode==='off')state.keyMode='green';saveSettings();renderBackgroundGallery();
}

async function selectBackground(id,{persist=true}={}){
  const record=backgrounds.find(item=>item.id===id);if(!record)return;
  const img=await loadImageSrc(record.url);
  backgroundImage=img;backgroundUrl=record.url;backgroundName=record.name||'Arka plan';activeBackgroundId=record.id;
  if(persist)saveActiveId(record.id);
  updateUi();renderBackgroundGallery();
}

async function removeActiveBackground(){
  const id=activeBackgroundId;if(!id)return;
  const index=backgrounds.findIndex(item=>item.id===id);const record=backgrounds[index];
  try{await deleteBackgroundRecord(id)}catch{toast('Arka plan silinemedi.');return}
  revokeRecord(record);backgrounds.splice(index,1);
  const next=backgrounds[Math.min(index,backgrounds.length-1)]||backgrounds[0];
  if(next)await selectBackground(next.id,{persist:true});else{clearActiveBackground();saveActiveId('');state.enabled=false;saveSettings()}
  renderBackgroundGallery();
}

function clearActiveBackground(){activeBackgroundId='';backgroundImage=null;backgroundUrl='';backgroundName='Arka plan yok';updateUi()}

function insertScenePanel(){
  const nav=$('.dock-tabs'); const body=$('.dock-body');
  if(!nav||!body||$('[data-dock-tab="scene"]'))return;
  const tab=document.createElement('button');
  tab.className='dock-tab';tab.type='button';tab.dataset.dockTab='scene';tab.setAttribute('aria-selected','false');
  tab.innerHTML='<span>🎬</span><b>Sahne</b>';
  const projectTab=$('[data-dock-tab="project"]',nav);nav.insertBefore(tab,projectTab||null);

  const panel=document.createElement('section');
  panel.className='dock-pane scene-pane';panel.dataset.dockPanel='scene';
  panel.innerHTML=`
    <div class="scene-layout">
      <div class="scene-card scene-background-card">
        <div class="scene-card-head"><div><strong>Arka Plan</strong><small id="sceneBgName">Arka plan yok</small></div><label class="scene-switch"><input id="sceneEnabled" type="checkbox"><span></span></label></div>
        <div class="scene-preview" id="scenePreview"><span>Manzara / şehir / tapınak görseli ekle</span></div>
        <div class="scene-library-head"><span>Arka planlar</span><b id="sceneBgCount">0</b></div>
        <div class="scene-bg-gallery" id="sceneBgGallery"><div class="scene-bg-empty">Henüz arka plan yok</div></div>
        <div class="scene-actions"><button id="sceneAddBg" class="scene-primary" type="button">＋ Arka Planlar Ekle</button><button id="sceneRemoveBg" type="button">Seçileni Sil</button></div>
      </div>
      <div class="scene-card">
        <div class="scene-card-head"><div><strong>Chroma Key</strong><small>Yeşil veya mavi fonu kaldır</small></div></div>
        <label class="scene-field"><span>Fon rengi</span><select id="sceneKeyMode"><option value="off">Kapalı</option><option value="green">Yeşil Fon</option><option value="blue">Mavi Fon</option><option value="custom">Özel Renk</option></select></label>
        <label class="scene-field scene-custom-color"><span>Özel renk</span><input id="sceneCustomColor" type="color" value="#00ff00"></label>
        <label class="scene-range"><div><span>Tolerans</span><b id="sceneToleranceValue">105</b></div><input id="sceneTolerance" type="range" min="20" max="220" value="105"></label>
        <label class="scene-range"><div><span>Kenar yumuşatma</span><b id="sceneFeatherValue">100</b></div><input id="sceneFeather" type="range" min="100" max="100" value="100" disabled></label>
      </div>
      <div class="scene-card">
        <div class="scene-card-head"><div><strong>Arka Plan Yerleşimi</strong><small>Kadrajı sahneye uydur</small></div><button id="sceneReset" type="button">Sıfırla</button></div>
        <label class="scene-range"><div><span>Ölçek</span><b id="sceneScaleValue">100%</b></div><input id="sceneScale" type="range" min="70" max="220" value="100"></label>
        <label class="scene-range"><div><span>Yatay</span><b id="sceneXValue">0</b></div><input id="sceneX" type="range" min="-100" max="100" value="0"></label>
        <label class="scene-range"><div><span>Dikey</span><b id="sceneYValue">0</b></div><input id="sceneY" type="range" min="-100" max="100" value="0"></label>
        <div class="scene-two-col"><label class="scene-range"><div><span>Bulanıklık</span><b id="sceneBlurValue">0</b></div><input id="sceneBlur" type="range" min="0" max="18" value="0"></label><label class="scene-range"><div><span>Parlaklık</span><b id="sceneBrightnessValue">100%</b></div><input id="sceneBrightness" type="range" min="40" max="160" value="100"></label></div>
      </div>
      <div class="scene-note"><b>Çekim mantığı:</b> Manuel fotoğraf çektikten sonra bu kare için Arka Plan 1, 2, 3… seçimi sorulur. Seçtiğin sahne yalnızca o kareye işlenir.</div>
    </div>
    <input id="sceneBgInput" type="file" accept="image/*" multiple hidden>`;
  const projectPanel=$('[data-dock-panel="project"]',body);body.insertBefore(panel,projectPanel||null);
  wireUi(panel);
}

function wireUi(root){
  const bind=(id,event,fn)=>$('#'+id,root)?.addEventListener(event,fn);
  bind('sceneAddBg','click',()=>$('#sceneBgInput',root)?.click());
  bind('sceneBgInput','change',async e=>{const files=e.target.files;if(!files?.length)return;try{await addBackgroundFiles(files)}catch(error){console.warn(error);toast('Arka planlar eklenemedi.')}e.target.value=''});
  bind('sceneRemoveBg','click',()=>removeActiveBackground());
  bind('sceneEnabled','change',e=>{state.enabled=e.target.checked;saveSettings()});
  bind('sceneKeyMode','change',e=>{state.keyMode=e.target.value;saveSettings()});
  bind('sceneCustomColor','input',e=>{state.customColor=e.target.value;saveSettings()});
  [['sceneTolerance','tolerance'],['sceneScale','scale'],['sceneX','x'],['sceneY','y'],['sceneBlur','blur'],['sceneBrightness','brightness']].forEach(([id,key])=>bind(id,'input',e=>{state[key]=Number(e.target.value);saveSettings()}));
  bind('sceneReset','click',()=>{state={...state,scale:100,x:0,y:0,blur:0,brightness:100,tolerance:105,feather:100};saveSettings();syncInputs(root)});
  syncInputs(root); updateUi();renderBackgroundGallery();
}

function syncInputs(root=document){
  state.feather=100;
  const values={sceneEnabled:state.enabled,sceneKeyMode:state.keyMode,sceneCustomColor:state.customColor,sceneTolerance:state.tolerance,sceneFeather:100,sceneScale:state.scale,sceneX:state.x,sceneY:state.y,sceneBlur:state.blur,sceneBrightness:state.brightness};
  Object.entries(values).forEach(([id,val])=>{const el=$('#'+id,root);if(!el)return;if(el.type==='checkbox')el.checked=Boolean(val);else el.value=String(val)});updateUi();
}
function updateUi(){
  const set=(id,text)=>{const el=$('#'+id);if(el)el.textContent=text};
  const enabled=$('#sceneEnabled');if(enabled)enabled.checked=Boolean(state.enabled&&backgroundImage);
  const mode=$('#sceneKeyMode');if(mode)mode.value=state.keyMode;
  const color=$('#sceneCustomColor');if(color)color.value=state.customColor;
  set('sceneBgName',backgroundName);set('sceneBgCount',String(backgrounds.length));set('sceneToleranceValue',state.tolerance);set('sceneFeatherValue','100');set('sceneScaleValue',`${state.scale}%`);set('sceneXValue',state.x);set('sceneYValue',state.y);set('sceneBlurValue',state.blur);set('sceneBrightnessValue',`${state.brightness}%`);
  $('.scene-custom-color')?.classList.toggle('show',state.keyMode==='custom');
  const preview=$('#scenePreview');if(preview){preview.classList.toggle('has-image',Boolean(backgroundImage));preview.style.backgroundImage=backgroundUrl?`url("${backgroundUrl}")`:'';if(!backgroundImage)preview.innerHTML='<span>Manzara / şehir / tapınak görseli ekle</span>';else preview.innerHTML=''}
  const remove=$('#sceneRemoveBg');if(remove)remove.disabled=!activeBackgroundId;
}

function renderBackgroundGallery(){
  const gallery=$('#sceneBgGallery');if(!gallery)return;
  gallery.innerHTML='';
  if(!backgrounds.length){gallery.innerHTML='<div class="scene-bg-empty">Henüz arka plan yok</div>';updateUi();return}
  backgrounds.forEach((record,index)=>{
    const button=document.createElement('button');button.type='button';button.className='scene-bg-thumb';button.classList.toggle('active',record.id===activeBackgroundId);button.dataset.bgId=record.id;button.setAttribute('aria-label',`${index+1}. arka plan: ${record.name||'Arka plan'}`);button.title=record.name||`Arka plan ${index+1}`;
    const img=document.createElement('img');img.src=record.url;img.alt='';img.loading='lazy';
    const number=document.createElement('span');number.textContent=String(index+1);
    button.append(img,number);button.addEventListener('click',()=>selectBackground(record.id,{persist:true}).catch(()=>toast('Arka plan açılamadı.')));gallery.append(button);
  });
  updateUi();
}

const originalCapture=CameraController.prototype.capture;
CameraController.prototype.capture=function(canvas,options={}){
  const raw=originalCapture.call(this,canvas,options);
  if(!state.enabled||!backgroundImage||state.keyMode==='off')return raw;
  try{return compositeScene(canvas,backgroundImage)}catch(error){console.warn('Sahne uygulanamadı',error);return raw}
};

function compositeScene(foregroundCanvas,sceneImage=backgroundImage){
  const w=foregroundCanvas.width,h=foregroundCanvas.height;
  if(!w||!h||!sceneImage)return foregroundCanvas.toDataURL('image/jpeg',.99);
  const fg=foregroundCanvas.getContext('2d',{alpha:false,willReadFrequently:true}).getImageData(0,0,w,h);
  const out=document.createElement('canvas');out.width=w;out.height=h;const ctx=out.getContext('2d',{alpha:false});
  drawBackground(ctx,w,h,sceneImage);
  const bg=ctx.getImageData(0,0,w,h);
  const target=keyColor();const tolerance=clamp(state.tolerance,1,255);const feather=100;
  const f=fg.data,b=bg.data;
  for(let i=0;i<f.length;i+=4){
    const dr=f[i]-target[0],dg=f[i+1]-target[1],db=f[i+2]-target[2];
    const dist=Math.sqrt(dr*dr+dg*dg+db*db);
    let keep=dist<=tolerance?0:dist<tolerance+feather?(dist-tolerance)/feather:1;
    if(keep>0&&keep<1){if(state.keyMode==='green')f[i+1]=Math.min(f[i+1],Math.max(f[i],f[i+2])*1.12);if(state.keyMode==='blue')f[i+2]=Math.min(f[i+2],Math.max(f[i],f[i+1])*1.12)}
    b[i]=Math.round(b[i]*(1-keep)+f[i]*keep);b[i+1]=Math.round(b[i+1]*(1-keep)+f[i+1]*keep);b[i+2]=Math.round(b[i+2]*(1-keep)+f[i+2]*keep);b[i+3]=255;
  }
  ctx.putImageData(bg,0,0);
  foregroundCanvas.width=w;foregroundCanvas.height=h;foregroundCanvas.getContext('2d',{alpha:false}).drawImage(out,0,0);
  return foregroundCanvas.toDataURL('image/jpeg',.99);
}

function drawBackground(ctx,w,h,sceneImage=backgroundImage){
  ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  const iw=sceneImage.naturalWidth||sceneImage.width,ih=sceneImage.naturalHeight||sceneImage.height;
  const cover=Math.max(w/iw,h/ih)*(clamp(state.scale,50,300)/100);const dw=iw*cover,dh=ih*cover;
  const dx=(w-dw)/2+(state.x/100)*(w*.5);const dy=(h-dh)/2+(state.y/100)*(h*.5);
  ctx.filter=`blur(${clamp(state.blur,0,30)}px) brightness(${clamp(state.brightness,20,200)}%)`;ctx.drawImage(sceneImage,dx,dy,dw,dh);ctx.filter='none';ctx.restore();
}
function keyColor(){if(state.keyMode==='blue')return [0,80,255];if(state.keyMode==='custom')return hexToRgb(state.customColor);return [0,255,0]}
function hexToRgb(hex){const n=parseInt(String(hex).replace('#',''),16);return [(n>>16)&255,(n>>8)&255,n&255]}
function loadImageSrc(src){return new Promise((resolve,reject)=>{const img=new Image();img.decoding='async';img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Görsel okunamadı.'));img.src=src;if(img.complete&&img.naturalWidth)resolve(img)})}

async function applyBackgroundToCapturedData(rawDataUrl,record,index){
  if(!record)return {dataUrl:rawDataUrl,backgroundId:'',backgroundNumber:0,backgroundName:'Arka plansız'};
  await selectBackground(record.id,{persist:true});
  state.enabled=true;
  if(state.keyMode==='off'){state.keyMode='green';toast('Chroma Key Yeşil Fon olarak açıldı.');}
  saveSettings();syncInputs();
  const foreground=await loadImageSrc(rawDataUrl);
  const canvas=document.createElement('canvas');canvas.width=foreground.naturalWidth||foreground.width;canvas.height=foreground.naturalHeight||foreground.height;
  canvas.getContext('2d',{alpha:false}).drawImage(foreground,0,0,canvas.width,canvas.height);
  const sceneImage=record.id===activeBackgroundId&&backgroundImage?backgroundImage:await loadImageSrc(record.url);
  const dataUrl=compositeScene(canvas,sceneImage);
  return {dataUrl,backgroundId:record.id,backgroundNumber:index+1,backgroundName:record.name||`Arka Plan ${index+1}`};
}

function promptBackgroundChoice(){
  if(!backgrounds.length)return Promise.resolve({type:'none'});
  document.querySelector('.scene-capture-picker')?.remove();
  return new Promise(resolve=>{
    const overlay=document.createElement('div');overlay.className='scene-capture-picker';overlay.tabIndex=-1;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Bu kare hangi arka plan olsun?');
    const sheet=document.createElement('div');sheet.className='scene-capture-sheet';
    const head=document.createElement('div');head.className='scene-capture-head';head.innerHTML='<div><small>YENİ KARE</small><strong>Bu kare hangi arka plan olsun?</strong><span>Numaralı sahnelerden birini seç.</span></div>';
    const grid=document.createElement('div');grid.className='scene-capture-grid';
    const finish=value=>{overlay.remove();resolve(value)};
    const none=document.createElement('button');none.type='button';none.className='scene-capture-choice scene-capture-none';none.innerHTML='<div class="scene-capture-thumb"><span>∅</span></div><b>0</b><strong>Arka plansız</strong><small>Orijinal kare</small>';none.addEventListener('click',()=>finish({type:'none'}));grid.append(none);
    backgrounds.forEach((record,index)=>{
      const button=document.createElement('button');button.type='button';button.className='scene-capture-choice';button.dataset.bgId=record.id;button.setAttribute('aria-label',`Arka Plan ${index+1}: ${record.name||''}`);
      const thumb=document.createElement('div');thumb.className='scene-capture-thumb';const img=document.createElement('img');img.src=record.url;img.alt='';thumb.append(img);
      const number=document.createElement('b');number.textContent=String(index+1);
      const title=document.createElement('strong');title.textContent=`Arka Plan ${index+1}`;
      const name=document.createElement('small');name.textContent=record.name||`Sahne ${index+1}`;
      button.append(thumb,number,title,name);button.addEventListener('click',()=>finish({type:'background',record,index}));grid.append(button);
    });
    const footer=document.createElement('div');footer.className='scene-capture-footer';const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Çekimi iptal et';cancel.addEventListener('click',()=>finish({type:'cancel'}));footer.append(cancel);
    sheet.append(head,grid,footer);overlay.append(sheet);document.body.append(overlay);
    overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish({type:'cancel'})}});
    requestAnimationFrame(()=>overlay.focus());
  });
}

async function promptAndApplyCapturedFrame(rawDataUrl){
  const choice=await promptBackgroundChoice();
  if(choice.type==='cancel')return null;
  if(choice.type==='none')return {dataUrl:rawDataUrl,backgroundId:'',backgroundNumber:0,backgroundName:'Arka plansız'};
  try{return await applyBackgroundToCapturedData(rawDataUrl,choice.record,choice.index)}catch(error){console.warn('Seçilen sahne uygulanamadı',error);toast('Arka plan uygulanamadı; kare arka plansız kaydedildi.');return {dataUrl:rawDataUrl,backgroundId:'',backgroundNumber:0,backgroundName:'Arka plansız'}}
}

globalThis.AEFSSceneCapture={
  hasBackgrounds:()=>backgrounds.length>0,
  getBackgrounds:()=>backgrounds.map((record,index)=>({id:record.id,number:index+1,name:record.name||`Arka Plan ${index+1}`})),
  promptAndApply:promptAndApplyCapturedFrame
};

function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}

insertScenePanel();
loadBackgroundLibrary().then(()=>syncInputs());
window.addEventListener('beforeunload',()=>backgrounds.forEach(revokeRecord));
