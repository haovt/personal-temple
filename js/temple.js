// SceneView: one photograph shown full screen, with hotspots placed in photo coordinates.
//
// Layout model
//   The photo (optionally cropped) is scaled to *cover* the viewport. The full,
//   uncropped photo is the "plate"; hotspots and overlays are positioned in % of
//   the plate, so they stay attached to the right object at any window size.
//   The plate is translated so the scene's focal point sits as close to the
//   viewport centre as possible without revealing an edge or the cropped area.

const SIZES = [1280, 2560];
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** img.decode() can stay pending while the window is hidden; fall back to the load event. */
function decoded(img, timeout = 2500) {
  const loaded = img.complete && img.naturalWidth
    ? Promise.resolve()
    : new Promise((res, rej) => {
      img.addEventListener('load', res, { once: true });
      img.addEventListener('error', rej, { once: true });
    });
  return Promise.race([
    img.decode().catch(() => loaded),
    loaded.then(() => new Promise((r) => setTimeout(r, timeout))),
  ]);
}

export class SceneView {
  constructor(scene, { onHotspot }) {
    this.scene = scene;
    this.onHotspot = onHotspot;
    this.loadedWidth = 0;
    this.crop = { top: 0, right: 0, bottom: 0, left: 0, ...(scene.crop || {}) };

    this.el = document.createElement('section');
    this.el.className = 'scene';
    this.el.dataset.scene = scene.id;
    this.el.setAttribute('aria-label', scene.title);

    this.plate = document.createElement('div');
    this.plate.className = 'plate';

    this.img = document.createElement('img');
    this.img.className = 'photo';
    this.img.alt = '';
    this.img.decoding = 'async';
    this.img.draggable = false;

    this.overlays = document.createElement('div');   // filled by interactions (milestone 2)
    this.overlays.className = 'overlays';

    this.hotspotLayer = document.createElement('div');
    this.hotspotLayer.className = 'hotspots';

    this.plate.append(this.img, this.overlays, this.hotspotLayer);
    const vignette = document.createElement('div');
    vignette.className = 'vignette';
    this.el.append(this.plate, vignette);

    this.hotspots = scene.hotspots.map((h) => this.#makeHotspot(h));
  }

  #makeHotspot(h) {
    const [x, y, w, hh] = h.rect;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hotspot' + (h.edge ? ` edge-${h.edge}` : '') + (y < 22 ? ' label-below' : '');
    btn.dataset.id = h.id;
    btn.setAttribute('aria-label', h.label);
    Object.assign(btn.style, { left: `${x}%`, top: `${y}%`, width: `${w}%`, height: `${hh}%` });

    const label = document.createElement('span');
    label.className = 'hs-label';
    label.textContent = h.label;
    btn.append(label);

    btn.addEventListener('click', (ev) => this.onHotspot(this, h, btn, ev));
    this.hotspotLayer.append(btn);
    return btn;
  }

  /** Choose the image size for the rendered width and wait until it can be painted. */
  async load(renderWidth = window.innerWidth) {
    const needed = renderWidth * Math.min(window.devicePixelRatio || 1, 2);
    const width = SIZES.find((s) => s >= needed * 0.9) || SIZES[SIZES.length - 1];
    if (width <= this.loadedWidth) return;
    const src = `${this.scene.image}-${width}.webp`;
    if (!this.loadedWidth) {
      this.img.src = src;
      try { await decoded(this.img); } catch { /* broken image: shown as dark plate */ }
    } else {
      // Upgrade quietly: decode off-screen first so the swap does not flash.
      const probe = new Image();
      probe.src = src;
      try { await decoded(probe); this.img.src = src; } catch { return; }
    }
    this.loadedWidth = width;
  }

  /** Size and position the plate for a viewport. Returns the plate width in px. */
  layout(vw, vh) {
    const { top, right, bottom, left } = this.crop;
    const fw = 1 - left - right;          // visible fraction of the photo
    const fh = 1 - top - bottom;
    const visAspect = (this.scene.aspect * fw) / fh;

    let visW, visH;                       // cover the viewport
    if (vw / vh > visAspect) { visW = vw; visH = vw / visAspect; }
    else { visH = vh; visW = vh * visAspect; }

    const plateW = visW / fw;
    const plateH = visH / fh;

    const [fx, fy] = this.scene.focus || [50, 50];
    // The visible (cropped) photo must always cover the viewport.
    const ox = clamp(vw / 2 - (fx / 100) * plateW, vw - (1 - right) * plateW, -left * plateW);
    const oy = clamp(vh / 2 - (fy / 100) * plateH, vh - (1 - bottom) * plateH, -top * plateH);

    this.plate.style.width = `${plateW}px`;
    this.plate.style.height = `${plateH}px`;
    this.plate.style.transform = `translate3d(${ox}px, ${oy}px, 0)`;
    this.plateBox = { x: ox, y: oy, w: plateW, h: plateH };
    this.view = { w: vw, h: vh };
    this.#pinEdges();
    return plateW;
  }

  /** Edge passages stick to the visible screen edge, wherever the photo is cropped. */
  #pinEdges() {
    const b = this.plateBox;
    const visLeft = (-b.x / b.w) * 100;
    const visRight = ((this.view.w - b.x) / b.w) * 100;
    this.scene.hotspots.forEach((h, i) => {
      if (!h.edge) return;
      const w = h.rect[2];
      this.hotspots[i].style.left = `${h.edge === 'left' ? visLeft : visRight - w}%`;
    });
  }


  hint() {
    this.el.classList.add('hint');
    setTimeout(() => this.el.classList.remove('hint'), 2800);
  }
}

/** Small ring of light at the pressed point of an action hotspot. */
export function ripple(btn, ev) {
  const r = document.createElement('span');
  r.className = 'ripple';
  if (ev && ev.clientX) {
    const box = btn.getBoundingClientRect();
    r.style.left = `${ev.clientX - box.left}px`;
    r.style.top = `${ev.clientY - box.top}px`;
  }
  btn.append(r);
  r.addEventListener('animationend', () => r.remove(), { once: true });
}
