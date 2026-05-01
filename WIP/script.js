import { ACTIVE_NAV_SECTIONS, applySectionTheme } from "./site-sections.js"

/* script.js
 * Entry-point for the landing page interaction.
 * Handles the door-screen open animation: listens for click / keyboard
 * events to trigger the CSS opening class, then hides the overlay once
 * the opacity transition completes so it is removed from the a11y tree.
 */
const doorScreen = document.getElementById("door-screen")
const mainPage = document.getElementById("main-page")

applySectionTheme()

let hasOpened = false

function openDoors() {
    if (!doorScreen || !mainPage || hasOpened) return

    hasOpened = true
    doorScreen.classList.add("opening")
    doorScreen.setAttribute("aria-hidden", "true")
    mainPage.classList.add("visible")
}

if (doorScreen && mainPage) {
    doorScreen.addEventListener("click", openDoors)
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

if (mainPage) {
    mainPage.addEventListener("scroll", updateActiveNav, { passive: true })
    updateActiveNav()
}
