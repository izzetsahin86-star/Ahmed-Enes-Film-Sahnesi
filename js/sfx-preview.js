const $=(selector,root=document)=>root.querySelector(selector);

let previewAudio=null;
let previewUrl='';
let previewButton=null;
let previewLabel='';

function installPreviewStyle(){
  if($('#sfxPreviewStyle'))return;
  const style=document.createElement('style');
  style.id='sfxPreviewStyle';
  style.textContent=`
    .ninja-sfx-pad.previewing{
      background:rgba(22,136,255,.18)!important;
      border-color:rgba(88,174,255,.48)!important;
      box-shadow:0 0 0 1px rgba(88,174,255,.12),0 8px 22px rgba(0,72,170,.16)!important;
    }
    .ninja-sfx-pad.previewing .ninja-sfx-icon{background:rgba(22,136,255,.28)!important;color:#fff!important}
    .ninja-sfx-pad.previewing .ninja-sfx-add{color:#fff!important}
  `;
  document.head.append(style);
}

function stopPreview(){
  if(previewAudio){
    try{previewAudio.pause();previewAudio.currentTime=0}catch{}
    previewAudio.onended=null;
    previewAudio.onerror=null;
  }
  if(previewUrl){
    try{URL.revokeObjectURL(previewUrl)}catch{}
  }
  if(previewButton){
    previewButton.classList.remove('previewing');
    const small=previewButton.querySelector('.ninja-sfx-copy small');
    if(small&&small.textContent==='Çalıyor…')small.textContent=previewLabel||'Dokun: dinle + ekle';
  }
  previewAudio=null;
  previewUrl='';
  previewButton=null;
  previewLabel='';
}

function previewEffect(button){
  const input=$('#soundFileInput');
  const file=input?.files?.[0];
  if(!file||!file.type?.startsWith('audio/'))return;

  stopPreview();
  previewButton=button;
  const small=button.querySelector('.ninja-sfx-copy small');
  previewLabel=small?.textContent||'Dokun: dinle + ekle';
  if(small)small.textContent='Çalıyor…';
  button.classList.add('previewing');

  previewUrl=URL.createObjectURL(file);
  previewAudio=new Audio(previewUrl);
  previewAudio.preload='auto';
  previewAudio.volume=.95;
  previewAudio.onended=stopPreview;
  previewAudio.onerror=stopPreview;
  const playPromise=previewAudio.play();
  if(playPromise?.catch)playPromise.catch(()=>stopPreview());
}

function updateLabels(){
  document.querySelectorAll('.ninja-sfx-copy small').forEach(label=>{
    if(label.textContent==='Dokun ve ekle')label.textContent='Dokun: dinle + ekle';
  });
}

installPreviewStyle();
updateLabels();

document.addEventListener('click',event=>{
  const button=event.target.closest?.('[data-ninja-sfx]');
  if(!button)return;
  // ninja-sfx.js aynı tıklamada WAV dosyasını input'a yerleştirir.
  // Bubble aşamasında dosya hazırdır; kullanıcı hareketi devam ederken sesi çalabiliriz.
  previewEffect(button);
});

const library=$('.ninja-sfx-library');
if(library)new MutationObserver(updateLabels).observe(library,{childList:true,subtree:true});
window.addEventListener('beforeunload',stopPreview);
