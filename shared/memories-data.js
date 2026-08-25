const MANIFEST_PATH = "memories/memories_manifest.json"

let memoriesPromise = null

export function getMemoriesManifest() {
    if (!memoriesPromise) {
        memoriesPromise = fetch(MANIFEST_PATH)
            .then((response) => (response.ok ? response.json() : { memories: [] }))
            .then((data) => (Array.isArray(data.memories) ? data.memories : []))
            .catch(() => [])
    }

    return memoriesPromise
}

export function buildMemoryMeta(memory) {
    const metaParts = []
    if (memory.year) metaParts.push(memory.year)
    if (memory.location) metaParts.push(memory.location)
    if (Array.isArray(memory.people) && memory.people.length) metaParts.push(memory.people.join(", "))
    return metaParts.join(" · ")
}
