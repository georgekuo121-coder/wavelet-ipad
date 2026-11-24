// Shared renderer runtime: settings/media/audio subscriptions, palettes, smoothing, lyrics timing, edit chrome.
const Wv = (() => {
  const N = 128;
  const Q = new URLSearchParams(location.search);
  const st = {
    s: null, media: {}, lyrics: { lines: [] }, spotify: { connected: false, queue: [] }, stats: null, weather: null, sys: null, covered: false, edit: false,
    audio: { f: new Uint8Array(N), w: new Uint8Array(256).fill(128), level: 0, bass: 0, mid: 0, treble: 0, beat: false, flux: 0 },
    cover: null, coverPal: null, cursor: { x: -9999, y: -9999 }, lastAudio: 0,
  };
  const A = { sm: new Float32Array(N), peaks: new Float32Array(N), wave: st.audio.w, bass: 0, mid: 0, treble: 0, level: 0, beat: false, pulse: 0, flux: 0, energy: 0, cover: null };
  const handlers = {};
  const emit = (k, d) => (handlers[k] || []).forEach((f) => f(d));
  const on = (k, f) => (handlers[k] = handlers[k] || []).push(f);

  /* ---------- colour ---------- */
  const THEMES = {
    Nebula: ['#6366f1', '#a855f7', '#ec4899'], Ocean: ['#06b6d4', '#3b82f6', '#8b5cf6'], Sunset: ['#f59e0b', '#ef4444', '#ec4899'],
    Forest: ['#10b981', '#84cc16', '#facc15'], Ice: ['#e0f2fe', '#7dd3fc', '#818cf8'], Mono: ['#ffffff', '#a1a1aa', '#52525b'],
  };
  const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;
  function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    let h = 0, s = 0;
    if (d) {
      s = d / (1 - Math.abs(2 * l - 1));
      h = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
    }
    return [h, s, l];
  }
  // One swatch -> three-stop palette, sweeping the hue both ways so it reads as a designed gradient.
  function sweep(hex) {
    const [h, s, l] = hexToHsl(hex);
    const S = Math.max(0.55, s), L = Math.min(0.68, Math.max(0.5, l));
    return [hsl(h - 38, S, L - 0.04), hsl(h, S, L), hsl(h + 38, Math.min(1, S + 0.05), L + 0.06)];
  }
  function coverPalette(img) {
    const c = document.createElement('canvas'); c.width = c.height = 24;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, 24, 24);
    const d = g.getImageData(0, 0, 24, 24).data;
    let x = 0, y = 0, wsum = 0, ssum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      const [h, s, l] = hexToHsl('#' + ((1 << 24) | (d[i] << 16) | (d[i + 1] << 8) | d[i + 2]).toString(16).slice(1));
      const w = s * (1 - Math.abs(l - 0.5) * 1.6);
      if (w <= 0) { n++; continue; }
      x += Math.cos((h * Math.PI) / 180) * w; y += Math.sin((h * Math.PI) / 180) * w; wsum += w; ssum += s; n++;
    }
    const hue = (Math.atan2(y, x) * 180) / Math.PI;
    if (ssum / n < 0.12 || wsum < 2) return [hsl(hue, 0.18, 0.93), hsl(hue, 0.14, 0.82), hsl(hue + 30, 0.22, 0.72)]; // grey cover: pale tinted whites
    return [hsl(hue - 35, 0.75, 0.58), hsl(hue, 0.8, 0.62), hsl(hue + 35, 0.85, 0.7)];
  }
  // Palette for the visualizer widget (and anything that follows it).
  function palette(over) {
    const s = st.s; if (!s) return THEMES.Nebula;
    if (over === 'album' && st.coverPal) return st.coverPal;
    if (over && THEMES[over]) return THEMES[over];
    if (s.pro.moodSync && st.coverPal) return st.coverPal;
    if (s.vis.accent) return sweep(s.vis.accent);
    return THEMES[s.vis.theme] || THEMES.Nebula;
  }

  /* ---------- audio smoothing ---------- */
  function update(dt) {
    const s = st.s, sens = s ? s.audio.sens : 1.3, smooth = s ? s.audio.smooth : 0.75;
    const bb = s ? s.audio.bassBoost ?? 1 : 1, tb = s ? s.audio.trebleBoost ?? 1 : 1;
    const fresh = performance.now() - st.lastAudio < 300;
    const f = st.audio.f;
    for (let i = 0; i < N; i++) {
      const tilt = bb + (tb - bb) * (i / (N - 1));
      const v = fresh ? Math.min(1, (f[i] / 255) * sens * tilt) : 0;
      A.sm[i] = v > A.sm[i] ? A.sm[i] + (v - A.sm[i]) * 0.65 : A.sm[i] * smooth + v * (1 - smooth);
      A.peaks[i] = Math.max(A.sm[i], A.peaks[i] - dt * 0.5);
    }
    const k = fresh ? 1 : 0;
    A.bass = A.bass * 0.6 + Math.min(1, st.audio.bass * sens * bb) * 0.4 * k;
    A.mid = A.mid * 0.6 + Math.min(1, st.audio.mid * sens * (bb + tb) / 2) * 0.4 * k;
    A.treble = A.treble * 0.6 + Math.min(1, st.audio.treble * sens * 1.4 * tb) * 0.4 * k;
    A.level = A.level * 0.7 + Math.min(1, st.audio.level * sens) * 0.3 * k;
    A.flux = A.flux * 0.8 + st.audio.flux * 0.2 * k;
    A.energy = A.energy * 0.995 + A.level * 0.005;
    A.beat = fresh && st.audio.beat; st.audio.beat = false;
    A.pulse = A.beat ? 1 : Math.max(0, A.pulse - dt * 3.2);
    A.wave = st.audio.w;
    A.cover = st.cover;
  }
  const silent = () => A.level < 0.015;

  /* ---------- timing ---------- */
  const mode = Q.get('mode') || '';
  function paused() { return mode === 'wallpaper' && st.covered && st.s && st.s.system.pauseCovered; }
  function run(draw) {
    let last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);
      const fps = silent() ? 20 : (st.s ? st.s.system.fps : 60);
      if (now - last < 1000 / fps - 1.5) return;
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      if (paused() || !st.s) return;
      update(dt);
      draw(dt, now / 1000);
    }
    requestAnimationFrame(frame);
  }
  function fit(canvas) {
    const dpr = devicePixelRatio || 1, r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const g = canvas.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { g, w: r.width, h: r.height };
  }

  /* ---------- media ---------- */
  function position() {
    const m = st.media; if (!m || !m.duration) return 0;
    const p = (m.position || 0) + (m.status === 'Playing' ? (Date.now() - (m.updated || Date.now())) / 1000 : 0);
    return Math.max(0, Math.min(m.duration, p));
  }
  function lyricIndex() {
    const L = st.lyrics.lines || []; const p = position() + 0.25 + ((st.s && st.s.lyrics.offset) || 0); let i = -1;
    for (let k = 0; k < L.length; k++) { if (L[k].t <= p) i = k; else break; }
    return i;
  }
  function loadCover(src) {
    if (!src) { st.cover = null; st.coverPal = null; emit('cover', null); return; }
    const img = new Image();
    img.onload = () => { st.cover = img; try { st.coverPal = coverPalette(img); } catch { st.coverPal = null; } emit('cover', img); };
    img.src = src;
  }

  /* ---------- interaction: drag anywhere to move, corner to resize, tap / double-tap ---------- */
  const css = document.createElement('style');
  css.textContent = `
    #wv-edit{position:fixed;inset:0;border:1.5px dashed rgba(167,139,250,.75);border-radius:14px;z-index:99;pointer-events:none;opacity:0;transition:opacity .2s}
    body.wv-active #wv-edit{opacity:1}
    #wv-edit .bar{position:absolute;top:6px;left:50%;transform:translateX(-50%);font:11px 'Segoe UI','Microsoft JhengHei',sans-serif;color:#fff;background:rgba(0,0,0,.6);padding:3px 9px;border-radius:6px;white-space:nowrap}
    #wv-edit .corner{position:absolute;right:0;bottom:0;width:24px;height:24px;pointer-events:auto;cursor:nwse-resize;background:linear-gradient(135deg,transparent 50%,#a78bfa 50%);border-bottom-right-radius:12px}
    body.wv-active{cursor:grab} body.wv-drag{cursor:grabbing}
    .wv-seek{display:flex;align-items:center;gap:8px;font:11px 'Segoe UI',sans-serif;color:rgba(255,255,255,.75);font-variant-numeric:tabular-nums;cursor:default}
    .wv-seek .trk{position:relative;flex:1;height:14px;cursor:pointer;display:flex;align-items:center}
    .wv-seek .trk:before{content:'';position:absolute;left:0;right:0;height:4px;border-radius:2px;background:rgba(255,255,255,.18)}
    .wv-seek .trk i{position:absolute;left:0;height:4px;border-radius:2px;background:var(--seek,#fff)}
    .wv-seek .trk b{position:absolute;width:12px;height:12px;margin-left:-6px;border-radius:50%;background:#fff;box-shadow:0 0 8px rgba(0,0,0,.5);opacity:0;transition:opacity .15s}
    .wv-seek .trk:hover b,.wv-seek.drag .trk b{opacity:1}
    .wv-seek .trk:hover:before,.wv-seek.drag .trk:before{height:6px}
    .wv-btns{display:flex;gap:6px}
    .wv-btns button{width:28px;height:28px;border-radius:50%;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:12px;cursor:pointer}
    .wv-btns button:hover{background:rgba(255,255,255,.28)}`;
  document.head.appendChild(css);
  let lifted = false;
  function setActive() {
    const hoverable = mode === 'top' || mode === 'normal';
    document.body.classList.toggle('wv-active', mode === 'edit' || lifted || (hoverable && document.body.matches(':hover')));
  }
  function editChrome() {
    const el = document.createElement('div');
    el.id = 'wv-edit';
    el.innerHTML = '<div class="bar">拖曳移動 · 右下角縮放</div><div class="corner"></div>';
    document.body.appendChild(el);
    api.on('lift', (v) => { lifted = v; setActive(); });
    document.addEventListener('mouseover', setActive); document.addEventListener('mouseleave', () => document.body.classList.remove('wv-active'));
    setActive();
    // resize from the corner
    const c = el.querySelector('.corner');
    c.addEventListener('pointerdown', (e) => {
      e.stopPropagation(); c.setPointerCapture(e.pointerId);
      const sx = e.screenX, sy = e.screenY, w0 = innerWidth, h0 = innerHeight;
      const mv = (ev) => api.cmd('resize', { w: w0 + ev.screenX - sx, h: h0 + ev.screenY - sy });
      c.addEventListener('pointermove', mv);
      c.addEventListener('pointerup', () => { c.removeEventListener('pointermove', mv); api.cmd('resize', { end: true }); }, { once: true });
    });
    // drag anywhere else to move; a press without movement is a tap
    let lastTap = 0;
    document.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('[data-nodrag],button,input,select,a')) return;
      const t = e.target; t.setPointerCapture(e.pointerId);
      const sx = e.screenX, sy = e.screenY, wx = window.screenX, wy = window.screenY;
      let moved = false, raf = 0, lx = 0, ly = 0;
      const mv = (ev) => {
        lx = ev.screenX - sx; ly = ev.screenY - sy;
        if (!moved && Math.hypot(lx, ly) < 4) return;
        moved = true; document.body.classList.add('wv-drag');
        if (!raf) raf = requestAnimationFrame(() => { raf = 0; api.cmd('move', { x: wx + lx, y: wy + ly }); });
      };
      t.addEventListener('pointermove', mv);
      t.addEventListener('pointerup', () => {
        t.removeEventListener('pointermove', mv); document.body.classList.remove('wv-drag');
        if (moved) { api.cmd('move', { x: wx + lx, y: wy + ly }).then(() => api.cmd('move', { end: true })); return; }
        const now = performance.now();
        if (now - lastTap < 320) { lastTap = 0; emit('dbltap'); } else { lastTap = now; emit('tap'); }
      }, { once: true });
    });
  }
  const fmtTime = (s) => { s = Math.max(0, Math.floor(s || 0)); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = String(s % 60).padStart(2, '0'); return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
  // Draggable progress bar that seeks the real player through the media session.
  function seekBar(host, { times = true } = {}) {
    host.innerHTML = `<div class="wv-seek" data-nodrag>${times ? '<span class="cur">0:00</span>' : ''}<div class="trk"><i></i><b></b></div>${times ? '<span class="dur">0:00</span>' : ''}</div>`;
    const root = host.firstChild, trk = root.querySelector('.trk'), fill = trk.querySelector('i'), knob = trk.querySelector('b');
    let drag = null;
    const frac = (e) => { const r = trk.getBoundingClientRect(); return Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); };
    const paint = (f) => { fill.style.width = f * 100 + '%'; knob.style.left = f * 100 + '%'; const d = st.media.duration || 0; if (times) { root.querySelector('.cur').textContent = fmtTime(f * d); root.querySelector('.dur').textContent = fmtTime(d); } };
    trk.addEventListener('pointerdown', (e) => {
      if (!st.media.duration) return;
      e.stopPropagation(); trk.setPointerCapture(e.pointerId); drag = frac(e); root.classList.add('drag'); paint(drag);
      const mv = (ev) => { drag = frac(ev); paint(drag); };
      trk.addEventListener('pointermove', mv);
      trk.addEventListener('pointerup', () => { trk.removeEventListener('pointermove', mv); root.classList.remove('drag'); api.cmd('seek', drag * st.media.duration); drag = null; }, { once: true });
    });
    return { update() { if (drag != null) return; const d = st.media.duration || 0; paint(d ? position() / d : 0); root.style.visibility = d ? 'visible' : 'hidden'; } };
  }
  function transport(host) {
    host.innerHTML = '<div class="wv-btns" data-nodrag><button data-c="prev">⏮</button><button data-c="play">⏯</button><button data-c="next">⏭</button></div>';
    host.addEventListener('click', (e) => { const c = e.target.dataset && e.target.dataset.c; if (c) api.cmd('media', c); });
    return { update() { const b = host.querySelector('[data-c=play]'); if (b) b.textContent = st.media.status === 'Playing' ? '⏸' : '▶'; } };
  }

  /* ---------- boot ---------- */
  async function init() {
    api.on('audio', (f) => { st.audio = f; st.lastAudio = performance.now(); });
    api.on('settings', (s) => { st.s = s; emit('settings', s); });
    api.on('media', (m) => { const old = st.media.cover; st.media = m; if (m.cover !== old) loadCover(m.cover); emit('media', m); });
    api.on('lyrics', (l) => { st.lyrics = l; emit('lyrics', l); });
    api.on('stats', (d) => { st.stats = d; emit('stats', d); });
    api.on('weather', (d) => { st.weather = d; emit('weather', d); });
    api.on('sys', (d) => { st.sys = d; emit('sys', d); });
    api.on('covered', (c) => { st.covered = c; });
    api.on('cursor', (p) => { st.cursor = p; });
    api.on('edit', (e) => { st.edit = e; emit('edit', e); });
    api.on('audio-status', (a) => emit('audio-status', a));
    api.on('spotify', (d) => { st.spotify = d; emit('spotify', d); });
    api.on('remote', (d) => emit('remote', d));
    const snap = await api.get();
    Object.assign(st, { s: snap.settings, media: snap.media, lyrics: snap.lyrics, stats: snap.stats, weather: snap.weather, sys: snap.sys, covered: snap.covered, edit: snap.editMode, spotify: snap.spotify || { connected: false, queue: [] } });
    loadCover(snap.media && snap.media.cover);
    emit('ready', snap);
    emit('settings', st.s); emit('media', st.media); emit('lyrics', st.lyrics);
    return snap;
  }
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  return { st, A, N, Q, THEMES, mode, on, init, run, fit, palette, sweep, hsl, position, lyricIndex, editChrome, seekBar, transport, fmtTime, esc, silent };
})();
