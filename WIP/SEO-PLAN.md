# Making the site findable

A plan for search and AI-crawler visibility that does not change what the site
looks like or how it is edited.

## 1 · What actually caps it today

Measured, not estimated:

| | now |
|---|---|
| indexable URLs | **1** |
| words in the raw HTML | **260** |
| internal links a crawler can follow | **0** (every href is a `#hash`) |
| URLs in `sitemap.xml` | 1 |
| URLs on the old site that will 404 at cutover | **358** |
| content items with no address of their own | 38 posts, 14 people, 66 publications |

Five distinct problems live in that table and they need different fixes.

**A fragment is not an address.** This is the hard cap and it is worth being
blunt about it: Google retired the `#!` crawlable-fragment scheme in 2015 and
has ignored fragments for indexing since. `…/#post-2023-new-logo` is not a page
Google, Bing or any AI crawler can hold — it is the root, seen again. So *no
amount of pre-rendering helps while the URLs are hashes*. Real paths come
first; everything else is downstream of that.

**Rendering is not the same as indexing.** Googlebot does run the modules, on a
delay and against a budget. Bing renders partially. But `GPTBot`, `ClaudeBot`,
`PerplexityBot`, `Bingbot`'s fast path, and every social-card generator
(X, LinkedIn, Slack, Bluesky, iMessage) fetch raw HTML and run nothing. Those
crawlers currently see 260 words and one image for the whole lab — no post
bodies, no bios, no publication titles. Since `robots.txt` deliberately invites
the LLM crawlers in, they should be given something when they arrive.

**Nothing links to anything.** Even once pages exist, discovery has to come from
somewhere. A sitemap is enough for Google; a crawler that only follows `<a href>`
needs real links in the markup.

**The door is fine.** `#main-page` is behind a 78%-opaque veil and
`pointer-events: none` — not `display: none`, not `opacity: 0`. A rendering
crawler reads the DOM normally. This is not a hidden-content risk and does not
need changing.

## 2 · The design decision

The tension is real: the whole appeal of the site is that nothing ever jumps,
and the whole appeal of the workflow is that a post is a `post.json`. Both
survive, on one architectural move and one trick.

### The move: routes become paths, in one place

`shared/deep-link.js` already funnels *every* URL write through `writeRoute` and
every read through `matchRoute`, and handlers receive an opaque route string
(`post-2023-new-logo`, `dominique-makowski`, `publications-gallery`). Nothing
outside that module knows the URL is a hash.

So the change is one bidirectional map, which now lives in `shared/routes.js`
beside it — a pure translation with no state, kept separate so it can be read
and checked on its own before deep-link.js adopts it:

```
post-<slug>        ⇄  /news/<slug>/
<member-folder>    ⇄  /people/<folder>/
pub-<slug>         ⇄  /publications/<slug>/
people|research|news|publications|contact[-<tab>]  ⇄  /<section>/[<tab>/]
join-<stage>       ⇄  /join/<stage>/
services-<id>      ⇄  /services/<id>/
sec-<id>           ⇄  /#sec-<id>   (unchanged — an anchor is genuinely a fragment)
```

`writeRoute` becomes `history.replaceState(null, "", pathFor(route))` instead of
writing a hash. It stays a *replace*, so the two properties CLAUDE.md leans on
hold exactly as before: no history entry, and no `hashchange`, so a module can
still never re-enter its own route handler. Reading gains one line: the initial
route comes from `body.dataset.route` when there is no hash.

**Nothing else in the codebase changes.** Every section's `applyRoute`, every
`write` flag, `landOnLoad`, `page-meta.js`, the door-skip in the inline
bootstrap — all of them speak route strings and never see a URL. That is the
reason this is tractable at all, and it is worth saying out loud that the
existing design is what makes it cheap.

Legacy `#post-…` hashes keep working: a hash on arrival is translated to a route
and immediately `replaceState`d to its path.

### The trick: a pre-render block the bootstrap deletes

Each real path is served by a generated `index.html` that is **the site's own
shell, byte-identical except for the head, plus one extra element**:

```html
<body data-route="post-2023-new-logo">
  <div id="prerender">
     … the post: <h1>, <p>, <img>, real <a href> links, byline, date …
  </div>
  <div id="door-screen">…
```

and, in the inline bootstrap that already runs before first paint:

```js
document.getElementById("prerender")?.remove()
```

That single line is what makes this work and it is worth being precise about
why:

