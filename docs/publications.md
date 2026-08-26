# The Publications section

The ORCID/CrossRef pipeline, the manifest's fields and their traps, the cards, the metric badges and the Scholar button.

## Publications

`publications/publications.js` over `publications_manifest.json`, styled in
`css/14-publications.css`. Two tabs (List, Gallery), a multi-term search with a
keyword dropdown, a sort bar, the shared pager, and a cite modal on `<body>`.

**The list is the whole ORCID profile plus `EXTRA_DOIS`, minus `OMIT_DOIS` —
63 entries, 9 of them preprints, 54 with a figure, 52 with a PDF.**

### One work, one entry

**A preprint and its published version must never both be in the list** — the
journal version replaces the preprint, it does not join it. The rule had been
enforced by comparing `re.sub(r"\s+", " ", title.lower())`, which is not a key,
it is a title with its spaces tidied, and by the time anyone counted there were
**four duplicate pairs standing in a list of 67**. `_title_key`,
`_is_erratum` and `_abstract_key` in `update_publications.py` are what replaced
it. Each existed because of a specific failure:

- **A zero-width character is not whitespace.** `\s` does not match U+FEFF, and
  Behavior Research Methods deposited "Check your outliers\ufeff!" — so the
  preprint sat beside its own journal version for a year while the rule that
  was supposed to catch it compared two strings that differed by an invisible
  character. The key now keeps nothing but letters and digits.
- **An erratum carries the paper's title plus a pointer to it.** "In Medio Stat
  Virtus: … (vol 85, pg 1613, 2021)" is a correction notice, and CrossRef types
  it `journal-article` like anything else. `ERRATUM_TAIL` strips the tail, which
  is what makes it collide with the paper it corrects; it is dropped and the
  paper is kept.
