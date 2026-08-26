import { onRouteSettled } from "./deep-link.js"

/* analytics.js
 * One GoatCounter pageview per route the reader actually reaches.
 *
 * ── Why this file exists at all ──
 * A one-line analytics snippet counts a pageview when the document loads, and
 * this site loads one document. A reader who opens People, four profiles, the
 * Memories tab, three photographs, News and two posts has moved through eleven
 * addresses and caused exactly one load — so the snippet on its own reports the
 * landing URL and nothing else, and the ~250 generated pages look unvisited.
 *
 * The counting has to follow the *routes* instead, and the site already has the
 * channel for that: `onRouteSettled` in deep-link.js, which fires both when the
 * reader moved and when a module wrote the URL after a click, and which
 * page-meta.js already reads to keep the title in step. This is a second
 * consumer of the same thing, and it obeys the same rule the channel is built
 * around — AN OBSERVER MUST NOT WRITE THE ROUTE. Nothing here does.
 *
 * count.js's own counting is switched off in index.html; see the note there.
 *
 * ── What is and is not sent ──
 * The path, and the title. No cookie, no identifier, no query string: the path
 * is read from `location.pathname`, which drops the `?…` a reader may have
 * arrived with. GoatCounter is cookieless and that is the reason it was chosen,
 * so nothing here should quietly reintroduce anything that identifies a person.
 */

/* count.js is `async`, so on a fast route change — or a reader who lands
   directly on a generated page — a hit can be ready before the script is. The
   queue is what stops the first pageview of every visit from being the one that
   goes missing, which is the one that matters most.

   Capped, because the other reason `goatcounter.count` never appears is a
   blocker or a failed CDN, and an unbounded array on a page that stays open all
   afternoon is a leak. Twenty is far more than the gap can ever hold. */
const QUEUE_LIMIT = 20
const pending = []

function dispatch(hit) {
    if (!window.goatcounter || typeof window.goatcounter.count !== "function") return false
    try {
        window.goatcounter.count(hit)
    } catch (error) {
        // Never let a counting failure surface as a broken page.
        console.error("analytics: goatcounter.count failed", error)
    }
    return true
}

function flush() {
    while (pending.length && dispatch(pending[0])) pending.shift()
}

/* The last path *sent*, not the last route seen. Several routes share a path —
   a bare `#sec-…` anchor keeps whatever path the reader was already on — and
   those are a scroll rather than a visit to somewhere new. `writeRoute` already
   returns early when the route has not changed; this is the same guard one
   level down, where the address rather than the route is what is being
   reported. */
let lastPath = null

function send() {
    const path = window.location.pathname
    if (path === lastPath) return
    lastPath = path

    /* Deferred by a microtask so the *whole* observer list has run before the
       title is read. page-meta.js sets `document.title` from this same
       notification, and observers run in registration order — an order that
       depends on module evaluation and would be an absurd thing for the
       reported title to hinge on. A microtask is after all of them, whichever
       way round they registered. */
    queueMicrotask(() => {
        const hit = { path, title: document.title }
        if (dispatch(hit)) return
        if (pending.length < QUEUE_LIMIT) pending.push(hit)
    })
}

// The async script arriving is the only thing that can drain a queued hit.
const loader = document.getElementById("goatcounter")
if (loader) loader.addEventListener("load", flush)

send() // the page the reader landed on
onRouteSettled(send) // every route after it
