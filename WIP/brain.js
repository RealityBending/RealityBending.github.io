/* brain.js
 * Loads and renders the interactive 3-D brain mesh in the hero section.
 * Uses Three.js with OrbitControls and post-processing (OutlinePass) to
 * display a GLTF brain model.  Region hover events are synchronised with
 * the surrounding brain-atlas wedges and section cards via shared region
 * data attributes on the .brain-atlas element.
 */
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js"
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js"
import { RenderPass } from "three/addons/postprocessing/RenderPass.js"
import { OutlinePass } from "three/addons/postprocessing/OutlinePass.js"
import { OutputPass } from "three/addons/postprocessing/OutputPass.js"
import { ATLAS_HIT_SECTORS, SECTION_BY_ID, SITE_SECTIONS, buildAtlasHighlightGradient } from "./site-sections.js"

const container = document.getElementById("brain-viewer")
const atlas = document.querySelector(".brain-atlas")
const MAX_PIXEL_RATIO = 2
const INTERACTION_PIXEL_RATIO = 1.15
let isUserInteracting = false
let currentPixelRatio = Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO)

// ── Renderer ───────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" })
renderer.setPixelRatio(currentPixelRatio)
renderer.setSize(container.clientWidth, container.clientHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
container.appendChild(renderer.domElement)

// ── Scene & Camera ─────────────────────────────────────────────────────────
const scene = new THREE.Scene()
const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.001, 1000)
camera.position.set(0, 0, 3)

// ── Lighting ───────────────────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0xffffff, 1.8)
const keyLight = new THREE.DirectionalLight(0xffffff, 2.5)
keyLight.position.set(3, 4, 5)
const fillLight = new THREE.DirectionalLight(0xffffff, 0.8)
fillLight.position.set(-3, -2, -2)
scene.add(ambient, keyLight, fillLight)

// ── Controls ───────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.dampingFactor = 0.07
controls.autoRotate = true
controls.autoRotateSpeed = 1.5

// ── Post-processing ────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))

const outlinePass = new OutlinePass(new THREE.Vector2(container.clientWidth, container.clientHeight), scene, camera)
outlinePass.edgeStrength = 3.5
outlinePass.edgeGlow = 0
outlinePass.edgeThickness = 1.5
outlinePass.pulsePeriod = 0
outlinePass.visibleEdgeColor.set("#2a2a2a")
outlinePass.hiddenEdgeColor.set("#111111")
composer.addPass(outlinePass)
composer.addPass(new OutputPass())

function syncRendererResolution() {
    const nextPixelRatio = Math.min(window.devicePixelRatio, isUserInteracting ? INTERACTION_PIXEL_RATIO : MAX_PIXEL_RATIO)
    if (currentPixelRatio === nextPixelRatio) return

    currentPixelRatio = nextPixelRatio
    renderer.setPixelRatio(currentPixelRatio)
    composer.setPixelRatio(currentPixelRatio)
    composer.setSize(container.clientWidth, container.clientHeight)
}

// ── Brain regions ──────────────────────────────────────────────────────────
// Axes in normalised [0,1] box space after centring:
//   nx = left(0) → right(1),  ny = bottom(0) → top(1),  nz = back(0) → front(1)
// Adjust thresholds to match your model's anatomy.
// nx = left(0)→right(1), ny = bottom(0)→top(1), nz = back(0)→front(1)
const REGIONS = SITE_SECTIONS.map((section) => ({
    id: section.id,
    label: section.brainLabel,
    color: new THREE.Color(section.colorHex),
    highlightIndex: section.brainRegionIndex,
    test: section.regionTest,
    viewAzimuth: section.viewAzimuth,
    viewPolar: section.viewPolar,
    scrollTargetId: section.scrollTargetId,
})).concat([
    {
        id: "easter-egg",
        label: "🧠 ???",
        color: new THREE.Color(0xffcc00),
        highlightIndex: 6,
        test: (nx, ny, nz) => ny < 0.18,
        isEasterEgg: true,
        viewAzimuth: Math.PI,
        viewPolar: 2.0,
        scrollTargetId: "easteregg.html",
    },
])
const regionsById = new Map(REGIONS.map((region) => [region.id, region]))
const sectionElements = new Map(REGIONS.map((region) => [region.id, document.getElementById(region.id)]))
const atlasCenter = atlas.querySelector(".brain-atlas__center")
const ATLAS_SECTORS = ATLAS_HIT_SECTORS

