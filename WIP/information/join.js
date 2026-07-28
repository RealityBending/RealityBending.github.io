/* join.js
 * Renders the Information → Join tab from JOIN_CONTENT.
 *
 * The tab is a stage explorer: a rail of career levels (undergraduate → RA →
 * PhD → postdoc) across the top, one panel of content per level below it. The
 * panels are swapped with the same shared/tab-slide.js transition every other
 * tab group on the page uses, so a level change reads the same way as a tab
 * change one level up.
 *
 * Everything is built as DOM nodes rather than innerHTML — the content module
 * is plain text, and a stray "<" in a scholarship name should not be able to
 * open an element. The one exception is the inline markup parser below, which
 * only ever produces <a>, <em> and <strong>.
 *
 * Opportunities are one block type across all three levels (`routes`), so a
 * scheme looks the same whether it funds a summer project or a fellowship. A
 * sparse entry is just a card with fewer fields filled in, not another layout.
 */

import { JOIN_CONTENT } from "./join-content.js"
import { swapTabPanels } from "../shared/tab-slide.js"

const ROOT_ID = "join-root"
const STAGE_PANEL_PREFIX = "join-stage-"
const ALL_FILTER = "Everything"

/* ── Inline markup ──
 * `[label](href)`, `*emphasis*`, `**strong**` and `***both***`, and nothing
 * else. Enough to keep a link inside a sentence without handing the content
 * file the power to inject markup.
 *
 * The asterisk runs are alternatives rather than one nestable rule, longest
 * first — `**bold**` matched by the single-asterisk rule would otherwise take
 * the *second* star as its opener and leave stray ones on either side.
 */
const INLINE_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*/g

function appendRichText(parent, text) {
    if (!text) return parent

    let cursor = 0
    let match

    INLINE_PATTERN.lastIndex = 0
    while ((match = INLINE_PATTERN.exec(text)) !== null) {
        if (match.index > cursor) {
            parent.appendChild(document.createTextNode(text.slice(cursor, match.index)))
        }

        if (match[1]) {
            parent.appendChild(createLink(match[1], match[2]))
        } else if (match[3]) {
            const strong = document.createElement("strong")
            strong.appendChild(element("em", null, match[3]))
            parent.appendChild(strong)
        } else {
            parent.appendChild(element(match[4] ? "strong" : "em", null, match[4] || match[5]))
        }

        cursor = match.index + match[0].length
    }

    if (cursor < text.length) {
        parent.appendChild(document.createTextNode(text.slice(cursor)))
    }

    return parent
}

/* In-page anchors and mailto links must not open a new tab; everything else
   points off-site and should. */
function createLink(label, href) {
    const anchor = document.createElement("a")
    anchor.className = "join-link"
    anchor.href = href
    anchor.textContent = label

    if (!/^(#|mailto:)/.test(href)) {
        anchor.target = "_blank"
        anchor.rel = "noreferrer noopener"
    }

    return anchor
}

function element(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text != null) node.textContent = text
    return node
}

function paragraph(className, text) {
    return appendRichText(element("p", className), text)
}

/* ── Block-level markup ──
 * A blank line starts a new paragraph; a run of lines opening "- " becomes a
 * list. That is the whole grammar — enough for a lede that wants to make a few
 * points without the content module having to hand-build DOM.
 *
 * Lines are trimmed individually rather than dedented against a common prefix,
 * because these are written as template literals: the first line sits against
 * the backtick with no indentation at all, so a common prefix would always be
 * empty and dedent nothing.
 */
