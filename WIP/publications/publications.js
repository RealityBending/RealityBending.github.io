/* publications.js
 * Renders the Publications section from publications/publications_manifest.json.
 */
;(function () {
    const PAGE_SIZE = 5

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
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") citeModal.hidden = true
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

            function openCiteModal(pub) {
                _currentCitePub = pub
                _currentFmt = "apa"
                citeModal
                    .querySelectorAll(".pub-cite-tab")
                    .forEach((t) => t.classList.toggle("pub-cite-tab--active", t.dataset.fmt === "apa"))
                _renderCiteContent()
                citeModal.hidden = false
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

                /* year pill */
                if (pub.year) {
                    const year = document.createElement("span")
                    year.className = "pub-card__year"
                    year.textContent = pub.year
                    body.appendChild(year)
                }

                /* title â€” links to DOI */
                const title = document.createElement("h3")
                title.className = "pub-card__title"
                if (pub.doi) {
                    const a = document.createElement("a")
                    a.href = "https://doi.org/" + encodeURIComponent(pub.doi)
                    a.target = "_blank"
                    a.rel = "noopener noreferrer"
                    a.textContent = pub.title
                    title.appendChild(a)
                } else {
                    title.textContent = pub.title
                }
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

                if (pub.doi) {
                    const altmetric = document.createElement("div")
                    altmetric.className = "altmetric-embed"
                    altmetric.setAttribute("data-badge-type", "donut")
                    altmetric.setAttribute("data-badge-popover", "right")
                    altmetric.setAttribute("data-doi", pub.doi)
                    badges.appendChild(altmetric)

                    const dimensions = document.createElement("span")
                    dimensions.className = "__dimensions_badge_embed__"
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

                if (badges.children.length) body.appendChild(badges)

                card.appendChild(body)

                /* preprint badge — top-right corner label */
                if (pub.is_preprint) {
                    const preprintBadge = document.createElement("span")
                    preprintBadge.className = "pub-card__preprint-badge"
                    preprintBadge.textContent = "Preprint"
                    card.appendChild(preprintBadge)
                }

                /* featured image — clicking opens the article */
                if (pub.featured) {
                    const wrap = pub.doi ? document.createElement("a") : document.createElement("div")
                    wrap.className = "pub-card__featured-wrap"
                    if (pub.doi) {
                        wrap.href = "https://doi.org/" + encodeURIComponent(pub.doi)
                        wrap.target = "_blank"
                        wrap.rel = "noopener noreferrer"
                        wrap.setAttribute("aria-label", pub.title)
                    }
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
                        const item = document.createElement("a")
                        item.className = "pub-gallery__item"
                        item.dataset.year = pub.year || 0
                        if (pub.doi) {
                            item.href = "https://doi.org/" + encodeURIComponent(pub.doi)
                            item.target = "_blank"
                            item.rel = "noopener noreferrer"
                        }
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

            /* Trigger badge scripts */
            if (typeof _altmetric_embed_init === "function") _altmetric_embed_init()
            if (typeof __dimensions_embed !== "undefined" && typeof __dimensions_embed.addBadges === "function")
                __dimensions_embed.addBadges()

            // â”€â”€ Pagination element (after list) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
            const paginationEl = document.createElement("div")
            paginationEl.className = "pub-pagination"
            container.parentNode.insertBefore(paginationEl, container.nextSibling)

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
            const sortDirs = { date: 1, citations: 1 } // 1 = desc (default), -1 = asc
            let activeTerms = []
            const searchInput = document.getElementById("pub-search")

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
                filtered.slice(start, start + PAGE_SIZE).forEach((card) => {
                    card.hidden = false
                    container.appendChild(card)
                })

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

                renderPagination(totalPages)
            }

            function renderPagination(totalPages) {
                paginationEl.innerHTML = ""
                if (totalPages <= 1) return

                function goTo(page) {
                    currentPage = page
                    renderView()
                    document.getElementById("sec-publications-full")?.scrollIntoView({ behavior: "smooth", block: "start" })
                }

                // Prev arrow
                const prev = document.createElement("button")
                prev.type = "button"
                prev.className = "pub-pagination__btn pub-pagination__arrow"
                prev.setAttribute("aria-label", "Previous page")
                prev.innerHTML = "&#8592;"
                prev.disabled = currentPage === 0
                prev.addEventListener("click", () => {
                    if (currentPage > 0) goTo(currentPage - 1)
                })
                paginationEl.appendChild(prev)

                for (let i = 0; i < totalPages; i++) {
                    const btn = document.createElement("button")
                    btn.type = "button"
                    btn.className = "pub-pagination__btn" + (i === currentPage ? " pub-pagination__btn--active" : "")
                    btn.textContent = i + 1
                    btn.addEventListener("click", () => goTo(i))
                    paginationEl.appendChild(btn)
                }

                // Next arrow
                const next = document.createElement("button")
                next.type = "button"
                next.className = "pub-pagination__btn pub-pagination__arrow"
                next.setAttribute("aria-label", "Next page")
                next.innerHTML = "&#8594;"
                next.disabled = currentPage === totalPages - 1
                next.addEventListener("click", () => {
                    if (currentPage < totalPages - 1) goTo(currentPage + 1)
                })
                paginationEl.appendChild(next)
            }

            // Initial render
            renderView()

            // -- Tab switching --
            function activateTab(tab) {
                document.querySelectorAll(".pub-tab-btn").forEach((b) => {
                    b.classList.toggle("pub-tab-btn--active", b.dataset.tab === tab)
                    b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false")
                })
                document.querySelectorAll(".pub-tab-panel").forEach((panel) => {
                    panel.hidden = panel.id !== "pub-tab-" + tab
                })
            }

            document.querySelectorAll(".pub-tab-btn").forEach((btn) => {
                btn.addEventListener("click", () => {
                    const tab = btn.dataset.tab
                    activateTab(tab)
                    const url = new URL(location.href)
                    url.searchParams.set("section", "publications")
                    url.searchParams.set("tab", tab)
                    history.pushState({ section: "publications", tab }, "", url.toString())
                })
            })

            // Restore tab from URL on load
            ;(() => {
                const params = new URLSearchParams(location.search)
                const tabParam = params.get("tab")
                if (tabParam && document.getElementById("pub-tab-" + tabParam)) {
                    activateTab(tabParam)
                    document.getElementById("sec-publications-full")?.scrollIntoView({ behavior: "auto", block: "start" })
                }
            })()

            // Handle browser back/forward
            window.addEventListener("popstate", (e) => {
                const tab = e.state?.tab || new URLSearchParams(location.search).get("tab") || "list"
                if (document.getElementById("pub-tab-" + tab)) activateTab(tab)
            })

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

            function renderDropdown() {
                const q = searchInput.value.trim().toLowerCase()
                const available = allKeywords.filter((kw) => !activeTerms.includes(kw) && (!q || kw.includes(q)))
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

            function renderChips() {
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
                        renderChips()
                        renderDropdown()
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
                    renderChips()
                    searchInput.value = ""
                    renderDropdown()
                    currentPage = 0
                    renderView()
                    searchInput.focus()
                }
            }

            searchInput.addEventListener("focus", renderDropdown)
            searchInput.addEventListener("input", () => {
                currentPage = 0
                renderView()
                renderDropdown()
            })
            searchInput.addEventListener("blur", () => {
                setTimeout(() => {
                    dropdown.hidden = true
                }, 160)
            })
            searchInput.addEventListener("keydown", (e) => {
                if (e.key === "Escape") {
                    dropdown.hidden = true
                    searchInput.blur()
                } else if (e.key === "Enter") {
                    e.preventDefault()
                    const val = searchInput.value.trim()
                    if (val) addTerm(val)
                } else if (e.key === "Backspace" && searchInput.value === "" && activeTerms.length > 0) {
                    activeTerms.pop()
                    renderChips()
                    renderDropdown()
                    currentPage = 0
                    renderView()
                }
            })
        })
        .catch((err) => {
            console.warn("publications.js: could not load manifest", err)
        })
})()
