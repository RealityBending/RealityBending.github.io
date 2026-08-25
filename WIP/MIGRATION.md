# Migration: WIP/ becomes the site

Replacing the Hugo/blogdown site at the repository root with this one, and
serving it from `main`.

The whole thing is one commit's worth of work and it is reversible until the
Pages source is switched. Read §1 first — most of the preparation is already
done, and knowing which parts changes what you have to do.

**This file is disposable.** It is a runbook for a one-time job plus the list of
what is still open; once the site is live and §7 is worked through, delete it.
Everything permanent about how the site works lives in `CLAUDE.md`.

---

## 0 · Before you start

**What is being replaced.** `github.com/RealityBending/RealityBending.github.io`
currently builds a Hugo site with blogdown in CI and publishes `docs/` to the
`gh-pages` branch, which GitHub Pages serves at
`https://realitybending.github.io/`. After this, `main` is the source, a Python
script generates ~250 pages in CI, and Pages serves the artifact directly.

**The one-way door** is step 5 — switching *Settings → Pages → Source* to GitHub
Actions. Everything before it is a normal commit you can revert, and the live
site keeps being served off `gh-pages` the whole time.

**Do it in one push.** The redirect stubs for the old site's 100 URLs and the
pages they point at ship together or not at all; stubs pointing at paths that do
not exist yet are worse than no stubs.

---

## 1 · What is already prepared

Three things were written *inside* `WIP/` specifically so the migration is a
move rather than a rewrite. None of them is active while `WIP/` is nested, and
all of them are correct the moment it is not:

| | where | why it is inert today |
|---|---|---|
| `deploy.yml`, `check.yml` | `WIP/.github/workflows/` | GitHub only reads workflows from `.github/` at the **repository root** |
| `.gitignore` | `WIP/.gitignore` | git reads a `.gitignore` in any directory, relative to that directory — so its un-prefixed paths already match, and still match after the move |
| every script's paths | `Path(__file__).resolve().parent` | each one resolves its own directory; none knows it has a parent |

The one exception, and it needs a decision in step 3: **`tools/build_legacy_map.py`
reads `../docs/sitemap.xml`** — the old Hugo build — to check that every stub it
writes corresponds to a URL the old site actually published.

---

## 2 · Move it

From the repository root:

```bash
git rm -r --cached config content layouts themes assets data resources index.Rmd .hugo_build.lock
```

Then delete the same directories from disk, plus the untracked build output
(`docs/`, `public/`), and move the site up:

```bash
rm -rf config content layouts themes assets data resources docs public index.Rmd .hugo_build.lock
git mv WIP/.github/workflows/deploy.yml .github/workflows/deploy.yml
git mv WIP/.github/workflows/check.yml .github/workflows/check.yml
git rm .github/workflows/tweet.yml
git mv WIP/.gitignore .gitignore
git mv WIP/* .
rmdir WIP/.github/workflows WIP/.github WIP
```

`git mv WIP/*` will not move dotfiles — `.nojekyll` in particular, and **the
site is broken without it**: Jekyll ignores any path beginning with `_` and
mangles others. Move it explicitly and check:

```bash
git mv WIP/.nojekyll .nojekyll
ls -a | grep nojekyll
```

**Keep at the root:** `README.md`, `.Rprofile` and the `.Rproj` if you still
open the repo in RStudio; delete them otherwise. They are inert either way.

**`git mv` rather than a plain move**, so git records renames and the history of
every file survives. It will not follow a copy-then-delete.

---

## 3 · Freeze `tools/build_legacy_map.py`

Once `docs/` is gone this script cannot run — it joins the old site's published
URLs against the new content, and one half of that join no longer exists.

That is fine, because **its output is committed.** `legacy_map.json` is 100
reviewed entries about a site that will never change again, and
`generate_pages.py` reads it directly. The script becomes documentation of how
the map was made.

Add a line at the top of it saying so, so the next person does not spend twenty
minutes finding out:

> This can no longer run: it reads the old Hugo site's `docs/sitemap.xml`, which
> was deleted at the migration. `legacy_map.json` is its committed output and is
> what `generate_pages.py` reads. Kept as the record of how the map was built.

If you ever need to re-derive it, the old sitemap is in the git history:
`git show <last-hugo-commit>:docs/sitemap.xml`.

---

## 4 · Verify locally, before pushing

```bash
python generate_pages.py
```

Expect **148 content pages, 100 redirect stubs, 147 sitemap URLs**. Then both
route checks — these are the two halves of *every URL this site writes is a URL
it serves*, and between them they catch the class of bug this site is prone to:

```bash
python tools/check-paths.py
```

Expect `PASS — every one is a real page.` over 149 routes. Then open
`tools/check-routes.html` in a browser; expect `PASS — every route round-trips.`

Then serve it and click through:

```bash
python -m http.server 8777
```

Check, at minimum:

- the homepage loads and the door opens;
- a deep link works cold — `http://localhost:8777/news/2023-new-logo/` should
  open the reader with no door and the right title;
- a legacy URL redirects — `http://localhost:8777/post/2023-02-01-new_logo/`
  should land on that same post;
- reloading after pressing a tab is not a 404 (that is what `check-paths.py`
  proves, but it is worth seeing once).

**`python -m http.server` sends no cache headers** and browsers hold stale JS and
CSS across reloads. If a change appears to have no effect,
`fetch("/script.js", {cache: "reload"})` in the console and reload before
assuming the code is wrong.

---

## 5 · Push, then switch Pages

Push to `main`. The `🚀 Build and deploy` workflow will run and **succeed**, and
deploy nothing anyone can see — because Pages is still serving `gh-pages`.

That is the safety property: the new pipeline proves itself green on the real
repository while the live site is untouched.

