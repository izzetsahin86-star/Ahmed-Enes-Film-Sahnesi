const topControls = document.querySelector('.simple-top-controls');

function installCameraLogo() {
  const host = document.querySelector('.simple-top-controls') || topControls;
  if (!host) return;

  host.querySelector('.simple-close')?.remove();

  if (!host.querySelector('.simple-corner-logo')) {
    const logo = document.createElement('div');
    logo.className = 'simple-corner-logo';
    logo.setAttribute('aria-label', 'Ahmed Enes Film Sahnesi');
    logo.innerHTML = '<img src="./assets/ahmed-enes-logo.jpg" alt="Ahmed Enes Film Sahnesi logosu">';
    host.prepend(logo);
  }
}

installCameraLogo();
requestAnimationFrame(installCameraLogo);
setTimeout(installCameraLogo, 120);
setTimeout(installCameraLogo, 600);

const hostObserver = new MutationObserver(() => installCameraLogo());
const cameraColumn = document.querySelector('.camera-stage-column');
if (cameraColumn) hostObserver.observe(cameraColumn, { childList: true, subtree: true });
