# The People section

The roster, the Alumni band, the open-seat node, and the Memories tab's shareable photographs.

## The Alumni band opens on a height, and that costs two boxes

`people.js` + `css/11-alumni.css`. Nine faces appearing in one frame read as a
layout bug rather than as a disclosure, so the band is animated — and the shape
that takes is worth knowing because it is the standard one:

- **The panel is the animated box and the grid inside it is what fades.** A
  reveal written onto `.alumni-card` itself would have to outrank
  `.alumni-card:hover`'s own transform and would lose to it the moment the
  pointer crossed a card on the way in.
- **`hidden` had to go: `display: none` gives a transition nothing to start
  from.** The closed panel is `height: 0; overflow: hidden` instead, and
  `inert` is what keeps nine buttons out of the tab order without taking them
  out of layout.
- **`auto` is not a height a transition can reach**, so every press measures the
  grid and writes pixels, and `transitionend` hands `auto` back. Leaving it on
  the pixel value would freeze the band at whatever the column count was when
  it opened, and this grid is `auto-fit`.
- **Reduced motion takes a branch in the script too**, not only in the
  stylesheet: with no transition there is no `transitionend`, so the height
  would never be handed back.

## A memory has an address

`shared/media-lightbox.js`, `memories/memories.js`, the `memory-` branches in
`shared/routes.js` and `people/people.js`, `build_memories` in
`generate_pages.py`, and `memory_slug` in `update_people.py`.

Pressing a photograph writes `/people/memories/<slug>/`, and that is a real
page whose `og:image` **is the photograph**. Before this, all 32 shared as the
site's own card and resolved to the homepage — for the one kind of content here
whose entire point is the picture, and the kind most often sent into a chat
window rather than typed into a search bar.

Seven things:

- **The route is the only one on the site that is three segments deep.**
  `MEMORY_BASE` in `routes.js`, read *before* the tab is — otherwise
  `/people/memories/<slug>/` resolves to the tab it sits in and a shared link
  opens the gallery instead of the picture. It nests under the tab because that
  is where closing the viewer leaves the reader, and because a slug that deep
  cannot collide with a member folder, so `RESERVED` gains nothing.
  There is deliberately **no bare `memory` route**: it would be a second address
  for `/people/memories/`, the exact duplicate `CANONICAL_ALIASES` exists to
  undo elsewhere, and here it can simply not be created.
- **The slug comes from the image's filename, and is the only stable name a
  memory has.** There is no folder here the way there is for a member or a post,
  and the title is hand-editable and repeatable ("Lab lunch"). ASCII-folded for
  the reason `update_publications.py` folds a publication slug — this becomes a
  directory name — and **a collision is reported by `load_memories`, not
  repaired**, because `mkdir(exist_ok=True)` in the generator means it is not an
  error there: the second page overwrites the first and one photograph goes
  missing from a set nobody counts by hand.
  Reported rather than auto-suffixed on purpose — a generated `-2` is a URL
  nobody chose, attached to whichever of the two happened to sort second, so it
  moves if either file is renamed and it would go unnoticed. Two images folding
  to one slug means two filenames differing only in case or punctuation, which
  is an oversight in `memories/img/` rather than a case to support:
  `2024_Rome.jpg` and `2024_rome.png` were the only pair, and the fix was to
  name the second `2024_Rome2.png`.
  A hand-written `slug` in the manifest wins, so a URL that has been shared
  survives the image being renamed or re-encoded to a different extension.
- **The viewer knows nothing about routes, and the caller owns both halves.**
  Which route to write on *close* depends on where the reader came from — the
  gallery writes `people-memories`, a profile panel's strip writes the member's
  own folder — so `openImageLightbox` takes an `onClose` callback rather than
  deciding. It fires for the ✕, the backdrop and Escape alike, which is the
  whole reason it is one callback here instead of three listeners over there.
- **The work is split across two modules because only one of them owns the
  tab.** `people.js` claims a `memory-` route for the section, the tab and the
  `landOnLoad` correction; `memories.js` opens the viewer and nothing else.
  Clicking the tab button from `memories.js` — the `join.js` idiom — would race
  the manifest that button's own listener is waiting on. `people.js` claims the
  route even for a slug that names nothing, so a dead link lands on the gallery
  rather than on the top of the page.
- **Escape closes the top layer only, and that needs the capture phase.** The
  profile panel and the viewer both had a document-level Escape handler, so one
  press closed both and left the URL naming a profile nobody was looking at. A
  live `is-open` test in the panel's handler cannot fix it — the answer depends
  on which listener ran first. The viewer's handler is registered with
  `capture: true`, which always runs before every bubbling one, and it
  `preventDefault`s; `people.js` bails on `defaultPrevented`. **Any third layer
  over this one needs the same pair.**
