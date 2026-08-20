const topControls = document.querySelector('.simple-top-controls');
const LOGO_URL = 'https://raw.githubusercontent.com/izzetsahin86-star/Ahmed-Enes-Film-Sahnesi/main/assets/ahmed-enes-logo.jpg?v=27';

function installCameraLogo() {
  const host = document.querySelector('.simple-top-controls') || topControls;
  if (!host) return;

  host.querySelector('.simple-close')?.remove();

  let logo = host.querySelector('.simple-corner-logo');
  if (!logo) {
    logo = document.createElement('div');
    logo.className = 'simple-corner-logo';
    logo.setAttribute('aria-label', 'Ahmed Enes Film Sahnesi');
    const img = document.createElement('img');
    img.alt = 'Ahmed Enes Film Sahnesi logosu';
    img.decoding = 'async';
    img.src = LOGO_URL;
    img.addEventListener('error', () => {
      img.removeAttribute('src');
      img.alt = '';
      logo.classList.add('logo-load-error');
    }, { once: true });
    logo.append(img);
    host.prepend(logo);
  } else {
    const img = logo.querySelector('img');
    if (img && img.src !== LOGO_URL) img.src = LOGO_URL;
  }
}

installCameraLogo();
requestAnimationFrame(installCameraLogo);
setTimeout(installCameraLogo, 120);
setTimeout(installCameraLogo, 600);

const hostObserver = new MutationObserver(() => installCameraLogo());
const cameraColumn = document.querySelector('.camera-stage-column');
if (cameraColumn) hostObserver.observe(cameraColumn, { childList: true, subtree: true });