// ── Shared highlight uniforms ──────────────────────────────────────────────
// One object shared by every mesh material — updating .value here affects all.
const H = {
    uBoxMin: { value: new THREE.Vector3() },
    uBoxSize: { value: new THREE.Vector3() },
    uActiveRegion: { value: -1 },
    uHighlightColor: { value: new THREE.Color(0x6aacff) },
    uHighlightStrength: { value: 0.0 },
}
let strengthTarget = 0.0

// ── Custom shader material ─────────────────────────────────────────────────
// Injects highlight logic into MeshStandardMaterial so we keep PBR lighting.
function makeBrainMaterial() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xd4a9a0, roughness: 0.75, metalness: 0.05 })

    mat.onBeforeCompile = (shader) => {
        // Attach our shared uniforms to this shader instance
        Object.assign(shader.uniforms, H)

        // Vertex: export world-space position as varying
        shader.vertexShader = "varying vec3 vWorldPos;\n" + shader.vertexShader
        shader.vertexShader = shader.vertexShader.replace(
            "#include <begin_vertex>",
            `#include <begin_vertex>
            vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;`,
        )

        // Fragment: declare varying + custom uniforms
        shader.fragmentShader = "varying vec3 vWorldPos;\n" + shader.fragmentShader
        shader.fragmentShader = shader.fragmentShader.replace(
            "void main() {",
            `uniform vec3  uBoxMin;
            uniform vec3  uBoxSize;
            uniform int   uActiveRegion;
            uniform vec3  uHighlightColor;
            uniform float uHighlightStrength;
            void main() {`,
        )

        // Fragment: blend highlight colour into diffuseColor before lighting
        // Each region uses smoothstep for soft boundaries.
        shader.fragmentShader = shader.fragmentShader.replace(
            "#include <color_fragment>",
            `#include <color_fragment>
            if (uActiveRegion >= 0 && uHighlightStrength > 0.001) {
                vec3  n  = clamp((vWorldPos - uBoxMin) / uBoxSize, 0.0, 1.0);
                float nx = n.x, ny = n.y, nz = n.z;
                float blend = 0.0;
                if (uActiveRegion == 0) {
                      // Bilateral prefrontal cortex (low nz = anterior in this model)
                      blend = (1.0 - smoothstep(0.32, 0.42, nz))
                          * smoothstep(0.34, 0.44, ny);
                } else if (uActiveRegion == 1) {
                      // Right parietal cortex
                      blend = smoothstep(0.48, 0.58, nx)
                          * smoothstep(0.54, 0.64, ny)
                          * smoothstep(0.26, 0.36, nz)
                          * (1.0 - smoothstep(0.58, 0.68, nz));
                } else if (uActiveRegion == 2) {
                      // Right temporal cortex
                      blend = smoothstep(0.48, 0.58, nx)
                          * smoothstep(0.14, 0.24, ny)
                          * (1.0 - smoothstep(0.52, 0.62, ny))
                          * smoothstep(0.30, 0.40, nz)
                          * (1.0 - smoothstep(0.64, 0.74, nz));
                } else if (uActiveRegion == 3) {
                      // Bilateral occipital cortex (high nz = posterior in this model)
                      blend = smoothstep(0.58, 0.68, nz)
                          * smoothstep(0.30, 0.40, ny);
                } else if (uActiveRegion == 4) {
                      // Left parietal cortex
                      blend = (1.0 - smoothstep(0.42, 0.52, nx))
                          * smoothstep(0.54, 0.64, ny)
                          * smoothstep(0.26, 0.36, nz)
                          * (1.0 - smoothstep(0.58, 0.68, nz));
                } else if (uActiveRegion == 5) {
                      // Left temporal cortex
                      blend = (1.0 - smoothstep(0.42, 0.52, nx))
                          * smoothstep(0.14, 0.24, ny)
                          * (1.0 - smoothstep(0.52, 0.62, ny))
                          * smoothstep(0.30, 0.40, nz)
                          * (1.0 - smoothstep(0.64, 0.74, nz));
                } else if (uActiveRegion == 6) {
                      // Brain stem (bottom of the brain)
                      blend = (1.0 - smoothstep(0.12, 0.22, ny));
                }
                if (blend > 0.001) {
                    diffuseColor.rgb = mix(diffuseColor.rgb, uHighlightColor, blend * uHighlightStrength * 0.72);
                }
            }`,
        )
    }
    return mat
}

