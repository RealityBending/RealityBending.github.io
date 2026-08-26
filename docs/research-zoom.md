# The Research zoom (the Overview tab)

A `position: sticky` stage inside a tall track, with one 0 -> 1 scroll number driving the Magritte eye's zoom, the veil, and the landmarks. The largest single piece of machinery on the site; nothing else depends on it.

## The Research zoom

The Overview tab is `research/reality-zoom.js`: a `position: sticky` stage inside
a tall track, with one 0 → 1 scroll number driving the Magritte eye's zoom, the
veil, and the landmarks that rise out of the dark and pass the viewer. Nothing
is a CSS animation, so the whole thing scrubs in both directions.

**The landmark count is not written down anywhere.** The timeline's fractions
are derived from `research-content.js`'s own list against the vh budgets, the
rail sizes itself from it, and the track's height follows — so adding a station
costs `SCENE_VH` of scroll and nothing else. It does move the scroll budget: at
five landmarks the dive is ~805vh, which is what "~800vh" means throughout the
notes below.

**The last stretch is the first one run backwards.** Past `scenesEnd` the veil
lifts and the eye pulls back to scale 1, so `p = 1` is the same picture as
`p = 0`. That is not decoration: it is what lets the gate be shut behind a
reader who has flown the whole thing without anything appearing to move. The
outro is written as `× (1 - surface)` over the dive's own numbers rather than as
a second set of ramps, so there is nothing to keep in step. `OUTRO_VH` is
shorter than `ZOOM_VH` — there is nothing new to read on the way out, and a
pull-back as long as the dive reads as the section refusing to end.

Consequently **every landmark exits, the last one included.** It used to hold
while the stage scrolled away, because there was nothing after it; now the dark
has to be empty before the eye comes back into it. For the same reason the
rail's fill spans `[zoomEnd, scenesEnd]`, not `[zoomEnd, 1]` — the dots cover
the landmarks, not the pull-back.

**It is opt-in, and the gate changes only the scroll budget.** Locked — the
default — the track is exactly one stage tall, so the sticky stage has no travel
and the page carries that full screen of the eye past like any other section.
Opening buys the ~800vh the dive is scrubbed through. Nothing is resized and
nothing moves: the eye is at the same place and the same scale either side of
the switch, and all that is added when locked is `.rz-gate` over the top.
`.rz--unlocked` is the whole switch.

**Because of that, nothing anywhere on the page may key off a fraction of the
scroll height.** Opening the gate changes `#main-page.scrollHeight` by ~800vh,
so "half way down the page" is a different place depending on whether a reader
opened a section — and with the Research section being the tallest one even
shut, half of the scroll height already landed inside it. The "Like this
website?" FAB was written that way and appeared over the middle of the zoom
instead of after it; it now tests `#sec-research-full`'s own rect
(`bottom <= 0`), like its withdrawal already tested Information's. Section
boundaries are stable under the gate; fractions of the document are not.

The overlay *is* the button — `.rz-gate` is a `<button>` covering the whole
stage, so anywhere on the section opens it and the pulsing line only says so.
The site nav and the FAB group still sit above it and keep their own clicks.

**The settle-on-hover styling is scoped to `.rz-gate__label:hover`, not
`.rz-gate:hover`.** The button is the entire 100vh stage; with a section this
tall the pointer is "over" it for nearly the whole time it is on screen, so
hovering the button would have settled the pulse the instant the overlay
appeared and it would never breathe again. Scoped to the label's own small box,
the settle only happens when the pointer is actually on the words. Keyboard
focus keeps the whole button — there is no cursor position for it to aim at.

Four ways back out. The ✕ (`.rz-close`, centred at the foot of the stage) and
Escape are both a **cut**, deliberately: that is the way out for a reader who
has decided they are done, and making them sit through an animation first would
be the section arguing. The only animated pull-back is the end of the track, and
it is scrubbed like everything else.

The other two are leaving the track at either end: scrolling back up out of the
top, or flying the whole dive and starting to leave. Both are `EXIT_*_MARGIN` of
a viewport past the edge, which is hysteresis — without it the smallest twitch
past either end flips the gate. Down gets the larger margin (a quarter of a
screen) because it doubles as grace: the reader can sit on the last frame, and
scrub back into the dive from just past it, before the gate re-arms.

**The way *on* to Creations is a FAB, not something inside the section.** The
Overview is a ~800vh sticky stage, so anything anchored in it is either fixed to
one frame of the dive or scrolls away on the first pull; `#fab-research-creations`
joins the standing FAB group instead and is up whenever Overview is both the
active tab and the thing filling the screen. `research.js` owns it, and it is
now the **only** way on: the rail used to end in a `.rz-rail__exit` button
saying the same thing, which has gone. It said it from a place that only
existed once the dive had gone dark, where this one is up for the whole
section. Two things about it:

- It tests the **section's own rect**, like the promo FAB and for the same
  reason — a fraction of the scroll height moves by ~800vh when the gate opens.
