import { openImageLightbox, closeImageLightbox, isImageLightboxOpen } from "../shared/media-lightbox.js"
import { buildMemoryMeta, getMemoriesManifest } from "../shared/memories-data.js"
import { INITIAL_ROUTE, onRoute, writeRoute } from "../shared/deep-link.js"
import { registerRouteTitle } from "../shared/page-meta.js"

/* memories.js
 * Renders the Memories tab gallery.
 * Fetches memories/memories_manifest.json, groups images by year,
 * and displays a responsive masonry-style grid with a lightbox viewer.
 *
 * ── Every picture has an address ──
 * Opening one writes `/people/memories/<slug>/`, which generate_pages.py serves
 * as a real page carrying that image as its `og:image` — so the link in the
 * address bar is the link to send someone, and a chat client previewing it
 * shows the photograph rather than the site's card. Closing writes the tab's own
 * route back.
 *
 * The slug comes from the manifest (update_people.py, `memory_slug`), so it is
 * derived from the image's filename and nothing here has to invent an id.
 *
 * Two things this deliberately does not do:
 *
 *  - **It does not switch to the Memories tab, or scroll.** people.js owns the
 *    tab machinery and claims a `memory-` route for exactly that much, then
 *    arms `landOnLoad`. Clicking the tab button from here — the join.js idiom —
 *    would race the manifest that button's listener is waiting on.
 *  - **It does not write a route when it is *applying* one.** `openMemory`
 *    takes the same `write` flag every other "activate" on this site takes, and
 *    it is false when the change came out of the URL.
 */
;(function () {
    /* slug -> memory, filled when the manifest lands. `applyRoute` is called
       before that on a page opened directly on a memory's URL, so the initial
       route is re-applied inside the `.then` like every other section's. */
    const bySlug = new Map()

    function openMemory(memory, write) {
        openImageLightbox({
            src: memory.file,
            alt: memory.title || memory.filename || "",
            label: memory.title || memory.filename || "Memory",
            title: memory.title || "",
            caption: memory.caption || "",
            meta: buildMemoryMeta(memory),
            id: memory.slug || "",
            /* Runs for the ✕, the backdrop and Escape alike. The tab is where
               the reader is left, so the tab is the route — a picture that has
               been closed is no longer what the URL names. */
            onClose: () => writeRoute("people-memories"),
        })
        if (write !== false && memory.slug) writeRoute("memory-" + memory.slug)
    }

    /* Idempotent, because a reader can paste the same link twice: a route
       naming the picture already on screen must be left alone rather than
       reopened under them. */
    function applyRoute(route) {
        const slug = route && route.startsWith("memory-") ? route.slice("memory-".length) : null
        if (!slug) {
            // Any other route means the reader has gone somewhere else, and this
            // viewer covers the screen. Silent: its onClose would write the
            // Memories tab back over the route they just asked for.
            closeImageLightbox({ silent: true })
            return false
        }
        const memory = bySlug.get(slug)
        if (!memory) return false
        if (!isImageLightboxOpen(slug)) openMemory(memory, false)
        /* Not a claim on the route — it is the one the reader gave us. This
           normalises a *legacy* `#memory-…` hash to the path it names, which is
           what `writeRoute`'s "already there unless there is a hash" guard is
           for: on the path already it returns immediately. deep-link.js does
           the same tidy-up for the route the page was opened on, and cannot do
           it for one typed mid-visit. */
        writeRoute(route)
        return true
    }

    onRoute(applyRoute)

    // ── Wait for the memories tab panel to exist in the DOM ──────────────────
    function init() {
        const container = document.getElementById("memories-gallery")
        if (!container) return

        getMemoriesManifest()
            .then((memories) => {
                memories.forEach((memory) => {
                    if (memory.slug) bySlug.set(memory.slug, memory)
                })
                render(container, memories)

                registerRouteTitle((route) => {
                    const slug = route && route.startsWith("memory-") ? route.slice("memory-".length) : null
                    const memory = slug && bySlug.get(slug)
                    return memory ? memory.title || "Memory" : null
                })

                /* The route the page was opened on. people.js arms `landOnLoad`
                   for it — the section and the tab are its half of this — so
                   nothing here has to scroll. */
                applyRoute(INITIAL_ROUTE)
            })
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

                card.addEventListener("click", () => openMemory(memory, true))
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
