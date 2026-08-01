import { ACTIVE_NAV_SECTIONS, applySectionTheme } from "./site-sections.js"
import { initMarginTabNav, swapTabPanels } from "./shared/tab-slide.js"
import { INITIAL_ROUTE, landOnLoad, matchRoute, onRoute, readRoute, revealSection, writeRoute } from "./shared/deep-link.js"
/* Imported for its side effect: the module hooks the route and keeps the tab
   title in step. Here as well as in the two sections that register resolvers,
   so a section failing to load cannot leave the title frozen. */
import "./shared/page-meta.js"

/* script.js
 * Entry-point for the landing page interaction.
 * Handles the door-screen open animation: listens for click / keyboard
 * events to trigger the CSS opening class, then hides the overlay once
 * the opacity transition completes so it is removed from the a11y tree.
 */
const doorScreen = document.getElementById("door-screen")
const mainPage = document.getElementById("main-page")

/* The inline bootstrap in index.html has already opened the door if the page
   was loaded on a hash — it runs before this module and before the first paint,
   which is the only place the skip can happen without the door flashing. Start
   from where it left off rather than offering to open something already open. */
let hasOpened = Boolean(doorScreen && doorScreen.hidden)

function openDoors() {
    if (!doorScreen || !mainPage || hasOpened) return

    hasOpened = true
    doorScreen.classList.add("opening")
    doorScreen.setAttribute("aria-hidden", "true")
    mainPage.classList.add("visible")
}

if (doorScreen && mainPage) {
    doorScreen.addEventListener("click", openDoors)
    doorScreen.addEventListener("pointerdown", openDoors)
    doorScreen.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        openDoors()
    })

    doorScreen.addEventListener("transitionend", (event) => {
        if (event.target !== doorScreen || event.propertyName !== "opacity") return
        doorScreen.hidden = true
    })
}

// Theming runs after the door listeners are wired so a failure here can never
// leave the landing screen unclickable.
try {
    applySectionTheme()
} catch (error) {
    console.error("applySectionTheme failed", error)
}

// ── Active nav section highlighting ──
const sectionNavMap = ACTIVE_NAV_SECTIONS

function updateActiveNav() {
    const mid = window.innerHeight / 2
    let activeSectionId = null

    for (const { sectionId, pageSectionId } of sectionNavMap) {
        const el = document.getElementById(pageSectionId)
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.top <= mid && r.bottom >= mid) {
            activeSectionId = sectionId
            break
        }
    }

    document.querySelectorAll("nav a").forEach((a) => a.classList.remove("active"))
    if (activeSectionId) {
        const link = document.querySelector(`nav a[data-section-id="${activeSectionId}"]`)
        if (link) link.classList.add("active")
    }
}

// ── Nav visibility: hidden over the hero, revealed once scrolled past it ──
const navBar = document.querySelector("nav")
const heroSection = document.querySelector(".hero")

// Maps the tail of the hero's exit onto a 0 → 1 reveal the stylesheet reads as
// --nav-reveal, so the bar eases in with the scroll instead of snapping.
const NAV_REVEAL_END = 90

function updateNavVisibility() {
    if (!navBar || !heroSection) return

    const heroBottom = heroSection.getBoundingClientRect().bottom
    const revealStart = Math.max(NAV_REVEAL_END + 120, window.innerHeight * 0.45)
    const reveal = Math.min(1, Math.max(0, (revealStart - heroBottom) / (revealStart - NAV_REVEAL_END)))

    navBar.style.setProperty("--nav-reveal", reveal.toFixed(3))
    navBar.classList.toggle("nav--hidden", reveal <= 0.02)
}

