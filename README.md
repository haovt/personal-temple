# Temple

A quiet, local visit to a Vietnamese Buddhist temple, built from real photographs.
Static HTML, CSS and vanilla JavaScript. No framework, no backend, no build step.
Made for desktop PC browsers.

## Run it

The page must be served over HTTP, because browsers block ES modules and `fetch` from `file://`.

- **Recommended:** the small dev server in `tools/` (it tells the browser not to reuse old
  copies, so a normal refresh always shows the latest files):

```bash
python tools/serve.py 5520
```

  Then open http://127.0.0.1:5520.
- **VS Code:** right-click `index.html` and choose **Open with Live Server**.

`tools/serve.py` is only a development helper; the temple itself is plain HTML, CSS and
JavaScript. With other servers, use **Ctrl+F5** after changing files.

## Using it

- Click the gate to enter. Move the pointer over objects to see what you can do.
- Refreshing the page starts the visit fresh: everything is reset and you begin at the gate.
- Sound starts after your first click (browsers require it): birds and garden air outdoors,
  muffled inside the halls, wind chimes now and then. Hover the speaker button for the volume
  slider; click it to mute. Sound pauses while the tab is hidden.
- **Esc** or the ← button goes back. Move the pointer to the bottom edge for the list of places.
- **H** outlines every interactive spot.

## Project layout

```
index.html            page shell
css/                  fonts, layout + HUD, scene + hotspot styling, animations
js/app.js             boot
js/navigation.js      scene graph, cross-fades, URL hash, back, places strip
js/temple.js          SceneView: cover layout, crop, focal point, hotspots
js/interactions.js    rituals: incense, candles, lotus, prayer, wooden fish, bells; saved state
js/particles.js       canvas incense sticks, embers and smoke
js/fortune.js         fortune sticks: shake, dropped stick, fortune slip
js/audio.js           Web Audio: recordings, hall reverb, mute
js/storage.js         clears old browser storage on every page load
data/scenes.json      scenes and hotspots, positioned in % of each photo
data/rituals.json     overlay anchors (candles, lotus, incense, bell, fortune cylinder) and prayer wishes
data/fortunes.json    the 100 fortunes (number, rank, title, poem, meaning, advice); edit freely
assets/               photos (WebP 1280/2560), fonts
CREDITS.md            source and license of every asset
```

To move a hotspot, edit its `rect` (`[left, top, width, height]` in % of the full photo) in
`data/scenes.json`. Press **H** in the page to see the result.
