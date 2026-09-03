/* publications.js
 * Renders the Publications section from publications/publications_manifest.json.
 */
import { initMarginTabNav, swapTabPanels } from "../shared/tab-slide.js"
import { createPager } from "../shared/pager.js"
import { INITIAL_ROUTE, hrefForRoute, landOnLoad, matchRoute, onRoute, revealSection, writeRoute } from "../shared/deep-link.js"
import { element as el } from "../shared/dom.js"
import { openImageLightbox } from "../shared/media-lightbox.js"
import { registerRouteTitle } from "../shared/page-meta.js"
;(function () {
    const PAGE_SIZE = 5

    /* ── The Scholar figures ──
     * Hand-kept, because there is no API for them and scraping a Scholar
     * profile from the browser is blocked at the other end. Update them when
     * they move; nothing here will notice that they have.
     *
     * `publications: null` means "use the manifest's own length" — the honest
     * fallback while nobody has written the real Scholar count down. Set it to
     * a number once someone has.
     */
    const SCHOLAR = {
        url: "https://scholar.google.com/citations?user=bg0BZ-QAAAAJ",
        hIndex: 28,
        citations: 20510,
        publications: null,
    }
    const SEARCH_INPUT_DEBOUNCE_MS = 120
    const ALTMETRIC_SCRIPT_SRC = "https://d1bxh8uas1mnw7.cloudfront.net/assets/embed.js"
    const DIMENSIONS_SCRIPT_SRC = "https://badge.dimensions.ai/badge.js"
    let metricBadgeScriptsPromise = null

    function loadScriptOnce(src) {
        const existing = Array.from(document.scripts).find((script) => script.src === src)
        if (existing) {
            if (existing.dataset.ready === "true") {
                return Promise.resolve(existing)
            }

            return new Promise((resolve, reject) => {
                existing.addEventListener(
                    "load",
                    () => {
                        existing.dataset.ready = "true"
                        resolve(existing)
                    },
                    { once: true },
                )
                existing.addEventListener("error", () => reject(new Error("Could not load " + src)), { once: true })
            })
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement("script")
            script.src = src
            script.async = true
            script.addEventListener(
                "load",
                () => {
                    script.dataset.ready = "true"
                    resolve(script)
                },
                { once: true },
            )
            script.addEventListener("error", () => reject(new Error("Could not load " + src)), { once: true })
            document.body.appendChild(script)
        })
    }

    /* ── Arming a page's badges ──
     * The placeholders are built with a neutral class (see the card builder);
     * this is what gives them the names the two vendors' scripts scan for, and
     * it is called with the cards the pager has just put on screen.
     *
     * The class is the switch and not a `data-` attribute, because the class is
     * what both scripts select on — so an unarmed badge is invisible to them by
     * construction rather than by our remembering to filter something.
     *
     * `armed` is what keeps this idempotent: `renderView` runs on every filter,
     * every sort and every page turn, and a card that has already been armed
     * has already been *populated*, so re-arming it would ask both vendors for
     * a number they have already drawn. Returns whether anything changed, so
     * the caller can skip the refresh when nothing did.
     */
    const BADGE_CLASSES = { altmetric: "altmetric-embed", dimensions: "__dimensions_badge_embed__" }

    function armMetricBadges(cards) {
        let armed = 0
        cards.forEach((card) => {
            card.querySelectorAll("[data-metric-badge]").forEach((slot) => {
                const name = BADGE_CLASSES[slot.dataset.metricBadge]
                if (!name || slot.classList.contains(name)) return
                slot.classList.add(name)
                armed += 1
            })
        })
        return armed > 0
    }

    function refreshOfficialMetricBadges() {
        if (typeof window._altmetric_embed_init === "function") {
            window._altmetric_embed_init()
        }

        if (window.__dimensions_embed?.addBadges) {
            window.__dimensions_embed.addBadges()
        }
    }

    function ensureOfficialMetricBadgeScripts() {
        if (!document.querySelector(".altmetric-embed, .__dimensions_badge_embed__")) {
            return Promise.resolve()
        }

        /* Loading only. The refresh belongs to the caller's `.then` below and
           used to be here as well, which meant the first call scanned and
           populated everything twice — and both vendors answer a second scan
           with a second round of API calls, measured at three per DOI where one
           was due. */
        if (!metricBadgeScriptsPromise) {
            metricBadgeScriptsPromise = Promise.all([loadScriptOnce(ALTMETRIC_SCRIPT_SRC), loadScriptOnce(DIMENSIONS_SCRIPT_SRC)])
        }

        return metricBadgeScriptsPromise.then(() => {
            refreshOfficialMetricBadges()
        })
    }

    function scheduleOfficialMetricBadges() {
        ensureOfficialMetricBadgeScripts().catch((error) => {
            console.warn("publications.js: official badge scripts failed to load", error)
        })
    }

    /* ── The Scholar button ──
     * "View on Google Scholar" says nothing a reader could not have guessed
     * from the icon. This cycles the lab's bibliometrics instead, and then
     * undercuts them — the joke is the point: an h-index is a number people
     * are trained to be impressed by and which means very little on its own,
     * and saying so is more honest than displaying it straight.
     *
     * Built over the anchor that is already in index.html rather than
     * replacing it, so the href, the target and the rel survive untouched and
     * the no-JS fallback is the plain link.
     *
     * The states are **stacked in one grid cell**, not swapped in and out: the
     * button then sizes itself to the widest and the tallest of them once, and
     * a header that is a fixed size cannot shove the tab bar down every four
     * seconds. Same reason the zoom's ask line reserves two lines' height.
     */
    /* Brisk on purpose: the whole sequence is five states, and at a leisurely
       pace a reader glancing at the header never reaches the punchline. */
    const SCHOLAR_ROTATE_MS = 1200

    function buildScholarMetrics(listedCount) {
        const link = document.querySelector(".pub-scholar")
        const label = link?.querySelector(".pub-scholar__label")
        if (!link || !label) return

        const count = SCHOLAR.publications ?? listedCount
        const states = [
            { figure: SCHOLAR.hIndex.toLocaleString("en-GB"), caption: "h-index" },
            { figure: SCHOLAR.citations.toLocaleString("en-GB"), caption: "citations" },
            { figure: count.toLocaleString("en-GB"), caption: "publications" },
            { line: "What does it mean?" },
            { line: "Nothing, but check out our Google Scholar profile →" },
        ]

        const stack = document.createElement("span")
        stack.className = "pub-scholar__states"

        const nodes = states.map((state, index) => {
            const node = document.createElement("span")
            node.className = "pub-scholar__state" + (index === 0 ? " is-on" : "")
            if (state.line) {
                node.classList.add("pub-scholar__state--aside")
                node.textContent = state.line
            } else {
                const figure = document.createElement("b")
                figure.className = "pub-scholar__figure"
                figure.textContent = state.figure
                node.append(figure, document.createTextNode(" "))
                const caption = document.createElement("span")
                caption.className = "pub-scholar__caption"
                caption.textContent = state.caption
                node.appendChild(caption)
            }
            stack.appendChild(node)
            return node
        })

        // Screen readers get the whole set as one label rather than whichever
        // frame happened to be up; the stack itself is decoration on a link
        // whose destination has not changed.
        stack.setAttribute("aria-hidden", "true")
        link.setAttribute(
            "aria-label",
            "Google Scholar profile: h-index " + SCHOLAR.hIndex + ", " + SCHOLAR.citations + " citations, " + count + " publications",
        )

        label.replaceWith(stack)

        // Under reduced motion the rotation is the whole effect, so there is
        // nothing to fall back to but the numbers standing still. The first
        // state stays up and the punchline is dropped — a joke that never
        // arrives is worse than no joke.
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            nodes.forEach((node, index) => node.classList.toggle("is-on", index === 0))
            link.classList.add("pub-scholar--still")
            return
        }

        let index = 0
        let timer = 0

        function tick() {
            nodes[index].classList.remove("is-on")
            index = (index + 1) % nodes.length
            nodes[index].classList.add("is-on")
        }

        function start() {
            if (!timer) timer = window.setInterval(tick, SCHOLAR_ROTATE_MS)
        }
        function stop() {
            window.clearInterval(timer)
            timer = 0
        }

        /* Rotating only while the section is on screen: a timer that runs for
           the whole visit to repaint a button nobody is looking at is the kind
           of thing that shows up on a phone's battery and never in a
           screenshot.

           It **starts first and lets the observer stop it**, rather than
           waiting to be started. An IntersectionObserver that never fires is a
           real case — a headless or non-compositing pane is one — and the
           failure modes are not equal: rotating off-screen costs a timer
           nobody sees, while waiting for a callback that does not come leaves
           a button frozen on its first frame, which looks like the feature is
           broken. `root` is #main-page, not the viewport: that is the scroll
           container here, and an observer against the window sees nothing
           move. */
        start()

        const mainPage = document.getElementById("main-page")
        const section = document.getElementById("sec-publications-full")
        if (section && mainPage && "IntersectionObserver" in window) {
            new IntersectionObserver(
                (entries) => {
                    entries.forEach((entry) => (entry.isIntersecting ? start() : stop()))
                },
                { root: mainPage },
            ).observe(section)
        }
    }

    fetch("publications/publications_manifest.json")
        .then((r) => r.json())
        .then((manifest) => {
            const container = document.getElementById("publications-list")
            if (!container) return

            const pubs = manifest.publications || []
            if (!pubs.length) {
                container.textContent = "No publications found."
                return
            }

            // Placeholder â€” will be replaced once search is wired up
            let addTerm = () => {}
            // ── Cite modal ──────────────────────────────────────────────────
            function _apaCite(pub) {
                const authors = pub.authors || "Unknown"
                const year = pub.year ? `(${pub.year})` : "(n.d.)"
                const journal = pub.journal ? ` ${pub.journal}.` : ""
                const doi = pub.doi ? ` https://doi.org/${pub.doi}` : ""
                return `${authors} ${year}. ${pub.title}.${journal}${doi}`
            }

            function _bibtexCite(pub) {
                const firstAuthor = (pub.authors || "").split(",")[0].trim().replace(/\s+/g, "")
                const key = (firstAuthor || "Unknown") + (pub.year || "")
                const lines = [`@article{${key},`]
                if (pub.title) lines.push(`  title   = {${pub.title}},`)
                if (pub.authors) lines.push(`  author  = {${pub.authors}},`)
                if (pub.journal) lines.push(`  journal = {${pub.journal}},`)
                if (pub.year) lines.push(`  year    = {${pub.year}},`)
                if (pub.doi) lines.push(`  doi     = {${pub.doi}},`)
                lines.push("}")
                return lines.join("\n")
            }

            const citeModal = document.createElement("div")
            citeModal.className = "pub-cite-modal"
            citeModal.setAttribute("role", "dialog")
            citeModal.setAttribute("aria-modal", "true")
            citeModal.setAttribute("aria-label", "Cite publication")
            citeModal.hidden = true
            citeModal.innerHTML = `
                <div class="pub-cite-backdrop"></div>
                <div class="pub-cite-dialog">
                    <div class="pub-cite-header">
                        <div class="pub-cite-tabs" role="tablist">
                            <button class="pub-cite-tab pub-cite-tab--active" data-fmt="apa">APA</button>
                            <button class="pub-cite-tab" data-fmt="bibtex">BibTeX</button>
                        </div>
                        <button class="pub-cite-close" aria-label="Close">&#xD7;</button>
                    </div>
                    <pre class="pub-cite-content"></pre>
                    <button class="pub-cite-copy">Copy</button>
                </div>`
            document.body.appendChild(citeModal)

            let _currentCitePub = null
            let _currentFmt = "apa"

            function _renderCiteContent() {
                citeModal.querySelector(".pub-cite-content").textContent =
                    _currentFmt === "bibtex" ? _bibtexCite(_currentCitePub) : _apaCite(_currentCitePub)
            }

            citeModal.querySelector(".pub-cite-backdrop").addEventListener("click", () => {
                citeModal.hidden = true
            })
            citeModal.querySelector(".pub-cite-close").addEventListener("click", () => {
                citeModal.hidden = true
            })
            /* One Escape handler for both layers, innermost first: the cite
               modal sits over the publication panel (z-index 1000 against 200),
               so a single press that closed both would take the reader two
               steps back for one keystroke. */
            document.addEventListener("keydown", (e) => {
                if (e.key !== "Escape") return
                /* The image viewer is a third layer above both of these, and it
                   claims Escape from the capture phase and marks the event —
                   see shared/media-lightbox.js. Bailing on `defaultPrevented`
                   is what people.js does for the same reason, and without it
                   one press would close the figure and the panel under it. */
                if (e.defaultPrevented) return
                if (!citeModal.hidden) {
                    citeModal.hidden = true
                    return
                }
                closeReader()
            })

            citeModal.querySelectorAll(".pub-cite-tab").forEach((tab) => {
                tab.addEventListener("click", () => {
                    _currentFmt = tab.dataset.fmt
                    citeModal.querySelectorAll(".pub-cite-tab").forEach((t) => t.classList.toggle("pub-cite-tab--active", t === tab))
                    _renderCiteContent()
                })
            })

            const copyBtn = citeModal.querySelector(".pub-cite-copy")
            copyBtn.addEventListener("click", () => {
                navigator.clipboard
                    .writeText(citeModal.querySelector(".pub-cite-content").textContent)
                    .then(() => {
                        copyBtn.textContent = "Copied!"
                        setTimeout(() => {
                            copyBtn.textContent = "Copy"
                        }, 1800)
                    })
                    .catch(() => {})
            })

            /* `fmt` is which tab to open on, defaulting to APA — the panel's
               own BibTeX button is the one caller that wants the other, because
               the APA reference is already printed beside it. */
            function openCiteModal(pub, fmt) {
                _currentCitePub = pub
                _currentFmt = fmt === "bibtex" ? "bibtex" : "apa"
                citeModal
                    .querySelectorAll(".pub-cite-tab")
                    .forEach((t) => t.classList.toggle("pub-cite-tab--active", t.dataset.fmt === _currentFmt))
                _renderCiteContent()
                citeModal.hidden = false
            }

            /* ── The publication panel ──────────────────────────────────────
             * A publication was a link to its DOI and nothing else, which made
             * the 67 pages `generate_pages.py` writes for them addresses
             * nothing on the site pointed at. Worse, they were reachable: a
             * reader arriving on `/publications/<folder>/` from a search
             * result got the shell, no handler claimed `pub-<folder>`, and
             * they were left at the top of the homepage looking at the door.
             *
             * This is the News reader (news.js) and the People profile panel,
             * in this section's colours, and it is the same singleton — built
             * once, refilled on every open. Three things come out of it:
             * `pub-<folder>` is a route somebody can send, the generated page
             * is what that link resolves to for a crawler, and the abstract —
             * which the manifest deliberately does not carry, see
             * docs/publications.md — finally has somewhere to be shown.
             *
             * It lives on <body> rather than inside #main-page: that is the
             * scroll container and it is `pointer-events: none` until the door
             * opens, and a panel inside it would inherit both.
             */
            const readerBackdrop = el("div", "pub-reader__backdrop")
            document.body.appendChild(readerBackdrop)

            const reader = el("aside", "pub-reader")
            reader.setAttribute("role", "dialog")
            reader.setAttribute("aria-modal", "true")
            reader.setAttribute("aria-label", "Publication")
            reader.hidden = true

            const readerClose = el("button", "pub-reader__close", "×")
            readerClose.type = "button"
            readerClose.setAttribute("aria-label", "Close")
            reader.appendChild(readerClose)

            const readerBody = el("div", "pub-reader__body")
            reader.appendChild(readerBody)
            document.body.appendChild(reader)

            // Where focus goes back to when the panel closes, so a keyboard
            // reader is not dropped at the top of the document.
            let lastTrigger = null

            /* ── The abstract ──
             * The one field the manifest does not carry, because 28 abstracts
             * at a median of 165 words is ~50KB every visitor downloads to
             * render a list of titles. So it is fetched per publication, the
             * way news.js fetches a post.json, and cached — a reader who opens
             * the same paper twice must not ask twice.
             *
             * A failure is silent and returns `{}`: 36 of the 63 have no
             * abstract anyway (JOSS deposits none), so "no abstract" is an
             * ordinary state here rather than an error worth showing.
             */
            const infoCache = new Map()

            function loadInfo(pub) {
                if (infoCache.has(pub.folder)) return Promise.resolve(infoCache.get(pub.folder))
                return fetch("publications/" + encodeURIComponent(pub.folder) + "/info.json")
                    .then((response) => (response.ok ? response.json() : {}))
                    .catch(() => ({}))
                    .then((info) => {
                        infoCache.set(pub.folder, info)
                        return info
                    })
            }

            /* ── "See also" ──
             * Three publications at the foot of the panel, and the keywords are
             * what makes them worth reading rather than three random rows: a
             * candidate is scored by how many keywords it shares with the one
             * being read, and the three are drawn from the best-scoring band
             * that can fill them. Within a band the pick is random, so opening
             * the same paper twice offers a different three, constrained to
             * things that are actually related. news.js's "Keep reading" has
             * the same shape but no scoring — see there for why.
             *
             * A publication with no keywords still gets three, out of the
             * zero-score band, which is the whole archive: a loose suggestion
             * beats an empty section.
             *
             * **Entries whose title key matches are dropped**, not only the
             * paper itself. This is a backstop rather than the plan: a preprint
             * and its journal version must never both be in the manifest, and
             * update_publications.py is where that is enforced. It stays
             * because it is two lines, because the pipeline runs against a live
             * ORCID profile that can hand it a pair nothing has seen yet, and
             * because "see also: this same paper" is the one suggestion that
             * reads as a bug to every reader who meets it.
             */
            function normalisedTitle(title) {
                return String(title || "")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, " ")
                    .trim()
            }

            function shuffled(list) {
                const out = list.slice()
                for (let i = out.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1))
                    ;[out[i], out[j]] = [out[j], out[i]]
                }
                return out
            }

            function relatedTo(pub, count) {
                const mine = new Set((pub.keywords || []).map((kw) => kw.toLowerCase()))
                const ownTitle = normalisedTitle(pub.title)

                const bands = new Map()
                pubs.forEach((other) => {
                    if (other.folder === pub.folder) return
                    if (normalisedTitle(other.title) === ownTitle) return
                    const score = (other.keywords || []).reduce((total, kw) => total + (mine.has(kw.toLowerCase()) ? 1 : 0), 0)
                    if (!bands.has(score)) bands.set(score, [])
                    bands.get(score).push(other)
                })

                const picked = []
                for (const score of [...bands.keys()].sort((a, b) => b - a)) {
                    for (const other of shuffled(bands.get(score))) {
                        if (picked.length >= count) return picked
                        picked.push(other)
                    }
                }
                return picked
            }

            /* A real anchor, not a button: the destination is a route the
               router already owns, so `hrefForRoute` gives back exactly the URL
               `writeRoute` would put in the address bar — and with it
               middle-click, "copy link address", and a link a crawler can
               follow. The press itself is still handled here, or the browser
               would reload the page to reach a panel. */
            function routeAnchor(route, onOpen) {
                const anchor = document.createElement("a")
                const href = hrefForRoute(route)
                if (href) anchor.href = href
                anchor.addEventListener("click", (event) => {
                    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    event.preventDefault()
                    onOpen(event)
                })
                return anchor
            }

            function externalLink(className, label, href) {
                const anchor = el("a", className, label)
                anchor.href = href
                anchor.target = "_blank"
                anchor.rel = "noopener noreferrer"
                return anchor
            }

            function closeReader(write) {
                if (!reader.classList.contains("is-open")) return
                // Back to the section's own route, so the URL never names a
                // paper nobody is reading — except when the close is itself
                // part of applying a route, where the caller is about to say
                // what the URL should be.
                reader.dataset.pub = ""
                if (write !== false) writeRoute("publications-" + activeTab)
                reader.classList.remove("is-open")
                readerBackdrop.classList.remove("is-visible")
                // Out of the tab order only once it has finished sliding out;
                // hiding it on the spot would cut the transition.
                setTimeout(() => {
                    if (!reader.classList.contains("is-open")) reader.hidden = true
                }, 380)
                if (lastTrigger) lastTrigger.focus({ preventScroll: true })
                lastTrigger = null
            }

            readerClose.addEventListener("click", () => closeReader())
            readerBackdrop.addEventListener("click", () => closeReader())

            function renderPublication(pub) {
                readerBody.replaceChildren()

                const article = el("article", "pub-article")

                if (pub.year || pub.is_preprint) {
                    const eyebrow = el("div", "pub-article__eyebrow")
                    if (pub.year) eyebrow.appendChild(el("span", "pub-article__year", pub.year))
                    if (pub.is_preprint) eyebrow.appendChild(el("span", "pub-card__preprint-badge", "Preprint"))
                    article.appendChild(eyebrow)
                }

                article.appendChild(el("h3", "pub-article__title", pub.title))
                if (pub.authors) article.appendChild(el("p", "pub-article__authors", pub.authors))

                const meta = []
                if (pub.journal) meta.push(pub.journal)
                if (pub.citations != null && pub.citations >= 0) {
                    meta.push(pub.citations + (pub.citations === 1 ? " citation" : " citations"))
                }
                if (meta.length) article.appendChild(el("p", "pub-article__meta", meta.join(" · ")))

                /* Everywhere the paper itself can be reached, in one row and in
                   the order somebody would want them: the publisher's record
                   first because it is the canonical one, then the copy we can
                   serve, then the two things that are *about* the work. */
                const actions = el("div", "pub-article__actions")
                if (pub.doi) {
                    actions.appendChild(
                        externalLink("pub-action pub-action--primary", "Read the paper", "https://doi.org/" + encodeURIComponent(pub.doi)),
                    )
                }
                if (pub.pdf) actions.appendChild(externalLink("pub-action", "PDF", pub.pdf))
                if (pub.github) actions.appendChild(externalLink("pub-action", "Code", pub.github))
                if (pub.spotify) actions.appendChild(externalLink("pub-action", "Podcast", pub.spotify))
                if (actions.children.length) article.appendChild(actions)

                /* ── The summary and the figure share a row ──
                   The figure had the panel's full width, which on a 920px panel
                   is a 700px chart standing over two sentences of text — at
                   that size the figure reads as the point of the page, and it
                   is not: the summary is. Side by side it is about a fifth of
                   the row, which is also how the two sit on the card the reader
                   pressed to get here.

                   Text first, figure right, matching the card and for the
                   reason the card gives: a publication's figure illustrates an
                   entry the title has already announced, so it follows the text
                   rather than preceding it. Source order is visual order.

                   Both sit in a tinted box under an "In brief" heading. The
                   abstract below is the publisher's text and runs long; this is
                   the lab's own two or three sentences and is the thing worth
                   reading first, and on a panel of undifferentiated prose it
                   was the harder of the two to find. The box is the section's
                   own green, at a stronger tint than the citation box further
                   down so the two do not read as the same kind of thing.

                   `--split` rather than `:has()`, because this is built in JS
                   and knows perfectly well whether there is a figure — 9 of the
                   63 have none, and their summary takes the whole row. */
                const brief = el("section", "pub-article__brief")
                brief.appendChild(el("h4", "pub-article__h", "In brief"))

                /* The box is the row's own element rather than the grid, so the
                   heading can sit above both columns without a `grid-area` that
                   has to be undone when there is no figure. */
                const briefRow = el("div", "pub-article__brief-row")

                // The lab's own two or three sentences on what the paper found
                // — the one thing about it that is not already on the
                // publisher's site. See docs/publications.md.
                if (pub.summary) briefRow.appendChild(el("p", "pub-article__summary", pub.summary))

                if (pub.featured) {
                    briefRow.classList.add("pub-article__brief-row--split")
                    /* A button, because shrinking the figure to a column takes a
                       readable chart down to something a reader can only tell
                       apart from another chart. The viewer is the one the
                       Memories tab and the profile panel already use, so a
                       figure here opens the way a photograph does. */
                    const figure = el("button", "pub-article__figure")
                    figure.type = "button"
                    figure.setAttribute("aria-label", "View the figure full size: " + pub.title)
                    const img = document.createElement("img")
                    img.src = pub.featured
                    img.alt = ""
                    figure.appendChild(img)
                    figure.addEventListener("click", () =>
                        openImageLightbox({
                            src: pub.featured,
                            alt: pub.title,
                            label: "Figure: " + pub.title,
                            title: pub.title,
                            meta: [pub.journal, pub.year].filter(Boolean).join(" \u00b7 "),
                        }),
                    )
                    briefRow.appendChild(figure)
                }

                /* The heading is always there, so the row is what says whether
                   this entry has anything to put in the box. */
                if (briefRow.children.length) {
                    brief.appendChild(briefRow)
                    article.appendChild(brief)
                }

                const abstractSlot = el("div", "pub-article__abstract")
                article.appendChild(abstractSlot)

                if (pub.keywords && pub.keywords.length) {
                    const tags = el("div", "pub-article__keywords")
                    pub.keywords.forEach((kw) => {
                        const tag = el("button", "pub-card__keyword", kw)
                        tag.type = "button"
                        // Filtering the list is something to come *back* to, so
                        // the panel gets out of the way first.
                        tag.addEventListener("click", () => {
                            closeReader()
                            addTerm(kw.toLowerCase())
                        })
                        tags.appendChild(tag)
                    })
                    article.appendChild(tags)
                }

                const cite = el("section", "pub-article__cite")
                cite.appendChild(el("h4", "pub-article__h", "Cite this"))
                cite.appendChild(el("p", "pub-article__apa", _apaCite(pub)))
                const citeActions = el("div", "pub-article__cite-actions")
                const copyApa = el("button", "pub-action", "Copy APA")
                copyApa.type = "button"
                copyApa.addEventListener("click", () => {
                    navigator.clipboard
                        .writeText(_apaCite(pub))
                        .then(() => {
                            copyApa.textContent = "Copied!"
                            setTimeout(() => {
                                copyApa.textContent = "Copy APA"
                            }, 1800)
                        })
                        .catch(() => {})
                })
                citeActions.appendChild(copyApa)
                const bibtex = el("button", "pub-action", "BibTeX")
                bibtex.type = "button"
                bibtex.addEventListener("click", () => openCiteModal(pub, "bibtex"))
                citeActions.appendChild(bibtex)
                cite.appendChild(citeActions)
                article.appendChild(cite)

                const related = relatedTo(pub, 3)
                if (related.length) {
                    const also = el("section", "pub-article__related")
                    also.appendChild(el("h4", "pub-article__h", "See also"))
                    const grid = el("div", "pub-related")
                    related.forEach((other) => {
                        const item = routeAnchor("pub-" + other.folder, () => openPublication(other, lastTrigger))
                        item.className = "pub-related__item"
                        if (other.featured) {
                            const thumb = document.createElement("img")
                            thumb.className = "pub-related__img"
                            thumb.src = other.featured
                            thumb.alt = ""
                            thumb.loading = "lazy"
                            item.appendChild(thumb)
                        }
                        item.appendChild(el("span", "pub-related__title", other.title))
                        const line = [other.year, other.journal].filter(Boolean).join(" · ")
                        if (line) item.appendChild(el("span", "pub-related__meta", line))
                        grid.appendChild(item)
                    })
                    also.appendChild(grid)
                    article.appendChild(also)
                }

                readerBody.appendChild(article)
                reader.setAttribute("aria-label", pub.title)
                reader.hidden = false
                // The panel is fixed and scrolls itself; a reopened one would
                // otherwise start where the last paper was left.
                reader.scrollTop = 0

                // The panel goes from `display: none` to displayed, so there is
                // no starting position for the transform to animate from until
                // it has been laid out once. Reading offsetWidth forces that
                // synchronously — rather than waiting a frame, which leaves the
                // open at the mercy of whether rAF is running at all.
                void reader.offsetWidth
                // Kept on the element so a route naming the paper already open
                // is recognised and left alone rather than re-entered.
                reader.dataset.pub = pub.folder
                writeRoute("pub-" + pub.folder)
                reader.classList.add("is-open")
                readerBackdrop.classList.add("is-visible")
                readerClose.focus({ preventScroll: true })

                return abstractSlot
            }

            function openPublication(pub, trigger) {
                lastTrigger = trigger || null
                const slot = renderPublication(pub)

                /* The panel opens now and the abstract arrives when it does.
                   Waiting on one small file before showing anything reads as a
                   dead press, and 36 of the 63 have no abstract to wait for.
                   The guard is what makes hopping through three "see also"
                   links safe: a response for a paper the reader has already
                   moved on from must not write itself into the panel. */
                loadInfo(pub).then((info) => {
                    if (reader.dataset.pub !== pub.folder) return
                    const abstract = (info.abstract || "").trim()
                    if (!abstract) return
                    slot.replaceChildren()
                    slot.appendChild(el("h4", "pub-article__h", "Abstract"))
                    // Text, never markup: this is the only string on the site
                    // fetched from a third party (CrossRef), and `element` sets
                    // textContent. See docs/publications.md.
                    slot.appendChild(el("p", null, abstract))
                })
            }

            // â”€â”€ Build all cards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const allCards = []

            pubs.forEach((pub) => {
                const card = document.createElement("article")
                card.className = "pub-card"
                if (pub.featured) card.classList.add("pub-card--has-image")
                if (pub.is_preprint) card.classList.add("pub-card--preprint")

                const searchText = [
                    pub.title || "",
                    pub.authors || "",
                    pub.journal || "",
                    pub.summary || "",
                    (pub.keywords || []).join(" "),
                    pub.is_preprint ? "preprint" : "",
                    String(pub.year || ""),
                ]
                    .join(" ")
                    .toLowerCase()
                card.dataset.search = searchText
                card.dataset.year = pub.year || 0
                card.dataset.citations = pub.citations ?? -1

                /* text body wrapper */
                const body = document.createElement("div")
                body.className = "pub-card__body"

                /* ── Eyebrow: the year, and the preprint state beside it ──
                   The badge used to be `position: absolute` in the card's
                   top-right corner, which put it over the figure column on the
                   46 cards that have one — a label sitting on a chart, in the
                   one place the card has a picture rather than space. Here it
                   is a sibling of the year, which is the card's other piece of
                   bibliographic state and already occupies this line. It also
                   removes the `padding-right` the title needed to dodge the
                   corner, so a long title gets its full measure back.

                   The row is built whenever there is either a year or a
                   preprint flag, so a preprint with no year still shows it. */
                if (pub.year || pub.is_preprint) {
                    const eyebrow = document.createElement("div")
                    eyebrow.className = "pub-card__eyebrow"
                    if (pub.year) {
                        const year = document.createElement("span")
                        year.className = "pub-card__year"
                        year.textContent = pub.year
                        eyebrow.appendChild(year)
                    }
                    if (pub.is_preprint) {
                        const preprintBadge = document.createElement("span")
                        preprintBadge.className = "pub-card__preprint-badge"
                        preprintBadge.textContent = "Preprint"
                        eyebrow.appendChild(preprintBadge)
                    }
                    body.appendChild(eyebrow)
                }

                /* ── The title opens the publication's own page ──
                   It used to be a link straight to doi.org, which meant the
                   only thing this site had to say about a paper was somebody
                   else's address for it — and the page generate_pages.py
                   writes at `/publications/<folder>/` was reachable from
                   nowhere. The DOI has not gone anywhere; it is the first
                   action inside the panel. */
                const title = el("h3", "pub-card__title")
                const titleLink = routeAnchor("pub-" + pub.folder, () => openPublication(pub, card))
                titleLink.textContent = pub.title
                title.appendChild(titleLink)
                body.appendChild(title)

                /* authors + cite button */
                if (pub.authors) {
                    const authorsRow = document.createElement("div")
                    authorsRow.className = "pub-card__authors-row"
                    const authors = document.createElement("span")
                    authors.className = "pub-card__authors"
                    authors.textContent = pub.authors
                    authorsRow.appendChild(authors)
                    const citeBtn = document.createElement("button")
                    citeBtn.type = "button"
                    citeBtn.className = "pub-card__cite-btn"
                    citeBtn.textContent = "Cite"
                    citeBtn.setAttribute("aria-label", "Cite: " + pub.title)
                    citeBtn.addEventListener("click", () => openCiteModal(pub))
                    authorsRow.appendChild(citeBtn)
                    body.appendChild(authorsRow)
                }

                /* journal + inline citation count */
                if (pub.journal || (pub.citations != null && pub.citations >= 0)) {
                    const meta = document.createElement("div")
                    meta.className = "pub-card__meta"
                    if (pub.journal) meta.appendChild(document.createTextNode(pub.journal))
                    if (pub.citations != null && pub.citations >= 0) {
                        if (pub.journal) {
                            const dot = document.createElement("span")
                            dot.style.cssText = "font-size:1.3em;line-height:1;vertical-align:-0.05em;margin:0 0.18em"
                            dot.textContent = "\u00b7"
                            meta.appendChild(dot)
                        }
                        const citSpan = document.createElement("span")
                        citSpan.className = "pub-card__cite-inline"
                        citSpan.setAttribute("title", "Citations (CrossRef / Semantic Scholar)")
                        citSpan.innerHTML =
                            '<svg viewBox="0 0 12 10" width="11" height="11" aria-hidden="true" style="vertical-align:-1px;margin-right:2px"><rect x="0" y="6" width="2" height="4" fill="currentColor"/><rect x="3" y="3" width="2" height="7" fill="currentColor"/><rect x="6" y="1" width="2" height="9" fill="currentColor"/><rect x="9" y="4" width="2" height="6" fill="currentColor"/></svg>' +
                            pub.citations
                        meta.appendChild(citSpan)
                    }
                    body.appendChild(meta)
                }

                /* ── The lab's own sentences ──
                   Clamped to three lines in the sheet rather than truncated
                   here, so the card does not decide for the panel: the same
                   string is shown in full there. It is the one thing on a card
                   that is not bibliographic, which is why it sits between the
                   journal line and the keywords rather than under them. */
                if (pub.summary) {
                    body.appendChild(el("p", "pub-card__summary", pub.summary))
                }

                /* keywords â€” clickable, add to filter */
                if (pub.keywords && pub.keywords.length) {
                    const tags = document.createElement("div")
                    tags.className = "pub-card__keywords"
                    pub.keywords.forEach((kw) => {
                        const tag = document.createElement("button")
                        tag.type = "button"
                        tag.className = "pub-card__keyword"
                        tag.dataset.kw = kw.toLowerCase()
                        tag.textContent = kw
                        tag.addEventListener("click", () => addTerm(kw.toLowerCase()))
                        tags.appendChild(tag)
                    })
                    body.appendChild(tags)
                }

                /* Altmetric, Dimensions, PDF & GitHub badges */
                const badges = document.createElement("div")
                badges.className = "pub-card__badges"

                /* ── The two third-party badges are placed, not armed ──
                   All 66 cards are built up front and the pager shows five, so
                   writing `altmetric-embed` and `__dimensions_badge_embed__`
                   here handed both vendors' scripts every publication at once:
                   111 image requests to badges.altmetric.com and
                   badge.dimensions.ai on the *homepage*, before the reader has
                   scrolled anywhere near this section, for 61 cards that are
                   `hidden`. Measured.

                   So the class names those scripts scan for are withheld until
                   a card is actually on a page the reader is looking at, and
                   `armMetricBadges` below puts them on. Everything else — the
                   DOI, the badge options — is written now, because none of it
                   is what triggers a fetch. */
                if (pub.doi) {
                    const altmetric = document.createElement("div")
                    altmetric.className = "pub-metric-badge"
                    altmetric.dataset.metricBadge = "altmetric"
                    altmetric.setAttribute("data-badge-type", "donut")
                    altmetric.setAttribute("data-badge-popover", "right")
                    altmetric.setAttribute("data-doi", pub.doi)
                    badges.appendChild(altmetric)

                    const dimensions = document.createElement("span")
                    dimensions.className = "pub-metric-badge"
                    dimensions.dataset.metricBadge = "dimensions"
                    dimensions.setAttribute("data-doi", pub.doi)
                    dimensions.setAttribute("data-style", "small_circle")
                    badges.appendChild(dimensions)
                }

                if (pub.pdf) {
                    const pdfLink = document.createElement("a")
                    pdfLink.className = "pub-card__pdf-badge"
                    pdfLink.href = pub.pdf
                    pdfLink.target = "_blank"
                    pdfLink.rel = "noopener noreferrer"
                    pdfLink.setAttribute("aria-label", "Download PDF")
                    pdfLink.innerHTML = `<svg viewBox="0 0 40 48" aria-hidden="true" focusable="false" style="width:34px;height:34px;display:block"><path d="M6 0 H28 L40 12 V48 H6 Z" fill="white"/><path d="M28 0 L40 12 H28 Z" fill="rgba(220,0,20,0.35)"/><text x="23" y="36" text-anchor="middle" font-size="14" font-weight="900" font-family="Arial,Helvetica,sans-serif" fill="#E8192C" letter-spacing="0.5">PDF</text></svg>`
                    badges.appendChild(pdfLink)
                }

                if (pub.github) {
                    const ghLink = document.createElement("a")
                    ghLink.className = "pub-card__github-badge"
                    ghLink.href = pub.github
                    ghLink.target = "_blank"
                    ghLink.rel = "noopener noreferrer"
                    ghLink.setAttribute("aria-label", "GitHub repository")
                    ghLink.innerHTML = `<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`
                    badges.appendChild(ghLink)
                }

                /* Hand-written in info.json like `github`, and rendered the same
                   way: a link on the card, not on the generated page. Both are
                   about the work rather than part of it, and neither is
                   something CrossRef or ORCID knows — see CLAUDE.md. */
                if (pub.spotify) {
                    const spLink = document.createElement("a")
                    spLink.className = "pub-card__spotify-badge"
                    spLink.href = pub.spotify
                    spLink.target = "_blank"
                    spLink.rel = "noopener noreferrer"
                    spLink.setAttribute("aria-label", "Listen on Spotify")
                    spLink.innerHTML = `<svg viewBox="3.55 6.3 17.4 11.55" aria-hidden="true" focusable="false"><path d="M17.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02z"/><path d="M18.961 14.04c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2z"/><path d="M19.081 10.68C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`
                    badges.appendChild(spLink)
                }

                if (badges.children.length) body.appendChild(badges)

                card.appendChild(body)

                /* featured image — clicking opens the article. After the body,
                   so source order matches the visual order: it is the card's
                   right-hand column and fills the row's height. */
                if (pub.featured) {
                    const wrap = routeAnchor("pub-" + pub.folder, () => openPublication(pub, card))
                    wrap.className = "pub-card__featured-wrap"
                    wrap.setAttribute("aria-label", pub.title)
                    const img = document.createElement("img")
                    img.className = "pub-card__featured"
                    img.src = pub.featured
                    img.alt = ""
                    img.loading = "lazy"
                    wrap.appendChild(img)
                    card.appendChild(wrap)
                }

                container.appendChild(card)
                allCards.push(card)
            })

            // -- Build gallery --
            const galleryContainer = document.getElementById("publications-gallery")
            if (galleryContainer) {
                const withImages = pubs.filter((p) => p.featured)
                if (withImages.length) {
                    // Gallery items data (keep stable reference for re-sorting)
                    const galleryItems = withImages.map((pub) => {
                        const item = routeAnchor("pub-" + pub.folder, () => openPublication(pub, item))
                        item.className = "pub-gallery__item"
                        item.dataset.year = pub.year || 0
                        item.setAttribute("aria-label", pub.title)
                        const img = document.createElement("img")
                        img.className = "pub-gallery__img"
                        img.src = pub.featured
                        img.alt = pub.title
                        img.loading = "lazy"
                        item.appendChild(img)
                        const caption = document.createElement("div")
                        caption.className = "pub-gallery__caption"
                        if (pub.year) {
                            const yr = document.createElement("span")
                            yr.className = "pub-gallery__year"
                            yr.textContent = pub.year
                            caption.appendChild(yr)
                        }
                        const ttl = document.createElement("p")
                        ttl.className = "pub-gallery__title"
                        ttl.textContent = pub.title
                        caption.appendChild(ttl)
                        item.appendChild(caption)
                        return item
                    })

                    // Fisher-Yates shuffle for default random order
                    function shuffleArray(arr) {
                        const a = arr.slice()
                        for (let i = a.length - 1; i > 0; i--) {
                            const j = Math.floor(Math.random() * (i + 1))
                            ;[a[i], a[j]] = [a[j], a[i]]
                        }
                        return a
                    }

                    let gallerySortMode = "random" // "random" | "date"
                    let gallerySortDir = 1 // 1 = desc, -1 = asc

                    function renderGallery() {
                        let sorted
                        if (gallerySortMode === "date") {
                            sorted = galleryItems.slice().sort((a, b) => gallerySortDir * (Number(b.dataset.year) - Number(a.dataset.year)))
                        } else {
                            // Guarantee a different order each time Random is clicked
                            const currentOrder = Array.from(galleryContainer.children)
                            sorted = shuffleArray(galleryItems)
                            if (galleryItems.length > 1) {
                                let attempts = 0
                                while (attempts < 20 && sorted.every((el, i) => el === currentOrder[i])) {
                                    sorted = shuffleArray(galleryItems)
                                    attempts++
                                }
                            }
                        }
                        galleryContainer.innerHTML = ""
                        sorted.forEach((el) => galleryContainer.appendChild(el))
                    }

                    // Sort bar above gallery
                    const gallerySortBar = document.createElement("div")
                    gallerySortBar.className = "pub-sort-bar"
                    gallerySortBar.innerHTML = `<span class="pub-sort-label">Sort by</span>
                        <button type="button" class="pub-sort-btn pub-sort-btn--active" data-gsort="random">Random</button>
                        <button type="button" class="pub-sort-btn" data-gsort="date">Date <span class="pub-sort-arrow"></span></button>`
                    galleryContainer.parentNode.insertBefore(gallerySortBar, galleryContainer)

                    gallerySortBar.querySelectorAll("[data-gsort]").forEach((btn) => {
                        btn.addEventListener("click", () => {
                            const key = btn.dataset.gsort
                            if (key === "date" && gallerySortMode === "date") {
                                gallerySortDir *= -1
                            } else {
                                gallerySortMode = key
                                gallerySortDir = 1
                            }
                            gallerySortBar.querySelectorAll("[data-gsort]").forEach((b) => {
                                const active = b.dataset.gsort === gallerySortMode
                                b.classList.toggle("pub-sort-btn--active", active)
                                const arrow = b.querySelector(".pub-sort-arrow")
                                if (arrow)
                                    arrow.textContent =
                                        active && gallerySortMode === "date" ? (gallerySortDir === 1 ? "\u2193" : "\u2191") : ""
                            })
                            renderGallery()
                        })
                    })

                    renderGallery()
                } else {
                    galleryContainer.textContent = "No featured images available."
                }
            }

            /* ── Pagination (after the list) ──
               The same component News uses (shared/pager.js), in this
               section's colours: it was a numbered strip, which grows with the
               archive and reflows on every filter. */
            const pager = createPager({
                onChange: (page) => {
                    currentPage = page
                    renderView()
                    document.getElementById("sec-publications-full")?.scrollIntoView({ behavior: "smooth", block: "start" })
                },
                ariaLabel: "Publication pages",
            })
            container.parentNode.insertBefore(pager.el, container.nextSibling)

            // â”€â”€ Sort bar (between search bar and list) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const searchBar = document.querySelector(".pub-search-bar")
            const sortBar = document.createElement("div")
            sortBar.className = "pub-sort-bar"
            sortBar.innerHTML = `<span class="pub-sort-label">Sort by</span>
                <button type="button" class="pub-sort-btn pub-sort-btn--active" data-sort="date">Date <span class="pub-sort-arrow">\u2193</span></button>
                <button type="button" class="pub-sort-btn" data-sort="citations">Citations <span class="pub-sort-arrow"></span></button>`
            container.parentNode.insertBefore(sortBar, container)

            // â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            let currentSort = "date"
            let currentPage = 0
            // Which tab the URL goes back to when the panel is closed — a paper
            // is read *over* a tab, and the reader is put back on the one they
            // came from. Same idea as news.js's `activeTab`.
            let activeTab = "list"
            const sortDirs = { date: 1, citations: 1 } // 1 = desc (default), -1 = asc
            let activeTerms = []
            const searchInput = document.getElementById("pub-search")
            let searchInputTimer = 0
            let chipsSignature = ""
            let dropdownSignature = ""

            // â”€â”€ Core render â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            function getFilteredSorted() {
                const q = searchInput ? searchInput.value.trim().toLowerCase() : ""
                const terms = q ? [...activeTerms, q] : [...activeTerms]
                const filtered = allCards.filter((card) => terms.length === 0 || terms.every((t) => card.dataset.search.includes(t)))
                filtered.sort((a, b) => {
                    const dir = sortDirs[currentSort]
                    if (currentSort === "citations") {
                        return dir * (Number(b.dataset.citations) - Number(a.dataset.citations))
                    }
                    return dir * (Number(b.dataset.year) - Number(a.dataset.year))
                })
                return filtered
            }

            function renderView() {
                const filtered = getFilteredSorted()
                const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
                if (currentPage >= totalPages) currentPage = totalPages - 1

                // Update keyword active states
                container.querySelectorAll(".pub-card__keyword").forEach((btn) => {
                    btn.classList.toggle("pub-card__keyword--active", activeTerms.includes(btn.dataset.kw))
                })

                // Hide all, then move & show this page's slice (reorders DOM to match sort)
                allCards.forEach((card) => {
                    card.hidden = true
                })
                const start = currentPage * PAGE_SIZE
                const onPage = filtered.slice(start, start + PAGE_SIZE)
                onPage.forEach((card) => {
                    card.hidden = false
                    container.appendChild(card)
                })

                /* The two third-party badges are given their real class names
                   here and nowhere else — this is the only place that knows
                   which cards a reader can see. Only when something was newly
                   armed: the vendors' scripts walk the whole document, and on
                   an archive this size that is not free. */
                if (armMetricBadges(onPage)) scheduleOfficialMetricBadges()

                // Empty state
                let emptyMsg = container.querySelector(".pub-search-empty")
                if (filtered.length === 0) {
                    if (!emptyMsg) {
                        emptyMsg = document.createElement("p")
                        emptyMsg.className = "pub-search-empty"
                        emptyMsg.textContent = "No publications match your search."
                    }
                    emptyMsg.hidden = false
                    container.appendChild(emptyMsg)
                } else if (emptyMsg) {
                    emptyMsg.hidden = true
                }

                pager.render(currentPage, totalPages)
            }

            // Initial render. It arms and schedules the badges for the first
            // page itself, so there is no blanket call here any more — that one
            // ran against a document holding all 66 cards.
            renderView()
            buildScholarMetrics(pubs.length)

            /* -- Tab switching, and the URL --
               `#publications-<tab>`, the same scheme every other section uses
               (shared/deep-link.js). This was `?section=publications&tab=…`
               pushed onto the history stack, which was the only query-string
               state on the site and the only tab that added a history entry:
               four presses of Gallery and List meant four presses of Back to
               leave the page. `write` is false for a switch that came out of
               the URL in the first place. */
            function activateTab(tab, write) {
                activeTab = tab
                document.querySelectorAll(".pub-tab-btn").forEach((b) => {
                    b.classList.toggle("pub-tab-btn--active", b.dataset.tab === tab)
                    b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false")
                })
                swapTabPanels(document.querySelectorAll(".pub-tab-panel"), "pub-tab-" + tab)
                if (write !== false) writeRoute("publications-" + tab)
            }

            document.querySelectorAll(".pub-tab-btn").forEach((btn) => {
                btn.addEventListener("click", () => activateTab(btn.dataset.tab))
            })

            initMarginTabNav(document.querySelector(".publications-full"), ".pub-tab-btn")

            /* `pub-<folder>` opens one publication in the panel,
               `publications-<tab>` picks a tab. Idempotent — a reader can paste
               the same link twice, and a route naming the paper already open
               must not re-enter it under them. */
            function applyRoute(route) {
                const folder = matchRoute(route, "pub")
                if (folder) {
                    const pub = pubs.find((entry) => entry.folder === folder)
                    if (!pub) return false
                    revealSection("sec-publications-full")
                    if (reader.dataset.pub !== folder || !reader.classList.contains("is-open")) openPublication(pub, null)
                    return true
                }

                /* Anything that is not a publication is somewhere else on the
                   page, and the panel covers all of it — so it goes, whether or
                   not the destination is this section. Silent when nothing was
                   open, which is the usual case. */
                closeReader(false)

                const tab = matchRoute(route, "publications")
                if (tab === null || !document.getElementById("pub-tab-" + tab)) return false
                activateTab(tab, false)
                revealSection("sec-publications-full")
                return true
            }

            onRoute(applyRoute)

            /* The tab label for an open publication. Registered here rather
               than at startup for the same reason applyRoute is: a folder is
               only a title once the manifest has landed. */
            registerRouteTitle((route) => {
                const folder = matchRoute(route, "pub")
                if (!folder) return null
                const pub = pubs.find((entry) => entry.folder === folder)
                return pub ? pub.title : null
            })
            // Armed only when this section owned the route — see news.js.
            if (applyRoute(INITIAL_ROUTE)) landOnLoad("sec-publications-full")

            // â”€â”€ Sort buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            sortBar.querySelectorAll(".pub-sort-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const key = btn.dataset.sort
                    if (key === currentSort) {
                        sortDirs[key] *= -1 // toggle direction
                    } else {
                        currentSort = key
                        sortDirs[key] = 1 // reset to descending when switching keys
                    }
                    // Sync button appearance
                    sortBar.querySelectorAll(".pub-sort-btn").forEach((b) => {
                        const active = b.dataset.sort === currentSort
                        b.classList.toggle("pub-sort-btn--active", active)
                        const arrow = b.querySelector(".pub-sort-arrow")
                        if (arrow) arrow.textContent = active ? (sortDirs[currentSort] === 1 ? "\u2193" : "\u2191") : ""
                    })
                    currentPage = 0
                    renderView()
                })
            })

            // â”€â”€ Multi-term search / filter + keyword dropdown â”€â”€â”€â”€â”€â”€â”€â”€
            if (!searchInput || !searchBar) return

            const allKeywords = [...new Set(pubs.flatMap((p) => (p.keywords || []).map((k) => k.toLowerCase())))].sort()

            // Wrap chips + input in a single styled field
            const field = document.createElement("div")
            field.className = "pub-search-field"
            searchBar.insertBefore(field, searchInput)
            const chipsContainer = document.createElement("div")
            chipsContainer.className = "pub-search-chips"
            chipsContainer.hidden = true
            field.appendChild(chipsContainer)
            field.appendChild(searchInput)

            // Keyword dropdown
            const dropdown = document.createElement("ul")
            dropdown.className = "pub-search-dropdown"
            dropdown.hidden = true
            dropdown.setAttribute("role", "listbox")
            searchBar.appendChild(dropdown)

            function renderDropdown(force = false) {
                const q = searchInput.value.trim().toLowerCase()
                const available = allKeywords.filter((kw) => !activeTerms.includes(kw) && (!q || kw.includes(q)))
                const nextSignature = [q, ...activeTerms, "--", ...available].join("|")

                if (!force && nextSignature === dropdownSignature) {
                    dropdown.hidden = available.length === 0
                    return
                }

                dropdownSignature = nextSignature
                dropdown.innerHTML = ""
                if (!available.length) {
                    dropdown.hidden = true
                    return
                }
                available.forEach((kw) => {
                    const li = document.createElement("li")
                    li.className = "pub-search-dropdown__item"
                    li.setAttribute("role", "option")
                    const displayKw = pubs.flatMap((p) => p.keywords || []).find((k) => k.toLowerCase() === kw) || kw
                    li.textContent = displayKw
                    li.addEventListener("mousedown", (e) => {
                        e.preventDefault()
                        addTerm(kw)
                    })
                    dropdown.appendChild(li)
                })
                dropdown.hidden = false
            }

            function renderChips(force = false) {
                const nextSignature = activeTerms.join("|")

                if (!force && nextSignature === chipsSignature) {
                    chipsContainer.hidden = activeTerms.length === 0
                    return
                }

                chipsSignature = nextSignature
                chipsContainer.innerHTML = ""
                activeTerms.forEach((term, i) => {
                    const chip = document.createElement("span")
                    chip.className = "pub-search-chip"
                    chip.appendChild(document.createTextNode(term + "\u00a0"))
                    const remove = document.createElement("button")
                    remove.type = "button"
                    remove.className = "pub-search-chip__remove"
                    remove.setAttribute("aria-label", "Remove filter: " + term)
                    remove.textContent = "\u00d7"
                    remove.addEventListener("click", () => {
                        activeTerms.splice(i, 1)
                        renderChips(true)
                        renderDropdown(true)
                        currentPage = 0
                        renderView()
                        searchInput.focus()
                    })
                    chip.appendChild(remove)
                    chipsContainer.appendChild(chip)
                })
                chipsContainer.hidden = activeTerms.length === 0
            }

            addTerm = function (term) {
                const t = term.trim().toLowerCase()
                if (t && !activeTerms.includes(t)) {
                    activeTerms.push(t)
                    renderChips(true)
                    searchInput.value = ""
                    renderDropdown(true)
                    currentPage = 0
                    renderView()
                    searchInput.focus()
                }
            }

            searchInput.addEventListener("focus", () => renderDropdown(true))
            searchInput.addEventListener("input", () => {
                window.clearTimeout(searchInputTimer)
                searchInputTimer = window.setTimeout(() => {
                    currentPage = 0
                    renderView()
                    renderDropdown()
                }, SEARCH_INPUT_DEBOUNCE_MS)
            })
            searchInput.addEventListener("blur", () => {
                window.clearTimeout(searchInputTimer)
                setTimeout(() => {
                    dropdown.hidden = true
                }, 160)
            })
            searchInput.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    dropdown.hidden = true
                    searchInput.blur()
                } else if (e.key === "Enter") {
                    window.clearTimeout(searchInputTimer)
                    e.preventDefault()
                    const val = searchInput.value.trim()
                    if (val) addTerm(val)
                } else if (e.key === "Backspace" && searchInput.value === "" && activeTerms.length > 0) {
                    activeTerms.pop()
                    renderChips(true)
                    renderDropdown(true)
                    currentPage = 0
                    renderView()
                }
            })
        })
        .catch((err) => {
            console.warn("publications.js: could not load manifest", err)
        })
})()
