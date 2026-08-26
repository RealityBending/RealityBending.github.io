/* rain.js
 * Renders two Matrix-style falling-text rain animations on the landing
 * door screen (left and right canvases).  Each column cycles through a
 * fixed set of literary quotes displayed as vertically-falling characters.
 * Uses requestAnimationFrame with delta-time movement; cleans up its
 * ResizeObserver and animation loop when the door-screen transition ends.
 */
;(function () {
    // Split each quote into phrases that will fall as vertical columns
    const LEFT_PHRASES = ["If the doors of perception were cleansed,", "every thing would appear to man as it is,", "infinite"]

    const RIGHT_PHRASES = [
        "Do not try to bend the spoon, that's impossible",
        "instead, only try to realize the truth",
        "there is no spoon",
        "then you'll see it is not the spoon that bends",
        "it is only yourself",
    ]

    const landingScreen = document.getElementById("door-screen")

    /* A page opened at a real route never shows the door — index.html's
       bootstrap hides it before the first paint — so there is nothing for the
       rain to fall on. Worth an early return rather than a wasted loop: the
       stop below hangs off the door's own `transitionend`, and a door that was
       hidden rather than faded never fires one, so both canvases would keep
       animating for the entire visit behind the page the reader came for. */
    if (landingScreen && landingScreen.hidden) return

    function Rain(canvasId, phrases) {
        const canvas = document.getElementById(canvasId)
        if (!canvas) return null

        const ctx = canvas.getContext("2d", { alpha: true, desynchronized: true })
        if (!ctx) return null

        const FONT_SIZE = 14 // px per character row
        const MAX_PIXEL_RATIO = 1.5
        const SPEED = FONT_SIZE * 4.6 // px per second

        let cols, streams, phraseIdx
        let animationFrameId = 0
        let lastTime = 0
        let pixelRatio = 1
        let resizeObserver = null
        let stopped = false

        // nextPhrase always advances in order across all columns
        function nextPhrase() {
            const p = phrases[phraseIdx % phrases.length]
            phraseIdx++
            return p.split("").reverse()
        }

        function resize() {
            if (stopped) return

            pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
            canvas.width = Math.round(canvas.offsetWidth * pixelRatio)
            canvas.height = Math.round(canvas.offsetHeight * pixelRatio)
            ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
            ctx.textBaseline = "top"
            cols = Math.max(1, Math.floor(canvas.offsetWidth / (FONT_SIZE * 1.15)))
            phraseIdx = 0

            // Build streams with positions first, then sort by startY descending
            // so the stream closest to the bottom gets phrase 0 (exits first → appears first)
            const raw = Array.from({ length: cols }, (_, i) => ({
                x: i * (canvas.offsetWidth / cols) + FONT_SIZE * 0.3,
                startY: -Math.random() * (canvas.offsetHeight * 1.5),
            }))
            raw.sort((a, b) => b.startY - a.startY) // highest Y (least offscreen) first
            streams = raw.map((r) => ({ x: r.x, y: r.startY, chars: nextPhrase() }))
        }

        function drawFrame(now) {
            if (stopped) return

            animationFrameId = window.requestAnimationFrame(drawFrame)
            if (document.hidden) {
                lastTime = now
                return
            }

            const deltaSeconds = Math.min((now - lastTime || 16.67) / 1000, 0.05)
            lastTime = now

            ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
            ctx.font = `${FONT_SIZE}px "Courier New", monospace`

            for (const s of streams) {
                const totalHeight = s.chars.length * FONT_SIZE

                // Draw each character of the phrase top-to-bottom
                for (let ci = 0; ci < s.chars.length; ci++) {
                    const cy = s.y + ci * FONT_SIZE
                    if (cy < -FONT_SIZE || cy > canvas.offsetHeight) continue

                    // Brightest at the bottom (lead), fades toward top
                    const distFromLead = s.chars.length - 1 - ci
                    const alpha = Math.max(0, 0.9 - distFromLead * (0.9 / s.chars.length))
                    ctx.fillStyle = `rgba(255, 255, 255, ${alpha.toFixed(2)})`
                    ctx.fillText(s.chars[ci], s.x, cy)
                }

                s.y += SPEED * deltaSeconds

                // Once the whole phrase has exited the bottom, reset with next phrase
                if (s.y > canvas.offsetHeight + totalHeight) {
                    s.chars = nextPhrase()
                    s.y = -s.chars.length * FONT_SIZE - Math.random() * canvas.offsetHeight * 0.5
                }
            }
        }

        resizeObserver = new ResizeObserver(resize)
        resizeObserver.observe(canvas)
        resize()
        animationFrameId = window.requestAnimationFrame((now) => {
            lastTime = now
            drawFrame(now)
        })

        return () => {
            if (stopped) return

            stopped = true
            window.cancelAnimationFrame(animationFrameId)
            resizeObserver?.disconnect()
            ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)
        }
    }

    const stopLeftRain = Rain("rain-left", LEFT_PHRASES)
    const stopRightRain = Rain("rain-right", RIGHT_PHRASES)

    if (landingScreen) {
        const stopRain = (event) => {
            if (event.target !== landingScreen || event.propertyName !== "opacity") return

            stopLeftRain?.()
            stopRightRain?.()
            landingScreen.removeEventListener("transitionend", stopRain)
        }

        landingScreen.addEventListener("transitionend", stopRain)
    }
})()
