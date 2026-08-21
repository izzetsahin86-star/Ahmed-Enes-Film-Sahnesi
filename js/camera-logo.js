// Sol üst kontrol alanını tamamen boş bırak: logo ve X görünmez, DOM'dan kaldırılır.
function removeLeftTopControl(){
  document.querySelectorAll('.simple-corner-logo,.simple-close').forEach(element=>element.remove());
  const host=document.querySelector('.simple-top-controls');
  if(host)host.classList.add('simple-top-controls-no-left');
}

removeLeftTopControl();
requestAnimationFrame(removeLeftTopControl);
setTimeout(removeLeftTopControl,120);
setTimeout(removeLeftTopControl,600);

const cameraColumn=document.querySelector('.camera-stage-column');
if(cameraColumn){
  const observer=new MutationObserver(()=>removeLeftTopControl());
  observer.observe(cameraColumn,{childList:true,subtree:true});
}
