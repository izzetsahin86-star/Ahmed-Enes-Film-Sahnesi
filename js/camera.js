export class CameraController {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.facingMode = 'environment';
    this.deviceId = '';
    this.resolution = 'auto';
    this.actualResolution = { width: 0, height: 0 };
  }

  get active() { return Boolean(this.stream); }
  get track() { return this.stream?.getVideoTracks?.()[0] || null; }

  async start(options = {}) {
    await this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Bu tarayıcı kamera erişimini desteklemiyor.');

    this.deviceId = options.deviceId ?? this.deviceId;

    // TELEFON STANDARDI:
    // Çözünürlük, FPS, resizeMode, focus, exposure veya white balance zorlamıyoruz.
    // Böylece hangi telefon kullanılıyorsa tarayıcı o cihaz için kendi varsayılan
    // kamera akışını seçer. Sadece istenen fiziksel kamera (arka/ön) belirtilir.
    const video = this.deviceId
      ? { deviceId: { exact: this.deviceId } }
      : { facingMode: { ideal: this.facingMode } };

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
    this.video.srcObject = this.stream;
    await this.video.play();

    // Telefonun kendi autofocus/pozlama sisteminin oturması için kısa süre ver.
    await wait(180);
    this.syncActualResolution();
    return this.stream;
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

  syncActualResolution() {
    const settings = this.getSettings();
    this.actualResolution = {
      width: Number(settings.width) || Number(this.video.videoWidth) || 0,
      height: Number(settings.height) || Number(this.video.videoHeight) || 0
    };
    return this.actualResolution;
  }

  getActualResolution() { return { ...this.syncActualResolution() }; }

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
    this.syncActualResolution();
    return drawSourceToCanvas(this.video, canvas, {
      mirror,
      aspectRatio,
      quality: Math.max(0.985, Math.min(1, Number(quality) || 0.99))
    });
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

  // Telefonun verdiği gerçek kamera karesini kendi piksel ölçüsünde sakla.
  // Burada büyütme veya küçültme yapılmaz.
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: false });
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
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
