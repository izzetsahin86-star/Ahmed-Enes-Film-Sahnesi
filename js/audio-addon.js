import { getLatestProject } from './project-store.js';

const $ = selector => document.querySelector(selector);
const els = {
  playBtn: $('#playBtn'), playbackPosition: $('#playbackPosition'), saveProjectBtn: $('#saveProjectBtn'),
  newProjectBtn: $('#newProjectBtn'), projectFileInput: $('#projectFileInput'),
  musicImportBtn: $('#musicImportBtn'), soundImportBtn: $('#soundImportBtn'), micRecordBtn: $('#micRecordBtn'),
  musicFileInput: $('#musicFileInput'), soundFileInput: $('#soundFileInput'),
  masterVolume: $('#masterVolume'), masterVolumeValue: $('#masterVolumeValue'),
  musicVolume: $('#musicVolume'), musicVolumeValue: $('#musicVolumeValue'), musicLoopToggle: $('#musicLoopToggle'),
  musicStartInput: $('#musicStartInput'), musicInfo: $('#musicInfo'), removeMusicBtn: $('#removeMusicBtn'),
  audioClipList: $('#audioClipList'), audioEmpty: $('#audioEmpty'), audioStatus: $('#audioStatus'), audioSize: $('#audioSize'),
  exportMp4Btn: $('#exportMp4Btn'), exportWebmBtn: $('#exportWebmBtn'), exportProjectBtn: $('#exportProjectBtn'),
  exportCanvas: $('#exportCanvas'), toast: $('#toast')
};

const DB_NAME = 'aefs-audio-studio';
const STORE = 'audioProjects';
const VERSION = 1;
const DEFAULT_STATE = () => ({ version: 1, masterVolume: 0.9, music: null, clips: [] });

let state = DEFAULT_STATE();
let currentProjectKey = 'session-default';
let previewContext = null;
let previewSources = [];
let recorder = null;
let recorderStream = null;
let recorderChunks = [];
let recorderStart = 0;
let toastTimer = 0;
let draftStartedAt = 0;
const decodedCache = new Map();

function showToast(message) {
  if (!els.toast) return;
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.classList.add('show');
  toastTimer = setTimeout(() => els.toast.classList.remove('show'), 3200);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'projectId' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function loadStored(projectId) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(projectId);
    req.onsuccess = () => resolve(req.result?.state || null);
    req.onerror = () => reject(req.error);
  });
}
async function storeState(projectId = currentProjectKey) {
  const db = await openDb();
  const clean = serializableState();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ projectId, state: clean, updatedAt: Date.now() });
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function normalizeState(input = {}) {
  return {
    ...DEFAULT_STATE(),
    ...input,
    masterVolume: clampNumber(input.masterVolume, 0, 1, 0.9),
    music: input.music ? {
      ...input.music,
      volume: clampNumber(input.music.volume, 0, 1, 0.7),
      start: Math.max(0, Number(input.music.start) || 0),
      loop: input.music.loop !== false
    } : null,
    clips: Array.isArray(input.clips) ? input.clips.map(clip => ({
      ...clip,
      id: clip.id || crypto.randomUUID(),
      start: Math.max(0, Number(clip.start) || 0),
      volume: clampNumber(clip.volume, 0, 1, 0.9),
      duration: Math.max(0, Number(clip.duration) || 0)
    })) : []
  };
}
function serializableState() {
  return {
    version: 1,
    masterVolume: state.masterVolume,
    music: state.music ? { ...state.music } : null,
    clips: state.clips.map(clip => ({ ...clip }))
  };
}
async function persist() {
  try { await storeState(); } catch { }
  renderAudioUi();
}
async function resolveCurrentProject({ migrate = true } = {}) {
  try {
    const latest = await getLatestProject();
    if (!latest?.id) return null;
    if (currentProjectKey.startsWith('draft-')) {
      const belongsToDraft = !draftStartedAt || Number(latest.createdAt || 0) >= draftStartedAt - 1000;
      if (migrate && belongsToDraft) {
        currentProjectKey = latest.id;
        draftStartedAt = 0;
        await storeState(latest.id);
      }
    } else currentProjectKey = latest.id;
    return latest;
  } catch { return null; }
}

