# The News section

One JSON file per post, the reader panel, the two tabs, and how the fifteen posts were ported from the old Hugo site.

## News

Same pipeline as People, for the same reason: content is one folder per item
and a Python script turns the tree into the single JSON the page fetches. **No
Markdown files, no front matter, no static site generator** — a post is one
JSON file.

```
news/<year>-<short-title>/post.json    metadata + the body as HTML, all of it
news/<year>-<short-title>/featured.*   optional, first match wins
update_news.py                         → news/news_manifest.json
```

**A folder is `<year>-<short-title>`, and the folder name is the slug** — so it
is also the shareable link (`#post-2025-interoception-questionnaires`). That is
why it is a year and a handful of words rather than a full date: **the day
lives in post.json and nowhere else.** It used to be in both, and one post
already disagreed with itself by two days; `parse_date` no longer falls back to
the folder, so a post with no `date` is a warning rather than a wrong date
nobody notices.

```json
{
  "title": "New location and new logo!",
  "date": "2023-02-01",
  "authors": ["Dominique Makowski"],
  "category": "Lab",
  "featured": true,
  "content": [
    "<p>New year, new start…</p>",
    "<figure><img src=\"old_logo.png\"><figcaption>ReBeL logo (2020-2022).</figcaption></figure>"
  ]
}
```

**`category` is one value from a closed list, not free tags** — `CATEGORIES` in
`update_news.py`, currently Research, Thoughts, Methods, Lab, Awards, Media, in that
order because it is a running order and not an alphabet. The old site tagged
every post with "Reality Bending Lab", "University of Sussex" and "Psychology",
which is true of all of them and so filters nothing; what a reader wants to say
is "show me the essays". The list should be hard to extend: a category that
applies to two posts is a category, one that applies to one is a tag. An
unknown value is a warning, not a failure, so a typo shows up in the run rather
than silently producing a chip of its own.

**`featured: true` is the whole Featured tab.** No ordering field, no count —
the tab is whatever is flagged, newest first.

`image` names the hero if it is not called `featured.*`; the manifest reports
the resolved path as `image`, so `featured` can mean the flag and nothing else.

`content` is **HTML**, and it goes in through `innerHTML`. That is the
format's one real decision, and it is the same one the People section already
made — `summary` and `details` in `people_manifest.json` are raw HTML rendered
by `normalizeRichHtml`. The content is written by the lab, in the lab's own
repository, and reviewed like every other file here; there is no path by which
a visitor can put anything into it. In exchange a post gets the whole of HTML
rather than whatever a dialect happened to implement, and `news.js` is about
120 lines shorter than the Markdown renderer it replaced.

**It may be one string, or a list of strings that are joined.** JSON strings
cannot hold a literal newline, so a post of any length written as one string is
a single enormous line; splitting it a block per paragraph keeps it editable
and a diff readable. The list is line-wrapping and nothing else — `news.js`
joins it and never looks at where the joins were. Both forms are in the repo:
`2025-ai-faces-in-the-news` is two sentences and one string,
the other two are lists.

A post carries **no class names**. `css/13-news.css` dresses the elements
themselves under `.news-prose`, and `news.js` does the two things an author
would otherwise have to remember on every post:

- `<img src="mint.jpg">` names a file in the post's own folder and is re-based
  against it, and gets `loading="lazy"` — a post's figures are below the fold
  of a panel that has just opened, and one of them is a 700 KB GIF.
- every off-site `<a>` gets `target="_blank"`, `rel="noreferrer noopener"` and
  the `.news-link` class.

### Porting a post from the old Hugo site

Fifteen came across from `content/post/` in one pass, and five things about it
are worth having written down before the next one:

- **No in-page hash may appear in a post body except the site's own routes** —
  `#post-…`, `#join-…`, a member's bare folder, and the rest. Any hash at all fires
  `hashchange`, every route handler on the page hears it, and `news.js` closes
  the reader on any route that is not a post. Markdown footnotes are the trap:
  they render as `#fn-1` / `#fnref-1` jump links, so a reader pressing a
  footnote marker had the article shut on them. The markers are plain `<sup>`
  now and the notes sit at the foot of the piece — the panel scrolls itself, so
  a jump link was not going to land anywhere useful in any case.
- **Convert with `mistune`, not `python-markdown`.** The old posts fence code
  inside list items, which `fenced_code` does not see: it degrades to an inline
  `<code>` with the language name leaking into the text. mistune's
  `<pre><code class="language-…">` is already what the posts here use.
- **Headings shift down one.** Hugo printed the title as the page's `h1`, so
  the old bodies start their sections at `##`; here the title is the reader's
  own and a post's sections start at `h3`.
- **Hotlinked images are dropped, not carried across.** Seven of them pointed at
  giphy, gfycat, kym-cdn and reddit; some of those hosts are already gone, and
  a broken figure is worse than no figure. Everything kept is re-encoded into
  the post's own folder.
