/* memories.js
 * Renders the Memories tab gallery.
 * Fetches memories/memories_manifest.json, groups images by year,
 * and displays a responsive masonry-style grid with a lightbox viewer.
 */
;(function () {
    const MANIFEST_PATH = "memories/memories_manifest.json"

    // ── Wait for the memories tab panel to exist in the DOM ──────────────────
    function init() {
        const container = document.getElementById("memories-gallery")
        if (!container) return

        fetch(MANIFEST_PATH, { cache: "no-store" })
            .then((r) => r.json())
            .then((manifest) => render(container, manifest.memories || []))
            .catch((err) => {
                console.error("memories.js: failed to load manifest", err)
            })
    }

    // ── Group memories by year (descending) ──────────────────────────────────
    function groupByYear(memories) {
        const map = new Map()
        for (const m of memories) {
            const yr = m.year || 0
            if (!map.has(yr)) map.set(yr, [])
            map.get(yr).push(m)
        }
        // Sort years descending
        return Array.from(map.entries()).sort((a, b) => b[0] - a[0])
    }

    // ── Build the lightbox singleton ──────────────────────────────────────────
    function buildLightbox() {
        const lb = document.createElement("div")
        lb.className = "memories-lightbox"
        lb.setAttribute("role", "dialog")
        lb.setAttribute("aria-modal", "true")
        lb.setAttribute("aria-label", "Memory viewer")
        lb.innerHTML = `
            <div class="memories-lightbox__backdrop"></div>
            <div class="memories-lightbox__frame">
                <button class="memories-lightbox__close" aria-label="Close">&times;</button>
                <img class="memories-lightbox__img" src="" alt="" />
                <div class="memories-lightbox__info">
                    <p class="memories-lightbox__title"></p>
                    <p class="memories-lightbox__caption"></p>
                    <p class="memories-lightbox__meta"></p>
                </div>
            </div>
        `
        document.body.appendChild(lb)

        const backdrop = lb.querySelector(".memories-lightbox__backdrop")
        const closeBtn = lb.querySelector(".memories-lightbox__close")
        const img = lb.querySelector(".memories-lightbox__img")
        const titleEl = lb.querySelector(".memories-lightbox__title")
        const captionEl = lb.querySelector(".memories-lightbox__caption")
        const metaEl = lb.querySelector(".memories-lightbox__meta")

        function open(memory) {
            img.src = memory.file
            img.alt = memory.title || memory.filename || ""
            titleEl.textContent = memory.title || ""
            captionEl.textContent = memory.caption || ""

            const metaParts = []
            if (memory.year) metaParts.push(memory.year)
            if (memory.location) metaParts.push(memory.location)
            if (memory.people && memory.people.length) metaParts.push(memory.people.join(", "))
            metaEl.textContent = metaParts.join(" · ")

            lb.classList.add("is-open")
            closeBtn.focus()
        }

        function close() {
            lb.classList.remove("is-open")
            img.src = ""
        }

        backdrop.addEventListener("click", close)
        closeBtn.addEventListener("click", close)
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && lb.classList.contains("is-open")) close()
        })

        return { open }
    }

    // ── Render the full gallery ───────────────────────────────────────────────
    function render(container, memories) {
        if (!memories.length) {
            container.innerHTML = '<p class="memories-empty">No memories yet.</p>'
            return
        }

        const lightbox = buildLightbox()
        const groups = groupByYear(memories)

        for (const [year, items] of groups) {
            const section = document.createElement("div")
            section.className = "memories-year"

            const heading = document.createElement("h3")
            heading.className = "memories-year__label"
            heading.textContent = year || "Earlier"
            section.appendChild(heading)

            const grid = document.createElement("div")
            grid.className = "memories-year__grid"

            for (const memory of items) {
                const card = document.createElement("button")
                card.type = "button"
                card.className = "memories-card"
                card.setAttribute("aria-label", memory.title || memory.filename || "Memory")

                const img = document.createElement("img")
                img.className = "memories-card__img"
                img.src = memory.file
                img.alt = memory.title || memory.filename || ""
                img.loading = "lazy"
                img.decoding = "async"
                card.appendChild(img)

                if (memory.title) {
                    const overlay = document.createElement("div")
                    overlay.className = "memories-card__overlay"
                    overlay.textContent = memory.title
                    card.appendChild(overlay)
                }

                card.addEventListener("click", () => lightbox.open(memory))
                grid.appendChild(card)
            }

            section.appendChild(grid)
            container.appendChild(section)
        }
    }

    // ── Bootstrap ─────────────────────────────────────────────────────────────
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init)
    } else {
        init()
    }
})()
