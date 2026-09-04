# Assets and the size budget

What every file in `img/` and the section `img/` folders is for, the per-use pixel budget every image is encoded to, and the recipes. Read this before adding any image, video or model.

## Assets

| file | status |
|---|---|
| `img/intro-bg.webm` | **used** — first `<source>` for the People backdrop |
| `img/intro-bg.mp4` | **used** — fallback `<source>` (Safari / no VP9) |
| `img/intro-bg.jpg` | **used** — `poster`, and the still under reduced motion |
| `information/img/sussex-bg.jpg` | **used** — the Information section backdrop, behind all three tabs. 1600×800 / 306 KB. It lived in `img/` at the root until that was noticed: `img/` is for what more than one section uses, and nothing else has ever asked for this one |
| `information/img/sussex_landscape.jpg` | **used** — the campus, in the University block on the Contact tab. 1200×675 / 166 KB from a 2048px original, which is kept as a gitignored `_full`. Shown at ~320px in a column and ~775px as a banner below 900px, so 1200 is the 2× case that actually happens |
| `information/img/logo_sussex.svg` | **used** — the crest, badged on that photograph. 9 KB of line art with no `fill` of its own, so it renders black and needs the cream plate it is given |
| `img/og-card.jpg` | **used** — the social card, 1200×630 / 19 KB. `lab_banner_white.png` centred on the hero's black at 62% width. Referenced as an absolute URL — no social crawler resolves a relative one |
| `img/favicon.png`, `img/apple-touch-icon.png` | **used** — 48px / 180px, 1.5 and 5.9 KB. `lab_logo_black.png` cropped to `getbbox()`, then its lower 16% dropped to lose the Sussex wordmark, on the site's cream so the mark survives a dark tab bar |
| `img/brain.glb` | **used** — the hero's 3D brain, 5.7 MB. Repacked from Sketchfab's 13.2 MB (see the repack note at the foot of this file); CC-BY-4.0, dgallichan |
| `img/magritte_falsemirror.jpg` | **used** — the eye the Research zoom dives into (2000×1345; the pupil constants are measured off it) |
| `research/img/train_ciotat_loop.webp` | **used** — the Lumière brothers' *L'Arrivée d'un train*, behind the zoom's opening landmark. **Animated WebP**, 687 KB / 540 × 360 / 143 frames at 15fps, cut to the arrival alone (t = 3.8 → 13.6 of the source). It is a `background-image`, not a `<video>` — see [research-zoom.md](research-zoom.md), "The opening landmark", for why that was the fix rather than a preference. Regenerate from `train_ciotat.webm` with `-vf "fps=15,scale=540:-1:flags=lanczos,hqdn3d=5:5:8:8" -c:v libwebp_anim -q:v 50 -compression_level 6 -loop 0 -an`. **Do not swap it for a GIF**: the same cut at 360px, 10fps and 32 colours is 3 MB, because film grain defeats frame-delta compression. Not fetched before the gate opens, and never fetched at all below 900px or under reduced motion — measured, 0 requests |
| `research/img/train_ciotat_still.jpg` | **used** — one frame of the same clip (t = 11.2, the locomotive in frame), 13 KB / 540 × 360. What the stacked branch and reduced motion get in place of the loop, chosen in the stylesheet by the query that sets `--rz-mode: stack`. That branch used to get no film at all |
| `research/img/train_ciotat.webm`, `.mp4` | **source only** — 2.1 MB VP9/Opus and 1.35 MB H.264/AAC, both 540 × 360 / 51.7s, the full reel. Nothing on the page requests either any more; they are what the WebP and the still are cut from, and the 5.33 MB VP8 original is beside them as a gitignored `train_ciotat_full.webm`. **Untracked, so deleting them is not recoverable from git** — by this file's own rule they should either go or become `_full`-suffixed and gitignored, and that is a call for whoever next touches this |
| `research/img/era-galvanoscope.jpg` | **used** — Galvani's bimetallic-arc frog-leg experiment, the deck's fifth card. An anonymous 19th-century textbook plate on cream paper, so it needed the same dark remap as `era-wundt` once did: mean luminance **222.8 → 102.5**, into the paintings' 72–111 band. Cropped from a portrait `_full` (864 × 1024) to 4:3 at 900 × 675, dropping the French figure caption, which is illegible at card size anyway |
| `research/img/art_fake.jpg` | **used** — the AI-Beliefs pair, left card. 737×900, ~95 KB |
| `research/img/art_real.jpg` | **used** — same pair, right card. 717×900, ~125 KB |
| `research/img/era-*.jpg` | **used** — all seven cards of the Metascience deck, ~810 KB between them, in deck order: `era-folly` (Bosch), `era-pinel` (Robert-Fleury), `era-phrenology`, `era-charcot` (Brouillet), `era-galvanoscope`, `era-wundt`, `era-lab`. All 900 × 675 / q82 except `era-wundt`, which is 684 × 513 — the whole of what its source had, and **never upscale**: the budget is a ceiling. Each is beside its own gitignored `_full`, cropped to *exactly* 4:3 so nothing is squeezed — **and the card's ratio is 4/3 because of that**, not the other way round: changing it would `cover` these and quietly cut seven chosen crops. `era-wundt` is the Leipzig laboratory with Wundt in it, which replaced a trade engraving of a bare chronoscope — the room was always what the station claimed. `era-lab` is the lab's own multimodal session, the one card that is not historical and the one the run ends on, which is the point of it. Every card has a picture, so the `ERA_ARTS` drawings are a fallback nothing takes — see [research-zoom.md](research-zoom.md) |
| `research/img/copernicus.jpg` | **unused** — was the Inventions plate until that row went light; nothing requests it now. 1600×1151, 220 KB, and its 4000×2877 / 2.3 MB original is beside it as a gitignored `_full`, so the web copy is regenerable and safe to delete. Still committed, which is the one thing here that breaks the "nothing no page requests is in the repository" rule |
| `publications/*/*.pdf` | **used** — 40 papers, 58.9 MB, copied byte for byte (no ghostscript/qpdf/pikepdf here). Fetched only when a reader presses the badge, so this is clone weight, not page weight |
| `publications/*/featured.{jpg,png}` | **used** — 41 figures, 2.3 MB. 39 imported from the old site's `content/publication/*/featured.*` by `tools/import_publication_assets.py`, 19.9 MB → 2.1 MB. See the recipe below |
| `research/img/*_full.jpg`, `*_full.png` | source only — gitignored, kept on disk so a web copy can be regenerated. Every `logo-*.png` has one |
| `research/img/logo-*.png` | **used** — the Creations cards' pictures, one per tool. Eleven files, 1.07 MB between them (15–188 KB each), each beside its own gitignored `_full`. They were the `_full`s: 9.2 MB, `logo-neuropsyxart.png` alone 4500×4500 / 5.7 MB. See the recipe below |
| `news/2025-ai-faces-in-the-news/featured.webp` | **used** — copied from the old site unchanged, 25 KB |
| `news/2025-interoception-questionnaires/featured.jpg` | **used** — re-encoded from the old site's 2.2 MB `featured.png` at 1400px / q82 |
| `news/2025-interoception-questionnaires/mint.jpg` | **used** — same, from a 679 KB PNG at 1100px |
| `news/2025-interoception-questionnaires/ans.webp` | **used** — copied unchanged, already 118 KB |
| `news/2023-new-logo/matrix-*.gif` | **used** — 2.4 / 4.4 MB originals cut to ~700 KB: 360px wide, every third frame, 64 colours |
| `news/2023-new-logo/*.png, TheDoors.jpg` | **used** — copied unchanged, 8–125 KB each |
| `news/2026-cognitive-elegance/rubin-clip.gif` | **used** — the Rubin clip, in the body at `width: 30%`, floated right. 2.7 MB original at 965 KB: 240px, every fourth frame, 48 colours. **It is not called `featured.gif` any more**: a still now serves as the hero, and with both files present the hero would have been whichever extension `FEATURED_EXTENSIONS` happens to list first |
| `news/2026-cognitive-elegance/featured.jpg` | **used** — a still of the same clip, two stacked frames, so 4:5 and unusable as a hero raw: a 16:9 card crop shows only the band where the frames meet. The still is centred at 336×420 on a 1000×563 plate of `#e9f2ee` instead, sized to clear the hero's crop — its `max-height: 22rem` starts biting above a panel width of ~626px and shows only the middle ~77% of the height at the full 920px, so the still is 75% of the plate's height and never reaches the cut. The crop is vertical only, at every width. The 400×500 original is beside it as a gitignored `featured_full.jpg` |
| `news/2023-chatgpt-personality/featured.jpg` | **used** — re-encoded from a 2.8 MB PNG at 1400px |
| `news/2020-what-is-reality-bending/*.jpg` | **used** — hero, `don-quixote` and `wizard`, all re-encoded from 0.3–1.5 MB originals |
| `news/2026-event-triggers/featured.png` | **used** — copied unchanged, 100 KB |
| `memories/img/2026_ESCAN_Symposium.webp` | **used** — the symposium group photo again, 1400px on the long side / 131 KB, a second copy of the post's `speakers.jpg` because a memory's file has to live in this folder to be found |
| `news/2026-escan-symposium-artificial-emotion/featured.jpg`, `speakers.jpg` | **used** — the symposium's title slide, kept at its native 786px (upscaling a slide export only adds bytes) at 72 KB, and the group photo re-encoded from a 1206×1579 JPEG to 1100px on the long side, 139 KB |
| `news/2026-skeptic-agnostic-believer/featured.gif` | **used** — drawn, not photographed: `make_figure.py` beside it renders the frames with matplotlib and assembles the GIF with Pillow on one 48-colour palette. 1400×560, ~130 frames, ~460 KB — under the GIF budget despite the full hero width, because flat colour on cream compresses in a way a photographic GIF never does. Edit the script and re-run it rather than editing the image |
| `news/2024-most-cited-researcher/rg2025_september_november.png`, `rg2026_may_august.png` | **used** — the ResearchGate notices the post is about, at their native 598px, shown at `max-width: 60%` of the prose column (~384px, so still 1.5×). Quantised to a 64-colour palette on the way in: flat UI screenshots, so 122 and 115 KB of RGBA came down to 27 KB each with nothing visibly changed |
| `news/2024-rob-dickinson-impact-award/featured.jpg` | **used** — Rob's own `people/rob-dickinson/avatar.png`, which is a circle on transparency: dropped straight in, a 16:9 hero crop would have sliced the face and shown four transparent wedges. Composited instead at 1000×563 on `#e9f2ee` — the section's cream under the tint `.news-article__hero` paints behind a picture that does not fill it. **The circle is 420px, not larger**, because the reader's hero runs to ~2.3:1 and only the middle ~77% of a 16:9 plate survives that crop; a fuller medallion came out as a capsule. 1000px rather than 1400 because the avatar is 576px and upscaling only adds bytes |
| `news/2025-eva-mala-socobio-internship/featured.png` | **used** — the SoCoBio DTP mark on its own dark ground, 739×415 / 23 KB, as supplied. Its wordmark's lower line sits just inside the hero's crop; a taller plate would be safer if it is ever replaced |
| `news/2025-sam-marine-nhs-prize/featured.png` | **used** — the NHS wordmark, white on NHS Blue `#005eb8` at 1400×788 / 36 KB. Rendered from Wikimedia Commons' `National_Health_Service_(England)_logo.svg` (public domain as simple text and shapes; the mark itself is a UK trademark, so this is editorial use — see LICENSE). There is no rasteriser or Node on the machine this was built on, so the three glyph paths were flattened with a throwaway Pillow script rather than converted; the SVG is 1.2 KB and re-renderable from the same source if the plate ever needs another size |
| the fifteen posts ported from `content/post/` | **used** — every still re-encoded on the way in (1400px hero, 1100px in-body, q82); heroes land at 20–300 KB against originals up to 3.4 MB. GIFs copied unchanged where already under ~700 KB |
| `img/Intro.mp4` | source only, 54 MB — gitignored, and no longer in the repository. `encode_intro_bg.sh` takes its source as `$1` if you bring it back |


