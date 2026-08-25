/* reality-zoom.js
 * The Research section's Overview tab: one continuous zoom, driven by scroll.
 *
 * The screen is held by a sticky stage while a tall track scrolls past it. The
 * track's progress through that window is a single 0 → 1 number, and every
 * moving part reads from it:
 *
 *   0 ────── zoomEnd ── L0 ── L1 ── L2 ── L3 ── scenesEnd ────── 1
 *   │ eye fills the      │ landmarks, one per slot: │ the dive run
 *   │ screen, scales up  │ each rises out of the    │ backwards — black
 *   │ around the pupil   │ dark, holds, then passes │ recedes, the eye
 *   │ until black        │ the viewer.              │ pulls back to frame
 *   │                    │                          │ one.
 *
 * The last stretch is a mirror of the first, and that is the point: the section
 * ends on exactly the picture it started on, so the gate can be shut behind the
 * reader without anything appearing to move.
 *
 * Two things are worth knowing before changing anything here:
 *
 * - The pupil is a *painted* circle in a JPEG, so nothing in CSS knows where it
 *   is. syncGeometry() lays the image out by hand (a cover fit computed in JS
 *   rather than object-fit) precisely so the pupil's centre and radius are
 *   known in pixels — that centre is the transform-origin the whole zoom turns
 *   around, and that radius sets how far it has to scale before black covers
 *   the corners. Change PUPIL_* only against the actual file.
 *
 * - The scroll container is #main-page, not the window (see CLAUDE.md). Sticky
 *   resolves against it, and the scroll listener has to be on it.
 */

import { element as el } from "../shared/dom.js"
import { hrefForRoute } from "../shared/deep-link.js"

/* Measured off img/magritte_falsemirror.jpg (2000×1345) by scanning the middle
   of the canvas for the pupil's dark run: it spans x 831→1096, y 537→804. Eyed
   values were 7px out at natural size, which showed as a ring at scale 1. */
const PUPIL_X = 0.4818 /* fraction of the image's width  */
const PUPIL_Y = 0.4985 /* fraction of the image's height */
const PUPIL_R = 0.0668 /* radius, as a fraction of the width */

/* Scroll budget, in viewport heights. The track is the stage plus these, so
   the timeline's fractions are derived rather than written down twice. Shorter
   out than in: there is nothing new to read on the way back, and a pull-back
   that takes as long as the dive did reads as the section refusing to end. */
const ZOOM_VH = 1.6
const SCENE_VH = 1.05
const OUTRO_VH = 1.2

/* Where inside its own slot a landmark rises, holds, and leaves. */
const ENTER_END = 0.24
const EXIT_START = 0.74

/* ── The opening landmark's paragraphs, against its own `local` progress ──
 * Tied to scroll position rather than to a timer: an earlier version staggered
 * these on a CSS transition-delay, which is wall-clock and therefore has no
 * relationship to how fast the reader is actually moving through the
 * landmark's own slot. A fast flick could cross the whole slot before the
 * delay had finished counting, landing the reader on the next station having
 * seen the film alone — the paragraphs technically ran, just off-screen.
 * `local` is the one number every other reveal in this module already keys
 * on, so a paragraph's opacity is a fraction of it in exactly the same way a
 * landmark's own `enter`/`exit` are: nothing to skip, because there is no
 * clock to outrun, and it stays scrubbable in both directions.
 * `FILM_TEXT_START` holds every paragraph back until the film itself has had
 * a beat alone (the "video plays first" ask); each paragraph then fades in
 * across `FILM_TEXT_STEP` of local progress, back to back, finishing well
 * inside the landmark's own held span (EXIT_START = 0.74).
 *
 * **The step has to be re-derived when a paragraph is added or removed, and a
 * pause counts as one of them**: the last paragraph ends at
 * START + (slots + 1)·STEP, and that has to clear EXIT_START or the final line
 * is still arriving while the landmark is already leaving. This landmark
 * carries four paragraphs and one pause, so the last one sits in slot 4 and
 * ends at START + 5·STEP — which is why the step came down from 0.13 to 0.115
 * when the pause went in. It ends at 0.675, inside 0.74 with room to spare, and
 * the pause reads as a full step of dead air after "…continue to fade…". */
const FILM_TEXT_START = 0.1
const FILM_TEXT_STEP = 0.115

/* The rail's own presence, which is deliberately *not* the veil's. It used to
   ride `--rz-veil`, and the veil only starts closing at 72% of the dive — so
   the stations announced themselves at the last possible moment and were gone
   again before the eye had finished coming back. It reads better as the thing
   that is already there when the dark arrives and is still there once the
   picture returns, so it is given its own ramp: fractions of the dive on the
   way in, fractions of the outro on the way out. */
const RAIL_IN_START = 0.26
const RAIL_IN_END = 0.58
const RAIL_OUT_START = 0.24
const RAIL_OUT_END = 0.7

/* The outro, as fractions of its own span, mirroring the dive: the veil lifts
   over the first stretch — the same 28% the dive spends closing it — and the
   eye pulls back across the rest, settling a hair before the track runs out so
   the last frame is held rather than arrived at. */
const OUTRO_VEIL_END = 0.28
const OUTRO_SETTLE = 0.98

const clamp01 = (value) => Math.min(1, Math.max(0, value))
const lerp = (from, to, t) => from + (to - from) * t

/* Progress across a sub-range of the timeline, clamped at both ends. */
function span(value, start, end) {
    return end > start ? clamp01((value - start) / (end - start)) : value >= end ? 1 : 0
}

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
const easeOut = (t) => 1 - Math.pow(1 - t, 3)


function svg(tag, attrs) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag)
    Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value))
    return node
}

/* For drawings that are fixed rather than computed. The HTML parser handles
   foreign content, so an <svg> written as markup here comes out as real SVG
   nodes — and forty svg() calls to lay out a diagram that never changes is
   harder to read, and harder to nudge, than the diagram itself. Use svg()
   wherever the geometry actually depends on something. */
function svgMarkup(markup) {
    const holder = document.createElement("div")
    holder.innerHTML = markup
    return holder.firstElementChild
}

/* ── Figures ──
 * Each builder returns an element for the right-hand side of a landmark. They
 * are interactive, and the stage turns pointer-events on only for the landmark
 * currently holding — so a widget can never be clicked through the dark while
 * it is still on its way in.
 */

/* ── The cloud ──
 * Reality at the centre, the six dimensions the lab actually measures large
 * around it, and the rest of its vocabulary smaller still further out. It was a
 * network first — hub, six discs on an ellipse, spokes and a ring — and the
 * cloud says the same thing with more of it: the six were the whole of what the
 * landmark could show, and the lab's own research page lists five times as many
 * words than that.
 *
 * ── Nothing is positioned by hand ──
 * Every word is placed by walking an outward elliptical spiral from the centre
 * and stopping at the first point where its box clears everything already
 * placed. That is the only way this stays maintainable: a cloud whose
 * coordinates are typed in has to be re-typed the moment a word is added, made
 * longer, or resized, and there is no way to tell by reading it whether two
 * words overlap. Here, adding a word costs a line of data.
 *
 * Consequently **a word that cannot be fitted is dropped, not overlapped** —
 * the failure mode is a slightly emptier cloud rather than an illegible one.
 * If a word is missing from the picture, the list below is too long for the
 * viewBox, not broken.
 *
 * ── The spiral is elliptical, and matches the box ──
 * `SPREAD_X` / `SPREAD_Y` are the viewBox's own aspect. A circular spiral in a
 * 460×360 box runs out of room at the top and bottom while the sides are still
 * empty, and every word after that point is dropped.
 *
 * The tones group the words rather than decorating them — red is the body, blue
 * is control and perception, purple is the self — which is the same three
 * colours the rest of the zoom already uses for the same three ideas. A word
 * with no tone is one of the lab's methods rather than one of its subjects, and
 * takes the neutral.
 */
/* ── Why the box is this size, and the list this long ──
 * The viewBox is drawn at whatever width the figure column gives it, so its
 * units are a scale factor and nothing else: 420 units drawn 416px wide is
 * ~1:1, and drawn 343px wide — the stacked fallback on a 375px phone — is 0.82.
 * The smallest word here is 11 units, so it is read at 10.9px and 9.0px
 * respectively, and 9px is the floor the network this replaced already sat at.
 *
 * That is the whole constraint, and it is a budget — but **the budget is the
 * word sizes, not the number of words**, and that distinction cost a round
 * trip. An early pass fitted eighteen keywords by shrinking them until the
 * smallest read at 7.1px on a phone, which is where "thirteen is what fits"
 * came from. It was never the box: at these sizes the packer places all
 * eighteen inside this same 420 × 335 with nothing dropped, because the box was
 * only 77% filled vertically. Growing it to 400 was tried and is worse — the
 * spiral then has slack, and the ink drifts 23 units off centre instead of 4.
 *
 * So the rule for a nineteenth is: add it at 11 units or more and check the
 * packing (a dropped word is silent — see below), rather than reaching for
 * either smaller type or a bigger box.
 */
const CLOUD_W = 420
const CLOUD_H = 335
const CLOUD_CX = CLOUD_W / 2
const CLOUD_CY = CLOUD_H / 2
/* The clear circle around "Reality" — measured off the word itself below, this
   is only the floor under it so the first ring never crowds the centre. */
const CLOUD_HUB_R = 52
const SPREAD_X = 1.28
const SPREAD_Y = 0.82

/* The words themselves are content and live in research-content.js — see the
   note over `figure` there for what each field is and why. This file is the
   packer and the wiring; it knows a word has a `text`, a `size`, maybe a `tone`
   and maybe a `paper`, and nothing else about them. */

/* ── The paper behind a word ──
 * A word carrying a `paper` becomes a link, and the strip under the cloud shows
 * which one. Three things about the shape:
 *
 * ── It reveals, then it opens ──
 * The first press on a word that is not already showing only shows it; the next
 * one follows the link. That is one rule covering two devices rather than two
 * rules: a mouse has already hovered by the time it clicks, so a click opens on
 * the first go, while a finger — which cannot hover — gets a tap to look and a
 * tap to go. Without it, tapping a 9px word on a phone throws the reader
 * straight out of the dive to a publisher's site they never saw the name of.
 *
 * ── The word is the link, not the strip's copy of it ──
 * It is a real SVG <a>, so middle-click, "copy link address" and Enter all work
 * without anything here implementing them, which is the same reason the strand
 * tiles and the open seat are anchors. The strip is an <a> too and points at
 * the same place — it is what a reader who has read the title reaches for —
 * but it only *has* an href while a paper is showing, so in its resting state
 * it is not a link and not a tab stop.
 *
 * ── It leaves the site, and says so ──
 * `↗` is this site's mark for that and has to keep meaning only that. Going to
 * the DOI rather than to this site's own /publications/<folder>/ page is not a
 * preference: those pages exist for crawlers, but no module claims a `pub-`
 * route, so a reader following one lands on a shell with nothing open. And it
 * opens in a new tab because the whole point of the ask was not to take the
 * reader out of a dive they are half way down.
 */