- It is **placed against the group, not laid out in its column.** The column
  stretches every button to the width of its widest, and this label is the
  longest text in the group; as a flex item it would have widened
  "Hire us" and "Join the Lab" for the whole visit, on every page where it never
  appears. `position: absolute; bottom: 100%` contributes no width and no
  height, so the other two never move and there is nothing to measure — which is
  where it parts company with `.fab--promo`'s negative-margin collapse.

**The down exit is measured against the stage, not the far side of the track,
and getting that wrong is a bug that has already been shipped once.** From
`p = 1` on, the sticky stage is pinned to the track's foot, so `track.bottom`
and the stage's bottom are the same number and `track.bottom === stage height`
is exactly the last frame. The original test was `track.bottom < 0` — "the track
has gone" — which put the trigger a whole screen further down, past the stage's
entire slide-off. A reader who stopped anywhere in that band never armed the
exit at all, and that band is precisely where you stop, because it is where the
next section first comes into view. Measured: 806px of dead zone on a 720px
viewport, in which the gate could never shut no matter how long you waited.

That the stage travels with the track's foot is also **what makes the collapse
safe**: the stage the reader is still looking at and everything after the
section both move up by the height the track loses, so `setUnlocked`'s single
scroll correction covers both and nothing on screen appears to move. This holds
everywhere the down exit can fire, which is why the same geometry (`bottom <=
stage.clientHeight`, not `<= 0`) gates that correction.

**The collapse is deferred by exactly one animation frame — it does not wait
for the page to stop moving, and must not be made to.** rAF runs after that
frame's scroll events and before style and layout, which is where a ~800vh
layout change belongs, and it coalesces several scroll events in one frame into
a single collapse. `shutGate()` re-tests `leftBy()` in the frame that does the
work, so a reader who crosses and comes straight back is not ejected.

An earlier version instead required `mainPage.scrollTop` to read the same value
across eight consecutive frames, on the theory that collapsing under a running
gesture was what tore the stage. **That theory cost more than it bought.** It
made the relock hostage to the reader pausing: turn round inside the window and
the poll bailed without rescheduling, and since the only thing that could re-arm
it was a fresh edge crossing, the gate then stayed open permanently — scrolling
back dropped the reader into the middle of the dive, live-painting the eye at
~9× from a scroll position nobody intended, with the promoted layer rasterising
in bands. Stillness was never what made the collapse safe. The scroll correction
is.

Three more things guard the same collapse:

- **In-page anchors shut the gate on the click, in the capture phase.** The nav
  links and the FABs are plain `#fragment` hrefs, so the *browser* does that
  scrolling, and it resolves the target's offset once, when the navigation
  starts. Collapse the track during the flight and that offset is stale by the
  whole scroll budget — the reader lands ~800vh too far, at the foot of the
  page, and nothing here can re-target it. Shutting the gate first means the
  browser measures against the collapsed layout. Capture phase because the
  guarantee is "settled before anything reads it", and script.js opens the
  Information tabs off these same links. Modifier-clicks are skipped (no
  navigation), and so is static mode (nothing collapses asynchronously there,
  so there is no stale offset to prevent). The side effect is deliberate: a nav
  link pressed mid-dive leaves the zoom, the same call the Creations FAB makes.
- **The scroll position is corrected by hand.** When the reader is already past
  the track's end, everything they are looking at moves up by whatever the track
  lost, so `setUnlocked` subtracts that delta. The numbers it needs
  (`scrollBefore`, `heightBefore`) have to be read *before* `syncGeometry()`:
  shortening the page under a scroll position past its new end makes the browser
  clamp on the spot, and a `scrollTop` read afterwards has already moved. Note
  also that `scrollTop`'s **setter honours the container's `scroll-behavior`**,
  which is `smooth` here — corrections must go through
  `scrollTo({behavior: "instant"})`.
- `.rz-track` is `overflow-anchor: none`. Scroll anchoring would answer the same
  height change with a correction of its own, against an anchor picked inside
  the thing that changed. Two answers to one shift is a jump.

**`.rz-zoom` must not be promoted to its own compositor layer — no
`will-change`, no `backface-visibility: hidden`, nothing else that would give
it one.** A promoted layer is rasterised at its own size *times its scale*, and
this one is the whole stage scaled by up to `coverScale` (~9), so the texture is
`stage width × 9` across. That goes past the 16384px GPU texture limit as soon
as the viewport is wider than **~1810px** — which is essentially the same place
the sidebar appears, so every wide-screen reader was over the line:

| viewport | raster width at full zoom | |
|---|---|---|
| 1280px | 11954px | ok |
| 1800px | 16335px | ok, by 49px |
| 1900px | 17079px | over |

Past the limit Chrome drops tiles, and dropped tiles composite as nothing — the
stage's own black showing through the eye in rectangles. It only ever appeared
on the way back *out*: `paint()` hides this element while `--rz-veil` is 1, and
un-hides it the moment the veil starts lifting, which is at ~9× scale — the
worst case, and the one moment the reader is looking straight at it. Measured,
the reveal lands at `p ≈ 0.84`, `--rz-scale: 9.03`.

