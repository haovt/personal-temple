// Ritual interactions: incense, candles, lotus offering, prayer, wooden fish,
// bowl bell, great bell and fortune sticks. State lives in memory for the visit
// only: every page load starts the temple fresh.
//
// Overlay positions come from data/rituals.json, in % of each full photo.

import { IncenseLayer } from './particles.js';
import { FortuneTeller } from './fortune.js';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const MINUTE = 60e3;

export class Rituals {
  constructor(cfg, audio, fortunes) {
    this.cfg = cfg;
    this.audio = audio;
    this.fortunes = fortunes;
    this.views = new Map();
    this.state = { incense: [], candles: {}, lotus: [], prayers: 0 };
  }

  // ------------------------------------------------------------ lifecycle

  created(view) {
    this.views.set(view.scene.id, view);
    const setup = {
      'main-hall': () => this.#setupHall(view),
      incense: () => this.#setupIncense(view),
      bell: () => this.#setupBell(view),
      fortune: () => { this.fortune = new FortuneTeller(view, this.cfg.fortune, this.fortunes, this.audio, whisper); },
    }[view.scene.id];
    setup?.();
  }

  enter(view) {
    if (view.scene.id === 'incense') { this.#refreshIncense(); this.incense.setActive(true); }
  }

  leave(view) {
    if (view.scene.id === 'incense') this.incense.setActive(false);
    if (view.scene.id === 'main-hall') this.#closePrayer(true);
    if (view.scene.id === 'fortune') this.fortune?.reset();
  }

  handle({ hotspot, view, el, ev }) {
    const fn = {
      candle: () => this.#toggleCandles(hotspot.id),
      flowers: () => this.#offerLotus(),
      pray: () => this.#openPrayer(view),
      'wooden-fish': () => this.#knock(view, hotspot),
      'bowl-bell': () => this.#bowlBell(view, hotspot),
      incense: () => this.#lightIncense(),
      'ring-bell': () => this.#ringBell(view, ev),
      fortune: () => this.fortune?.draw(),
    }[hotspot.action];
    fn?.();
  }

  // ------------------------------------------------------------ main hall

  #setupHall(view) {
    const layer = view.overlays;

    // Candle flames on both candelabras
    this.candleSets = {};
    for (const [id, set] of Object.entries(this.cfg.candles)) {
      if (!set.flames) continue;
      const group = el('div', 'candle-set');
      const glow = el('div', 'candle-glow');
      place(glow, set.glow[0], set.glow[1]);
      group.append(glow);
      set.flames.forEach(([x, y], i) => {
        const f = el('div', 'flame');
        place(f, x, y);
        f.style.width = `${this.cfg.candles.flameWidth}%`;
        f.style.setProperty('--d', `${(i * 0.37) % 1.3}s`);   // de-synchronise the flicker
        f.style.setProperty('--i', i);
        group.append(f);
      });
      layer.append(group);
      this.candleSets[id] = group;
    }

    // Lotus offerings (keyed from the photo's black background once, then reused)
    this.lotusEls = [];
    this.lotusReady = keyBlackBackground(this.cfg.lotus.image, this.cfg.lotus.crop).then((url) => {
      this.lotusUrl = url;
    });

    // Dim layer and halo used while praying
    const [hx, hy] = this.cfg.pray.halo;
    this.prayDim = el('div', 'pray-dim');
    this.prayDim.style.setProperty('--hx', `${hx}%`);
    this.prayDim.style.setProperty('--hy', `${hy}%`);
    this.prayHalo = el('div', 'pray-halo');
    place(this.prayHalo, hx, hy);
    this.prayHalo.style.width = `${this.cfg.pray.haloWidth}%`;
    layer.append(this.prayDim, this.prayHalo);
  }

