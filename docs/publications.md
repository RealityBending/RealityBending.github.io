# The Publications section

The ORCID/CrossRef pipeline, the manifest's fields and their traps, the cards, the metric badges and the Scholar button.

## Publications

`publications/publications.js` over `publications_manifest.json`, styled in
`css/14-publications.css`. Two tabs (List, Gallery), a multi-term search with a
keyword dropdown, a sort bar, the shared pager, and a cite modal on `<body>`.

**The list is the whole ORCID profile plus `EXTRA_DOIS`, minus `OMIT_DOIS` —
65 entries, 10 of them preprints, 46 with a figure, 45 with a PDF.**

**The automatic preprint dedupe only catches an exact title match**, and
retitling between preprint and journal is ordinary, so it misses a share of
them: `10.31234/osf.io/jz6yq` ("…Should I Use? A Data-driven Answer") and
`10.1111/psyp.70164` ("…Should I Use for Psychophysiological Research?") are
one paper and both survived it. The tell is **two entries whose slugs collide
on the first four words** — that is what a retitled preprint looks like from
here. The fix is `OMIT_DOIS`, with the base DOI and no `_vN` suffix.

That rule has now missed a pair twice, and the second one did not even give the
slug tell: `10.31234/osf.io/9pjx5` ("The Illusion Game: A Novel Experimental
Paradigm Provides Evidence for a General Factor of Visual Illusion Sensitivity
and Personality Correlates") and `10.1038/S41598-023-33148-5` ("A novel visual
illusion paradigm provides evidence for a general factor of illusion
sensitivity and personality correlates") are one study with the same abstract,
and they share no opening at all — one leads with the task's name, the other
with the finding. **The reliable tell is the abstract, not the title.** Two
entries whose `abstract` matches are one paper however differently they are
named, and nothing in the run checks that.

`MAX_PUBLICATIONS` in `update_publications.py` was `20` while the section was
being built and is now `None`. Four things follow from that number, none of
which bit at twenty:

- **A full run is minutes, not seconds**, because every DOI is cross-validated
  against CrossRef one at a time. It prints a heartbeat every ten works for
  that reason: without one it is indistinguishable from a hang, and killing it
  half way leaves the manifest unwritten.
- **Four words of a title stopped being a unique folder name.** `unique_slug`
  lengthens the slug with the title's own next word until it is unique, which
  keeps the name content-derived and therefore stable between runs. It matters
  because `pub_dir.mkdir(exist_ok=True)` means a collision is not an error —
  the second publication simply overwrites the first and goes missing from a
  list nobody counts by hand.
- **ORCID is incomplete as well as occasionally wrong, and nothing reports an
  absence.** A paper never added to the profile is simply invisible here —
  the Ribot centenary paper (`10.3917/bupsy.549.0163`) was on the old Hugo site
  and on no ORCID record, so it had gone missing without a trace.
  `EXTRA_DOIS` is the mirror of `OMIT_DOIS`: a DOI is the whole entry, fetched
  from CrossRef in full. An entry that later appears on the profile is skipped
  with a note rather than duplicated.
- **A folder name is a URL path, so a slug is folded to ASCII.** `\w` is
  Unicode-aware in Python 3, and the first French title produced
  `2017_CentenaireRibotPremièrePartie` — a directory that must be
  percent-encoded in every `<img src>` built from it, and that git and Dropbox
  normalise differently on Windows and macOS (NFC vs NFD), which is how a
  repository ends up with two folders whose names look identical. Every other
  folder is ASCII by accident of the titles being English; `title_to_slug`
  makes it so on purpose.
- **ORCID records are self-claimed, and "D. Makowski" is not a unique name.**
  A hardware paper — "Novel Digital Camera with the PCIe Interface" — is on the
  profile with no DOI, so there was nothing to cross-validate it against and it
  rendered as a bare title in the middle of a psychology list. `OMIT_TITLES` is
  `OMIT_DOIS` for the works that cannot be named by DOI. Check any new entry
  that arrives with no authors: that is what an unmatched work looks like.
- **A work can reach the list with no year.** ORCID had none for the misophonia
  paper, which put it in a `0000_` folder and printed "n.d." on the card, for a
  paper CrossRef dates perfectly well — so the year falls back to CrossRef's
  `published`/`issued`. ORCID's own year is never overridden. The fallback runs
  before the sort and before the slug, so both pick it up.

Entries carry fields written by hand in their `info.json`, and that is the
supported way both to fix one and to add something upstream does not have:
`load_publications` merges the file over the fetched data, so a hand-written
field survives every future run — including a key ORCID and CrossRef know
nothing about, which is copied through to the manifest with everything else.

**`github` and `spotify` are that second kind.** Both are optional, both are a
plain URL, and both render as a badge on the card in `publications.js` beside
the Altmetric donut, the Dimensions circle and the PDF — nothing generates or
validates them, so a typo is a dead badge and there is no run that will say so.
Neither is written into the generated page, on the same reasoning: they are
*about* the work rather than part of it, and the page's job is the text a
crawler indexes. Four badges is the widest a card gets and the row does not
wrap, so a fifth link field needs the layout looked at before it is added.

- `2017_HowVirtualEmbodimentAffects` — no DOI at all; authors taken from the
  old Hugo site's front matter.
- `2023_DisentanglingTheSocialFrom` — a book chapter in *Future Cities — City
  Futures* (TU Delft OPEN Books). `10.34641/mg.55` is the **book's** DOI, not
  the chapter's, and is in neither CrossRef nor DataCite, so nothing could be
  fetched. Authors and venue come from the Sussex figshare deposit
  (`sussex.figshare.com/articles/chapter/…/23737158`), whose public API answers
  where the web page returns 403. It has no citation count for the same reason.
- `2025_TooBeautifulToBeFake`, `2024_TheHeartCanLie` and
  `2023_NovelVisualIllusionParadigm` — `spotify`, a podcast episode discussing
  the paper. Store the **bare episode URL**: Spotify's share button appends a
  `?si=` token that identifies the account that shared it, and that does not
  belong in a committed public link. Each of these three also has a matching
  `.mp3` in its folder, carried over from the old Hugo site, which nothing on
  the new site references yet.

**`abstract`, `summary` and `keywords`.** The first and third are fetched, the
second is only ever written by hand.

- **`abstract` comes free from a response the script already had.** Every DOI is
  cross-validated against CrossRef for the type check, the authors and the
  citation count, and the abstract was in that same `message` being discarded.
  Coverage is **27 of 65**, and it is not random: all 10 PsyArXiv preprints have
  one, all 12 JOSS papers do not, Elsevier and Springer mostly do not, Frontiers
  / MDPI / Wiley / SAGE / PLOS do. An entry without one is normal.
- **It is stored as plain text and must be inserted as text, never as HTML.**
  CrossRef returns JATS XML, and `_clean_abstract` strips every tag rather than
  translating it — unescaping entities *between* two stripping passes, so
  doubly encoded markup cannot survive. This is the only string on the site
  fetched from a third party; everything else (`content` in a post.json,
  `summary`/`details` in the people manifest) is lab-authored and reviewed,
  which is the assumption `normalizeRichHtml` is written on. The tag pattern
  requires a letter after the `<`, so an abstract containing "p < .05 and
  n > 30" keeps it.
- **`summary` is seeded empty in every `info.json` on purpose.** Nobody fills in
  a field they do not know exists, and this is the highest-value text a
  publication entry can carry: two or three plain sentences on what the paper
  found are the one thing about it that is not already on the publisher's site,
  on PubMed and on ResearchGate. An abstract makes a page longer; this is what
  makes it worth indexing. The twelve JOSS papers — the lab's own
  software, and the block with no abstracts at all — are where it earns most.
- **"Existing wins" is qualified for all three.** `merged.update(existing)` is
  what lets a hand-written value survive every run, but on its own it also
  freezes an *empty* one: a paper whose abstract CrossRef did not have on the
  first run would keep `""` for ever, even after the publisher deposits it. So
  existing wins only when it holds something.

**The manifest carries no `abstract`** — the same rule the news pipeline follows
for post bodies, and for the same reason. Every visitor downloads
`publications_manifest.json` to render a list of titles, and 28 abstracts at a
median of 165 words is ~50KB that nothing in the list view shows. Read it off
`info.json` instead, where it costs the page nothing. `summary` and `keywords`
*are* in the manifest: both are short and both are worth having in the list view
and in the search.

**Folders are not deleted when a slug changes**, because a stale one may hold a
PDF or a figure that was put there by hand and the new folder will not have it.
The script lists them at the end of a run instead, with whatever they contain
besides `info.json`.

**Folder names are chosen, not only generated.** The four-words-of-the-title
rule truncates mid-phrase and keeps the filler word it lands on
(`…PriorsIn`, `…OutliersAn`, `TheBeautyAndThe`), and renders a software paper
as its subtitle rather than as the name of the thing
(`ModelbasedAnRPackage`). `SLUG_OVERRIDES` replaces 45 of them. Three things
about it:

- **It is keyed by the generated slug, not by DOI** — the readable choice for a
  hand-edited map, and the failure is visible rather than silent: a changed
  upstream title stops the key matching, and the run reports both the unused
  override and the orphaned folder.
- **Two keys have to be tried**, the plain four-word slug *and* the
  collision-lengthened one, because `title_to_slug` never returns the latter.
  The stale-override warning is what catches a key that matches neither.
- **Every override value is reserved before any slug is assigned**, so a
  generated name that collides with a chosen one is lengthened instead — the
  deliberate name wins whichever order the two arrive in.

**`pdf` and `featured` are the one pair of fields where disk beats
`info.json`**, and it is the opposite of every other field. They are not
metadata; they are paths built out of the folder's own name, so the moment a
folder is renamed the remembered value points at a file that no longer exists —
`existing or detected` pins it there permanently. Renaming 48 folders broke 27
of 68 entries exactly this way, and the card renders a broken image. It is
`detected or existing` now, the `existing` half being what lets a hand-written
path to a PDF hosted elsewhere survive a run that finds no local file.

**Forty of the 67 figures came from the old Hugo site** via
`tools/import_publication_assets.py` — see the Assets table.

**The section is green.** `--pub-accent` is `--section-publications` (#55cc77,
what it has on the hero's arc and on the brain), `--pub-ink` is that hue taken
down to `#23663a` so it can be read as text on cream — #55cc77 itself is far
too light for a tab label. Every tint in the sheet is `color-mix`ed off those
two, so recolouring the section is one token. It was `rgba(85, 100, 160, …)`, a
slate blue-violet that appeared nowhere else on the site, which made the tab
bar, the chips and the sort buttons read as belonging to a different page. This
is the arrangement News already had, and the reason both sections have three
tokens rather than one.

Two things that must not take the accent:

- **The preprint state.** A green state chip inside a green section says
  nothing, so `--pub-preprint` is the site's amber. The tint stays on the
  card's border, its badge, and a tint of the field faint enough that a row of
  mixed cards still reads as one set.

**The badge sits beside the year, in `.pub-card__eyebrow`, and used to be
`position: absolute` in the card's top-right corner.** That corner is where the
figure column is on **46 of the 65 cards**, so on two thirds of the list the
label sat on top of a chart. Three things came out of moving it:

- It is next to the year because the year is the card's *other* piece of
  bibliographic state, and that line already exists.
- `align-items: baseline`, not `center`: the year is letter-spaced caps with no
  box and the badge is a pill with its own padding, so centring the two boxes
  puts the two sets of letters on visibly different lines.
- **The `padding-right: 4.75rem` the title needed to dodge the corner is
  gone**, and with it the `:not(.pub-card--has-image)` qualifier that scoped it.
  A long title on a preprint gets its full measure back. A preprint card's
  eyebrow is 15.7px against a plain card's 11px — the pill genuinely is taller,
  and that is the whole of the difference.
- **The PDF and GitHub badges.** Acrobat red and GitHub purple are what those
  things look like everywhere a reader has ever met them. They are not section
  colours and must not become them.

**The Altmetric and Dimensions badges are placed on every card and armed only on
the page the reader is looking at.** All 66 cards are built up front and the
pager shows five, so writing `altmetric-embed` and `__dimensions_badge_embed__`
into the card builder handed both vendors' scripts every publication at once:
**111 image requests** to `badges.altmetric.com` and `badge.dimensions.ai` on the
*homepage*, before anyone had scrolled near the section, for 61 cards that are
`hidden`. Measured. It is 7 now. Three things:

- **The class name is the switch**, not a `data-` attribute — because the class
  is what both scripts select on, so an unarmed badge is invisible to them by
  construction rather than by our remembering to filter something. The
  placeholders are built as `.pub-metric-badge` with `data-metric-badge`, and
  `armMetricBadges` adds the real names.
- **It has to be idempotent.** `renderView` runs on every filter, every sort and
  every page turn, and a card already armed has already been *populated* — so
  re-arming would ask both vendors for a number they have drawn. It returns
  whether anything changed, and the refresh is skipped when nothing did.
- **`ensureOfficialMetricBadgeScripts` refreshed twice** — once in its own
  `.then` and once in the caller's — and both vendors answer a second scan with
  a second round of API calls, measured at three per DOI where one was due. The
  inner one is gone; the refresh belongs to the caller.

The step deliberately *not* taken is deferring the two scripts behind an
`IntersectionObserver` on the section. It would take the homepage to zero, at
the cost of the failure mode this file already warns about for the Scholar
rotation: an observer that never fires is a real case, and there it costs a
timer nobody sees, while here it would leave the badges permanently blank.

**The cards are plain white** (`rgba(255, 255, 255, 0.72)`), the same field the
News rows and the Creations tiles sit on. They carried an SVG fibre grain for a
while — a paper texture, inline as a `data:` URI. Two things came out of that
and are worth keeping even though the texture is gone:

- **The first attempt was invisible, and the opacity was the wrong knob.**
  `feTurbulence` writes noise into all four channels, so its own alpha is noise
  centred on 0.5: pass that through and the rect's `opacity` is halved before
  anything reaches the screen, the colour is a flat mid-grey, and the result
  lands within a couple of levels of the background whatever the opacity says.
  Measured, sd **1.4 out of 255**. Raising the opacity mostly darkens the card
  without adding contrast; what adds contrast is throwing the noise's own
  colour away — pin RGB with an `feColorMatrix` and build alpha out of the
  noise's *luminance* instead.
- **A texture can be measured without being seen.** Draw the data URI onto a
  canvas over the intended `background-color` and take the standard deviation
  of the luminance. That is how both the invisible version (1.4) and the
  visible one (6.4) were checked in a pane that cannot screenshot.

The visible version was then rejected on sight: a page whose sections are all
clean cream and white has nothing for a grain to belong to, and it read as
dirt. Not a third attempt.

**The figure is a column, not a thumbnail** — 13rem on the **right**, filling
whatever height the row turns out to be, so a short entry and a long one line
their figures up. It used to be a 160px image centred in that space. Two
things follow:

- It is on the right, where News puts its thumbnail on the left, and that is
  not an inconsistency: a post's picture is the hook, while a publication's
  figure is a chart that illustrates an entry the title has already announced.
  So it follows the text rather than preceding it, and `publications.js`
  appends it after the body — **source order matches visual order**, and
  nothing has to reorder anything.
- 13rem against News' 15rem, for the same reason it is second: it is one of
  several things in the row rather than the row itself.

Below 780px the card stacks and the figure becomes a full-width 11rem band
under the text — the same breakpoint and treatment as `.news-card`. The
preprint badge's title padding is scoped away from cards with a figure
(`:not(.pub-card--has-image)`): there the badge sits over the figure's column,
not over the end of the title's first line.

**The Scholar button is the bibliometrics, and then a joke about them.**
`buildScholarMetrics` in `publications.js` cycles h-index → citations →
publications → "What does it mean?" → "Nothing, but check out our Google
Scholar profile →", one state every `SCHOLAR_ROTATE_MS` (1200) — brisk on
purpose, because the sequence is five states and at a leisurely pace a reader
glancing at the header never reaches the punchline. Five things about it:

- **The numbers are hand-kept**, in the `SCHOLAR` constant at the top of the
  module: there is no API for them and a Scholar profile cannot be fetched from
  a browser. `publications: null` means "use the manifest's own length", which
  is the honest fallback until someone writes the real Scholar figure down —
  the manifest is a curated selection, not the whole profile.
- **It is built over the anchor already in `index.html`**, not in place of it,
  so the href, the target and the rel survive untouched and the no-JS fallback
  is a working Scholar link.
- **The states are stacked in one grid cell**, not swapped in and out. The
  button is then sized once by the widest and the tallest of them and never
  changes size; a header that resized itself every 3.6s would shove the tab bar
  down the page under someone reading it. Same trick as the zoom's ask line.
  It is also what makes the narrow-screen rule safe: below 620px the button
  gives up its fixed 15.5rem and takes the row, and the punchline wrapping to
  three lines still does not make it move.
- **The rotation starts, and the observer stops it** — not the other way round.
  It only runs while the section is on screen (an `IntersectionObserver` rooted
  on `#main-page`, because that is the scroll container), but an observer that
  never fires is a real case, and the two failure modes are not equal: rotating
  off-screen costs a timer nobody sees, while waiting for a callback that never
  comes leaves the button frozen on its first frame, which reads as broken.
- **Under reduced motion the three figures stand side by side** and the two
  punchlines are dropped (`.pub-scholar--still`). The rotation *is* the effect
  — there is nothing to slow down — and a punchline only works after the
  set-up it no longer has.
