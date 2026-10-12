/* ============================================================
   Cursor glow
   ------------------------------------------------------------
   A small glowing dot tracks the pointer while a light ring trails
   behind it and grows over links, buttons, and other controls.

   Skipped entirely for coarse pointers (no hover target) and
   for reduced-motion users.
   ============================================================ */
(() => {
  'use strict';

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const glow = document.createElement('div');
  glow.className = 'cursor-glow';
  glow.setAttribute('aria-hidden', 'true');

  const dot = document.createElement('div');
  dot.className = 'cursor-dot';
  dot.setAttribute('aria-hidden', 'true');

  document.body.append(glow, dot);
  document.body.classList.add('has-custom-cursor');

  // target = where the pointer is, gx/gy = where the halo has caught up to
  let tx = -100;
  let ty = -100;
  let gx = tx;
  let gy = ty;
  let on = false;
  let raf = 0;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    // The dot stays under the pointer; the ring follows with a soft lag.
    gx += (tx - gx) * 0.22;
    gy += (ty - gy) * 0.22;
    glow.style.transform = `translate3d(${gx.toFixed(1)}px,${gy.toFixed(1)}px,0) translate(-50%,-50%)`;
    dot.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0) translate(-50%,-50%)`;
  };

  document.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      tx = e.clientX;
      ty = e.clientY;
      if (!on) {
        on = true;
        // jump rather than slide in from wherever the halo was parked
        gx = tx;
        gy = ty;
        glow.classList.add('is-on');
        dot.classList.add('is-on');
      }
      // An interactive target under the pointer blooms the ring.
      const hot = e.target instanceof Element && e.target.closest('a,button,[role="button"],.interactive');
      glow.classList.toggle('is-hot', !!hot);
      dot.classList.toggle('is-hot', !!hot);
    },
    { passive: true }
  );

  const hide = () => {
    on = false;
    glow.classList.remove('is-on', 'is-hot');
    dot.classList.remove('is-on', 'is-hot');
  };
  document.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf) {
      tick();
    }
  });

  tick();
})();
