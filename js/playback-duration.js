// Oynatma sırasında kamera ekranında geçen / toplam süre göstergesi.
const playButton = document.getElementById('playBtn');
const playbackPosition = document.getElementById('playbackPosition');
const durationValue = document.getElementById('durationValue');
const cameraUi = document.querySelector('.simple-camera-ui');

let badge = null;

function ensureBadge() {
  if (badge?.isConnected) return badge;
  const host = document.querySelector('.simple-camera-ui') || cameraUi;
  if (!host) return null;
  badge = document.createElement('div');
  badge.className = 'simple-playback-duration';
  badge.setAttribute('role', 'status');
  badge.setAttribute('aria-live', 'polite');
  badge.innerHTML = '<span class="simple-playback-current">0.0 sn</span><i>/</i><strong class="simple-playback-total">0.0 sn</strong>';
  host.append(badge);
  return badge;
}

function isPlaying() {
  return Boolean(playButton?.textContent?.includes('❚'));
}

function currentSeconds() {
  const text = String(playbackPosition?.textContent || '').trim();
  const match = text.match(/(\d+):(\d+(?:\.\d+)?)/);
  if (match) return Number(match[1]) * 60 + Number(match[2]);
  const number = Number.parseFloat(text.replace(',', '.'));
  return Number.isFinite(number) ? number : 0;
}

function totalSeconds() {
  const text = String(durationValue?.textContent || '').replace(',', '.');
  const number = Number.parseFloat(text);
  return Number.isFinite(number) ? number : 0;
}

function formatSeconds(value) {
  const seconds = Math.max(0, Number(value) || 0);
  if (seconds < 60) return `${seconds.toFixed(1)} sn`;
  const min = Math.floor(seconds / 60);
  const sec = seconds - min * 60;
  return `${min}:${sec.toFixed(1).padStart(4, '0')}`;
}

function syncDurationBadge() {
  const el = ensureBadge();
  if (!el) return;
  const playing = isPlaying();
  el.classList.toggle('show', playing);
  el.querySelector('.simple-playback-current').textContent = formatSeconds(currentSeconds());
  el.querySelector('.simple-playback-total').textContent = formatSeconds(totalSeconds());
}

// app.js oynatma sırasında playbackPosition değerini kare kare güncelliyor.
const observer = new MutationObserver(syncDurationBadge);
if (playButton) observer.observe(playButton, { childList: true, subtree: true, characterData: true });
if (playbackPosition) observer.observe(playbackPosition, { childList: true, subtree: true, characterData: true });
if (durationValue) observer.observe(durationValue, { childList: true, subtree: true, characterData: true });

playButton?.addEventListener('click', () => requestAnimationFrame(syncDurationBadge));
document.querySelector('.simple-play')?.addEventListener('click', () => requestAnimationFrame(syncDurationBadge));
window.addEventListener('pageshow', syncDurationBadge);

syncDurationBadge();