- **A retitled preprint shares neither title nor slug with what it became.**
  This is what most of `OMIT_DOIS` is: `10.31234/osf.io/jz6yq` ("…Should I Use?
  A Data-driven Answer") against `10.1111/psyp.70164` ("…Should I Use for
  Psychophysiological Research?"), and `10.31234/osf.io/9pjx5` ("The Illusion
  Game: A Novel Experimental Paradigm…") against `10.1038/S41598-023-33148-5`
  ("A novel visual illusion paradigm…"), which share no opening at all — one
  leads with the task's name, the other with the finding. **The tell there is
  the abstract**, which survives a retitling where a title does not.

**What is removed automatically and what is only reported is a deliberate
asymmetry.** The three rules above cannot be wrong: an identical key, an
erratum tail, an abstract 90% identical to a published one. Everything short of
that is *reported* — `POSSIBLE DUPLICATE` at the end of a run, naming both DOIs
and what to do — because deleting a real paper because two titles happen to
overlap is a far worse failure than leaving a duplicate on a page, and the hard
part was never the fix. It was noticing.

The measured gap does not support automating it either way. Of the three
genuine preprint pairs, the title overlaps were 1.00, 0.80 and 0.48; the
closest *non*-duplicate pair — the Mint scale against the Affective Style
Questionnaire, two questionnaire validations — was 0.27. The report fires at
0.40 and a human decides.

**Two pairs still need `OMIT_DOIS`, and both are instructive.**
`10.31234/osf.io/p342w` (The Heart can Lie) was retitled *and* reworded: its
abstract is 0.77 similar to the published one, under the 0.90 a removal needs.
`10.31234/osf.io/rw39q` (Beauty is in the Eye of the Beholder → The Beauty and
the Self) could not have been caught by anything: the titles share less than
half their words and CrossRef holds **no abstract at all** for the published
version. Its abstract was copied onto `2024_TheBeautyAndTheSelf`'s `info.json`
by hand before the preprint entry went, or the site would have lost the only
copy it had. Check for that before omitting a preprint.

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

## The publication panel

`.pub-reader` in `publications.js`, styled at the foot of
`css/14-publications.css`. One publication, opened over the section by pressing
a card's title, its figure or a gallery tile, and closed on the ✕, the backdrop
or Escape.

**It exists because the 63 pages `generate_pages.py` writes were addresses
nothing on the site pointed at.** A card's title linked straight to doi.org, so
the only thing this site had to say about a paper was somebody else's address
for it — and the pages were not merely unlinked, they were *reachable*: they
are in `sitemap.xml`, so a reader arriving on `/publications/<folder>/` from a
search result got the shell, no handler claimed `pub-<folder>`, and they were
left at the top of the homepage looking at the door. The route existed in
`routes.js` and in the generator and in nothing between them.

It is the News reader and the People profile panel — same geometry, same 0.38s,
same backdrop, copied rather than shared for the reason `css/13-news.css`
already gives. Seven things are specific to it:

- **The DOI has not gone anywhere; it is the first action inside the panel.**
  `--primary` is filled because the publisher's record is the canonical one and
  usually the reason somebody opened the panel at all. `PDF`, `Code` and
  `Podcast` follow it — which is where `github` and `spotify` finally get a
  second home, though they still stay off the *generated* page for the reason
  given above: they are about the work rather than part of it.
- **"In brief": the summary and the figure, in a tinted box.** Two problems and
  one element. The figure had the panel's full width — on a 920px panel that is
  a 700px chart standing over two sentences of text, and at that size the figure
  reads as the point of the page, which it is not. And the summary is the most
  worth reading of the panel's prose while looking like the least of it: three
  lines of body text above 200 words of the publisher's abstract. So the two sit
  side by side in the section's green, under a heading that names them. Five
  things:
  - **The figure is a 15rem column on the right**, the arrangement and the
    reasoning of the card the reader pressed to get here: a publication's figure
    illustrates an entry the title has already announced, so it follows the text
    rather than preceding it. Source order is visual order.
  - **`--split` is set in JS, not by `:has()`.** 9 of the 63 entries have no
    figure, and their summary must take the whole row rather than the 1fr a
    missing figure would leave. The module knows which case it is in.
  - **`max-height` with `object-fit: contain`, not a fixed aspect ratio.**
    These are charts of every shape — 667×1000 and 1000×857 both occur — and one
    tall enough to run past the summary beside it would put the panel back where
    it started. The letterboxing is invisible against the frame's white, and the
    frame is opaque white rather than the 72% the panel's other cards use:
    on the tint a translucent frame goes green too.
  - **The tint was measured, not picked.** At the 10% it started on, the box was
    rgb(228, 250, 241) against the citation box's rgb(243, 250, 244) — five
    levels of red between two boxes that say different things. It is 16% now,
    rgb(228, 247, 233), fifteen levels off the citation box and seventeen off
    the panel's cream, and the summary's ink still clears 12:1 on it.
  - **The figure is a button** that opens `shared/media-lightbox.js`, the viewer
    the Memories tab and the profile panel already use. A 220px chart is
    something a reader can only tell apart from another chart, so shrinking it
    without giving the full size back would have been a straight loss. That puts
    a third layer over the panel, which is why the Escape handler bails on
    `defaultPrevented` — the viewer claims the key from the capture phase, as
    people.js already documents.

  **The panel's four section labels are full `--pub-ink`, and that is a
  correction.** "In brief", "Abstract", "Cite this" and "See also" were mixed to
  75% of it, which measured **3.6:1 on all three grounds they sit on** — cream,
  the citation box, the brief box. At 0.68rem/700 these are *small* text by
  WCAG's reckoning (large starts at 18.66px bold; these render at 10.9px), so
  3.6 is a fail rather than a near miss. Undiluted they are 6.2–6.5:1. A
  letter-spaced uppercase label is the last thing on a page that can afford to
  be faint.
- **The abstract is fetched per publication**, because the manifest
  deliberately does not carry it (see below). Cached in a `Map`, so a reader who
  opens the same paper twice asks once, and a failure is silent and returns
  `{}` — 36 of the 63 have no abstract anyway, so "no abstract" is an ordinary
  state rather than an error worth showing.
- **The panel opens first and the abstract lands into a slot.** Waiting on the
  fetch before showing anything reads as a dead press. The guard on the way back
  in (`reader.dataset.pub !== pub.folder`) is what makes hopping through three
  "see also" links safe: a response for a paper the reader has already left must
  not write itself into the panel.
- **Re-rendering would re-roll the suggestions**, so the abstract fills a slot
  rather than triggering a second `renderPublication`. That is the whole reason
  the render returns the empty `<div>`.
- **The card title, the card figure and the gallery tile are real anchors**, via
  `hrefForRoute` — middle-click, "copy link address" and a link a crawler can
  follow all give the same URL `writeRoute` would put in the address bar. The
  press is still handled in script, or the browser would reload the page to
  reach a panel.
- **One Escape handler for three layers, innermost first.** The image viewer
  (9000) is over the cite modal (1000) is over the panel (200), and a single
  press that closed more than one would take the reader two steps back for one
  keystroke. The viewer marks the event itself; the modal and the panel are
  ordered by hand in the one handler.

**"See also" is three publications, and the keywords are what make them worth
reading.** A candidate is scored by how many keywords it shares with the paper
being read, and the three are drawn from the best-scoring band that can fill
them. Two things follow:

- **The panel's three are random within a band and the generated page's three
  are not.** Opening the same paper twice should offer something new, which is
  the re-roll `news.js`'s "another post" already does — but a *page* whose
  internal links changed on every build would churn 63 files a deploy and never
  let a link settle. `related_publications` in `generate_pages.py` therefore has
  total tie-breaks: shared keywords, then the nearest year, then the folder
  name.
- **An entry whose title key matches is dropped, not only the paper itself.**
  This is a backstop and not the plan: a preprint and its journal version must
  never both be in the list in the first place, and "One work, one entry" above
  is where that is enforced. It stays because it is two lines, because the
  pipeline runs against a live ORCID profile that can hand it a pair it has
  never seen, and because "see also: this same paper" is the one suggestion
  that reads as a bug to every reader who sees it. It does not *hide* anything
  the run would have reported — the `POSSIBLE DUPLICATE` warning fires on the
  same data, in the place a maintainer will see it.

**The three outgoing links are the point on the generated page.** Before them a
publication page's only internal links were its breadcrumbs, so 63 of the
site's ~250 pages were leaves: a crawler that walks links rather than sitemaps
reached one and had nowhere to go but back up. The page also carries the APA
reference in the raw HTML — `apa_reference` in `generate_pages.py`, deliberately
a second copy of `_apaCite` in `publications.js`, because it is the most copied
string on one of these pages and both a crawler and the reader looking at the
panel want it. **If those two drift, that is the pair to look at.**

## Abstract, summary, keywords

**`abstract` is fetched; `summary` and `keywords` are written by hand.**
`keywords` *can* be fetched — `_crossref_keywords` reads whatever CrossRef
deposited — and in practice that was 5 distinct terms across 2 of the 63
entries, which is not a vocabulary. See the keyword note below.

- **`abstract` comes free from a response the script already had.** Every DOI is
  cross-validated against CrossRef for the type check, the authors and the
  citation count, and the abstract was in that same `message` being discarded.
  Coverage is **27 of 63**, and it is not random: the PsyArXiv preprints
  mostly have one, all 12 JOSS papers do not, Elsevier and Springer mostly do
  not, Frontiers / MDPI / Wiley / SAGE / PLOS do. An entry without one is
  normal. One of the 27 is hand-written — see the `OMIT_DOIS` note above.
- **It is stored as plain text and must be inserted as text, never as HTML.**
  CrossRef returns JATS XML, and `_clean_abstract` strips every tag rather than
  translating it — unescaping entities *between* two stripping passes, so
  doubly encoded markup cannot survive. This is the only string on the site
  fetched from a third party; everything else (`content` in a post.json,
  `summary`/`details` in the people manifest) is lab-authored and reviewed,
  which is the assumption `normalizeRichHtml` is written on. The tag pattern
  requires a letter after the `<`, so an abstract containing "p < .05 and
  n > 30" keeps it.
- **`summary` is written for all 63, and it is the highest-value text an entry
  carries.** Two or three plain sentences on what the paper found are the one
  thing about it that is not already on the publisher's site, on PubMed and on
  ResearchGate — an abstract makes a page longer, this is what makes it worth
  indexing. It is shown three times over: clamped to three lines on the card,
  in full above the abstract in the panel, and as the generated page's
  `<meta name="description">`.

  **Where there was no abstract to work from, the summary says what the paper
  *does*, not what it found.** 36 of the 63 have no abstract — every JOSS
  paper, most of the early Springer and Elsevier entries — and an invented
  result is worse than a plain description. Keep that rule when adding one: a
  reader can tell the difference, and a wrong finding on a lab's own website is
  the kind of error that gets quoted back.

  It has no upstream source, so `merged.setdefault("summary", "")` leaves
  whatever is in `info.json` alone on every run — there is nothing that can
  overwrite one.
- **`keywords` is a controlled vocabulary, assigned by hand to all 63.** It
  had to be: CrossRef's own deposits gave 5 terms across 2 entries, and the
  keyword dropdown, the search chips and "see also" all read this one field. The
  vocabulary is **32 terms** and it is the lab's strands rather than each
  paper's own words — *Reality Beliefs*, *Interoception*, *Visual Illusions*,
  *Emotion Regulation*, *Software Development*, *Computational Models*,
  *Aesthetics*, *Self-Reference*, *Episodic Memory*, *Psychophysiology* and so
  on, 2–4 per entry. Two constraints, neither enforced:
  - **A term earns its place by joining two papers.** A keyword on one entry
    is a dropdown row that filters to a list of one, which is a worse way of
    finding that paper than typing its title. *Time Perception* is the one
    term currently on a single entry, and the check to run before adding
    another is simply to count.
  - **The written form is the displayed form.** The dropdown, the chips and the
    generated page all print the string as stored; matching is
    `toLowerCase()`d, so `Reality Beliefs` and `reality beliefs` filter alike
    but show differently. Title Case throughout.
  - `info.json` is the record, not this list: "existing wins" below is what
    carries them through every future ORCID run. There is no script that
    re-applies them, on purpose — a second source of truth would drift from the
    first.
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

**Forty of the figures came from the old Hugo site** via
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
figure column is on **54 of the 63 cards**, so on all but nine of them the
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
the page the reader is looking at.** Every card is built up front and the
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
