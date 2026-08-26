# URLs, generated pages, and what a crawler sees

Every shareable link on the site, the ~250 static pages that make them real, and the head/JSON-LD/sitemap/llms.txt machinery. Read this before touching `shared/routes.js`, `shared/deep-link.js`, `generate_pages.py` or anything that writes a URL.

## Shareable URLs

`shared/deep-link.js`, and `shared/routes.js` beside it.

**Routes are carried by the path now, not by a hash.** The route strings are
unchanged — they are still the opaque values every `applyRoute` receives — but
`writeRoute` writes `/news/2023-new-logo/` where it used to write
`#post-2023-new-logo`. `routes.js` is the whole of that translation and the only
module that knows a route has a URL shape at all, which is why the change was
cheap: nothing else in the codebase sees a URL.

It changed because **a fragment is not an address.** Google retired the
crawlable-fragment scheme in 2015, so every deep link resolved to the root and
the entire site was one indexable URL whatever was rendered into it. See "The
generated pages" below for what replaced it and why not something else.

Four things follow:

- **Every path must be a real file**, written by `generate_pages.py`. That
  script and this module ship together; writing a path nothing serves makes the
  next reload a 404. **`tools/check-paths.py` is the check**, and it exists
  because this rule was broken three separate ways at once and nothing threw:
  the nine Services card paths (services.js was never migrated off hashes, so
  the generator had never been told they existed), `/information/contact/` (the
  one *default* tab with no page — `activateContactTab` writes `contact-<tab>`
  for every tab, as News writes `news-all`), and `/people/` + `/research/`,
  which a legacy stub had overwritten with a page that redirected to itself.
  Run it after the generator. It pairs with `tools/check-routes.html`: that one
  checks routes.js round-trips, this one checks something serves the result.
- **A route has two possible sources**, in order: a hash (legacy links, and a
  reader who edited the URL), then the path itself. Nothing downstream can tell
  which.
  **`body[data-route]` is not one of them**, and this is the trap: it *was*,
  second, described as "the authority on a generated page" — but it is written
  at build time and never changes, so on any of the 147 generated pages it
  pinned `currentRoute()` to the route the page was built for, for the whole
  visit, however far the reader navigated. The symptom is silent and specific:
  `writeRoute`'s "already there" guard asks `currentRoute()`, so any write of
  the built-for route after the reader had moved was skipped and the address
  bar quietly kept the previous URL. Arriving on `/services/iacs-2026/` left
  the reader on `/information/services/` with the right card open. It is read
  once now, into `INITIAL_ROUTE`, as what it actually is — a statement about
  how the page was *opened*, the only moment it can be true.
- **A legacy hash is normalised to its path once, on arrival**, in deep-link.js
  itself. Not left to the section that claims the route: `applyRoute` is called
  with `write: false`, so nothing else would ever tidy it up.
- **`writeRoute` always clears the hash.** Arriving on `#post-x` and then
  pressing something else must not leave the old fragment stapled to the new
  path, or the URL names two things and the canonical agrees with neither.
- **`hrefForRoute` is the read-only half of that, for a control in the page that
  wants to be a real anchor.** Some in-page destinations are somewhere the
  router already owns — the zoom's strand links pointing at the Creations tab —
  and a `<button>` there costs middle-click, "copy link address" and anything
  that follows links. This gives back the mounted URL the route lives at, so
  the anchor's href is exactly what `writeRoute` would put in the address bar,
  and it is mount-aware: a typed `/research/creations/` is a URL outside a
  sub-path-mounted copy. **The click still has to be handled in script**, or the
  browser reloads the page to reach a tab. It returns "" for a route with no
  path of its own — a caller should treat that as no link, since the `#route`
  fallback that is right for the address bar is wrong in an href, where a bare
  fragment resolves against `<base>`.
