// iPad shim: stands in for preload.js so the PC's own renderers (widget, stage, fullscreen) run unchanged
// inside the iPad page. All data comes from the parent page's hub (one live connection, one sound stream).
(() => {
  const hub = window.parent !== window && window.parent.WvHub;
  if (!hub) { document.documentElement.innerHTML = '<body style="background:#000;color:#fff;font:16px sans-serif;padding:40px">請從 Wavelet 的 iPad 頁面打開。</body>'; return; }
  window.api = {
    get: async () => hub.snapshot(),
    patch: async (p) => hub.patchLocal(p),      // style changes made on the iPad stay on the iPad
    cmd: async (c, a) => hub.cmd(c, a),
    on: (ch, cb) => hub.on(ch, cb, window),
    sendFrame() {}, sendAudioStatus() {}, sendPcm() {},
  };
  // Touch has no hover: let a tap count as "mouse moved" so pages that hide their controls when idle show them.
  addEventListener('pointerdown', () => dispatchEvent(new MouseEvent('mousemove')), true);
  // Keyboard hints mean nothing on a tablet.
  const css = document.createElement('style'); css.textContent = '#hint{display:none!important}'; document.head.appendChild(css);
})();
