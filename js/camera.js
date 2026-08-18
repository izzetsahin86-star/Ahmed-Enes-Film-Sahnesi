const RESOLUTIONS = {
  720: { width: 1280, height: 720, minWidth: 960, minHeight: 540 },
  1080: { width: 1920, height: 1080, minWidth: 1280, minHeight: 720 },
  2160: { width: 3840, height: 2160, minWidth: 1920, minHeight: 1080 }
};

export class CameraController {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.facingMode = 'environment';
    this.deviceId = '';
    this.resolution = '1080';
  }

  get active() { return Boolean(this.stream); }
  get track() { return this.stream?.getVideoTracks?.()[0] || null; }

  async start(options = {}) {
    await this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Bu tarayıcı kamera erişimini desteklemiyor.');
    this.resolution = String(options.resolution || this.resolution || '1080');
    this.deviceId = options.deviceId ?? this.deviceId;
    const preset = RESOLUTIONS[this.resolution] || RESOLUTIONS[1080];

    // Önce gerçek HD çözünürlüğü koruyan daha güçlü kısıtları dene.
    // Cihaz bunu karşılayamazsa ideal kısıtlara otomatik geri dön.
    const strongVideo = this.buildVideoConstraints(preset, true);
    const fallbackVideo = this.buildVideoConstraints(preset, false);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: strongVideo });
    } catch (error) {
      if (!['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError'].includes(error?.name)) throw error;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: fallbackVideo });
    }

    const track = this.track;
    // Stop-motion için hareket akıcılığından çok uzamsal detay önemlidir.
    try { if (track && 'contentHint' in track) track.contentHint = 'detail'; } catch {}

    this.video.srcObject = this.stream;
    await this.video.play();
    await this.applyPreferredCameraModes();
    // Kamera açıldıktan hemen sonra ilk kareyi bulanık almamak için kısa yerleşme süresi.
    await wait(140);
    return this.stream;
  }

  buildVideoConstraints(preset, strong = false) {
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
    const video = {
      width: strong ? { min: preset.minWidth, ideal: preset.width } : { ideal: preset.width },
      height: strong ? { min: preset.minHeight, ideal: preset.height } : { ideal: preset.height },
      frameRate: { ideal: 30 }
    };
    if (supported.resizeMode) video.resizeMode = 'none';
    if (this.deviceId) video.deviceId = { exact: this.deviceId };
    else video.facingMode = { ideal: this.facingMode };
    return video;
  }

  async applyPreferredCameraModes() {
    const track = this.track;
    if (!track?.applyConstraints) return;
    const caps = this.getCapabilities();
    const advanced = {};
    const focusModes = Array.isArray(caps.focusMode) ? caps.focusMode : [];
    const exposureModes = Array.isArray(caps.exposureMode) ? caps.exposureMode : [];
    const whiteBalanceModes = Array.isArray(caps.whiteBalanceMode) ? caps.whiteBalanceMode : [];
    if (focusModes.includes('continuous')) advanced.focusMode = 'continuous';
    if (exposureModes.includes('continuous')) advanced.exposureMode = 'continuous';
    if (whiteBalanceModes.includes('continuous')) advanced.whiteBalanceMode = 'continuous';
    if (!Object.keys(advanced).length) return;
    try { await track.applyConstraints({ advanced: [advanced] }); } catch {}
  }

  async stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  async restart(options = {}) { return this.start(options); }

  async switchCamera(options = {}) {
    this.deviceId = '';
    this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
    return this.start({ ...options, deviceId: '' });
  }

  getSettings() { return this.track?.getSettings?.() || {}; }
  getCapabilities() {
    try { return this.track?.getCapabilities?.() || {}; } catch { return {}; }
  }

  async listVideoInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  }

  async applyAdvanced(constraints = {}) {
    const track = this.track;
    if (!track?.applyConstraints) throw new Error('Bu kamera gelişmiş ayarları desteklemiyor.');
    await track.applyConstraints({ advanced: [constraints] });
    return this.getSettings();
  }

  async setZoom(value) {
    const caps = this.getCapabilities();
    if (!caps.zoom) throw new Error('Bu kamerada optik zoom denetimi yok.');
    const next = clamp(Number(value), Number(caps.zoom.min), Number(caps.zoom.max));
    return this.applyAdvanced({ zoom: next });
  }

  async setExposureLock(locked) {
    const caps = this.getCapabilities();
    const modes = Array.isArray(caps.exposureMode) ? caps.exposureMode : [];
    if (!modes.length) throw new Error('Pozlama kilidi bu kamerada desteklenmiyor.');
    const desired = locked
      ? (modes.includes('manual') ? 'manual' : modes.includes('single-shot') ? 'single-shot' : null)
      : (modes.includes('continuous') ? 'continuous' : null);
    if (!desired) throw new Error(locked ? 'Pozlama kilidi desteklenmiyor.' : 'Otomatik pozlama desteklenmiyor.');
    return this.applyAdvanced({ exposureMode: desired });
  }

  async setWhiteBalanceLock(locked) {
    const caps = this.getCapabilities();
    const modes = Array.isArray(caps.whiteBalanceMode) ? caps.whiteBalanceMode : [];
    if (!modes.length) throw new Error('Beyaz ayarı kilidi bu kamerada desteklenmiyor.');
    const desired = locked
      ? (modes.includes('manual') ? 'manual' : modes.includes('single-shot') ? 'single-shot' : null)
      : (modes.includes('continuous') ? 'continuous' : null);
    if (!desired) throw new Error(locked ? 'Beyaz ayarı kilidi desteklenmiyor.' : 'Otomatik beyaz ayarı desteklenmiyor.');
    return this.applyAdvanced({ whiteBalanceMode: desired });
  }

  capture(canvas, { mirror = false, aspectRatio = '16:9', quality = 0.98 } = {}) {
    if (!this.active || !this.video.videoWidth || !this.video.videoHeight) throw new Error('Kamera hazır değil.');
    // Eski çağrılar %92 istese bile yeni kareleri yüksek JPEG kalitesinde sakla.
    const finalQuality = Math.max(0.97, Math.min(1, Number(quality) || 0.98));
    return drawSourceToCanvas(this.video, canvas, { mirror, aspectRatio, quality: finalQuality });
  }
}

export function drawSourceToCanvas(source, canvas, { mirror = false, aspectRatio = '16:9', quality = 0.98 } = {}) {
  const sourceW = source.videoWidth || source.naturalWidth || source.width;
  const sourceH = source.videoHeight || source.naturalHeight || source.height;
  if (!sourceW || !sourceH) throw new Error('Görüntü boyutu okunamadı.');
  let sx = 0, sy = 0, sw = sourceW, sh = sourceH;
  const ratio = parseAspect(aspectRatio);
  if (ratio) {
    const sourceRatio = sourceW / sourceH;
    if (sourceRatio > ratio) {
      sw = Math.round(sourceH * ratio);
      sx = Math.round((sourceW - sw) / 2);
    } else if (sourceRatio < ratio) {
      sh = Math.round(sourceW / ratio);
      sy = Math.round((sourceH - sh) / 2);
    }
  }
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: false });
  ctx.imageSmoothingEnabled = true;
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
  ctx.save();
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas.toDataURL('image/jpeg', Math.max(0.97, Math.min(1, Number(quality) || 0.98)));
}

function parseAspect(value) {
  if (!value || value === 'source') return null;
  const [w, h] = String(value).split(':').map(Number);
  return w > 0 && h > 0 ? w / h : null;
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
