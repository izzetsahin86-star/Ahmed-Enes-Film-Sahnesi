import { CameraController, drawSourceToCanvas } from './camera.js';
import { Timeline } from './timeline.js';
import { GifEncoder } from './gif-encoder.js';
import { saveLocalProject, getLatestProject } from './project-store.js';

const $ = selector => document.querySelector(selector);
const els = {
  projectName: $('#projectName'), saveChip: $('#saveChip'), settingsBtn: $('#settingsBtn'), closeSettingsBtn: $('#closeSettingsBtn'), sidePanel: $('#sidePanel'),
  undoBtn: $('#undoBtn'), redoBtn: $('#redoBtn'), newProjectBtn: $('#newProjectBtn'), openProjectBtn: $('#openProjectBtn'), saveProjectBtn: $('#saveProjectBtn'), exportBtn: $('#exportBtn'), shortcutsBtn: $('#shortcutsBtn'),
  resolutionSelect: $('#resolutionSelect'), aspectSelect: $('#aspectSelect'), fpsInput: $('#fpsInput'), fpsValue: $('#fpsValue'), onionInput: $('#onionInput'), onionValue: $('#onionValue'), timerSelect: $('#timerSelect'), gridToggle: $('#gridToggle'), mirrorToggle: $('#mirrorToggle'),
  intervalSelect: $('#intervalSelect'), intervalStartBtn: $('#intervalStartBtn'), intervalStatus: $('#intervalStatus'), zoomInput: $('#zoomInput'), zoomValue: $('#zoomValue'), zoomSupport: $('#zoomSupport'), exposureLockBtn: $('#exposureLockBtn'), whiteBalanceLockBtn: $('#whiteBalanceLockBtn'),
  brightnessInput: $('#brightnessInput'), brightnessValue: $('#brightnessValue'), contrastInput: $('#contrastInput'), contrastValue: $('#contrastValue'), saturationInput: $('#saturationInput'), saturationValue: $('#saturationValue'), warmthInput: $('#warmthInput'), warmthValue: $('#warmthValue'), resetColorBtn: $('#resetColorBtn'),
  playbackModeSelect: $('#playbackModeSelect'), freezeSelect: $('#freezeSelect'), importPhotosBtn: $('#importPhotosBtn'), photoImportInput: $('#photoImportInput'),
  mobileNewProjectBtn: $('#mobileNewProjectBtn'), mobileOpenProjectBtn: $('#mobileOpenProjectBtn'), mobileSaveProjectBtn: $('#mobileSaveProjectBtn'), mobileUndoBtn: $('#mobileUndoBtn'),
  duplicateBtn: $('#duplicateBtn'), moveLeftBtn: $('#moveLeftBtn'), moveRightBtn: $('#moveRightBtn'), deleteFrameBtn: $('#deleteFrameBtn'), frameCount: $('#frameCount'), durationValue: $('#durationValue'), projectSize: $('#projectSize'), saveStatus: $('#saveStatus'),
  statusDot: $('#statusDot'), cameraStatus: $('#cameraStatus'), cameraMeta: $('#cameraMeta'), cameraDeviceSelect: $('#cameraDeviceSelect'), switchCameraBtn: $('#switchCameraBtn'), fullscreenBtn: $('#fullscreenBtn'),
  stage: $('#stage'), cameraVideo: $('#cameraVideo'), framePreview: $('#framePreview'), onionLayer: $('#onionLayer'), colorTint: $('#colorTint'), gridOverlay: $('#gridOverlay'), stageEmpty: $('#stageEmpty'), emptyCameraBtn: $('#emptyCameraBtn'), countdown: $('#countdown'), recordFlash: $('#recordFlash'), frameBadge: $('#frameBadge'), liveBadge: $('#liveBadge'),
  previousBtn: $('#previousBtn'), cameraToggleBtn: $('#cameraToggleBtn'), captureBtn: $('#captureBtn'), timerBtn: $('#timerBtn'), timerButtonText: $('#timerButtonText'), nextBtn: $('#nextBtn'),
  playBtn: $('#playBtn'), goStartBtn: $('#goStartBtn'), playbackPosition: $('#playbackPosition'), timelineZoom: $('#timelineZoom'), collapseTimelineBtn: $('#collapseTimelineBtn'), timelineDock: $('#timelineDock'), timelineTrack: $('#timelineTrack'),
  exportDialog: $('#exportDialog'), exportMp4Btn: $('#exportMp4Btn'), exportGifBtn: $('#exportGifBtn'), exportWebmBtn: $('#exportWebmBtn'), exportProjectBtn: $('#exportProjectBtn'), exportFrameBtn: $('#exportFrameBtn'), shortcutsDialog: $('#shortcutsDialog'),
  projectFileInput: $('#projectFileInput'), captureCanvas: $('#captureCanvas'), exportCanvas: $('#exportCanvas'), workCanvas: $('#workCanvas'), toast: $('#toast')
};

const camera = new CameraController(els.cameraVideo);
let project = createProject();
let selectedIndex = -1;
let playing = false;
let playbackRaf = 0;
let playbackStart = 0;
let playbackSequence = [];
let lastPlaybackSlot = -1;
let toastTimer = 0;
let autosaveTimer = 0;
let dirty = false;
let history = [];
let future = [];
let captureBusy = false;
let intervalActive = false;
let intervalTimer = 0;

