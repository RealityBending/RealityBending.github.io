# Building and deploying

The `update_*.py` scripts, `generate_pages.py`, the CI pipeline, the `.gitignore` rules, and the one Pages setting the whole design depends on.

## How this actually gets deployed

**Pages must be set to *Settings → Pages → Source: GitHub Actions*, and the
whole design collapses silently if it is not.** `deploy.yml` has always said so
in a comment; this is what it looks like when it is ignored.

On "Deploy from a branch", GitHub runs its own built-in `pages build and
deployment` workflow on every push *as well as* ours. Both succeed. The branch
one wins, and the branch is by definition the thing that does **not** contain
the ~250 generated pages, `sitemap.xml` or `llms.txt` — every one of which is
gitignored precisely because CI is supposed to build it.

The failure is invisible from every angle you would normally look from:

- The homepage is perfect, because the homepage *is* `index.html` on the branch.
- Every in-page route works, because the router is client-side — press a member
  and the URL says `/people/dominique-makowski/` and the panel opens.
- Actions is green. Our workflow ran, generated all 182 pages, passed
  `check-paths.py`, and uploaded an artifact nothing served.
- It only shows when somebody **reloads or shares** one of those URLs, which is
  the one thing the whole generated-pages exercise exists to support.

Two runs of the built-in workflow next to ours in the Actions list is the tell.
If `curl -o /dev/null -w '%{http_code}' https://realitybendinglab.com/sitemap.xml`
returns 404, the branch is being served.

## `.gitignore`: name the files, not the folder

`information/` was ignored as a whole folder, and it is the one generated
directory that also holds source — `join.js`, `services.js`, their
`-content.js`, and the section's own `img/`. Files added *before* that rule
stayed tracked, so it looked fine for months. Three assets added afterwards —
`sussex-bg.jpg`, `sussex_landscape.jpg` and `logo_sussex.svg` — were silently
never committed.

**That failure is invisible locally and only exists on the deployed site**,
which is what makes it worth writing down: the files are on your disk, so the
local server serves them, the Contact and Services backdrops render, and
nothing in the repository looks wrong. `git status` does not mention them —
that is the entire point of an ignore rule. Only the deployed site 404s.

It is `information/index.html` + `information/*/index.html` now. The other six
generated folders hold nothing else and are anchored with a leading slash
(`/join/`, not `join/`) so they cannot also swallow `information/join/` and
disguise which rule is doing the work.

**Before adding a folder to `.gitignore`, check whether anything in it is
source.** And when an image "does not show" on the deployed site but does
locally, `git check-ignore -v <path>` is the first thing to run.

`site-sections.js` is the place to change a section's colour, its brain region,
or its nav entry — the hero buttons, nav links and 3D brain highlight all read
from it. Changing a colour in `css/01-base.css` alone will desynchronise them.

## Running the Python scripts

```bash
python update_people.py && python update_publications.py && python update_news.py
python generate_pages.py
python tools/check-paths.py
```

`generate_pages.py` reads the manifests, so it runs **after** whichever
`update_*.py` owns the content you changed. Editing a publication's `info.json`
is the case that catches people out: the page's own text is read straight from
`info.json`, but `summary`, `keywords` and `citations` are *also* in the
manifest, which is what the list view renders — so a change to any of those
needs `update_publications.py` first or the section and the page disagree.

### Two lines every one of them needs, and why

Both are guarded in all five runnable scripts — the three `update_*.py`,
`generate_pages.py` and `tools/check-paths.py`. (`tools/build_legacy_map.py` is
frozen and cannot run at all, so it carries only the first.) Neither guard is
decoration: each covers a real environment somebody actually runs these in.

- **`sys.stdout.reconfigure(encoding="utf-8")`, behind a `hasattr`.** They all
  print ✓/✗ and names, and **a Windows console defaults to cp1252**, so without
  the reconfigure a script does its work and then dies on its own summary line
  with a `UnicodeEncodeError` — which reads exactly like a failure to write the
  file, when the manifest on disk is already correct. But `sys.stdout` in a
  Jupyter/IPython cell is an ipykernel `OutStream`, which **has no
  `reconfigure`**, so calling it unconditionally fails on line one with
  `AttributeError: 'OutStream' object has no attribute 'reconfigure'`. Hence
  `if hasattr(sys.stdout, "reconfigure")`.
- **`__file__`, behind a `try`.** It does not exist in a notebook cell at all,
  so `Path(__file__).resolve().parent` is an immediate `NameError` — the second
  error you hit, one line after the first. The fallback is `Path.cwd()`.

**And in `generate_pages.py` that fallback is then checked**, which the
`update_*.py` scripts do not bother with and should not: they write one manifest
into a folder they also read, so a wrong root fails loudly on the read. This one
*writes* ~250 files plus three site-wide indexes, and a wrong root would scatter
a website into whatever directory the notebook happened to start in. `index.html`
must be in the root, so its absence is the cheapest possible proof that the root
is wrong, and it is checked before anything is created. `tools/check-paths.py`
carries the same check for a softer reason — it only reads, but "183 MISSING" is
a far worse error message than "you are in the wrong directory".

If one of these ever appears to have crashed, read the output before re-running
anything.


## `tools/` — developer tools, and none of it is part of the site

No page fetches anything in here, and that is the line that decides what
belongs.

- **`check-routes.html`** — round-trips every route shape through `routes.js`
  and prints PASS or names what broke. Open it in a browser.
- **`check-paths.py`** — every route the site can *write* is a real file, or it
  names the 404s. Run it after `generate_pages.py`; CI runs it as a gate on the
  deploy. It pairs with `check-routes.html`: that one checks routes.js
  round-trips, this one checks something serves the result.
- **`build_legacy_map.py`** — the old Hugo site's URLs → `legacy_map.json`.
  **Frozen: it can no longer run**, because it joins `docs/sitemap.xml` and
  `content/` from the old Hugo site, both deleted at the migration. Its output
  is committed and is what `generate_pages.py` reads.
- **`legacy_sitemap.xml`** — the old site's deployed sitemap, 354 URLs, kept
  because the `gh-pages` branch that held the only copy is going away.
  `legacy_map.json` maps 100 of them; this is the only thing the other 254 can
  be audited against.
- **`import_publication_assets.py`** — one-off, done: the old site's publication
  figures and PDFs → here, joined on DOI (see [publications.md](publications.md)).
  Frozen for the same reason as `build_legacy_map.py`.

`encode_intro_bg.sh` at the repo root is the same kind of thing for the People
backdrop loop — see [assets.md](assets.md).