const CITE_LABEL = "Example ↗"

function paperHref(paper) {
    if (!paper) return ""
    if (paper.href) return paper.href
    return paper.doi ? "https://doi.org/" + paper.doi : ""
}

/* Word widths come from a canvas rather than from an estimate, because the
   packing is only as good as the boxes it is packing: guess a width 15% short
   and two words are laid over each other, guess it long and the cloud has holes
   in it. The font string has to match `.rz-cloud__word` in the stylesheet — the
   family, the weight and the size — and the letter-spacing is added back by
   hand, since canvas has no notion of it. */
const CLOUD_TRACKING = 0.05 /* the `letter-spacing`, in em */
let measureCtx
function measureWord(text, size) {
    if (measureCtx === undefined) measureCtx = document.createElement("canvas").getContext("2d") || null
    const tracking = text.length * size * CLOUD_TRACKING
    // No canvas is not a case that happens in a browser, but a wrong-by-10%
    // fallback is a better answer than a thrown error inside a figure builder.
    if (!measureCtx) return text.length * size * 0.56 + tracking
    measureCtx.font = '600 ' + size + 'px "Helvetica Neue", Helvetica, Arial, sans-serif'
    return measureCtx.measureText(text).width + tracking
}

function buildCloudFigure(config, scene) {
    const wrap = el("div", "rz-fig rz-fig--cloud")
    const dimensions = Array.isArray(config && config.dimensions) ? config.dimensions : []
    const keywords = Array.isArray(config && config.keywords) ? config.keywords : []
    const words = dimensions.concat(keywords)
    /* A group rather than role="img": the picture used to be one opaque label,
       and it cannot be that once some of the words inside it are links. The
       label is kept as the group's own name, so the summary is still announced
       before the words are walked. */
    const root = svg("svg", {
        viewBox: "0 0 " + CLOUD_W + " " + CLOUD_H,
        class: "rz-cloud",
        role: "group",
        "aria-label": "Reality at the centre of what the lab studies: " + words.map((word) => word.text).join(", "),
    })

    const defs = svg("defs", {})
    const glow = svg("radialGradient", { id: "rz-cloud-glow" })
    glow.appendChild(svg("stop", { offset: "0", "stop-color": "#8fb7ff", "stop-opacity": "0.4" }))
    glow.appendChild(svg("stop", { offset: "1", "stop-color": "#8fb7ff", "stop-opacity": "0" }))
    defs.appendChild(glow)
    root.appendChild(defs)

    root.appendChild(svg("circle", { class: "rz-cloud__glow", cx: CLOUD_CX, cy: CLOUD_CY, r: 164, fill: "url(#rz-cloud-glow)" }))

    /* Boxes are padded as they go in rather than as they are tested, so the gap
       between two words is the same whichever of them was placed first. */
    const PAD_X = 5
    const PAD_Y = 2.5
    const placed = []

    function boxAt(x, y, w, h) {
        return { x1: x - w / 2 - PAD_X, x2: x + w / 2 + PAD_X, y1: y - h / 2 - PAD_Y, y2: y + h / 2 + PAD_Y }
    }

    function fits(box) {
        if (box.x1 < 4 || box.x2 > CLOUD_W - 4 || box.y1 < 4 || box.y2 > CLOUD_H - 4) return false
        return !placed.some((other) => box.x1 < other.x2 && box.x2 > other.x1 && box.y1 < other.y2 && box.y2 > other.y1)
    }

    /* The spiral. `startAngle` is what keeps the six large words spread around
       the centre instead of stacked on one side: each starts its walk a sixth
       of a turn on from the last, and the first free point is therefore in its
       own sector. The step is deliberately finer than the radius grows, so a
       word tries most of a turn at one distance before moving outwards. */
    function place(w, h, startAngle) {
        for (let step = 0; step < 1400; step += 1) {
            const angle = startAngle + step * 0.26
            const radius = CLOUD_HUB_R + step * 0.42
            const x = CLOUD_CX + Math.cos(angle) * radius * SPREAD_X
            const y = CLOUD_CY + Math.sin(angle) * radius * SPREAD_Y
            const box = boxAt(x, y, w, h)
            if (fits(box)) return { x, y, box }
        }
        return null
    }

    // "Reality" first and at the centre, so everything else is placed around it.
    const hubSize = 34
    const hubWidth = measureWord("Reality", hubSize)
    placed.push({
        x1: CLOUD_CX - Math.max(hubWidth / 2 + PAD_X, CLOUD_HUB_R),
        x2: CLOUD_CX + Math.max(hubWidth / 2 + PAD_X, CLOUD_HUB_R),
        y1: CLOUD_CY - CLOUD_HUB_R * 0.62,
        y2: CLOUD_CY + CLOUD_HUB_R * 0.62,
    })
    const hub = svg("text", { class: "rz-cloud__word rz-cloud__word--hub", x: CLOUD_CX, y: CLOUD_CY + hubSize * 0.34, "text-anchor": "middle" })
    hub.style.setProperty("--rz-word-index", "0")
    hub.textContent = "Reality"
    root.appendChild(hub)

    /* ── The cloud writes into the landmark's own heading and paragraph ──
     * It used to carry its own strip underneath, showing the paper behind the
     * word. The payload is bigger now — a word can carry prose as well as a
     * paper — and putting it in the copy column means the reader watches the
     * *landmark* change under them rather than a caption filling in below a
     * picture. So this builder takes the scene, like the map it briefly
     * replaced, and every other builder still ignores that argument.
     *
     * ── Both swapped lines reserve their tallest state ──
     * The heading goes from "What we work on" to "Phenomenological Control" and
     * the paragraph from a 45-word statement to a paper title, and
     * `.rz-scene__copy` is `align-content: center` — so anything that changed
     * height would move the whole column under the pointer. Each therefore keeps
     * a hidden ghost of its longest candidate in the same grid cell, which is
     * the only form that works at *every* column width. For the heading that
     * candidate has to be computed: it is the longest word in the cloud, and a
     * new one longer than "Phenomenological Control" changes it. */
    const heading = scene ? scene.querySelector(".rz-scene__title") : null
    const target = scene ? scene.querySelector(".rz-scene__text") : null
    const restTitle = heading ? heading.textContent : ""
    const restText = target ? target.textContent : ""
    const longestLabel = words
        .map((word) => word.text || "")
        .concat(restTitle)
        .reduce((best, candidate) => (candidate.length > best.length ? candidate : best), "")

    function reserve(host, ghostText) {
        if (!host) return null
        host.textContent = ""
        host.classList.add("rz-swap")
        const ghost = el("span", "rz-swap__ghost", ghostText)
        ghost.setAttribute("aria-hidden", "true")
        const liveNode = el("span", "rz-swap__live")
        host.appendChild(ghost)
        host.appendChild(liveNode)
        return liveNode
    }
    const liveTitle = reserve(heading, longestLabel)
    const liveText = reserve(target, restText)

    /* The link, under the paragraph it belongs to. At rest it has no `href`, so
       it is neither followable nor a tab stop — but it is laid out all the same,
       on a fixed box rather than `min-height: 1lh`, because the arrows fall back
       to a font with taller metrics than the label's. */
    const link = el("a", "rz-swap__link")
    if (target && target.parentNode) target.parentNode.insertBefore(link, target.nextSibling)

    let showing = null
    function reveal(word) {
        showing = word
        if (liveTitle) liveTitle.textContent = word.text || ""
        /* Prose when the word has any, and the paper's title when it does not.
           Most of the vocabulary carries a publication rather than a paragraph —
           writing twenty-six blurbs to fill this line would be inventing lab copy
           — and the title of the work *is* the honest answer to "what does this
           word mean here". */
        if (liveText) liveText.textContent = word.about || (word.paper && word.paper.title) || ""
        link.removeAttribute("target")
        link.removeAttribute("rel")
        link.removeAttribute("data-research-tab")
        if (word.link) {
            /* A word whose answer is neither a paper nor this section's own
               shelf — Neuroaesthetics' comic. Same shape as a paper's link
               (off-site, new tab) but the label is written out rather than
               built from a citation, since there is no citation to build it
               from. Takes the slot over `paper` when both are given. */
            link.href = word.link.href
            link.target = "_blank"
            link.rel = "noreferrer noopener"
            link.textContent = word.link.label || CITE_LABEL
        } else if (word.paper) {
            link.href = paperHref(word.paper)
            link.target = "_blank"
            link.rel = "noreferrer noopener"
            /* The citation *is* the label where there is one: it says whose work
               it is and that it leaves the site, in one line, where "Example ↗"
               said only the second. `CITE_LABEL` is the fallback for a paper
               with no short form written out. */
            link.textContent = word.paper.cite ? word.paper.cite + " ↗" : CITE_LABEL
        } else if (word.tab) {
            link.href = hrefForRoute("research-" + word.tab)
            link.dataset.researchTab = word.tab
            link.textContent = "See our tools →"
        } else {
            link.removeAttribute("href")
            link.textContent = ""
            link.setAttribute("aria-hidden", "true")
            link.tabIndex = -1
            return
        }
        link.removeAttribute("aria-hidden")
        link.tabIndex = 0
    }
    function rest() {
        showing = null
        if (liveTitle) liveTitle.textContent = restTitle
        if (liveText) liveText.textContent = restText
        link.removeAttribute("href")
        link.removeAttribute("target")
        link.removeAttribute("rel")
        link.removeAttribute("data-research-tab")
        link.textContent = ""
        link.setAttribute("aria-hidden", "true")
        link.tabIndex = -1
    }
    // Leaving the whole figure rests it, rather than leaving a word: otherwise
    // the pointer could never travel from one word to the next without emptying
    // the paragraph on the way between them.
    wrap.addEventListener("pointerleave", rest)

    /* Dimensions before keywords, so the large words take the inside of the
       spiral and the small ones fill in around them — which is the picture: the
       nearer the centre, the more of the lab it is. */
    words.forEach((word, index) => {
        const isDimension = index < dimensions.length
        const width = measureWord(word.text, word.size)
        // Golden angle for the keywords: any fixed fraction of a turn puts them
        // in lanes, and lanes in a word cloud read as a table that went wrong.
        const startAngle = isDimension ? (index * Math.PI * 2) / dimensions.length - Math.PI / 2 : index * 2.3999
        const spot = place(width, word.size * 1.05, startAngle)
        if (!spot) return

        placed.push(spot.box)
        /* Where the word goes when it is followed rather than merely pointed at.
           A `link` or a paper leaves the site; a `tab` is another tab of this
           section and stays on it, so it takes a real path from the router and
           the delegated listener in research.js catches the click. A word with
           none of the three is still *pointable* — it has prose to show — it
           simply has nowhere to go. */
        const href = word.link ? word.link.href : word.paper ? paperHref(word.paper) : word.tab ? hrefForRoute("research-" + word.tab) : ""
        const speaks = !!(word.link || word.paper || word.about || word.tab)
        const node = svg("text", {
            class:
                "rz-cloud__word rz-cloud__word--" +
                (isDimension ? "dimension" : "keyword") +
                (word.tone ? " rz-cloud__word--" + word.tone : "") +
                (speaks ? " rz-cloud__word--linked" : ""),
            x: spot.x.toFixed(1),
            y: (spot.y + word.size * 0.34).toFixed(1),
            "text-anchor": "middle",
            "font-size": word.size,
        })
        node.style.setProperty("--rz-word-index", String(index + 1))
        node.textContent = word.text
        if (!speaks) {
            root.appendChild(node)
            return
        }

        /* An `<a>` when there is somewhere to go, so middle-click, "copy link
           address" and Enter all work with nothing here implementing them. When
           there is not, the word still has to be reachable by keyboard and
           pointer — hence a `<text>` given a button's role rather than a dead
           anchor, which is not focusable and would announce itself as a link to
           nowhere. */
        let hit
        if (href) {
            hit = svg("a", { href, class: "rz-cloud__anchor" })
            if (word.link || word.paper) {
                hit.setAttribute("target", "_blank")
                hit.setAttribute("rel", "noreferrer noopener")
            } else if (word.tab) {
                hit.setAttribute("data-research-tab", word.tab)
            }
        } else {
            hit = svg("g", { class: "rz-cloud__anchor", role: "button", tabindex: "0" })
            hit.setAttribute("aria-label", word.text)
        }
        hit.appendChild(node)
        /* Touch is excluded on purpose. A tap fires `pointerenter` before its
           `click`, so without this the finger would have "hovered" by the time
           the click arrives, the reveal-then-open rule below would think it was
           the second press, and the first tap on a 9px word would leave the
           site. Pen is left in — it hovers for real. */
        hit.addEventListener("pointerenter", (event) => {
            if (event.pointerType === "touch") return
            reveal(word)
        })
        hit.addEventListener("focus", () => reveal(word))
        // Reveal, then open — see the note over CITE_LABEL. A modifier- or
        // middle-click is somebody asking for a new tab explicitly and is never
        // swallowed, and neither is the second press.
        hit.addEventListener("click", (event) => {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
            if (showing === word) return
            event.preventDefault()
            reveal(word)
        })
        root.appendChild(hit)
    })

    wrap.appendChild(root)
    rest()
    return wrap
}

