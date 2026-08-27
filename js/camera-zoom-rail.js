// Sağ hızlı kamera araçlarına mevcut kamera zoom kontrolünü bağlayan + / − düğmeleri.
const rail = document.querySelector('.simple-tool-rail');
const zoomInput = document.getElementById('zoomInput');
const zoomValue = document.getElementById('zoomValue');
const cameraToggleButton = document.getElementById('cameraToggleBtn');
const toastElement = document.getElementById('toast');

let toastTimer = 0;

const zoomIcons = {
  out: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10"/></svg>',
  in: '<svg class="sm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10M12 7v10"/></svg>'
};

function toast(message) {
  if (!toastElement) return;
  clearTimeout(toastTimer);
  toastElement.textContent = message;
  toastElement.classList.add('show');
  toastTimer = setTimeout(() => toastElement.classList.remove('show'), 2600);
}
function tapFeedback() { try { navigator.vibrate?.(7); } catch {} }
function cameraActive() { return Boolean(cameraToggleButton?.classList.contains('active')); }
function zoomAvailable() { return Boolean(zoomInput && !zoomInput.disabled && cameraActive()); }
function numeric(value, fallback) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
function getZoomState() {
  const current = numeric(zoomInput?.value, 1);
  const min = numeric(zoomInput?.min, 1);
  const max = numeric(zoomInput?.max, Math.max(1, current));
  let step = numeric(zoomInput?.step, 0.1);
  if (!(step > 0)) step = 0.1;
  return { current, min, max, step };
}
function makeButton(kind, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'simple-tool-button simple-zoom-button';
  button.dataset.cameraZoom = kind;
  button.setAttribute('aria-label', label);
  button.title = label;
  button.innerHTML = zoomIcons[kind];
  return button;
}
function syncButtons() {
  const minus = rail?.querySelector('[data-camera-zoom="out"]');
  const plus = rail?.querySelector('[data-camera-zoom="in"]');
  if (!minus || !plus) return;
  const available = zoomAvailable();
  const { current, min, max } = getZoomState();
  const epsilon = 0.0001;
  minus.disabled = !available || current <= min + epsilon;
  plus.disabled = !available || current >= max - epsilon;
  const label = `${current.toFixed(1)}×`;
  minus.title = available ? `Uzaklaştır · ${label}` : 'Kamera zoomu kullanılamıyor';
  plus.title = available ? `Yakınlaştır · ${label}` : 'Kamera zoomu kullanılamıyor';
  minus.setAttribute('aria-label', minus.title);
  plus.setAttribute('aria-label', plus.title);
}
function changeZoom(direction) {
  tapFeedback();
  if (!cameraActive()) return toast('Önce kamerayı aç.');
  if (!zoomInput || zoomInput.disabled) return toast('Bu kamera zoom kontrolünü desteklemiyor.');
  const { current, min, max, step } = getZoomState();
  const target = Math.min(max, Math.max(min, current + direction * step));
  if (Math.abs(target - current) < 0.0001) return;
  zoomInput.value = String(Number(target.toFixed(3)));
  zoomInput.dispatchEvent(new Event('input', { bubbles: true }));
  zoomInput.dispatchEvent(new Event('change', { bubbles: true }));
  if (zoomValue) zoomValue.textContent = `${Number(zoomInput.value).toFixed(1)}×`;
  requestAnimationFrame(syncButtons);
  setTimeout(syncButtons, 180);
}
function install() {
  if (!rail || rail.querySelector('[data-camera-zoom]')) { syncButtons(); return; }
  const minus = makeButton('out', 'Uzaklaştır');
  const plus = makeButton('in', 'Yakınlaştır');
  const switchButton = rail.querySelector('[data-simple-tool="switch"]');
  if (switchButton) {
    rail.insertBefore(minus, switchButton);
    rail.insertBefore(plus, switchButton);
  } else rail.append(minus, plus);
  minus.addEventListener('click', () => changeZoom(-1));
  plus.addEventListener('click', () => changeZoom(1));
  syncButtons();
}
install();
zoomInput?.addEventListener('input', syncButtons);
zoomInput?.addEventListener('change', syncButtons);
if (cameraToggleButton) new MutationObserver(() => setTimeout(syncButtons, 220)).observe(cameraToggleButton, { attributes: true, attributeFilter: ['class'] });
[250, 700, 1400].forEach(delay => setTimeout(syncButtons, delay));
