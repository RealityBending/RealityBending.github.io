import { RESEARCH_CONTENT } from "./research-content.js"
import { LEAVE_DURATION, swapTabPanels } from "../shared/tab-slide.js"
import { buildRealityZoom, initRealityZoom } from "./reality-zoom.js"

/* The Research section is two tabs over one shell. Overview is the scroll-driven
   zoom (reality-zoom.js); anything else falls back to the card layout the other
   sections use.

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

    function createCard(card) {
        const article = document.createElement("article")
        article.className = "research-card"

        if (card.meta) {
            const meta = document.createElement("div")
            meta.className = "research-card__meta"
            meta.textContent = card.meta
            article.appendChild(meta)
        }

        if (card.title) {
            const title = document.createElement("h3")
            title.className = "research-card__title"
            title.textContent = card.title
            article.appendChild(title)
        }

        if (card.text) {
            const text = document.createElement("p")
            text.className = "research-card__text"
            text.textContent = card.text
            article.appendChild(text)
        }

        return article
    }

    function fillCardTab(panel, tab) {
        const header = document.createElement("div")
        header.className = "research-tab-header"

        if (tab.eyebrow) {
            const eyebrow = document.createElement("div")
            eyebrow.className = "research-tab-eyebrow"
            eyebrow.textContent = tab.eyebrow
            header.appendChild(eyebrow)
        }

        if (tab.heading) {
            const heading = document.createElement("h3")
            heading.className = "research-tab-heading"
            heading.textContent = tab.heading
            header.appendChild(heading)
        }

        if (tab.lede) {
            const lede = document.createElement("p")
            lede.className = "research-tab-lede"
            lede.textContent = tab.lede
            header.appendChild(lede)
        }

        panel.appendChild(header)

        if (Array.isArray(tab.cards) && tab.cards.length) {
            const grid = document.createElement("div")
            grid.className = "research-card-grid"
            tab.cards.forEach((card) => grid.appendChild(createCard(card)))
            panel.appendChild(grid)
        }
    }

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
            panel.classList.add("research-tab-panel--cards")
            fillCardTab(panel, tab)
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

    function activateTab(tabId) {
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

    if (zoom) {
        // The rail's way out of the zoom. It points at whichever tab is not the
        // zoom, and scrolls the section header back into view along with it —
        // switching tabs at the bottom of a 700vh track otherwise lands the
        // reader on a short panel they have already scrolled past.
        const other = tabs.find((tab) => tab.kind !== "reality-zoom")
        if (other) {
            zoom.exit.textContent = other.label + " →"
            zoom.exit.addEventListener("click", () => {
                // activateTab shuts the gate on the way out, so coming back to
                // Overview starts from the poster rather than dropping the
                // reader into the middle of a track they had already left.
                activateTab(other.id)
                const section = document.getElementById("sec-research-full")
                if (section && mainPage) {
                    mainPage.scrollTo({ top: section.offsetTop, behavior: "smooth" })
                }
            })
        } else {
            zoom.exit.remove()
        }

        zoom.driver = initRealityZoom(zoom, mainPage)
    }
})()