function initContactTabs() {
    const buttons = Array.from(document.querySelectorAll(".contact-tab-btn"))
    const panels = Array.from(document.querySelectorAll(".contact-tab-panel"))
    if (!buttons.length || !panels.length) return

    // The backdrop is a sibling of the panels, so it cannot select on which one
    // is showing — and it has to, because the tabs differ enormously in height
    // and the banner is sized against the section. See the [data-active-tab]
    // rules in css/15-contact.css.
    const section = document.querySelector(".contact-full")

    const TABS = ["contact", "join", "services"]

    /* `write` is false for the two calls that are not a reader pressing
       something — the initial render, and applying a route that came out of the
       URL in the first place. Writing on those would be this section claiming
       the hash off whatever section the reader actually linked to. */
    function activateContactTab(tab, write) {
        if (section) section.dataset.activeTab = tab

        buttons.forEach((button) => {
            const isActive = button.dataset.tab === tab
            button.classList.toggle("contact-tab-btn--active", isActive)
            button.setAttribute("aria-selected", isActive ? "true" : "false")
        })

        swapTabPanels(panels, "contact-" + tab)
        if (write !== false) writeRoute("contact-" + tab)
    }

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            activateContactTab(button.dataset.tab || "contact")
        })
    })

    /* The FABs and the two nav entries. They are plain `#sec-contact-full`
       anchors, so the browser does the scrolling and the hash it leaves behind
       is the section's — which is why these do not write one of their own. */
    document.querySelectorAll("[data-contact-tab-target]").forEach((link) => {
        link.addEventListener("click", () => {
            activateContactTab(link.getAttribute("data-contact-tab-target") || "contact", false)
        })
    })

    /* Landing is part of it: a `#contact-join` a reader was sent is a link to
       the tab, and every other section's route handler scrolls to itself. The
       one on the initial route is re-run on `load` for the reason
       `landOnInitialSection` is — this section is the last one on the page, so
       its offset is the sum of every manifest still being fetched. */
    function applyRoute(route) {
        const tab = matchRoute(route, "contact")
        if (tab === null || !TABS.includes(tab)) return
        activateContactTab(tab, false)
        revealSection("sec-contact-full")
    }

    onRoute(applyRoute)
    const initialTab = matchRoute(INITIAL_ROUTE, "contact")
    activateContactTab(TABS.includes(initialTab) ? initialTab : "contact", false)
    if (TABS.includes(initialTab)) {
        revealSection("sec-contact-full")
        landOnLoad("sec-contact-full")
    }
    initMarginTabNav(section, ".contact-tab-btn")
}

/* ── Section backdrop parallax ──
 * Shared by the People video and the Information image. Travel is clamped to
 * however much the layer and its section differ in height, which covers both
 * arrangements: a layer shorter than its section (the video, sized so the whole
 * frame stays visible) moves within the letterbox gap, and a layer taller than
 * its section (the image, deliberately overhanging) moves within the overhang.
 * Either way the layer never pulls away from an edge.
 *
 * In-view is derived from the same rect rather than a separate
 * IntersectionObserver: one mechanism, on a path guaranteed to run whenever the
 * section can be seen.
 */
function trackSectionParallax(section, layer, customProperty, options) {
    const settings = options || {}
    const maxTravel = settings.maxTravel || 160
    const viewMargin = settings.viewMargin || 200
    let inView = false

    function update() {
        const rect = section.getBoundingClientRect()
        const viewport = window.innerHeight

        const nowInView = rect.bottom > -viewMargin && rect.top < viewport + viewMargin
        if (nowInView !== inView) {
            inView = nowInView
            if (settings.onViewChange) settings.onViewChange(inView)
        }
        if (!nowInView) return

        const slack = Math.abs(rect.height - layer.offsetHeight) / 2
        const travel = Math.min(slack * 0.9, maxTravel)

        // Progress is mapped onto the range the box can actually be scrolled
        // through, not onto a full crossing of the viewport. The Information
        // banner sits at the end of the page and never reaches the top of it,
        // so against a full crossing it only ever used a quarter of its travel
        // — and it got weaker every time the section grew. For a box that does
        // cross fully this is the same ratio as before.
        const maxScroll = mainPage.scrollHeight - mainPage.clientHeight
        const boxTop = rect.top + mainPage.scrollTop
        const enter = Math.min(viewport, boxTop)
        const exit = Math.max(-rect.height, boxTop - maxScroll)
        const span = enter - exit
        // Clamped because viewMargin runs update() while the layer is still
        // outside that range, where the ratio overshoots and pushes the layer
        // past its own overhang — which uncovers a strip at the far edge.
        const progress = span > 0 ? Math.min(1, Math.max(0, (enter - rect.top) / span)) : 0.5

        section.style.setProperty(customProperty, ((progress - 0.5) * 2 * travel).toFixed(1) + "px")
    }

    mainPage.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", update)

    // Section height is not settled at startup and changes with the tabs; both
    // move the slack the travel is clamped to.
    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(update).observe(section)
    }

    update()

    return { update, isInView: () => inView }
}