/* ── Ask ──
 * The strip under a figure: one line of text and one button, where pressing the
 * button turns the question into its answer and itself into the way back.
 * Illusions and AI-Beliefs both work this way and have to read as the same
 * control, so it is one builder rather than two copies that can drift apart.
 * `onChange` is where a figure does whatever revealing means for it.
 */
function buildAsk(config, onChange) {
    const node = el("div", "rz-fig__ask")
    const line = el("p", "rz-fig__prompt", config.question || "")
    const button = el("button", "rz-fig__button", config.button || "Show answer")
    button.type = "button"
    node.appendChild(line)
    node.appendChild(button)

    let revealed = false

    function set(on) {
        revealed = on
        line.textContent = on ? config.answer || "" : config.question || ""
        line.classList.toggle("rz-fig__prompt--answer", on)
        button.textContent = on ? config.reset || "Reset" : config.button || "Show answer"
        if (onChange) onChange(on)
    }

    button.addEventListener("click", () => set(!revealed))
    return { node, set }
}

/* Ponzo. The two bars are the same element size — the only difference between
   them is the converging rails, which the answer takes away. */
function buildPonzoFigure(config) {
    const wrap = el("div", "rz-fig rz-fig--ponzo")
    wrap.dataset.context = "on"

    const root = svg("svg", { viewBox: "0 0 320 260", class: "rz-ponzo", role: "img", "aria-label": "Ponzo illusion: two identical red bars over converging rails" })

    const rails = svg("g", { class: "rz-ponzo__rails" })
    rails.appendChild(svg("line", { x1: "150", y1: "18", x2: "38", y2: "246" }))
    rails.appendChild(svg("line", { x1: "170", y1: "18", x2: "282", y2: "246" }))
    for (let i = 1; i <= 4; i += 1) {
        const t = i / 5
        rails.appendChild(
            svg("line", {
                class: "rz-ponzo__tie",
                x1: String(lerp(150, 38, t)),
                y1: String(lerp(18, 246, t)),
                x2: String(lerp(170, 282, t)),
                y2: String(lerp(18, 246, t)),
            }),
        )
    }
    root.appendChild(rails)

    /* Same width, same height — stated once so it cannot drift. */
    const BAR_W = 108
    const BAR_H = 11
    ;[78, 196].forEach((y, index) => {
        const bar = svg("rect", { class: "rz-ponzo__bar", x: String(160 - BAR_W / 2), y: String(y), width: String(BAR_W), height: String(BAR_H), rx: "2" })
        bar.style.setProperty("--rz-bar-index", String(index))
        root.appendChild(bar)
    })

    // Plumb lines through both bars' ends, spanning where they land once they
    // have closed up — the ends line up, which is the whole demonstration.
    const guide = svg("g", { class: "rz-ponzo__guide" })
    guide.appendChild(svg("line", { x1: "106", y1: "112", x2: "106", y2: "178" }))
    guide.appendChild(svg("line", { x1: "214", y1: "112", x2: "214", y2: "178" }))
    root.appendChild(guide)

    wrap.appendChild(root)

    // Revealing the answer *is* taking the rails away: the bars slide together
    // and the plumb lines come up, so the reader is shown rather than told.
    wrap.appendChild(buildAsk(config, (on) => (wrap.dataset.context = on ? "off" : "on")).node)
    return wrap
}

/* Two paintings, both made by people. One of them is reliably taken for AI and
   the other for human, and the reveal is that their provenance never differed —
   only the impression did. The reader is asked to pick before being told, so
   the judgement is theirs before the answer arrives; picking is itself the
   reveal, since there is nothing to score. */
function buildArtworksFigure(config) {
    const wrap = el("div", "rz-fig rz-fig--artworks")
    wrap.dataset.revealed = "false"

    const grid = el("div", "rz-artworks")
    const cards = (config.works || []).map((work, index) => {
        const card = el("button", "rz-artworks__card")
        card.type = "button"
        card.dataset.picked = "false"
        // Staggers the reveal across the pair rather than flashing both at once.
        card.style.setProperty("--rz-card-index", String(index))

        /* Nothing but the frame is laid out in the card, and that is deliberate:
           a verdict line under each painting sat there at opacity 0 the whole
           time the question was still open, which is what put more space under
           the pair than over it. The badge is absolutely placed inside the
           frame, so the answer costs no height either. */
        const frame = el("span", "rz-artworks__frame")
        const image = el("img", "rz-artworks__img")
        image.src = work.src
        image.alt = work.alt || ""
        image.decoding = "async"
        /* Not `loading="lazy"`. These live inside a sticky stage that is on
           screen for the whole dive, so lazy loading has nothing useful to
           defer — but it does have a frame in which it can decide to fetch,
           and that frame is the one where the landmark rises out of the dark.
           A pair of ~85 KB thumbnails is not worth the risk of an empty card.
           Low priority so they still queue behind the hero. */
        image.fetchPriority = "low"
        frame.appendChild(image)
        // Both badges say the same thing, which is the point of showing two.
        frame.appendChild(el("span", "rz-artworks__badge", work.truth || "Human"))
        card.appendChild(frame)

        // Picking marks the reader's answer and stops there — the button below
        // is what tells them, the same as it does under the illusion.
        card.addEventListener("click", () => cards.forEach((other) => (other.dataset.picked = String(other === card))))
        grid.appendChild(card)
        return card
    })
    wrap.appendChild(grid)

    wrap.appendChild(
        buildAsk(config, (on) => {
            wrap.dataset.revealed = on ? "true" : "false"
            if (!on) cards.forEach((card) => (card.dataset.picked = "false"))
        }).node,
    )

    return wrap
}

/* The heart–brain loop: one cardiac cycle drawn as a ring that fills, a heart
   that contracts inside it, and the burst that leaves the baroreceptors on the
   pressure wave and arrives at the brainstem. Everything is on the *same* CSS
   cycle — `--rz-cycle` is the only timing in it — so the ejection, the burst
   and the ring's systolic arc cannot drift apart however long it runs.
   Deliberately a loop rather than something the reader scrubs: the claim is
   that this happens on every beat whether or not anyone is watching. */