// ── Load model ─────────────────────────────────────────────────────────────
let brainMeshes = []
let brainBox = new THREE.Box3()
let brainSize = new THREE.Vector3()
let brainMin = new THREE.Vector3()
let activeRegionId = null
const GLB_MAGIC = 0x46546c67
const GLB_VERSION = 2
const GLB_JSON_CHUNK_TYPE = 0x4e4f534a
const GLB_JSON_PADDING_BYTE = 0x20

function setActiveRegion(region) {
    const nextRegionId = region?.id ?? null
    if (activeRegionId === nextRegionId) return

    activeRegionId = nextRegionId

    if (atlas) {
        if (nextRegionId) {
            atlas.dataset.activeRegion = nextRegionId
            atlas.style.setProperty("--atlas-active-gradient", buildAtlasHighlightGradient(nextRegionId))
        } else {
            delete atlas.dataset.activeRegion
            atlas.style.setProperty("--atlas-active-gradient", "transparent")
        }
    }

    sectionElements.forEach((element, id) => {
        element?.classList.toggle("is-highlighted", id === nextRegionId)
    })
}

function highlightRegion(region) {
    H.uActiveRegion.value = region.highlightIndex
    H.uHighlightColor.value.copy(region.color)
    strengthTarget = 1.0
    setActiveRegion(region)
}

function clearHighlight() {
    strengthTarget = 0.0
    setActiveRegion(null)
}

// ── Camera lock-in on section hover ────────────────────────────────────────
// When the pointer is over a section card, smoothly rotate the brain to the
// optimal viewing angle for that region.  Unlocking resumes auto-rotate.
let lockedView = null
const _lockSpherical = new THREE.Spherical()
const LOCK_LERP = 0.08

function lockCamera(region) {
    if (region && region.viewAzimuth !== undefined) {
        lockedView = { azimuth: region.viewAzimuth, polar: region.viewPolar }
        controls.autoRotate = false
    }
}

function unlockCamera() {
    lockedView = null
    controls.autoRotate = true
}

// ── 3-D region detection from raycast hit ──────────────────────────────────
// Uses the actual world-space hit point on the brain surface, normalised into
// the bounding box, then tested against each region's anatomical bounds.
// This stays correct regardless of camera rotation / auto-rotate.

function regionFromHit(hit) {
    const p = hit.point
    const nx = (p.x - brainMin.x) / brainSize.x
    const ny = (p.y - brainMin.y) / brainSize.y
    const nz = (p.z - brainMin.z) / brainSize.z
    for (const r of REGIONS) {
        if (r.test(nx, ny, nz)) return r
    }
    return null
}

// Keyboard focus on sections (accessibility)
sectionElements.forEach((element, id) => {
    if (!element) return
    const region = regionsById.get(id)
    if (!region) return
    element.addEventListener("focusin", () => {
        highlightRegion(region)
        lockCamera(region)
    })
    element.addEventListener("focusout", () => {
        clearHighlight()
        unlockCamera()
    })
})

const loader = new GLTFLoader()

