# The Research section: colour and the Creations tab

The section's two colour tokens and the Inventions/Tools tab. The Overview tab's scroll-driven dive is its own file — see [research-zoom.md](research-zoom.md).

## The Research section's colour

Blue, like everything else Research has: `--res-accent` is
`--section-research` (#5599ff, what it carries on the hero's arc, on the brain
and in the nav), and `--res-ink` is that hue taken down to `#2f5fa8` so it can
be read as text on cream — #5599ff itself is a light blue meant to be seen
against black and is barely there as a tab label. The tab bar was a slate green
that appeared nowhere else on the site, which made the first part of the section
a reader meets the one part that did not match it.

Same arrangement, and the same reason for two tokens rather than one, as
Publications and News. Both are declared on `.research-full` and every value in
the tab bar is mixed off one of them.

## The Research Creations tab

`research/creations.js`, styled in `css/05-research.css` under the `rc-`
prefix — not a file of its own, because unlike the zoom it has nothing later in
the cascade it needs to beat.

**Its content is `research/creations-content.js`, not `research-content.js`.**
The two tabs have nothing to say to each other and the zoom's landmarks are
long; `research-content.js` imports `CREATIONS_TAB` into its own `tabs`, which
stays the single list of what the section shows.

Everything the lab puts out is sorted into two rows: **Inventions** are ideas
that went into the literature, **Tools** are instruments someone can pick up.
They are `groups`, and **each group names its own renderer in `kind`** — `list`
or `cards`. A third row is a content change.

**There is no header**: no eyebrow, no heading, no lede. The tab bar has named
the tab and each plate names itself, so anything above the first plate is a
third label for the same thing. `research.js` no longer carries the generic card
builder either — it went out with those fields, and a tab with no `kind` now
renders an empty panel rather than reaching a builder no content had used since
it was written.

**A row with a painting behind it is a dark plate; a row without one is light,
and `group.image` is the whole switch** (`rc-plate--art` / `rc-plate--light`).
**Both rows are light now and nothing sets `image`**, so the dark tone is a
path the code still supports and nothing takes. It went in two steps, and both
are the same lesson from opposite ends:

- **Tools went light first.** It carried Wright of Derby's orrery lecture: a
  room of people gathered round an instrument being *used*, which is what a
  tool is for. That reasoning was sound about the painting and wrong about the
  row — once every tool arrived as a card with a picture of its own, the
  painting was a twelfth picture competing with the eleven it was supposed to
  be holding.
- **Inventions followed, and the argument for its painting is worth keeping
  because it was a good one.** It had Copernicus at his instruments — an
  astronomer working out a new arrangement of the world — on the grounds that a
  list of ideas is a page of text and the picture is what makes it a thing to
  look at; dark also because the tab next door is a black stage and a page of
  white cards on the other side of the tab bar reads as a different site. The
  second half was right about the tab bar and wrong about the tab: once Tools
  was cream, what read as two different pages was a black band sitting on a
  cream one, inside one tab. Consistency across the tab beat contrast with the
  tab beside it.

**The light plate is not a plate at all** — no background, no shadow, nothing
but the section's own cream. A tinted box (`#efece4`, a shade deeper than the
section's `#f5f4ef`) was tried first and read as a tray under the row: one more
edge to explain, when the cards have edges of their own and their shadows are
what lift them off the page. It keeps the plate's padding, so the two rows'
heads line up.

**Every `rc-` rule below the head is written for the dark plate, and
`--light` has to turn each one over.** That is the trap the second step walked
into: `--light` had only ever dressed a label and a lede, because the only
light row held cards and a card brings its own white face. The moment it held
the *list*, every line was white on cream — invisible, and nothing warns you.
So `--light` now also carries the hairline, the hover, the focus ring, the
star, the body, the name, the dash and the reference link. **Anything added to
a plate needs both tones.**

Two of those are not just the dark value with its `text-shadow` dropped:

