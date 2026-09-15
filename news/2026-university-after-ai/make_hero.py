"""Render this post's hero: the debating-society photograph with a melted,
blood-red title bled across it.

    python make_hero.py                     # featured.gif, the animated hero
    python make_hero.py --still             # featured.jpg, one frame of it
    python make_hero.py --variant serif --out somewhere.gif

There is no melted-horror face on this machine, and shipping one would mean
shipping somebody else's licence, so the melt is procedural: the title is set
in a heavy stock face, its contour is roughened with two smooth noise fields,
and the drips are grown downward off the bottom contour, one bead at a time,
with a terminal blob. All of it happens at 4x and is downsampled at the end -
that supersample is what keeps a roughened edge from aliasing into fringes.

**A drip is a spec, not a drawing**: `plan_drips` decides where each one starts,
how long it eventually runs, how it tapers and the exact random walk it wanders
along, and `paint_drips` then draws the first `grow` of that walk. One number
per frame is the whole animation, and the still is `grow = STILL`.

Edit this script and re-run it rather than editing the images. The source
photograph is the gitignored featured_full.jpg beside it, so a fresh clone has
the hero but not the means to rebuild it - the same trade every _full here makes.
"""

import argparse
import os
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    HERE = Path(__file__).resolve().parent
except NameError:                                # a notebook cell has no __file__
    HERE = Path.cwd()

RAW = HERE / "featured_full.jpg"
SS = 4                                           # supersample factor
SEED = 20260915

FONTS = Path("C:/Windows/Fonts")

# The animation, as (grow, drip alpha, milliseconds) per frame. It opens on the
# finished title and holds there: that frame is the one a social crawler shows
# for an `og:image` that happens to be a GIF, and it is the frame `--still`
# writes, so the poster and the animation cannot drift apart.
HOLD_MS = 1500
DRAIN, RUN = 7, 15
OVERRUN = 1.12                                   # how far past the still the drain runs
STILL = 1.0 / OVERRUN                            # `grow` at which a drip is "finished"

# Every drip is planned to its drained length and `grow` is the fraction of it
# that is painted, so STILL - not 1.0 - is the state the poster is in. Passing
# 1.0 for the still is the easy mistake: it renders every drip 12% long.

# GIF palette. 64 real colours - a greyscale photograph plus one red - and the
# last index kept back for the frame-to-frame delta. 64 is the repository's
# standing GIF recipe and it holds here: at 4x magnification 64 and 255 are not
# tellable apart on this picture, because the film grain dithers it already, and
# 255 costs 122 KB more. The clear index is bright green because nothing in this
# picture is within reach of it, so no pixel is quantised onto the index that
# means "unchanged".
PALETTE_COLOURS = 64
CLEAR = 255                                      # the last palette slot, whatever PALETTE_COLOURS is
CLEAR_RGB = (0, 255, 0)

VARIANTS = {
    # Condensed poster capitals, long heavy drips.
    "impact": dict(
        font=FONTS / "impact.ttf",
        lines=["THE FUTURE OF", "UNIVERSITY?"],
        widths=[0.52, 0.88],
        track=[0.06, 0.06],
        rough=2.4,
        # The first line's drips are short by design and clamped by layout() on
        # top of that - see clamp_drips.
        drip_len=[(4, 12), (14, 46)],
        drip_gap=[22, 17],
        drip_p=[0.50, 0.78],
    ),
    # Gothic serif, mixed case, fewer and shorter drips - a book plate that has
    # started to run rather than a poster.
    "serif": dict(
        font=FONTS / "georgiab.ttf",
        lines=["The Future of", "University?"],
        widths=[0.50, 0.88],
        track=[0.02, 0.02],
        rough=2.0,
        drip_len=[(5, 14), (11, 42)],
        drip_gap=[26, 21],
        drip_p=[0.40, 0.62],
    ),
    # Roman capitals, roughened hardest - the most decayed of the three.
    "times": dict(
        font=FONTS / "timesbd.ttf",
        lines=["THE FUTURE OF", "UNIVERSITY?"],
        widths=[0.54, 0.90],
        track=[0.05, 0.05],
        rough=3.2,
        drip_len=[(6, 18), (15, 46)],
        drip_gap=[24, 18],
        drip_p=[0.48, 0.72],
    ),
}


# ---------------------------------------------------------------- typesetting

def line_width(font, text, track_px):
    return sum(font.getlength(c) for c in text) + track_px * max(0, len(text) - 1)