Unpromoted, the transform is painted into the sticky stage's layer and clipped
by its `overflow: hidden`, so the raster is bounded by the stage however far the
eye is scaled. `will-change: transform` was never buying anything here: it
caches a raster at one scale, and this scale is rewritten every scroll frame.
The geometry is not the suspect if this ever comes back — the cover fit was
measured across the whole outro and the eye covers the stage at every point of
it, with no gap at any `p`.

**The two plain FABs invert over the stage**, and this is a fix rather than a
flourish: `.fab--primary` ("Join the Lab") is `#111` on cream, so over the
zoom's `#06070b` it was a near-black pill on a near-black field — only its cream
lettering showed, reading as text floating on nothing. The plain `.fab` beside
it keeps its cream surface but loses its 1px hairline and its drop shadow, both
of which are dark. So the two swap grounds (`css/18-fabs-footer.css`): the plain
one takes the nav's dark glass and the primary takes the cream, which preserves
the hierarchy exactly — on a light page the emphatic button is the dark one, on
a dark one it is the light one. `.fab--promo` and `.fab--research` are excluded
because each carries its own saturated gradient and reads on either field.

**`.fab--primary` is excluded from the plain rule rather than overriding it.**
Three `:not()`s put that selector at (1,4,0) against the primary's (1,2,0), so
written as an override the primary silently loses and both buttons come out as
dark glass. That was written, shipped into a working tree and only caught by
measuring the computed background — it looks exactly like a rule that did not
apply. Disjoint selectors, no specificity race.

Verifying it needs the transitions killed first. The buttons cross-fade over
0.35s with the nav, and a preview pane with no animation frames never advances a
transition — so every transitioned property reads as its *start* value, while
`backdrop-filter`, which is not in the transition list, has already changed.
Measured, the nav reported `rgb(245, 244, 239)` while the dark rule was
demonstrably applying. Inject `* { transition: none !important }`, read, remove.
Same trap as the frozen transitions in ../CLAUDE.md, "Verifying changes", but this one
looks like a selector that does not match.

Leaving the Overview tab locks the zoom too (`activateTab` in `research.js`),
for the same reason: the panel is about to be `display: none` and its track goes
with it. It calls `driver.lock()`, which is the instant path — no pull-back,
nothing left on screen to animate — and passes `focus: false`, because the
reader's focus belongs to the tab button they just pressed.

`.rz-close` is the **last** child of the stage, and that is load-bearing.
Stacked it is `position: sticky; bottom`, and a bottom-stuck element can only be
pushed *up* out of its natural position — as a first child it just scrolls away
off the top instead of pinning. The same rule needs `overflow: visible` on the
stacked stage: the base hides overflow to clip the zoomed eye, and leaving it on
makes the stage its own scrollport, which silently stops the sticking.

Repositioning on the switch is the one move that cannot be avoided, because a
sticky stage pins to the top of the viewport the moment its track is taller than
it is. It has to happen **before** `refresh()`, not after: `render()` runs the
scroll-up exit test, and against the pre-switch scroll position that shuts the
gate on the same frame the button opened it. The exception is the scroll-up exit
itself, which passes `reposition: false` — the reader is already moving.

The locked rules are written `.rz:not(.rz--unlocked) …` rather than put in a
media query, because they also have to outrank the static-fallback block —
locked on a narrow screen is still the overlay, not a stack of landmarks.

- **The pupil is painted into a JPEG**, so no CSS can find it. The module lays
  the image out by hand — a cover fit computed in script, not `object-fit` —
  because the pupil's centre and radius have to be known in pixels: the centre
  is the `transform-origin` everything turns around, and the radius sets how far
  it must scale before black clears the furthest corner. `PUPIL_X/Y/R` were
  measured by scanning the file's own pixels (the dark run spans x 831→1096,
  y 537→804 in 2000×1345); eyed values were 7px out and showed as a ring at
  scale 1. Re-measure against the file if the image is ever replaced.
- **Zoom the exponent, not the scale.** A steady rate of approach is a constant
  *ratio* per unit of scroll, so the scale is `coverScale ** t`. Interpolating
  the scale linearly spends the first half of the dive barely moving and then
  lurches.
- **Progress is clamped to [0, 1]**, so past the end of the track the veil stays
  opaque. Anything that reacts to "the section is dark" — the nav's dark dress,
  in particular — has to gate on the stage's own rect, or it stays black for the
  rest of the page.
- **Whether there is a zoom at all is decided in the stylesheet**, not in
  script: below 900px and under reduced motion the landmarks stack instead. The
  module reads that back through the `--rz-mode` custom property (`zoom` /
  `stack`) rather than re-testing the media queries, so there is one source of
  truth and crossing the breakpoint switches modes for free. It deliberately
  does *not* infer this from the stage's `position` — that was the original
  signal, and it broke once the gate started moving `position` too.
- **The margin arrows are taken away over this tab**, not over the section. The
  zones span the whole host and this host is a ~800vh sticky stage, so over the
  zoom they are invisible click targets down the full height of the dive and a
  stray click in the dark swaps the tab out from under the reader. They exist
  over Creations only — see [layout.md](layout.md), "Tabs".