- **The gold star had to come down** (`#e8b73f` → `#a8761a`). Gold is the mark
  that reads against a night painting and a smudge on cream. It stays gold
  rather than becoming the row's blue for the reason it was gold in the first
  place: it marks an idea as the lab's own rather than restating the plate's
  colour.
- **The reference link mixes toward the ink, not toward white**
  (`color-mix(… 62%, #10151d)` against the dark tone's `50%, #fff`) — the same
  move `--res-ink` makes for this section's blue, because `#5599ff` is a light
  blue meant to be seen against black and is barely there as small text on
  cream.

Measured on cream: name and label 13.6:1, body 6.7:1, reference 5.2:1, lede
4.5:1, star 3.6:1 as a graphical mark. The dash is 1.9:1 and deliberately so —
it is punctuation between the name and the idea, and it is exactly the fraction
of the ink that the dark tone makes of white.

Four things about the dark tone, for whoever turns it back on:

- The painting is an **`<img>`, not a CSS background**. The path is written from
  the site root in the content module, where a `url()` in `css/` would resolve
  against that folder instead (this has broken the door logos and the
  Information backdrop before), and a background cannot be lazy.
- It sits at `z-index: -2` with its scrim at `-1` under `isolation: isolate` on
  the plate, so both paint above the plate's own background and below every
  child **without a z-index anywhere on the content**. The scrim is diagonal
  rather than flat, so one band of the painting stays lighter — a flat wash
  leaves a picture nobody can tell is a picture.
- **The scrim was set by measurement, not by eye.** The first pass (art at 0.5,
  scrim 0.95 / 0.74 / 0.92) was dark enough that neither painting could be made
  out at all. It is 0.85 and 0.74 / 0.42 / 0.68, which puts the composite
  at a mean luminance of 22–28 of 255 and a worst patch of 105 — white text
  keeps 18:1 on average and 5.5:1 against the brightest thing in either
  picture, which was the glowing chart in the Copernicus. Going one step lighter
  again drops that worst case to 3.6:1, below AA, for four points of mean.
  That is the trade, and the way to re-check it after changing a picture is to
  composite it onto a canvas and take the luminance — the same trick the
  Publications grain was measured with; nothing here can be screenshotted.
  Everything over the plate carries a `text-shadow` for the same reason.
- Any replacement has to survive being darkened and cropped to a wide band, so
  a painting whose subject is a small bright thing in one corner is the wrong
  kind.

The two rows are laid out differently on purpose, and swapping them would be
worse in both directions:

- Inventions are **one line each** — star, name, idea, reference, on one
  baseline with a hairline between entries. The name and the idea are one
  paragraph rather than two columns: the names run from two words to four, and
  a name column wide enough for the longest leaves a trench in front of every
  other entry. The reference *does* get a column, so the way out of a line is
  always in the same place. Below 720px that column drops under its own entry
  rather than squeezing the idea.
  **The whole row is the `<a>`**, and the reference is a `<span>` inside it: one
  destination per entry, and a line of text whose only target is a short word at
  the far right makes the reader aim at the hardest part of the row to hit. So
  the row carries the padding and the hover tint (with a negative inline margin,
  so the tint reaches past the text without indenting the list) and there is no
  nested anchor. `<a>` may hold a `<p>` — its content model is transparent and
  nothing inside is interactive. An entry with no `href` is a plain `<div>` row
  rather than a dead anchor.
  **The star is gold**, not the row's blue: it marks an idea as the lab's own
  rather than restating the plate's colour, and a warm mark is the one that
  reads against a night painting.
- Tools are a **masonry of cards**, one picture each, because a tool is
  recognised before it is read. The whole card is the `<a>`: with four fields
  and one link, a chip at the foot of the card would be a second target for the
  same place, and the smaller of the two.

**The cards were a honeycomb** (`shared/honeycomb.js`, the same placement the
Services tab still uses) and the reason they are not any more is worth keeping.
A hexagon is one size for every card and clips whatever is on it to the same six
sides, so a wordmark, a square mark and a screenshot all arrived as the same
shape at the same weight — and at ~210px across, a screenshot arrived as a
smudge. A card takes its height from its own picture instead, which is what
makes the row a masonry and what makes it read as a shelf of different things.
That change took the measure-and-re-place machinery out of `creations.js`
altogether: `columns` does the layout, and nothing is measured.

Six things hold that up:

- **A card's height never changes, and everything else depends on it.** Column
  balancing is a function of the cards' heights, so a card that grew on hover
  could push a later one into a different column — three columns away from the
  pointer, and nowhere near what the reader was doing. Hence the shape of the
  reveal below.
- **The reveal grows upward, over the picture.** `.rc-card__detail` is anchored
  at `bottom: 100%` of the name bar with the card's own `overflow: hidden` above
  it, so the box gets taller while the card does not. It is
  `grid-template-rows: 0fr → 1fr` rather than a height, for the reason the
  Alumni band writes pixels and this cannot: the height is whatever the
  description wraps to, and this panel is `display: none` until its tab is
  opened, where a measurement comes out as zero. The `0fr` row needs the inner
  box (`min-height: 0` and its own clip) or it will not collapse.
- **Its padding is inline only**, and the top space is a margin on the first
  child. Vertical padding on a collapsed grid item still paints, which would
  leave a white strip above every name at rest; a margin cannot, because the
  inner box clips its own content and establishes a formatting context.
- **`.rc-card__media` has a minimum height and the reveal has to fit inside
  it.** Measured at three columns, the tallest reveal is 86px against a floor of
  136px, so it never reaches the card's top edge and is never cut. Both numbers
  move together: the description's four-line clamp is what bounds the reveal,
  and dropping the floor or letting the description run would put the first line
  of it under the card's own clip. Re-measure by forcing
  `grid-template-rows: 1fr` and comparing the inner box's top against the
  card's — **with `transition: none` set first**, or the reading is a frozen
  transition rather than a layout (see ../CLAUDE.md, "Verifying changes").
- **`@media (hover: none)` lays the reveal out in flow instead**, rather than
  showing it in place: a phone has no hover to give and the first tap is the
  link, so the card is simply taller there and the description sits under the
  name. The DOM order is written for that — name, then kind, then line. There is
  no masonry balance to protect in that branch, because nothing changes after
  layout.
- **The cap and the column width are one pair.** `.rc-cards` is
  `columns: 13.5rem` under a `max-width: 46rem`, which is three columns of 233px
  — about the size the logos were drawn for. Narrowing the plate drops that to
  two and then one with no breakpoint to keep in step. There are two breakpoints
  all the same, and both move the **cap**, never the column width: `20rem` below
  460px, so a single column is a card and not a whole phone, and `61rem` past
  1800px for a fourth column. That second one is a taste call rather than a fit
  — the plate is already at the 1200px content cap by ~1264px and has the room
  either way, so what changes is that the row uses 976px of it instead of 736px,
  at 230px a card instead of 233px. 1800px because it is the site's one wide
  breakpoint (the nav's sidebar); a second wide threshold is a second thing to
  keep in step.

The columns balance greedily, so one of them runs longer than the rest —
measured with the current eleven, a spread of ~195px at three columns and ~194px
at four. That is what a masonry of unbreakable blocks looks like and the fix is
not a stylesheet one: it is either JS placement (which is the machinery this
change removed) or an order chosen for height rather than for what the row is
saying.

A few more things that look incidental and are not:

- Each row's accent is written inline from `group.accent` and **every tint in
  the stylesheet is `color-mix`ed off that one property**, so recolouring a row
  is one hex in the content module.
- **A plate's name is plain bold white, with no mark in front of it**, and
  there is **no accent bar on the plate's top edge and no rule under the head**.
  All three were the row's colour saying the same thing, and against a painting
  a coloured line reads as a fault in the picture rather than as a division of
  the plate — the plate's own edge is already the division. The accent survives
  only where it is a property of something rather than a stripe across it: a
  tool's name on its card, the reference at the end of an invention.
- **One mark for the whole tab, and it is a text star — on the Inventions side
  only.** This carried nine hand-drawn line-art glyphs, one per item, to the
  same 32×32 spec the zoom's strand tiles used before the map replaced them (the
  zoom's surviving drawings are `ERA_ARTS`). At bullet size a drawing is
  a smudge that has to be squinted at, and there was nothing to work out from
  any of them; the star says "one of ours" and gets out of the way. The tools
  carried one too and dropped it when the picture became the top of the card —
  a glyph next to a logo is a second mark for the same thing, and the worse of
  the two. Anything that wants to be a picture here should be a real one.
- **Every card carries a picture and there is no fallback.** A tool without one
  is a content gap to fix, not a case to render: two shapes of card in one row —
  some with a picture, some without — read as a set that had not finished
  loading. Pictures are files, never markup: content is plain text everywhere on
  this site and must not be able to inject any.
- **A card says two things at rest and the rest on hover** — the picture and the
  name, then the kind and the description, over a dark scrim on the picture.
- **There is one dark layer, and it is on the picture, not on the reveal.**
  `.rc-card__media::after` covers the whole picture and the reveal carries no
  background at all: two layers would double up where they overlap and draw a
  hard edge across the picture at exactly the height the text starts. At 0.78 a
  white logo composites to ~68 of 255, so white text on it holds ~9:1 whatever
  the picture underneath is, and the picture still shows through as a shape.
  This replaced fading the logo out against the card's white, which washed a
  mark out rather than putting anything behind the words.
- **Both text colours in the reveal are written for that scrim**, which is why
  `@media (hover: none)` has to hand them back: laid out in the white name bar
  they would be white on white.
- **The cards are white, on the section's own cream.** Every logo here was drawn
  for white paper, and it is the same field the Publications cards and the News
  rows sit on. Their shadow is a light-ground shadow, soft and short — the
  `rgba(0, 0, 0, 0.42)` they carried over the painting is a bruise under every
  card on cream. With the plate gone the shadows are the only thing separating
  the row from the page, so they are load-bearing rather than decoration.
- **The name is grey (`#33383f`, 11.7:1), not the accent.** Eleven cards each
  carrying a picture of its own is already a lot of colour, and a teal name on
  top of it made the name a twelfth thing to look at rather than the label of
  the card it sits on. `--rc-card-ink` — the accent taken down until it can be
  read on white, the same two-token arrangement as `--res-accent` /
  `--res-ink` — is left for the focus ring; the kind label over the scrim takes
  the raw hue lifted instead, at 6.4:1. When you re-measure any of this, parse
  `getComputedStyle().color` properly: a `color-mix` comes back as
  `color(srgb 0.13 0.48 0.5)` and reading those floats as 0–255 reports a false
  failure.
- **The pictures are `loading="lazy"`, and that costs a settle.** This panel is
  `display: none` until its tab is opened, so nothing is fetched until then —
  and since a card's height *is* its picture's height, the columns balance once
  on the placeholders and again as the files land. The media's `min-height` is
  what keeps that a settle rather than a jump. Eager would remove it outright,
  at the cost of ~1.1 MB on every visit for a tab most readers never open —
  which is the trade to weigh, and the reason the logos are cut to a budget at
  all. It was 9.2 MB before they were.

**A tool's name gets `overflow-wrap: anywhere`.** A card is 233px across at
three columns and a package name is one unbroken token —
"SequentialSamplingModels" has nowhere the browser is allowed to break it, so
without this it runs out of the card. Breaking it badly is the lesser of the
two, and it is what makes the row safe for whatever gets added next. The name is
clamped to two lines and the description to four for the same reason.
