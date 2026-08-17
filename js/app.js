import { CameraController } from './camera.js';
import { Timeline } from './timeline.js';
import { saveLocalProject, getLatestProject } from './project-store.js';

const $ = selector => document.querySelector(selector);
const els = {
  projectName: $('#projectName'),
  settingsBtn: $('#settingsBtn'),
  sidePanel: $('#sidePanel'),
  newProjectBtn: $('#newProjectBtn'),
  openProjectBtn: $('#openProjectBtn'),
  saveProjectBtn: $('#saveProjectBtn'),
  exportBtn: $('#exportBtn'),
  fpsInput: $('#fpsInput'),
  fpsValue: $('#fpsValue'),
  onionInput: $('#onionInput'),
  onionValue: $('#onionValue'),
  gridToggle: $('#gridToggle'),
  mirrorToggle: $('#mirrorToggle'),
  duplicateBtn: $('#duplicateBtn'),
  moveLeftBtn: $('#moveLeftBtn'),
  moveRightBtn: $('#moveRightBtn'),
  deleteFrameBtn: $('#deleteFrameBtn'),
  frameCount: $('#frameCount'),
  durationValue: $('#durationValue'),
  saveStatus: $('#saveStatus'),
  statusDot: $('#statusDot'),
  cameraStatus: $('#cameraStatus'),
  switchCameraBtn: $('#switchCameraBtn'),
  fullscreenBtn: $('#fullscreenBtn'),
  stage: $('#stage'),
  cameraVideo: $('#cameraVideo'),
  framePreview: $('#framePreview'),
  onionLayer: $('#onionLayer'),
  gridOverlay: $('#gridOverlay'),
  stageEmpty: $('#stageEmpty'),
  countdown: $('#countdown'),
  frameBadge: $('#frameBadge'),
  previousBtn: $('#previousBtn'),
  cameraToggleBtn: $('#cameraToggleBtn'),
  captureBtn: $('#captureBtn'),
  timerBtn: $('#timerBtn'),
  nextBtn: $('#nextBtn'),
  playBtn: $('#playBtn'),
  goStartBtn: $('#goStartBtn'),
  playbackPosition: $('#playbackPosition'),
  collapseTimelineBtn: $('#collapseTimelineBtn'),
  timelineDock: $('#timelineDock'),
  timelineBody: $('#timelineBody'),
  timelineTrack: $('#timelineTrack'),
  projectFileInput: $('#projectFileInput'),
  captureCanvas: $('#captureCanvas'),
  exportCanvas: $('#exportCanvas'),
  toast: $('#toast')
};

const camera = new CameraController(els.cameraVideo);
let project = createProject();
let selectedIndex = -1;
let timerEnabled = false;
let playing = false;
let playbackTimer = null;
let toastTimer = null;
let dirty = false;

const timeline = new Timeline(els.timelineTrack, {
  onSelect: index => selectFrame(index),
  onMove: (from, to) => moveFrame(from, to)
});

