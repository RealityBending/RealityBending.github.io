# Reality Bending Lab — site notes

Single-page site for the Reality Bending Lab (University of Sussex). No build
step, no framework, no package manager: plain ES modules, plain stylesheets,
static assets. The repository root **is** the site.

**This file is the index, and it is deliberately short.** Everything specific
lives in `docs/`, one file per area — read only the one you need. Every fact
lives in exactly one place; if something is true of two areas, it is here.

```bash
python -m http.server 8777
```

## Where to read before you change something

| Working on | Read |
|---|---|
| any CSS; the shell, hero, tabs, pager, scroll handlers, parallax | [docs/layout.md](docs/layout.md) |
| URLs, deep links, `routes.js`, `deep-link.js`, generated pages, SEO/head | [docs/routing.md](docs/routing.md) |
| the People section, roster, alumni, memories | [docs/people.md](docs/people.md) |
| the Research section's Creations tab, its colours | [docs/research.md](docs/research.md) |
| the Research **Overview** tab (the scroll-driven dive) | [docs/research-zoom.md](docs/research-zoom.md) |
| News posts, the reader, porting old posts | [docs/news.md](docs/news.md) |
| Publications, the ORCID/CrossRef pipeline, cards, badges | [docs/publications.md](docs/publications.md) |
| the Information section (Contact / Join / Services) | [docs/information.md](docs/information.md) |
| adding **any** image, video or model | [docs/assets.md](docs/assets.md) |
| the Python scripts, CI, `.gitignore`, deployment | [docs/build-and-deploy.md](docs/build-and-deploy.md) |

`README.md` is the only file here written for lab students rather than
maintainers: how to add a profile, how to write a post. Keep it that way.

## The repository

```
index.html          all markup; sections are static, contents injected by JS
css/                one numbered file per part — the numbering IS the cascade
script.js           door screen, nav, hero glow, tabs, backdrop parallax
site-sections.js    single source of truth for a section's colour, brain region, nav entry
brain.js            the three.js brain in the hero
shared/             cross-section helpers; their CSS counterpart is css/07-shared.css
people/ research/ publications/ collaborations/ memories/ news/ information/
                    one module + JSON manifest each, rendered client-side
update_people.py    people/ + memories/ folders  → their manifests
update_publications.py
                    ORCID + CrossRef                → publications/ + manifest
update_news.py      news/ folders                   → news_manifest.json
generate_pages.py   manifests + index.html          → ~250 real pages, robots.txt,
                    sitemap.xml, llms.txt   (all gitignored, all built in CI)
tools/              developer tools — nothing here is part of the site
img/                assets shared by more than one section
.github/workflows/  the deploy and check pipelines
LICENSE             MIT for the code, plus what in here is somebody else's: the
                    brain mesh is CC-BY-4.0, the paintings and the papers are
                    not ours to relicense
```

## Rules that apply everywhere

Break one of these and the failure is usually silent. They are here rather than
in `docs/` because they are not any one area's business.

- **A section's colour lives in `site-sections.js`, not in the stylesheet.**
  The hero buttons, the nav links and the 3D brain's highlight all read from it.
  Changing a colour in `css/01-base.css` alone desynchronises them. Note also
  that the hero's button colours come from `:nth-child` rules, so a colour
  belongs to **a position on the arc, not to a section** — see
  [docs/layout.md](docs/layout.md).
- **A section's colour lives in `site-sections.js`, not in the stylesheet.**
  The hero buttons, the nav links and the 3D brain's highlight all read from it.
  Changing a colour in `css/01-base.css` alone desynchronises them. Note also
  that the hero's button colours come from `:nth-child` rules, so a colour
  belongs to **a position on the arc, not to a section** — see
  [docs/layout.md](docs/layout.md).
- **`#main-page` is the scroll container, not the window.** It is
  `position: fixed; inset: 0; overflow-y: auto`. Anything scroll-related listens
  on it; `IntersectionObserver` needs `root: mainPage`.
- **`css/` is one stylesheet cut into numbered parts, and the number is the
  cascade.** A rule loses to the same-specificity rule in any later file. Add a
  file where it belongs in the order, never at the end for convenience, and put
  a rule in the part that owns the component.
- **Relative `url()` resolves against the stylesheet, not the page** — from
  `css/` an image is `url("../img/…")`.
- **`[hidden]` loses to a `display` rule.** Any component with `display: flex`
  or `grid` needs its own `[hidden] { display: none }`, or pagination and tab
  switching silently show everything.
