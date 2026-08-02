import { initMarginTabNav, swapTabPanels } from "../shared/tab-slide.js"
import { openProfileByFolder } from "../shared/profile-api.js"
import { createPager } from "../shared/pager.js"
import { INITIAL_ROUTE, landOnLoad, matchRoute, onRoute, revealSection, writeRoute } from "../shared/deep-link.js"
import { registerRouteTitle } from "../shared/page-meta.js"
import { element as el } from "../shared/dom.js"

/* news.js
 * The News section: two tabs over an index of posts — Featured, a short
 * curated list, and All posts, the browsable archive with category filters and
 * a pager — plus a reader that slides in over the page for one of them.
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
    const PAGE_SIZE = 4

    // Every post in the manifest, for the reader's "another post" button —
    // which suggests across the whole archive, not just the tab in view.
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

    const readerClose = el("button", "news-reader__close")
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

    /* ── "Another post" ──
     * The People section's discover button, squared off: a tile at the foot of
     * the reader offering a post picked at random from the rest of the
     * archive. Like that one it lives on <body> rather than inside the panel —
     * the panel is the thing that scrolls, so a button inside it would either
     * scroll away or need a sticky footer over the prose.
     *
     * Rebuilt on every open, which is what re-rolls the suggestion: reading
     * three posts in a row offers three different ones. */
    const another = el("button", "news-another")
    another.type = "button"
    another.hidden = true
    document.body.appendChild(another)

    let anotherPost = null
    // Keeps the row that opened the reader in the first place, so closing after
    // hopping through three posts still puts focus back where the reader came
    // from rather than at the top of the document.
    another.addEventListener("click", () => {
        if (anotherPost) openPost(anotherPost, lastTrigger)
    })

    function offerAnother(current) {
        const others = allPosts.filter((post) => post.slug !== current.slug)
        anotherPost = others.length ? others[Math.floor(Math.random() * others.length)] : null

        another.replaceChildren()
        another.hidden = !anotherPost
        if (!anotherPost) return

        if (anotherPost.image) {
            const img = el("img", "news-another__img")
            img.src = anotherPost.image
            img.alt = ""
            another.appendChild(img)
        }

        const copy = el("span", "news-another__copy")
        copy.appendChild(el("span", "news-another__label", anotherPost.category ? "More " + anotherPost.category : "Read next"))
        copy.appendChild(el("span", "news-another__title", anotherPost.title))
        another.appendChild(copy)

        another.setAttribute("aria-label", "Read another post: " + anotherPost.title)
        another.title = anotherPost.title
    }

    function closeReader(write) {
        if (!reader.classList.contains("is-open")) return
        // Back to the index's own route, so the URL never names a post nobody
        // is reading — except when the close is itself part of applying a
        // route, where the caller is about to say what the URL should be.
        reader.dataset.post = ""
        if (write !== false) writeRoute("news-" + activeTab)
        reader.classList.remove("is-open")
        backdrop.classList.remove("is-visible")
        another.hidden = true
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
        header.appendChild(buildByline(post, "news-byline news-byline--article", true))
        article.appendChild(header)

        article.appendChild(prose)

        if (post.category) {
            const foot = el("footer", "news-article__foot")
            foot.appendChild(el("span", "news-tag", post.category))
            article.appendChild(foot)
        }

        readerBody.appendChild(article)
        reader.setAttribute("aria-label", post.title)
        reader.hidden = false
        // The panel is fixed and scrolls itself; a reopened one would otherwise
        // start where the last post was left.
        reader.scrollTop = 0
        offerAnother(post)

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

    /* ── The index ── */

    function buildRow(post) {
        const row = el("button", "news-card")
        row.type = "button"
        row.addEventListener("click", () => openPost(post, row))

        if (post.image) {
            const figure = el("div", "news-card__thumb")
            const img = el("img")
            img.src = post.image
            img.alt = ""
            img.loading = "lazy"
            figure.appendChild(img)
            row.appendChild(figure)
        } else {
            row.classList.add("news-card--textonly")
        }

        const body = el("div", "news-card__body")

        const meta = el("div", "news-card__meta")
        meta.appendChild(el("time", "news-card__date", formatDate(post.date, true)))
        if (post.minutes) meta.appendChild(el("span", "news-card__read", post.minutes + " min read"))
        body.appendChild(meta)

        body.appendChild(el("h3", "news-card__title", post.title))
        if (post.summary) body.appendChild(el("p", "news-card__summary", post.summary))

        const foot = el("div", "news-card__foot")
        foot.appendChild(buildByline(post, "news-byline news-byline--card"))
        if (post.category) foot.appendChild(el("span", "news-tag", post.category))
        body.appendChild(foot)

        row.appendChild(body)
        return row
    }

    /* ── Featured ──
     * The front door: a short curated list, no filter and no pager, because
     * neither has anything to do on a handful of posts a human chose.
     * `featured: true` in a post.json is the whole mechanism.
     *
     * ── Why these are cards and the archive is rows ──
     * The archive's row is the right shape for a list you are *scanning*:
     * thumbnail at a fixed 15rem, the summary doing the work, forty entries
     * reading down the page. This is a shortlist you are *browsing*, six or so
     * of them, and the picture is the reason to press. So the picture becomes
     * the top of the card and the cards run two across — which is also what
     * separates the two tabs at a glance, rather than making a reader read the
     * tab bar to know which one they are on.
     *
     * ── And why there is no lead card ──
     * A big first card spanning both columns is the obvious editorial move and
     * it would be a lie here: `featured` is a flag with no ordering, so the
     * first card is only the most recently flagged post, not the most
     * important one. The same reason nothing on this site reports the size of
     * a filtered set or dresses an h-index up as an achievement. Equal weight,
     * because the data gives them equal weight.
     */
    function buildFeatureCard(post) {
        const card = el("button", "news-feature")
        card.type = "button"
        card.addEventListener("click", () => openPost(post, card))

        if (post.image) {
            const media = el("div", "news-feature__media")
            const img = el("img")
            img.src = post.image
            img.alt = ""
            img.loading = "lazy"
            media.appendChild(img)
            /* The category rides on the picture rather than sitting under the
               title, which is what marks these as picked rather than listed —
               and it keeps the body a clean run of date, title, summary,
               byline whatever the summary's length. */
            if (post.category) media.appendChild(el("span", "news-feature__tag", post.category))
            card.appendChild(media)
        } else {
            card.classList.add("news-feature--textonly")
        }

        const body = el("div", "news-feature__body")

        const meta = el("div", "news-feature__meta")
        meta.appendChild(el("time", "news-feature__date", formatDate(post.date, true)))
        if (post.minutes) meta.appendChild(el("span", "news-feature__read", post.minutes + " min read"))
        // With no picture there is nowhere for the badge to ride, so it joins
        // the meta line rather than being dropped.
        if (post.category && !post.image) meta.appendChild(el("span", "news-tag", post.category))
        body.appendChild(meta)

        body.appendChild(el("h3", "news-feature__title", post.title))
        if (post.summary) body.appendChild(el("p", "news-feature__summary", post.summary))

        /* The byline goes last and is pushed to the foot by the body's own
           1fr row, so it lines up across a pair whether or not the two
           summaries wrap to the same number of lines. */
        body.appendChild(buildByline(post, "news-byline news-byline--card"))

        card.appendChild(body)
        return card
    }

    function buildFeatured(posts) {
        const featured = posts.filter((post) => post.featured)
        featuredList.replaceChildren()
        if (!featured.length) {
            featuredList.appendChild(el("p", "news-empty", "Nothing featured yet."))
            return
        }
        featured.forEach((post) => featuredList.appendChild(buildFeatureCard(post)))
    }

    /* ── All posts: categories and pages ── */
    function buildArchive(posts, categories) {
        /* One category per post, out of a short closed list — the old site's
         * free tags put "Reality Bending Lab" and "Psychology" on everything,
         * which filters nothing. The chips stay multi-select and match on
         * **any**, so "Research or Thoughts" is one gesture; and there is no
         * "All" chip, because none selected already means all. The way back is
         * Clear, which is only up while something is on. */
        const selected = new Set()
        let page = 0

        function matching() {
            if (!selected.size) return posts
            return posts.filter((post) => selected.has(post.category))
        }

        function render() {
            const shown = matching()
            const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE))
            if (page > pages - 1) page = pages - 1

            archiveList.replaceChildren()
            if (!shown.length) {
                archiveList.appendChild(el("p", "news-empty", "No posts in those categories."))
            } else {
                shown.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).forEach((post) => archiveList.appendChild(buildRow(post)))
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

        if (categories.length) {
            const filter = el("div", "news-filter")
            filter.setAttribute("role", "group")
            filter.setAttribute("aria-label", "Filter posts by category")

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
                    clear.hidden = selected.size === 0
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
                filter.querySelectorAll(".news-filter__btn--on").forEach((button) => {
                    button.classList.remove("news-filter__btn--on")
                    button.setAttribute("aria-pressed", "false")
                })
                clear.hidden = true
                page = 0
                render()
            })
            filter.appendChild(clear)
            filters.appendChild(filter)
        }

        return { render }
    }

    function buildIndex(manifest) {
        allPosts = Array.isArray(manifest.posts) ? manifest.posts.filter((post) => post && post.title) : []
        if (!allPosts.length) {
            archiveList.appendChild(el("p", "news-empty", "No posts yet."))
            return
        }

        buildFeatured(allPosts)
        buildArchive(allPosts, Array.isArray(manifest.categories) ? manifest.categories : []).render()

        /* Two tabs over the same shell, the same machinery every other tab
           group on this page uses — swapTabPanels for the slide, and the empty
           side margins as prev/next zones. */
        tabs.forEach((tab) => {
            tab.button.addEventListener("click", () => activateTab(tab.id))
        })

        /* ── The URL ──
           `#post-<slug>` opens a post in the reader, `#news-<tab>` picks a tab.
           Here rather than at startup: the manifest is what turns a slug into a
           post, and this runs inside its `.then`. Idempotent — the reader can
           paste the same link twice, and a route naming the post already open
           must not re-fetch and re-enter it. */
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

            const tab = matchRoute(route, "news")
            if (tab === null || !tabs.some((entry) => entry.id === tab)) return false
            revealSection("sec-news-full")
            activateTab(tab, false)
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

        /* The section, not the shell. The zones are as wide as the strip
           between their host and the centred content column
           (`(100% - --content-inline-size) / 2`), and the shell *is* that
           column — so hosted there they came out 32px wide against the other
           sections' 113px, which is a target nobody could find and the reason
           this section looked like it had no arrows at all. */
        initMarginTabNav(document.getElementById("sec-news-full"), ".news-tab-btn")
    }

    /* ── Assembly ── */

    const shell = el("div", "news-shell")

    const head = el("div", "news-head")
    head.appendChild(el("h2", "news-full__title", "News"))
    shell.appendChild(head)

    const nav = el("div", "news-tabs-nav")
    nav.setAttribute("role", "tablist")
    nav.setAttribute("aria-label", "News views")
    shell.appendChild(nav)

    const panelHost = el("div", "news-panels")
    shell.appendChild(panelHost)

    /* All posts first, and so the default: the archive is what a reader coming
       to a News section is looking for, and Featured is a shortcut into it
       rather than a front door of its own. */
    const tabs = [
        { id: "all", label: "All posts" },
        { id: "featured", label: "Featured" },
    ].map((tab, index) => {
        const button = el("button", "news-tab-btn" + (index === 0 ? " news-tab-btn--active" : ""), tab.label)
        button.type = "button"
        button.setAttribute("role", "tab")
        button.setAttribute("aria-selected", index === 0 ? "true" : "false")
        button.setAttribute("aria-controls", "news-panel-" + tab.id)
        nav.appendChild(button)

        const panel = el("div", "news-panel")
        panel.id = "news-panel-" + tab.id
        panel.setAttribute("role", "tabpanel")
        panel.hidden = index !== 0
        panelHost.appendChild(panel)

        return { ...tab, button, panel }
    })

    // By id rather than by index: the two panels are filled with different
    // things and the tab order is a presentation decision, so reordering the
    // list above must not silently swap what goes in them.
    const panelFor = (id) => tabs.find((tab) => tab.id === id).panel

    /* Which tab the URL goes back to when the reader is closed — a post is read
       over whichever index the visitor was on. */
    let activeTab = tabs[0].id

    /* `write` is false when the switch came out of the URL in the first place;
       writing then would be this section claiming a hash it was only reading. */
    function activateTab(id, write) {
        activeTab = id
        tabs.forEach((other) => {
            const isActive = other.id === id
            other.button.classList.toggle("news-tab-btn--active", isActive)
            other.button.setAttribute("aria-selected", isActive ? "true" : "false")
        })
        swapTabPanels(
            tabs.map((other) => other.panel),
            "news-panel-" + id
        )
        if (write !== false) writeRoute("news-" + id)
    }

    // Its own class, not `news-list`: the two tabs lay their posts out
    // differently on purpose — see buildFeatureCard.
    const featuredList = el("div", "news-features")
    panelFor("featured").appendChild(featuredList)

    const filters = el("div", "news-filters")
    const archiveList = el("div", "news-list")
    // Assigned by buildArchive, which is where the page number lives. The pager
    // is built out here because the panel it sits in is assembled here.
    let pageTo = () => {}
    const pager = createPager({ onChange: (page) => pageTo(page), ariaLabel: "News pages" })
    panelFor("all").append(filters, archiveList, pager.el)

    root.replaceChildren(shell)

    fetch(MANIFEST_URL)
        .then((response) => {
            if (!response.ok) throw new Error(response.status + " " + response.statusText)
            return response.json()
        })
        .then(buildIndex)
        .catch((error) => {
            console.error("news: could not load " + MANIFEST_URL, error)
            // The panel the reader is looking at, which is the archive now that
            // All posts is the default tab.
            archiveList.appendChild(el("p", "news-empty", "News could not be loaded."))
        })
})()
