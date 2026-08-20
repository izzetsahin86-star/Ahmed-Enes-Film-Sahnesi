const pane=document.querySelector('.audio-pane');
if(pane){
  const layout=pane.querySelector('.audio-layout');
  const cards=[...layout?.querySelectorAll(':scope > .audio-card')||[]];
  const sources=cards[0];
  const library=cards[1];
  const timeline=cards[cards.length-1];
  sources?.classList.add('audio-sources-card');
  library?.classList.add('audio-library-card');
  timeline?.classList.add('audio-timeline-card');

  const isMobile=()=>matchMedia('(max-width:760px)').matches;
  let activeView='sources';

  if(layout&&!layout.querySelector('.audio-workspace-nav')){
    const nav=document.createElement('div');
    nav.className='audio-workspace-nav';
    nav.innerHTML=`
      <button type="button" class="primary" data-audio-jump="sources">＋ Ekle</button>
      <button type="button" data-audio-jump="timeline">▤ Zaman</button>
      <button type="button" data-audio-jump="library">⚡ Efekt</button>
      <span class="audio-workspace-spacer"></span>
      <span class="audio-workspace-summary">Ses çalışma alanı</span>`;
    layout.prepend(nav);

    const targets={timeline,sources,library};
    const setView=name=>{
      activeView=name in targets?name:'sources';
      layout.dataset.mobileAudioView=activeView;
      nav.querySelectorAll('[data-audio-jump]').forEach(item=>item.classList.toggle('primary',item.dataset.audioJump===activeView));
      const target=targets[activeView];
      if(!target)return;
      if(isMobile()){
        target.scrollTop=0;
      }else{
        target.animate([{outline:'1px solid rgba(80,164,255,.1)'},{outline:'1px solid rgba(80,164,255,.65)'},{outline:'1px solid rgba(80,164,255,.1)'}],{duration:520,easing:'ease-out'});
      }
    };

    nav.addEventListener('click',event=>{
      const button=event.target.closest('[data-audio-jump]');
      if(!button)return;
      setView(button.dataset.audioJump);
    });

    document.querySelector('[data-dock-tab="audio"]')?.addEventListener('click',()=>{
      if(isMobile())setTimeout(()=>setView('sources'),0);
    });
    window.addEventListener('resize',()=>setView(activeView));
    setView('sources');
  }

  const updateSummary=()=>{
    const summary=layout?.querySelector('.audio-workspace-summary');
    const status=document.getElementById('audioStatus')?.textContent?.trim();
    const size=document.getElementById('audioSize')?.textContent?.trim();
    if(summary)summary.textContent=[status,size].filter(Boolean).join(' · ')||'Ses çalışma alanı';
  };
  updateSummary();
  const statusNode=document.getElementById('audioStatus');
  const sizeNode=document.getElementById('audioSize');
  const observer=new MutationObserver(updateSummary);
  if(statusNode)observer.observe(statusNode,{childList:true,subtree:true,characterData:true});
  if(sizeNode)observer.observe(sizeNode,{childList:true,subtree:true,characterData:true});
}
