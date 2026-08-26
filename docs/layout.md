# Page shell, stylesheets, and cross-section layout

The scroll container, the cascade, the hero, full-bleed sections, the shared tab and pager components, and the one scroll loop everything rides on. Read this before changing any CSS or anything that reacts to scrolling.

## The stylesheets

`css/` is one stylesheet cut into numbered parts, not a set of independent
modules. **The numbering is the cascade**: `index.html` links them in order and
a rule loses to the same-specificity rule in any later file. Several things
depend on that and nothing warns you when it breaks:

- `19-narrow.css` (one `max-width: 900px` block) and `20-wide.css`
  (`min-width: 1800px`) are cross-section and come *after* every section file
  because they have to beat it. They are not "the responsive file" — most
  breakpoints live with the rules they modify.

  **Taking an element out of an absolute box means undoing every property that
  box implied, not just `position`.** The People roster's role label is
  `position: absolute` + `writing-mode: vertical-lr` on desktop, running down
  the side of each band. Stacked, `19-narrow.css` reset `position`, `transform`
  and `width` — and left the writing mode. So the label went on rendering as a
  column of sideways type, and **a static block's height is then the length of
  its text**: measured at 375px, "Principal Investigator" was 177px tall and
  10px wide. Every pair of rows was separated by a near-invisible sliver with
  160-odd px of apparent dead air around it, and every band was a different
  height because the roles are different lengths. It reads as a spacing bug,
  which is what it was reported as. Horizontal, the same label is 19px:
  402/298/328/386px per band → 212px each, `#people-grid` 1451px → 877px.
- `21-reality-zoom.css` comes after `20-wide.css` and carries its own 1800px
  override for exactly that reason (see [research-zoom.md](research-zoom.md)).

So: add a file where it belongs in the order, never at the end for convenience,
and put a new rule in the part that owns the component rather than wherever it
happens to work.

**Relative `url()` resolves against the stylesheet, not the page** — from
`css/` an image is `url("../img/…")`. This broke the door logos and the
Information backdrop the moment the files moved into the folder; nothing in the
CSS looks wrong, the requests just go to `/css/img/`.

The old single `style.css` is gone. Anything that still says "style.css" is
stale.

## Page structure

`#main-page` is `position: fixed; inset: 0; overflow-y: auto` — **it is the
scroll container, not the window**. Anything scroll-related must listen on
`mainPage`, not `window`, and `IntersectionObserver` needs `root: mainPage`.

Section order: hero → People → Research → News → Publications → Information →
footer.

The nav and the hero's ring of menu buttons read in that same order, minus News'
neighbours: People, Research, News, Publications, Join, Information. Both are
plain source order — `nav ul` in `index.html` and `.menu-buttons` in the same
file — and the button colours come from `:nth-child` rules, so a colour belongs
to a **position on the arc, not to a section**. Reordering the menu means moving
the section names between the `--section-*` tokens in `css/01-base.css` `:root`
(and the matching `colorHex` in `site-sections.js`), leaving the
purple → red sequence where it is. `SITE_SECTIONS`' own array order is
unrelated: it is brain.js's hit-test precedence, and the regions overlap.

The last item in `nav ul` is not a destination on the site: `.nav-social` is X,
LinkedIn and GitHub. Three things about it:

- **It is one `<li>` holding all three links, not three items.** The bar is a
  row by default and a 14rem column past 1800px; as separate items the icons
  would become three more rows of that column. Inside one item they stay a
  cluster in both, taking the list's own gap in front of them and no margin of
  their own — a nudge that reads as separation in a row reads as a
  misalignment in a column.
- **The marks are inline SVG in `currentColor`**, so they inherit `nav a`'s
  colour — which is what `main-page--dark-zoom` overrides. They go light with
  the section links during the Research zoom and `21-reality-zoom.css` never
  has to name them. Inline rather than the People panel's icon CDN
  (`SI_CDN` in `people.js`): that panel is opened on demand, this bar is on
  screen for the whole visit.
- **Nothing in script needed changing.** `updateActiveNav` clears `.active` off
  every `nav a` and then sets it by `[data-section-id]`, and
  `applySectionTheme` finds links by `navHref`; an external href matches
  neither.

## Full-bleed backgrounds and the wide-screen sidebar

At `min-width: 1800px` the nav becomes a 14rem left sidebar. The inset for it
lives **on the sections**, not on `#main-page`:

```css
#main-page > *:not(nav):not(.fab-group):not(.hero):not(.people-full):not(.research-full) {
    margin-left: 14rem;
}
```

