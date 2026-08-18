import './camera-simple.js';
import './camera-tweaks.js';
import './studio-ux.js';
import './modern-sheet.js';

const dock=document.getElementById('timelineDock');
const collapseButton=document.getElementById('collapseTimelineBtn');
const tabs=[...document.querySelectorAll('[data-dock-tab]')];
const panels=[...document.querySelectorAll('[data-dock-panel]')];
const settingsButton=document.getElementById('settingsBtn');
const shortcutMirror=document.querySelector('[data-open-shortcuts]');
const shortcutsButton=document.getElementById('shortcutsBtn');
const fullscreenButton=document.getElementById('fullscreenBtn');
const stage=document.getElementById('stage');
const stageColumn=document.querySelector('.camera-stage-column');

function expandedHeight(){
  if(matchMedia('(orientation: landscape) and (max-height: 520px)').matches)return '148px';
  if(matchMedia('(max-width: 900px)').matches)return '172px';
  return '202px';
}
function expandedHeaderHeight(){
  if(matchMedia('(orientation: landscape) and (max-height: 520px)').matches)return '44px';
  if(matchMedia('(max-width: 900px)').matches)return '48px';
  return '52px';
}
function syncDockGeometry(){
  const collapsed=dock?.classList.contains('collapsed');
  document.documentElement.style.setProperty('--dock-head',collapsed?'46px':expandedHeaderHeight());
  if(!collapsed)document.documentElement.style.setProperty('--timeline-h',expandedHeight());
}
function expandDock(){
  if(!dock?.classList.contains('collapsed'))return;
  dock.classList.remove('collapsed');
  collapseButton?.setAttribute('aria-expanded','true');
  syncDockGeometry();
}
function activateDock(name,{expand=true}={}){
  tabs.forEach(tab=>{const active=tab.dataset.dockTab===name;tab.classList.toggle('active',active);tab.setAttribute('aria-selected',String(active));});
  panels.forEach(panel=>panel.classList.toggle('active',panel.dataset.dockPanel===name));
  document.body.dataset.studioPanel=name;
  try{localStorage.setItem('aefs-active-dock',name);}catch{}
  if(expand)expandDock();
}
tabs.forEach(tab=>tab.addEventListener('click',()=>activateDock(tab.dataset.dockTab)));
settingsButton?.addEventListener('click',()=>activateDock('shoot'));
shortcutMirror?.addEventListener('click',()=>shortcutsButton?.click());
collapseButton?.addEventListener('click',()=>queueMicrotask(syncDockGeometry));

fullscreenButton?.addEventListener('click',async event=>{
  event.stopImmediatePropagation();
  try{
    if(document.fullscreenElement)await document.exitFullscreen();
    else await stageColumn?.requestFullscreen?.();
  }catch{}
},{capture:true});
stage?.addEventListener('dblclick',event=>{if(event.target.closest('button,input,select'))return;fullscreenButton?.click();});
document.addEventListener('fullscreenchange',()=>{if(fullscreenButton)fullscreenButton.textContent=document.fullscreenElement?'Tam ekrandan çık':'Tam ekran';});
window.addEventListener('resize',syncDockGeometry);
const stored=(()=>{try{return localStorage.getItem('aefs-active-dock');}catch{return null;}})();
activateDock(['shoot','frames','audio','project','export'].includes(stored)?stored:'shoot',{expand:false});
syncDockGeometry();
