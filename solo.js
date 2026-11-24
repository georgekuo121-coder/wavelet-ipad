// Stand-alone iPad build: no PC needed. Signs in to Spotify in the browser (PKCE, no secret), follows
// whatever this Spotify account is playing (normally the iPad's own Spotify app), and fetches synced
// lyrics from lrclib.net. Feeds the same entry points (IN.*) that the PC connection uses in remote.html.
// The Spotify login stays in this browser's storage only.
(() => {
  const CFG = window.WV_CONFIG || {};
  const SCOPE = 'user-read-playback-state user-read-currently-playing user-modify-playback-state';
  const REDIRECT = location.origin + location.pathname;
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} } };
  const clientId = () => LS.get('wv-solo-client') || CFG.clientId || '';
  let tok = { access: '', exp: 0, refresh: LS.get('wv-solo-refresh') || '' };
  let IN = null, timer = 0, busy = false, key = '', cur = null, waitUntil = 0, qT = 0;

  /* ---------- sign-in ---------- */
  const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  async function login() {
    if (!clientId()) return showLogin('還沒有設定 Spotify Client ID。');
    const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
    const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
    const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
    LS.set('wv-solo-verifier', verifier); LS.set('wv-solo-state', state);
    location.href = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({ client_id: clientId(), response_type: 'code', redirect_uri: REDIRECT, code_challenge_method: 'S256', code_challenge: challenge, state, scope: SCOPE });
  }
  async function tokenCall(form) {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId(), ...form }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error_description || j.error || 'HTTP ' + r.status);
    tok.access = j.access_token; tok.exp = Date.now() + (j.expires_in || 3600) * 1000 - 60000;
    if (j.refresh_token) { tok.refresh = j.refresh_token; LS.set('wv-solo-refresh', tok.refresh); }
  }
  async function finishLogin() {
    const q = new URLSearchParams(location.search);
    if (!q.has('code') && !q.has('error')) return;
    history.replaceState(null, '', REDIRECT); // keep the code out of the address bar and the home-screen link
    if (q.get('error')) return showLogin('Spotify 沒有完成登入（' + q.get('error') + '）。');
    if (q.get('state') !== LS.get('wv-solo-state')) return showLogin('登入資訊不符，請再登入一次。');
    try { await tokenCall({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: REDIRECT, code_verifier: LS.get('wv-solo-verifier') || '' }); }
    catch (e) { showLogin('登入失敗：' + e.message); }
    LS.set('wv-solo-verifier', null); LS.set('wv-solo-state', null);
  }
  function logout() { tok = { access: '', exp: 0, refresh: '' }; LS.set('wv-solo-refresh', null); clearInterval(timer); timer = 0; showLogin(); }
  async function api(path, opt = {}) {
    if (!tok.refresh) throw Object.assign(new Error('not signed in'), { login: true });
    if (!tok.access || Date.now() > tok.exp) {
      try { await tokenCall({ grant_type: 'refresh_token', refresh_token: tok.refresh }); }
      catch (e) { if (/invalid_grant|revoked/i.test(e.message)) logout(); throw e; }
    }
    const r = await fetch('https://api.spotify.com/v1' + path, { ...opt, headers: { Authorization: 'Bearer ' + tok.access, ...(opt.headers || {}) } });
    if (r.status === 429) { waitUntil = Date.now() + (+(r.headers.get('Retry-After') || 5)) * 1000; throw new Error('rate limited'); }
    if (r.status === 401) { tok.access = ''; throw new Error('401'); }
    if (r.status === 204 || r.status === 202) return null;
    if (!r.ok) throw Object.assign(new Error('Spotify ' + r.status), { status: r.status });
    return r.headers.get('content-type') && r.headers.get('content-type').includes('json') ? r.json() : null;
  }

  /* ---------- login screen ---------- */
  function showLogin(msg) {
    let el = document.getElementById('soloLogin');
    if (!el) {
      el = document.createElement('div'); el.id = 'soloLogin';
      el.style.cssText = 'position:fixed;inset:0;z-index:20;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.72);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)';
      document.body.appendChild(el);
    }
    el.innerHTML = `<div style="max-width:460px;padding:28px;text-align:center;line-height:1.7">
      <div style="font-size:28px;font-weight:800;margin-bottom:8px">Wavelet</div>
      <div style="opacity:.75;font-size:15px">在這台 iPad 的 Spotify 播歌，這裡就會顯示封面、同步歌詞和視覺化，不需要開電腦。</div>
      ${msg ? `<div style="color:#ff9b9b;margin-top:12px;font-size:14px">${msg.replace(/[<>&]/g, '')}</div>` : ''}
      <button id="soloGo" style="margin-top:22px;border:0;border-radius:24px;padding:14px 28px;font:700 16px inherit;font-family:inherit;background:#1ed760;color:#000">登入 Spotify</button>
      <div style="opacity:.5;font-size:12px;margin-top:14px">只會讀取播放狀態，並在你按畫面上的按鈕時控制播放。登入資料只存在這台 iPad。</div></div>`;
    el.querySelector('#soloGo').onclick = login;
  }
  const hideLogin = () => { const el = document.getElementById('soloLogin'); if (el) el.remove(); };

  /* ---------- lyrics (same matching rules as the PC app) ---------- */
  function parseLRC(txt) {
    const out = [];
    for (const row of (txt || '').split(/\r?\n/)) {
      const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)], text = row.replace(/\[[^\]]*\]/g, '').trim();
      for (const s of stamps) out.push({ t: +s[1] * 60 + +s[2], text });
    }
    return out.sort((a, b) => a.t - b.t);
  }
  const normTitle = (s) => String(s || '').toLowerCase().replace(/\s*[([（【].*?[)\]）】]/g, '').replace(/\s+-\s+.*$/, '').replace(/feat\.?.*$/, '').replace(/[^\p{L}\p{N}]+/gu, '');
  const sameTitle = (a, b) => { const x = normTitle(a), y = normTitle(b); return !!x && !!y && (x === y || (x.length > 3 && y.length > 3 && (x.includes(y) || y.includes(x)))); };
  const artistsOf = (s) => String(s || '').toLowerCase().split(/\s*(?:,|&|、|\/|;| x | feat\.? | ft\.? | and )\s*/).map((a) => a.replace(/[^\p{L}\p{N}]+/gu, '')).filter(Boolean);
  const sameArtist = (a, b) => { const x = artistsOf(a), y = artistsOf(b); return !y.length || x.some((p) => y.some((q) => p === q || p.includes(q) || q.includes(p))); };
  async function findLyrics(m) {
    const get = async (u) => { const r = await fetch(u); return r.ok ? r.json() : null; };
    const q = { track_name: m.title, artist_name: m.artist };
    let res = m.duration > 0 ? await get('https://lrclib.net/api/get?' + new URLSearchParams({ ...q, duration: Math.round(m.duration) })).catch(() => null) : null;
    if (!res || !res.syncedLyrics) {
      const list = (await get('https://lrclib.net/api/search?' + new URLSearchParams(q)).catch(() => null)) || [];
      const best = list.filter((x) => x.syncedLyrics && sameTitle(x.trackName, m.title) && sameArtist(x.artistName, m.artist))
        .map((x) => ({ x, d: m.duration > 0 && x.duration ? Math.abs(x.duration - m.duration) : 0 })).sort((a, b) => a.d - b.d)[0];
      res = best ? best.x : res && sameTitle(res.trackName, m.title) ? res : null;
    }
    return { lines: parseLRC(res && res.syncedLyrics), plain: res && !res.syncedLyrics ? res.plainLyrics : '' };
  }
  async function dataUrl(url) {
    const b = await (await fetch(url)).blob();
    return new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => ok(url); r.readAsDataURL(b); });
  }
  const img = (album) => { const im = ((album && album.images) || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0)); return (im.find((x) => (x.width || 0) <= 640) || im[0] || {}).url || ''; };

  /* ---------- follow the player ---------- */
  async function queue() {
    try {
      const q = await api('/me/player/queue');
      IN.spotify({ connected: true, queue: ((q && q.queue) || []).slice(0, 8).map((t) => ({ title: t.name, artist: (t.artists || (t.show ? [t.show] : [])).map((a) => a.name).join(', '), image: img(t.album || t) })) });
    } catch {}
  }
  async function poll() {
    if (busy || document.visibilityState !== 'visible' || Date.now() < waitUntil) return;
    busy = true;
    try {
      const t0 = Date.now();
      const p = await api('/me/player'), it = p && p.item;
      const half = Math.min(0.5, (Date.now() - t0) / 2000), now = Date.now();
      hideLogin(); IN.status('', false);
      if (!it || it.type !== 'track') {
        if (key !== 'none') { key = 'none'; cur = null; IN.media({ source: 'spotify', device: '', title: '', status: 'Stopped', now }); IN.cover(''); IN.lyrics({ key: '', lines: [] }); }
        return;
      }
      const mm = { source: 'spotify', device: (p.device && p.device.name) || '', title: it.name, artist: (it.artists || []).map((a) => a.name).join(', '), album: (it.album && it.album.name) || '',
        duration: (it.duration_ms || 0) / 1000, position: (p.progress_ms || 0) / 1000 + (p.is_playing ? half : 0), status: p.is_playing ? 'Playing' : 'Paused', updated: now, now };
      if (it.id !== key) {
        key = it.id; cur = mm; IN.media(mm); IN.lyrics({ key, lines: [], loading: true }); queue(); qT = now;
        const id = it.id, u = img(it.album);
        if (u) dataUrl(u).then((d) => { if (key === id) IN.cover(d); }).catch(() => {});
        findLyrics(mm).catch(() => ({ lines: [] })).then((l) => { if (key === id) IN.lyrics({ key: id, ...l }); });
        return;
      }
      const pred = cur.position + (cur.status === 'Playing' ? (now - cur.updated) / 1000 : 0);
      if (cur.status !== mm.status || Math.abs(pred - mm.position) > 0.3 || cur.device !== mm.device) { cur = mm; IN.media(mm); }
      if (now - qT > 20000) { qT = now; queue(); }
    } catch (e) {
      if (e.login) showLogin(); else if (!/rate limited/.test(e.message)) IN.status('Spotify 暫時連不上，重試中…', true);
    } finally { busy = false; }
  }

  window.WvSolo = {
    async start(feed) {
      IN = feed;
      IN.settings(CFG.settings || {}); IN.opts({ offset: 0, songOffset: 0 });
      IN.media({ source: 'spotify', title: '', status: 'Stopped', now: Date.now() });
      await finishLogin();
      if (!tok.refresh) return showLogin();
      timer = setInterval(poll, 1000); poll();
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') poll(); });
    },
    // Controls act on the active Spotify device (needs Spotify Premium).
    async cmd(c, t) {
      const playing = cur && cur.status === 'Playing';
      const [method, path] = c === 'play' ? ['PUT', playing ? '/me/player/pause' : '/me/player/play'] : c === 'next' ? ['POST', '/me/player/next']
        : c === 'prev' ? ['POST', '/me/player/previous'] : c === 'seek' ? ['PUT', '/me/player/seek?position_ms=' + Math.round(t * 1000)] : [];
      if (!method) return;
      try { await api(path, { method }); setTimeout(poll, 350); }
      catch (e) { IN.status(e.status === 403 ? '控制播放需要 Spotify Premium，請在 Spotify App 裡操作' : '沒辦法控制 Spotify：' + e.message, true); setTimeout(() => IN.status('', false), 3500); }
    },
    logout,
  };
})();