The two paintings are both by people, and which is which matters: `art_fake` is
the one viewers reliably call AI, `art_real` the one they call human. Swapping
the filenames silently inverts the demonstration. Regenerate the web copies from
the `_full` originals at 900px on the long side, quality 82. Both are portrait
at very close to 4:5, which is what `.rz-artworks__frame`'s `aspect-ratio` is
set to — replacing one with a differently shaped canvas means revisiting that
number, or the pair stops reading as one comparison.

## The size budget, and why it is not optional

Every image on the site is encoded to the largest size it is ever *displayed*
at, doubled for a 2× screen — not to whatever came off the camera:

| | budget | because |
|---|---|---|
| avatar | 700px | 188px in the profile panel, 156px in the People grid |
| memory photo | 1400px | the lightbox is `min(90vw, 960px)` |
| memory GIF | 480px wide | same, and see the GIF recipe below |
| post hero | 1400px | the reader panel is `min(920px, 100vw)` |
| post figure | 1100px | inside that panel's own column |
| section backdrop | 1600px | full-bleed |
| publication figure | 1000px | a 13rem column |
| collaborator | 400px | a small round portrait |
| tool logo | short side ~1000px | a 233px Creations card — generous on purpose, these are the pictures the row is made of |
| timeline plate | 900px wide | a 416px 4:3 frame at its widest, cropped to that ratio on the way in |