Then, and only then:

**Settings → Pages → Source → GitHub Actions.**

Re-run the workflow (`Actions → 🚀 Build and deploy → Run workflow`) and the new
site is live.

---

## 6 · Clean up

- **Delete the `gh-pages` branch** once the new site is confirmed live. Leaving
  it is not dangerous, but it is a second copy of a site that no longer exists
  and it will confuse the next person.
- **The old workflow's `tweet.yml`** is entirely commented out and was deleted in
  step 2. If posting to X on publish is wanted again, it is a new job on the new
  workflow, not that file resurrected.

---

## 7 · After it is live

In rough order of value:

1. **Check the redirects on the real domain.** Pick five old URLs — a post, a
   publication, an author, `/jobs/phd/`, `/post/` — and confirm each lands.
   Locally-passing stubs are not proof: Hugo lowercased the URLs it published,
   and a case mistake is invisible on Windows and on Dropbox but fatal on Pages.
2. **Search Console and Bing Webmaster Tools**: verify the property, submit
   `sitemap.xml`, then watch the Pages report — old URLs draining out, new ones
   coming in. This is the only way to find out whether any of the SEO work
   landed. Expect weeks, not days.
3. **Check a few real shares.** Paste a post URL into Slack, X and LinkedIn and
   confirm the card shows that post's own title and image rather than the
   homepage's. Per-page `og:*` is generated; nothing has confirmed it in the
   wild.
4. **Measure Core Web Vitals on the homepage**, then act on §8.

---

## 8 · One thing still open

It does not block cutover. It is a judgement call that was left for you.


### 8.1 The generated publication pages show an abstract the site does not

`generate_pages.py` writes the abstract into `/publications/<slug>/`, and
`publications.js` never renders it — the string is not referenced in the module
at all. So a crawler that runs nothing sees the abstract and a reader does not.

That breaks the one property the whole pre-render trick rests on: *a crawler
that renders and a crawler that does not come away with the same text* (see
CLAUDE.md, "Why this shape and not another"). The content is legitimate and
nobody is going to be penalised for an abstract, so the risk is low — but it is
the single place the invariant does not hold.

Two honest fixes: show the abstract in the panel (it is already fetched
per-publication from `info.json`, so it costs the list view nothing), or drop it
from the generated page. **Showing it is the better one**, on the same reasoning
CLAUDE.md gives for the hand-written `summary` field.

---

## 9 · What the pre-cutover audit checked

Kept as the record, because "we looked" is worth being able to point at. Verified
against a local server with all four generator scripts run:

- **No console errors** across every tab of every section, opening a profile,
  opening a post, flipping a Services card, and a full scrub of the Research
  zoom. The only console output is Chrome's own video power-pause warning, which
  CLAUDE.md documents and the encoder already mitigates.
- **All 250 network requests return 200.** No broken images, no 404 assets.
- **Routes hold both ways.** `tools/check-routes.html` round-trips all 18 route
  shapes it exercises; `tools/check-paths.py` passes all 149 routes the site can
  write.
- **Legacy coverage is complete where it matters** — all 37 old post URLs, all
  39 publication URLs and all 7 job URLs redirect. The 254 unmapped are
  deliberate; see CLAUDE.md.
- **Accessibility basics hold.** One `<h1>`, no heading-level skips, `alt` on all
  288 images, no unnamed buttons, `aria-selected` maintained on every tab group,
  `inert` used properly, `prefers-reduced-motion` honoured in 14 CSS blocks and
  7 JS branches. Two gaps, both minor: no `<main>` landmark (`#main-page` is a
  `div`) and no skip link.
- **`innerHTML` is confined to lab-authored content.** The one third-party string
  (CrossRef abstracts) is stripped to plain text by `_clean_abstract` and
  inserted with `esc()`. `shared/rich-text.js` builds DOM nodes and can only
  emit `<a>`, `<em>`, `<strong>`.
- **Bundle weight**: 66 KB of CSS and 120 KB of JS gzipped, no build step, no
  dependencies beyond three.js from a CDN.

Five defects were found and fixed. Four were the same shape — *a URL the site
puts in the address bar that nothing serves* — which is why `tools/check-paths.py`
exists and why CI runs it. All five are written up where they belong, in
CLAUDE.md next to the code they concern: the self-redirecting `/people/` and
`/research/` hubs, `body[data-route]` freezing the router on generated pages,
Services never being migrated off hashes, `/information/contact/` having no page,
and `og:url` still being written as a hash.

---

## 10 · If it goes wrong

**Switch *Settings → Pages → Source* back to *Deploy from a branch → gh-pages*.**
That branch is untouched by any of this, so the old site returns in about a
minute. Everything else — a bad generate, a broken stub, a wrong canonical — is
a commit on `main` and can be reverted normally.

The one thing that is genuinely awkward to undo is deleting `gh-pages`, which is
why step 6 says to wait.

---

## Appendix · The five copies of "where the site lives"

`https://realitybending.github.io/` is written in five places and **nothing keeps
them in step.** A CNAME, an org rename or a different deploy path means changing
all five, and the failure mode is silent — pages that describe themselves as
living somewhere they do not:

| file | what it holds |
|---|---|
| `index.html` | `<link rel="canonical">` and `og:url` |
| `generate_pages.py` | `SITE_URL`, which writes the canonical and `og:url` into all 148 generated pages and every entry of `sitemap.xml` |
| `shared/page-meta.js` | `SITE_URL`, for the live `og:url` |
| `robots.txt` | the `Sitemap:` line |
| `tools/build_legacy_map.py` | the prefix it strips off the old sitemap's URLs |

`sitemap.xml` and `llms.txt` are generated, so they follow `generate_pages.py`
automatically and are not a sixth copy.