function sanitizeBrainGlb(arrayBuffer) {
    const view = new DataView(arrayBuffer)
    if (view.byteLength < 20) return arrayBuffer
    if (view.getUint32(0, true) !== GLB_MAGIC || view.getUint32(4, true) !== GLB_VERSION) return arrayBuffer

    const chunks = []
    let offset = 12

    while (offset + 8 <= view.byteLength) {
        const chunkLength = view.getUint32(offset, true)
        offset += 4

        const chunkType = view.getUint32(offset, true)
        offset += 4

        chunks.push({
            type: chunkType,
            data: arrayBuffer.slice(offset, offset + chunkLength),
        })
        offset += chunkLength
    }

    const jsonChunk = chunks.find((chunk) => chunk.type === GLB_JSON_CHUNK_TYPE)
    if (!jsonChunk) return arrayBuffer

    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    const gltf = JSON.parse(
        decoder
            .decode(jsonChunk.data)
            .replace(/\u0000+$/g, "")
            .trimEnd(),
    )
    let didChange = false

    ;["extensionsUsed", "extensionsRequired"].forEach((key) => {
        if (!Array.isArray(gltf[key])) return

        const filtered = gltf[key].filter((name) => name !== "KHR_materials_pbrSpecularGlossiness")
        if (filtered.length === gltf[key].length) return

        didChange = true
        if (filtered.length) {
            gltf[key] = filtered
        } else {
            delete gltf[key]
        }
    })

    if (Array.isArray(gltf.materials)) {
        gltf.materials = gltf.materials.map((material) => {
            if (!material?.extensions?.KHR_materials_pbrSpecularGlossiness) {
                return material
            }

            didChange = true

            const nextMaterial = { ...material }
            const nextExtensions = { ...nextMaterial.extensions }
            delete nextExtensions.KHR_materials_pbrSpecularGlossiness

            if (Object.keys(nextExtensions).length) {
                nextMaterial.extensions = nextExtensions
            } else {
                delete nextMaterial.extensions
            }

            if (!nextMaterial.pbrMetallicRoughness) {
                nextMaterial.pbrMetallicRoughness = {}
            }

            return nextMaterial
        })
    }

    if (!didChange) return arrayBuffer

    const jsonBytes = encoder.encode(JSON.stringify(gltf))
    const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4
    const totalLength =
        12 + chunks.reduce((sum, chunk) => sum + 8 + (chunk.type === GLB_JSON_CHUNK_TYPE ? paddedJsonLength : chunk.data.byteLength), 0)
    const output = new Uint8Array(totalLength)
    const outputView = new DataView(output.buffer)

    outputView.setUint32(0, GLB_MAGIC, true)
    outputView.setUint32(4, GLB_VERSION, true)
    outputView.setUint32(8, totalLength, true)

    offset = 12
    chunks.forEach((chunk) => {
        const source = chunk.type === GLB_JSON_CHUNK_TYPE ? jsonBytes : new Uint8Array(chunk.data)
        const chunkLength = chunk.type === GLB_JSON_CHUNK_TYPE ? paddedJsonLength : source.byteLength

        outputView.setUint32(offset, chunkLength, true)
        offset += 4
        outputView.setUint32(offset, chunk.type, true)
        offset += 4
        output.set(source, offset)

        if (chunk.type === GLB_JSON_CHUNK_TYPE) {
            output.fill(GLB_JSON_PADDING_BYTE, offset + source.byteLength, offset + chunkLength)
        }

        offset += chunkLength
    })

    return output.buffer
}

function handleBrainLoad(gltf) {
    const model = gltf.scene

    brainBox.setFromObject(model)
    const centre = brainBox.getCenter(new THREE.Vector3())
    const size = brainBox.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    model.position.sub(centre)

    // Recompute after centring and push into uniforms
    brainBox.setFromObject(model)
    brainBox.getSize(brainSize)
    brainMin.copy(brainBox.min)
    H.uBoxMin.value.copy(brainMin)
    H.uBoxSize.value.copy(brainSize)

    camera.position.z = maxDim * 1.8
    camera.near = maxDim * 0.01
    camera.far = maxDim * 100
    camera.updateProjectionMatrix()
    controls.maxDistance = maxDim * 5
    controls.minDistance = maxDim * 0.4

    model.traverse((child) => {
        if (child.isMesh) {
            child.material = makeBrainMaterial()
            brainMeshes.push(child)
        }
    })
    outlinePass.selectedObjects = brainMeshes
    scene.add(model)
}

