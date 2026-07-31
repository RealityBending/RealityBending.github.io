/* services-content.js
 * Copy for the Information → Services tab. Rendered by services.js.
 *
 * One honeycomb, one list. `entries` holds both the work already done and the
 * work we are available to do — the difference between them is not a separate
 * array but which fields are filled in:
 *
 *   an entry with a client or a date is work delivered
 *   an entry with neither is work offered
 *
 * That is also the visual difference: services.js reads it to hold the
 * photograph back on an offer, so the two kinds still read apart in the comb
 * without being kept apart in the file. Adding a client and a date to a
 * capability is all it takes to promote it to a contract.
 *
 * Every entry is joined to `domains` by id, which is what gives the cell its
 * photograph and its colour.
 *
 * ── The face, top to bottom ──
 *   domain      taken from `domains`, not written here
 *   title       the bold line — what the job was
 *   description one or two sentences
 *   client · date   only when both or either are present
 *
 * A hexagon cannot grow to fit its contents the way a card can, so each field
 * is written to a budget: `title` up to two lines (three when there is no
 * description), `description` up to three, the meta line one. Past that the
 * stylesheet truncates rather than letting text spill over the sloping edges.
 *
 * `logo` is optional and swaps the domain photograph for a client's own mark,
 * which fills the same space and is cropped to it — so give it something that
 * survives losing its edges. It keeps its own colours rather than taking the
 * domain's duotone. `description` may carry *emphasis* but not links: the
 * front of a hexagon is one big button, and the only anchor on the card is on
 * its back.
 *
 * Accent triplets are accent / deep / ink. The base colours are three of the
 * site's own section tokens (css/01-base.css :root) so nothing new enters the
 * palette — orange, teal and blue — plus the Information red for the card that
 * closes the honeycomb. They are picked for the contrast between the three
 * strands of work, not to point at any particular section, so a section
 * changing colour does not have to drag them with it.
 */

export const SERVICES_CONTENT = Object.freeze({
    eyebrow: "Services",
    headline: "What we can teach, analyse, and build for you.",
    lede: "We support labs, departments, start-ups and companies with skills development, research support and custom technical development. Our university consultancy department can help draft a contract and take care of the administrative aspects.",
    cta: {
        label: "Request more information",
        href: "mailto:realitybending@sussex.ac.uk?subject=Requesting%20more%20information%20about%20Reality%20Bending%20Lab%20services",
    },

    domains: [
        {
            id: "upskilling",
            label: "Upskilling",
            image: "information/img/workshop.jpg",
            accent: { accent: "255, 153, 51", deep: "150, 90, 30", ink: "117, 70, 23" },
        },
        {
            id: "expertise",
            label: "Scientific expertise",
            image: "information/img/consultation.png",
            accent: { accent: "51, 204, 204", deep: "30, 120, 120", ink: "26, 92, 92" },
        },
        {
            id: "development",
            label: "Development",
            image: "information/img/development.jpg",
            accent: { accent: "85, 153, 255", deep: "50, 90, 150", ink: "39, 70, 117" },
        },
    ],

    /* The honeycomb has no heading of its own: the filter chips name the three
       strands of work between them, and a title over them only said again what
       they already show. */
    filterAllLabel: "Everything",

    /* Delivered work leads the honeycomb: it is the persuasive part, and the
       offers read as "and here is what else" behind it. The comb fills in this
       order and does not sort, so the ordering here is the editorial decision
       it looks like. */
    entries: [
        {
            id: "sedarc-2026",
            domain: "upskilling",
            title: "Introduction to GitHub",
            description: 'Contracted to record a re-usable *"Introduction to GitHub"* lecture for PhD students.',
            client: "SEDarc",
            logo: "information/img/logo_sedarc.png",
            date: "2026",
        },
        {
            id: "fragrance-2026",
            domain: "expertise",
            title: "Smells and emotions",
            description: "Contract research on smells and emotions for a fragrance company.",
            client: "Fragrance industry",
            logo: "information/img/logo_fragrance.webp",
            date: "2026",
        },
        {
            id: "iacs-2026",
            domain: "development",
            title: "EEG hyperscanning",
            description: "Contracted to develop hyperscanning capabilities for an open source portable EEG software.",
            client: "Institute for Advanced Consciousness Studies",
            date: "2026",
            logo: "information/img/advancedconsciousnesslogo.png",
            logoAlt: "Institute for Advanced Consciousness Studies",
        },
        {
            id: "basel-2024",
            domain: "upskilling",
            title: "Psychophysiology workshop",
            description: 'Workshop for PhD students on *"Using psychophysiological methods for psychology and neuroscience research"*.',
            client: "University of Basel",
            logo: "information/img/2024_Basel.jpg",
            date: "2024",
        },
        {
            id: "rbl-site-2024",
            domain: "development",
            title: "Website Creation",
            description:
                'We created our own website. We can build one cheaper (and better) than "professionals" developer. And we can show you how to host it for free on GitHub, and how to maintain & update it yourself.',
            client: "This website",
            logo: "information/img/rebel_website.png",
            date: "2024",
        },
        {
            id: "zurich-2022",
            domain: "upskilling",
            title: "Python Workshop",
            description: 'Workshop for PhD students on *"Programming and Data Science with Python"*.',
            client: "University of Zurich",
            logo: "information/img/logo_python.png",
            date: "2022",
        },
        {
            id: "paris-2024",
            domain: "upskilling",
            title: "Bayesian Workshop",
            description: 'Workshop for a University of Paris lab members on *"Bayesian Statistics"*.',
            client: "University of Paris",
            logo: "information/img/bayesian.png",
            date: "2024",
        },
        {
            id: "ntu-2021",
            domain: "upskilling",
            title: "Mixed models in R",
            description: 'Workshop for the Nanyang Technological University in Singapore on *"Mixed models in R"*.',
            client: "Nanyang Technological University",
            logo: "information/img/mixedmodels.png",
            date: "2021",
        },

        /* No client and no date: work offered rather than delivered. */
        // { id: "research-software", domain: "development", title: "Research software and packages" },
        // { id: "modern-experiments", domain: "development", title: "User-friendly modern experiments" },
    ],

    /* The back of every hexagon. One message, not one per card — the point of
       turning a card over is to find the same way of getting in touch wherever
       you happened to be looking. */
    flip: {
        question: "Interested in a similar project?",
        lead: "Contact",
        email: "D.Makowski@sussex.ac.uk",
        tail: "for any information and quotes.",
    },

    /* The cell that closes the honeycomb, in the section's own red. It does not
       turn over: it is already the side every other hexagon flips to. */
    outro: {
        id: "get-in-touch",
        kicker: "Get in touch",
        title: "Not sure what you need?",
        text: "Tell us about the project.",
        email: "D.Makowski@sussex.ac.uk",
        accent: { accent: "255, 85, 85", deep: "162, 44, 44", ink: "126, 47, 47" },
    },
})