function renderAudioUi() {
  if (!els.audioClipList) return;
  els.masterVolume.value = String(Math.round(state.masterVolume * 100));
  els.masterVolumeValue.textContent = `${Math.round(state.masterVolume * 100)}%`;
  const music = state.music;
  els.musicVolume.disabled = !music;
  els.musicLoopToggle.disabled = !music;
  els.musicStartInput.disabled = !music;
  els.removeMusicBtn.disabled = !music;
  els.musicVolume.value = String(Math.round((music?.volume ?? 0.7) * 100));
  els.musicVolumeValue.textContent = `${Math.round((music?.volume ?? 0.7) * 100)}%`;
  els.musicLoopToggle.checked = music?.loop !== false;
  els.musicStartInput.value = String(music?.start ?? 0);
  els.musicInfo.innerHTML = music
    ? `<strong>${escapeHtml(music.name || 'Müzik')}</strong><span>${formatDuration(music.duration)} · ${formatBytes(dataUrlBytes(music.dataUrl))}</span>`
    : '<strong>Müzik yok</strong><span>MP3, M4A, WAV veya tarayıcının okuyabildiği ses dosyası</span>';

  els.audioClipList.innerHTML = '';
  for (const clip of state.clips) els.audioClipList.append(createClipRow(clip));
  els.audioEmpty.hidden = state.clips.length > 0;
  els.audioSize.textContent = formatBytes(audioBytes());
  els.audioStatus.textContent = `${state.clips.length} klip${music ? ' · müzik aktif' : ''}`;
}
function createClipRow(clip) {
  const row = document.createElement('div');
  row.className = 'audio-clip-row';
  row.dataset.id = clip.id;
  const icon = clip.kind === 'voice' ? '🎙' : clip.kind === 'effect' ? '✦' : '♪';
  row.innerHTML = `
    <div class="audio-clip-main"><span class="audio-kind">${icon}</span><div><strong>${escapeHtml(clip.name || 'Ses')}</strong><small>${clip.kind === 'effect' ? 'Üretilen efekt' : formatDuration(clip.duration)}</small></div></div>
    <label class="audio-mini-field"><span>Başlangıç</span><input data-role="start" type="number" min="0" step="0.1" value="${Number(clip.start).toFixed(1)}"></label>
    <label class="audio-volume-field"><span>Ses</span><input data-role="volume" type="range" min="0" max="100" value="${Math.round(clip.volume * 100)}"></label>
    <div class="audio-row-actions"><button type="button" data-role="preview" title="Dinle">▶</button><button type="button" data-role="delete" title="Sil">×</button></div>`;
  row.querySelector('[data-role="start"]').addEventListener('change', async event => {
    clip.start = Math.max(0, Number(event.target.value) || 0); await persist();
  });
  row.querySelector('[data-role="volume"]').addEventListener('input', event => { clip.volume = Number(event.target.value) / 100; });
  row.querySelector('[data-role="volume"]').addEventListener('change', persist);
  row.querySelector('[data-role="preview"]').addEventListener('click', () => previewSingleClip(clip));
  row.querySelector('[data-role="delete"]').addEventListener('click', async () => {
    state.clips = state.clips.filter(item => item.id !== clip.id); stopPreviewAudio(); await persist();
  });
  return row;
}

