/* services.js
 * Renders the Information → Services tab from SERVICES_CONTENT.
 *
 * The tab is one honeycomb. Every cell is the same hexagon: a picture on top,
 * and under it the domain, the job, what it was, and — where the entry has
 * them — the client and the year. The comb closes with a red cell that is
 * simply an invitation to write. Everything a hexagon has to say is on its
 * face; nothing expands.
 *
 * ── Delivered or offered ──
 * There is no flag for it. An entry with a client or a date is work done, an
 * entry with neither is work available, and that is read straight off the
 * content module — see `isDelivered`. It decides the meta line and how far the
 * photograph is held back, so promoting a capability to a contract is a matter
 * of filling in two fields rather than moving it between lists.
 *
 * ── Turning over ──
 * Clicking a hexagon flips it to its back, which carries the same invitation
 * on every card. The card is not a <button>: the back holds a real mailto
 * anchor, and an <a> inside a <button> is invalid. The *front face* takes
 * role="button" and a tabindex instead — it has no interactive content of its
 * own, so that is honest — while the back stays a plain region whose anchor is
 * reachable on its own. The face turned away is `inert`, so it is out of the
 * tab order and the accessibility tree rather than merely undrawn.
 *
 * ── Placement is computed, not measured ──
 * The comb itself is shared/honeycomb.js — the Research section's tools use the
 * same placement with a smaller hexagon. Everything this module has to hold up
 * its end of is in that file's header; the two constants below are the only
 * thing about the comb that is specific to this section.
 *
 * As in join.js, everything is built as DOM nodes rather than innerHTML — the
 * content module is plain text, and a stray "<" in a client name should not be
 * able to open an element.
 */

import { SERVICES_CONTENT } from "./services-content.js"
import { element, createRichText } from "../shared/rich-text.js"
import { createHoneycomb } from "../shared/honeycomb.js"

const ROOT_ID = "services-root"

const ALL_FILTER = "all"

/* Below this a hexagon stops having room for its face in the band where it is
   still full width, so the honeycomb drops a column instead. */
const MIN_HEX_WIDTH = 300

/* "Large hexagons" was the brief; past three across they stop being large. */
const MAX_COLUMNS = 3

const { appendRichText } = createRichText({
    linkClass: "services-link",
    listClass: "services-rich-list",
})

/* Work done, as opposed to work offered. The presence of the fields is the
   flag — see the header of services-content.js. */
function isDelivered(entry) {
    return Boolean(entry.client || entry.date)
}

function applyAccent(node, accent) {
    if (!accent) return node
    node.style.setProperty("--svc-accent", accent.accent)
    node.style.setProperty("--svc-deep", accent.deep)
    node.style.setProperty("--svc-ink", accent.ink)
    return node
}