function createProject() {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: 'Yeni Film',
    fps: 12,
    onionOpacity: 35,
    grid: false,
    mirror: true,
    frames: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function markDirty() {
  dirty = true;
  els.saveStatus.textContent = 'Değişti';
}

function markSaved() {
  dirty = false;
  els.saveStatus.textContent = 'Kaydedildi';
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function syncControls() {
  project.name = els.projectName.value.trim() || 'Adsız Film';
  project.fps = Number(els.fpsInput.value);
  project.onionOpacity = Number(els.onionInput.value);
  project.grid = els.gridToggle.checked;
  project.mirror = els.mirrorToggle.checked;
  project.updatedAt = Date.now();

  els.fpsValue.textContent = String(project.fps);
  els.onionValue.textContent = `${project.onionOpacity}%`;
  els.gridOverlay.style.display = project.grid ? 'block' : 'none';
  els.cameraVideo.classList.toggle('mirrored', project.mirror);
  els.onionLayer.style.opacity = String(project.onionOpacity / 100);
  renderStats();
}

function loadProjectState(nextProject) {
  stopPlayback();
  project = {
    ...createProject(),
    ...nextProject,
    frames: Array.isArray(nextProject.frames) ? nextProject.frames : []
  };
  els.projectName.value = project.name || 'Adsız Film';
  els.fpsInput.value = String(project.fps || 12);
  els.onionInput.value = String(project.onionOpacity ?? 35);
  els.gridToggle.checked = Boolean(project.grid);
  els.mirrorToggle.checked = project.mirror !== false;
  selectedIndex = project.frames.length ? 0 : -1;
  syncControls();
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
  markSaved();
}

function renderStats() {
  const duration = project.frames.length / Math.max(1, project.fps);
  els.frameCount.textContent = String(project.frames.length);
  els.durationValue.textContent = `${duration.toFixed(1)} sn`;
  els.frameBadge.textContent = selectedIndex >= 0 ? `Kare ${selectedIndex + 1} / ${project.frames.length}` : 'Kare 0';
  els.playbackPosition.textContent = formatTime(selectedIndex >= 0 ? selectedIndex / project.fps : 0);
  const hasSelection = selectedIndex >= 0;
  els.duplicateBtn.disabled = !hasSelection;
  els.deleteFrameBtn.disabled = !hasSelection;
  els.moveLeftBtn.disabled = !hasSelection || selectedIndex <= 0;
  els.moveRightBtn.disabled = !hasSelection || selectedIndex >= project.frames.length - 1;
  els.previousBtn.disabled = !hasSelection || selectedIndex <= 0;
  els.nextBtn.disabled = !hasSelection || selectedIndex >= project.frames.length - 1;
  els.playBtn.disabled = project.frames.length === 0;
  els.exportBtn.disabled = project.frames.length === 0;
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, '0')}:${sec.toFixed(1).padStart(4, '0')}`;
}

function renderStage() {
  const selected = project.frames[selectedIndex];
  const previous = project.frames[selectedIndex - 1];
  if (playing || (!camera.active && selected)) {
    els.framePreview.src = selected?.dataUrl || '';
    els.framePreview.style.display = selected ? 'block' : 'none';
  } else {
    els.framePreview.style.display = 'none';
  }

  const onionSource = camera.active ? project.frames.at(-1) : previous;
  if (!playing && onionSource && project.onionOpacity > 0) {
    els.onionLayer.src = onionSource.dataUrl;
    els.onionLayer.style.display = 'block';
  } else {
    els.onionLayer.style.display = 'none';
  }

  els.stageEmpty.style.display = camera.active || selected ? 'none' : 'grid';
  renderStats();
}

function selectFrame(index) {
  if (index < 0 || index >= project.frames.length) return;
  stopPlayback();
  selectedIndex = index;
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
}

function addFrame(dataUrl) {
  const frame = { id: crypto.randomUUID(), dataUrl, createdAt: Date.now() };
  project.frames.push(frame);
  selectedIndex = project.frames.length - 1;
  project.updatedAt = Date.now();
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
  markDirty();
}

function duplicateSelected() {
  const source = project.frames[selectedIndex];
  if (!source) return;
  project.frames.splice(selectedIndex + 1, 0, { ...source, id: crypto.randomUUID(), createdAt: Date.now() });
  selectedIndex += 1;
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
  markDirty();
}

function deleteSelected() {
  if (selectedIndex < 0) return;
  project.frames.splice(selectedIndex, 1);
  selectedIndex = Math.min(selectedIndex, project.frames.length - 1);
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
  markDirty();
}

function moveFrame(from, to) {
  if (from < 0 || to < 0 || from >= project.frames.length || to >= project.frames.length) return;
  const [frame] = project.frames.splice(from, 1);
  project.frames.splice(to, 0, frame);
  selectedIndex = to;
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
  markDirty();
}

async function toggleCamera() {
  if (camera.active) {
    await camera.stop();
    els.cameraToggleBtn.textContent = 'Kamerayı Aç';
    els.cameraStatus.textContent = 'Kamera kapalı';
    els.statusDot.classList.remove('live');
    renderStage();
    return;
  }
  try {
    await camera.start();
    els.cameraToggleBtn.textContent = 'Kamerayı Kapat';
    els.cameraStatus.textContent = 'Kamera hazır';
    els.statusDot.classList.add('live');
    renderStage();
  } catch (error) {
    showToast(`Kamera açılamadı: ${error.message}`);
  }
}

async function captureFrame() {
  if (!camera.active) {
    showToast('Önce kamerayı aç.');
    return;
  }
  if (timerEnabled) await runCountdown(3);
  try {
    const dataUrl = camera.capture(els.captureCanvas, project.mirror);
    addFrame(dataUrl);
    flashCapture();
  } catch (error) {
    showToast(error.message);
  }
}

function runCountdown(seconds) {
  return new Promise(resolve => {
    let value = seconds;
    els.countdown.style.display = 'grid';
    els.countdown.textContent = String(value);
    const id = setInterval(() => {
      value -= 1;
      if (value <= 0) {
        clearInterval(id);
        els.countdown.style.display = 'none';
        resolve();
      } else {
        els.countdown.textContent = String(value);
      }
    }, 1000);
  });
}

function flashCapture() {
  els.stage.animate([{ filter: 'brightness(1)' }, { filter: 'brightness(2.1)' }, { filter: 'brightness(1)' }], { duration: 180 });
}

function play() {
  if (!project.frames.length) return;
  if (playing) {
    stopPlayback();
    return;
  }
  playing = true;
  els.playBtn.textContent = '❚❚';
  let index = selectedIndex >= 0 ? selectedIndex : 0;
  const step = () => {
    selectedIndex = index;
    timeline.setFrames(project.frames, selectedIndex);
    renderStage();
    index += 1;
    if (index >= project.frames.length) index = 0;
  };
  step();
  playbackTimer = setInterval(step, 1000 / Math.max(1, project.fps));
}

function stopPlayback() {
  if (playbackTimer) clearInterval(playbackTimer);
  playbackTimer = null;
  playing = false;
  els.playBtn.textContent = '▶';
  renderStage();
}

async function saveProject() {
  syncControls();
  try {
    await saveLocalProject(project);
    markSaved();
    const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
    downloadBlob(blob, `${safeFileName(project.name)}.aefs.json`);
    showToast('Proje tarayıcıya kaydedildi ve proje dosyası indirildi.');
  } catch (error) {
    showToast(`Kaydetme hatası: ${error.message}`);
  }
}

function openProjectFile() {
  els.projectFileInput.value = '';
  els.projectFileInput.click();
}

async function handleProjectFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.frames)) throw new Error('Geçersiz proje dosyası.');
    loadProjectState(parsed);
    await saveLocalProject(project);
    showToast('Proje açıldı.');
  } catch (error) {
    showToast(`Proje açılamadı: ${error.message}`);
  }
}

function newProject() {
  if (dirty && !confirm('Kaydedilmemiş değişiklikler var. Yeni projeye geçilsin mi?')) return;
  loadProjectState(createProject());
  showToast('Yeni proje oluşturuldu.');
}

async function exportVideo() {
  if (!project.frames.length) return;
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    showToast('Bu tarayıcı doğrudan WebM video dışa aktarmayı desteklemiyor.');
    return;
  }
  const supported = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => window.MediaRecorder.isTypeSupported(type));
  if (!supported) {
    showToast('Bu tarayıcı doğrudan WebM video dışa aktarmayı desteklemiyor.');
    return;
  }

  els.exportBtn.disabled = true;
  els.exportBtn.textContent = 'Hazırlanıyor…';
  try {
    const first = await loadImage(project.frames[0].dataUrl);
    const canvas = els.exportCanvas;
    canvas.width = first.naturalWidth || first.width;
    canvas.height = first.naturalHeight || first.height;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(project.fps);
    const recorder = new MediaRecorder(stream, { mimeType: supported, videoBitsPerSecond: 8_000_000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise(resolve => recorder.onstop = resolve);
    recorder.start();

    const frameMs = 1000 / project.fps;
    for (const frame of project.frames) {
      const image = await loadImage(frame.dataUrl);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      await delay(frameMs);
    }
    await delay(frameMs);
    recorder.stop();
    await stopped;
    downloadBlob(new Blob(chunks, { type: supported }), `${safeFileName(project.name)}.webm`);
    showToast('Video hazırlandı.');
  } catch (error) {
    showToast(`Video oluşturulamadı: ${error.message}`);
  } finally {
    els.exportBtn.disabled = project.frames.length === 0;
    els.exportBtn.textContent = 'Video';
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Kare okunamadı.'));
    img.src = src;
  });
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function safeFileName(value) { return (value || 'film').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80); }
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

els.settingsBtn.addEventListener('click', () => els.sidePanel.classList.toggle('open'));
els.newProjectBtn.addEventListener('click', newProject);
els.openProjectBtn.addEventListener('click', openProjectFile);
els.saveProjectBtn.addEventListener('click', saveProject);
els.exportBtn.addEventListener('click', exportVideo);
els.projectFileInput.addEventListener('change', event => handleProjectFile(event.target.files?.[0]));
els.cameraToggleBtn.addEventListener('click', toggleCamera);
els.captureBtn.addEventListener('click', captureFrame);
els.switchCameraBtn.addEventListener('click', async () => {
  if (!camera.active) return showToast('Önce kamerayı aç.');
  try { await camera.switchCamera(); syncControls(); showToast('Kamera değiştirildi.'); } catch (error) { showToast(error.message); }
});
els.fullscreenBtn.addEventListener('click', () => els.stage.requestFullscreen?.());
els.timerBtn.addEventListener('click', () => {
  timerEnabled = !timerEnabled;
  els.timerBtn.classList.toggle('active', timerEnabled);
  els.timerBtn.setAttribute('aria-pressed', String(timerEnabled));
});
els.fpsInput.addEventListener('input', () => { syncControls(); markDirty(); });
els.onionInput.addEventListener('input', () => { syncControls(); renderStage(); markDirty(); });
els.gridToggle.addEventListener('change', () => { syncControls(); markDirty(); });
els.mirrorToggle.addEventListener('change', () => { syncControls(); markDirty(); });
els.projectName.addEventListener('input', () => { syncControls(); markDirty(); });
els.duplicateBtn.addEventListener('click', duplicateSelected);
els.deleteFrameBtn.addEventListener('click', deleteSelected);
els.moveLeftBtn.addEventListener('click', () => moveFrame(selectedIndex, selectedIndex - 1));
els.moveRightBtn.addEventListener('click', () => moveFrame(selectedIndex, selectedIndex + 1));
els.previousBtn.addEventListener('click', () => selectFrame(selectedIndex - 1));
els.nextBtn.addEventListener('click', () => selectFrame(selectedIndex + 1));
els.playBtn.addEventListener('click', play);
els.goStartBtn.addEventListener('click', () => project.frames.length && selectFrame(0));
els.collapseTimelineBtn.addEventListener('click', () => {
  const collapsed = els.timelineDock.classList.toggle('collapsed');
  els.collapseTimelineBtn.setAttribute('aria-expanded', String(!collapsed));
  document.documentElement.style.setProperty('--timeline-h', collapsed ? '44px' : (matchMedia('(max-width: 860px)').matches ? '162px' : '188px'));
});
window.addEventListener('keydown', event => {
  if (event.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
    event.preventDefault();
    captureFrame();
  }
  if (event.key === 'ArrowLeft') selectFrame(selectedIndex - 1);
  if (event.key === 'ArrowRight') selectFrame(selectedIndex + 1);
});
window.addEventListener('beforeunload', event => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

(async function init() {
  timeline.setFrames([], -1);
  syncControls();
  renderStage();
  try {
    const latest = await getLatestProject();
    if (latest) {
      loadProjectState(latest);
      showToast('Son proje tarayıcıdan geri yüklendi.');
    }
  } catch {
    // IndexedDB kullanılamıyorsa uygulama yine çalışır.
  }
})();