  #toggleCandles(id) {
    const group = this.candleSets[id];
    if (!group) return;
    const lit = !group.classList.contains('lit');
    group.classList.toggle('lit', lit);
    this.audio?.play(lit ? 'candle' : 'candle-out');
    this.state.candles[id] = lit;
    whisper(lit ? 'Đã thắp nến' : 'Đã tắt nến');
  }

  async #offerLotus() {
    await this.lotusReady;
    const { slots, wiltMinutes } = this.cfg.lotus;
    const taken = new Set(this.state.lotus.map((l) => l.slot));
    let slot = slots.findIndex((_, i) => !taken.has(i));
    let message = 'Dâng một đóa sen';
    if (slot < 0) {
      // The vase is full: replace the oldest lotus once it has begun to wilt.
      const oldest = [...this.state.lotus].sort((a, b) => a.at - b.at)[0];
      if (Date.now() - oldest.at < (wiltMinutes / 3) * MINUTE) { whisper('Bình hoa đã đầy, hoa vẫn còn tươi'); return; }
      slot = oldest.slot;
      this.state.lotus = this.state.lotus.filter((l) => l !== oldest);
      this.lotusEls[slot]?.remove();
      message = 'Thay một đóa sen tươi';
    }
    this.state.lotus.push({ slot, at: Date.now() });
    this.#addLotusEl(slot);
    this.audio?.play('flowers');
    whisper(message);
  }

  #addLotusEl(slot) {
    const s = this.cfg.lotus.slots[slot];
    const w = s.w || this.cfg.lotus.width;
    const img = el('img', 'lotus');
    img.src = this.lotusUrl;
    img.alt = '';
    img.style.left = `${s.x}%`;
    img.style.top = `${s.y}%`;
    img.style.width = `${w}%`;
    img.style.setProperty('--rot', `${s.rot || 0}deg`);
    img.style.setProperty('--flip', s.flip ? -1 : 1);
    // Wilting: over the next minutes the flower slowly loses colour and droops
    // a little further the way it already leans (see .lotus.wilting in temple.css).
    img.style.setProperty('--droop-to', `${Math.sign(s.rot || 0.5) * 9}deg`);
    img.style.setProperty('--wilt', `${this.cfg.lotus.wiltMinutes * 60}s`);
    this.views.get('main-hall').overlays.append(img);
    this.lotusEls[slot] = img;
    setTimeout(() => img.classList.add('wilting'), 2000);   // after the fade-in
  }

  // --- prayer

  #openPrayer(view) {
    if (this.prayPanel) return;
    view.el.classList.add('praying');
    document.body.classList.add('modal-open');

    const panel = el('div', 'pray-panel');
    panel.innerHTML = `
      <p class="pray-invocation">Nam mô Bổn Sư Thích Ca Mâu Ni Phật</p>
      <div class="pray-actions">
        <button type="button" class="primary">Lễ Phật</button>
        <button type="button" class="quiet">Thôi</button>
      </div>
      <p class="pray-step" aria-live="polite"></p>`;
    document.body.append(panel);
    requestAnimationFrame(() => panel.classList.add('show'));
    this.prayPanel = panel;

    const [bow, cancel] = panel.querySelectorAll('button');
    bow.addEventListener('click', () => this.#bow(view));
    cancel.addEventListener('click', () => this.#closePrayer());
    this.prayKeys = (e) => {
      if (e.key === 'Escape' && !this.bowing) { e.preventDefault(); this.#closePrayer(); }
    };
    window.addEventListener('keydown', this.prayKeys, true);
    setTimeout(() => bow.focus({ preventScroll: true }), 300);
  }

  /** A wish chosen at random, never the same one twice in a row. */
  #randomWish() {
    const list = this.cfg.pray.wishes;
    let i;
    do { i = Math.floor(Math.random() * list.length); } while (list.length > 1 && i === this.lastWish);
    this.lastWish = i;
    return list[i];
  }

  async #bow(view) {
    if (this.bowing) return;
    const wish = this.#randomWish();
    this.bowing = true;
    const panel = this.prayPanel;
    panel.classList.add('bowing');
    const step = panel.querySelector('.pray-step');
    for (const word of ['Lạy thứ nhất', 'Lạy thứ hai', 'Lạy thứ ba']) {
      if (!this.prayPanel) break;
      step.textContent = word;
      view.el.classList.remove('bow');
      void view.el.offsetWidth;
      view.el.classList.add('bow');
      this.audio?.play('bowl-bell', { gain: 0.55 });   // the bowl bell marks each bow
      await wait(2200);
    }
    view.el.classList.remove('bow');
    if (!this.prayPanel) { this.bowing = false; return; }
    this.state.prayers += 1;
    this.#releaseWish(view, wish);
    step.textContent = wish;
    await wait(3200);
    this.bowing = false;
    this.#closePrayer();
  }

  #releaseWish(view, text) {
    const [hx, hy] = this.cfg.pray.halo;
    const w = el('div', 'wish-light');
    w.textContent = text;
    place(w, hx, hy - 4);
    view.overlays.append(w);
    w.addEventListener('animationend', () => w.remove(), { once: true });
  }

  #closePrayer(immediate = false) {
    const panel = this.prayPanel;
    if (!panel) return;
    this.prayPanel = null;
    this.bowing = false;
    window.removeEventListener('keydown', this.prayKeys, true);
    document.body.classList.remove('modal-open');
    this.views.get('main-hall')?.el.classList.remove('praying', 'bow');
    panel.classList.remove('show');
    setTimeout(() => panel.remove(), immediate ? 0 : 600);
  }

  // --- wooden fish & bowl bell

  #knock(view, h) {
    this.audio?.play('wooden-fish', { rate: 0.97 + Math.random() * 0.06 });
    const [x, y, w, hh] = h.rect;
    const k = el('div', 'knock-glow');
    place(k, x + w / 2, y + hh / 2);
    k.style.width = `${w * 1.4}%`;
    view.overlays.append(k);
    k.addEventListener('animationend', () => k.remove(), { once: true });
  }

  #bowlBell(view, h) {
    this.audio?.play('bowl-bell');
    const [x, y, w, hh] = h.rect;
    for (let i = 0; i < 3; i++) {
      const r = el('div', 'sound-ring');
      place(r, x + w / 2, y + hh * 0.35);
      r.style.width = `${w * 0.9}%`;
      r.style.animationDelay = `${i * 0.45}s`;
      view.overlays.append(r);
      r.addEventListener('animationend', () => r.remove(), { once: true });
    }
  }

  // ------------------------------------------------------------ incense

  #setupIncense(view) {
    // Region covering the sticks and the smoke column, up to the burner roof.
    this.incense = new IncenseLayer(view.overlays, [30, 28, 42, 48], { roofY: 39, centerX: 51 });
    this.#refreshIncense();
  }

  #stickList() {
    const c = this.cfg.incense;
    const out = [];
    for (const g of this.state.incense) {
      const slot = c.groups[g.slot];
      for (let k = 0; k < 3; k++) {
        out.push({
          x: slot.x + (k - 1) * c.spread,
          y: slot.y + (k === 1 ? 0 : 0.15),
          angle: (k - 1) * c.fan + (slot.lean || 0),
          length: c.length * (k === 1 ? 1 : 0.97),
          litAt: g.litAt + k * 120,
          burnMs: c.burnMinutes * 60e3,
        });
      }
    }
    return out;
  }

  #refreshIncense() {
    this.incense?.setSticks(this.#stickList());
  }

  #lightIncense() {
    const c = this.cfg.incense;
    const now = Date.now();
    const burnMs = c.burnMinutes * 60e3;
    const burning = (g) => now - g.litAt < burnMs;
    // Use an empty place, or the place whose incense has burnt out the longest.
    let slot = c.groups.findIndex((_, i) => !this.state.incense.some((g) => g.slot === i));
    if (slot < 0) {
      const spent = this.state.incense.filter((g) => !burning(g)).sort((a, b) => a.litAt - b.litAt)[0];
      if (!spent) { whisper('Hương vẫn đang cháy'); return; }
      slot = spent.slot;
    }
    this.state.incense = this.state.incense.filter((g) => g.slot !== slot);
    this.state.incense.push({ slot, litAt: now });
    this.#refreshIncense();
    this.audio?.play('incense');
    whisper('Thắp ba nén hương');
  }

  // ------------------------------------------------------------ great bell

  #setupBell(view) {
    const b = this.cfg.bell;
    const cut = el('div', 'bell-cut');
    cut.style.clipPath = `polygon(${b.outline.map(([x, y]) => `${x}% ${y}%`).join(',')})`;
    cut.style.transformOrigin = `${b.pivot[0]}% ${b.pivot[1]}%`;
    const img = el('img', 'photo');
    img.alt = '';
    cut.append(img);
    view.overlays.append(cut);
    this.bell = { cut, img, view };
  }

  async #ringBell(view, ev) {
    const bell = this.bell;
    const now = performance.now();
    if (bell.until && now < bell.until - 3000) return;    // let it settle a little between strikes
    bell.img.src = view.img.src;                            // same photo, same resolution
    this.audio?.play('great-bell', { rate: 0.99 + Math.random() * 0.02 });
    bell.cut.classList.add('moving');

    // Ripples from where the bell was struck (centre of the bell for keyboard use).
    const box = view.plate.getBoundingClientRect();
    const px = ev?.clientX ? ((ev.clientX - box.left) / box.width) * 100 : 51;
    const py = ev?.clientY ? ((ev.clientY - box.top) / box.height) * 100 : 62;
    for (let i = 0; i < 3; i++) {
      const r = el('div', 'sound-ring big');
      place(r, px, py);
      r.style.animationDelay = `${i * 0.6}s`;
      view.overlays.append(r);
      r.addEventListener('animationend', () => r.remove(), { once: true });
    }

    // Damped sway: a great bronze bell barely moves; it shudders and settles.
    const amp = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.26;
    const dur = 5200;
    bell.until = now + dur;
    const t0 = now;
    cancelAnimationFrame(bell.raf);
    const step = (t) => {
      const k = (t - t0) / dur;
      if (k >= 1) { bell.cut.style.transform = ''; bell.cut.classList.remove('moving'); return; }
      const a = amp * Math.exp(-3.2 * k) * Math.sin((t - t0) / 1000 * 2 * Math.PI * 0.85);
      const shiver = amp * 0.12 * Math.exp(-9 * k) * Math.sin((t - t0) / 1000 * 2 * Math.PI * 11);
      bell.cut.style.transform = `rotate(${a + shiver}deg)`;
      bell.raf = requestAnimationFrame(step);
    };
    bell.raf = requestAnimationFrame(step);
  }
}