- **The rail has its own ramp (`--rz-rail-in`), and it is not the veil's.** It
  used to ride `--rz-veil`, which only starts closing at 72% of the dive — so
  the stations announced themselves at the last possible moment and were gone
  again before the eye had finished coming back. It now comes up between 26%
  and 58% of the dive, over the painting, and goes down between 24% and 70% of
  the outro, after the eye is back. Two consequences: what makes it clickable
  is its own `.rz--rail` rather than the veil's own state, because it outlives
  the dark at both ends;
  and it carries a `drop-shadow` now, because it is up while a bright sky is
  still behind it.
- **A landmark's `text` may be one string or several, and several is a
  different object.** An array becomes a paragraph each, and `buildLandmark`
  marks the scene `.rz-scene--essay` when there is more than one. That class is
  not decoration: **the stage is exactly 100vh and clips**, so the leading that
  is right for a four-line caption overflows at twenty lines and the section
  silently loses its last paragraph to `overflow: hidden`. Measured at
  920 × 600 — the tightest two-column case, since below 900px the whole thing
  stacks and scrolls — the question landmark came to 617px in a 600px stage.
  The three steps are ordered by what they cost: a tighter copy gap and a
  tighter leading (which a block this long wanted anyway) take it to 561, and
  only then does a query at `(min-width: 901px) and (max-width: 1100px) and
  (max-height: 700px)` touch the size of the type, bringing it to 503. Wide and
  short is never the problem — the copy column grows with the viewport and the
  block wraps to fewer lines, so 1120 × 600 comes to 474 untouched. The lower
  bound of that query is the stacked fallback's own breakpoint, or a phone at
  375 × 667 would match it and shrink its text where nothing can clip.
- **`--held` gates the keyboard as well as the mouse now.** `paint()` sets
  `scene.inert` to the opposite of held, next to the class it already toggles.
  `pointer-events` had always kept the pointer out of a landmark that was not
  facing the reader; without this the *tab order* still ran through every
  widget in the whole dive whatever was on screen, which the cloud made
  impossible to ignore — that one landmark contributes twenty-five links. It is
  written **only inside `paint()`**, and that is what keeps the stacked fallback
  safe: nothing is ever held there because `paint()` never runs, so a blanket
  rule would have made the entire static page non-interactive.
- **The figures are per-landmark and their state lives in `data-*`, but they
  all ask the same way.** `buildAsk()` is the strip under a figure — one line
  and one button, where the button turns the question into its answer and
  itself into the way back — and Illusions and AI-Beliefs both take their
  `question` / `answer` / `button` / `reset` from `research-content.js` through
  it. The line reserves two lines' height whether or not it needs them: the
  landmarks are centred in the stage, so a question and an answer of different
  lengths would otherwise resize the figure and shift the whole scene under the
  reader on the press. Body & Emotions borrows the shape without the reveal —
  its button is a placeholder for the interoception test and says
  "In construction" when pressed (`aria-disabled`, not `disabled`, so keyboard
  focus is not dropped on the floor). It carries no caption: the loop is the
  explanation.
  The **first** landmark is the exception at the other end: it has no figure at
  all now. It carries the Lumière train film behind it and three paragraphs that
  arrive one at a time, and the word cloud it used to hold went to the last
  landmark. See "The opening landmark" below.
  The **last** landmark is the network (see below), and it is where the one
  "point at a label, get text" gesture in the dive now lives.
  A node there may carry an `href` — an off-site paper, shown as "See example ↗"
  — **or a `tab`, which is the same offer pointing at another tab of this
  section**: Assessment and Open Science both point at Creations, because the
  work those two name is the work that tab holds, and a paper somewhere else
  would be a worse answer than the lab's own shelf of it. Three things about
  that shape, which is the one to copy for any other in-page destination:
  - **It is a real anchor at the tab's own path**, from `hrefForRoute` in
    `deep-link.js` — so middle-click, "copy link address" and a crawler all get
    the address the router itself would write, and it is mount-aware, where a
    typed `/research/creations/` would be a URL outside a sub-path-mounted copy.
  - **The plain click is caught in `research.js`**, by a delegated listener on
    the section root keyed to `a[data-research-tab]` — the same shape as
    Information's `[data-contact-tab-target]`. Without it the browser reloads
    the page to reach a tab. It skips modifier- and middle-clicks, so those
    still open the page for real. It goes through `goToTab`, so a link pressed
    mid-dive shuts the gate and scrolls the header back exactly as the
    Creations FAB does.
  - **The two kinds must not look alike.** `↗` is this site's mark for "leaves
    the site" and has to keep meaning only that, so the internal one takes `→`
    ("See our tools →") and no `target`/`rel`.
  The AI-Beliefs pair is two real paintings (see Assets) with the same badge
  over both; picking one only marks the reader's answer, and the button is what
  tells them. Nothing but the frame is laid out in a card — a verdict line
  under each painting used to sit there at opacity 0 while the question was
  still open, which is what put more space under the pair than over it.
