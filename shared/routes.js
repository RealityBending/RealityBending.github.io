/* routes.js
 * The translation between a route string and a URL path.
 *
 * ── What this is for ──
 * Routes used to be hashes (`#post-2023-new-logo`), and a fragment is not an
 * address: Google retired the crawlable-fragment scheme in 2015 and no crawler
 * indexes one separately, so the whole site was a single indexable URL whatever
 * was rendered into it. Giving each thing a real path is what lifted that cap —
 * see CLAUDE.md, "The generated pages".
 *
 * This module is the *whole* of that translation as far as the rest of the site
 * is concerned. `shared/deep-link.js` funnels every URL write through
 * `writeRoute` and every read through `readRoute`, and hands handlers an opaque
 * route string — nothing outside those two modules knows a route has a URL
 * shape at all. So the route strings are unchanged, and so is every
 * `applyRoute`.
 *
 * ── Every path this can produce must be a real file ──
 * `generate_pages.py` writes them and `tools/check-paths.py` is the gate: a
 * path nothing serves makes the first reload after a tab click a 404.
 *
 * ── The one constraint, and nothing enforces it ──
 * `/news/<x>/` is a post when `x` is a slug and a tab when `x` is a tab name,
 * and the same is true of `/people/` and `/publications/`. The tab names are
 * therefore RESERVED: no post folder may be called `all` or `featured`, no
 * member folder `lab`, `collaborations` or `memories`, no publication folder
 * `list` or `gallery`. This is the same class of constraint CLAUDE.md already
 * records for member folders under "Shareable URLs", and it is safe today for
 * the same reason: post and publication folders begin with a year, and members
 * are named after people. `RESERVED` below is the list to check a new folder
 * against.
 */

/* Route prefix -> the path segment it becomes. `contact` is the one that is not
   its own name: the route predates the section being called Information, and
   renaming the route would break the one link shape that was in use before the
   site was published. */
const SECTION_PATHS = new Map([
    ["people", "people"],
    ["research", "research"],
    ["news", "news"],
    ["publications", "publications"],
    ["contact", "information"],
])

/* The tabs of each section, by path segment. These are the reserved names.

   News is the one entry that no longer names live tabs: the section has a
   single view now, `all` and `featured` are read-only routes kept alive for the
   links the old tab bar left behind, and `news.js` lands them on the index (the
   second with the Featured chip on). They stay reserved for exactly the reason
   the list exists — a post folder called `all` would otherwise take the path
   off one of them. */
const RESERVED = new Map([
    ["people", ["lab", "collaborations", "memories"]],
    ["research", ["overview", "creations"]],
    ["news", ["all", "featured"]],
    ["publications", ["list", "gallery"]],
    ["information", ["contact", "join", "services"]],
])

/* Item routes: a prefixed route that becomes `/<base>/<id>/`. A member is the
   exception and is handled separately — it has no prefix, because a person's
   name is the one id here that is enough on its own (CLAUDE.md, "Shareable
   URLs"). */
const ITEM_ROUTES = [
    { prefix: "post", base: "news" },
    { prefix: "pub", base: "publications" },
    { prefix: "join", base: "join" },
    { prefix: "services", base: "services" },
]

/* ── The one route that is three segments deep ──
 * `memory-<slug>` -> `/people/memories/<slug>/`. A memory is a picture *in* the
 * Memories tab rather than a thing beside it, and the tab is where the reader
 * is left when they close it — so it nests under the tab's own path instead of
 * taking a base of its own. That is also what keeps its ids out of everyone
 * else's way: a slug three segments down cannot collide with a member folder,
 * so `RESERVED` gains nothing here.
 *
 * There is deliberately no bare `memory` route. It would be a second address
 * for `/people/memories/`, which already has one — the same duplicate
 * CANONICAL_ALIASES exists to undo in generate_pages.py, and here it can simply
 * not be created. */
const MEMORY_BASE = "/people/memories/"

/* ── Members are registered, not guessed ──
 * `pathForRoute("dominique-makowski")` has to know that route names a member
 * rather than a section or a typo, and the set of members lives in a manifest
 * that has not landed at module evaluation. So people.js hands it over when it
 * does — the same registration idiom `shared/page-meta.js` already uses for
 * titles, and safe for the same reason: a route is only ever *written* in
 * response to something the reader pressed, which is long after the manifest is
 * there.
 *
 * Reading is not affected: `/people/<x>/` is unambiguous from its shape, so a
 * page opened directly on a member's path resolves before any registration. */
let memberFolders = new Set()

export function registerMemberFolders(folders) {
    memberFolders = new Set(folders)
}

export function isReserved(base, id) {
    return (RESERVED.get(base) || []).includes(id)
}

/* route -> path. Returns a root-relative path with a trailing slash, or null
   for a route that has no path of its own and must stay a fragment. */
