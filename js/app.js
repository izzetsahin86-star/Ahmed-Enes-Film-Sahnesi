import { CameraController } from './camera.js';
import { Timeline } from './timeline.js';
import { saveLocalProject, getLatestProject } from './project-store.js';

const $ = selector => document.querySelector(selector);
const els = {
  projectName: $('#projectName'), saveChip: $('#saveChip'), settingsBtn: $('#settingsBtn'), closeSettingsBtn: $('#closeSettingsBtn'), sidePanel: $('#sidePanel'),
  undoBtn: $('#undoBtn'), redoBtn: $('#redoBtn'), newProjectBtn: $('#newProjectBtn'), openProjectBtn: $('#openProjectBtn'), saveProjectBtn: $('#saveProjectBtn'), exportBtn: $('#exportBtn'), shortcutsBtn: $('#shortcutsBtn'),
  resolutionSelect: $('#resolutionSelect'), aspectSelect: $('#aspectSelect'), fpsInput: $('#fpsInput'), fpsValue: $('#fpsValue'), onionInput: $('#onionInput'), onionValue: $('#onionValue'), timerSelect: $('#timerSelect'), gridToggle: $('#gridToggle'), mirrorToggle: $('#mirrorToggle'),
  mobileNewProjectBtn: $('#mobileNewProjectBtn'), mobileOpenProjectBtn: $('#mobileOpenProjectBtn'), mobileSaveProjectBtn: $('#mobileSaveProjectBtn'), mobileUndoBtn: $('#mobileUndoBtn'),
  duplicateBtn: $('#duplicateBtn'), moveLeftBtn: $('#moveLeftBtn'), moveRightBtn: $('#moveRightBtn'), deleteFrameBtn: $('#deleteFrameBtn'), frameCount: $('#frameCount'), durationValue: $('#durationValue'), projectSize: $('#projectSize'), saveStatus: $('#saveStatus'),
  statusDot: $('#statusDot'), cameraStatus: $('#cameraStatus'), cameraMeta: $('#cameraMeta'), cameraDeviceSelect: $('#cameraDeviceSelect'), switchCameraBtn: $('#switchCameraBtn'), fullscreenBtn: $('#fullscreenBtn'),
  stage: $('#stage'), cameraVideo: $('#cameraVideo'), framePreview: $('#framePreview'), onionLayer: $('#onionLayer'), gridOverlay: $('#gridOverlay'), stageEmpty: $('#stageEmpty'), emptyCameraBtn: $('#emptyCameraBtn'), countdown: $('#countdown'), recordFlash: $('#recordFlash'), frameBadge: $('#frameBadge'), liveBadge: $('#liveBadge'),
  previousBtn: $('#previousBtn'), cameraToggleBtn: $('#cameraToggleBtn'), captureBtn: $('#captureBtn'), timerBtn: $('#timerBtn'), timerButtonText: $('#timerButtonText'), nextBtn: $('#nextBtn'),
  playBtn: $('#playBtn'), goStartBtn: $('#goStartBtn'), playbackPosition: $('#playbackPosition'), timelineZoom: $('#timelineZoom'), collapseTimelineBtn: $('#collapseTimelineBtn'), timelineDock: $('#timelineDock'), timelineTrack: $('#timelineTrack'),
  exportDialog: $('#exportDialog'), exportVideoBtn: $('#exportVideoBtn'), exportProjectBtn: $('#exportProjectBtn'), exportFrameBtn: $('#exportFrameBtn'), shortcutsDialog: $('#shortcutsDialog'),
  projectFileInput: $('#projectFileInput'), captureCanvas: $('#captureCanvas'), exportCanvas: $('#exportCanvas'), toast: $('#toast')
};

const camera = new CameraController(els.cameraVideo);
let project = createProject();
let selectedIndex = -1;
let playing = false;
let playbackRaf = 0;
let playbackStart = 0;
let playbackStartIndex = 0;
let lastPlaybackIndex = -1;
let toastTimer = 0;
let autosaveTimer = 0;
let dirty = false;
let history = [];
let future = [];
let captureBusy = false;

const timeline = new Timeline(els.timelineTrack, {
  onSelect: index => selectFrame(index),
  onMove: (from, to) => moveFrame(from, to),
  onDuplicate: index => { selectedIndex = index; duplicateSelected(); }
});

