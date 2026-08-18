// Ahmed Enes Film Sahnesi — yüksek kalite video kayıt koruması
// Mevcut app.js ve audio-addon.js MediaRecorder kullanımlarına merkezi olarak uygulanır.

const NativeMediaRecorder = window.MediaRecorder;

function recommendedVideoBitrate(stream) {
  const track = stream?.getVideoTracks?.()[0];
  const settings = track?.getSettings?.() || {};
  const canvas = document.getElementById('exportCanvas');
  const width = Number(settings.width) || Number(canvas?.width) || 1920;
  const height = Number(settings.height) || Number(canvas?.height) || 1080;
  const pixels = width * height;

  // Stop-motion kareleri çok sayıda keskin kenar ve ince LEGO detayı içerir.
  // Bu nedenle tipik gerçek zamanlı video bitrate'lerinden daha yüksek hedef kullanıyoruz.
  if (pixels >= 7_000_000) return 60_000_000; // 4K sınıfı
  if (pixels >= 3_000_000) return 40_000_000; // 1440p sınıfı
  if (pixels >= 1_700_000) return 28_000_000; // 1080p
  if (pixels >= 800_000) return 16_000_000;   // 720p
  return 10_000_000;
}

if (NativeMediaRecorder) {
  class HighQualityMediaRecorder extends NativeMediaRecorder {
    constructor(stream, options = {}) {
      const next = { ...options };
      if (stream?.getVideoTracks?.().length) {
        const target = recommendedVideoBitrate(stream);
        next.videoBitsPerSecond = Math.max(Number(options.videoBitsPerSecond) || 0, target);
        if (next.audioBitsPerSecond != null) {
          next.audioBitsPerSecond = Math.max(Number(next.audioBitsPerSecond) || 0, 192_000);
        }
      }
      super(stream, next);
    }

    static isTypeSupported(type) {
      return NativeMediaRecorder.isTypeSupported?.(type) ?? false;
    }
  }

  try {
    Object.defineProperty(HighQualityMediaRecorder, 'name', { value: 'MediaRecorder' });
  } catch {}

  window.MediaRecorder = HighQualityMediaRecorder;
}

// Dışa aktarım canvas'ında ölçekleme gerektiğinde yüksek kaliteli interpolasyon kullan.
const exportCanvas = document.getElementById('exportCanvas');
if (exportCanvas) {
  const originalGetContext = exportCanvas.getContext.bind(exportCanvas);
  exportCanvas.getContext = function(type, options) {
    const context = originalGetContext(type, options);
    if (type === '2d' && context) {
      context.imageSmoothingEnabled = true;
      try { context.imageSmoothingQuality = 'high'; } catch {}
    }
    return context;
  };
}
