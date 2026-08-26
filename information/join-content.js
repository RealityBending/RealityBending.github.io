/* join-content.js
 * Every word and link in the Information → Join tab. The renderer
 * (information/join.js) knows about block *types*, not about the copy, so this
 * file is the only one to touch when an opportunity opens, closes, or moves.
 *
 * Text fields accept a minimal inline markup — `[label](href)` for links,
 * `*emphasis*`, `**strong**` and `***both***`. Nothing else: the renderer builds
 * DOM nodes rather than assigning innerHTML, so raw HTML here would appear
 * verbatim on the page.
 *
 * `heading` is plain text; `lede` and any `text`/`blurb` also take block-level
 * markup — a blank line starts a paragraph, and lines opening "- " become a
 * list.
 *
 * Block types (see renderBlock in join.js):
 *   routes  — cards for the named ways in, each with its own links. Every
 *             level's opportunities are this one block type, so a scheme reads
 *             the same wherever it sits. An item with `featured: true` is
 *             pulled out visually; `featured: "…"` also names the flag. Items
 *             carrying `tags` get an eligibility filter above the grid.
 *   steps   — a numbered sequence
 *   faq     — collapsed question/answer pairs
 *   note    — a callout, "tip" or "warn"
 *
 * On `tags`: "Open to all" means no nationality restriction, and those entries
 * stay visible under *every* filter — picking "France" is asking "what can I,
 * a French applicant, go for", which includes everything unrestricted.
 *
 * `prompt` is the whole of the console above the rail — the rail's three
 * buttons are the rest of it, and they say what the levels are without help.
 *
 * On `accent` and `image`: each level retints the whole tab and swaps the
 * banner photograph behind it. Colours live here rather than in the stylesheet
 * for the same reason they live in site-sections.js — the level is the thing
 * that owns them, and the rail, the panel and the banner all have to agree.
 * `accent` values are RGB triplets so the stylesheet can vary their alpha:
 *   accent — the bright hue, for fills and washes
 *   deep   — the mid tone, for gradient ends
 *   ink    — the dark tone, and the only one used for text
 */