function createProject() {
  return {
    version: 2,
    id: crypto.randomUUID(),
    name: 'Yeni Film',
    fps: 12,
    onionOpacity: 35,
    grid: false,
    mirror: true,
    resolution: '1080',
    aspectRatio: '16:9',
    timerSeconds: 3,
    frames: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function normalizeProject(input = {}) {
  const defaults = createProject();
  return {
    ...defaults,
    ...input,
    version: 2,
    resolution: String(input.resolution || '1080'),
    aspectRatio: input.aspectRatio || '16:9',
    timerSeconds: Number.isFinite(Number(input.timerSeconds)) ? Number(input.timerSeconds) : 3,
    frames: Array.isArray(input.frames) ? input.frames : []
  };
}

function snapshot() {
  return {
    project: { ...project, frames: project.frames.map(frame => ({ ...frame })) },
    selectedIndex
  };
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 25) history.shift();
  future = [];
  updateHistoryButtons();
}

function undo() {
  if (!history.length) return;
  stopPlayback();
  future.push(snapshot());
  const previous = history.pop();
  restoreSnapshot(previous);
  markDirty();
  updateHistoryButtons();
}

function redo() {
  if (!future.length) return;
  stopPlayback();
  history.push(snapshot());
  const next = future.pop();
  restoreSnapshot(next);
  markDirty();
  updateHistoryButtons();
}

function restoreSnapshot(state) {
  project = normalizeProject(state.project);
  selectedIndex = Math.min(state.selectedIndex, project.frames.length - 1);
  applyProjectToControls();
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
}

function updateHistoryButtons() {
  els.undoBtn.disabled = history.length === 0;
  els.redoBtn.disabled = future.length === 0;
  els.mobileUndoBtn.disabled = history.length === 0;
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800);
}

function setSaveState(state, label) {
  els.saveChip.className = `save-chip ${state}`;
  els.saveChip.querySelector('b').textContent = label;
  els.saveStatus.textContent = label;
}

function markDirty() {
  dirty = true;
  setSaveState('dirty', 'Değişti');
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => autosaveProject(), 900);
}

async function autosaveProject() {
  if (!dirty) return;
  project.updatedAt = Date.now();
  setSaveState('saving', 'Kaydediliyor');
  try {
    await saveLocalProject(project);
    dirty = false;
    setSaveState('saved', 'Otomatik kayıt');
  } catch {
    setSaveState('dirty', 'Kayıt bekliyor');
  }
}

async function manualSave() {
  syncProjectFromControls();
  project.updatedAt = Date.now();
  setSaveState('saving', 'Kaydediliyor');
  try {
    await saveLocalProject(project);
    dirty = false;
    setSaveState('saved', 'Kaydedildi');
    showToast('Proje cihazına kaydedildi.');
  } catch (error) {
    setSaveState('dirty', 'Kayıt hatası');
    showToast(`Kaydetme hatası: ${error.message}`);
  }
}

function syncProjectFromControls() {
  project.name = els.projectName.value.trim() || 'Adsız Film';
  project.fps = Number(els.fpsInput.value);
  project.onionOpacity = Number(els.onionInput.value);
  project.grid = els.gridToggle.checked;
  project.mirror = els.mirrorToggle.checked;
  project.resolution = els.resolutionSelect.value;
  project.aspectRatio = els.aspectSelect.value;
  project.timerSeconds = Number(els.timerSelect.value);
  project.updatedAt = Date.now();
  refreshControlReadouts();
}

function applyProjectToControls() {
  els.projectName.value = project.name || 'Adsız Film';
  els.fpsInput.value = String(project.fps || 12);
  els.onionInput.value = String(project.onionOpacity ?? 35);
  els.gridToggle.checked = Boolean(project.grid);
  els.mirrorToggle.checked = project.mirror !== false;
  els.resolutionSelect.value = String(project.resolution || '1080');
  els.aspectSelect.value = project.aspectRatio || '16:9';
  els.timerSelect.value = String(project.timerSeconds ?? 3);
  refreshControlReadouts();
}