function ctaLink(action) {
    const link = element("a", "contact-cta" + (action.primary ? " contact-cta--primary" : ""), action.label)
    link.href = action.href
    if (!/^(#|mailto:)/.test(action.href)) {
        link.target = "_blank"
        link.rel = "noreferrer noopener"
    }
    return link
}

function mailLink(address, className) {
    const link = element("a", className, address)
    link.href = "mailto:" + address
    return link
}

/* ── Hero ── */
function renderHero(content) {
    const hero = element("header", "services-hero")

    hero.appendChild(element("p", "services-hero__eyebrow", content.eyebrow))
    hero.appendChild(element("h3", "services-hero__headline", content.headline))
    hero.appendChild(element("p", "services-hero__lede", content.lede))

    if (content.cta) {
        const actions = element("p", "services-hero__actions")
        actions.appendChild(ctaLink({ ...content.cta, primary: true }))
        hero.appendChild(actions)
    }

    return hero
}

/* ── The shell every hexagon shares ──
 * The cell is the grid item and carries the placement, the drop-shadow and the
 * ring; the hexagon inside it holds the two faces. They cannot be the same
 * element: `clip-path` would cut the shadow and the ring off with everything
 * else outside the six sides, and it is applied to each face rather than to
 * the card because clipping an ancestor of a preserve-3d subtree flattens it
 * and the flip stops being a flip.
 */
function buildShell(accent, modifier) {
    /* The accent goes on the cell rather than the hexagon so the ring drawn by
       .services-cell::before can read it. Custom properties inherit, so the
       faces still get the same values. */
    const cell = applyAccent(element("div", "services-cell"), accent)

    const hex = element("div", "services-hex" + (modifier ? " " + modifier : ""))
    const inner = element("div", "services-hex__inner")
    const front = element("div", "services-hex__face services-hex__face--front")

    hex.appendChild(inner)
    inner.appendChild(front)
    cell.appendChild(hex)

    return { cell, hex, inner, front }
}

/* A client's own mark, where the entry carries one, instead of the domain's
   stock photograph: it is shown whole on a pale ground rather than cropped and
   tinted, because a logo that has been duotoned and cover-cropped is no longer
   the logo. */
function buildMedia(entry, domain) {
    const media = element("span", "services-hex__media" + (entry.logo ? " services-hex__media--logo" : ""))
    const image = element("img")

    if (entry.logo) {
        image.src = entry.logo
        image.alt = entry.logoAlt || ""
    } else {
        image.src = domain.image
        image.alt = ""
        media.appendChild(element("span", "services-hex__tint"))
    }

    image.loading = "lazy"
    media.insertBefore(image, media.firstChild)
    return media
}

/* ── The back ──
 * One message for every card. It is built per hexagon rather than shared,
 * because a single node cannot be on the back of fourteen cards at once, but
 * the copy comes from one place in the content module.
 */
function buildBack(flip, onFlipBack) {
    const back = element("div", "services-hex__face services-hex__face--back")
    back.setAttribute("role", "group")

    const body = element("div", "services-hex__body")
    body.appendChild(element("p", "services-hex__back-question", flip.question))

    const address = element("p", "services-hex__back-address")
    address.appendChild(document.createTextNode(flip.lead + " "))
    const mail = mailLink(flip.email, "services-hex__mail")
    address.appendChild(mail)
    body.appendChild(address)

    body.appendChild(element("p", "services-hex__back-tail", flip.tail))
    back.appendChild(body)

    /* Anywhere that is not the address turns the card back over. This listens
       on the face rather than on a stretched overlay: the body is absolutely
       positioned, so an `inset: 0` overlay inside it covers the text band and
       stops short of the picture above — which made the whole top half of
       every card a dead zone. */
    back.addEventListener("click", (event) => {
        if (event.target.closest("a")) return
        onFlipBack()
    })

    return { back, mail }
}

/* ── One turnable hexagon ──
 * Face, top to bottom: the domain, the title in bold, the description, and the
 * client and date where the entry has them.
 */
function buildEntryCard(entry, domain, content) {
    const delivered = isDelivered(entry)
    const kind = delivered ? "contract" : "capability"
    const { cell, hex, inner, front } = buildShell(domain.accent, "services-hex--" + kind)
    hex.dataset.card = entry.id

    front.appendChild(buildMedia(entry, domain))

    const body = element("div", "services-hex__body")
    body.appendChild(element("p", "services-hex__eyebrow", domain.label))
    body.appendChild(element("h5", "services-hex__title", entry.title))
    if (entry.description) {
        body.appendChild(appendRichText(element("p", "services-hex__text"), entry.description))
    }

    const meta = [entry.client, entry.date].filter(Boolean).join(" · ")
    if (meta) body.appendChild(element("p", "services-hex__meta", meta))
    front.appendChild(body)

    const { back, mail } = buildBack(content.flip, () => setFlipped(false))
    inner.appendChild(back)

    /* No visible control on either face, so the front *is* the control: it has
       no interactive content of its own, which is what makes role="button"
       honest here rather than a label stuck on a div. The back cannot take the
       same treatment — its anchor would be an interactive element nested
       inside a button — so it stays a region and Escape is its way out. */
    front.setAttribute("role", "button")
    front.tabIndex = 0
    front.setAttribute("aria-label", entry.title + " — " + content.flip.question)

    function setFlipped(flipped) {
        hex.classList.toggle("services-hex--flipped", flipped)
        front.setAttribute("aria-expanded", flipped ? "true" : "false")
        /* inert takes the hidden face out of the tab order and the
           accessibility tree, which backface-visibility alone does not do —
           it only stops it being drawn. */
        front.inert = flipped
        back.inert = !flipped
        // Land on the address when turning over: it is the reason to turn.
        ;(flipped ? mail : front).focus({ preventScroll: true })
    }

    front.setAttribute("aria-expanded", "false")
    front.inert = false
    back.inert = true

    front.addEventListener("click", () => setFlipped(true))
    front.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return
        event.preventDefault()
        setFlipped(true)
    })

    return { cell, hex, id: entry.id, domainId: domain.id, flip: setFlipped }
}