- **`:not()` carries its argument's specificity**, so a blanket child selector
  can outrank rules it was never meant to touch.
- **`<base href="./">` in `index.html` is mandatory and must stay relative.**
  The path moves as the reader navigates, so every URL built afterwards would
  otherwise resolve against the new directory. `generate_pages.py` refuses to
  run without it.
- **Every URL write is a `replaceState`** — no history entry, no `hashchange`,
  so a module can never re-enter its own route handler.
- **Nothing may key off a fraction of the scroll height.** Opening the Research
  zoom's gate changes `scrollHeight` by ~800vh. Test a section's own rect.
- **Scroll handlers go through `shared/scroll-loop.js`**, one coalesced
  animation frame for the whole page, and return early when the value has not
  changed.
- **Encode every image to the size it is actually displayed at, doubled.** The
  per-use budget is in [docs/assets.md](docs/assets.md). The site once pulled
  122 MB on a cold load.
- **`.gitignore`: name the generated files, never a folder that also holds
  source.** An ignored source file is invisible locally and 404s only on the
  deployed site. When an image "does not show" in production but works locally,
  run `git check-ignore -v <path>` first.
- **Pages must be set to Settings → Pages → Source: GitHub Actions**, or the
  ~250 generated pages are never served and nothing anywhere says so. See
  [docs/build-and-deploy.md](docs/build-and-deploy.md).
- **The Python scripts must survive both a cp1252 console and a notebook.**
  `sys.stdout.reconfigure(encoding="utf-8")` behind a `hasattr` (a notebook's
  `OutStream` has no such method), and `__file__` behind a `try` (a cell has no
  `__file__`). Without the first they do the work and then die on their own
  summary line, which reads exactly like a failure to write the manifest. See
  [docs/build-and-deploy.md](docs/build-and-deploy.md).

## Verifying changes

There are no tests. Verify in a browser, and prefer computed styles and
geometry over screenshots — faster, and exact:

```js
getComputedStyle(el).position
el.getBoundingClientRect()
```

**`python -m http.server` sends no cache headers**, so browsers serve stale JS
and CSS while you debug a fix that already landed. Before assuming the code is
wrong: `fetch("/script.js", { cache: "reload" })`, then reload.

### In a headless or non-compositing preview pane

Several things look exactly like real bugs and are not:

- **`requestAnimationFrame` never fires**, because `document.visibilityState` is
  permanently `"hidden"`. Since `scroll-loop.js` coalesces every scroll handler
  into one rAF, *nothing on the page reacts to scrolling* until it is stubbed.
- **CSS transitions and animations never advance**, so a transitioned property
  reads as its **start** value — which looks identical to a selector that does
  not match. Inject `* { transition: none !important }`, read, then remove.
- **`IntersectionObserver` and `ResizeObserver` callbacks do not fire.**
- **`loading="lazy"` images never load** — no request at all, `naturalWidth` 0.
  `fetch()` the path to prove it serves, then set `img.loading = "eager"`.
- **`scrollTo({behavior: "smooth"})` does not move anything.** Re-issue with
  `behavior: "instant"`.
- **Screenshots are unavailable** for the same reason frames are.

The four lines that make scroll-driven work testable there:

```js
document.getElementById("main-page").classList.add("visible")  // then remove #door-screen
mainPage.style.scrollBehavior = "auto"                          // else scrollTop is ignored
window.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 0)
window.dispatchEvent(new Event("resize"))                       // stands in for a scroll
```

Then drive real events and await a tick:

```js
mp.scrollTop = 5000
mp.dispatchEvent(new Event("scroll"))
await new Promise((r) => setTimeout(r, 40))
```

A `javascript_tool` call aborted mid-flight can leave the stubbed loop wedged
with a frame scheduled and never run; reload rather than debugging the symptom.

### Measuring contrast

Colours are `color-mix`ed throughout and come back as
`color(srgb 0.13 0.48 0.5)` — **reading those floats as 0–255 reports false
failures.** Composite onto a 1×1 canvas and let the browser parse:

```js
ctx.fillStyle = background; ctx.fillRect(0,0,1,1)
ctx.fillStyle = foreground; ctx.fillRect(0,0,1,1)
const [r,g,b] = ctx.getImageData(0,0,1,1).data
```

### Debug guides

`--debug-margins` in `:root` (`css/01-base.css`) outlines sections and content
containers. Set it to `1` while working on spacing.
