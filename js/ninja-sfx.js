const $=(selector,root=document)=>root.querySelector(selector);

const STYLE='./ninja-sfx.css';
if(!document.querySelector(`link[href="${STYLE}"]`)){
  const link=document.createElement('link');
  link.rel='stylesheet';
  link.href=STYLE;
  document.head.append(link);
}

const LIBRARY=[
  {id:'ninja',label:'Ninja Hareketleri',icon:'🥷',effects:[
    ['sword_swing','Kılıç Savuruş','⚔'],['spin','Spin','◎'],['jump','Zıplama','↥'],['land','İniş','↧'],['dash','Hızlı Geçiş','➜'],['cloth','Kıyafet Hareketi','≈']
  ]},
  {id:'fight',label:'Dövüş',icon:'⚔',effects:[
    ['sword_clash','Kılıç Çarpışma','✦'],['punch','Yumruk','●'],['kick','Tekme','◆'],['block','Blok','▰'],['heavy_hit','Ağır Darbe','⬢'],['explosion','Patlama','✹']
  ]},
  {id:'element',label:'Element / Enerji',icon:'⚡',effects:[
    ['lightning','Yıldırım','ϟ'],['fire','Ateş','♨'],['ice','Buz','❄'],['energy_shot','Enerji Atışı','◉'],['energy_charge','Enerji Şarjı','◌'],['portal','Portal','◍'],['smoke','Duman','☁'],['magic','Güç Parlaması','✧']
  ]},
  {id:'world',label:'Ortam / Yaratık',icon:'◈',effects:[
    ['wind','Rüzgar','≈'],['footsteps','Adımlar','••'],['thunder','Gök Gürültüsü','☈'],['dragon','Ejderha Kükremesi','◖'],['alarm','Alarm','!']
  ]},
  {id:'lego',label:'LEGO / Mekanik',icon:'▦',effects:[
    ['lego_click','LEGO Klik','▣'],['brick_drop','Parça Düşme','◇'],['mechanism','Mekanizma','⚙'],['vehicle','Araç Motoru','▰'],['shutter_plus','Kamera','◉'],['beep_plus','Teknoloji Bip','⌁']
  ]}
];

const ALL=LIBRARY.flatMap(group=>group.effects.map(([id,name,icon])=>({id,name,icon,group:group.id})));

function setup(){
  const oldGrid=$('.sfx-grid');
  const soundInput=$('#soundFileInput');
  if(!oldGrid||!soundInput||$('.ninja-sfx-library'))return;

  const wrap=document.createElement('div');
  wrap.className='ninja-sfx-library';
  wrap.innerHTML=`
    <div class="ninja-sfx-toolbar">
      <div class="ninja-sfx-search"><span>⌕</span><input type="search" placeholder="Efekt ara…" aria-label="Efekt ara"></div>
      <div class="ninja-sfx-count"><strong>${ALL.length}</strong><span>özgün efekt</span></div>
    </div>
    <div class="ninja-sfx-chips" role="tablist" aria-label="Efekt kategorileri">
      <button class="active" data-filter="all" type="button">Tümü</button>
      ${LIBRARY.map(g=>`<button data-filter="${g.id}" type="button">${g.icon} ${g.label}</button>`).join('')}
    </div>
    <div class="ninja-sfx-groups"></div>
    <p class="ninja-sfx-note">Efektler telifli ses dosyaları değildir; uygulama içinde özgün olarak üretilir ve mevcut oynatma konumuna eklenir.</p>`;
  oldGrid.replaceWith(wrap);

  const groups=$('.ninja-sfx-groups',wrap);
  LIBRARY.forEach(group=>{
    const section=document.createElement('section');
    section.className='ninja-sfx-group';
    section.dataset.group=group.id;
    section.innerHTML=`<div class="ninja-sfx-group-title"><span>${group.icon}</span><strong>${group.label}</strong></div><div class="ninja-sfx-pads"></div>`;
    const pads=$('.ninja-sfx-pads',section);
    group.effects.forEach(([id,name,icon])=>{
      const button=document.createElement('button');
      button.type='button';
      button.className='ninja-sfx-pad';
      button.dataset.ninjaSfx=id;
      button.dataset.search=name.toLocaleLowerCase('tr-TR');
      button.innerHTML=`<span class="ninja-sfx-icon">${icon}</span><span class="ninja-sfx-copy"><b>${name}</b><small>Dokun ve ekle</small></span><span class="ninja-sfx-add">＋</span>`;
      button.addEventListener('click',()=>addGeneratedEffect(id,name,soundInput,button));
      pads.append(button);
    });
    groups.append(section);
  });

  const search=$('input[type="search"]',wrap);
  const chips=[...wrap.querySelectorAll('[data-filter]')];
  let filter='all';
  const apply=()=>{
    const q=search.value.trim().toLocaleLowerCase('tr-TR');
    wrap.querySelectorAll('.ninja-sfx-group').forEach(section=>{
      let visible=0;
      section.querySelectorAll('.ninja-sfx-pad').forEach(button=>{
        const categoryOk=filter==='all'||section.dataset.group===filter;
        const searchOk=!q||button.dataset.search.includes(q);
        button.hidden=!(categoryOk&&searchOk);
        if(!button.hidden)visible++;
      });
      section.hidden=visible===0;
    });
  };
  chips.forEach(chip=>chip.addEventListener('click',()=>{
    filter=chip.dataset.filter;
    chips.forEach(item=>item.classList.toggle('active',item===chip));
    apply();
  }));
  search.addEventListener('input',apply);
}

