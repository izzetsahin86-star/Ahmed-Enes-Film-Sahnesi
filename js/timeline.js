export class Timeline {
  constructor(trackElement, handlers = {}) {
    this.track = trackElement;
    this.handlers = handlers;
    this.frames = [];
    this.selectedIndex = -1;
    this.dragIndex = null;
    this.zoom = 45;
    this.setZoom(this.zoom);
  }

  setFrames(frames, selectedIndex) {
    this.frames = frames;
    this.selectedIndex = selectedIndex;
    this.render();
  }

  select(index) {
    this.selectedIndex = index;
    this.track.querySelectorAll('.frame-card').forEach((card, i) => card.classList.toggle('selected', i === index));
    this.track.querySelector('.frame-card.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }

  setZoom(value) {
    this.zoom = Number(value);
    const width = Math.round(78 + (this.zoom / 100) * 86);
    this.track.style.setProperty('--frame-width', `${width}px`);
  }

  render() {
    this.track.innerHTML = '';
    if (!this.frames.length) {
      const empty = document.createElement('div');
      empty.className = 'timeline-empty';
      empty.innerHTML = '<strong>Timeline boş</strong><span>Kamerayı aç veya fotoğraf içe aktar.</span>';
      this.track.append(empty);
      return;
    }

    this.frames.forEach((frame, index) => {
      const button = document.createElement('button');
      button.className = `frame-card${index === this.selectedIndex ? ' selected' : ''}`;
      button.draggable = true;
      button.dataset.index = String(index);
      button.setAttribute('aria-label', `Kare ${index + 1}`);

      const img = document.createElement('img');
      img.src = frame.dataUrl;
      img.alt = `Kare ${index + 1}`;
      img.draggable = false;

      const badge = document.createElement('span');
      badge.className = 'frame-index';
      badge.textContent = String(index + 1).padStart(3, '0');
      button.append(img, badge);

      const hold = Math.max(1, Number(frame.hold) || 1);
      if (hold > 1) {
        const freeze = document.createElement('span');
        freeze.className = 'frame-freeze-badge';
        freeze.textContent = `×${hold}`;
        freeze.title = `Bu kare ${hold} kare süresi tutulur`;
        button.append(freeze);
      }

      button.addEventListener('click', () => this.handlers.onSelect?.(index));
      button.addEventListener('dblclick', () => this.handlers.onDuplicate?.(index));
      button.addEventListener('dragstart', event => {
        this.dragIndex = index;
        button.classList.add('dragging');
        event.dataTransfer.effectAllowed = 'move';
      });
      button.addEventListener('dragend', () => {
        button.classList.remove('dragging');
        this.dragIndex = null;
      });
      button.addEventListener('dragover', event => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      });
      button.addEventListener('drop', event => {
        event.preventDefault();
        if (this.dragIndex === null || this.dragIndex === index) return;
        this.handlers.onMove?.(this.dragIndex, index);
        this.dragIndex = null;
      });
      this.track.append(button);
    });

    requestAnimationFrame(() => this.track.querySelector('.frame-card.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' }));
  }
}
