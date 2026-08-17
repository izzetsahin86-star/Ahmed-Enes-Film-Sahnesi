const dock=document.getElementById('timelineDock');
const collapseButton=document.getElementById('collapseTimelineBtn');
const tabs=[...document.querySelectorAll('[data-dock-tab]')];
const panels=[...document.querySelectorAll('[data-dock-panel]')];
const settingsButton=document.getElementById('settingsBtn');
const shortcutMirror=document.querySelector('[data-open-shortcuts]');
const shortcutsButton=document.getElementById('shortcutsBtn');
const fullscreenButton=document.getElementById('fullscreenBtn');
const stage=document.getElementById('stage');

function expandedHeight(){
  if(matchMedia('(orientation: landscape) and (max-height: 520px)').matches)return '148px';
  if(matchMedia('(max-width: 900px)').matches)return '172px';
  return '202px';
}
function expandDock(){
  if(!dock?.classList.contains('collapsed'))return;
  dock.classList.remove('collapsed');
  collapseButton?.setAttribute('aria-expanded','true');
  document.documentElement.style.setProperty('--timeline-h',expandedHeight());
}
function activateDock(name,{expand=true}={}){
  tabs.forEach(tab=>{const active=tab.dataset.dockTab===name;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));});
  panels.forEach(panel=>panel.classList.toggle('active',panel.dataset.dockPanel===name));
  try{localStorage.setItem('aefs-active-dock',name);}catch{}
  if(expand)expandDock();
}
tabs.forEach(tab=>tab.addEventListener('click',()=>activateDock(tab.dataset.dockTab)));
settingsButton?.addEventListener('click',()=>activateDock('shoot'));
shortcutMirror?.addEventListener('click',()=>shortcutsButton?.click());
stage?.addEventListener('dblclick',event=>{if(event.target.closest('button,input,select'))return;fullscreenButton?.click();});
document.addEventListener('fullscreenchange',()=>{if(fullscreenButton)fullscreenButton.textContent=document.fullscreenElement?'Tam ekrandan çık':'Tam ekran';});
window.addEventListener('resize',()=>{if(!dock?.classList.contains('collapsed'))document.documentElement.style.setProperty('--timeline-h',expandedHeight());});
const stored=(()=>{try{return localStorage.getItem('aefs-active-dock');}catch{return null;}})();
activateDock(['shoot','frames','project','export'].includes(stored)?stored:'shoot',{expand:false});
