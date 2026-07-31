import { RESEARCH_CONTENT } from "./research-content.js"
import { LEAVE_DURATION, swapTabPanels } from "../shared/tab-slide.js"
import { buildRealityZoom, initRealityZoom } from "./reality-zoom.js"
import { buildCreations } from "./creations.js"

/* The Research section is two tabs over one shell. Overview is the scroll-driven
   zoom (reality-zoom.js), Creations the inventions/tools grid (creations.js).
   A tab with neither `kind` renders as an empty panel: there is no generic card
   fallback here, because there was never a tab that used it and a builder no
   content reaches is a builder nobody notices is wrong.

   Note the missing initMarginTabNav: every other tab group turns its side
   margins into prev/next zones, but this one cannot. The zones span the whole
   host, and Overview's host is a ~700vh sticky stage — the arrows would sit as
   invisible click targets over the full height of the zoom, so a stray click
   anywhere in the dark would swap the tab out from under the reader. Two
   labelled buttons are enough for two tabs. */
;(function () {
    const root = document.getElementById("research-root")
    if (!root) return

    const mainPage = document.getElementById("main-page")
    const tabs = Array.isArray(RESEARCH_CONTENT.tabs) ? RESEARCH_CONTENT.tabs.filter((tab) => tab && tab.id && tab.label) : []
    if (!tabs.length) return

    let zoom = null

    function createPanel(tab, index) {
        const panel = document.createElement("div")
        panel.className = "research-tab-panel research-tab-panel--" + tab.id
        panel.id = "research-tab-" + tab.id
        panel.setAttribute("role", "tabpanel")
        panel.setAttribute("aria-labelledby", "research-tab-btn-" + tab.id)
        panel.hidden = index !== 0

        if (tab.kind === "reality-zoom") {
            panel.classList.add("research-tab-panel--zoom")
            zoom = buildRealityZoom(tab)
            panel.appendChild(zoom.root)
        } else {
            // --cards is the column width and the padding, which any non-zoom
            // tab wants; the rows themselves are creations.js's.
            panel.classList.add("research-tab-panel--cards")
            if (tab.kind === "creations") panel.appendChild(buildCreations(tab))
        }

        return panel
    }

    const shell = document.createElement("div")
    shell.className = "research-shell"

    const head = document.createElement("div")
    head.className = "research-head"

    const title = document.createElement("h2")
    title.className = "research-full__title"
    title.textContent = RESEARCH_CONTENT.title || "Research"
    head.appendChild(title)

    const nav = document.createElement("div")
    nav.className = "research-tabs-nav"
    nav.setAttribute("role", "tablist")
    nav.setAttribute("aria-label", "Research views")
    head.appendChild(nav)

    shell.appendChild(head)

    const panelHost = document.createElement("div")
    panelHost.className = "research-panels"

    const buttons = []
    const panels = []

    const zoomTab = tabs.find((tab) => tab.kind === "reality-zoom")

    let activeTab = tabs[0].id
    // Assigned by initCreationsFab, which cannot exist until the panels do.
    let syncFab = () => {}

    function activateTab(tabId) {
        activeTab = tabId

        // Leaving Overview shuts the gate. The panel is about to be display:none
        // and its ~700vh track goes with it, which is a scroll jump for anyone
        // deep in the dive; locked it is one screen tall, so the swap costs
        // nothing. It also means coming back starts from the overlay rather
        // than halfway down a track the reader had already left.
        if (zoom && zoom.driver && zoomTab && tabId !== zoomTab.id) zoom.driver.lock()

        buttons.forEach((button) => {
            const isActive = button.dataset.tab === tabId
            button.classList.toggle("research-tab-btn--active", isActive)
            button.setAttribute("aria-selected", isActive ? "true" : "false")
        })
        swapTabPanels(panels, "research-tab-" + tabId)
        // After the swap, not before: the floating button reads the section's
        // own rect, and the section is about to change height by the whole of
        // one panel. Once more when the slide has settled, for the same reason
        // the zoom refreshes twice.
        syncFab()

        // The zoom measures itself against a stage that was display:none for as
        // long as its tab was hidden, so its geometry is stale the moment it
        // comes back. The second pass is for the other direction: the outgoing
        // panel keeps its box for the length of the slide, so a reading taken
        // now still sees the zoom on screen and would leave the nav in its dark
        // dress over a cream page.
        if (zoom && zoom.driver) {
            requestAnimationFrame(() => zoom.driver.refresh())
            setTimeout(() => zoom.driver.refresh(), LEAVE_DURATION + 60)
        }
        setTimeout(syncFab, LEAVE_DURATION + 60)
    }

    tabs.forEach((tab, index) => {
        const button = document.createElement("button")
        button.type = "button"
        button.id = "research-tab-btn-" + tab.id
        button.className = "research-tab-btn" + (index === 0 ? " research-tab-btn--active" : "")
        button.dataset.tab = tab.id
        button.setAttribute("role", "tab")
        button.setAttribute("aria-selected", index === 0 ? "true" : "false")
        button.setAttribute("aria-controls", "research-tab-" + tab.id)
        button.textContent = tab.label
        button.addEventListener("click", () => activateTab(tab.id))
        nav.appendChild(button)
        buttons.push(button)

        const panel = createPanel(tab, index)
        panelHost.appendChild(panel)
        panels.push(panel)
    })

    shell.appendChild(panelHost)
    root.replaceChildren(shell)

    /* Leaving the zoom for the other tab, and scrolling the section header back
       into view along with it — switching tabs at the bottom of a 700vh track
       otherwise lands the reader on a short panel they have already scrolled
       past. activateTab shuts the gate on the way out, so coming back to
       Overview starts from the poster rather than dropping the reader into the
       middle of a track they had already left.

       Two things call this: the rail's own exit, which only exists once the
       dive has gone dark, and the floating button, which is up for the whole
       section. */
    function goToTab(tabId) {
        activateTab(tabId)
        const section = document.getElementById("sec-research-full")
        if (section && mainPage) mainPage.scrollTo({ top: section.offsetTop, behavior: "smooth" })
    }

    /* The floating way through to Creations. It joins the two standing FABs
       rather than being placed in the section, because the Overview is a
       ~700vh sticky stage: anything anchored inside it is either fixed to one
       frame of the dive or scrolls away from the reader on the first pull.

       Shown only while Overview is both the active tab and the thing filling
       the screen. Both halves matter — the tab, or it would offer to take a
       reader to the panel they are already reading; the rect, because the
       section is the tallest on the page and its own boundaries are the only
       stable measure here (a fraction of the scroll height moves by ~700vh
       when the gate opens — see the note on `gate` in script.js). */
    function initCreationsFab(targetTab) {
        const fab = document.getElementById("fab-research-creations")
        const section = document.getElementById("sec-research-full")
        if (!fab || !section || !mainPage || !targetTab || !zoomTab) return

        fab.addEventListener("click", () => goToTab(targetTab.id))

        function update() {
            const rect = section.getBoundingClientRect()
            const vh = window.innerHeight
            // Covering the screen rather than merely intersecting it: the
            // header creeping into view under the next section is not "you are
            // in the Research section".
            const onScreen = rect.top < vh * 0.4 && rect.bottom > vh * 0.5
            fab.classList.toggle("is-shown", onScreen && activeTab === zoomTab.id)
        }

        mainPage.addEventListener("scroll", update, { passive: true })
        window.addEventListener("resize", update)
        update()
        syncFab = update
    }

    if (zoom) {
        // The rail's way out of the zoom. It points at whichever tab is not the
        // zoom.
        const other = tabs.find((tab) => tab.kind !== "reality-zoom")
        if (other) {
            zoom.exit.textContent = other.label + " →"
            zoom.exit.addEventListener("click", () => goToTab(other.id))
        } else {
            zoom.exit.remove()
        }

        zoom.driver = initRealityZoom(zoom, mainPage)
        if (other) initCreationsFab(other)
    }
})()
