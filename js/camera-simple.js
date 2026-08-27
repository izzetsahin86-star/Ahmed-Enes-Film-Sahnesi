const $ = (selector, root = document) => root.querySelector(selector);

const cssHref = './camera-simple.css';
if (!document.querySelector(`link[href="${cssHref}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;
  document.head.append(link);
}

const stageColumn = $('.camera-stage-column');
const dock = $('#timelineDock');
const collapseButton = $('#collapseTimelineBtn');
const captureButton = $('#captureBtn');
const playButton = $('#playBtn');
const onionInput = $('#onionInput');
const timerButton = $('#timerBtn');
const intervalSelect = $('#intervalSelect');
const intervalStartButton = $('#intervalStartBtn');
const cameraToggleButton = $('#cameraToggleBtn');
const switchCameraButton = $('#switchCameraBtn');
const toastElement = $('#toast');
const video = $('#cameraVideo');

let photoMode = 'photo';
let torchOn = false;
let toastTimer = 0;

const ICONS = {
  play: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/></svg>',
  pause: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6v12M16 6v12"/></svg>',
  onion: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="12" r="6"/><circle cx="14" cy="12" r="6"/></svg>',
  timer: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="13" r="7"/><path d="M9 3h6M12 6v2M12 13l3-2"/></svg>',
  torch: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 2 6.8 13h5L10.5 22 17.2 11h-5z"/></svg>',
  switch: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h10l-2.5-2.5M17 17H7l2.5 2.5M19 7a7.5 7.5 0 0 1 1 5M5 17a7.5 7.5 0 0 1-1-5"/></svg>',
  gallery: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="m6.5 17 4-4 3 3 2-2 2.5 3"/></svg>',
  panel: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 14 5-5 5 5"/></svg>'
};

function toast(message) {
  if (!toastElement) return;
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.add('show');
  toastTimer = setTimeout(() => toastElement.classList.remove('show'), 2800);
}

function tapFeedback(duration = 8) {
  try { navigator.vibrate?.(duration); } catch {}
}

function iconButton(className, label, iconName) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = ICONS[iconName] || '';
  return button;
}

function buildUi() {
  if (!stageColumn || $('.simple-camera-ui')) return;

  const ui = document.createElement('div');
  ui.className = 'simple-camera-ui';
  ui.innerHTML = `
    <div class="simple-top-controls simple-top-controls-no-left">
      <button class="simple-square-button simple-play" type="button" aria-label="Oynat" title="Oynat">${ICONS.play}</button>
    </div>
    <div class="simple-tool-rail" aria-label="Hızlı kamera araçları"></div>
    <div class="simple-capture-zone">
      <div class="simple-mode-switch" role="tablist" aria-label="Çekim modu">
        <button class="active" data-simple-mode="photo" type="button">Fotoğraf</button>
        <button data-simple-mode="interval" type="button">Interval</button>
      </div>
      <div class="simple-capture-row">
        <button class="simple-gallery-button" type="button" aria-label="Kareleri aç" title="Kareler">${ICONS.gallery}</button>
        <button class="simple-shutter" type="button" aria-label="Kare çek" title="Kare çek"><span></span></button>
        <button class="simple-panel-button" type="button" aria-label="Araç paneli" title="Araç paneli">${ICONS.panel}</button>
      </div>
    </div>
  `;

  const rail = $('.simple-tool-rail', ui);
  const onion = iconButton('simple-tool-button', 'Onion Skin', 'onion');
  onion.dataset.simpleTool = 'onion';
  const timer = iconButton('simple-tool-button', 'Sayaç', 'timer');
  timer.dataset.simpleTool = 'timer';
  const torch = iconButton('simple-tool-button', 'Flaş / ışık', 'torch');
  torch.dataset.simpleTool = 'torch';
  const switchCam = iconButton('simple-tool-button', 'Kamera değiştir', 'switch');
  switchCam.dataset.simpleTool = 'switch';
  rail.append(onion, timer, torch, switchCam);

  stageColumn.append(ui);
  wireUi(ui);
  syncUi(ui);
}

function wireUi(ui) {
  $('.simple-play', ui)?.addEventListener('click', () => {
    tapFeedback();
    playButton?.click();
  });
  $('.simple-gallery-button', ui)?.addEventListener('click', () => {
    tapFeedback();
    openDock('frames');
  });
  $('.simple-panel-button', ui)?.addEventListener('click', () => {
    tapFeedback();
    if (dock?.classList.contains('collapsed')) openDock('shoot');
    else collapseButton?.click();
  });

  $('.simple-shutter', ui)?.addEventListener('click', () => {
    tapFeedback(14);
    if (photoMode === 'interval') {
      if (!cameraToggleButton?.classList.contains('active')) {
        cameraToggleButton?.click();
        toast('Kamera açılıyor. Interval için tekrar deklanşöre dokun.');
        return;
      }
      if (Number(intervalSelect?.value || 0) <= 0) {
        intervalSelect.value = '2';
        intervalSelect.dispatchEvent(new Event('change', { bubbles: true }));
      }
      intervalStartButton?.click();
    } else {
      if (!cameraToggleButton?.classList.contains('active')) {
        cameraToggleButton?.click();
        toast('Kamera açılıyor. Hazır olduğunda tekrar çek.');
        return;
      }
      captureButton?.click();
    }
    requestAnimationFrame(() => syncUi(ui));
  });

  ui.querySelectorAll('[data-simple-mode]').forEach(button => {
    button.addEventListener('click', () => {
      tapFeedback();
      photoMode = button.dataset.simpleMode;
      ui.querySelectorAll('[data-simple-mode]').forEach(item => item.classList.toggle('active', item === button));
      syncUi(ui);
    });
  });

  ui.querySelectorAll('[data-simple-tool]').forEach(button => {
    button.addEventListener('click', async () => {
      tapFeedback();
      const tool = button.dataset.simpleTool;
      if (tool === 'onion') {
        const current = Number(onionInput?.value || 0);
        if (current > 0) {
          onionInput.dataset.simplePrevious = String(current);
          onionInput.value = '0';
        } else onionInput.value = onionInput.dataset.simplePrevious || '35';
        onionInput.dispatchEvent(new Event('input', { bubbles: true }));
        onionInput.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tool === 'timer') {
        timerButton?.click();
      } else if (tool === 'switch') {
        if (!cameraToggleButton?.classList.contains('active')) return toast('Önce kamerayı aç.');
        switchCameraButton?.click();
      } else if (tool === 'torch') {
        await toggleTorch(button);
      }
      syncUi(ui);
    });
  });
}

async function toggleTorch(button) {
  const track = video?.srcObject?.getVideoTracks?.()[0];
  if (!track) return toast('Önce kamerayı aç.');
  let capabilities = {};
  try { capabilities = track.getCapabilities?.() || {}; } catch {}
  if (!capabilities.torch) return toast('Bu kamerada flaş / ışık kontrolü desteklenmiyor.');
  try {
    torchOn = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    button.classList.toggle('active', torchOn);
  } catch {
    torchOn = false;
    button.classList.remove('active');
    toast('Flaş / ışık bu cihazda açılamadı.');
  }
}

function openDock(name) {
  document.querySelector(`[data-dock-tab="${name}"]`)?.click();
}

function syncUi(ui = $('.simple-camera-ui')) {
  if (!ui) return;
  const panelOpen = Boolean(dock && !dock.classList.contains('collapsed'));
  document.body.classList.toggle('simple-panel-open', panelOpen);

  const playing = playButton?.textContent?.includes('❚');
  const playMirror = $('.simple-play', ui);
  if (playMirror) {
    playMirror.classList.toggle('active', playing);
    playMirror.innerHTML = playing ? ICONS.pause : ICONS.play;
  }

  ui.querySelector('[data-simple-tool="onion"]')?.classList.toggle('active', Number(onionInput?.value || 0) > 0);
  ui.querySelector('[data-simple-tool="timer"]')?.classList.toggle('active', Boolean(timerButton?.classList.contains('active')));

  const intervalRunning = intervalStartButton?.classList.contains('active');
  const shutter = $('.simple-shutter', ui);
  shutter?.classList.toggle('interval-active', photoMode === 'interval' && intervalRunning);
}

function makeDockMobileFirst() {
  if (!dock || !collapseButton) return;
  if (matchMedia('(max-width: 900px)').matches && !dock.classList.contains('collapsed')) collapseButton.click();
}

buildUi();
makeDockMobileFirst();
syncUi();

const observer = new MutationObserver(() => syncUi());
if (dock) observer.observe(dock, { attributes: true, attributeFilter: ['class'] });
if (playButton) observer.observe(playButton, { childList: true, subtree: true, characterData: true });
if (cameraToggleButton) observer.observe(cameraToggleButton, { attributes: true, attributeFilter: ['class'] });
if (intervalStartButton) observer.observe(intervalStartButton, { attributes: true, attributeFilter: ['class'] });
if (timerButton) observer.observe(timerButton, { attributes: true, attributeFilter: ['class'] });
onionInput?.addEventListener('input', () => syncUi());
intervalSelect?.addEventListener('change', () => syncUi());
window.addEventListener('resize', () => syncUi());