`#main-page` clips overflow, so anything indented there can never bleed back out
to the screen edge. Sections that paint a full-bleed background (`.hero`,
`.people-full`, `.research-full`) are excluded and take the sidebar as
**padding** instead, which keeps their backgrounds reaching x=0 while their
content stays aligned with every other section. Adding another full-bleed
section means adding it to that `:not()` list and giving it the matching
padding.

`.research-full` goes one step further: its header and card tab want the sidebar
as padding, but the zoom stage has to bleed back across it, so `.rz-stage` takes
`margin-left: -14rem; width: calc(100% + 14rem)`. That override has to sit with
the rest of the `.rz-*` rules — those come later (`css/21-reality-zoom.css`, and
`20-wide.css` is loaded before it), and a copy parked in the earlier
`@media (min-width: 1800px)` block loses on source order. The symptom is
specific: the negative margin applies, the width does not, and the black stops
14rem short of the right edge.

Related: a full-bleed child sized with `calc(-50vw + 50%)` assumes its element
is centred in the viewport. Once a section carries asymmetric padding that stops
being true and the background falls short. Overshoot (`left: -100vw; right:
-100vw`) and let the section's own `overflow-x: clip` cut it back.

## There is no brain and no button ring below 900px

`css/19-narrow.css` takes `.hero__brain` away entirely, and the gate that goes
with it is in `index.html`. Stacked, the WebGL canvas and the six wrapped pills
came to **723px of a 1292px hero on a 375x812 screen** — more than half the
first screenful spent on a model nobody can orbit with a thumb. The nav bar
carries all six destinations already, so the ring is the *second* copy of that
menu, not the only one; the hero is 769px now.

**Hiding it in CSS is not enough, and both of the other two halves were missed
on the first pass:**

- **`brain.js` is all top-level code with no init function**, so a static
  `<script src>` runs whatever the stylesheet says: three.js builds a renderer
  against a 0x0 container and fetches the 5.7 MB `img/brain.glb` to draw
  nothing. It is a conditional `import()` in an inline module now, gated on
  `getComputedStyle(host).display !== "none"` — asking the stylesheet rather
  than re-testing the breakpoint, the same arrangement as `--rz-mode`.
- **`<link rel="preload" href="img/brain.glb">` is honoured whether or not
  anything ever asks for the file.** Gating the module while leaving the
  preload alone saved exactly nothing — measured, the phone still pulled all
  5.7 MB. It carries `media="(min-width: 901px)"` now, and **that is the one
  place this breakpoint is written twice**: a preload cannot ask the
  stylesheet. Keep it in step with `19-narrow.css`.
- **The resize listener is for a tablet turning over, not for a dragged
  window.** An iPad is 768px in portrait and 1024px in landscape, so it crosses
  this breakpoint on rotation; without it the brain is permanently absent for
  anyone who loaded the page the short way round. It fires once and removes
  itself.

Verified at 375 (no fetch), 768 (no fetch), 768 → 1100 (loads on the resize)
and 1280 (loads at parse). Note when checking this in a preview pane that
**`resize_window` does not dispatch a `resize` event to the page**, so the
rotation path has to be driven by hand — a canvas that fails to appear there is
the pane, not the gate.

## The hero's disc has to be taller than the hero

The white half of the hero is a circle (`.brain-atlas::before`) plus a plain
rectangle filling everything to its right (`::after`). That reads as a cut-out
in the black **only while the circle's top and bottom clear the edges of the
hero** — the moment they do not, the rectangle's own left edge is exposed above
and below the arc and the black grows flat vertical sides mid-curve.

The circle used to be sized off the atlas alone (172% of it), and the atlas
shrinks with the viewport width while the hero stays `min(800px, 100vh)` tall.
Between ~900px (where the layout stacks) and ~1040px the two crossed over: at
1000×800 the disc was 756px in an 800px hero, i.e. 22px of straight edge at each
end. So the diameter is now
`max(172%, calc(var(--hero-height) + 24px))` — 12px of overhang whatever the
width, which is what 172% itself comes to where it does still fit, so nothing
changes at the sizes that already worked.

`--hero-height` comes from `100cqh` on `.hero__brain`, which is
`container-type: size`. That column's height comes from the grid row and never
from its contents, so size containment costs nothing there — **except in the
stacked layout below 900px, where the row is content-sized and containment
would collapse it to zero.** `19-narrow.css` sets `container-type: normal` back
for exactly that reason. `cqh` measures the *content* box, hence the
`+ var(--brain-pad) * 2`.