- **A reader with JS never sees it.** The bootstrap is parsed inline, before the
  deferred modules and before the browser paints — the same property the
  door-skip already relies on. There is no flash, no layout shift, nothing to
  animate away. The modules then open the panel exactly as they do today for a
  hash link. **The site looks and behaves identically.**
- **A crawler that runs nothing gets the whole post** — real prose, real
  headings, real links.
- **A crawler that renders gets the panel**, which contains the same text. Same
  content either way, which is the line that separates progressive enhancement
  from cloaking.
- **The generated markup does not have to match the panel's.** This is the part
  that keeps the maintenance cost down. The Python side emits plain semantic
  HTML — no class names, no shared design tokens, no obligation to look like
  anything — because nobody with JS ever sees it. So there is no second renderer
  to keep in step with `news.js`, which is exactly the tax that usually kills
  this kind of project. Give it forty lines of its own CSS so a no-JS reader
  gets something legible, and stop there.

For posts it is nearly free: `content` in `post.json` is already HTML.

### Why not the alternatives

- **Separate standalone reading pages** (a "crawlable twin" at
  `/news/x/` that is *not* the SPA) — two presentations of the same content that
  will drift, and a visitor from Google lands somewhere that is not the site.
- **Meta-refresh from a stub page into the SPA** — Google treats meta-refresh as
  a redirect, so every stub collapses into the root and nothing is indexed
  separately. This is the pattern to avoid; it undoes the whole exercise.
- **Prerendering service / headless build** — a build step and a dependency, for
  a site whose selling point is not having either.

## 3 · Phases

Ordered so that each one is shippable and none blocks on a later one. Phases 1
and 2 must ship *together with cutover*, not before.

### Phase 0 — housekeeping ✅ done

- `404.html` — self-contained (inline CSS, no dependency on the numbered
  sheets, which are all written for the single-page shell). `noindex`, and
  **every path in it root-absolute**: GitHub Pages serves this one file for any
  unmatched depth while the address bar keeps the URL that was asked for, so a
  relative `img/…` on `/news/typo/` resolves to `/news/typo/img/…` and 404s
  inside the 404.
- `.nojekyll` at the deploy root.
- `<html lang="en">` → `en-GB`, matching `og:locale`.
- `llms.txt` — the lab, its contact details, its software, and links to the four
  JSON manifests. Those manifests are the only machine-readable content the site
  has until Phase 1, and they are directly fetchable, so pointing at them is
  worth more than pointing at hash routes no crawler can hold. Regenerated
  alongside the sitemap once real paths exist.

### Phase 1 — real paths and pre-rendered pages *(the main work)*

**1a. `shared/routes.js`** — the route ⇄ path map above. ✅ written and passing,
and **inert: nothing imports it yet.** It must not be adopted until
`generate_pages.py` writes a real file at every path it can produce, or the
first reload after a tab click is a 404. `tools/check-routes.html` round-trips
all 26 route shapes against the real member folders; open it and it says PASS or
names what broke.

Two things it settles that were open:

- **Members are registered, not guessed.** `pathForRoute("dominique-makowski")`
  has to know that names a member, and the manifest has not landed at module
  evaluation — so `people.js` hands the folder set over when it does, the same
  idiom `page-meta.js` already uses for titles. Safe because a route is only
  ever *written* in response to a press. Reading is unaffected:
  `/people/<x>/` is unambiguous from its shape, so a page opened directly on a
  member's path resolves before any registration.
- **Tab names are reserved.** `/news/<x>/` is a post when `x` is a slug and a
  tab when `x` is a tab name, so no post folder may be `all` or `featured`, no
  member folder `lab`/`collaborations`/`memories`, no publication folder
  `list`/`gallery`. Checked against the current content: no collisions, and
  every post and publication folder begins with a year.

**1b. `shared/deep-link.js`** — adopt the map: `writeRoute` writes a path,
`INITIAL_ROUTE` falls back to `body.dataset.route`, an arriving legacy hash is
translated and `replaceState`d to its path. Both remain `replaceState`, so the
no-`hashchange` re-entrancy guarantee is untouched. This is the only existing JS
file that changes substantially.

**1c. `generate_pages.py`** — a fourth script beside the three `update_*.py`,
run after them. It reads `index.html` as the template and the three manifests,
and writes:

```
news/<slug>/index.html            38   the post
news/index.html                    1   every post, as real <a href> links
people/<folder>/index.html        14   the profile
people/index.html                  1   every member, linked
publications/<slug>/index.html    66   title, authors, abstract, DOI, PDF link
publications/index.html            1   every publication, linked
research/index.html  join/…  services/…  information/index.html
sitemap.xml                            all of the above, generated
```

