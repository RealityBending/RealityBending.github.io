"""Generate people/people_manifest.json and memories/memories_manifest.json.

People:
    Each subfolder of people/ should contain:
        - profile.json   (required) with keys: name, category
            optional keys: email, details, website, title, affiliation, location,
            summary, socials, interests, education, keywords, hook
        - avatar.*       (optional) first image file matching avatar.png/.jpg/.jpeg/.webp

Memories:
    Scans memories/img/ for image files named like {Year}_{name}.jpg.
    Creates or updates memories/memories_manifest.json while preserving manual
    metadata for existing entries and adding defaults for new images.

Run:
    python update_people.py
"""

import json
import re
import sys
from pathlib import Path

ROLE_ORDER = ["PI", "Postdoc", "PhD Student", "Research Assistant", "Alumni"]
REQUIRED_FIELDS = ["name", "category"]
OPTIONAL_FIELDS = [
    "email",
    "details",
    "website",
    "keywords",
    "hook",
    "title",
    "affiliation",
    "location",
    "summary",
    "socials",
    "interests",
    "education",
]
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

try:
    ROOT = Path(__file__).resolve().parent
except NameError:
    ROOT = Path.cwd()

PEOPLE_DIR = ROOT / "people"
OUTPUT = PEOPLE_DIR / "people_manifest.json"

MEMORIES_DIR = ROOT / "memories"
MEMORIES_IMAGE_DIR = MEMORIES_DIR / "img"
MEMORIES_OUTPUT = MEMORIES_DIR / "memories_manifest.json"
MEMORY_IMAGE_EXTENSIONS = ("png", "jpg", "jpeg", "webp", "gif")

errors_found = 0


def warn(folder: str, msg: str) -> None:
    global errors_found
    errors_found += 1
    print(f"  ✗ {folder}: {msg}")


def note(scope: str, msg: str) -> None:
    print(f"  ! {scope}: {msg}")


def find_avatar(person_dir: Path) -> str | None:
    for ext in ("png", "jpg", "jpeg", "webp"):
        candidate = person_dir / f"avatar.{ext}"
        if candidate.exists():
            return candidate.relative_to(ROOT).as_posix()
    return None