function buildHeartBrainFigure(config) {
    const wrap = el("div", "rz-fig rz-fig--heartbrain")

    /* Geometry, for anything that has to be changed in step:
         brain     centred (160, 52)
         ring      centred (160, 208), r 60 — 12 o'clock is the start of systole,
                   which runs clockwise for the first 35% of the circumference
         heart     the same centre, and the scale origin of the beat
         nerve     leaves the heart, passes the baroreceptor node at (108, 146),
                   and ends on the brainstem at (143, 96)
       The ring's dash lengths are fractions of 2π·60 = 376.99 and live in the
       stylesheet with the rest of the timing; the transform origins there
       repeat these coordinates because CSS cannot read them off the markup. */
    wrap.appendChild(
        svgMarkup(`
        <svg viewBox="0 0 320 280" class="rz-hb" role="img" aria-label="A heart beating inside a ring marking one cardiac cycle, with a baroreceptor signal travelling to the brain on each systole">
            <defs>
                <!-- Stop colours come from the stylesheet, so --rz-brain is the
                     one place the brain's colour is stated. -->
                <radialGradient id="rz-hb-glow">
                    <stop class="rz-hb__glow-stop rz-hb__glow-stop--in" offset="0"/>
                    <stop class="rz-hb__glow-stop rz-hb__glow-stop--out" offset="1"/>
                </radialGradient>
            </defs>

            <ellipse class="rz-hb__glow" cx="160" cy="52" rx="88" ry="62" fill="url(#rz-hb-glow)"/>

            <g class="rz-hb__brain">
                <path class="rz-hb__brain-shape" d="M 110 58 C 100 42 112 24 132 26 C 140 14 162 12 170 24 C 190 16 208 30 204 48 C 216 58 210 78 194 80 C 186 92 166 94 158 84 C 144 92 124 86 120 74 C 110 74 106 66 110 58 Z"/>
                <path class="rz-hb__fold" d="M 132 38 C 144 44 140 56 150 60"/>
                <path class="rz-hb__fold" d="M 172 32 C 180 44 174 54 184 62"/>
                <path class="rz-hb__fold" d="M 140 72 C 152 66 158 74 168 68"/>
                <path class="rz-hb__stem" d="M 152 82 C 150 90 147 94 143 96"/>
            </g>

            <path class="rz-hb__nerve" d="M 146 188 C 126 176 110 164 108 146 C 102 120 118 100 143 96"/>
            <path class="rz-hb__burst" pathLength="100" d="M 146 188 C 126 176 110 164 108 146 C 102 120 118 100 143 96"/>
            <circle class="rz-hb__ping" cx="108" cy="146" r="4.5"/>
            <circle class="rz-hb__baro" cx="108" cy="146" r="3.4"/>

            <!-- Two fills, not one. The lap used to be a single stroke that
                 changed colour at the phase boundary, which meant the whole
                 travelled arc was red through systole and then all of it turned
                 blue — the phase that had just been drawn was erased by the one
                 being drawn. Each phase now fills its own arc and stops: the
                 red keeps the first 35% for the rest of the beat while the blue
                 grows from the boundary. The blue is rotated to start there
                 (126° = 0.35 turn), which is the only number the two share. -->
            <g class="rz-hb__ring" transform="translate(160 208) rotate(-90)">
                <circle class="rz-hb__arc rz-hb__arc--dia" r="60"/>
                <circle class="rz-hb__arc rz-hb__arc--sys" r="60"/>
                <circle class="rz-hb__sweep rz-hb__sweep--sys" r="60"/>
                <circle class="rz-hb__sweep rz-hb__sweep--dia" r="60" transform="rotate(126)"/>
            </g>
            <g class="rz-hb__hand"><circle cx="0" cy="-60" r="3.6"/></g>

            <path class="rz-hb__heart" d="M 160 230 C 130 212 132 190 147 186 C 155 184 160 190 160 195 C 160 190 165 184 173 186 C 188 190 190 212 160 230 Z"/>

            <text class="rz-hb__tag rz-hb__tag--brain" x="160" y="12" text-anchor="middle">Brain</text>
            <text class="rz-hb__tag rz-hb__tag--baro" x="98" y="140" text-anchor="end">Baroreceptors</text>
            <text class="rz-hb__tag rz-hb__tag--sys" x="228" y="176">Systole</text>
            <text class="rz-hb__tag rz-hb__tag--dia" x="92" y="248" text-anchor="end">Diastole</text>
        </svg>`),
    )

    /* The one control here is not a reveal — there is nothing hidden — but it
       keeps the same shape as the other two landmarks' so the reader learns one
       thing: a line, and a button under it. The test itself does not exist yet,
       and saying so on the button is more honest than a button that quietly
       does nothing. */
    const ask = el("div", "rz-fig__ask")
    ask.appendChild(el("p", "rz-fig__prompt", config.question || "How good is your interoception?"))

    const button = el("button", "rz-fig__button", config.button || "Take the test (5min)")
    button.type = "button"
    button.addEventListener("click", () => {
        if (wrap.dataset.soon === "true") return
        wrap.dataset.soon = "true"
        button.textContent = config.soon || "In construction"
        // aria-disabled rather than `disabled`: a disabled button drops out of
        // the tab order and cannot be focused, so a reader who arrived at it by
        // keyboard would be left with nothing under their focus ring.
        button.setAttribute("aria-disabled", "true")
    })
    ask.appendChild(button)
    wrap.appendChild(ask)

    return wrap
}

/* ── The instruments on the timeline's plates ──
 * Line art on a 200×200 grid in `currentColor`, at the same weight as
 * `.rz-cloud`'s old glyphs were — the site's one drawing vocabulary, six times
 * larger than a bullet because these are the subject. Anything added here has to
 * be drawn to that weight or the set stops reading as a set. (The Creations
 * tab's star and these are now the whole of it; the strand tiles that carried a
 * third set went with the last landmark's rebuild.)
 *
 * ── They are the placeholder, and they have to look finished ──
 * A station shows its drawing until it is given an `img`, at which point the
 * painting takes the plate and the drawing is not built at all. So this set is
 * what the widget looks like today, and what a station with no picture to find
 * looks like for good — the frontier being one of those by construction. A grey
 * box with a filename in it would have been the honest placeholder and the
 * wrong one: a reader cannot tell "not gathered yet" from "broken", and the one
 * thing this figure cannot afford is looking unfinished.
 *
 * Drawn rather than photographed for the reason the prism this replaced was: a
 * Bosch, a Hipp chronoscope, an EEG trace and a posterior over accumulated
 * evidence have nothing in common photographically, and at this size, in one
 * line weight, they look like what they are — five centuries of the same
 * gesture. That stops being true one picture at a time as the real ones arrive,
 * which is fine: by then the frame's own dressing is what holds them together.
 */
const ERA_ARTS = {
    // Bosch's Cure of Folly: the skull opened and the stone lifted out of it.
    // The blade and the funnel hat are the painting's own detail and are left
    // out — at 150px they are two more things to squint at, and the stone
    // coming out of a head is the whole of what the station is saying.
    folly: `<svg class="rz-era__art" viewBox="-2 4.5 200 200" aria-hidden="true">
        <path d="M66 186 V154 C46 145 39 124 41 108 C44 78 67 58 98 58 C131 58 153 79 155 108 C156 124 149 134 139 138 L142 152 L130 156 L132 170 L116 174 L116 186 Z"/>
        <path d="M50 100 C72 70 126 68 150 98"/>
        <path d="M140 122 C132 130 120 132 112 128"/>
        <circle class="rz-era__solid" cx="102" cy="30" r="7"/>
        <path class="rz-era__faint" d="M84 40 L90 48"/>
        <path class="rz-era__faint" d="M120 40 L114 48"/>
        <path class="rz-era__faint" d="M102 48 V56"/>
    </svg>`,
    // Pinel at the Salpêtrière: the cuff open and empty, and the chain that was
    // on it broken and falling away. The empty ring is the point — this is the
    // one station whose subject is something *stopping*.
    pinel: `<svg class="rz-era__art" viewBox="12.5 7.5 200 200" aria-hidden="true">
        <path d="M110 46 A 42 42 0 1 0 110 106"/>
        <path d="M104 55 A 30 30 0 1 0 104 97"/>
        <path d="M110 46 L104 55"/>
        <path d="M110 106 L104 97"/>
        <ellipse cx="138" cy="132" rx="15" ry="9" transform="rotate(42 138 132)"/>
        <ellipse cx="168" cy="164" rx="15" ry="9" transform="rotate(42 168 164)"/>
        <path class="rz-era__faint" d="M118 108 L126 100"/>
        <path class="rz-era__faint" d="M126 116 L136 110"/>
    </svg>`,
    // Gall's bust: a profile in mapped compartments, which is the whole idea —
    // a faculty per region, readable from the outside.
    phrenology: `<svg class="rz-era__art" viewBox="0 0 200 200" aria-hidden="true">
        <path d="M64 168 V132 C40 122 32 98 34 80 C37 47 63 26 98 26 C136 26 160 50 162 82 C163 100 156 112 145 116 L148 132 L134 136 L136 152 L118 156 L118 168 Z"/>
        <path d="M34 80 C64 66 108 62 148 72"/>
        <path d="M45 56 C74 76 74 108 62 132"/>
        <path d="M74 32 C88 62 92 100 84 140"/>
        <path d="M104 27 C110 60 112 100 108 130"/>
        <path d="M132 33 C132 66 130 96 126 118"/>
        <path d="M40 100 C74 92 120 92 158 100"/>
        <path d="M36 118 C64 114 100 114 148 118"/>
        <circle class="rz-era__solid" cx="151" cy="97" r="4"/>
    </svg>`,
    // Hipp's chronoscope, which is what Wundt's room was built around: a dial
    // reading thousandths of a second, over the clockwork that got it there.
    // The first instrument that made "how long did that thought take" an
    // answerable question.
    chronoscope: `<svg class="rz-era__art" viewBox="0 0 200 200" aria-hidden="true">
        <circle cx="100" cy="82" r="52"/>
        <circle cx="100" cy="82" r="44"/>
        <path d="M100 38 V46"/><path d="M144 82 H136"/><path d="M100 126 V118"/><path d="M56 82 H64"/>
        <path d="M131 51 L126 56"/><path d="M131 113 L126 108"/><path d="M69 113 L74 108"/><path d="M69 51 L74 56"/>
        <path d="M100 82 L128 62"/>
        <path d="M100 82 L88 108"/>
        <circle class="rz-era__solid" cx="100" cy="82" r="5"/>
        <path d="M74 134 V150 H126 V134"/>
        <path d="M62 150 H138 L146 172 H54 Z"/>
        <circle cx="84" cy="161" r="7"/>
        <circle cx="116" cy="161" r="7"/>
        <path d="M84 161 L116 161"/>
    </svg>`,
    // Brouillet's clinical lesson: a patient held up in front of a room full of
    // men looking at her. The audience is the subject of the drawing rather
    // than the background to it — that a demonstration needed a theatre is the
    // thing the station is about.
    charcot: `<svg class="rz-era__art" viewBox="1 14 200 200" aria-hidden="true">
        <path d="M16 88 C58 54 142 54 184 88"/>
        <circle cx="24" cy="72" r="7"/>
        <circle cx="46" cy="58" r="7"/>
        <circle cx="70" cy="49" r="7"/>
        <circle cx="96" cy="45" r="7"/>
        <circle cx="122" cy="47" r="7"/>
        <circle cx="148" cy="55" r="7"/>
        <circle cx="172" cy="70" r="7"/>
        <circle cx="62" cy="118" r="10"/>
        <path d="M62 130 V 166"/>
        <path d="M62 140 L96 132"/>
        <path d="M62 166 L50 190"/>
        <path d="M62 166 L74 190"/>
        <circle class="rz-era__solid" cx="150" cy="130" r="9"/>
        <path d="M142 137 C126 150 112 158 96 160"/>
        <path class="rz-era__faint" d="M96 160 L74 168"/>
        <path d="M86 178 H186"/>
        <path class="rz-era__faint" d="M104 178 V190"/>
        <path class="rz-era__faint" d="M176 178 V190"/>
    </svg>`,
    // Berger's answer to the skull-readers: the same head, sampled at the
    // scalp, with the trace it produces running underneath.
    eeg: `<svg class="rz-era__art" viewBox="1 8 200 200" aria-hidden="true">
        <path d="M62 150 V128 C40 118 32 96 34 78 C37 47 63 26 98 26 C136 26 160 48 162 80 C163 98 156 110 145 114 L148 128 L136 132 L138 148"/>
        <path d="M40 62 C70 44 124 44 154 64"/>
        <circle class="rz-era__solid" cx="52" cy="74" r="5"/>
        <circle class="rz-era__solid" cx="76" cy="53" r="5"/>
        <circle class="rz-era__solid" cx="104" cy="46" r="5"/>
        <circle class="rz-era__solid" cx="132" cy="53" r="5"/>
        <circle class="rz-era__solid" cx="154" cy="74" r="5"/>
        <path d="M52 74 C58 88 66 92 76 90"/>
        <path d="M76 53 C82 70 88 78 100 80"/>
        <path d="M132 53 C128 70 122 78 110 80"/>
        <path d="M154 74 C148 88 140 92 130 90"/>
        <path class="rz-era__trace" d="M22 176 H44 L50 160 L56 188 L62 168 L70 176 H88 L94 156 L100 190 L106 170 L114 176 H134 L140 162 L146 186 L152 170 L158 176 H180"/>
    </svg>`,
}