≈ 125 pages. Each differs from the root shell only in: `<title>`,
`meta description`, `link rel=canonical` (its own path), `og:title` /
`og:description` / `og:url` / `og:image` (the item's own featured image, which is
a real win for sharing), the JSON-LD graph, `body[data-route]`, and the
`#prerender` block.

**Two things the generator must get right:**

- **All asset URLs in the generated shells become root-absolute**
  (`/css/01-base.css`, `/script.js`). A page at `/news/x/` cannot resolve
  `css/…`. This is safe because `RealityBending.github.io` is an organisation
  page served at the domain root — but it is a *fifth* copy of the "where the
  site lives" fact (with the canonical, `sitemap.xml`, `robots.txt` and
  `SITE_URL` in `page-meta.js`). Worth centralising all five into one constant
  the generator writes.
- **The three folder trees already are the URL structure.** `news/<slug>/`,
  `people/<folder>/` and `publications/<slug>/` exist on disk with their assets
  in them; the generated `index.html` goes in beside `post.json` and
  `featured.jpg`. Nothing has to be invented and the deep-link slugs are
  unchanged.

**1d. per-item JSON-LD.** The root's hand-kept graph
(`ResearchOrganization` / `Person` / `WebSite`) stays as it is. The objection
recorded in `index.html` — that publications do not belong on a page that is not
about them — dissolves once each has a page of its own:

- `/news/<slug>/` → `BlogPosting` (headline, datePublished, author → the PI's
  `@id`, image, publisher)
- `/people/<folder>/` → `Person` (+ `sameAs` from the manifest's social links,
  which it already has)
- `/publications/<slug>/` → `ScholarlyArticle` (+ `identifier` the DOI, authors,
  `isPartOf` the venue, `citation` count)

All generated from the manifests, so nothing is hand-kept twice.

**1e. crawlable internal links.** Two options, in ascending fidelity and risk:

- *Low risk:* a link row in the footer — People · Research · News ·
  Publications · Join · Contact — pointing at the new real paths. Minor visual
  addition, normal for a site footer.
- *Higher fidelity:* the nav's own hrefs become the real paths
  (`/people/`, `/news/`, …) with a click handler that `preventDefault`s and does
  today's smooth scroll. Appearance identical, and the homepage then links to
  every hub. **Interaction to watch:** CLAUDE.md documents that the Research
  zoom shuts its gate on capture-phase clicks of `#fragment` anchors precisely
  *because the browser* does that scrolling and resolves a stale offset. If the
  nav stops being a fragment link, that guard has to move to the new handler.

Recommendation: do the footer row in Phase 1, and the nav change only if the
homepage's link graph turns out to matter.

### Phase 2 — the old site's 358 URLs

Do not start from zero. Post and publication URLs from the old site are where
whatever ranking exists today actually sits; the tag and author pages are not.

**The map is `legacy_map.json`, built by `build_legacy_map.py`.** ✅ built and
verified — 102 entries, every target checked to exist.

An earlier draft of this plan put `legacy_paths` in each `post.json` and
`info.json` instead, on the grounds that content should be the single source of
truth. That was wrong for this case, and the reason is worth keeping: **the old
site is frozen.** Its URLs will never change again, so its map is a static
artefact about a thing that no longer moves, not living metadata about the
content. One reviewed file beats the same 76 facts scattered through 76 content
files. The orphan risk that motivated the original idea is handled better by the
script's own target check, which fails loudly and names the stub — a stale field
buried in a `post.json` would simply have gone quiet.

**What the join turned out to be:**

- *Posts — 37 of 39, automatically, not by hand.* The earlier draft said this
  needed a hand-checked map because the slugs disagree
  (`2024-03-12-JingJRA` → `2023-jra-experience`). The slugs do disagree, but
  **the titles were preserved verbatim by the port**, so an exact normalised
  title join matches everything. Two hand overrides are all that is needed: the
  ECG post, whose title had a typo the port fixed (`articial` → `artificial`),
  and a 2021 vacancy ad that was not carried across and now points at the Join
  rail. Two more old folders are unpublished drafts — not in the old sitemap, so
  no stub is due.
- *Publications — 39 of 39*, by DOI with a normalised-title fallback: the join
  `import_publication_assets.py` already uses.
- *Authors — 14 of 74.* Exactly those whose slug is a lab member's folder.
- *Jobs and section indexes — 12*, hand-mapped; there is no key to join them on.
  `jobs/companion` and `jobs/projects` have no equivalent stage, so they go to
  `/join/` and `/research/` respectively.
