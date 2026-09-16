"""Build featured.gif — cogmod's widget capture, with a spinning reaction face,
a red arrow and the cogmod logo stuck on it.

    python make_thumbnail.py
    python make_thumbnail.py --still            # also write a poster to look at
    python make_thumbnail.py --gif <path|url> --video <path|url> --logo <path|url>

Three inputs, none of which has to live in this repository — give it a path or
an http(s) link and it will fetch and cache it beside this script:

    --gif     the pristine capture   cogmod/man/figures/anim_widget.gif
    --video   the reaction footage   reactface.mp4, 360x640, 70 frames
    --logo    the hex sticker        cogmod/man/figures/logo.png

The defaults are the local cogmod checkout for the two cogmod files and
`reactface.mp4` beside this script. The output is the same 820x690 canvas as
the capture, every frame of it composited. **Edit the numbers below and re-run
rather than editing the GIF.**

Six things this script is the record of.

**The face is keyed, not masked by hand.** The wall behind it is uniform and
bright, so background is `S < 45 and V > 140` — but only the part of it that
the border can reach: the flood fill from the edges is what keeps the glasses,
which are exactly as bright and as grey as the wall, from being punched out of
the middle of the face. Everything after that is morphology and the largest
connected component.

**Everything drawn has to live inside the hero's safe band.** The reader's hero
is `object-fit: cover` at 808x352 against a 690px-tall source, so it keeps only
the middle ~52% of the height — y 166..523 here — and the index card keeps the
middle ~67%. So nothing is drawn in the canvas's own corners: a logo in the
true top-right corner is in neither picture anyone sees. It goes in the top
right *of the band*. `--still` draws both bands so this is checked, not assumed.

**A spinning sticker is bounded by its diagonal, not its height.** It sweeps
the circle its corners describe, so what has to fit the band is `2R`, and the
face is scaled from the radius rather than the other way round — `fit_to_spin`.
The still version of this hero was 258px tall and 330px across the diagonal;
inside a 357px band that leaves 27px, which is why it could not simply be spun
where it stood.

**The logo is composited last, so the face passes behind it.** The band is
357px tall and both the logo and the face want the right-hand side of it. That
is solved by draw order rather than by geometry, and the draw order is also the
reading that looks deliberate — a sticker tucking behind the logo, rather than
two things carefully avoiding one another.

**The spin is a burst at the head of the loop, and that is a size decision
before it is a comic one.** A face turning on every frame is a large region of
photographic pixels changing 268 times, which is the one thing a GIF cannot
encode cheaply: measured on this canvas, a constant spin is **7.1 MB** against
530 KB for a still one, and no combination of fewer colours, fewer frames and a
smaller face brings a *readable* constant spin below ~1.5 MB — at an angle step
slow enough to fit the budget it reads as a slideshow, not a spin. So the face
turns twice in the first 1.6s and then holds for the remaining 25s: 712 KB, the
face at full size, and the spin at full speed. It is also where the spin is
most likely to be seen, since a GIF restarts when the card scrolls into view —
the head of the loop is what everyone gets and the tail is what almost nobody
reaches. Both ends of the burst land on 0°, so the loop closes without a jump.

**Colour: `dither=Image.NONE`.** Error diffusion scatters noise over flat
fills that were compressing perfectly, and cost 821 KB against 530 KB on the
still version of this hero for a face nobody can tell apart. It is the largest
single lever on the file and it costs nothing visible here, because there is no
sky and no gradient on the canvas for banding to show up in — only the logo's
neon, and at 96 colours that survives 2x magnification.

**`optimize=True` merges runs of identical frames and sums their delays**, so
fewer frames come out than go in: the capture holds still whenever the
recording does. The burst breaks the run it falls in and the rest still merge —
268 in, ~137 out, 26.8s either way. Read the count back off the written file
rather than reporting the input's.
"""

import argparse
import sys
import urllib.request
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    HERE = Path(__file__).resolve().parent
except NameError:
    HERE = Path.cwd()

COGMOD = Path.home() / "Dropbox" / "Software" / "cogmod" / "man" / "figures"
DEFAULT_GIF = COGMOD / "anim_widget.gif"
DEFAULT_VIDEO = HERE / "reactface.mp4"
DEFAULT_LOGO = COGMOD / "logo.png"
OUTPUT = HERE / "featured.gif"

# The frame of the reaction video the face is cut from: mouth widest, eyes
# widest. 40 and 50 are the same expression a little less far along.
REACTION_FRAME = 45

