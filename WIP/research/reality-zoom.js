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

function el(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text != null) node.textContent = text
    return node
}

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

/* The lab's own diagram: Reality above, its two aspects below, and the body
   feeding into both. Drawn rather than shipped as an image so the strokes can
   be animated on arrival. */
function buildMapFigure() {
    const wrap = el("div", "rz-fig rz-fig--map")
    const root = svg("svg", { viewBox: "0 0 420 330", class: "rz-map", role: "img", "aria-label": "Reality, its two aspects, and the body" })

    const defs = svg("defs", {})
    const glow = svg("radialGradient", { id: "rz-map-glow" })
    glow.appendChild(svg("stop", { offset: "0", "stop-color": "#7fa8ff", "stop-opacity": "0.5" }))
    glow.appendChild(svg("stop", { offset: "1", "stop-color": "#7fa8ff", "stop-opacity": "0" }))
    defs.appendChild(glow)

    /* Arrowheads. marker-end is set from the stylesheet, but the marker itself
       has to live in the document, and its fill cannot be inherited through a
       marker — hence the colour twice. */
    ;[
        { id: "rz-arrow-body", fill: "rgba(255, 95, 87, 0.75)" },
        { id: "rz-arrow-control", fill: "rgba(85, 153, 255, 0.75)" },
    ].forEach(({ id, fill }) => {
        const marker = svg("marker", {
            id,
            viewBox: "0 0 10 10",
            refX: "8",
            refY: "5",
            markerWidth: "5",
            markerHeight: "5",
            orient: "auto-start-reverse",
        })
        marker.appendChild(svg("path", { d: "M 0 1 L 9 5 L 0 9 z", fill }))
        defs.appendChild(marker)
    })

    root.appendChild(defs)

    root.appendChild(svg("circle", { cx: "210", cy: "62", r: "95", fill: "url(#rz-map-glow)" }))

    const arrows = [
        { d: "M 118 268 L 150 172", accent: "body" },
        { d: "M 118 268 L 270 172", accent: "body" },
        { d: "M 302 268 L 270 172", accent: "control" },
        { d: "M 302 268 L 150 172", accent: "control" },
    ]
    arrows.forEach(({ d, accent }, index) => {
        const path = svg("path", { d, class: "rz-map__arrow rz-map__arrow--" + accent })
        path.style.setProperty("--rz-arrow-index", String(index))
        root.appendChild(path)
    })

    const nodes = [
        { x: 210, y: 62, w: 132, h: 56, label: "Reality", cls: "reality" },
        { x: 150, y: 158, w: 116, h: 46, label: "Perception", cls: "aspect" },
        { x: 270, y: 158, w: 116, h: 46, label: "Beliefs", cls: "aspect" },
        { x: 118, y: 286, w: 132, h: 44, label: "Body & Emotions", cls: "body" },
        { x: 302, y: 286, w: 132, h: 44, label: "Cognitive Control", cls: "control" },
    ]
    nodes.forEach(({ x, y, w, h, label, cls }, index) => {
        const group = svg("g", { class: "rz-map__node rz-map__node--" + cls })
        group.style.setProperty("--rz-node-index", String(index))
        group.appendChild(svg("rect", { x: x - w / 2, y: y - h / 2, width: w, height: h, rx: cls === "reality" ? 10 : 6 }))
        const text = svg("text", { x, y: y + 5, "text-anchor": "middle" })
        text.textContent = label
        group.appendChild(text)
        root.appendChild(group)
    })

    wrap.appendChild(root)
    return wrap
}

/* Ponzo. The two bars are the same element size — the only difference between
   them is the converging rails, which the button takes away. */
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

    const button = el("button", "rz-fig__button", config.toggleOn || "Remove the context")
    button.type = "button"
    button.addEventListener("click", () => {
        const off = wrap.dataset.context === "off"
        wrap.dataset.context = off ? "on" : "off"
        button.textContent = off ? config.toggleOn : config.toggleOff
    })
    wrap.appendChild(button)

    if (config.caption) wrap.appendChild(el("p", "rz-fig__caption", config.caption))
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

    if (config.prompt) wrap.appendChild(el("p", "rz-fig__prompt", config.prompt))

    const grid = el("div", "rz-artworks")
    const cards = (config.works || []).map((work, index) => {
        const card = el("button", "rz-artworks__card")
        card.type = "button"
        card.dataset.picked = "false"
        // Staggers the reveal across the pair rather than flashing both at once.
        card.style.setProperty("--rz-card-index", String(index))

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
        card.appendChild(el("span", "rz-artworks__verdict", work.verdict || ""))

        card.addEventListener("click", () => {
            cards.forEach((other) => (other.dataset.picked = String(other === card)))
            setRevealed(true)
        })
        grid.appendChild(card)
        return card
    })
    wrap.appendChild(grid)

    wrap.appendChild(el("p", "rz-fig__caption rz-fig__caption--reveal", config.reveal))

    const button = el("button", "rz-fig__button", config.button || "Reveal")
    button.type = "button"
    button.addEventListener("click", () => setRevealed(wrap.dataset.revealed !== "true"))
    wrap.appendChild(button)

    // Declared, not assigned: the card listeners above are built before this
    // point but only ever run after it.
    function setRevealed(on) {
        wrap.dataset.revealed = on ? "true" : "false"
        button.textContent = on ? config.reset || "Again" : config.button || "Reveal"
        if (!on) cards.forEach((card) => (card.dataset.picked = "false"))
    }

    return wrap
}