- **The Metascience landmark's figure is a fanned deck of photographs, and it
  ends on this lab.** `buildEraFigure` + `ERA_ARTS` in `reality-zoom.js`,
  `.rz-era*` in the stylesheet, seven `stations` in `research-content.js`, in
  this order: Bosch's stone of madness, Pinel, a phrenological chart, Charcot's
  lesson, Galvani's frog-leg experiment, Wundt's laboratory, and a photograph of
  the Reality Bending Lab recording EEG and physiology. They spread down and to
  the right in about a second and come to rest as a pile.

  **The order groups by what kind of reading each plate is, then turns.** The
  first three are observations taken from the outside — two paintings of
  madness treated as spectacle, then a chart of the skull read like a map —
  and Charcot's lesson closes that group as its clinical peak, a live
  demonstration for an audience. Galvani then turns the deck from watching the
  mind to measuring the body's own electricity, which the last two cards carry
  forward: an instrument recording it, then this lab still doing so. The
  galvanoscope sits out of date order for that reason — it is 1791, a century
  before the Salpêtrière lesson beside it — because the argument is the group,
  not the year.
  **The last card is the argument.** The station is not "old instruments are
  interesting"; it is the old site's Metascience theme, whose three parts
  (history and philosophy, data analysis and statistics, methods and tools) are
  the landmark's three tags. A line of instruments that each looked definitive
  and each turned out to be a stage, ending on our own bench, is the only
  honest place to put ourselves in it. **Nothing may be appended after `lab`**
  without changing what the run says.
  Seven things:
  - **The stack is the point, not the sequence.** Two earlier versions showed one
    picture at a time — a walkable timeline with a dot axis, then a deck turning
    on a spindle — and both spent nearly all of their life showing a single
    image, so the *arc* had to be remembered rather than seen. Fanned, all six
    are on screen at once and the claim is the picture: six overlapping frames,
    oldest at the back, ours in front. The deal is what says which order they
    came in.
  - **Peeling is what earns the legend back.** Every card keeps a sliver showing,
    and pointing at one lifts everything in front of it away so it can be seen
    whole. With the pictures now permanently overlapping, a reader who wants to
    know what the half-hidden painting behind the lab photograph *is* has a way
    to ask and an answer that appears only when asked — which is different from
    the caption-on-every-card the timeline had, and which was four labels for one
    image.
    The peel is `data-peeled` on the cards *after* the focused one, never
    anything on the focused card itself: **a reveal that also moved the thing
    being revealed is the one way to make this gesture feel unreliable.**
  - **The legend's height is reserved and its two lines are optional.** Title on
    one line, `artist, year` on the next, filled for whatever is being pointed at
    and otherwise describing the card on top. **Two cards genuinely have no
    attribution** — a phrenological chart and a catalogue engraving of a
    chronoscope are anonymous works, and inventing one for either would be worse
    than a short line. The year is the *picture's*, not the era's: Robert-Fleury
    painted 1795 in 1876, and a date under a painting is read as that painting's
    date. That distinction is why the era years the timeline stamped on the frame
    are gone rather than reused.
  - **Every card is a real `<button>`.** It peels the stack back to itself and
    names its own painting, which is a control — so it carries its legend as an
    `aria-label`. Six tab stops, and they cost nothing elsewhere: `paint()` marks
    every scene that is not holding the screen `inert`. Stacking is
    `z-index: var(--rz-i)`, and that is also the hit-testing — a card is covered
    by the ones dealt after it, so the only part that can take a pointer is the
    sliver still showing, which is exactly the edge the reader aims at. Nothing
    computes hit areas.
  - **The three fan numbers are one derivation and the card count is in it.**
    `--rz-card` + 5 × `--rz-dx` = 100% of the stage's width; vertically the pile
    reaches 98.6% of its height. Measured at 1280: the last card's right edge
    lands at 341.0 in a 341.1 box. **Changing the number of cards means
    re-deriving all three** — at seven, the same steps overflow. The offsets are
    per-card *transform* percentages, so they resolve against the card's own box
    and the maths holds at every figure size.
  - **The deal is a CSS stagger, not a JS timer.** One class on the deck, and the
    per-card delay is `--rz-i` times a step. A background tab clamps timers to
    roughly 1Hz, which would turn a one-second deal into six seconds of cards
    arriving one at a time; a transition delay is not a timer. The ticker that
    remains only arms the pictures and watches `--held` — dealing on hold and
    clearing on release is what makes the run play again on a second visit.
  - **The stacked branch needs its own layout, and `opacity: 1` is the
    load-bearing line.** Nothing is ever `--held` there, so the deal never fires
    — without the reset every card would sit at its undealt `opacity: 0` and the
    figure would be blank. `.rz--static .rz-era` lays them out as a flat
    `auto-fit` contact sheet instead, and **the cards are still buttons there**,
    so a tap names a picture: that is how a phone gets the attributions the fan
    gives a mouse. `transition: none` is required too, or a resize across 900px
    animates six cards out of the fan.
  - **The drawings are now a fallback nothing takes.** Every station has a
    picture, so `ERA_ARTS` renders only if one is ever missing — kept because a
    station added without an `img` has to render as *something*, and a grey box
    with a filename in it cannot be told from a broken image. **Each viewBox
    origin is offset so the drawing's own `getBBox()` centre lands on
    (100, 100)**; measured, they were up to 14 units out.
