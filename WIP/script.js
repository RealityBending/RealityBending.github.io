import { ACTIVE_NAV_SECTIONS, applySectionTheme } from "./site-sections.js"

/* script.js
 * Entry-point for the landing page interaction.
 * Handles the door-screen open animation: listens for click / keyboard
 * events to trigger the CSS opening class, then hides the overlay once
 * the opacity transition completes so it is removed from the a11y tree.
 */
const doorScreen = document.getElementById("door-screen")
const mainPage = document.getElementById("main-page")

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

if (mainPage) {
    mainPage.addEventListener("scroll", updateActiveNav, { passive: true })
    mainPage.addEventListener("scroll", updateNavVisibility, { passive: true })
    window.addEventListener("resize", updateNavVisibility)
    updateActiveNav()
    updateNavVisibility()
}

initContactTabs()
initContactBanners()
initHeroGlow()
