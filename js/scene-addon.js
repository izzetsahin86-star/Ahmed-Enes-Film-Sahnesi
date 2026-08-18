import { CameraController } from './camera.js';

const $=(s,r=document)=>r.querySelector(s);
const clamp=(v,min,max)=>Math.min(max,Math.max(min,Number(v)||0));
const SETTINGS_KEY='aefs-scene-settings-v1';
const DB_NAME='aefs-scene-studio';
const STORE='backgrounds';

const defaults={enabled:false,keyMode:'green',customColor:'#00ff00',tolerance:105,feather:55,scale:100,x:0,y:0,blur:0,brightness:100};
let state={...defaults,...readSettings()};
let backgroundImage=null;
let backgroundUrl='';
let backgroundName='Arka plan yok';

function readSettings(){try{return JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}catch{return {}}}
function saveSettings(){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(state))}catch{} updateUi()}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function storeBackground(blob,name){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({blob,name},'active');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}
async function loadStoredBackground(){try{const db=await openDb();const data=await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).get('active');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});if(data?.blob)await useBackgroundBlob(data.blob,data.name||'Arka plan')}catch{}}
async function clearStoredBackground(){try{const db=await openDb();await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete('active');tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)})}catch{}}

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
        <div class="scene-actions"><button id="sceneAddBg" class="scene-primary" type="button">＋ Arka Plan Ekle</button><button id="sceneRemoveBg" type="button">Kaldır</button></div>
      </div>
      <div class="scene-card">
        <div class="scene-card-head"><div><strong>Chroma Key</strong><small>Yeşil veya mavi fonu kaldır</small></div></div>
        <label class="scene-field"><span>Fon rengi</span><select id="sceneKeyMode"><option value="off">Kapalı</option><option value="green">Yeşil Fon</option><option value="blue">Mavi Fon</option><option value="custom">Özel Renk</option></select></label>
        <label class="scene-field scene-custom-color"><span>Özel renk</span><input id="sceneCustomColor" type="color" value="#00ff00"></label>
        <label class="scene-range"><div><span>Tolerans</span><b id="sceneToleranceValue">105</b></div><input id="sceneTolerance" type="range" min="20" max="220" value="105"></label>
        <label class="scene-range"><div><span>Kenar yumuşatma</span><b id="sceneFeatherValue">55</b></div><input id="sceneFeather" type="range" min="0" max="140" value="55"></label>
      </div>
      <div class="scene-card">
        <div class="scene-card-head"><div><strong>Arka Plan Yerleşimi</strong><small>Kadrajı sahneye uydur</small></div><button id="sceneReset" type="button">Sıfırla</button></div>
        <label class="scene-range"><div><span>Ölçek</span><b id="sceneScaleValue">100%</b></div><input id="sceneScale" type="range" min="70" max="220" value="100"></label>
        <label class="scene-range"><div><span>Yatay</span><b id="sceneXValue">0</b></div><input id="sceneX" type="range" min="-100" max="100" value="0"></label>
        <label class="scene-range"><div><span>Dikey</span><b id="sceneYValue">0</b></div><input id="sceneY" type="range" min="-100" max="100" value="0"></label>
        <div class="scene-two-col"><label class="scene-range"><div><span>Bulanıklık</span><b id="sceneBlurValue">0</b></div><input id="sceneBlur" type="range" min="0" max="18" value="0"></label><label class="scene-range"><div><span>Parlaklık</span><b id="sceneBrightnessValue">100%</b></div><input id="sceneBrightness" type="range" min="40" max="160" value="100"></label></div>
      </div>
      <div class="scene-note"><b>Çekim mantığı:</b> Arka plan ve Chroma Key açıkken yeni çekilen kareye sahne otomatik işlenir. Böylece Kareler, GIF, MP4 ve WebM çıktılarında aynı görünür.</div>
    </div>
    <input id="sceneBgInput" type="file" accept="image/*" hidden>`;
  const projectPanel=$('[data-dock-panel="project"]',body);body.insertBefore(panel,projectPanel||null);
  wireUi(panel);
}

function wireUi(root){
  const bind=(id,event,fn)=>$('#'+id,root)?.addEventListener(event,fn);
  bind('sceneAddBg','click',()=>$('#sceneBgInput',root)?.click());
  bind('sceneBgInput','change',async e=>{const file=e.target.files?.[0];if(!file)return;try{await storeBackground(file,file.name);await useBackgroundBlob(file,file.name);state.enabled=true;if(state.keyMode==='off')state.keyMode='green';saveSettings()}catch{toast('Arka plan eklenemedi.')}e.target.value=''});
  bind('sceneRemoveBg','click',async()=>{releaseBackground();await clearStoredBackground();state.enabled=false;saveSettings()});
  bind('sceneEnabled','change',e=>{state.enabled=e.target.checked;saveSettings()});
  bind('sceneKeyMode','change',e=>{state.keyMode=e.target.value;saveSettings()});
  bind('sceneCustomColor','input',e=>{state.customColor=e.target.value;saveSettings()});
  [['sceneTolerance','tolerance'],['sceneFeather','feather'],['sceneScale','scale'],['sceneX','x'],['sceneY','y'],['sceneBlur','blur'],['sceneBrightness','brightness']].forEach(([id,key])=>bind(id,'input',e=>{state[key]=Number(e.target.value);saveSettings()}));
  bind('sceneReset','click',()=>{state={...state,scale:100,x:0,y:0,blur:0,brightness:100,tolerance:105,feather:55};saveSettings();syncInputs(root)});
  syncInputs(root); updateUi();
}

function syncInputs(root=document){
  const values={sceneEnabled:state.enabled,sceneKeyMode:state.keyMode,sceneCustomColor:state.customColor,sceneTolerance:state.tolerance,sceneFeather:state.feather,sceneScale:state.scale,sceneX:state.x,sceneY:state.y,sceneBlur:state.blur,sceneBrightness:state.brightness};
  Object.entries(values).forEach(([id,val])=>{const el=$('#'+id,root);if(!el)return;if(el.type==='checkbox')el.checked=Boolean(val);else el.value=String(val)});updateUi();
}
function updateUi(){
  const set=(id,text)=>{const el=$('#'+id);if(el)el.textContent=text};
  const enabled=$('#sceneEnabled');if(enabled)enabled.checked=Boolean(state.enabled&&backgroundImage);
  const mode=$('#sceneKeyMode');if(mode)mode.value=state.keyMode;
  const color=$('#sceneCustomColor');if(color)color.value=state.customColor;
  set('sceneBgName',backgroundName);set('sceneToleranceValue',state.tolerance);set('sceneFeatherValue',state.feather);set('sceneScaleValue',`${state.scale}%`);set('sceneXValue',state.x);set('sceneYValue',state.y);set('sceneBlurValue',state.blur);set('sceneBrightnessValue',`${state.brightness}%`);
  $('.scene-custom-color')?.classList.toggle('show',state.keyMode==='custom');
  const preview=$('#scenePreview');if(preview){preview.classList.toggle('has-image',Boolean(backgroundImage));preview.style.backgroundImage=backgroundUrl?`url("${backgroundUrl}")`:'';if(!backgroundImage)preview.innerHTML='<span>Manzara / şehir / tapınak görseli ekle</span>';else preview.innerHTML=''}
}

async function useBackgroundBlob(blob,name){
  releaseBackground();
  backgroundUrl=URL.createObjectURL(blob);backgroundName=name||'Arka plan';
  const img=new Image();img.decoding='async';img.src=backgroundUrl;await img.decode();backgroundImage=img;updateUi();
}
function releaseBackground(){if(backgroundUrl)URL.revokeObjectURL(backgroundUrl);backgroundUrl='';backgroundImage=null;backgroundName='Arka plan yok';updateUi()}

const originalCapture=CameraController.prototype.capture;
CameraController.prototype.capture=function(canvas,options={}){
  const raw=originalCapture.call(this,canvas,options);
  if(!state.enabled||!backgroundImage||state.keyMode==='off')return raw;
  try{return compositeScene(canvas)}catch(error){console.warn('Sahne uygulanamadı',error);return raw}
};

function compositeScene(foregroundCanvas){
  const w=foregroundCanvas.width,h=foregroundCanvas.height;
  if(!w||!h||!backgroundImage)return foregroundCanvas.toDataURL('image/jpeg',.99);
  const fg=foregroundCanvas.getContext('2d',{alpha:false,willReadFrequently:true}).getImageData(0,0,w,h);
  const out=document.createElement('canvas');out.width=w;out.height=h;const ctx=out.getContext('2d',{alpha:false});
  drawBackground(ctx,w,h);
  const bg=ctx.getImageData(0,0,w,h);
  const target=keyColor();const tolerance=clamp(state.tolerance,1,255);const feather=clamp(state.feather,0,180);
  const f=fg.data,b=bg.data;
  for(let i=0;i<f.length;i+=4){
    const dr=f[i]-target[0],dg=f[i+1]-target[1],db=f[i+2]-target[2];
    const dist=Math.sqrt(dr*dr+dg*dg+db*db);
    let keep=dist<=tolerance?0:feather>0&&dist<tolerance+feather?(dist-tolerance)/feather:1;
    // Yeşil/mavi saçılmayı kenarlarda azalt.
    if(keep>0&&keep<1){if(state.keyMode==='green')f[i+1]=Math.min(f[i+1],Math.max(f[i],f[i+2])*1.12);if(state.keyMode==='blue')f[i+2]=Math.min(f[i+2],Math.max(f[i],f[i+1])*1.12)}
    b[i]=Math.round(b[i]*(1-keep)+f[i]*keep);b[i+1]=Math.round(b[i+1]*(1-keep)+f[i+1]*keep);b[i+2]=Math.round(b[i+2]*(1-keep)+f[i+2]*keep);b[i+3]=255;
  }
  ctx.putImageData(bg,0,0);
  foregroundCanvas.width=w;foregroundCanvas.height=h;foregroundCanvas.getContext('2d',{alpha:false}).drawImage(out,0,0);
  return foregroundCanvas.toDataURL('image/jpeg',.99);
}

function drawBackground(ctx,w,h){
  ctx.save();ctx.fillStyle='#000';ctx.fillRect(0,0,w,h);
  const iw=backgroundImage.naturalWidth||backgroundImage.width,ih=backgroundImage.naturalHeight||backgroundImage.height;
  const cover=Math.max(w/iw,h/ih)*(clamp(state.scale,50,300)/100);const dw=iw*cover,dh=ih*cover;
  const dx=(w-dw)/2+(state.x/100)*(w*.5);const dy=(h-dh)/2+(state.y/100)*(h*.5);
  ctx.filter=`blur(${clamp(state.blur,0,30)}px) brightness(${clamp(state.brightness,20,200)}%)`;ctx.drawImage(backgroundImage,dx,dy,dw,dh);ctx.filter='none';ctx.restore();
}
function keyColor(){if(state.keyMode==='blue')return [0,80,255];if(state.keyMode==='custom')return hexToRgb(state.customColor);return [0,255,0]}
function hexToRgb(hex){const n=parseInt(String(hex).replace('#',''),16);return [(n>>16)&255,(n>>8)&255,n&255]}
function toast(msg){const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');setTimeout(()=>el.classList.remove('show'),2600)}

insertScenePanel();
loadStoredBackground().then(()=>syncInputs());
window.addEventListener('beforeunload',releaseBackground);
