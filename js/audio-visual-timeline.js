// Ses paneli için görsel yerleşim zaman çizelgesi.
const pane = document.querySelector('.audio-pane');
const layout = pane?.querySelector('.audio-layout');
const clipList = document.getElementById('audioClipList');
const playbackPosition = document.getElementById('playbackPosition');
const durationValue = document.getElementById('durationValue');

let board = null;
let insertHint = null;
let lastCount = 0;
let initialized = false;

function parseSeconds(text) {
  const value = String(text || '').trim().replace(',', '.');
  const time = value.match(/(\d+):(\d+(?:\.\d+)?)/);
  if (time) return Number(time[1]) * 60 + Number(time[2]);
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? number : 0;
}

function currentSeconds() { return parseSeconds(playbackPosition?.textContent); }
function totalSeconds() { return Math.max(0.1, parseSeconds(durationValue?.textContent)); }
function format(value) {
  const seconds = Math.max(0, Number(value) || 0);
  if (seconds < 60) return `${seconds.toFixed(1)} sn`;
  const min = Math.floor(seconds / 60);
  const sec = seconds - min * 60;
  return `${min}:${sec.toFixed(1).padStart(4, '0')}`;
}

function ensureBoard() {
  const timelineCard = pane?.querySelector('.audio-timeline-card');
  if (!timelineCard) return null;
  if (board?.isConnected) return board;

  board = document.createElement('section');
  board.className = 'audio-placement-board';
  board.innerHTML = `
    <div class="audio-placement-head">
      <div><strong>Seslerin Filmdeki Yeri</strong><small>Numaraya dokun → ilgili klibe git</small></div>
      <b id="audioPlacementCurrent">0.0 sn</b>
    </div>
    <div class="audio-position-track" aria-label="Ses zaman çizelgesi">
      <div class="audio-position-progress"></div>
      <div class="audio-position-markers"></div>
      <div class="audio-position-playhead"><span></span></div>
    </div>
    <div class="audio-position-ruler"><span>0</span><span>25%</span><span>50%</span><span>75%</span><span class="audio-ruler-end">0.0 sn</span></div>`;

  const status = timelineCard.querySelector('.audio-status-row');
  status?.insertAdjacentElement('afterend', board);
  return board;
}

function ensureInsertHint() {
  const library = pane?.querySelector('.audio-library-card');
  if (!library) return null;
  if (insertHint?.isConnected) return insertHint;
  insertHint = document.createElement('div');
  insertHint.className = 'audio-insert-location';
  insertHint.innerHTML = `<span>＋</span><div><small>Yeni efekt buraya eklenecek</small><strong id="audioInsertPosition">0.0 sn</strong></div><button type="button" data-go-audio-time>Zamanı Gör</button>`;
  library.prepend(insertHint);
  insertHint.querySelector('[data-go-audio-time]')?.addEventListener('click', () => switchToTimeline());
  return insertHint;
}

function rows() { return [...(clipList?.querySelectorAll('.audio-clip-row') || [])]; }

function rowStart(row) {
  return Math.max(0, Number(row.querySelector('[data-role="start"]')?.value) || 0);
}

function rowName(row) {
  return row.querySelector('.audio-clip-main strong')?.textContent?.trim() || 'Ses';
}

function switchToTimeline() {
  const button = layout?.querySelector('[data-audio-jump="timeline"]');
  if (button) button.click();
}

function focusRow(row) {
  rows().forEach(item => item.classList.toggle('audio-location-focus', item === row));
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  setTimeout(() => row.classList.remove('audio-location-focus'), 1800);
}

function renderMarkers() {
  const ui = ensureBoard();
  ensureInsertHint();
  if (!ui) return;

  const total = totalSeconds();
  const now = Math.min(total, currentSeconds());
  const markerHost = ui.querySelector('.audio-position-markers');
  const playhead = ui.querySelector('.audio-position-playhead');
  const progress = ui.querySelector('.audio-position-progress');
  const current = ui.querySelector('#audioPlacementCurrent');
  const end = ui.querySelector('.audio-ruler-end');
  const insertPosition = document.getElementById('audioInsertPosition');

  if (current) current.textContent = `${format(now)} / ${format(total)}`;
  if (end) end.textContent = format(total);
  if (insertPosition) insertPosition.textContent = format(currentSeconds());
  const pct = Math.max(0, Math.min(100, (now / total) * 100));
  if (playhead) playhead.style.left = `${pct}%`;
  if (progress) progress.style.width = `${pct}%`;

  markerHost.innerHTML = '';
  rows().forEach((row, index) => {
    const start = rowStart(row);
    const left = Math.max(0, Math.min(100, (start / total) * 100));
    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'audio-position-marker';
    marker.style.left = `${left}%`;
    marker.style.setProperty('--lane', String(index % 3));
    marker.textContent = String(index + 1);
    marker.title = `${index + 1}. ${rowName(row)} · ${format(start)}`;
    marker.setAttribute('aria-label', marker.title);
    marker.addEventListener('click', () => focusRow(row));
    markerHost.append(marker);

    let badge = row.querySelector('.audio-location-number');
    if (!badge) {
      badge = document.createElement('span');
      badge.className = 'audio-location-number';
      row.querySelector('.audio-clip-main')?.prepend(badge);
    }
    const numberText = String(index + 1);
    if (badge && badge.textContent !== numberText) badge.textContent = numberText;

    const startInput = row.querySelector('[data-role="start"]');
    if (startInput && !startInput.dataset.visualBound) {
      startInput.dataset.visualBound = '1';
      startInput.addEventListener('input', renderMarkers);
      startInput.addEventListener('change', renderMarkers);
    }
  });
}

function handleClipMutation() {
  const count = rows().length;
  renderMarkers();
  if (initialized && count > lastCount && document.body.dataset.studioPanel === 'audio') {
    switchToTimeline();
    const newest = rows()[count - 1];
    if (newest) {
      newest.classList.add('audio-just-added');
      setTimeout(() => {
        newest.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => newest.classList.remove('audio-just-added'), 2200);
      }, 120);
    }
  }
  lastCount = count;
}

function syncPlayhead() { renderMarkers(); }

if (pane && layout && clipList) {
  setTimeout(() => {
    ensureBoard();
    ensureInsertHint();
    lastCount = rows().length;
    renderMarkers();
    initialized = true;
  }, 350);

  // Sadece klip listesinin doğrudan çocukları eklendiğinde/silindiğinde izle.
  // Klip içindeki numara etiketi gibi kendi DOM güncellemelerimizi izlemek sonsuz döngüye neden olur.
  const clipObserver = new MutationObserver(handleClipMutation);
  clipObserver.observe(clipList, { childList: true });

  const positionObserver = new MutationObserver(syncPlayhead);
  if (playbackPosition) positionObserver.observe(playbackPosition, { childList: true, subtree: true, characterData: true });
  if (durationValue) positionObserver.observe(durationValue, { childList: true, subtree: true, characterData: true });

  pane.addEventListener('click', event => {
    if (event.target.closest('.ninja-sfx-pad,.sfx-pad,[data-sfx]')) {
      ensureInsertHint();
      const target = document.getElementById('audioInsertPosition');
      if (target) target.textContent = format(currentSeconds());
    }
  }, true);

  document.querySelector('[data-dock-tab="audio"]')?.addEventListener('click', () => setTimeout(renderMarkers, 80));
  window.addEventListener('resize', renderMarkers);
}
