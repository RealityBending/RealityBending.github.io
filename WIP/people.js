/* people.js
 * Renders the People section as a Multi-Layered Perceptron (MLP) diagram.
 * Fetches people_manifest.json, builds one layer per role (PI → Postdoc →
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

    fetch("people_manifest.json")
        .then((r) => r.json())
        .then((manifest) => {
            const container = document.getElementById("people-grid")
            if (!container) return

            container.innerHTML = ""
            container.classList.add("mlp-network")

            /* ── SVG overlay for connections ── */
            const svg = document.createElementNS(NS, "svg")
            svg.classList.add("mlp-connections")
            svg.setAttribute("aria-hidden", "true")

            const defs = document.createElementNS(NS, "defs")

            /* glow filter for active paths */
            const filter = document.createElementNS(NS, "filter")
            filter.id = "conn-glow"
            filter.innerHTML =
                '<feGaussianBlur stdDeviation="3" result="blur"/>' +
                '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>'
            defs.appendChild(filter)

            svg.appendChild(defs)
            container.appendChild(svg)

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

                /* ── Header: name at the top ── */
                const header = document.createElement("div")
                header.className = "profile-panel__header"

                const name = document.createElement("div")
                name.className = "profile-panel__name"
                name.textContent = m.name
                header.appendChild(name)

                panelBody.appendChild(header)

                /* ── Two-column area ── */
                const columns = document.createElement("div")
                columns.className = "profile-panel__columns"

                /* ── Sidebar: avatar, keywords, email ── */
                const sidebar = document.createElement("div")
                sidebar.className = "profile-panel__sidebar"

                const img = document.createElement("img")
                img.src = m.avatar || DEFAULT_AVATAR
                img.alt = m.name
                img.className = "profile-panel__avatar"
                sidebar.appendChild(img)

                const kws = Array.isArray(m.keywords) ? m.keywords.filter(Boolean) : []
                if (kws.length) {
                    const wrap = document.createElement("div")
                    wrap.className = "profile-panel__keywords"
                    kws.forEach((kw) => {
                        const tag = document.createElement("span")
                        tag.className = "profile-panel__keyword"
                        tag.textContent = kw
                        wrap.appendChild(tag)
                    })
                    sidebar.appendChild(wrap)
                }

                if (m.email) {
                    const links = document.createElement("div")
                    links.className = "profile-panel__links"
                    const a = document.createElement("a")
                    a.className = "profile-panel__link"
                    a.href = "mailto:" + m.email
                    a.textContent = m.email
                    links.appendChild(a)
                    sidebar.appendChild(links)
                }

                columns.appendChild(sidebar)

                /* ── Main: category, details ── */
                const main = document.createElement("div")
                main.className = "profile-panel__main"

                const cat = document.createElement("div")
                cat.className = "profile-panel__role"
                cat.textContent = CATEGORY_LABELS[m.category] || m.category
                main.appendChild(cat)

                const details = m.details || m.description || ""
                if (details) {
                    const p = document.createElement("p")
                    p.className = "profile-panel__details"
                    p.textContent = details
                    main.appendChild(p)
                }

                if (m.website) {
                    const links = document.createElement("div")
                    links.className = "profile-panel__links"
                    const a = document.createElement("a")
                    a.className = "profile-panel__link"
                    a.href = m.website
                    a.target = "_blank"
                    a.rel = "noopener noreferrer"
                    a.textContent = "Website"
                    links.appendChild(a)
                    main.appendChild(links)
                }

                columns.appendChild(main)
                panelBody.appendChild(columns)

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

            /* ──────────────── SVG connection drawing ──────────────── */
            let pathEls = [] // { path, from, to }

            function drawConnections() {
                /* remove old elements */
                pathEls.forEach((p) => {
                    p.path.remove()
                })
                pathEls = []

                const cRect = container.getBoundingClientRect()
                const sl = container.scrollLeft
                const st = container.scrollTop
                const w = container.scrollWidth
                const h = container.scrollHeight
                svg.setAttribute("viewBox", "0 0 " + w + " " + h)
                svg.style.width = w + "px"
                svg.style.height = h + "px"

                /* reusable fragment to batch DOM appends */
                const frag = document.createDocumentFragment()
                let idx = 0

                for (let i = 0; i < layers.length - 1; i++) {
                    const fromNodes = layers[i].nodes
                    const toNodes = layers[i + 1].nodes

                    fromNodes.forEach((fn) => {
                        const fromRing = fn.querySelector(".mlp-node__ring") || fn
                        const fr = fromRing.getBoundingClientRect()
                        const fx = fr.left + fr.width * 0.5 - cRect.left + sl
                        const fy = fr.bottom - cRect.top + st

                        toNodes.forEach((tn) => {
                            const toRing = tn.querySelector(".mlp-node__ring") || tn
                            const tr = toRing.getBoundingClientRect()
                            const tx = tr.left + tr.width * 0.5 - cRect.left + sl
                            const ty = tr.top - cRect.top + st

                            const midY = (fy + ty) * 0.5
                            const d = "M" + fx + " " + fy + "C" + fx + " " + midY + " " + tx + " " + midY + " " + tx + " " + ty

                            const path = document.createElementNS(NS, "path")
                            path.setAttribute("d", d)
                            path.classList.add("mlp-connection")
                            path.dataset.from = fn.dataset.member
                            path.dataset.to = tn.dataset.member

                            const pid = "c" + idx++
                            path.id = pid

                            frag.appendChild(path)

                            pathEls.push({ path, from: fn.dataset.member, to: tn.dataset.member })
                        })
                    })
                }

                svg.appendChild(frag)

                /* set stroke-dasharray/offset after paths are in the DOM */
                pathEls.forEach((p) => {
                    const len = p.path.getTotalLength()
                    p.path.setAttribute("stroke-dasharray", len)
                    p.path.setAttribute("stroke-dashoffset", len)
                })
            }

            /* initial draw (two rAFs to guarantee layout) */
            requestAnimationFrame(() => requestAnimationFrame(drawConnections))

            /* redraw on resize — debounced */
            let rsTimer
            window.addEventListener("resize", () => {
                clearTimeout(rsTimer)
                rsTimer = setTimeout(drawConnections, 250)
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
                    node.addEventListener("mouseenter", () => {
                        node.classList.add("is-active")
                        const id = node.dataset.member

                        const connected = new Set()
                        connected.add(id)
                        pathEls.forEach((p) => {
                            if (p.from === id || p.to === id) {
                                p.path.classList.add("is-active")
                                connected.add(p.from)
                                connected.add(p.to)
                            } else {
                                p.path.classList.add("is-dimmed")
                            }
                        })

                        layers.forEach((l) =>
                            l.nodes.forEach((n) => {
                                if (connected.has(n.dataset.member)) {
                                    n.classList.add("is-connected")
                                } else {
                                    n.classList.add("is-dimmed")
                                }
                            }),
                        )
                    })

                    node.addEventListener("mouseleave", () => {
                        node.classList.remove("is-active")
                        pathEls.forEach((p) => p.path.classList.remove("is-active", "is-dimmed"))
                        layers.forEach((l) => l.nodes.forEach((n) => n.classList.remove("is-dimmed", "is-connected")))
                    })
                })
            })
        })
        .catch((err) => console.warn("Could not load people manifest:", err))
})()