// ── Information: parallaxed Sussex banner, starting at the tab line ──
function initInformationBackdrop() {
    const section = document.querySelector(".contact-full")
    const backdrop = section && section.querySelector(".contact-full__backdrop")
    const layer = backdrop && backdrop.querySelector(".contact-full__backdrop-img")
    if (!section || !backdrop || !layer || !mainPage) return

    // Where the banner starts. Measured rather than hardcoded because the tab
    // row wraps to a second line on narrow viewports.
    const tabsNav = section.querySelector(".contact-tabs-nav")

    function syncTop() {
        if (!tabsNav) return
        const top = tabsNav.getBoundingClientRect().bottom - section.getBoundingClientRect().top
        backdrop.style.setProperty("--contact-backdrop-top", Math.round(top) + "px")
    }

    if (typeof ResizeObserver !== "undefined") {
        new ResizeObserver(syncTop).observe(section)
    }
    window.addEventListener("resize", syncTop)
    syncTop()

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    // Measured against the banner, not the section: the travel comes from the
    // image's overhang inside the banner, and the banner is the shorter of the
    // two now that it starts at the tab line.
    trackSectionParallax(backdrop, layer, "--contact-parallax")
}

// ── People: dimmed backdrop loop, fetched and played only while in view ──
function initPeopleVideo() {
    const section = document.querySelector(".people-full")
    const video = section && section.querySelector(".people-full__video-el")
    if (!section || !video || !mainPage) return

    // Under reduced motion the poster stays put and nothing is ever fetched.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    // Only the team roster gets the backdrop; the other two tabs stay plain.
    const labPanel = document.getElementById("people-tab-lab")
    const onLabTab = () => !labPanel || !labPanel.hidden

    let inView = false
    let loadStarted = false

    function sync() {
        section.classList.toggle("people-full--video-on", onLabTab())

        if (!inView || !onLabTab()) {
            video.pause()
            return
        }

        if (!loadStarted) {
            loadStarted = true
            // preload="none" in the markup keeps the video from competing with
            // the hero for bandwidth, but it leaves the fetch suspended — and
            // raising preload on its own does not reliably restart it. load()
            // re-runs resource selection and actually pulls the bytes.
            video.preload = "auto"
            video.load()
        }

        // play() before any data has arrived is fine — playback starts once
        // there is enough. Never swallow the rejection: it is the only thing
        // that names a blocked autoplay.
        video.play().catch((error) => {
            console.warn("People backdrop video did not start:", error && error.name, error && error.message)
        })
    }

    if (labPanel) {
        new MutationObserver(sync).observe(labPanel, { attributes: true, attributeFilter: ["hidden"] })
    }

    // Chrome pauses backdrop loops in a backgrounded tab — it reports them as
    // "video-only background media" and refuses play() outright while hidden,
    // silent audio track or not. Coming back to the tab fires nothing else, so
    // without this the backdrop stays frozen on a frame for the rest of the
    // visit. One event, no polling.
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") sync()
    })

    // Parallax also tells us when the section is near enough to start fetching.
    const tracker = trackSectionParallax(section, video, "--people-video-parallax", {
        onViewChange: (visible) => {
            inView = visible
            sync()
        },
    })
    inView = tracker.isInView()

    sync()
}

