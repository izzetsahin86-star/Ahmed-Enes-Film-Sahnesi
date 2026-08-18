// Ahmed Enes Film Sahnesi — istenen açılış çekim varsayılanları
// Son proje geri yüklense bile yalnızca çekim kontrollerini bu değerlere getirir.

const DEFAULTS = {
  fps: 5,
  onion: 0,
  timer: '0',
  aspect: 'source',
  mirror: false,
  grid: false,
  zoom: 1
};

const $ = selector => document.querySelector(selector);

function fire(element, type) {
  if (!element) return;
  element.dispatchEvent(new Event(type, { bubbles: true }));
}

function setRange(selector, value) {
  const el = $(selector);
  if (!el || Number(el.value) === Number(value)) return;
  el.value = String(value);
  fire(el, 'input');
  fire(el, 'change');
}

function setSelect(selector, value) {
  const el = $(selector);
  if (!el || el.value === String(value)) return;
  const optionExists = [...el.options].some(option => option.value === String(value));
  if (!optionExists) return;
  el.value = String(value);
  fire(el, 'change');
}

function setCheck(selector, checked) {
  const el = $(selector);
  if (!el || el.checked === checked) return;
  el.checked = checked;
  fire(el, 'change');
}

function applyZoom() {
  const input = $('#zoomInput');
  const label = $('#zoomValue');
  if (label) label.textContent = '1.0×';
  if (!input) return;

  const min = Number(input.min);
  const max = Number(input.max);
  const target = Number.isFinite(min) && Number.isFinite(max)
    ? Math.min(max, Math.max(min, DEFAULTS.zoom))
    : DEFAULTS.zoom;

  input.value = String(target);
  // Kamera açıksa app.js bu change olayıyla gerçek kamera zoomunu ve proje değerini günceller.
  if (!input.disabled && $('#cameraToggleBtn')?.classList.contains('active')) fire(input, 'change');
}

function applyStartupDefaults() {
  setRange('#fpsInput', DEFAULTS.fps);
  setRange('#onionInput', DEFAULTS.onion);
  setSelect('#timerSelect', DEFAULTS.timer);
  setSelect('#aspectSelect', DEFAULTS.aspect);
  setCheck('#mirrorToggle', DEFAULTS.mirror);
  setCheck('#gridToggle', DEFAULTS.grid);
  applyZoom();

  // Üstteki sayaç hızlı düğmesi de anında doğru etiketi göstersin.
  const timerText = $('#timerButtonText');
  if (timerText) timerText.textContent = 'Kapalı';
  $('#timerBtn')?.classList.remove('active');
}

// app.js önce boş proje durumunu kurup ardından IndexedDB'den son projeyi geri yükleyebilir.
// Kısa aralıklarla yeniden uygulayarak son proje yüklemesinden sonra da istenen açılış değerlerini garanti et.
[0, 250, 900, 1800].forEach(delay => setTimeout(applyStartupDefaults, delay));
window.addEventListener('pageshow', () => setTimeout(applyStartupDefaults, 120));

// Kamera daha sonra açılırsa 1.0× zoomu o anda uygula.
const cameraButton = $('#cameraToggleBtn');
if (cameraButton) {
  const observer = new MutationObserver(() => {
    if (cameraButton.classList.contains('active')) setTimeout(applyZoom, 220);
  });
  observer.observe(cameraButton, { attributes: true, attributeFilter: ['class'] });
}