function appendRichBlocks(container, text) {
    if (!text) return container

    let pending = []
    let list = null

    function flushParagraph() {
        if (!pending.length) return
        container.appendChild(paragraph(null, pending.join(" ")))
        pending = []
    }

    String(text)
        .split("\n")
        .map((line) => line.trim())
        .forEach((line) => {
            if (!line) {
                flushParagraph()
                list = null
                return
            }

            // A plain dash, or the author's own emoji used as the bullet — a
            // "✅" list keeps its ticks instead of being given generic dots.
            // The required space is what keeps this off "*emphasis*" at the
            // start of a line.
            // \uFE0F and \u200D are the variation selector and zero-width
            // joiner, so a compound emoji is taken whole rather than split.
            const bullet = /^([-–—*•]|[\p{Extended_Pictographic}\uFE0F\u200D]+)\s+(.*)$/u.exec(line)
            if (bullet) {
                flushParagraph()
                if (!list) {
                    list = element("ul", "join-rich-list")
                    container.appendChild(list)
                }
                const item = appendRichText(element("li"), bullet[2])
                if (!/^[-–—*•]$/.test(bullet[1])) item.dataset.marker = bullet[1]
                list.appendChild(item)
                return
            }

            list = null
            pending.push(line)
        })

    flushParagraph()
    return container
}

/* ── Block renderers ── */

function renderBlockHeader(block) {
    const header = document.createDocumentFragment()
    if (block.title) header.appendChild(element("h4", "join-block__title", block.title))
    if (block.note) header.appendChild(paragraph("join-block__note", block.note))
    return header
}

/* `featured: true` lifts a card out of the grid's uniformity with three stars
   in its corner; `featured: "…"` does the same and names it for screen readers
   ("Recommended", "Start here"). Position in the grid is left to the content
   module's own ordering. */
function buildRouteCards(items) {
    const grid = element("div", "join-routes")

    const entries = items.map((item) => {
        const card = element("article", "join-route" + (item.featured ? " join-route--featured" : ""))

        if (item.featured) {
            // Decorative to the eye, named to a screen reader — three stars on
            // their own would otherwise be announced as "black star" thrice.
            const stars = element("span", "join-route__stars", "★★★")
            stars.setAttribute("role", "img")
            stars.setAttribute("aria-label", typeof item.featured === "string" ? item.featured : "Featured")
            card.appendChild(stars)
        }

        if (item.meta) card.appendChild(element("p", "join-route__meta", item.meta))
        card.appendChild(element("h5", "join-route__name", item.name))
        if (item.blurb) card.appendChild(appendRichBlocks(element("div", "join-route__blurb"), item.blurb))

        if (Array.isArray(item.highlights) && item.highlights.length) {
            const list = element("ul", "join-route__highlights")
            item.highlights.forEach((highlight) => list.appendChild(element("li", null, highlight)))
            card.appendChild(list)
        }

        if (Array.isArray(item.links) && item.links.length) {
            const links = element("p", "join-route__links")
            item.links.forEach((link) => links.appendChild(createLink(link.label, link.href)))
            card.appendChild(links)
        }

        grid.appendChild(card)
        return { node: card, tags: item.tags || [] }
    })

    return { grid, entries }
}

/* The eligibility filter. "Open to all" entries survive every filter — picking
   a country asks "what can I apply for", which includes the unrestricted ones,
   not just the country-specific ones. Picking "Open to all" itself is the one
   case where that would be a no-op, so there it means exactly what it says.
 *
 * It takes the cards' entries rather than the block, so it never has to know
 * what it is filtering — only which nodes carry which tags.
 */
function buildFilterBar(entries) {
    const tags = []
    entries.forEach((entry) => {
        entry.tags.forEach((tag) => {
            if (!tags.includes(tag)) tags.push(tag)
        })
    })
    if (!tags.length) return null

    const filters = element("div", "join-filters")
    filters.setAttribute("role", "group")
    filters.setAttribute("aria-label", "Filter by eligibility")

    const count = element("p", "join-filters__count")
    count.setAttribute("aria-live", "polite")

    function apply(active) {
        let shown = 0
        entries.forEach((entry) => {
            const match =
                active === ALL_FILTER ||
                entry.tags.includes(active) ||
                (active !== "Open to all" && entry.tags.includes("Open to all"))
            entry.node.hidden = !match
            if (match) shown += 1
        })
        count.textContent = (shown === entries.length ? entries.length : shown + " of " + entries.length) + " schemes"
    }

    ;[ALL_FILTER].concat(tags).forEach((tag, index) => {
        const chip = element("button", "join-filter", tag)
        chip.type = "button"
        chip.setAttribute("aria-pressed", index === 0 ? "true" : "false")

        chip.addEventListener("click", () => {
            filters.querySelectorAll(".join-filter").forEach((other) => {
                const isActive = other === chip
                other.setAttribute("aria-pressed", isActive ? "true" : "false")
                other.classList.toggle("join-filter--active", isActive)
            })
            apply(tag)
        })

        if (index === 0) chip.classList.add("join-filter--active")
        filters.appendChild(chip)
    })

    apply(ALL_FILTER)

    const bar = element("div", "join-filters__bar")
    bar.appendChild(filters)
    bar.appendChild(count)
    return bar
}

