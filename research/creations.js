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
 * One mark, on the Inventions side: a star. It was a set of nine hand-drawn
 * glyphs, one per item, which is a lot of drawing for a bullet nobody reads as
 * meaning anything. The star says "this is one of ours" and gets out of the
 * way. The tools carried one too and dropped it when the picture became the
 * top of the card — a glyph next to a logo is a second mark for the same
 * thing, and the worse of the two. The one picture that earns its space is a
 * tool's own logo, which is a thing a reader may already recognise.
 *
 * Two rows, laid out differently on purpose (see creations-content.js).
 * Inventions are ideas: one line each — the star, the name, the idea, and where
 * to read it, all on the same baseline — because an idea is a sentence and a
 * column of nine cards of prose is a wall. Tools are things: cards in a masonry,
 * each one a picture of the thing with its name under it, because a tool is
 * recognised before it is read. Which renderer a group gets is its own `kind`,
 * so the split lives in the content.
 *
 * The cards were hexagons in a honeycomb (shared/honeycomb.js) until the logos
 * outgrew them: a hexagon is one size for every card and crops every logo to
 * the same six sides, which turns a wordmark, a square mark and a screenshot
 * into the same shape. A card takes its height from its own picture, so the row
 * reads as a shelf of different things — which is what it is. Nothing places
 * them any more either; CSS columns do it, so the module lost the measure /
 * re-place machinery the comb needed.
 */

import { element as el } from "../shared/dom.js"

const STAR = "★"

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

/* ── Tools: a masonry of cards ──
 * The whole card is the link. A picture, a name, what sort of thing it is and
 * one line is the entire content, so a link chip at the foot of the card would
 * be a second target for the same destination — and the smaller of the two.
 *
 * **The picture is the card's top and sets its height.** The logo is laid out
 * at its own aspect ratio rather than cropped to a fixed box, which is what
 * makes the cards different heights and the row a masonry: a wordmark is a
 * band, a square mark is a square, a screenshot is tall. Every item carries a
 * `logo` — there is no fallback, so a tool without one is a content gap to fix
 * rather than a case to render.
 *
 * **At rest a card shows the picture and the name.** The kind and the
 * description are behind the pointer: `.rc-card__detail` hangs above the name
 * bar and grows upward over the picture, so the card's own height never
 * changes and no card in the masonry moves when another is hovered. That is
 * the whole reason the reveal goes up rather than down — see the stylesheet.
 *
 * `alt` is empty on the logo: the name is in the DOM next to it and reading the
 * picture out as well would say the same thing twice.
 *
 * The pictures stay **lazy**, and there is a cost to that worth knowing about.
 * This panel is `display: none` until its tab is opened, so a lazy image is not
 * fetched at all until then — and since a card's height *is* its picture's
 * height, the columns balance once on the placeholders and again as the files
 * land. `.rc-card__media`'s `min-height` is what keeps that a settle rather
 * than a jump: a card starts at ~180px, not at nothing. Eager would remove it
 * outright, and should be reconsidered the moment these logos are cut to the
 * site's size budget — as of writing they are ten times over it, which is far
 * too much to put on every visit for a tab most readers never open.
 */
function buildCards(group) {
    const list = el("ul", "rc-cards")

    group.items.forEach((item) => {
        const slot = el("li", "rc-cards__item")
        const card = item.href ? outboundLink("rc-card") : el("div", "rc-card")
        if (item.href) card.href = item.href

        const media = el("span", "rc-card__media")
        const logo = el("img", "rc-card__logo")
        logo.src = item.logo
        logo.alt = ""
        logo.loading = "lazy"
        logo.decoding = "async"
        media.appendChild(logo)
        card.appendChild(media)

        /* The name is a child of the body and the other two share one, because
           they are what the hover reveals and the box that carries them is what
           collapses. The name comes first in the DOM so the link reads as
           name → kind → description; the reveal is positioned, not ordered. */
        const body = el("span", "rc-card__body")
        body.appendChild(el("span", "rc-card__name", item.name))
        const detail = el("span", "rc-card__detail")
        const detailInner = el("span", "rc-card__detail-inner")
        if (item.type) detailInner.appendChild(el("span", "rc-card__type", item.type))
        if (item.line) detailInner.appendChild(el("span", "rc-card__line", item.line))
        detail.appendChild(detailInner)
        body.appendChild(detail)
        card.appendChild(body)

        slot.appendChild(card)
        list.appendChild(slot)
    })

    return { node: list }
}

const GROUP_BUILDERS = {
    list: buildList,
    cards: buildCards,
}

/* ── The plate ──
 * A painting behind each row, darkened to a texture. It is an <img> rather than
 * a stylesheet background for two reasons: the paths in the content module are
 * from the site root, where a `url()` in css/ resolves against the stylesheet's
 * own folder (this has broken the door logos and the Information backdrop
 * before); and an <img> can be lazy, which a background cannot.
 */
function buildPlate(group, body) {
    /* A row with a painting behind it is a dark plate; a row without one is a
       light plate, and the class is what says which. Tools is the light one:
       eleven pictures of their own on white cards, where a painting behind them
       would be a twelfth picture competing with the eleven. */
    const tone = group.image ? "rc-plate--art" : "rc-plate--light"
    const plate = el("section", "rc-plate rc-plate--" + group.id + " " + tone)
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
