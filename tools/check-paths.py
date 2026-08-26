#!/usr/bin/env python
"""Every route the site can write must be a real file.

    python tools/check-paths.py        (run from the repo root, after generate_pages.py)

`tools/check-routes.html` checks the other half of this: that routes.js
round-trips a route to a path and back. It cannot check that anything *serves*
that path, because it has no filesystem. This does, and between them the
guarantee is complete.

── Why it exists ──
Three bugs of exactly this shape shipped into the pre-cutover audit, and none of
them threw anything:

  - the nine Services card routes were 404s, because services.js was still on
    hashes and generate_pages.py had never been told those paths existed;
  - `/information/contact/` was a 404, because `activateContactTab` writes
    `contact-<tab>` for *every* tab including the default one, and only the
    default one had no page;
  - `/people/` and `/research/` were self-redirecting stubs, because a legacy
    map entry overwrote the hub the generator had just written.

All three are invisible until somebody reloads or shares the URL in their
address bar — the most ordinary thing a reader does with a link — and by then
the failure looks like a broken site rather than a missing file.

── How it works ──
The route sources are read from the same content the modules read, not from a
list kept here: the three manifests, plus the two Information content modules
for the ids that only exist in JS. So adding a post, a member, a service or a
join stage is covered automatically, and the only thing that can go stale is the
set of *tab names*, which is small and changes about once a year.
"""

import json
import os
import re
import sys

# Guarded for the same reason as generate_pages.py: `sys.stdout` in a notebook
# is an ipykernel OutStream with no `reconfigure`, and `__file__` is undefined
# there. This one only reads, so a wrong ROOT reports every path as missing
# rather than doing damage — but it is still checked, because "183 MISSING" is a
# much worse error message than "you are in the wrong directory".
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
except NameError:
    ROOT = os.getcwd()

if not os.path.exists(os.path.join(ROOT, "index.html")):
    sys.exit(
        f"check-paths: no index.html in {ROOT}\n"
        "  Run this from the repository root, after generate_pages.py."
    )

# The tab names each section's module can write. The one hand-kept list here,
# and the one thing this check cannot derive.
TABS = {
    "people": ("lab", "collaborations", "memories"),
    "news": ("all", "featured"),
    "publications": ("list", "gallery"),
    "research": ("overview", "creations"),
    "information": ("contact", "join", "services"),
}

# Section and hub paths, which exist because routes.js can produce them.
BARE = ("/", "/people/", "/news/", "/publications/", "/research/", "/information/", "/join/", "/services/")


def manifest(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as fh:
        return json.load(fh)


def ids_in(path, block=None):
    """`id: "..."` out of a content module, optionally inside one named block."""
    with open(os.path.join(ROOT, path), encoding="utf-8") as fh:
        text = fh.read()
    if block:
        found = re.search(r"\n    %s:\s*\[(.*?)\n    \]," % block, text, re.S)
        if not found:
            sys.exit(f"check-paths: could not find `{block}:` in {path}")
        text = found.group(1)
    return re.findall(r'^\s*id:\s*"([^"]+)"', text, re.M)


def main():
    expected = list(BARE)

    for member in manifest("people", "people_manifest.json")["members"]:
        expected.append("/people/%s/" % member["folder"])
    for post in manifest("news", "news_manifest.json")["posts"]:
        expected.append("/news/%s/" % post["slug"])
    for pub in manifest("publications", "publications_manifest.json")["publications"]:
        expected.append("/publications/%s/" % pub["folder"])
    # The one route that is three segments deep — see routes.js, MEMORY_BASE.
    for memory in manifest("memories", "memories_manifest.json")["memories"]:
        if memory.get("slug"):
            expected.append("/people/memories/%s/" % memory["slug"])

    for section, tabs in TABS.items():
        for tab in tabs:
            expected.append("/%s/%s/" % (section, tab))

    for stage in ids_in("information/join-content.js"):
        expected.append("/join/%s/" % stage)
    for card in ids_in("information/services-content.js", "entries"):
        expected.append("/services/%s/" % card)

    expected = sorted(set(expected))

    missing = []
    stubs = []
    for path in expected:
        target = os.path.join(ROOT, path.strip("/"), "index.html") if path != "/" else os.path.join(ROOT, "index.html")
        if not os.path.exists(target):
            missing.append(path)
            continue
        # A page that redirects to itself is worse than a missing one: it is an
        # infinite reload rather than a 404, and it is what a legacy stub
        # written over a real hub looks like.
        with open(target, encoding="utf-8") as fh:
            head = fh.read(2000)
        found = re.search(r'http-equiv="refresh"[^>]*url=([^"\']+)', head)
        if found and found.group(1).strip() == path:
            stubs.append(path)

    print(f"routes the site can write: {len(expected)}")

    for path in missing:
        print(f"   MISSING   {path}   nothing serves this — a reload here is a 404")
    for path in stubs:
        print(f"   SELF-LOOP {path}   redirects to itself")

    if missing or stubs:
        print(f"\nFAIL — {len(missing) + len(stubs)} broken. Run update_*.py then generate_pages.py, and check legacy_map.json.")
        return 1

    print("PASS — every one is a real page.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
