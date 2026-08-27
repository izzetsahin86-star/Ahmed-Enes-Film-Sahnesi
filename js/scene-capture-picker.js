import { drawSourceToCanvas } from './camera.js';

const $=selector=>document.querySelector(selector);
let busy=false;

function sceneApi(){return globalThis.AEFSSceneCapture}
function hasSceneChoices(){try{return Boolean(sceneApi()?.hasBackgrounds?.())}catch{return false}}
function cameraReady(){const video=$('#cameraVideo');return Boolean($('#cameraToggleBtn')?.classList.contains('active')&&video?.srcObject&&video.videoWidth&&video.videoHeight)}
function isTypingTarget(target){return Boolean(target?.closest?.('input,textarea,select,[contenteditable="true"]'))}

async function captureWithSceneChoice(){
  if(busy)return;
  if(!cameraReady()){toast('Önce kamerayı aç.');return}
  const api=sceneApi();
  if(!api?.promptAndApply){toast('Sahne sistemi henüz hazır değil.');return}
  const video=$('#cameraVideo');const canvas=$('#captureCanvas');const captureBtn=$('#captureBtn');
  busy=true;if(captureBtn)captureBtn.disabled=true;
  try{
    const timerSeconds=Number($('#timerSelect')?.value||0);
    if(timerSeconds>0)await runCountdown(timerSeconds);
    const rawDataUrl=drawSourceToCanvas(video,canvas,{
      mirror:Boolean($('#mirrorToggle')?.checked),
      aspectRatio:$('#aspectSelect')?.value||'source',
      quality:.99
    });
    flashCapture();
    const result=await api.promptAndApply(rawDataUrl);
    if(!result){toast('Çekim iptal edildi.');return}
    appendFrame(result);
  }catch(error){console.warn('Sahne seçimli çekim başarısız',error);toast(error?.message||'Fotoğraf çekilemedi.');}
  finally{busy=false;if(captureBtn)captureBtn.disabled=!cameraReady()}
}

function appendFrame(result){
  const frames=globalThis.AEFS_PROJECT_FRAMES;
  const timeline=globalThis.AEFS_TIMELINE;
  if(!Array.isArray(frames)||!timeline?.setFrames)throw new Error('Proje zaman çizelgesi hazır değil.');
  const frame={
    id:globalThis.crypto?.randomUUID?.()||`frame-${Date.now()}`,
    dataUrl:result.dataUrl,
    hold:1,
    createdAt:Date.now(),
    sceneBackgroundId:result.backgroundId||'',
    sceneBackgroundNumber:Number(result.backgroundNumber)||0,
    sceneBackgroundName:result.backgroundName||'Arka plansız'
  };
  frames.push(frame);
  const index=frames.length-1;
  timeline.setFrames(frames,index);
  timeline.handlers?.onSelect?.(index);
  // App'in mevcut otomatik kayıt mekanizmasını çalıştır; herhangi bir ayarı değiştirmez.
  $('#fpsInput')?.dispatchEvent(new Event('change',{bubbles:true}));
  if(frame.sceneBackgroundNumber>0)toast(`Kare ${index+1} · Arka Plan ${frame.sceneBackgroundNumber} uygulandı.`);
  else toast(`Kare ${index+1} arka plansız kaydedildi.`);
}

function runCountdown(seconds){
  return new Promise(resolve=>{
    const countdown=$('#countdown');
    if(!countdown){resolve();return}
    let value=Math.max(1,Math.round(seconds));
    countdown.style.display='grid';countdown.textContent=String(value);
    const id=setInterval(()=>{
      value-=1;
      if(value<=0){clearInterval(id);countdown.style.display='none';resolve()}
      else countdown.textContent=String(value);
    },1000);
  });
}

function flashCapture(){
  const flash=$('#recordFlash');if(!flash)return;
  flash.classList.remove('flash');void flash.offsetWidth;flash.classList.add('flash');
}
function toast(message){
  const el=$('#toast');if(!el)return;
  el.textContent=message;el.classList.add('show');
  clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove('show'),2800);
}

document.addEventListener('click',event=>{
  const button=event.target?.closest?.('#captureBtn');
  if(!button||!hasSceneChoices())return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  captureWithSceneChoice();
},true);

document.addEventListener('keydown',event=>{
  if(event.code!=='Space'||event.repeat||isTypingTarget(event.target)||!hasSceneChoices())return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  captureWithSceneChoice();
},true);
