"""Draws featured.gif for "Lighthouse plots: shining a light on differences".

    python news/2026-lighthouse-plots/make_featured.py

A lighthouse turns its beam. While the beam points elsewhere, the plot shows
two conditions with overlapping intervals and a smug face calls it obviously
non-significant. When the beam lands on the plot it reveals each participant's
two scores joined by a line, every one of them rising, and the face changes
its mind.

Drawn with Pillow at 2x and downsampled, then quantised on one shared palette.
Needs smugface.jpg and surprisedface.jpg beside it, and Impact (any bold font
will do: see FONT_CANDIDATES).
"""

import math
import os
import sys

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont
from scipy import stats

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:
    HERE = os.getcwd()

# ── Canvas & timing ──
W, H = 1120, 630  # 16:9, the card's own crop
SS = 2  # drawn at 2x, downsampled
COLOURS = 96  # GIF palette
STEP = 70  # ms per moving frame

FONT_CANDIDATES = [
    "C:/Windows/Fonts/impact.ttf",
    "/Library/Fonts/Impact.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/Impact.ttf",
    "C:/Windows/Fonts/ariblk.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]

# ── Colours ──
SKY = [(12, 22, 42), (15, 28, 52), (19, 35, 63)]  # three flat bands, top down
SEA = (8, 17, 34)
WAVE = (36, 62, 104)
ROCK = (27, 33, 46)
STAR = (196, 208, 232)
MOON = (246, 236, 200)
PANEL = (22, 38, 68)
AXIS = (150, 166, 194)
BLUE = (74, 148, 242)
ORANGE = (246, 128, 72)
BEAM = (255, 228, 128)
LINE = (255, 255, 255)
LAMP = (255, 212, 90)
TOWER_RED = (212, 54, 56)
TOWER_WHITE = (241, 236, 226)
DARK = (28, 31, 38)
RED = (228, 36, 42)
INK = (14, 14, 14)
WHITE = (255, 255, 255)

# ── Geometry (final pixels) ──
LX, LY = 100, 348  # the lamp
BEAM_LEN, BEAM_HALF = 1000, 600  # reach and half-height at full reach
PLOT = (285, 132, 678, 548)  # the panel
Y_TOP, Y_BOTTOM = 160, 478  # where scores land
SCORE_LO, SCORE_HI = 24, 80
X_A, X_B = 402, 562  # the means, at the violins' flat edges
X_RAW_A, X_RAW_B = 422, 542  # the participants, inside them
BUBBLE = (700, 48, 1098, 224)
FACE_RIGHT, FACE_BOTTOM = 1096, 650
ARROW = ((694, 246), (612, 186), (500, 290))  # start, control, tip


def P(*xy):
    """Final pixels to drawing pixels."""
    return tuple(int(round(v * SS)) for v in xy)


def font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            return ImageFont.truetype(path, int(size * SS))
    raise SystemExit("No bold font found: add one to FONT_CANDIDATES.")


def dilate(mask, r):
    """Round dilation by about r drawing pixels: blur, then a low threshold."""
    return mask.filter(ImageFilter.GaussianBlur(r / 2)).point(lambda v: 255 if v > 6 else 0)


def layer():
    return Image.new("RGBA", (W * SS, H * SS), (0, 0, 0, 0))


def solid(colour, mask):
    out = Image.new("RGBA", mask.size, colour + (255,))
    out.putalpha(mask)
    return out


def y_of(score):
    return Y_BOTTOM - (score - SCORE_LO) / (SCORE_HI - SCORE_LO) * (Y_BOTTOM - Y_TOP)


# ── Data: everyone goes up, a little ──


def make_data(n=14):
    for seed in range(10_000):
        rng = np.random.default_rng(seed)
        a = rng.normal(50, 10, n)
        b = a + 3 + rng.normal(0, 1.5, n)
        uncrossed = (np.argsort(a) == np.argsort(b)).all()
        if uncrossed and (b - a).min() > 1.2 and a.min() > SCORE_LO + 4 and b.max() < SCORE_HI - 4:
            return a, b
    raise SystemExit("No seed found")


A, B = make_data()

# ── The still parts ──


def draw_background():
    img = Image.new("RGBA", (W * SS, H * SS), SKY[0] + (255,))
    d = ImageDraw.Draw(img)
    d.rectangle([*P(0, 250), *P(W, H)], fill=SKY[1])
    d.rectangle([*P(0, 430), *P(W, H)], fill=SKY[2])

    # stars, kept off the panel and the bubble
    rng = np.random.default_rng(7)
    keep_out = [PLOT, BUBBLE, (40, 270, 170, 640)]
    placed = 0
    while placed < 46:
        x, y = rng.uniform(10, W - 10), rng.uniform(10, 540)
        if any(x0 - 12 < x < x1 + 12 and y0 - 12 < y < y1 + 12 for x0, y0, x1, y1 in keep_out):
            continue
        r = rng.choice([1.1, 1.6, 2.3], p=[0.5, 0.35, 0.15])
        tone = tuple(int(c * rng.uniform(0.55, 1.0)) for c in STAR)
        d.ellipse([*P(x - r, y - r), *P(x + r, y + r)], fill=tone)
        placed += 1

    # a crescent moon
    mx, my, mr = 232, 92, 26
    d.ellipse([*P(mx - mr, my - mr), *P(mx + mr, my + mr)], fill=MOON)
    d.ellipse([*P(mx - mr + 12, my - mr - 6), *P(mx + mr + 12, my + mr - 6)], fill=SKY[0])

    # sea and waves
    d.rectangle([*P(0, 586), *P(W, H)], fill=SEA)
    rng = np.random.default_rng(3)
    for row, y in enumerate((598, 612, 625)):
        x = -40 + row * 23
        while x < W:
            length = rng.uniform(26, 60)
            d.arc([*P(x, y - 6), *P(x + length, y + 6)], 200, 340, fill=WAVE, width=2 * SS)
            x += length + rng.uniform(30, 70)
    return img


def draw_lighthouse(img):
    d = ImageDraw.Draw(img)
    # rocks
    d.polygon([P(18, 640), P(28, 598), P(52, 578), P(92, 570), P(140, 574), P(170, 590), P(186, 640)], fill=ROCK)
    # tower, tapering, in stripes
    bottom, top = 582, 380
    hw_bottom, hw_top = 42, 28
    bands = 6
    for i in range(bands):
        y0 = bottom - (bottom - top) * i / bands
        y1 = bottom - (bottom - top) * (i + 1) / bands
        w0 = hw_bottom + (hw_top - hw_bottom) * i / bands
        w1 = hw_bottom + (hw_top - hw_bottom) * (i + 1) / bands
        colour = TOWER_RED if i % 2 == 0 else TOWER_WHITE
        d.polygon([P(LX - w0, y0), P(LX + w0, y0), P(LX + w1, y1), P(LX - w1, y1)], fill=colour)
    # door and windows
    d.rounded_rectangle([*P(LX - 9, 552), *P(LX + 9, 582)], radius=8 * SS, fill=DARK)
    for y in (486, 420):
        d.rectangle([*P(LX - 5, y), *P(LX + 5, y + 14)], fill=DARK)
    # gallery and railing
    d.rectangle([*P(LX - 40, 370), *P(LX + 40, 382)], fill=DARK)
    d.line([P(LX - 38, 354), P(LX + 38, 354)], fill=DARK, width=3 * SS)
    for x in range(-36, 40, 12):
        d.line([P(LX + x, 354), P(LX + x, 370)], fill=DARK, width=2 * SS)
    # lamp room
    d.rectangle([*P(LX - 22, 330), *P(LX + 22, 370)], fill=LAMP)
    for x in (-22, -7, 7, 22):
        d.line([P(LX + x, 330), P(LX + x, 370)], fill=DARK, width=3 * SS)
    # roof
    d.polygon([P(LX - 32, 332), P(LX + 32, 332), P(LX, 298)], fill=TOWER_RED)
    d.ellipse([*P(LX - 6, 288), *P(LX + 6, 300)], fill=DARK)


def draw_plot(img):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = PLOT
    d.rounded_rectangle([*P(x0, y0), *P(x1, y1)], radius=18 * SS, fill=PANEL)
    d.line([P(x0 + 34, y0 + 18), P(x0 + 34, 494), P(x1 - 20, 494)], fill=AXIS, width=3 * SS, joint="curve")
    f = font(30)
    for x, label in ((X_A, "A"), (X_B, "B")):
        d.text(P(x, 522), label, font=f, fill=AXIS, anchor="mm")

    # half violins, facing outwards
    grid = np.linspace(SCORE_LO + 1, SCORE_HI - 1, 160)
    for scores, x, side, colour in ((A, X_A, -1, BLUE), (B, X_B, 1, ORANGE)):
        density = stats.gaussian_kde(scores)(grid)
        width = 74 * density / density.max()
        keep = width > 2
        edge = [P(x + side * w, y_of(s)) for s, w in zip(grid[keep], width[keep])]
        spine = [P(x, y_of(s)) for s in grid[keep][::-1]]
        violin = layer()
        ImageDraw.Draw(violin).polygon(edge + spine, fill=colour + (185,))
        img.alpha_composite(violin)


def draw_intervals(img):
    d = ImageDraw.Draw(img)
    for scores, x, colour in ((A, X_A, BLUE), (B, X_B, ORANGE)):
        m = scores.mean()
        half = 1.96 * scores.std(ddof=1) / math.sqrt(len(scores))
        top, bottom = y_of(m + half), y_of(m - half)
        d.line([P(x, top - 2), P(x, bottom + 2)], fill=INK, width=14 * SS)
        d.line([P(x, top), P(x, bottom)], fill=colour, width=9 * SS)
        r = 10
        d.ellipse([*P(x - r - 2, y_of(m) - r - 2), *P(x + r + 2, y_of(m) + r + 2)], fill=INK)
        d.ellipse([*P(x - r, y_of(m) - r), *P(x + r, y_of(m) + r)], fill=colour)


def draw_lines():
    out = layer()
    d = ImageDraw.Draw(out)
    for a, b in zip(A, B):
        d.line([P(X_RAW_A, y_of(a)), P(X_RAW_B, y_of(b))], fill=LINE + (240,), width=4 * SS)
    for a, b in zip(A, B):
        for x, s, colour in ((X_RAW_A, a, BLUE), (X_RAW_B, b, ORANGE)):
            r = 5.5
            d.ellipse([*P(x - r, y_of(s) - r), *P(x + r, y_of(s) + r)], fill=colour + (255,), outline=WHITE, width=SS)
    return out


def sticker(path, height, bottom=None):
    """The face cut out of its white page, with a white border, as RGBA."""
    src = Image.open(path).convert("L")
    if bottom:
        src = src.crop((0, 0, src.width, bottom))
    ink = src.point(lambda v: 255 if v < 140 else 0)
    closed = ink.filter(ImageFilter.MaxFilter(9))  # seal small gaps in the outline
    pad = 8
    canvas = Image.new("L", (src.width + 2 * pad, src.height + 2 * pad), 0)
    canvas.paste(closed, (pad, pad))
    # The foot of the picture counts as a wall, so a bust cut off by the
    # bottom edge stays solid instead of draining out through it.
    ImageDraw.Draw(canvas).rectangle([0, canvas.height - pad, canvas.width, canvas.height], fill=255)
    ImageDraw.floodfill(canvas, (0, 0), 128)
    inside = canvas.point(lambda v: 0 if v == 128 else 255).crop((pad, pad, pad + src.width, pad + src.height))
    box = inside.getbbox()
    face = Image.open(path).convert("RGB").crop((0, 0, src.width, src.height)).crop(box)
    inside = inside.crop(box)

    scale = height * SS / face.height
    size = (round(face.width * scale), round(face.height * scale))
    face, inside = face.resize(size, Image.LANCZOS), inside.resize(size, Image.LANCZOS)

    border = 9 * SS
    m = border + 24 * SS  # room for the shadow, which ImageChops.offset wraps
    full = Image.new("L", (size[0] + 2 * m, size[1] + 2 * m), 0)
    full.paste(inside, (m, m))
    rim = dilate(full, border)
    shadow = rim.filter(ImageFilter.GaussianBlur(5 * SS)).point(lambda v: v * 0.55)

    out = Image.new("RGBA", full.size, (0, 0, 0, 0))
    out.alpha_composite(solid((0, 0, 0), ImageChops.offset(shadow, 5 * SS, 7 * SS)))
    out.alpha_composite(solid(WHITE, rim))
    pasted = Image.new("RGBA", full.size, (0, 0, 0, 0))
    pasted.paste(face, (m, m))
    pasted.putalpha(full)
    out.alpha_composite(pasted)
    return out


def bubble(lines, colour, size):
    """A speech bubble with its tail towards the face, as a full-frame layer."""
    x0, y0, x1, y1 = BUBBLE
    shape = Image.new("L", (W * SS, H * SS), 0)
    d = ImageDraw.Draw(shape)
    d.rounded_rectangle([*P(x0, y0), *P(x1, y1)], radius=26 * SS, fill=255)
    d.polygon([P(930, y1 - 4), P(990, y1 - 4), P(980, 280)], fill=255)

    out = layer()
    out.alpha_composite(solid(INK, dilate(shape, 4 * SS)))
    out.alpha_composite(solid(WHITE, shape))
    d = ImageDraw.Draw(out)
    f = font(size)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    gap = size * 1.02
    for i, text in enumerate(lines):
        y = cy + (i - (len(lines) - 1) / 2) * gap
        d.text(P(cx, y), text, font=f, fill=colour, anchor="mm")
    return out


def arrow():
    """A fat red arrow, curved, white-rimmed, with a drop shadow."""
    (sx, sy), (cx, cy), (tx, ty) = ARROW
    head_len, head_w = 58, 66
    dx, dy = tx - cx, ty - cy
    norm = math.hypot(dx, dy)
    ux, uy = dx / norm, dy / norm
    bx, by = tx - ux * head_len, ty - uy * head_len  # base of the head

    ts = np.linspace(0, 1, 48)
    pts = np.array([((1 - t) ** 2 * sx + 2 * (1 - t) * t * cx + t**2 * bx, (1 - t) ** 2 * sy + 2 * (1 - t) * t * cy + t**2 * by) for t in ts])
    tangents = np.gradient(pts, axis=0)
    normals = np.stack([-tangents[:, 1], tangents[:, 0]], axis=1)
    normals /= np.linalg.norm(normals, axis=1, keepdims=True)
    half = (8 + 6 * ts)[:, None]  # tapers towards the tail
    left, right = pts + normals * half, pts - normals * half
    nx, ny = -uy, ux
    head = [(bx + nx * head_w / 2, by + ny * head_w / 2), (tx, ty), (bx - nx * head_w / 2, by - ny * head_w / 2)]
    outline = [tuple(p) for p in left] + head + [tuple(p) for p in right[::-1]]

    shape = Image.new("L", (W * SS, H * SS), 0)
    ImageDraw.Draw(shape).polygon([P(x, y) for x, y in outline], fill=255)
    rim = dilate(shape, 5 * SS)
    shadow = rim.filter(ImageFilter.GaussianBlur(4 * SS)).point(lambda v: v * 0.5)

    out = layer()
    out.alpha_composite(solid((0, 0, 0), ImageChops.offset(shadow, 4 * SS, 6 * SS)))
    out.alpha_composite(solid(WHITE, rim))
    out.alpha_composite(solid(RED, shape))
    return out


# ── The moving parts ──

def beam(phi):
    """The beam's wedge (for revealing) and its light (for drawing) at angle phi.

    phi = 0 points straight at the plot, 90 at the viewer, 180 away to the
    left, 270 away from the viewer. Seen from the side, a beam turning in a
    horizontal plane only changes how far it reaches across the picture.
    """
    c = math.cos(math.radians(phi))
    reach = BEAM_LEN * c
    half = BEAM_HALF * (0.35 + 0.65 * abs(c))
    wedge = Image.new("L", (W * SS, H * SS), 0)
    core = Image.new("L", (W * SS, H * SS), 0)
    if abs(reach) > 2:
        end = LX + reach
        ImageDraw.Draw(wedge).polygon([P(LX, LY - 6), P(end, LY - half), P(end, LY + half), P(LX, LY + 6)], fill=255)
        ImageDraw.Draw(core).polygon([P(LX, LY - 4), P(end, LY - half * 0.42), P(end, LY + half * 0.42), P(LX, LY + 4)], fill=255)
    alpha = ImageChops.add(wedge.point(lambda v: v * 0.17), core.point(lambda v: v * 0.21))
    return wedge, solid(BEAM, alpha)


def glow(phi):
    """The lamp: always lit, and flaring when the beam faces the viewer."""
    facing = max(0.0, math.sin(math.radians(phi))) ** 10
    out = layer()
    d = ImageDraw.Draw(out)
    r = 22 + 34 * facing
    for k, a in ((2.2, 36), (1.5, 64), (1.0, 110), (0.45, 230)):
        rr = r * k
        d.ellipse([*P(LX - rr, LY - rr), *P(LX + rr, LY + rr)], fill=BEAM + (a,))
    return out


def scaled(sprite, s, anchor):
    """Scale a full-frame layer by s about anchor (final pixels)."""
    if s == 1:
        return sprite
    ax, ay = P(*anchor)
    big = sprite.resize((round(sprite.width * s), round(sprite.height * s)), Image.LANCZOS)
    out = layer()
    out.paste(big, (round(ax - ax * s), round(ay - ay * s)))  # onto nothing, so no blending needed
    return out


def timeline():
    """(phi, revealed, pop, shake, duration) for every frame."""
    # The reveal comes first: the first frame is the still a social card shows.
    # The shake ends where it started, so the loop closes on it without a jump.
    frames = [(360, True, 0, 0, 1100)]  # the reveal, landed
    frames += [(phi, phi < 72, 0, 0, STEP) for phi in range(10, 121, 10)]  # and away, past the flash
    frames += [(130, False, 0, 0, 900)]  # smug, long enough to read
    frames += [(phi, False, 0, 0, STEP) for phi in range(140, 271, 10)]  # beam away
    frames += [(phi, False, 0, 0, STEP) for phi in range(275, 300, 5)]  # sweeping on
    frames += [(phi, True, k, 0, STEP) for phi, k in ((300, 1), (315, 2), (330, 3), (345, 0))]  # pop
    frames += [(360, True, 0, k, 90) for k in range(1, 7)]  # shake
    return frames


def main():
    print("Drawing the still parts…")
    base = draw_background()
    draw_plot(base)
    lines = draw_lines()
    tower = layer()
    draw_lighthouse(tower)
    smug = sticker(os.path.join(HERE, "smugface.jpg"), 300)
    shocked = sticker(os.path.join(HERE, "surprisedface.jpg"), 318, bottom=366)  # cut at the chin
    calm = bubble(["Obviously", "non-significant."], INK, 54)
    loud = bubble(["p < .001***?!!"], RED, 70)
    pointer = arrow()

    def face_layer(face, s=1.0):
        out = layer()
        x = FACE_RIGHT * SS - face.width
        y = FACE_BOTTOM * SS - face.height
        out.alpha_composite(face, (x, y))
        return scaled(out, s, (FACE_RIGHT - 130, FACE_BOTTOM - 120))

    frames, durations = [], []
    plan = timeline()
    print(f"Rendering {len(plan)} frames…")
    for phi, revealed, pop, shake, ms in plan:
        frame = base.copy()
        wedge, light = beam(phi)
        frame.alpha_composite(light)
        lit = lines.copy()
        lit.putalpha(ImageChops.multiply(lines.getchannel("A"), wedge))
        frame.alpha_composite(lit)
        draw_intervals(frame)
        frame.alpha_composite(tower)
        frame.alpha_composite(glow(phi))

        if revealed:
            s = {1: 1.14, 2: 1.06, 3: 0.98}.get(pop, 1.0)
            frame.alpha_composite(face_layer(shocked, {1: 1.12, 2: 1.04}.get(pop, 1.0)))
            frame.alpha_composite(pointer)
            words = scaled(loud, s, ((BUBBLE[0] + BUBBLE[2]) / 2, (BUBBLE[1] + BUBBLE[3]) / 2))
            if shake:
                dx, dy = [(4, -2), (-4, 2), (3, 3), (-3, -2), (2, -1), (0, 0)][shake - 1]
                words = ImageChops.offset(words, dx * SS, dy * SS)
            frame.alpha_composite(words)
        else:
            frame.alpha_composite(face_layer(smug))
            frame.alpha_composite(calm)

        frames.append(frame.convert("RGB").resize((W, H), Image.LANCZOS))
        durations.append(ms)

    print("Quantising…")
    # The palette is built from every fourth frame. Four hand-picked ones were
    # not enough: the lamp, a few pixels under its glow, came out tan.
    keys = frames[::4]
    montage = Image.new("RGB", (W, H * len(keys)))
    for i, k in enumerate(keys):
        montage.paste(k, (0, H * i))
    palette = montage.quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT)
    quantised = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in frames]

    out = os.path.join(HERE, "featured.gif")
    tmp = out + ".tmp"
    quantised[0].save(tmp, format="GIF", save_all=True, append_images=quantised[1:], duration=durations, loop=0)
    os.replace(tmp, out)
    print(f"featured.gif: {W}x{H}, {len(frames)} frames, {sum(durations) / 1000:.1f}s, {os.path.getsize(out) / 1024:.0f} KB")


if __name__ == "__main__":
    main()
