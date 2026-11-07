// Entry point: load data, start navigation, rituals and sound, wire the few controls.
import { Navigator } from './navigation.js';
import { Rituals } from './interactions.js';
import { TempleAudio } from './audio.js';
import { storage } from './storage.js';

async function boot() {
  // Every page load (including a browser refresh) starts the visit fresh:
  // clear saved state and begin again at the temple gate.
  storage.clearAll();

  let scenes, rituals, fortunes;
  try {
    [scenes, rituals, fortunes] = await Promise.all([
      fetch('data/scenes.json').then((r) => r.json()),
      fetch('data/rituals.json').then((r) => r.json()),
      fetch('data/fortunes.json').then((r) => r.json()),
    ]);
  } catch (err) {
    console.error('Could not load data files', err);
    document.getElementById('file-notice').hidden = false;
    return;
  }
  history.replaceState(null, '', `#${scenes.start}`);

  const audio = new TempleAudio();
  const ritual = new Rituals(rituals, audio, fortunes);
  const nav = new Navigator({
    world: document.getElementById('world'),
    data: scenes,
    onAction: (detail) => ritual.handle(detail),
    hooks: {
      created: (view) => ritual.created(view),
      enter: (view) => { ritual.enter(view); audio.setScene(view.scene.id); },
      leave: (view) => ritual.leave(view),
    },
  });
  window.temple = { nav, ritual, audio };  // handy for debugging in the console
  await nav.start();

  const fsBtn = document.getElementById('btn-fullscreen');
  if (!document.fullscreenEnabled) fsBtn.hidden = true;
  fsBtn.addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });

  const soundBtn = document.getElementById('btn-sound');
  const volume = document.getElementById('volume');
  const showMuted = (muted) => {
    soundBtn.classList.toggle('muted', muted);
    soundBtn.setAttribute('aria-label', muted ? 'Bật âm thanh' : 'Tắt âm thanh');
  };
  soundBtn.addEventListener('click', () => {
    audio.setMuted(!audio.muted);
    showMuted(audio.muted);
  });
  volume.addEventListener('input', () => {
    audio.setVolume(volume.value / 100);
    if (audio.muted && volume.value > 0) { audio.setMuted(false); showMuted(false); }
    volume.style.setProperty('--fill', `${volume.value}%`);
  });
  volume.style.setProperty('--fill', `${volume.value}%`);
}

boot();
