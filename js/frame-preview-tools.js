// Kareler: fotoğrafa dokununca büyük önizleme + tüm kareleri sil.
const track = document.getElementById('timelineTrack');
const deleteButton = document.getElementById('deleteFrameBtn');
const playButton = document.getElementById('playBtn');
const toast = document.getElementById('toast');
let previewIndex = -1;
let overlay = null;

function ensurePreview() {
  if (overlay?.isConnected) return overlay;
  overlay = document.createElement('div');
  overlay.className = 'frame-photo-preview';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Kare önizleme');
  overlay.innerHTML = `
    <div class="frame-photo-preview-bar">
      <strong id="framePhotoPreviewTitle">Kare Önizleme</strong>
      <button type="button" class="frame-photo-preview-close" aria-label="Önizlemeyi kapat">×</button>
    </div>
    <div class="frame-photo-preview-body">
      <button type="button" class="frame-photo-preview-nav prev" aria-label="Önceki kare">‹</button>
      <img alt="Kare önizleme" />
      <button type="button" class="frame-photo-preview-nav next" aria-label="Sonraki kare">›</button>
    </div>
    <div class="frame-photo-preview-count"></div>`;
  document.body.append(overlay);
  overlay.querySelector('.frame-photo-preview-close')?.addEventListener('click', closePreview);
  overlay.querySelector('.prev')?.addEventListener('click', () => showPreview(previewIndex - 1));
  overlay.querySelector('.next')?.addEventListener('click', () => showPreview(previewIndex + 1));
  overlay.addEventListener('click', event => { if (event.target === overlay) closePreview(); });
  return overlay;
}

function frameCards() {
  return [...(track?.querySelectorAll('.frame-card') || [])];
}

function showPreview(index) {
  const cards = frameCards();
  if (!cards.length) return closePreview();
  previewIndex = Math.min(cards.length - 1, Math.max(0, Number(index) || 0));
  const card = cards[previewIndex];
  const source = card.querySelector('img')?.src;
  if (!source) return;
  const view = ensurePreview();
  view.querySelector('img').src = source;
  view.querySelector('#framePhotoPreviewTitle').textContent = `Kare ${String(previewIndex + 1).padStart(3, '0')}`;
  view.querySelector('.frame-photo-preview-count').textContent = `${previewIndex + 1} / ${cards.length}`;
  view.querySelector('.prev').disabled = previewIndex <= 0;
  view.querySelector('.next').disabled = previewIndex >= cards.length - 1;
  view.classList.add('show');
  document.body.classList.add('frame-preview-open');
}

function closePreview() {
  overlay?.classList.remove('show');
  document.body.classList.remove('frame-preview-open');
}

track?.addEventListener('click', event => {
  const image = event.target.closest?.('.frame-card img');
  if (!image) return;
  const card = image.closest('.frame-card');
  const index = Number(card?.dataset.index);
  requestAnimationFrame(() => showPreview(Number.isFinite(index) ? index : 0));
});

document.addEventListener('keydown', event => {
  if (!overlay?.classList.contains('show')) return;
  if (event.key === 'Escape') closePreview();
  else if (event.key === 'ArrowLeft') { event.preventDefault(); showPreview(previewIndex - 1); }
  else if (event.key === 'ArrowRight') { event.preventDefault(); showPreview(previewIndex + 1); }
});

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2600);
}

function addDeleteAllButton() {
  if (!deleteButton || document.getElementById('deleteAllFramesBtn')) return;
  const button = document.createElement('button');
  button.className = 'panel-btn delete-all-frames';
  button.id = 'deleteAllFramesBtn';
  button.type = 'button';
  button.innerHTML = '<span>⌫</span>Tümünü Sil';
  deleteButton.insertAdjacentElement('afterend', button);
  button.addEventListener('click', () => {
    const cards = frameCards();
    if (!cards.length) return showToast('Silinecek kare yok.');
    if (!confirm(`${cards.length} karenin tamamı silinsin mi? Bu işlem geri alınması zor bir işlemdir.`)) return;
    closePreview();
    if (playButton?.textContent?.includes('❚')) playButton.click();

    // İlk kareyi seç; app.js silme işlemi sonrasında seçim aynı konumda kaldığı için
    // kalan kareler sırayla temizlenir.
    frameCards()[0]?.click();
    let safety = 0;
    while (track?.querySelector('.frame-card') && safety < 10000) {
      deleteButton.click();
      safety += 1;
    }
    showToast(`${cards.length} kare silindi.`);
  });
}

addDeleteAllButton();