/* ── The deck ──
 * Five centuries of asking the lab's questions with whatever was to hand, dealt
 * as a fanned stack of photographs: the cards spread down and to the right, one
 * after another in about a second, and the run comes to rest on a photograph of
 * this lab recording EEG and physiology. **That ending is the argument** — the
 * landmark is about a line of instruments that each looked definitive and each
 * turned out to be a stage, and putting our own bench on top of the pile is the
 * only honest place to put it.
 *
 * ── The stack is the point, not the sequence ──
 * Two earlier versions showed one picture at a time: a walkable timeline with a
 * dot axis, then a deck turning on a spindle. Both spent most of their life
 * showing a single image, so the *arc* — the thing the landmark is actually
 * claiming — had to be remembered rather than seen. Fanned, all six are on
 * screen at once and the claim is the picture: six overlapping frames, oldest
 * at the back, ours in front. The deal is what says which order they came in.
 *
 * ── Peeling is the only way back ──
 * Every card keeps a sliver showing, and pointing at one lifts everything in
 * front of it away so it can be seen whole. That is what earns the legend back:
 * with the pictures now permanently overlapping, a reader who wants to know what
 * the half-hidden painting behind the lab photograph *is* has a way to ask, and
 * an answer that appears only when asked. It is not a caption on every card,
 * which is what the timeline had and what made it four labels for one image.
 *
 * ── The deal plays while the landmark holds, and the stagger is CSS ──
 * A quarter-second ticker watches `.rz-scene--held` and does two things: arms
 * the pictures, and adds or removes one class. The per-card delay is the
 * stylesheet's (`--rz-i` times a step) and not a JS timer, because a background
 * tab clamps timers to roughly 1Hz — which would turn a one-second deal into six
 * seconds of cards arriving one at a time. A transition delay is not a timer.
 *
 * ── The stacked branch needs its own layout ──
 * There, and under reduced motion, `paint()` never runs, so nothing is ever held
 * and the deal never fires. `.rz--static` lays the deck out flat as a contact
 * sheet instead — every card at once, nothing overlapping, nothing to wait for,
 * and the cards are still buttons so a tap names one. It is written in the
 * stylesheet rather than here, so crossing the breakpoint switches between the
 * two for free. See `.rz--static .rz-era` in `css/21-reality-zoom.css`.
 */
const ERA_TICK_MS = 250

/* The legend a card shows: its own title, then artist and year on the line
 * under it. Both parts are optional and two of the six plates genuinely have no
 * attribution to give — a phrenological chart and a catalogue engraving of a
 * chronoscope are anonymous, and **inventing a name for either would be worse
 * than leaving the line short.** The lab's own photograph has a title and no
 * artist for the same reason in reverse. */
function eraMeta(station) {
    return [station.artist, station.year].filter(Boolean).join(", ")
}

function buildEraFigure(config) {
    const wrap = el("div", "rz-fig rz-fig--era")
    const stations = Array.isArray(config.stations) ? config.stations.filter((item) => item && item.id) : []
    if (!stations.length) return wrap

    const last = stations.length - 1
    const deck = el("div", "rz-era")

    /* ── Every card is a real button ──
     * The previous deck was one `role="img"` with a single authored label,
     * because nothing in it could be pointed at. This one can: each card peels
     * the stack back to itself and names its own painting, which is a control,
     * so it is a `<button>` with its legend as the accessible name. Six tab
     * stops, and they cost nothing anywhere else on the page — `paint()` marks
     * every scene that is not holding the screen `inert`, so only the landmark
     * actually in front of the reader is ever in the tab order.
     *
     * Stacking is source order via `z-index: var(--rz-i)`, which is also what
     * makes the hit-testing work with no code: a card is covered by the ones
     * dealt after it, so the only part of it that can receive a pointer is the
     * sliver still showing — exactly the edge the reader is aiming at. */
    const cards = stations.map((station, index) => {
        const card = el("button", "rz-era__card" + (station.img ? " rz-era__card--photo" : " rz-era__card--drawn"))
        card.type = "button"
        card.style.setProperty("--rz-i", String(index))
        // How far along the run this card is: the stylesheet warms the old ones
        // and leaves the last one alone, which is the only thing left saying
        // that this is five centuries and not six photographs.
        card.style.setProperty("--rz-plate-t", (last ? index / last : 0).toFixed(3))
        card.setAttribute("aria-label", [station.title, eraMeta(station)].filter(Boolean).join(" — "))

        if (station.img) {
            const image = el("img", "rz-era__img")
            /* ── The src is withheld until the gate opens ──
               `.rz-scenes` is `display: none` until the reader opens the zoom,
               and these six pictures are 706 KB — measured — for a dive most
               readers never open. **`loading="lazy"` does not defer them**,
               which is the trap: an image with no layout box can never
               intersect the viewport, so the browser loads it immediately
               rather than never. `armImages()` below assigns `src` on the first
               tick where the figure has a box, i.e. the moment the gate opens.
               `loading` stays as the honest statement that these are not
               urgent, and it is written before `src` because assigning `src`
               starts the fetch there and then and a `loading` written
               afterwards does not call it back. */
            image.loading = "lazy"
            image.fetchPriority = "low"
            image.decoding = "async"
            // The button's own aria-label already names the picture.
            image.alt = ""
            image.dataset.src = station.img
            card.appendChild(image)
        } else {
            /* The fallback nothing currently takes: every station has a picture.
               It stays because a station added without one has to render as
               *something*, and a grey box with a filename in it cannot be told
               from a broken image. */
            const art = ERA_ARTS[station.art]
            if (art) card.appendChild(svgMarkup(art))
        }

        deck.appendChild(card)
        return card
    })

    /* The legend. Its height is reserved in the stylesheet — one line for the
       title and one for the attribution, whether or not either is there — for
       the reason everything in this dive reserves its height: the landmarks are
       centred in a stage that clips, so a strip that grew when the reader
       pointed at something would shift the whole scene under them mid-gesture. */
    const legend = el("div", "rz-era__legend")
    const legendTitle = el("p", "rz-era__legend-title")
    const legendMeta = el("p", "rz-era__legend-meta")
    legend.appendChild(legendTitle)
    legend.appendChild(legendMeta)

    wrap.appendChild(deck)
    wrap.appendChild(legend)

    /* ── Peeling ──
     * Pointing at a card lifts every card in front of it off the pile and names
     * the one underneath. `focus(null)` is the rest state, which shows the top
     * card — the lab — because that is what is actually facing the reader when
     * nobody is pointing at anything.
     *
     * The peel is `data-peeled` on the cards *after* the focused one rather
     * than anything on the focused card itself, so the card being revealed
     * never moves. A reveal that also slid the thing being revealed is the one
     * way to make this gesture feel unreliable. */
    function focus(index) {
        const at = index === null ? last : index
        cards.forEach((card, i) => {
            card.dataset.peeled = String(index !== null && i > index)
            card.dataset.focus = String(i === at)
        })
        const station = stations[at]
        legendTitle.textContent = station.title || ""
        legendMeta.textContent = eraMeta(station)
    }

    cards.forEach((card, index) => {
        /* Touch is excluded for the reason the rest of this file excludes it: a
           tap fires `pointerenter` before its own `click`, so the two would
           fight over one gesture. On a touch screen the click below is what
           does the work, and the stacked branch lays the deck out flat so there
           is something to tap at. */
        card.addEventListener("pointerenter", (event) => {
            if (event.pointerType === "touch") return
            focus(index)
        })
        card.addEventListener("focus", () => focus(index))
        card.addEventListener("click", () => focus(index))
    })
    deck.addEventListener("pointerleave", () => focus(null))
    deck.addEventListener("focusout", (event) => {
        if (!deck.contains(event.relatedTarget)) focus(null)
    })

    focus(null)

    /* The pictures, once there is anything to show them in. `offsetParent` is
       null for an element inside a `display: none` box and non-null the moment
       the gate opens it, which is the whole test — no observer, and nothing
       here has to know that a gate exists. Runs once. */
    let armed = false
    function armImages() {
        if (armed || !wrap.offsetParent) return
        armed = true
        wrap.querySelectorAll("img[data-src]").forEach((image) => {
            image.src = image.dataset.src
            image.removeAttribute("data-src")
        })
    }

    /* ── The deal ──
     * One class, and the stagger is the stylesheet's (`--rz-i` times a step).
     * It was a JS timer walking an index, and a CSS stagger is better here for
     * a reason that has bitten this file before: a background tab clamps timers
     * to roughly 1Hz, which would turn a one-second deal into six seconds of
     * cards arriving one at a time. A transition delay is not a timer and does
     * not care.
     *
     * The ticker that remains does two things only: arm the pictures, and watch
     * `--held`. Dealing on hold and clearing on release is what makes the run
     * play again on a second visit rather than being permanently spent.
     */
    let held = false
    setInterval(() => {
        armImages()
        const scene = wrap.closest(".rz-scene")
        const holding = !!scene && scene.classList.contains("rz-scene--held")
        if (holding === held) return
        held = holding
        if (held) {
            deck.classList.add("is-dealt")
            return
        }
        /* Off screen: gather the pile back up, and drop any peel with it — a
           reader who left mid-hover would otherwise come back to a stack that
           is still holding itself open for a pointer that has gone. The class
           goes off without a stagger (the stylesheet zeroes the delay when it
           is absent), so the reset is a single movement rather than the deal
           run backwards. */
        deck.classList.remove("is-dealt")
        focus(null)
    }, ERA_TICK_MS)

    return wrap
}

const FIGURE_BUILDERS = {
    cloud: buildCloudFigure,
    ponzo: buildPonzoFigure,
    artworks: buildArtworksFigure,
    heartbrain: buildHeartBrainFigure,
    era: buildEraFigure,
}

/* ── Assembly ── */

