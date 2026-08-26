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
                    short: "The question",
                    accent: "#8fb7ff",
                    /* ── No eyebrow, no title ──
                       This landmark used to carry both — "The question" over
                       "How is reality constructed?" — which read as a slide with
                       a headline rather than a film with subtitles. The question
                       itself moved to the last landmark, where it lands as the
                       resting title of the whole dive; what is left here is the
                       film and the four paragraphs, arriving one at a time on
                       their own with nothing captioning them first. `short`
                       survives alone, for the rail label only.

                       ── The film behind this one ──
                       `background` is a landmark-level video layer, and this is
                       the only landmark that has one. It is feathered into the
                       dark rather than bled across the stage, for a reason that
                       is about the source and not about taste: the clip is
                       540 × 360, so a modest upscale is what archival footage
                       carries and a stage-wide one is mush. The mask is what
                       stops a contained video reading as a boxed-in clip.
                       **Its box states its own size and keeps the clip's 3:2**
                       rather than stretching to the scene — see
                       `.rz-scene__film`, where stretching it is what made this
                       film invisible once the landmark lost its figure.

                       ── It is a picture, not a `<video>`, and that is the point ──
                       It was two `<video>` encodes fetched and started by an
                       `armSceneFilm` that watched for the gate. Everything about
                       that worked and it was still reported, twice, as a film
                       that never played — because a `<video>` has a queue of ways
                       to end up showing one dark frame that no amount of CSS can
                       reach: an autoplay policy that refuses `play()`, Chrome's
                       power-pause for media with no audio track, a `preload`
                       that leaves the fetch suspended, and this section's own
                       `--rz-mode` gate, which withholds the film entirely under
                       reduced motion. An animated image has none of them. It
                       decodes and runs wherever an `<img>` would, so there is no
                       failure mode left to diagnose.

                       **Animated WebP rather than GIF**, which is what was asked
                       for and is the same idea: 687 KB at the source's full
                       540 × 360 and 15fps, against 3 MB for a GIF that had to
                       drop to 360px, 10fps and 32 colours to get that far —
                       1896 film grain defeats a GIF's frame-delta compression.
                       Support is Chrome 32 / Firefox 65 / Safari 14, which is
                       wider than several things this page already requires.

                       `still` is the same clip's strongest frame, and it is what
                       the stacked branch and reduced motion get instead of the
                       loop — 13 KB, and a landmark that used to open on a phone
                       with no picture at all. The paths are declared here rather
                       than in the stylesheet for the reason the Creations plate
                       is: a `url()` in `css/` resolves against that folder, and
                       these go through `<base>` instead. */
                    background: {
                        image: "research/img/train_ciotat_loop.webp",
                        still: "research/img/train_ciotat_still.jpg",
                    },
                    text: [
                        "In 1896, the Lumière brothers presented a 50-seconds long movie of a train's arrival at a station.",
                        "Intense fear and awe rose up among the audience, as if they could not believe that it was not a real train.",
                        "Several decades later, the edges of our reality still continue to fade...",
                        /* `pause` is a beat held open before this paragraph — in the
                           space above it and in the stagger alike. The line before it
                           ends on an ellipsis, which is a hanging sentence; a
                           paragraph arriving right behind it at the same cadence and
                           the same gap closes it off instead of letting it hang. See
                           `buildLandmark`, which counts a pause as one slot of
                           `FILM_TEXT_STEP`. */
                        {
                            pause: true,
                            text: "Through virtual and augmented reality, AI-generated deep fakes, interactions with artificial agents and new forms of fictions, simulations of all kind populate our everyday experience and challenge our intuitive feeling and belief of reality.",
                        },
                        "This is what we study.",
                    ],
                },
                {
                    id: "illusions",
                    eyebrow: "Perception of Reality",
                    title: "Illusions",
                    accent: "#5599ff",
                    text: "An illusion is not a failure of the visual system. It is the system working exactly as designed, showing its assumptions out loud. We use them as instruments: measure how strongly a person's perception is biased, and you have measured something about how they build the world.",
                    tags: [
                        "Illusion sensitivity",
                        "Phenomenological Control",
                        "Computational modelling",
                    ],
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
                    text: 'We react to the same thing differently if we believe it is "fake". Believing something is artificial or synthetic changes how true, how moving, and how valuable it feels. We study the effect of believing that something is real or not, as well as the neurocognitive and bodily mechanisms that drive the formation of these beliefs.',
                    tags: [
                        "Trust & deception",
                        "Fake news",
                        "Human-AI interaction",
                    ],
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
                        answer: "Neither, both were painted by people. But the question is: what made you select that one?",
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
                    tags: [
                        "Interoception",
                        "Emotion Regulation",
                        "Brain-Body Axis",
                    ],
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
                    /* ── Metascience ──
                       Carried over from the old site, where it was the third of
                       three research themes — "travelling in the past and
                       charting the future of neuropsychology", in three parts:
                       history and philosophy, data analysis and statistics,
                       methods and tools. The first pass at this section
                       compressed all of that into "old instruments are
                       interesting", which is a much smaller idea.

                       It earns a station rather than a tile in the list below,
                       because it is not another *topic*: it is a stance about
                       how to do any of the others. The three old sub-themes are
                       the three tags — the paragraphs make the argument and the
                       tags name its parts, rather than the landmark growing
                       three headings it has no room for.

                       The figure is the timeline: five centuries of asking the
                       same questions with whatever was to hand, ending on a
                       station that is deliberately empty. */
                    id: "metascience",
                    eyebrow: "Metascience",
                    title: "Past & Future",
                    short: "Metascience",
                    accent: "#c9a227",
                    text: [
                        "Neuropsychology and its connected fields are an evolving science with a long history and an unfinished future. We believe that in order to better understand where we are, and how to move forward, we must know and study the past. We are interested in exploring the roots of our current theories, excavating ancient perspectives that resonate with today's interpretations. Moreover, we are committed to contributing to the future of psychological science by developing new methods, tools, and approaches that can advance our understanding of the mind and brain.",
                    ],
                    tags: [
                        "History & philosophy",
                        "Statistics & open tools",
                        "Methods & instruments",
                    ],
                    /* ── The deck's cards ──
                       A card is `img` — a path from the site root,
                       `research/img/era-<id>.jpg`, cropped to the deck's 4:3 at
                       900 × 675 / q82 (see the size budget in CLAUDE.md) — plus
                       an `id` saying which picture it is, and `art`, the name of
                       a drawing in ERA_ARTS (reality-zoom.js) used only if the
                       picture is ever missing.

                       **There is no per-card text, and that is deliberate.** The
                       cards used to carry a year, a name, a sentence and a
                       credit; all four were labels for a picture the reader can
                       already see, and the sequence says "this kept changing" on
                       its own. The argument lives in the landmark's `text` above.

                       **The order is the argument, and the last card is the
                       point of it**: a line of instruments that each looked
                       definitive, ending on this lab's own bench. Nothing may be
                       appended after `lab` without changing what the run says.

                       `title`, `artist` and `year` are the legend, shown only
                       for the card the reader is pointing at, and they are also
                       that card's accessible name. **`artist` and `year` are
                       both optional and two cards genuinely have neither**: a
                       phrenological chart and a catalogue engraving of a
                       chronoscope are anonymous works, and inventing an
                       attribution for either would be worse than a short line.
                       The year is the *picture's*, not the era's — Robert-Fleury
                       painted 1795 in 1876 — because a date under a painting is
                       read as that painting's date. That distinction is why the
                       era years the timeline used to stamp on the frame are gone
                       rather than reused. */
                    figure: {
                        type: "era",
                        stations: [
                            {
                                id: "folly",
                                art: "folly",
                                img: "research/img/era-folly.jpg",
                                title: "The Cure of Folly",
                                artist: "Hieronymus Bosch",
                                year: "c. 1500",
                            },
                            {
                                id: "pinel",
                                art: "pinel",
                                img: "research/img/era-pinel.jpg",
                                title: "Pinel Freeing the Insane at the Salpêtrière",
                                artist: "Tony Robert-Fleury",
                                year: "1876",
                            },
                            {
                                // Anonymous, and the specific chart this scan
                                // came from is not known — see the note above.
                                id: "phrenology",
                                art: "phrenology",
                                img: "research/img/era-phrenology.jpg",
                                title: "Phrenological chart of the faculties",
                                year: "19th century",
                            },
                            {
                                id: "charcot",
                                art: "charcot",
                                img: "research/img/era-charcot.jpg",
                                title: "A Clinical Lesson at the Salpêtrière",
                                artist: "André Brouillet",
                                year: "1887",
                            },
                            {
                                /* Galvani's bimetallic arc, from an anonymous
                                   19th-century textbook plate ("Fig. 208.
                                   Expérience de la patte de grenouille…"). Placed
                                   after Charcot rather than by date — it is 1791,
                                   a century before the Salpêtrière lesson —
                                   because the *argument* groups the three
                                   observational plates first (the two madness
                                   paintings and the phrenological chart, each a
                                   reading taken from the outside) and only then
                                   turns to the body's own electricity, which is
                                   what the last two cards carry forward: an
                                   instrument recording it (Wundt's laboratory)
                                   and this lab still doing so. */
                                id: "galvanoscope",
                                img: "research/img/era-galvanoscope.jpg",
                                title: "Galvani's frog-leg experiment",
                                year: "19th century",
                            },
                            {
                                /* The room, not the instrument. It was a trade
                                   engraving of a bare chronoscope; this is
                                   Wundt's own laboratory with the apparatus on
                                   the table and the man himself in it, which is
                                   what the station was always claiming.
                                   Photographer and date both unknown — the plate
                                   is widely reproduced and loosely dated, and a
                                   year I cannot stand behind is exactly what the
                                   note above says not to print. */
                                id: "wundt",
                                art: "chronoscope",
                                img: "research/img/era-wundt.jpg",
                                title: "Wundt's laboratory in Leipzig",
                            },
                            {
                                id: "lab",
                                art: "eeg",
                                img: "research/img/era-lab.jpg",
                                title: "Multimodal EEG and Physiological recording",
                                artist: "Reality Bending Lab",
                            },
                        ],
                    },
                },
                {
                    /* ── The last landmark: the whole vocabulary ──
                       It was four tiles of "other interests" under a paragraph
                       that never changed, then briefly a nine-node network. It
                       is the word cloud now, moved here from the opening
                       landmark — which gave it up to the Lumière film — and the
                       reason it came back rather than staying a network is
                       simply **count**: the cloud carries twenty-six words where
                       the ring could only carry nine and stay legible, and the
                       point of this landmark is how far the question reaches.

                       **The tiles were merged in, not discarded.** Three of the
                       four (Deep Self, Neuroaesthetics, Open Science) were
                       already words here, so their paragraphs became `about` on
                       the word that already existed; only Assessment needed a
                       word of its own. Nothing was duplicated.

                       ── What a word can carry ──
                       `text` is the word itself and `size` is the box the packer
                       measures (see the note in reality-zoom.js — it is length,
                       not importance). Then, all optional:
                         `about`  prose, shown as the landmark's paragraph
                         `paper`  { title, cite, doi } — becomes the paragraph
                                  when there is no `about`, and always the link
                         `tab`    another tab of this section, for a word whose
                                  answer is the lab's own shelf rather than a
                                  publication
                         `link`   { href, label } — an arbitrary off-site link,
                                   for a word whose answer is neither a paper nor
                                   this section's own shelf (Neuroaesthetics'
                                   comic). Takes the one link slot over `paper`
                                   and `tab` when present.
                       A word with none of the four is drawn but not pointable.
                       **Pointing at one rewrites the heading and the paragraph
                       above**, so a word's `text` is also a heading: keep it
                       short, and note that the longest of them is what the
                       heading reserves its height against. */
                    id: "beyond",
                    eyebrow: "Themes",
                    /* The question the whole dive opened on, and never named
                       again until now. It used to sit as the opening landmark's
                       own title, over the Lumière film; moved here it is what
                       the question was building towards, landing as the resting
                       heading over the full vocabulary that answers it. `short`
                       keeps the rail label the title itself is too long for. */
                    title: "How is reality constructed?",
                    short: "And more",
                    accent: "#33cccc",
                    /* The resting paragraph, and the one place the lab's own
                       summary of itself survives: this is the opening landmark's
                       first paragraph, which the Lumière text displaced. It is
                       what the heading and paragraph fall back to whenever the
                       reader is not pointing at a word. */
                    text: "Our experience of reality is built from noisy senses, acquired by a body in a particular state, filtered through a cascade of prior expectations. We study the mechanisms that lead to its distortion, and explore what reality alterations tell us about our Selves.",
                    figure: {
                        type: "cloud",
                        dimensions: [
                            {
                                text: "Interoception",
                                tone: "body",
                                size: 17,
                                paper: {
                                    title: "Mega-analysis of the Interoceptive Accuracy Scale (IAS) Structure and its Dispositional Correlates",
                                    cite: "Neves et al., 2026",
                                    doi: "10.31234/osf.io/2mpqd_v5",
                                },
                            },
                            {
                                text: "Emotions",
                                tone: "body",
                                size: 18,
                                paper: {
                                    title: "Phenomenal, bodily and brain correlates of fictional reappraisal as an implicit emotion regulation strategy",
                                    cite: "Makowski et al., 2019",
                                    doi: "10.3758/S13415-018-00681-0",
                                },
                            },
                            {
                                text: "Bodily States",
                                tone: "body",
                                size: 17,
                                paper: {
                                    title: "Which Heart Rate Variability (HRV) Indices Should I Use for Psychophysiological Research? A Data-Driven Answer",
                                    cite: "Pham et al., 2025",
                                    doi: "10.1111/psyp.70164",
                                },
                            },
                            {
                                text: "Cognitive Control",
                                tone: "control",
                                size: 16,
                                paper: {
                                    title: "The heart of cognitive control: Cardiac phase modulates processing speed and inhibition",
                                    cite: "Makowski et al., 2020",
                                    doi: "10.1111/PSYP.13490",
                                },
                            },
                            {
                                text: "Phenomenological Control",
                                tone: "control",
                                size: 13.5,
                                paper: {
                                    title: "A novel visual illusion paradigm provides evidence for a general factor of illusion sensitivity and personality correlates",
                                    cite: "Makowski et al., 2023",
                                    doi: "10.1038/S41598-023-33148-5",
                                },
                            },
                            {
                                text: "Deep Self",
                                about: "The mechanisms underneath: understanding and measuring what actually drives how we perceive and behave in the world.",
                                tone: "self",
                                size: 18,
                                paper: {
                                    title: "Towards an Active Inference Personality Framework: The Deep-Self Predictive Cascade Model",
                                    cite: "Makowski, 2026",
                                    doi: "10.31234/osf.io/9pequ_v2",
                                },
                            },
                        ],
                        /* The wider vocabulary, taken from the lab's own research
                           page — chosen for spread rather than for the nineteen
                           most important, since the point of a cloud around
                           "Reality" is how far the word reaches. */
                        keywords: [
                            {
                                text: "Illusions",
                                tone: "control",
                                size: 13,
                                paper: {
                                    title: "A Parametric Framework to Generate Visual Illusions Using Python",
                                    cite: "Makowski et al., 2021",
                                    doi: "10.1177/03010066211057347",
                                },
                            },
                            {
                                text: "Fake News",
                                tone: "control",
                                size: 12,
                                paper: {
                                    title: "Interventions for combating COVID-19 misinformation: a systematic realist review",
                                    cite: "Dickinson et al., 2025",
                                    doi: "10.1371/journal.pone.0321818",
                                },
                            },
                            {
                                text: "Lying",
                                tone: "control",
                                size: 12,
                                paper: {
                                    title: "The structure of deception: Validation of the lying profile questionnaire",
                                    cite: "Makowski et al., 2021",
                                    doi: "10.1007/s12144-021-01760-1",
                                },
                            },
                            {
                                text: "Virtual Reality",
                                tone: "control",
                                size: 11.5,
                                paper: {
                                    title: "In Medio Stat Virtus: intermediate levels of mind wandering improve episodic memory encoding in a virtual reality task",
                                    cite: "Blondé et al., 2022",
                                    doi: "10.1007/S00426-022-01660-4",
                                },
                            },
                            {
                                text: "Presence",
                                tone: "control",
                                size: 11,
                                paper: {
                                    title: '"Being there" and remembering it: Presence improves memory encoding',
                                    cite: "Makowski et al., 2017",
                                    doi: "10.1016/J.CONCOG.2017.06.015",
                                },
                            },
                            {
                                text: "Consciousness",
                                tone: "self",
                                size: 12.5,
                                paper: {
                                    title: "The Beauty and the Self: A Common Mnemonic Advantage Between Aesthetic Judgment and Self-Reference",
                                    cite: "Lee et al., 2024",
                                    doi: "10.1037/CNS0000345",
                                },
                            },
                            {
                                text: "Personality",
                                tone: "self",
                                size: 12,
                                paper: {
                                    title: "A novel visual illusion paradigm provides evidence for a general factor of illusion sensitivity and personality correlates",
                                    cite: "Makowski et al., 2023",
                                    doi: "10.1038/S41598-023-33148-5",
                                },
                            },
                            {
                                text: "Meditation",
                                tone: "self",
                                size: 11,
                                paper: {
                                    title: "The protective role of long-term meditation on the decline of the executive component of attention in aging",
                                    cite: "Sperduti et al., 2016",
                                    doi: "10.1080/13825585.2016.1159652",
                                },
                            },
                            {
                                text: "Emotion Regulation",
                                tone: "body",
                                size: 12,
                                paper: {
                                    title: "The distinctive role of executive functions in implicit emotion regulation",
                                    cite: "Sperduti et al., 2017",
                                    doi: "10.1016/J.ACTPSY.2016.12.001",
                                },
                            },
                            {
                                text: "Brain-Body Axis",
                                tone: "body",
                                size: 11,
                                paper: {
                                    title: "Heart Rate Variability in Psychology: A Review of HRV Indices and an Analysis Tutorial",
                                    cite: "Pham et al., 2021",
                                    doi: "10.3390/s21123998",
                                },
                            },
                            {
                                text: "Physiology",
                                tone: "body",
                                size: 12,
                                paper: {
                                    title: "NeuroKit2: A Python toolbox for neurophysiological signal processing",
                                    cite: "Makowski et al., 2021",
                                    doi: "10.3758/s13428-020-01516-y",
                                },
                            },
                            {
                                text: "Predictive Coding",
                                size: 11.5,
                                paper: {
                                    title: "Towards an Active Inference Personality Framework: The Deep-Self Predictive Cascade Model",
                                    cite: "Makowski, 2026",
                                    doi: "10.31234/osf.io/9pequ_v2",
                                },
                            },
                            {
                                text: "Bayesian Brain",
                                size: 11.5,
                                paper: {
                                    title: "Towards an Active Inference Personality Framework: The Deep-Self Predictive Cascade Model",
                                    cite: "Makowski, 2026",
                                    doi: "10.31234/osf.io/9pequ_v2",
                                },
                            },
                            {
                                text: "Computational Modelling",
                                size: 11,
                                paper: {
                                    title: "Introducing the Choice-Confidence (CHOCO) Model for Bimodal Data from Subjective Ratings",
                                    cite: "Makowski et al., 2025",
                                    doi: "10.31234/osf.io/z68v3_v1",
                                },
                            },
                            {
                                text: "EEG",
                                size: 12.5,
                                paper: {
                                    title: "Brain entropy, fractal dimensions and predictability: A review of complexity measures for EEG in healthy and clinical populations",
                                    cite: "Lau et al., 2022",
                                    doi: "10.1111/EJN.15800",
                                },
                            },
                            {
                                text: "Fractals & Chaos",
                                about: "Complexity quantification (with concepts like non-linear dynamics, entropy, fractal dimensions) is a fascinating approach that we are exploring with neurophysiological signals (for instance with EEG or heart rate variability) and psychological experiences.",
                                size: 11.5,
                                paper: {
                                    title: "Brain entropy, fractal dimensions and predictability: A review of complexity measures for EEG in healthy and neuropsychiatric populations",
                                    cite: "Lau et al., 2022",
                                    doi: "10.1111/EJN.15800",
                                },
                            },
                            {
                                text: "Artificial Intelligence",
                                size: 11,
                                paper: {
                                    title: "Too beautiful to be fake: Attractive faces are less likely to be judged as artificially generated",
                                    cite: "Makowski et al., 2025",
                                    doi: "10.1016/j.actpsy.2024.104670",
                                },
                            },
                            {
                                text: "Neuroaesthetics",
                                about: "We are also interested in the neurocognitive mechanisms supporting aesthetic judgment and aesthetic experience, as well as more extreme states of consciousness such as Awe or the sublime (check-out one of my favourite comics on this topic).",
                                size: 11.5,
                                link: {
                                    href: "https://existentialcomics.com/comic/18",
                                    label: "One of my favourite comics ↗",
                                },
                            },
                            {
                                text: "Open Science",
                                about: "We're highly committed to improving science practices by studying them, and to leading the revolution towards open and transparent research.",
                                size: 11.5,
                                paper: {
                                    title: "Where Are We Going with Statistical Computing? From Mathematical Statistics to Collaborative Data Science",
                                    cite: "Makowski & Waggoner, 2023",
                                    doi: "10.3390/math11081821",
                                },
                            },
                            {
                                text: "History of Psychology",
                                size: 11,
                                paper: {
                                    title: "Can mental fatigue be measured by Weber's compass? Alfred Binet's answer on the value of aesthesiometry",
                                    cite: "Nicolas & Makowski, 2016",
                                    doi: "10.1484/J.EYHP.5.112940",
                                },
                            },
                            {
                                /* The one theme the old cloud had no word for,
                                   carried over from the tiles this landmark used
                                   to hold. No paper: what it points at is the
                                   shelf of instruments themselves. */
                                text: "Assessment",
                                about: "We develop innovative neuropsychological instruments — tasks and questionnaires for interoception, cognitive control and the Self.",
                                size: 12,
                                tab: "creations",
                            },
                        ],
                    },
                },
            ],
        },
        CREATIONS_TAB,
    ],
})