export const JOIN_CONTENT = Object.freeze({
    prompt: "What are you looking for?",

    stages: [
        {
            id: "research-assistant",
            step: "01",
            label: "Research Assistant",
            image: "information/img/researchassistant.jpg",
            imageAlt: "A researcher at a desk, studying MRI brain scans on one monitor and analysis code on another",
            accent: { accent: "255, 85, 85", deep: "162, 44, 44", ink: "126, 47, 47" },
            heading: "Gain Research Experience",
            lede: "Whether you are an undergraduate after a first taste of research or a graduate building your CV for a PhD, this is a key step in your career.",
            blocks: [
                {
                    type: "routes",
                    title: "Opportunities",
                    items: [
                        {
                            name: "Funded RA positions",
                            meta: "Salaried · advertised when a grant lands",
                            blurb: "Open RA posts are often listed on the university's recruitment pages. They come and go with funding rather than on a yearly cycle, so it is worth checking more than once.",
                            highlights: ["Salaried", "Full research experience"],
                            links: [{ label: "Sussex jobs", href: "https://www.sussex.ac.uk/about/jobs/" }],
                        },
                        {
                            name: "Psychology Placement Year",
                            featured: true,
                            meta: "Undergraduates · Sussex · 1 year",
                            blurb: "A full year in a research lab between your second and third year. It looks like it pushes your degree back by twelve months; but it will 100% make a difference to your CV if you plan to apply to jobs, masters and PhDs.",
                            links: [
                                {
                                    label: "The course",
                                    href: "https://www.sussex.ac.uk/study/undergraduate/courses/psychology-with-a-professional-placement-year-bsc-hons",
                                },
                                { label: "Placement info", href: "http://www.sussex.ac.uk/psychology/internal/students/placements" },
                            ],
                        },
                        {
                            name: "Junior Research Associate (JRA)",
                            featured: true,
                            meta: "Undergraduates · Sussex · 8 weeks · funded",
                            blurb: "An intensive eight-week research project over the summer break, with a bursary. Small enough for a summer, long enough to get something out of it.",
                            links: [
                                { label: "The scheme", href: "http://www.sussex.ac.uk/suro/jra" },
                                { label: "How to apply", href: "http://www.sussex.ac.uk/suro/applying" },
                                { label: "A past JRA's account", href: "#post-2023-jra-experience" },
                            ],
                        },
                        {
                            name: "International JRA (IJRA)",
                            meta: "Undergraduates · beyond Sussex · summer",
                            blurb: "The same summer scheme, opened up to students from outside Sussex.",
                            links: [{ label: "Details", href: "https://www.sussex.ac.uk/suro/current/ijra" }],
                        },
                        {
                            name: "SoCoBio Summer Studentship",
                            meta: "Undergraduates · UK residents · 6 weeks · paid",
                            blurb: "A paid six-week internship at 30 hours a week, taken between 1 July and 30 September, run by the South Coast Biosciences doctoral network. It is reserved for first-generation students — neither parent or guardian holds a degree — in the middle years of a first degree.",
                            links: [
                                {
                                    label: "Programme page",
                                    href: "https://southcoastbiosciencesdtp.ac.uk/undergraduate-summer-studentship-programme/",
                                },
                            ],
                        },
                        {
                            name: "Neuropsychology International Fellowship",
                            meta: "Postgraduates · up to £6,000",
                            blurb: "A British Neuropsychological Society award that can cover a research stay: postgraduates from low- and middle-income countries coming to the UK, or UK-based researchers running a project abroad. A senior member has to sponsor the application.",
                            links: [{ label: "BNS grants", href: "https://www.the-bns.org/grants" }],
                        },
                    ],
                },
            ],
        },

        {
            id: "phd",
            step: "02",
            label: "PhD",
            image: "information/img/graduation.jpg",
            imageAlt: "Graduates in black gowns and red hoods standing in a line on Brighton's pebble beach, facing the sea",
            accent: { accent: "85, 204, 119", deep: "44, 124, 72", ink: "39, 94, 58" },
            heading: "Become a Doctor",
            lede: `Doing a PhD at the Reality Bending Lab is the best, because you'll get:
            
            ✅ Joining a dynamic team with a vibrant lab life
            ✅ A supervisor that actually supervises 🤯
            ✅ A super interesting research topic
            ✅ A French-style thesis defense to celebrate your accomplishments 🧀🍷

            But getting into a funded PhD program is also the trickiest stage with the most moving parts: a supervisor, a project, and - the hard one - the money.`,
            blocks: [
                {
                    type: "steps",
                    title: "How it actually works",
                    items: [
                        {
                            title: "Reach out to the supervisor",
                            text: "Send your CV, your research interests and eventually a couple of project ideas that connect to the lab's work. Having no ideas yet is perfectly fine: we will usually propose some directions and refine them with you. It also helps enormously to arrive having already searched and selected potential funding schemes you want to target, so we can shape the project around what you are actually eligible for.",
                        },
                        {
                            title: "Then find the money",
                            text: "This is the genuinely difficult part. Four profiles cover most cases: you and the supervisor build a project and apply for a scholarship together; the supervisor already holds a grant for a specific project and recruits for it; you arrive with a scholarship already secured; or you self-fund, which we do not recommend unless you are one of the lucky few with money to spare.",
                        },
                        {
                            title: "Then apply",
                            text: "With a target in mind, gather the documents and write the proposal. Fingers crossed!",
                        },
                    ],
                },
                {
                    type: "routes",
                    title: "Opportunities",
                    note: "Funding is the usual barrier between a plan and a PhD. Below are some opportunities, but you should also search for others.",
                    items: [
                        // {
                        //     name: "Sussex Psychology PhD",
                        //     tags: ["Open to all"],
                        //     meta: "Deadline usually December",
                        //     blurb: "Fully funded for local and international students — fees paid and a salary. Selection weighs your CV and your project proposal equally, so talk to a supervisor before you write it.",
                        //     highlights: ["Fees + stipend", "Home and international", "CV + proposal"],
                        //     links: [{ label: "Programme", href: "https://www.sussex.ac.uk/study/phd/degrees/psychology-phd" }],
                        // },
                        {
                            name: "Sussex Neuroscience 3+1",
                            featured: true,
                            tags: ["Open to all"],
                            meta: "Deadline usually January",
                            blurb: "Fully funded, and the one route where you do not need a supervisor lined up: the first year is three rotations through different labs. Selection is based mostly on your CV.",
                            highlights: ["Fees + stipend", "No supervisor needed", "Three lab rotations"],
                            links: [
                                {
                                    label: "Programme",
                                    href: "https://www.sussex.ac.uk/study/phd/degrees/sussex-neuroscience-4-year-programme-phd",
                                },
                            ],
                        },
                        {
                            name: "SEDarc (ESRC) scholarships",
                            tags: ["Open to all"],
                            meta: "Deadline usually December",
                            blurb: "Three and a half years, fully funded, for projects that sit inside one of the SEDarc themes — data science among them. Selection on CV and proposal.",
                            highlights: ["3.5 years", "Must fit a theme"],
                            links: [
                                { label: "SEDarc", href: "https://www.sedarc.ac.uk/" },
                                { label: "Thematic pathways", href: "https://www.sedarc.ac.uk/thematic-pathways/" },
                            ],
                        },
                        {
                            name: "Sussex AI studentships",
                            tags: ["Open to all"],
                            meta: "Co-supervision · last round closed January 2026",
                            blurb: "Your primary supervisor has to come from the School of Engineering and Informatics, but I can be a co-supervisor on it.",
                            highlights: ["Cross-school"],
                            links: [
                                {
                                    label: "Studentships",
                                    href: "https://www.sussex.ac.uk/study/fees-funding/phd-funding/view/1807-Sussex-AI-PhD-studentships",
                                },
                            ],
                        },
                        /* The long tail of the same collection. These carry no
                           blurb of their own — the name, who they are open to
                           and a link is all there is to say — but they are the
                           same kind of thing as the cards above and one filter
                           bar governs all of them. */
                        {
                            name: "South Coast Biosciences (SoCoBio)",
                            tags: ["UK"],
                            meta: "UK",
                            links: [{ label: "The partnership", href: "https://southcoastbiosciencesdtp.ac.uk/" }],
                        },
                        {
                            name: "FIRE / Learning Planet Institute",
                            tags: ["France"],
                            meta: "France",
                            blurb: "Requires a collaboration with a Paris-based lab.",
                            links: [{ label: "How to join", href: "https://phd.learningplanetinstitute.org/en/join-us" }],
                        },
                        {
                            name: "DAAD scholarships",
                            tags: ["Germany"],
                            meta: "Germany",
                            links: [{ label: "Scholarship database", href: "https://www.daad.de/en/study-research-teach-abroad/" }],
                        },
                        {
                            name: "Commonwealth PhD Scholarships (LDCs)",
                            tags: ["Bangladesh"],
                            meta: "Commonwealth states",
                            blurb: "Fully funded UK PhD study for citizens of Bangladesh and other Commonwealth countries.",
                            links: [
                                {
                                    label: "Commonwealth Scholarships",
                                    href: "https://cscuk.fcdo.gov.uk/scholarships/commonwealth-phd-scholarships-for-least-developed-countries-and-vulnerable-states/",
                                },
                            ],
                        },
                        {
                            name: "Scholarships for Singaporeans (gov.uk compilation)",
                            tags: ["Singapore"],
                            meta: "Singapore",
                            links: [
                                {
                                    label: "The compilation",
                                    href: "https://www.gov.uk/government/news/compilation-of-scholarships-and-fellowships-for-singaporeans",
                                },
                            ],
                        },
                        {
                            name: "Lee Kuan Yew Scholarship",
                            tags: ["Singapore"],
                            meta: "Singapore",
                            links: [
                                {
                                    label: "Scholarship",
                                    href: "https://www.psc.gov.sg/scholarships/postgraduate-scholarships/lee-kuan-yew-scholarship",
                                },
                            ],
                        },
                        {
                            name: "A*STAR National Science Scholarship",
                            tags: ["Singapore"],
                            meta: "Singapore",
                            links: [
                                {
                                    label: "Scholarship",
                                    href: "https://www.a-star.edu.sg/Scholarships/for-graduate-studies/national-science-scholarship-phd",
                                },
                            ],
                        },
                        {
                            name: "SMU Overseas Postgraduate Scholarship",
                            tags: ["Singapore"],
                            meta: "Singapore",
                            links: [{ label: "Scholarship", href: "https://www.smu.edu.sg/MOE-start/overseas-pg-scholarship" }],
                        },
                        {
                            name: "NTU Humanities International Scholarship (HIPS)",
                            tags: ["Singapore"],
                            meta: "Singapore",
                            links: [{ label: "Scholarship", href: "https://www.ntu.edu.sg/hass/admissions/graduate-programmes/hips2025" }],
                        },
                    ],
                },
                {
                    type: "routes",
                    title: "Alternative routes",
                    items: [
                        {
                            name: "Co-supervision and cotutelle",
                            meta: "Split between two universities",
                            blurb: "Many universities allow some form of co-supervision: you do the bulk of the PhD elsewhere and come to Sussex as part of a collaboration. Formal frameworks exist for this, such as the French [cotutelle](https://u-paris.fr/cotutelle-internationale-de-these/).",
                        },
                        {
                            name: "Industry partnership",
                            meta: "≈ £35k over three years, matched",
                            blurb: "If an external partner covers half the cost, the university can match the other half. It works well for applied projects with startups, companies or NGOs — particularly if there is a product, a piece of software or a service to build at the end of it.",
                        },
                    ],
                },
                {
                    type: "faq",
                    title: "Questions & answers",
                    items: [
                        {
                            q: "Clinical Psychology PhD, or DClinPsy?",
                            a: [
                                "Unfortunately, the University of Sussex does not offer at the moment a PhD in Clinical Psychology that includes clinical placements and internships in hospitals. However, if you are interested in working with patients, it is entirely possible to have a research project that involves clinical populations, and specialize in 'clinical' research. Some people then complement this kind of PhD with clinical trainings (e.g., psychotherapy) to transition from research to practice.",
                            ],
                        },
                        {
                            q: "How do I become a neuropsychologist?",
                            a: [
                                "Neuropsychology is both an approach (focusing on the relationship between the brain and its output in the form of behaviour and thought) and a practice (involving neuropsychological assessments and rehabilitation). The latter is considered a specialization of Clinical Psychology, which means that one must be a clinical psychologist to be a clinical neuropsychologist. As said above, the University of Sussex unfortunately does not offer, at the moment, a formal PhD in clinical psychology or clinical neuropsychology. However, joining the Reality Bending Lab will get you well-prepared to eventually pursue this type of program, as the methods and mindset that we have draws heavily on neuropsychology (the use of neuropsychological tests, the focus on neurocognitive theories, etc.). In fact, some of our past members have become brilliant neuropsychologists, so feel free to ask them!",
                            ],
                        },
                        {
                            q: "Can I work on psychedelics?",
                            a: [
                                "Psychedelics and altered states of consciousness are a hot topic in psychology and neuroscience. Unfortunately, it is still *extremely* difficult to get authorizations to work with these substances. I would not recommend to base your PhD project on this potentiality, as it's too risky that things might not work out (due to ethical, administrative, or political reasons). That said, we do have projects running in collaborations with experts in the field, and are always on the lookout for opportunities to work on these topics. Additionally, we think it's also very interesting to study how altered states of consciousness can be induced *without* external substances (e.g., through meditation, hypnosis, sensory deprivation, neural stimulation, ...), which might be a more sustainable and ethical way to approach these phenomena.",
                            ],
                        },
                    ],
                },
                {
                    type: "note",
                    tone: "tip",
                    title: "Writing an application that gets read",
                    text: `A few tips for your writing up your application dossier, in particular pertaining your CV and cover letter. Note that these are general guidelines that also apply to other contexts (master's programs, industry jobs, etc.).

                    The key thing is to keep in mind that we receive a ***lot*** of applications (few hundreds for some positions). The first mistake you want to avoid is to have a generic, impersonal application: do address specific people (and **do not make mistakes in the spelling of their names**, it happens often and is a turn-off), and try to concisely paint a profile of yourself that the recruiter can easily picture and form an image of: what is your background, where do you come from, what are your expertise, interests and goals. This should really be one tightly written paragraph (you can expand on this in your CV). We often see long and convoluted CVs and cover letters, that try to show "a bit of everything", leaving the reader with little more than a sense of confusion.

                    Next, after providing a clear depiction of who you are, you want to show that you have **done your homework about where you are applying**: be specific about the people of the department (e.g., "I am particularly interested in working with Dr. X because of their work on Y"), or the papers ("I particularly enjoyed your paper on X because of Y"). This shows that you are motivated and that you are not just sending the same application to 100 different places. That being said, do not list *everything* that is written on someone's website or profile, because it makes it look like you just copied and pasted it. Be genuine, personal and specific. 
                    
                    I know it is tempting to use AI to generate these kinds of things, but don't: it is a big red flag. Putting in the time, effort, and hard work will pay off. We prefer something less polished and perfect. 

                    Finally, you want to show that you are a good fit for the position, and show that you have experience in the methods that are used in the lab, that you have experience in the field, etc.`,
                },
            ],
        },

        {
            id: "postdoc",
            step: "03",
            label: "Postdoc",
            image: "information/img/postdoc.jpg",
            imageAlt: "A researcher presenting a scientific poster to a small group at a conference",
            accent: { accent: "51, 204, 204", deep: "30, 120, 120", ink: "26, 92, 92" },
            heading: "Postdoctoral Fellowships",
            lede: "If you have just finished a PhD (or are about to), consider applying for postdoc fellowships. Some let you join a lab of your choice, with your own funding and your own research programme!",
            blocks: [
                {
                    type: "routes",
                    title: "Opportunities",
                    items: [
                        {
                            name: "Marie Skłodowska-Curie postdoctoral fellowships (MSCA)",
                            tags: ["Open to all"],
                            links: [
                                {
                                    label: "The action",
                                    href: "https://marie-sklodowska-curie-actions.ec.europa.eu/actions/postdoctoral-fellowships",
                                },
                            ],
                        },
                        {
                            name: "UKRI Future Leaders Fellowships",
                            tags: ["Open to all"],
                            links: [
                                {
                                    label: "The scheme",
                                    href: "https://www.ukri.org/apply-for-funding/our-fellowship-opportunities/future-leaders-fellowships/",
                                },
                            ],
                        },
                        {
                            name: "Newton International Fellowships",
                            tags: ["International"],
                            meta: "For applicants based outside the UK, without UK citizenship",
                            links: [{ label: "The scheme", href: "https://royalsociety.org/grants/newton-international/" }],
                        },
                        {
                            name: "British Academy postdoctoral fellowships",
                            tags: ["UK"],
                            meta: "A UK doctorate, or UK/EEA nationality",
                            links: [
                                {
                                    label: "Fellowships",
                                    href: "https://www.thebritishacademy.ac.uk/funding/postdoctoral-fellowships/",
                                },
                            ],
                        },
                        {
                            name: "Fondation Fyssen",
                            tags: ["France"],
                            meta: "For French PhD holders",
                            links: [{ label: "Study grants", href: "https://www.fondationfyssen.fr/en/our-actions/study-grants/" }],
                        },
                        {
                            name: "Canada Postdoctoral Research Award (SSHRC)",
                            tags: ["Canada"],
                            meta: "Canada · formerly the SSHRC postdoctoral fellowships",
                            links: [
                                {
                                    label: "The programme",
                                    href: "https://sshrc-crsh.canada.ca/en/funding/opportunities/canada-postdoctoral-research-award-program.aspx",
                                },
                            ],
                        },
                        {
                            name: "FRQSC postdoctoral scholarship",
                            tags: ["Canada"],
                            meta: "Canada",
                            links: [
                                {
                                    label: "The scholarship",
                                    href: "https://frq.gouv.qc.ca/programme/frqsc-bourse-postdoctorale-b3z-concours-automne-2023-2024-2025/",
                                },
                            ],
                        },
                        {
                            name: "Banting postdoctoral fellowships",
                            tags: ["Canada"],
                            meta: "Canada",
                            links: [
                                {
                                    label: "The programme",
                                    href: "https://banting.fellowships-bourses.gc.ca/en/app-dem_overview-apercu.html",
                                },
                            ],
                        },
                        {
                            name: "NTU Humanities International Postdoctoral Scholarship (HIPS)",
                            tags: ["Singapore"],
                            meta: "Singapore",
                            links: [{ label: "Scholarship", href: "https://www.ntu.edu.sg/hass/admissions/graduate-programmes/hips2025" }],
                        },
                    ],
                },
                {
                    type: "note",
                    tone: "tip",
                    title: "Get in touch early",
                    text: "Once you have an opportunity in mind and a rough project idea, write to us. We can then shape the application together and give it the best possible shot.",
                },
            ],
        },
    ],

    outro: {
        kicker: "Before you decide",
        title: "Don't rely on what is written",
        text: "Don't hesitate to ask any current or past [members of the team](#sec-people-full) what the lab is actually like.",
        actions: [
            {
                label: "Email the lab",
                href: "mailto:realitybending@sussex.ac.uk?subject=Joining%20the%20Reality%20Bending%20Lab",
                primary: true,
            },
            { label: "Meet the team", href: "#sec-people-full" },
        ],
    },
})
