/* page-meta.js
 * The document title, kept in step with the route.
 *
 * ── What this is not ──
 * This is not SEO, and it is worth being blunt about that so it is not
 * mistaken for it later. A search or social crawler fetches the raw HTML and
 * does not run these modules, so what it indexes and what a shared link renders
 * as is the static block in index.html's <head> — always, whichever route the
 * link points at. Nothing written here is ever seen by one.
 *
 * What it is for is the reader's own browser: the tab label, the history menu,
 * the bookmark name and the window switcher. Opening three profiles and then
 * looking at the history menu should not show three entries called "Reality
 * Bending Lab". og:title and og:url are updated alongside for one narrow case
 * that does read the live DOM — a person copying a link out of the address bar
 * into a chat client whose preview runs a real browser.
 *
 * Deep-linkable *content* becoming indexable is a different job, and it needs
 * real paths rather than hashes. See the Tier 3 note in CLAUDE.md.
 *
 * ── How it knows what to say ──
 * A route names a thing whose title lives in a manifest that has not landed
 * yet — `post-2023-new-logo` is only "New location and new logo!" once
 * news_manifest.json is there. So resolvers are *registered* rather than
 * imported: news.js and people.js each hand one over when their manifest
 * arrives, and registering re-runs the current route, which is what fills in
 * the title of a page opened directly on a deep link.
 *
 * A resolver is given the whole route and returns a label, or null for a route
 * it does not own — the same contract as `applyRoute`, and for the same reason.
 * First non-null wins, so the specific resolvers registered by the sections
 * take precedence over the section fallback at the bottom of this file.
 */

import { onRouteSettled, readRoute } from "./deep-link.js"

const SITE_NAME = "Reality Bending Lab"
/* Kept identical to <title> in index.html by hand. If these two drift, the tab
   label changes when the reader lands on the hero, which reads as a flicker. */
const BASE_TITLE = "Reality Bending Lab — Neuropsychology of Reality | University of Sussex"
/* The deployed origin, read off the page's own canonical rather than written
   here. It was a literal, and one of four copies of the same fact with nothing
   keeping them in step — see `_site_url` in generate_pages.py, which is now the
   only other thing that resolves it, and does so from the same tag.

   Every page carries an absolute canonical: index.html's is the site root and a
   generated page's is that page, so the *origin* is the same in both and is
   what this needs. It supplies the origin for `og:url` so a preview generated
   from a local or staging copy still names the deployed page, which is the
   whole point of an absolute og:url — hence the fallback, for a copy of
   index.html whose canonical has been stripped. */
const SITE_URL = (() => {
    const canonical = document.querySelector('link[rel="canonical"]')
    try {
        return new URL(canonical.href).origin
    } catch (error) {
        return window.location.origin
    }
})()

/* The routes whose label is knowable without any content: a section, and any
   tab of it. The value is what the reader would call the place they are in.

   Keyed by the route's first segment, so `news-featured`, `news-all` and bare
   `news` all resolve to "News" — the tab is a view of a section rather than a
   destination with a name of its own, and "News — Featured" in a history menu
   is more precision than the entry can carry. `join` is the exception the site
   already makes everywhere else: the three levels are three different things to
   apply for, so join.js registers its own resolver. */
const SECTION_LABELS = new Map([
    ["people", "People"],
    ["research", "Research"],
    ["news", "News"],
    ["publications", "Publications"],
    ["contact", "Information"],
    ["join", "Join the Lab"],
    ["services", "Services"],
])

const resolvers = []

function metaTag(selector, create) {
    let tag = document.head.querySelector(selector)
    if (!tag) {
        tag = create()
        document.head.appendChild(tag)
    }
    return tag
}

function setProperty(property, value) {
    const tag = metaTag(`meta[property="${property}"]`, () => {
        const el = document.createElement("meta")
        el.setAttribute("property", property)
        return el
    })
    tag.setAttribute("content", value)
}

/* The fallback, once no registered resolver has claimed the route. A plain
   `#sec-news-full` is what the nav's own links leave behind and means "the News
   section", so it has to read the same as `#news-all` — hence the one step past
   `sec`, which carries the section name in the middle of it. */
function sectionLabel(route) {
    if (!route) return null
    const parts = route.split("-")
    const key = parts[0] === "sec" ? parts[1] : parts[0]
    return SECTION_LABELS.get(key) || null
}

function resolve(route) {
    for (const resolver of resolvers) {
        try {
            const label = resolver(route)
            if (label) return label
        } catch (error) {
            console.error("page-meta: a resolver failed for #" + route, error)
        }
    }
    return sectionLabel(route)
}

function sync(route) {
    const label = resolve(route)
    const title = label ? `${label} · ${SITE_NAME}` : BASE_TITLE
    document.title = title
    setProperty("og:title", title)
    /* The site's own address for this route, which is `location.pathname` and
       not a hash. It was `SITE_URL + "#" + route` — the shape routes had before
       they became paths, and a URL that now resolves to nothing: the one client
       this line exists for (a chat preview that runs a real browser) was being
       handed `…/#people-memories` for a page whose real address is
       `…/people/memories/`. Read off the document rather than rebuilt from the
       route, because deep-link.js is the only thing that knows how a route maps
       to a path *and* where the site is mounted. SITE_URL supplies the origin
       so a preview generated from a local or staging copy still names the
       deployed page — which is the whole point of an absolute og:url. */
    setProperty("og:url", SITE_URL + window.location.pathname)
}

/* Registering re-runs the current route: a resolver almost always arrives
   *after* the route it can answer has already been applied — its manifest is
   what it was waiting for — so without this a page opened on #post-… would
   keep the site title until the reader moved. */
export function registerRouteTitle(resolver) {
    resolvers.push(resolver)
    sync(readRoute())
}

onRouteSettled(sync)
sync(readRoute())
