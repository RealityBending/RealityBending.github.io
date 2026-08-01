/* The Creations tab's content, kept out of research-content.js so the Overview
 * zoom's landmarks and this list are not one file that has to be scrolled past
 * to reach either. research-content.js imports the tab below into its own
 * `tabs`, which stays the single list of what the section shows.
 *
 * Two rows, not one filtered set, because the two things a lab puts out are
 * read differently. An **invention** is an idea that went into the literature:
 * what matters is the idea in one line and where to read it, which is a list. A
 * **tool** is something you can pick up: what matters is what it looks like,
 * what sort of thing it is, and the way to it — which is a card with the
 * thing's own picture on it. So `groups` carries its own renderer in `kind`
 * ("list" or "cards"), and adding a third row is a content change.
 *
 * A group with an `image` — a path from the site root, like a tool's `logo` —
 * is a dark plate with that painting behind it. Inventions has one, an
 * astronomer working out a new arrangement of the world, because a list of
 * ideas is a page of text and the picture is what makes it a thing to look at.
 * A replacement has to survive being darkened to a texture and cropped to a
 * wide band, so a picture whose subject is a small bright thing in one corner
 * is the wrong kind.
 *
 * A group with no `image` is a light plate, which is what Tools is: eleven
 * pictures of their own, each on a white card. A painting behind those is a
 * twelfth picture competing with them, and it lost.
 *
 * Item keys, both rows: `name`, `line` (the one-line description — this is the
 * whole of what a reader gets, so it has to stand alone), `href` and
 * `linkLabel`. Then `type` on the cards side, plus `logo`: a path to the
 * thing's own logo, screenshot or illustration, relative to the site root. It
 * is the top of the card and its own shape sets the card's height, so anything
 * from a wordmark to a tall screenshot is fine and nothing is cropped to a
 * fixed box; the name sits under it and the kind and description arrive on
 * hover. Every tool needs one — there is no fallback rendering for a tool
 * without a logo, so a new entry with no picture of its own needs one made
 * before it can be added here.
 */
export const CREATIONS_TAB = Object.freeze({
    id: "creations",
    label: "Creations",
    kind: "creations",
    groups: [
        {
            id: "inventions",
            kind: "list",
            label: "Inventions",
            lede: "Ideas and concepts we defined.",
            accent: "#5599ff",
            image: "research/img/copernicus.jpg",
            items: [
                {
                    name: "Probability of Direction (pd)",
                    line: "Our index of effect existence became a standard tool for Bayesian analysis reporting.",
                    href: "https://en.wikipedia.org/wiki/Probability_of_direction",
                    linkLabel: "Wikipedia",
                },
                {
                    name: "Fictional Reappraisal",
                    line: "We coined the term for an interesting subtype of emotion regulation strategy.",
                    href: "https://en.wikipedia.org/wiki/Paradox_of_fiction#Scientific_investigations",
                    linkLabel: "Wikipedia",
                },
                {
                    name: "Choice-Confidence (CHOCO) Model",
                    line: "A new way of statistically modelling data from slider scales.",
                    href: "https://doi.org/10.31234/osf.io/z68v3_v1",
                    linkLabel: "Preprint",
                },
            ],
        },
        {
            id: "tools",
            kind: "cards",
            label: "Tools",
            lede: "Instruments and paradigms, all made available open source.",
            accent: "#33cccc",
            items: [
                {
                    name: "NeuroKit2",
                    type: "Python package",
                    logo: "research/img/logo-neurokit.png",
                    line: "Neurophysiological signals processing (ECG, EDA, PPG, EMG, ...).",
                    href: "https://neuropsychology.github.io/NeuroKit/",
                    linkLabel: "Docs",
                },
                {
                    name: "easystats",
                    type: "R ecosystem",
                    logo: "research/img/logo-easystats.png",
                    line: "A collection of 10 packages.",
                    href: "https://easystats.github.io/easystats/",
                    linkLabel: "Docs",
                },
                {
                    name: "Pyllusion",
                    type: "Python package",
                    logo: "research/img/logo-pyllusion.png",
                    line: "A package for generating visual illusions.",
                    href: "https://realitybending.github.io/Pyllusion/",
                    linkLabel: "Docs",
                },
                {
                    name: "SequentialSamplingModels",
                    type: "Julia package",
                    logo: "research/img/logo-sequentialsamplingmodels.png",
                    line: "Evidence accumulation models in Julia.",
                    href: "https://github.com/itsdfish/SequentialSamplingModels.jl",
                    linkLabel: "GitHub",
                },
                {
                    name: "The Mint",
                    type: "Questionnaire",
                    logo: "research/img/logo-mint.png",
                    line: "The best interoception questionnaire.",
                    href: "https://doi.org/10.31234/osf.io/8qrht_v1",
                    linkLabel: "Preprint",
                },
                {
                    name: "The LIE Scale",
                    type: "Questionnaire",
                    logo: "research/img/logo-lie.png",
                    line: "Sixteen-item deception questionnaire.",
                    href: "https://doi.org/10.1007/s12144-021-01760-1",
                    linkLabel: "Paper",
                },
                {
                    name: "The Illusion Game",
                    type: "Task",
                    logo: "research/img/logo-illusiongame.png",
                    line: "A robust paradigm to measure illusion sensitivity.",
                    href: "https://doi.org/10.1038/s41598-023-33148-5",
                    linkLabel: "Paper",
                },
                {
                    name: "Neuropsydia",
                    type: "Python package",
                    logo: "research/img/logo-neuropsydia.png",
                    line: "A Python module for creating experiments, tasks and questionnaires.",
                    href: "https://github.com/neuropsychology/neuropsydia.py",
                    linkLabel: "GitHub",
                },
                {
                    name: "Patient Assessment App",
                    type: "Web app",
                    logo: "research/img/logo-patientassessmentapp.png",
                    line: "A web application to facilitate the Bayesian neuropsychological assessment of patients.",
                    href: "https://neuropsychology.shinyapps.io/patientassessmentapp",
                    linkLabel: "Open app",
                },
                {
                    name: "NeuropsyXart",
                    type: "Art project",
                    logo: "research/img/logo-neuropsyxart.png",
                    line: "Dominique Makowski's art project, turning brain and body signals into generative drawings.",
                    href: "https://dominiquemakowski.github.io/NeuropsyXart/",
                    linkLabel: "Gallery",
                },
                {
                    name: "Music",
                    type: "Art project",
                    logo: "research/img/logo-music.png",
                    line: "Dominique Makowski's piano arrangements and scores.",
                    href: "https://musescore.com/dominiquemakowski",
                    linkLabel: "Musescore",
                },
            ],
        },
    ],
})