def fit_font(path, text, target_px, track_frac):
    """The largest size whose tracked line is target_px wide."""
    lo, hi = 8, 900
    while lo < hi - 1:
        mid = (lo + hi) // 2
        f = ImageFont.truetype(str(path), mid)
        if line_width(f, text, track_frac * mid) <= target_px:
            lo = mid
        else:
            hi = mid
    f = ImageFont.truetype(str(path), lo)
    return f, line_width(f, text, track_frac * lo)


def render_line(path, text, target_px, track_frac):
    """A tight L-mode mask of one tracked line, cropped to its ink."""
    font, width = fit_font(path, text, target_px, track_frac)
    track = track_frac * font.size
    pad = int(font.size * 0.6)
    canvas = Image.new("L", (int(width) + 2 * pad, int(font.size * 2.4) + 2 * pad), 0)
    draw = ImageDraw.Draw(canvas)
    x = float(pad)
    baseline = pad + font.size * 1.4
    for ch in text:
        draw.text((x, baseline), ch, font=font, fill=255, anchor="ls")
        x += font.getlength(ch) + track
    return canvas.crop(canvas.getbbox())


# ------------------------------------------------------------------- the melt

def smooth_noise(rng, shape, scale):
    """A bicubic-upsampled random field in [-0.5, 0.5]."""
    h, w = shape
    small = rng.random((max(2, int(h / scale)), max(2, int(w / scale))), dtype=np.float32)
    up = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(up, dtype=np.float32) / 255.0 - 0.5


def rough_field(rng, shape, amount_px):
    """The displacement the contour is roughened by - drawn once, used every frame."""
    amt = amount_px * SS
    dx = (smooth_noise(rng, shape, 22 * SS) * amt * 2.0
          + smooth_noise(rng, shape, 6 * SS) * amt * 0.7)
    dy = (smooth_noise(rng, shape, 26 * SS) * amt * 2.0
          + smooth_noise(rng, shape, 7 * SS) * amt * 0.7)
    h, w = shape
    ys, xs = np.mgrid[0:h, 0:w]
    return (np.clip(ys + dy, 0, h - 1).astype(np.int32),
            np.clip(xs + dx, 0, w - 1).astype(np.int32))


def roughen(mask, field):
    sy, sx = field
    return Image.fromarray(np.asarray(mask, dtype=np.uint8)[sy, sx])


def crisp(mask, blur_px=0.85):
    """Knit the beads into the glyph, then pull the edge back to a hard one."""
    a = np.asarray(mask.filter(ImageFilter.GaussianBlur(blur_px * SS)), dtype=np.float32) / 255.0
    return np.clip((a - 0.45) / 0.22, 0, 1)


def dilate_soft(m, radius, floor=0.34):
    """A blurred-and-clipped spread, standing in for a dilation.

    `MaxFilter` at the width this outline needs is 2 seconds a call at 4x, which
    at 23 frames is the whole render; a Gaussian is 0.02s and the difference at
    a one-pixel rim is not visible.
    """
    img = Image.fromarray((np.clip(m, 0, 1) * 255).astype(np.uint8))
    a = np.asarray(img.filter(ImageFilter.GaussianBlur(radius)), dtype=np.float32) / 255.0
    return np.clip(a / floor, 0, 1)


def stem_width(ink, x, y):
    """How wide the stroke is at (x, y) - the drip is a fraction of it."""
    h, w = ink.shape
    row = ink[max(0, min(h - 1, y))]
    left = right = x
    while left > 0 and row[left - 1]:
        left -= 1
    while right < w - 1 and row[right + 1]:
        right += 1
    return right - left + 1