- **`memories.js` writes the route it just read, and that is not a claim on
  it.** `writeRoute`'s guard is "already there *unless* there is a hash", so
  calling it with the route being applied is a no-op on the path and normalises
  a legacy `#memory-…` typed mid-visit to the path it names. deep-link.js does
  the same tidy-up for the route the page was *opened* on and cannot do it for
  one that arrives later.
- **`people_names` is written by `update_people.py`, not resolved in the
  browser.** `people` on a memory is a list of member *folders* — the join key —
  and the viewer was printing them raw: "2025 · ana-neves, dominique-makowski"
  under a photograph that is now a page people share. Both manifests are written
  in the same run, so the two can never disagree, and the alternative is a
  second fetch racing the first. A folder that names no member is titlecased
  rather than dropped: guests appear in these photographs.

`llms.txt` deliberately does not list them. A photograph has no text for a
crawler that only reads, and 32 more lines would dilute the ones that do.

## An empty level in the roster is an open seat, not a missing row

`people.js` (`OPEN_SEAT_STAGES`, `buildOpenSeat`), `.mlp-node--seat` in
`css/10-people-mlp.css`, and the `[data-join-stage]` handler in
`information/join.js`.

A role with nobody in it used to be skipped, which is the tidy answer and the
wrong one: the Postdoc row disappearing does not read as "there is an opening",
it reads as a lab with no postdocs and no interest in one. The level renders
anyway, holding one node that is nobody — the section's own no-avatar
silhouette and "You?" — which leads to that level's own step of the Join rail.
Six things:

- **Only the levels the lab recruits for get a seat, and each names the
  `#join-<stage>` it leads to.** `OPEN_SEAT_STAGES` is that map, keyed on the
  manifest's own `category` values. A seat with nowhere to send anyone would be
  an advert for a vacancy that cannot be applied for, so a role absent from the
  map is still skipped when empty.
- **A level with members in it never shows a seat.** The row already answers who
  is here, and an open seat beside four faces reads as a fifth person whose
  picture failed to load.
- **The href is the level's own path** (`/join/postdoc/`, from `hrefForRoute`),
  not `#sec-contact-full`. Middle-click, "copy link address" and a crawler then
  get a real page about the thing the seat is offering. This is the same shape
  as the zoom's Creations links — see [routing.md](routing.md).
- **The plain click is caught in `join.js`, delegated from the document, and
  that is not a style choice.** `data-contact-tab-target` would have been the
  obvious attribute to reuse, and it cannot work here: script.js binds those
  with one `querySelectorAll` at startup, and this node is built from a manifest
  that lands long afterwards. The handler does what `applyRoute` does — click
  the tab button, `select` the level, `revealSection` — because following the
  link and pressing the control have to arrive at the same place. It writes
  `join-<stage>` over the `contact-join` the tab click just wrote, for the
  reason documented in [routing.md](routing.md).
  It is also the general answer for "a control elsewhere on the page that wants
  a particular Join level", where `data-contact-tab-target="join"` only ever
  lands on the first one.
- **The picture is `DEFAULT_AVATAR`, the section's existing no-avatar
  placeholder.** A seat-only silhouette was drawn first — same greys, a dashed
  edge, shorter shoulders — and every difference from this one turned out to be
  decoration: a person with no picture and a person who is not here yet are the
  same drawing, and the row's own emptiness is what says which. One asset, and
  it is one the section already had to keep working.
  It did get **darker** in the process (#e7e4da / #c9c4b6 → #dcd8cc / #a9a294,
  1.36:1 between the two tones → 1.78:1). That constant had never been seen at
  size — every member has an avatar, so the open seat is the only place it
  renders — and at 156px in a row of photographs the old greys read as a blank
  disc rather than as a person. Both tones had to move together: darkening the
  silhouette alone makes it a mark on paper instead of a figure on a ground.
- **The hover ring is the members' own**, with `SEAT_KEYWORDS`
  ("Fellowships", "Join us", "Info") where a member has research topics —
  `buildKeywordRing` unchanged, same place in the node, same CSS. That is what
  stops the seat being the one node in the roster that does nothing when
  pointed at. One set for every level rather than a set per level, because
  Postdoc is the only empty one today; "Fellowships" is the word that would
  have to change first if the Research Assistant row ever emptied.
- **`.mlp-node--seat` is two properties, and that is the whole of its
  styling.** An earlier pass gave the seat an italic accent-coloured name, an
  avatar faded to 0.72 that came up on hover, and a focus ring of its own; all
  of it was the seat insisting it was a special kind of node when the empty row
  already says so. What is left undoes the anchor's underline and colour, which
  is the one real difference — every other node is a `<div>`. Focus is the
  browser's default ring, as it is everywhere else on this site. **Anything
  added here should have to justify not being a member node.**
