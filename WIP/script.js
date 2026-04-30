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
const sectionNavMap = [
    { id: "sec-people-full", href: "#sec-people" },
    { id: "sec-publications-full", href: "#sec-publications" },
    { id: "sec-contact-full", href: "#sec-contact" },
]

function updateActiveNav() {
    const mid = window.innerHeight / 2
    let activeHref = null

    for (const { id, href } of sectionNavMap) {
        const el = document.getElementById(id)
        if (!el) continue
        const r = el.getBoundingClientRect()
        if (r.top <= mid && r.bottom >= mid) {
            activeHref = href
            break
        }
    }

    document.querySelectorAll("nav a").forEach((a) => a.classList.remove("active"))
    if (activeHref) {
        const link = document.querySelector(`nav a[href="${activeHref}"]`)
        if (link) link.classList.add("active")
    }
}

if (mainPage) {
    mainPage.addEventListener("scroll", updateActiveNav, { passive: true })
}
