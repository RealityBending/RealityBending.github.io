"""The pictures for this post. Run from anywhere; writes beside itself.

nativity.webp  the nativity scene and its star, side by side
featured.jpg   the same pair, plated for the hero and card crops
codex.webp     the Codex Udolphus page
diagram.webp   the columbarium, a page drawn for this post
boundary.webp  a deep zoom into the edge of the Mandelbrot set

The first three come from Ray Girvan's "The Mandelbrot Monk" (1999), via the
Internet Archive. The originals are cached beside this file as gitignored
*_full.jpg and downloaded again if missing.
"""

import sys
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
try:
    HERE = Path(__file__).resolve().parent
except NameError:
    HERE = Path.cwd()

ARCHIVE = "https://web.archive.org/web/{}im_/http://classes.yale.edu/{}/MandelMonk/{}"
SOURCES = {
    "codex_full.jpg": ARCHIVE.format("20040923120143", "fractals/Mandelset", "codex.jpg"),
    "nativity_full.jpg": ARCHIVE.format("20030513012404", "Fractals/MandelSet", "nativit.jpg"),
    "udomag_full.jpg": ARCHIVE.format("20040923124949", "fractals/Mandelset", "udomag.jpg"),
}


def source(name):
    path = HERE / name
    if not path.exists():
        urllib.request.urlretrieve(SOURCES[name], path)
    return Image.open(path).convert("RGB")


# --- nativity.webp ----------------------------------------------------------
# Both pictures lose the pink frame and their captions; the gap between them is
# transparent so it takes whatever the prose sits on.
scene = source("nativity_full.jpg").crop((16, 16, 238, 228))
star = source("udomag_full.jpg").crop((0, 36, 262, 272))
star = star.resize((round(star.width * scene.height / star.height), scene.height), Image.LANCZOS)
gap = 10
pair = Image.new("RGBA", (scene.width + gap + star.width, scene.height), (0, 0, 0, 0))
pair.paste(scene, (0, 0))
pair.paste(star, (scene.width + gap, 0))
pair.save(HERE / "nativity.webp", quality=85)

# --- featured.jpg -----------------------------------------------------------
# The same pair, its gap filled by the plate. Kept at its native size (the
# budget is a ceiling) and 72% of the plate height, so it clears the hero's
# middle-~77% crop as well as the card's 16:9.
plate_h = round(pair.height / 0.72)
plate = Image.new("RGB", (round(plate_h * 16 / 9), plate_h), (23, 23, 23))
plate.paste(pair, ((plate.width - pair.width) // 2, (plate.height - pair.height) // 2), pair)
plate.save(HERE / "featured.jpg", quality=88, subsampling=0)

# --- codex.webp -------------------------------------------------------------
# The page without the original's pink frame and its pasted-on caption box,
# which sat in the bottom margin under the text. Native size, shown at it.
source("codex_full.jpg").crop((8, 4, 256, 287)).save(HERE / "codex.webp", quality=85)

# --- meme.webp --------------------------------------------------------------
# The unmasking meme, from the author's own PNG (gitignored as meme_full.png).
# Shown at max-width 50% of the prose column (320px), so its native 500px is
# already more than 1.5x; re-encoded, not resized.
if (HERE / "meme_full.png").exists():
    Image.open(HERE / "meme_full.png").convert("RGB").save(HERE / "meme.webp", quality=82)

# --- diagram.webp -----------------------------------------------------------
# The columbarium, from the author's own generated page (gitignored as
# diagram_full.jpg). Cropped just inside the page, which drops the white
# surround, its rounded corners and the sliver of the facing page on the right;
# the hellmouth bleeding off the left edge loses a few pixels. Native size,
# already under the figure budget.
if (HERE / "diagram_full.jpg").exists():
    page = Image.open(HERE / "diagram_full.jpg").convert("RGB").crop((22, 20, 820, 1238))
    page.save(HERE / "diagram.webp", quality=80)

# --- boundary.webp ----------------------------------------------------------
# "Seahorse valley", a window a thousandth the width of Udo's 2.5-unit frame.
W, H, MAXIT = 1100, 620, 1500
cx, cy, width = -0.743643887, 0.131825904, 0.0025
re = np.linspace(cx - width / 2, cx + width / 2, W)
im = np.linspace(cy + width * H / W / 2, cy - width * H / W / 2, H)
C = re[None, :] + 1j * im[:, None]
Z = np.zeros_like(C)
it = np.full(C.shape, MAXIT, float)
alive = np.ones(C.shape, bool)
for k in range(MAXIT):
    Z[alive] = Z[alive] ** 2 + C[alive]
    esc = alive & (np.abs(Z) > 2)
    it[esc] = k + 1 - np.log2(np.log(np.abs(Z[esc])))  # smooth escape count
    alive &= ~esc
s = np.log1p(it) / np.log1p(MAXIT)
s = (s - s[~alive].min()) / (s[~alive].max() - s[~alive].min())
stops = [0, 0.45, 0.8, 1]
palette = np.array([[10, 18, 42], [34, 62, 140], [214, 168, 66], [250, 236, 200]])
rgb = np.stack([np.interp(s, stops, palette[:, c]) for c in range(3)], -1)
rgb[alive] = (8, 10, 20)
Image.fromarray(rgb.astype(np.uint8)).save(HERE / "boundary.webp", quality=82)

for name in ("nativity.webp", "featured.jpg", "codex.webp", "meme.webp", "diagram.webp", "boundary.webp"):
    with Image.open(HERE / name) as done:
        print(f"{name}: {done.width}×{done.height}, {(HERE / name).stat().st_size // 1024} KB")
