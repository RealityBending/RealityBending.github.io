"""Rebuild featured.jpg — a screenshot of the Sussex page the post is about.

Run it again if that page is restyled; there is nothing else here to
regenerate the hero from.

    python make_hero.py

Three things this file is the record of.

**The cookie banner is hidden, not answered.** It is the first element on the
page and it pushes the whole layout down by ~320px. `#cookie-options` is set to
`display: none` from the outside, which records no consent either way.

**The capture is cut at the photograph's bottom edge** (CUT, in CSS px at
VW = 1600). One line further down is the page's own caption, which misspells
the name; one line further up would slice the picture.

**The capture sits inside the middle of a 16:9 plate, not flush to it.** The
card shows the whole file, but the reader's hero is `max-height: 22rem` over a
hero that measures 823px at every viewport width — so it keeps 76% of the
height and cuts 95px off the top and the bottom. At SHOT_H the cream band is
114px, which clears that by 19px. Raise SHOT_H and the Sussex header goes.
"""

from PIL import Image, ImageDraw
from playwright.sync_api import sync_playwright

URL = "https://www.sussex.ac.uk/research/about/standards/breaking-barriers-research"
VW, DSF = 1600, 2  # 1600 keeps the nav on one row; 2x then down keeps the type crisp
CUT = 907  # CSS px: the top of the page down to the photograph's bottom edge

PLATE_W, PLATE_H = 1400, 788  # 16:9, so the index card shows the whole file
SHOT_H = 560  # see the docstring: 114px of cream against the hero's 95px cut
CREAM = (233, 242, 238)  # the section cream the hero's tint sits on
HAIRLINE = (205, 221, 214)  # or the white page has no edge against the cream

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": VW, "height": 1000}, device_scale_factor=DSF)
    page.goto(URL, wait_until="networkidle", timeout=60_000)
    page.add_style_tag(content="#cookie-options{display:none !important}")
    page.wait_for_timeout(1500)
    page.screenshot(path="_shot.png", clip={"x": 0, "y": 0, "width": VW, "height": CUT})
    browser.close()

shot = Image.open("_shot.png").convert("RGB")
shot = shot.resize((round(SHOT_H * shot.width / shot.height), SHOT_H), Image.LANCZOS)

plate = Image.new("RGB", (PLATE_W, PLATE_H), CREAM)
x, y = (PLATE_W - shot.width) // 2, (PLATE_H - SHOT_H) // 2
plate.paste(shot, (x, y))
ImageDraw.Draw(plate).rectangle([x - 1, y - 1, x + shot.width, y + SHOT_H], outline=HAIRLINE)
# 4:4:4 rather than 4:2:0: most of this picture is small text and the Sussex green.
plate.save("featured.jpg", quality=88, subsampling=0, optimize=True)

print(f"{shot.width}x{SHOT_H} at {(x, y)} on {PLATE_W}x{PLATE_H}")
print(f"hero cuts 95px each side; clearance {y - 95}px")