/* ── A landmark's background film ──
 * One landmark has one, and it is an **animated image, not a `<video>`**.
 *
 * That is the whole of what this used to be: two encodes, a `preload="none"`
 * held back until the gate opened, a `--rz-mode` gate, a `load()` before
 * `play()`, a silent `anullsrc` track muxed in to dodge Chrome's power-pause,
 * a `pause` listener to fight it anyway, and a `play()` rejection logged
 * because the console message was the only thing that could identify a
 * failure. All of it correct, and the film was still reported twice as one
 * that never played — a `<video>` has too many ways to sit on one dark frame
 * that nothing in CSS can see or reach. An animated image has none of them: it
 * decodes and runs wherever an `<img>` would.
 *
 * **The withholding survives the change and costs nothing.** `.rz-scenes` is
 * `display: none` until the gate opens, and a browser does not fetch a
 * background image inside a `display: none` subtree — so the discipline the
 * old `preload`/`data-src` dance existed to enforce is now a property of the
 * layout. Verified: 0 requests before the gate.
 *
 * **The stacked branch gets the still, not the loop**, chosen in the stylesheet
 * off the same media query that sets `--rz-mode: stack` — so there is still one
 * place the mode is decided, and it is not read back into script at all any
 * more. A phone pays 13 KB instead of 687, and gets a picture where this
 * landmark used to open with none.
 *
 * The two paths come from the content module, as inline custom properties: a
 * relative `url()` in `css/` resolves against that folder, and these have to go
 * through `<base>`.
 */

/* Which side the figure sits on comes from :nth-child in the stylesheet, so a
   landmark's position in the list is the only thing that decides it. */
function buildLandmark(landmark) {
    const scene = el("article", "rz-scene")
    scene.id = "rz-scene-" + landmark.id
    scene.dataset.landmark = landmark.id
    scene.style.setProperty("--rz-accent", landmark.accent || "#5599ff")

    /* Behind everything in the scene, on a negative z-index. The scene already
       makes a stacking context of its own (it carries a `transform`), so the
       layer cannot escape underneath the stage — and because it is a child of
       the scene it inherits `--rz-in`, which means it fades in and out with the
       landmark for free rather than needing a line in `paint()`. */
    const film = landmark.background && landmark.background.image
    if (film) {
        scene.classList.add("rz-scene--film")
        const filmBox = el("div", "rz-scene__film")
        /* Decorative: it is the landmark's ground, and the paragraphs over it
           are the content. A `div` rather than an `<img>` for that reason, and
           because the stylesheet has to be able to choose between the loop and
           the still per media query. */
        const picture = el("div", "rz-scene__video")
        /* Resolved against `document.baseURI` here, and that is not belt and
           braces. A `url()` inside a custom property is resolved against the
           stylesheet that *consumes* it, not the rule that declares it — so
           these, declared inline but read by `background-image` in
           `css/21-reality-zoom.css`, came out as `/css/research/img/…` and
           404'd. Measured, first try. `new URL(…, document.baseURI)` is what
           `<base>` would have done for an `<img src>`, which keeps it
           mount-aware for a copy served from a sub-path. */
        const url = (path) => 'url("' + new URL(path, document.baseURI).href + '")'
        picture.style.setProperty("--rz-film-src", url(film))
        picture.style.setProperty("--rz-film-still", url(landmark.background.still || film))
        filmBox.appendChild(picture)
        scene.appendChild(filmBox)
    }

    const copy = el("div", "rz-scene__copy")
    if (landmark.eyebrow) copy.appendChild(el("p", "rz-scene__eyebrow", landmark.eyebrow))
    if (landmark.title) copy.appendChild(el("h3", "rz-scene__title", landmark.title))
    /* One string or several: a landmark that has an argument to make rather
       than a caption to give gets a paragraph per step of it, and .rz-scene__copy
       is already a grid with a gap, so nothing has to space them. */
    const paragraphs = Array.isArray(landmark.text) ? landmark.text : landmark.text ? [landmark.text] : []
    /* An entry is a plain string, or `{ text, pause: true }` — a beat held open
       before it. A pause is worth one slot of the stagger and one extra gap
       above the paragraph, and `data-slot` is what carries the first half of
       that into `paint()`: the stagger counts slots rather than array indices,
       so a pause costs a step without anything downstream being renumbered by
       hand. See `.rz-scene__text--beat` for the space, and FILM_TEXT_STEP for
       why the step had to come down when this one was added. */
    let slot = 0
    paragraphs.forEach((entry) => {
        const beat = !!(entry && typeof entry === "object" && entry.pause)
        if (beat) slot += 1
        const node = el("p", "rz-scene__text" + (beat ? " rz-scene__text--beat" : ""), typeof entry === "string" ? entry : entry.text)
        node.dataset.slot = String(slot)
        copy.appendChild(node)
        slot += 1
    })
    /* Several paragraphs is a different object from a caption and has to be set
       as one: the stage is exactly 100vh and clips, so the leading that is right
       for four lines overflows at twenty. See .rz-scene--essay. */
    if (paragraphs.length > 1) scene.classList.add("rz-scene--essay")
    if (landmark.note) copy.appendChild(el("p", "rz-scene__note", landmark.note))

    if (Array.isArray(landmark.tags) && landmark.tags.length) {
        const tags = el("ul", "rz-scene__tags")
        landmark.tags.forEach((tag) => tags.appendChild(el("li", null, tag)))
        copy.appendChild(tags)
    }
    scene.appendChild(copy)

    const builder = landmark.figure && FIGURE_BUILDERS[landmark.figure.type]
    if (builder) {
        const figure = el("div", "rz-scene__figure")
        /* The scene is passed as a second argument for the one builder that
           writes back into the copy column — the map rewrites the landmark's own
           paragraph as the reader moves over it, which is a different gesture
           from a caption appearing under a figure. Every other builder ignores
           it. The copy is already built and appended by this point, so the
           `.rz-scene__text` the map goes looking for is there to be found. */
        figure.appendChild(builder(landmark.figure, scene))
        scene.appendChild(figure)
    } else {
        scene.classList.add("rz-scene--text-only")
    }

    return scene
}

export function buildRealityZoom(tab) {
    const landmarks = Array.isArray(tab.landmarks) ? tab.landmarks.filter((item) => item && item.id) : []

    const root = el("div", "rz")
    const track = el("div", "rz-track")
    const stage = el("div", "rz-stage")

    const zoom = el("div", "rz-zoom")
    const image = el("img", "rz-eye")
    image.src = "img/magritte_falsemirror.jpg"
    image.alt = "René Magritte, The False Mirror — a giant eye whose iris is a cloudy sky"
    image.decoding = "async"
    zoom.appendChild(image)
    zoom.appendChild(el("div", "rz-pupil"))
    stage.appendChild(zoom)

    stage.appendChild(el("div", "rz-veil"))
    stage.appendChild(el("div", "rz-depth"))

    const question = el("p", "rz-question", tab.question || "What is Reality?")
    stage.appendChild(question)

    const scenes = el("div", "rz-scenes")
    scenes.id = "rz-landmarks"
    const sceneNodes = landmarks.map((landmark) => {
        const scene = buildLandmark(landmark)
        scenes.appendChild(scene)
        return scene
    })
    stage.appendChild(scenes)

    /* The rail is the section's only navigation once the page is black: it says
       how many stations there are and jumps between them. */
    // A div carrying the role rather than a <nav>: the stylesheet styles bare
    // `nav` as the site's own bar — fixed, cream, and a 14rem sidebar past
    // 1800px — and a second <nav> anywhere on the page inherits all of it.
    const rail = el("div", "rz-rail")
    rail.setAttribute("role", "navigation")
    rail.setAttribute("aria-label", "Research landmarks")

    /* The dots get a container of their own, of a known height and split into
       one equal row per landmark. That is what lets the line behind them double
       as a position readout: a dot centred in row i sits exactly (i + 0.5) / n
       of the way down, which is the same fraction the fill reaches when that
       landmark is holding the screen. They agree by construction. */
    const railTrack = el("div", "rz-rail__track")
    railTrack.style.setProperty("--rz-count", String(landmarks.length))

    const dots = landmarks.map((landmark) => {
        const dot = el("button", "rz-rail__dot")
        dot.type = "button"
        dot.dataset.landmark = landmark.id
        dot.style.setProperty("--rz-accent", landmark.accent || "#5599ff")
        // `short` exists because a title can be a whole sentence, and the label
        // is nowrap — the rail would be as wide as the stage.
        dot.appendChild(el("span", "rz-rail__label", landmark.short || landmark.title || landmark.id))
        railTrack.appendChild(dot)
        return dot
    })
    rail.appendChild(railTrack)
    /* The rail carries the dots and nothing else. It used to end in a button
       through to the other tab, which said exactly what `#fab-research-creations`
       says — and that one is up for the whole section rather than only once the
       dive has gone dark, so the rail's copy was the redundant one. */

    if (dots.length) stage.appendChild(rail)

    /* Last child of the stage on purpose. Zoomed it is absolutely placed, so
       order costs nothing; stacked it is `position: sticky; bottom`, and a
       bottom-stuck element can only ever be pushed *up* out of its natural
       position — as a first child it would simply scroll away off the top. Last
       is what pins it to the foot of the screen for the whole stack. */
    const close = el("button", "rz-close")
    close.type = "button"
    close.setAttribute("aria-label", "Leave the zoom")
    close.title = "Leave the zoom (Esc)"
    close.appendChild(el("span", "rz-close__mark", "✕"))

    /* The gate. It lies over the eye at full size and is the only thing that
       changes when the reader opens the zoom — the picture underneath does not
       move. It is itself the button, covering the whole stage, so anywhere on
       the section opens it; the line of text only says so. */
    const gateConfig = tab.gate || {}
    const gateButton = el("button", "rz-gate")
    gateButton.type = "button"
    gateButton.setAttribute("aria-expanded", "false")
    gateButton.setAttribute("aria-controls", scenes.id)
    gateButton.appendChild(el("span", "rz-gate__label", gateConfig.label || "Click to discover our research"))
    stage.appendChild(gateButton)

    const hint = el("p", "rz-hint", tab.hint || "Scroll to look closer")
    stage.appendChild(hint)

    stage.appendChild(close)

    track.appendChild(stage)
    root.appendChild(track)

    return { root, track, stage, zoom, image, question, sceneNodes, rail, railTrack, dots, close, gateButton, hint, count: landmarks.length }
}

/* ── The driver ── */