- **The last landmark is the word cloud, and it absorbed the four tiles that
  used to live there.** `buildCloudFigure` in `reality-zoom.js`, `.rz-cloud*` in
  the stylesheet, twenty-six words in `research-content.js`. **Pointing at a word
  rewrites the landmark's own heading and paragraph** and offers the work behind
  it — a citation that leaves the site, or "See our tools →" into Creations.
  It has moved and changed shape twice, and the reasons are worth keeping
  because both were nearly the opposite call. The cloud began in the *opening*
  landmark and lost its place there to the Lumière film. It arrived here as a
  nine-node network, on the argument that the last thing the dive says should be
  legible rather than impressive. That was right about legibility and wrong about
  **count**: nine nodes on a ring is all a ring will hold, and the point of this
  landmark is how far the question reaches — which is exactly what twenty-six
  words can show and nine cannot.
  Six things:
  - **The tiles were merged in, not discarded.** Three of the four — Deep Self,
    Neuroaesthetics, Open Science — were *already* words in the cloud, so their
    paragraphs became `about` on the word that existed rather than a second entry
    saying the same thing. Only Assessment needed a word of its own. Check that
    before adding anything here: the cloud's vocabulary is wide, and the odds are
    the thing being added is already in it.
  - **A word can carry three optional things and they compose.** `about` is
    prose; `paper` is `{title, cite, doi}`; `tab` points at another tab of this
    section. The paragraph shows `about` when there is one and the paper's
    *title* when there is not — most of the vocabulary carries a publication
    rather than a paragraph, and **writing twenty-six blurbs to fill that line
    would be inventing lab copy**, where the title of the work is the honest
    answer to "what does this word mean here". The link prefers the paper.
  - **A word with none of the three is drawn but not pointable**, which is the
    right answer when nothing in the list really covers it — a wrong paper is
    worse than none.
  - **Both swapped lines reserve their tallest state, and a `min-height` cannot
    do it.** `.rz-scene__copy` is `align-content: center`, so a line that changed
    height would not merely resize, it would move the whole column under the
    pointer mid-gesture. Each keeps a hidden ghost of its longest candidate in
    the same grid cell (`.rz-swap`), which is the only form that works at *every*
    column width. The heading's ghost is **computed** — the longest word in the
    cloud — so a new word longer than "Phenomenological Control" widens the
    reservation on its own. Measured across all twenty-six at 1280 and 920: the
    heading, the paragraph, the scene and the heading's own top are each a single
    value.
  - **The heading's cell is two lines and most headings are one**, so the live
    line is `align-self: center` — the slack splits above and below instead of
    sitting underneath as a hole. It has to be `align-self` on the item: grid
    items stretch by default, and `align-content` on the container does nothing
    when the track is exactly as tall as its tallest item. The paragraph is
    deliberately not centred; prose starts at the top.
  - **The link is a fixed box, not `min-height: 1lh`.** The `↗` and `→` fall back
    to a font with taller metrics than the label's, so the line box grew by 1.2px
    the moment the link had text — measured — and the centred column passed that
    into the heading. `height: 1.5em` + `overflow: hidden` pins it. At rest it
    has no `href`, so it is neither followable nor a tab stop.
  - **A word with a `tab` is a real anchor at that tab's path**, from
    `hrefForRoute`, carrying `data-research-tab` so research.js's delegated
    listener switches tab instead of the browser reloading the page. A word with
    neither paper nor tab but with `about` is still pointable, and gets a `<g
    role="button" tabindex="0">` rather than a dead `<a>` — an anchor with no
    `href` is not focusable and announces itself as a link to nowhere.
