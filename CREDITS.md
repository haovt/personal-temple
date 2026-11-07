# Credits

Every asset used by the temple, with its source and license. All photographs are real
photographs, downloaded on 2026-11-07 as WebP (1280 px and 2560 px wide) through the Pexels
image CDN. The lotus is cut out of its black background in the browser at runtime
(brightness-based alpha); all other crops and the bell cut-out (a clip-path on the same photo) are
applied at display time. The source files are unedited.

## Photographs

| File | Subject | Photographer | Source | License |
|---|---|---|---|---|
| `assets/images/entrance/buu-long-gate-*.webp` | Three-arch temple gate with Buddhist flags | The Old Path White Clouds | https://www.pexels.com/photo/entrance-to-b-u-long-pagoda-in-d-ng-nai-vietnam-39341202/ | Pexels License |
| `assets/images/main-hall/golden-buddha-hall-*.webp` | Main hall, golden Buddha before a Bodhi-tree relief | The Old Path White Clouds | https://www.pexels.com/photo/golden-buddha-statue-in-vietnamese-temple-interior-39341197/ | Pexels License |
| `assets/images/incense/stone-incense-burner-*.webp` | Stone dragon incense burner, Ho Chi Minh City | The Old Path White Clouds | https://www.pexels.com/photo/intricate-temple-architecture-in-ho-chi-minh-city-38518284/ | Pexels License |
| `assets/images/bell/bronze-bell-tower-*.webp` | Large bronze bell in a wooden bell tower | Valeria Drozdova | https://www.pexels.com/photo/large-traditional-bell-in-pagoda-setting-37890062/ | Pexels License |
| `assets/images/fortune/fortune-sticks-*.webp` | Fortune sticks in a red cylinder | Wisnu Phaewchimplee | https://www.pexels.com/photo/close-up-of-fortune-sticks-in-jar-12958510/ | Pexels License |
| `assets/images/overlays/lotus-pink-800.webp` | Pink lotus with stem on a black background (offering overlay) | DI LAI | https://www.pexels.com/photo/27704157/ | Pexels License |

Note on the entrance photo: Pexels captions it as Bửu Long Pagoda (Đồng Nai), but the gate's
inscription reads **"Bản Sơn Thiền Viện Thường Chiếu"**. The visible inscription is the stronger
evidence, so the app does not name the temple.

**Pexels License** (https://www.pexels.com/license/): free to use and modify, attribution not
required. Not allowed: selling unaltered copies, redistributing on stock or wallpaper platforms,
implying endorsement, showing identifiable people in a bad light.

## Sounds

Real recordings, downloaded on 2026-11-07. The Freesound files are the site's public
high-quality MP3 previews (no login needed); the license is the same as the original upload.
Excerpts are chosen at playback time (start offset, fade); the files are unedited. The hall
reverb is a generated impulse response, not a recording.

| File | Used for | Author | Source | License |
|---|---|---|---|---|
| `assets/sounds/effects/temple-bell-1532.mp3` | Great bell (Gác chuông). A 1,200 lb bronze temple bell cast in 1532, recorded at a New Year bell-ringing in San Francisco | tec_studio | https://freesound.org/people/tec_studio/sounds/668647/ | CC0 1.0 |
| `assets/sounds/effects/singing-bowl-1.ogg` | Bowl bell (chuông gia trì), and each bow during prayer | BambooBeast | https://commons.wikimedia.org/wiki/File:SingingBowl1.ogg | Public domain |
| `assets/sounds/effects/mokugyo.mp3` | Wooden fish (mõ) | jonopodmore | https://freesound.org/people/jonopodmore/sounds/607215/ | CC0 1.0 |
| `assets/sounds/effects/lighting-incense.mp3` | Lighting incense | 714jimmy | https://freesound.org/people/714jimmy/sounds/547495/ | CC0 1.0 |
| `assets/sounds/effects/match-light-candle.mp3` | Lighting candles (excerpt 6.2–8.8 s) | shelbyshark | https://freesound.org/people/shelbyshark/sounds/464099/ | CC0 1.0 |
| `assets/sounds/effects/bamboo-rattle.mp3` | Shaking the fortune-stick cylinder (excerpt 29.5–31.7 s) | JarredGibb | https://freesound.org/people/JarredGibb/sounds/263884/ | CC0 1.0 |
| `assets/sounds/effects/candle-blow-out.mp3` | Blowing out the candles (excerpt 1.25–2.0 s) | JacobEmanuelMadrid | https://freesound.org/people/JacobEmanuelMadrid/sounds/656818/ | CC0 1.0 |
| `assets/sounds/effects/flowers-rustle.mp3` | Offering a lotus (excerpt 1.7–3.5 s) | ost-soundwerkstatt | https://freesound.org/people/ost-soundwerkstatt/sounds/571154/ | CC0 1.0 |

The dropped fortune stick landing on the table reuses the wooden-fish knock, played faster.

### Ambience

| File | Used for | Author | Source | License |
|---|---|---|---|---|
| `assets/sounds/ambient/garden-birds.mp3` | Background bed: birds and garden air (4 min loop; muffled indoors) | SamuelGremaud | https://freesound.org/people/SamuelGremaud/sounds/459488/ | CC0 1.0 |
| `assets/sounds/ambient/truclam-wind-chimes.mp3` | Wind chimes now and then, recorded at Trúc Lâm Zen Monastery, Vietnam | EliasArtista | https://freesound.org/people/EliasArtista/sounds/840816/ | CC0 1.0 |

## Fonts

| File | Font | Source | License |
|---|---|---|---|
| `assets/fonts/noto-serif-{vietnamese,latin,latin-ext}.woff2` | Noto Serif (variable, v33) | Google Fonts, https://fonts.google.com/noto/specimen/Noto+Serif | SIL Open Font License 1.1 |

## Procedural effects (not photographs)

These are drawn in code, not photographed:

- **Incense sticks, embers, smoke and falling ash** (`js/particles.js`): thin canvas strokes for the
  sticks and ash, soft pre-rendered puffs for the smoke. At the size the sticks appear on screen (1–3 px wide), a
  photographed cut-out would not look different.
- **Candle flames and light spill** (`css/temple.css`): layered radial gradients with a CSS flicker.
- **Prayer halo, sound rings, wooden-fish glow**: CSS gradients.
- **Fortune scene clean plate**: while the cylinder shakes, the area behind it is filled with the
  photo's own out-of-focus background, mirrored in from both sides and blended (computed in the
  browser). The moving cylinder and the dropped stick are cut from the same photo.

## Texts

The 100 fortunes in `data/fortunes.json` and the prayer wishes in `data/rituals.json` were written
for this project; they are not copied from any fortune book or website.