// ── Hero: soft glow that trails the pointer across the dark half ──
function initHeroGlow() {
    const hero = document.querySelector(".hero")
    if (!hero || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    hero.addEventListener(
        "pointermove",
        (event) => {
            const rect = hero.getBoundingClientRect()
            if (!rect.width || !rect.height) return
            hero.style.setProperty("--hero-pointer-x", (((event.clientX - rect.left) / rect.width) * 100).toFixed(2) + "%")
            hero.style.setProperty("--hero-pointer-y", (((event.clientY - rect.top) / rect.height) * 100).toFixed(2) + "%")
        },
        { passive: true },
    )
}

/* ── "Like this website?" ──
 * A third floating button that slides up under the other two once a visitor is
 * far enough in to have formed an opinion of the site. It points at the
 * Services tab, which the FAB group's own handler in initContactTabs already
 * knows how to open — this only decides *when* the button exists.
 *
 * It withdraws again on the way back up, and — the part that keeps it from
 * being a nuisance — it withdraws once the Information section is actually on
 * screen. A button whose whole job is "go over there" has nothing to say while
 * you are standing in front of "there", and leaving it floating over the
 * section it advertises is exactly the behaviour that makes these obnoxious.
 *
 * Both ends are section boundaries, deliberately: it lives for exactly News and
 * Publications. Nothing here may be a fraction of the scroll height — the
 * Research zoom's gate changes that height by ~700vh (see the note at `gate`).
 */
function initSitePromoFab() {
    const fab = document.getElementById("fab-site-promo")
    const target = document.getElementById("sec-contact-full")
    /* What "far enough in" is measured against. It used to be a fraction of the
       page — half way down, on the theory that People and Research are behind
       you by then — and that was wrong twice over. Research is the tallest
       section on the page even with its zoom shut, so half of the scroll height
       already landed inside it; and opening the zoom adds ~700vh to the
       document, which drags the halfway mark right into the middle of the dive.
       Either way the button arrived over the section it was meant to come
       after, and its position moved depending on whether the reader had opened
       something. A section boundary does not have that problem. */
    const gate = document.getElementById("sec-research-full")

    // Fallback only, for a page without that section: half way down.
    const SHOW_PAST = 0.5

    /* How far the button has to pull itself out of the column to leave no trace
       of itself in it: its own height, plus the gap that would sit above it.
       Measured rather than written down because the second line wraps at narrow
       widths and the height follows. Safe to read at any time — the button is
       collapsed with a margin, so it keeps its natural height throughout. */
    function measureCollapse() {
        const group = fab.parentElement
        if (!group) return
        const gap = parseFloat(getComputedStyle(group).rowGap) || 0
        fab.style.setProperty("--fab-promo-collapse", fab.offsetHeight + gap + "px")
    }

    function update() {
        const scrollable = mainPage.scrollHeight - mainPage.clientHeight
        if (scrollable <= 0) return

        // Research entirely off the top, which is the moment News fills the
        // screen — so the button's whole life is News and Publications, whether
        // or not the reader took the long way through the zoom.
        const scrolled = gate ? gate.getBoundingClientRect().bottom <= 0 : mainPage.scrollTop / scrollable >= SHOW_PAST
        // Three quarters of a viewport of the destination is "you are here".
        const arrived = target ? target.getBoundingClientRect().top < mainPage.clientHeight * 0.75 : false

        fab.classList.toggle("is-shown", scrolled && !arrived)
    }

    mainPage.addEventListener("scroll", update, { passive: true })
    window.addEventListener("resize", () => {
        measureCollapse()
        update()
    })
    measureCollapse()
    update()
}

if (mainPage) {
    mainPage.addEventListener("scroll", updateActiveNav, { passive: true })
    mainPage.addEventListener("scroll", updateNavVisibility, { passive: true })
    window.addEventListener("resize", updateNavVisibility)
    updateActiveNav()
    updateNavVisibility()
}

/* Landing on a plain section anchor — `#sec-news-full`, which is what the nav's
   own links leave in the URL and so what a reader is most likely to copy. The
   browser does resolve these itself, but it resolves them once, against a page
   whose sections are still empty: every manifest here is fetched, so the
   offsets move afterwards. Doing it again on `load` is what makes a shared
   section link land where it says. Routes that name something inside a section
   are that section's own job, since only it knows when its content exists. */
function landOnInitialSection() {
    if (!INITIAL_ROUTE.startsWith("sec-")) return
    revealSection(INITIAL_ROUTE)
}

if (INITIAL_ROUTE) {
    landOnInitialSection()
    window.addEventListener("load", landOnInitialSection)
}

/* ── The section anchors have to be scrolled by hand now ──
 * `<base href="/">` in index.html is what keeps every site-relative URL on the
 * page resolving against the site root rather than against whatever path
 * `writeRoute` last wrote (see the note in index.html). It has one cost: a bare
 * `href="#sec-people-full"` resolves to `/#sec-people-full`, which stops being
 * a same-document fragment the moment the URL is `/people/memories/` — the
 * browser would treat it as a navigation and reload the page.
 *
 * So these nine anchors are handled here instead. The behaviour is the one they
 * always had, only smooth on purpose: a click inside the page is a move the
 * reader initiated and reads better animated, which is the same distinction
 * `revealSection` already makes between arriving and navigating.
 *
 * Delegated from the document so it covers the nav, the FABs and anything
 * added later, and registered without `capture` so the existing
 * `[data-contact-tab-target]` listeners still run — they open the tab, this
 * moves the page, and neither knows about the other.
 *
 * Modifier-clicks and middle-clicks fall through untouched: those mean "open
 * this somewhere else", and a preventDefault would silently break them.
 */
document.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const anchor = event.target.closest && event.target.closest('a[href*="#sec-"]')
    if (!anchor) return
    const sectionId = (anchor.getAttribute("href") || "").split("#")[1]
    if (!sectionId || !document.getElementById(sectionId)) return
    event.preventDefault()
    revealSection(sectionId, { smooth: true })
})

initContactTabs()
initHeroGlow()
initPeopleVideo()
initInformationBackdrop()
initSitePromoFab()
