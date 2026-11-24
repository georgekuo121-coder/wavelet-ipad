// Lyric stage: word-by-word lyrics in 13 styles.
// Word timings come from enhanced LRC <mm:ss.xx> tags when the lyrics have them,
// otherwise each line's time is spread across its words by length.
const Stage = (() => {
  const STYLES = [
    ['Ship', '文字', '字一個個落在緩緩飄移的 3D 牆上'],
    ['Fisheye', '文字', '三個字的堆疊，像透過魚眼鏡頭鼓起'],
    ['Visual', '文字', '置中堆疊，有圖示的字旁邊加上圖示'],
    ['Fisheye Visual', '文字', '魚眼 + 圖示'],
    ['Codestyle', '圖案', '歌詞被打成程式碼，紅色游標閃爍'],
    ['Codestyle Visual', '圖案', '程式碼 + 圖示註解'],
    ['Branches', '圖案', '一條線自己長出來，每個字點亮一個節點'],
    ['Web', '圖案', '每句織成蜘蛛網，每個字一條絲'],
    ['Constellation', '圖案', '每句連成星座，一顆星一個字'],
    ['Messages', '手機', '整首歌變成訊息對話，一句一個泡泡'],
    ['Money', '手機', '整首歌變成一串付款紀錄'],
    ['Map', '手機', '一段步行路線，每句插一根圖釘'],
    ['Notifications', '手機', '每句像鎖定畫面通知一樣跳出來'],
    ['Poster', '文字', '整句排成大寫海報字，大小字混排，唱到的字變亮'],
  ];
  const NAMES = STYLES.map((s) => s[0]);
  const NATIVE = new Set(['Messages', 'Money', 'Map', 'Notifications']);
  const ICONS = {
    moon: '🌙', sun: '☀️', star: '⭐', stars: '✨', fire: '🔥', burn: '🔥', heart: '❤️', love: '💖', rain: '🌧️', night: '🌃', sky: '🌌',
    sea: '🌊', ocean: '🌊', wave: '🌊', water: '💧', tears: '💧', cry: '😢', eyes: '👀', kiss: '💋', home: '🏠', car: '🚗', drive: '🚗',
    money: '💸', cash: '💵', gold: '🥇', diamond: '💎', time: '⏳', clock: '⏰', world: '🌍', city: '🏙️', light: '💡', lights: '💡',
    dark: '🌑', cold: '🥶', snow: '❄️', ice: '🧊', weather: '🌦️', sweater: '🧥', music: '🎵', song: '🎶', dance: '💃', phone: '📱',
    call: '📞', party: '🎉', dream: '💭', dreams: '💭', flower: '🌸', rose: '🌹', king: '👑', queen: '👑', angel: '👼', devil: '😈',
    ghost: '👻', wind: '🌬️', storm: '⛈️', thunder: '⚡', run: '🏃', fly: '🕊️', bird: '🐦', train: '🚆', road: '🛣️', window: '🪟',
    glass: '🥂', wine: '🍷', smoke: '💨', key: '🔑', door: '🚪', baby: '👶', girl: '👧', boy: '👦', hand: '✋', hands: '🙌',
    月: '🌙', 日: '☀️', 星: '⭐', 火: '🔥', 心: '❤️', 愛: '💖', 雨: '🌧️', 夜: '🌃', 天: '🌌', 海: '🌊', 淚: '💧', 眼: '👀', 家: '🏠',
    車: '🚗', 錢: '💸', 時: '⏳', 光: '💡', 雪: '❄️', 冷: '🥶', 歌: '🎶', 舞: '💃', 夢: '💭', 花: '🌸', 風: '🌬️', 路: '🛣️', 酒: '🍷',
  };
  const iconFor = (w) => ICONS[w.toLowerCase().replace(/[^a-z㐀-鿿]/g, '')] || null;
  const DEMO = ['Midnight trains are humming low', 'Neon rain across the window glass', 'I count the stars you left behind', 'Hold the moon until the morning', 'Every heartbeat turns to fire', 'We dance until the city sleeps'];
  const CJK = '\\u3040-\\u30ff\\u3400-\\u9fff\\uac00-\\ud7af';
  const TOKEN = new RegExp(`<(\\d+):(\\d+(?:\\.\\d+)?)>|([${CJK}])|([^\\s${CJK}<]+)`, 'g');

  /* ---------------- timing ---------------- */
  function tokenize(text) {
    const out = []; let pend = null, m;
    TOKEN.lastIndex = 0;
    while ((m = TOKEN.exec(text))) {
      if (m[1]) { pend = +m[1] * 60 + +m[2]; continue; }
      out.push({ w: m[3] || m[4], t: pend, cjk: !!m[3] }); pend = null;
    }
    return out;
  }
  function build(lines) {
    const L = [];
    for (let i = 0; i < lines.length; i++) {
      const text = (lines[i].text || '').trim(); if (!text) continue;
      const start = lines[i].t, next = lines[i + 1] ? lines[i + 1].t : start + 6;
      const words = tokenize(text); if (!words.length) continue;
      const span = Math.max(0.6, Math.min(next - start, Math.max(1.2, words.length * 0.55)) * 0.92);
      const weight = words.map((w) => (w.cjk ? 1 : 0.5 + Math.min(10, w.w.length) * 0.22));
      const tot = weight.reduce((a, b) => a + b, 0);
      let acc = 0;
      words.forEach((w, k) => { if (w.t == null) w.t = start + (acc / tot) * span; acc += weight[k]; });
      words.forEach((w, k) => { w.end = k + 1 < words.length ? Math.max(w.t + 0.05, words[k + 1].t) : Math.max(w.t + 0.3, start + span); w.icon = iconFor(w.w); });
      L.push({ t: start, end: next, text, words, wordLevel: /<\d+:\d+/.test(text) });
    }
    return L;
  }
  const demoLines = (() => { const out = []; let t = 0; for (const s of DEMO) { out.push({ t, text: s }); t += 3.2; } return { lines: build(out), total: t }; })();
  let cache = { key: null, L: [] };
  function timeline(lyrics, pos, demo) {
    if (demo) {
      const p = (performance.now() / 1000) % demoLines.total;
      return { L: demoLines.lines, pos: p, demo: true };
    }
    if (!lyrics || !(lyrics.lines || []).length) return { L: [], pos, demo: false };
    if (cache.key !== lyrics.key || cache.n !== lyrics.lines.length) cache = { key: lyrics.key, n: lyrics.lines.length, L: build(lyrics.lines) };
    return { L: cache.L, pos, demo: false };
  }
  function locate(L, pos) {
    let li = -1; for (let i = 0; i < L.length; i++) { if (L[i].t <= pos) li = i; else break; }
    let wi = -1; if (li >= 0) L[li].words.forEach((w, k) => { if (w.t <= pos) wi = k; });
    return { li, wi };
  }

  /* ---------------- helpers ---------------- */
  const mem = new WeakMap();
  const S = (g) => { let s = mem.get(g); if (!s) mem.set(g, (s = {})); return s; };
  const font = (o, px, wt = 700) => `${wt} ${Math.round(px)}px "${o.font}", "Microsoft JhengHei", "Segoe UI Emoji", sans-serif`;
  const frac = (w, pos) => (pos < w.t ? 0 : pos >= w.end ? 1 : (pos - w.t) / Math.max(0.05, w.end - w.t));
  const colorOf = (o, w, pos) => { const f = frac(w, pos); return f >= 1 ? o.text : f > 0 ? o.hl : o.sec; };
  const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);
  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
  const rng = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const rgba = (c, a) => { if (c.startsWith('#')) { const n = parseInt(c.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; } return c.replace(/\)$/, ` / ${a})`); };
  // wrap words into centred rows
  function rows(g, words, maxW) {
    const sp = g.measureText(' ').width, out = []; let cur = { items: [], width: 0 };
    words.forEach((w, k) => {
      const ww = g.measureText(w.w).width, gap = cur.items.length ? (w.cjk && words[k - 1].cjk ? 0 : sp) : 0;
      if (cur.items.length && cur.width + gap + ww > maxW) { out.push(cur); cur = { items: [], width: 0 }; }
      const g2 = cur.items.length ? gap : 0;
      cur.items.push({ w, x: cur.width + g2, width: ww }); cur.width += g2 + ww;
    });
    if (cur.items.length) out.push(cur);
    return out;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

  /* ================= KINETIC ================= */
  function Ship(g, w, h, c, o) {
    const s = S(g), { L, li, pos } = c, px = Math.min(w, h) * 0.085 * o.size;
    s.a = (s.a || 0) + c.dt * 0.25;
    const ry = Math.sin(s.a) * 0.28, rx = Math.cos(s.a * 0.7) * 0.12;
    g.save(); g.translate(w / 2, h / 2);
    g.transform(Math.cos(ry), Math.sin(ry) * 0.18, Math.sin(rx) * 0.2, Math.cos(rx), 0, 0);
    for (let k = 2; k >= 0; k--) {
      const line = L[li - k]; if (!line) continue;
      const fs = px * (k ? 0.62 : 1); g.font = font(o, fs, 800); g.textBaseline = 'middle';
      const R = rows(g, line.words, w * 0.8), lh = fs * 1.15, y0 = -k * px * 1.6 - (R.length - 1) * lh / 2 - (k ? px * 0.6 : 0);
      R.forEach((r, ri) => r.items.forEach((it) => {
        const f = frac(it.w, pos), land = ease((pos - it.w.t) / 0.28);
        if (!k && f <= 0) return;
        const sc = k ? 1 : 1 + (1 - land) * 1.2;
        g.save(); g.globalAlpha = k ? 0.28 / k : land;
        g.translate(-r.width / 2 + it.x + it.width / 2, y0 + ri * lh); g.scale(sc, sc);
        g.fillStyle = k ? o.sec : colorOf(o, it.w, pos);
        g.textAlign = 'center'; g.fillText(it.w.w, 0, 0); g.restore();
      }));
    }
    g.restore();
  }
  // Poster: the current line set as a big uppercase type block, left-aligned, words in mixed sizes.
  // Sung words are solid, upcoming ones faint; the old line slides up and fades as the new one arrives.
  const SMALL = new Set(['I', 'A', 'AN', 'THE', 'OF', 'TO', 'IN', 'ON', 'IS', 'AM', 'AT', 'MY', 'ME', 'BE', 'OR', 'AND', 'BUT', 'SO', 'IT', 'YOU', 'WE', 'OH']);
  function posterLayout(g, line, w, h, o) {
    const maxW = w * 0.94, base = Math.min(h * 0.24, w * 0.12) * o.size;
    const up = line.words.map((x) => ({ w: x, txt: x.cjk ? x.w : x.w.toUpperCase() }));
    const longest = up.reduce((m, x) => Math.max(m, x.txt.length), 0);
    up.forEach((x, k) => {
      const bare = x.txt.replace(/[^A-Z']/g, '');
      x.k = x.w.cjk ? 0.8 : bare.length === 1 ? 0.46 : SMALL.has(bare) ? (hash(bare + k) % 2 ? 0.62 : 1) : x.txt.length === longest || hash(x.txt + k) % 3 === 0 ? 1 : 0.74;
    });
    for (let fit = 1; fit > 0.3; fit *= 0.88) {
      const R = []; let row = { items: [], width: 0, hgt: 0 };
      for (const x of up) {
        const fs = base * fit * x.k; g.font = font(o, fs, 900);
        const ww = g.measureText(x.txt).width, gap = row.items.length ? fs * 0.22 : 0;
        if (row.items.length && row.width + gap + ww > maxW) { R.push(row); row = { items: [], width: 0, hgt: 0 }; }
        const g2 = row.items.length ? gap : 0;
        row.items.push({ ...x, fs, x: row.width + g2, ww }); row.width += g2 + ww; row.hgt = Math.max(row.hgt, fs);
      }
      if (row.items.length) R.push(row);
      const tot = R.reduce((s, r) => s + r.hgt * 0.9, 0);
      if (tot <= h * 0.86 || fit < 0.35) return { R, tot };
    }
  }
  function Poster(g, w, h, c, o) {
    const s = S(g), { L, li, pos } = c;
    if (!s.cache || s.cache.L !== L || s.cache.w !== w || s.cache.h !== h || s.cache.size !== o.size || s.cache.font !== o.font) s.cache = { L, w, h, size: o.size, font: o.font, m: new Map() };
    const lay = (i) => { if (!s.cache.m.has(i)) s.cache.m.set(i, posterLayout(g, L[i], w, h, o)); return s.cache.m.get(i); };
    g.textBaseline = 'alphabetic'; g.textAlign = 'left';
    const x0 = w * 0.03;
    const paint = (i, alpha, dy, live) => {
      const { R, tot } = lay(i); let y = (h - tot) / 2 + dy;
      for (const r of R) {
        const by = y + r.hgt * 0.8;
        for (const it of r.items) {
          const f = live ? frac(it.w, pos) : 1, pop = live ? ease((pos - it.w.t) / 0.18) : 1;
          g.save(); g.globalAlpha = alpha * (f > 0 ? 1 : 0.22);
          g.font = font(o, it.fs, 900); g.fillStyle = f > 0 ? o.text : o.sec;
          if (f > 0 && pop < 1) { const sx = x0 + it.x + it.ww / 2; g.translate(sx, by); g.scale(1 + (1 - pop) * 0.18, 1 + (1 - pop) * 0.18); g.translate(-sx, -by); }
          if (f > 0) { g.shadowColor = rgba(o.text, 0.35); g.shadowBlur = it.fs * 0.15; }
          g.fillText(it.txt, x0 + it.x, by); g.restore();
        }
        y += r.hgt * 0.9;
      }
    };
    // Hand-over in sequence so two text blocks never sit on top of each other: the old line lifts away
    // and is gone by halfway, the new one only starts to show once the old is mostly out.
    const u = (pos - L[li].t) / 0.45, out = ease(Math.min(1, u / 0.5)), inn = ease(Math.max(0, Math.min(1, (u - 0.35) / 0.65)));
    if (u < 0.5 && L[li - 1]) paint(li - 1, 1 - out, -out * h * 0.18, false);
    paint(li, inn, (1 - inn) * h * 0.06, true);
  }
  function flat(L) { const out = []; L.forEach((l, li) => l.words.forEach((w, wi) => out.push({ ...w, li, wi }))); return out; }
  function Fisheye(g, w, h, c, o, icons) {
    const s = S(g); if (s.L !== c.L) { s.L = c.L; s.F = flat(c.L); }
    const F = s.F, pos = c.pos;
    let idx = -1; for (let i = 0; i < F.length; i++) { if (F[i].t <= pos) idx = i; else break; }
    if (idx < 0) return;
    const cur = F[idx], f = ease(frac(cur, pos) * 2.5);
    s.smooth = s.smooth == null ? idx : s.smooth + (idx - 1 + f - s.smooth) * Math.min(1, c.dt * 12);
    const px = Math.min(w, h) * 0.11 * o.size, cy = h / 2;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (let k = -3; k <= 3; k++) {
      const i = Math.round(s.smooth) + k; const W = F[i]; if (!W) continue;
      const d = i - s.smooth - 1; // 0 = word being sung
      const bulge = Math.exp(-d * d * 0.8), sc = 0.42 + bulge * 1.0;
      const y = cy + Math.sign(d) * Math.pow(Math.abs(d), 0.8) * px * 1.05;
      g.save(); g.globalAlpha = Math.max(0, Math.exp(-d * d * 0.35) * (W.li === cur.li || Math.abs(d) < 1.2 ? 1 : 0.6));
      g.translate(w / 2, y); g.scale(sc * (1 + bulge * 0.12), sc); // horizontal bulge = lens
      g.font = font(o, px, 900); g.fillStyle = i <= idx ? (i === idx ? o.hl : o.text) : o.sec;
      const txt = icons && W.icon ? `${W.icon} ${W.w}` : W.w;
      g.fillText(txt, 0, 0); g.restore();
    }
  }
  function Visual(g, w, h, c, o) {
    const { L, li, pos } = c; const line = L[li]; if (!line) return;
    const sung = line.words.filter((x) => x.t <= pos);
    const n = Math.max(1, sung.length), px = Math.min(h / (n + 1.5), Math.min(w, h) * 0.09) * o.size, lh = px * 1.12;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    sung.forEach((W, k) => {
      const a = ease((pos - W.t) / 0.25), y = h / 2 - ((n - 1) * lh) / 2 + k * lh + (1 - a) * px * 0.4;
      g.globalAlpha = a; g.font = font(o, px, 800); g.fillStyle = colorOf(o, W, pos);
      const tw = g.measureText(W.w).width;
      g.fillText(W.w, w / 2, y);
      if (W.icon) { g.font = font(o, px * 0.8, 400); g.fillText(W.icon, w / 2 - tw / 2 - px * 0.7, y); }
    });
    g.globalAlpha = 1;
  }

  /* ================= MOTION ================= */
  function Codestyle(g, w, h, c, o, icons) {
    const { L, li, pos } = c, show = 7, first = Math.max(0, li - show + 1);
    // fit the longest visible line to the width, like an editor zoomed out
    let px = Math.max(10, Math.min(w, h) * 0.036 * o.size);
    g.font = `500 ${px}px Consolas, "Cascadia Code", monospace`;
    let longest = 0;
    for (let i = first; i <= li; i++) if (L[i]) longest = Math.max(longest, g.measureText(`999 lyric[${i}] = "${L[i].words.map((x) => x.w).join(' ')}";  // ✨✨`).width);
    if (longest > w * 0.88) px = Math.max(8, px * (w * 0.88) / longest);
    const lh = px * 1.6;
    g.font = `500 ${px}px Consolas, "Cascadia Code", monospace`; g.textBaseline = 'middle'; g.textAlign = 'left';
    const x0 = w * 0.05, gut = px * 3.2;
    let y = h / 2 - ((Math.min(show, li + 1) - 1) * lh) / 2;
    for (let i = first; i <= li; i++) {
      const line = L[i]; if (!line) continue;
      const isCur = i === li;
      let typed = line.text.length;
      if (isCur) { typed = 0; for (const W of line.words) { const f = frac(W, pos); if (f <= 0) break; typed += Math.round(W.w.length * f) + 1; } typed = Math.min(line.text.replace(/<[^>]+>/g, '').length, typed); }
      const clean = line.words.map((x) => x.w).join(line.words.some((x) => x.cjk) ? '' : ' ');
      const str = clean.slice(0, typed);
      g.globalAlpha = isCur ? 1 : 0.45 + 0.1 * (i - first) / show;
      g.fillStyle = o.sec; g.fillText(String(i + 1).padStart(3, ' '), x0, y);
      let x = x0 + gut;
      const seg = (t, col) => { g.fillStyle = col; g.fillText(t, x, y); x += g.measureText(t).width; };
      seg('lyric', '#c792ea'); seg('[', o.sec); seg(String(i), '#f78c6c'); seg('] = ', o.sec); seg('"', '#c3e88d'); seg(str, isCur ? o.hl : '#c3e88d');
      if (!isCur || typed >= clean.length) seg('";', '#c3e88d');
      if (icons) { const ic = line.words.filter((W) => W.icon && W.t <= pos).map((W) => W.icon).join(' '); if (ic) seg('  // ' + ic, '#546e7a'); }
      if (isCur && Math.floor(performance.now() / 450) % 2 === 0) { g.fillStyle = '#ff3b4e'; g.fillRect(x + 2, y - px * 0.6, px * 0.55, px * 1.2); }
      y += lh;
    }
    g.globalAlpha = 1;
  }
  function Branches(g, w, h, c, o) {
    const s = S(g), { L, li, pos } = c;
    if (s.L !== L) {
      s.L = L; s.nodes = []; const r = rng(hash(L.map((x) => x.text).join('|')) || 7); let x = 0, y = 0, dir = 0;
      L.forEach((line, i) => { dir += (r() - 0.5) * 1.6; line.words.forEach((W, k) => { const step = 70 + r() * 40; dir += (r() - 0.5) * 0.5; x += Math.cos(dir) * step; y += Math.sin(dir) * step * 0.7; s.nodes.push({ x, y, W, li: i, k }); }); });
      s.cam = null;
    }
    const sc = o.size * Math.min(w, h) / 600;
    const nodes = s.nodes; let last = null;
    for (const n of nodes) if (n.W.t <= pos) last = n;
    if (!last) return;
    const tgt = { x: last.x, y: last.y };
    s.cam = s.cam ? { x: s.cam.x + (tgt.x - s.cam.x) * Math.min(1, c.dt * 2.5), y: s.cam.y + (tgt.y - s.cam.y) * Math.min(1, c.dt * 2.5) } : tgt;
    g.save(); g.translate(w / 2 - s.cam.x * sc, h / 2 - s.cam.y * sc); g.scale(sc, sc);
    g.lineCap = 'round';
    for (let i = 1; i < nodes.length; i++) {
      const a = nodes[i - 1], b = nodes[i]; if (b.li < li - 2 || a.li > li) continue;
      if (b.W.t > pos) continue;
      g.strokeStyle = rgba(o.hl, b.li === li ? 0.9 : 0.3); g.lineWidth = 2.5;
      const p = b.W.t <= pos ? ease((pos - b.W.t) / 0.25) : 0;
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(a.x + (b.x - a.x) * p, a.y + (b.y - a.y) * p); g.stroke();
    }
    g.textAlign = 'center'; g.textBaseline = 'bottom';
    for (const n of nodes) {
      if (n.li < li - 2 || n.li > li || n.W.t > pos) continue;
      const on = n.li === li, a = ease((pos - n.W.t) / 0.3);
      g.globalAlpha = on ? 1 : 0.35;
      g.fillStyle = on ? o.hl : o.sec; g.shadowColor = o.hl; g.shadowBlur = on ? 18 * a : 0;
      g.beginPath(); g.arc(n.x, n.y, 6 + a * 2, 0, 7); g.fill(); g.shadowBlur = 0;
      g.font = font(o, 26, 700); g.fillStyle = on ? colorOf(o, n.W, pos) : o.sec; g.fillText(n.W.w, n.x, n.y - 14);
    }
    g.restore(); g.globalAlpha = 1;
  }
  function Web(g, w, h, c, o) {
    const { L, li, pos } = c, cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.46 * o.size, spokes = 12;
    g.strokeStyle = rgba(o.sec, 0.35); g.lineWidth = 1;
    for (let k = 0; k < spokes; k++) { const a = (k / spokes) * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); }
    for (let d = 3; d >= 0; d--) {
      const line = L[li - d]; if (!line) continue;
      const r = R * (0.92 - d * 0.2), n = line.words.length;
      line.words.forEach((W, k) => {
        if (W.t > pos) return;
        const a0 = (k / n) * Math.PI * 2 - Math.PI / 2, a1 = ((k + 1) / n) * Math.PI * 2 - Math.PI / 2;
        const p = d ? 1 : ease((pos - W.t) / 0.3);
        g.strokeStyle = d ? rgba(o.sec, 0.5) : o.hl; g.lineWidth = d ? 1.2 : 2.2;
        const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
        g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(cx + Math.cos((a0 + a1) / 2) * r * 0.9, cy + Math.sin((a0 + a1) / 2) * r * 0.9, x0 + (x1 - x0) * p, y0 + (y1 - y0) * p); g.stroke();
        if (!d) {
          const am = (a0 + a1) / 2, lx = cx + Math.cos(am) * (r + 26 * o.size), ly = cy + Math.sin(am) * (r + 26 * o.size);
          g.font = font(o, Math.min(w, h) * 0.035 * o.size, 700); g.textAlign = 'center'; g.textBaseline = 'middle';
          g.globalAlpha = p; g.fillStyle = colorOf(o, W, pos); g.fillText(W.w, lx, ly); g.globalAlpha = 1;
        }
      });
    }
  }
  function Constellation(g, w, h, c, o) {
    const s = S(g), { L, li, pos } = c;
    if (!s.bg || s.bw !== w) { s.bw = w; const r = rng(42); s.bg = Array.from({ length: 140 }, () => ({ x: r() * w, y: r() * h, z: r() })); }
    for (const st of s.bg) { g.fillStyle = rgba('#ffffff', 0.15 + st.z * 0.4 * (0.6 + 0.4 * Math.sin(performance.now() / 700 + st.x))); g.fillRect(st.x, st.y, 1.2 + st.z, 1.2 + st.z); }
    for (let d = 1; d >= 0; d--) {
      const line = L[li - d]; if (!line) continue;
      const r = rng(hash(line.text) + li - d), n = line.words.length;
      const pts = line.words.map((W, k) => ({ W, x: w * (0.12 + (k / Math.max(1, n - 1)) * 0.76) + (r() - 0.5) * w * 0.06, y: h * (0.3 + r() * 0.4) }));
      const fade = d ? Math.max(0, 1 - (pos - L[li].t) / 1.2) : 1; if (fade <= 0) continue;
      g.globalAlpha = fade;
      for (let k = 1; k < pts.length; k++) {
        if (pts[k].W.t > pos) break; const p = ease((pos - pts[k].W.t) / 0.3);
        g.strokeStyle = rgba(o.hl, 0.6); g.lineWidth = 1.4; g.beginPath(); g.moveTo(pts[k - 1].x, pts[k - 1].y); g.lineTo(pts[k - 1].x + (pts[k].x - pts[k - 1].x) * p, pts[k - 1].y + (pts[k].y - pts[k - 1].y) * p); g.stroke();
      }
      g.textAlign = 'center'; g.textBaseline = 'top';
      for (const p of pts) {
        if (p.W.t > pos) continue; const a = ease((pos - p.W.t) / 0.3);
        g.fillStyle = '#fff'; g.shadowColor = o.hl; g.shadowBlur = 16 * a; g.beginPath(); g.arc(p.x, p.y, 2.5 + a * 2.5, 0, 7); g.fill(); g.shadowBlur = 0;
        g.font = font(o, Math.min(w, h) * 0.038 * o.size, 600); g.fillStyle = colorOf(o, p.W, pos); g.fillText(p.W.w, p.x, p.y + 10);
      }
    }
    g.globalAlpha = 1;
  }

  /* ================= NATIVE DESIGN (keep their own colours) ================= */
  function words(g, line, pos, x, y, maxW, px, cOn, cOff, align = 'left') {
    g.font = `600 ${px}px "Segoe UI", "Microsoft JhengHei", sans-serif`; g.textBaseline = 'top';
    const R = rows(g, line.words, maxW), lh = px * 1.3;
    R.forEach((r, ri) => r.items.forEach((it) => { g.fillStyle = it.w.t <= pos ? cOn : cOff; g.textAlign = 'left'; g.fillText(it.w.w, (align === 'right' ? x - r.width : x) + it.x, y + ri * lh); }));
    return { h: R.length * lh, w: Math.max(...R.map((r) => r.width), 0) };
  }
  function Messages(g, w, h, c, o) {
    const { L, li, pos } = c, px = Math.max(13, Math.min(w, h) * 0.042 * o.size), pad = px * 0.75, maxW = w * 0.62;
    let y = h - px * 1.5;
    const next = L[li + 1];
    if (next && next.t - pos < 1.6 && next.t - pos > 0 && li >= 0) { // typing indicator
      const side = (li + 1) % 2; const bw = px * 3.2, bh = px * 1.9; const bx = side ? w - bw - px : px;
      g.fillStyle = side ? '#0a84ff' : '#3a3a3c'; roundRect(g, bx, y - bh, bw, bh, bh / 2); g.fill();
      for (let k = 0; k < 3; k++) { g.fillStyle = `rgba(255,255,255,${0.4 + 0.6 * Math.max(0, Math.sin(performance.now() / 180 - k))})`; g.beginPath(); g.arc(bx + bw * (0.3 + k * 0.2), y - bh / 2, px * 0.18, 0, 7); g.fill(); }
      y -= bh + px * 0.6;
    }
    for (let i = li; i >= 0 && y > 0; i--) {
      const line = L[i], side = i % 2, me = side === 1;
      g.font = `600 ${px}px "Segoe UI", "Microsoft JhengHei", sans-serif`;
      const R = rows(g, line.words, maxW - pad * 2), bw = Math.max(...R.map((r) => r.width)) + pad * 2, bh = R.length * px * 1.3 + pad * 1.4;
      const appear = i === li ? ease((pos - line.t) / 0.3) : 1;
      const bx = me ? w - bw - px : px, by = y - bh + (1 - appear) * px;
      g.globalAlpha = appear;
      g.fillStyle = me ? '#0a84ff' : '#3a3a3c'; roundRect(g, bx, by, bw, bh, px * 0.9); g.fill();
      words(g, line, pos, bx + pad, by + pad * 0.7, maxW - pad * 2, px, '#ffffff', 'rgba(255,255,255,.38)');
      y = by - px * 0.45;
    }
    g.globalAlpha = 1;
  }
  function Money(g, w, h, c, o) {
    const { L, li, pos } = c, px = Math.max(12, Math.min(w, h) * 0.036 * o.size);
    g.fillStyle = '#ffffff'; g.font = `700 ${px * 1.4}px "Segoe UI", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('Activity', px, px * 0.6);
    let y = px * 3;
    for (let i = li; i >= 0 && y < h; i--) {
      const line = L[i], r = rng(hash(line.text)), amt = (5 + r() * 240).toFixed(2), incoming = r() > 0.6;
      const appear = i === li ? ease((pos - line.t) / 0.35) : 1;
      g.font = `600 ${px}px "Segoe UI", "Microsoft JhengHei", sans-serif`;
      const textH = rows(g, line.words, w - px * 11).length * px * 1.3;
      const rowH = Math.max(px * 3.6, textH + px * 2.5);
      g.globalAlpha = appear;
      g.fillStyle = i === li ? 'rgba(255,255,255,.08)' : 'rgba(255,255,255,.03)'; roundRect(g, px * 0.5, y, w - px, rowH - px * 0.4, px * 0.7); g.fill();
      const ini = (line.words[0] ? line.words[0].w[0] : '♪').toUpperCase();
      g.fillStyle = `hsl(${hash(line.text) % 360} 70% 55%)`; g.beginPath(); g.arc(px * 2.2, y + rowH / 2 - px * 0.2, px * 1.1, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.font = `700 ${px}px "Segoe UI", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ini, px * 2.2, y + rowH / 2 - px * 0.2);
      words(g, { words: line.words }, pos, px * 4, y + px * 0.55, w - px * 11, px, '#ffffff', 'rgba(255,255,255,.35)');
      g.font = `500 ${px * 0.8}px "Segoe UI", sans-serif`; g.fillStyle = 'rgba(255,255,255,.5)'; g.textAlign = 'left'; g.textBaseline = 'bottom';
      g.fillText(i === li ? 'Pending · now' : 'Completed', px * 4, y + rowH - px * 0.7);
      g.font = `700 ${px * 1.05}px "Segoe UI", sans-serif`; g.textAlign = 'right'; g.textBaseline = 'middle';
      g.fillStyle = incoming ? '#30d158' : '#ffffff'; g.fillText(`${incoming ? '+' : '−'}$${amt}`, w - px * 1.2, y + rowH / 2 - px * 0.2);
      y += rowH;
    }
    g.globalAlpha = 1;
  }
  function MapWalk(g, w, h, c, o) {
    const s = S(g), { L, li, pos } = c;
    if (s.L !== L) {
      s.L = L; const r = rng(hash(L.map((x) => x.text).join('|')) || 3); let x = 0, y = 0; s.path = [{ x, y }];
      L.forEach(() => { const steps = 2 + Math.floor(r() * 2); for (let k = 0; k < steps; k++) { if (r() > 0.5) x += (r() > 0.3 ? 1 : -1) * 120; else y += (r() > 0.4 ? -1 : 1) * 120; s.path.push({ x, y }); } s.path[s.path.length - 1].pin = true; });
      s.pins = s.path.filter((p) => p.pin); s.cam = null;
    }
    const line = L[li], pin = s.pins[li] || s.pins[0];
    const pinIdx = s.path.indexOf(pin), prevIdx = li > 0 ? s.path.indexOf(s.pins[li - 1]) : 0;
    const prog = line ? Math.min(1, (pos - line.t) / Math.max(0.5, (line.words.at(-1).end - line.t))) : 0;
    const segs = Math.max(1, pinIdx - prevIdx), fi = prevIdx + prog * segs, a = s.path[Math.floor(fi)], b = s.path[Math.min(s.path.length - 1, Math.floor(fi) + 1)], ff = fi - Math.floor(fi);
    const me = { x: a.x + (b.x - a.x) * ff, y: a.y + (b.y - a.y) * ff };
    s.cam = s.cam ? { x: s.cam.x + (me.x - s.cam.x) * Math.min(1, c.dt * 3), y: s.cam.y + (me.y - s.cam.y) * Math.min(1, c.dt * 3) } : me;
    const sc = Math.min(w, h) / 520 * o.size;
    g.fillStyle = '#1c1f26'; roundRect(g, 0, 0, w, h, 18); g.fill();
    g.save(); roundRect(g, 0, 0, w, h, 18); g.clip();
    g.translate(w / 2 - s.cam.x * sc, h / 2 - s.cam.y * sc); g.scale(sc, sc);
    // streets
    const gx0 = Math.floor((s.cam.x - w / sc) / 120) * 120, gy0 = Math.floor((s.cam.y - h / sc) / 120) * 120;
    g.fillStyle = '#2a2f3a'; for (let x = gx0; x < s.cam.x + w / sc; x += 120) for (let y = gy0; y < s.cam.y + h / sc; y += 120) roundRect(g, x + 10, y + 10, 100, 100, 8), g.fill();
    g.strokeStyle = '#3d4452'; g.lineWidth = 2; for (let x = gx0; x < s.cam.x + w / sc; x += 120) { g.beginPath(); g.moveTo(x, gy0); g.lineTo(x, s.cam.y + h / sc); g.stroke(); }
    // walked route
    g.strokeStyle = '#0a84ff'; g.lineWidth = 7; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(s.path[0].x, s.path[0].y);
    for (let i = 1; i <= Math.floor(fi); i++) g.lineTo(s.path[i].x, s.path[i].y); g.lineTo(me.x, me.y); g.stroke();
    s.pins.forEach((p, i) => { if (i > li) return; g.fillStyle = '#ff375f'; g.beginPath(); g.arc(p.x, p.y - 18, 10, 0, 7); g.fill(); g.beginPath(); g.moveTo(p.x - 7, p.y - 13); g.lineTo(p.x, p.y); g.lineTo(p.x + 7, p.y - 13); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(p.x, p.y - 18, 4, 0, 7); g.fill(); });
    g.fillStyle = '#fff'; g.beginPath(); g.arc(me.x, me.y, 11, 0, 7); g.fill(); g.fillStyle = '#0a84ff'; g.beginPath(); g.arc(me.x, me.y, 7.5, 0, 7); g.fill();
    g.restore();
    if (line) { // label card
      const px = Math.max(13, Math.min(w, h) * 0.04 * o.size);
      g.font = `600 ${px}px "Segoe UI", "Microsoft JhengHei", sans-serif`;
      const R = rows(g, line.words, w * 0.8), bw = Math.max(...R.map((r) => r.width)) + px * 1.6, bh = R.length * px * 1.3 + px * 1.2;
      g.fillStyle = 'rgba(28,28,30,.92)'; roundRect(g, (w - bw) / 2, h - bh - px, bw, bh, px * 0.8); g.fill();
      words(g, line, pos, (w - bw) / 2 + px * 0.8, h - bh - px + px * 0.6, w * 0.8, px, '#ffffff', 'rgba(255,255,255,.35)');
    }
  }
  function Notifications(g, w, h, c, o) {
    const { L, li, pos } = c, px = Math.max(12, Math.min(w, h) * 0.036 * o.size), now = new Date();
    g.textAlign = 'center'; g.textBaseline = 'top'; g.fillStyle = 'rgba(255,255,255,.92)';
    g.font = `600 ${px * 1.1}px "Segoe UI", "Microsoft JhengHei", sans-serif`; g.fillText(now.toLocaleDateString('zh-TW', { weekday: 'long', month: 'long', day: 'numeric' }), w / 2, px * 0.6);
    g.font = `700 ${px * 4.2}px "Segoe UI Variable Display", "Segoe UI", sans-serif`; g.fillText(now.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', hour12: false }), w / 2, px * 2);
    let y = px * 7.2; const cw = Math.min(w - px * 2, px * 26), cx = (w - cw) / 2;
    for (let i = li, n = 0; i >= 0 && n < 4; i--, n++) {
      const line = L[i]; const appear = i === li ? ease((pos - line.t) / 0.35) : 1;
      if (n === 3) { g.globalAlpha = 0.5; g.fillStyle = 'rgba(60,60,67,.6)'; roundRect(g, cx + px, y, cw - px * 2, px * 1.2, px * 0.6); g.fill(); break; }
      g.font = `600 ${px}px "Segoe UI", "Microsoft JhengHei", sans-serif`;
      const R = rows(g, line.words, cw - px * 5), ch = R.length * px * 1.3 + px * 2.6;
      g.globalAlpha = appear; const yy = y - (1 - appear) * px * 2;
      g.fillStyle = 'rgba(40,40,46,.78)'; roundRect(g, cx, yy, cw, ch, px * 1.1); g.fill();
      g.fillStyle = o.hl; roundRect(g, cx + px * 0.8, yy + px * 0.8, px * 2.2, px * 2.2, px * 0.55); g.fill();
      g.fillStyle = '#fff'; g.font = `${px * 1.2}px "Segoe UI Emoji"`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪', cx + px * 1.9, yy + px * 1.9);
      g.font = `700 ${px * 0.85}px "Segoe UI", sans-serif`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = 'rgba(255,255,255,.6)'; g.fillText('WAVELET', cx + px * 3.6, yy + px * 0.8);
      g.textAlign = 'right'; g.fillText(i === li ? '現在' : `${Math.max(1, Math.round((pos - line.t) / 60))} 分鐘前`, cx + cw - px * 0.9, yy + px * 0.8);
      words(g, line, pos, cx + px * 3.6, yy + px * 2.0, cw - px * 5, px, '#ffffff', 'rgba(255,255,255,.35)');
      y = yy + ch + px * 0.5;
    }
    g.globalAlpha = 1;
  }

  const FN = {
    Ship, Fisheye: (g, w, h, c, o) => Fisheye(g, w, h, c, o, false), Visual, 'Fisheye Visual': (g, w, h, c, o) => Fisheye(g, w, h, c, o, true),
    Codestyle: (g, w, h, c, o) => Codestyle(g, w, h, c, o, false), 'Codestyle Visual': (g, w, h, c, o) => Codestyle(g, w, h, c, o, true),
    Branches, Web, Constellation, Messages, Money, Map: MapWalk, Notifications, Poster,
  };
  // o: { font, size, text, hl, sec }  src: { lyrics, pos, demo, dt }
  function draw(style, g, w, h, src, o) {
    g.clearRect(0, 0, w, h);
    const tl = timeline(src.lyrics, src.pos, src.demo);
    const loc = locate(tl.L, tl.pos);
    if (loc.li < 0) { // before the first line: show the title quietly
      if (src.title) { g.fillStyle = rgba(o.sec, 0.9); g.font = font(o, Math.min(w, h) * 0.05 * o.size, 600); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♪  ' + src.title, w / 2, h / 2); }
      return tl;
    }
    (FN[style] || Fisheye)(g, w, h, { L: tl.L, li: loc.li, wi: loc.wi, pos: tl.pos, dt: src.dt || 1 / 60 }, o);
    return tl;
  }
  return { STYLES, NAMES, NATIVE, draw, build };
})();
