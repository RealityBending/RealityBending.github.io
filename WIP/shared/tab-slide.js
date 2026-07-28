/* tab-slide.js
 * Shared transition for every tab group on the page (people, research,
 * publications, contact).
 *
 * Each group used to swap panels by toggling `hidden` outright. swapTabPanels
 * keeps that contract but animates it: the incoming panel takes the flow slot
 * immediately, while the outgoing one is pinned where it sat, lifted out of the
 * flow and slid off to the left — so it reads as the old tab sliding away to
 * uncover the new one.
 */

const LEAVE_DURATION = 320
const LEAVING_CLASS = "tab-panel--leaving"
const LEAVING_BACK_CLASS = "tab-panel--leaving-back"
const ENTERING_CLASS = "tab-panel--entering"

/* Everything swapTabPanels writes inline, so it can hand the panel back
   untouched afterwards. */
const PINNED_PROPS = ["position", "top", "left", "width", "zIndex", "pointerEvents"]

/* Set by the margin arrows just before they forward their click. Without it a
   wrap from the last tab back to the first would read as "backwards" from the
   panel order and slide against the arrow the reader just pressed. */
let pendingDirection = 0

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/* Undo the pinning, whether the slide finished or a second click cut it short. */
function releasePanel(panel) {
    if (panel.tabSlideTimer) {
        clearTimeout(panel.tabSlideTimer)
        panel.tabSlideTimer = null
    }

    panel.classList.remove(LEAVING_CLASS, LEAVING_BACK_CLASS, ENTERING_CLASS)
    PINNED_PROPS.forEach((prop) => {
        panel.style[prop] = ""
    })

    if (panel.tabSlideParent) {
        panel.tabSlideParent.style.position = ""
        panel.tabSlideParent = null
    }
}

export function swapTabPanels(panels, activeId) {
    // Read and clear up front so a swap that bails out early can't leave a
    // stale direction behind for the next one.
    const forcedDirection = pendingDirection
    pendingDirection = 0

    const list = Array.from(panels)
    if (!list.length) return

    const incoming = list.find((panel) => panel.id === activeId) || null
    const outgoing = list.find((panel) => panel !== incoming && !panel.hidden) || null

    // A click during a running slide lands here: drop the old one on the spot.
    list.forEach(releasePanel)

    // Nothing to slide from — first paint, an unknown tab, or motion turned down.
    if (!incoming || !outgoing || prefersReducedMotion()) {
        list.forEach((panel) => {
            panel.hidden = panel !== incoming
        })
        return
    }

    // Measure while the outgoing panel still owns the flow slot the incoming
    // one is about to take, so pinning it leaves it visually in place.
    const parent = outgoing.parentElement
    const parentRect = parent.getBoundingClientRect()
    const rect = outgoing.getBoundingClientRect()
    const top = rect.top - parentRect.top - parent.clientTop
    const left = rect.left - parentRect.left - parent.clientLeft
    const width = rect.width

    // Absolute offsets resolve against the nearest positioned ancestor, so the
    // parent has to be one for the measurements above to hold.
    if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative"
        outgoing.tabSlideParent = parent
    }

    list.forEach((panel) => {
        if (panel !== outgoing) panel.hidden = panel !== incoming
    })

    outgoing.style.position = "absolute"
    outgoing.style.top = top + "px"
    outgoing.style.left = left + "px"
    outgoing.style.width = width + "px"
    outgoing.style.zIndex = "3"
    outgoing.style.pointerEvents = "none"

    // An arrow says which way it points; otherwise the panels' own order tells
    // us, so tab buttons slide correctly without every caller having to say so.
    const goingBack = forcedDirection ? forcedDirection < 0 : list.indexOf(incoming) < list.indexOf(outgoing)
    outgoing.classList.add(goingBack ? LEAVING_BACK_CLASS : LEAVING_CLASS)
    incoming.classList.add(ENTERING_CLASS)

    outgoing.tabSlideTimer = setTimeout(() => {
        releasePanel(outgoing)
        outgoing.hidden = true
        incoming.classList.remove(ENTERING_CLASS)
    }, LEAVE_DURATION)
}

/* Turns the empty margins either side of a section's content column into
   prev/next tab controls. Clicks are forwarded to the group's own tab buttons,
   so each section keeps whatever else its handler does (history, theming). */
export function initMarginTabNav(container, buttonSelector) {
    if (!container || container.dataset.marginTabNav === "true") return
    if (container.querySelectorAll(buttonSelector).length < 2) return

    container.dataset.marginTabNav = "true"
    container.classList.add("tab-margin-host")

    const step = (delta) => {
        const buttons = Array.from(container.querySelectorAll(buttonSelector))
        if (buttons.length < 2) return
        const current = buttons.findIndex((button) => button.getAttribute("aria-selected") === "true")
        const from = current === -1 ? 0 : current
        buttons[(from + delta + buttons.length) % buttons.length].click()
    }

    ;[
        { modifier: "prev", delta: -1, label: "Previous tab" },
        { modifier: "next", delta: 1, label: "Next tab" },
    ].forEach(({ modifier, delta, label }) => {
        const zone = document.createElement("button")
        zone.type = "button"
        zone.className = "tab-margin-nav tab-margin-nav--" + modifier
        zone.setAttribute("aria-label", label)
        zone.tabIndex = -1

        const chevron = document.createElement("span")
        chevron.className = "tab-margin-nav__chevron"
        zone.appendChild(chevron)

        zone.addEventListener("click", () => {
            pendingDirection = delta
            step(delta)
            // The group's handler runs synchronously inside step(), so anything
            // still set here means it never swapped — drop it rather than let
            // it colour an unrelated swap later.
            queueMicrotask(() => {
                pendingDirection = 0
            })
        })
        container.appendChild(zone)
    })
}
