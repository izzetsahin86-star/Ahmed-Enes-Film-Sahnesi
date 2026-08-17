export class Timeline {
  constructor(trackElement, handlers = {}) {
    this.track = trackElement;
    this.handlers = handlers;
    this.frames = [];
    this.selectedIndex = -1;
    this.dragIndex = null;
  }

  setFrames(frames, selectedIndex) {
    this.frames = frames;
    this.selectedIndex = selectedIndex;
    this.render();
  }

  render() {
    this.track.innerHTML = '';
    if (!this.frames.length) {
      const empty = document.createElement('div');
      empty.className = 'timeline-empty';
      empty.textContent = 'Henüz kare yok — kamerayı açıp ilk kareyi çek.';
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
      badge.textContent = String(index + 1);

      button.append(img, badge);
      button.addEventListener('click', () => this.handlers.onSelect?.(index));
      button.addEventListener('dragstart', () => {
        this.dragIndex = index;
        button.classList.add('dragging');
      });
      button.addEventListener('dragend', () => button.classList.remove('dragging'));
      button.addEventListener('dragover', event => event.preventDefault());
      button.addEventListener('drop', event => {
        event.preventDefault();
        if (this.dragIndex === null || this.dragIndex === index) return;
        this.handlers.onMove?.(this.dragIndex, index);
        this.dragIndex = null;
      });
      this.track.append(button);
    });

    requestAnimationFrame(() => {
      this.track.querySelector('.frame-card.selected')?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    });
  }
}
