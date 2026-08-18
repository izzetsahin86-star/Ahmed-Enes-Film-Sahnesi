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
const gridToggle = $('#gridToggle');
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

function toast(message) {
  if (!toastElement) return;
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.add('show');
  toastTimer = setTimeout(() => toastElement.classList.remove('show'), 2800);
}

function iconButton(className, label, icon) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = `<span aria-hidden="true">${icon}</span>`;
  return button;
}

function buildUi() {
  if (!stageColumn || $('.simple-camera-ui')) return;

  const ui = document.createElement('div');
  ui.className = 'simple-camera-ui';
  ui.innerHTML = `
    <div class="simple-top-controls">
      <button class="simple-square-button simple-close" type="button" aria-label="Kamerayı kapat" title="Kamerayı kapat"><span>×</span></button>
      <button class="simple-square-button simple-play" type="button" aria-label="Oynat" title="Oynat"><span>▶</span></button>
    </div>
    <div class="simple-tool-rail" aria-label="Hızlı kamera araçları"></div>
    <div class="simple-capture-zone">
      <div class="simple-mode-switch" role="tablist" aria-label="Çekim modu">
        <button class="active" data-simple-mode="photo" type="button">Fotoğraf</button>
        <button data-simple-mode="interval" type="button">Interval</button>
      </div>
      <div class="simple-capture-row">
        <button class="simple-gallery-button" type="button" aria-label="Kareleri aç" title="Kareler"><span>▧</span></button>
        <button class="simple-shutter" type="button" aria-label="Kare çek" title="Kare çek"><span></span></button>
        <button class="simple-panel-button" type="button" aria-label="Araç paneli" title="Araç paneli"><span>⌃</span></button>
      </div>
      <div class="simple-capture-caption"><span id="simpleCaptureStatus">Kamera hazır</span></div>
    </div>
  `;

  const rail = $('.simple-tool-rail', ui);
  const onion = iconButton('simple-tool-button', 'Onion Skin', '◉');
  onion.dataset.simpleTool = 'onion';
  const grid = iconButton('simple-tool-button', 'Izgara', '#');
  grid.dataset.simpleTool = 'grid';
  const timer = iconButton('simple-tool-button', 'Sayaç', '◷');
  timer.dataset.simpleTool = 'timer';
  const torch = iconButton('simple-tool-button', 'Flaş / ışık', 'ϟ');
  torch.dataset.simpleTool = 'torch';
  const switchCam = iconButton('simple-tool-button', 'Kamera değiştir', '↻');
  switchCam.dataset.simpleTool = 'switch';
  rail.append(onion, grid, timer, torch, switchCam);

  stageColumn.append(ui);
  wireUi(ui);
  syncUi(ui);
}

function wireUi(ui) {
  $('.simple-close', ui)?.addEventListener('click', () => {
    if (cameraToggleButton?.classList.contains('active')) cameraToggleButton.click();
    else if (!dock?.classList.contains('collapsed')) collapseButton?.click();
  });

  $('.simple-play', ui)?.addEventListener('click', () => playButton?.click());
  $('.simple-gallery-button', ui)?.addEventListener('click', () => openDock('frames'));
  $('.simple-panel-button', ui)?.addEventListener('click', () => {
    if (dock?.classList.contains('collapsed')) openDock('shoot');
    else collapseButton?.click();
  });

  $('.simple-shutter', ui)?.addEventListener('click', () => {
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
      photoMode = button.dataset.simpleMode;
      ui.querySelectorAll('[data-simple-mode]').forEach(item => item.classList.toggle('active', item === button));
      syncUi(ui);
    });
  });

  ui.querySelectorAll('[data-simple-tool]').forEach(button => {
    button.addEventListener('click', async () => {
      const tool = button.dataset.simpleTool;
      if (tool === 'grid') {
        gridToggle.checked = !gridToggle.checked;
        gridToggle.dispatchEvent(new Event('change', { bubbles: true }));
      } else if (tool === 'onion') {
        const current = Number(onionInput.value || 0);
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
  if (!capabilities.torch) return toast('Bu kamerada flaş/ışık kontrolü desteklenmiyor.');
  try {
    torchOn = !torchOn;
    await track.applyConstraints({ advanced: [{ torch: torchOn }] });
    button.classList.toggle('active', torchOn);
  } catch {
    torchOn = false;
    button.classList.remove('active');
    toast('Flaş/ışık bu cihazda açılamadı.');
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
    playMirror.querySelector('span').textContent = playing ? 'Ⅱ' : '▶';
  }

  ui.querySelector('[data-simple-tool="grid"]')?.classList.toggle('active', Boolean(gridToggle?.checked));
  ui.querySelector('[data-simple-tool="onion"]')?.classList.toggle('active', Number(onionInput?.value || 0) > 0);

  const intervalRunning = intervalStartButton?.classList.contains('active');
  const shutter = $('.simple-shutter', ui);
  shutter?.classList.toggle('interval-active', photoMode === 'interval' && intervalRunning);

  const status = $('#simpleCaptureStatus', ui);
  if (status) {
    if (photoMode === 'interval') status.textContent = intervalRunning ? `Interval aktif · ${intervalSelect?.value || 2} sn` : `Interval · ${intervalSelect?.value > 0 ? intervalSelect.value : 2} sn`;
    else status.textContent = cameraToggleButton?.classList.contains('active') ? 'Kare çekmeye hazır' : 'Deklanşöre dokununca kamera açılır';
  }
}

function makeDockMobileFirst() {
  if (!dock || !collapseButton) return;
  if (matchMedia('(max-width: 900px)').matches && !dock.classList.contains('collapsed')) {
    collapseButton.click();
  }
}

buildUi();
makeDockMobileFirst();
syncUi();

const observer = new MutationObserver(() => syncUi());
if (dock) observer.observe(dock, { attributes: true, attributeFilter: ['class'] });
if (playButton) observer.observe(playButton, { childList: true, subtree: true, characterData: true });
if (cameraToggleButton) observer.observe(cameraToggleButton, { attributes: true, attributeFilter: ['class'] });
if (intervalStartButton) observer.observe(intervalStartButton, { attributes: true, attributeFilter: ['class'] });

gridToggle?.addEventListener('change', () => syncUi());
onionInput?.addEventListener('input', () => syncUi());
intervalSelect?.addEventListener('change', () => syncUi());
window.addEventListener('resize', () => syncUi());
