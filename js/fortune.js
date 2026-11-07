// Xin xăm: shake the fortune-stick cylinder, one stick drops onto the table,
// and a fortune slip opens with the number, rank, poem, meaning and advice.
//
// Everything that moves is cut from the scene's own photograph:
//  - the cylinder (with its sticks) is a clip-path copy of the photo, rotated
//    around a point below the frame, as if held and rocked by hand;
//  - behind it a soft "clean plate" (the blurred background, blended across the
//    cylinder's place) hides the still original while it moves;
//  - the dropped stick is a sprite of one real stick from the bundle.
// Fortune texts live in data/fortunes.json.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class FortuneTeller {
  constructor(view, cfg, data, audio, whisper) {
    this.view = view;
    this.cfg = cfg;
    this.data = data;
    this.audio = audio;
    this.whisper = whisper;
    this.busy = false;
    this.last = -1;

    const layer = view.overlays;

    // Clean plate (built once the photo is available)
    this.plate = document.createElement('canvas');
    this.plate.className = 'fortune-plate';
    setBox(this.plate, cfg.plateRegion);
    layer.append(this.plate);
    this.plateReady = buildCleanPlate(this.plate, cfg.plateSource, cfg.plateRegion, cfg.sampleWidth);

    // Moving cylinder: the same photo, clipped to the cylinder and its sticks
    this.cyl = document.createElement('div');
    this.cyl.className = 'fortune-cylinder';
    this.cyl.style.clipPath = polygon(cfg.cylinder.outline);
    this.cyl.style.transformOrigin = `${cfg.cylinder.pivot[0]}% ${cfg.cylinder.pivot[1]}%`;
    this.cylImg = document.createElement('img');
    this.cylImg.className = 'photo';
    this.cylImg.alt = '';
    this.cyl.append(this.cylImg);
    layer.append(this.cyl);

    // The stick that falls out: a sprite of one stick from the photo
    const [bx, by, bw, bh] = cfg.stick.box;
    this.stick = document.createElement('div');
    this.stick.className = 'fortune-stick';
    setBox(this.stick, cfg.stick.box);
    this.stick.style.backgroundSize = `${(100 / bw) * 100}% ${(100 / bh) * 100}%`;
    this.stick.style.backgroundPosition = `${(bx / (100 - bw)) * 100}% ${(by / (100 - bh)) * 100}%`;
    this.stick.style.clipPath = polygon(cfg.stick.outline.map(([x, y]) => [((x - bx) / bw) * 100, ((y - by) / bh) * 100]));
    layer.append(this.stick);

    this.tag = document.createElement('div');
    this.tag.className = 'fortune-tag';
    layer.append(this.tag);
  }

  /** Shake → stick drops → slip opens. */
  async draw() {
    if (this.busy) return;
    this.busy = true;
    this.closeSlip(true);
    this.#clearStick();
    this.view.el.classList.add('drawing');

    await this.plateReady;
    const photo = this.view.img.src;
    this.cylImg.src = photo;
    this.stick.style.backgroundImage = `url("${photo}")`;

    // 1. Shake
    this.audio?.play('rattle');
    this.plate.classList.add('on');
    this.cyl.classList.add('on');
    const shake = reduceMotion() ? null : this.cyl.animate([
      { transform: 'rotate(0deg)' },
      { transform: 'rotate(-4.5deg) translateY(-0.6%)', offset: 0.1 },
      { transform: 'rotate(4deg) translateY(0.3%)', offset: 0.22 },
      { transform: 'rotate(-4deg) translateY(-0.7%)', offset: 0.34 },
      { transform: 'rotate(4.5deg) translateY(0.2%)', offset: 0.46 },
      { transform: 'rotate(-3.5deg) translateY(-0.5%)', offset: 0.58 },
      { transform: 'rotate(3.5deg)', offset: 0.7 },
      { transform: 'rotate(-2deg) translateY(-0.3%)', offset: 0.82 },
      { transform: 'rotate(1deg)', offset: 0.92 },
      { transform: 'rotate(0deg)' },
    ], { duration: 2100, easing: 'ease-in-out' });
    await wait(2150);
    shake?.cancel();
    this.cyl.classList.remove('on');
    this.plate.classList.remove('on');

    // 2. One stick slides up out of the bundle and drops onto the table
    const pick = this.#pick();
    await this.#dropStick();
    this.audio?.play('wooden-fish', { rate: 1.7, gain: 0.45 });
    this.tag.textContent = `Xăm số ${pick.number}`;
    const [tx, ty] = this.cfg.stick.tag;
    this.tag.style.left = `${tx}%`;
    this.tag.style.top = `${ty}%`;
    this.tag.classList.add('on');
    await wait(900);

    // 3. The fortune slip
    this.#openSlip(pick);
    this.view.el.classList.remove('drawing');
    this.busy = false;
  }

  /** Called when leaving the scene. */
  reset() {
    this.closeSlip(true);
    this.#clearStick();
    this.view.el.classList.remove('drawing');
  }

  #pick() {
    const list = this.data.fortunes;
    const r = new Uint32Array(1);
    let i;
    do { crypto.getRandomValues(r); i = r[0] % list.length; } while (list.length > 1 && i === this.last);
    this.last = i;
    return list[i];
  }

  async #dropStick() {
    const s = this.stick;
    const { rest } = this.cfg.stick;              // final place on the table: [x, y, rotate°]
    const box = this.view.plateBox;               // px size of the photo right now
    const [bx, by, bw, bh] = this.cfg.stick.box;
    // Distance from the stick's place in the bundle to its resting place, in px
    const dx = ((rest[0] - (bx + bw / 2)) / 100) * box.w;
    const dy = ((rest[1] - (by + bh / 2)) / 100) * box.h;
    const rise = -0.32 * (bh / 100) * box.h;
    s.classList.add('on');
    const anim = reduceMotion() ? null : s.animate([
      { transform: 'translate(0, 0) rotate(0deg)', offset: 0 },
      { transform: `translate(0, ${rise}px) rotate(0deg)`, offset: 0.35, easing: 'ease-in' },
      { transform: `translate(${dx * 0.55}px, ${rise * 1.4}px) rotate(${rest[2] * 0.45}deg)`, offset: 0.6, easing: 'ease-in' },
      { transform: `translate(${dx}px, ${dy}px) rotate(${rest[2]}deg)`, offset: 0.92, easing: 'ease-out' },
      { transform: `translate(${dx}px, ${dy - 0.004 * box.h}px) rotate(${rest[2] - 2}deg)`, offset: 0.96 },
      { transform: `translate(${dx}px, ${dy}px) rotate(${rest[2]}deg)`, offset: 1 },
    ], { duration: 1500 });
    await wait(1500);
    anim?.cancel();
    // Settle in % so it stays in place if the window is resized.
    s.style.left = `${rest[0] - bw / 2}%`;
    s.style.top = `${rest[1] - bh / 2}%`;
    s.style.transform = `rotate(${rest[2]}deg)`;
  }

  #clearStick() {
    this.stick.classList.remove('on');
    this.tag.classList.remove('on');
    setBox(this.stick, this.cfg.stick.box);
    this.stick.style.transform = '';
  }

  // ---------------------------------------------------------------- slip

  #openSlip(f) {
    const rankName = this.data.ranks[f.rank] || f.rank;
    const slip = document.createElement('div');
    slip.className = `fortune-slip rank-${f.rank}`;
    slip.setAttribute('role', 'dialog');
    slip.setAttribute('aria-label', `Xăm số ${f.number}`);
    slip.innerHTML = `
      <div class="slip-paper">
        <div class="slip-head">
          <span class="slip-seal"><span>${f.number}</span></span>
          <div>
            <div class="slip-no">Xăm số ${f.number}</div>
            <div class="slip-rank"></div>
          </div>
        </div>
        <h2 class="slip-title"></h2>
        <div class="slip-poem"></div>
        <p class="slip-meaning"></p>
        <dl class="slip-advice"></dl>
      </div>
      <div class="slip-actions">
        <button type="button" class="again">Gieo lại</button>
        <button type="button" class="read" hidden>Nghe đọc</button>
        <button type="button" class="close">Đóng</button>
      </div>`;
    slip.querySelector('.slip-rank').textContent = rankName;
    slip.querySelector('.slip-title').textContent = f.title;
    const poem = slip.querySelector('.slip-poem');
    for (const line of f.poem) {
      const p = document.createElement('p');
      p.textContent = line;
      poem.append(p);
    }
    slip.querySelector('.slip-meaning').textContent = f.meaning;
    const dl = slip.querySelector('.slip-advice');
    for (const [key, label] of Object.entries(this.data.topics)) {
      if (!f.advice?.[key]) continue;
      const dt = document.createElement('dt');
      dt.textContent = label;
      const dd = document.createElement('dd');
      dd.textContent = f.advice[key];
      dl.append(dt, dd);
    }

    slip.querySelector('.again').addEventListener('click', () => this.draw());
    slip.querySelector('.close').addEventListener('click', () => { this.closeSlip(); this.#clearStick(); });
    const readBtn = slip.querySelector('.read');
    const voice = vietnameseVoice();
    if (voice) {
      readBtn.hidden = false;
      readBtn.addEventListener('click', () => speak(voice, `Xăm số ${f.number}. ${rankName}. ${f.title}. ${f.poem.join('. ')}. ${f.meaning}`));
    }

    document.body.append(slip);
    document.body.classList.add('modal-open');
    requestAnimationFrame(() => slip.classList.add('show'));
    this.slip = slip;
    this.keys = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); this.closeSlip(); this.#clearStick(); }
    };
    window.addEventListener('keydown', this.keys, true);
    setTimeout(() => slip.querySelector('.again').focus({ preventScroll: true }), 400);
  }

  closeSlip(immediate = false) {
    const slip = this.slip;
    if (!slip) return;
    this.slip = null;
    window.speechSynthesis?.cancel();
    window.removeEventListener('keydown', this.keys, true);
    document.body.classList.remove('modal-open');
    slip.classList.remove('show');
    setTimeout(() => slip.remove(), immediate ? 0 : 500);
  }
}

