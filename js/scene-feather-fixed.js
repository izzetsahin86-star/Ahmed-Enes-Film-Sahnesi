// Sahne Chroma Key kenar yumuşatma değeri sabit 100.
const feather = document.getElementById('sceneFeather');
const reset = document.getElementById('sceneReset');

function applyFixedFeather() {
  if (!feather) return;
  if (Number(feather.value) !== 100) {
    feather.value = '100';
    feather.dispatchEvent(new Event('input', { bubbles: true }));
  }
  feather.disabled = true;
  const row = feather.closest('.scene-range');
  row?.classList.add('scene-fixed-feather');
  const value = document.getElementById('sceneFeatherValue');
  if (value) value.textContent = '100';
}

applyFixedFeather();
[150, 500, 1200].forEach(ms => setTimeout(applyFixedFeather, ms));
reset?.addEventListener('click', () => setTimeout(applyFixedFeather, 0));
window.addEventListener('pageshow', () => setTimeout(applyFixedFeather, 80));
