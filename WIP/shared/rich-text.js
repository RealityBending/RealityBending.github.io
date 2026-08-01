/* rich-text.js
 * The small markup dialect the Information section's content modules are
 * written in. Factored out of join.js so the Services tab renders prose the
 * same way the Join tab does.
 *
 * Everything here builds DOM nodes rather than assigning innerHTML — the
 * content modules are plain text, and a stray "<" in a workshop title should
 * not be able to open an element. The inline parser is the one place markup is
 * produced at all, and it only ever emits <a>, <em> and <strong>.
 *
 * Class names differ per tab (join-link vs services-link), so the parsers are
 * handed out by createRichText() with those baked in. That keeps every call
 * site free of an options argument it would otherwise have to repeat.
 */

/* Re-exported rather than defined here: four modules had their own copy of it,
   and the ones outside this section should not have to import the dialect below
   to get six lines of DOM sugar. See shared/dom.js. */
export { element } from "./dom.js"
import { element } from "./dom.js"

/* ── Inline markup ──
 * `[label](href)`, `*emphasis*`, `**strong**` and `***both***`, and nothing
 * else. Enough to keep a link inside a sentence without handing the content
 * file the power to inject markup.
 *
 * The asterisk runs are alternatives rather than one nestable rule, longest
 * first — `**bold**` matched by the single-asterisk rule would otherwise take
 * the *second* star as its opener and leave stray ones on either side.
 */
const INLINE_PATTERN = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*\*([^*]+)\*\*\*|\*\*([^*]+)\*\*|\*([^*]+)\*/g

export function createRichText(options = {}) {
    const linkClass = options.linkClass || null
    const listClass = options.listClass || null

    /* In-page anchors and mailto links must not open a new tab; everything else
       points off-site and should. */
    function createLink(label, href) {
        const anchor = element("a", linkClass, label)
        anchor.href = href

        if (!/^(#|mailto:)/.test(href)) {
            anchor.target = "_blank"
            anchor.rel = "noreferrer noopener"
        }

        return anchor
    }

    function appendRichText(parent, text) {
        if (!text) return parent

        let cursor = 0
        let match

        INLINE_PATTERN.lastIndex = 0
        while ((match = INLINE_PATTERN.exec(text)) !== null) {
            if (match.index > cursor) {
                parent.appendChild(document.createTextNode(text.slice(cursor, match.index)))
            }

            if (match[1]) {
                parent.appendChild(createLink(match[1], match[2]))
            } else if (match[3]) {
                const strong = document.createElement("strong")
                strong.appendChild(element("em", null, match[3]))
                parent.appendChild(strong)
            } else {
                parent.appendChild(element(match[4] ? "strong" : "em", null, match[4] || match[5]))
            }

            cursor = match.index + match[0].length
        }

        if (cursor < text.length) {
            parent.appendChild(document.createTextNode(text.slice(cursor)))
        }

        return parent
    }

    function paragraph(className, text) {
        return appendRichText(element("p", className), text)
    }

    /* ── Block-level markup ──
     * A blank line starts a new paragraph; a run of lines opening "- " becomes
     * a list. That is the whole grammar — enough for a lede that wants to make
     * a few points without the content module having to hand-build DOM.
     *
     * Lines are trimmed individually rather than dedented against a common
     * prefix, because these are written as template literals: the first line
     * sits against the backtick with no indentation at all, so a common prefix
     * would always be empty and dedent nothing.
     */
    function appendRichBlocks(container, text) {
        if (!text) return container

        let pending = []
        let list = null

        function flushParagraph() {
            if (!pending.length) return
            container.appendChild(paragraph(null, pending.join(" ")))
            pending = []
        }

        String(text)
            .split("\n")
            .map((line) => line.trim())
            .forEach((line) => {
                if (!line) {
                    flushParagraph()
                    list = null
                    return
                }

                // A plain dash, or the author's own emoji used as the bullet — a
                // "✅" list keeps its ticks instead of being given generic dots.
                // The required space is what keeps this off "*emphasis*" at the
                // start of a line.
                // ️ and ‍ are U+FE0F and U+200D, the variation selector
                // and zero-width joiner, so a compound emoji is taken whole
                // rather than being split into its parts.
                const bullet = /^([-–—*•]|[\p{Extended_Pictographic}️‍]+)\s+(.*)$/u.exec(line)
                if (bullet) {
                    flushParagraph()
                    if (!list) {
                        list = element("ul", listClass)
                        container.appendChild(list)
                    }
                    const item = appendRichText(element("li"), bullet[2])
                    if (!/^[-–—*•]$/.test(bullet[1])) item.dataset.marker = bullet[1]
                    list.appendChild(item)
                    return
                }

                list = null
                pending.push(line)
            })

        flushParagraph()
        return container
    }

    return { createLink, appendRichText, paragraph, appendRichBlocks }
}