async function importMusic(file) {
  if (!file) return;
  try {
    const dataUrl = await fileToDataUrl(file);
    const duration = await getAudioDuration(dataUrl);
    state.music = { name: file.name, dataUrl, mime: file.type, duration, volume: 0.7, start: 0, loop: true };
    decodedCache.delete(dataUrl);
    await persist();
    showToast('Müzik projeye eklendi.');
  } catch (error) { showToast(`Müzik eklenemedi: ${error.message}`); }
  finally { els.musicFileInput.value = ''; }
}
async function importSound(file) {
  if (!file) return;
  try {
    const dataUrl = await fileToDataUrl(file);
    const duration = await getAudioDuration(dataUrl);
    state.clips.push({ id: crypto.randomUUID(), kind: 'file', name: file.name, dataUrl, mime: file.type, duration, start: currentPlayheadSeconds(), volume: 0.9 });
    await persist();
    showToast('Ses dosyası oynatma konumuna eklendi.');
  } catch (error) { showToast(`Ses eklenemedi: ${error.message}`); }
  finally { els.soundFileInput.value = ''; }
}
async function addEffect(effect) {
  const names = { click: 'Klik', pop: 'Pop', whoosh: 'Whoosh', beep: 'Beep', shutter: 'Kamera' };
  state.clips.push({ id: crypto.randomUUID(), kind: 'effect', effect, name: names[effect] || effect, duration: effectDuration(effect), start: currentPlayheadSeconds(), volume: 0.9 });
  await persist();
  showToast(`${names[effect] || 'Efekt'} eklendi.`);
}

