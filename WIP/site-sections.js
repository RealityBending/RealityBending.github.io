export const SITE_SECTIONS = Object.freeze([
    {
        id: "sec-research",
        navHref: "#sec-research-full",
        scrollTargetId: "sec-research-full",
        pageSectionId: "sec-research-full",
        brainRegionIndex: 4,
        colorVar: "--section-research",
        colorHex: "#33cccc",
        atlasColor: "rgba(51, 204, 204, 0.9)",
        atlasDisplayRange: [300, 360],
        atlasHitRange: [240, 300],
        brainLabel: "Research →",
        viewAzimuth: -Math.PI / 2,
        viewPolar: 1.0,
        regionTest: (nx, ny, nz) => nx < 0.48 && ny > 0.58 && nz >= 0.3 && nz <= 0.62,
    },
    {
        id: "sec-people",
        // The section, not the hero button that shares the id — see sec-contact.
        navHref: "#sec-people-full",
        scrollTargetId: "sec-people-full",
        pageSectionId: "sec-people-full",
        brainRegionIndex: 0,
        colorVar: "--section-people",
        colorHex: "#aa55ff",
        atlasColor: "rgba(170, 85, 255, 0.9)",
        atlasDisplayRange: [60, 120],
        atlasHitRange: [0, 60],
        brainLabel: "People →",
        viewAzimuth: Math.PI,
        viewPolar: 1.25,
        regionTest: (nx, ny, nz) => nz < 0.38 && ny > 0.38,
    },
    {
        id: "sec-blog",
        navHref: "#sec-blog",
        scrollTargetId: "sec-blog",
        pageSectionId: null,
        brainRegionIndex: 5,
        colorVar: "--section-blog",
        colorHex: "#55cc77",
        atlasColor: "rgba(85, 204, 119, 0.88)",
        atlasDisplayRange: [0, 60],
        atlasHitRange: [300, 360],
        brainLabel: "Blog →",
        viewAzimuth: -Math.PI / 2,
        viewPolar: Math.PI / 2,
        regionTest: (nx, ny, nz) => nx < 0.48 && ny >= 0.18 && ny < 0.58 && nz > 0.35 && nz < 0.7,
    },
    {
        id: "sec-publications",
        // The section, not the hero button that shares the id — see sec-contact.
        navHref: "#sec-publications-full",
        scrollTargetId: "sec-publications-full",
        pageSectionId: "sec-publications-full",
        brainRegionIndex: 1,
        colorVar: "--section-publications",
        colorHex: "#5599ff",
        atlasColor: "rgba(85, 153, 255, 0.88)",
        atlasDisplayRange: [120, 180],
        atlasHitRange: [60, 120],
        brainLabel: "Publications →",
        viewAzimuth: Math.PI / 2,
        viewPolar: 1.0,
        regionTest: (nx, ny, nz) => nx > 0.52 && ny > 0.58 && nz >= 0.3 && nz <= 0.62,
    },
    {
        id: "sec-tour",
        navHref: "#sec-tour",
        scrollTargetId: "sec-tour",
        pageSectionId: null,
        brainRegionIndex: 3,
        colorVar: "--section-tour",
        colorHex: "#ff9933",
        atlasColor: "rgba(255, 153, 51, 0.88)",
        atlasDisplayRange: [240, 300],
        atlasHitRange: [180, 240],
        brainLabel: "Tour →",
        viewAzimuth: 0,
        viewPolar: 1.25,
        regionTest: (nx, ny, nz) => nz > 0.62 && ny > 0.35,
    },
    {
        id: "sec-contact",
        // The section, not the hero button that shares the "sec-contact" id —
        // the nav link is an anchor, so it goes wherever this points.
        navHref: "#sec-contact-full",
        scrollTargetId: "sec-contact-full",
        pageSectionId: "sec-contact-full",
        brainRegionIndex: 2,
        colorVar: "--section-contact",
        colorHex: "#ff5555",
        atlasColor: "rgba(255, 85, 85, 0.88)",
        atlasDisplayRange: [180, 240],
        atlasHitRange: [120, 180],
        brainLabel: "Information →",
        viewAzimuth: Math.PI / 2,
        viewPolar: Math.PI / 2,
        regionTest: (nx, ny, nz) => nx > 0.52 && ny >= 0.18 && ny < 0.58 && nz > 0.35 && nz < 0.7,
    },
])

export const SECTION_BY_ID = new Map(SITE_SECTIONS.map((section) => [section.id, section]))

export const ACTIVE_NAV_SECTIONS = SITE_SECTIONS.filter((section) => section.pageSectionId).map((section) => ({
    sectionId: section.id,
    navHref: section.navHref,
    pageSectionId: section.pageSectionId,
}))

export const ATLAS_HIT_SECTORS = SITE_SECTIONS.map((section) => ({
    id: section.id,
    start: section.atlasHitRange[0],
    end: section.atlasHitRange[1],
}))

function buildAtlasRangeGradient(range, color) {
    const [start, end] = range
    return `conic-gradient(from -60deg, transparent 0deg ${start}deg, ${color} ${start}deg ${end}deg, transparent ${end}deg 360deg)`
}

export function buildAtlasBaseGradient() {
    const stops = SITE_SECTIONS.slice()
        .sort((left, right) => left.atlasDisplayRange[0] - right.atlasDisplayRange[0])
        .map((section) => `${section.atlasColor} ${section.atlasDisplayRange[0]}deg ${section.atlasDisplayRange[1]}deg`)

    return `conic-gradient(from -60deg, ${stops.join(", ")})`
}

export function buildAtlasHighlightGradient(sectionId) {
    const section = SECTION_BY_ID.get(sectionId)
    return section ? buildAtlasRangeGradient(section.atlasDisplayRange, section.atlasColor) : "transparent"
}

export function applySectionTheme(doc = document) {
    SITE_SECTIONS.forEach((section) => {
        const navLink = doc.querySelector(`nav a[href="${section.navHref}"]`)
        if (navLink) {
            navLink.classList.add("nav-link")
            navLink.dataset.sectionId = section.id
            navLink.style.setProperty("--section-color", `var(${section.colorVar})`)
        }

        const heroSection = doc.getElementById(section.id)
        if (heroSection) {
            heroSection.style.setProperty("--section-color", `var(${section.colorVar})`)
        }
    })

    const atlas = doc.querySelector(".brain-atlas")
    if (atlas) {
        atlas.style.setProperty("--atlas-sector-gradient", buildAtlasBaseGradient())
        atlas.style.setProperty("--atlas-active-gradient", "transparent")
    }
}
