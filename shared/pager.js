/* pager.js
 * The one pager on this site: ← "Page N of M" →, styled in css/07-shared.css
 * under `.pager`. News and Publications both use it.
 *
 * It **owns no state**. The caller already holds a page number — it has to, to
 * slice its own list — so a second copy in here is one more thing that can
 * drift; `render(page, pages)` is told the truth every time the list is drawn
 * and the arrows only ever hand back a number. That is also what makes it safe
 * for a caller whose page can move without the pager being touched, which is
 * every filter and every re-sort.
 *
 * It hides itself below two pages. A pager over a single page is two dead
 * arrows and a tautology.
 *
 * It is a `div` with `role="navigation"`, never a `<nav>`: the stylesheet
 * dresses bare `nav` as *the* site navigation — fixed, cream, and a 14rem
 * sidebar past 1800px — and any second one on the page picks all of that up.
 * Same trap the zoom's landmark rail fell into.
 */

function arrow(direction, glyph, label) {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "pager__btn pager__btn--" + direction
    button.setAttribute("aria-label", label)
    button.textContent = glyph
    return button
}

export function createPager({ onChange, ariaLabel = "Pagination" }) {
    const el = document.createElement("div")
    el.className = "pager"
    el.setAttribute("role", "navigation")
    el.setAttribute("aria-label", ariaLabel)

    const prev = arrow("prev", "←", "Previous page")
    const position = document.createElement("span")
    position.className = "pager__position"
    const next = arrow("next", "→", "Next page")
    el.append(prev, position, next)

    // The last numbers render() was given. Not the source of truth — the
    // caller's are — only what the arrows need to know to name their target.
    let page = 0
    let pages = 1

    prev.addEventListener("click", () => {
        if (page > 0) onChange(page - 1)
    })
    next.addEventListener("click", () => {
        if (page < pages - 1) onChange(page + 1)
    })

    return {
        el,
        render(nextPage, nextPages) {
            pages = Math.max(1, nextPages)
            page = Math.min(Math.max(0, nextPage), pages - 1)
            position.textContent = "Page " + (page + 1) + " of " + pages
            prev.disabled = page === 0
            next.disabled = page >= pages - 1
            el.hidden = pages <= 1
        },
    }
}
