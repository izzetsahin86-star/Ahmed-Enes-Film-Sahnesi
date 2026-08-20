// Video içe aktarma: mevcut fotoğraf/kare motorunu kullanarak videoyu proje FPS'inde karelere dönüştürür.
const importPhotosBtn = document.getElementById('importPhotosBtn');
const photoImportInput = document.getElementById('photoImportInput');
const timelineTrack = document.getElementById('timelineTrack');
const fpsInput = document.getElementById('fpsInput');
const toast = document.getElementById('toast');

const MAX_FRAMES = 600;
const BATCH_SIZE = 12;
const MAX_EDGE = 1280;
let picker = null;
let overlay = null;
let video = null;
let canvas = null;
let selectedFile = null;
let videoUrl = '';
let processing = false;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function projectFps() {
  return Math.max(1, Number(fpsInput?.value) || 5);
}

function formatTime(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const min = Math.floor(seconds / 60);
  const sec = seconds - min * 60;
  return min ? `${min}:${sec.toFixed(1).padStart(4, '0')}` : `${sec.toFixed(1)} sn`;
}

function buildButton() {
  if (!importPhotosBtn || document.getElementById('videoImportBtn')) return;
  const button = document.createElement('button');
  button.className = 'panel-btn video-import-launch';
  button.id = 'videoImportBtn';
  button.type = 'button';
  button.innerHTML = '<span>▶</span>Video';
  importPhotosBtn.insertAdjacentElement('afterend', button);
  button.addEventListener('click', () => picker?.click());
}

function buildUi() {
  if (!photoImportInput || overlay) return;

  picker = document.createElement('input');
  picker.id = 'videoImportInput';
  picker.type = 'file';
  picker.accept = 'video/*';
  picker.hidden = true;
  document.body.append(picker);

  overlay = document.createElement('div');
  overlay.className = 'video-import-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Video ekle');
  overlay.innerHTML = `
    <div class="video-import-sheet">
      <div class="video-import-head">
        <div><small>VİDEO → KARELER</small><strong>Video Ekle</strong></div>
        <button type="button" class="video-import-close" aria-label="Kapat">×</button>
      </div>
      <div class="video-import-body">
        <div class="video-import-preview-wrap">
          <video class="video-import-preview" muted playsinline controls preload="metadata"></video>
          <div class="video-import-meta">
            <strong id="videoImportName">Video seçilmedi</strong>
            <span id="videoImportInfo">—</span>
          </div>
        </div>
        <div class="video-import-settings">
          <div class="video-import-fps-card"><span>Aktarım hızı</span><strong id="videoImportFps">5 FPS</strong><small>Proje FPS'i ile aynı; video normal hızında kalır.</small></div>
          <div class="video-import-trim">
            <label><span>Başlangıç</span><input id="videoImportStart" type="number" min="0" step="0.1" value="0"></label>
            <label><span>Bitiş</span><input id="videoImportEnd" type="number" min="0" step="0.1" value="0"></label>
          </div>
          <div class="video-import-estimate">
            <div><span>Tahmini kare</span><strong id="videoImportFrames">0 kare</strong></div>
            <div><span>Aktarılacak süre</span><strong id="videoImportDuration">0.0 sn</strong></div>
          </div>
          <div class="video-import-warning" id="videoImportWarning" hidden></div>
          <p class="video-import-note">Video görüntüsü mevcut kare sistemine eklenir. Bu sürüm videonun ses kanalını otomatik aktarmıyor; ses sistemi ayrı çalışmaya devam eder.</p>
        </div>
      </div>
      <div class="video-import-progress" id="videoImportProgress" hidden>
        <div><span id="videoImportProgressText">Hazırlanıyor…</span><strong id="videoImportProgressPct">0%</strong></div>
        <progress max="100" value="0"></progress>
      </div>
      <div class="video-import-actions">
        <button type="button" class="video-import-cancel">İptal</button>
        <button type="button" class="video-import-confirm" disabled>Karelere Dönüştür</button>
      </div>
    </div>`;
  document.body.append(overlay);

  video = overlay.querySelector('.video-import-preview');
  canvas = document.createElement('canvas');
  const close = overlay.querySelector('.video-import-close');
  const cancel = overlay.querySelector('.video-import-cancel');
  const confirm = overlay.querySelector('.video-import-confirm');
  const start = overlay.querySelector('#videoImportStart');
  const end = overlay.querySelector('#videoImportEnd');

  close.addEventListener('click', closeEditor);
  cancel.addEventListener('click', closeEditor);
  overlay.addEventListener('click', event => { if (event.target === overlay) closeEditor(); });
  start.addEventListener('input', updateEstimate);
  end.addEventListener('input', updateEstimate);
  start.addEventListener('change', () => seekPreview(Number(start.value) || 0));
  end.addEventListener('change', updateEstimate);
  confirm.addEventListener('click', importVideoFrames);
  picker.addEventListener('change', () => openVideo(picker.files?.[0]));
}