def clean_string(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def clean_string_list(value) -> list[str]:
    if isinstance(value, list):
        return [clean_string(item) for item in value if clean_string(item)]
    item = clean_string(value)
    return [item] if item else []


def clean_long_string(value) -> str:
    if isinstance(value, list):
        parts = [clean_string(item) for item in value if clean_string(item)]
        return "\n\n".join(parts)
    return clean_string(value)


def clean_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def clean_socials(value) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    socials = []
    for item in value:
        if not isinstance(item, dict):
            continue
        label = clean_string(
            item.get("label") or item.get("name") or item.get("platform")
        )
        url = clean_string(item.get("url") or item.get("link"))
        if not label or not url:
            continue
        socials.append({"label": label, "url": url})
    return socials


def clean_education(value) -> list[dict[str, str]]:
    if not isinstance(value, list):
        return []
    education = []
    for item in value:
        if not isinstance(item, dict):
            continue
        degree = clean_string(
            item.get("degree") or item.get("course") or item.get("title")
        )
        institution = clean_string(
            item.get("institution") or item.get("school") or item.get("organization")
        )
        year = clean_string(item.get("year"))
        details = clean_string(
            item.get("details") or item.get("description") or item.get("notes")
        )
        logo = clean_string(item.get("logo") or item.get("image") or item.get("icon"))
        if not degree and not institution and not year:
            continue
        education.append(
            {
                "degree": degree,
                "institution": institution,
                "year": year,
                "details": details,
                "logo": logo,
            }
        )
    return education


def validate_profile(folder: str, data: dict) -> bool:
    ok = True
    for field in REQUIRED_FIELDS:
        if not data.get(field, "").strip():
            warn(folder, f"missing required field '{field}'")
            ok = False
    category = data.get("category", "")
    if category and category not in ROLE_ORDER:
        warn(
            folder,
            f"invalid category '{category}' — must be one of: {', '.join(ROLE_ORDER)}",
        )
        ok = False
    email = data.get("email", "")
    if email and not EMAIL_RE.match(email):
        warn(folder, f"malformed email '{email}'")
    known = set(REQUIRED_FIELDS + OPTIONAL_FIELDS)
    unknown = set(data.keys()) - known
    if unknown:
        warn(folder, f"unknown fields ignored: {', '.join(sorted(unknown))}")
    return ok


def load_people() -> list[dict]:
    people = []
    if not PEOPLE_DIR.is_dir():
        print(f"  ⚠ people/ directory not found at {PEOPLE_DIR}")
        return people

    for entry in sorted(PEOPLE_DIR.iterdir()):
        if not entry.is_dir():
            continue
        profile_path = entry / "profile.json"
        if not profile_path.exists():
            warn(entry.name, "no profile.json found — skipping")
            continue
        try:
            with open(profile_path, encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            warn(entry.name, f"invalid JSON in profile.json — {e}")
            continue
        if not isinstance(data, dict):
            warn(entry.name, "profile.json must be a JSON object")
            continue
        if not validate_profile(entry.name, data):
            print(f"    → {entry.name}/ skipped due to errors")
            continue

        avatar = find_avatar(entry)
        if not avatar:
            print(
                f"  ℹ {entry.name}: no avatar image found (looked for avatar.png/jpg/jpeg/webp)"
            )

        person = {
            "folder": entry.name,
            "name": clean_string(data["name"]),
            "category": clean_string(data["category"]),
            "email": clean_string(data.get("email", "")),
            "details": clean_string(data.get("details", "")),
            "website": clean_string(data.get("website", "")),
            "title": clean_string(data.get("title", "")),
            "affiliation": clean_string(data.get("affiliation", "")),
            "location": clean_string(data.get("location", "")),
            "summary": clean_long_string(data.get("summary", "")),
            "socials": clean_socials(data.get("socials", [])),
            "interests": clean_string_list(data.get("interests", [])),
            "education": clean_education(data.get("education", [])),
            "keywords": clean_string_list(data.get("keywords", [])),
            "hook": clean_string(data.get("hook", "")),
            "avatar": avatar,
        }
        people.append(person)

    def sort_key(p):
        try:
            rank = ROLE_ORDER.index(p["category"])
        except ValueError:
            rank = len(ROLE_ORDER)
        return (rank, p["name"].lower())

    people.sort(key=sort_key)
    return people


# ── Memories ──────────────────────────────────────────────


def humanize_memory_name(value: str) -> str:
    text = re.sub(r"[_-]+", " ", clean_string(value))
    if not text:
        return ""
    words = []
    for word in text.split():
        if word.isupper() or any(char.isdigit() for char in word):
            words.append(word)
        else:
            words.append(word[:1].upper() + word[1:])
    return " ".join(words)


def parse_memory_filename(image_name: str) -> dict[str, int | str]:
    stem = Path(image_name).stem
    match = re.match(r"^(?P<year>\d{4})[_-](?P<name>.+)$", stem)
    if not match:
        note(
            "memories",
            f"image '{image_name}' does not match '{{Year}}_{{name}}' — using fallback metadata",
        )
        return {"year": 0, "month": 1, "title": humanize_memory_name(stem)}
    return {
        "year": int(match.group("year")),
        "month": 1,
        "title": humanize_memory_name(match.group("name")),
    }


def normalize_memory_entry(entry: dict, image_path: Path) -> dict:
    defaults = parse_memory_filename(image_path.name)
    relative_path = image_path.relative_to(ROOT).as_posix()
    normalized = dict(entry)
    normalized["file"] = relative_path
    normalized["filename"] = image_path.name
    normalized["title"] = clean_string(normalized.get("title")) or defaults["title"]
    normalized["caption"] = clean_string(normalized.get("caption"))
    normalized.pop("description", None)
    normalized.pop("location", None)
    normalized["year"] = clean_int(normalized.get("year"), int(defaults["year"]))
    normalized["month"] = clean_int(normalized.get("month"), int(defaults["month"]))
    normalized["people"] = clean_string_list(normalized.get("people", []))
    normalized["tags"] = clean_string_list(normalized.get("tags", []))
    return normalized


def load_existing_memories_manifest() -> list[dict]:
    if not MEMORIES_OUTPUT.exists():
        return []
    try:
        with open(MEMORIES_OUTPUT, encoding="utf-8") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        note(
            "memories",
            f"invalid JSON in {MEMORIES_OUTPUT.name} — rebuilding manifest ({e})",
        )
        return []
    entries = data.get("memories", []) if isinstance(data, dict) else []
    if not isinstance(entries, list):
        note(
            "memories",
            f"{MEMORIES_OUTPUT.name} has invalid format — expected a 'memories' list; rebuilding manifest",
        )
        return []
    return [dict(item) for item in entries if isinstance(item, dict)]


def load_memories() -> list[dict]:
    MEMORIES_DIR.mkdir(exist_ok=True)
    MEMORIES_IMAGE_DIR.mkdir(exist_ok=True)

    image_paths = sorted(
        path
        for path in MEMORIES_IMAGE_DIR.iterdir()
        if path.is_file() and path.suffix.lower().lstrip(".") in MEMORY_IMAGE_EXTENSIONS
    )
    if not image_paths:
        note(
            "memories",
            f"no images found in {MEMORIES_IMAGE_DIR.relative_to(ROOT).as_posix()}",
        )

    existing_entries = load_existing_memories_manifest()
    existing_by_file = {}
    existing_by_filename = {}
    for entry in existing_entries:
        file_key = clean_string(entry.get("file"))
        filename_key = clean_string(entry.get("filename"))
        if file_key:
            existing_by_file[file_key] = entry
        if filename_key:
            existing_by_filename[filename_key] = entry

    current_files = {image.relative_to(ROOT).as_posix() for image in image_paths}
    current_names = {image.name for image in image_paths}
    for entry in existing_entries:
        file_key = clean_string(entry.get("file"))
        filename_key = clean_string(entry.get("filename"))
        if file_key and file_key not in current_files:
            note(
                "memories",
                f"removing stale manifest entry for missing image '{file_key}'",
            )
        elif not file_key and filename_key and filename_key not in current_names:
            note(
                "memories",
                f"removing stale manifest entry for missing image '{filename_key}'",
            )

    memories = []
    for image_path in image_paths:
        relative_path = image_path.relative_to(ROOT).as_posix()
        existing = existing_by_file.get(relative_path) or existing_by_filename.get(
            image_path.name
        )
        memories.append(normalize_memory_entry(existing or {}, image_path))

    memories.sort(
        key=lambda item: (
            -clean_int(item.get("year"), 0),
            -clean_int(item.get("month"), 0),
            item.get("filename", "").lower(),
        )
    )
    return memories


def main():
    print(f"Scanning {PEOPLE_DIR} ...")
    people = load_people()

    grouped: dict[str, list[dict]] = {}
    for p in people:
        grouped.setdefault(p["category"], []).append(p)

    manifest = {"roles": ROLE_ORDER, "members": people, "by_role": grouped}
    with open(OUTPUT, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Wrote {OUTPUT.name} — {len(people)} member(s)")
    for role in ROLE_ORDER:
        names = [p["name"] for p in grouped.get(role, [])]
        if names:
            print(f"  {role}: {', '.join(names)}")

    memories = load_memories()
    memories_manifest = {"memories": memories}
    with open(MEMORIES_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(memories_manifest, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Wrote {MEMORIES_OUTPUT.name} — {len(memories)} image(s)")
    for memory in memories[:5]:
        year = memory.get("year") or "n.d."
        print(f"  {year} — {memory.get('title') or memory.get('filename')}")
    if len(memories) > 5:
        print(f"  ... and {len(memories) - 5} more")

    if errors_found:
        print(f"\n⚠ {errors_found} warning(s) — review above")
        sys.exit(1)


if __name__ == "__main__":
    main()