function refreshControlReadouts() {
  els.fpsValue.textContent = String(project.fps);
  els.onionValue.textContent = `${project.onionOpacity}%`;
  els.gridOverlay.style.display = project.grid ? 'block' : 'none';
  els.cameraVideo.classList.toggle('mirrored', project.mirror);
  els.onionLayer.style.opacity = String(project.onionOpacity / 100);
  els.timerButtonText.textContent = project.timerSeconds > 0 ? `${project.timerSeconds} sn` : 'Kapalı';
  els.timerBtn.classList.toggle('active', project.timerSeconds > 0);
  updateStageAspect();
  renderStats();
}

function loadProjectState(nextProject, { resetHistory = true } = {}) {
  stopPlayback();
  project = normalizeProject(nextProject);
  selectedIndex = project.frames.length ? 0 : -1;
  if (resetHistory) { history = []; future = []; }
  applyProjectToControls();
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
  dirty = false;
  setSaveState('saved', 'Kaydedildi');
  updateHistoryButtons();
}

function renderStats() {
  const duration = project.frames.length / Math.max(1, project.fps);
  els.frameCount.textContent = String(project.frames.length);
  els.durationValue.textContent = `${duration.toFixed(1)} sn`;
  els.projectSize.textContent = `${estimateProjectMb().toFixed(1)} MB`;
  els.frameBadge.textContent = selectedIndex >= 0 ? `KARE ${String(selectedIndex + 1).padStart(3, '0')} / ${String(project.frames.length).padStart(3, '0')}` : 'KARE 000';
  els.playbackPosition.textContent = formatTime(selectedIndex >= 0 ? selectedIndex / project.fps : 0);
  const hasSelection = selectedIndex >= 0;
  els.duplicateBtn.disabled = !hasSelection;
  els.deleteFrameBtn.disabled = !hasSelection;
  els.moveLeftBtn.disabled = !hasSelection || selectedIndex <= 0;
  els.moveRightBtn.disabled = !hasSelection || selectedIndex >= project.frames.length - 1;
  els.previousBtn.disabled = !hasSelection || selectedIndex <= 0;
  els.nextBtn.disabled = !hasSelection || selectedIndex >= project.frames.length - 1;
  els.playBtn.disabled = project.frames.length === 0;
  els.exportFrameBtn.disabled = !hasSelection;
}