export function pathForRoute(route) {
    if (!route) return "/"

    // A plain section anchor is genuinely a fragment — it names an element on a
    // page rather than a thing with an address. It keeps the hash.
    if (route === "sec" || route.startsWith("sec-")) return null

    if (route.startsWith("memory-")) {
        return MEMORY_BASE + route.slice("memory-".length) + "/"
    }

    for (const { prefix, base } of ITEM_ROUTES) {
        if (route === prefix) return `/${base}/`
        if (route.startsWith(prefix + "-")) {
            return `/${base}/${route.slice(prefix.length + 1)}/`
        }
    }

    // A section, bare or with one of its tabs.
    for (const [routePrefix, path] of SECTION_PATHS) {
        if (route === routePrefix) return `/${path}/`
        if (route.startsWith(routePrefix + "-")) {
            return `/${path}/${route.slice(routePrefix.length + 1)}/`
        }
    }

    if (memberFolders.has(route)) return `/people/${route}/`

    return null
}

/* path -> route. The inverse, and it must be exact: a path this cannot read is
   a page that would open on the wrong thing. Returns null for a path that names
   no route (the homepage, or anything unrecognised). */
export function routeForPath(pathname) {
    const parts = (pathname || "/").split("/").filter(Boolean)
    if (parts.length === 0) return ""

    const [base, id, sub] = parts

    if (base === "people") {
        if (!id) return "people"
        // `/people/memories/<slug>/` — the one path with a third segment. It has
        // to be read before the tab is, or a memory would resolve to the tab it
        // sits in and a shared link would open the gallery instead of the
        // picture.
        if (id === "memories" && sub) return `memory-${sub}`
        return isReserved("people", id) ? `people-${id}` : id
    }

    if (base === "news") {
        if (!id) return "news"
        return isReserved("news", id) ? `news-${id}` : `post-${id}`
    }

    if (base === "publications") {
        if (!id) return "publications"
        return isReserved("publications", id) ? `publications-${id}` : `pub-${id}`
    }

    if (base === "research") {
        return id ? `research-${id}` : "research"
    }

    if (base === "information") {
        return id ? `contact-${id}` : "contact"
    }

    if (base === "join" || base === "services") {
        return id ? `${base}-${id}` : base
    }

    return null
}

/* ── Self-check ──
 * Every route shape the site can produce, round-tripped. Exported rather than
 * run on import: this is a module the page loads, not a test runner. Call it
 * from the console, or from tools/check-routes.html.
 *
 * Returns an array of failures — empty means the map is total and symmetric
 * over these samples.
 */
export function verify() {
    registerMemberFolders(["dominique-makowski", "ana-neves", "zen-juen"])

    const cases = [
        ["", "/"],
        ["people", "/people/"],
        ["people-lab", "/people/lab/"],
        ["people-collaborations", "/people/collaborations/"],
        ["people-memories", "/people/memories/"],
        ["memory-2025-beach", "/people/memories/2025-beach/"],
        ["memory-2019-tms-tam", "/people/memories/2019-tms-tam/"],
        ["dominique-makowski", "/people/dominique-makowski/"],
        ["zen-juen", "/people/zen-juen/"],
        ["research", "/research/"],
        ["research-overview", "/research/overview/"],
        ["research-creations", "/research/creations/"],
        ["news", "/news/"],
        ["news-all", "/news/all/"],
        ["news-featured", "/news/featured/"],
        ["post-2023-new-logo", "/news/2023-new-logo/"],
        ["post-2026-cognitive-elegance", "/news/2026-cognitive-elegance/"],
        ["publications", "/publications/"],
        ["publications-list", "/publications/list/"],
        ["publications-gallery", "/publications/gallery/"],
        ["pub-2015_EmotionRegulationAging", "/publications/2015_EmotionRegulationAging/"],
        ["contact", "/information/"],
        ["contact-contact", "/information/contact/"],
        ["contact-join", "/information/join/"],
        ["contact-services", "/information/services/"],
        ["join-phd", "/join/phd/"],
        ["join-research-assistant", "/join/research-assistant/"],
        ["services-consulting", "/services/consulting/"],
    ]

    const failures = []

    for (const [route, path] of cases) {
        const got = pathForRoute(route)
        if (got !== path) failures.push(`pathForRoute(${JSON.stringify(route)}) = ${got}, expected ${path}`)
        const back = routeForPath(path)
        if (back !== route) failures.push(`routeForPath(${JSON.stringify(path)}) = ${back}, expected ${route}`)
    }

    // Fragments stay fragments.
    for (const route of ["sec-people-full", "sec-research-full", "sec-contact-full"]) {
        if (pathForRoute(route) !== null) failures.push(`pathForRoute(${route}) should be null`)
    }

    // A route naming nothing has no path.
    for (const route of ["not-a-member", "wat"]) {
        if (pathForRoute(route) !== null) failures.push(`pathForRoute(${route}) should be null`)
    }

    return failures
}