function loadBrainModel() {
    fetch("img/brain.glb")
        .then((response) => {
            if (!response.ok) {
                throw new Error("Could not load brain model.")
            }

            return response.arrayBuffer()
        })
        .then((arrayBuffer) => sanitizeBrainGlb(arrayBuffer))
        .then(
            (arrayBuffer) =>
                new Promise((resolve, reject) => {
                    loader.parse(arrayBuffer, document.baseURI, resolve, reject)
                }),
        )
        .then(handleBrainLoad)
        .catch((error) => {
            console.error("brain.js: failed to load sanitized brain model", error)
        })
}

loadBrainModel()

// ── Mouse interaction ──────────────────────────────────────────────────────
// Single pointermove on the atlas container resolves all highlight logic,
// avoiding race conditions between section and brain hover handlers.
const tooltip = document.getElementById("brain-tooltip")
const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let pointerDownPos = { x: 0, y: 0 }

function setUserInteraction(active) {
    if (isUserInteracting === active) return

    isUserInteracting = active
    if (active) {
        unlockCamera()
        clearHighlight()
        tooltip.classList.remove("visible")
        renderer.domElement.style.cursor = "grabbing"
    }

    syncRendererResolution()

    if (!active) {
        renderer.domElement.style.cursor = "grab"
    }
}

controls.addEventListener("start", () => {
    setUserInteraction(true)
})

controls.addEventListener("end", () => {
    setUserInteraction(false)
})

function getNDC(e) {
    const rect = renderer.domElement.getBoundingClientRect()
    return {
        x: ((e.clientX - rect.left) / rect.width) * 2 - 1,
        y: -((e.clientY - rect.top) / rect.height) * 2 + 1,
        rect,
    }
}

function raycastBrain(e) {
    if (!brainMeshes.length) return null
    const { x, y } = getNDC(e)
    pointer.set(x, y)
    raycaster.setFromCamera(pointer, camera)
    const hits = raycaster.intersectObjects(brainMeshes, true)
    return hits.length ? hits[0] : null
}

function regionFromAtlasSector(e) {
    if (window.getComputedStyle(atlasCenter).position !== "absolute") return null

    const atlasRect = atlas.getBoundingClientRect()
    const centerRect = atlasCenter.getBoundingClientRect()
    const centerX = atlasRect.left + atlasRect.width / 2
    const centerY = atlasRect.top + atlasRect.height / 2
    const offsetX = e.clientX - centerX
    const offsetY = e.clientY - centerY
    const innerRadius = Math.min(centerRect.width, centerRect.height) / 2

    if (Math.hypot(offsetX, offsetY) <= innerRadius) return null

    const angle = (Math.atan2(offsetY, offsetX) * 180) / Math.PI
    const atlasAngle = (angle + 90 + 360) % 360
    const sector = ATLAS_SECTORS.find(({ start, end }) => atlasAngle >= start && atlasAngle < end)
    return sector ? (regionsById.get(sector.id) ?? null) : null
}

function clickedRegionFromEvent(e) {
    const sectionEl = e.target.closest(".section")
    if (sectionEl) return regionsById.get(sectionEl.id) ?? null

    if (container.contains(e.target)) {
        const hit = raycastBrain(e)
        if (hit) return regionFromHit(hit)
    }

    return regionFromAtlasSector(e)
}

