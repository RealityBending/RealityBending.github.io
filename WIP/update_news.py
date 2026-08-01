"""Generate news/news_manifest.json from the folders under news/.

The same shape as update_people.py, and for the same reason: content is one
folder per item, edited by hand, and a script turns the tree into the single
JSON the page fetches. Nothing else is involved — no Markdown files, no front
matter, no static site generator.

A post is one folder, named `<year>-<short-title>` — `2025-interoception-
questionnaires`. That name is the post's slug and so its shareable link
(`#post-2025-interoception-questionnaires`), which is why it is a year and a
handful of words rather than a full date: the day is in post.json, where the
page reads it from, and a URL nobody can say out loud is a URL nobody shares.

Each subfolder of news/ contains:
    - post.json     (required)
    - featured.*    (optional) first image matching featured.jpg/.png/.webp/.gif
    - any other images the post refers to, by plain filename

post.json:
    {
      "title":    "...",                         required
      "date":     "2025-12-20",                  required, YYYY-MM-DD
      "summary":  "one or two sentences",        shown on the index row
      "subtitle": "...",                         optional
      "authors":  ["roisin-sharma", "A Guest"],  people folders or plain names
      "category": "Research",                    one of CATEGORIES below
      "featured": true,                          optional, puts it on the
                                                 Featured tab
      "image":    "featured.jpg",                optional; `featured.*` in the
                                                 folder is found without it
      "draft":    true,                          optional, keeps it unpublished
      "content":  "<p>…</p>"                     the post itself, as HTML
    }

`category` is **one** value from a short closed list, not free tags. The old
site tagged every post with "Reality Bending Lab", "University of Sussex" and
"Psychology", which is true of all of them and therefore filters nothing; what
a reader wants to say is "show me the essays" or "show me the how-tos". The
list is CATEGORIES below and it is deliberately hard to extend — a category
that applies to two posts is a category, one that applies to one is a tag.

`content` is **HTML** — plain `<p>`, `<h3>`, `<ul>`, `<figure>`,
`<blockquote>`, written by hand and carrying no class names; the stylesheet
dresses the elements. An `<img src="mint.jpg">` names a file in the post's own
folder and news.js re-bases it, and off-site links are given their target and
rel automatically, so neither has to be typed out.

It may be **one string, or a list of strings that are joined**. JSON strings
cannot hold a literal newline, so a post of any length written as a single
string is one enormous line; splitting it into a block per paragraph keeps it
editable and keeps a diff readable. The list is line-wrapping and nothing more
— news.js joins it and never looks at where the joins were. This is the same
contract the People section's `summary` and `details` already have.

The manifest carries metadata only — never `content`. The index has to list
every post, and pulling every body into it would mean downloading the whole
blog to render a list of titles; news.js fetches a post.json when a post is
actually opened. `authors` are resolved against people/people_manifest.json so
a post shows the author's avatar and canonical name; run update_people.py first
if both changed.

Run:
    python update_news.py
"""

import io
import json
import re
import sys
from pathlib import Path

FEATURED_EXTENSIONS = ("jpg", "jpeg", "png", "webp", "gif", "avif")
WORDS_PER_MINUTE = 220

# The order the filter chips are laid out in, so it is a running order and not
# an alphabet: what the lab found, what it thinks, how it is done, the lab
# itself, and what other people said about it. A post carries exactly one.
CATEGORIES = ["Research", "Thoughts", "Methods", "Lab", "Media"]

# The report below prints ✓/✗ and author names, and a Windows console defaults
# to cp1252 — without this the script does its work and then dies on the
# summary line, which reads exactly like a failure to write the manifest.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    ROOT = Path(__file__).resolve().parent
except NameError:
    ROOT = Path.cwd()

NEWS_DIR = ROOT / "news"
OUTPUT = NEWS_DIR / "news_manifest.json"
PEOPLE_MANIFEST = ROOT / "people" / "people_manifest.json"

warnings_found = 0


def warn(folder: str, msg: str) -> None:
    global warnings_found
    warnings_found += 1
    print(f"  ✗ {folder}: {msg}")


