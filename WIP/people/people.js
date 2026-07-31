import { openImageLightbox } from "../shared/media-lightbox.js"
import { buildMemoryMeta, getMemoriesManifest } from "../shared/memories-data.js"
import { registerProfileActions } from "../shared/profile-api.js"
import { initMarginTabNav, swapTabPanels } from "../shared/tab-slide.js"

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

    /* Accent per level — drives the node circle and the member's profile panel.
       Values are the site section palette (see :root in css/01-base.css) so the
       people section stays inside the same set of hues. */
    const CATEGORY_COLORS = {
        PI: "rgba(85, 153, 255, 0.94)", // #5599ff blue
        Postdoc: "rgba(51, 204, 204, 0.94)", // #33cccc teal
        "PhD Student": "rgba(85, 204, 119, 0.94)", // #55cc77 green
        "Research Assistant": "rgba(255, 85, 85, 0.94)", // #ff5555 red
        Alumni: "rgba(170, 85, 255, 0.94)", // #aa55ff purple, matching their band
    }

    const DEFAULT_ACCENT = "rgba(170, 85, 255, 0.94)"

    function accentFor(category) {
        return CATEGORY_COLORS[category] || DEFAULT_ACCENT
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

    function hasHtmlMarkup(value) {
        return /<[a-z!/][^>]*>/i.test(value)
    }

    function normalizeRichHtml(content, fallback) {
        if (typeof content === "string" && content.trim()) {
            const trimmed = content.trim()
            return /<[a-z!/][^>]*>/i.test(trimmed) ? trimmed : paragraphizePlainText(trimmed)
        }

        if (Array.isArray(content)) {
            const items = content.map((item) => (item == null ? "" : String(item).trim())).filter(Boolean)
            if (items.length) {
                return items.map(paragraphizePlainText).join("")
            }
        }

        const safeFallback = (fallback || "").trim()
        return safeFallback ? paragraphizePlainText(safeFallback) : ""
    }

    function normalizePlainPreview(value) {
        const safeValue = (value || "").trim()
        if (!safeValue) return ""
        return hasHtmlMarkup(safeValue) ? "" : safeValue
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

    function normalizeExperienceEntries(value) {
        if (!Array.isArray(value)) return []

        return value
            .map((item) => {
                if (!item || typeof item !== "object") return null
                const degree = (item.degree || item.course || item.title || "").trim()
                const institution = (item.institution || item.school || item.organization || "").trim()
                const year = item.year == null ? "" : String(item.year).trim()
                const details = (item.details || item.description || item.notes || "").trim()
                const logo = (item.logo || item.image || item.icon || "").trim()
                if (!degree && !institution && !year) return null
                return { degree, institution, year, details, logo }
            })
            .filter(Boolean)
    }

    var SI_CDN = "https://cdn.jsdelivr.net/npm/simple-icons@v13/icons/"
    var SI_SLUGS = [
        ["scholar", "googlescholar"],
        ["github", "github"],
        ["researchgate", "researchgate"],
        ["x.com", "x"],
        ["twitter", "x"],
        ["linkedin", "linkedin"],
        ["orcid", "orcid"],
    ]

    function createSocialIcon(label, url) {
        const haystack = (label + " " + url).toLowerCase()
        for (var si = 0; si < SI_SLUGS.length; si++) {
            if (haystack.includes(SI_SLUGS[si][0])) {
                const span = document.createElement("span")
                span.className = "si-icon"
                span.style.setProperty("--si", "url(" + SI_CDN + SI_SLUGS[si][1] + ".svg)")
                span.setAttribute("aria-hidden", "true")
                return span
            }
        }
        // Fallback: custom SVG for website / generic link
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
        if (haystack.includes("website") || haystack.includes("http")) {
            appendCircle("12", "12", "9")
            appendPath("M3 12h18")
            appendPath("M12 3a14.5 14.5 0 0 1 0 18")
            appendPath("M12 3a14.5 14.5 0 0 0 0 18")
        } else {
            appendPath("M10 14l8-8")
            appendPath("M14 6h4v4")
            appendPath("M20 13v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4")
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

    function createEducationLogo(src, className) {
        const safeSrc = (src || "").trim()
        if (!safeSrc) return null

        const logo = document.createElement("img")
        logo.src = safeSrc
        logo.alt = ""
        logo.className = className
        logo.decoding = "async"
        return logo
    }

    /* ── shared profile-panel section builders ── */

    function buildInterestsSection(interests) {
        const section = document.createElement("section")
        section.className = "profile-panel__section"
        const heading = document.createElement("h2")
        heading.className = "profile-panel__section-title"
        heading.textContent = "Interests"
        section.appendChild(heading)
        const list = document.createElement("ul")
        list.className = "profile-panel__interest-list"
        interests.forEach((interest) => {
            const item = document.createElement("li")
            item.textContent = interest
            list.appendChild(item)
        })
        section.appendChild(list)
        return section
    }

    function splitAchievementText(value) {
        const text = (value || "").trim()
        if (!text) return { title: "", detail: "" }

        const separatorIndex = text.indexOf(":")
        if (separatorIndex === -1) {
            return { title: text, detail: "" }
        }

        return {
            title: text.slice(0, separatorIndex).trim(),
            detail: text.slice(separatorIndex + 1).trim(),
        }
    }

    function buildAchievementsSection(achievements) {
        const section = document.createElement("section")
        section.className = "profile-panel__section profile-panel__achievement-box"

        const heading = document.createElement("h2")
        heading.className = "profile-panel__section-title"
        heading.textContent = achievements.length === 1 ? "Achievement" : "Achievements"
        section.appendChild(heading)

        const list = document.createElement("div")
        list.className = "profile-panel__achievement-list"
        const items = []

        function clearActive() {
            items.forEach(({ toggle, detail }) => {
                toggle.classList.remove("is-active")
                toggle.setAttribute("aria-expanded", "false")
                detail.classList.remove("is-visible")
                detail.setAttribute("aria-hidden", "true")
            })
        }

        function setActive(index) {
            items.forEach(({ toggle, detail }, itemIndex) => {
                const isActive = itemIndex === index
                toggle.classList.toggle("is-active", isActive)
                toggle.setAttribute("aria-expanded", isActive ? "true" : "false")
                detail.classList.toggle("is-visible", isActive)
                detail.setAttribute("aria-hidden", isActive ? "false" : "true")
            })
        }

        achievements.forEach((achievement) => {
            const item = document.createElement("div")
            item.className = "profile-panel__achievement-item"

            const { title, detail } = splitAchievementText(achievement)
            const isExpandable = !!detail
            const toggle = document.createElement(isExpandable ? "button" : "div")
            toggle.className = "profile-panel__achievement-toggle"
            if (isExpandable) {
                toggle.type = "button"
                toggle.setAttribute("aria-expanded", "false")
            } else {
                toggle.classList.add("is-static")
            }

            const marker = document.createElement("span")
            marker.className = "profile-panel__achievement-marker"
            marker.setAttribute("aria-hidden", "true")
            marker.textContent = "★"
            toggle.appendChild(marker)

            const copy = document.createElement("span")
            copy.className = "profile-panel__achievement-copy"

            const titleEl = document.createElement("span")
            titleEl.className = "profile-panel__achievement-title"
            titleEl.textContent = title || achievement
            copy.appendChild(titleEl)
            toggle.appendChild(copy)
            item.appendChild(toggle)

            if (isExpandable) {
                const detailWrap = document.createElement("div")
                detailWrap.className = "profile-panel__achievement-detail"
                detailWrap.setAttribute("aria-hidden", "true")

                const detailEl = document.createElement("p")
                detailEl.className = "profile-panel__achievement-detail-text"
                detailEl.textContent = detail
                detailWrap.appendChild(detailEl)

                toggle.addEventListener("click", () => {
                    if (toggle.classList.contains("is-active")) {
                        clearActive()
                    } else {
                        setActive(items.findIndex((itemEntry) => itemEntry.toggle === toggle))
                    }
                })

                item.appendChild(detailWrap)
                items.push({ toggle, detail: detailWrap })
            }

            list.appendChild(item)
        })

        section.appendChild(list)
        return section
    }

    function buildProfileSections({ interests, experience, achievements }) {
        const leftColumnItems = []
        const rightColumnItems = []

        if (interests.length) leftColumnItems.push(buildInterestsSection(interests))
        if (achievements.length) leftColumnItems.push(buildAchievementsSection(achievements))
        if (experience.length) rightColumnItems.push(buildExperienceSection(experience))

        if (!leftColumnItems.length && !rightColumnItems.length) return null

        const sections = document.createElement("div")
        sections.className = "profile-panel__sections"
        ;[leftColumnItems, rightColumnItems].forEach((items) => {
            if (!items.length) return
            const column = document.createElement("div")
            column.className = "profile-panel__sections-column"
            items.forEach((item) => column.appendChild(item))
            sections.appendChild(column)
        })

        return sections
    }

    function buildExperienceSection(experience) {
        const section = document.createElement("section")
        section.className = "profile-panel__section"
        const heading = document.createElement("h2")
        heading.className = "profile-panel__section-title"
        heading.textContent = "Experience"
        section.appendChild(heading)

        const list = document.createElement("div")
        list.className = "profile-panel__education-list"
        if (experience.length === 1) list.classList.add("has-one-entry")

        const items = []

        function clearActive() {
            items.forEach(({ toggle, detail }) => {
                toggle.classList.remove("is-active")
                toggle.setAttribute("aria-expanded", "false")
                detail.classList.remove("is-visible")
                detail.setAttribute("aria-hidden", "true")
            })
        }

        function setActive(index) {
            items.forEach(({ toggle, detail }, itemIndex) => {
                const isActive = itemIndex === index
                toggle.classList.toggle("is-active", isActive)
                toggle.setAttribute("aria-expanded", isActive ? "true" : "false")
                detail.classList.toggle("is-visible", isActive)
                detail.setAttribute("aria-hidden", isActive ? "false" : "true")
            })
        }

        experience.forEach((entry) => {
            const item = document.createElement("div")
            item.className = "profile-panel__education-item"

            const detailText = (entry.details || "").trim()
            const isExpandable = !!detailText
            const toggle = document.createElement(isExpandable ? "button" : "div")
            toggle.className = "profile-panel__education-toggle"
            if (isExpandable) {
                toggle.type = "button"
                toggle.setAttribute("aria-expanded", "false")
            } else {
                toggle.classList.add("is-static")
            }

            const year = document.createElement("span")
            year.className = "profile-panel__education-year"
            year.textContent = entry.year || "–"
            toggle.appendChild(year)

            const marker = document.createElement("span")
            marker.className = "profile-panel__education-marker"
            marker.setAttribute("aria-hidden", "true")
            toggle.appendChild(marker)

            const card = document.createElement("span")
            card.className = "profile-panel__education-card"

            const copy = document.createElement("span")
            copy.className = "profile-panel__education-copy"

            const title = document.createElement("span")
            title.className = "profile-panel__education-title"
            title.textContent = entry.degree || entry.institution || entry.year || "Experience"
            copy.appendChild(title)

            const metaParts = [entry.institution].filter(Boolean)
            if (metaParts.length) {
                const meta = document.createElement("span")
                meta.className = "profile-panel__education-meta"
                meta.textContent = metaParts.join(" • ")
                copy.appendChild(meta)
            }

            card.appendChild(copy)

            const logo = createEducationLogo(entry.logo, "profile-panel__education-logo")
            if (logo) card.appendChild(logo)

            toggle.appendChild(card)

            item.appendChild(toggle)

            if (isExpandable) {
                const detail = document.createElement("div")
                detail.className = "profile-panel__education-detail"
                detail.setAttribute("aria-hidden", "true")

                const detailBody = document.createElement("p")
                detailBody.className = "profile-panel__education-detail-text"
                detailBody.textContent = detailText
                detail.appendChild(detailBody)

                toggle.addEventListener("click", () => {
                    if (toggle.classList.contains("is-active")) {
                        clearActive()
                    } else {
                        setActive(items.findIndex((itemEntry) => itemEntry.toggle === toggle))
                    }
                })

                item.appendChild(detail)
                items.push({ toggle, detail })
            }

            list.appendChild(item)
        })

        section.appendChild(list)
        return section
    }

    function buildMemoriesSection(folder) {
        const section = document.createElement("section")
        section.className = "profile-panel__memories"
        const heading = document.createElement("h2")
        heading.className = "profile-panel__section-title"
        heading.textContent = "Memories"
        section.appendChild(heading)
        const grid = document.createElement("div")
        grid.className = "profile-panel__memories-grid"
        section.appendChild(grid)
        getMemoriesManifest().then((memories) => {
            const matching = memories.filter((mem) => Array.isArray(mem.people) && mem.people.includes(folder))
            if (!matching.length) {
                section.remove()
                return
            }
            matching.forEach((mem) => {
                const thumb = document.createElement("button")
                thumb.type = "button"
                thumb.className = "profile-panel__memory-thumb"
                thumb.setAttribute("aria-label", mem.caption || mem.title || "View memory")
                const img = document.createElement("img")
                img.src = mem.file
                img.alt = mem.caption || mem.title || ""
                img.loading = "lazy"
                thumb.appendChild(img)
                if (mem.caption) {
                    const cap = document.createElement("span")
                    cap.className = "profile-panel__memory-thumb-caption"
                    cap.textContent = mem.caption
                    thumb.appendChild(cap)
                }
                thumb.addEventListener("click", () =>
                    openImageLightbox({
                        src: mem.file,
                        alt: mem.caption || mem.title || "",
                        label: mem.caption || mem.title || "Memory",
                        title: mem.title || "",
                        caption: mem.caption || "",
                        meta: buildMemoryMeta(mem),
                    }),
                )
                grid.appendChild(thumb)
            })
            if (matching.length > 4) {
                const toggle = document.createElement("button")
                toggle.type = "button"
                toggle.className = "profile-panel__memories-toggle"
                toggle.textContent = "Show more"
                toggle.addEventListener("click", () => {
                    const expanded = grid.classList.toggle("is-expanded")
                    toggle.textContent = expanded ? "Show fewer" : "Show more"
                })
                section.appendChild(toggle)
            }
        })
        return section
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

                swapTabPanels(document.querySelectorAll(".people-tab-panel"), "people-tab-" + tab)
            }

            document.querySelectorAll(".people-tab-btn").forEach((button) => {
                button.addEventListener("click", () => {
                    activatePeopleTab(button.dataset.tab || "lab")
                })
            })

            activatePeopleTab("lab")
            initMarginTabNav(document.querySelector(".people-full"), ".people-tab-btn")

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

            function removeDiscoverButton() {
                const oldDiscover = document.querySelector(".profile-panel__discover")
                if (oldDiscover) oldDiscover.remove()
                panel.classList.remove("profile-panel--has-discover")
            }

            function setPanelTheme(member, isMinimal) {
                const accent = accentFor(member?.category)
                panel.style.setProperty("--profile-accent", accent)
                backdrop.style.setProperty("--profile-accent", accent)
                panel.classList.toggle("profile-panel--minimal", !!isMinimal)
            }

            function closePanel() {
                removeDiscoverButton()
                panel.classList.remove("is-open")
                panel.classList.remove("profile-panel--minimal")
                backdrop.classList.remove("is-visible")
            }

            panelClose.addEventListener("click", closePanel)
            backdrop.addEventListener("click", closePanel)
            document.addEventListener("keydown", (e) => {
                if (e.key === "Escape") closePanel()
            })

            function openMinimalProfile(m) {
                panelBody.innerHTML = ""
                removeDiscoverButton()
                setPanelTheme(m, true)

                const details = normalizePlainPreview(m.details)
                const achievements = normalizeTextList(m.achievements)
                const interests = normalizeTextList(m.interests)
                const experience = normalizeExperienceEntries(m.experience || m.education)

                const header = document.createElement("div")
                header.className = "profile-panel__minimal-header"

                const img = document.createElement("img")
                img.src = m.avatar || m.image || DEFAULT_AVATAR
                img.alt = m.name
                img.className = "profile-panel__avatar profile-panel__avatar--minimal"
                header.appendChild(img)

                const nameEl = document.createElement("h1")
                nameEl.className = "profile-panel__name"
                nameEl.textContent = m.name
                header.appendChild(nameEl)

                if (details) {
                    const detailEl = document.createElement("p")
                    detailEl.className = "profile-panel__minimal-desc"
                    detailEl.textContent = details
                    header.appendChild(detailEl)
                }

                panelBody.appendChild(header)

                const sections = buildProfileSections({ interests, experience, achievements })
                if (sections) {
                    panelBody.appendChild(sections)
                }

                panel.classList.add("is-open")
                backdrop.classList.add("is-visible")
            }

            function openProfile(m) {
                panelBody.innerHTML = ""

                // Remove any previous floating discover button
                removeDiscoverButton()
                setPanelTheme(m, false)

                const summaryHtml = normalizeRichHtml(m.summary)
                const detailsHtml = normalizeRichHtml(m.details)
                const achievements = normalizeTextList(m.achievements)
                const interests = normalizeTextList(m.interests)
                const experience = normalizeExperienceEntries(m.experience || m.education)
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
                            link.appendChild(createSocialIcon(social.label, social.url))
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

                const sections = buildProfileSections({ interests, experience, achievements })
                if (sections) {
                    panelBody.appendChild(sections)
                }

                if (detailsHtml) {
                    const details = document.createElement("div")
                    details.className = "profile-panel__details-content"
                    // Details content is trusted author-provided HTML from local profile data.
                    details.innerHTML = detailsHtml
                    details.querySelectorAll("a").forEach((link) => {
                        if (link.querySelector("img")) {
                            link.classList.add("profile-panel__details-media-link")
                        }
                    })
                    panelBody.appendChild(details)
                }

                /* ── Memories ── */
                panelBody.appendChild(buildMemoriesSection(m.folder))

                /* ── Discover: floating shortcut to another profile ── */
                const others = manifest.members.filter((o) => o.folder !== m.folder && o.category !== "Alumni")
                if (others.length) {
                    const other = others[Math.floor(Math.random() * others.length)]
                    const btn = document.createElement("button")
                    btn.className = "profile-panel__discover"
                    btn.type = "button"
                    btn.style.setProperty("--discover-color", accentFor(other.category))
                    btn.setAttribute("aria-label", "Visit " + other.name + "'s profile")
                    btn.title = other.hook || "Meet " + other.name + "!"

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

                    panel.classList.add("profile-panel--has-discover")
                    document.body.appendChild(btn)
                }

                panel.classList.add("is-open")
                backdrop.classList.add("is-visible")
            }

            registerProfileActions({
                open: openProfile,
                openMinimal: openMinimalProfile,
                // A news byline knows an author's folder and nothing else. The
                // manifest is here, so the lookup is too — an unmatched folder
                // (a guest author) simply opens nothing.
                openByFolder: (folder) => {
                    const member = manifest.members.find((m) => m.folder === folder)
                    if (member) openProfile(member)
                },
            })

            manifest.roles.forEach((category, li) => {
                if (category === "Alumni") return
                const members = manifest.by_role[category]
                if (!members || !members.length) return

                const layer = document.createElement("div")
                layer.className = "mlp-layer"
                layer.style.setProperty("--layer-index", li)
                layer.style.setProperty("--member-count", members.length)

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
                    node.style.setProperty("--node-color", accentFor(category))

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
                    const keywordRing = buildKeywordRing(m.keywords, accentFor(category))
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

            /* ──────────────── Alumni band ──────────────── */
            const alumni = manifest.by_role["Alumni"] || []
            if (alumni.length) {
                const band = document.createElement("div")
                band.className = "alumni-band"

                const trigger = document.createElement("button")
                trigger.type = "button"
                trigger.className = "alumni-band__trigger"
                trigger.setAttribute("aria-expanded", "false")
                trigger.setAttribute("aria-controls", "alumni-band-grid")

                const triggerLabel = document.createElement("span")
                triggerLabel.className = "alumni-band__label"
                triggerLabel.textContent = "Alumni"
                trigger.appendChild(triggerLabel)

                const triggerCount = document.createElement("span")
                triggerCount.className = "alumni-band__count"
                triggerCount.textContent = "" + alumni.length
                trigger.appendChild(triggerCount)

                const triggerChevron = document.createElement("span")
                triggerChevron.className = "alumni-band__chevron"
                triggerChevron.setAttribute("aria-hidden", "true")
                trigger.appendChild(triggerChevron)

                const grid = document.createElement("div")
                grid.id = "alumni-band-grid"
                grid.className = "alumni-band__grid"
                grid.hidden = true

                alumni.forEach((m) => {
                    const card = document.createElement("button")
                    card.type = "button"
                    card.className = "alumni-card"
                    card.setAttribute("aria-label", "View profile of " + m.name)

                    const img = document.createElement("img")
                    img.className = "alumni-card__avatar"
                    img.src = m.avatar || DEFAULT_AVATAR
                    img.alt = m.name
                    img.loading = "lazy"
                    card.appendChild(img)

                    const nameEl = document.createElement("span")
                    nameEl.className = "alumni-card__name"
                    nameEl.textContent = m.name
                    card.appendChild(nameEl)

                    const detailPreview = normalizePlainPreview(m.details)
                    if (detailPreview) {
                        const detailEl = document.createElement("span")
                        detailEl.className = "alumni-card__details"
                        detailEl.textContent = detailPreview
                        card.appendChild(detailEl)
                    }

                    card.addEventListener("click", () => openMinimalProfile(m))
                    grid.appendChild(card)
                })

                trigger.addEventListener("click", () => {
                    const open = trigger.getAttribute("aria-expanded") === "true"
                    trigger.setAttribute("aria-expanded", !open)
                    grid.hidden = open
                    trigger.classList.toggle("is-open", !open)
                })

                band.appendChild(trigger)
                band.appendChild(grid)
                container.appendChild(band)
            }

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