/* Every level's opportunities render through here: a card grid, with the
   eligibility filter above it when the items carry tags. */
function renderRoutes(block) {
    const out = document.createDocumentFragment()
    const cards = buildRouteCards(block.items)

    const bar = buildFilterBar(cards.entries)
    if (bar) out.appendChild(bar)

    out.appendChild(cards.grid)
    return out
}

function renderSteps(block) {
    const list = element("ol", "join-steps")

    block.items.forEach((item) => {
        const step = element("li", "join-step-item")
        step.appendChild(element("h5", "join-step-item__title", item.title))
        step.appendChild(paragraph("join-step-item__text", item.text))
        list.appendChild(step)
    })

    return list
}

function renderFaq(block) {
    const list = element("div", "join-faq")

    block.items.forEach((item) => {
        const entry = document.createElement("details")
        entry.className = "join-faq__item"

        const summary = document.createElement("summary")
        summary.className = "join-faq__question"
        summary.appendChild(element("span", null, item.q))
        entry.appendChild(summary)

        const body = element("div", "join-faq__answer")
        item.a.forEach((text) => body.appendChild(paragraph(null, text)))
        entry.appendChild(body)

        list.appendChild(entry)
    })

    return list
}

/* Block-level rather than a single paragraph: a note is sometimes one line and
   sometimes several paragraphs of advice. */
function renderNote(block) {
    const note = element("aside", "join-note join-note--" + (block.tone || "tip"))
    if (block.title) note.appendChild(element("p", "join-note__title", block.title))
    note.appendChild(appendRichBlocks(element("div", "join-note__text"), block.text))
    return note
}

/* A note is its own callout — a block heading above it would double the title —
   so it is not in this table and is handled on its own below. */
const BLOCK_RENDERERS = {
    routes: renderRoutes,
    steps: renderSteps,
    faq: renderFaq,
}

function renderBlock(block) {
    if (block.type === "note") return renderNote(block)

    const render = BLOCK_RENDERERS[block.type]
    if (!render) return null

    const section = element("section", "join-block join-block--" + block.type)
    section.appendChild(renderBlockHeader(block))
    section.appendChild(render(block))
    return section
}

/* ── Stage panels ── */

function renderStage(stage, index) {
    const panel = element("section", "join-stage")
    panel.id = STAGE_PANEL_PREFIX + stage.id
    panel.setAttribute("role", "tabpanel")
    panel.setAttribute("aria-labelledby", "join-step-btn-" + stage.id)
    panel.hidden = index !== 0

    const header = element("header", "join-stage__head")
    header.appendChild(element("p", "join-stage__eyebrow", stage.label))
    header.appendChild(element("h4", "join-stage__heading", stage.heading))
    header.appendChild(appendRichBlocks(element("div", "join-stage__lede"), stage.lede))

    panel.appendChild(header)
    stage.blocks.forEach((block) => {
        const node = renderBlock(block)
        if (node) panel.appendChild(node)
    })

    return panel
}

function renderOutro(outro) {
    const box = element("aside", "join-outro")
    box.appendChild(element("p", "join-outro__kicker", outro.kicker))
    box.appendChild(element("h4", "join-outro__title", outro.title))
    box.appendChild(paragraph("join-outro__text", outro.text))

    const actions = element("div", "join-outro__actions")
    outro.actions.forEach((action) => {
        const link = createLink(action.label, action.href)
        link.className = "contact-cta" + (action.primary ? " contact-cta--primary" : "")
        actions.appendChild(link)
    })
    box.appendChild(actions)

    return box
}

