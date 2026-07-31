/* honeycomb.js
 * Places hexagonal cells so they tessellate. Used by the Information section's
 * Services comb (information/services.js) and by the Research section's
 * Creations tools (research/creations.js).
 *
 * A honeycomb is not something `auto-fit` can produce: alternate rows have to
 * be offset by half a cell and hold one fewer of them. So the grid is given
 * `columns × 2` half-width tracks, every hexagon spans two, and this module
 * places each one explicitly by row and start column. Nothing is left to
 * auto-placement, which means nothing has to be measured afterwards either.
 *
 * Hexagons tessellate at a vertical pitch of ¾ of their height, not a full one.
 * The shortfall is written out as `pullVar` for the stylesheet to apply as a
 * negative bottom margin on every cell, computed in pixels because a percentage
 * margin resolves against the container's *width* and would drift with the
 * column count. Without it the offset rows read as a scatter of diamonds.
 *
 * What a caller has to provide in CSS, whatever its own prefix:
 *
 *   grid   `grid-template-columns: repeat(calc(var(columnsVar) * 2), 1fr)`,
 *          no column or row gap, `padding-bottom: var(pullVar)`
 *   cell   `grid-column-end: span 2`, `margin-bottom: calc(var(pullVar) * -1)`,
 *          and its padding is the seam between neighbours — a grid gap would
 *          make a one-track offset half a hexagon *plus half a gap*, and the
 *          rows would stop interlocking
 *   hex    `aspect-ratio: 0.8660254` (the reciprocal of HEX_RATIO below —
 *          change one, change the other)
 */

/* Height ÷ width of a regular pointy-top hexagon. */
export const HEX_RATIO = 2 / Math.sqrt(3)

/* In a honeycomb every neighbour is the same distance away, so a row's vertical
   spacing is the horizontal cell pitch turned through 60°. */
const ROW_SPACING_RATIO = Math.sqrt(3) / 2

/* `cells` is a function rather than an array because a caller may filter: it is
   asked again on every placement, and any cell that is `hidden` is skipped —
   which takes it out of grid layout entirely, so the comb closes up rather than
   leaving a hole where it was.
 *
 * Rows alternate full, one-short, full … which is what makes the offset row's
 * hexagons sit in the notches of the row above instead of hanging off the end
 * of it. A single column has no notches to sit in, so it is left as a plain
 * stack and takes no row pull.
 *
 * `centreRuns` centres a row that ran out of cells before it ran out of
 * columns, which can only be the last one. Off, it starts where every other row
 * starts, and a comb whose count leaves one over ends with a hexagon hanging
 * off the left. It is opt-in because it is a judgement about the shape of a
 * particular set rather than about honeycombs: with a filter over the comb the
 * last row's length changes on every press, and a row that slides sideways as
 * it shortens is worse than one that is simply short. */
export function createHoneycomb(grid, options) {
    const cells = options.cells
    const minWidth = options.minWidth
    const maxColumns = options.maxColumns
    const columnsVar = options.columnsVar
    const pullVar = options.pullVar
    const centreRuns = Boolean(options.centreRuns)

    let placedColumns = 0

    function columnsFor(width) {
        if (!width) return maxColumns
        return Math.max(1, Math.min(maxColumns, Math.floor(width / minWidth)))
    }

    function place() {
        const all = cells()
        const width = grid.clientWidth
        const columns = columnsFor(width)
        placedColumns = columns
        grid.style.setProperty(columnsVar, String(columns))

        /* The seam is read off a cell's own padding, so the stylesheet stays
           the one place it is set. */
        const seam = all.length ? parseFloat(getComputedStyle(all[0]).paddingTop) || 0 : 0
        const cellWidth = width / columns
        const cellHeight = (cellWidth - seam * 2) * HEX_RATIO + seam * 2

        /* Two hexagons side by side in a row are `cellWidth` apart centre to
           centre, seam included. Every other neighbour in a honeycomb sits at
           that same distance, so the row spacing is that pitch turned 60° —
           and the seam is carried through it automatically.

           Working from the hexagon's own height instead (¾ of it, plus the
           seam) tessellates the *shapes* perfectly and so leaves no vertical
           seam at all: the rows touch while the columns keep their few pixels,
           which is exactly what makes the horizontal gaps look wider. */
        const rowSpacing = cellWidth * ROW_SPACING_RATIO
        const pull = columns > 1 ? cellHeight - rowSpacing : 0
        grid.style.setProperty(pullVar, pull.toFixed(2) + "px")

        const visible = all.filter((cell) => !cell.hidden)
        let index = 0
        for (let row = 0; index < visible.length; row++) {
            const offset = columns > 1 && row % 2 === 1
            const perRow = offset ? columns - 1 : columns
            const run = visible.slice(index, index + perRow)
            // Whole tracks only: half a track would put the row out of step
            // with the notches it has to sit in.
            const centre = centreRuns ? Math.floor((perRow - run.length) / 2) : 0
            run.forEach((cell, column) => {
                cell.style.gridRow = String(row + 1)
                cell.style.gridColumnStart = String(1 + (offset ? 1 : 0) + (centre + column) * 2)
            })
            index += perRow
        }
    }

    return {
        place,
        /* Re-placing is only needed when the column count actually changes:
           `place()` alters the grid's height, which a ResizeObserver also sees,
           so re-placing on every resize has it chase its own tail. */
        needsReplace: () => columnsFor(grid.clientWidth) !== placedColumns,
    }
}
