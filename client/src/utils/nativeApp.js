const DEEP_LINK_SCHEME = 'edumeetlive://';

export function openNativeApp(roomId, token) {
  const url = `${DEEP_LINK_SCHEME}meeting/${roomId}?token=${token}`;
  window.location.href = url;
}

export function isNativeAppInstalled() {
  return new Promise((resolve) => {
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = `${DEEP_LINK_SCHEME}meeting/test`;
    document.body.appendChild(iframe);
    
    setTimeout(() => {
      document.body.removeChild(iframe);
      resolve(false);
    }, 1000);
  });
}