// ------------------------------------------------------------ helpers

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

/** Position an element's anchor (set in CSS) at a point in % of the photo. */
function place(e, x, y) {
  e.style.left = `${x}%`;
  e.style.top = `${y}%`;
}

let whisperTimer;
/** A short line of text near the bottom of the screen that fades away. */
export function whisper(text) {
  const w = document.getElementById('whisper');
  if (!w) return;
  w.textContent = text;
  w.classList.remove('show');
  void w.offsetWidth;
  w.classList.add('show');
  clearTimeout(whisperTimer);
  whisperTimer = setTimeout(() => w.classList.remove('show'), 2600);
}

/**
 * Cut a photographed object out of its black studio background.
 * Alpha comes from brightness, so petals and stem keep soft natural edges.
 * Returns an object URL for a transparent PNG.
 */
async function keyBlackBackground(src, [sx, sy, sw, sh]) {
  const img = new Image();
  // The load event, not img.decode(): decode() can stay pending while the window is hidden.
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = src;
  });
  const c = document.createElement('canvas');
  c.width = sw;
  c.height = sh;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  const data = g.getImageData(0, 0, sw, sh);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const m = Math.max(p[i], p[i + 1], p[i + 2]);
    const a = Math.min(1, Math.max(0, (m - 22) / 38));
    p[i + 3] = Math.round(a * 255);
  }
  g.putImageData(data, 0, 0);
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  return URL.createObjectURL(blob);
}
