/* Saravana Kumar B — portfolio interactions */
(() => {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- year ---------- */
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();

  /* ---------- sticky nav ---------- */
  const nav = document.getElementById('nav');
  const hero = document.querySelector('.hero');
  if (nav && hero) {
    const sentinel = document.createElement('div');
    hero.prepend(sentinel);
    new IntersectionObserver(
      ([e]) => nav.classList.toggle('is-stuck', !e.isIntersecting),
      { rootMargin: '-90px 0px 0px 0px' }
    ).observe(sentinel);
  }

  /* ---------- mobile menu ---------- */
  const burger = document.querySelector('.burger');
  const menu = document.getElementById('mobile-menu');
  if (burger && menu) {
    const setOpen = (open) => {
      menu.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () =>
      setOpen(burger.getAttribute('aria-expanded') !== 'true')
    );
    menu.addEventListener('click', (e) => {
      if (e.target.tagName === 'A') setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') setOpen(false);
    });
  }

  /* ---------- active nav link on scroll ---------- */
  const links = [...document.querySelectorAll('.nav-links a')];
  const targets = links
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if (targets.length) {
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) =>
            a.classList.toggle(
              'is-active',
              a.getAttribute('href') === `#${entry.target.id}`
            )
          );
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    targets.forEach((t) => spy.observe(t));
  }

  /* ---------- marquee: duplicate track for a seamless loop ---------- */
  const track = document.querySelector('.marquee-track');
  if (track) {
    track.append(
      ...[...track.children].map((node) => {
        const clone = node.cloneNode(true);
        clone.setAttribute('aria-hidden', 'true');
        return clone;
      })
    );
  }

  /* ---------- engagement toggle ---------- */
  const COPY = {
    full: {
      label: 'CURRENT STATUS',
      headline: 'AI/ML Engineer <span>@ iTECH India</span>',
      list: [
        'Computer vision &amp; applied deep learning roles',
        'Generative AI and RAG platform teams',
        'Product teams that want AI in the product, not beside it',
        'Anywhere the model has to survive contact with users',
      ],
      note: "Happy where I am — but always open to a conversation about a problem worth moving for.",
    },
    consult: {
      label: 'ADVISORY &amp; BUILD',
      headline: 'Short engagements <span>that leave something running</span>',
      list: [
        'Feasibility reviews — can a model actually solve this?',
        'Proof of concept for vision or document-heavy workflows',
        'RAG assistants over your own private documents',
        'Rescuing a promising prototype that never shipped',
      ],
      note: 'Scoped per project after a conversation about the problem. Evenings and weekends, around my full-time role.',
    },
  };

  const toggle = document.querySelector('.toggle');
  if (toggle) {
    const slot = (name) => document.querySelector(`[data-slot="${name}"]`);
    toggle.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-mode]');
      if (!btn) return;

      [...toggle.querySelectorAll('button')].forEach((b) =>
        b.setAttribute('aria-selected', String(b === btn))
      );

      const data = COPY[btn.dataset.mode];
      if (!data) return;

      slot('label').innerHTML = data.label;
      slot('headline').innerHTML = data.headline;
      slot('list').innerHTML = data.list.map((li) => `<li>${li}</li>`).join('');
      slot('note').innerHTML = data.note;
    });
  }

  /* ---------- contact form -> mailto (no backend) ---------- */
  const form = document.getElementById('contact-form');
  const hint = document.getElementById('form-hint');
  if (form && hint) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = form.name.value.trim();
      const email = form.email.value.trim();
      const message = form.message.value.trim();

      if (!name || !email || !message) {
        hint.textContent = 'Please fill in all three fields.';
        hint.classList.add('is-err');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        hint.textContent = 'That email address does not look right.';
        hint.classList.add('is-err');
        return;
      }

      hint.classList.remove('is-err');
      hint.textContent = 'Opening your email app…';

      const body = `${message}\n\n— ${name}\n${email}`;
      window.location.href =
        `mailto:saravanajevana@gmail.com` +
        `?subject=${encodeURIComponent(`Portfolio enquiry from ${name}`)}` +
        `&body=${encodeURIComponent(body)}`;
    });
  }

  /* ---------- scroll reveal ---------- */
  const revealable = document.querySelectorAll(
    '.impact, .service-row, .w-card, .p-card, .b-stat, .b-quote, .b-right, ' +
      '.band-inner, .e-panel, .bg-feature, .bg-small, .contact-block, .footer-top'
  );

  if (!REDUCED) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealable.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
      io.observe(el);
    });
  }

  /* ---------- animated counters ----------
     Replays nothing: fires once when the number scrolls into view. */
  const counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    const run = (el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = parseInt(el.dataset.decimals || '0', 10);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';

      if (REDUCED) {
        el.textContent = prefix + target.toFixed(decimals) + suffix;
        return;
      }

      const DURATION = 1400;
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min((now - start) / DURATION, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    const countIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          run(entry.target);
          countIO.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => countIO.observe(el));
  }

  /* ---------- viz: only animate while on screen ----------
     A dozen looping scan-lines running off-screen is wasted battery, so
     each .viz gets its animations paused until it is actually visible. */
  const vizzes = document.querySelectorAll('.viz');
  if (vizzes.length && !REDUCED) {
    const vizIO = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          entry.target.style.setProperty(
            '--viz-play',
            entry.isIntersecting ? 'running' : 'paused'
          );
        });
      },
      { rootMargin: '120px 0px' }
    );
    vizzes.forEach((v) => {
      v.style.setProperty('--viz-play', 'paused');
      vizIO.observe(v);
    });
  }

  /* ---------- hero pointer parallax (fine pointers only) ---------- */
  const heroEl = document.querySelector('.hero');
  if (heroEl && !REDUCED && window.matchMedia('(pointer:fine)').matches) {
    heroEl.classList.add('has-parallax');
    let raf = 0;
    heroEl.addEventListener('pointermove', (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const r = heroEl.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        heroEl.style.setProperty('--px', `${(dx * 18).toFixed(1)}px`);
        heroEl.style.setProperty('--py', `${(dy * 12).toFixed(1)}px`);
      });
    });
    heroEl.addEventListener('pointerleave', () => {
      heroEl.style.setProperty('--px', '0px');
      heroEl.style.setProperty('--py', '0px');
    });
  }
})();
