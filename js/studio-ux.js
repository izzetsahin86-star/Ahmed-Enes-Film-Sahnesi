const $ = (selector, root = document) => root.querySelector(selector);

const cssHref = './studio-ux.css';
if (!document.querySelector(`link[href="${cssHref}"]`)) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = cssHref;
  document.head.append(link);
}

const dock = $('#timelineDock');
const collapseButton = $('#collapseTimelineBtn');
const galleryButton = $('.simple-gallery-button');
const timelineTrack = $('#timelineTrack');
const captureButton = $('#captureBtn');
const framePreview = $('#framePreview');
const tabs = [...document.querySelectorAll('[data-dock-tab]')];

function activePanelName() {
  return document.querySelector('[data-dock-tab].active')?.dataset.dockTab || 'shoot';
}

function syncPanelState() {
  document.body.dataset.studioPanel = activePanelName();
  document.body.classList.toggle('studio-sheet-open', Boolean(dock && !dock.classList.contains('collapsed')));
}

function latestFrameSource() {
  const cards = [...document.querySelectorAll('#timelineTrack .frame-card img')];
  return cards.at(-1)?.src || '';
}

function syncGalleryThumb() {
  if (!galleryButton) return;
  const src = latestFrameSource();
  let img = $('.last-frame-thumb', galleryButton);
  if (!src) {
    galleryButton.classList.remove('has-frame');
    img?.remove();
    return;
  }
  if (!img) {
    img = document.createElement('img');
    img.className = 'last-frame-thumb';
    img.alt = 'Son çekilen kare';
    galleryButton.append(img);
  }
  if (img.src !== src) img.src = src;
  galleryButton.classList.add('has-frame');
}

function removeSecondaryGridShortcut() {
  document.querySelector('[data-simple-tool="grid"]')?.remove();
}

function subtleCaptureFeedback() {
  const shutter = $('.simple-shutter');
  if (!shutter) return;
  shutter.animate?.([
    { transform: 'scale(1)' },
    { transform: 'scale(.90)' },
    { transform: 'scale(1)' }
  ], { duration: 190, easing: 'ease-out' });
  try { navigator.vibrate?.(18); } catch {}
}

function setupSheetGesture() {
  const header = dock?.querySelector('.studio-dock-header');
  if (!header || !collapseButton) return;
  let startY = 0;
  let startX = 0;
  let tracking = false;

  header.addEventListener('touchstart', event => {
    const touch = event.touches?.[0];
    if (!touch) return;
    startY = touch.clientY;
    startX = touch.clientX;
    tracking = true;
  }, { passive: true });

  header.addEventListener('touchend', event => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const dy = touch.clientY - startY;
    const dx = Math.abs(touch.clientX - startX);
    if (dx > 55 || Math.abs(dy) < 34) return;

    if (dy > 0 && !dock.classList.contains('collapsed')) {
      collapseButton.click();
    } else if (dy < 0 && dock.classList.contains('collapsed')) {
      document.querySelector(`[data-dock-tab="${activePanelName()}"]`)?.click();
    }
  }, { passive: true });
}

function setupDoubleTapGallery() {
  if (!galleryButton) return;
  let lastTap = 0;
  galleryButton.addEventListener('pointerup', () => {
    const now = performance.now();
    if (now - lastTap < 320) {
      const lastCard = [...document.querySelectorAll('#timelineTrack .frame-card')].at(-1);
      lastCard?.click();
    }
    lastTap = now;
  });
}

function setupObservers() {
  if (timelineTrack) {
    const observer = new MutationObserver(() => requestAnimationFrame(syncGalleryThumb));
    observer.observe(timelineTrack, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  }
  if (dock) {
    const observer = new MutationObserver(syncPanelState);
    observer.observe(dock, { attributes: true, attributeFilter: ['class'] });
  }
  tabs.forEach(tab => tab.addEventListener('click', () => requestAnimationFrame(syncPanelState)));
}

captureButton?.addEventListener('click', subtleCaptureFeedback);
framePreview?.addEventListener('load', () => requestAnimationFrame(syncGalleryThumb));

removeSecondaryGridShortcut();
syncPanelState();
syncGalleryThumb();
setupSheetGesture();
setupDoubleTapGallery();
setupObservers();
