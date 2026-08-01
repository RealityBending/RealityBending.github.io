/* deep-link.js
 * The site's shareable URLs.
 *
 * This is one page, so a link into it is a hash — no server, no build step, and
 * nothing that would 404 on GitHub Pages. One hash, one thing on show:
 *
 *   #<folder>                 a member's profile panel, open over People
 *   #post-<slug>              a news post, open in the reader
 *   #people-<tab>             a section and which of its tabs
 *   #research-<tab>
 *   #news-<tab>
 *   #publications-<tab>
 *   #contact-<tab>            (Information — this one predates the module)
 *   #sec-<id>                 a plain section anchor; the nav's own links
 *
 * ── Every write is a replace ──
 * `writeRoute` uses `history.replaceState`, which adds no history entry and —
 * the part that matters — fires no `hashchange`. So a module writing the URL
 * can never re-enter its own route handler, and there is no "am I applying this
 * or did the reader ask for it" state to keep anywhere. The cost is that Back
 * does not step through tabs, which is the right trade: a tab is not a page,
 * and a reader who opened three profiles does not want to press Back three
 * times to leave.
 *
 * `hashchange` therefore only ever means the *reader* moved — an edited URL, a
 * nav link, the Back button leaving the site's own initial entry. That is when
 * handlers run.
 *
 * ── Applying a route is each section's own job ──
 * The content this points into is fetched, so nothing can be resolved at
 * startup: People and News both apply the route when their manifest lands. A
 * handler is called with the whole route string and ignores what it does not
 * own, which is why `matchRoute` returns null rather than throwing.
 *
 * Handlers must be idempotent. A reader can put the same hash in twice.
 */

const listeners = []

function currentHash() {
    const raw = window.location.hash.replace(/^#/, "")
    try {
        return decodeURIComponent(raw)
    } catch (error) {
        // A hand-edited URL can carry a stray % that is not an escape.
        return raw
    }
}

/* The hash the page was opened on, captured at module evaluation — before any
   section has had the chance to write its own. This is what the door screen
   asks about and what each section applies once its content is there. */
export const INITIAL_ROUTE = currentHash()

export function readRoute() {
    return currentHash()
}

/* `prefix` matched as a whole segment: "people" matches `people-lab` and bare
   `people`, and never `peoplesomething`. Returns the rest of the route, "" for
   a bare prefix, or null when this is somebody else's route.

   A member's route has no prefix and so does not come through here: people.js
   matches the whole route against the *set* of folders it already holds. That
   is what makes an unprefixed route safe — a shape can be guessed wrong, a
   membership test cannot. */
export function matchRoute(route, prefix) {
    if (!route) return null
    if (route === prefix) return ""
    return route.startsWith(prefix + "-") ? route.slice(prefix.length + 1) : null
}

export function writeRoute(route) {
    if (currentHash() === route) return
    // Dropping the hash entirely means writing the path back, or the URL keeps
    // a bare "#" and the reader's copy of it has a dangling character.
    const url = route ? "#" + route : window.location.pathname + window.location.search
    window.history.replaceState(null, "", url)
}

export function onRoute(handler) {
    listeners.push(handler)
}

window.addEventListener("hashchange", () => {
    const route = currentHash()
    listeners.forEach((handler) => {
        try {
            handler(route)
        } catch (error) {
            console.error("deep-link: a route handler failed for #" + route, error)
        }
    })
})

/* Where a deep link lands. `#main-page` is the scroll container, not the
   window, so nothing here can go through `scrollIntoView` on the document —
   and `scrollTop`'s setter honours the container's own `scroll-behavior`,
   which is smooth, hence the explicit `behavior`.

   Instant on arrival and smooth afterwards: a reader who followed a link is
   already where they meant to be and should not have to watch the page get
   there, while the same call made by a click in the page is a move they
   initiated and reads better animated. */
export function revealSection(sectionId, options) {
    const section = document.getElementById(sectionId)
    const mainPage = document.getElementById("main-page")
    if (!section || !mainPage) return
    mainPage.scrollTo({ top: section.offsetTop, behavior: (options && options.smooth) ? "smooth" : "instant" })
}

/* Land again once the page has finished loading, and only for a route that
   arrived with it.

   A section applies its route as soon as *its own* content exists — inside its
   manifest's `.then` — but the offset it scrolls to is the sum of every section
   above it, and those are still fetching manifests and still loading images.
   Measured on a member link: `revealSection` put the reader at scrollTop 1353,
   the hero settled, and the section they asked for ended up at 720. A shared
   link landing 633px into the wrong part of a section is the difference between
   a link that works and one that nearly does.

   `landOnLoad` is the correction, and it is a no-op after `load` — so a hash
   the reader pastes later, when offsets are settled, does not get an extra
   scroll it never asked for. `script.js` makes the same correction by hand for
   a plain `#sec-…`, which is where this was learnt. */
export function landOnLoad(sectionId) {
    if (document.readyState === "complete") return
    window.addEventListener("load", () => revealSection(sectionId), { once: true })
}
