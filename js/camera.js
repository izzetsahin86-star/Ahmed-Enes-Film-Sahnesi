const RESOLUTIONS = {
  720: { width: 1280, height: 720, minWidth: 960, minHeight: 540 },
  1080: { width: 1920, height: 1080, minWidth: 1280, minHeight: 720 },
  2160: { width: 3840, height: 2160, minWidth: 1920, minHeight: 1080 }
};

const AUTO_MAX = { width: 4096, height: 3072 };

export class CameraController {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.facingMode = 'environment';
    this.deviceId = '';
    this.resolution = '1080';
    this.autoQuality = true;
    this.actualResolution = { width: 0, height: 0 };
  }

  get active() { return Boolean(this.stream); }
  get track() { return this.stream?.getVideoTracks?.()[0] || null; }

  async start(options = {}) {
    await this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Bu tarayıcı kamera erişimini desteklemiyor.');
    this.resolution = String(options.resolution || this.resolution || '1080');
    this.deviceId = options.deviceId ?? this.deviceId;
    const preset = RESOLUTIONS[this.resolution] || RESOLUTIONS[1080];

    // İlk açılışta yüksek kalite hedefle; cihaz karşılayamazsa güvenli biçimde geri dön.
    const strongVideo = this.buildVideoConstraints(preset, true);
    const fallbackVideo = this.buildVideoConstraints(preset, false);
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: strongVideo });
    } catch (error) {
      if (!['OverconstrainedError', 'ConstraintNotSatisfiedError', 'NotFoundError'].includes(error?.name)) throw error;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: fallbackVideo });
    }

    const track = this.track;
    try { if (track && 'contentHint' in track) track.contentHint = 'detail'; } catch {}

    this.video.srcObject = this.stream;
    await this.video.play();

    // Hangi telefon kullanılıyorsa o cihazın tarayıcı üzerinden erişilebilen en yüksek
    // kamera çözünürlüğünü otomatik seç. Stop-motion için FPS yerine detay önceliklidir.
    await this.maximizeDeviceResolution();
    await this.applyPreferredCameraModes();
    await wait(220);
    this.syncActualResolution();
    return this.stream;
  }

  buildVideoConstraints(preset, strong = false) {
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
    const video = {
      width: strong
        ? { min: preset.minWidth, ideal: Math.max(preset.width, 3840) }
        : { ideal: Math.max(preset.width, 1920) },
      height: strong
        ? { min: preset.minHeight, ideal: Math.max(preset.height, 2160) }
        : { ideal: Math.max(preset.height, 1080) },
      frameRate: { ideal: 24, max: 30 }
    };
    if (supported.resizeMode) video.resizeMode = 'none';
    if (this.deviceId) video.deviceId = { exact: this.deviceId };
    else video.facingMode = { ideal: this.facingMode };
    return video;
  }

  async maximizeDeviceResolution() {
    const track = this.track;
    if (!track?.applyConstraints || !this.autoQuality) return;
    const caps = this.getCapabilities();
    const maxW = Number(caps.width?.max);
    const maxH = Number(caps.height?.max);
    if (!Number.isFinite(maxW) || !Number.isFinite(maxH) || maxW <= 0 || maxH <= 0) {
      this.syncActualResolution();
      return;
    }

    const scale = Math.min(1, AUTO_MAX.width / maxW, AUTO_MAX.height / maxH);
    const targetW = Math.max(1, Math.round(maxW * scale));
    const targetH = Math.max(1, Math.round(maxH * scale));
    const supported = navigator.mediaDevices?.getSupportedConstraints?.() || {};
    const constraints = {
      width: { ideal: targetW },
      height: { ideal: targetH },
      frameRate: { ideal: 24, max: 30 }
    };
    if (supported.resizeMode) constraints.resizeMode = 'none';

    try {
      await track.applyConstraints(constraints);
      await wait(120);
    } catch {
      // Bazı mobil tarayıcılar maksimum width/height çiftini birlikte kabul etmez.
      // Böyle bir durumda mevcut yüksek kaliteli akışı bozmadan devam et.
    }
    this.syncActualResolution();
  }

  syncActualResolution() {
    const settings = this.getSettings();
    this.actualResolution = {
      width: Number(settings.width) || Number(this.video.videoWidth) || 0,
      height: Number(settings.height) || Number(this.video.videoHeight) || 0
    };
    return this.actualResolution;
  }

  getActualResolution() { return { ...this.syncActualResolution() }; }

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
    this.actualResolution = { width: 0, height: 0 };
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
    this.syncActualResolution();
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

  capture(canvas, { mirror = false, aspectRatio = '16:9', quality = 0.99 } = {}) {
    if (!this.active || !this.video.videoWidth || !this.video.videoHeight) throw new Error('Kamera hazır değil.');
    const finalQuality = Math.max(0.985, Math.min(1, Number(quality) || 0.99));
    this.syncActualResolution();
    return drawSourceToCanvas(this.video, canvas, { mirror, aspectRatio, quality: finalQuality });
  }
}

export function drawSourceToCanvas(source, canvas, { mirror = false, aspectRatio = '16:9', quality = 0.99 } = {}) {
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
  // Kareyi 1:1 piksel ölçüsünde alıyoruz; gereksiz interpolasyon bulanıklığını kapat.
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  ctx.restore();
  return canvas.toDataURL('image/jpeg', Math.max(0.985, Math.min(1, Number(quality) || 0.99)));
}

function parseAspect(value) {
  if (!value || value === 'source') return null;
  const [w, h] = String(value).split(':').map(Number);
  return w > 0 && h > 0 ? w / h : null;
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
