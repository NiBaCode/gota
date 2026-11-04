/* Gota · Agua oscura — regia della pagina (GSAP 3.15 + ScrollTrigger + Lenis, script classici).
   Hero: 120 fotogrammi Blender legati allo scroll. L'acqua delle altre sezioni è in water.js. */
(function () {
  'use strict';
  const d = document, root = d.documentElement;
  const $ = (s, r) => (r || d).querySelector(s);
  const $$ = (s, r) => Array.from((r || d).querySelectorAll(s));
  const params = new URLSearchParams(location.search);
  const clamp = (a, b, x) => Math.min(b, Math.max(a, x));
  const span = (a, b, x) => clamp(0, 1, (x - a) / (b - a));
  const smooth = (x) => x * x * (3 - 2 * x);

  /* ---------- modulo: funziona anche senza movimento ---------- */
  const form = $('[data-form]'), input = $('#email'), msg = $('[data-form-msg]'), label = $('[data-submit-label]');
  const NOTE = msg.textContent;
  const valid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  let onReserved = () => {};
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!valid(input.value.trim())) {
      input.setAttribute('aria-invalid', 'true');
      msg.textContent = 'Escribe un correo válido, como nombre@correo.com.';
      msg.classList.add('is-error');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    msg.classList.remove('is-error');
    const btn = $('button', form);
    btn.disabled = true; btn.setAttribute('aria-busy', 'true');
    label.textContent = 'Guardando tu frasco…';
    setTimeout(() => {
      input.disabled = true; btn.hidden = true;
      msg.textContent = 'Tu frasco está guardado. Te escribimos cuando el lote 03 esté listo.';
      onReserved();
    }, 800);
  });
  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true' && valid(input.value.trim())) {
      input.removeAttribute('aria-invalid'); msg.classList.remove('is-error'); msg.textContent = NOTE;
    }
  });

  /* senza movimento o senza GSAP: pagina statica, tutto leggibile */
  if (!root.classList.contains('motion') || !window.gsap || !window.ScrollTrigger) { root.classList.remove('motion', 'fx'); return; }
  gsap.registerPlugin(ScrollTrigger);

  const inFrame = window.self !== window.top;
  let lenis = null;
  if (window.Lenis && !inFrame) {
    lenis = new Lenis({ lerp: 0.09, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    window.__lenis = lenis;
  }
  const W = window.GotaWater;
  const tryGL = (fn) => { try { return fn(); } catch (err) { console.warn('Water off, images kept:', err.message || err); return null; } };
  const imgReady = (img) => new Promise((res) => { if (img.complete && img.naturalWidth) res(img); else { img.loading = 'eager'; img.addEventListener('load', () => res(img), { once: true }); img.addEventListener('error', () => res(null), { once: true }); } });

  /* ---------- 1 · sequenza: stessa tecnica del Rosso, caricata a passate 8/4/2/1 ---------- */
  const N = 120;
  const SIZE = { d: [1920, 1200], m: [720, 1560] };
  const IMPACT = { d: [.5, .807], m: [.5, .677] };    /* dove la goccia tocca l'acqua, in proporzione al fotogramma */
  const folder = innerWidth < 700 || innerHeight > innerWidth * 1.1 ? 'm' : 'd';
  const hero = { p: 0 };
  const visual = $('[data-hero-visual]');
  const load = $('[data-hero-load]');

  function startSeq() {
    const url = (i) => 'assets/seq/' + folder + '/' + String(i).padStart(3, '0') + '.webp';
    const canvas = d.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true'); canvas.className = 'hero__canvas';
    visual.appendChild(canvas);
    const ctx = canvas.getContext('2d', { alpha: false });
    const frames = new Array(N).fill(null);
    let drawn = -1;
    const resize = () => {
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(visual.clientWidth * dpr); canvas.height = Math.round(visual.clientHeight * dpr); drawn = -1;
    };
    resize(); addEventListener('resize', resize);
    const nearest = (i) => { for (let k = 0; k < N; k++) { if (frames[i - k]) return i - k; if (frames[i + k]) return i + k; } return -1; };
    const draw = () => {
      const i = nearest(Math.round(clamp(0, 1, hero.p) * (N - 1)));
      if (i < 0 || i === drawn) return;
      const img = frames[i], cw = canvas.width, ch = canvas.height, k = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
      const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
      ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      if (drawn < 0) visual.classList.add('is-live');
      const dir = i >= drawn ? 1 : -1;
      for (let s = 1; s <= 3; s++) { const f = frames[i + s * dir]; if (f && f.decode) f.decode().catch(() => {}); }
      drawn = i;
    };
    const order = [], seen = new Set();
    [8, 4, 2, 1].forEach((step) => { for (let i = 0; i < N; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); } });
    let next = 0, done = 0;
    const pump = () => {
      if (next >= order.length) return;
      const i = order[next++], img = new Image();
      img.decoding = 'async';
      const after = (ok) => {
        if (ok) frames[i] = img;
        done++; load.firstElementChild.style.transform = 'scaleX(' + done / order.length + ')';
        if (done === order.length) load.classList.add('is-done');
        pump();
      };
      img.onload = () => after(true); img.onerror = () => after(false);
      img.src = url(i);
    };
    for (let k = 0; k < 6; k++) pump();
    window.__gotaSeq = { frames, get drawn() { return drawn; } };
    return draw;
  }
  const lite = !!(navigator.connection && navigator.connection.saveData) || params.has('no3d');
  const drawSeq = lite ? null : startSeq();
  if (lite) load.classList.add('is-done');

  /* ---------- 2 · superficie ---------- */
  const stage = $('[data-stage]'), surface = $('[data-surface]'), sideEls = $$('[data-surface-side]');
  const page = d.createElement('canvas');
  let sf = null;
  const dropA = { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, stretch: 0, dirx: 1, diry: 0, show: 0, last: -9 };

  function paintSurface(img) {
    const w = sf.gl.canvas.width, h = sf.gl.canvas.height;
    page.width = w; page.height = h;
    const c = page.getContext('2d');
    const k = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    c.drawImage(img, (w - img.naturalWidth * k) / 2, (h - img.naturalHeight * k) / 2, img.naturalWidth * k, img.naturalHeight * k);
    c.fillStyle = 'rgba(4,16,30,.5)'; c.fillRect(0, 0, w, h);
    const mobile = sf.w < 700;
    const size = (mobile ? Math.min(sf.w * .19, sf.h * .13) : Math.min(sf.w * .125, sf.h * .26)) * sf.dpr;
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#e8eef5';
    c.font = '400 ' + size + 'px "Bodoni Moda", Georgia, serif';
    const shift = size * .3;
    c.fillText('Agua fría,', w / 2 - (mobile ? 0 : shift), h / 2 - size * .5);
    c.font = 'italic 400 ' + size + 'px "Bodoni Moda", Georgia, serif';
    c.fillText('después piel', w / 2 + (mobile ? 0 : shift), h / 2 + size * .5);
    sf.tex(0, page, 'uTex');
  }

  /* ---------- 3 · goccia ---------- */
  const dropSec = $('[data-drop]');
  let dg = null;
  const dropState = { p: 0, wob: 0, last: 0, on: false };

  /* ---------- 4 · fondo ---------- */
  const deep = $('[data-deep]');
  let dp = null;
  const deepState = { on: false, ring: 0, amp: 0, until: 0 };
  const moonImg = new Image();

  async function setupGL() {
    await (d.fonts ? Promise.all([d.fonts.load('400 80px "Bodoni Moda"'), d.fonts.load('italic 400 80px "Bodoni Moda"')]).catch(() => {}) : 0);

    sf = tryGL(() => W.create($('[data-surface-gl]'), W.SURFACE, ['uTex', 'uRes', 'uRing', 'uAmb', 'uTime', 'uDrop', 'uDir', 'uShow'], { pixels: 9e5 }));
    if (sf) {
      const ok = await imgReady($('[data-surface-img]'));
      root.classList.add('gl-surface');   /* prima di misurare: senza la classe il canvas è display:none */
      const painted = ok && tryGL(() => { sf.resize(); paintSurface(ok); return true; });
      if (!painted) root.classList.remove('gl-surface');
      if (painted) {
        addEventListener('resize', () => { sf.resize(); tryGL(() => paintSurface(ok)); });
      } else sf = null;
    }

    dg = tryGL(() => W.create($('[data-drop-gl]'), W.DROP, ['uA', 'uB', 'uC', 'uW', 'uRes', 'uDrop', 'uDepth', 'uTime', 'uWob']));
    if (dg) {
      const imgs = await Promise.all($$('[data-note-img]').map(imgReady));
      const ok = imgs.every(Boolean) && tryGL(() => { dg.resize(); dg.tex(0, imgs[0], 'uA'); dg.tex(1, imgs[1], 'uB'); dg.tex(2, imgs[2], 'uC'); return true; });
      if (ok) addEventListener('resize', () => dg.resize());
      else {
        dg = null; root.classList.add('no-gl'); ScrollTrigger.refresh();   /* senza goccia le note restano un elenco con le foto */
      }
    }

    moonImg.src = 'assets/img/luna.webp';
    await imgReady(moonImg);
    dp = moonImg.naturalWidth ? tryGL(() => {
      const a = W.create($('[data-deep-gl]'), W.DEEP, ['uMoon', 'uRes', 'uC', 'uR', 'uTime', 'uRing', 'uRingA'], { pixels: 7e5 });
      root.classList.add('gl-deep');
      a.resize(); a.tex(0, moonImg, 'uMoon');
      return a;
    }) : null;
    if (dp) addEventListener('resize', () => dp.resize());
    ScrollTrigger.refresh();
  }
  setupGL();

  /* ---------- regia dello scroll ---------- */
  const SEQ_END = .6, RING_A = .52, RING_B = .7;   /* parti del palco: sequenza, anello che apre, frase */
  const copy = $$('[data-hero-copy]');
  const proxy = { p: 0 };
  const ringNow = { r: 0, amp: 0 };
  let surfaceOpen = false, lastP = 0, ambient = 0;
  gsap.to(proxy, {
    p: 1, ease: 'none',
    scrollTrigger: { trigger: '[data-run]', start: 'top top', end: 'bottom bottom', scrub: .5 },
    onUpdate() { stageUpdate(proxy.p); }
  });

  function ringCenter() {
    const [iw, ih] = SIZE[folder], [ix, iy] = IMPACT[folder];
    const sw = stage.clientWidth, sh = stage.clientHeight, k = Math.max(sw / iw, sh / ih);
    return [sw / 2 + (ix - .5) * iw * k, sh / 2 + (iy - .5) * ih * k];
  }

  function stageUpdate(p) {
    hero.p = span(0, SEQ_END, p);
    gsap.set(copy, { autoAlpha: 1 - span(.02, .1, p), y: -48 * span(.02, .1, p) });
    const open = span(RING_A, RING_B, p), [cx, cy] = ringCenter();
    surfaceOpen = open > 0;
    surface.style.opacity = surfaceOpen ? 1 : 0;
    if (surfaceOpen) {
      const big = Math.hypot(stage.clientWidth, stage.clientHeight) * 2.6;
      const r = big * open * open, ry = r * (.42 + .58 * open);
      if (open < 1) {
        const m = 'radial-gradient(' + r.toFixed(1) + 'px ' + ry.toFixed(1) + 'px at ' + cx.toFixed(1) + 'px ' + cy.toFixed(1) + 'px, #000 90%, transparent 100%)';
        surface.style.webkitMaskImage = m; surface.style.maskImage = m;
      } else { surface.style.webkitMaskImage = 'none'; surface.style.maskImage = 'none'; }
      ringNow.r = r * .9; ringNow.amp = 1 - span(.62, .86, p);
    }
    const side = span(RING_B - .01, RING_B + .08, p);
    sideEls.forEach((el, i) => { el.style.opacity = i ? span(RING_B + .05, RING_B + .13, p) : side; });
    surfaceAlive(p);
  }
  function surfaceAlive(p) {
    ambient = Math.min(1, ambient + Math.abs(p - lastP) * 40);   /* l'acqua si muove quando ti muovi tu, poi si calma */
    lastP = p;
  }

  /* la goccia-lente segue il puntatore; su telefono attraversa la frase una volta, da sola */
  const stageRect = () => stage.getBoundingClientRect();
  addEventListener('pointermove', (e) => {
    if (proxy.p < RING_B) return;
    const r = stageRect();
    dropA.tx = e.clientX - r.left; dropA.ty = e.clientY - r.top; dropA.show = 1; dropA.last = gsap.ticker.time;
  }, { passive: true });
  let piloted = false;
  function pilot() {
    if (piloted || !sf) return;
    piloted = true;
    const w = sf.w, h = sf.h;
    dropA.x = dropA.tx = w * .18; dropA.y = dropA.ty = h * .44;
    gsap.to(dropA, { show: 1, duration: .5 });
    gsap.to(dropA, { tx: w * .8, duration: 2.6, ease: 'sine.inOut' });
    gsap.to(dropA, { ty: h * .56, duration: 2.6, ease: 'sine.inOut' });
    gsap.to(dropA, { show: 0, duration: .6, delay: 3.4 });
  }

  function surfaceFrame(time, dt) {
    if (!sf || !surfaceOpen) return;
    if (proxy.p > RING_B + .03) pilot();
    const k = 70, c = 10.5;
    dropA.vx += ((dropA.tx - dropA.x) * k - dropA.vx * c) * dt; dropA.vy += ((dropA.ty - dropA.y) * k - dropA.vy * c) * dt;
    dropA.x += dropA.vx * dt; dropA.y += dropA.vy * dt;
    const R = Math.min(sf.w, sf.h) * .1, speed = Math.hypot(dropA.vx, dropA.vy);
    dropA.stretch += (Math.min(.55, speed / (R * 14)) - dropA.stretch) * Math.min(1, dt * 9);
    if (speed > R * .4) { dropA.dirx = dropA.vx / speed; dropA.diry = dropA.vy / speed; }
    ambient = Math.max(0, ambient - dt * .33);
    const g = sf.gl, U = sf.U, D = sf.dpr, [cx, cy] = ringCenter();
    g.uniform1f(U.uTime, time);
    g.uniform1f(U.uAmb, ambient + ringNow.amp * .7);
    g.uniform4f(U.uRing, cx * D, cy * D, ringNow.r * D, ringNow.amp);
    g.uniform4f(U.uDrop, dropA.x * D, dropA.y * D, R * D, dropA.stretch);
    g.uniform2f(U.uDir, dropA.dirx, dropA.diry);
    g.uniform1f(U.uShow, dropA.show);
    sf.draw();
  }

  /* ---- 3 · la discesa ---- */
  const notes = $$('[data-note]'), head = $('[data-drop-head]');
  const BANDS = [[.13, .36], [.39, .62], [.65, .88]];
  ScrollTrigger.create({ trigger: dropSec, start: 'top bottom', end: 'bottom top', onToggle: (s) => { dropState.on = s.isActive; } });
  gsap.to(dropState, { p: 1, ease: 'none', scrollTrigger: { trigger: dropSec, start: 'top top', end: 'bottom bottom', scrub: .4 }, onUpdate: noteUpdate });
  function noteUpdate() {
    const p = dropState.p;
    dropState.wob = Math.min(1, dropState.wob + Math.abs(p - dropState.last) * 30); dropState.last = p;
    head.style.opacity = 1 - span(.07, .12, p);
    notes.forEach((n, i) => {
      const [a, b] = BANDS[i];
      const o = Math.min(span(a, a + .03, p), 1 - span(b - .03, b, p));
      n.style.opacity = o; n.style.visibility = o > 0 ? 'visible' : 'hidden';
    });
  }
  noteUpdate();
  function dropFrame(time, dt) {
    if (!dg || !dropState.on) return;
    const p = dropState.p, w = dg.w, h = dg.h, wide = w >= 900 && w > h;
    const R = wide ? Math.min(w * .17, h * .27) : Math.min(w * .36, h * .2);
    const home = wide ? h * .53 : h * .34;
    let y = gsap.utils.interpolate(-R * 2, home, smooth(span(0, .13, p)));
    y = gsap.utils.interpolate(y, h + R * 2, Math.pow(span(.88, 1, p), 2));
    y += Math.sin(p * 18) * h * .012;
    const x = w / 2 + Math.sin(p * 11) * w * .012;
    const f = (i) => Math.min(span(BANDS[i][0] - .03, BANDS[i][0] + .01, p), i < 2 ? 1 - span(BANDS[i][1] - .01, BANDS[i][1] + .03, p) : 1);
    let a = f(0), b = f(1), c = f(2);
    if (p < BANDS[0][0]) a = 1;
    const sum = Math.max(.001, a + b + c);
    dropState.wob = Math.max(0, dropState.wob - dt * .5);
    const g = dg.gl, U = dg.U, D = dg.dpr;
    g.uniform1f(U.uTime, time); g.uniform1f(U.uDepth, p); g.uniform1f(U.uWob, dropState.wob);
    g.uniform3f(U.uW, a / sum, b / sum, c / sum);
    g.uniform3f(U.uDrop, x * D, y * D, R * D);
    dg.draw();
  }

  /* ---- 4 · il fondo: vive solo in vista, e si calma se nessuno si muove ---- */
  ScrollTrigger.create({ trigger: deep, start: 'top bottom', end: 'bottom top', onToggle: (s) => { deepState.on = s.isActive; deepState.until = gsap.ticker.time + 5; }, onUpdate: () => { deepState.until = gsap.ticker.time + 5; } });
  addEventListener('pointermove', () => { if (deepState.on) deepState.until = gsap.ticker.time + 5; }, { passive: true });
  let deepClock = 0;
  function deepFrame(time, dt) {
    if (!dp || !deepState.on) return;
    if (time > deepState.until && deepState.drawn) return;
    deepState.drawn = true;
    deepClock += dt;
    const wide = dp.w > dp.h;
    const g = dp.gl, U = dp.U, D = dp.dpr, u = Math.min(dp.w, dp.h);
    deepState.ring += dt * u * .9; deepState.amp = Math.max(0, deepState.amp - dt * .45);
    g.uniform1f(U.uTime, deepClock);
    g.uniform2f(U.uC, wide ? .66 : .6, wide ? .3 : .13);
    g.uniform1f(U.uR, u * (wide ? .2 : .2) * D);
    g.uniform1f(U.uRing, deepState.ring * D); g.uniform1f(U.uRingA, deepState.amp);
    dp.draw();
  }
  function deepFrameForce() { deepState.on = true; deepState.until = 1e9; deepFrame(gsap.ticker.time, .016); }
  onReserved = () => { deepState.ring = 0; deepState.amp = 1; deepState.until = gsap.ticker.time + 5; };

  /* ---- 1 · l'acqua si tocca prima di scorrere: mouse = cerchi piccoli, clic o tocco = onda.
     Il canvas nasce al primo contatto con l'acqua e sparisce appena parte lo scroll ---- */
  const HORIZON = { d: .645, m: .56 };
  const BOTTLE0 = { d: [.433, .566, .73], m: [.356, .644, .615] };   /* flacone nel primo fotogramma: sinistra, destra, base */
  const ripples = [];
  let rp = null, rpFailed = false, rpLast = { x: -999, y: -999, t: 0 };
  function rippleSetup() {
    if (rp || rpFailed) return rp;
    const c = d.createElement('canvas');
    c.className = 'hero__ripple'; c.setAttribute('aria-hidden', 'true');
    visual.appendChild(c);
    const first = window.__gotaSeq && window.__gotaSeq.frames[0];
    const src = first || $('.hero__poster');
    rp = tryGL(() => {
      const a = W.create(c, W.HERO, ['uTex', 'uRes', 'uS', 'uH', 'uBot', 'uRp'], { pixels: 7e5 });
      a.fit = () => {
        a.resize();
        const [iw, ih] = SIZE[folder], k = Math.max(a.w / iw, a.h / ih);
        a.gl.uniform2f(a.U.uS, a.w / k / iw, a.h / k / ih);
      };
      a.fit(); a.gl.uniform1f(a.U.uH, HORIZON[folder]); a.gl.uniform3fv(a.U.uBot, BOTTLE0[folder]); a.tex(0, src, 'uTex');
      return a;
    });
    if (rp) addEventListener('resize', rp.fit); else { rpFailed = true; c.remove(); }
    return rp;
  }
  function overWater(x, y) {
    const [iw, ih] = SIZE[folder], sw = stage.clientWidth, sh = stage.clientHeight, k = Math.max(sw / iw, sh / ih);
    return (y - sh / 2) / (ih * k) + .5 > HORIZON[folder] + .02 && x >= 0 && x <= sw;
  }
  function addRipple(x, y, amp) {
    if (proxy.p > .004 || !rippleSetup()) return;
    ripples.push({ x, y, amp, born: gsap.ticker.time });
    if (ripples.length > 10) ripples.shift();
  }
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !overWater(e.clientX, e.clientY)) return;
    const t = gsap.ticker.time, moved = Math.hypot(e.clientX - rpLast.x, e.clientY - rpLast.y);
    if (moved < 46 || t - rpLast.t < .1) return;
    rpLast = { x: e.clientX, y: e.clientY, t };
    addRipple(e.clientX, e.clientY, .45);
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    if ((e.target.closest && e.target.closest('a, button, input')) || !overWater(e.clientX, e.clientY)) return;
    addRipple(e.clientX, e.clientY, 1);
  }, { passive: true });
  function rippleFrame(time) {
    if (!rp) return;
    const c = rp.gl.canvas, fade = 1 - span(.002, .012, proxy.p);
    while (ripples.length && time - ripples[0].born > 3.2) ripples.shift();
    const on = ripples.length > 0 && fade > 0;
    if (!on) { if (c.style.opacity !== '0') c.style.opacity = 0; return; }
    c.style.opacity = fade;
    const D = rp.dpr, u = Math.min(rp.w, rp.h), data = new Float32Array(40);
    ripples.forEach((r, i) => {
      const age = time - r.born;
      data.set([r.x * D, r.y * D, age * u * .34 * D, r.amp * Math.exp(-age * 1.5) * Math.min(1, age * 8)], i * 4);
    });
    rp.gl.uniform4fv(rp.U.uRp, data);
    rp.draw();
  }

  /* un solo orologio per tutta l'acqua */
  let last = 0;
  gsap.ticker.add((time) => {
    const dt = Math.min(.05, last ? time - last : .016); last = time;
    if (drawSeq && proxy.p < RING_B + .02) drawSeq();
    rippleFrame(time); surfaceFrame(time, dt); dropFrame(time, dt); deepFrame(time, dt);
  });
  stageUpdate(0);
  window.__gota = { proxy, dropState, ripples, get gl() { return { sf: !!sf, dg: !!dg, dp: !!dp }; }, still() { if (!dp) return ''; deepClock += .3; deepFrameForce(); return dp.gl.canvas.toDataURL('image/webp', .8); } };
})();
