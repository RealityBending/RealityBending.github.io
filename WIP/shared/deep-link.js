/* deep-link.js
 * The site's shareable URLs.
 *
 * One URL, one thing on show. The routes are unchanged — they are still the
 * opaque strings every section's `applyRoute` receives — but they are now
 * carried by the *path* rather than by a hash:
 *
 *   /people/<folder>/         a member's profile panel, open over People
 *   /news/<slug>/             a news post, open in the reader
 *   /people/<tab>/            a section and which of its tabs
 *   /research/<tab>/
 *   /news/<tab>/
 *   /publications/<tab>/
 *   /information/<tab>/       (the `contact-` route predates the module)
 *   #sec-<id>                 a plain section anchor; the nav's own links
 *
 * `shared/routes.js` is the whole of that translation and the only place that
 * knows a route has a URL shape at all. It changed because a fragment is not an
 * address: no crawler indexes one separately, so the entire site was a single
 * indexable URL whatever was rendered into it (SEO-PLAN.md).
 *
 * Every path here is a real file, written by generate_pages.py — which is why
 * that script and this module ship together. Writing a path nothing serves
 * makes the next reload a 404.
 *
 * Legacy `#post-…` hashes still resolve, and are normalised to their path on
 * arrival.
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

import { pathForRoute, routeForPath } from "./routes.js"

const listeners = []

/* ── Where the site is mounted ──
 * `routes.js` deals in site paths — `/people/memories/` — which assume the site
 * is the root of its origin. That is true of the deployed site and false of
 * every other way it gets opened: a server started at the repo with the site
 * under /WIP/, or a project page under /<repo>/.
 *
 * `<base>` in index.html already knows the answer (it is relative, so the
 * browser resolved it against the document's own URL at parse time and then
 * froze it — see the comment there). So these two translate between a site path
 * and a real one, and everything in between stays mount-agnostic.
 *
 * Without this, pressing a tab in a /WIP/-mounted copy writes
 * `/people/memories/` — a URL outside the site, which 404s on reload. */
const BASE_PATH = new URL(document.baseURI).pathname

function toMountedPath(sitePath) {
    return new URL(sitePath.replace(/^\//, ""), document.baseURI).pathname
}

function toSitePath(mountedPath) {
    return mountedPath.startsWith(BASE_PATH) ? "/" + mountedPath.slice(BASE_PATH.length) : mountedPath
}

function currentHash() {
    const raw = window.location.hash.replace(/^#/, "")
    try {
        return decodeURIComponent(raw)
    } catch (error) {
        // A hand-edited URL can carry a stray % that is not an escape.
        return raw
    }
}

/* ── Where a route comes from, in order ──
 * 1. A hash, if there is one. That is a legacy link, or a reader who edited the
 *    URL, and it still has to work.
 * 2. `body[data-route]`, written by generate_pages.py. This is the authority on
 *    a generated page: it is the route the page was built for, and it does not
 *    depend on this module and routes.js agreeing about how to read a path.
 * 3. The path itself, for anything served at a real URL without that attribute.
 *
 * A route is a route whichever of the three it came from — nothing downstream
 * can tell, which is the whole point. */
function currentRoute() {
    const hash = currentHash()
    if (hash) return hash
    const declared = document.body && document.body.dataset ? document.body.dataset.route : ""
    if (declared) return declared
    return routeForPath(toSitePath(window.location.pathname)) || ""
}

/* The route the page was opened on, captured at module evaluation — before any
   section has had the chance to write its own. This is what the door screen
   asks about and what each section applies once its content is there. */
export const INITIAL_ROUTE = currentRoute()

export function readRoute() {
    return currentRoute()
}

/* ── A legacy hash is normalised to its path, once, on arrival ──
 * `#post-2023-new-logo` and `/news/2023-new-logo/` are the same place, and the
 * one worth having in the address bar is the one a crawler can hold. Done here
 * rather than left to the section that claims the route, because `applyRoute`
 * is called with `write: false` — reading a route deliberately does not rewrite
 * it — so nothing else would ever tidy this up.
 *
 * `replaceState` like every other write here: no history entry, no
 * `hashchange`, so this cannot re-enter anything. */
if (INITIAL_ROUTE && currentHash()) {
    const path = pathForRoute(INITIAL_ROUTE)
    const mounted = path && toMountedPath(path)
    if (mounted && mounted !== window.location.pathname) {
        window.history.replaceState(null, "", mounted)
    }
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
    if (currentRoute() === route && !currentHash()) return

    /* A route with a path of its own gets it. Everything the site actually
       writes has one — see routes.js — so the fallback below is for a route
       shape that map does not know, where a hash is still better than nothing.

       Note that the hash is always cleared: arriving on `#post-x` and then
       pressing something else must not leave the old fragment stapled to the
       new path, or the URL names two different things and the canonical on the
       page disagrees with both. */
    const path = pathForRoute(route)
    const url = path
        ? toMountedPath(path) + window.location.search
        : route
          ? window.location.pathname + window.location.search + "#" + route
          : window.location.pathname + window.location.search

    window.history.replaceState(null, "", url)
    // Observers only — never the route handlers. See onRouteSettled.
    notifySettled(route)
}

export function onRoute(handler) {
    listeners.push(handler)
}

/* ── A second channel, for observers rather than handlers ──
 * `onRoute` fires only when the *reader* moved, which is the whole point of
 * writeRoute being a replaceState: a section can write its own route without
 * re-entering its own handler.
 *
 * But something that merely wants to *know* what the URL now says — the title
 * in shared/page-meta.js — needs both cases, because "the reader opened a post"
 * and "a module wrote #post-… after a click" produce the same URL and should
 * produce the same title.
 *
 * So: a separate list, notified from both places, and it does not weaken the
 * re-entrancy guarantee above because of one rule —
 *
 *   AN OBSERVER MUST NOT WRITE THE ROUTE.
 *
 * `notifying` enforces it rather than trusting it: a write from inside a
 * notification would otherwise notify again, and two observers each nudging the
 * URL would spin. Observers are for reading the route, never for steering it.
 */
const observers = []
let notifying = false

export function onRouteSettled(observer) {
    observers.push(observer)
}

function notifySettled(route) {
    if (notifying) return
    notifying = true
    observers.forEach((observer) => {
        try {
            observer(route)
        } catch (error) {
            console.error("deep-link: a route observer failed for #" + route, error)
        }
    })
    notifying = false
}

window.addEventListener("hashchange", () => {
    const route = currentRoute()
    listeners.forEach((handler) => {
        try {
            handler(route)
        } catch (error) {
            console.error("deep-link: a route handler failed for #" + route, error)
        }
    })
    notifySettled(route)
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
