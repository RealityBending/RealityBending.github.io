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
    /* `people_names` is what update_people.py resolves `people` (a list of
       member folders) to, in the same run that writes both manifests. The
       folders themselves are the join key and were never meant to be read —
       "ana-neves, dominique-makowski" under a photograph is a slug, not a
       credit. The raw list is the fallback for a manifest written before that. */
    const credits = memory.people_names && memory.people_names.length ? memory.people_names : memory.people
    if (Array.isArray(credits) && credits.length) metaParts.push(credits.join(", "))
    return metaParts.join(" · ")
}