function estimateProjectMb() {
  let bytes = 0;
  for (const frame of project.frames) bytes += Math.ceil((frame.dataUrl?.length || 0) * 0.75);
  return bytes / (1024 * 1024);
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${String(min).padStart(2, '0')}:${sec.toFixed(1).padStart(4, '0')}`;
}

function updateStageAspect() {
  const aspect = project.aspectRatio || '16:9';
  els.stage.dataset.aspect = aspect;
  if (aspect === 'source') {
    const settings = camera.getSettings();
    const w = settings.width || els.cameraVideo.videoWidth;
    const h = settings.height || els.cameraVideo.videoHeight;
    els.stage.style.aspectRatio = w && h ? `${w} / ${h}` : '16 / 9';
  } else {
    els.stage.style.aspectRatio = '';
  }
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
  els.liveBadge.classList.toggle('show', camera.active && !playing);
  renderStats();
}

function selectFrame(index) {
  if (index < 0 || index >= project.frames.length) return;
  stopPlayback();
  selectedIndex = index;
  timeline.select(index);
  renderStage();
}

function addFrame(dataUrl) {
  pushHistory();
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
  pushHistory();
  project.frames.splice(selectedIndex + 1, 0, { ...source, id: crypto.randomUUID(), createdAt: Date.now() });
  selectedIndex += 1;
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
  markDirty();
}

function deleteSelected() {
  if (selectedIndex < 0) return;
  pushHistory();
  project.frames.splice(selectedIndex, 1);
  selectedIndex = Math.min(selectedIndex, project.frames.length - 1);
  timeline.setFrames(project.frames, selectedIndex);
  renderStage();
  markDirty();
}

function moveFrame(from, to) {
  if (from < 0 || to < 0 || from >= project.frames.length || to >= project.frames.length || from === to) return;
  pushHistory();
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
    setCameraUi(false);
    renderStage();
    return;
  }
  try {
    await camera.start({ resolution: project.resolution, deviceId: els.cameraDeviceSelect.value });
    setCameraUi(true);
    await refreshCameraDevices();
    updateCameraMeta();
    updateStageAspect();
    renderStage();
  } catch (error) {
    setCameraUi(false);
    showToast(`Kamera açılamadı: ${friendlyCameraError(error)}`);
  }
}

function setCameraUi(active) {
  els.cameraToggleBtn.classList.toggle('active', active);
  els.cameraToggleBtn.innerHTML = `<span class="camera-dot"></span>${active ? 'Kamerayı Kapat' : 'Kamerayı Aç'}`;
  els.cameraStatus.textContent = active ? 'Kamera hazır' : 'Kamera kapalı';
  els.statusDot.classList.toggle('live', active);
  els.cameraMeta.textContent = active ? 'Canlı çekim etkin' : 'Hazır olduğunda kamerayı aç';
  els.captureBtn.disabled = !active || captureBusy;
}

function updateCameraMeta() {
  const settings = camera.getSettings();
  const dims = settings.width && settings.height ? `${settings.width}×${settings.height}` : 'Çözünürlük otomatik';
  const fps = settings.frameRate ? ` · ${Math.round(settings.frameRate)} fps kamera` : '';
  els.cameraMeta.textContent = `${dims}${fps}`;
}

async function refreshCameraDevices() {
  try {
    const devices = await camera.listVideoInputs();
    const current = camera.getSettings().deviceId || '';
    els.cameraDeviceSelect.innerHTML = '<option value="">Otomatik kamera</option>';
    devices.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.textContent = device.label || `Kamera ${index + 1}`;
      option.selected = device.deviceId === current;
      els.cameraDeviceSelect.append(option);
    });
  } catch { }
}

async function restartCamera() {
  if (!camera.active) return;
  try {
    await camera.restart({ resolution: project.resolution, deviceId: els.cameraDeviceSelect.value });
    setCameraUi(true);
    updateCameraMeta();
    updateStageAspect();
  } catch (error) {
    showToast(`Kamera ayarı uygulanamadı: ${friendlyCameraError(error)}`);
  }
}

function friendlyCameraError(error) {
  if (error?.name === 'NotAllowedError') return 'Kamera izni verilmedi.';
  if (error?.name === 'NotFoundError') return 'Uygun kamera bulunamadı.';
  if (error?.name === 'NotReadableError') return 'Kamera başka bir uygulama tarafından kullanılıyor olabilir.';
  if (error?.name === 'OverconstrainedError') return 'Seçilen kamera ayarı desteklenmiyor.';
  return error?.message || 'Bilinmeyen kamera hatası.';
}

async function captureFrame() {
  if (!camera.active || captureBusy) {
    if (!camera.active) showToast('Önce kamerayı aç.');
    return;
  }
  captureBusy = true;
  els.captureBtn.disabled = true;
  try {
    if (project.timerSeconds > 0) await runCountdown(project.timerSeconds);
    const dataUrl = camera.capture(els.captureCanvas, { mirror: project.mirror, aspectRatio: project.aspectRatio, quality: 0.92 });
    addFrame(dataUrl);
    flashCapture();
  } catch (error) {
    showToast(error.message);
  } finally {
    captureBusy = false;
    els.captureBtn.disabled = !camera.active;
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
      } else els.countdown.textContent = String(value);
    }, 1000);
  });
}

function flashCapture() {
  els.recordFlash.classList.remove('flash');
  void els.recordFlash.offsetWidth;
  els.recordFlash.classList.add('flash');
}

function play() {
  if (!project.frames.length) return;
  if (playing) return stopPlayback();
  playing = true;
  els.playBtn.textContent = '❚❚';
  playbackStart = performance.now();
  playbackStartIndex = selectedIndex >= 0 ? selectedIndex : 0;
  lastPlaybackIndex = -1;
  const tick = now => {
    if (!playing) return;
    const elapsedFrames = Math.floor(((now - playbackStart) * Math.max(1, project.fps)) / 1000);
    const index = (playbackStartIndex + elapsedFrames) % project.frames.length;
    if (index !== lastPlaybackIndex) {
      selectedIndex = index;
      lastPlaybackIndex = index;
      timeline.select(index);
      renderStage();
    }
    playbackRaf = requestAnimationFrame(tick);
  };
  playbackRaf = requestAnimationFrame(tick);
}

function stopPlayback() {
  if (playbackRaf) cancelAnimationFrame(playbackRaf);
  playbackRaf = 0;
  if (!playing) return;
  playing = false;
  els.playBtn.textContent = '▶';
  renderStage();
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

function exportProjectFile() {
  syncProjectFromControls();
  const blob = new Blob([JSON.stringify(project)], { type: 'application/json' });
  downloadBlob(blob, `${safeFileName(project.name)}.aefs.json`);
  els.exportDialog.close();
  showToast('Proje dosyası indirildi.');
}

function exportSelectedFrame() {
  const frame = project.frames[selectedIndex];
  if (!frame) return;
  const a = document.createElement('a');
  a.href = frame.dataUrl;
  a.download = `${safeFileName(project.name)}-kare-${String(selectedIndex + 1).padStart(3, '0')}.jpg`;
  document.body.append(a); a.click(); a.remove();
  els.exportDialog.close();
}

async function exportVideo() {
  if (!project.frames.length) return;
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) {
    showToast('Bu tarayıcı doğrudan WebM video dışa aktarmayı desteklemiyor. Proje dosyasını dışa aktarabilirsin.');
    return;
  }
  const supported = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
  if (!supported) return showToast('Bu tarayıcı WebM video kodlamayı desteklemiyor.');

  const label = els.exportVideoBtn.querySelector('strong');
  const original = label.textContent;
  els.exportVideoBtn.disabled = true;
  label.textContent = 'Video hazırlanıyor…';
  try {
    const first = await loadImage(project.frames[0].dataUrl);
    const canvas = els.exportCanvas;
    canvas.width = first.naturalWidth || first.width;
    canvas.height = first.naturalHeight || first.height;
    const ctx = canvas.getContext('2d', { alpha: false });
    const stream = canvas.captureStream(project.fps);
    const recorder = new MediaRecorder(stream, { mimeType: supported, videoBitsPerSecond: 10_000_000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise(resolve => recorder.onstop = resolve);
    recorder.start();
    const frameMs = 1000 / Math.max(1, project.fps);
    for (let i = 0; i < project.frames.length; i += 1) {
      const image = await loadImage(project.frames[i].dataUrl);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      label.textContent = `Video hazırlanıyor… ${Math.round(((i + 1) / project.frames.length) * 100)}%`;
      await delay(frameMs);
    }
    await delay(frameMs);
    recorder.stop(); await stopped;
    downloadBlob(new Blob(chunks, { type: supported }), `${safeFileName(project.name)}.webm`);
    els.exportDialog.close();
    showToast('Video hazırlandı.');
  } catch (error) {
    showToast(`Video oluşturulamadı: ${error.message}`);
  } finally {
    els.exportVideoBtn.disabled = false;
    label.textContent = original;
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Kare okunamadı.')); img.src = src;
  });
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function safeFileName(value) { return (value || 'film').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80); }
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200);
}

function closeMobileSettings() { els.sidePanel.classList.remove('open'); }
function isTypingTarget() { return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName); }

els.settingsBtn.addEventListener('click', () => els.sidePanel.classList.toggle('open'));
els.closeSettingsBtn.addEventListener('click', closeMobileSettings);
els.emptyCameraBtn.addEventListener('click', toggleCamera);
els.undoBtn.addEventListener('click', undo);
els.redoBtn.addEventListener('click', redo);
els.newProjectBtn.addEventListener('click', newProject);
els.mobileNewProjectBtn.addEventListener('click', () => { closeMobileSettings(); newProject(); });
els.openProjectBtn.addEventListener('click', openProjectFile);
els.mobileOpenProjectBtn.addEventListener('click', () => { closeMobileSettings(); openProjectFile(); });
els.saveProjectBtn.addEventListener('click', manualSave);
els.mobileSaveProjectBtn.addEventListener('click', () => { closeMobileSettings(); manualSave(); });
els.mobileUndoBtn.addEventListener('click', undo);
els.exportBtn.addEventListener('click', () => els.exportDialog.showModal());
els.shortcutsBtn.addEventListener('click', () => els.shortcutsDialog.showModal());
els.exportVideoBtn.addEventListener('click', exportVideo);
els.exportProjectBtn.addEventListener('click', exportProjectFile);
els.exportFrameBtn.addEventListener('click', exportSelectedFrame);
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close()));
els.projectFileInput.addEventListener('change', event => handleProjectFile(event.target.files?.[0]));
els.cameraToggleBtn.addEventListener('click', toggleCamera);
els.captureBtn.addEventListener('click', captureFrame);
els.switchCameraBtn.addEventListener('click', async () => {
  if (!camera.active) return showToast('Önce kamerayı aç.');
  try {
    await camera.switchCamera({ resolution: project.resolution });
    els.cameraDeviceSelect.value = '';
    setCameraUi(true); await refreshCameraDevices(); updateCameraMeta(); updateStageAspect(); renderStage();
  } catch (error) { showToast(friendlyCameraError(error)); }
});
els.cameraDeviceSelect.addEventListener('change', restartCamera);
els.fullscreenBtn.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen(); else await els.stage.requestFullscreen?.();
  } catch { showToast('Tam ekran bu cihazda kullanılamıyor.'); }
});
els.timerBtn.addEventListener('click', () => {
  const options = [0, 2, 3, 5, 10];
  const current = options.indexOf(project.timerSeconds);
  project.timerSeconds = options[(current + 1) % options.length];
  els.timerSelect.value = String(project.timerSeconds);
  refreshControlReadouts(); markDirty();
});
els.fpsInput.addEventListener('input', () => { syncProjectFromControls(); renderStage(); });
els.fpsInput.addEventListener('change', markDirty);
els.onionInput.addEventListener('input', () => { syncProjectFromControls(); renderStage(); });
els.onionInput.addEventListener('change', markDirty);
els.gridToggle.addEventListener('change', () => { pushHistory(); syncProjectFromControls(); markDirty(); });
els.mirrorToggle.addEventListener('change', () => { pushHistory(); syncProjectFromControls(); markDirty(); });
els.aspectSelect.addEventListener('change', () => { pushHistory(); syncProjectFromControls(); renderStage(); markDirty(); });
els.timerSelect.addEventListener('change', () => { syncProjectFromControls(); markDirty(); });
els.resolutionSelect.addEventListener('change', async () => { syncProjectFromControls(); markDirty(); await restartCamera(); });
els.projectName.addEventListener('input', () => { syncProjectFromControls(); markDirty(); });
els.duplicateBtn.addEventListener('click', duplicateSelected);
els.deleteFrameBtn.addEventListener('click', deleteSelected);
els.moveLeftBtn.addEventListener('click', () => moveFrame(selectedIndex, selectedIndex - 1));
els.moveRightBtn.addEventListener('click', () => moveFrame(selectedIndex, selectedIndex + 1));
els.previousBtn.addEventListener('click', () => selectFrame(selectedIndex - 1));
els.nextBtn.addEventListener('click', () => selectFrame(selectedIndex + 1));
els.playBtn.addEventListener('click', play);
els.goStartBtn.addEventListener('click', () => project.frames.length && selectFrame(0));
els.timelineZoom.addEventListener('input', () => timeline.setZoom(els.timelineZoom.value));
els.collapseTimelineBtn.addEventListener('click', () => {
  const collapsed = els.timelineDock.classList.toggle('collapsed');
  els.collapseTimelineBtn.setAttribute('aria-expanded', String(!collapsed));
  document.documentElement.style.setProperty('--timeline-h', collapsed ? '46px' : (matchMedia('(max-width: 860px)').matches ? '172px' : '202px'));
});

window.addEventListener('keydown', event => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); manualSave(); return; }
  if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  if (isTypingTarget()) return;
  if (event.code === 'Space') { event.preventDefault(); captureFrame(); }
  else if (event.key.toLowerCase() === 'p') { event.preventDefault(); play(); }
  else if (event.key === 'ArrowLeft') selectFrame(selectedIndex - 1);
  else if (event.key === 'ArrowRight') selectFrame(selectedIndex + 1);
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); }
  else if (event.key === 'Escape') closeMobileSettings();
});
window.addEventListener('beforeunload', event => {
  if (!dirty) return;
  event.preventDefault(); event.returnValue = '';
});
window.addEventListener('resize', updateStageAspect);

async function init() {
  timeline.setFrames([], -1);
  timeline.setZoom(els.timelineZoom.value);
  applyProjectToControls();
  renderStage();
  setCameraUi(false);
  updateHistoryButtons();
  try {
    const latest = await getLatestProject();
    if (latest) { loadProjectState(latest); showToast('Son proje otomatik olarak geri yüklendi.'); }
  } catch { }
  try { await navigator.storage?.persist?.(); } catch { }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
