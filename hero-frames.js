/* ============================================================
   Hero frame scrubber
   ------------------------------------------------------------
   Plays a short head-turn clip as discrete frames, indexed by
   cursor X — so the head actually rotates to follow the pointer
   instead of faking depth.

   Expects, produced by tools/build-hero-frames.sh:
     assets/frames/center.webp        resting frame, shown first
     assets/frames/frame_0.webp  ...  frame_63.webp

   If those files are absent this does nothing at all and the
   depth-parallax hero (hero-depth.js) stays in charge.
   ============================================================ */
(() => {
  'use strict';

  const COUNT = 64;
  const DIR = 'assets/frames/';

  const hero = document.querySelector('.hero');
  const img = document.querySelector('.hero-portrait');
  if (!hero || !img) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const load = (src) =>
    new Promise((res, rej) => {
      const i = new Image();
      i.decoding = 'async';
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });

  // Probe the resting frame first. Missing means the clip was never
  // built — bail silently rather than logging a wall of 404s.
  load(DIR + 'center.webp').then(start).catch(() => {});

  function start(center) {
    const canvas = document.createElement('canvas');
    canvas.className = 'hero-frames';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d', { alpha: true });

    const host = img.closest('.hero-inner') || hero;
    host.appendChild(canvas);
    hero.classList.add('frames-on');

    const AR = center.naturalWidth / center.naturalHeight;
    canvas.style.aspectRatio = `${center.naturalWidth} / ${center.naturalHeight}`;

    let cw = 0;
    let ch = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const nw = Math.round(r.width * dpr);
      const nh = Math.round(r.height * dpr);
      if (nw === cw && nh === ch) return;
      cw = canvas.width = nw;
      ch = canvas.height = nh;
    };

    const draw = (frame) => {
      if (!frame || !cw) return;
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(frame, 0, 0, cw, ch);
    };

    resize();
    draw(center);
    window.addEventListener('resize', () => {
      resize();
      draw(frames[Math.round(cur)] || center);
    });

    /* ---- progressive preload ----
       Load outward from the middle so the frames nearest the resting
       pose arrive first and small cursor moves work almost immediately. */
    const frames = new Array(COUNT);
    let ready = 0;
    const mid = COUNT >> 1;
    const order = [];
    for (let i = 0; i < COUNT; i++) {
      order.push(mid + (i % 2 ? -((i + 1) >> 1) : i >> 1));
    }

    let scrubbing = false;
    order
      .filter((i) => i >= 0 && i < COUNT)
      .forEach((i) => {
        load(`${DIR}frame_${i}.webp`)
          .then((im) => {
            frames[i] = im;
            ready++;
            // enough of the middle is in to feel responsive
            if (!scrubbing && ready > COUNT * 0.35) scrubbing = true;
          })
          .catch(() => {});
      });

    /* ---- cursor -> frame index ---- */
    let target = mid;
    let cur = mid;
    let active = false;

    hero.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = hero.getBoundingClientRect();
      const x = Math.min(Math.max((e.clientX - r.left) / r.width, 0), 1);
      target = x * (COUNT - 1);
      active = true;
    });
    hero.addEventListener('pointerleave', () => {
      target = mid;
    });

    let visible = true;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting), {
      rootMargin: '100px',
    }).observe(hero);

    // nearest already-decoded frame, so gaps during preload don't stutter
    const pick = (idx) => {
      const i = Math.round(idx);
      if (frames[i]) return frames[i];
      for (let d = 1; d < COUNT; d++) {
        if (frames[i - d]) return frames[i - d];
        if (frames[i + d]) return frames[i + d];
      }
      return center;
    };

    let last = -1;
    let raf;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!visible || !scrubbing) return;

      cur += (target - cur) * 0.14;
      const i = Math.round(cur);
      if (i === last) return;
      last = i;
      resize();
      draw(pick(cur));
    };
    tick();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else tick();
    });

    void active;
    void AR;
  }
})();
