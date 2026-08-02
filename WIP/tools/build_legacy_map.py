"""Build the complete old-site -> new-site URL map, and report what is left over.

Writes legacy_map.json and an audit. Nothing is written into the site.

── The case trap ──
Hugo lowercases the URL it publishes, so the folder `content/post/2026-01-09-EventTriggers`
was served at `/post/2026-01-09-eventtriggers/`. A redirect stub written at the
folder's own mixed-case name is a file nothing ever requests. Every old path
here is therefore lowercased, and every one is checked against the deployed
sitemap so a stub that matches nothing is caught here rather than shipped.

── Joins ──
  posts         old Hugo front-matter title == post.json title (exact, normalised)
  publications  DOI, falling back to normalised title — the join
                import_publication_assets.py already uses, 39/39 there
  authors       old author slug == people/ folder
  jobs, indexes hand-mapped below; there are nine and they have no key to join on
"""

import io
import json
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

WIP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(WIP)

# ── Hand-mapped: no key exists to join these on ──
HAND = {
    # the old job pages -> the Join rail's three stages (join-content.js)
    "jobs": "join/",
    "jobs/assistant": "join/research-assistant/",
    "jobs/intern": "join/research-assistant/",
    "jobs/phd": "join/phd/",
    "jobs/postdoc": "join/postdoc/",
    "jobs/companion": "join/",  # an apprenticeship idea, no stage of its own
    "jobs/projects": "research/",  # "Research Projects" — an overview, not a vacancy
    # section indexes
    "post": "news/",
    "publication": "publications/",
    "authors": "people/",
    # NOT here: `people` and `research`. Both were live on the old site and both
    # are live on this one *at the same path*, so nothing moved and there is
    # nothing to redirect. Mapping them to themselves wrote a stub at a path
    # generate_pages.py had already filled with the real hub — a page whose
    # meta-refresh pointed at itself, i.e. an infinite reload, `noindex`, and no
    # content, at two of the six section URLs. The identity guard below is what
    # stops the same mistake being made again.
}

# ── Overrides: a title the port deliberately changed ──
TITLE_OVERRIDES = {
    # the port fixed a typo: "articial" -> "artificial"
    "post/2019-05-17-simulate_ecg": "news/2019-simulate-ecg/",
    # a dated vacancy ad, not carried across; the Join rail is where it points now
    "post/2021-12-01-recruiting_nice": "join/research-assistant/",
}

# ── Deliberately NOT mapped ──
# (see CLAUDE.md, "What the old site's URLs taught us")
# tag/ (161), category/ (25), tags, categories, publication-type/,
# publication_types, event, talk/ (2). A redirect to an irrelevant page is
# treated as a soft 404 and discarded; a 404 is the correct answer for a page
# whose content no longer exists in any form.


def normalise(title):
    return re.sub(r"[^a-z0-9]+", "", (title or "").lower())


def front_matter(path):
    text = io.open(path, encoding="utf-8", errors="replace").read()
    doi = re.search(r"^doi:\s*[\"']?([^\"'\n]*)", text, re.M)
    title = re.search(r"^title:\s*(.+)$", text, re.M)
    return {
        "doi": (doi.group(1).strip().lower() if doi else ""),
        "title": (title.group(1).strip().strip("'\"") if title else ""),
    }


def index_file(folder):
    for cand in ("index.md", "index.Rmd", "index.markdown", "index.html"):
        p = os.path.join(folder, cand)
        if os.path.exists(p):
            return p
    return None


# ── what the old site actually published ──
sitemap = io.open(os.path.join(ROOT, "docs", "sitemap.xml"), encoding="utf-8").read()
live = {u.replace("https://realitybending.github.io/", "").strip("/") for u in re.findall(r"<loc>(.*?)</loc>", sitemap)}
live.discard("")

mapping = {}
audit = {"posts": [], "publications": [], "authors": [], "hand": [], "unmatched": []}

# ── POSTS ──
new_posts = {}
for d in sorted(os.listdir(os.path.join(WIP, "news"))):
    p = os.path.join(WIP, "news", d, "post.json")
    if os.path.exists(p):
        data = json.load(io.open(p, encoding="utf-8"))
        new_posts[normalise(data.get("title"))] = d

for d in sorted(os.listdir(os.path.join(ROOT, "content", "post"))):
    folder = os.path.join(ROOT, "content", "post", d)
    if not os.path.isdir(folder):
        continue
    old_path = f"post/{d}".lower()
    src = index_file(folder)
    meta = front_matter(src) if src else {"title": ""}
    target = TITLE_OVERRIDES.get(old_path) or (
        f"news/{new_posts[normalise(meta['title'])]}/" if normalise(meta["title"]) in new_posts else None
    )
    if target:
        mapping[old_path] = target
        audit["posts"].append((old_path, target))
    else:
        audit["unmatched"].append((old_path, meta["title"], old_path in live))