const timeline = new Timeline(els.timelineTrack, {
  onSelect: index => selectFrame(index),
  onMove: (from, to) => moveFrame(from, to),
  onDuplicate: index => { selectedIndex = index; duplicateSelected(); }
});

function createProject() {
  return {
    version: 3,
    id: crypto.randomUUID(),
    name: 'Yeni Film',
    fps: 12,
    onionOpacity: 35,
    grid: false,
    mirror: true,
    resolution: '1080',
    aspectRatio: '16:9',
    timerSeconds: 3,
    intervalSeconds: 0,
    cameraZoom: null,
    exposureLocked: false,
    whiteBalanceLocked: false,
    playbackMode: 'normal',
    color: { brightness: 0, contrast: 0, saturation: 0, warmth: 0 },
    frames: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

function normalizeProject(input = {}) {
  const defaults = createProject();
  const color = { ...defaults.color, ...(input.color || {}) };
  return {
    ...defaults,
    ...input,
    color,
    version: 3,
    resolution: String(input.resolution || '1080'),
    aspectRatio: input.aspectRatio || '16:9',
    timerSeconds: finiteNumber(input.timerSeconds, 3),
    intervalSeconds: finiteNumber(input.intervalSeconds, 0),
    cameraZoom: input.cameraZoom == null ? null : finiteNumber(input.cameraZoom, 1),
    exposureLocked: Boolean(input.exposureLocked),
    whiteBalanceLocked: Boolean(input.whiteBalanceLocked),
    playbackMode: ['normal', 'reverse', 'boomerang'].includes(input.playbackMode) ? input.playbackMode : 'normal',
    frames: Array.isArray(input.frames) ? input.frames.map(frame => ({ ...frame, hold: Math.max(1, Math.round(finiteNumber(frame.hold, 1))) })) : []
  };
}

function finiteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function snapshot() { return { project: structuredCloneProject(project), selectedIndex }; }
function structuredCloneProject(value) { return { ...value, color: { ...value.color }, frames: value.frames.map(frame => ({ ...frame })) }; }
function pushHistory() {
  history.push(snapshot());
  if (history.length > 25) history.shift();
  future = [];
  updateHistoryButtons();
}
function undo() {
  if (!history.length) return;
  stopPlayback(); stopIntervalCapture();
  future.push(snapshot());
  restoreSnapshot(history.pop());
  markDirty(); updateHistoryButtons();
}
function redo() {
  if (!future.length) return;
  stopPlayback(); stopIntervalCapture();
  history.push(snapshot());
  restoreSnapshot(future.pop());
  markDirty(); updateHistoryButtons();
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
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
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
  project.intervalSeconds = Number(els.intervalSelect.value);
  project.playbackMode = els.playbackModeSelect.value;
  project.color = {
    brightness: Number(els.brightnessInput.value),
    contrast: Number(els.contrastInput.value),
    saturation: Number(els.saturationInput.value),
    warmth: Number(els.warmthInput.value)
  };
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
  els.intervalSelect.value = String(project.intervalSeconds ?? 0);
  els.playbackModeSelect.value = project.playbackMode || 'normal';
  els.brightnessInput.value = String(project.color.brightness || 0);
  els.contrastInput.value = String(project.color.contrast || 0);
  els.saturationInput.value = String(project.color.saturation || 0);
  els.warmthInput.value = String(project.color.warmth || 0);
  refreshControlReadouts();
}
function refreshControlReadouts() {
  els.fpsValue.textContent = String(project.fps);
  els.onionValue.textContent = `${project.onionOpacity}%`;
  els.brightnessValue.textContent = signed(project.color.brightness);
  els.contrastValue.textContent = signed(project.color.contrast);
  els.saturationValue.textContent = signed(project.color.saturation);
  els.warmthValue.textContent = signed(project.color.warmth);
  els.gridOverlay.style.display = project.grid ? 'block' : 'none';
  els.cameraVideo.classList.toggle('mirrored', project.mirror);
  els.onionLayer.style.opacity = String(project.onionOpacity / 100);
  els.timerButtonText.textContent = project.timerSeconds > 0 ? `${project.timerSeconds} sn` : 'Kapalı';
  els.timerBtn.classList.toggle('active', project.timerSeconds > 0);
  els.intervalStartBtn.disabled = !camera.active || project.intervalSeconds <= 0;
  els.intervalStatus.textContent = intervalActive ? `Aktif · ${project.intervalSeconds} sn` : (project.intervalSeconds > 0 ? `${project.intervalSeconds} sn aralık` : 'Kapalı');
  updateFreezeControl();
  applyPreviewColor();
  updateStageAspect();
  renderStats();
}
function signed(value) { return Number(value) > 0 ? `+${value}` : String(value); }

function loadProjectState(nextProject, { resetHistory = true } = {}) {
  stopPlayback(); stopIntervalCapture();
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

function buildPlaybackItems() {
  const base = project.frames.map((frame, index) => ({ frame, index, hold: Math.max(1, Number(frame.hold) || 1) }));
  if (project.playbackMode === 'reverse') return [...base].reverse();
  if (project.playbackMode === 'boomerang' && base.length > 1) return base.concat(base.slice(0, -1).reverse());
  return base;
}
function buildPlaybackSlots() {
  const slots = [];
  for (const item of buildPlaybackItems()) for (let i = 0; i < item.hold; i += 1) slots.push(item.index);
  return slots;
}
function effectiveFrameUnits() { return buildPlaybackItems().reduce((sum, item) => sum + item.hold, 0); }
function renderStats() {
  const duration = effectiveFrameUnits() / Math.max(1, project.fps);
  els.frameCount.textContent = String(project.frames.length);
  els.durationValue.textContent = `${duration.toFixed(1)} sn`;
  els.projectSize.textContent = `${estimateProjectMb().toFixed(1)} MB`;
  els.frameBadge.textContent = selectedIndex >= 0 ? `KARE ${String(selectedIndex + 1).padStart(3, '0')} / ${String(project.frames.length).padStart(3, '0')}` : 'KARE 000';
  els.playbackPosition.textContent = formatTime(selectedIndex >= 0 ? selectedIndex / Math.max(1, project.fps) : 0);
  const hasSelection = selectedIndex >= 0;
  els.duplicateBtn.disabled = !hasSelection;
  els.deleteFrameBtn.disabled = !hasSelection;
  els.moveLeftBtn.disabled = !hasSelection || selectedIndex <= 0;
  els.moveRightBtn.disabled = !hasSelection || selectedIndex >= project.frames.length - 1;
  els.previousBtn.disabled = !hasSelection || selectedIndex <= 0;
  els.nextBtn.disabled = !hasSelection || selectedIndex >= project.frames.length - 1;
  els.playBtn.disabled = project.frames.length === 0;
  els.exportFrameBtn.disabled = !hasSelection;
  els.exportMp4Btn.disabled = project.frames.length === 0;
  els.exportGifBtn.disabled = project.frames.length === 0;
  els.exportWebmBtn.disabled = project.frames.length === 0;
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
  } else els.stage.style.aspectRatio = '';
}
function previewFilter() {
  const b = Math.max(0.1, 1 + project.color.brightness / 100);
  const c = Math.max(0.1, 1 + project.color.contrast / 100);
  const s = Math.max(0, 1 + project.color.saturation / 100);
  return `brightness(${b}) contrast(${c}) saturate(${s})`;
}
function applyPreviewColor() {
  const filter = previewFilter();
  els.cameraVideo.style.filter = filter;
  els.framePreview.style.filter = filter;
  els.onionLayer.style.filter = filter;
  els.timelineTrack.style.setProperty('--frame-filter', filter);
  const warmth = Number(project.color.warmth) || 0;
  els.colorTint.style.background = warmth >= 0 ? '#ff7a28' : '#3478ff';
  els.colorTint.style.opacity = String(Math.min(0.22, Math.abs(warmth) / 100 * 0.22));
}
function renderStage() {
  const selected = project.frames[selectedIndex];
  const previous = project.frames[selectedIndex - 1];
  if (playing || (!camera.active && selected)) {
    els.framePreview.src = selected?.dataUrl || '';
    els.framePreview.style.display = selected ? 'block' : 'none';
  } else els.framePreview.style.display = 'none';

  const onionSource = camera.active ? project.frames.at(-1) : previous;
  if (!playing && onionSource && project.onionOpacity > 0) {
    els.onionLayer.src = onionSource.dataUrl;
    els.onionLayer.style.display = 'block';
  } else els.onionLayer.style.display = 'none';

  els.stageEmpty.style.display = camera.active || selected ? 'none' : 'grid';
  els.liveBadge.classList.toggle('show', camera.active && !playing);
  applyPreviewColor();
  updateFreezeControl();
  renderStats();
}
function selectFrame(index) {
  if (index < 0 || index >= project.frames.length) return;
  stopPlayback();
  selectedIndex = index;
  timeline.select(index);
  renderStage();
}

function addFrame(dataUrl, { push = true } = {}) {
  if (push) pushHistory();
  project.frames.push({ id: crypto.randomUUID(), dataUrl, hold: 1, createdAt: Date.now() });
  selectedIndex = project.frames.length - 1;
  project.updatedAt = Date.now();
  timeline.setFrames(project.frames, selectedIndex);
  renderStage(); markDirty();
}
function duplicateSelected() {
  const source = project.frames[selectedIndex];
  if (!source) return;
  pushHistory();
  project.frames.splice(selectedIndex + 1, 0, { ...source, id: crypto.randomUUID(), createdAt: Date.now() });
  selectedIndex += 1;
  timeline.setFrames(project.frames, selectedIndex); renderStage(); markDirty();
}
function deleteSelected() {
  if (selectedIndex < 0) return;
  pushHistory();
  project.frames.splice(selectedIndex, 1);
  selectedIndex = Math.min(selectedIndex, project.frames.length - 1);
  timeline.setFrames(project.frames, selectedIndex); renderStage(); markDirty();
}
function moveFrame(from, to) {
  if (from < 0 || to < 0 || from >= project.frames.length || to >= project.frames.length || from === to) return;
  pushHistory();
  const [frame] = project.frames.splice(from, 1);
  project.frames.splice(to, 0, frame);
  selectedIndex = to;
  timeline.setFrames(project.frames, selectedIndex); renderStage(); markDirty();
}
function updateFreezeControl() {
  const frame = project.frames[selectedIndex];
  els.freezeSelect.disabled = !frame;
  els.freezeSelect.value = String(frame?.hold || 1);
}
function setSelectedFreeze() {
  const frame = project.frames[selectedIndex];
  if (!frame) return;
  pushHistory();
  frame.hold = Math.max(1, Number(els.freezeSelect.value) || 1);
  timeline.setFrames(project.frames, selectedIndex); renderStage(); markDirty();
}

async function toggleCamera() {
  if (camera.active) {
    stopIntervalCapture();
    await camera.stop();
    setCameraUi(false); renderStage(); refreshCameraCapabilities();
    return;
  }
  try {
    await camera.start({ resolution: project.resolution, deviceId: els.cameraDeviceSelect.value });
    setCameraUi(true);
    await refreshCameraDevices();
    await refreshCameraCapabilities({ applySaved: true });
    updateCameraMeta(); updateStageAspect(); renderStage();
  } catch (error) {
    setCameraUi(false); showToast(`Kamera açılamadı: ${friendlyCameraError(error)}`);
  }
}
function setCameraUi(active) {
  els.cameraToggleBtn.classList.toggle('active', active);
  els.cameraToggleBtn.innerHTML = `<span class="camera-dot"></span>${active ? 'Kamerayı Kapat' : 'Kamerayı Aç'}`;
  els.cameraStatus.textContent = active ? 'Kamera hazır' : 'Kamera kapalı';
  els.statusDot.classList.toggle('live', active);
  els.cameraMeta.textContent = active ? 'Canlı çekim etkin' : 'Hazır olduğunda kamerayı aç';
  els.captureBtn.disabled = !active || captureBusy;
  els.intervalStartBtn.disabled = !active || project.intervalSeconds <= 0;
}
function updateCameraMeta() {
  const settings = camera.getSettings();
  const dims = settings.width && settings.height ? `${settings.width}×${settings.height}` : 'Çözünürlük otomatik';
  const fps = settings.frameRate ? ` · ${Math.round(settings.frameRate)} fps kamera` : '';
  const zoom = settings.zoom ? ` · ${Number(settings.zoom).toFixed(1)}×` : '';
  els.cameraMeta.textContent = `${dims}${fps}${zoom}`;
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
  stopIntervalCapture();
  try {
    await camera.restart({ resolution: project.resolution, deviceId: els.cameraDeviceSelect.value });
    setCameraUi(true);
    await refreshCameraCapabilities({ applySaved: true });
    updateCameraMeta(); updateStageAspect();
  } catch (error) { showToast(`Kamera ayarı uygulanamadı: ${friendlyCameraError(error)}`); }
}
function friendlyCameraError(error) {
  if (error?.name === 'NotAllowedError') return 'Kamera izni verilmedi.';
  if (error?.name === 'NotFoundError') return 'Uygun kamera bulunamadı.';
  if (error?.name === 'NotReadableError') return 'Kamera başka bir uygulama tarafından kullanılıyor olabilir.';
  if (error?.name === 'OverconstrainedError') return 'Seçilen kamera ayarı desteklenmiyor.';
  return error?.message || 'Bilinmeyen kamera hatası.';
}
async function refreshCameraCapabilities({ applySaved = false } = {}) {
  const caps = camera.getCapabilities();
  const settings = camera.getSettings();
  const zoom = caps.zoom;
  const zoomSupported = Boolean(zoom && Number.isFinite(Number(zoom.min)) && Number.isFinite(Number(zoom.max)));
  els.zoomInput.disabled = !zoomSupported;
  if (zoomSupported) {
    els.zoomInput.min = String(zoom.min);
    els.zoomInput.max = String(zoom.max);
    els.zoomInput.step = String(zoom.step || 0.1);
    const desired = project.cameraZoom == null ? Number(settings.zoom || zoom.min) : clamp(project.cameraZoom, zoom.min, zoom.max);
    els.zoomInput.value = String(desired);
    els.zoomValue.textContent = `${desired.toFixed(1)}×`;
    els.zoomSupport.textContent = 'Optik kamera zoom';
    if (applySaved && project.cameraZoom != null) try { await camera.setZoom(desired); } catch { }
  } else {
    els.zoomInput.value = '1'; els.zoomValue.textContent = '1.0×'; els.zoomSupport.textContent = 'Bu kamerada yok';
  }

  const exposureModes = Array.isArray(caps.exposureMode) ? caps.exposureMode : [];
  const wbModes = Array.isArray(caps.whiteBalanceMode) ? caps.whiteBalanceMode : [];
  els.exposureLockBtn.disabled = !exposureModes.length;
  els.whiteBalanceLockBtn.disabled = !wbModes.length;
  updateLockButtons();
  if (applySaved) {
    if (project.exposureLocked && exposureModes.length) try { await camera.setExposureLock(true); } catch { project.exposureLocked = false; }
    if (project.whiteBalanceLocked && wbModes.length) try { await camera.setWhiteBalanceLock(true); } catch { project.whiteBalanceLocked = false; }
    updateLockButtons();
  }
}
function updateLockButtons() {
  els.exposureLockBtn.classList.toggle('active', project.exposureLocked);
  els.exposureLockBtn.textContent = project.exposureLocked ? 'Pozlama 🔒' : 'Pozlama kilidi';
  els.whiteBalanceLockBtn.classList.toggle('active', project.whiteBalanceLocked);
  els.whiteBalanceLockBtn.textContent = project.whiteBalanceLocked ? 'Beyaz ayarı 🔒' : 'Beyaz ayarı kilidi';
}
async function toggleExposureLock() {
  if (!camera.active) return showToast('Önce kamerayı aç.');
  const next = !project.exposureLocked;
  try { await camera.setExposureLock(next); project.exposureLocked = next; updateLockButtons(); updateCameraMeta(); markDirty(); }
  catch (error) { showToast(error.message); }
}
async function toggleWhiteBalanceLock() {
  if (!camera.active) return showToast('Önce kamerayı aç.');
  const next = !project.whiteBalanceLocked;
  try { await camera.setWhiteBalanceLock(next); project.whiteBalanceLocked = next; updateLockButtons(); markDirty(); }
  catch (error) { showToast(error.message); }
}
async function applyZoom() {
  if (!camera.active || els.zoomInput.disabled) return;
  try {
    const value = Number(els.zoomInput.value);
    await camera.setZoom(value);
    project.cameraZoom = value;
    els.zoomValue.textContent = `${value.toFixed(1)}×`;
    updateCameraMeta(); markDirty();
  } catch (error) { showToast(error.message); }
}

async function captureFrame({ skipTimer = false } = {}) {
  if (!camera.active || captureBusy) {
    if (!camera.active) showToast('Önce kamerayı aç.');
    return false;
  }
  captureBusy = true; els.captureBtn.disabled = true;
  try {
    if (!skipTimer && project.timerSeconds > 0) await runCountdown(project.timerSeconds);
    const dataUrl = camera.capture(els.captureCanvas, { mirror: project.mirror, aspectRatio: project.aspectRatio, quality: 0.92 });
    addFrame(dataUrl); flashCapture(); return true;
  } catch (error) {
    showToast(error.message); return false;
  } finally {
    captureBusy = false; els.captureBtn.disabled = !camera.active;
  }
}
function runCountdown(seconds) {
  return new Promise(resolve => {
    let value = seconds;
    els.countdown.style.display = 'grid'; els.countdown.textContent = String(value);
    const id = setInterval(() => {
      value -= 1;
      if (value <= 0) { clearInterval(id); els.countdown.style.display = 'none'; resolve(); }
      else els.countdown.textContent = String(value);
    }, 1000);
  });
}
function flashCapture() { els.recordFlash.classList.remove('flash'); void els.recordFlash.offsetWidth; els.recordFlash.classList.add('flash'); }
function startIntervalCapture() {
  if (intervalActive) return stopIntervalCapture();
  if (!camera.active) return showToast('Interval çekim için önce kamerayı aç.');
  if (project.intervalSeconds <= 0) return showToast('Bir interval süresi seç.');
  intervalActive = true;
  els.intervalStartBtn.classList.add('active'); els.intervalStartBtn.textContent = 'Interval Durdur';
  refreshControlReadouts();
  showToast(`Interval çekim başladı: her ${project.intervalSeconds} saniyede bir kare.`);
  scheduleIntervalShot();
}
function scheduleIntervalShot() {
  clearTimeout(intervalTimer);
  if (!intervalActive) return;
  intervalTimer = setTimeout(async () => {
    if (!intervalActive) return;
    await captureFrame({ skipTimer: true });
    scheduleIntervalShot();
  }, Math.max(250, project.intervalSeconds * 1000));
}
function stopIntervalCapture() {
  clearTimeout(intervalTimer); intervalTimer = 0;
  if (!intervalActive) return;
  intervalActive = false;
  els.intervalStartBtn.classList.remove('active'); els.intervalStartBtn.textContent = 'Interval Başlat';
  refreshControlReadouts();
}

async function importPhotos(files) {
  const list = [...(files || [])].filter(file => file.type.startsWith('image/'));
  if (!list.length) return;
  stopPlayback();
  pushHistory();
  els.importPhotosBtn.disabled = true;
  const original = els.importPhotosBtn.textContent;
  try {
    for (let i = 0; i < list.length; i += 1) {
      els.importPhotosBtn.textContent = `Aktarılıyor ${i + 1}/${list.length}`;
      const image = await loadImageFile(list[i]);
      const dataUrl = imageToProjectFrame(image);
      project.frames.push({ id: crypto.randomUUID(), dataUrl, hold: 1, createdAt: Date.now(), imported: true });
      if (image.close) image.close();
      await delay(0);
    }
    selectedIndex = project.frames.length - 1;
    timeline.setFrames(project.frames, selectedIndex); renderStage(); markDirty();
    showToast(`${list.length} fotoğraf projeye eklendi.`);
  } catch (error) {
    showToast(`Fotoğraf içe aktarılamadı: ${error.message}`);
  } finally {
    els.importPhotosBtn.disabled = false; els.importPhotosBtn.textContent = original; els.photoImportInput.value = '';
  }
}
async function loadImageFile(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { }
  }
  const url = URL.createObjectURL(file);
  try { return await loadImage(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
}
function imageToProjectFrame(image) {
  const canvas = els.workCanvas;
  const raw = drawSourceToCanvas(image, canvas, { mirror: false, aspectRatio: project.aspectRatio, quality: 0.92 });
  const max = resolutionMax(project.resolution, project.aspectRatio);
  if (canvas.width <= max.width && canvas.height <= max.height) return raw;
  const scale = Math.min(max.width / canvas.width, max.height / canvas.height);
  const temp = document.createElement('canvas'); temp.width = Math.round(canvas.width * scale); temp.height = Math.round(canvas.height * scale);
  temp.getContext('2d', { alpha: false }).drawImage(canvas, 0, 0, temp.width, temp.height);
  return temp.toDataURL('image/jpeg', 0.92);
}
function resolutionMax(resolution, aspect) {
  const h = Number(resolution) || 1080;
  const ratio = aspect === '4:3' ? 4 / 3 : aspect === '1:1' ? 1 : 16 / 9;
  return { width: Math.round(h * ratio), height: h };
}

function play() {
  if (!project.frames.length) return;
  if (playing) return stopPlayback();
  playbackSequence = buildPlaybackSlots();
  if (!playbackSequence.length) return;
  playing = true; els.playBtn.textContent = '❚❚';
  const initialSlot = Math.max(0, playbackSequence.findIndex(index => index === selectedIndex));
  playbackStart = performance.now() - (initialSlot * 1000 / Math.max(1, project.fps));
  lastPlaybackSlot = -1;
  const tick = now => {
    if (!playing) return;
    const slot = Math.floor(((now - playbackStart) * Math.max(1, project.fps)) / 1000) % playbackSequence.length;
    if (slot !== lastPlaybackSlot) {
      selectedIndex = playbackSequence[slot]; lastPlaybackSlot = slot; timeline.select(selectedIndex); renderStage();
      els.playbackPosition.textContent = formatTime(slot / Math.max(1, project.fps));
    }
    playbackRaf = requestAnimationFrame(tick);
  };
  playbackRaf = requestAnimationFrame(tick);
}
function stopPlayback() {
  if (playbackRaf) cancelAnimationFrame(playbackRaf);
  playbackRaf = 0;
  if (!playing) return;
  playing = false; els.playBtn.textContent = '▶'; renderStage();
}

function openProjectFile() { els.projectFileInput.value = ''; els.projectFileInput.click(); }
async function handleProjectFile(file) {
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!parsed || !Array.isArray(parsed.frames)) throw new Error('Geçersiz proje dosyası.');
    loadProjectState(parsed); await saveLocalProject(project); showToast('Proje açıldı.');
  } catch (error) { showToast(`Proje açılamadı: ${error.message}`); }
}
function newProject() {
  if (dirty && !confirm('Kaydedilmemiş değişiklikler var. Yeni projeye geçilsin mi?')) return;
  stopIntervalCapture(); loadProjectState(createProject()); showToast('Yeni proje oluşturuldu.');
}
function exportProjectFile() {
  syncProjectFromControls();
  downloadBlob(new Blob([JSON.stringify(project)], { type: 'application/json' }), `${safeFileName(project.name)}.aefs.json`);
  els.exportDialog.close(); showToast('Proje dosyası indirildi.');
}
async function exportSelectedFrame() {
  const frame = project.frames[selectedIndex];
  if (!frame) return;
  try {
    const image = await loadImage(frame.dataUrl);
    const canvas = els.exportCanvas; canvas.width = image.naturalWidth || image.width; canvas.height = image.naturalHeight || image.height;
    renderImageToCanvas(image, canvas, canvas.width, canvas.height);
    const blob = await canvasToBlob(canvas, 'image/jpeg', 0.94);
    downloadBlob(blob, `${safeFileName(project.name)}-kare-${String(selectedIndex + 1).padStart(3, '0')}.jpg`);
    els.exportDialog.close();
  } catch (error) { showToast(`Kare dışa aktarılamadı: ${error.message}`); }
}

function findRecorderMime(format) {
  if (!window.MediaRecorder?.isTypeSupported) return null;
  const candidates = format === 'mp4'
    ? ['video/mp4;codecs=avc1.42E01E', 'video/mp4;codecs=avc1', 'video/mp4']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return candidates.find(type => MediaRecorder.isTypeSupported(type)) || null;
}
async function exportRecordedVideo(format) {
  if (!project.frames.length) return;
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return showToast('Bu tarayıcı canvas video kaydını desteklemiyor.');
  const mime = findRecorderMime(format);
  if (!mime) return showToast(format === 'mp4' ? 'Bu tarayıcı MP4 kodlamayı desteklemiyor. GIF veya WebM kullanabilirsin.' : 'Bu tarayıcı WebM kodlamayı desteklemiyor.');
  const button = format === 'mp4' ? els.exportMp4Btn : els.exportWebmBtn;
  const label = button.querySelector('strong'); const original = label.textContent;
  button.disabled = true;
  try {
    const items = buildPlaybackItems();
    const first = await loadImage(items[0].frame.dataUrl);
    const canvas = els.exportCanvas; canvas.width = first.naturalWidth || first.width; canvas.height = first.naturalHeight || first.height;
    const stream = canvas.captureStream(project.fps);
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000 });
    const chunks = [];
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = event => reject(event.error || new Error('Video kaydı başarısız.')); });
    recorder.start(1000);
    const frameMs = 1000 / Math.max(1, project.fps);
    let doneUnits = 0; const totalUnits = items.reduce((sum, item) => sum + item.hold, 0);
    for (const item of items) {
      const image = await loadImage(item.frame.dataUrl);
      renderImageToCanvas(image, canvas, canvas.width, canvas.height);
      doneUnits += item.hold;
      label.textContent = `${format.toUpperCase()} hazırlanıyor… ${Math.round(doneUnits / totalUnits * 100)}%`;
      await delay(frameMs * item.hold);
    }
    await delay(frameMs); recorder.stop(); await stopped;
    downloadBlob(new Blob(chunks, { type: mime }), `${safeFileName(project.name)}.${format}`);
    els.exportDialog.close(); showToast(`${format.toUpperCase()} video hazırlandı.`);
  } catch (error) { showToast(`${format.toUpperCase()} oluşturulamadı: ${error.message}`); }
  finally { button.disabled = false; label.textContent = original; }
}
async function exportGif() {
  if (!project.frames.length) return;
  const label = els.exportGifBtn.querySelector('strong'); const original = label.textContent;
  els.exportGifBtn.disabled = true;
  try {
    const items = buildPlaybackItems();
    const first = await loadImage(items[0].frame.dataUrl);
    const sourceW = first.naturalWidth || first.width, sourceH = first.naturalHeight || first.height;
    const maxW = 640; const scale = Math.min(1, maxW / sourceW);
    const width = Math.max(2, Math.round(sourceW * scale)); const height = Math.max(2, Math.round(sourceH * scale));
    const canvas = els.exportCanvas; canvas.width = width; canvas.height = height;
    const encoder = new GifEncoder(width, height, { loop: 0 });
    for (let i = 0; i < items.length; i += 1) {
      const image = await loadImage(items[i].frame.dataUrl);
      renderImageToCanvas(image, canvas, width, height);
      encoder.addFrame(canvas.getContext('2d').getImageData(0, 0, width, height), (items[i].hold * 1000) / Math.max(1, project.fps));
      label.textContent = `GIF hazırlanıyor… ${Math.round((i + 1) / items.length * 100)}%`;
      await delay(0);
    }
    downloadBlob(encoder.finish(), `${safeFileName(project.name)}.gif`);
    els.exportDialog.close(); showToast('GIF hazırlandı.');
  } catch (error) { showToast(`GIF oluşturulamadı: ${error.message}`); }
  finally { els.exportGifBtn.disabled = false; label.textContent = original; }
}
function renderImageToCanvas(image, canvas, width, height) {
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.save();
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
  ctx.filter = previewFilter(); ctx.drawImage(image, 0, 0, width, height); ctx.filter = 'none';
  applyWarmth(ctx, width, height); ctx.restore();
}
function applyWarmth(ctx, width, height) {
  const warmth = Number(project.color.warmth) || 0;
  if (!warmth) return;
  ctx.save(); ctx.globalCompositeOperation = 'soft-light';
  const alpha = Math.min(0.24, Math.abs(warmth) / 100 * 0.24);
  ctx.fillStyle = warmth > 0 ? `rgba(255,105,30,${alpha})` : `rgba(40,105,255,${alpha})`;
  ctx.fillRect(0, 0, width, height); ctx.restore();
}
function resetColor() {
  pushHistory();
  project.color = { brightness: 0, contrast: 0, saturation: 0, warmth: 0 };
  applyProjectToControls(); renderStage(); markDirty();
}