def plan_drips(mask, rng, length_px, gap_px, probability):
    """Where the drips start and the whole path each one will eventually take.

    Nothing is drawn here. The random walk is rolled out to its full length once
    so that a half-grown drip is the *prefix* of the finished one - roll it per
    frame instead and the drip wriggles as it runs.
    """
    ink = np.asarray(mask, dtype=np.uint8) > 127
    h, w = ink.shape
    has = ink.any(axis=0)
    bottom = np.where(has, h - 1 - np.argmax(ink[::-1, :], axis=0), -1)

    # The lowest ink in a column is not always an edge liquid could hang from.
    # Between the I and the T of UNIVERSITY the lowest ink is the T's *crossbar*,
    # and a drip grown off it runs down through the gap between the two letters
    # and welds them into one blob - which is what the word did before this test
    # existed. So a seed also has to sit near the baseline its neighbours sit on,
    # not merely lower than the columns either side of it.
    reach = max(1, int(0.30 * h))
    baseline = np.array([bottom[max(0, x - reach):x + reach].max() for x in range(w)])
    hangs = bottom >= baseline - 0.10 * h

    lo_len, hi_len = length_px[0] * SS, length_px[1] * SS
    gap = gap_px * SS
    drips = []

    x = 0
    while x < w:
        if not has[x] or not hangs[x]:
            x += 1
            continue
        near = bottom[max(0, x - 7 * SS):min(w, x + 7 * SS)]
        if bottom[x] < near.max() - SS:           # only where the glyph hangs lowest
            x += 1
            continue
        if rng.random() > probability:
            x += int(gap * 0.5)
            continue

        y0 = int(bottom[x])
        stem = stem_width(ink, x, y0 - 3 * SS)
        length = rng.uniform(lo_len, hi_len) * OVERRUN
        w_top = max(1.7 * SS, stem * rng.uniform(0.32, 0.52))
        w_end = max(1.1 * SS, w_top * rng.uniform(0.34, 0.62))

        steps = max(3, int(length))
        # Clamped at every step, not once over the cumulative sum: an unbounded
        # walk of 200 steps wanders far enough to smear a drip sideways across
        # the letter beside it, and clipping only the total does not stop it.
        drift, walk = np.empty(steps, dtype=np.float32), 0.0
        for i, step in enumerate(rng.normal(0, 0.09, steps) * SS):
            walk = float(np.clip(walk + step, -1.7 * SS, 1.7 * SS))
            drift[i] = walk
        drips.append(dict(x=x, y0=y0, length=length, steps=steps, drift=drift,
                          w_top=w_top, w_end=w_end, bead=rng.uniform(1.0, 1.8)))
        x += int(gap * rng.uniform(0.85, 1.7))
    return drips


def drip_width(d, t):
    return d["w_top"] + (d["w_end"] - d["w_top"]) * (t ** 0.7)


def clamp_drips(drips, limit):
    """Stop a line's drips before they reach the line below.

    The first line's drips have to stay out of the caps of the second or the
    counters fill in and the word is a blob at the index card's ~385px. This is
    the constraint, enforced; leaving it to the drawn lengths happening to be
    shorter than the gap is how it silently stopped holding.
    """
    kept = []
    for d in drips:
        room = limit - d["y0"] - d["w_end"] * d["bead"] * 1.65
        if room < 3 * SS:
            continue
        d["length"] = min(d["length"], room)
        d["steps"] = max(3, int(d["length"]))
        kept.append(d)
    return kept


def drip_extent(drips, grow):
    """How far below its origin the lowest drip reaches - the crop has to clear it."""
    low = 0
    for d in drips:
        t = min(1.0, grow)
        tip = d["y0"] + t * d["length"]
        low = max(low, tip + drip_width(d, t) * d["bead"] * 1.65)
    return low


def paint_drips(size, drips, grow, offset=(0, 0)):
    """Draw the first `grow` of every planned drip onto a fresh mask."""
    canvas = Image.new("L", size, 0)
    draw = ImageDraw.Draw(canvas)
    ox, oy = offset
    for d in drips:
        n = int(d["steps"] * min(1.0, grow))
        if n < 2:
            continue
        xx = yy = width = 0.0
        for i in range(n):
            t = i / (d["steps"] - 1)
            width = drip_width(d, t)
            xx = d["x"] + d["drift"][i] + ox
            yy = d["y0"] + t * d["length"] + oy
            draw.ellipse([xx - width / 2, yy - width / 2,
                          xx + width / 2, yy + width / 2], fill=255)
        bead = width * d["bead"]                  # the drop rides at the leading edge
        draw.ellipse([xx - bead, yy - bead * 0.35, xx + bead, yy + bead * 1.65], fill=255)
    return canvas


# ----------------------------------------------------------------- the layout

def layout(cfg, W, H, rng):
    """Place the lines on the frame and plan every drip, in 4x frame coordinates."""
    big = (W * SS, H * SS)
    lines = []
    for i, text in enumerate(cfg["lines"]):
        ink = render_line(cfg["font"], text, cfg["widths"][i] * W * SS, cfg["track"][i])
        drips = plan_drips(ink, rng, cfg["drip_len"][i], cfg["drip_gap"][i], cfg["drip_p"][i])
        lines.append((ink, drips))
    gap = int(0.045 * H * SS)
    for i, (ink, drips) in enumerate(lines[:-1]):
        lines[i] = (ink, clamp_drips(drips, ink.height + gap * 0.82))

    # Stack the lines, then centre the block by its measured extent rather than
    # by a guess at how far the drips ran. The reader's hero keeps only the
    # middle ~58% of this picture's height, so everything that has to survive
    # the crop lives there - build() prints the clearance for both crops.
    tops, y = [], 0
    for ink, _ in lines:
        tops.append(y)
        y += ink.height + gap
    block_top = min(tops)
    block_bot = max(top + max(ink.height, drip_extent(drips, STILL))
                    for top, (ink, drips) in zip(tops, lines))
    y0 = int(big[1] * 0.5 - (block_bot - block_top) * 0.5) - int(0.012 * big[1])

    letters = Image.new("L", big, 0)
    placed = []
    for (ink, drips), top in zip(lines, tops):
        ox, oy = (big[0] - ink.width) // 2, y0 + top
        letters.paste(ink, (ox, oy), ink)
        placed += [dict(d, x=d["x"] + ox, y0=d["y0"] + oy) for d in drips]
    return letters, placed