async function toggleMicRecording() {
  if (recorder?.state === 'recording') return stopMicRecording();
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return showToast('Bu tarayıcı mikrofon kaydını desteklemiyor.');
  try {
    recorderStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    const mime = findAudioMime();
    recorder = mime ? new MediaRecorder(recorderStream, { mimeType: mime }) : new MediaRecorder(recorderStream);
    recorderChunks = [];
    recorderStart = currentPlayheadSeconds();
    recorder.ondataavailable = event => { if (event.data?.size) recorderChunks.push(event.data); };
    recorder.onstop = finalizeMicRecording;
    recorder.start(250);
    els.micRecordBtn.classList.add('recording');
    els.micRecordBtn.innerHTML = '<span>■</span><b>Kaydı Durdur</b>';
    showToast('Mikrofon kaydı başladı.');
  } catch (error) { showToast(`Mikrofon açılamadı: ${error.message}`); cleanupRecorder(); }
}
function stopMicRecording() { if (recorder?.state === 'recording') recorder.stop(); }
async function finalizeMicRecording() {
  try {
    const type = recorder?.mimeType || recorderChunks[0]?.type || 'audio/webm';
    const blob = new Blob(recorderChunks, { type });
    if (!blob.size) throw new Error('Kayıt boş.');
    const dataUrl = await blobToDataUrl(blob);
    const duration = await getAudioDuration(dataUrl).catch(() => 0);
    state.clips.push({ id: crypto.randomUUID(), kind: 'voice', name: `Ses Kaydı ${state.clips.filter(c => c.kind === 'voice').length + 1}`, dataUrl, mime: type, duration, start: recorderStart, volume: 0.95 });
    await persist();
    showToast('Ses kaydı projeye eklendi.');
  } catch (error) { showToast(`Kayıt eklenemedi: ${error.message}`); }
  finally { cleanupRecorder(); }
}
function cleanupRecorder() {
  recorderStream?.getTracks?.().forEach(track => track.stop());
  recorderStream = null; recorder = null; recorderChunks = [];
  if (els.micRecordBtn) { els.micRecordBtn.classList.remove('recording'); els.micRecordBtn.innerHTML = '<span>●</span><b>Mikrofon Kaydı</b>'; }
}
function findAudioMime() {
  if (!MediaRecorder.isTypeSupported) return '';
  return ['audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find(type => MediaRecorder.isTypeSupported(type)) || '';
}

async function startPreviewAudio(offset = 0) {
  stopPreviewAudio();
  const duration = await movieDuration();
  if (!state.music && !state.clips.length) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return showToast('Bu tarayıcı Web Audio desteği sunmuyor.');
  previewContext = new Context();
  await previewContext.resume();
  await scheduleAllAudio(previewContext, previewContext.destination, offset, duration, previewSources);
}
function stopPreviewAudio() {
  previewSources.forEach(source => { try { source.stop?.(); } catch {} });
  previewSources = [];
  if (previewContext) { try { previewContext.close(); } catch {} }
  previewContext = null;
}
async function previewSingleClip(clip) {
  stopPreviewAudio();
  const Context = window.AudioContext || window.webkitAudioContext;
  if (!Context) return;
  previewContext = new Context();
  await previewContext.resume();
  const master = previewContext.createGain(); master.gain.value = state.masterVolume; master.connect(previewContext.destination);
  await scheduleClip(previewContext, master, clip, previewContext.currentTime + 0.02, 0, previewSources);
}

async function scheduleAllAudio(context, destination, offset, duration, collector = []) {
  const master = context.createGain();
  master.gain.value = state.masterVolume;
  master.connect(destination);
  const startAt = context.currentTime + 0.03;
  if (state.music) await scheduleMusic(context, master, state.music, startAt, offset, duration, collector);
  await scheduleClipBatch(context, master, offset, duration, collector, startAt);
  return master;
}
async function scheduleMusic(context, destination, music, when, offset, duration, collector) {
  const buffer = await decodeDataUrl(context, music.dataUrl);
  const gain = context.createGain(); gain.gain.value = music.volume; gain.connect(destination);
  const source = context.createBufferSource(); source.buffer = buffer; source.loop = music.loop !== false; source.connect(gain);
  const timelineStart = Number(music.start) || 0;
  const elapsed = Math.max(0, offset - timelineStart);
  const wait = Math.max(0, timelineStart - offset);
  if (!source.loop && elapsed >= buffer.duration) return;
  const bufferOffset = source.loop ? (elapsed % Math.max(0.001, buffer.duration)) : elapsed;
  source.start(when + wait, bufferOffset);
  collector.push(source);
  if (!source.loop && duration > 0) try { source.stop(when + Math.max(0, duration - offset) + 0.1); } catch {}
}
async function scheduleClipBatch(context, destination, offset, duration, collector, startAt = context.currentTime + 0.02) {
  for (const clip of state.clips) {
    if (clip.start < offset - 0.02) continue;
    if (duration > 0 && clip.start > duration) continue;
    await scheduleClip(context, destination, clip, startAt + Math.max(0, clip.start - offset), 0, collector);
  }
}
async function scheduleClip(context, destination, clip, when, sourceOffset, collector) {
  const gain = context.createGain(); gain.gain.value = clip.volume ?? 0.9; gain.connect(destination);
  if (clip.kind === 'effect') {
    const nodes = scheduleSynthEffect(context, gain, clip.effect, when);
    collector.push(...nodes);
    return;
  }
  const buffer = await decodeDataUrl(context, clip.dataUrl);
  const source = context.createBufferSource(); source.buffer = buffer; source.connect(gain); source.start(when, sourceOffset); collector.push(source);
}
function scheduleSynthEffect(context, destination, effect, when) {
  const nodes = [];
  if (effect === 'whoosh' || effect === 'shutter') {
    const duration = effectDuration(effect);
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = context.createBufferSource(); source.buffer = buffer;
    const filter = context.createBiquadFilter(); filter.type = effect === 'whoosh' ? 'bandpass' : 'highpass';
    filter.frequency.setValueAtTime(effect === 'whoosh' ? 450 : 1400, when);
    if (effect === 'whoosh') filter.frequency.exponentialRampToValueAtTime(2400, when + duration);
    const gain = context.createGain(); gain.gain.setValueAtTime(0.0001, when); gain.gain.exponentialRampToValueAtTime(effect === 'whoosh' ? 0.55 : 0.8, when + 0.02); gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter); filter.connect(gain); gain.connect(destination); source.start(when); nodes.push(source); return nodes;
  }
  const settings = {
    click: { f1: 1800, f2: 900, d: 0.07, type: 'square' },
    pop: { f1: 180, f2: 520, d: 0.14, type: 'sine' },
    beep: { f1: 880, f2: 880, d: 0.18, type: 'sine' }
  }[effect] || { f1: 660, f2: 330, d: 0.1, type: 'sine' };
  const osc = context.createOscillator(); osc.type = settings.type; osc.frequency.setValueAtTime(settings.f1, when); osc.frequency.exponentialRampToValueAtTime(Math.max(20, settings.f2), when + settings.d);
  const gain = context.createGain(); gain.gain.setValueAtTime(0.5, when); gain.gain.exponentialRampToValueAtTime(0.0001, when + settings.d);
  osc.connect(gain); gain.connect(destination); osc.start(when); osc.stop(when + settings.d); nodes.push(osc); return nodes;
}
function effectDuration(effect) { return ({ click: 0.08, pop: 0.16, whoosh: 0.55, beep: 0.2, shutter: 0.18 })[effect] || 0.12; }

