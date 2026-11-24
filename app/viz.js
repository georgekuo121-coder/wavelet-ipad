// Visualizer drawing library. Viz.draw(style, g, w, h, A, P, t, opts)
//  A: smoothed audio from Wv.A   P: three-stop palette   opts: { look, density, glow, center }
const Viz = (() => {
  const FREE = ['Bars', 'Mirror', 'Blocks', 'Ring', 'Waveform', 'Aurora'];
  const PRO = ['Orb', 'Vinyl', 'Waterfall', 'Scope', 'Particles', 'Terrain', 'Meters', 'Halo'];
  const LOOKS = {
    Orb: ['Dots', 'Rings', 'Spikes', 'Album'], Vinyl: ['Black', 'Picture', 'Neon'], Waterfall: ['Ridges', 'Heatmap'],
    Scope: ['XY', 'Line', 'Polar'], Particles: ['Burst', 'Fountain', 'Galaxy'], Terrain: ['Synth', 'Wire', 'Peaks'],
    Meters: ['Needles', 'Ladders', 'Rings', 'Dots'], Halo: ['White', 'Mono', 'Theme'],
  };
  const PERSIST = { Scope: true };
  const mem = new WeakMap();
  const S = (g) => { let s = mem.get(g); if (!s) mem.set(g, (s = {})); return s; };
  const TAU = Math.PI * 2;

  function alpha(c, a) {
    if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
    return c.replace(/\)$/, ` / ${a})`).replace('hsl(', 'hsl(');
  }
  function lin(g, x0, y0, x1, y1, P) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, P[0]); gr.addColorStop(0.5, P[1]); gr.addColorStop(1, P[2]); return gr; }
  const glow = (g, c, o, k = 18) => { g.shadowColor = c; g.shadowBlur = (o.glow ?? 0.6) * k; };
  const noGlow = (g) => { g.shadowBlur = 0; };
  // Average of the smoothed spectrum for bar i of n, using the musical range.
  function band(A, i, n, range = 0.82) {
    const N = A.sm.length, a = Math.floor((i / n) * N * range), b = Math.max(a + 1, Math.floor(((i + 1) / n) * N * range));
    let s = 0; for (let k = a; k < b; k++) s += A.sm[k]; return s / (b - a);
  }
  const barCount = (w, o, min = 12, max = 128) => Math.max(min, Math.min(max, Math.round(w / (4 + (1 - (o.density ?? 0.5)) * 16))));

  /* ================= FREE ================= */
  function Bars(g, w, h, A, P, t, o) {
    const refl = o.refl ?? 0.16, n = barCount(w, o), slot = w / n, bw = slot * Math.min(0.96, 0.72 * o.thick), gap = slot - bw, base = refl > 0 ? h * 0.8 : h * 0.97, max = base * 0.92;
    g.fillStyle = lin(g, 0, 0, w, 0, P); glow(g, P[1], o);
    for (let i = 0; i < n; i++) {
      const v = band(A, i, n), bh = Math.max(2, v * max), x = i * (bw + gap) + gap / 2;
      g.beginPath(); g.roundRect(x, base - bh, bw, bh, Math.min(bw / 2, 4)); g.fill();
    }
    noGlow(g);
    if (refl <= 0) return;
    g.save(); g.globalAlpha = refl; g.translate(0, base * 2 + 4); g.scale(1, -1);
    for (let i = 0; i < n; i++) { const v = band(A, i, n), bh = Math.max(2, v * max) * 0.35, x = i * (bw + gap) + gap / 2; g.fillRect(x, base - bh, bw, bh); }
    g.restore();
  }
  function Mirror(g, w, h, A, P, t, o) {
    const n = barCount(w, o) & ~1, half = n / 2, bw = (w / n) * Math.min(0.96, 0.7 * o.thick), gap = w / n - bw, cy = h / 2, max = h * 0.44;
    g.fillStyle = lin(g, 0, cy - max, 0, cy + max, [P[2], P[1], P[0]]); glow(g, P[1], o);
    for (let i = 0; i < n; i++) {
      const k = i < half ? half - 1 - i : i - half, v = band(A, k, half), bh = Math.max(1.5, v * max), x = i * (bw + gap) + gap / 2;
      g.beginPath(); g.roundRect(x, cy - bh, bw, bh * 2, Math.min(bw / 2, 3)); g.fill();
    }
    noGlow(g);
  }
  function Blocks(g, w, h, A, P, t, o) {
    const n = Math.max(10, Math.round(barCount(w, o) * 0.6)), rows = Math.max(8, Math.round(h / 14)), cw = w / n, ch = (h * 0.86) / rows;
    const s = S(g); s.cap = s.cap || new Float32Array(128);
    glow(g, P[1], o, 10);
    for (let i = 0; i < n; i++) {
      const v = band(A, i, n), lit = Math.round(v * rows);
      s.cap[i] = Math.max(lit, (s.cap[i] || 0) - 0.15);
      for (let r = 0; r < lit; r++) { const f = r / rows; g.fillStyle = f < 0.5 ? P[0] : f < 0.8 ? P[1] : P[2]; g.fillRect(i * cw + cw * 0.12, h * 0.93 - (r + 1) * ch + ch * 0.15, cw * 0.76, ch * 0.7); }
      g.fillStyle = P[2]; const cr = Math.floor(s.cap[i]); if (cr > 0) g.fillRect(i * cw + cw * 0.12, h * 0.93 - (cr + 1) * ch + ch * 0.5, cw * 0.76, ch * 0.25);
    }
    noGlow(g);
  }
  function Ring(g, w, h, A, P, t, o) {
    const cx = o.cx ?? w / 2, cy = o.cy ?? h / 2, m = o.radius ?? Math.min(w, h) * 0.22;
    const R = m * (1 + A.bass * 0.12), n = Math.round(90 + (o.density ?? 0.5) * 90), max = o.ringMax ?? Math.min(w, h) * 0.26;
    g.lineCap = 'round'; g.lineWidth = Math.max(1, (TAU * R) / n * 0.5 * o.thick); glow(g, P[1], o, 14);
    const rot = t * 0.12;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rot - Math.PI / 2, k = i < n / 2 ? i : n - i, v = band(A, k, n / 2, 0.7), l = v * max + 2;
      g.strokeStyle = i % 3 === 0 ? P[0] : i % 3 === 1 ? P[1] : P[2];
      g.beginPath(); g.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.lineTo(cx + Math.cos(a) * (R + l), cy + Math.sin(a) * (R + l)); g.stroke();
    }
    noGlow(g);
    if (A.cover && o.ringCover !== false) {
      g.save(); g.beginPath(); g.arc(cx, cy, R * 0.86, 0, TAU); g.clip(); g.drawImage(A.cover, cx - R * 0.86, cy - R * 0.86, R * 1.72, R * 1.72); g.restore();
    } else {
      const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R); gr.addColorStop(0, alpha(P[1], 0.45 + A.bass * 0.4)); gr.addColorStop(1, alpha(P[0], 0));
      g.fillStyle = gr; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.fill();
    }
  }
  function Waveform(g, w, h, A, P, t, o) {
    const wv = A.wave, n = wv.length, cy = h / 2;
    g.lineJoin = 'round'; glow(g, P[1], o, 20);
    for (let L = 2; L >= 0; L--) {
      const amp = h * 0.38 * (0.55 + A.level) * (1 - L * 0.22) * (A.scaleWave || 1);
      g.strokeStyle = P[L]; g.globalAlpha = 1 - L * 0.28; g.lineWidth = (2.5 - L * 0.6) * o.thick;
      g.beginPath();
      let px = 0, py = cy;
      for (let i = 0; i < n; i += 2) {
        const x = (i / (n - 1)) * w, edge = Math.sin((i / (n - 1)) * Math.PI);
        const y = cy + ((wv[(i + L * 9) % n] - 128) / 128) * amp * edge + Math.sin(i * 0.04 + t * (1 + L * 0.4)) * h * 0.03 * edge;
        if (!i) g.moveTo(x, y); else g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
        px = x; py = y;
      }
      g.stroke();
    }
    g.globalAlpha = 1; noGlow(g);
  }
  function Aurora(g, w, h, A, P, t, o) {
    g.globalCompositeOperation = 'lighter';
    const steps = 48;
    for (let L = 0; L < 3; L++) {
      for (let i = 0; i < steps; i++) {
        const x = (i / steps) * w, v = band(A, i, steps, 0.6);
        const top = h * (0.62 - L * 0.07) - v * h * 0.5 - Math.sin(i * 0.25 + t * (0.5 + L * 0.25) + L * 2) * h * 0.06 * (1 + A.bass);
        const gr = g.createLinearGradient(0, top, 0, h * 0.95);
        gr.addColorStop(0, alpha(P[L], 0)); gr.addColorStop(0.15, alpha(P[L], 0.28 + v * 0.35)); gr.addColorStop(1, alpha(P[L], 0));
        g.fillStyle = gr; g.fillRect(x, top, w / steps + 1, h * 0.95 - top);
      }
    }
    g.globalCompositeOperation = 'source-over';
  }

  /* ================= PRO ================= */
  function Orb(g, w, h, A, P, t, o) {
    const s = S(g), look = LOOKS.Orb[(o.look || 0) % 4], cx = w / 2, cy = h / 2, R0 = Math.min(w, h) * 0.3;
    if (!s.pts) {
      s.pts = []; const n = 340;
      for (let i = 0; i < n; i++) { const y = 1 - (i / (n - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963; s.pts.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
      s.kick = 0;
    }
    s.kick = Math.max(s.kick * 0.9, A.pulse);
    const rot = t * 0.35, cr = Math.cos(rot), sr = Math.sin(rot), tilt = 0.35, ct = Math.cos(tilt), stt = Math.sin(tilt);
    const halo = g.createRadialGradient(cx, cy, 0, cx, cy, R0 * 1.8);
    halo.addColorStop(0, alpha(P[1], 0.35 + A.bass * 0.35)); halo.addColorStop(0.5, alpha(P[0], 0.12)); halo.addColorStop(1, alpha(P[0], 0));
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    const proj = (p) => {
      const lat = Math.abs(p[1]);
      const flick = A.treble * Math.pow(lat, 4) * (0.6 + 0.4 * Math.sin(t * 40 + p[0] * 20));
      const R = R0 * (1 + A.bass * 0.28 * (1 - lat) + flick * 0.35 + s.kick * 0.18);
      let x = p[0] * cr - p[2] * sr, z = p[0] * sr + p[2] * cr, y = p[1];
      const y2 = y * ct - z * stt, z2 = y * stt + z * ct;
      return [cx + x * R, cy + y2 * R, z2, R];
    };
    if (look === 'Album' && A.cover) {
      const r = R0 * (0.8 + A.bass * 0.15); g.save(); g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.clip(); g.drawImage(A.cover, cx - r, cy - r, r * 2, r * 2); g.restore();
    }
    glow(g, P[1], o, 12);
    if (look === 'Rings') {
      g.lineWidth = 1.4;
      for (let k = 1; k < 12; k++) {
        const lat = -1 + (k / 12) * 2; g.strokeStyle = P[k % 3]; g.beginPath();
        for (let j = 0; j <= 48; j++) { const a = (j / 48) * TAU, r = Math.sqrt(1 - lat * lat); const q = proj([Math.cos(a) * r, lat, Math.sin(a) * r]); j ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); }
        g.stroke();
      }
    } else {
      for (let i = 0; i < s.pts.length; i++) {
        const p = s.pts[i], q = proj(p), front = (q[2] + 1) / 2;
        const v = band(A, i % 64, 64);
        g.fillStyle = P[i % 3]; g.globalAlpha = 0.25 + front * 0.75;
        if (look === 'Spikes') {
          g.strokeStyle = P[i % 3]; g.lineWidth = 1.2; const ex = cx + (q[0] - cx) * (1 + v * 0.5), ey = cy + (q[1] - cy) * (1 + v * 0.5);
          g.beginPath(); g.moveTo(q[0], q[1]); g.lineTo(ex, ey); g.stroke();
        } else { g.beginPath(); g.arc(q[0], q[1], (0.8 + front * 1.8 + v * 2.2) * o.thick, 0, TAU); g.fill(); }
      }
      g.globalAlpha = 1;
    }
    noGlow(g);
  }
  function Vinyl(g, w, h, A, P, t, o) {
    const s = S(g), look = LOOKS.Vinyl[(o.look || 0) % 3], cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.36;
    s.ang = (s.ang || 0) + (0.55 + A.level * 0.6) * (o.dt || 0.016) * TAU * 0.55;
    // spectrum halo
    g.lineWidth = 2; glow(g, P[1], o, 12);
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * TAU - Math.PI / 2, v = band(A, i < 48 ? i : 96 - i, 48, 0.7), l = v * R * 0.35;
      g.strokeStyle = P[i % 3]; g.beginPath(); g.moveTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6)); g.lineTo(cx + Math.cos(a) * (R + 6 + l), cy + Math.sin(a) * (R + 6 + l)); g.stroke();
    }
    noGlow(g);
    g.save(); g.translate(cx, cy); g.rotate(s.ang);
    g.beginPath(); g.arc(0, 0, R, 0, TAU);
    if (look === 'Picture' && A.cover) { g.save(); g.clip(); g.drawImage(A.cover, -R, -R, R * 2, R * 2); g.restore(); }
    else { g.fillStyle = look === 'Neon' ? '#07070c' : '#111'; g.fill(); }
    for (let r = R * 0.38; r < R * 0.97; r += 2.2) {
      g.strokeStyle = look === 'Neon' ? alpha(P[Math.floor(r) % 3], 0.18 + A.level * 0.25) : `rgba(255,255,255,${0.035 + ((r * 7) % 3) * 0.01})`;
      g.lineWidth = 1; g.beginPath(); g.arc(0, 0, r, 0, TAU); g.stroke();
    }
    const sheen = g.createLinearGradient(-R, -R, R, R); sheen.addColorStop(0.35, 'rgba(255,255,255,0)'); sheen.addColorStop(0.5, 'rgba(255,255,255,0.10)'); sheen.addColorStop(0.65, 'rgba(255,255,255,0)');
    g.fillStyle = sheen; g.beginPath(); g.arc(0, 0, R, 0, TAU); g.fill();
    const lr = R * 0.34; g.beginPath(); g.arc(0, 0, lr, 0, TAU);
    if (A.cover && look !== 'Picture') { g.save(); g.clip(); g.drawImage(A.cover, -lr, -lr, lr * 2, lr * 2); g.restore(); }
    else if (look !== 'Picture') { g.fillStyle = lin(g, -lr, -lr, lr, lr, P); g.fill(); }
    g.fillStyle = '#000'; g.beginPath(); g.arc(0, 0, 3.5, 0, TAU); g.fill();
    g.restore();
    // tonearm
    g.strokeStyle = '#d4d4d8'; g.lineWidth = 4; g.lineCap = 'round';
    const px = cx + R * 1.05, py = cy - R * 0.95, ang = 2.15 + A.level * 0.03;
    g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(ang) * R * 1.05, py + Math.sin(ang) * R * 1.05); g.stroke();
    g.fillStyle = '#a1a1aa'; g.beginPath(); g.arc(px, py, 8, 0, TAU); g.fill();
  }
  function Waterfall(g, w, h, A, P, t, o) {
    const s = S(g), look = LOOKS.Waterfall[(o.look || 0) % 2], cols = 64;
    s.hist = s.hist || []; s.acc = (s.acc || 0) + (o.dt || 0.016);
    if (s.acc > 0.045) { s.acc = 0; const row = new Float32Array(cols); for (let i = 0; i < cols; i++) row[i] = band(A, i, cols); s.hist.unshift(row); if (s.hist.length > 42) s.hist.pop(); }
    if (look === 'Heatmap') {
      const rows = s.hist.length, cw = w / cols, rh = h / 42;
      for (let r = 0; r < rows; r++) for (let i = 0; i < cols; i++) {
        const v = s.hist[r][i]; if (v < 0.04) continue;
        g.fillStyle = alpha(v < 0.35 ? P[0] : v < 0.7 ? P[1] : P[2], Math.min(1, v * 1.4) * (1 - r / 46)); g.fillRect(i * cw, r * rh, cw + 0.5, rh + 0.5);
      }
      return;
    }
    for (let r = s.hist.length - 1; r >= 0; r--) {
      const row = s.hist[r], depth = r / 42, y0 = h * 0.88 - depth * h * 0.62, sx = w * 0.08 + depth * w * 0.14, sw = w - sx * 2, amp = h * 0.32 * (1 - depth * 0.55);
      g.beginPath(); g.moveTo(sx, y0);
      for (let i = 0; i < cols; i++) g.lineTo(sx + (i / (cols - 1)) * sw, y0 - row[i] * amp);
      g.lineTo(sx + sw, y0); g.closePath();
      g.fillStyle = `rgba(5,5,10,${0.85 - depth * 0.4})`; g.fill();
      g.strokeStyle = alpha(P[r % 3 === 0 ? 2 : r % 3 === 1 ? 1 : 0], 1 - depth * 0.85); g.lineWidth = 1.3; g.stroke();
    }
  }
  function Scope(g, w, h, A, P, t, o) {
    const look = LOOKS.Scope[(o.look || 0) % 3], wv = A.wave, n = wv.length, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
    // phosphor decay (persistent canvas)
    g.save(); g.globalCompositeOperation = 'destination-out'; g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, 0, w, h); g.restore();
    g.strokeStyle = P[1]; g.lineWidth = 1.6 * o.thick; glow(g, P[2], o, 16); g.beginPath();
    for (let i = 0; i < n; i++) {
      const a = (wv[i] - 128) / 128, b = (wv[(i + 17) % n] - 128) / 128;
      let x, y;
      if (look === 'XY') { x = cx + (a - b) * R * 1.2 * (0.6 + A.level); y = cy + (a + b) * R * 0.6 * (0.6 + A.level); }
      else if (look === 'Line') { x = (i / (n - 1)) * w; y = cy + a * h * 0.4 * (0.5 + A.level); }
      else { const ang = (i / n) * TAU, r = R * (0.55 + a * 0.45 * (0.6 + A.level)); x = cx + Math.cos(ang) * r; y = cy + Math.sin(ang) * r; }
      i ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    if (look === 'Polar') g.closePath();
    g.stroke(); noGlow(g);
  }
  function Particles(g, w, h, A, P, t, o) {
    const s = S(g), look = LOOKS.Particles[(o.look || 0) % 3], dt = o.dt || 0.016, cx = w / 2, cy = look === 'Fountain' ? h * 0.92 : h / 2;
    s.p = s.p || [];
    const spawn = (k, power) => {
      for (let i = 0; i < k && s.p.length < 900; i++) {
        let a = Math.random() * TAU, sp = (40 + Math.random() * 200) * power;
        if (look === 'Fountain') a = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
        s.p.push({ x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, c: P[(Math.random() * 3) | 0], r: 1 + Math.random() * 2.2 });
      }
    };
    spawn(Math.round(A.level * 12), 0.6 + A.level);
    if (A.beat) spawn(60, 1.6 + A.bass);
    g.globalCompositeOperation = 'lighter';
    for (let i = s.p.length - 1; i >= 0; i--) {
      const p = s.p[i];
      if (look === 'Galaxy') { const dx = p.x - cx, dy = p.y - cy; p.vx += -dy * 0.9 * dt - dx * 0.25 * dt; p.vy += dx * 0.9 * dt - dy * 0.25 * dt; }
      if (look === 'Fountain') p.vy += 260 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.992; p.vy *= 0.992; p.life -= dt * (look === 'Galaxy' ? 0.25 : 0.55);
      if (p.life <= 0 || p.x < -20 || p.x > w + 20 || p.y > h + 20) { s.p.splice(i, 1); continue; }
      g.globalAlpha = p.life; g.fillStyle = p.c; g.beginPath(); g.arc(p.x, p.y, p.r * (1 + A.treble) * o.thick, 0, TAU); g.fill();
    }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    const core = g.createRadialGradient(cx, cy, 0, cx, cy, 30 + A.bass * 50); core.addColorStop(0, alpha(P[1], 0.6)); core.addColorStop(1, alpha(P[1], 0));
    g.fillStyle = core; g.beginPath(); g.arc(cx, cy, 30 + A.bass * 50, 0, TAU); g.fill();
  }
  function Terrain(g, w, h, A, P, t, o) {
    const s = S(g), look = LOOKS.Terrain[(o.look || 0) % 3], cols = 40, rows = 26, hor = h * 0.42;
    s.rows = s.rows || []; s.acc = (s.acc || 0) + (o.dt || 0.016);
    if (s.acc > 0.06 || !s.rows.length) {
      s.acc = 0; const r = new Float32Array(cols);
      for (let i = 0; i < cols; i++) { const d = Math.abs(i - (cols - 1) / 2) / ((cols - 1) / 2); r[i] = band(A, Math.floor(d * 32), 32, 0.6) * (0.25 + d * 0.9); }
      s.rows.unshift(r); if (s.rows.length > rows) s.rows.pop();
    }
    if (look === 'Synth') {
      const sun = g.createLinearGradient(0, hor - h * 0.3, 0, hor); sun.addColorStop(0, P[2]); sun.addColorStop(1, P[0]);
      g.fillStyle = sun; g.beginPath(); g.arc(w / 2, hor, h * (0.2 + A.bass * 0.03), Math.PI, TAU); g.fill();
    }
    const proj = (ci, ri, v) => { const z = 1 + ri * 0.6, x = w / 2 + ((ci / (cols - 1) - 0.5) * w * 2.2) / z, y = hor + (h * 0.9) / z - (v * h * (look === 'Peaks' ? 0.7 : 0.45)) / z; return [x, y]; };
    g.lineWidth = 1.2 * o.thick; glow(g, P[1], o, 8);
    for (let r = s.rows.length - 1; r >= 0; r--) {
      const row = s.rows[r], fade = 1 - r / rows;
      g.beginPath();
      for (let c = 0; c < cols; c++) { const [x, y] = proj(c, r, row[c]); c ? g.lineTo(x, y) : g.moveTo(x, y); }
      if (look !== 'Wire') { const [xe] = proj(cols - 1, r, 0), [xs] = proj(0, r, 0); g.lineTo(xe, h); g.lineTo(xs, h); g.closePath(); g.fillStyle = `rgba(4,4,10,${0.9 * fade})`; g.fill(); }
      g.strokeStyle = alpha(P[r < rows / 3 ? 2 : r < (rows * 2) / 3 ? 1 : 0], fade); g.stroke();
    }
    if (look === 'Wire') for (let c = 0; c < cols; c += 2) { g.beginPath(); for (let r = 0; r < s.rows.length; r++) { const [x, y] = proj(c, r, s.rows[r][c]); r ? g.lineTo(x, y) : g.moveTo(x, y); } g.strokeStyle = alpha(P[0], 0.4); g.stroke(); }
    noGlow(g);
  }
  function Meters(g, w, h, A, P, t, o) {
    const s = S(g), look = LOOKS.Meters[(o.look || 0) % 4];
    const vals = [A.bass, (A.bass + A.mid) / 2, A.mid, (A.mid + A.treble) / 2, A.treble];
    s.pk = s.pk || [0, 0, 0, 0, 0]; vals.forEach((v, i) => (s.pk[i] = Math.max(v, s.pk[i] - (o.dt || 0.016) * 0.4)));
    if (look === 'Needles') {
      const L = Math.min(1, A.level * 1.3 + A.bass * 0.2), Rr = Math.min(1, A.level * 1.2 + A.treble * 0.25), mw = Math.min(w / 2 - 16, h * 1.1);
      [[w / 4, L, 'L'], [(w * 3) / 4, Rr, 'R']].forEach(([cx, v, lab], k) => {
        const cy = h * 0.82, r = mw * 0.48;
        g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
        g.strokeStyle = P[2]; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, r, Math.PI * 1.72, Math.PI * 1.85); g.stroke();
        for (let i = 0; i <= 10; i++) { const a = Math.PI * (1.15 + 0.07 * i); g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9); g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); g.stroke(); }
        const a = Math.PI * (1.15 + 0.7 * v); glow(g, P[k], o, 14); g.strokeStyle = P[k]; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02); g.stroke(); noGlow(g);
        g.fillStyle = 'rgba(255,255,255,.6)'; g.font = '600 12px Segoe UI'; g.textAlign = 'center'; g.fillText(lab, cx, cy - r * 0.3);
      });
    } else if (look === 'Ladders') {
      const n = 5, bw = w / n, seg = 18;
      for (let i = 0; i < n; i++) for (let k = 0; k < seg; k++) {
        const on = vals[i] * seg > k, pk = Math.floor(s.pk[i] * seg) === k, f = k / seg;
        g.fillStyle = on || pk ? (f < 0.6 ? P[0] : f < 0.85 ? P[1] : P[2]) : 'rgba(255,255,255,.06)';
        g.fillRect(i * bw + bw * 0.2, h * 0.92 - (k + 1) * ((h * 0.84) / seg), bw * 0.6, (h * 0.84) / seg - 3);
      }
    } else if (look === 'Rings') {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.44;
      g.lineCap = 'round'; glow(g, P[1], o, 10);
      vals.forEach((v, i) => { const r = R * (1 - i * 0.17); g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = R * 0.1; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.stroke(); g.strokeStyle = P[i % 3]; g.beginPath(); g.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0.01, v)); g.stroke(); });
      noGlow(g);
    } else {
      const cols = 16, rws = 10, cw = w / cols, ch = h / rws;
      for (let c = 0; c < cols; c++) { const v = band(A, c, cols); for (let r = 0; r < rws; r++) { const on = v * rws > r; g.fillStyle = on ? P[r < 5 ? 0 : r < 8 ? 1 : 2] : 'rgba(255,255,255,.05)'; g.beginPath(); g.arc(c * cw + cw / 2, h - (r + 0.5) * ch, Math.min(cw, ch) * 0.32, 0, TAU); g.fill(); } }
    }
  }

  // Halo: round cover in the middle, a dense crown of thin glowing radial bars (mirrored left/right) and a soft light behind.
  function Halo(g, w, h, A, P, t, o) {
    const s = S(g), look = LOOKS.Halo[(o.look || 0) % LOOKS.Halo.length], cx = w / 2, cy = h / 2;
    const base = Math.min(w, h) * 0.2, R = base * (1 + A.bass * 0.07), max = Math.min(w, h) * 0.27;
    const col = look === 'Theme' ? P[1] : '#f4f1ea';
    const n = Math.round(120 + (o.density ?? 0.5) * 100);
    s.hl = s.hl && s.hl.length === n ? s.hl : new Float32Array(n);
    // soft light behind the disc
    const halo = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.9);
    halo.addColorStop(0, alpha(col, 0.32 + A.level * 0.3)); halo.addColorStop(0.45, alpha(col, 0.1 + A.bass * 0.08)); halo.addColorStop(1, alpha(col, 0));
    g.fillStyle = halo; g.fillRect(0, 0, w, h);
    g.lineCap = 'round'; g.strokeStyle = col; glow(g, col, o, 16);
    g.lineWidth = Math.max(1.2, ((TAU * R) / n) * 0.42 * o.thick);
    for (let i = 0; i < n; i++) {
      // mirror around the vertical axis so lows sit at the bottom and highs at the top on both sides
      const k = i < n / 2 ? i : n - 1 - i, raw = band(A, n / 2 - 1 - k, n / 2, 0.75);
      const jitter = 0.75 + 0.25 * Math.sin(i * 12.9898 + t * 0.7);
      s.hl[i] = Math.max(raw * jitter, s.hl[i] * 0.86);
      const a = (i / n) * TAU - Math.PI / 2, l = 3 + s.hl[i] * max;
      g.beginPath(); g.moveTo(cx + Math.cos(a) * (R + 4), cy + Math.sin(a) * (R + 4)); g.lineTo(cx + Math.cos(a) * (R + 4 + l), cy + Math.sin(a) * (R + 4 + l)); g.stroke();
    }
    noGlow(g);
    // dotted inner ring
    g.fillStyle = alpha(col, 0.7);
    for (let i = 0; i < 90; i++) { const a = (i / 90) * TAU + t * 0.05; g.beginPath(); g.arc(cx + Math.cos(a) * (R + 1), cy + Math.sin(a) * (R + 1), 0.9, 0, TAU); g.fill(); }
    // the disc
    g.save(); g.beginPath(); g.arc(cx, cy, R - 2, 0, TAU); g.clip();
    if (A.cover && o.ringCover !== false) {
      g.translate(cx, cy); g.rotate(t * 0.04);
      if (look === 'Mono') g.filter = 'grayscale(1) contrast(1.1)';
      g.drawImage(A.cover, -R, -R, R * 2, R * 2); g.filter = 'none';
    } else {
      const gr = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
      gr.addColorStop(0, alpha(col, 0.9)); gr.addColorStop(1, alpha(col, 0.25)); g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);
    }
    g.restore();
  }

  const FN = { Bars, Mirror, Blocks, Ring, Waveform, Aurora, Orb, Vinyl, Waterfall, Scope, Particles, Terrain, Meters, Halo };
  // opts.scale = amplitude, opts.speed = animation speed, opts.thick = line/bar thickness, opts.refl = reflection
  function draw(style, g, w, h, A, P, t, o = {}) {
    const s = S(g), sc = o.scale ?? 1, sp = o.speed ?? 1, dt = (o.dt || 1 / 60) * sp;
    s.tt = (s.tt ?? t) + dt;
    let AA = A;
    if (sc !== 1) {
      s.buf = s.buf || new Float32Array(A.sm.length);
      for (let i = 0; i < A.sm.length; i++) s.buf[i] = Math.min(1.25, A.sm[i] * sc);
      AA = Object.assign(s.proxy || (s.proxy = {}), A, { sm: s.buf, bass: Math.min(1.2, A.bass * sc), mid: Math.min(1.2, A.mid * sc), treble: Math.min(1.2, A.treble * sc), level: Math.min(1, A.level * sc), scaleWave: sc });
    }
    if (!PERSIST[style]) g.clearRect(0, 0, w, h);
    (FN[style] || Bars)(g, w, h, AA, P, s.tt, { ...o, dt, thick: o.thick ?? 1 });
  }
  return { FREE, PRO, ALL: [...FREE, ...PRO], LOOKS, PERSIST, draw, alpha, band };
})();