- **The opening landmark has no figure: it has a film behind it — and the film
  is an animated image, not a `<video>`.**
  `background: { image, still }` on a landmark in `research-content.js`, built by
  `buildLandmark` into a `.rz-scene__film` layer.
  The Lumière brothers' *L'Arrivée d'un train* runs behind three paragraphs that
  arrive one at a time — the 1896 audience that could not believe the train was
  not real, and then the same edge of reality today. It replaced the word cloud,
  which moved to the last landmark.
  Five things:
  - **It stopped being a `<video>` because a `<video>` could not be made to
    show up.** It was two encodes, `preload="none"`, a `--rz-mode` gate, a
    `load()` before `play()`, a silent `anullsrc` track muxed in against
    Chrome's power-pause, a `pause` listener fighting it anyway, and a logged
    `play()` rejection because the console was the only place a failure could
    be seen. Every piece of that was correct and measured, and the film was
    still reported **twice** as one that never played. That is the lesson worth
    keeping: a `<video>` has a queue of independent ways to end up sitting on
    one dark frame — an autoplay policy that refuses `play()`, the power-pause,
    a suspended `preload`, a mode gate — and **none of them is reachable or
    visible from CSS**, so the symptom is identical in all four cases and
    identical to a genuine bug. An animated image has none of them. `armSceneFilm`
    is gone, and with it every one of those notes.
  - **Animated WebP, not GIF, and the difference is not marginal.** 687 KB at
    the source's full 540 × 360 and 15fps, against **3 MB** for a GIF that had
    to fall to 360px, 10fps and 32 colours to get even that far — 1896 film
    grain changes every pixel every frame, which is exactly what a GIF's
    frame-delta compression cannot do anything with. Denoising first
    (`hqdn3d`) helps and does not close the gap. Support is Chrome 32 /
    Firefox 65 / Safari 14, wider than several things this page already needs.
  - **The clip is cut to the arrival, not the whole 51.7s.** t = 3.8 → 13.6:
    the title card ends, the platform is empty, the train appears far off and
    grows until the locomotive fills the frame. The rest of the reel is people
    on a platform, and it was what a reader arriving mid-loop used to get.
    **Recutting it changes the exposure, and the dimming is measured against
    it.** The band the copy sits over runs a mean of 84 and a peak of 221 in the
    arrival, against 67 and 171 in the full reel — bright sky and bright
    platform, where the rest is a crowd against dark carriages. Carrying the
    old dimming over put the worst patch at 128 of 255, i.e. **3.97:1** for
    white body copy, under AA on the one landmark whose copy has nothing
    between it and the picture. Re-measure `.rz-scene__video`'s two ramps
    against any new cut.
  - **The withholding survives and now costs nothing.** A browser does not
    fetch a background image inside a `display: none` subtree, and `.rz-scenes`
    is `display: none` until the gate opens — so the discipline the old
    `preload`/`data-src` dance existed to enforce is a property of the layout.
    **Verified: 0 requests before the gate at 1280**, one 687 KB request after.
  - **The stacked branch gets the still, and that is a gain, not a fallback.**
    13 KB, chosen in the stylesheet by the same media query that sets
    `--rz-mode: stack`, so the mode is still decided in one place and script
    does not read it back at all. It has to be **that** query and not the
    `prefers-reduced-motion` one beside it — put there first, a 375px phone
    with animation switched on still took the loop. And a phone used to get
    **no film of any kind**, because the old gate was `--rz-mode` in script:
    this landmark opened on a phone with nothing but its paragraphs.
  - **Stacked, `.rz-scene--film` has to take `position: relative` back.** The
    film box is absolute, and `.rz-scene` gives up its `transform` and `filter`
    in that branch — so both containing blocks go with them and the box climbs
    to `.rz-track`. Measured on a 375px phone: the picture sat at y=2406 while
    its own landmark was at y=379, behind whichever station happened to be half
    way down the stack.
  - **The two paths are declared in the content module and resolved against
    `document.baseURI` in script.** A `url()` in `css/` resolves against that
    folder — and so, it turns out, does a `url()` sitting in a *custom
    property* that a rule in `css/` consumes, even when the property itself is
    declared inline on the element. First attempt produced
    `/css/research/img/…` and a 404. `new URL(path, document.baseURI)` is what
    `<base>` would have done for an `<img src>`, and keeps it mount-aware.
  - **It is contained to the scene's box and feathered, not bled across the
    stage**, and that is about the source: at the box's 928px the 540px clip is
    a 1.72× upscale, which archival footage carries once it is desaturated and
    feathered, where stage-wide is ~3.5× and is mush.
    **The box is capped three ways — `min(58rem, 92vw, 132vh)` — and the third
    is the one nothing would tell you about.** It keeps a 3:2 and the stage is
    exactly 100vh and clips, so a cap on width alone grows past the stage as
    soon as the window is wide and short; `132vh` is that bound solved for the
    ratio (height = width / 1.5, so width ≤ 1.32 × vh holds the box inside 88%
    of the stage). Measured: 1280 × 720 takes the 58rem at 928 × 619, and
    1280 × 600 takes the vh cap instead at 792 × 528, clear by 36px at each end.
    The feathering is exactly why an overrun would not show. The radial mask is what stops a contained video reading as a boxed-in
    clip — with no visible rectangle it reads as the dark having a picture in it.
    It also sidesteps the full-bleed trap [layout.md](layout.md) documents: no
    `calc(-50vw + 50%)`, so the scene's asymmetric `padding-right` for the rail
    cannot make it fall short.
  - **The paragraph stagger counts `data-slot`, set per paragraph by
    `buildLandmark`, never `:nth-of-type`.** The copy column also holds a `<p>`
    eyebrow, so type counting is off by one — it put the delays on the wrong
    paragraphs and gave the last one none at all. And `.rz--static` has to hand
    the text back: nothing is ever `--held` there, so without the reset the
    opening landmark is four invisible paragraphs on a phone.
  - **A paragraph may ask for a beat before it, and that costs a slot.** An
    entry in `text` is a plain string or `{ text, pause: true }`; the fourth
    one here is paused, because the line before it ends on an ellipsis and a
    paragraph arriving at the standard gap and the standard cadence closes that
    off instead of letting it hang. A pause is **both** halves or it is
    neither: `.rz-scene__text--beat` opens 1.6rem above the paragraph, and the
    stagger skips a slot so the reveal holds a matching step of dead air — the
    gap on its own reads as a hole in the layout rather than as a pause.
    Two things nothing warns you about. **`FILM_TEXT_STEP` has to be
    re-derived** when a pause is added, since the last paragraph now ends at
    `START + (slots + 1)·STEP` and that has to clear `EXIT_START`; four
    paragraphs and one pause put it at 0.115, ending on 0.675 against 0.74. And
    **`.rz-scene__text--beat` has to sit after `.rz-scene__text`** in the
    sheet, not up with the `--film` rules: both selectors are one class, so
    `margin: 0` wins on source order from anywhere earlier and silently zeroes
    the gap.
  - **The film is dimmed only once there is text to protect, and a single flat
    value is what made it look broken.** Four paragraphs sit directly on the
    clip with no scrim between them, so while they are up it has to stay under
    the type — but the value the type wants is far below the value a film
    wants. Measured through the filter chain and composited over the stage's
    own `#06070b`, a flat dimming put a mean frame at **26 of 255** and the
    brightest patch (the station roof) at 67: loaded, decoded, playing, and to
    the eye simply not there, which is how it was reported. An earlier pass had
    already tried to fix it by moving the one number from 0.3 to 0.5.
    `--rz-film-solo` is the beat before the first paragraph arrives, written
    every scroll frame by `paint()` off the same `local` as everything else, so
    it scrubs both ways: at 1 the film is just the picture, and it settles as
    that paragraph fades in. Composited, mean **63 → 39**, brightest patch
    **168 → 101**.
    **The settled floor is brighter than the old flat value and the copy is
    more readable, not less** — the two moved together. `.rz-scene--film
    .rz-scene__text` gives up `--rz-ink-dim` (62% white) for solid white plus a
    shadow, which is worth more than the brighter film costs: **15:1** on a
    mean frame against the old 7.3:1, and **5.9:1** over the brightest patch
    against the old 5.0:1. Re-measure the pair whenever either moves; the worst
    patch is a small highlight and the shadow is what carries it. Note the old
    comment in the sheet claimed 9.2:1 by computing against `#fff` when the
    copy was 62% white — **parse the colour that is actually rendering.**
