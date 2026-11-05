"""Makes video.mp4: a 9:16 reel of the lab for the Instagram post.

    python social/2026_10_labshowcase/make_video.py

Two halves, dissolved into each other:

1. **The opener is the real site**, in its wide desktop layout: the door opens,
   the camera pulls back to the whole landing, then makes a short push in on
   the brain as two sections light up their regions. A virtual camera moves
   over a 1440x810 page; where its crop is wider than 9:16 the frame is
   letterboxed over a blurred copy of itself, as reels do with landscape
   footage.
2. **Everything after it is video.html** beside this script: the eye, the
   research themes, the TMS clip (tms.webm, cut from the lab's own video), the
   tools, the team, lab life and the end card. It draws any moment through
   render(t), so open it in a browser to preview or edit the scenes; nothing
   here needs changing for that.

1080x1920, 30fps, ~32s, silent. Needs Playwright (`pip install playwright`,
`playwright install chromium`), Pillow, and ffmpeg on PATH or from
`pip install imageio-ffmpeg`. Serves the working copy itself; Raleway comes
from Google Fonts.

── Why frame by frame ──
A real-time capture of a headless page drops frames. Here time stands still
between frames instead: in the opener, Playwright's fake clock drives timers and
requestAnimationFrame (the door, the three.js brain) and CSS animations are
paused and stepped by hand; video.html simply takes t. Raw
`Page.captureScreenshot` ignores the emulated DPR, hence `scale` in its clip.
The brain is WebGL, which headless Chromium renders only with SwiftShader.
"""

import base64
import functools
import http.server
import math
import shutil
import subprocess
import sys
import tempfile
import threading
from datetime import datetime, timedelta
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    HERE = Path(__file__).resolve().parent
except NameError:
    HERE = Path.cwd()
ROOT = HERE.parent.parent
OUTPUT = HERE / "video.mp4"

OUT_W, OUT_H, FPS = 1080, 1920, 30
SITE_W, SITE_H = 1440, 810  # the desktop layout, top nav, as the site is mostly seen
SITE_DPR = 2.4  # the tightest crop (~450 CSS px wide) still has 1080 real pixels
OPENER = 3.8  # seconds of site before video.html has fully dissolved in
DISSOLVE = 0.45

# The camera: (time, centre x, crop width), eased between. The crop is as tall
# as the page allows (810) or 9:16, whichever is smaller.
CAMERA = [
    (0.0, 720, 560),  # the door: its Psi spans x 480-990, the panels are cut
    (0.8, 720, 580),
    (2.0, 720, 1440),  # pulled back as the doors open: the whole landing
    (2.5, 720, 1440),
    (3.3, 1085, 640),  # a short push in on the brain (x 900-1380) and the arc beside it
    (OPENER, 1085, 640),  # then still, under the dissolve
]
# A hovered section lights its region of the brain, and the brain turns to face
# it (brain.js, "Camera lock-in") — so two, not one per section, or it spins.
HOVERS = [(2.0, "people"), (2.75, "research")]

# Runs before the site's own scripts: pauses every CSS animation the first time
# it is seen and from then on advances it by hand; finish() at the end, so
# transitionend still fires (the door listens for it).
STEP_JS = r"""
window.__rec = {
  seen: new WeakMap(), done: new WeakSet(),
  step(dt) {
    for (const a of document.getAnimations()) {
      if (this.done.has(a)) continue;
      let t = this.seen.get(a);
      if (t === undefined) { a.pause(); t = a.currentTime || 0; }
      else t += dt;
      this.seen.set(a, t);
      const end = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : Infinity;
      if (isFinite(end) && t >= end) { this.done.add(a); try { a.finish(); } catch (e) {} }
      else a.currentTime = t;
    }
  },
};
"""


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def camera(t):
    for (t0, x0, w0), (t1, x1, w1) in zip(CAMERA, CAMERA[1:]):
        if t <= t1:
            k = ease((t - t0) / (t1 - t0)) if t1 > t0 else 1
            # zoom in log space, so a pull-back and a push-in feel equally steady
            return x0 + (x1 - x0) * k, math.exp(math.log(w0) + (math.log(w1) - math.log(w0)) * k)
    return CAMERA[-1][1], CAMERA[-1][2]


