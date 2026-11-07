// Canvas effects for the incense burner: the sticks, their embers and rising smoke.
//
// The canvas covers a region of the photo given in % of the full photo, so it
// scales and moves with the scene. Smoke is a stream of soft, pre-rendered
// puffs that start thin and laminar at the tip, then widen, drift and fade.
// While a stick burns, a grey ash cap slowly builds on its tip; now and then it
// breaks off, drops and settles on the ash bed.
// The loop is capped at 30 FPS and only runs while its scene is on screen.

const FRAME_MS = 1000 / 30;
const MAX_PARTICLES = 900;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

let puffSprite, emberSprite;
function sprites() {
  if (puffSprite) return;
  puffSprite = radialSprite(64, [[0, 'rgba(226,229,236,1)'], [0.45, 'rgba(218,222,230,0.5)'], [1, 'rgba(210,214,224,0)']]);
  emberSprite = radialSprite(32, [[0, 'rgba(255,236,190,1)'], [0.25, 'rgba(255,150,60,0.9)'], [0.6, 'rgba(255,90,20,0.25)'], [1, 'rgba(255,60,0,0)']]);
}
function radialSprite(size, stops) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) gr.addColorStop(o, col);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export class IncenseLayer {
  /**
   * @param {HTMLElement} parent  the scene's overlay layer (sized like the photo)
   * @param {number[]} region     [x, y, w, h] in % of the photo
   * @param {{roofY:number, centerX:number}} opts  smoke spreads out under the burner roof
   */
  constructor(parent, region, opts) {
    sprites();
    this.region = region;
    this.opts = opts;
    this.sticks = [];
    this.particles = [];
    this.flakes = [];                 // falling ash
    this.running = false;
    this.last = 0;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'fx-canvas';
    const [x, y, w, h] = region;
    Object.assign(this.canvas.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
    parent.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');

    // Layout size (unaffected by the scene's zoom transitions).
    new ResizeObserver(([e]) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.max(1, Math.round(e.contentRect.width * dpr));
      this.canvas.height = Math.max(1, Math.round(e.contentRect.height * dpr));
      this.particles.length = 0;
      this.draw(performance.now());
    }).observe(this.canvas);
  }

  // Pixels per 1 % of photo width / height.
  get uW() { return this.canvas.width / this.region[2]; }
  get uH() { return this.canvas.height / this.region[3]; }
  px(x) { return (x - this.region[0]) * this.uW; }
  py(y) { return (y - this.region[1]) * this.uH; }

  /**
   * sticks: [{ x, y, angle (deg), length (% of photo height), litAt (ms epoch), burnMs }]
   */
  setSticks(sticks) {
    const now = Date.now();
    this.sticks = sticks.map((s) => ({
      ...s,
      rad: (s.angle * Math.PI) / 180,
      appearAt: s.litAt > now - 1500 ? performance.now() : 0,
      emitDebt: 0,
      ashSince: Math.max(s.litAt, now - Math.random() * 20e3),   // when the current ash cap started
      ashCycle: ashCycle(),
    }));
    this.draw(performance.now());
    if (this.active) this.start();
  }

  setActive(active) {
    this.active = active;
    if (active) this.start(); else this.stop();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    const tick = (t) => {
      if (!this.running) return;
      if (t - this.last >= FRAME_MS - 2) {
        const dt = Math.min(0.1, (t - this.last) / 1000);
        this.last = t;
        this.update(dt, t);
        this.draw(t);
        if (!this.isAlive()) { this.running = false; return; }
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  burning(s, now = Date.now()) { return now - s.litAt < s.burnMs; }
  isAlive() { return this.particles.length > 0 || this.flakes.length > 0 || this.sticks.some((s) => this.burning(s)); }

  /** Length of the ash cap on a burning tip, in px: grows until it drops. */
  ashLength(s, g, now) {
    const grown = Math.min(1, (now - s.ashSince) / s.ashCycle);
    return Math.min(g.coated, this.uH * (0.12 + 0.6 * grown));
  }

  /** Geometry of one stick right now, in canvas px. */
  stickGeom(s, now = Date.now()) {
    const L = s.length * this.uH;
    const progress = Math.min(1, Math.max(0, (now - s.litAt) / s.burnMs));
    const handle = L * 0.3;                         // red-dyed bamboo handle
    const coated = L * 0.7 * (1 - progress);        // incense paste that burns down
    const dx = Math.sin(s.rad), dy = -Math.cos(s.rad);
    const bx = this.px(s.x), by = this.py(s.y);
    return {
      bx, by, dx, dy, handle, coated, progress,
      tipX: bx + dx * (handle + coated), tipY: by + dy * (handle + coated),
      width: Math.max(1.2, this.uW * 0.1),
    };
  }

  update(dt, t) {
    const now = Date.now();
    const uW = this.uW, uH = this.uH;
    // Emit from every burning stick (after the ember has caught).
    for (const s of this.sticks) {
      if (!this.burning(s, now)) continue;
      if (s.appearAt && t - s.appearAt < 900) continue;
      const g = this.stickGeom(s, now);
      const rate = reduceMotion ? 8 : 24;           // puffs per second (dense enough to read as a thread)
      s.emitDebt += rate * dt;
      if (this.particles.length > MAX_PARTICLES) s.emitDebt = 0;   // safety cap on very large screens
      while (s.emitDebt >= 1) {
        s.emitDebt -= 1;
        this.particles.push({
          x: g.tipX + (Math.random() - 0.5) * g.width,
          y: g.tipY - Math.random() * uH * 0.2,
          age: 0,
          life: 3.8 + Math.random() * 1.8,
          size: g.width * (1.1 + Math.random() * 0.5),
          grow: uW * (0.75 + Math.random() * 0.6),
          rise: uH * (3.6 + Math.random() * 1.6),
          peak: 0.09 + Math.random() * 0.05,
          phase: Math.random() * Math.PI * 2,
          freq: 0.6 + Math.random() * 0.5,
        });
      }
    }
    // Move: laminar near the tip, wavering and spreading as it ages,
    // and pushed sideways once it reaches the underside of the burner roof.
    const roof = this.py(this.opts.roofY);
    const cx = this.px(this.opts.centerX);
    const time = t / 1000;
    // Ash caps that have grown long enough break off and fall.
    for (const s of this.sticks) {
      if (!this.burning(s, now) || now - s.ashSince < s.ashCycle) continue;
      const g = this.stickGeom(s, now);
      const len = this.ashLength(s, g, now);
      this.flakes.push({
        x: g.tipX - g.dx * len * 0.5, y: g.tipY - g.dy * len * 0.5,
        vx: (Math.random() - 0.5) * uW * 0.6, vy: 0,
        rot: s.rad, spin: (Math.random() - 0.5) * 6,
        len: len * 0.9, w: g.width * 1.05,
        floor: this.py(s.y) - Math.random() * uH * 0.4,   // the ash bed around the stick's base
        landed: 0, alpha: 1,
      });
      s.ashSince = now;
      s.ashCycle = ashCycle();
    }
    for (let i = this.flakes.length - 1; i >= 0; i--) {
      const f = this.flakes[i];
      if (!f.landed) {
        f.vy += uH * 26 * dt;                            // gravity
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += f.spin * dt;
        if (f.y >= f.floor) { f.y = f.floor; f.landed = t; f.rot = Math.PI / 2 + (Math.random() - 0.5) * 0.6; }
      } else {
        f.alpha = 1 - (t - f.landed) / 2500;            // settles into the ash, fades
        if (f.alpha <= 0) this.flakes.splice(i, 1);
      }
    }

    const ps = this.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      p.age += dt;
      if (p.age >= p.life) { ps.splice(i, 1); continue; }
      const k = p.age / p.life;
      const sway = Math.sin(time * p.freq + p.phase + p.y * 0.015) * uW * 0.9 * k * k;
      const nearRoof = smooth(roof + uH * 9, roof, p.y);
      p.x += (sway + Math.sign(p.x - cx || 1) * nearRoof * uW * 2.2 + uW * 0.08) * dt;
      p.y -= p.rise * (1 - 0.75 * nearRoof) * dt;
      p.size += p.grow * dt * (0.4 + k);
      // A fresh thread is thin but dense; it thins out as it widens and drifts.
      const thread = 1 + 2.6 * (1 - smooth(0.02, 0.4, k));
      p.alpha = Math.min(0.5, p.peak * thread) * smooth(0, 0.05, k) * Math.pow(1 - k, 1.3) * (1 - 0.65 * nearRoof);
    }
  }

  draw(t) {
    const ctx = this.ctx;
    const { width: W, height: H } = this.canvas;
    ctx.clearRect(0, 0, W, H);
    const now = Date.now();

    // Sticks
    for (const s of this.sticks) {
      const g = this.stickGeom(s, now);
      const fade = s.appearAt ? Math.min(1, (t - s.appearAt) / 500) : 1;
      ctx.globalAlpha = fade;
      ctx.lineCap = 'butt';
      ctx.lineWidth = g.width;
      // handle
      ctx.strokeStyle = '#a3252a';
      line(ctx, g.bx, g.by, g.bx + g.dx * g.handle, g.by + g.dy * g.handle);
      // coated part, with a faint lit edge for roundness
      if (g.coated > 0.5) {
        const hx = g.bx + g.dx * g.handle, hy = g.by + g.dy * g.handle;
        ctx.strokeStyle = '#5a2c22';
        line(ctx, hx, hy, g.tipX, g.tipY);
        ctx.lineWidth = Math.max(0.5, g.width * 0.35);
        ctx.strokeStyle = 'rgba(190,120,95,0.45)';
        line(ctx, hx - g.width * 0.2, hy, g.tipX - g.width * 0.2, g.tipY);
        ctx.lineWidth = g.width;
      }
      // short grey ash cap on a burning tip
      if (this.burning(s, now)) {
        const ash = this.ashLength(s, g, now);
        ctx.strokeStyle = '#8e8a86';
        line(ctx, g.tipX, g.tipY, g.tipX - g.dx * ash, g.tipY - g.dy * ash);
      }
    }
    ctx.globalAlpha = 1;

    // Falling ash
    ctx.lineCap = 'round';
    for (const f of this.flakes) {
      ctx.globalAlpha = Math.max(0, f.alpha);
      ctx.strokeStyle = '#a19c96';
      ctx.lineWidth = f.w;
      const hx = Math.sin(f.rot) * f.len / 2, hy = -Math.cos(f.rot) * f.len / 2;
      line(ctx, f.x - hx, f.y - hy, f.x + hx, f.y + hy);
    }
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;

    // Smoke
    for (const p of this.particles) {
      if (p.alpha <= 0.003) continue;
      ctx.globalAlpha = p.alpha;
      ctx.drawImage(puffSprite, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    // Embers (additive light)
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.sticks) {
      if (!this.burning(s, now)) continue;
      const g = this.stickGeom(s, now);
      const catchUp = s.appearAt ? smooth(250, 1100, t - s.appearAt) : 1;
      const flicker = reduceMotion ? 0.9 : 0.78 + 0.22 * Math.sin(t / 90 + s.x * 7) * Math.sin(t / 37 + s.y);
      const r = g.width * 3.2;
      ctx.globalAlpha = catchUp * flicker;
      ctx.drawImage(emberSprite, g.tipX - r, g.tipY - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }
}

/** Each ash cap lasts 25–55 s before it drops. */
function ashCycle() {
  return 25e3 + Math.random() * 30e3;
}

function line(ctx, x1, y1, x2, y2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