- **`<base>` in `index.html` is mandatory, it is not only for the generated
  pages, and it must be `./` rather than `/`.** This one has already broken the
  site twice, in opposite directions.
  Because the path now *moves* as the reader navigates — `/` →
  `/people/memories/` → `/publications/gallery/` — every site-relative URL
  created *after* a move resolves against the new directory. The Creations
  logos, the publication figures and the Information backdrops all disappeared
  (`research/img/logo-neurokit.png` →
  `/publications/gallery/research/img/logo-neurokit.png`), and
  `fetch(post.file)` was about to fail the same way. It shows as **empty
  space, never as an error** — the panels built on demand are the ones that
  break, while everything built at startup keeps working, which makes it look
  like a content problem rather than a URL one.

  `<base>` fixes every case at once, which is why it is preferred over
  prefixing the ~25 manifest paths and fetch constants and hoping none was
  missed. `generate_pages.py` refuses to run if it is gone.

  **`./`, never `/`** — that was the second breakage. A root-absolute base is
  right only if the site is the root of its origin, which the deployed site is
  and nothing else is: serve the site under a sub-path, or open it
  over `file://`, and every stylesheet and every module resolves to the wrong
  place and the page comes up bare. A *relative* base is resolved once at parse
  time against the document's own URL and then frozen — measured: after
  `replaceState("/people/memories/")` the baseURI is still where the page
  loaded from — so it is equally proof against the moving path while assuming
  nothing about the mount. Each generated page carries its own `../` per level
  for the same reason.

  Because of that, **`routes.js` deals in site paths and `deep-link.js`
  translates them.** `toMountedPath` / `toSitePath` are two lines against
  `document.baseURI`; without them a tab press in a sub-path-mounted copy writes
  `/people/memories/` — a URL outside the site, which 404s on reload — while
  every image on the page still works, because those go through the frozen
  base. Everything between `routes.js` and the DOM stays mount-agnostic.

  Its one cost: a bare `href="#sec-…"` resolves to `/#sec-…`, which is a
  different document once the path has moved, so the browser would reload
  instead of scrolling. The nine section anchors are therefore scrolled by
  hand — a delegated click handler at the foot of `script.js`, which
  `preventDefault`s and calls `revealSection(..., {smooth: true})`. It skips
  modifier- and middle-clicks, and does not use capture, so the existing
  `[data-contact-tab-target]` listeners still open their tab.

Tab names are **reserved words** and nothing enforces it: `/news/<x>/` is a post
when `x` is a slug and a tab when `x` is a tab name. No post folder may be
`all` or `featured`, no member folder `lab`, `collaborations` or `memories`, no
publication folder `list` or `gallery`. `RESERVED` in routes.js is the list;
`tools/check-routes.html` round-trips every route shape and says PASS or names
what broke.

`#sec-<id>` stays a fragment, because a section anchor genuinely names an
element on a page rather than a thing with an address.

The rest of this section still describes what each route *means*, which has not
changed:

```
#<folder>               a member's profile panel, open over People
#memory-<slug>          one photograph, open in the image viewer
#post-<slug>            a news post, open in the reader
#pub-<folder>           one publication, open in the publications panel
#people-<tab>           a section and which of its tabs
#research-<tab>
#news-<tab>
#publications-<tab>
#contact-<tab>          Information — this one predates the module
#join-<stage>           a Join level; more specific than #contact-join
#services-<id>          a Services card, turned over
#sec-<id>               a plain section anchor; what the nav's own links leave
```

The ids are the ones the content already joins on — a member's folder, a post's
slug — so nothing new has to be kept in step.

**A member has no prefix**, and is the only route that does not. A person is
the one thing here whose name is enough: `#dominique-makowski` is what somebody
would guess and what they would want to send, and `#person-dominique-makowski`
was saying "person" twice. It is safe because people.js matches the whole route
against the *set* of folders in its manifest rather than against a shape — a
prefix has to be guessed at, `members.find` cannot mistake
`post-2020-r-or-python` for a member. Two constraints come with it and nothing
enforces either:

- a folder must not begin with another route's prefix (`people-`, `post-`,
  `memory-`, `sec-`, `join-`, `services-`, `contact-`, `research-`, `news-`,
  `publications-`), and
- a folder must not equal an `id` in `index.html`, or the browser will scroll
  to that element on top of whatever the handler does.

Neither is true of any of the fourteen current folders. There is no
`person-<folder>` fallback: the site had not been published when this changed,
so no link with the old shape ever existed to keep working.

**A route is only shareable if pressing the thing writes it.** Every one of
these is written by the control that reaches it, so the link to send someone is
whatever is in the address bar once they are looking at the right thing. The
Join rail is the case that made this explicit: the three levels are three
different answers to "what can I apply for", and the tab alone (`#contact-join`)
lands a PhD candidate on the undergraduate one. Each level writes `#join-<id>`
on press, and applying that route opens the tab, selects the level and scrolls
to the section — that last part being what the Information routes were missing.
`#contact-<tab>` lands too now, and both re-land on `load`: Information is the
last section on the page, so its offset is the sum of every manifest still
being fetched when the route is first applied — the same correction
`landOnInitialSection` makes for a plain `#sec-…`.