This is written down because the site drifted a very long way from it while
these notes were being careful about news images. Measured on a cold load the
page pulled **122 MB**, 106 MB of it images: a 20 MB GIF, a **14 MB avatar for a
156px thumbnail**, three memory GIFs totalling 52 MB. Re-encoding 22 files to
the table above took 99 MB down to 10.8 MB and nothing on screen changed.

Two things that were doing most of the damage, and are the first things to check
on any new asset:

- **A photograph saved as PNG.** Of the eleven PNGs over 400 KB here, exactly
  one used its alpha channel. The rest were JPEGs waiting to happen — the
  14 MB avatar became 80 KB. Test the channel (`getchannel("A").getextrema()`),
  do not assume from the extension; and when converting, the filename changes,
  so re-run the manifest script that resolves it (`update_people.py`,
  `update_publications.py`) or fix the hand-kept manifest
  (`collaborations_manifest.json`) and content module by hand.
- **A GIF nobody re-encoded.** The recipe is in the table above: width down
  first, every Nth frame with the swallowed delay added to the frame kept, and
  a 64-colour palette. Two PIL details cost real time — quantise every frame
  against **one shared palette**, or the encoder dies on "Transparency for P
  mode should be bytes or int" *after truncating the file it was writing*; and
  write to a temporary file and `replace()`, having `close()`d the source, or
  Windows refuses the rename and you are left with the zero-byte GIF.

