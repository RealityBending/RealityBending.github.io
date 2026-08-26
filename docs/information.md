# The Information section

The Contact tab's University block and the Services tab's sticky photograph.

## Information: the University of Sussex block

The picture is a **column that fills the block's height**, not a banner across
its top — the same arrangement the publication cards use for their figures, and
the reason `.contact-why` is `align-items: stretch`. A banner was tried first
and is wrong here: the block is only ~380px tall, so a 1200px-wide band cut to
fit leaves a 5:1 letterbox of a landscape. Below 900px it *becomes* a banner, at
the photograph's own 16:9, because the column crop only earns its keep when it
has a tall box to fill.

**The crest rides on the photograph rather than sitting beside it.** A crest
next to a picture of the same campus is two ways of saying "Sussex" competing
for the same corner; on it, the photograph is the subject and the mark is the
label. It needs the cream plate it is given — `logo_sussex.svg` is line art with
no `fill` of its own, so it renders black, and black on trees and sky is
unreadable at any opacity.

**Not a second backdrop cycling with `sussex-bg.jpg`**, which was the other idea
and is worth recording as rejected: the section's backdrop already has a
crossfade partner layer (`.contact-full__backdrop-img--out`) and **the Join tab
owns it** — it swaps a per-level photograph through it on every press. An
ambient cycle would be fighting that machinery for the same element, and on the
Join tab the reader's chosen level would be interrupted by a timer.

## Information: the Services tab's photograph is the surface

The other two tabs parallax the backdrop as a banner; Services runs it the full
height of the tab and holds it still while the content scrolls over it. Five
things:

- **`position: sticky` and nothing else — no script, no transform.** That is not
  tidiness, it is the whole point. This was first built as a scroll handler
  writing a translate, and it visibly dragged: the content is moved by the
  compositor and the picture by JS, so the picture arrives a frame late and the
  gap opens up at speed. Sticky is resolved during layout, by the same pass that
  places everything else, so the two can never disagree. **Do not reintroduce a
  scroll handler here.**
- **`background-attachment: fixed` cannot do it and neither can `position:
  fixed`.** The first resolves against the window, and the window is not what
  scrolls here — `#main-page` is — and iOS ignores it outright. The second
  leaves the box behind and paints over the sections either side.
- **The box has to give up `overflow: hidden`, and that is a trap worth
  knowing.** A sticky child sticks to its *nearest* scroll container, and
  `overflow: hidden` makes one — which never scrolls, so the picture would sit
  at the top of the box and never move. `clip-path: inset(0)` cuts it to the
  same rectangle without claiming to be scrollable. Nothing else is needed to
  keep the picture inside the tab: a sticky offset is bounded by its containing
  block, so it stops at the foot of the box on its own.
- **The crossfade partner is `display: none` here.** It is the Join tab's
  machinery; sticky puts it in flow, where it would be a second viewport-tall
  box under the first rather than a layer over it.
- **The scrim is flat, dark, and over the whole tab.** It is what makes the
  honeycomb readable — the cards are opaque cream, so the darker the field the
  more they read as things on a surface — and it is flat because the picture no
  longer ends anywhere, so a scrim that faded would just put back the seam this
  replaced.

**The scrim's 0.62 and the filter chips' dressing are one measurement, in two
files.** The chips are the only thing on the tab with no surface of their own —
the hero is a frosted sheet, the cards are paper — so `17-services.css` gives
them their own `rgba(12, 12, 14, 0.55)` pill and takes their ink from the
accent *lifted* 20% toward white, rather than from `--svc-ink`, which is that
hue taken **down** to be read on cream and is invisible on a dark field. Same
arrangement and same reason as the Creations cards' kind label over their
scrim. Measured against the brightest patch of the collage the three chips land
at 5.3–7.0:1, and against the darkest at 8.7–11.4:1; the hero's sheet stays at
225/255 in its worst case, 13.5:1 for the headline. Whichever of the three
numbers moves — scrim, pill, lift — re-measure, because they only work
together, and **parse `color-mix` output properly when you do**: it comes back
as `color(srgb 1 0.68 0.36)`, and reading those floats as 0–255 reports every
chip as failing.

There is deliberately **no reduced-motion branch**. A sticky background is
layout, not animation — nothing moves, the page moves past it — and the
alternative was two appearances for one tab, which would have meant two
sets of chip colours to keep in step.

The banner this replaced took its height from `--svc-banner-height`, measured
by a `sizeBanner()` in `services.js`. Both are gone; nothing reads that
property now.

`.contact-why` in `index.html`, styled in `css/15-contact.css`. A second glass
block under the address panel on the Contact tab, carried over near-verbatim
from the old Hugo site's `content/home/5b_university.md` where it sat under the
Sussex photograph.

Kept for the reason it was written: **most of the people this lab wants to hear
from are not in the UK, and "University of Sussex, Brighton" means nothing to
them.** The address panel above answers *where*; this answers *what it is like
to be there*, which is the part a prospective PhD student in Lisbon or Singapore
is actually weighing. It ends in the standing `[data-contact-tab-target="join"]`
control, so the block funnels where it is arguing towards.

Four things:

- **Two paragraphs, and the names stay in the sentence.** A first pass broke the
  second paragraph into three bulleted claims on the grounds that Seth, Clark,
  Dienes, Critchley and Field were buried mid-sentence. They were, and it was
  still the wrong call: the run-on sentence is the voice of the original and the
  pile-up of things Sussex is known for is itself the argument. A bulleted list
  turns a boast into a spec sheet.
- **Its own block rather than a fourth thing in the panel's left column.** That
  column is already a lede and an address against a map, and it is half the
  width.
- **`.contact-why__copy` carries `max-width: 48rem`, and that is not decoration.**
  With the crest taking ~130px of a 1123px content box the prose otherwise ran
  to 993px — about 120 characters a line, roughly twice a comfortable one. The
  track stays `1fr` so the block still fills the panel width above it.
- **The crest is sized by height (`6.5rem`), not width.** It is 577×624 and any
  mark that ever replaces it will have a different ratio; height is the
  dimension that keeps it optically the same size, and the `auto` track follows
  it. Below 900px it goes above the prose rather than beside it — there is not
  enough width left for a readable measure otherwise, and shrinking the crest to
  buy that back makes it a smudge.
- **It is a third of the static prose on the page**, and worth knowing before
  anyone trims it: the raw HTML a crawler that runs nothing comes away with went
  from 267 words to 382 when this landed, and the homepage is thin for what it
  has to rank for. Measured, not estimated.
