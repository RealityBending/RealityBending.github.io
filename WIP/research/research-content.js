/* Two tabs only: Overview and Discoveries.
 *
 * Overview is not a card layout — it is the scroll-driven zoom in
 * reality-zoom.js. Its `landmarks` are the stations that zoom passes through,
 * in order: the eye opens onto a map of the lab's question, then each aspect of
 * it in turn. `figure.type` names a builder in reality-zoom.js; adding a
 * landmark here without adding its builder there renders the text alone rather
 * than failing. */
export const RESEARCH_CONTENT = Object.freeze({
    title: "Research",
    tabs: [
        {
            id: "overview",
            label: "Overview",
            kind: "reality-zoom",
            question: "What is Reality?",
            hint: "Scroll to look closer",
            /* The zoom is opt-in. Until the section is clicked it is a full
               screen of the eye with this one line over it, and the page
               scrolls straight past. The whole overlay is the button. */
            gate: { label: "Click to discover our research" },
            landmarks: [
                {
                    id: "map",
                    eyebrow: "The question",
                    title: "Reality is not given. It is built.",
                    short: "The question",
                    accent: "#8fb7ff",
                    text: "Everything you take to be real is a construction — assembled from noisy senses, prior expectations, and a body that never stops reporting on itself. We study that construction where it is most revealing: at the points where it bends.",
                    note: "Two aspects. One modulator.",
                    figure: { type: "map" },
                },
                {
                    id: "illusions",
                    eyebrow: "Aspect I — Perception",
                    title: "Illusions",
                    accent: "#5599ff",
                    text: "An illusion is not a failure of the visual system. It is the system working exactly as designed, showing its assumptions out loud. We use them as instruments: measure how strongly a person's perception is pulled by context, and you have measured something about how they build the world.",
                    tags: ["Psychophysics", "Illusion sensitivity", "Eye tracking", "Computational modelling"],
                    figure: {
                        type: "ponzo",
                        caption: "The two red bars are identical. Take the rails away and you can see it.",
                        toggleOn: "Remove the context",
                        toggleOff: "Put the context back",
                    },
                },
                {
                    id: "beliefs",
                    eyebrow: "Aspect II — Beliefs",
                    title: "AI-Beliefs",
                    accent: "#a98bff",
                    text: "The same work lands differently once you believe a machine made it. Believing something is artificial changes how true, how moving, and how valuable it feels — before anything about it is looked at again. We study that belief as a lens sitting between people and everything they now encounter online.",
                    tags: ["Authorship beliefs", "Trust & deception", "Fake news", "Human–AI interaction"],
                    /* Both paintings are human. The first is the one people
                       reliably call AI, the second the one they call human —
                       which is the demonstration: the judgement tracks the
                       impression, not the provenance. */
                    figure: {
                        type: "artworks",
                        prompt: "One of these was made by AI. Which one?",
                        works: [
                            {
                                src: "research/img/art_fake.jpg",
                                alt: "A painting that viewers reliably judge to be AI-generated",
                                verdict: "Usually judged AI",
                                truth: "Human",
                            },
                            {
                                src: "research/img/art_real.jpg",
                                alt: "A painting that viewers reliably judge to be human-made",
                                verdict: "Usually judged human",
                                truth: "Human",
                            },
                        ],
                        reveal: "Neither. Both were painted by people — only the impression differed.",
                        button: "Reveal",
                        reset: "Again",
                    },
                },
                {
                    id: "body",
                    eyebrow: "The modulator",
                    title: "Body & Emotions",
                    accent: "#ff5f57",
                    text: "Neither perception nor belief runs in a vacuum. A heartbeat, a held breath, a rising sweat response — the body's state biases what gets seen and what gets believed, and cognitive control decides how much of that bias survives. We record the body while reality bends, and model both together.",
                    tags: ["ECG & interoception", "Electrodermal activity", "EEG", "Cognitive control"],
                    figure: {
                        type: "heartbrain",
                        caption: "Every beat: the ejection sends a pressure wave, the baroreceptors fire, and the brain is told what the body has just done.",
                        slow: "Slow it down",
                        normal: "Normal speed",
                    },
                },
            ],
        },
        {
            id: "discoveries",
            label: "Discoveries",
            eyebrow: "Findings + Creations",
            heading: "What the lab has found and what it has built",
            lede: "Empirical results on one side, the instruments and open-source tools built to get them on the other. This tab is still being filled in.",
            cards: [
                {
                    meta: "Found",
                    title: "What moves the felt sense of reality",
                    text: "Placeholder for concise findings on perception, illusion sensitivity, belief, confidence, and bodily state.",
                },
                {
                    meta: "Created",
                    title: "Measures, tasks, and paradigms",
                    text: "Placeholder for scales, experimental paradigms, and conceptual frameworks produced by the lab.",
                },
                {
                    meta: "Shared",
                    title: "Open-source software",
                    text: "Placeholder for the packages and public resources the lab maintains for neuropsychological science.",
                },
            ],
        },
    ],
})
