/* ============================================================
   Hero frame scrubber
   ------------------------------------------------------------
   Maps the cursor angle around the face to one of 64 head-turn
   frames from good4.mp4. All frames are loaded and decoded before
   scrubbing begins; one crisp frame is drawn at a time to prevent
   double-image ghosting between poses.
   ============================================================ */
(() => {
  'use strict';

  const COUNT = 64;
  const DIR = 'assets/veo-frames/';
  const REV = '?r=13';
  const FRAME = { w: 960, h: 720 };
  // good4 briefly returns to neutral in its final upper-right sector. Route
  // those angles through its actual up-right/right poses instead of the
  // neutral frames, which made the face appear to ignore the pointer there.
  const ANGLE_FRAME = Array.from({ length: COUNT }, (_, index) => index);
  [56, 57, 58, 59, 59, 62, 63, 0].forEach((frame, offset) => {
    ANGLE_FRAME[56 + offset] = frame;
  });

  const hero = document.querySelector('.hero');
  const img = document.querySelector('.hero-portrait');
  if (!hero || !img) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const load = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => {
        if (typeof image.decode === 'function') {
          image.decode().catch(() => {}).then(() => resolve(image));
        } else {
          resolve(image);
        }
      };
      image.onerror = reject;
      image.src = src;
    });

  load(DIR + 'center.webp' + REV).then(start).catch(() => {});

  function start(center) {
    const canvas = document.createElement('canvas');
    canvas.className = 'hero-frames';
    canvas.setAttribute('aria-hidden', 'true');
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const host = img.closest('.hero-inner') || hero;
    host.appendChild(canvas);
    canvas.style.aspectRatio = `${FRAME.w} / ${FRAME.h}`;
    hero.classList.add('frames-on');

    let canvasWidth = 0;
    let canvasHeight = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.round(rect.width * dpr);
      const height = Math.round(rect.height * dpr);
      if (width === canvasWidth && height === canvasHeight) return;
      canvasWidth = canvas.width = width;
      canvasHeight = canvas.height = height;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    };

    const draw = (frame) => {
      if (!frame || !canvasWidth) return;
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
      ctx.drawImage(frame, 0, 0, canvasWidth, canvasHeight);
    };

    resize();
    draw(center);
    window.addEventListener('resize', () => {
      resize();
      lastFrame = -2;
      draw(center);
    }, { passive: true });

    const frames = new Array(COUNT);
    const allFrames = Array.from({ length: COUNT }, (_, index) =>
      load(`${DIR}frame_${index}.webp${REV}`).catch(() => null)
    );
    let framesReady = false;

    let targetAngle = 0;
    let currentAngle = 0;
    let inDeadzone = true;
    const angleForPointer = (event) => {
      if (event.pointerType === 'touch') return;
      const rect = canvas.getBoundingClientRect();
      const faceX = rect.left + rect.width * 0.5;
      const faceY = rect.top + rect.height * 0.3;
      const dx = event.clientX - faceX;
      const dy = event.clientY - faceY;
      const distance = Math.hypot(dx, dy);
      const deadzone = Math.min(window.innerWidth, window.innerHeight) * 0.12;
      const threshold = inDeadzone ? deadzone * 1.15 : deadzone;

      if (distance < threshold) {
        inDeadzone = true;
        return;
      }

      inDeadzone = false;
      // good4 turns clockwise: right -> down -> left -> up.
      targetAngle = Math.atan2(dy, dx);
      if (targetAngle < 0) targetAngle += Math.PI * 2;
    };

    // Track the pointer across the whole viewport so the direction stays tied
    // to the face even when it crosses the hero's content or the browser edge.
    window.addEventListener('pointermove', angleForPointer, { passive: true });
    window.addEventListener('blur', () => {
      inDeadzone = true;
    });
    window.addEventListener('pointerleave', () => {
      inDeadzone = true;
    });

    let visible = true;
    let animationFrame = 0;
    let lastFrame = -2;

    const nearestFrame = (index) => {
      if (frames[index]) return frames[index];
      for (let distance = 1; distance < COUNT; distance++) {
        const before = (index - distance + COUNT) % COUNT;
        const after = (index + distance) % COUNT;
        if (frames[before]) return frames[before];
        if (frames[after]) return frames[after];
      }
      return center;
    };

    const lerpAngle = (current, target, amount) => {
      let delta = (target - current) % (Math.PI * 2);
      if (delta < -Math.PI) delta += Math.PI * 2;
      if (delta > Math.PI) delta -= Math.PI * 2;
      return current + delta * amount;
    };

    const render = () => {
      animationFrame = 0;
      if (!visible || document.hidden) return;

      resize();
      if (inDeadzone) {
        if (lastFrame !== -1) {
          draw(center);
          lastFrame = -1;
        }
      } else {
        // Match the reference's per-frame shortest-path lerp. The frame loop
        // keeps pointer updates out of layout/paint and avoids direction snaps.
        currentAngle = lerpAngle(currentAngle, targetAngle, 0.26);
        currentAngle = (currentAngle + Math.PI * 2) % (Math.PI * 2);

        const angleIndex = Math.round((currentAngle / (Math.PI * 2)) * COUNT) % COUNT;
        const frameIndex = ANGLE_FRAME[angleIndex];
        if (frameIndex !== lastFrame) {
          draw(nearestFrame(frameIndex));
          lastFrame = frameIndex;
        }
      }

      animationFrame = requestAnimationFrame(render);
    };

    const startRendering = () => {
      if (framesReady && visible && !document.hidden && !animationFrame) {
        animationFrame = requestAnimationFrame(render);
      }
    };

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) startRendering();
      else if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      }
    }, { rootMargin: '100px' });
    observer.observe(hero);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = 0;
      } else {
        startRendering();
      }
    });

    // Keep the center frame on screen until every direction is ready, then
    // begin scrubbing with a complete, decoded frame set.
    Promise.all(allFrames).then((loadedFrames) => {
      loadedFrames.forEach((frame, index) => { frames[index] = frame; });
      framesReady = true;
      lastFrame = -2;
      startRendering();
    });
  }
})();