function loadImage(src) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Kare okunamadı.')); img.src = src; }); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function safeFileName(value) { return (value || 'film').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80); }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500); }
function canvasToBlob(canvas, type, quality) { return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Dosya oluşturulamadı.')), type, quality)); }
function clamp(value, min, max) { return Math.min(Number(max), Math.max(Number(min), Number(value))); }
function closeMobileSettings() { els.sidePanel.classList.remove('open'); }
function isTypingTarget() { return ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName); }

els.settingsBtn.addEventListener('click', () => els.sidePanel.classList.toggle('open'));
els.closeSettingsBtn.addEventListener('click', closeMobileSettings);
els.emptyCameraBtn.addEventListener('click', toggleCamera);
els.undoBtn.addEventListener('click', undo); els.redoBtn.addEventListener('click', redo);
els.newProjectBtn.addEventListener('click', newProject); els.mobileNewProjectBtn.addEventListener('click', () => { closeMobileSettings(); newProject(); });
els.openProjectBtn.addEventListener('click', openProjectFile); els.mobileOpenProjectBtn.addEventListener('click', () => { closeMobileSettings(); openProjectFile(); });
els.saveProjectBtn.addEventListener('click', manualSave); els.mobileSaveProjectBtn.addEventListener('click', () => { closeMobileSettings(); manualSave(); }); els.mobileUndoBtn.addEventListener('click', undo);
els.exportBtn.addEventListener('click', () => els.exportDialog.showModal()); els.shortcutsBtn.addEventListener('click', () => els.shortcutsDialog.showModal());
els.exportMp4Btn.addEventListener('click', () => exportRecordedVideo('mp4')); els.exportWebmBtn.addEventListener('click', () => exportRecordedVideo('webm')); els.exportGifBtn.addEventListener('click', exportGif); els.exportProjectBtn.addEventListener('click', exportProjectFile); els.exportFrameBtn.addEventListener('click', exportSelectedFrame);
document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.closeDialog)?.close()));
els.projectFileInput.addEventListener('change', event => handleProjectFile(event.target.files?.[0]));
els.photoImportInput.addEventListener('change', event => importPhotos(event.target.files)); els.importPhotosBtn.addEventListener('click', () => els.photoImportInput.click());
els.cameraToggleBtn.addEventListener('click', toggleCamera); els.captureBtn.addEventListener('click', () => captureFrame());
els.switchCameraBtn.addEventListener('click', async () => {
  if (!camera.active) return showToast('Önce kamerayı aç.');
  stopIntervalCapture();
  try { await camera.switchCamera({ resolution: project.resolution }); els.cameraDeviceSelect.value = ''; setCameraUi(true); await refreshCameraDevices(); await refreshCameraCapabilities({ applySaved: true }); updateCameraMeta(); updateStageAspect(); renderStage(); }
  catch (error) { showToast(friendlyCameraError(error)); }
});
els.cameraDeviceSelect.addEventListener('change', restartCamera);
els.fullscreenBtn.addEventListener('click', async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await els.stage.requestFullscreen?.(); } catch { showToast('Tam ekran bu cihazda kullanılamıyor.'); } });
els.timerBtn.addEventListener('click', () => { const options = [0, 2, 3, 5, 10]; const current = options.indexOf(project.timerSeconds); project.timerSeconds = options[(current + 1) % options.length]; els.timerSelect.value = String(project.timerSeconds); refreshControlReadouts(); markDirty(); });
els.intervalStartBtn.addEventListener('click', startIntervalCapture);
els.intervalSelect.addEventListener('change', () => { stopIntervalCapture(); syncProjectFromControls(); markDirty(); });
els.zoomInput.addEventListener('input', () => { els.zoomValue.textContent = `${Number(els.zoomInput.value).toFixed(1)}×`; }); els.zoomInput.addEventListener('change', applyZoom);
els.exposureLockBtn.addEventListener('click', toggleExposureLock); els.whiteBalanceLockBtn.addEventListener('click', toggleWhiteBalanceLock);
els.fpsInput.addEventListener('input', () => { syncProjectFromControls(); renderStage(); }); els.fpsInput.addEventListener('change', markDirty);
els.onionInput.addEventListener('input', () => { syncProjectFromControls(); renderStage(); }); els.onionInput.addEventListener('change', markDirty);
els.gridToggle.addEventListener('change', () => { pushHistory(); syncProjectFromControls(); markDirty(); }); els.mirrorToggle.addEventListener('change', () => { pushHistory(); syncProjectFromControls(); markDirty(); });
els.aspectSelect.addEventListener('change', () => { pushHistory(); syncProjectFromControls(); renderStage(); markDirty(); }); els.timerSelect.addEventListener('change', () => { syncProjectFromControls(); markDirty(); });
els.resolutionSelect.addEventListener('change', async () => { syncProjectFromControls(); markDirty(); await restartCamera(); }); els.projectName.addEventListener('input', () => { syncProjectFromControls(); markDirty(); });
els.duplicateBtn.addEventListener('click', duplicateSelected); els.deleteFrameBtn.addEventListener('click', deleteSelected); els.moveLeftBtn.addEventListener('click', () => moveFrame(selectedIndex, selectedIndex - 1)); els.moveRightBtn.addEventListener('click', () => moveFrame(selectedIndex, selectedIndex + 1));
els.previousBtn.addEventListener('click', () => selectFrame(selectedIndex - 1)); els.nextBtn.addEventListener('click', () => selectFrame(selectedIndex + 1)); els.playBtn.addEventListener('click', play); els.goStartBtn.addEventListener('click', () => project.frames.length && selectFrame(project.playbackMode === 'reverse' ? project.frames.length - 1 : 0));
els.timelineZoom.addEventListener('input', () => timeline.setZoom(els.timelineZoom.value)); els.freezeSelect.addEventListener('change', setSelectedFreeze);
els.playbackModeSelect.addEventListener('change', () => { pushHistory(); syncProjectFromControls(); renderStage(); markDirty(); });
[els.brightnessInput, els.contrastInput, els.saturationInput, els.warmthInput].forEach(input => input.addEventListener('input', () => { syncProjectFromControls(); renderStage(); }));
[els.brightnessInput, els.contrastInput, els.saturationInput, els.warmthInput].forEach(input => input.addEventListener('change', markDirty)); els.resetColorBtn.addEventListener('click', resetColor);
els.collapseTimelineBtn.addEventListener('click', () => { const collapsed = els.timelineDock.classList.toggle('collapsed'); els.collapseTimelineBtn.setAttribute('aria-expanded', String(!collapsed)); document.documentElement.style.setProperty('--timeline-h', collapsed ? '46px' : (matchMedia('(max-width: 860px)').matches ? '172px' : '202px')); });

