import { CREATIONS_TAB } from "./creations-content.js"

/* Two tabs only: Overview and Creations.
 *
 * Overview is not a card layout — it is the scroll-driven zoom in
 * reality-zoom.js. Its `landmarks` are the stations that zoom passes through,
 * in order: the eye opens onto a map of the lab's question, then each aspect of
 * it in turn. `figure.type` names a builder in reality-zoom.js; adding a
 * landmark here without adding its builder there renders the text alone rather
 * than failing.
 *
 * Creations lives in creations-content.js — the two tabs have nothing to say to
 * each other, and the zoom's landmarks are long enough that anything after them
 * in this file would only ever be scrolled past. `tabs` stays the single list
 * of what the section shows. */
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
                    title: "How is reality constructed?",
                    short: "The question",
                    accent: "#8fb7ff",
                    text: "Everything you take to be real is a construction assembled from noisy sensations, filtered through a brain with deeply seated prior expectations, gathered with a body that never stops reporting on itself.",
                    // note: "Two aspects. One modulator.",
                    figure: { type: "map" },
                },
                {
                    id: "illusions",
                    eyebrow: "Perception of Reality",
                    title: "Illusions",
                    accent: "#5599ff",
                    text: "An illusion is not a failure of the visual system. It is the system working exactly as designed, showing its assumptions out loud. We use them as instruments: measure how strongly a person's perception is biased, and you have measured something about how they build the world.",
                    tags: ["Illusion sensitivity", "Phenomenological Control", "Computational modelling"],
                    /* question → answer → question, on one button. The three
                       interactive landmarks all take these same keys, so the
                       reader meets one control rather than three. */
                    figure: {
                        type: "ponzo",
                        question: "Which of the two lines is the longest?",
                        answer: "Both lines are actually the same.",
                        button: "Show answer",
                        reset: "Reset",
                    },
                },
                {
                    id: "beliefs",
                    eyebrow: "Beliefs of Reality",
                    title: "What if it was AI-Generated?",
                    // The rail's labels are nowrap, and this title is a whole
                    // question — without a `short` the rail would be as wide as
                    // the stage.
                    short: "AI-Beliefs",
                    accent: "#a98bff",
                    text: "The same work lands differently once you believe a machine made it. Believing something is artificial changes how true, how moving, and how valuable it feels — before anything about it is looked at again. We study that belief as a lens sitting between people and everything they now encounter online.",
                    tags: ["Trust & deception", "Fake news", "Human-AI interaction"],
                    /* Both paintings are human. The first is the one people
                       reliably call AI, the second the one they call human —
                       which is the demonstration: the judgement tracks the
                       impression, not the provenance. */
                    figure: {
                        type: "artworks",
                        works: [
                            {
                                src: "research/img/art_fake.jpg",
                                alt: "A painting that viewers reliably judge to be AI-generated",
                                truth: "Human",
                            },
                            {
                                src: "research/img/art_real.jpg",
                                alt: "A painting that viewers reliably judge to be human-made",
                                truth: "Human",
                            },
                        ],
                        question: "Which of these 2 images was AI-generated?",
                        answer: "Neither. Both were painted by people. But what made you select that one?",
                        button: "Show answer",
                        reset: "Reset",
                    },
                },
                {
                    id: "body",
                    eyebrow: "Potential mechanisms",
                    title: "Body & Emotions",
                    accent: "#ff5f57",
                    text: "Neither perception nor belief formation runs in a vacuum. A heartbeat, a held breath, a rising sweat response: the body's state biases what gets seen and what gets believed. We record the body while reality bends, and model both together.",
                    tags: ["Interoception", "Emotion Regulation", "Brain-Body Axis"],
                    /* No reveal to make here — the loop is the point, and it
                       runs whether or not anyone presses anything, so there is
                       nothing to caption either. The button is a placeholder
                       for the interoception test, and says so when pressed. */
                    figure: {
                        type: "heartbrain",
                        question: "Are you good at feeling your body?",
                        button: "Take our interoception test (5min)",
                        soon: "In construction",
                    },
                },
                {
                    /* The last station, and the only one that is a list rather
                       than a demonstration: these are the lab's other lines of
                       work, and the point is their breadth. `strands` is the
                       builder for it.

                       A strand is `mark`, `name`, `text`, and an optional
                       `link` — somewhere to see the work, since a list is the
                       one landmark with nothing to press. It shows as "See
                       example" unless the strand gives its own `linkLabel`. */
                    id: "beyond",
                    eyebrow: "Also in the lab",
                    title: "Other interests",
                    short: "And more",
                    accent: "#33cccc",
                    text: "Reality is the thread, not the fence around it. The same instruments reach into who the perceiver is underneath, into how any of this can be measured in the first place, and into what a mind does standing in front of a painting — and none of it counts for much unless other people can check it.",
                    figure: {
                        type: "strands",
                        items: [
                            {
                                mark: "self",
                                name: "Deep Self",
                                text: "The mechanisms underneath: understanding and measuring what actually drives how we perceive and behave in the world.",
                                link: "https://osf.io/preprints/psyarxiv/9pequ_v2",
                            },
                            {
                                mark: "assess",
                                name: "Assessment",
                                text: "We develop innovative neuropsychological instruments like tasks and questionnaires for interoception, cognitive control and the Self.",
                            },
                            {
                                mark: "art",
                                name: "Neuroaesthetics",
                                text: "Beauty, awe, and the sublime: how the brain responds to art.",
                            },
                            {
                                mark: "open",
                                name: "Metascience and Open Science",
                                text: "We're highly committed to improving science practices by studying them and leading the revolution!",
                            },
                        ],
                    },
                },
            ],
        },
        CREATIONS_TAB,
    ],
})
