/* ============================================================
   Hero depth parallax
   ------------------------------------------------------------
   Renders the cutout portrait through a depth map so the face
   leads the shoulders as the cursor moves — a 2.5D head-turn.

   Depth convention: 0 = background (never displaces), 1 = the
   face (displaces most). That keeps the silhouette anchored
   while the features travel.

   Degrades to the plain <img> if WebGL or the textures fail.
   ============================================================ */
(() => {
  'use strict';

  const hero = document.querySelector('.hero');
  const img = document.querySelector('.hero-portrait');
  if (!hero || !img) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(pointer:fine)').matches) return;

  const VERT = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main(){
      vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
      gl_Position = vec4(aPos, 0.0, 1.0);
    }`;

  const FRAG = `
    precision mediump float;
    varying vec2 vUv;
    uniform sampler2D uImage;
    uniform sampler2D uDepth;
    uniform vec2  uMouse;     // -1..1
    uniform float uStrength;
    uniform vec2  uTexel;

    void main(){
      // Iterate so near pixels don't smear: each pass re-reads depth at
      // the corrected position and converges on the right sample point.
      vec2 p = vUv;
      for (int i = 0; i < 4; i++) {
        float d = texture2D(uDepth, p).r;
        p = vUv + uMouse * d * uStrength;
      }

      vec4 col = texture2D(uImage, p);

      // Relight from the depth gradient so the face actually catches the
      // light as the cursor moves, rather than just sliding around.
      float dl = texture2D(uDepth, p - vec2(uTexel.x, 0.0)).r;
      float dr = texture2D(uDepth, p + vec2(uTexel.x, 0.0)).r;
      float du = texture2D(uDepth, p - vec2(0.0, uTexel.y)).r;
      float dd = texture2D(uDepth, p + vec2(0.0, uTexel.y)).r;

      vec3 n = normalize(vec3((dl - dr) * 2.0, (du - dd) * 2.0, 0.25));
      vec3 L = normalize(vec3(uMouse.x, -uMouse.y, 0.75));
      float diff = max(dot(n, L), 0.0);

      col.rgb += col.rgb * diff * 0.42;
      col.rgb += vec3(1.0, 0.55, 0.3) * pow(diff, 3.0) * 0.16 * col.a;

      gl_FragColor = col;
    }`;

  const canvas = document.createElement('canvas');
  canvas.className = 'hero-depth';
  canvas.setAttribute('aria-hidden', 'true');

  const gl =
    canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: true }) ||
    canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false });
  if (!gl) return;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('hero-depth shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uMouse = gl.getUniformLocation(prog, 'uMouse');
  const uStrength = gl.getUniformLocation(prog, 'uStrength');
  const uTexel = gl.getUniformLocation(prog, 'uTexel');

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  const makeTexture = (image, unit, name) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
    return t;
  };

  const load = (src) =>
    new Promise((res, rej) => {
      const i = new Image();
      i.crossOrigin = 'anonymous';
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = src;
    });

  // the <img> already has the colour plate decoded; reuse whichever source won
  const colourSrc = img.currentSrc || img.src;

  Promise.all([load(colourSrc), load('assets/hero-depth.jpg')])
    .then(([colour, depth]) => {
      makeTexture(colour, 0, 'uImage');
      makeTexture(depth, 1, 'uDepth');
      gl.uniform2f(uTexel, 1 / depth.naturalWidth, 1 / depth.naturalHeight);

      // must share the <img>'s containing block or the two won't line up:
      // the img resolves against .hero-inner, not .hero
      const host = img.closest('.hero-inner') || hero;
      host.appendChild(canvas);
      hero.classList.add('webgl-on');

      let w = 0;
      let h = 0;
      const resize = () => {
        const r = canvas.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const nw = Math.round(r.width * dpr);
        const nh = Math.round(r.height * dpr);
        if (nw === w && nh === h) return;
        w = canvas.width = nw;
        h = canvas.height = nh;
        gl.viewport(0, 0, w, h);
      };
      resize();
      window.addEventListener('resize', resize);

      // target vs current, lerped — the head eases toward the cursor
      let tx = 0;
      let ty = 0;
      let cx = 0;
      let cy = 0;
      const STRENGTH = 0.045;

      hero.addEventListener('pointermove', (e) => {
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      });
      hero.addEventListener('pointerleave', () => {
        tx = 0;
        ty = 0;
      });

      let visible = true;
      new IntersectionObserver(
        ([e]) => {
          visible = e.isIntersecting;
        },
        { rootMargin: '80px' }
      ).observe(hero);

      let raf;
      const frame = () => {
        raf = requestAnimationFrame(frame);
        // real head-turn frames loaded — stop burning GPU on the fake one
        if (hero.classList.contains('frames-on')) {
          cancelAnimationFrame(raf);
          return;
        }
        if (!visible) return;

        cx += (tx - cx) * 0.07;
        cy += (ty - cy) * 0.07;
        resize();

        gl.uniform2f(uMouse, cx, cy);
        gl.uniform1f(uStrength, STRENGTH);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      };
      frame();

      document.addEventListener('visibilitychange', () => {
        if (document.hidden) cancelAnimationFrame(raf);
        else frame();
      });
    })
    .catch(() => {
      /* textures unavailable — the plain <img> stays as-is */
      hero.classList.remove('webgl-on');
    });
})();