- **The old site's tags do not survive.** "Reality Bending Lab", "Psychology",
  "University of Sussex" are true of every post and so filter nothing; a
  category is chosen per post from the closed list instead. Old-site URLs that
  now name something on this page (`/post/…`, `/authors/…`, `/jobs/assistant/`)
  are rewritten to the hash that reaches it; the rest of
  `realitybending.github.io` is left alone, because those pages are still up.

Other notes:

- **The manifest carries metadata only, never `content`.** The index has to
  list every post; inlining the bodies would mean downloading the whole blog to
  render a list of titles. `news.js` fetches a post.json when the post is
  opened and caches it for the session.
- **`authors` are resolved against `people/people_manifest.json`**, by folder
  slug first then by name, so a post picks up the author's avatar and canonical
  name and stays right when either changes. Run `update_people.py` first if
  both changed. An unmatched entry is kept as a plain name, not an error —
  guests write here too.
- **A resolved author's name is a button through to their profile**: the page
  goes to the People section and their panel opens over it. `folder` is exactly
  the set of authors who have a profile, so a guest stays plain text and there
  is nothing extra to check. The lookup is `openProfileByFolder` in
  `shared/profile-api.js`, registered by `people.js` — the manifest lives
  there, and a caller resolving a slug itself would be fetching a second copy.
  It is registered when that manifest lands, so a click before then does
  nothing, which is the same contract the other two profile actions have.
  **Only the reader's byline carries links.** An index row is itself a
  `<button>`, and a button inside a button is invalid and behaves
  unpredictably; the row already has a job.
- A post that gives no `summary` gets its opening `<p>` instead, with figures
  stripped out first so a caption can never become the summary.

**The reader is the People section's sliding profile panel**, in this section's
colours: a fixed panel off the right edge, a blurred backdrop, closing on the
✕, on the backdrop and on Escape. Three things about it:

- Its shell rules are **copied from `.profile-panel`, not shared with it** —
  same width behaviour, same 0.38s cubic-bezier, same z-index pair (200 over
  199). That sheet is 26KB of people-specific children and reaching into it
  would couple the two sections for the sake of forty lines. If a third one of
  these appears, that is the moment to extract the shell.
- It lives on `<body>`, **not inside `#main-page`** — which is the scroll
  container and is `pointer-events: none` until the door opens. A panel inside
  it would inherit both.
- The open forces a reflow (`void reader.offsetWidth`) between un-hiding the
  panel and adding `.is-open`, rather than waiting a frame. Going from
  `display: none` to displayed leaves no start position for the transform to
  animate from, and rAF is not always running — in a headless preview pane it
  never fires, and the panel would appear with no slide at all.

**The index is two tabs** — All posts, the archive, and Featured, a short
curated list with no filter and no pager because neither has anything to do on
four rows a human chose. They use the page's own tab machinery: `swapTabPanels`
for the slide and `initMarginTabNav` for the margin arrows, like People,
Research, Publications and Information. `.news-panel[hidden]` is needed because
`[hidden]` loses to their `display` rule — the same trap as everywhere else.

**All posts is first, and so the default.** The archive is what a reader coming
to a News section is looking for; Featured is a shortcut into it rather than a
front door of its own. Two consequences worth keeping: the tab order is a
presentation decision, so `news.js` fills the two panels through `panelFor(id)`
rather than by index, and the "no posts" / "could not be loaded" messages go to
the archive list — the panel a reader is actually looking at. The empty state
names whichever control emptied it: "No posts match your search." when a term
is active, "No posts in those categories." otherwise.

The head above the tabs is the title and nothing else. It used to carry a post
count opposite it and a rule underneath; the tab bar draws its own line
immediately below, so the second rule was two lines saying the same thing.
Nothing reports the size of a filtered set now — the rows are the feedback, and
the pager still says which page of how many once there is more than one.

**The two tabs lay their posts out differently, and that is the point.**
All posts is **rows** (`.news-card`, `buildRow`) — thumbnail at a fixed 15rem on
the left, everything else on the right — because posts run from a two-line
link-out to a 1500-word essay, forty of them read down the page, and a grid of
squares would give them all the same weight and the same crop. Featured is
**cards three across** (`.news-feature`, `buildFeatureCard`), picture on top,
because it is six posts a human chose and the picture is the reason to press.
It also means a reader knows which tab they are on without reading the tab bar.

Everything else about the card is the row's own dressing — same border, radius,
cream and lift — because these are the same posts in the same section; the
layout is what differs, not the material. Four things:

- **There is no lead card**, and the temptation is real: a big first card
  spanning both columns is the obvious editorial move. It would be a lie.
  `featured` is a flag with no ordering, so the first card is only the most
  recently flagged post, not the most important one. Equal weight, because the
  data gives them equal weight — the same reason nothing here reports the size
  of a filtered set.
- **`repeat(auto-fit, minmax(min(22rem, 100%), 1fr))`**, not `1fr 1fr 1fr`:
  three columns at the 1200px content cap, two from ~1100px down, one below
  ~730px, no breakpoint to keep in step. 22rem is what puts three inside the
  cap; the cards come out at ~385px, and the title dropped from 1.34rem to
  1.2rem so a serif title still fits its three lines at that width. (It was
  26rem and two columns until the third was asked for.) **The `min()` is
  load-bearing**: a track minimum is a *minimum*, so a bare floor keeps the
  single column wider than a 375px phone and pushes `#main-page` into
  horizontal overflow — 432 against 375, measured at 26rem.
