const CACHE = 'aefs-studio-v35';
const ASSETS = ['./', './index.html', './styles.css', './studio-shell.css', './life-lapse.css', './audio-studio.css', './audio-timeline-tweak.css', './audio-workspace.css', './audio-visual-timeline.css', './scene-studio.css', './playback-duration.css', './frame-preview-tools.css', './video-import.css', './camera-simple.css', './smart-panels.css', './ninja-sfx.css', './js/app.js', './js/camera.js', './js/timeline.js', './js/gif-encoder.js', './js/project-store.js', './js/ui-shell.js', './js/quality-guard.js', './js/camera-standard-ui.js', './js/scene-addon.js', './js/scene-capture-picker.js', './js/scene-feather-fixed.js', './js/startup-camera-defaults.js', './js/playback-duration.js', './js/frame-preview-tools.js', './js/video-import.js', './js/audio-addon.js', './js/audio-timeline-tweak.js', './js/audio-workspace.js', './js/audio-visual-timeline.js', './js/camera-simple.js', './js/camera-zoom-rail.js', './js/smart-mobile.js', './js/smart-panels.js', './js/ninja-sfx.js', './js/sfx-preview.js', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    caches.open(CACHE).then(cache => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('./index.html'))));
});