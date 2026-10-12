/* ============================================================
   Hero frame scrubber
   ------------------------------------------------------------
   Plays a short head-turn clip as discrete frames, indexed by
   the pointer angle around the face. A center dead zone keeps
   the portrait facing forward when the pointer is nearby.

   Expects, produced from good4.mp4 by tools/build-good4-hero.sh:
     assets/veo-frames/center.webp        resting frame, shown first
     assets/veo-frames/frame_0.webp  ...  frame_63.webp

   If those files are absent this does nothing at all and the
   depth-parallax hero (hero-depth.js) stays in charge.
   ============================================================ */
(() => {
  'use strict';

  const COUNT = 64;
  const DIR = 'assets/veo-frames/';
  // Frame filenames never change, so a rebuild of the set would otherwise
  // be served from cache forever. Bump this whenever the frames change.
  const REV = '?r=13';

  /* good4 is cropped to 960x720 (4:3). */
  const FRAME = { w: 960, h: 720 };
  const WINDOW = { w: 960, h: 720 };
  const OFFSET = { x: 0, y: 0 };

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
  load(DIR + 'center.webp' + REV).then(start).catch(() => {});

  function start(center) {
    const canvas = document.createElement('canvas');
    canvas.className = 'hero-frames';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d', { alpha: true });

    const host = img.closest('.hero-inner') || hero;
    host.appendChild(canvas);
    hero.classList.add('frames-on');

    canvas.style.aspectRatio = `${WINDOW.w} / ${WINDOW.h}`;

    let cw = 0;
    let ch = 0;

    const place = (c, frame) => {
      const sx = cw / WINDOW.w;
      const sy = ch / WINDOW.h;
      c.drawImage(frame, OFFSET.x * sx, OFFSET.y * sy, FRAME.w * sx, FRAME.h * sy);
    };

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
      place(ctx, frame);
    };

    // Blend between the two neighboring views. The source clip has a finite
    // number of poses; sub-frame blending prevents the face from snapping
    // between them as the pointer moves.
    const drawBetween = (a, b, amount) => {
      if (!a || !b || !cw) return draw(a || b);
      ctx.clearRect(0, 0, cw, ch);
      place(ctx, a);
      ctx.globalAlpha = amount;
      place(ctx, b);
      ctx.globalAlpha = 1;
    };

    resize();
    draw(center);
    window.addEventListener('resize', () => {
      resize();
      draw(center);
      last = -1;
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
        load(`${DIR}frame_${i}.webp${REV}`)
          .then((im) => {
            frames[i] = im;
            ready++;
            // enough of the middle is in to feel responsive
            if (!scrubbing && ready > COUNT * 0.35) scrubbing = true;
          })
          .catch(() => {});
      });

    let targetAngle = 0;
    let currentAngle = 0;
    let inDeadzone = true;

    const angleForPointer = (e) => {
      if (e.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect();
      // good4's eyes sit near the upper third of the cropped frame.
      const faceX = r.left + r.width * 0.5;
      const faceY = r.top + r.height * 0.3;
      const dx = e.clientX - faceX;
      const dy = e.clientY - faceY;
      const distance = Math.hypot(dx, dy);
      const deadzone = Math.min(window.innerWidth, window.innerHeight) * 0.12;
      const threshold = inDeadzone ? deadzone * 1.15 : deadzone;

      if (distance < threshold) {
        inDeadzone = true;
        return;
      }

      inDeadzone = false;
      // good4 moves clockwise from right -> down -> left -> up.
      targetAngle = Math.atan2(dy, dx);
      if (targetAngle < 0) targetAngle += Math.PI * 2;
    };

    hero.addEventListener('pointermove', angleForPointer);
    hero.addEventListener('pointerleave', () => {
      inDeadzone = true;
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

      if (inDeadzone) {
        if (last !== mid) {
          last = mid;
          resize();
          draw(center);
        }
        return;
      }

      let delta = targetAngle - currentAngle;
      if (delta > Math.PI) delta -= Math.PI * 2;
      if (delta < -Math.PI) delta += Math.PI * 2;
      // Cap angular travel to roughly one frame per tick. Large cursor moves
      // then pass through the intermediate poses instead of skipping them.
      const step = Math.sign(delta) * Math.min(Math.abs(delta) * 0.16, 0.06);
      currentAngle += step;
      if (currentAngle < 0) currentAngle += Math.PI * 2;
      if (currentAngle >= Math.PI * 2) currentAngle -= Math.PI * 2;
      const position = (currentAngle / (Math.PI * 2)) * COUNT;
      const i = Math.floor(position) % COUNT;
      const next = (i + 1) % COUNT;
      const fraction = position - Math.floor(position);
      const marker = `${i}:${Math.round(fraction * 20)}`;
      if (marker === last) return;
      last = marker;
      resize();
      drawBetween(frames[i] || pick(i), frames[next] || pick(next), fraction);
    };
    tick();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else tick();
    });
  }
})();