function openOverlay() {
  overlay?.classList.add('show');
  document.body.classList.add('video-import-open');
}

function closeEditor() {
  if (processing) return;
  overlay?.classList.remove('show');
  document.body.classList.remove('video-import-open');
  if (video) {
    try { video.pause(); } catch {}
    video.removeAttribute('src');
    video.load();
  }
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = '';
  selectedFile = null;
  if (picker) picker.value = '';
}

async function openVideo(file) {
  if (!file || !file.type.startsWith('video/')) return;
  selectedFile = file;
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = URL.createObjectURL(file);
  openOverlay();
  video.src = videoUrl;
  video.load();
  try {
    if (video.readyState < 1) await waitEvent(video, 'loadedmetadata', 12000);
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration) throw new Error('Video süresi okunamadı.');
    const start = overlay.querySelector('#videoImportStart');
    const end = overlay.querySelector('#videoImportEnd');
    start.value = '0'; start.max = String(duration);
    end.value = String(Number(duration.toFixed(2))); end.max = String(duration);
    overlay.querySelector('#videoImportName').textContent = file.name || 'Video';
    overlay.querySelector('#videoImportInfo').textContent = `${video.videoWidth || 0}×${video.videoHeight || 0} · ${formatTime(duration)}`;
    updateEstimate();
  } catch (error) {
    showToast(error.message || 'Video açılamadı.');
    closeEditor();
  }
}

function readRange() {
  const duration = Math.max(0, Number(video?.duration) || 0);
  const startEl = overlay.querySelector('#videoImportStart');
  const endEl = overlay.querySelector('#videoImportEnd');
  let start = Math.max(0, Math.min(duration, Number(startEl.value) || 0));
  let end = Math.max(0, Math.min(duration, Number(endEl.value) || duration));
  if (end < start) [start, end] = [end, start];
  return { start, end, duration: Math.max(0, end - start) };
}

function updateEstimate() {
  if (!overlay || !video) return;
  const fps = projectFps();
  const range = readRange();
  const count = Math.max(0, Math.ceil(range.duration * fps));
  overlay.querySelector('#videoImportFps').textContent = `${fps} FPS`;
  overlay.querySelector('#videoImportFrames').textContent = `${count} kare`;
  overlay.querySelector('#videoImportDuration').textContent = formatTime(range.duration);
  const warning = overlay.querySelector('#videoImportWarning');
  const confirm = overlay.querySelector('.video-import-confirm');
  if (count > MAX_FRAMES) {
    warning.hidden = false;
    warning.textContent = `Bu seçim ${count} kare oluşturuyor. Telefonda kararlı çalışması için tek aktarım en fazla ${MAX_FRAMES} kare. Başlangıç/bitişi kısalt.`;
    confirm.disabled = true;
  } else if (count < 1) {
    warning.hidden = false;
    warning.textContent = 'Aktarılacak bölüm en az bir kare oluşturmalı.';
    confirm.disabled = true;
  } else {
    warning.hidden = true;
    warning.textContent = '';
    confirm.disabled = false;
  }
}

async function seekPreview(time) {
  if (!video || !Number.isFinite(video.duration)) return;
  try { video.currentTime = Math.max(0, Math.min(video.duration - 0.001, time)); } catch {}
}

function waitEvent(target, name, timeout = 10000) {
  return new Promise((resolve, reject) => {
    let timer = 0;
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('Video okunurken zaman aşımı oluştu.')); };
    const cleanup = () => { clearTimeout(timer); target.removeEventListener(name, done); target.removeEventListener('error', fail); };
    target.addEventListener(name, done, { once: true });
    target.addEventListener('error', fail, { once: true });
    timer = setTimeout(fail, timeout);
  });
}

