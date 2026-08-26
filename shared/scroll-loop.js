/* scroll-loop.js
 * One scroll listener and one animation frame for the whole page.
 *
 * ── Why this exists ──
 * Six things on this page react to `#main-page` scrolling: the active-nav
 * highlight, the nav's reveal over the hero, the two backdrop parallaxes, the
 * "Like this website?" FAB and the Research zoom's whole dive. Each registered
 * its own `scroll` listener, and each does the same shape of work — measure
 * something with `getBoundingClientRect()`, then write a custom property or
 * toggle a class.
 *
 * Six of those interleaved in one event is the textbook layout thrash: the
 * first handler's write invalidates layout, so the second handler's read forces
 * the browser to lay the page out again before it can answer, and so on down
 * the list. And it happened *per event* — a trackpad or a smooth-scrolling
 * wheel fires them faster than the screen refreshes, so the whole run could
 * happen several times for one painted frame.
 *
 * Coalescing into a single `requestAnimationFrame` fixes both halves at once:
 * the handlers run at most once per painted frame, and they run at the point in
 * the frame where style and layout are about to happen anyway.
 *
 * ── What it does not do ──
 * It does not reorder reads before writes across handlers. That would mean
 * every caller splitting itself in two, and the win is much smaller than the
 * one above — the expensive part was doing it several times a frame. Modules
 * that can cheaply take their measurements in one go (see `readFrame` in
 * research/reality-zoom.js) should still do so.
 *
 * ── The one assumption ──
 * That a scheduled animation frame always eventually runs. Browsers queue rAF
 * callbacks rather than dropping them, including across a tab being
 * backgrounded — and a backgrounded tab is not being scrolled either — so this
 * holds everywhere the site actually runs. It does **not** hold in a preview
 * pane whose `document.visibilityState` is permanently "hidden": there nothing
 * on the page reacts to scrolling until `requestAnimationFrame` is stubbed. See
 * CLAUDE.md, "Verifying changes".
 *
 * It also leaves `resize` alone. Resizing is a transient gesture rather than a
 * continuous one, and every scroll-driven module here routes `resize` to the
 * same update function — which is what makes
 * `window.dispatchEvent(new Event("resize"))` a working stand-in for a scroll
 * in a preview pane that fires neither scroll events nor animation frames (see
 * CLAUDE.md, "Verifying changes"). Putting resize behind a frame would take
 * that away.
 */

/* Keyed by the scrolling element, so this stays correct if anything is ever
   driven by a container other than #main-page. In practice there is one. */
const registry = new Map()

function flush(state) {
    state.frame = 0
    /* Isolated the way separate listeners were: one handler throwing must not
       take the other five down with it, or a fault in the zoom would freeze the
       nav bar for the rest of the visit. */
    for (const handler of state.handlers) {
        try {
            handler()
        } catch (error) {
            console.error("scroll handler failed", error)
        }
    }
}

/* Register `handler` to run once per painted frame in which `container`
   scrolled. Returns a function that unregisters it. */
export function onScroll(container, handler) {
    if (!container || typeof handler !== "function") return () => {}

    let state = registry.get(container)
    if (!state) {
        state = { handlers: new Set(), frame: 0 }
        registry.set(container, state)
        container.addEventListener(
            "scroll",
            () => {
                if (state.frame) return
                state.frame = requestAnimationFrame(() => flush(state))
            },
            { passive: true },
        )
    }

    state.handlers.add(handler)
    return () => state.handlers.delete(handler)
}