# The capture is cropped to 820x461 before anything is drawn on it — see the
# header. The crop is the index card's own 16:9, centred, so the card shows the
# whole file and a corner of the file is a corner of the picture people see.
CROP_TO_CARD = True

# What the reader's hero keeps of the cropped canvas's height. The card keeps
# all of it, the crop being the card's ratio. Measured in the browser at a
# 1440px viewport, not read off the CSS.
HERO_KEEPS = 0.775

# Geometry on the 820x461 canvas.
FACE_CENTRE = (185, 275)            # bottom left, and the axis the face spins about
FACE_RADIUS = 180                   # the sweep; the sticker is scaled to it
SPIN_TURNS = 7                      # whole turns across the whole loop, so it closes
ARROW = ((250, 400), (500, 420), (462, 168))   # start, bezier control, tip
ARROW_WIDTH = 32
LOGO_HEIGHT = 140
LOGO_TOPRIGHT = (808, 58)           # right edge, top edge
RED = (214, 26, 26, 255)

COLOURS = 48                        # the widget is flat colour; the face and
                                    # the logo are the only busy things on it.
                                    # 96 is plenty at rest — a constant spin is
                                    # what forces this down (see the header)
FRAME_STEP = 2                      # keep every 2nd frame at twice the delay:
                                    # 26.8s either way, and the one lever that
                                    # halves a spinning file outright
DITHER = Image.NONE                 # see the header — this is the size lever


def source(where: str, cache_name: str) -> Path:
    """A local path, or an http(s) link fetched once and cached beside this file."""
    if str(where).startswith(("http://", "https://")):
        cached = HERE / cache_name
        if not cached.exists():
            print(f"  ↓ {where}")
            urllib.request.urlretrieve(where, cached)
        return cached
    path = Path(where).expanduser()
    if not path.exists():
        raise SystemExit(f"  ✗ no such file: {path}")
    return path


def face_cutout(path: Path, index: int) -> Image.Image:
    """The reaction face as RGBA, background keyed out."""
    cap = cv2.VideoCapture(str(path))
    frame = None
    for _ in range(index + 1):
        ok, read = cap.read()
        if not ok:
            break
        frame = read
    cap.release()
    if frame is None:
        raise SystemExit(f"  ✗ {path.name}: no frame {index}")

    h, w = frame.shape[:2]
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    wall = ((hsv[..., 1] < 45) & (hsv[..., 2] > 140)).astype(np.uint8)

    # Only wall the border can reach is background — this is what saves the
    # glasses, which key as wall but are surrounded by face.
    flood, ffmask = wall.copy(), np.zeros((h + 2, w + 2), np.uint8)
    for x in range(0, w, 4):
        for y in (0, h - 1):
            if flood[y, x] == 1:
                cv2.floodFill(flood, ffmask, (x, y), 2)
    for y in range(0, h, 4):
        for x in (0, w - 1):
            if flood[y, x] == 1:
                cv2.floodFill(flood, ffmask, (x, y), 2)

    fg = 1 - (flood == 2).astype(np.uint8)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, kernel)
    fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, kernel)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(fg, 8)
    if count > 1:
        fg = (labels == 1 + int(np.argmax(stats[1:, cv2.CC_STAT_AREA]))).astype(np.uint8)

    alpha = cv2.GaussianBlur(fg * 255, (0, 0), 1.6)
    return Image.fromarray(np.dstack([cv2.cvtColor(frame, cv2.COLOR_BGR2RGB), alpha]))