- **The Body & Emotions loop is a whole cardiac cycle in CSS**, on `--rz-cycle`
  and on nothing else, so the ejection, the baroreceptor burst and the ring's
  systolic arc cannot drift apart; the percentages are documented over the
  block in `css/21-reality-zoom.css`, and the transform origins there repeat
  coordinates from the markup in `reality-zoom.js` because CSS cannot read them
  off the drawing.
  That loop is paused while its landmark is not `--held` — scoped away from
  `.rz--static`, where nothing is ever held because `paint()` never runs, or
  the stacked fallback would show a diagram frozen on frame one. Its three
  colours are site tokens, not one-offs: heart and burst on the landmark's own
  accent (red), brain on the Beliefs purple, the diastolic half of the ring on
  the Perception blue.
  **The lap is two arcs, one per phase, not one stroke that changes colour.**
  A single stroke's colour applies to the whole travelled arc, so the ring was
  all red through systole and then all of it turned blue — the phase just drawn
  was erased by the one being drawn. Red now takes the first 35% and holds it
  for the rest of the beat while blue grows from the boundary, and the two run
  at the same rate (131.95 units over 35% of the cycle, 245.04 over the
  remaining 65%) so they read as one continuous head. The blue arc's
  `rotate(126)` in the markup is what starts it at the boundary — 0.35 of a
  turn, and the only number the two have to agree on.
- **The scene reserves the rail's width, and has to.** The rail is absolutely
  placed over the right of the stage while the content column is centred in the
  *full* width, so at 1280px the active station's label landed on top of
  whatever was in the right-hand column — the map, the artworks and the strands
  tiles all reach that far, and the figure swaps sides per landmark so it is not
  always the same column. `.rz--unlocked:not(.rz--static) .rz-scene` takes
  `--rz-rail-space` as `padding-right`; that token and the rail's own width have
  to move together, and a station label longer than it will overhang again.
- **The rail's line and its dots agree by construction.** `.rz-rail__track` is
  `grid-template-rows: repeat(var(--rz-count), 1fr)` with each dot centred in
  its own row, so dot *i* sits at exactly `(i + 0.5) / n` down the line — which
  is the same fraction the fill reaches when landmark *i* is holding the
  screen, since the landmarks divide the post-zoom phase evenly. Nothing is
  tuned to make them line up, and adding a landmark keeps them lined up. The
  fill height is written every scroll frame, so it reads as a continuous
  position rather than stepping from dot to dot.
- **A second `<nav>` inherits the site's bar.** The stylesheet styles bare `nav`
  as *the* navigation — fixed, cream, and a 14rem sidebar past 1800px. The
  landmark rail was a `<nav>` first and picked up all of it. It is a `div` with
  `role="navigation"` now. Same trap awaits any other in-page nav.
- **`[hidden]` loses to a `display` rule**, which is how `swapTabPanels` puts a
  panel away — hence `.research-tab-panel[hidden]`. Same trap as `.join-stage`
  and `.pub-card`.