def clean_string(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def as_list(value) -> list[str]:
    if isinstance(value, list):
        return [clean_string(item) for item in value if clean_string(item)]
    item = clean_string(value)
    return [item] if item else []


def load_json(path: Path, label: str):
    try:
        with io.open(path, encoding="utf-8-sig") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        warn(label, f"invalid JSON in {path.name} — {e}")
        return None


# ── Authors ───────────────────────────────────────────────


def load_people() -> dict:
    if not PEOPLE_MANIFEST.exists():
        print("  ! authors: people_manifest.json not found — names used as written")
        return {}
    data = load_json(PEOPLE_MANIFEST, "authors")
    if not data:
        return {}

    index = {}
    for person in data.get("members", []):
        entry = {
            "name": clean_string(person.get("name")),
            "folder": clean_string(person.get("folder")),
            "avatar": clean_string(person.get("avatar")),
        }
        if entry["folder"]:
            index[entry["folder"].lower()] = entry
        if entry["name"]:
            index[entry["name"].lower()] = entry
    return index


def resolve_authors(values, people: dict) -> list[dict]:
    authors = []
    for value in as_list(values):
        match = people.get(value.lower())
        # Not an error when there is no match: guests and former collaborators
        # write here too, and they have no folder under people/.
        authors.append(dict(match) if match else {"name": value, "folder": "", "avatar": ""})
    return authors


# ── Content ───────────────────────────────────────────────

TAG_RE = re.compile(r"<[^>]+>")
# A caption is a label for a picture, not the opening of the piece — it must
# not be able to become the summary.
FIGURE_RE = re.compile(r"<figure[\s\S]*?</figure>", re.I)


def normalize_content(value, folder: str) -> str:
    """One HTML string. A list of strings is joined; that is all the list is."""
    if isinstance(value, list):
        parts = [clean_string(part) for part in value if clean_string(part)]
        return "\n".join(parts)
    if isinstance(value, str):
        return value.strip()
    if value is None:
        return ""
    warn(folder, "'content' must be a string, or a list of strings")
    return ""


def strip_tags(html: str) -> str:
    return re.sub(r"\s+", " ", TAG_RE.sub(" ", html)).strip()


def count_words(html: str) -> int:
    return len(strip_tags(html).split())


def first_sentences(html: str, limit: int = 180) -> str:
    """The opening paragraph, for a post that gave no summary of its own."""
    for match in re.finditer(r"<p[^>]*>([\s\S]*?)</p>", FIGURE_RE.sub(" ", html), re.I):
        text = strip_tags(match.group(1))
        if len(text) > 60:
            return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"
    return ""


def find_image(folder: Path, declared: str) -> str:
    if declared:
        candidate = folder / declared
        if candidate.exists():
            return candidate.relative_to(ROOT).as_posix()
        warn(folder.name, f"'image' names a missing file: {declared}")
    for ext in FEATURED_EXTENSIONS:
        candidate = folder / f"featured.{ext}"
        if candidate.exists():
            return candidate.relative_to(ROOT).as_posix()
    return ""


def check_category(value, folder: str) -> str:
    category = clean_string(value)
    if not category:
        warn(folder, f"no 'category' — must be one of: {', '.join(CATEGORIES)}")
        return ""
    if category not in CATEGORIES:
        warn(folder, f"unknown category {category!r} — must be one of: {', '.join(CATEGORIES)}")
    return category


DATE_RE = re.compile(r"^(\d{4})-(\d{2})-(\d{2})")


def parse_date(value, folder: str) -> str:
    """post.json is the only place the day is written.

    A folder is `<year>-<short-title>` — enough to sort the tree and to read at
    a glance, and short enough that the slug it becomes is a URL somebody can
    say out loud. It deliberately does *not* carry the day: two places holding
    the same date is two places to get it wrong, and the one that showed on the
    page was always post.json's. (It was `<full date>-<short title>`, and one
    post already disagreed with itself by two days.)
    """
    match = DATE_RE.match(clean_string(value))
    if match:
        return match.group(0)
    warn(folder, "no usable 'date' in post.json — needs YYYY-MM-DD")
    return ""


def load_posts(people: dict) -> list[dict]:
    posts = []
    if not NEWS_DIR.is_dir():
        print(f"  ⚠ news/ directory not found at {NEWS_DIR}")
        return posts

    for entry in sorted(NEWS_DIR.iterdir()):
        if not entry.is_dir():
            continue
        source = entry / "post.json"
        if not source.exists():
            warn(entry.name, "no post.json found — skipping")
            continue

        data = load_json(source, entry.name)
        if data is None:
            continue
        if not isinstance(data, dict):
            warn(entry.name, "post.json must be a JSON object")
            continue
        if data.get("draft") is True:
            print(f"  ℹ {entry.name}: draft — left out of the manifest")
            continue

        title = clean_string(data.get("title"))
        if not title:
            warn(entry.name, "missing 'title' — skipping")
            continue

        html = normalize_content(data.get("content"), entry.name)
        if not html:
            warn(entry.name, "no content")

        words = count_words(html)
        posts.append(
            {
                "slug": entry.name,
                "title": title,
                "subtitle": clean_string(data.get("subtitle")),
                "date": parse_date(data.get("date"), entry.name),
                "summary": clean_string(data.get("summary")) or first_sentences(html),
                "authors": resolve_authors(data.get("authors"), people),
                "category": check_category(data.get("category"), entry.name),
                "featured": data.get("featured") is True,
                "image": find_image(entry, clean_string(data.get("image"))),
                "file": source.relative_to(ROOT).as_posix(),
                # The folder, so news.js can resolve a figure's plain filename
                # without having to take the path apart.
                "base": entry.relative_to(ROOT).as_posix() + "/",
                "words": words,
                "minutes": max(1, round(words / WORDS_PER_MINUTE)),
            }
        )

    posts.sort(key=lambda post: (post["date"], post["slug"]), reverse=True)
    return posts


def main():
    print(f"Scanning {NEWS_DIR} ...")
    people = load_people()
    posts = load_posts(people)

    # Only the categories actually in use, in CATEGORIES order — an empty chip
    # is a promise the archive cannot keep.
    counts: dict[str, int] = {}
    for post in posts:
        if post["category"]:
            counts[post["category"]] = counts.get(post["category"], 0) + 1
    categories = [{"name": name, "count": counts[name]} for name in CATEGORIES if name in counts]

    featured = sum(1 for post in posts if post["featured"])
    if posts and not featured:
        print("  ! featured: no post is marked \"featured\": true — the Featured tab will be empty")

    manifest = {"categories": categories, "posts": posts}
    with io.open(OUTPUT, "w", encoding="utf-8", newline="\n") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\n✓ Wrote {OUTPUT.name} — {len(posts)} post(s), {featured} featured")
    for name, count in ((row["name"], row["count"]) for row in categories):
        print(f"  {name}: {count}")
    print()
    for post in posts:
        authors = ", ".join(author["name"] for author in post["authors"]) or "—"
        star = "★" if post["featured"] else " "
        print(f"  {star} {post['date']} — {post['title'][:46]} ({authors}, {post['minutes']} min)")

    if warnings_found:
        print(f"\n⚠ {warnings_found} warning(s) — review above")
        sys.exit(1)


if __name__ == "__main__":
    main()