async function addGeneratedEffect(id,name,input,button){
  if(button.disabled)return;
  button.disabled=true;
  button.classList.add('adding');
  const original=button.querySelector('small')?.textContent||'';
  const small=button.querySelector('small');
  if(small)small.textContent='Üretiliyor…';
  try{
    const wav=createEffectWav(id);
    const file=new File([wav],`${safeName(name)}.wav`,{type:'audio/wav',lastModified:Date.now()});
    if(typeof DataTransfer==='undefined')throw new Error('Bu tarayıcı otomatik ses eklemeyi desteklemiyor.');
    const transfer=new DataTransfer();
    transfer.items.add(file);
    input.files=transfer.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    button.classList.add('added');
    setTimeout(()=>button.classList.remove('added'),700);
    try{navigator.vibrate?.(12)}catch{}
  }catch(error){
    console.warn('Efekt eklenemedi',error);
    const toast=$('#toast');
    if(toast){toast.textContent=error.message||'Efekt eklenemedi.';toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2800)}
  }finally{
    button.disabled=false;
    button.classList.remove('adding');
    if(small)small.textContent=original;
  }
}

function createEffectWav(id){
  const sr=22050;
  const d=effectDuration(id);
  const n=Math.max(1,Math.floor(sr*d));
  const data=new Float32Array(n);
  let seed=hash(id);
  const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296*2-1};
  const env=(t,attack=.01,power=2)=>Math.min(1,t/attack)*Math.pow(Math.max(0,1-t/d),power);
  const sine=(f,t)=>Math.sin(Math.PI*2*f*t);
  const sweep=(f1,f2,t)=>sine(f1+(f2-f1)*(t/d),t);
  const noise=t=>rnd()*env(t,.004,1.5);

  for(let i=0;i<n;i++){
    const t=i/sr;
    let x=0;
    switch(id){
      case 'sword_swing': x=(noise(t)*.42+sweep(220,2400,t)*.16)*Math.sin(Math.PI*t/d); break;
      case 'spin': x=(noise(t)*.28+sweep(160,1800,t)*.18+sine(95+90*t/d,t)*.10)*Math.sin(Math.PI*t/d); break;
      case 'jump': x=sweep(180,720,t)*.5*env(t,.015,1.8); break;
      case 'land': x=(sine(72,t)*.65+noise(t)*.28)*env(t,.002,4); break;
      case 'dash': x=(noise(t)*.46+sweep(380,2100,t)*.13)*Math.sin(Math.PI*t/d); break;
      case 'cloth': x=noise(t)*.32*Math.sin(Math.PI*t/d)*(.6+.4*sine(9,t)); break;
      case 'sword_clash': x=(sine(1480,t)*.34+sine(2190,t)*.22+sine(3110,t)*.14+noise(t)*.25)*env(t,.001,3); break;
      case 'punch': x=(sine(105,t)*.55+noise(t)*.38)*env(t,.001,5); break;
      case 'kick': x=(sine(76,t)*.62+sine(145,t)*.22+noise(t)*.30)*env(t,.001,4); break;
      case 'block': x=(sine(620,t)*.30+sine(1040,t)*.20+noise(t)*.28)*env(t,.001,5); break;
      case 'heavy_hit': x=(sine(48,t)*.72+sine(92,t)*.26+noise(t)*.34)*env(t,.001,3); break;
      case 'explosion': x=(noise(t)*.66+sine(48,t)*.44)*env(t,.001,2.4); break;
      case 'lightning': x=(noise(t)*(.45+.35*Math.abs(sine(43,t)))+sine(120,t)*.15)*env(t,.001,1.3); break;
      case 'fire': x=(noise(t)*.28+Math.max(0,rnd())*.18)*env(t,.02,1.1); break;
      case 'ice': x=(sine(2100,t)*.24+sine(3300,t)*.18+sweep(3900,900,t)*.16+noise(t)*.12)*env(t,.001,2); break;
      case 'energy_shot': x=(sweep(1150,180,t)*.48+sine(72,t)*.22)*env(t,.003,2.5); break;
      case 'energy_charge': x=(sweep(90,760,t)*.34+sine(180,t)*.16+noise(t)*.08)*Math.pow(Math.min(1,t/(d*.7)),1.2)*(1-t/d*.45); break;
      case 'portal': x=(sine(120+45*sine(5,t),t)*.30+sine(310+90*sine(7,t),t)*.16+noise(t)*.09)*Math.sin(Math.PI*t/d); break;
      case 'smoke': x=noise(t)*.23*Math.sin(Math.PI*t/d); break;
      case 'magic': x=(sine(523,t)+sine(659,t)*.75+sine(784,t)*.55)*.15*env(t,.02,1.7); break;
      case 'wind': x=noise(t)*.26*Math.sin(Math.PI*t/d)*(.65+.35*sine(3.5,t)); break;
      case 'footsteps': {const hit=(p)=>Math.exp(-Math.pow((t-p)/.028,2));x=(sine(85,t)*.36+noise(t)*.24)*(hit(.08)+hit(.32)+hit(.56));break;}
      case 'thunder': x=(noise(t)*.48+sine(42,t)*.38+sine(61,t)*.18)*env(t,.005,1.35); break;
      case 'dragon': x=(sine(54+12*sine(4,t),t)*.44+sine(83+18*sine(3.2,t),t)*.24+noise(t)*.20)*Math.sin(Math.PI*t/d); break;
      case 'alarm': x=sine((Math.floor(t/.16)%2)?760:980,t)*.38*env(t,.002,.7); break;
      case 'lego_click': x=(sine(1250,t)*.30+sine(2100,t)*.16+noise(t)*.26)*env(t,.001,8); break;
      case 'brick_drop': x=((sine(520,t)*.24+noise(t)*.25)*Math.exp(-t*28))+((sine(120,t)*.35+noise(t)*.18)*Math.exp(-Math.max(0,t-.08)*18)*(t>.08)); break;
      case 'mechanism': x=(sine(165+35*sine(28,t),t)*.22+sine(330,t)*.10+noise(t)*.05)*env(t,.01,1.2); break;
      case 'vehicle': x=(sine(76+18*sine(9,t),t)*.34+sine(152,t)*.16+noise(t)*.07)*Math.sin(Math.PI*t/d); break;
      case 'shutter_plus': x=((noise(t)*.35+sine(1500,t)*.20)*Math.exp(-t*55))+((noise(t)*.30+sine(1100,t)*.18)*Math.exp(-Math.max(0,t-.08)*55)*(t>.08)); break;
      case 'beep_plus': x=sine(920,t)*.34*env(t,.004,2); break;
      default: x=sine(440,t)*.25*env(t,.005,2);
    }
    data[i]=softClip(x);
  }
  return pcm16Wav(data,sr);
}