# ----------------------------------------------------------------- the render

def bed_for(photo, m_max):
    """The dark ground the title sits on, painted once and reused by every frame.

    A soft halo, because the title crosses a pale floor *and* dark suits and has
    to read on both, plus a tight shadow to lift it off the grain. It is built
    from the drips at their longest and then held still: recomputing it per frame
    changes a 17px-blurred area around the whole title on every one of them, and
    those near-invisible changes were most of the GIF - 654 KB against 366 KB for
    the same animation with the ground nailed down, before the palette came down.
    """
    arr = np.asarray(photo, dtype=np.float32) / 255.0
    mimg = Image.fromarray((m_max * 255).astype(np.uint8))
    halo = np.asarray(mimg.filter(ImageFilter.GaussianBlur(17)), dtype=np.float32) / 255.0
    arr = arr * (1.0 - 0.60 * np.clip(halo * 2.6, 0, 1))[..., None]
    drop = ImageChops.offset(mimg, 2, 3).filter(ImageFilter.GaussianBlur(2.0))
    arr = arr * (1.0 - 0.72 * (np.asarray(drop, dtype=np.float32) / 255.0))[..., None]
    glow = np.asarray(mimg.filter(ImageFilter.GaussianBlur(7)), dtype=np.float32) / 255.0
    return arr, glow


def compose(bed, m, rng_noise):
    """Paint one mask onto the prepared ground: outline, blood, glow."""
    ground, glow = bed
    H, W = m.shape
    arr = ground

    outline = np.clip(dilate_soft(m, 1.15) - m, 0, 1)

    # Blood: brightest at the top of the block, drying towards the drips.
    rows = np.where(m.max(axis=1) > 0.02)[0]
    top, bot = (rows[0], rows[-1]) if len(rows) else (0, H - 1)
    t = np.clip((np.arange(H) - top) / max(1, bot - top), 0, 1)[:, None]
    red = np.stack([
        (0.855 + (0.400 - 0.855) * t) * np.ones((1, W)),
        (0.125 + (0.031 - 0.125) * t) * np.ones((1, W)),
        (0.118 + (0.047 - 0.118) * t) * np.ones((1, W)),
    ], axis=-1)
    red = np.clip(red * (1.0 + rng_noise * 0.22)[..., None], 0, 1)

    arr = arr * (1 - outline[..., None]) + np.array([0.094, 0.016, 0.020]) * outline[..., None]
    arr = arr * (1 - m[..., None]) + red * m[..., None]
    arr = arr + np.array([0.30, 0.02, 0.03]) * (glow * (1 - m))[..., None] * 0.55

    return Image.fromarray((np.clip(arr, 0, 1) * 255).astype(np.uint8)), top, bot


def report(W, H, top, bot):
    """The two crops this picture has to survive, printed rather than discovered
    in the browser: the index card takes 16:9, the reader's hero takes the
    picture's own ratio under `max-height: 22rem` in a panel up to 920px wide.
    Both are centred, so both cut vertically only."""
    for name, kept in (("card", (W * 9 / 16) / H), ("hero", min(1.0, 352 / (920 * H / W)))):
        lo, hi = H * (1 - kept) / 2, H * (1 + kept) / 2
        clear = min(top - lo, hi - bot)
        print(f"  {name}: keeps y {lo:.0f}-{hi:.0f}, ink {top}-{bot}, "
              f"{clear:+.0f}px clearance [{'ok' if clear > 0 else 'CUT'}]")


def frames_for(variant):
    """Every frame of the loop, as (grow, drip alpha, duration) - opening on the
    finished title, draining the last of it off the bottom, then running again.

    It drains rather than retracting, and the drips keep lengthening while they
    fade: blood flowing back up a letter reads as a video played backwards, and
    the eye catches it immediately.
    """
    plan = [(STILL, 1.0, HOLD_MS)]
    for i in range(1, DRAIN + 1):
        t = i / DRAIN
        plan.append((STILL + (1.0 - STILL) * t, 1.0 - t, 70))
    for i in range(1, RUN + 1):                   # the last one wraps to frame 0
        t = i / (RUN + 1)
        plan.append(((1 - (1 - t) ** 2.2) * STILL, 1.0, 55))
    return plan