Growing the disc keeps its **leftmost point pinned** (`--disc-left: -36%`)
rather than its centre, so it opens the arc out to the right instead of pushing
white further into the intro column — the text already runs close to the buttons
at these widths. The six buttons ride the same `--disc-radius` at
`--btn-angle` of ±10°, ±30°, ±52°, so they stay on the divide by construction
instead of by six hand-tuned percentage pairs.

## `:not()` carries its argument's specificity

`.people-full > *:not(.people-full__video)` is (0,2,0), which silently beat
`.tab-margin-nav`'s `position: absolute` at (0,1,0) and dropped the tab arrows
into normal flow at the bottom of the section. Prefer giving the backdrop
`z-index: -1` plus `isolation: isolate` on the section over reaching for a
blanket child selector — the negative layer then paints above the section's own
background and below all content, touching nothing else.

## Everything that reacts to scroll shares one frame

`shared/scroll-loop.js`. Six things read `#main-page` scrolling — the active-nav
highlight, the nav's reveal over the hero, the two backdrop parallaxes, the
"Like this website?" FAB and the Research zoom's whole dive — and each used to
register its own listener. Every one of them has the same shape: measure with
`getBoundingClientRect()`, then write a custom property or toggle a class.

Six of those interleaved in one event is textbook layout thrash — the first
handler's write invalidates layout, so the second handler's read forces the
page to be laid out again before it can answer — and it ran **per event**, which
on a trackpad is several times per painted frame. Measured on the homepage,
twelve scroll events at a settled position:

| | before | after |
|---|---|---|
| `getBoundingClientRect()` calls | 120 | 10 |
| of those, taken after a style write | 115 | 3 |
| `setProperty` calls | 22 | 1 |
| document-wide `querySelectorAll` | 12 | 0 |

Mid-dive on the Research zoom, the same twelve events: **120 → 9** reads,
**118 → 1** forced, and **384 → 30** style writes.

Three things hold that up, and they are separable:

- **`onScroll(container, handler)` coalesces into one `requestAnimationFrame`.**
  That is where a scroll-driven write belongs anyway: rAF runs after the frame's
  scroll events and before style and layout. Handlers are wrapped individually,
  so one throwing cannot take the other five down with it — which is the
  isolation separate listeners gave for free.
- **A handler that would write what is already there returns first.** The active
  nav answers with the same section for hundreds of frames at a time, and the
  parallaxes sit clamped at the end of their travel for whole sections; a
  custom property re-written with its current value still invalidates style on
  everything that reads it.
- **A module that can take all its measurements at once does** — `readFrame()`
  in `reality-zoom.js` is that, and it is why the dive's forced layouts went to
  one. `paint()` used to take its own rect *after* writing a few hundred custom
  properties, and `leftBy()` a third after that.

**`resize` is deliberately left alone.** It is a transient gesture rather than a
continuous one, and every scroll-driven module here routes `resize` to the same
update function — which is what makes
`window.dispatchEvent(new Event("resize"))` a working stand-in for a scroll in a
preview pane that fires neither scroll events nor animation frames (see
../CLAUDE.md, "Verifying changes"). Putting resize behind a frame would take that away, and
buy almost nothing.

**What it does not do is reorder reads before writes *across* handlers.** That
needs every caller split in two, and the win is much smaller than the one above
— the expensive part was doing the whole run several times a frame. The three
reads still left after a write are the nav handlers measuring after the zoom has
written; if that ever matters, splitting the API is the move, not reordering
registration, which would be an implicit priority nothing states.

## Backdrop parallax

`trackSectionParallax(box, layer, cssVar)` in `script.js` drives both backdrops.
Travel is clamped to `|box.height - layer.height| / 2`, which covers both
arrangements in use:

- **shorter than its box** (People video) — the box is `.people-full__video`,
  which is the section *minus its bottom padding*; the video is sized to full
  width at its own aspect ratio so the whole frame stays visible, moves within
  the letterbox gap and is never cropped. This was an explicit requirement for
  that clip.
- **taller than its box** (Information image) — the box is the banner wrapper,
  which starts at the tab line rather than the section top, so the section is
  the wrong thing to measure against. The image overhangs the wrapper by 14%
  and is cropped by it; it moves within that overhang.

**`anchor: "bottom"` is where the swing sits inside the slack, and only the
People video asks for it.** Centred — the default — is right for a layer taller
than its box, where the overhang is symmetric. It is wrong for one shorter than
its box: the video's feathered bottom edge then floats at whatever height the
roster gives the section, and it finished *below* the Alumni bar, which reads as
the backdrop outliving the roster. Anchored, full progress lands the layer's
bottom edge exactly on the box's.

