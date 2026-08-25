/* dom.js
 * The one helper every module that builds its own markup had a copy of.
 *
 * `element("p", "news-card__summary", post.summary)` — tag, class, text, in the
 * order they are thought of. It existed four times over, byte for byte, in
 * news.js, creations.js, reality-zoom.js and shared/rich-text.js, which is
 * three copies too many for six lines that will never diverge.
 *
 * **`textContent`, never `innerHTML`** — that is the whole reason this shape is
 * worth having rather than a template string. Content on this site is plain
 * text in a JS module or a JSON file, and a stray "<" in a scholarship name, a
 * paper title or a tool's description must not be able to open an element. The
 * two places markup is genuinely wanted are explicit about it and say so:
 * `news.js`'s `renderContent` (a post's body *is* HTML, see the News notes) and
 * `rich-text.js`'s inline parser, which only ever emits <a>, <em> and <strong>.
 *
 * It lives here rather than in rich-text.js — where it used to be exported
 * from — so that a module wanting six lines of DOM sugar does not have to pull
 * in the Information section's markup dialect to get them. rich-text.js
 * re-exports it, so its own callers are unchanged.
 */

export function element(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text != null) node.textContent = text
    return node
}