**Every write is a `replaceState`.** No history entry, and — the part that
matters — no `hashchange`, so a module writing the URL can never re-enter its
own route handler and there is no "am I applying this or did the reader ask for
it" flag anywhere. `hashchange` therefore only ever means the reader moved.
The cost is that Back does not step through tabs, which is the right trade: a
tab is not a page, and a reader who opened three profiles should not need three
presses of Back to leave. This replaced the one place that did push —
Publications' `?section=…&tab=…`, the only query-string state on the site and
the only tab group that grew the history stack.

Four things that are easy to get wrong here:

- **Applying a route is each section's own job, and it waits for content.**
  People and News resolve theirs inside their manifest's `.then`; Research waits
  until the zoom's driver exists, because switching away from Overview before
  then measures the stage while it is `display: none`. A handler gets the whole
  route string and ignores what it does not own.
- **And it has to land twice.** A section applies its route as soon as *its own*
  content exists, but the offset it scrolls to is the sum of every section above
  it — all still fetching manifests and loading images. Measured: a member link
  put the reader at scrollTop 1353 and the section settled at 720, so a shared
  link arrived 633px into the wrong part of it. `landOnLoad(sectionId)` in
  deep-link.js is the correction, and it is a no-op once `load` has passed, so a
  hash pasted later does not get a scroll nobody asked for.
  **Arm it only when the handler claimed the route** — every `applyRoute` here
  returns true when it did. Arming it unconditionally on "there is a hash" put
  four sections' worth of listeners on `load`, each scrolling to itself, last
  one winning: `#dominique-makowski` landed 3,090px down, inside News.
- **Handlers must be idempotent** — a reader can paste the same link twice. The
  profile panel and the news reader both keep the open id in a `data-` attribute
  so a route naming what is already on screen is recognised and left alone
  rather than rebuilt under the reader.
- **Every "activate" takes a `write` flag, false when the change came out of the
  URL** — otherwise applying a route immediately rewrites it, and a section
  claims a hash it was only reading. The same flag is why `closePanel` and
  `closeReader` are wrapped in arrows where they are used as listeners: their
  first argument is that flag, and a listener would hand them the event object.
- **A programmatic tab click is indistinguishable from a press.** `join.js` and
  `services.js` open the Information tab by clicking its button, which now
  writes `#contact-join` over the very link the reader followed — so both write
  their own more specific route back afterwards.
- **A module must go through `onRoute`, never `hashchange`.** `services.js` was
  the one that did not, and it is worth keeping as the illustration: it read
  `window.location.hash` and listened for `hashchange`, which was correct while
  every route *was* a hash and silently deaf the moment they stopped being one —
  `writeRoute` is a `replaceState` and fires no `hashchange`, so the module
  heard the reader and never the router. Three things were broken at once and
  none of them threw: the nine card paths were 404s, arriving at one did
  nothing because the hash was empty, and pressing a card wrote no route at all,
  so the tab quietly failed the site's own "a route is only shareable if
  pressing the thing writes it" rule while this file went on documenting
  `#services-<id>` as a route.

**Any hash at all skips the door**, with no animation. A reader who followed a
link to a person or a post has already chosen to come in. The skip lives in the
inline bootstrap in `index.html`, not in `script.js`, and that is the reason:
inline is parsed before the deferred modules and before the first paint, so the
door never appears — from a module it flashes. It adds `visible` to `#main-page`
as well as hiding the door, which is not decoration: that element is
`pointer-events: none` until it has the class, so a door merely hidden leaves
the whole page unclickable.

`revealSection` scrolls `#main-page` — the scroll container, not the window —
instantly on arrival and smoothly when a click in the page asks for it. A plain
`#sec-…` link is landed twice, once immediately and once on `load`: the browser
resolves a fragment once, against a page whose sections are still empty, and
every manifest here is fetched, so the offsets move afterwards.

## How the page describes itself

The `<head>` block in `index.html`, `shared/page-meta.js`, and the generated
`robots.txt` / `sitemap.xml` / `llms.txt`. One thing governs all four and it is easy to forget:

**The site is one document, so the static `<head>` is the whole of what any
crawler ever sees.** Search engines, social-card generators and the LLM
crawlers fetch the raw HTML and do not run the modules. Whichever route a
shared link points at — `#post-…`, a member, `#join-phd` — what gets indexed
and what renders as the card is the block written in `index.html`. Measured,
that is **249 words**: the hero, the section headings and the Information
copy. Every post body, every bio and all twenty publications arrive by `fetch`
afterwards and are invisible to anything that does not render.

So `page-meta.js` is **not SEO and must not be mistaken for it.** It keeps the
tab label, the history menu and bookmarks honest — opening three profiles
should not leave three entries called "Reality Bending Lab" — and it updates
`og:title`/`og:url` for the one case that does read the live DOM, a chat client
whose link preview runs a real browser. Making the *content* indexable needs
real paths instead of hashes, which is a separate job (see below).

Five things worth knowing:

- **The site's URL is written once, in `index.html`'s `<link rel="canonical">`,
  and everything else derives from it.** `_site_url()` in `generate_pages.py`
  reads the origin out of that tag — so `sitemap.xml`, `llms.txt`, `robots.txt`
  and all ~250 generated pages follow it — and `shared/page-meta.js` reads it
  off the live DOM, which works on a generated page too because every page
  carries an absolute canonical of its own and only the *origin* is wanted.
  `CNAME` is **checked** against it rather than being another copy: the
  generator refuses to run if the two disagree, since Pages serves on the CNAME
  and every canonical, `og:url` and sitemap entry would otherwise point
  somewhere else.
  It was four independent copies until recently — this module,
  `page-meta.js`, `robots.txt` and the canonical — with nothing keeping them in
  step. **Do not reintroduce a fifth.** The `og:*` and JSON-LD `@id`s in
  `index.html` are not copies in the dangerous sense: they are in the same file
  as the canonical, where a mismatch is visible on one screen.
  **`tools/build_legacy_map.py` is not one either**, and this is the distinction
  to hold on to: the `https://realitybending.github.io/` prefix it strips is the
  *old Hugo site's* deployed URL, in a frozen script reading a frozen sitemap.
  It is correct precisely because it did not move.
  **The site's original URL genuinely was `https://realitybending.github.io/`**,
  which is where the repository's name comes from: it is a GitHub Pages user
  site, and that is the address Pages gives one for free. The lab then bought
  `realitybendinglab.com` from Namecheap and set it as the custom domain in
  **Settings → Pages → Custom domain**, which is what wrote the `CNAME` file at
  the repo root. So there are two live hostnames and only one of them is the
  site: Pages still answers on `realitybending.github.io` and **301s to the
  custom domain**. That redirect is exactly why the stale canonicals were
  invisible for so long — a wrong canonical never 404s, it just quietly points
  every indexed page at the wrong host, and every link you click still works.
  Two consequences worth keeping in mind: **`CNAME` must stay committed** (it
  is the deployed artifact's only record of the domain, and `deploy.yml` uploads
  the repo root, so it travels), and the DNS behind it lives at Namecheap rather
  than anywhere in this repository — a resolution failure is not something any
  file here can explain.
  **`BASE_TITLE` in `page-meta.js` is the one duplicate that is left**, and it
  is of `<title>` rather than of the URL: if the two drift, the tab label
  changes when the reader reaches the hero, which reads as a flicker. It has no
  cheap single source — `document.title` is the *page's* title on a generated
  page, not the site's — so it stays hand-kept and this is the note about it.
- **The lab's description, email and address are single-sourced the same way.**
  They live in `index.html`'s JSON-LD `ResearchOrganization` node — the site's
  machine-readable statement of what it is, and the copy a crawler already reads
  without running anything. `organization()` in `generate_pages.py` parses that
  node and `llms.txt` renders it, so the blurb and the postal address exist in
  one place rather than three. The JSON-LD `description` deliberately carries
  the *long* wording (it used to be a one-liner while `llms.txt` had the rich
  version): deriving the short one from the long one loses nothing, and the
  reverse would have thrown away the better text.