window.addEventListener('keydown', event => {
  const mod = event.ctrlKey || event.metaKey;
  if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); manualSave(); return; }
  if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  if (isTypingTarget()) return;
  if (event.code === 'Space') { event.preventDefault(); captureFrame(); }
  else if (event.key.toLowerCase() === 'p') { event.preventDefault(); play(); }
  else if (event.key.toLowerCase() === 'i') { event.preventDefault(); startIntervalCapture(); }
  else if (event.key === 'ArrowLeft') selectFrame(selectedIndex - 1);
  else if (event.key === 'ArrowRight') selectFrame(selectedIndex + 1);
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); deleteSelected(); }
  else if (event.key === 'Escape') { stopIntervalCapture(); closeMobileSettings(); }
});
window.addEventListener('beforeunload', event => { if (!dirty) return; event.preventDefault(); event.returnValue = ''; });
window.addEventListener('resize', updateStageAspect);

async function init() {
  timeline.setFrames([], -1); timeline.setZoom(els.timelineZoom.value);
  applyProjectToControls(); renderStage(); setCameraUi(false); updateHistoryButtons(); refreshCameraCapabilities();
  try { const latest = await getLatestProject(); if (latest) { loadProjectState(latest); showToast('Son proje otomatik olarak geri yüklendi.'); } } catch { }
  try { await navigator.storage?.persist?.(); } catch { }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
}
init();
