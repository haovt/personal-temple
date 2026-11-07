// Scene graph, transitions and URL hash routing.
import { SceneView, ripple } from './temple.js';

export class Navigator {
  constructor({ world, data, onAction, hooks = {} }) {
    this.world = world;
    this.hooks = hooks;             // { created(view), enter(view), leave(view) }
    this.scenes = new Map(data.scenes.map((s) => [s.id, s]));
    this.startId = data.start;
    this.onAction = onAction;
    this.views = new Map();
    this.current = null;            // SceneView
    this.busy = false;
    this.pendingOrigin = null;      // viewport point the user clicked, for the push-in
    this.hinted = new Set();

    this.titleEl = document.getElementById('place-title');
    this.backBtn = document.getElementById('btn-back');
    this.placesEl = document.getElementById('places');
    this.#buildPlaces();

    this.backBtn.addEventListener('click', () => this.back());
    window.addEventListener('hashchange', () => this.#fromHash());
    window.addEventListener('resize', () => this.#relayout());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !document.body.classList.contains('modal-open')) this.back();
      // H: outline every interactive spot (helps first-time visitors and hotspot tuning)
      if ((e.key === 'h' || e.key === 'H') && !e.target.closest('input, textarea')) {
        document.body.classList.toggle('show-hotspots');
      }
    });
  }

  async start() {
    const id = this.#hashId() || this.startId;
    if (!this.#hashId()) history.replaceState(null, '', `#${id}`);
    await this.#show(id, { instant: true });
    this.#preloadAll();
  }

  /** Navigate to a scene. `origin` is the viewport point the move started from. */
  go(id, origin = null) {
    if (!this.scenes.has(id) || this.current?.scene.id === id) return;
    this.pendingOrigin = origin;
    location.hash = id;             // hashchange → #show (keeps browser back/forward working)
  }

  back() {
    const parent = this.current?.scene.parent;
    if (parent) this.go(parent);
  }

  // ---------------------------------------------------------------- internals

  #hashId() {
    const id = decodeURIComponent(location.hash.slice(1));
    return this.scenes.has(id) ? id : null;
  }

  #fromHash() {
    const id = this.#hashId();
    if (id && id !== this.current?.scene.id) this.#show(id);
  }

  #view(id) {
    if (!this.views.has(id)) {
      const view = new SceneView(this.scenes.get(id), {
        onHotspot: (v, h, btn, ev) => this.#hotspot(v, h, btn, ev),
      });
      this.views.set(id, view);
      this.hooks.created?.(view);
    }
    return this.views.get(id);
  }

  #hotspot(view, h, btn, ev) {
    if (h.type === 'go') {
      const box = btn.getBoundingClientRect();
      this.go(h.to, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
    } else {
      ripple(btn, ev);
      this.onAction?.({ scene: view.scene.id, hotspot: h, view, el: btn, ev });
    }
  }

  async #show(id, { instant = false } = {}) {
    if (this.busy) { this.queued = id; return; }
    this.busy = true;

    const next = this.#view(id);
    const prev = this.current;
    const vw = window.innerWidth, vh = window.innerHeight;
    next.layout(vw, vh);
    if (!next.el.isConnected) this.world.append(next.el);
    await next.load(next.plateBox.w);

    this.hooks.enter?.(next);
    if (instant || !prev) {
      next.el.classList.add('active', 'entering');
      setTimeout(() => next.el.classList.remove('entering'), fadeMs());
    } else {
      const origin = this.pendingOrigin;
      prev.el.style.transformOrigin = origin ? `${origin.x}px ${origin.y}px` : '50% 50%';
      prev.el.classList.remove('active');
      prev.el.classList.add('leaving');
      if (origin) prev.el.classList.add('push');
      next.el.classList.add('active', 'entering');
      await wait(fadeMs());
      prev.el.classList.remove('leaving', 'push');
      prev.el.style.transformOrigin = '';
      prev.el.remove();             // keep the view object (and its state) for later
      this.hooks.leave?.(prev);
      next.el.classList.remove('entering');
    }
    this.pendingOrigin = null;
    this.current = next;
    document.body.dataset.scene = id;
    this.#updateChrome(next.scene);

    if (!this.hinted.has(id)) {
      this.hinted.add(id);
      setTimeout(() => this.current === next && next.hint(), 1200);
    }
    this.busy = false;
    if (this.queued && this.queued !== id) { const q = this.queued; this.queued = null; this.#show(q); }
    else this.queued = null;
  }

  #updateChrome(scene) {
    this.backBtn.hidden = !scene.parent;
    this.titleEl.textContent = scene.title;
    this.titleEl.classList.remove('show');
    void this.titleEl.offsetWidth;
    this.titleEl.classList.add('show');
    clearTimeout(this.titleTimer);
    this.titleTimer = setTimeout(() => this.titleEl.classList.remove('show'), 3800);
    document.title = `${scene.title} · Chùa`;
    for (const b of this.placesEl.querySelectorAll('button')) {
      b.setAttribute('aria-current', String(b.dataset.to === scene.id));
    }
  }

  #buildPlaces() {
    for (const s of this.scenes.values()) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.to = s.id;
      b.textContent = s.title;
      b.addEventListener('click', () => this.go(s.id));
      this.placesEl.append(b);
    }
    // Reveal when the pointer comes near the bottom edge; hide again when idle.
    let timer;
    const show = () => {
      this.placesEl.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!this.placesEl.matches(':hover')) this.placesEl.classList.remove('show');
      }, 2500);
    };
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && e.clientY > window.innerHeight - 110) show();
    });
    this.placesEl.addEventListener('pointerleave', show);
  }

  #relayout() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      for (const v of this.views.values()) {
        const w = v.layout(vw, vh);
        if (v === this.current) v.load(w);   // upgrade to the larger image if needed
      }
    });
  }

  #preloadAll() {
    // Warm the cache for every scene so moving around never shows a blank frame.
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 600));
    idle(() => {
      const vw = window.innerWidth, vh = window.innerHeight;
      for (const id of this.scenes.keys()) {
        const v = this.#view(id);
        v.load(v.layout(vw, vh));
      }
    });
  }
}

function fadeMs() {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--fade').trim();
  return parseFloat(v) || 900;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