/* ── Per-level accent ──
 * Written as three RGB triplets so the stylesheet can vary their alpha. Set on
 * the tab root (retints everything) and on each rail button (so a node keeps
 * its own level's colour even when another level is showing).
 */
function applyAccent(node, accent) {
    if (!accent) return
    node.style.setProperty("--join-accent", accent.accent)
    node.style.setProperty("--join-deep", accent.deep)
    node.style.setProperty("--join-ink", accent.ink)
}

/* ── Section backdrop ──
 * The banner behind the Information section is shared with the Contact and
 * Services tabs, so the Join tab borrows it rather than owning it: it writes
 * the level's photograph in as a custom property and hands the default back
 * when another tab takes over.
 *
 * The crossfade parks the outgoing photograph on a second, stacked layer at
 * full opacity with its transition suppressed, then releases it a frame later.
 * Both layers read --contact-parallax off their shared parent, so they move
 * together and the fade never shears.
 */
const BACKDROP_FADE_MS = 450

function createBackdropController() {
    const section = document.querySelector(".contact-full")
    const backdrop = section && section.querySelector(".contact-full__backdrop")
    const primary = backdrop && backdrop.querySelector(".contact-full__backdrop-img:not(.contact-full__backdrop-img--out)")
    if (!backdrop || !primary) return { show() {}, reset() {}, preload() {} }

    // Read rather than hardcode, so the stylesheet stays the one place the
    // section's own photograph is named.
    const defaultImage = getComputedStyle(primary).backgroundImage
    const defaultLabel = backdrop.getAttribute("aria-label") || ""
    const preloaded = new Map()

    let current = defaultImage
    let timer = null

    function preload(src) {
        if (!src || preloaded.has(src)) return
        const image = new Image()
        preloaded.set(src, image)
        image.src = src
    }

    function paint(value, label) {
        if (value === current) return

        const outgoing = current
        current = value

        if (timer) {
            clearTimeout(timer)
            timer = null
        }

        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        if (!still) {
            backdrop.style.setProperty("--contact-backdrop-image-out", outgoing)
            backdrop.classList.add("contact-full__backdrop--swapping")
        }

        backdrop.style.setProperty("--contact-backdrop-image", value)
        backdrop.setAttribute("aria-label", label || defaultLabel)

        if (still) return

        // Flush the suppressed state so the class removal below is a change the
        // browser can transition from, rather than a no-op it coalesces away.
        void backdrop.offsetWidth
        backdrop.classList.remove("contact-full__backdrop--swapping")

        timer = setTimeout(() => {
            backdrop.style.removeProperty("--contact-backdrop-image-out")
            timer = null
        }, BACKDROP_FADE_MS)
    }

    return {
        preload,
        show(src, label) {
            if (!src) return
            paint('url("' + src + '")', label)
        },
        reset() {
            paint(defaultImage, defaultLabel)
        },
    }
}

/* ── Wiring ── */

