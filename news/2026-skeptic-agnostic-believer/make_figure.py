"""Draws an updated featured.gif for "Skeptic, Agnostic, Believer".

Rendered with Matplotlib and compiled via Pillow with a unified palette.
Squarish 16:10 layout with matched title typography and smooth transitions.
"""

import os
import sys

import matplotlib
import numpy as np
from PIL import Image
from scipy import stats

matplotlib.use("Agg")
import matplotlib.pyplot as plt

try:
    HERE = os.path.dirname(os.path.abspath(__file__))
except NameError:
    HERE = os.getcwd()

# ── Canvas & Timing ──
WIDTH, HEIGHT, DPI = 960, 600, 100  # Squarish 16:10 ratio
S = WIDTH / 1000  # Scaling factor for line weights and fonts
FPS = 24
HOLD = 20  # Hold duration at grid nodes (frames)
TRAVEL = 22  # Travel duration between nodes (frames)
COLOURS = 64  # GIF palette size

# ── Color Palette ──
CREAM = "#fbfaf6"
INK = "#1b2d37"
MUTED = "#55524c"  # Refined dark grey for matched titles/labels
LIGHT_RULE = "#e8e5dc"
RULE = "#d4cec4"
RED = "#d9383a"
GREEN = np.array([0.16, 0.62, 0.52])  # Skeptic tone
BLUE = np.array([0.18, 0.42, 0.82])   # Believer tone

EFFECT = 1.0
LOCATIONS = [("skeptic", -EFFECT), ("agnostic", 0.0), ("believer", EFFECT)]
Y_FLAT, Y_WIDE, Y_NARROW = 0.10, 0.50, 0.90
PRECISIONS = [("flat", Y_FLAT), ("wide", Y_WIDE), ("narrow", Y_NARROW)]
SD_FLAT, SD_WIDE, SD_NARROW = 5.0, 0.88, 0.28

ROUTE = [
    (0.0, Y_WIDE),
    (EFFECT, Y_WIDE),
    (EFFECT, Y_NARROW),
    (0.0, Y_NARROW),
    (-EFFECT, Y_NARROW),
    (-EFFECT, Y_WIDE),
    (0.0, Y_FLAT),
]


def sd_at(y):
    """Log-linear interpolation of standard deviation from precision height."""
    ys = [Y_FLAT, Y_WIDE, Y_NARROW]
    logs = [np.log(SD_FLAT), np.log(SD_WIDE), np.log(SD_NARROW)]
    return float(np.exp(np.interp(y, ys, logs)))


def colour_at(mu):
    """Smooth blend from Skeptic (green) to Believer (blue)."""
    t = (mu + EFFECT) / (2 * EFFECT)
    return tuple(GREEN + (BLUE - GREEN) * np.clip(t, 0, 1))


def ease(t):
    """Smooth cosine ease-in-out."""
    return 0.5 - 0.5 * np.cos(np.pi * t)


def frames_along_route():
    stops = ROUTE + [ROUTE[0]]
    for (mu0, y0), (mu1, y1) in zip(stops, stops[1:]):
        for _ in range(HOLD):
            yield mu0, y0
        for i in range(1, TRAVEL + 1):
            t = ease(i / (TRAVEL + 1))
            yield mu0 + (mu1 - mu0) * t, y0 + (y1 - y0) * t


def label_of(mu, y):
    loc = min(LOCATIONS, key=lambda item: abs(item[1] - mu))[0]
    pre = min(PRECISIONS, key=lambda item: abs(item[1] - y))[0]
    return "flat prior" if pre == "flat" else f"{loc}, {pre} prior"


# ── Figure & Canvas Setup ──
fig = plt.figure(figsize=(WIDTH / DPI, HEIGHT / DPI), dpi=DPI, facecolor=CREAM)

# Two balanced side-by-side axes
main = fig.add_axes([0.08, 0.14, 0.46, 0.66])
side = fig.add_axes([0.62, 0.14, 0.32, 0.66])

# Left Panel: Density Curve
X_MIN, X_MAX = -2.6, 2.6
xs = np.linspace(X_MIN, X_MAX, 800)
PEAK = stats.norm.pdf(0, 0, SD_NARROW)

main.set_facecolor(CREAM)
main.set_xlim(X_MIN, X_MAX)
main.set_ylim(0, PEAK * 1.34)
for s in ("top", "right", "left"):
    main.spines[s].set_visible(False)
main.spines["bottom"].set_color(INK)
main.spines["bottom"].set_linewidth(1.4 * S)
main.set_yticks([])
main.set_xticks([-EFFECT, 0, EFFECT])
main.set_xticklabels(["−effect", "0", "+effect"], fontsize=11 * S, color=INK, fontweight="bold")
main.tick_params(axis="x", length=6 * S, width=1.3 * S, colors=INK)

