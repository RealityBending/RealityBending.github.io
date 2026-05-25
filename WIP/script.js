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

function initContactTabs() {
    const buttons = Array.from(document.querySelectorAll(".contact-tab-btn"))
    const panels = Array.from(document.querySelectorAll(".contact-tab-panel"))
    if (!buttons.length || !panels.length) return

    function activateContactTab(tab) {
        buttons.forEach((button) => {
            const isActive = button.dataset.tab === tab
            button.classList.toggle("contact-tab-btn--active", isActive)
            button.setAttribute("aria-selected", isActive ? "true" : "false")
        })

        panels.forEach((panel) => {
            panel.hidden = panel.id !== "contact-" + tab
        })
    }

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            activateContactTab(button.dataset.tab || "contact")
        })
    })

    document.querySelectorAll("[data-contact-tab-target]").forEach((link) => {
        link.addEventListener("click", () => {
            activateContactTab(link.getAttribute("data-contact-tab-target") || "contact")
        })
    })

    const hashToTab = {
        "#contact-contact": "contact",
        "#contact-join": "join",
        "#contact-services": "services",
    }

    function activateFromHash() {
        const tab = hashToTab[window.location.hash]
        if (tab) {
            activateContactTab(tab)
        }
    }

    window.addEventListener("hashchange", activateFromHash)
    activateContactTab(hashToTab[window.location.hash] || "contact")
}

function initContactBanners() {
    const banners = Array.from(document.querySelectorAll(".contact-banner"))
    if (!banners.length || !mainPage) return

    function updateContactBanners() {
        const scrollRange = Math.max(0, mainPage.scrollHeight - mainPage.clientHeight)
        const scrollProgress = scrollRange > 0 ? mainPage.scrollTop / scrollRange : 0

        banners.forEach((banner) => {
            const rect = banner.getBoundingClientRect()
            if (!rect.height) return

            const travel = Math.max(96, rect.height * 0.82)
            const offset = -travel * scrollProgress

            banner.style.setProperty("--contact-banner-travel", travel.toFixed(2) + "px")
            banner.style.setProperty("--contact-banner-offset", offset.toFixed(2) + "px")
        })
    }

    mainPage.addEventListener("scroll", updateContactBanners, { passive: true })
    window.addEventListener("resize", updateContactBanners)
    updateContactBanners()
}

if (mainPage) {
    mainPage.addEventListener("scroll", updateActiveNav, { passive: true })
    updateActiveNav()
}

initContactTabs()
initContactBanners()
