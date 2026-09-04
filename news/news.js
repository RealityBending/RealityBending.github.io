import { openProfileByFolder } from "../shared/profile-api.js"
import { createPager } from "../shared/pager.js"
import { INITIAL_ROUTE, hrefForRoute, landOnLoad, matchRoute, onRoute, revealSection, writeRoute } from "../shared/deep-link.js"
import { registerRouteTitle } from "../shared/page-meta.js"
import { element as el } from "../shared/dom.js"

/* news.js
 * The News section: one index of posts — a grid of cards under a search field,
 * category chips and a pager — plus a reader that slides in over the page for
 * one of them.
 *
 * There were two tabs here, All posts and Featured, and the second is now a
 * chip in the first's own filter row. A tab is a *view*, and Featured was
 * never one: it showed the same posts, from the same manifest, differing only
 * in which of them it dropped. That is what a filter is, and as a filter it
 * composes — "featured Awards posts" is one gesture where two tabs could not
 * express it at all. The grid the Featured tab used to draw is now how every
 * post is drawn, so nothing was lost but the tab bar.
 *
 * Content is the People section's system — one folder per post under news/,
 * assembled by update_news.py into news/news_manifest.json. A post is a single
 * post.json holding its own metadata and its body as HTML; there is no
 * Markdown file and no front matter. Adding a post is dropping a folder in and
 * re-running the script.
 *
 * The manifest holds metadata only, so the index costs the same whether the
 * blog has three posts or three hundred. A post.json is fetched when the post
 * is opened and cached for the session.
 *
 * The reader is the People section's sliding profile panel, in this section's
 * colours: a fixed panel off the right edge, a blurred backdrop, close on the
 * ✕, on the backdrop and on Escape. Its shell rules are duplicated in
 * css/13-news.css rather than shared with .profile-panel — the profile's own
 * sheet is 26KB of people-specific children and reaching into it would couple
 * the two sections for the sake of forty lines. If a third one of these ever
 * appears, that is the moment to extract the shell.
 */