/* The heart–brain loop: one cardiac cycle drawn as a ring that fills, a heart
   that contracts inside it, and the burst that leaves the baroreceptors on the
   pressure wave and arrives at the brainstem. Everything is on the *same* CSS
   cycle — `--rz-cycle` is the only timing in it — so the ejection, the burst
   and the ring's systolic arc cannot drift apart however long it runs.
   Deliberately a loop rather than something the reader scrubs: the claim is
   that this happens on every beat whether or not anyone is watching, and the
   one control slows it down far enough to read the order of events. */
function buildHeartBrainFigure(config) {
    const wrap = el("div", "rz-fig rz-fig--heartbrain")
    wrap.dataset.speed = "normal"

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

            <g class="rz-hb__ring" transform="translate(160 208) rotate(-90)">
                <circle class="rz-hb__arc rz-hb__arc--dia" r="60"/>
                <circle class="rz-hb__arc rz-hb__arc--sys" r="60"/>
                <circle class="rz-hb__sweep" r="60"/>
            </g>
            <g class="rz-hb__hand"><circle cx="0" cy="-60" r="3.6"/></g>

            <path class="rz-hb__heart" d="M 160 230 C 130 212 132 190 147 186 C 155 184 160 190 160 195 C 160 190 165 184 173 186 C 188 190 190 212 160 230 Z"/>

            <text class="rz-hb__tag rz-hb__tag--brain" x="160" y="12" text-anchor="middle">Brain</text>
            <text class="rz-hb__tag rz-hb__tag--baro" x="98" y="140" text-anchor="end">Baroreceptors</text>
            <text class="rz-hb__tag rz-hb__tag--sys" x="228" y="176">Systole</text>
            <text class="rz-hb__tag rz-hb__tag--dia" x="92" y="248" text-anchor="end">Diastole</text>
        </svg>`),
    )

    const button = el("button", "rz-fig__button", config.slow || "Slow it down")
    button.type = "button"
    button.addEventListener("click", () => {
        const slow = wrap.dataset.speed === "slow"
        wrap.dataset.speed = slow ? "normal" : "slow"
        button.textContent = slow ? config.slow || "Slow it down" : config.normal || "Normal speed"
    })
    wrap.appendChild(button)

    if (config.caption) wrap.appendChild(el("p", "rz-fig__caption", config.caption))
    return wrap
}

const FIGURE_BUILDERS = {
    map: buildMapFigure,
    ponzo: buildPonzoFigure,
    artworks: buildArtworksFigure,
    heartbrain: buildHeartBrainFigure,
}

/* ── Assembly ── */

/* Which side the figure sits on comes from :nth-child in the stylesheet, so a
   landmark's position in the list is the only thing that decides it. */
function buildLandmark(landmark) {
    const scene = el("article", "rz-scene")
    scene.id = "rz-scene-" + landmark.id
    scene.dataset.landmark = landmark.id
    scene.style.setProperty("--rz-accent", landmark.accent || "#5599ff")

    const copy = el("div", "rz-scene__copy")
    if (landmark.eyebrow) copy.appendChild(el("p", "rz-scene__eyebrow", landmark.eyebrow))
    if (landmark.title) copy.appendChild(el("h3", "rz-scene__title", landmark.title))
    if (landmark.text) copy.appendChild(el("p", "rz-scene__text", landmark.text))
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
        figure.appendChild(builder(landmark.figure))
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
    /* By the last landmark the tab buttons are a whole track above, so the rail
       carries the way on to the other tab. Its label and target are filled in
       by research.js, which owns the tabs. */
    const exit = el("button", "rz-rail__exit")
    exit.type = "button"
    rail.appendChild(exit)

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

    return { root, track, stage, zoom, image, question, sceneNodes, rail, railTrack, dots, exit, close, gateButton, hint, count: landmarks.length }
}

/* ── The driver ── */

export function initRealityZoom(parts, mainPage) {
    const { root, track, stage, zoom, image, question, sceneNodes, railTrack, dots, close, gateButton, hint } = parts
    if (!root || !mainPage) return null

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

            // Held is about input: only the landmark actually facing the reader
            // may be clicked. The rail's highlight is a separate question — it
            // follows whichever is *most* present, so it does not blink off in
            // the dark between two landmarks.
            scene.classList.toggle("rz-scene--held", opacity > 0.6)
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
       call `.rz-rail__exit` already makes: the reader asked to be somewhere
       else, and the section should not argue. Static mode is exempt — nothing
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