main.axvline(0, color=LIGHT_RULE, lw=1.2 * S, zorder=1)
main.axvline(EFFECT, color=RED, lw=2.2 * S, ls=(0, (4, 3)), zorder=1)
main.text(
    EFFECT + 0.08,
    PEAK * 1.05,
    "the effect\nyou expect",
    ha="left",
    va="top",
    fontsize=10.5 * S,
    color=RED,
    fontweight="bold",
    linespacing=1.25,
)
main.set_xlabel("parameter value", fontsize=10.5 * S, color=MUTED, labelpad=10 * S)

# Static Left Panel Title
main.text(X_MIN, PEAK * 1.30, "PRIOR DENSITY", ha="left", va="top", fontsize=10 * S, color=MUTED, fontweight="bold")

# Right Panel: 2D Prior Space
side.set_facecolor(CREAM)
side.set_xlim(-1.65, 1.65)
side.set_ylim(-0.08, 1.34)
side.axis("off")

arrow = dict(arrowstyle="-|>", color=INK, lw=1.5 * S, mutation_scale=12 * S)
side.annotate("", xy=(1.55, 0.0), xytext=(-1.5, 0.0), arrowprops=arrow)
side.annotate("", xy=(-1.42, 1.10), xytext=(-1.42, 0.0), arrowprops=arrow)

side.text(1.55, 0.04, "LOCATION", ha="right", va="bottom", fontsize=9 * S, color=INK, fontweight="bold")
side.text(-1.36, 1.10, "PRECISION", ha="left", va="top", fontsize=9 * S, color=INK, fontweight="bold")

for name, x in LOCATIONS:
    side.plot([x, x], [-0.018, 0.018], color=INK, lw=1.3 * S)
    side.text(x, -0.045, name, ha="center", va="top", fontsize=10.5 * S, color=INK, fontweight="bold")

for name, y in PRECISIONS:
    side.plot([-1.435, -1.405], [y, y], color=INK, lw=1.3 * S)
    side.text(-1.48, y, name, ha="right", va="center", fontsize=10.5 * S, color=INK, fontweight="bold")

# Route trajectory & landmarks
loop = ROUTE + [ROUTE[0]]
side.plot([p[0] for p in loop], [p[1] for p in loop], color=RULE, lw=1.2 * S, ls=(0, (3, 3)), zorder=1)
for x, y in ROUTE:
    side.plot(x, y, marker="o", ms=4.5 * S, color=MUTED, alpha=0.35, lw=0, zorder=2)

# Static Right Panel Title (matched font size, weight, and dark grey color)
side.text(0.0, 1.30, "PRIOR SPACE", ha="center", va="top", fontsize=10 * S, color=MUTED, fontweight="bold")


def render(mu, y):
    colour = colour_at(mu)
    pdf = stats.norm.pdf(xs, mu, sd_at(y))

    # Animated elements: dynamic state label, curve, fill, and cursor
    added = [
        main.text(X_MIN, PEAK * 1.19, label_of(mu, y), ha="left", va="top", fontsize=16 * S, color=colour, fontweight="bold"),
        main.fill_between(xs, pdf, color=colour, alpha=0.30, lw=0, zorder=2),
        main.plot(xs, pdf, color=colour, lw=2.8 * S, zorder=3)[0],
        # Outer glow ring
        side.plot(mu, y, marker="o", ms=18 * S, color=colour, alpha=0.25, lw=0, zorder=4)[0],
        # Solid center cursor
        side.plot(mu, y, marker="o", ms=9 * S, color=colour, mec=CREAM, mew=1.8 * S, lw=0, zorder=5)[0],
    ]

    fig.canvas.draw()
    frame = Image.fromarray(np.asarray(fig.canvas.buffer_rgba())).convert("RGB")

    for artist in added:
        artist.remove()

    return frame


# ── Render and Build ──
rgb_frames = [render(mu, y) for mu, y in frames_along_route()]

# Palette quantization to avoid per-frame color jitter
sample = rgb_frames[:: max(1, len(rgb_frames) // 16)]
strip = Image.new("RGB", (WIDTH, HEIGHT * len(sample)))
for i, f in enumerate(sample):
    strip.paste(f, (0, i * HEIGHT))
palette = strip.quantize(colors=COLOURS, method=Image.Quantize.MEDIANCUT)
frames = [f.quantize(palette=palette, dither=Image.Dither.NONE) for f in rgb_frames]

out = os.path.join(HERE, "featured.gif")
frames[0].save(
    out,
    save_all=True,
    append_images=frames[1:],
    duration=int(1000 / FPS),
    loop=0,
    optimize=True,
)
plt.close(fig)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
print(f"Saved {out}: {len(frames)} frames, {WIDTH}×{HEIGHT} ({os.path.getsize(out) // 1024} KB)")