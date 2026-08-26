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
        root.classList.remove("is-open")
        root.hidden = true
        image.src = ""
        image.alt = ""
        title.textContent = ""
        caption.textContent = ""
        meta.textContent = ""
    }

    backdrop.addEventListener("click", close)
    closeButton.addEventListener("click", close)
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && root.classList.contains("is-open")) {
            close()
        }
    })

    lightboxState = {
        root,
        image,
        title,
        caption,
        meta,
        closeButton,
        close,
    }

    return lightboxState
}

export function openImageLightbox({ src, alt = "", label = "Image viewer", title = "", caption = "", meta = "" }) {
    const lightbox = ensureLightbox()

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
