/* media-lightbox.js
 * The full-size image viewer. One singleton, opened from the Memories gallery
 * and from the memories strip in a profile panel.
 *
 * ── It knows nothing about routes, and that is on purpose ──
 * A memory has a shareable URL (`/people/memories/<slug>/`), and so the thing
 * that opens the viewer has to write one — but *which* route to write back on
 * close depends on where the reader was: the Memories tab writes
 * `people-memories`, a profile panel writes the member's own folder, and a
 * viewer that decided this for itself would send the second reader to the wrong
 * place. So the caller passes `onClose` and owns both halves.
 *
 * `onClose` runs for every way out — the ✕, the backdrop and Escape — which is
 * the whole reason it is a callback here rather than three listeners over
 * there. */

let lightboxState = null

function ensureLightbox() {
    if (lightboxState) return lightboxState

    const root = document.createElement("div")
    root.className = "media-lightbox"
    root.setAttribute("role", "dialog")
    root.setAttribute("aria-modal", "true")
    root.hidden = true
    root.innerHTML = `
        <div class="media-lightbox__backdrop"></div>
        <div class="media-lightbox__frame">
            <button class="media-lightbox__close" aria-label="Close">&times;</button>
            <img class="media-lightbox__img" src="" alt="" />
            <div class="media-lightbox__info">
                <p class="media-lightbox__title"></p>
                <p class="media-lightbox__caption"></p>
                <p class="media-lightbox__meta"></p>
            </div>
        </div>
    `

    document.body.appendChild(root)

    const backdrop = root.querySelector(".media-lightbox__backdrop")
    const closeButton = root.querySelector(".media-lightbox__close")
    const image = root.querySelector(".media-lightbox__img")
    const title = root.querySelector(".media-lightbox__title")
    const caption = root.querySelector(".media-lightbox__caption")
    const meta = root.querySelector(".media-lightbox__meta")

    function close() {
        // Read and cleared *before* the callback runs: the caller's handler
        // normally writes a route, and a route write can re-open this viewer.
        const onClose = lightboxState && lightboxState.onClose
        if (lightboxState) lightboxState.onClose = null

        root.classList.remove("is-open")
        root.hidden = true
        image.src = ""
        image.alt = ""
        title.textContent = ""
        caption.textContent = ""
        meta.textContent = ""
        root.removeAttribute("data-memory")

        if (onClose) onClose()
    }

    backdrop.addEventListener("click", close)
    closeButton.addEventListener("click", close)
    /* ── Escape closes the top layer only, and that needs the capture phase ──
     * The profile panel has its own document-level Escape handler, and this
     * viewer opens *over* it (a memory in the panel's own strip). Both fire for
     * the same key, so one press was closing both and leaving the URL naming a
     * profile nobody was looking at.
     *
     * A live `is-open` test in the other handler cannot fix it, because the
     * answer depends on which listener ran first. Capture is what makes the
     * order fixed: a capture listener on `document` runs before every bubbling
     * one, so this closes first and marks the event, and people.js bails on
     * `defaultPrevented`. A second press then reaches the panel. */
    document.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Escape" && root.classList.contains("is-open")) {
                event.preventDefault()
                close()
            }
        },
        true,
    )

    lightboxState = {
        root,
        image,
        title,
        caption,
        meta,
        closeButton,
        close,
        onClose: null,
    }

    return lightboxState
}

/* `id` is the open thing's identity, kept on the element so a route naming
   whatever is already on screen can be recognised and left alone rather than
   rebuilt under the reader — the same idempotence contract the profile panel
   and the news reader work to (CLAUDE.md, "Shareable URLs"). */
export function isImageLightboxOpen(id) {
    return Boolean(lightboxState && lightboxState.root.classList.contains("is-open") && (!id || lightboxState.root.dataset.memory === id))
}

export function closeImageLightbox({ silent = false } = {}) {
    if (!lightboxState || !lightboxState.root.classList.contains("is-open")) return
    if (silent) lightboxState.onClose = null
    lightboxState.close()
}

export function openImageLightbox({ src, alt = "", label = "Image viewer", title = "", caption = "", meta = "", id = "", onClose = null }) {
    const lightbox = ensureLightbox()

    lightbox.onClose = onClose
    if (id) lightbox.root.dataset.memory = id
    else lightbox.root.removeAttribute("data-memory")
    lightbox.root.setAttribute("aria-label", label)
    lightbox.image.src = src
    lightbox.image.alt = alt
    lightbox.title.textContent = title
    lightbox.caption.textContent = caption
    lightbox.meta.textContent = meta
    lightbox.root.hidden = false
    lightbox.root.classList.add("is-open")
    lightbox.closeButton.focus()
}