// ------------------------------------------------------------ helpers

function setBox(e, [x, y, w, h]) {
  Object.assign(e.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${h}%` });
}

function polygon(points) {
  return `polygon(${points.map(([x, y]) => `${x}% ${y}%`).join(',')})`;
}

/**
 * Build the clean plate: for each row of the region, blend the background colour
 * just left of it into the colour just right of it, then blur strongly. The real
 * background here is out-of-focus bokeh, so a soft blend reads as more of the same.
 */
async function buildCleanPlate(canvas, src, [x, y, w, h], sampleWidth) {
  const img = new Image();
  await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });
  const W = img.naturalWidth, H = img.naturalHeight;
  const rx = Math.round((x / 100) * W), ry = Math.round((y / 100) * H);
  const rw = Math.round((w / 100) * W), rh = Math.round((h / 100) * H);
  const band = Math.max(4, Math.round((sampleWidth / 100) * W));

  const src2d = document.createElement('canvas');
  src2d.width = W; src2d.height = H;
  const g = src2d.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  // Mirror the real background on each side into the gap and cross-fade the two:
  // at the left edge the fill equals the pixel just left of the region, at the right
  // edge the pixel just right of it, so both seams are invisible and the bokeh keeps
  // its natural texture. Rows are kept, so horizontal bands (the table edge) continue.
  const left = g.getImageData(Math.max(0, rx - rw), ry, Math.min(rw, rx), rh).data;
  const lw = Math.min(rw, rx);
  const rStart = rx + rw;
  const rwid = Math.min(rw, W - rStart);
  const right = g.getImageData(rStart, ry, rwid, rh).data;

  const fill = document.createElement('canvas');
  fill.width = rw; fill.height = rh;
  const fg = fill.getContext('2d');
  const out = fg.createImageData(rw, rh);
  for (let row = 0; row < rh; row++) {
    for (let col = 0; col < rw; col++) {
      const lc = Math.max(0, lw - 1 - (col % lw));                 // mirrored from the left
      const rc = Math.max(0, Math.min(rwid - 1, rw - 1 - col));    // mirrored from the right
      const a = (row * lw + lc) * 4;
      const b = (row * rwid + rc) * 4;
      const t = col / (rw - 1);
      const k = (row * rw + col) * 4;
      out.data[k] = left[a] * (1 - t) + right[b] * t;
      out.data[k + 1] = left[a + 1] * (1 - t) + right[b + 1] * t;
      out.data[k + 2] = left[a + 2] * (1 - t) + right[b + 2] * t;
      out.data[k + 3] = 255;
    }
  }
  fg.putImageData(out, 0, 0);

  // Light extra blur so the cross-fade does not show doubled light spots.
  canvas.width = rw; canvas.height = rh;
  const cg = canvas.getContext('2d');
  const r = Math.max(2, Math.round(rw * 0.025));
  cg.filter = `blur(${r}px)`;
  cg.drawImage(fill, -3 * r, -3 * r, rw + 6 * r, rh + 6 * r);
  cg.filter = 'none';
}

function vietnameseVoice() {
  const voices = window.speechSynthesis?.getVoices() || [];
  return voices.find((v) => /^vi(-|_|$)/i.test(v.lang) && v.localService) || null;
}

function speak(voice, text) {
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.92;
  synth.speak(u);
}
// Some browsers load their voice list late; ask once so it is ready by the time a slip opens.
window.speechSynthesis?.getVoices();
