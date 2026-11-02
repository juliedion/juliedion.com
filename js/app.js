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

  initReelControls();
  initHeroShader();

  // Muted loops play only while on screen, and never under reduced motion
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loops = $$('.jp-showreel-media video');
  if (loops.length && !reduceMotion && 'IntersectionObserver' in window) {
    const vo = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) { if (!e.target.dataset.userPaused) e.target.play().catch(() => {}); }
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

// "Now showing" label that follows the reel's scenes, plus a pause/play toggle
function initReelControls() {
  const video = $('.jp-showreel-media video');
  if (!video) return;
  const chip = $('.jp-reel-chip'), toggle = $('.jp-reel-toggle');
  const scenes = JSON.parse(video.dataset.scenes || '[]');
  const len = parseFloat(video.dataset.sceneLength) || 2.2;
  let shown = 0, userPaused = false;
  video.dataset.userPaused = '';
  if (chip && scenes.length) video.addEventListener('timeupdate', () => {
    const i = Math.floor(video.currentTime / len) % scenes.length;
    if (i === shown) return;
    shown = i;
    chip.href = scenes[i][1];
    $('strong', chip).textContent = scenes[i][0];
    chip.classList.remove('swap'); void chip.offsetWidth; chip.classList.add('swap');
  });
  if (!toggle) return;
  const icon = $('span', toggle);
  const sync = () => {
    const playing = !video.paused;
    icon.className = playing ? 'jp-icon-pause' : 'jp-icon-play';
    toggle.setAttribute('aria-label', playing ? 'Pause the reel' : 'Play the reel');
  };
  toggle.addEventListener('click', () => {
    userPaused = !video.paused;
    video.dataset.userPaused = userPaused ? '1' : '';
    userPaused ? video.pause() : video.play().catch(() => {});
  });
  video.addEventListener('play', sync);
  video.addEventListener('pause', sync);
  sync();
}

// Hero background: a slow navy-to-teal wave gradient drawn with WebGL.
// Falls back to the CSS gradient when WebGL is unavailable.
const HERO_FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
const float SEED = 32.0, SPEED = 0.24, FREQ_X = 0.9, FREQ_Y = 6.0, ANGLE = 21.0;
const float AMP = 1.33, SOFT = 1.09, BLEND = 0.57;
const vec3 C0 = vec3(0.0, 0.125, 0.231);    // #00203b
const vec3 C1 = vec3(0.051, 0.498, 0.549);  // #0d7f8c
const vec3 C2 = vec3(0.012, 0.075, 0.149);  // #031326
const vec3 C3 = vec3(0.027, 0.671, 0.714);  // #07abb6

mat2 rot(float a) { float s = sin(a), c = cos(a); return mat2(c, -s, s, c); }
vec2 hash(vec2 p) {
  p = vec2(dot(p, vec2(2127.1 + SEED * 13.37, 81.17 + SEED * 7.31)),
           dot(p, vec2(1269.5 + SEED * 11.13, 283.37 + SEED * 5.79)));
  return fract(sin(p) * (43758.5453 + SEED * 1.618));
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  float n = mix(mix(dot(-1.0 + 2.0 * hash(i), f),
                    dot(-1.0 + 2.0 * hash(i + vec2(1, 0)), f - vec2(1, 0)), u.x),
                mix(dot(-1.0 + 2.0 * hash(i + vec2(0, 1)), f - vec2(0, 1)),
                    dot(-1.0 + 2.0 * hash(i + vec2(1, 1)), f - vec2(1, 1)), u.x), u.y);
  return 0.5 + 0.5 * n;
}
float seedF(float b) { return b * (1.0 + 0.5 * sin(SEED * 3.17 + b)); }
vec2 warp(vec2 uv, float t) {
  vec2 r = rot(radians(ANGLE + sin(SEED * 2.73) * 30.0)) * uv;
  float fx = seedF(FREQ_X), fy = seedF(FREQ_Y);
  float a = fy * r.y - sin(r.x * fx + r.y - t + fract(sin(SEED * 7.19) * 437.58) * 6.2832);
  a += sin(SEED * 1.23) * 0.5 * sin(r.x * fx * 2.0 + r.y * 0.5 + t * 0.7 + fract(cos(SEED * 3.41) * 291.37) * 6.2832);
  a = smoothstep(cos(a) * SOFT, sin(a) * SOFT + 3.0, cos(a - fy * r.y) - sin(a - fx * r.x)) * AMP;
  return cos(a) * uv + sin(a) * vec2(-uv.y, uv.x);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float ratio = u_res.x / u_res.y, t = u_time * SPEED;
  vec2 tuv = uv - 0.5;
  float deg = noise(vec2(t * 0.1, tuv.x * tuv.y) + vec2(sin(SEED * 4.37), cos(SEED * 5.91)) * 100.0);
  tuv.y /= ratio;
  tuv *= rot(radians((deg - 0.5) * 720.0 + 180.0));
  tuv.y *= ratio;
  vec2 uv2 = (gl_FragCoord.xy * 2.0 - u_res) / (u_res.x + u_res.y) * 2.0;
  uv2 *= rot(fract(sin(SEED * 5.63) * 173.29) * 6.2832);
  vec2 b = mix(tuv, warp(uv2, t) * 0.5, BLEND);
  vec3 l1 = mix(C0, C2, smoothstep(-0.3, 0.3, (b * rot(radians(-5.0 + sin(SEED * 1.83) * 20.0))).x));
  vec3 l2 = mix(C3, C1, smoothstep(-0.3, 0.3, (b * rot(radians(10.0 + cos(SEED * 2.47) * 20.0))).x));
  vec3 col = mix(l1, l2, 1.0 - smoothstep(-0.3, 0.3, b.y));
  col = mix(col, col * col + 0.5 * sqrt(col), 0.3);
  gl_FragColor = vec4(col, 1.0);
}`;

function initHeroShader() {
  const hero = $('.jp-hero');
  const canvas = hero && $('.jp-hero-shader', hero);
  if (!canvas) return;
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = compile(gl.VERTEX_SHADER, 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }');
  const fs = compile(gl.FRAGMENT_SHADER, HERO_FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');

  // The gradient is soft, so half resolution looks identical and costs a quarter
  const resize = () => {
    const w = Math.max(1, Math.round(canvas.clientWidth * 0.5));
    const h = Math.max(1, Math.round(canvas.clientHeight * 0.5));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRes, w, h);
  };
  const draw = t => { resize(); gl.uniform1f(uTime, t); gl.drawArrays(gl.TRIANGLES, 0, 3); };

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let elapsed = 0, last = 0, raf = 0, visible = true;
  const tick = now => {
    if (last) elapsed += Math.min(now - last, 100) / 1000;
    last = now;
    draw(elapsed);
    raf = requestAnimationFrame(tick);
  };
  const start = () => { if (!raf && !reduceMotion && visible && !document.hidden) { last = 0; raf = requestAnimationFrame(tick); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  draw(0);
  hero.classList.add('has-shader');
  window.addEventListener('resize', () => { if (!raf) draw(elapsed); });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(hero);
  }
  start();
}