async function seekTo(time) {
  const maxTime = Math.max(0, (Number(video.duration) || 0) - 0.001);
  const target = Math.max(0, Math.min(maxTime, time));
  if (Math.abs(video.currentTime - target) < 0.002 && video.readyState >= 2) {
    await nextPaint();
    return;
  }
  const promise = waitEvent(video, 'seeked', 12000);
  video.currentTime = target;
  await promise;
  if (video.requestVideoFrameCallback) await new Promise(resolve => video.requestVideoFrameCallback(() => resolve()));
  else await nextPaint();
}

function nextPaint() {
  return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function setupCanvas() {
  const vw = Math.max(2, video.videoWidth || 1280);
  const vh = Math.max(2, video.videoHeight || 720);
  const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
  canvas.width = Math.max(2, Math.round(vw * scale));
  canvas.height = Math.max(2, Math.round(vh * scale));
}

function frameBlob() {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Video karesi oluşturulamadı.')), 'image/jpeg', 0.9);
  });
}

function frameCount() {
  return timelineTrack?.querySelectorAll('.frame-card').length || 0;
}

function waitForFrameCount(target, timeout = 60000) {
  if (frameCount() >= target) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let timer = 0;
    const observer = new MutationObserver(() => {
      if (frameCount() >= target) { cleanup(); resolve(); }
    });
    const cleanup = () => { clearTimeout(timer); observer.disconnect(); };
    observer.observe(timelineTrack, { childList: true });
    timer = setTimeout(() => { cleanup(); reject(new Error('Kareler projeye eklenirken zaman aşımı oluştu.')); }, timeout);
  });
}

async function pushBatch(files) {
  if (!files.length) return;
  const before = frameCount();
  const dt = new DataTransfer();
  files.forEach(file => dt.items.add(file));
  photoImportInput.files = dt.files;
  photoImportInput.dispatchEvent(new Event('change', { bubbles: true }));
  await waitForFrameCount(before + files.length);
  try { photoImportInput.value = ''; } catch {}
}

function setProgress(done, total, message) {
  const progressWrap = overlay.querySelector('#videoImportProgress');
  const progress = progressWrap.querySelector('progress');
  const pct = total ? Math.round(done / total * 100) : 0;
  progressWrap.hidden = false;
  progress.value = pct;
  overlay.querySelector('#videoImportProgressText').textContent = message || `Kareler hazırlanıyor ${done}/${total}`;
  overlay.querySelector('#videoImportProgressPct').textContent = `${pct}%`;
}

function setProcessing(active) {
  processing = active;
  overlay.classList.toggle('processing', active);
  overlay.querySelector('.video-import-close').disabled = active;
  overlay.querySelector('.video-import-cancel').disabled = active;
  overlay.querySelector('.video-import-confirm').disabled = active || !selectedFile;
  const launch = document.getElementById('videoImportBtn');
  if (launch) launch.disabled = active;
}

async function importVideoFrames() {
  if (processing || !selectedFile || !video) return;
  const fps = projectFps();
  const range = readRange();
  const total = Math.ceil(range.duration * fps);
  if (total < 1 || total > MAX_FRAMES) return updateEstimate();

  setProcessing(true);
  setupCanvas();
  const ctx = canvas.getContext('2d', { alpha: false });
  const baseName = (selectedFile.name || 'video').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').slice(0, 40) || 'video';
  let batch = [];

  try {
    video.pause();
    for (let i = 0; i < total; i += 1) {
      const time = Math.min(range.end - 0.001, range.start + i / fps);
      await seekTo(Math.max(range.start, time));
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await frameBlob();
      batch.push(new File([blob], `${baseName}-${String(i + 1).padStart(4, '0')}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
      setProgress(i + 1, total, `Video karelere ayrılıyor ${i + 1}/${total}`);

      if (batch.length >= BATCH_SIZE || i === total - 1) {
        setProgress(i + 1, total, `Projeye ekleniyor ${i + 1}/${total}`);
        await pushBatch(batch);
        batch = [];
      }
      if (i % 4 === 0) await new Promise(resolve => setTimeout(resolve, 0));
    }
    setProgress(total, total, `${total} kare projeye eklendi`);
    showToast(`${total} video karesi projeye eklendi.`);
    setTimeout(() => { setProcessing(false); closeEditor(); }, 650);
  } catch (error) {
    console.error('Video aktarım hatası', error);
    setProcessing(false);
    updateEstimate();
    showToast(error.message || 'Video projeye eklenemedi.');
  }
}

buildButton();
buildUi();