# ── PUBLICATIONS ──
pubs = json.load(io.open(os.path.join(WIP, "publications", "publications_manifest.json"), encoding="utf-8"))[
    "publications"
]
by_doi = {p["doi"].lower(): p for p in pubs if p.get("doi")}
by_title = {normalise(p["title"]): p for p in pubs}

for d in sorted(os.listdir(os.path.join(ROOT, "content", "publication"))):
    folder = os.path.join(ROOT, "content", "publication", d)
    if not os.path.isdir(folder):
        continue
    old_path = f"publication/{d}".lower()
    src = index_file(folder)
    if not src:
        continue
    meta = front_matter(src)
    match = by_doi.get(meta["doi"]) or by_title.get(normalise(meta["title"]))
    if match:
        mapping[old_path] = f"publications/{match['folder']}/"
        audit["publications"].append((old_path, mapping[old_path]))
    else:
        audit["unmatched"].append((old_path, meta["title"], old_path in live))

# ── AUTHORS ── only those that name an actual lab member
members = {m["folder"] for m in json.load(io.open(os.path.join(WIP, "people", "people_manifest.json"), encoding="utf-8"))["members"]}
for path in sorted(p for p in live if p.startswith("authors/")):
    slug = path.split("/", 1)[1]
    if slug in members:
        mapping[path] = f"people/{slug}/"
        audit["authors"].append((path, mapping[path]))

# ── HAND-MAPPED ──
for old_path, target in HAND.items():
    mapping[old_path] = target
    audit["hand"].append((old_path, target))

# ── A URL that did not move is not a redirect ──
# An old path that equals its own target is a page whose address is unchanged.
# Emitting a stub for it does not redirect anything: it overwrites the real page
# at that path with a meta-refresh pointing at itself. Drop them here rather
# than only guarding in generate_pages.py, so the map itself never claims a
# move that did not happen.
identity = sorted(old for old, new in mapping.items() if old.strip("/") == new.strip("/"))
for old_path in identity:
    del mapping[old_path]

# ── REPORT ──
print(f"live old URLs in sitemap: {len(live)}")
print(f"mapped: {len(mapping)}\n")

for kind in ("posts", "publications", "authors", "hand"):
    rows = audit[kind]
    dead = [r for r in rows if r[0] not in live]
    print(f"── {kind}: {len(rows)} mapped, {len(rows) - len(dead)} confirmed live ──")
    for old, new in dead:
        print(f"   !! stub for a path NOT in the old sitemap: {old} -> {new}")
    print()

print("── unmatched ──")
for old, title, is_live in audit["unmatched"]:
    flag = "LIVE — NEEDS A DECISION" if is_live else "not in sitemap, ignorable"
    print(f"   [{flag}] {old}\n        title: {title or '(none)'}")

if identity:
    print("── unchanged addresses, no stub written ──")
    for old_path in identity:
        print(f"   {old_path}  is already its own target")
    print()

print("\n── live old URLs left unmapped, by kind (deliberate: see header) ──")
kinds = {}
for p in sorted(live - set(mapping)):
    kinds.setdefault(p.split("/")[0], []).append(p)
for kind, items in sorted(kinds.items(), key=lambda kv: -len(kv[1])):
    sample = "" if len(items) > 3 else "  " + ", ".join(items)
    print(f"   {len(items):4d}  {kind}{sample}")

# ── Every target must exist ──
# This is what makes the map safe to keep in one file rather than scattered
# through the content as `legacy_paths` fields: rename a news folder and this
# fails loudly on the next run, naming the stub that would have pointed at
# nothing. A field buried in a post.json would simply have gone stale in
# silence. Section routes (news/, join/phd/ …) are pages generate_pages.py
# will write and are not checked against disk.
CONTENT_ROOTS = {"news": "news", "publications": "publications", "people": "people"}
broken = []
for old_path, target in sorted(mapping.items()):
    parts = target.strip("/").split("/")
    if len(parts) == 2 and parts[0] in CONTENT_ROOTS:
        if not os.path.isdir(os.path.join(WIP, CONTENT_ROOTS[parts[0]], parts[1])):
            broken.append((old_path, target))

print("\n── target check ──")
if broken:
    for old_path, target in broken:
        print(f"   BROKEN  {old_path}  ->  {target}   (no such folder)")
    print(f"\n   {len(broken)} target(s) do not exist. Fix before generating stubs.")
else:
    print(f"   all {len(mapping)} targets resolve")

out = os.path.join(WIP, "legacy_map.json")
with io.open(out, "w", encoding="utf-8") as fh:
    json.dump(mapping, fh, indent=2, ensure_ascii=False, sort_keys=True)
print(f"\nwrote legacy_map.json ({len(mapping)} entries)")

sys.exit(1 if broken else 0)