export function initRealityZoom(parts, mainPage) {
    const { root, track, stage, zoom, image, question, sceneNodes, railTrack, dots, close, gateButton, hint } = parts
    if (!root || !mainPage) return null

    /* One scene has a film behind it and paragraphs staggered against its own
       `local` progress (see FILM_TEXT_START above) — queried once rather than
       every scroll frame, since the paragraph count and order never change. */
    const filmTexts = sceneNodes.map((scene) =>
        scene.classList.contains("rz-scene--film") ? [...scene.querySelectorAll(".rz-scene__text")] : null,
    )

    /* Timeline, derived from the same vh budgets the track is sized with so the
       two can never disagree. */
    let zoomEnd = 0.3
    let sceneSpan = 0.175
    let scenesEnd = 1 /* where the last landmark is gone and the pull-back starts */
    let coverScale = 12
    let isStatic = false

    const isLocked = () => !root.classList.contains("rz--unlocked")

    function syncGeometry() {
        /* Whether there is a zoom to drive at all is the stylesheet's call —
           below 900px and under reduced motion the landmarks stack instead —
           and this reads the decision back through --rz-mode rather than
           re-testing the media queries. It cannot read the stage's `position`
           for this any more: the lock state moves that too. */
        isStatic = getComputedStyle(root).getPropertyValue("--rz-mode").trim() === "stack"
        root.classList.toggle("rz--static", isStatic)
        if (isStatic) {
            track.style.height = ""
            // Both would otherwise be left behind by whatever the last scroll
            // frame wrote before the viewport crossed the breakpoint.
            root.classList.remove("rz--dark")
            mainPage.classList.remove("main-page--dark-zoom")
            return
        }

        const stageWidth = stage.clientWidth
        const stageHeight = stage.clientHeight
        if (!stageWidth || !stageHeight) return

        /* The scroll budget is the *only* thing the gate changes. Locked, the
           track is exactly the stage, so the sticky stage has no travel and the
           page carries a full screen of the eye past like any other section;
           opening buys the ~700vh that the dive is scrubbed through. The
           picture is identical either side of the switch. */
        const scroll = (ZOOM_VH + sceneNodes.length * SCENE_VH + OUTRO_VH) * stageHeight
        track.style.height = isLocked() ? stageHeight + "px" : stageHeight + scroll + "px"
        zoomEnd = scroll > 0 ? (ZOOM_VH * stageHeight) / scroll : 1
        sceneSpan = scroll > 0 ? (SCENE_VH * stageHeight) / scroll : 0
        // Derived rather than measured off OUTRO_VH separately: the landmarks
        // end where they end, and the pull-back gets whatever is left.
        scenesEnd = Math.min(1, zoomEnd + sceneNodes.length * sceneSpan)

        // A cover fit done by hand: object-fit would place the pupil somewhere
        // only the compositor knows, and the pupil is the pivot of everything
        // below.
        const natural = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 2000 / 1345
        const stageRatio = stageWidth / stageHeight
        const width = stageRatio > natural ? stageWidth : stageHeight * natural
        const height = stageRatio > natural ? stageWidth / natural : stageHeight
        const left = (stageWidth - width) / 2
        const top = (stageHeight - height) / 2

        root.style.setProperty("--rz-img-w", width.toFixed(1) + "px")
        root.style.setProperty("--rz-img-h", height.toFixed(1) + "px")
        root.style.setProperty("--rz-img-x", left.toFixed(1) + "px")
        root.style.setProperty("--rz-img-y", top.toFixed(1) + "px")

        const pupilX = left + width * PUPIL_X
        const pupilY = top + height * PUPIL_Y
        const pupilR = width * PUPIL_R
        root.style.setProperty("--rz-pupil-x", pupilX.toFixed(1) + "px")
        root.style.setProperty("--rz-pupil-y", pupilY.toFixed(1) + "px")
        root.style.setProperty("--rz-pupil-r", pupilR.toFixed(1) + "px")

        // How far the pupil has to grow before it clears the furthest corner.
        // Measured rather than guessed: the pupil is off-centre, so the corner
        // that matters changes with the viewport.
        const far = Math.max(
            Math.hypot(pupilX, pupilY),
            Math.hypot(stageWidth - pupilX, pupilY),
            Math.hypot(pupilX, stageHeight - pupilY),
            Math.hypot(stageWidth - pupilX, stageHeight - pupilY),
        )
        coverScale = (far / pupilR) * 1.06
    }

    function progress() {
        const rect = track.getBoundingClientRect()
        const range = track.offsetHeight - stage.clientHeight
        return range > 0 ? clamp01(-rect.top / range) : 0
    }

    let activeIndex = -1
    let atRest = false

    /* Leaving the track at either end shuts the gate again.
       - Up: the reader zooms all the way back out and keeps going.
       - Down: they have flown the whole dive and started to leave. Without this
         the ~700vh track is still there behind them, and scrolling back drops
         them into the middle of it instead of onto the overlay.
       The margins are hysteresis — without them the smallest twitch past either
       end would flip the gate. Down gets the larger one because it is grace as
       well: a quarter of a screen in which a reader who overshot the last frame
       can scrub back into the dive. */
    const EXIT_UP_MARGIN = 0.12
    const EXIT_DOWN_MARGIN = 0.25

    /* Which end of the track the reader has left by, if either.

       The down test is measured against the *stage*, not the far side of the
       track, and that is the whole of it. From p = 1 on, the sticky stage is
       held at the track's foot — `track.bottom` and the stage's bottom are the
       same number, and `track.bottom === stage height` is exactly the last
       frame of the dive. Testing "the track has gone" instead (`bottom < 0`)
       put the trigger a whole screen further down, past the stage's entire
       slide-off, and a reader who stopped anywhere inside that band never armed
       the exit at all — which is where you do stop, because it is where the
       next section first comes into view.

       That the stage travels with the track's foot is also what makes the
       collapse safe from here on: the stage and everything after the section
       move up by the height the track loses, so the one correction in
       setUnlocked covers both and nothing on screen appears to move. */
    function leftBy() {
        const rect = track.getBoundingClientRect()
        if (rect.top > window.innerHeight * EXIT_UP_MARGIN) return "up"
        if (rect.bottom < stage.clientHeight - window.innerHeight * EXIT_DOWN_MARGIN) return "down"
        return ""
    }

    /* Shutting the gate takes ~700vh of track out of the page, so it is done in
       an animation frame rather than inline in the scroll handler: rAF runs
       after that frame's scroll events and before style and layout, which is
       where a change of this size belongs, and several scroll events in one
       frame collapse the track once.

       It deliberately does *not* wait for the page to stop moving. An earlier
       version required `mainPage.scrollTop` to read the same value across eight
       consecutive frames, on the theory that collapsing under a running gesture
       is what tore the stage. That made the relock hostage to the reader
       pausing: turn round inside the window and the poll bailed without
       rescheduling, and since the only thing that could re-arm it was a fresh
       crossing, the gate then stayed open for good — scrolling back dropped the
       reader into the middle of the dive, which is the bug this replaced.
       Stillness was never what made the collapse safe; the scroll correction
       is, and it is exact everywhere the down exit can fire (see leftBy). */
    let exitFrame = 0

    function disarmExit() {
        if (!exitFrame) return
        cancelAnimationFrame(exitFrame)
        exitFrame = 0
    }

    function shutGate() {
        exitFrame = 0
        // Re-tested in the frame that does the work, not just in the one that
        // asked for it: a reader who crossed the edge and came straight back
        // never wanted the gate shut.
        if (isStatic || isLocked() || root.offsetParent === null || !leftBy()) return
        setUnlocked(false, { reposition: false })
    }

    function armExit() {
        if (!leftBy()) {
            disarmExit()
            return
        }
        if (exitFrame) return
        exitFrame = requestAnimationFrame(shutGate)
    }

    function render() {
        if (isStatic) return

        // Hidden means the other tab is showing. Drop the dark nav on the way
        // out — nothing else will, and it would stay black over a cream page.
        if (root.offsetParent === null) {
            mainPage.classList.remove("main-page--dark-zoom")
            disarmExit()
            return
        }

        if (isLocked()) {
            // The overlay is up: hold the picture at the start of the dive.
            // Painting it once is enough — nothing moves until it is opened.
            if (!atRest) {
                atRest = true
                paint(0)
            }
            disarmExit()
            return
        }

        atRest = false
        paint(progress())
        armExit()
    }

    function paint(p) {
        root.style.setProperty("--rz-progress", p.toFixed(4))

        /* How far through the pull-back, in its own 0 → 1. Everything the dive
           did is multiplied by (1 - surface), which runs the whole thing
           backwards without a second set of numbers to keep in step. */
        const outroSpan = 1 - scenesEnd
        const outro = outroSpan > 0 ? span(p, scenesEnd, 1) : 0
        const surface = easeInOut(clamp01(outro / OUTRO_SETTLE))

        /* Zoom. Geometric, not linear: what the eye reads as a steady rate of
           approach is a constant *ratio* per unit of scroll, so interpolating
           the scale itself spends the first half of the dive barely moving and
           then lurches. The ease is applied to the exponent instead. */
        const zoomT = easeInOut(span(p, 0.02, zoomEnd)) * (1 - surface)
        zoom.style.setProperty("--rz-scale", Math.pow(coverScale, zoomT).toFixed(3))

        // Black closes over the last stretch of the dive and lifts over the
        // first of the pull-back — the same fraction at both ends.
        const veil = span(p, zoomEnd * 0.72, zoomEnd) * (1 - clamp01(outro / OUTRO_VEIL_END))
        root.style.setProperty("--rz-veil", veil.toFixed(3))
        // Once black is total the eye has nothing left to contribute, and
        // leaving a 12× scaled bitmap composited costs a layer for nothing.
        zoom.style.visibility = veil >= 1 ? "hidden" : ""

        /* The rail runs on its own ramp rather than the veil's: up while there
           is still eye on screen, and still up after the eye has come back into
           it. See RAIL_* above. */
        const railIn = span(p, zoomEnd * RAIL_IN_START, zoomEnd * RAIL_IN_END) * (1 - span(outro, RAIL_OUT_START, RAIL_OUT_END))
        root.style.setProperty("--rz-rail-in", railIn.toFixed(3))

        const questionIn = span(p, zoomEnd * 0.16, zoomEnd * 0.34)
        const questionOut = span(p, zoomEnd * 0.62, zoomEnd * 0.86)
        question.style.setProperty("--rz-in", (questionIn * (1 - questionOut)).toFixed(3))
        question.style.setProperty("--rz-drift", questionIn.toFixed(3))

        hint.style.setProperty("--rz-in", (1 - span(p, 0.01, 0.05)).toFixed(3))

        /* Landmarks. Each rises out of the dark, holds, then passes the viewer
           — which is what makes the travel between them read as more zoom
           rather than as a slideshow. */
        let nextActive = -1
        let strongest = 0
        sceneNodes.forEach((scene, index) => {
            const start = zoomEnd + index * sceneSpan
            const local = span(p, start, start + sceneSpan)

            const enter = easeOut(span(local, 0, ENTER_END))
            // Every landmark leaves the same way, the last one included: the
            // pull-back needs the dark empty before the eye comes back into it.
            const exit = easeInOut(span(local, EXIT_START, 1))

            const opacity = enter * (1 - exit)
            scene.style.setProperty("--rz-in", opacity.toFixed(3))
            scene.style.setProperty("--rz-z", (lerp(0.82, 1, enter) * lerp(1, 1.42, exit)).toFixed(3))
            scene.style.setProperty("--rz-blur", (lerp(7, 0, enter) + lerp(0, 5, exit)).toFixed(2))

            // The film's own paragraphs, staggered against this landmark's
            // `local` rather than a timer — see FILM_TEXT_START above.
            const paragraphs = filmTexts[index]
            if (paragraphs) {
                paragraphs.forEach((paragraph, i) => {
                    const from = FILM_TEXT_START + Number(paragraph.dataset.slot || i) * FILM_TEXT_STEP
                    paragraph.style.setProperty("--rz-text-in", easeOut(span(local, from, from + FILM_TEXT_STEP)).toFixed(3))
                })
                /* How much of the landmark still belongs to the film alone.
                   The clip is dimmed to the point of being a ghost once four
                   paragraphs are sitting directly on it — which is what it has
                   to be, since nothing is between them — and that is how a
                   playing film came to be reported as one that never played.
                   So it is only dimmed once there is something to protect:
                   full strength through the beat before the first paragraph,
                   settling as that paragraph arrives. Keyed on `local` like
                   every other reveal here, so it scrubs in both directions. */
                const solo = 1 - easeOut(span(local, FILM_TEXT_START, FILM_TEXT_START + FILM_TEXT_STEP))
                scene.style.setProperty("--rz-film-solo", solo.toFixed(3))
            }

            // Held is about input: only the landmark actually facing the reader
            // may be clicked. The rail's highlight is a separate question — it
            // follows whichever is *most* present, so it does not blink off in
            // the dark between two landmarks.
            const held = opacity > 0.6
            scene.classList.toggle("rz-scene--held", held)
            /* Keyboard's half of the same gate. `pointer-events` has always
               kept the mouse out of a landmark on its way in; without this the
               tab order runs through every widget in the dive whatever is on
               screen, which the cloud made impossible to ignore — it alone
               contributes twenty-five links. Written only here, so the stacked
               fallback (where paint() never runs, and nothing is ever held)
               keeps every control it has. */
            if (scene.inert === held) scene.inert = !held
            if (opacity > strongest) {
                strongest = opacity
                nextActive = index
            }
        })

        /* The rail's line is the position readout: it fills across the landmark
           phase, which is the stretch the dots actually cover — scenesEnd, not
           1, or the last dot would sit short of a line that keeps filling
           through the pull-back. Continuous, so it moves with every scroll
           frame rather than stepping at each dot. */
        if (railTrack) {
            railTrack.style.setProperty("--rz-fill", span(p, zoomEnd, scenesEnd).toFixed(4))
        }

        if (nextActive !== activeIndex) {
            activeIndex = nextActive
            dots.forEach((dot, index) => dot.classList.toggle("rz-rail__dot--active", index === activeIndex))
            // The fill takes the colour of wherever it has reached.
            if (railTrack) {
                const accent = activeIndex >= 0 ? dots[activeIndex].style.getPropertyValue("--rz-accent") : ""
                railTrack.style.setProperty("--rz-accent", accent || "rgba(255, 255, 255, 0.8)")
            }
        }

        /* Progress is clamped to [0, 1], so past the end of the track it stays
           at 1 and the veil stays opaque — which would leave the nav dressed
           for a black section for the whole rest of the page. The stage's own
           rect is the thing that actually says whether the dark is on screen. */
        const stageRect = stage.getBoundingClientRect()
        const onScreen = stageRect.bottom > 0 && stageRect.top < window.innerHeight
        const dark = veil > 0.5 && onScreen
        root.classList.toggle("rz--dark", dark)
        mainPage.classList.toggle("main-page--dark-zoom", dark)
        // The rail now comes up before the dark does and outlasts it, so what
        // makes it clickable can no longer be `.rz--dark`. Same off-screen
        // guard though: past the end of the track --rz-progress is pinned at 1,
        // and nothing in here should stay hit-testable over the next section.
        root.classList.toggle("rz--rail", railIn > 0.4 && onScreen)
    }

    /* Jumping to a landmark means scrolling to the point in the track where its
       hold begins — the same maths render() reads, run backwards. */
    dots.forEach((dot, index) => {
        dot.addEventListener("click", () => {
            const range = track.offsetHeight - stage.clientHeight
            if (range <= 0) return
            const target = zoomEnd + (index + (ENTER_END + EXIT_START) / 2) * sceneSpan
            const top = track.getBoundingClientRect().top + mainPage.scrollTop + target * range
            mainPage.scrollTo({ top, behavior: "smooth" })
        })
    })

    function refresh() {
        syncGeometry()
        render()
    }

    /* ── The gate ──
     * The only thing it changes is the scroll budget. Locked, the track is one
     * stage tall, so the page carries that full screen of the eye past like any
     * other section; opening buys the ~700vh the dive is scrubbed through.
     * Nobody should be committed to that by scrolling towards it, but nor
     * should opening it rearrange the picture — the eye stays where it was, at
     * the scale it was.
     *
     * Repositioning is the one move that cannot be avoided: a sticky stage pins
     * to the top of the viewport the moment its track is taller than it is.
     * Snapping there is the smallest version of that — the eye covers the stage
     * either way, so all the reader sees leave is the section header.
     */
    function setUnlocked(open, options) {
        if (root.classList.contains("rz--unlocked") === open) return
        const reposition = !options || options.reposition !== false
        const refocus = !options || options.focus !== false

        disarmExit()

        /* Measured before anything moves. Everything after the track shifts by
           whatever its height changes by, so a reader who is already past its
           end has to be shifted with it — otherwise shutting the gate behind
           them yanks the page up by the whole scroll budget.

           "Past its end" is the track's foot reaching the stage's height, not
           the track leaving the screen: that is p = 1, and from there the
           sticky stage is pinned to the foot and travels with it, so the stage
           the reader is still looking at moves by the same delta as the content
           below. Anywhere the down exit can fire, this is true and the
           correction is exact. */
        const wasPast = track.getBoundingClientRect().bottom <= stage.clientHeight
        const heightBefore = track.offsetHeight
        // Read now, not after. Taking the track's height away shortens the page
        // under a scroll position that is past the new end of it, and the
        // browser clamps on the spot — read it back afterwards and the
        // correction is applied to a number that has already moved.
        const scrollBefore = mainPage.scrollTop

        root.classList.toggle("rz--unlocked", open)
        gateButton.setAttribute("aria-expanded", open ? "true" : "false")

        /* Reposition *before* re-measuring, not after. render() watches for the
           reader having left the track, and refreshing first would run that
           test against the old scroll position — pressing the button anywhere
           but exactly at the track's top would shut the gate on the same frame
           it opened. The track's own top in page coordinates does not depend on
           its height, so this target is good either side. Skipped entirely when
           the reader is leaving by scrolling out of the track: they are already
           where they want to be, and yanking them would fight it. */
        if (reposition) {
            // Instant: this is a mode change, and easing a jump of several
            // thousand pixels reads as a fault.
            mainPage.scrollTo({ top: track.getBoundingClientRect().top + mainPage.scrollTop, behavior: "instant" })
        }

        syncGeometry()

        if (!reposition && wasPast) {
            const delta = heightBefore - track.offsetHeight
            // scrollTop's setter honours the container's `scroll-behavior`,
            // which is smooth here — this correction has to be instant or the
            // page visibly slides the whole budget it was meant to hide.
            if (delta) mainPage.scrollTo({ top: scrollBefore - delta, behavior: "instant" })
        }

        render()
        if (reposition && refocus && !open) gateButton.focus({ preventScroll: true })
    }

    /* Leaving by the ✕ or Escape is a cut, deliberately. It is the way out for
       a reader who has decided they are done, and making them sit through a
       pull-back first would be the section arguing. The one that *is* animated
       is the end of the track, which is scrubbed like everything else. */
    gateButton.addEventListener("click", () => setUnlocked(true))
    if (close) close.addEventListener("click", () => setUnlocked(false))

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !root.classList.contains("rz--unlocked")) return
        // Only while the zoom is the thing on screen — otherwise Escape
        // anywhere on the page would collapse a section nobody is looking at.
        const rect = stage.getBoundingClientRect()
        if (rect.bottom <= 0 || rect.top >= window.innerHeight) return
        setUnlocked(false)
    })

    /* In-page anchors are the one thing that can be mid-scroll while the gate
       shuts. The nav links and the FABs are plain `#fragment` hrefs, so the
       browser — not this module — does the scrolling, and it resolves the
       target's offset once, when the navigation starts. Collapse the track
       during that flight and the offset it recorded is stale by the whole
       scroll budget: the reader is carried ~700vh too far, to the foot of the
       page. Nothing here can re-target it afterwards.

       So the gate is shut in the click instead, and the browser then measures
       the target against the collapsed layout — correct by construction rather
       than by out-waiting an animation nobody owns. Capture phase, because the
       guarantee is "the layout is settled before anything reads it" and other
       listeners (script.js opens the Information tabs off these same links)
       must not get to measure first.

       It does mean a nav link pressed mid-dive leaves the zoom. That is the
       call `#fab-research-creations` already makes: the reader asked to be
       somewhere else, and the section should not argue. Static mode is exempt — nothing
       collapses asynchronously there, so there is no stale offset to prevent
       and no reason to throw the reader out of the stack. */
    document.addEventListener(
        "click",
        (event) => {
            if (isStatic || isLocked()) return
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
            const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null
            // A bare "#" scrolls nowhere, so there is no offset to protect.
            if (!link || link.getAttribute("href") === "#") return
            // focus: false — the reader pressed the link, and that is where
            // their focus belongs.
            setUnlocked(false, { focus: false })
        },
        true,
    )

    mainPage.addEventListener("scroll", render, { passive: true })
    window.addEventListener("resize", refresh)
    if (typeof ResizeObserver !== "undefined") new ResizeObserver(refresh).observe(stage)

    // naturalWidth is 0 until the file lands, and the cover fit above depends
    // on it — without this the pupil is placed against the fallback ratio and
    // the zoom drifts off-centre for the first visitor of every cold cache.
    if (image.complete) refresh()
    image.addEventListener("load", refresh)
    image.addEventListener("error", () => {
        root.classList.add("rz--no-image")
        refresh()
    })

    refresh()

    return {
        refresh,
        // No focus grab: this is the tab going away, and the reader's focus
        // belongs to whatever they just pressed.
        lock: () => setUnlocked(false, { focus: false }),
    }
}