function navigateToRegion(region) {
    if (!region) return

    tooltip.classList.remove("visible")
    if (region.isEasterEgg) {
        window.location.href = "easteregg.html"
        return
    }

    document.getElementById(region.scrollTargetId || region.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
}

atlas.addEventListener("pointermove", (e) => {
    // Skip expensive raycasting when not visible
    if (!heroVisible) return

    if (isUserInteracting) {
        tooltip.classList.remove("visible")
        return
    }

    // 1) Pointer is over a section box → highlight that section
    const sectionEl = e.target.closest(".section")
    if (sectionEl) {
        const region = regionsById.get(sectionEl.id)
        if (region) {
            highlightRegion(region)
            lockCamera(region)
            tooltip.classList.remove("visible")
            return
        }
    }

    // 2) Pointer is over the coloured atlas background → highlight that sector
    const atlasRegion = regionFromAtlasSector(e)
    if (atlasRegion) {
        highlightRegion(atlasRegion)
        lockCamera(atlasRegion)
        tooltip.classList.remove("visible")
        return
    }

    // 3) Pointer is over the brain canvas → raycast + 3D region detection
    if (container.contains(e.target)) {
        unlockCamera()
        const hit = raycastBrain(e)
        if (hit) {
            const region = regionFromHit(hit)
            if (region) {
                const rect = renderer.domElement.getBoundingClientRect()
                highlightRegion(region)
                tooltip.textContent = region.label
                tooltip.style.left = e.clientX - rect.left + 14 + "px"
                tooltip.style.top = e.clientY - rect.top - 10 + "px"
                tooltip.classList.add("visible")
                renderer.domElement.style.cursor = "pointer"
                return
            }
        }
        clearHighlight()
        tooltip.classList.remove("visible")
        renderer.domElement.style.cursor = "grab"
        return
    }

    // 4) Pointer is on the atlas background → clear
    clearHighlight()
    unlockCamera()
    tooltip.classList.remove("visible")
})

atlas.addEventListener("pointerleave", () => {
    clearHighlight()
    unlockCamera()
    tooltip.classList.remove("visible")
    renderer.domElement.style.cursor = "grab"
})

// Click on atlas region to scroll to its section
atlas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return
    pointerDownPos = { x: e.clientX, y: e.clientY }
})

atlas.addEventListener("pointerup", (e) => {
    if (e.button !== 0) return

    const dx = Math.abs(e.clientX - pointerDownPos.x)
    const dy = Math.abs(e.clientY - pointerDownPos.y)
    if (dx > 5 || dy > 5) return

    navigateToRegion(clickedRegionFromEvent(e))
})

// ── Visibility gate ────────────────────────────────────────────────────────
// Pause the entire render loop when the hero section is scrolled out of view
// or the browser tab is hidden.  This avoids running Three.js + post-processing
// at 60 fps for content the user cannot see.
let heroVisible = true
const heroObserver = new IntersectionObserver(
    (entries) => {
        heroVisible = entries[0].isIntersecting
        if (heroVisible && !document.hidden) {
            startAnimationLoop()
        } else {
            stopAnimationLoop()
        }
    },
    { threshold: 0 },
)
heroObserver.observe(atlas)

// ── Resize handler (debounced) ─────────────────────────────────────────────
let _resizeTimer
window.addEventListener("resize", () => {
    clearTimeout(_resizeTimer)
    _resizeTimer = setTimeout(() => {
        const w = container.clientWidth
        const h = container.clientHeight
        camera.aspect = w / h
        camera.updateProjectionMatrix()
        renderer.setSize(w, h)
        composer.setSize(w, h)
        syncRendererResolution()
    }, 200)
})

// ── Render loop ────────────────────────────────────────────────────────────
let animationFrameId = 0

function stopAnimationLoop() {
    if (!animationFrameId) return

    cancelAnimationFrame(animationFrameId)
    animationFrameId = 0
}

function startAnimationLoop() {
    if (animationFrameId || !heroVisible || document.hidden) return

    animationFrameId = requestAnimationFrame(animate)
}

function animate() {
    animationFrameId = 0

    if (!heroVisible || document.hidden) return

    if (lockedView) {
        // Smoothly interpolate camera toward the locked viewing angle
        _lockSpherical.setFromVector3(camera.position.clone().sub(controls.target))
        let dTheta = lockedView.azimuth - _lockSpherical.theta
        if (dTheta > Math.PI) dTheta -= 2 * Math.PI
        if (dTheta < -Math.PI) dTheta += 2 * Math.PI
        _lockSpherical.theta += dTheta * LOCK_LERP
        _lockSpherical.phi += (lockedView.polar - _lockSpherical.phi) * LOCK_LERP
        camera.position.setFromSpherical(_lockSpherical).add(controls.target)
        camera.lookAt(controls.target)
    } else {
        controls.update()
    }

    // Smooth highlight fade-in / fade-out
    H.uHighlightStrength.value += (strengthTarget - H.uHighlightStrength.value) * 0.1
    composer.render()
    startAnimationLoop()
}

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        stopAnimationLoop()
        return
    }

    startAnimationLoop()
})

startAnimationLoop()