function effectDuration(id){
  return ({
    sword_swing:.42,spin:.78,jump:.34,land:.28,dash:.38,cloth:.46,
    sword_clash:.34,punch:.18,kick:.25,block:.20,heavy_hit:.48,explosion:.95,
    lightning:.72,fire:1.05,ice:.68,energy_shot:.48,energy_charge:1.15,portal:1.25,smoke:.9,magic:.82,
    wind:1.2,footsteps:.72,thunder:1.3,dragon:1.45,alarm:.82,
    lego_click:.12,brick_drop:.34,mechanism:.85,vehicle:1.15,shutter_plus:.20,beep_plus:.22
  })[id]||.4;
}

function pcm16Wav(samples,sampleRate){
  const bytes=44+samples.length*2;
  const buffer=new ArrayBuffer(bytes);
  const view=new DataView(buffer);
  writeText(view,0,'RIFF'); view.setUint32(4,bytes-8,true); writeText(view,8,'WAVE');
  writeText(view,12,'fmt '); view.setUint32(16,16,true); view.setUint16(20,1,true); view.setUint16(22,1,true);
  view.setUint32(24,sampleRate,true); view.setUint32(28,sampleRate*2,true); view.setUint16(32,2,true); view.setUint16(34,16,true);
  writeText(view,36,'data'); view.setUint32(40,samples.length*2,true);
  let offset=44;
  for(const sample of samples){view.setInt16(offset,Math.round(Math.max(-1,Math.min(1,sample))*32767),true);offset+=2;}
  return new Blob([buffer],{type:'audio/wav'});
}
function writeText(view,offset,text){for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i))}
function softClip(x){return Math.tanh(x*1.25)*.82}
function hash(text){let h=2166136261;for(const ch of text){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function safeName(name){return name.toLocaleLowerCase('tr-TR').replace(/[^a-z0-9çğıöşü]+/gi,'-').replace(/^-|-$/g,'')||'efekt'}

setup();