### `img/brain.glb`: 13.2 MB → 5.7 MB with numpy and nothing else

It was the largest single asset and ~80% of a cold load. It needed no mesh
tool, no npm and no Blender, because most of its size was how Sketchfab wrote
it rather than what it contains — it is pure geometry, no textures, one
material, 215,601 verts / 377,701 tris. Three things, in order of size:

- **COLOR_0 was 3.45 MB the site never reads.** `makeBrainMaterial()` throws
  the glTF's own material away and builds a `MeshStandardMaterial` with
  `vertexColors` unset, so the per-vertex colours were decoded, uploaded to the
  GPU and ignored on every visit. Dropping the attribute is not lossy; it is
  dead data. **If the brain ever needs per-region vertex colour, this is the
  thing that was removed** — re-export from the source model rather than
  looking for it in the file.
- **The indices were u32 for meshes that already fit u16.** Sketchfab split the
  brain into primitives of exactly 65,532 vertices — the u16 limit — and then
  wrote 32-bit indices anyway. Halving them is lossless. Any replacement model
  is worth checking for the same thing.
- **NORMAL was f32**, now i8 normalized under `KHR_mesh_quantization`, which
  three.js's GLTFLoader reads natively. Because normals are *normalized*
  integers, no node transform changes — which is exactly why POSITION was left
  alone: quantising it means baking a dequantisation scale into the node
  hierarchy, and that is where a repack becomes surgery.

Measured against the original through the site's own three.js r167: identical
vertex count, triangle count, bounding box and centre, position delta exactly
0, worst normal error 0.376° over 5,830 sampled vertices.

The repack also strips `KHR_materials_pbrSpecularGlossiness`, which three.js
dropped in r160. `sanitizeBrainGlb` in `brain.js` rewrites the GLB's JSON chunk
at runtime to remove it — that is now a no-op on this file and could go, but it
is cheap and it is what makes a fresh Sketchfab export work, so it stays.

Further, if it is ever needed: **DracoPy** (`pip install DracoPy`, bundled
wheels, no npm) would reach ~1.5 MB, at the cost of shipping three's
`DRACOLoader` and a ~200 KB wasm decoder that must be fetched before anything
renders. Decimation below 377k triangles is the only genuinely lossy option and
needs trimesh or open3d.

Large originals are not committed, and `.gitignore` is what keeps it that way:
`*_full.jpg`, `*_full.png`, `*_full.webp` and `img/Intro.mp4`. **A source
arrives in whatever format it arrives in** — the timeline's plates came as a
`.webp` and a `.png` among the jpegs, and the `_full` rule has to cover the
extension or a 10 MB original walks into the repository. They stay on disk so a
derivative can be regenerated — `encode_intro_bg.sh` still takes its source as
`$1` — but nothing that no page requests is in the repository. This had drifted:
Intro.mp4 (54 MB) and every `*_full.jpg` were tracked, ~62 MB every clone paid
for. `img/sussex.png` (5.7 MB, superseded by `sussex-bg.jpg`) was the last one
left and has been deleted.