;(function () {
    const root = document.getElementById("news-root")
    if (!root) return

    const MANIFEST_URL = "news/news_manifest.json"
    /* Three rows of the three-column grid. It was 4 when the index was rows —
       a page of cards has to fill its last row or the grid ends ragged, so the
       size is a multiple of the column count rather than a number of entries a
       reader can take in. */
    const PAGE_SIZE = 9
    // Long enough that a fast typist filters once rather than per keystroke,
    // short enough that the list feels live. Same value as the Publications
    // search, which this one is deliberately the twin of.
    const SEARCH_DEBOUNCE_MS = 120

    // Every post in the manifest, for the reader's "Keep reading" tiles —
    // which draw from the whole archive, not from whatever the filters have
    // left on screen.
    let allPosts = []


    function scrollToSection() {
        const section = document.getElementById("sec-news-full")
        const mainPage = document.getElementById("main-page")
        if (section && mainPage) mainPage.scrollTo({ top: section.offsetTop, behavior: "smooth" })
    }

    /* "2025-12-20" → "20 December 2025". Written out rather than run through
       toLocaleDateString with a locale: the rest of the site is in British
       English regardless of who is reading it, and a date that switches to
       month/day for one visitor and day/month for another is worse than one
       that is simply spelled out. */
    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

    function formatDate(value, short) {
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || "")
        if (!match) return value || ""
        const month = MONTHS[Number(match[2]) - 1]
        return Number(match[3]) + " " + (short ? month.slice(0, 3) : month) + " " + match[1]
    }

    // Authors are objects once update_news.py has matched them against the
    // People manifest and plain strings when it could not — guests write here
    // too. Both read as a name.
    const authorNames = (post) =>
        (Array.isArray(post.authors) ? post.authors : []).map((author) => (typeof author === "string" ? author : author && author.name)).filter(Boolean)

    /* ── Bylines ──
     * The avatars are the ones the People section already has, resolved by
     * update_news.py, so an author who is in the lab is shown as themselves and
     * a guest is shown as a name. Overlapped when there is more than one — two
     * circles side by side read as two separate things, overlapped they read
     * as one byline.
     *
     * A name that resolved to a lab member is a button through to their
     * profile: the page goes to the People section and their panel opens over
     * it. `folder` is what update_news.py matched on, so it is exactly the set
     * of authors who have a profile to open — a guest stays plain text.
     *
     * `linked` because only the reader's byline can carry one. The index row is
     * itself a <button>, and a button inside a button is invalid and behaves
     * unpredictably; the row already has a job, which is opening the post. */
    function buildByline(post, className, linked) {
        const wrap = el("div", className)
        const authors = Array.isArray(post.authors) ? post.authors : []
        if (!authors.length) return wrap

        const withAvatars = authors.filter((author) => author.avatar)
        if (withAvatars.length) {
            const stack = el("div", "news-byline__avatars")
            if (withAvatars.length > 1) stack.classList.add("news-byline__avatars--stacked")
            withAvatars.forEach((author) => {
                const img = el("img", "news-byline__avatar")
                img.src = author.avatar
                img.alt = ""
                img.loading = "lazy"
                stack.appendChild(img)
            })
            wrap.appendChild(stack)
        }

        const names = el("span", "news-byline__names")
        authors.forEach((author, index) => {
            if (index) names.appendChild(document.createTextNode(" & "))
            if (!linked || !author.folder) {
                names.appendChild(el("span", null, author.name))
                return
            }
            const button = el("button", "news-byline__link", author.name)
            button.type = "button"
            button.addEventListener("click", () => goToPerson(author))
            names.appendChild(button)
        })
        wrap.appendChild(names)
        return wrap
    }

    /* Closing first, then scrolling, then opening: the profile panel is fixed
       and would otherwise sit over the reader with the news backdrop under it,
       two panels deep with no way to tell which ✕ belongs to which.

       The People section is above Research, so its offsetTop does not move when
       the zoom's gate collapses mid-flight — the stale-offset problem that
       makes the nav links shut the gate on the click does not arise here. */
    function goToPerson(author) {
        closeReader()
        const section = document.getElementById("sec-people-full")
        const mainPage = document.getElementById("main-page")
        if (section && mainPage) mainPage.scrollTo({ top: section.offsetTop, behavior: "smooth" })
        openProfileByFolder(author.folder)
    }

    /* ── The body ──
     * A post's `content` is HTML: plain `<p>`, `<h3>`, `<ul>`, `<figure>`,
     * `<blockquote>` written by hand. It is either one string or a list of
     * them, joined — the same contract the People section's `summary` and
     * `details` already have (normalizeRichHtml in people.js), and for the
     * same reason: JSON strings cannot hold a literal newline, so anything
     * longer than a few paragraphs has to be broken up to stay editable. The
     * list is line-wrapping, not a grammar; the renderer joins it and never
     * looks at where the joins were.
     *
     * This is `innerHTML`, and that is a deliberate trade. The content is
     * written by the lab, in the lab's own repository, and reviewed the way
     * every other file here is — it is not user input, and there is no path by
     * which a visitor can put anything into it. In exchange a post gets the
     * whole of HTML instead of whatever a dialect happened to implement, and
     * this module lost about 120 lines of parser.
     *
     * The stylesheet dresses the elements themselves under `.news-prose`, so a
     * post carries no class names.
     */

    /* Two passes over what the post wrote, both of which exist so the author
       does not have to think about them. */
    function finishContent(prose, base) {
        // Images name a plain file in the post's own folder ("mint.jpg"), and
        // the page is served from the site root. Anything absolute or off-site
        // is left alone, so a post can still point anywhere.
        prose.querySelectorAll("img[src]").forEach((img) => {
            const src = img.getAttribute("src")
            if (!/^(https?:)?\/\//.test(src) && !src.startsWith("/") && !src.startsWith("data:")) {
                img.setAttribute("src", (base || "") + src.replace(/^\.\//, ""))
            }
            // A post's figures are below the fold of a panel that has only just
            // opened, and one of them is a 700KB GIF.
            if (!img.hasAttribute("loading")) img.loading = "lazy"
        })

        // Every off-site link opens in a new tab, with the opener closed off.
        prose.querySelectorAll("a[href]").forEach((anchor) => {
            anchor.classList.add("news-link")
            if (/^(#|mailto:)/.test(anchor.getAttribute("href"))) return
            if (anchor.hostname && anchor.hostname !== location.hostname) {
                anchor.target = "_blank"
                anchor.rel = "noreferrer noopener"
            }
        })

        return prose
    }

    function renderContent(content, base) {
        const prose = el("div", "news-prose")
        prose.innerHTML = Array.isArray(content) ? content.join("\n") : String(content || "")
        return finishContent(prose, base)
    }

    /* ── The reader ──
     * One panel, built once and refilled — the same singleton the People
     * section's profile panel is. */
    const backdrop = el("div", "news-reader__backdrop")
    document.body.appendChild(backdrop)

    const reader = el("aside", "news-reader")
    reader.setAttribute("role", "dialog")
    reader.setAttribute("aria-modal", "true")
    reader.setAttribute("aria-label", "Post")
    reader.hidden = true

    const readerClose = el("button", "panel-close news-reader__close")
    readerClose.type = "button"
    readerClose.setAttribute("aria-label", "Close")
    readerClose.textContent = "×"
    reader.appendChild(readerClose)

    const readerBody = el("div", "news-reader__body")
    reader.appendChild(readerBody)
    document.body.appendChild(reader)

    // Where focus goes back to when the panel closes, so a keyboard reader is
    // not dropped at the top of the document.
    let lastTrigger = null

    /* ── "Keep reading" ──
     * Three posts at the foot of the article, drawn at random from the rest
     * of the archive on every open — so reading three posts in a row offers
     * nine different ones. It is the Publications reader's "See also" in
     * shape, but deliberately **not** in the choosing: that one scores by
     * shared keywords, and a first version of this scored by category and
     * author. It made every Awards post point at three other Awards posts,
     * every essay at three essays — a closed loop that never took a reader
     * anywhere new, on an archive of 48 where the point of the row is to
     * show that there is more than the shelf they happened to land on.
     *
     * generate_pages.py draws a post's static page's three the same way, a
     * fresh three on every build. See related_posts there. */
    function shuffled(list) {
        const out = list.slice()
        for (let i = out.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[out[i], out[j]] = [out[j], out[i]]
        }
        return out
    }

    function relatedTo(post, count) {
        return shuffled(allPosts.filter((other) => other.slug !== post.slug)).slice(0, count)
    }

    /* A real anchor, not a button: the destination is a route the router
       already owns, so `hrefForRoute` gives back exactly the URL `writeRoute`
       would put in the address bar — and with it middle-click, "copy link
       address", and a link a crawler can follow. The press itself is still
       handled here, or the browser would reload the page to reach a panel. */
    function routeAnchor(route, onOpen) {
        const anchor = document.createElement("a")
        const href = hrefForRoute(route)
        if (href) anchor.href = href
        anchor.addEventListener("click", (event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            onOpen()
        })
        return anchor
    }

    function buildRelated(post) {
        const related = relatedTo(post, 3)
        if (!related.length) return null

        const section = el("section", "news-article__related")
        section.setAttribute("aria-label", "Keep reading")
        section.appendChild(el("h4", "news-article__related-h", "Keep reading"))
        const grid = el("div", "news-related")
        related.forEach((other) => {
            // The row that opened the reader stays the trigger, so closing after
            // hopping through three posts still puts focus back where the reader
            // came from rather than at the top of the document.
            const item = routeAnchor("post-" + other.slug, () => openPost(other, lastTrigger))
            item.className = "news-related__item"
            if (other.image) {
                const img = el("img", "news-related__img")
                img.src = other.image
                img.alt = ""
                img.loading = "lazy"
                item.appendChild(img)
            }
            const copy = el("span", "news-related__copy")
            const line = [other.category, other.date ? String(other.date).slice(0, 4) : ""].filter(Boolean).join(" · ")
            if (line) copy.appendChild(el("span", "news-related__meta", line))
            copy.appendChild(el("span", "news-related__title", other.title))
            item.appendChild(copy)
            grid.appendChild(item)
        })
        section.appendChild(grid)
        return section
    }

    function closeReader(write) {
        if (!reader.classList.contains("is-open")) return
        // Back to the index's own route, so the URL never names a post nobody
        // is reading — except when the close is itself part of applying a
        // route, where the caller is about to say what the URL should be.
        reader.dataset.post = ""
        if (write !== false) writeRoute("news")
        reader.classList.remove("is-open")
        backdrop.classList.remove("is-visible")
        // Out of the tab order only once it has finished sliding out; hiding it
        // on the spot would cut the transition.
        setTimeout(() => {
            if (!reader.classList.contains("is-open")) reader.hidden = true
        }, 380)
        if (lastTrigger) lastTrigger.focus({ preventScroll: true })
        lastTrigger = null
    }

    // Wrapped rather than passed straight in: closeReader's first argument is a
    // flag, and a listener would hand it the event object.
    readerClose.addEventListener("click", () => closeReader())
    backdrop.addEventListener("click", () => closeReader())
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeReader()
    })

    function openReader(post, prose) {
        readerBody.replaceChildren()

        const article = el("article", "news-article")

        if (post.image) {
            const hero = el("div", "news-article__hero")
            const img = el("img")
            img.src = post.image
            img.alt = ""
            hero.appendChild(img)
            article.appendChild(hero)
        }

        const header = el("header", "news-article__head")
        const meta = el("div", "news-article__meta")
        meta.appendChild(el("time", null, formatDate(post.date)))
        if (post.minutes) meta.appendChild(el("span", null, post.minutes + " min read"))
        header.appendChild(meta)

        header.appendChild(el("h3", "news-article__title", post.title))
        if (post.subtitle) header.appendChild(el("p", "news-article__subtitle", post.subtitle))
        // The category rides on the byline, beside the author's name, where a
        // reader deciding whether to read on is looking — it used to close the
        // article in a footer of its own, which told them what shelf a post was
        // on only once they had finished it.
        const byline = buildByline(post, "news-byline news-byline--article", true)
        if (post.category) byline.appendChild(el("span", "news-tag news-tag--article", post.category))
        header.appendChild(byline)
        article.appendChild(header)

        article.appendChild(prose)

        const related = buildRelated(post)
        if (related) article.appendChild(related)

        readerBody.appendChild(article)
        reader.setAttribute("aria-label", post.title)
        reader.hidden = false
        // The panel is fixed and scrolls itself; a reopened one would otherwise
        // start where the last post was left.
        reader.scrollTop = 0

        // The panel goes from `display: none` to displayed, so there is no
        // starting position for the transform to animate from until it has
        // been laid out once. Reading offsetWidth forces that synchronously —
        // rather than waiting a frame, which leaves the open at the mercy of
        // whether rAF is running at all.
        void reader.offsetWidth
        // The shareable part. The slug is the post's folder name, which is
        // already the id the manifest and every image path join on. Kept on the
        // element too, so a route naming the post already open is recognised
        // and left alone rather than re-entered under the reader.
        reader.dataset.post = post.slug || ""
        if (post.slug) writeRoute("post-" + post.slug)
        reader.classList.add("is-open")
        backdrop.classList.add("is-visible")
        readerClose.focus({ preventScroll: true })
    }

    const bodyCache = new Map()

    function openPost(post, trigger) {
        lastTrigger = trigger || null

        const cached = bodyCache.get(post.slug)
        if (cached) {
            openReader(post, renderContent(cached, post.base))
            return
        }

        fetch(post.file)
            .then((response) => {
                if (!response.ok) throw new Error(response.status + " " + response.statusText)
                return response.json()
            })
            .then((data) => {
                // Kept as written — a string or a list of them — so the cache
                // holds the post rather than one rendering of it.
                const content = data.content || ""
                bodyCache.set(post.slug, content)
                openReader(post, renderContent(content, post.base))
            })
            .catch((error) => {
                console.error("news: could not load " + post.file, error)
                const message = el("div", "news-prose")
                message.appendChild(el("p", null, "This post could not be loaded."))
                openReader(post, message)
            })
    }

    /* ── The index ──
     * One card per post, three across: the picture on top, then date, title,
     * summary, byline.
     *
     * It was a row until the Featured tab was folded into the filters —
     * thumbnail at a fixed 15rem on the left, everything else on the right,
     * with this card shape kept for the tab. The row is the better shape for a
     * list you are *scanning* and the grid for one you are *browsing*, and a
     * reader arriving at a lab's News section is browsing: they do not know
     * what is here. Scanning is what the search field and the chips above are
     * for, and they answer it better than forty rows ever did.
     *
     * ── Why there is no lead card ──
     * A big first card spanning the row is the obvious editorial move and it
     * would be a lie: the order is the date, so the first card is only the most
     * recent post, not the most important one. The same reason nothing on this
     * site reports the size of a filtered set or dresses an h-index up as an
     * achievement. Equal weight, because the data gives them equal weight.
     */
    function buildCard(post) {
        const card = el("button", "news-card")
        card.type = "button"
        card.addEventListener("click", () => openPost(post, card))

        if (post.image) {
            const media = el("div", "news-card__media")
            const img = el("img")
            img.src = post.image
            img.alt = ""
            img.loading = "lazy"
            media.appendChild(img)
            /* The category rides on the picture rather than sitting under the
               title, which keeps the body a clean run of date, title, summary,
               byline whatever the summary's length. */
            if (post.category) media.appendChild(el("span", "news-card__tag", post.category))
            card.appendChild(media)
        } else {
            card.classList.add("news-card--textonly")
        }

        const body = el("div", "news-card__body")

        const meta = el("div", "news-card__meta")
        meta.appendChild(el("time", "news-card__date", formatDate(post.date, true)))
        if (post.minutes) meta.appendChild(el("span", "news-card__read", post.minutes + " min read"))
        // With no picture there is nowhere for the badge to ride, so it joins
        // the meta line rather than being dropped.
        if (post.category && !post.image) meta.appendChild(el("span", "news-tag", post.category))
        body.appendChild(meta)

        body.appendChild(el("h3", "news-card__title", post.title))
        if (post.summary) body.appendChild(el("p", "news-card__summary", post.summary))

        /* The byline goes last and is pushed to the foot by the body's own
           1fr row, so it lines up across a row of cards whether or not their
           summaries wrap to the same number of lines. */
        body.appendChild(buildByline(post, "news-byline news-byline--card"))

        card.appendChild(body)
        return card
    }

    /* ── The filters and the pages ── */
    function buildArchive(posts, categories) {
        /* One category per post, out of a short closed list — the old site's
         * free tags put "Reality Bending Lab" and "Psychology" on everything,
         * which filters nothing. The chips stay multi-select and match on
         * **any**, so "Research or Thoughts" is one gesture; and there is no
         * "All" chip, because none selected already means all. The way back is
         * Clear, which is only up while something is on. */
        const selected = new Set()
        /* ── Featured ──
         * `featured: true` in a post.json, which used to be a tab of its own
         * and is now a chip at the head of the same row. It is a *different
         * axis* from the categories, so it narrows **with** them rather than
         * joining their any-of set: "Featured" and "Awards" together means the
         * featured Awards posts, not everything that is either. That is the
         * only reading that makes it worth having beside them — as one more
         * value in the any-of set it could never narrow anything, which is
         * exactly what the tab could not do either. */
        let featuredOnly = false
        let page = 0

        /* ── Search ──
         * The Publications section's field, in this section's colours: chips
         * for the terms already committed, whatever is half-typed in the box
         * counting as one more, and every term having to match. It narrows
         * *with* the category chips rather than replacing them — a category is
         * a shelf and a search is a question, and "Methods, about Bayes" is a
         * reasonable thing to ask for.
         *
         * It searches the manifest, which is metadata only: a post's body is
         * not fetched until the post is opened, so full-text search would mean
         * downloading the whole blog to filter a list of titles. Title,
         * subtitle, summary, category, year and authors are what there is.
         *
         * A term is `{ label, value }` — what the chip says and what it matches
         * on. The two differ for a name picked out of the suggestions: matching
         * is lowercase throughout, and a chip reading "zen j. lau" after
         * pressing *Zen J. Lau* looks like a bug.
         *
         * **A term matches word by word, not as one substring.** The titles
         * here are sentences — "Your sample is too small" — so a reader typing
         * what they remember of one ("sample too small") gets nothing at all
         * from a plain `includes`, which is a search box that looks broken. */
        const terms = []
        let typed = ""

        const wordsOf = (text) => text.toLowerCase().split(/\s+/).filter(Boolean)

        /* Built once. The manifest is the whole index and nothing in it changes
           under us, so this is a lookup rather than a re-join per keystroke. */
        const haystacks = new Map(
            posts.map((post) => [
                post,
                [post.title, post.subtitle, post.summary, post.category, (post.date || "").slice(0, 4), ...authorNames(post)]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase(),
            ])
        )

        /* Flat, because a term's words and the box's words are wanted on the
           same footing: every word of every term has to be somewhere in the
           post, and which term it came from makes no difference. */
        const activeWords = () => [...terms.flatMap((term) => term.words), ...wordsOf(typed)]

        function matching() {
            const wanted = activeWords()
            if (!selected.size && !featuredOnly && !wanted.length) return posts
            return posts.filter((post) => {
                if (featuredOnly && !post.featured) return false
                if (selected.size && !selected.has(post.category)) return false
                const haystack = haystacks.get(post) || ""
                return wanted.every((word) => haystack.includes(word))
            })
        }

        function render() {
            const shown = matching()
            const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
            if (page > pages - 1) page = pages - 1

            archiveList.replaceChildren()
            if (!shown.length) {
                // Naming whichever control emptied the list, so a reader knows
                // which one to undo. Featured and the categories are the same
                // row of chips to the eye, so they give the same message.
                archiveList.appendChild(
                    el("p", "news-empty", activeWords().length ? "No posts match your search." : "No posts match those filters.")
                )
            } else {
                shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).forEach((post) => archiveList.appendChild(buildCard(post)))
            }

            pager.render(page, pages)
        }

        pageTo = (next) => {
            page = next
            render()
            // Back to the top of the list, not the top of the page: the pager
            // sits under the rows, so paging from it otherwise leaves the
            // reader looking at the foot of the new page.
            scrollToSection()
        }

        /* ── The search field ──
           Chips and the input inside one rounded box, with a suggestion list
           hanging under it. Built here rather than in the assembly block below
           because everything it touches — the term list, the page number it
           resets, `render` — lives in this closure. */
        const field = el("div", "news-search__field")
        const chips = el("div", "news-search__chips")
        chips.hidden = true

        const input = el("input", "news-search__input")
        input.type = "search"
        input.id = "news-search"
        input.placeholder = "Filter by title, author, year…"
        input.setAttribute("aria-label", "Filter posts")
        field.append(chips, input)

        /* The suggestions are **authors**, not categories: a category already
           has a chip of its own on the row below, and offering it in two places
           is two controls for one filter. Authors are the other closed list the
           manifest carries, and "everything Zen wrote" is the question the
           category chips cannot answer. */
        const suggestions = [...new Set(posts.flatMap(authorNames))].sort((a, b) => a.localeCompare(b))

        const dropdown = el("ul", "news-search__dropdown")
        dropdown.hidden = true
        dropdown.setAttribute("role", "listbox")
        searchBar.append(field, dropdown)

        function renderDropdown() {
            const available = suggestions.filter((name) => {
                const lower = name.toLowerCase()
                // Word by word, like the filter itself — "j lau" should still
                // find Zen.
                return !terms.some((term) => term.value === lower) && wordsOf(typed).every((word) => lower.includes(word))
            })
            dropdown.replaceChildren()
            available.forEach((name) => {
                const option = el("li", "news-search__option", name)
                option.setAttribute("role", "option")
                /* mousedown, not click: the input's blur fires first and would
                   have hidden the list out from under the press. Preventing the
                   default also keeps focus in the box, so there is no blur. */
                option.addEventListener("mousedown", (event) => {
                    event.preventDefault()
                    addTerm(name)
                })
                dropdown.appendChild(option)
            })
            dropdown.hidden = !available.length
        }

        function renderChips() {
            chips.replaceChildren()
            terms.forEach((term, index) => {
                const chip = el("span", "news-search__chip", term.label)
                const remove = el("button", "news-search__chip-remove", "×")
                remove.type = "button"
                remove.setAttribute("aria-label", "Remove filter: " + term.label)
                remove.addEventListener("click", () => {
                    terms.splice(index, 1)
                    renderChips()
                    renderDropdown()
                    page = 0
                    render()
                    input.focus()
                })
                chip.appendChild(remove)
                chips.appendChild(chip)
            })
            chips.hidden = !terms.length
        }

        function addTerm(label) {
            const value = label.trim().toLowerCase()
            if (!value || terms.some((term) => term.value === value)) return
            terms.push({ label: label.trim(), value, words: wordsOf(value) })
            input.value = ""
            typed = ""
            renderChips()
            renderDropdown()
            page = 0
            render()
            input.focus()
        }

        /* Applies whatever is in the box. One path, so the debounce and the
           blur cannot disagree about what the box currently means. */
        function applyTyped() {
            const next = input.value.trim().toLowerCase()
            if (next === typed) return
            typed = next
            page = 0
            render()
        }

        let searchTimer = 0
        input.addEventListener("input", () => {
            window.clearTimeout(searchTimer)
            searchTimer = window.setTimeout(() => {
                applyTyped()
                renderDropdown()
            }, SEARCH_DEBOUNCE_MS)
        })
        input.addEventListener("focus", renderDropdown)
        input.addEventListener("blur", () => {
            /* Flushed rather than dropped: typing a word and then clicking away
               otherwise loses the last keystrokes' worth of filtering. The
               dropdown goes after its own mousedown has had its turn. */
            window.clearTimeout(searchTimer)
            applyTyped()
            window.setTimeout(() => {
                dropdown.hidden = true
            }, 160)
        })
        input.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                dropdown.hidden = true
                input.blur()
            } else if (event.key === "Enter") {
                /* Enter commits what is typed as a chip, so the next word is a
                   second term rather than a longer first one. */
                event.preventDefault()
                window.clearTimeout(searchTimer)
                addTerm(input.value)
            } else if (event.key === "Backspace" && input.value === "" && terms.length) {
                // The whole chip, not a character of it — it is one token.
                terms.pop()
                renderChips()
                renderDropdown()
                page = 0
                render()
            }
        })

        const featuredCount = posts.filter((post) => post.featured).length

        /* One row of chips: Featured first, then the categories, then Clear.
           `role="group"` and not a name mentioning categories any more — the
           row now filters on two different axes. */
        const filter = el("div", "news-filter")
        filter.setAttribute("role", "group")
        filter.setAttribute("aria-label", "Filter posts")

        /* Built here rather than in the loop below, and given a modifier of its
           own — but the modifier is a hook for the route to find it by, not a
           different look. It is dressed exactly like a category chip, star
           included: the star inherits the chip's colour rather than taking the
           section accent, because the accent is what the *pressed* state uses
           and an off chip wearing it announces a filter nobody applied. */
        let featuredBtn = null
        if (featuredCount) {
            featuredBtn = el("button", "news-filter__btn news-filter__btn--featured")
            featuredBtn.type = "button"
            featuredBtn.setAttribute("aria-pressed", "false")
            featuredBtn.appendChild(el("span", "news-filter__star", "★"))
            featuredBtn.appendChild(el("span", null, "Featured"))
            featuredBtn.appendChild(el("span", "news-filter__count", String(featuredCount)))
            featuredBtn.addEventListener("click", () => {
                setFeatured(!featuredOnly)
                page = 0
                render()
            })
            filter.appendChild(featuredBtn)
        }

        categories.forEach((entry) => {
            const name = typeof entry === "string" ? entry : entry.name
            if (!name) return
            const button = el("button", "news-filter__btn")
            button.type = "button"
            button.dataset.category = name
            button.setAttribute("aria-pressed", "false")
            button.appendChild(el("span", null, name))
            if (entry.count) button.appendChild(el("span", "news-filter__count", String(entry.count)))

            button.addEventListener("click", () => {
                if (selected.has(name)) selected.delete(name)
                else selected.add(name)
                button.classList.toggle("news-filter__btn--on", selected.has(name))
                button.setAttribute("aria-pressed", selected.has(name) ? "true" : "false")
                syncClear()
                page = 0
                render()
            })
            filter.appendChild(button)
        })

        const clear = el("button", "news-filter__clear", "Clear")
        clear.type = "button"
        clear.hidden = true
        clear.addEventListener("click", () => {
            selected.clear()
            setFeatured(false)
            filter.querySelectorAll(".news-filter__btn--on").forEach((button) => {
                button.classList.remove("news-filter__btn--on")
                button.setAttribute("aria-pressed", "false")
            })
            page = 0
            render()
        })
        filter.appendChild(clear)

        // There is no "All" chip — none pressed already means all, and the way
        // back is Clear, which is only up while something is on.
        function syncClear() {
            clear.hidden = !selected.size && !featuredOnly
        }

        /* Set rather than toggled, because the route applies it too: landing on
           the old `/news/featured/` turns the chip on instead of 404ing, and
           that path must leave the button saying the same thing a press would
           have. */
        function setFeatured(on) {
            featuredOnly = Boolean(on) && Boolean(featuredCount)
            if (featuredBtn) {
                featuredBtn.classList.toggle("news-filter__btn--on", featuredOnly)
                featuredBtn.setAttribute("aria-pressed", featuredOnly ? "true" : "false")
            }
            syncClear()
        }

        if (featuredBtn || filter.querySelector(".news-filter__btn")) filters.appendChild(filter)

        return {
            render,
            /* What the two surviving tab routes land on. Set, not toggled, and
               in both directions: `/news/all/` means the unfiltered index, so
               it has to be able to take the chip *off* as well. */
            applyTabRoute(featured) {
                if (featuredOnly === Boolean(featured)) return
                setFeatured(featured)
                page = 0
                render()
            },
        }
    }

    function buildIndex(manifest) {
        allPosts = Array.isArray(manifest.posts) ? manifest.posts.filter((post) => post && post.title) : []
        if (!allPosts.length) {
            archiveList.appendChild(el("p", "news-empty", "No posts yet."))
            return
        }

        const archive = buildArchive(allPosts, Array.isArray(manifest.categories) ? manifest.categories : [])
        archive.render()

        /* ── The URL ──
           `#post-<slug>` opens a post in the reader; the section itself is
           `news`. Here rather than at startup: the manifest is what turns a
           slug into a post, and this runs inside its `.then`. Idempotent — the
           reader can paste the same link twice, and a route naming the post
           already open must not re-fetch and re-enter it. */
        function applyRoute(route) {
            const slug = matchRoute(route, "post")
            if (slug) {
                const post = allPosts.find((entry) => entry.slug === slug)
                if (!post) return false
                revealSection("sec-news-full")
                if (reader.dataset.post !== slug || !reader.classList.contains("is-open")) openPost(post, null)
                return true
            }

            /* Anything that is not a post is a route to somewhere else on the
               page, and the reader covers all of it — so it goes, whether or
               not the destination is this section. Silent when nothing was
               open, which is the usual case. */
            closeReader(false)

            /* ── The two tab routes that outlived the tabs ──
               `news-all` and `news-featured` were written by the tab bar and
               are indexed, linked and bookmarked; nothing writes them now, but
               they still have to *land*. `/news/all/` is the index, and
               `/news/featured/` is the index with the Featured chip on — which
               is the same set of posts the tab used to show, so an old link
               still means what it meant. Both pages canonicalise to `/news/`
               (generate_pages.py, CANONICAL_ALIASES).

               Read only, in both directions: they stay in RESERVED in
               shared/routes.js so that no post folder called `all` or
               `featured` could ever take the path off them. */
            const tab = matchRoute(route, "news")
            if (tab === null) return false
            if (tab !== "" && tab !== "all" && tab !== "featured") return false
            revealSection("sec-news-full")
            // Bare `news` is the section itself and says nothing about the
            // chips — it is what closing the reader writes, and a reader who
            // had filtered before opening a post gets their filter back.
            if (tab) archive.applyTabRoute(tab === "featured")
            return true
        }

        onRoute(applyRoute)

        /* The tab label for an open post. Registered here rather than at
           startup for the same reason applyRoute is: a slug is only a title
           once the manifest has landed. */
        registerRouteTitle((route) => {
            const slug = matchRoute(route, "post")
            if (!slug) return null
            const post = allPosts.find((entry) => entry.slug === slug)
            return post ? post.title : null
        })

        /* Only re-land if this section actually owned the route. `landOnLoad`
           fires unconditionally once armed, so arming it in every section meant
           four of them scrolling to themselves at `load` and the last one
           winning — which is how a member link ended up 3,090px into News. */
        if (applyRoute(INITIAL_ROUTE)) landOnLoad("sec-news-full")
    }

    /* ── Assembly ── */

    const shell = el("div", "news-shell")

    const head = el("div", "news-head")
    head.appendChild(el("h2", "news-full__title", "News"))
    shell.appendChild(head)

    /* Two rows, not one box: the search field spans the column and the chips
       wrap under it. buildArchive fills both. */
    const searchBar = el("div", "news-search")
    const filters = el("div", "news-filters")
    const archiveList = el("div", "news-list")
    // Assigned by buildArchive, which is where the page number lives. The pager
    // is built out here because the shell it sits in is assembled here.
    let pageTo = () => {}
    const pager = createPager({ onChange: (page) => pageTo(page), ariaLabel: "News pages" })
    shell.append(searchBar, filters, archiveList, pager.el)

    root.replaceChildren(shell)

    fetch(MANIFEST_URL)
        .then((response) => {
            if (!response.ok) throw new Error(response.status + " " + response.statusText)
            return response.json()
        })
        .then(buildIndex)
        .catch((error) => {
            console.error("news: could not load " + MANIFEST_URL, error)
            // Where the posts would have been, which is what the reader is
            // looking at.
            archiveList.appendChild(el("p", "news-empty", "News could not be loaded."))
        })
})()