;(function () {
    const root = document.getElementById(ROOT_ID)
    if (!root) return

    const stages = JOIN_CONTENT.stages
    if (!Array.isArray(stages) || !stages.length) return

    const layout = element("div", "join")

    // Prompt and rail share one frosted surface — the rail is the answer to the
    // question above it, and splitting them onto two cards read as two
    // unrelated objects.
    const consoleCard = element("div", "join-console")
    consoleCard.appendChild(element("h3", "join-console__prompt", JOIN_CONTENT.prompt))

    // The rail. --join-count and --join-active drive the connecting line's
    // geometry and fill entirely in CSS, so the only thing JS writes per click
    // is an index.
    const ladder = element("div", "join-ladder")
    ladder.setAttribute("role", "tablist")
    ladder.setAttribute("aria-label", "Career stages")
    ladder.style.setProperty("--join-count", String(stages.length))
    ladder.style.setProperty("--join-active", "0")

    const panelHost = element("div", "join-stages")
    const panels = stages.map((stage, index) => {
        const panel = renderStage(stage, index)
        panelHost.appendChild(panel)
        return panel
    })

    const buttons = stages.map((stage, index) => {
        const button = element("button", "join-step")
        button.type = "button"
        button.id = "join-step-btn-" + stage.id
        button.dataset.stage = stage.id
        button.setAttribute("role", "tab")
        button.setAttribute("aria-selected", index === 0 ? "true" : "false")
        button.setAttribute("aria-controls", STAGE_PANEL_PREFIX + stage.id)

        // The button is the tile and the level's name is what it says — the
        // step number is implicit in the rail's left-to-right order, so it is
        // not printed.
        button.appendChild(element("span", "join-step__label", stage.label))
        applyAccent(button, stage.accent)

        button.addEventListener("click", () => select(index))
        ladder.appendChild(button)
        return button
    })

    const backdrop = createBackdropController()
    let activeIndex = 0

    function select(index) {
        const stage = stages[index]
        if (!stage) return

        activeIndex = index

        buttons.forEach((button, position) => {
            const isActive = position === index
            button.classList.toggle("join-step--active", isActive)
            button.classList.toggle("join-step--done", position < index)
            button.setAttribute("aria-selected", isActive ? "true" : "false")
        })

        layout.dataset.stage = stage.id
        applyAccent(layout, stage.accent)
        ladder.style.setProperty("--join-active", String(index))
        syncBackdrop()
        swapTabPanels(panels, STAGE_PANEL_PREFIX + stage.id)
    }

    /* The banner belongs to the section, not to this tab, so a level photograph
       goes up only while Join is showing and the section's own is handed back
       on the way out. The margin arrows forward their clicks to the same tab
       buttons, which is why listening on those covers them too — and script.js
       registers its handler first, so aria-selected is already current here. */
    function syncBackdrop() {
        const joinTab = document.getElementById("contact-tab-btn-join")
        if (joinTab && joinTab.getAttribute("aria-selected") === "true") {
            const stage = stages[activeIndex]
            backdrop.show(stage.image, stage.imageAlt)
        } else {
            backdrop.reset()
        }
    }

    /* The tab buttons, plus anything that opens a tab from elsewhere on the
       page — the nav's Join link and the hero's Join button both carry
       data-contact-tab-target, and arriving that way has to raise the level's
       photograph just as clicking the tab does. */
    document.querySelectorAll(".contact-tab-btn, [data-contact-tab-target]").forEach((tab) => {
        tab.addEventListener("click", syncBackdrop)
    })

    // Arrow keys across the rail, per the tablist pattern.
    ladder.addEventListener("keydown", (event) => {
        const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0
        if (!delta) return
        event.preventDefault()
        const current = buttons.findIndex((button) => button.getAttribute("aria-selected") === "true")
        const next = (Math.max(0, current) + delta + buttons.length) % buttons.length
        select(next)
        buttons[next].focus()
    })

    consoleCard.appendChild(ladder)
    layout.appendChild(consoleCard)
    layout.appendChild(panelHost)
    if (JOIN_CONTENT.outro) layout.appendChild(renderOutro(JOIN_CONTENT.outro))

    root.appendChild(layout)
    select(0)

    /* Deep links. `#join-phd` both opens the Join tab — by clicking its button,
       so script.js's own handler does the work — and selects the stage. The
       Information tab controller runs first (script.js is earlier in the
       document) and will have fallen back to Contact, which this then
       overrides. */
    function selectFromHash() {
        const match = /^#join-([\w-]+)$/.exec(window.location.hash)
        if (!match) return
        const index = stages.findIndex((stage) => stage.id === match[1])
        if (index === -1) return

        const joinTab = document.getElementById("contact-tab-btn-join")
        if (joinTab && joinTab.getAttribute("aria-selected") !== "true") joinTab.click()
        select(index)
    }

    window.addEventListener("hashchange", selectFromHash)
    selectFromHash()

    // Warm the other levels' photographs once the page is idle: the crossfade
    // has nothing to dissolve into if the incoming image is still downloading.
    const warm = () => stages.forEach((stage) => backdrop.preload(stage.image))
    if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(warm, { timeout: 4000 })
    } else {
        setTimeout(warm, 2000)
    }

    document.querySelectorAll("[data-join-stage]").forEach((link) => {
        link.addEventListener("click", () => {
            const index = stages.findIndex((stage) => stage.id === link.getAttribute("data-join-stage"))
            if (index !== -1) select(index)
        })
    })
})()
