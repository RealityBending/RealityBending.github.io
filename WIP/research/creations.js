/* creations.js
 * The Research section's second tab.
 *
 * The section's first tab is a ~800vh scroll-driven dive (reality-zoom.js);
 * this one is the opposite by design — everything on one screenful, nothing to
 * scrub, nothing that has to be waited for. What the two do share is the dark:
 * each row here is a plate with a painting behind it, so leaving the eye does
 * not drop the reader onto a page of white cards.
 *
 * There is no header: no eyebrow, no heading, no lede. The tab bar has already
 * said which tab this is and each plate says what it holds, so anything above
 * the first plate would be a third label for the same thing.
 *
 * One mark, used twice: a star. It was a set of nine hand-drawn glyphs, one per
 * item, which is a lot of drawing for a bullet nobody reads as meaning
 * anything. The star says "this is one of ours" and gets out of the way. The
 * one place a real picture earns its space is a tool's own logo, which is a
 * thing a reader may already recognise — hence `logo` on the hexagons, falling
 * back to the same star.
 *
 * Two rows, laid out differently on purpose (see creations-content.js).
 * Inventions are ideas: one line each — the star, the name, the idea, and where
 * to read it, all on the same baseline — because an idea is a sentence and a
 * column of nine cards of prose is a wall. Tools are things: a honeycomb of
 * small hexagons, because each one is a destination and the comb makes a set of
 * destinations read as a set. Which renderer a group gets is its own `kind`, so
 * the split lives in the content.
 *
 * The comb is shared/honeycomb.js, the same placement the Information section's
 * Services tab uses at roughly twice the size. It is the one thing here that
 * has to be re-run: a hexagon's height is computed from the measured width of
 * the grid, and this panel is `display: none` until its tab is opened.
 */

import { createHoneycomb } from "../shared/honeycomb.js"
import { element as el } from "../shared/dom.js"

const STAR = "★"

/* Small hexagons, which is the whole difference from the Services comb (300 /
   three across). Four across at the comb's own capped width comes out at about
   210px, and the minimum is what drops that to three and then to two as the
   plate narrows. A run that runs out of cells before it runs out of columns is
   centred (`centreRuns`), so five tools are four and one under the middle
   rather than four and one hanging off the left. */
const MIN_HEX_WIDTH = 170
const MAX_COLUMNS = 4

/* What fills a hexagon that has no logo of its own. They are the site's own
   section tokens (css/01-base.css :root) minus the teal, which is the Tools
   row's own accent and would make a filled hexagon look like the plate rather
   than like a thing on it — nothing new enters the palette.
 *
 * Handed out in order to the hexagons that need one rather than by item index,
 * so two logo-less tools next to each other never take the same colour and the
 * set stays spread however many logos the row happens to carry. */
const FILL_COLOURS = ["#aa55ff", "#5599ff", "#55cc77", "#ff9933", "#ff5555"]


function star(className) {
    const mark = el("span", className, STAR)
    mark.setAttribute("aria-hidden", "true")
    return mark
}

/* Every href here leaves the site; the content module has no in-page targets. */
function outboundLink(className) {
    const anchor = el("a", className)
    anchor.target = "_blank"
    anchor.rel = "noreferrer noopener"
    return anchor
}

/* ── Inventions: a list of single lines ──
 * Star, name, idea, and the reference — one row, one baseline, a hairline
 * between rows. The name and the idea are one paragraph rather than two columns
 * because the names are of very different lengths and a name column wide enough
 * for the longest leaves a trench in front of every other entry; the reference
 * is a column of its own, so the way out of each line is always in the same
 * place.
 *
 * **The whole row is the anchor**, not the reference at the end of it. There is
 * one destination per entry, and a line of text with a small target at the far
 * right of it makes the reader aim at the one part of the row that is hardest
 * to hit. So the `<a>` is the row and the reference is a `<span>` inside it —
 * it still looks like the link because it is the part that says where the row
 * goes, but there is no second target and nothing nested. `<a>` may hold a
 * `<p>`: its content model is transparent, and nothing inside is interactive.
 *
 * Everything after the name is optional, so an idea with no paper out yet still
 * has a place to sit — it is a plain <div> row rather than a dead anchor.
 */
function buildList(group) {
    const list = el("ul", "rc-list")

    group.items.forEach((item) => {
        const entry = el("li", "rc-item")
        const row = item.href ? outboundLink("rc-item__row") : el("div", "rc-item__row")
        if (item.href) row.href = item.href

        row.appendChild(star("rc-item__star"))

        const body = el("p", "rc-item__body")
        body.appendChild(el("span", "rc-item__name", item.name))
        if (item.line) {
            // A real space either side of the dash, in the text rather than in
            // a margin: this is one sentence and it has to wrap as one.
            body.appendChild(el("span", "rc-item__dash", " — "))
            body.appendChild(el("span", "rc-item__line", item.line))
        }
        row.appendChild(body)

        if (item.href) row.appendChild(el("span", "rc-item__link", item.linkLabel || "Read it"))

        entry.appendChild(row)
        list.appendChild(entry)
    })

    return { node: list }
}

