/* publications.js
 * Renders the Publications section from publications_manifest.json.
 */
;(function () {
    fetch("publications_manifest.json")
        .then((r) => r.json())
        .then((manifest) => {
            const container = document.getElementById("publications-list")
            if (!container) return

            const pubs = manifest.publications || []
            if (!pubs.length) {
                container.textContent = "No publications found."
                return
            }

            pubs.forEach((pub) => {
                const card = document.createElement("article")
                card.className = "pub-card"

                /* year pill */
                if (pub.year) {
                    const year = document.createElement("span")
                    year.className = "pub-card__year"
                    year.textContent = pub.year
                    card.appendChild(year)
                }

                /* title */
                const title = document.createElement("h3")
                title.className = "pub-card__title"
                if (pub.doi) {
                    const a = document.createElement("a")
                    a.href = "https://doi.org/" + encodeURIComponent(pub.doi)
                    a.target = "_blank"
                    a.rel = "noopener noreferrer"
                    a.textContent = pub.title
                    title.appendChild(a)
                } else {
                    title.textContent = pub.title
                }
                card.appendChild(title)

                /* journal + type */
                const meta = document.createElement("div")
                meta.className = "pub-card__meta"
                const parts = [pub.journal, pub.type].filter(Boolean)
                meta.textContent = parts.join(" · ")
                if (parts.length) card.appendChild(meta)

                /* action links row */
                const actions = document.createElement("div")
                actions.className = "pub-card__actions"

                if (pub.doi) {
                    const doiLink = document.createElement("a")
                    doiLink.className = "pub-card__action"
                    doiLink.href = "https://doi.org/" + encodeURIComponent(pub.doi)
                    doiLink.target = "_blank"
                    doiLink.rel = "noopener noreferrer"
                    doiLink.textContent = "DOI"
                    actions.appendChild(doiLink)
                }

                if (pub.pdf) {
                    const pdfLink = document.createElement("a")
                    pdfLink.className = "pub-card__action pub-card__action--pdf"
                    pdfLink.href = pub.pdf
                    pdfLink.target = "_blank"
                    pdfLink.rel = "noopener noreferrer"
                    pdfLink.textContent = "PDF"
                    actions.appendChild(pdfLink)
                }

                if (actions.children.length) card.appendChild(actions)

                /* Altmetric & Dimensions badges */
                if (pub.doi) {
                    const badges = document.createElement("div")
                    badges.className = "pub-card__badges"

                    const altmetric = document.createElement("div")
                    altmetric.className = "altmetric-embed"
                    altmetric.setAttribute("data-badge-type", "donut")
                    altmetric.setAttribute("data-badge-popover", "right")
                    altmetric.setAttribute("data-doi", pub.doi)
                    altmetric.setAttribute("data-hide-no-mentions", "true")
                    badges.appendChild(altmetric)

                    const dimensions = document.createElement("span")
                    dimensions.className = "__dimensions_badge_embed__"
                    dimensions.setAttribute("data-doi", pub.doi)
                    dimensions.setAttribute("data-style", "small_circle")
                    dimensions.setAttribute("data-hide-zero-citations", "true")
                    badges.appendChild(dimensions)

                    card.appendChild(badges)
                }

                container.appendChild(card)
            })

            /* Trigger badge scripts to scan the newly added DOI elements */
            if (typeof _altmetric_embed_init === "function") {
                _altmetric_embed_init()
            }
            if (typeof __dimensions_embed !== "undefined" && typeof __dimensions_embed.addBadges === "function") {
                __dimensions_embed.addBadges()
            }
        })
        .catch((err) => {
            console.warn("publications.js: could not load manifest", err)
        })
})()
