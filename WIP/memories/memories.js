import { openImageLightbox } from "../shared/media-lightbox.js"
import { buildMemoryMeta, getMemoriesManifest } from "../shared/memories-data.js"

/* memories.js
 * Renders the Memories tab gallery.
 * Fetches memories/memories_manifest.json, groups images by year,
 * and displays a responsive masonry-style grid with a lightbox viewer.
 */
;(function () {
    // ── Wait for the memories tab panel to exist in the DOM ──────────────────
    function init() {
        const container = document.getElementById("memories-gallery")
        if (!container) return

        getMemoriesManifest()
            .then((memories) => render(container, memories))
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

    // ── Render the full gallery ───────────────────────────────────────────────
    function render(container, memories) {
        if (!memories.length) {
            container.innerHTML = '<p class="memories-empty">No memories yet.</p>'
            return
        }

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

                card.addEventListener("click", () =>
                    openImageLightbox({
                        src: memory.file,
                        alt: memory.title || memory.filename || "",
                        label: memory.title || memory.filename || "Memory",
                        title: memory.title || "",
                        caption: memory.caption || "",
                        meta: buildMemoryMeta(memory),
                    }),
                )
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