async function exportWithAudio(format, event) {
  event.preventDefault(); event.stopImmediatePropagation();
  stopPreviewAudio();
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return showToast('Bu tarayıcı video kaydını desteklemiyor.');
  const project = await freshProject();
  if (!project?.frames?.length) return showToast('Dışa aktarılacak kare yok.');
  const mime = findVideoMime(format, hasAudio());
  if (!mime) return showToast(format === 'mp4' ? 'Bu tarayıcı sesli MP4 kodlamayı desteklemiyor. WebM deneyebilirsin.' : 'Bu tarayıcı WebM kodlamayı desteklemiyor.');
  const button = format === 'mp4' ? els.exportMp4Btn : els.exportWebmBtn;
  const label = button.querySelector('strong'); const original = label.textContent; button.disabled = true;
  let audioContext = null;
  try {
    const items = buildPlaybackItems(project);
    const first = await loadImage(items[0].frame.dataUrl);
    const canvas = els.exportCanvas; canvas.width = first.naturalWidth || first.width; canvas.height = first.naturalHeight || first.height;
    const videoStream = canvas.captureStream(project.fps || 12);
    let stream = videoStream;
    const audioSources = [];
    if (hasAudio()) {
      const Context = window.AudioContext || window.webkitAudioContext;
      audioContext = new Context();
      const destination = audioContext.createMediaStreamDestination();
      await audioContext.resume();
      await scheduleAllAudio(audioContext, destination, 0, projectDuration(project), audioSources);
      stream = new MediaStream([...videoStream.getVideoTracks(), ...destination.stream.getAudioTracks()]);
    }
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 10_000_000, audioBitsPerSecond: 192_000 });
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data?.size) chunks.push(e.data); };
    const stopped = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = e => reject(e.error || new Error('Kayıt hatası.')); });
    recorder.start(500);
    const frameMs = 1000 / Math.max(1, project.fps || 12);
    const totalUnits = items.reduce((sum, item) => sum + item.hold, 0);
    let done = 0;
    for (const item of items) {
      const image = await loadImage(item.frame.dataUrl);
      renderImageToCanvas(project, image, canvas, canvas.width, canvas.height);
      done += item.hold; label.textContent = `${format.toUpperCase()} + Ses… ${Math.round(done / totalUnits * 100)}%`;
      await delay(frameMs * item.hold);
    }
    await delay(frameMs); recorder.stop(); await stopped;
    downloadBlob(new Blob(chunks, { type: mime }), `${safeFileName(project.name)}.${format}`);
    document.getElementById('exportDialog')?.close();
    showToast(`${format.toUpperCase()}${hasAudio() ? ' + ses' : ''} hazırlandı.`);
  } catch (error) { showToast(`Dışa aktarma hatası: ${error.message}`); }
  finally { if (audioContext) try { await audioContext.close(); } catch {}; button.disabled = false; label.textContent = original; }
}
function findVideoMime(format, withAudio) {
  if (!MediaRecorder.isTypeSupported) return null;
  const mp4 = withAudio
    ? ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4']
    : ['video/mp4;codecs=avc1.42E01E', 'video/mp4'];
  const webm = withAudio
    ? ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  return (format === 'mp4' ? mp4 : webm).find(type => MediaRecorder.isTypeSupported(type)) || null;
}
async function exportProjectWithAudio(event) {
  event.preventDefault(); event.stopImmediatePropagation();
  const project = await freshProject();
  if (!project) return showToast('Proje okunamadı.');
  const merged = { ...project, audioStudio: serializableState() };
  downloadBlob(new Blob([JSON.stringify(merged)], { type: 'application/json' }), `${safeFileName(project.name)}.aefs.json`);
  document.getElementById('exportDialog')?.close();
  showToast('Sesleri içeren proje dosyası indirildi.');
}
async function freshProject() {
  try { els.saveProjectBtn?.click(); } catch {}
  await delay(220);
  return getLatestProject();
}
function buildPlaybackItems(project) {
  const base = project.frames.map((frame, index) => ({ frame, index, hold: Math.max(1, Number(frame.hold) || 1) }));
  if (project.playbackMode === 'reverse') return [...base].reverse();
  if (project.playbackMode === 'boomerang' && base.length > 1) return base.concat(base.slice(0, -1).reverse());
  return base;
}
function projectDuration(project) { return buildPlaybackItems(project).reduce((sum, item) => sum + item.hold, 0) / Math.max(1, project.fps || 12); }
async function movieDuration() { const project = await getLatestProject(); return project ? projectDuration(project) : 0; }
function renderImageToCanvas(project, image, canvas, width, height) {
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  const color = project.color || {};
  const b = Math.max(0.1, 1 + (Number(color.brightness) || 0) / 100);
  const c = Math.max(0.1, 1 + (Number(color.contrast) || 0) / 100);
  const s = Math.max(0, 1 + (Number(color.saturation) || 0) / 100);
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); ctx.filter = `brightness(${b}) contrast(${c}) saturate(${s})`; ctx.drawImage(image, 0, 0, width, height); ctx.filter = 'none';
  const warmth = Number(color.warmth) || 0;
  if (warmth) { ctx.save(); ctx.globalCompositeOperation = 'soft-light'; const alpha = Math.min(0.24, Math.abs(warmth) / 100 * 0.24); ctx.fillStyle = warmth > 0 ? `rgba(255,105,30,${alpha})` : `rgba(40,105,255,${alpha})`; ctx.fillRect(0, 0, width, height); ctx.restore(); }
}