def reel_frame(img):
    """A crop wider than 9:16, centred over a blurred, darkened copy of itself."""
    if img.height >= OUT_H - 2:
        return img.resize((OUT_W, OUT_H), Image.LANCZOS)
    scale = OUT_H / img.height
    bg = img.resize((round(img.width * scale), OUT_H), Image.BILINEAR)
    left = (bg.width - OUT_W) // 2
    bg = bg.crop((left, 0, left + OUT_W, OUT_H))
    bg = bg.resize((OUT_W // 8, OUT_H // 8), Image.BILINEAR).filter(ImageFilter.GaussianBlur(5))
    bg = ImageEnhance.Brightness(bg.resize((OUT_W, OUT_H), Image.BILINEAR)).enhance(0.45)
    bg.paste(img, (0, (OUT_H - img.height) // 2))
    return bg


def jpeg(cdp, clip):
    shot = cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 95, "clip": clip})
    return base64.b64decode(shot["data"])


def record_opener(p, url, frames):
    browser = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
    ctx = browser.new_context(viewport={"width": SITE_W, "height": SITE_H}, device_scale_factor=SITE_DPR,
                              reduced_motion="no-preference")
    page = ctx.new_page()
    start = datetime(2026, 10, 25, 12, 0, 0)
    page.clock.install(time=start)
    page.add_init_script(STEP_JS)
    page.goto(url, wait_until="networkidle")
    page.evaluate("() => document.fonts.ready")
    page.add_style_tag(content=".fab-group { display: none !important; }")
    page.wait_for_timeout(1500)
    page.clock.pause_at(start + timedelta(seconds=60))
    cdp = ctx.new_cdp_session(page)
    buttons = page.evaluate("""() => Object.fromEntries([...document.querySelectorAll('.menu-button')].map(e => {
        const b = e.getBoundingClientRect(), s = [...e.classList].find(c => c.startsWith('section--')).slice(9);
        return [s, [b.left + b.width / 2, b.top + b.height / 2]]; }))""")
    hovers = list(HOVERS)
    ms = 0
    n = round(OPENER * FPS)
    for i in range(n):
        t = i / FPS
        if abs(t - 0.8) < 0.5 / FPS:
            page.evaluate("() => document.getElementById('door-screen').click()")
        while hovers and t >= hovers[0][0]:
            page.mouse.move(*buttons[hovers.pop(0)[1]])
        target = round((i + 1) * 1000 / FPS)
        page.clock.run_for(target - ms)
        ms = target
        page.evaluate("(dt) => window.__rec.step(dt)", 1000 / FPS)
        # Rounded and clamped: at full width the log-space zoom lands a hair
        # over 1440 and x a hair under 0, and a clip even 1e-13 outside the
        # viewport is captured at the wrong scale — the hero jumped to a
        # 1.33x crop of its left side for as long as the camera held wide.
        cx, w = camera(t)
        w = round(min(w, SITE_W), 3)
        h = round(min(SITE_H, w * OUT_H / OUT_W), 3)
        x = round(min(max(cx - w / 2, 0), SITE_W - w), 3)
        y = round((SITE_H - h) / 2, 3)
        raw = frames / "raw.jpg"
        raw.write_bytes(jpeg(cdp, {"x": x, "y": y, "width": w, "height": h, "scale": OUT_W / w}))
        reel_frame(Image.open(raw).convert("RGB")).save(frames / f"o{i:05d}.jpg", quality=95)
    browser.close()
    return n


def render_scenes(p, url, frames):
    browser = p.chromium.launch()
    ctx = browser.new_context(viewport={"width": OUT_W, "height": OUT_H}, device_scale_factor=1)
    page = ctx.new_page()
    page.add_init_script("window.__driven = true")
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(url, wait_until="networkidle")
    page.evaluate("() => window.ready")
    duration = page.evaluate("window.DURATION")
    cdp = ctx.new_cdp_session(page)
    n = round(duration * FPS)
    for i in range(n):
        page.evaluate("(t) => { render(t); return window.settle() }", i / FPS)
        (frames / f"s{i:05d}.jpg").write_bytes(jpeg(cdp, {"x": 0, "y": 0, "width": OUT_W, "height": OUT_H, "scale": 1}))
    browser.close()
    if errors:
        sys.exit("make_video: video.html threw:\n  " + "\n  ".join(errors))
    return n


def find_ffmpeg():
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit("make_video: needs ffmpeg on PATH, or `pip install imageio-ffmpeg`")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class QuietServer(http.server.ThreadingHTTPServer):
    # Chromium drops connections it no longer needs; on Windows each one is a
    # ConnectionResetError traceback
    def handle_error(self, request, client_address):
        pass


def main():
    ffmpeg = find_ffmpeg()
    server = QuietServer(("127.0.0.1", 0), functools.partial(QuietHandler, directory=str(ROOT)))
    threading.Thread(target=server.serve_forever, daemon=True).start()
    base = f"http://127.0.0.1:{server.server_address[1]}/"

    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        frames = Path(tmp)
        n_open = record_opener(p, base, frames)
        print(f"  opener: {n_open} frames")
        n_scenes = render_scenes(p, base + "social/2026_10_labshowcase/video.html", frames)
        print(f"  scenes: {n_scenes} frames")

        # video.html starts DISSOLVE before the opener ends and fades in over it
        offset = n_open - round(DISSOLVE * FPS)
        out = frames / "out"
        out.mkdir()
        for i in range(offset + n_scenes):
            if i < offset:
                shutil.copyfile(frames / f"o{i:05d}.jpg", out / f"{i:05d}.jpg")
            elif i < n_open:
                k = ease((i - offset + 1) / (n_open - offset))
                a = Image.open(frames / f"o{i:05d}.jpg")
                b = Image.open(frames / f"s{i - offset:05d}.jpg")
                Image.blend(a, b, k).save(out / f"{i:05d}.jpg", quality=95)
            else:
                shutil.copyfile(frames / f"s{i - offset:05d}.jpg", out / f"{i:05d}.jpg")

        # A silent AAC track, which some upload paths require and which leaves
        # room for music in the app. Chromium's JPEGs are full-range BT.601;
        # players expect limited-range BT.709, and the -color_* output flags
        # alone leave primaries and transfer "unknown", hence setparams.
        subprocess.run([
            ffmpeg, "-y", "-loglevel", "error",
            "-framerate", str(FPS), "-i", str(out / "%05d.jpg"),
            "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
            "-vf", "scale=in_range=full:out_range=tv:in_color_matrix=bt601:out_color_matrix=bt709,format=yuv420p,"
                   "setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709",
            "-c:v", "libx264", "-preset", "slow", "-crf", "23", "-tune", "film", "-profile:v", "high",
            "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart",
            str(OUTPUT),
        ], check=True)
        print(f"  {(offset + n_scenes) / FPS:.1f}s")
    server.shutdown()
    print(f"  wrote {OUTPUT.relative_to(ROOT)}, {OUTPUT.stat().st_size / 1e6:.1f} MB")


if __name__ == "__main__":
    main()