- **`onRouteSettled` is a second channel next to `onRoute`, and the split is
  deliberate.** `onRoute` fires only when the *reader* moved, which is what lets
  `writeRoute` be a `replaceState` that no handler can re-enter (see "Shareable
  URLs"). But a title needs both cases — a click that opens a post and a pasted
  link produce the same URL and must produce the same title — so observers get
  their own list, notified from `writeRoute` as well as from `hashchange`. The
  rule that keeps this safe is **an observer must not write the route**, and
  `notifying` enforces it rather than trusting it.
- **A resolver is registered, not imported.** `post-2023-new-logo` is only a
  title once `news_manifest.json` has landed, so `news.js` and `people.js` hand
  theirs over inside the same `.then` that applies their route. Registering
  re-runs the current route, which is what fills in the title of a page opened
  directly on a deep link — without it a shared link would show the site title
  until the reader moved.
- **The two icons carry the site's cream behind the mark.** A transparent logo
  is black-on-black in a dark tab bar. The Sussex wordmark in the corner of
  `lab_logo_black.png` is cropped away for them — at 48px it is noise rather
  than a second brand.

**What is deliberately absent from *this* page's graph.** The publications
are not in index.html's JSON-LD: 67 `ScholarlyArticle` nodes on a page that
visibly shows a filtered list is the kind of mismatch Google discounts. Each
one carries its own node on its own generated page instead, which is where the
page and the structured data agree — `build_publications`, below.

This paragraph used to say the same thing about `sitemap.xml`, which listed a
single URL because a fragment is not an address and an entry for `…/#post-x` is
read as a duplicate of the root. Both were waiting on the same thing and both
were fixed by it: real paths, generated. What that also bought was the **358
URLs in the old Hugo site's `docs/sitemap.xml`** (37 posts, 40 publications, 7
job pages), every one of which would have 404'd the day this replaced it —
hence the redirect stubs from `legacy_map.json`.

## The generated pages

`generate_pages.py`, run after the three `update_*.py` and after
`tools/build_legacy_map.py`. It writes 182 pages — one per post, member, memory,
publication and section, plus three hubs — 100 redirect stubs, `sitemap.xml` and `llms.txt`.
**None of it is committed** (`.gitignore`); it is built in CI, because ~250
files churning on every content edit buries the one-line change that actually
happened. That includes `sitemap.xml` and `llms.txt`, which were committed for
a while on the grounds that they are small and are the site's discovery
surface — the argument that settles it is that **the committed copies were
never the ones served**: CI regenerates both before uploading, so they bought
nothing and cost 51 KB of diff per content edit.

A generated page *is* `index.html`: same shell, same scripts, same stylesheets,
with four changes — a head that describes this one thing, a second JSON-LD
block, `<body data-route="…">`, and a `#prerender` block holding the content as
plain semantic HTML.

**The inline bootstrap removes `#prerender` before the first paint.** That one
line is the whole trick: a reader with JavaScript never sees it, because the
modules are about to open the real panel over the same content — so the site
looks and behaves exactly as it always did. A crawler that runs nothing keeps
it, and so does a reader with no JavaScript. It is in the bootstrap and not in a
module for the same reason the door-skip is: inline is parsed before the
deferred modules and before the first paint, so nothing is ever composited.

Consequently **the markup this script emits does not have to match what
`news.js` or `people.js` build.** It only has to be correct and readable. That
is what stops it becoming a second renderer to hold in step with the first —
the tax that usually kills this kind of project — and it is why it gets forty
lines of its own inline CSS rather than any of `css/`.

Three things that are easy to get wrong:

- **`<base href="/">` is what makes a page at depth work, not the markup
  rewrite.** The generator does rewrite every `src=`/`href=` to root-absolute,
  and that is *not enough*: the modules resolve their own URLs against the
  document, so `fetch("news/news_manifest.json")`, `fetch("img/brain.glb")` and
  every manifest-held avatar, figure and PDF path resolve one directory deep
  from `/news/x/` and 404. The failure mode is the dangerous one — empty
  sections and a page that reads as still loading, not an error. `<base>` fixes
  every case at once, including ones nobody has thought of.
- **The head substitutions are fatal on a miss.** Prettier wraps those
  attributes across lines and the patterns are written with DOTALL; reformat
  `index.html`'s head and they stop matching. A silent miss means 137 pages all
  describing themselves as the homepage, which is the exact failure this whole
  exercise removes — so `set_tag` raises rather than warning.