**Both halves of that are needed and neither works alone.** The box has to stop
at the section's bottom padding (`inset: 0 0 var(--people-pad-block) 0`) — the
line the Alumni bar sits on — *and* the swing has to be anchored to it.
Shortening the box alone only moves the float; anchoring alone lands the band on
the section's edge, a padding's worth past the bar. `--people-pad-block` exists
because `19-narrow.css` takes that padding to 3rem, and the box has to follow:
that sheet sets **the token, not `padding`**, or the two drift apart with
nothing to warn you.

Consequently `initPeopleVideo` passes the *backdrop*, not the section, to
`trackSectionParallax` — the custom property is written there and inherits down
to the video.

The scroll ratio is clamped to `[0, 1]`. `viewMargin` deliberately runs
`update()` while the layer is still below the fold, where the raw ratio goes
negative — unclamped it pushes the layer past its own overhang and uncovers a
strip at the far edge (this was a real 9px gap under the Information banner).

Section heights are not settled at startup (content is injected async) and
change when tabs switch, so a `ResizeObserver` recomputes. Without it the first
reading measures an empty section and clamps travel to zero.

## Tabs

Four tab groups (People, Research, Publications, Information) all share
`shared/tab-slide.js`:

- `swapTabPanels(panels, activeId)` — replaces toggling `hidden` directly. Pins
  the outgoing panel where it sat, lifts it out of flow and slides it away,
  uncovering the incoming one. Measure **before** showing the incoming panel or
  the outgoing one jumps.
- `initMarginTabNav(section, buttonSelector)` — turns the empty side margins
  into prev/next controls. Forwards to the group's own tab buttons via
  `.click()`, so per-group behaviour (URL state, theming) is preserved.

Slide direction comes from panel order, except when a margin arrow was used — an
arrow states its own direction so wrapping from the last tab to the first still
slides the way the arrow points.

**The host has to be the section, not its content column.** A zone is as wide as
the strip between the host and the centred column
(`(100% - var(--content-inline-size)) / 2`), so hosting it *on* that column
leaves nothing: News passed `.news-shell` and got 32px zones against every other
section's 113px, which is a target nobody can find and is why that section
looked like it had no arrows at all. All five now host on their `<section>`.

Two sections need more than the default:

- **Research** hides its zones while the Overview tab is showing. That host is a
  ~800vh sticky stage, and invisible click targets down the full height of the
  dive mean a stray click in the dark swaps the tab out from under the reader.
  `research.js` writes `data-active-tab` on the section and
  `css/05-research.css` takes the zones away on `overview`. The arrow is left
  doing the job the section was missing — the way back from Creations — while
  the way *out* of Overview keeps the standing FAB, which is labelled and up
  for the whole section.
- **`.people-full` and `.research-full` past 1800px.** Both take the sidebar as
  padding rather than margin, so their content column is not centred in the
  padding box and the zone formula overshoots; `css/20-wide.css` corrects both
  zones by hand for each. Any other full-bleed section that gains arrows needs
  the same pair of rules.

Zone width assumes the content column is centred in the section's padding box.
`.people-full` at ≥1800px is the exception and is overridden by hand.

## The pager

`shared/pager.js`, styled as `.pager` in `css/07-shared.css`. News and
Publications both use it: ← "Page N of M" →, hidden below two pages.

It replaced a numbered strip on the Publications side (← 1 2 3 4 →). A row of
page buttons grows with the archive, reflows every time a filter changes the
count, and answers a question — "take me to page 6" — that nobody asks of a
list they have just re-sorted. This form is the same size whatever the count,
which is also why the position label has a fixed `min-width`: without it the
row shuffles sideways when the total goes from one digit to two.

Three things about it:

- **It owns no state.** The caller already holds a page number — it has to, to
  slice its own list — so `render(page, pages)` is told the truth every time
  the list is drawn and the arrows only ever hand a number back. That is what
  makes it correct for a page that can move without the pager being touched,
  which is every filter and every re-sort.
- **It is a `div` with `role="navigation"`, never a `<nav>`.** The stylesheet
  dresses bare `nav` as *the* site navigation — fixed, cream, a 14rem sidebar
  past 1800px — and a second one picks all of it up. Same trap as the zoom's
  landmark rail.
- **It carries no section names.** `--pager-accent` and `--pager-ink` are the
  whole of its theming, declared by each section next to its own accent tokens.
  A component sheet that selected `.news-full .pager` would have to know about
  every section that ever used it.

`css/07-shared.css` (was `07-tabs.css`) is where a shared component's CSS
belongs, and the number is the reason: every section sheet comes after it and
can override. Parking a shared component in a section's own file puts it out of
reach of every section before it.
