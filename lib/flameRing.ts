/**
 * Real-looking animated flame ring (framework-free canvas engine).
 * Dense soft particles, additive blending, colour that cools white-lilac -> violet -> indigo,
 * tongues that rise and taper, flicker, and a pulsing bloom along the ring.
 */
type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; seed: number; tall: number };

/** Playback speed of the flames (1 = normal). Lower is slower and calmer. */
const SPEED = 0.5;
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

function sprite(stops: [number, string][]) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  stops.forEach(([o, col]) => gr.addColorStop(o, col));
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return c;
}

export function startFlameRing(wrapEl: HTMLElement, canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const reduce = false; // always animate: the flames are the centrepiece, even if the OS has animation effects switched off

  // colour stages from the hot base of the flame to cooling smoke
  const stages = [
    sprite([[0, 'rgba(228,255,234,1)'], [0.3, 'rgba(150,255,180,.85)'], [0.65, 'rgba(60,220,120,.3)'], [1, 'rgba(30,180,90,0)']]),
    sprite([[0, 'rgba(120,250,160,.95)'], [0.4, 'rgba(40,210,110,.6)'], [1, 'rgba(20,170,80,0)']]),
    sprite([[0, 'rgba(30,190,100,.8)'], [0.5, 'rgba(16,140,80,.42)'], [1, 'rgba(10,110,60,0)']]),
    sprite([[0, 'rgba(10,110,70,.5)'], [0.5, 'rgba(8,80,55,.2)'], [1, 'rgba(4,50,35,0)']]),
  ];

  let W = 0, H = 0, PAD = 0, dpr = 1, a = 0, b = 0, cx = 0, cy = 0, n = 2.5, perim = 1000;
  let parts: P[] = [];
  let raf = 0, running = false, visible = true, last = 0, t = 0;

  const pt = (th: number) => {
    const c = Math.cos(th), s = Math.sin(th), e = 2 / n;
    const x = a * Math.sign(c) * Math.pow(Math.abs(c), e);
    const y = b * Math.sign(s) * Math.pow(Math.abs(s), e);
    let nx = Math.sign(x) * Math.pow(Math.abs(x / a), n - 1) / a;
    let ny = Math.sign(y) * Math.pow(Math.abs(y / b), n - 1) / b;
    const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
    return { x: cx + x, y: cy + y, nx, ny };
  };

  // travelling pseudo-noise around the ring: where it is high, flames shoot taller
  const field = (th: number) =>
    clamp(0.5 + 0.26 * Math.sin(th * 11 + t * 2.1) + 0.2 * Math.sin(th * 17 - t * 1.6 + 2) + 0.24 * Math.sin(th * 5 + t * 0.9));

  const spawn = () => {
    let th = 0, p = pt(0), f = 0.5;
    for (let k = 0; k < 6; k++) {
      th = Math.random() * Math.PI * 2;
      p = pt(th);
      f = field(th);
      const topW = 0.3 + 0.7 * clamp(-p.ny + 0.35); // fewer flames at the bottom
      if (Math.random() < topW * (0.25 + 0.75 * f)) break;
    }
    const up = clamp(-p.ny), down = clamp(p.ny);
    const k = clamp(Math.min(W, H) / 800, 0.5, 1.4);
    const tall = 0.35 + 1.15 * Math.pow(f, 1.4);
    const rise = (95 + up * 120) * tall * k * rand(0.8, 1.15) * (1 - 0.55 * down);
    const life = rand(0.9, 1.5) * (0.45 + 0.55 * tall) * (1 - 0.6 * down);
    parts.push({
      x: p.x + rand(-7, 7), y: p.y + rand(-4, 4),
      vx: p.nx * rand(4, 20), vy: -rise,
      life, max: life, size: rand(46, 84) * k, seed: Math.random() * 100, tall,
    });
  };

  const step = (dt: number) => {
    t += dt;
    let emit = perim * 0.8 * dt + Math.random();
    while (emit-- > 1 && parts.length < 3200) spawn();
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.life -= dt;
      if (p.life <= 0) { parts[i] = parts[parts.length - 1]; parts.pop(); continue; }
      const u = 1 - p.life / p.max;
      p.vx += Math.sin(t * 3.4 + p.seed + p.y * 0.014) * 70 * u * dt; // licking sway grows toward the tip
      p.vx *= 1 - 1.4 * dt;
      p.vy *= 1 - 0.35 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
  };

  const frame = () => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W + PAD * 2, H + PAD * 2);
    ctx.globalCompositeOperation = 'lighter';

    // flickering bloom along the ring
    const fl = 0.86 + 0.07 * Math.sin(t * 7.1) + 0.05 * Math.sin(t * 13.7) + 0.04 * Math.sin(t * 2.3);
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 180; i++) { const q = pt((i / 180) * Math.PI * 2); if (i) { ctx.lineTo(q.x, q.y); } else { ctx.moveTo(q.x, q.y); } }
    ctx.closePath();
    ctx.shadowColor = 'rgba(40,220,120,1)';
    ctx.shadowBlur = 90 * fl; ctx.strokeStyle = `rgba(20,160,80,${0.22 * fl})`; ctx.lineWidth = 26; ctx.stroke();
    ctx.shadowBlur = 36 * fl; ctx.strokeStyle = `rgba(50,220,130,${0.6 * fl})`; ctx.lineWidth = 6; ctx.stroke();
    ctx.shadowBlur = 12; ctx.strokeStyle = `rgba(225,255,235,${0.9 * fl})`; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.restore();

    for (const p of parts) {
      const u = 1 - p.life / p.max;
      const sp = u < 0.16 ? stages[0] : u < 0.4 ? stages[1] : u < 0.72 ? stages[2] : stages[3];
      const taper = 1 - u * 0.78;
      const w = p.size * taper;
      const h = p.size * (1.15 + p.tall * 0.8) * (1 - u * 0.45);
      const env = clamp(u * 7) * (1 - u * u); // quick fade-in, long fade-out
      ctx.globalAlpha = clamp(env * (u < 0.16 ? 0.09 : u < 0.4 ? 0.15 : 0.2));
      const ang = Math.atan2(p.vy, p.vx) + Math.PI / 2, co = Math.cos(ang) * dpr, si = Math.sin(ang) * dpr;
      ctx.setTransform(co, si, -si, co, p.x * dpr, p.y * dpr);
      ctx.drawImage(sp, -w / 2, -h / 2, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  };

  const resize = () => {
    const r = wrapEl.getBoundingClientRect();
    W = r.width; H = r.height;
    PAD = Math.max(130, Math.min(W, H) * 0.4);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round((W + PAD * 2) * dpr);
    canvas.height = Math.round((H + PAD * 2) * dpr);
    canvas.style.width = W + PAD * 2 + 'px';
    canvas.style.height = H + PAD * 2 + 'px';
    canvas.style.left = -PAD + 'px';
    canvas.style.top = -PAD + 'px';
    cx = W / 2 + PAD; cy = H / 2 + PAD;
    a = (W / 2) * 0.99; b = (H / 2) * 0.99;
    n = W < 900 ? 4 : 2.7;
    perim = 2 * Math.PI * Math.sqrt((a * a + b * b) / 2);
    if (reduce) { parts = []; for (let i = 0; i < 160; i++) step(1 / 60); frame(); }
  };

  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016) * SPEED; // slow-motion burn
    last = now;
    step(dt); frame();
    raf = requestAnimationFrame(loop);
  };
  const start = () => { if (running || reduce || !visible || document.hidden) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  const ro = new ResizeObserver(() => resize());
  ro.observe(wrapEl);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); }, { rootMargin: '120px' });
  io.observe(wrapEl);
  const vis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', vis);

  resize();
  if (!reduce) for (let i = 0; i < 100; i++) step(1 / 60); // pre-warm so the ring is already burning on first paint
  start();
  return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis); };
}