- **Nothing is canonical off-site.** Pointing a publication page at its DOI or
  its publisher is the instinctively honest thing to do and it deindexes the
  page completely. The relationship goes in JSON-LD instead — `identifier` and
  `sameAs`.
  The one exception is `CANONICAL_ALIASES`, and it is the opposite case: a path
  that is a **second address for a view that already has one**. `/join/` and
  `/services/` show exactly what `/information/join/` and
  `/information/services/` show. Both shapes have to be files — routes.js can
  produce either and the old site's `jobs` index redirects to the first — but
  only one of each pair should be a result. The `/information/…` form wins
  because it is the one the *site* writes: press the Join tab and
  `activateContactTab` puts it in the address bar, so it is what readers share.
  They also drop out of `sitemap.xml` — a sitemap advertises destinations, and a
  page pointing its canonical elsewhere is not one.
  **Canonical and not a redirect stub**, which would be the stronger signal:
  these are live routes the router still writes, so a meta-refresh means a
  reader who lands on `/join/` gets a page reload on arrival — the same
  self-redirect trap that cost `/people/` and `/research/` their hubs.

With `<base>` set, a bare `#fragment` on a generated page resolves to
`/#fragment` — a navigation home rather than an in-page jump — so
`link_fragments_to_paths` rewrites the nav's hrefs to their real section paths
there. Same destination, and it gives every generated page a followable link to
all six sections. **`index.html` itself is untouched**, so the homepage's nav is
still fragments and still smooth.

### Why this shape and not another

Three alternatives were considered and rejected, and the reasons are worth
having because each of them looks easier from the outside:

- **Separate standalone reading pages** — a "crawlable twin" at `/news/x/` that
  is *not* the site. Two presentations of the same content that will drift, and
  a visitor arriving from Google lands somewhere that is not the site they were
  looking for.
- **A meta-refresh stub that bounces into the SPA.** This is the pattern to
  avoid and it undoes the whole exercise: Google treats meta-refresh as a
  redirect, so every stub collapses into the root and nothing is indexed
  separately. (It is the right tool for the *legacy* paths, where collapsing
  into the target is exactly what is wanted.)
- **A prerendering service or a headless build.** A build step and a dependency,
  for a site whose selling point is having neither. The generator is ~900 lines
  of Python against manifests that already exist and imports only the standard
  library.

What makes the chosen shape defensible rather than cloaking is one property:
**a crawler that renders and a crawler that does not come away with the same
text.** The renderer removes `#prerender` and the modules build the same content
into the panel. Anything that appears in one and not the other breaks that, so
it is the thing to check when adding a field to a generated page.

### What the old site's URLs taught us

**Hugo lowercased the URL it published.** `content/post/2026-01-09-EventTriggers`
was served at `/post/2026-01-09-eventtriggers/`. A stub written at the folder's
own mixed-case name is a file nothing ever requests — and on a case-insensitive
filesystem, which is Windows and Dropbox on top of it, **the mistake is
invisible locally and only appears once it is on GitHub Pages.** Every old path
in `legacy_map.json` is lowercased and checked against the deployed sitemap for
exactly that reason. It would have shipped 40-odd dead files.

**252 of the old site's 358 URLs are deliberately not mapped** — 161 `tag/`, 60
`authors/`, 25 `category/`, two conference talks and a handful of taxonomy
indexes. Google treats a redirect to an irrelevant page as a soft 404 and
discards it, and 252 of them is noise in Search Console that will hide real
problems. A 404 is the correct answer for a page whose content no longer exists
in any form. Do not be tempted to "fix" the unmapped count.

## With JavaScript off

Two `<noscript>` blocks in `index.html`, and they carry into every generated page
because those are built from this shell.

**The homepage is the one page with no `#prerender`** — a generated page carries
its content statically and a no-JS reader keeps it, but this one is the shell the
modules fill. So:

- **The door would otherwise be a wall.** `#door-screen` is fixed over
  everything and `#main-page` is `pointer-events: none` until script adds
  `.visible`. The `<noscript><style>` in `<head>` sets `display: none` on the
  door **and** `pointer-events: auto` on `#main-page` — hiding the door alone
  leaves the whole page unclickable, which is the same pair the inline bootstrap
  sets for a deep link.
- **In `<head>` because it must apply before the first paint**, and
  deliberately *not* a numbered sheet: those are written for the working site,
  and a `#door-screen { display: none }` sitting in one of them is a rule waiting
  to be applied by accident.
- **The four JS-built sections are taken away**, because a heading and a tab bar
  over nothing reads as broken rather than as degraded. The body `<noscript>`
  replaces them with links to the same six sections at their real paths, which
  *are* statically rendered. Those hrefs are relative (`people/`, not
  `/people/`) so they resolve through `<base>` on a generated page at depth.
- The hero and the whole Information section are static markup and survive
  untouched, so what is left is a real page.