- *Not mapped — 252.* 161 `tag/`, 60 remaining `authors/`, 25 `category/`, two
  conference talks and a handful of taxonomy indexes. Google treats a redirect
  to an irrelevant page as a soft 404 and discards it, and 252 of them is noise
  in Search Console that will hide real problems. A 404 is the correct answer
  for a page whose content no longer exists in any form.

**The case trap, which would have shipped 40-odd dead files.** Hugo lowercases
the URL it publishes: `content/post/2026-01-09-EventTriggers` was served at
`/post/2026-01-09-eventtriggers/`. A stub written at the folder's own mixed-case
name is a file nothing ever requests, and on a case-insensitive filesystem
(Windows, and Dropbox on top of it) the mistake is invisible locally and only
appears once it is on GitHub Pages. Every old path in the map is lowercased and
checked against the deployed sitemap for exactly that reason.

**The stub form.** GitHub Pages has no server redirects, so each stub is a file
at the old path:

```html
<!doctype html>
<meta charset="utf-8">
<link rel="canonical" href="https://realitybending.github.io/news/2023-new-logo/">
<meta http-equiv="refresh" content="0; url=/news/2023-new-logo/">
<title>Redirecting…</title>
<p><a href="/news/2023-new-logo/">Reality Bending Lab — New location and new logo!</a></p>
```

`rel=canonical` plus an instant meta-refresh is what Google documents as a
permanent-redirect signal when a real 301 is unavailable, and the visible link
is what makes it work for a crawler that honours neither. Roughly 85 stubs, all
generated.

### Phase 3 — deployment

The current workflow builds Hugo with blogdown into `docs/` and publishes
`docs/`. Cutover changes it to:

1. `python update_people.py && python update_publications.py && python update_news.py`
2. `python generate_pages.py`
3. publish `WIP/`

**Generate in CI, do not commit the output.** 125 generated `index.html` files
plus 85 stubs churning on every content edit would swamp the diff of the thing
that actually changed. The scripts stay runnable locally for preview.

Note that `update_publications.py` with `MAX_PUBLICATIONS = None` takes minutes
and hits ORCID and CrossRef on every DOI — that is too slow and too rude to run
on every push. Either commit the manifests (edited by the local script, as
today) and have CI run only `generate_pages.py`, or gate the fetching scripts
behind a manual trigger. **Recommended: CI runs `generate_pages.py` only.**

### Phase 4 — after it is live

- **Search Console + Bing Webmaster Tools**, sitemap submitted, then watch the
  Pages report for the old URLs draining out and the new ones coming in. This is
  the only way to find out whether any of the above worked.
- **Per-page `og:image`** already lands in Phase 1; check a few real shares.
- **Core Web Vitals.** The 3D brain is 5.7 MB and the People backdrop is a video
  loop. That is an LCP cost on mobile on the *homepage only* — the generated
  content pages carry the same shell, so it applies to them too. Worth measuring
  once there is something to measure; deferring `brain.glb` until the hero is
  interacted with, or behind `prefers-reduced-data`, is the obvious lever.
- **Text on the homepage.** 260 words is thin for the page that has to rank for
  "reality bending lab", "Makowski Sussex", "neuropsychology of reality". The
  Information section's copy is static and could carry another paragraph or two
  without changing the design.

## 4 · Effort and order

| phase | effort | ship |
|---|---|---|
| 0 · housekeeping | ✅ done | — |
| 1a · `shared/routes.js` | ✅ done, inert | with cutover |
| 1b–1e · deep-link, generator, JSON-LD, links | ~2 days | with cutover |
| 2 · legacy stubs | ✅ map built; ~2 h left to emit the stubs | with cutover |
| 3 · deploy workflow | ~2 h | with cutover |
| 4 · measurement and copy | ongoing | after |

Phase 2 came in far under estimate — the post join was automatable after all,
so what is left of it is a loop over `legacy_map.json` writing 102 files, and
that belongs inside `generate_pages.py`.

Phases 1 and 2 must go live in the same push. Stubs that point at paths which do
not exist yet are worse than no stubs.

## 5 · Deliberately not doing

- **Server-side rendering, a framework, or a prerender service.** The generator
  is ~300 lines of Python against manifests that already exist.
- **`pushState` on tab changes producing history entries.** Every write stays a
  replace, for the reason CLAUDE.md gives: a tab is not a page, and a reader who
  opened three profiles should not need three presses of Back to leave.
- **Redirect stubs for the 264 tag/author/category URLs.** See Phase 2.
- **AMP, or a separate mobile URL space.** Neither exists as a ranking factor
  any more.
