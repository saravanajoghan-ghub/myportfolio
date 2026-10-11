/* ============================================================
   Cursor glow
   ------------------------------------------------------------
   A warm halo that trails the pointer, plus a small dot that
   tracks it exactly. The native cursor is left visible — this
   decorates it rather than replacing it.

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

  // target = where the pointer is, gx/gy = where the halo has caught up to
  let tx = innerWidth / 2;
  let ty = innerHeight / 2;
  let gx = tx;
  let gy = ty;
  let on = false;
  let raf = 0;

  const tick = () => {
    raf = requestAnimationFrame(tick);
    // the dot is pinned to the pointer, the halo lags behind it
    gx += (tx - gx) * 0.16;
    gy += (ty - gy) * 0.16;
    glow.style.transform = `translate3d(${gx.toFixed(1)}px,${gy.toFixed(1)}px,0)`;
    dot.style.transform = `translate3d(${tx.toFixed(1)}px,${ty.toFixed(1)}px,0)`;
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
      // an interactive target under the pointer blooms the halo
      const hot = e.target instanceof Element && e.target.closest('a,button,[role="button"]');
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
  document.addEventListener('pointerleave', hide);
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