/* ── Tools: a comb of small hexagons ──
 * The whole hexagon is the link. A name, what sort of thing it is, one line,
 * and the way to it is the entire content — so a separate link chip inside the
 * face would be a second target for the same destination.
 *
 * The three-element nesting is the same as the Services comb's and for the same
 * reasons: the cell carries the placement, the shadow and the focus ring
 * because `clip-path` on the hexagon would cut all three off with everything
 * else outside the six sides, and the clip is on the *face* rather than on the
 * anchor so the anchor keeps a rectangular box to be scaled and shadowed in.
 *
 * The top of the face is the fill: the tool's own logo where it has one, and a
 * flat colour where it does not, so no hexagon is an empty shape with a mark in
 * it. A logo is `contain`ed on a white ground rather than cropped to the band —
 * a wordmark and a square mark are both logos, and cropping either to the
 * other's shape ruins one of them. `alt` is empty because the name is directly
 * underneath it.
 */
function buildComb(group) {
    const grid = el("div", "rc-comb")
    const cells = []
    let filled = 0

    group.items.forEach((item) => {
        const cell = el("div", "rc-cell")
        const hex = item.href ? outboundLink("rc-hex") : el("div", "rc-hex")
        if (item.href) hex.href = item.href

        const face = el("span", "rc-hex__face")

        const media = el("span", "rc-hex__media" + (item.logo ? " rc-hex__media--logo" : ""))
        if (item.logo) {
            const logo = el("img", "rc-hex__logo")
            logo.src = item.logo
            logo.alt = ""
            logo.loading = "lazy"
            media.appendChild(logo)
        } else {
            media.style.setProperty("--rc-fill", FILL_COLOURS[filled % FILL_COLOURS.length])
            filled += 1
            media.appendChild(star("rc-hex__star"))
        }
        face.appendChild(media)

        const body = el("span", "rc-hex__body")
        body.appendChild(el("span", "rc-hex__name", item.name))
        if (item.type) body.appendChild(el("span", "rc-hex__type", item.type))
        if (item.line) body.appendChild(el("span", "rc-hex__line", item.line))
        face.appendChild(body)

        hex.appendChild(face)
        cell.appendChild(hex)
        grid.appendChild(cell)
        cells.push(cell)
    })

    const comb = createHoneycomb(grid, {
        cells: () => cells,
        minWidth: MIN_HEX_WIDTH,
        maxColumns: MAX_COLUMNS,
        columnsVar: "--rc-columns",
        pullVar: "--rc-row-pull",
        centreRuns: true,
    })

    /* Placement is measured off the grid, and this panel is `display: none`
       until its tab is opened — where every rect is zero and the row pull comes
       out as nonsense. So the trigger is the width *changing*, not the column
       count changing: a hidden panel being shown goes 0 → N without necessarily
       crossing a column boundary, and would keep the layout it was given while
       it had no size. Re-placing alters the grid's height, which the observer
       also sees, so comparing the width is what stops it chasing its own tail.

       `needsReplace()` is still asked first because it is the cheaper answer to
       the same question and covers the case the width comparison cannot: a
       replacement that leaves the width alone. */
    let lastWidth = null

    function place() {
        lastWidth = grid.clientWidth
        comb.place()
    }

    function replaceIfNeeded() {
        if (grid.clientWidth !== lastWidth || comb.needsReplace()) place()
    }

    place()
    window.addEventListener("resize", replaceIfNeeded)
    if (typeof ResizeObserver === "function") new ResizeObserver(replaceIfNeeded).observe(grid)

    return { node: grid }
}

const GROUP_BUILDERS = {
    list: buildList,
    comb: buildComb,
}

/* ── The plate ──
 * A painting behind each row, darkened to a texture. It is an <img> rather than
 * a stylesheet background for two reasons: the paths in the content module are
 * from the site root, where a `url()` in css/ resolves against the stylesheet's
 * own folder (this has broken the door logos and the Information backdrop
 * before); and an <img> can be lazy, which a background cannot.
 */
function buildPlate(group, body) {
    const plate = el("section", "rc-plate rc-plate--" + group.id)
    // One property per row; every tint in the stylesheet is mixed off it, so a
    // row's colour is one hex in the content module.
    if (group.accent) plate.style.setProperty("--rc-accent", group.accent)

    if (group.image) {
        const art = el("img", "rc-plate__art")
        art.src = group.image
        art.alt = ""
        art.loading = "lazy"
        art.setAttribute("aria-hidden", "true")
        plate.appendChild(art)
    }

    const inner = el("div", "rc-plate__body")

    const head = el("header", "rc-plate__head")
    if (group.label) head.appendChild(el("h4", "rc-plate__label", group.label))
    if (group.lede) head.appendChild(el("p", "rc-plate__lede", group.lede))
    inner.appendChild(head)

    inner.appendChild(body)

    plate.appendChild(inner)
    return plate
}

export function buildCreations(tab) {
    const root = el("div", "rc")

    const groups = Array.isArray(tab.groups) ? tab.groups : []

    groups.forEach((group) => {
        const build = GROUP_BUILDERS[group.kind]
        const items = Array.isArray(group.items) ? group.items.filter((item) => item && item.name) : []
        if (!build || !items.length) return

        const built = build(Object.assign({}, group, { items }))
        root.appendChild(buildPlate(group, built.node))
    })

    return root
}
