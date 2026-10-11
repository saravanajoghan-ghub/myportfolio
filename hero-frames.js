/* ============================================================
   Hero frame scrubber
   ------------------------------------------------------------
   Plays a short head-turn clip as discrete frames, indexed by
   the pointer angle around the face. A center dead zone keeps
   the portrait facing forward when the pointer is nearby.

   Expects, produced by tools/build-hero-frames.sh:
     assets/veo-frames/center.webp        resting frame, shown first
     assets/veo-frames/frame_0.webp  ...  frame_63.webp

   If those files are absent this does nothing at all and the
   depth-parallax hero (hero-depth.js) stays in charge.
   ============================================================ */
(() => {
  'use strict';

  const COUNT = 64;
  const DIR = 'assets/veo-frames/';

  /* The canvas shows a window onto the frame, in frame pixels (frames are
     1000x750). The window is WIDER than the frame and the frame sits inside
     it at OFFSET, so the drawn figure can be centred on the head rather than
     on the image.

     Why not a tight crop around the head: the collar does not close into a
     recognisable shape until y~717 (above that it is two separate wings with
     real background between them and the neck, which reads as a keying
     error), and the shoulders reach x 20..952 by y 740. So the window has to
     run the full height and hold the full shoulder span — anything tighter
     either guillotines the collar or slices the shoulders off at a hard
     vertical edge.

     Measured across all 64 frames the head's own axis is x 466, so centring
     needs 486px of window either side of it: 466+486 = 952 covers the widest
     shoulder, and the 20px the window extends past the frame's left edge is
     just transparent padding. Head lands at exactly 50% of the window. */
  const FRAME = { w: 1000, h: 750 };
  const WINDOW = { w: 972, h: 750 };
  const OFFSET = { x: 20, y: 0 };

  /* Collar patch — see tools/build-hero-patch.sh, which generates it.

     The clip's matte is not reliable where the collar meets the neck: the
     shadowed crease there is mid-luma and desaturated, i.e. the same values
     as the backdrop, and it opens sideways into real background so the
     build script's floodfill cannot tell it is interior. About half the
     frames come out with a bite of background chewed into the collar.

     It cannot be repaired by patching alpha alone: WebP discards RGB under
     fully transparent pixels, so a hole has no colour left to recover.

     patch.webp is the resting frame's collar, cut to just the two junction
     zones where holes actually occur, feathered at its edges. Drawing it
     OVER each live frame replaces those zones outright, so they are
     pixel-identical all sweep long — the body is static and only the head
     turns, which is also what makes it invisible: there is no per-frame
     variation left to read as a seam. It deliberately does not cover the
     central neck column (that moves, and has no holes) or the silhouette
     edges (left to the live frame, so the outline still tracks the head). */
  const PATCH = 'patch.webp';

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
  // built — bail silently rather than logging a wall of 404s. The patch is
  // optional: without it the frames just show their original collar holes.
  load(DIR + 'center.webp')
    .then((center) =>
      load(DIR + PATCH).then(
        (patch) => start(center, patch),
        () => start(center, null)
      )
    )
    .catch(() => {});

  function start(center, patch) {
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
      if (patch) place(ctx, patch);
    };

    resize();
    draw(center);
    window.addEventListener('resize', () => {
      resize();
      draw(frames[last] || center);
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

    /* ---- pointer angle around the face -> frame index ---- */
    let targetAngle = 0;
    let currentAngle = 0;
    let inDeadzone = true;

    const angleForPointer = (e) => {
      if (e.pointerType === 'touch') return;
      const r = canvas.getBoundingClientRect();
      // the window is built so the head sits at exactly 50% across; the
      // head's vertical centre (source y ~263 of 750) is 35% down
      const faceX = r.left + r.width * 0.5;
      const faceY = r.top + r.height * 0.35;
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
      currentAngle += delta * 0.14;
      if (currentAngle < 0) currentAngle += Math.PI * 2;
      if (currentAngle >= Math.PI * 2) currentAngle -= Math.PI * 2;
      const i = Math.round((currentAngle / (Math.PI * 2)) * COUNT) % COUNT;
      if (i === last) return;
      last = i;
      resize();
      draw(pick(i));
    };
    tick();

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else tick();
    });
  }
})();