/* ── The cell that closes the honeycomb ──
 * Static: it is already the side every other hexagon turns over to, so turning
 * it would only show the same thing twice.
 */
function buildOutro(outro) {
    const { cell, hex, front } = buildShell(outro.accent, "services-hex--outro")

    const body = element("div", "services-hex__body")
    body.appendChild(element("p", "services-hex__eyebrow", outro.kicker))
    body.appendChild(element("h5", "services-hex__title", outro.title))
    if (outro.text) body.appendChild(element("p", "services-hex__text", outro.text))
    body.appendChild(mailLink(outro.email, "services-hex__mail"))
    front.appendChild(body)

    // No domainId: the filter reads that as "always on show".
    return { cell, hex, id: outro.id, domainId: null, flip: null }
}

/* ── The filter ──
 * One chip per domain plus an "everything". Same contract as join.js's filter
 * bar: aria-pressed on the chips carries the state.
 */
function buildFilters(content, onSelect) {
    const chips = element("div", "services-filters")
    chips.setAttribute("role", "group")
    chips.setAttribute("aria-label", "Filter by kind of work")

    const buttons = [{ id: ALL_FILTER, label: content.filterAllLabel }]
        .concat(content.domains.map((domain) => ({ id: domain.id, label: domain.label, accent: domain.accent })))
        .map((entry) => {
            const chip = applyAccent(element("button", "services-filter", entry.label), entry.accent)
            chip.type = "button"
            chip.dataset.filter = entry.id
            chip.setAttribute("aria-pressed", "false")
            chip.addEventListener("click", () => onSelect(entry.id))
            chips.appendChild(chip)
            return chip
        })

    function sync(active) {
        buttons.forEach((chip) => {
            const isActive = chip.dataset.filter === active
            chip.setAttribute("aria-pressed", isActive ? "true" : "false")
            chip.classList.toggle("services-filter--active", isActive)
        })
    }

    return { bar: chips, sync }
}

