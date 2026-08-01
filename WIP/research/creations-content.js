/* The Creations tab's content, kept out of research-content.js so the Overview
 * zoom's landmarks and this list are not one file that has to be scrolled past
 * to reach either. research-content.js imports the tab below into its own
 * `tabs`, which stays the single list of what the section shows.
 *
 * Two rows, not one filtered set, because the two things a lab puts out are
 * read differently. An **invention** is an idea that went into the literature:
 * what matters is the idea in one line and where to read it, which is a list. A
 * **tool** is something you can pick up: what matters is what it is, what sort
 * of thing it is, and the way to it — which is a hexagon in a comb. So `groups`
 * carries its own renderer in `kind` ("list" or "comb"), and adding a third row
 * is a content change.
 *
 * Each group is a dark plate with a painting behind it, given as `image` — a
 * path from the site root, like a tool's `logo`. Both are
 * chosen for what the row is: an astronomer working out a new arrangement of
 * the world for the ideas, and for the tools a room of people around an orrery
 * — an instrument being used, which is what a tool is for. Any replacement has
 * to survive being darkened to a texture and cropped to a wide band, so a
 * picture whose subject is a small bright thing in one corner is the wrong
 * kind.
 *
 * Item keys, both rows: `name`, `line` (the one-line description — this is the
 * whole of what a reader gets, so it has to stand alone), `href` and
 * `linkLabel`. Then `type` on the comb side, plus an optional `logo`: a path
 * to the thing's own logo or illustration, relative to the site root. It fills
 * the top of the hexagon; a tool without one is filled with a colour instead,
 * picked for it by creations.js, and marked with the star every entry on this
 * tab carries.
 *
 * Deliberately not exhaustive: a sample across both rows, and across the kinds
 * of tool (package, questionnaire, task), so the layout can be judged.
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
            lede: "Ideas that went into the literature and stayed there.",
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
                    name: "Choice-Confidence Model",
                    line: "Answers on an analogue scale are bimodal: people pick a side, then say how sure they are. Modelling both peaks jointly keeps a shift in belief apart from a shift in confidence.",
                    href: "https://doi.org/10.31234/osf.io/z68v3_v1",
                    linkLabel: "Preprint",
                },
            ],
        },
        {
            id: "tools",
            kind: "comb",
            label: "Tools",
            lede: "Instruments anyone can pick up and use.",
            accent: "#33cccc",
            image: "research/img/orrey.jpg",
            items: [
                {
                    name: "NeuroKit2",
                    type: "Python package",
                    logo: "research/img/logo-neurokit.png",
                    line: "Neurophysiological signal processing, from raw recording to interpretable features.",
                    href: "https://neuropsychology.github.io/NeuroKit/",
                    linkLabel: "Docs",
                },
                {
                    name: "easystats",
                    type: "R ecosystem",
                    line: "Ten packages that make describing, checking and reporting a model one function each.",
                    href: "https://easystats.github.io/easystats/",
                    linkLabel: "Docs",
                },
                {
                    name: "Pyllusion",
                    type: "Python package",
                    logo: "research/img/logo-pyllusion.png",
                    line: "Classic visual illusions as parametric functions, so illusion strength becomes a variable.",
                    href: "https://realitybending.github.io/Pyllusion/",
                    linkLabel: "Docs",
                },
                {
                    name: "SequentialSamplingModels",
                    type: "Julia package",
                    line: "Evidence accumulation models — drift diffusion and its relatives — to simulate and fit.",
                    href: "https://github.com/itsdfish/SequentialSamplingModels.jl",
                    linkLabel: "GitHub",
                },
                {
                    name: "Mint",
                    type: "Questionnaire",
                    line: "Seven modalities of bodily sensation, crossed with the contexts they show up in.",
                    href: "https://doi.org/10.31234/osf.io/8qrht_v1",
                    linkLabel: "Preprint",
                },
                {
                    name: "The LIE Scale",
                    type: "Questionnaire",
                    line: "Sixteen items for the four dimensions of lying: frequency, ability, negativity, context.",
                    href: "https://doi.org/10.1007/s12144-021-01760-1",
                    linkLabel: "Paper",
                },
                {
                    name: "The Illusion Game",
                    type: "Task",
                    line: "Ten staircased illusions in the browser, scored for both error and reaction time.",
                    href: "https://doi.org/10.1038/s41598-023-33148-5",
                    linkLabel: "Paper",
                },
            ],
        },
    ],
})