The same applies to **anything carried over from the old Hugo site**, which was
never size-conscious about post images — `content/post/` has a 3.4 MB PNG and a
2.8 MB GIF sitting in it. Re-encode on the way in and point the post's own
`content` at the new filename. Nothing enforces this; a post will happily
reference a 3 MB PNG.

- stills: 1400px on the long side for a hero, ~1100px for an in-body figure,
  quality 82
- tool logos (`research/img/logo-*.png`): keep the original as `_full`, which is
  gitignored, and write the web copy beside it. **Resize so the short side is
  ~1000px, never upscale, and cap the long side at 1600px** — that last one is
  for the extreme aspect ratios (`logo-sequentialsamplingmodels_full.png` is
  6000×2196, where the short-side rule alone asks for 2732px of wordmark).
  Then save an optimised PNG, and **only if it lands over ~400 KB**, try
  `im.quantize(colors=256, method=Image.FASTOCTREE)` — that is the mode that
  keeps alpha — and take it if it saves more than 30%. Six of the eleven are
  palette PNGs on those terms and none of them bands: these are flat-colour
  marks, and even the generative line drawing (`logo-neuropsyxart`, 4500×4500 /
  5.7 MB → 1000×1000 / 131 KB) survives it. Check the result by eye at full
  size before keeping it; a quantised gradient is the failure mode to look for.
- older logos came from the Hugo site's `featured.png`s. NeuroKit2's already had
  an alpha channel; **Pyllusion's was flat on white and had to be
  un-composited**, not keyed out — a threshold leaves a white fringe on every
  antialiased edge. For a flat-white background,
  `A = 1 - min(R,G,B)/255` and `F = (C - (1-A)·255) / A` is exact, and the
  magenta survives it. Then crop to `getbbox()` before resizing, or the card's
  picture is mostly the original's margin.
- publication figures imported from the old site
  (`tools/import_publication_assets.py`): the two trees share no key — old folders
  are citation keys (`makowski2015emotion`), new ones are
  `<year>_<FirstFourTitleWords>` — so the join is the DOI in the old front
  matter, falling back to an exact normalised title where they disagree, which
  15 of 39 do. Three things that made the first pass wrong and are guarded now:
  **one figure is a `.gif`** and was skipped in silence because the extension
  was not in the list, giving 37 imports where 38 were due — an unrecognised
  `featured.*` is now reported; **JPEG is the wrong format for several of
  these**, which are flat-colour diagrams and wordmarks, so both encodings are
  written and the smaller kept; and **a source already inside the budget is
  copied verbatim**, because some went through a PNG optimiser years ago that
  PIL cannot match and re-encoding turned 33 KB into 70 KB. Do not quantise
  these — by this file's own rule that is for files over ~400 KB, and the
  largest here is 159 KB. All 39 match now — `nicolas2017centenaire` did not
  until its DOI was added to `EXTRA_DOIS`, which is what an unmatched line
  usually means: a paper the manifest does not have rather than a broken join.
- **ffmpeg *is* available, and this file said for a long time that it was not.**
  Not on `PATH`, which is where the belief came from — it ships inside the
  `imageio-ffmpeg` wheel, and `py -c "import imageio_ffmpeg;
  print(imageio_ffmpeg.get_ffmpeg_exe())"` prints the path to a full build
  (libvpx-vp9, libx264, libopus, aac all present). That is what re-encoded the
  Ciotat film. Check there before concluding a video job cannot be done here.
- animated GIFs: PIL will resize one frame by
  frame. 360px wide, every third frame and a 64-colour adaptive palette took
  the two Matrix clips from 2.4 / 4.4 MB to ~700 KB, which is about as far as
  the format goes. They are only fetched when the post is opened.
  **Check the original's dimensions first.** The Cognitive Elegance GIF is
  286px wide, and a first pass at "420px, every third frame" made it *larger*
  than the 2.7 MB source — upscaling a GIF while re-quantising it is the worst
  of both. It came out at 965 KB once the width went down rather than up.

## Video backdrops need a silent audio track

**Chrome power-pauses media with no audio track** — "video-only background media
was paused to save power" — so it starts and then sticks on a frame. The
encoder muxes in `anullsrc` for a few KB to avoid that classification. Do not
"optimise" it back to `-an`.

Also: `preload="none"` leaves the fetch *suspended*. Raising `preload` to
`"auto"` does not reliably restart it and neither does `play()`; call
`video.load()` explicitly. And never swallow `play()` rejections — the console
message is what identifies these.