function hasAudio() { return Boolean(state.music || state.clips.length); }
function currentPlayheadSeconds() { return parseTime(els.playbackPosition?.textContent || '00:00.0'); }
function parseTime(value) { const parts = String(value).split(':'); return Math.max(0, (Number(parts[0]) || 0) * 60 + (Number(parts[1]) || 0)); }
function audioBytes() { return dataUrlBytes(state.music?.dataUrl) + state.clips.reduce((sum, clip) => sum + dataUrlBytes(clip.dataUrl), 0); }
function dataUrlBytes(value) { if (!value) return 0; const comma = value.indexOf(','); const payload = comma >= 0 ? value.slice(comma + 1) : value; return Math.ceil(payload.length * 0.75); }
function formatBytes(bytes) { if (!bytes) return '0 KB'; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10240 ? 0 : 1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
function formatDuration(seconds) { if (!Number.isFinite(seconds) || seconds <= 0) return 'Süre bilinmiyor'; const min = Math.floor(seconds / 60); const sec = Math.round(seconds % 60); return min ? `${min}:${String(sec).padStart(2, '0')}` : `${sec} sn`; }
function clampNumber(value, min, max, fallback) { const n = Number(value); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; }
function escapeHtml(value) { return String(value).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char])); }
function safeFileName(value) { return (value || 'film').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function loadImage(src) { return new Promise((resolve, reject) => { const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('Kare okunamadı.')); img.src = src; }); }
function downloadBlob(blob, filename) { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1800); }
function fileToDataUrl(file) { return blobToDataUrl(file); }
function blobToDataUrl(blob) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı.')); reader.readAsDataURL(blob); }); }
async function getAudioDuration(dataUrl) { return new Promise((resolve, reject) => { const audio = new Audio(); audio.preload = 'metadata'; audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0); audio.onerror = () => reject(new Error('Ses dosyası okunamadı.')); audio.src = dataUrl; }); }
async function decodeDataUrl(context, dataUrl) {
  if (!dataUrl) throw new Error('Ses verisi yok.');
  if (decodedCache.has(dataUrl) && decodedCache.get(dataUrl).sampleRate === context.sampleRate) return decodedCache.get(dataUrl);
  const array = dataUrlToArrayBuffer(dataUrl);
  const buffer = await context.decodeAudioData(array.slice(0));
  decodedCache.set(dataUrl, buffer);
  return buffer;
}
function dataUrlToArrayBuffer(dataUrl) {
  const [head, body] = dataUrl.split(',');
  if (!body) throw new Error('Ses verisi bozuk.');
  const binary = head.includes(';base64') ? atob(body) : decodeURIComponent(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

els.musicImportBtn?.addEventListener('click', () => els.musicFileInput.click());
els.soundImportBtn?.addEventListener('click', () => els.soundFileInput.click());
els.musicFileInput?.addEventListener('change', e => importMusic(e.target.files?.[0]));
els.soundFileInput?.addEventListener('change', e => importSound(e.target.files?.[0]));
els.micRecordBtn?.addEventListener('click', toggleMicRecording);
document.querySelectorAll('[data-sfx]').forEach(button => button.addEventListener('click', () => addEffect(button.dataset.sfx)));
els.masterVolume?.addEventListener('input', () => { state.masterVolume = Number(els.masterVolume.value) / 100; els.masterVolumeValue.textContent = `${els.masterVolume.value}%`; });
els.masterVolume?.addEventListener('change', persist);
els.musicVolume?.addEventListener('input', () => { if (state.music) { state.music.volume = Number(els.musicVolume.value) / 100; els.musicVolumeValue.textContent = `${els.musicVolume.value}%`; } });
els.musicVolume?.addEventListener('change', persist);
els.musicLoopToggle?.addEventListener('change', async () => { if (state.music) { state.music.loop = els.musicLoopToggle.checked; await persist(); } });
els.musicStartInput?.addEventListener('change', async () => { if (state.music) { state.music.start = Math.max(0, Number(els.musicStartInput.value) || 0); await persist(); } });
els.removeMusicBtn?.addEventListener('click', async () => { state.music = null; stopPreviewAudio(); await persist(); });

els.playBtn?.addEventListener('click', () => {
  queueMicrotask(() => {
    const playingNow = els.playBtn.textContent.includes('❚');
    if (playingNow) startPreviewAudio(currentPlayheadSeconds()).catch(() => {}); else stopPreviewAudio();
  });
});
window.addEventListener('keydown', event => { if (event.key.toLowerCase() === 'p' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) queueMicrotask(() => els.playBtn?.textContent.includes('❚') ? startPreviewAudio(currentPlayheadSeconds()) : stopPreviewAudio()); });

els.exportMp4Btn?.addEventListener('click', event => exportWithAudio('mp4', event), { capture: true });
els.exportWebmBtn?.addEventListener('click', event => exportWithAudio('webm', event), { capture: true });
els.exportProjectBtn?.addEventListener('click', exportProjectWithAudio, { capture: true });
document.addEventListener('click', event => {
  if (event.target.closest('.frame-card,#previousBtn,#nextBtn,#goStartBtn,#deleteFrameBtn,#duplicateBtn,#moveLeftBtn,#moveRightBtn,#openProjectBtn')) stopPreviewAudio();
});
window.addEventListener('beforeunload', () => { stopPreviewAudio(); if (recorder?.state === 'recording') try { recorder.stop(); } catch {}; cleanupRecorder(); });

els.newProjectBtn?.addEventListener('click', () => {
  queueMicrotask(async () => {
    if (document.getElementById('saveStatus')?.textContent === 'Değişti') return;
    stopPreviewAudio();
    draftStartedAt = Date.now();
    currentProjectKey = `draft-${crypto.randomUUID()}`;
    state = DEFAULT_STATE();
    await persist();
  });
});
els.saveProjectBtn?.addEventListener('click', () => setTimeout(() => resolveCurrentProject({ migrate: true }).catch(() => {}), 180));
els.projectFileInput?.addEventListener('change', async event => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    draftStartedAt = 0;
    currentProjectKey = parsed.id || `import-${crypto.randomUUID()}`;
    const stored = await loadStored(currentProjectKey).catch(() => null);
    state = normalizeState(parsed.audioStudio || stored || DEFAULT_STATE());
    await persist();
  } catch { }
});

(async function initAudioStudio() {
  const latest = await resolveCurrentProject({ migrate: false });
  if (latest?.id) {
    const stored = await loadStored(latest.id).catch(() => null);
    state = normalizeState(latest.audioStudio || stored || DEFAULT_STATE());
  }
  renderAudioUi();
})();
