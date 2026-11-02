/* ============================================================
   Julie Dion Portfolio — Site JavaScript
   ============================================================ */

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function initNavToggle() {
  const toggle = $('#nav-toggle');
  const links  = $('.nav-links');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', links.classList.contains('open'));
  });
  // Close on link click
  $$('.nav-links a').forEach(a => a.addEventListener('click', () => links.classList.remove('open')));
}

function initTheme() {
  $$('[data-split]').forEach(el => {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true" style="--i:${i}">${esc(w)}</span>`).join(' ');
  });

  const header = $('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('in'));
  }

  const quotes = $('#jp-quotes');
  if (quotes) {
    $$('.jp-quotes-nav button').forEach(btn => btn.addEventListener('click', () => {
      const card = quotes.querySelector('.jp-quote');
      const step = card ? card.offsetWidth + 24 : quotes.clientWidth;
      quotes.scrollBy({ left: step * Number(btn.dataset.dir), behavior: 'smooth' });
    }));
  }

  // Muted loops play only while on screen, and never under reduced motion
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loops = $$('.jp-showreel-media video');
  if (loops.length && !reduceMotion && 'IntersectionObserver' in window) {
    const vo = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.play().catch(() => {});
        else e.target.pause();
      });
    }, { threshold: 0.25 });
    loops.forEach(v => vo.observe(v));
  }

  initLightbox();
  initAwardVideo();
  initContactForm();

  // Close an open industry menu when clicking elsewhere
  document.addEventListener('click', e => {
    $$('.jp-chip-menu[open]').forEach(d => { if (!d.contains(e.target)) d.removeAttribute('open'); });
  });

  const year = $('#year');
  if (year) year.textContent = new Date().getFullYear();
}

function initLightbox() {
  const figs = $$('.jp-gallery figure, [data-lightbox]');
  if (!figs.length) return;
  const box = document.createElement('div');
  box.className = 'jp-lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Image viewer');
  box.innerHTML = '<img alt=""><button class="jp-lb-close" aria-label="Close">×</button>' +
    '<button class="jp-lb-prev" aria-label="Previous">←</button><button class="jp-lb-next" aria-label="Next">→</button>' +
    '<div class="jp-lb-count"></div>';
  document.body.appendChild(box);
  const img = $('img', box), count = $('.jp-lb-count', box);
  if (figs.length < 2) $$('.jp-lb-prev, .jp-lb-next, .jp-lb-count', box).forEach(el => el.hidden = true);
  let idx = 0;
  const show = i => {
    idx = (i + figs.length) % figs.length;
    const src = figs[idx].tagName === 'IMG' ? figs[idx] : $('img', figs[idx]);
    img.src = src.dataset.full || src.src;
    img.alt = src.alt;
    count.textContent = `${idx + 1} / ${figs.length}`;
  };
  const close = () => box.classList.remove('open');
  figs.forEach((f, i) => {
    f.tabIndex = 0;
    f.addEventListener('click', () => { show(i); box.classList.add('open'); });
    f.addEventListener('keydown', e => { if (e.key === 'Enter') { show(i); box.classList.add('open'); } });
  });
  $('.jp-lb-close', box).addEventListener('click', close);
  $('.jp-lb-prev', box).addEventListener('click', () => show(idx - 1));
  $('.jp-lb-next', box).addEventListener('click', () => show(idx + 1));
  box.addEventListener('click', e => { if (e.target === box) close(); });
  document.addEventListener('keydown', e => {
    if (!box.classList.contains('open')) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowLeft') show(idx - 1);
    if (e.key === 'ArrowRight') show(idx + 1);
  });
}

function initAwardVideo() {
  const modal = $('#award-video');
  if (!modal) return;
  const frame = $('iframe', modal);
  const open = () => { frame.src = 'https://player.vimeo.com/video/917562006?autoplay=1'; modal.classList.add('open'); };
  const close = () => { frame.src = ''; modal.classList.remove('open'); };
  $$('[data-award-video]').forEach(b => b.addEventListener('click', open));
  $('.jp-video-close', modal).addEventListener('click', close);
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal.classList.contains('open')) close(); });
}

// No form backend: compose the message in the visitor's email app, addressed to Julie
function initContactForm() {
  const form = $('#contact-form');
  if (!form) return;
  form.addEventListener('submit', e => {
    e.preventDefault();
    const d = new FormData(form);
    const name = `${d.get('first')} ${d.get('last')}`.trim();
    const subject = `Portfolio inquiry${d.get('type') ? ': ' + d.get('type') : ''} from ${name}`;
    const body = `${d.get('message')}\n\n${name}\n${d.get('email')}`;
    window.location.href = `mailto:juliedion1@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    $('.jp-form-note', form).textContent = "Your email app should open with the message ready. If it doesn't, email juliedion1@gmail.com directly.";
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavToggle();
});
