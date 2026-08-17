const RESOLUTIONS = {
  720: { width: 1280, height: 720 },
  1080: { width: 1920, height: 1080 },
  2160: { width: 3840, height: 2160 }
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

  async start(options = {}) {
    await this.stop();
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Bu tarayıcı kamera erişimini desteklemiyor.');

    this.resolution = String(options.resolution || this.resolution || '1080');
    this.deviceId = options.deviceId ?? this.deviceId;
    const preset = RESOLUTIONS[this.resolution] || RESOLUTIONS[1080];
    const video = {
      width: { ideal: preset.width },
      height: { ideal: preset.height }
    };
    if (this.deviceId) video.deviceId = { exact: this.deviceId };
    else video.facingMode = { ideal: this.facingMode };

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
    this.video.srcObject = this.stream;
    await this.video.play();
    return this.stream;
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

  getSettings() {
    return this.stream?.getVideoTracks?.()[0]?.getSettings?.() || {};
  }

  async listVideoInputs() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'videoinput');
  }

  capture(canvas, { mirror = false, aspectRatio = '16:9', quality = 0.92 } = {}) {
    if (!this.active || !this.video.videoWidth || !this.video.videoHeight) throw new Error('Kamera hazır değil.');

    const sourceW = this.video.videoWidth;
    const sourceH = this.video.videoHeight;
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
    const ctx = canvas.getContext('2d', { alpha: false });
    ctx.save();
    if (mirror) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    return canvas.toDataURL('image/jpeg', quality);
  }
}

function parseAspect(value) {
  if (!value || value === 'source') return null;
  const [w, h] = String(value).split(':').map(Number);
  return w > 0 && h > 0 ? w / h : null;
}