def build(variant, out_path, still):
    cfg = VARIANTS[variant]
    rng = np.random.default_rng(SEED)

    photo = Image.open(RAW).convert("RGB")
    W, H = photo.size
    big = (W * SS, H * SS)

    letters, drips = layout(cfg, W, H, rng)
    field = rough_field(rng, (big[1], big[0]), cfg["rough"])
    texture = smooth_noise(rng, (H, W), 9)

    def mask_at(grow, alpha):
        """Letters plus `alpha` of the drips, roughened, crisped, downsampled."""
        union = ImageChops.lighter(letters, paint_drips(big, drips, grow))
        m = crisp(roughen(union, field))
        full = np.clip(np.asarray(
            Image.fromarray((m * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS),
            dtype=np.float32) / 255.0, 0, 1)
        if alpha >= 1.0:
            return full
        return np.clip(mask_letters + alpha * np.clip(full - mask_letters, 0, 1), 0, 1)

    m = crisp(roughen(letters, field))
    mask_letters = np.clip(np.asarray(
        Image.fromarray((m * 255).astype(np.uint8)).resize((W, H), Image.LANCZOS),
        dtype=np.float32) / 255.0, 0, 1)

    bed = bed_for(photo, mask_at(1.0, 1.0))
    if still:
        frame, top, bot = compose(bed, mask_at(STILL, 1.0), texture)
        # 4:4:4 - chroma subsampling smears a saturated red edge against grey.
        frame.save(out_path, "JPEG", quality=86, subsampling=0, optimize=True, progressive=True)
        print(f"\u2713 {out_path.name} - {variant} still, {W}x{H}, "
              f"{out_path.stat().st_size / 1024:.0f} KB")
        report(W, H, top, bot)
        return

    plan = frames_for(variant)
    rgb, lo_ink, hi_ink = [], H, 0
    for grow, alpha, _ in plan:
        frame, top, bot = compose(bed, mask_at(grow, alpha), texture)
        rgb.append(frame)
        lo_ink, hi_ink = min(lo_ink, top), max(hi_ink, bot)
    write_gif(rgb, [d for _, _, d in plan], out_path)
    print(f"\u2713 {out_path.name} - {variant} animation, {W}x{H}, {len(rgb)} frames, "
          f"{sum(d for _, _, d in plan) / 1000:.1f}s loop, "
          f"{out_path.stat().st_size / 1024:.0f} KB")
    report(W, H, lo_ink, hi_ink)


def write_gif(rgb, durations, out_path):
    """One shared palette, and every unchanged pixel written as the clear index.

    Both halves matter. Quantising each frame on its own palette is what makes
    the encoder die on "Transparency for P mode should be bytes or int" *after*
    truncating the file it was writing. And the photograph behind the title never
    moves, so paying for it once and sending only the drips is the difference
    between a GIF that fits the budget and one that is five times over it.
    """
    ref = rgb[0].quantize(colors=PALETTE_COLOURS, method=Image.MEDIANCUT)
    pal = ref.getpalette()[: PALETTE_COLOURS * 3] + list(CLEAR_RGB)
    ref.putpalette(pal)

    quantised = [f.quantize(palette=ref, dither=Image.Dither.NONE) for f in rgb]
    arrays = [np.asarray(q, dtype=np.uint8) for q in quantised]

    frames = [quantised[0]]
    for i in range(1, len(arrays)):
        a = arrays[i].copy()
        a[a == arrays[i - 1]] = CLEAR
        frame = Image.new("P", quantised[i].size)
        frame.frombytes(a.tobytes())
        frame.putpalette(pal)
        frames.append(frame)

    # Written to a temporary file and renamed: with the source still open,
    # Windows refuses the rename and leaves a zero-byte GIF behind.
    tmp = out_path.with_suffix(".gif.tmp")
    frames[0].save(tmp, "GIF", save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, disposal=1,
                   transparency=CLEAR, optimize=False)
    os.replace(tmp, out_path)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--variant", default="impact", choices=sorted(VARIANTS))
    ap.add_argument("--still", action="store_true", help="write one JPEG frame instead")
    ap.add_argument("--out", type=Path)
    args = ap.parse_args()
    out = args.out or (HERE / ("featured.jpg" if args.still else "featured.gif"))
    build(args.variant, out, args.still)
