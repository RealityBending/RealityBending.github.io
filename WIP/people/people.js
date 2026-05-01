/* people.js
 * Renders the People section as a Multi-Layered Perceptron (MLP) diagram.
 * Fetches people/people_manifest.json, builds one layer per role (PI → Postdoc →
 * PhD Student → Research Assistant), draws animated SVG Bézier connections
 * between layers, and shows a curved keyword ring with up to three research
 * keywords around each member's avatar on hover.
 */
/* ───────────────────────────────────────────────────
   People section — Multi-Layered Perceptron visualisation
   ─────────────────────────────────────────────────── */
;(function () {
    const CATEGORY_LABELS = {
        PI: "Principal Investigator",
        Postdoc: "Postdocs",
        "PhD Student": "PhD Students",
        "Research Assistant": "Research Assistants",
    }

    const CATEGORY_COLORS = {
        PI: "rgba(20, 60, 140, 0.94)",
        Postdoc: "rgba(55, 120, 220, 0.90)",
        "PhD Student": "rgba(140, 60, 200, 0.88)",
        "Research Assistant": "rgba(180, 40, 40, 0.88)",
    }

    const DEFAULT_AVATAR = "img/default_avatar.png"
    const NS = "http://www.w3.org/2000/svg"

    function toCartesian(cx, cy, radius, angleDeg) {
        const rad = (angleDeg * Math.PI) / 180
        return {
            x: cx + radius * Math.cos(rad),
            y: cy + radius * Math.sin(rad),
        }
    }

    function buildArcPath(cx, cy, radius, startAngle, endAngle, reverse) {
        if (reverse) {
            // Swap start/end and use sweep-flag=0 (counterclockwise) so the
            // path travels from lower-left → bottom → lower-right.  Text
            // placed on this reversed path has its glyphs pointing inward
            // (upward at the bottom of the ring), making it right-side-up.
            const start = toCartesian(cx, cy, radius, endAngle)
            const end = toCartesian(cx, cy, radius, startAngle)
            return "M " + start.x + " " + start.y + " A " + radius + " " + radius + " 0 0 0 " + end.x + " " + end.y
        }
        const start = toCartesian(cx, cy, radius, startAngle)
        const end = toCartesian(cx, cy, radius, endAngle)
        return "M " + start.x + " " + start.y + " A " + radius + " " + radius + " 0 0 1 " + end.x + " " + end.y
    }

    function normalizeKeywords(keywords) {
        const source = Array.isArray(keywords) ? keywords : []
        return Array.from({ length: 3 }, (_, index) => (source[index] || "").trim())
    }

    function getKeywordFontSize(keyword, segmentLength) {
        if (!keyword) return 0

        const safeLength = Math.max(keyword.length, 4)
        return Math.max(8, Math.min(11, segmentLength / (safeLength * 0.78)))
    }

    function normalizeTextList(value) {
        if (Array.isArray(value)) {
            return value.map((item) => (item == null ? "" : String(item).trim())).filter(Boolean)
        }
        if (typeof value === "string") {
            const item = value.trim()
            return item ? [item] : []
        }
        return []
    }

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\"/g, "&quot;")
            .replace(/'/g, "&#39;")
    }

    function paragraphizePlainText(value) {
        const safeText = escapeHtml(value).replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br>")
        return "<p>" + safeText + "</p>"
    }

    function normalizeSummaryHtml(summary, fallback) {
        if (typeof summary === "string" && summary.trim()) {
            const trimmed = summary.trim()
            return /<[a-z!/][^>]*>/i.test(trimmed) ? trimmed : paragraphizePlainText(trimmed)
        }

        if (Array.isArray(summary)) {
            const items = summary.map((item) => (item == null ? "" : String(item).trim())).filter(Boolean)
            if (items.length) {
                return items.map(paragraphizePlainText).join("")
            }
        }

        const safeFallback = (fallback || "").trim()
        return safeFallback ? paragraphizePlainText(safeFallback) : ""
    }

    function normalizeSocials(member) {
        const links = []
        const seenUrls = new Set()

        function addLink(label, url) {
            const safeLabel = (label || "").trim()
            const safeUrl = (url || "").trim()
            if (!safeLabel || !safeUrl || seenUrls.has(safeUrl)) return
            seenUrls.add(safeUrl)
            links.push({ label: safeLabel, url: safeUrl })
        }

        if (Array.isArray(member.socials)) {
            member.socials.forEach((item) => {
                if (!item || typeof item !== "object") return
                addLink(item.label || item.name || item.platform, item.url || item.link)
            })
        }

        addLink("Website", member.website)
        return links
    }

    function normalizeEducationEntries(value) {
        if (!Array.isArray(value)) return []

        return value
            .map((item) => {
                if (!item || typeof item !== "object") return null
                const degree = (item.degree || item.course || item.title || "").trim()
                const institution = (item.institution || item.school || item.organization || "").trim()
                const year = item.year == null ? "" : String(item.year).trim()
                const details = (item.details || item.description || item.notes || "").trim()
                if (!degree && !institution && !year) return null
                return { degree, institution, year, details }
            })
            .filter(Boolean)
    }

    function getSocialIconType(label, url) {
        const haystack = (label + " " + url).toLowerCase()
        if (haystack.includes("scholar")) return "academic"
        if (haystack.includes("github")) return "code"
        if (haystack.includes("researchgate")) return "research"
        if (haystack.includes("x.com") || haystack.includes("twitter") || haystack === "x") return "message"
        if (haystack.includes("linkedin")) return "network"
        if (haystack.includes("website") || haystack.includes("http")) return "globe"
        return "link"
    }

    function createSocialIcon(type) {
        const svg = document.createElementNS(NS, "svg")
        svg.setAttribute("viewBox", "0 0 24 24")
        svg.setAttribute("fill", "none")
        svg.setAttribute("stroke", "currentColor")
        svg.setAttribute("stroke-width", "1.9")
        svg.setAttribute("stroke-linecap", "round")
        svg.setAttribute("stroke-linejoin", "round")
        svg.setAttribute("aria-hidden", "true")

        function appendPath(d) {
            const path = document.createElementNS(NS, "path")
            path.setAttribute("d", d)
            svg.appendChild(path)
        }

        function appendCircle(cx, cy, r) {
            const circle = document.createElementNS(NS, "circle")
            circle.setAttribute("cx", cx)
            circle.setAttribute("cy", cy)
            circle.setAttribute("r", r)
            svg.appendChild(circle)
        }

        switch (type) {
            case "academic":
                appendPath("M3 9l9-4 9 4-9 4-9-4z")
                appendPath("M7 11.5v3.2c0 .8 2.2 2.3 5 2.3s5-1.5 5-2.3v-3.2")
                appendPath("M19 10v4.5")
                appendPath("M19 14.5l1.4 2")
                break
            case "code":
                appendPath("M9 7l-5 5 5 5")
                appendPath("M15 7l5 5-5 5")
                appendPath("M13 4l-2 16")
                break
            case "research":
                appendCircle("7", "12", "2.25")
                appendCircle("17", "7", "2.25")
                appendCircle("17", "17", "2.25")
                appendPath("M9.1 11 14.8 8.1")
                appendPath("M9.1 13l5.7 2.9")
                break
            case "message":
                appendPath("M5 6.5h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H10l-5 4v-4H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z")
                appendPath("M8.5 10.5l7 4")
                appendPath("M15.5 10.5l-7 4")
                break
            case "network":
                appendCircle("6", "6", "2")
                appendCircle("18", "6", "2")
                appendCircle("12", "18", "2")
                appendPath("M7.5 7.5l3 7")
                appendPath("M16.5 7.5l-3 7")
                appendPath("M8 6h8")
                break
            case "globe":
                appendCircle("12", "12", "9")
                appendPath("M3 12h18")
                appendPath("M12 3a14.5 14.5 0 0 1 0 18")
                appendPath("M12 3a14.5 14.5 0 0 0 0 18")
                break
            default:
                appendPath("M10 14l8-8")
                appendPath("M14 6h4v4")
                appendPath("M20 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4")
                break
        }

        return svg
    }

    function getEducationDescription(entry) {
        if (entry.details) return entry.details

        const degree = entry.degree || "Study"
        const institution = entry.institution || "institution"
        if (entry.year) {
            return degree + " completed at " + institution + " in " + entry.year + "."
        }
        return degree + " completed at " + institution + "."
    }

    /* ── helper: build 3-slot curved keyword ring ── */
    function buildKeywordRing(keywords, color) {
        const slots = normalizeKeywords(keywords)
        const size = 190
        const cx = size / 2
        const cy = size / 2
        const discRadius = 79
        const avatarEdgeRadius = 51
        const contentRadius = (discRadius + avatarEdgeRadius) / 2
        const segmentLength = (2 * Math.PI * contentRadius) / 3
        const usableSegmentLength = segmentLength * 0.82
        const sharedFontSize = slots
            .filter(Boolean)
            .map((keyword) => getKeywordFontSize(keyword, usableSegmentLength))
            .reduce((smallest, current) => Math.min(smallest, current), 11)
        const arcDefs = [
            // reverse: true flips the sweep direction so text at the bottom
            // of the ring is right-side-up rather than upside-down.
            // All arcs use contentRadius; dominant-baseline: central on the
            // <text> element centres the glyphs within the ring band.
            { key: "bottom", start: 40, end: 140, reverse: true, radius: contentRadius },
            { key: "top-left", start: 160, end: 260, radius: contentRadius },
            { key: "top-right", start: 280, end: 380, radius: contentRadius },
        ]

        const svgEl = document.createElementNS(NS, "svg")
        svgEl.setAttribute("viewBox", "0 0 " + size + " " + size)
        svgEl.setAttribute("width", size)
        svgEl.setAttribute("height", size)
        svgEl.classList.add("mlp-node__keyword-ring")
        svgEl.setAttribute("aria-hidden", "true")
        if (color) svgEl.style.setProperty("--node-color", color)

        const defs = document.createElementNS(NS, "defs")
        svgEl.appendChild(defs)

        const disc = document.createElementNS(NS, "circle")
        disc.setAttribute("cx", cx)
        disc.setAttribute("cy", cy)
        disc.setAttribute("r", discRadius)
        disc.classList.add("mlp-keyword-disc")
        svgEl.appendChild(disc)
        ;[150, 270, 390].forEach((angle) => {
            const point = toCartesian(cx, cy, contentRadius, angle)
            const dot = document.createElementNS(NS, "circle")
            dot.setAttribute("cx", point.x)
            dot.setAttribute("cy", point.y)
            dot.setAttribute("r", "2.5")
            dot.classList.add("mlp-keyword-separator")
            svgEl.appendChild(dot)
        })

        arcDefs.forEach((arc, index) => {
            const pathId = "kw-" + arc.key + "-" + Math.random().toString(36).slice(2, 9)
            const pathDef = buildArcPath(cx, cy, arc.radius, arc.start, arc.end, arc.reverse)

            const guide = document.createElementNS(NS, "path")
            guide.id = pathId
            guide.setAttribute("d", pathDef)
            guide.setAttribute("fill", "none")
            defs.appendChild(guide)

            const keyword = slots[index]
            if (!keyword) return

            const text = document.createElementNS(NS, "text")
            text.classList.add("mlp-keyword-text")
            text.setAttribute("font-size", sharedFontSize.toFixed(2))
            text.setAttribute("dominant-baseline", "central")

            const textPath = document.createElementNS(NS, "textPath")
            textPath.setAttribute("href", "#" + pathId)
            textPath.setAttribute("startOffset", "50%")
            textPath.setAttribute("text-anchor", "middle")
            textPath.textContent = keyword.toUpperCase()
            text.appendChild(textPath)
            svgEl.appendChild(text)
        })

        return svgEl
    }

    fetch("people/people_manifest.json")
        .then((r) => r.json())
        .then((manifest) => {
            const container = document.getElementById("people-grid")
            if (!container) return

            function activatePeopleTab(tab) {
                document.querySelectorAll(".people-tab-btn").forEach((button) => {
                    const isActive = button.dataset.tab === tab
                    button.classList.toggle("people-tab-btn--active", isActive)
                    button.setAttribute("aria-selected", isActive ? "true" : "false")
                })

                document.querySelectorAll(".people-tab-panel").forEach((panel) => {
                    panel.hidden = panel.id !== "people-tab-" + tab
                })
            }

            document.querySelectorAll(".people-tab-btn").forEach((button) => {
                button.addEventListener("click", () => {
                    activatePeopleTab(button.dataset.tab || "lab")
                })
            })

            activatePeopleTab("lab")

            container.innerHTML = ""
            container.classList.add("mlp-network")

            /* ── Build layers ── */
            const layers = []

            /* ── Profile panel (singleton) ── */
            const backdrop = document.createElement("div")
            backdrop.className = "profile-panel__backdrop"
            document.body.appendChild(backdrop)

            const panel = document.createElement("div")
            panel.className = "profile-panel"
            panel.innerHTML =
                '<button class="profile-panel__close" aria-label="Close">&times;</button>' + '<div class="profile-panel__body"></div>'
            document.body.appendChild(panel)

            const panelBody = panel.querySelector(".profile-panel__body")
            const panelClose = panel.querySelector(".profile-panel__close")

            function closePanel() {
                panel.classList.remove("is-open")
                backdrop.classList.remove("is-visible")
            }

            panelClose.addEventListener("click", closePanel)
            backdrop.addEventListener("click", closePanel)
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") closePanel()
            })

            function openProfile(m) {
                panelBody.innerHTML = ""

                // Remove any previous floating discover button
                const oldDiscover = panel.querySelector(".profile-panel__discover")
                if (oldDiscover) oldDiscover.remove()

                const fallbackDetails = (m.details || m.description || "").trim()
                const summaryHtml = normalizeSummaryHtml(m.summary, fallbackDetails)
                const interests = normalizeTextList(m.interests)
                const education = normalizeEducationEntries(m.education)
                const socials = normalizeSocials(m)
                const categoryLabel = CATEGORY_LABELS[m.category] || m.category
                const titleText = (m.title || "").trim() || categoryLabel
                const affiliation = (m.affiliation || "").trim()
                const location = (m.location || "").trim()

                const hero = document.createElement("div")
                hero.className = "profile-panel__hero"

                const sidebar = document.createElement("aside")
                sidebar.className = "profile-panel__sidebar"

                const img = document.createElement("img")
                img.src = m.avatar || DEFAULT_AVATAR
                img.alt = m.name
                img.className = "profile-panel__avatar"
                sidebar.appendChild(img)

                const name = document.createElement("h1")
                name.className = "profile-panel__name"
                name.textContent = m.name
                sidebar.appendChild(name)

                const title = document.createElement("div")
                title.className = "profile-panel__title"
                title.textContent = titleText
                sidebar.appendChild(title)

                if (affiliation || location) {
                    const affiliationBlock = document.createElement("div")
                    affiliationBlock.className = "profile-panel__affiliation"

                    if (affiliation) {
                        const affiliationLine = document.createElement("div")
                        affiliationLine.textContent = affiliation
                        affiliationBlock.appendChild(affiliationLine)
                    }

                    if (location) {
                        const locationLine = document.createElement("div")
                        locationLine.textContent = location
                        affiliationBlock.appendChild(locationLine)
                    }

                    sidebar.appendChild(affiliationBlock)
                }

                if (m.email || socials.length) {
                    const contact = document.createElement("div")
                    contact.className = "profile-panel__contact"

                    if (m.email) {
                        const emailLink = document.createElement("a")
                        emailLink.className = "profile-panel__email"
                        emailLink.href = "mailto:" + m.email
                        emailLink.textContent = m.email
                        contact.appendChild(emailLink)
                    }

                    if (socials.length) {
                        const socialWrap = document.createElement("div")
                        socialWrap.className = "profile-panel__socials"
                        socials.forEach((social) => {
                            const link = document.createElement("a")
                            link.className = "profile-panel__social"
                            link.href = social.url
                            link.target = "_blank"
                            link.rel = "noopener noreferrer"
                            link.setAttribute("aria-label", social.label)
                            link.title = social.label
                            link.appendChild(createSocialIcon(getSocialIconType(social.label, social.url)))
                            socialWrap.appendChild(link)
                        })
                        contact.appendChild(socialWrap)
                    }

                    sidebar.appendChild(contact)
                }

                hero.appendChild(sidebar)

                const main = document.createElement("div")
                main.className = "profile-panel__main"

                if (summaryHtml) {
                    const summary = document.createElement("div")
                    summary.className = "profile-panel__summary"
                    // Summary content is trusted author-provided HTML from local profile data.
                    summary.innerHTML = summaryHtml
                    main.appendChild(summary)
                }

                hero.appendChild(main)
                panelBody.appendChild(hero)

                let funFactBox = null
                if (m.hook) {
                    funFactBox = document.createElement("aside")
                    funFactBox.className = "profile-panel__fun-fact"

                    const label = document.createElement("div")
                    label.className = "profile-panel__fun-fact-label"
                    label.textContent = "Fun fact"
                    funFactBox.appendChild(label)

                    const text = document.createElement("p")
                    text.className = "profile-panel__fun-fact-text"
                    text.textContent = m.hook
                    funFactBox.appendChild(text)
                }

                if (interests.length || education.length) {
                    const sections = document.createElement("div")
                    sections.className = "profile-panel__sections"

                    if (interests.length) {
                        const section = document.createElement("section")
                        section.className = "profile-panel__section"

                        const title = document.createElement("h2")
                        title.className = "profile-panel__section-title"
                        title.textContent = "Interests"
                        section.appendChild(title)

                        const list = document.createElement("ul")
                        list.className = "profile-panel__interest-list"
                        interests.forEach((interest) => {
                            const item = document.createElement("li")
                            item.textContent = interest
                            list.appendChild(item)
                        })
                        section.appendChild(list)
                        sections.appendChild(section)
                    }

                    if (education.length) {
                        const section = document.createElement("section")
                        section.className = "profile-panel__section"

                        const title = document.createElement("h2")
                        title.className = "profile-panel__section-title"
                        title.textContent = "Education"
                        section.appendChild(title)

                        const timeline = document.createElement("div")
                        timeline.className = "profile-panel__education-timeline"

                        const rail = document.createElement("div")
                        rail.className = "profile-panel__education-rail"

                        const detail = document.createElement("div")
                        detail.className = "profile-panel__education-detail"

                        const detailYear = document.createElement("div")
                        detailYear.className = "profile-panel__education-detail-year"
                        detail.appendChild(detailYear)

                        const detailDegree = document.createElement("div")
                        detailDegree.className = "profile-panel__education-detail-degree"
                        detail.appendChild(detailDegree)

                        const detailInstitution = document.createElement("div")
                        detailInstitution.className = "profile-panel__education-detail-meta"
                        detail.appendChild(detailInstitution)

                        const detailText = document.createElement("p")
                        detailText.className = "profile-panel__education-detail-text"
                        detail.appendChild(detailText)

                        const stops = []
                        function clearActiveEducation() {
                            stops.forEach((stop) => {
                                stop.classList.remove("is-active")
                                stop.setAttribute("aria-pressed", "false")
                            })
                            detail.classList.remove("is-visible")
                            detail.setAttribute("aria-hidden", "true")
                            detailYear.textContent = ""
                            detailDegree.textContent = ""
                            detailInstitution.textContent = ""
                            detailText.textContent = ""
                        }

                        function setActiveEducation(index) {
                            stops.forEach((stop, stopIndex) => {
                                stop.classList.toggle("is-active", stopIndex === index)
                                stop.setAttribute("aria-pressed", stopIndex === index ? "true" : "false")
                            })

                            const entry = education[index]
                            if (!entry) return

                            detail.classList.add("is-visible")
                            detail.setAttribute("aria-hidden", "false")
                            detailYear.textContent = entry.year || "Timeline"
                            detailDegree.textContent = entry.degree || entry.institution || entry.year || "Education"
                            detailInstitution.textContent = entry.institution || ""
                            detailText.textContent = getEducationDescription(entry)
                        }

                        education.forEach((entry, index) => {
                            const stop = document.createElement("button")
                            stop.type = "button"
                            stop.className = "profile-panel__education-stop"
                            stop.setAttribute("aria-pressed", "false")

                            const stopYear = document.createElement("span")
                            stopYear.className = "profile-panel__education-stop-year"
                            stopYear.textContent = entry.year || "Now"
                            stop.appendChild(stopYear)

                            const stopBody = document.createElement("span")
                            stopBody.className = "profile-panel__education-stop-body"

                            const stopTitle = document.createElement("span")
                            stopTitle.className = "profile-panel__education-stop-title"
                            stopTitle.textContent = entry.degree || entry.institution || entry.year || "Education"
                            stopBody.appendChild(stopTitle)

                            const stopMeta = document.createElement("span")
                            stopMeta.className = "profile-panel__education-stop-meta"
                            stopMeta.textContent = entry.institution || getEducationDescription(entry)
                            stopBody.appendChild(stopMeta)

                            stop.appendChild(stopBody)

                            stop.addEventListener("mouseenter", () => setActiveEducation(index))
                            stop.addEventListener("focus", () => setActiveEducation(index))
                            stop.addEventListener("click", () => setActiveEducation(index))

                            rail.appendChild(stop)
                            stops.push(stop)
                        })

                        rail.addEventListener("mouseleave", () => {
                            if (!timeline.contains(document.activeElement)) {
                                clearActiveEducation()
                            }
                        })

                        timeline.addEventListener("focusout", () => {
                            requestAnimationFrame(() => {
                                if (!timeline.contains(document.activeElement)) {
                                    clearActiveEducation()
                                }
                            })
                        })

                        clearActiveEducation()

                        timeline.appendChild(rail)
                        timeline.appendChild(detail)
                        section.appendChild(timeline)
                        sections.appendChild(section)
                    }

                    panelBody.appendChild(sections)
                }

                if (funFactBox) {
                    panelBody.appendChild(funFactBox)
                }

                /* ── Discover: floating button at bottom right ── */
                const others = manifest.members.filter((o) => o.folder !== m.folder)
                if (others.length) {
                    const other = others[Math.floor(Math.random() * others.length)]
                    const btn = document.createElement("button")
                    btn.className = "profile-panel__discover"
                    btn.type = "button"
                    btn.style.setProperty("--discover-color", CATEGORY_COLORS[other.category] || "rgba(85,153,255,0.94)")

                    const otherImg = document.createElement("img")
                    otherImg.src = other.avatar || DEFAULT_AVATAR
                    otherImg.alt = other.name
                    otherImg.className = "profile-panel__discover-avatar"
                    btn.appendChild(otherImg)

                    const hookText = document.createElement("span")
                    hookText.className = "profile-panel__discover-text"
                    hookText.textContent = other.hook || "Meet " + other.name + "!"
                    btn.appendChild(hookText)

                    btn.addEventListener("click", (e) => {
                        e.stopPropagation()
                        panel.scrollTo({ top: 0, behavior: "smooth" })
                        openProfile(other)
                    })

                    // Append to panel (outside body) so it floats fixed
                    panel.appendChild(btn)
                }

                panel.classList.add("is-open")
                backdrop.classList.add("is-visible")
            }

            manifest.roles.forEach((category, li) => {
                const members = manifest.by_role[category]
                if (!members || !members.length) return

                const layer = document.createElement("div")
                layer.className = "mlp-layer"
                layer.style.setProperty("--layer-index", li)
                layer.style.setProperty("--member-count", members.length)
                layer.style.setProperty("--layer-color", CATEGORY_COLORS[category] || "transparent")
                layer.classList.add("mlp-layer--count-" + Math.min(members.length, 4))

                /* label — category name only, rendered vertically via CSS */
                const label = document.createElement("div")
                label.className = "mlp-layer__label"
                const roleName = document.createElement("span")
                roleName.className = "mlp-layer__role"
                roleName.textContent = CATEGORY_LABELS[category] || category
                label.appendChild(roleName)
                layer.appendChild(label)

                /* nodes */
                const nodesWrap = document.createElement("div")
                nodesWrap.className = "mlp-layer__nodes"

                const nodes = []
                members.forEach((m) => {
                    const node = document.createElement("div")
                    node.className = "mlp-node"
                    node.dataset.member = m.folder
                    node.style.setProperty("--node-color", CATEGORY_COLORS[category] || "rgba(85,153,255,0.94)")

                    /* pulse ring */
                    const pulse = document.createElement("div")
                    pulse.className = "mlp-node__pulse"
                    node.appendChild(pulse)

                    /* avatar ring */
                    const ring = document.createElement("div")
                    ring.className = "mlp-node__ring"
                    const img = document.createElement("img")
                    img.src = m.avatar || DEFAULT_AVATAR
                    img.alt = m.name
                    img.className = "mlp-node__avatar"
                    img.loading = "lazy"
                    ring.appendChild(img)
                    node.appendChild(ring)

                    /* name below avatar */
                    const nameEl = document.createElement("span")
                    nameEl.className = "mlp-node__name"
                    nameEl.textContent = m.name
                    node.appendChild(nameEl)

                    /* curved keyword ring */
                    const catColor = CATEGORY_COLORS[category]
                    const keywordRing = buildKeywordRing(m.keywords, catColor)
                    if (keywordRing) node.appendChild(keywordRing)

                    /* click → open profile panel */
                    node.addEventListener("click", () => openProfile(m))
                    node.style.cursor = "pointer"

                    nodesWrap.appendChild(node)
                    nodes.push(node)
                })

                layer.appendChild(nodesWrap)
                container.appendChild(layer)
                layers.push({ el: layer, nodes, category })
            })

            /* ──────────────── Intersection Observer — reveal ──────────────── */
            const section = document.getElementById("sec-people-full")
            if (section) {
                const obs = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((e) => {
                            if (e.isIntersecting) {
                                container.classList.add("is-visible")
                                obs.unobserve(section)
                            }
                        })
                    },
                    { threshold: 0.12 },
                )
                obs.observe(section)
            }

            /* ──────────────── Hover interactions ──────────────── */
            layers.forEach((layer) => {
                layer.nodes.forEach((node) => {
                    node.addEventListener("mouseenter", () => node.classList.add("is-active"))
                    node.addEventListener("mouseleave", () => node.classList.remove("is-active"))
                })
            })
        })
        .catch((err) => console.warn("Could not load people manifest:", err))
})()