def sticker(face: Image.Image, height: int) -> Image.Image:
    """Crop to the head and shoulders, scale, and give it the white cut edge."""
    alpha = np.asarray(face)[..., 3]
    ys, xs = np.where(alpha > 24)
    # 0.80 cuts the torso off below the shoulders — a sticker, not a portrait
    top = int(ys.min())
    face = face.crop((int(xs.min()), top,
                      int(xs.max()) + 1, int(top + (ys.max() - top) * 0.80)))
    face = face.resize((max(1, round(face.width * height / face.height)), height),
                       Image.LANCZOS)

    pad = max(8, height // 22)
    canvas = Image.new("RGBA", (face.width + pad * 4, face.height + pad * 4), (0, 0, 0, 0))
    offset = (pad * 2, pad * 2)

    shape = Image.new("L", canvas.size, 0)
    shape.paste(face.split()[3], offset)
    edge = shape.filter(ImageFilter.MaxFilter(pad * 2 + 1))
    edge = edge.filter(ImageFilter.GaussianBlur(0.8)).point(lambda v: 255 if v > 110 else 0)

    # A hard white edge and no drop shadow. The shadow was a soft ramp around the
    # whole perimeter, which is a band of in-between colours that moves with the
    # sticker — on a spinning face it re-quantises differently every frame and
    # cost 26% of the file (2921 KB against 2167 KB, measured). On a still
    # sticker it is nearly free, which is why it was there to begin with.
    canvas.paste((255, 255, 255, 255), (0, 0), edge)
    canvas.paste(face, offset, face)
    return canvas


def fit_to_spin(face: Image.Image, radius: float) -> Image.Image:
    """Scale a sticker so the circle its corners sweep has the given radius, and
    centre it on a square canvas so every rotation lands on the same pixels."""
    trial = sticker(face, 300)
    diagonal = (trial.width ** 2 + trial.height ** 2) ** 0.5
    scaled = sticker(face, max(1, int(round(300 * 2 * radius / diagonal))))
    side = int(2 * radius) + 2
    square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    square.alpha_composite(scaled, ((side - scaled.width) // 2, (side - scaled.height) // 2))
    return square


def draw_arrow(draw: ImageDraw.ImageDraw, points, width: int) -> None:
    """A tapered arrow along a quadratic bezier, with a white halo under it so it
    stays legible where it crosses the traces."""
    (x0, y0), (cx, cy), (x1, y1) = points
    t = np.linspace(0, 1, 90)
    bx = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t ** 2 * x1
    by = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t ** 2 * y1

    head = width * 2.35
    run = np.concatenate([[0], np.cumsum(np.hypot(np.diff(bx), np.diff(by)))])
    keep = run <= run[-1] - head * 0.92          # stop short; the head is the tip
    sx, sy = bx[keep], by[keep]
    angle = np.arctan2(by[-1] - by[-6], bx[-1] - bx[-6])

    def shaft(w, colour):
        for i in range(len(sx) - 1):
            ww = w * (0.45 + 0.55 * i / max(1, len(sx) - 2))   # thin at the tail
            draw.line([sx[i], sy[i], sx[i + 1], sy[i + 1]], fill=colour, width=max(1, int(ww)))
            draw.ellipse([sx[i + 1] - ww / 2, sy[i + 1] - ww / 2,
                          sx[i + 1] + ww / 2, sy[i + 1] + ww / 2], fill=colour)

    def head_triangle(scale):
        h, half = head * scale, head * scale * 0.80
        back = (x1 - h * np.cos(angle), y1 - h * np.sin(angle))
        normal = (-np.sin(angle), np.cos(angle))
        return [(x1, y1),
                (back[0] + normal[0] * half, back[1] + normal[1] * half),
                (back[0] - normal[0] * half, back[1] - normal[1] * half)]

    shaft(width + 9, (255, 255, 255, 255))
    draw.polygon(head_triangle(1.28), fill=(255, 255, 255, 255))
    shaft(width, RED)
    draw.polygon(head_triangle(1.0), fill=RED)


def hero_band(height: int) -> tuple:
    """(top, bottom) of what the reader's hero keeps. The card keeps all of it."""
    return height * (1 - HERO_KEEPS) / 2, height * (1 + HERO_KEEPS) / 2


def spin_angle(i: int, count: int) -> float:
    """Degrees at frame `i` of `count`: a constant spin, SPIN_TURNS over the loop.

    Whole turns, because the GIF repeats forever and a fractional one makes the
    face jump at the seam. `SPIN_TURNS` is that number and the per-frame angle
    is derived from it, never the other way round.
    """
    return (SPIN_TURNS * 360.0 * i / count) % 360


def main(args) -> None:
    gif_path = source(args.gif, "featured_full.gif")
    video_path = source(args.video, "reactface.mp4")
    logo_path = source(args.logo, "logo_source.png")

    capture = Image.open(gif_path)
    count = capture.n_frames
    full = capture.size
    # the card's 16:9 out of the middle of the capture — this drops the title and
    # the model tabs off the top and the assumptions row off the bottom, none of
    # which the site has ever shown
    crop = ((0, (full[1] - round(full[0] * 9 / 16)) // 2,
             full[0], (full[1] - round(full[0] * 9 / 16)) // 2 + round(full[0] * 9 / 16))
            if CROP_TO_CARD else (0, 0) + full)
    size = (crop[2] - crop[0], crop[3] - crop[1])

    radius = FACE_RADIUS
    face = fit_to_spin(face_cutout(video_path, REACTION_FRAME), radius)
    logo = Image.open(logo_path).convert("RGBA")
    logo = logo.resize((max(1, round(logo.width * LOGO_HEIGHT / logo.height)), LOGO_HEIGHT),
                       Image.LANCZOS)

    # The arrow and the logo are the same on every frame; only the face turns.
    arrow_layer = Image.new("RGBA", size, (0, 0, 0, 0))
    draw_arrow(ImageDraw.Draw(arrow_layer), ARROW, ARROW_WIDTH)
    logo_at = (LOGO_TOPRIGHT[0] - logo.width, LOGO_TOPRIGHT[1])
    face_at = (FACE_CENTRE[0] - face.width // 2, FACE_CENTRE[1] - face.height // 2)

    frames, durations, turned = [], [], {}
    for i in range(0, count, FRAME_STEP):
        capture.seek(i)
        durations.append(capture.info.get("duration", 100) * FRAME_STEP)
        frame = capture.convert("RGBA").crop(crop)
        frame.alpha_composite(arrow_layer)
        angle = round(spin_angle(i, count), 1)
        if angle not in turned:
            turned[angle] = face.rotate(-angle, resample=Image.BICUBIC)
        frame.alpha_composite(turned[angle], face_at)
        frame.alpha_composite(logo, logo_at)       # last: the face passes behind it
        frames.append(frame.convert("RGB"))
    capture.close()

    if args.still:
        poster = frames[len(frames) // 2].copy()
        pen = ImageDraw.Draw(poster)
        top, bottom = hero_band(size[1])
        for y in (top, bottom):
            pen.line([0, y, size[0], y], fill=(255, 0, 0), width=2)
        pen.text((6, top + 4), f"hero keeps {int(top)}-{int(bottom)}; card keeps all",
                 fill=(255, 0, 0))
        pen.ellipse([FACE_CENTRE[0] - radius, FACE_CENTRE[1] - radius,
                     FACE_CENTRE[0] + radius, FACE_CENTRE[1] + radius],
                    outline=(255, 0, 255), width=2)
        poster.save(HERE / "featured_poster.png")
        print("  ✓ featured_poster.png — bands and sweep drawn, not part of the site")

    # One palette for all of them: quantising each frame against its own is what
    # makes a re-encoded GIF both bigger and unstable, and PIL dies on
    # "Transparency for P mode should be bytes or int" halfway through the write.
    sample = Image.new("RGB", (size[0], size[1] * 4))
    for k, i in enumerate((0, len(frames) // 3, 2 * len(frames) // 3, len(frames) - 1)):
        sample.paste(frames[i], (0, size[1] * k))
    palette = sample.quantize(colors=COLOURS, method=Image.MEDIANCUT)
    mapped = [f.quantize(palette=palette, dither=DITHER) for f in frames]

    # Write to a temporary file and replace: Windows will not rename over a file
    # the source image still holds open, and a failed save leaves a zero-byte GIF.
    temporary = OUTPUT.with_suffix(".tmp.gif")
    mapped[0].save(temporary, save_all=True, append_images=mapped[1:],
                   duration=durations, loop=0, optimize=True, disposal=1)
    temporary.replace(OUTPUT)

    with Image.open(OUTPUT) as written:
        kept = written.n_frames
    top, bottom = hero_band(size[1])
    print(f"  ✓ {OUTPUT.name} — {size[0]}x{size[1]}, {count} frames in, {kept} out "
          f"({sum(durations) / 1000:.1f}s), {OUTPUT.stat().st_size / 1024:.0f} KB, "
          f"{COLOURS} colours")
    print(f"    cropped from {full[0]}x{full[1]}; face sweeps r={radius:.0f} about "
          f"{FACE_CENTRE}, logo {logo.width}x{logo.height} at {logo_at}; "
          f"the hero keeps y {top:.0f}-{bottom:.0f}, the card all of it")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--gif", default=str(DEFAULT_GIF), help="path or http(s) link")
    parser.add_argument("--video", default=str(DEFAULT_VIDEO), help="path or http(s) link")
    parser.add_argument("--logo", default=str(DEFAULT_LOGO), help="path or http(s) link")
    parser.add_argument("--still", action="store_true", help="also write featured_poster.png")
    main(parser.parse_args())
