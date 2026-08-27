// 전체화면. 브라우저마다 이름이 조금씩 달라서 한 겹 감싼다.

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

export function toggleFullscreen(el) {
  if (isFullscreen()) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (exit) exit.call(document);
    return false;
  }
  const target = el || document.documentElement;
  const req = target.requestFullscreen || target.webkitRequestFullscreen;
  if (req) req.call(target);
  return true;
}

// 화면 크기가 바뀌면 알려 준다
export function onFullscreenChange(handler) {
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
}