;(function initServices() {
    const root = document.getElementById(ROOT_ID)
    if (!root) return

    const content = SERVICES_CONTENT
    const domainsById = new Map(content.domains.map((domain) => [domain.id, domain]))

    const layout = element("div", "services")
    layout.appendChild(renderHero(content))

    /* An entry naming a domain that does not exist would otherwise vanish from
       the honeycomb without a word — the one failure mode of the id join. */
    const entryCards = content.entries
        .map((entry) => {
            const domain = domainsById.get(entry.domain)
            if (!domain) {
                console.error(
                    'services-content.js: entry "' + entry.id + '" names unknown domain "' + entry.domain + '"',
                )
                return null
            }
            return buildEntryCard(entry, domain, content)
        })
        .filter(Boolean)

    /* The red cell has no domain of its own and survives every filter —
       whichever kind of help you are looking at, the way to ask about it should
       still be at the end of the honeycomb. */
    const outroCard = content.outro ? buildOutro(content.outro) : null
    const allCards = outroCard ? entryCards.concat([outroCard]) : entryCards

    /* The header holds only the filter bar — the chips name the three strands
       of work between them, so a heading over them was saying it twice. It is
       still the element sizeBanner() measures to, since it is still the line
       where the pitch ends and the work begins. */
    const gallery = element("section", "services-gallery")
    const header = element("div", "services-gallery__header")

    const filters = buildFilters(content, applyFilter)
    header.appendChild(filters.bar)
    gallery.appendChild(header)

    const grid = element("div", "services-grid")
    allCards.forEach(({ cell }) => grid.appendChild(cell))
    gallery.appendChild(grid)
    layout.appendChild(gallery)

    const comb = createHoneycomb(grid, {
        cells: () => allCards.map(({ cell }) => cell),
        minWidth: MIN_HEX_WIDTH,
        maxColumns: MAX_COLUMNS,
        columnsVar: "--svc-columns",
        pullVar: "--svc-row-pull",
    })

    root.appendChild(layout)

    function place() {
        comb.place()
        sizeBanner()
    }

    /* ── Filtering ──
     * `hidden` on the cells that drop out, which takes them out of grid layout
     * so the comb closes up rather than leaving holes. Any card showing its
     * address is turned back first: it would otherwise be left face-down in a
     * comb that has rearranged underneath it.
     */
    function applyFilter(next) {
        turnAllBack()

        allCards.forEach((card) => {
            card.cell.hidden = !(next === ALL_FILTER || card.domainId === next || !card.domainId)
        })

        filters.sync(next)
        place()
    }

    function turnAllBack() {
        allCards.forEach((card) => {
            if (card.flip && card.hex.classList.contains("services-hex--flipped")) card.flip(false)
        })
    }

    /* ── Where the photograph stops ──
     * The banner should end at the honeycomb, so the pitch floats over the
     * photograph and the work sits on the page. That line is the bottom of the
     * hero, which moves with the headline's wrapping and the viewport, so it is
     * measured rather than guessed at — a fixed max-height was tuned against a
     * hero that had three panels under it and overran by 120px once they were
     * removed.
     */
    function sizeBanner() {
        const section = root.closest(".contact-full")
        if (!section || section.dataset.activeTab !== "services") return

        const backdrop = section.querySelector(".contact-full__backdrop")
        if (!backdrop) return

        const top = backdrop.getBoundingClientRect().top
        const end = header.getBoundingClientRect().top
        // A hidden tab measures every rect at zero; nothing to size against.
        if (end <= top) return

        section.style.setProperty("--svc-banner-height", Math.round(end - top) + "px")
    }

    applyFilter(ALL_FILTER)

    /* Escape turns back whichever card is showing its address — and with no
       control on the back face, it is the keyboard's way out. */
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") turnAllBack()
    })

    /* Re-place when the column count changes, and only then: `place()` alters
       the grid's height, which the observer also sees, so re-placing on that
       would have it chase its own tail. The window listener is what actually
       fires in most environments; the ResizeObserver covers the grid changing
       width without the window doing so — the nav becoming a sidebar at
       1800px, or the tab being shown for the first time. */
    function replaceIfColumnsChanged() {
        if (comb.needsReplace()) place()
    }

    window.addEventListener("resize", replaceIfColumnsChanged)
    if (typeof ResizeObserver === "function") {
        new ResizeObserver(replaceIfColumnsChanged).observe(grid)
    }

    /* Deep links. `#services-iacs-2026` both opens the Services tab — by
       clicking its button, so script.js's own handler does the work — and
       turns that card over. */
    function openFromHash() {
        const match = /^#services-(.+)$/.exec(window.location.hash)
        if (!match) return
        const card = allCards.find((entry) => entry.id === match[1])
        if (!card) return

        const tab = document.getElementById("contact-tab-btn-services")
        if (tab && tab.getAttribute("aria-selected") !== "true") tab.click()
        // Clear the filter first: turning over a card that is currently
        // filtered out would flip something nobody can see.
        if (card.cell.hidden) applyFilter(ALL_FILTER)
        if (card.flip) card.flip(true)
    }

    window.addEventListener("hashchange", openFromHash)
    openFromHash()

    /* A hidden tab has no width, so the first `place()` above ran against a
       clientWidth of 0 and fell back to the widest honeycomb. Re-place whenever
       the tab is shown. script.js is earlier in the document, so its own
       handler has already un-hidden the panel by the time this runs. */
    document.querySelectorAll(".contact-tab-btn, [data-contact-tab-target]").forEach((tab) => {
        tab.addEventListener("click", place)
    })
})()