- **The media is a fixed 16:9, not the picture's own ratio.** These are heroes
  cropped for a 1400px reader panel and they arrive in every shape; letting each
  set its own height staggers the titles across a row. Title and summary are
  clamped (3 lines each) for the same reason — with the row's cards stretched to
  its tallest, an unclamped essay summary leaves the card beside it floating in
  a tall cell.
- **The category rides on the picture**, opaque rather than tinted: it sits over
  a photograph that could be any colour, and a translucent chip on the Matrix
  stills was unreadable. A post with no picture has nowhere for it to ride, so
  it joins the meta line instead of being dropped.

- **Category chips are multi-select and match on *any*.** A post has exactly
  one category, so "Research or Thoughts" is the only useful reading of two
  chips. There is no "All" chip — none selected already means all, and the way
  back is Clear, which is only up while something is selected.
- **Above them is the search field, and it is the Publications one.** Same
  shape (chips for committed terms inside the box, whatever is half-typed
  counting as one more, every term having to match), same 120ms debounce, same
  keys — Enter commits a term, Backspace on an empty box takes the last one
  back, Escape closes the list. The rules are copied into `css/13-news.css`
  rather than shared, for the reason the reader shell already gives.
  Four things differ, all of them because this is not a bibliography:
  - **It narrows *with* the category chips, not instead of them.** A category
    is a shelf and a search is a question, and "Methods, about Bayes" is a
    reasonable thing to ask for.
  - **It searches the manifest**, which is metadata only — title, subtitle,
    summary, category, year, authors. A post's body is not fetched until the
    post is opened, so full-text search would mean downloading the whole blog
    to filter a list of titles.
  - **The suggestion list is authors, not categories.** A category already has
    a chip of its own on the row below and offering it twice is two controls
    for one filter; authors are the other closed list the manifest carries, and
    "everything Zen wrote" is the question the chips cannot answer. It is ten
    names, so the dropdown is `min(20rem, …)` wide rather than the full column
    the Publications keyword list earns.
  - **A term is `{ label, value }`** — matching is lowercase throughout, and a
    chip reading "zen j. lau" after pressing *Zen J. Lau* looks like a bug.
  Blur *flushes* the pending debounce rather than dropping it, so typing a word
  and then clicking away does not lose the last keystrokes; the dropdown's
  items commit on `mousedown` (with the default prevented) so the input never
  blurs out from under the press in the first place.
- The pager is the shared one (see [layout.md](layout.md), "The pager"), which hides itself below two
  pages — so a filter that leaves one post does not leave two dead arrows and
  "Page 1 of 1" behind. `PAGE_SIZE` is in `news.js`.
- Rows drop to one column at 780px, well before the page's own 900px
  breakpoint: 15rem of thumbnail plus a readable summary needs the room, and a
  6rem crop of a photograph is not a photograph.

**"Keep reading" is three posts at the foot of the article** (`.news-related`),
the Publications reader's "See also" in shape. It replaced a single tile fixed
in the corner over the panel, which offered one post drawn at random from the
archive — one suggestion where three fit, and on a phone a square that covered
the prose it was suggesting an alternative to. Four things about it:

- **The three are random, not related — on purpose.** `relatedTo` in
  `news.js` shuffles the rest of the archive and takes three, on every open,
  so reading three posts in a row offers nine different ones. The publications
  score theirs by shared keywords, and a first version of this scored by
  category and author; it sent every Awards post to three other Awards posts
  and every essay to three essays — a closed loop that never showed a reader
  another shelf. 63 papers across a dozen topics have shelves worth walking;
  48 posts across six categories do not, and the point of the row here is
  that there is more than the shelf a reader landed on.
- **The generated page's three are random too, re-rolled on every build** —
  `related_posts` in `generate_pages.py`. The publications' three are
  deterministic so that a page's links settle ([publications.md](publications.md));
  here a fresh three per deploy is the point, and the generated pages are not
  in git, so there is no diff to churn. Before this a post's page had no
  outgoing internal link but its breadcrumbs.
- **Each tile is a real `<a>`** through `hrefForRoute`, so middle-click, "copy
  link address" and a crawler all work; a plain left click is intercepted and
  opens the post in the panel instead. Hopping through three posts keeps the
  row that opened the reader as the focus target for the eventual close.
- It sits **inside the article, in the prose's 40rem column**, under a
  hairline that closes the prose — it scrolls with the text and is reached
  where a reader who has finished actually is. That hairline used to belong to
  a footer carrying the post's category chip; **the chip now rides on the
  byline, beside the author's name** (`.news-tag--article`), where a reader
  deciding whether to read on is looking, rather than telling them what shelf
  the post was on once they had finished it. Three across is 12.5rem a tile, which a 16:9
  picture over a three-line title fits; a post with no picture gets a tinted
  block of the same size so the row keeps its shape. Below 620px it becomes a
  column of strips with the picture on the left, as the archive's rows do at
  780px.
