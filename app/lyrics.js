// Time-synced lyric renderer. Free: Line, Fade. Pro: Stack, Rise, Pop, Karaoke, Scatter.
const Lyrics = (() => {
  const STYLES = ['Line', 'Fade', 'Stack', 'Rise', 'Pop', 'Karaoke', 'Scatter'];
  const css = document.createElement('style');
  css.textContent = `
  .lyr{position:absolute;left:0;right:0;text-align:center;pointer-events:none;font-family:'Segoe UI','Microsoft JhengHei',sans-serif;color:#fff;text-shadow:0 1px 12px rgba(0,0,0,.6);overflow:hidden}
  .lyr .ln{transition:all .45s cubic-bezier(.2,.8,.2,1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:0 10px}
  .lyr .dim{opacity:.35;font-size:.8em}
  .lyr.Rise .ln.in{animation:lyrRise .6s cubic-bezier(.2,.8,.2,1)}
  @keyframes lyrRise{from{transform:translateY(80%);opacity:0;filter:blur(6px)}to{transform:none;opacity:1;filter:none}}
  .lyr.Pop .ln.in{animation:lyrPop .5s cubic-bezier(.3,1.6,.5,1)}
  @keyframes lyrPop{from{transform:scale(.6);opacity:0}to{transform:scale(1);opacity:1}}
  .lyr.Line .ln.in,.lyr.Fade .ln.in{animation:lyrFade .5s ease}
  @keyframes lyrFade{from{opacity:0}to{opacity:1}}
  .lyr.Karaoke .ln{background:linear-gradient(90deg,var(--k1) var(--p),rgba(255,255,255,.35) var(--p));-webkit-background-clip:text;color:transparent}
  .lyr.Scatter .w{display:inline-block;animation:lyrScatter .7s cubic-bezier(.2,.8,.2,1) both}
  @keyframes lyrScatter{from{transform:translate(var(--dx),var(--dy)) rotate(var(--r));opacity:0}to{transform:none;opacity:1}}`;
  document.head.appendChild(css);

  function mount(el) {
    let lastIdx = -2, lastKey = '', lastStyle = '';
    el.classList.add('lyr');
    function render(style, idx) {
      const L = Wv.st.lyrics.lines || [];
      const strip = (t) => String(t || '').replace(/<\d+:\d+(?:\.\d+)?>/g, '').replace(/\s+/g, ' ').trim();
      const line = (i) => Wv.esc(L[i] ? strip(L[i].text) || '♪' : '');
      el.className = 'lyr ' + style;
      if (idx < 0) { el.innerHTML = ''; return; }
      if (style === 'Fade') el.innerHTML = `<div class="ln dim">${line(idx - 1)}</div><div class="ln in">${line(idx)}</div><div class="ln dim">${line(idx + 1)}</div>`;
      else if (style === 'Stack') el.innerHTML = [-2, -1, 0, 1].map((d) => `<div class="ln" style="opacity:${d === 0 ? 1 : d < 0 ? 0.25 + 0.15 * (2 + d) : 0.3};font-size:${d === 0 ? 1.05 : 0.78}em">${line(idx + d)}</div>`).join('');
      else if (style === 'Scatter') el.innerHTML = `<div class="ln">${(strip(L[idx].text) || '♪').split(/(\s+)/).map((w, i) => /\s/.test(w) ? w : `<span class="w" style="--dx:${(Math.random() - 0.5) * 120}px;--dy:${(Math.random() - 0.5) * 60}px;--r:${(Math.random() - 0.5) * 40}deg;animation-delay:${i * 0.03}s">${Wv.esc(w)}</span>`).join('')}</div>`;
      else el.innerHTML = `<div class="ln in">${line(idx)}</div>`;
    }
    return {
      update(style, color) {
        const s = Wv.st.s; if (!s || !s.lyrics.enabled) { if (el.innerHTML) el.innerHTML = ''; return; }
        const idx = Wv.lyricIndex(), key = Wv.st.lyrics.key;
        if (idx !== lastIdx || key !== lastKey || style !== lastStyle) { render(style, idx); lastIdx = idx; lastKey = key; lastStyle = style; }
        if (style === 'Karaoke' && idx >= 0) {
          const L = Wv.st.lyrics.lines, a = L[idx].t, b = L[idx + 1] ? L[idx + 1].t : a + 4;
          const p = Math.max(0, Math.min(1, (Wv.position() - a) / Math.max(0.5, b - a)));
          const ln = el.querySelector('.ln'); if (ln) { ln.style.setProperty('--p', (p * 100).toFixed(1) + '%'); ln.style.setProperty('--k1', color || '#fff'); }
        }
      },
    };
  }
  return { STYLES, FREE: ['Line', 'Fade'], mount };
})();
