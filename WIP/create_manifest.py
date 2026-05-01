"""Generate people/people_manifest.json, memories/memories_manifest.json,
and publications/publications_manifest.json.

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

Publications:
  Fetches the most recent works from ORCID for the PI.
  Creates publications/<doi-slug>/info.json for each entry.
  Local edits to info.json are preserved (manual overrides).

Run:
    python create_manifest.py

Output: people/people_manifest.json, memories/memories_manifest.json,
and publications/publications_manifest.json.
"""

import json
import re
import sys
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

ROLE_ORDER = ["PI", "Postdoc", "PhD Student", "Research Assistant"]
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

# Resolve ROOT from the script's own location.  If __file__ is not available
# (e.g. frozen / interactive), fall back to cwd.
try:
    ROOT = Path(__file__).resolve().parent
except NameError:
    ROOT = Path.cwd()

PEOPLE_DIR = ROOT / "people"
OUTPUT = PEOPLE_DIR / "people_manifest.json"

# -- Memories --
MEMORIES_DIR = ROOT / "memories"
MEMORIES_IMAGE_DIR = MEMORIES_DIR / "img"
MEMORIES_OUTPUT = MEMORIES_DIR / "memories_manifest.json"
MEMORY_IMAGE_EXTENSIONS = ("png", "jpg", "jpeg", "webp", "gif")

# ── Publications ──
ORCID_ID = "0000-0001-5375-9967"
ORCID_API = f"https://pub.orcid.org/v3.0/{ORCID_ID}/works"
MAX_PUBLICATIONS = 20  # limit for testing & development
PUBLICATIONS_DIR = ROOT / "publications"
PUB_OUTPUT = PUBLICATIONS_DIR / "publications_manifest.json"

# Preprint DOIs to suppress even when automatic title-matching fails
# (e.g. preprint and published version have different titles).
# Use the base DOI without version suffix — any _vN variant will be matched.
OMIT_DOIS: set[str] = {
    "10.31234/osf.io/sae23",  # preprint of: A Distributional Response Time Analysis of the Perceptual Disfluency Effect
    "10.31234/osf.io/873th",  # Testing the Relationship between Phenomenological Control related to Illusion Sensitivity
}

errors_found = 0


def warn(folder: str, msg: str) -> None:
    global errors_found
    errors_found += 1
    print(f"  ✗ {folder}: {msg}")


def note(scope: str, msg: str) -> None:
    print(f"  ! {scope}: {msg}")


def find_avatar(person_dir: Path) -> str | None:
    """Return the relative path (from site root) to the avatar image, or None."""
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
        if not degree and not institution and not year:
            continue
        education.append(
            {
                "degree": degree,
                "institution": institution,
                "year": year,
                "details": details,
            }
        )
    return education


def validate_profile(folder: str, data: dict) -> bool:
    """Validate profile data. Returns True if usable (possibly with warnings)."""
    ok = True

    # Required fields
    for field in REQUIRED_FIELDS:
        if not data.get(field, "").strip():
            warn(folder, f"missing required field '{field}'")
            ok = False

    # Role must be one of the allowed values
    category = data.get("category", "")
    if category and category not in ROLE_ORDER:
        warn(
            folder,
            f"invalid category '{category}' — must be one of: {', '.join(ROLE_ORDER)}",
        )
        ok = False

    # Email format (if provided)
    email = data.get("email", "")
    if email and not EMAIL_RE.match(email):
        warn(folder, f"malformed email '{email}'")

    # Warn about unknown keys
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

    dirs = sorted(PEOPLE_DIR.iterdir())
    if not dirs:
        print("  ⚠ people/ directory is empty")
        return people

    for entry in dirs:
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

    # Sort by role hierarchy, then alphabetically within each role
    def sort_key(p):
        try:
            rank = ROLE_ORDER.index(p["category"])
        except ValueError:
            rank = len(ROLE_ORDER)
        return (rank, p["name"].lower())

    people.sort(key=sort_key)
    return people


# ═══════════════════════════════════════════════════════════
#  Memories — local image manifest
# ═══════════════════════════════════════════════════════════


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
    normalized["description"] = clean_long_string(normalized.get("description", ""))
    normalized["location"] = clean_string(normalized.get("location"))
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

    normalized_entries = []
    for item in entries:
        if not isinstance(item, dict):
            note("memories", "ignoring non-object manifest entry")
            continue
        normalized_entries.append(dict(item))
    return normalized_entries


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


# ═══════════════════════════════════════════════════════════
#  Publications — ORCID fetch
# ═══════════════════════════════════════════════════════════


def _orcid_get(url: str) -> dict:
    """GET a JSON response from the ORCID public API."""
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def title_to_slug(year: int | None, title: str) -> str:
    """Build a folder name like '2024_TheStructureOfChaos' from year + title.

    Uses the first 4 words in PascalCase.
    """
    yr = str(year) if year else "0000"
    # Keep only letters, digits, spaces
    clean = re.sub(r"[^\w\s]", "", title)
    words = clean.split()[:4]
    pascal = "".join(w.capitalize() for w in words)
    return f"{yr}_{pascal}"


def _pick_best_title(work_summary: dict) -> str:
    """Extract the best title string from an ORCID work summary."""
    title_obj = work_summary.get("title", {})
    title_val = title_obj.get("title", {})
    return (
        title_val.get("value", "") if isinstance(title_val, dict) else str(title_val)
    ).strip() or "Untitled"


def _extract_year(work_summary: dict) -> int | None:
    """Extract the publication year from an ORCID work summary."""
    pub_date = work_summary.get("publication-date")
    if pub_date and pub_date.get("year"):
        try:
            return int(pub_date["year"]["value"])
        except (ValueError, KeyError, TypeError):
            pass
    return None


def _extract_doi(ext_ids: list[dict]) -> str | None:
    """Return the first DOI found in external-ids, or None."""
    for eid in ext_ids:
        if eid.get("external-id-type", "").lower() == "doi":
            return eid.get("external-id-value", "").strip()
    return None


def _extract_journal(work_summary: dict) -> str:
    """Extract journal/source title."""
    jt = work_summary.get("journal-title")
    if jt and jt.get("value"):
        return jt["value"].strip()
    return ""


def _format_authors_apa(authors: list[dict]) -> str:
    """Format a CrossRef author list into APA-style string (Last, F. I., & Last, F. I.)."""
    parts = []
    for a in authors:
        family = a.get("family", "").strip()
        given = a.get("given", "").strip()
        if not family:
            name = a.get("name", "").strip()
            if name:
                parts.append(name)
            continue
        if given:
            initials = " ".join(f"{g[0]}." for g in given.split() if g)
            parts.append(f"{family}, {initials}")
        else:
            parts.append(family)
    if not parts:
        return ""
    if len(parts) == 1:
        return parts[0]
    return ", ".join(parts[:-1]) + ", & " + parts[-1]


def fetch_orcid_works(limit: int = MAX_PUBLICATIONS) -> list[dict]:
    """Fetch the most recent works from ORCID, return simplified dicts."""
    print(f"\nFetching publications from ORCID ({ORCID_ID}) ...")

    try:
        data = _orcid_get(ORCID_API)
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        print(f"  ✗ ORCID API error: {e}")
        return []

    groups = data.get("group", [])
    works = []

    for group in groups:
        summaries = group.get("work-summary", [])
        if not summaries:
            continue
        # Pick the first summary (preferred source)
        ws = summaries[0]
        ext_ids = []
        for s in summaries:
            ext_ids.extend(s.get("external-ids", {}).get("external-id", []))

        doi = _extract_doi(ext_ids)
        year = _extract_year(ws)
        title = _pick_best_title(ws)
        journal = _extract_journal(ws)

        works.append(
            {
                "doi": doi,
                "title": title,
                "year": year,
                "journal": journal,
                "type": ws.get("type", "").replace("-", " ").title(),
                "_raw_type": ws.get("type", ""),  # keep raw for filtering
            }
        )

    # PsyArXiv / OSF DOI prefix — preprints here are kept and displayed as preprints
    PSYARXIV_DOI_PREFIX = "10.31234/"  # OSF / PsyArXiv

    # Filter out preprints (ORCID type), keeping PsyArXiv preprints
    PREPRINT_TYPES = {"preprint", "working-paper"}
    filtered_works = []
    for w in works:
        doi = w.get("doi", "") or ""
        if w["_raw_type"] in PREPRINT_TYPES:
            if doi.startswith(PSYARXIV_DOI_PREFIX):
                w["is_preprint"] = True
                filtered_works.append(w)
            # else: silently drop other preprint types
        else:
            filtered_works.append(w)
    works = filtered_works

    # Cross-validate with CrossRef to catch preprints misclassified by ORCID
    # (e.g. Research Square DOIs reported as "journal-article")
    PREPRINT_DOI_PREFIXES = (
        "10.21203/",
        "10.20944/",
        "10.2139/",
    )  # ResearchSquare, Preprints.org, SSRN
    validated: list[dict] = []
    for w in works:
        doi = w.get("doi", "") or ""
        # Normalise OSF/PsyArXiv version suffixes (_v1, _v2 …) before any comparison
        doi_base = re.sub(r"_v\d+$", "", doi)
        # Manual suppress list — takes priority over everything else
        if doi_base in OMIT_DOIS:
            print(f"  ⊘ suppressed (OMIT_DOIS): {w['title'][:60]}")
            continue
        # Fast-reject known preprint DOI registrants (but keep PsyArXiv)
        if any(doi.startswith(pfx) for pfx in PREPRINT_DOI_PREFIXES):
            print(f"  ⊘ skipped (preprint DOI prefix): {w['title'][:60]}")
            continue
        # For remaining DOIs, ask CrossRef for the authoritative type
        if doi:
            try:
                cr_url = (
                    f"https://api.crossref.org/works/{urllib.parse.quote(doi, safe='')}"
                )
                req = urllib.request.Request(
                    cr_url,
                    headers={
                        "Accept": "application/json",
                        "User-Agent": "RealityBendingLab/1.0 (mailto:realitybending@sussex.ac.uk)",
                    },
                )
                with urllib.request.urlopen(req, timeout=15) as resp:
                    cr = json.loads(resp.read().decode())
                cr_msg = cr.get("message", {})
                cr_type = cr_msg.get("type", "")
                if cr_type in ("posted-content",):  # CrossRef type for preprints
                    if doi.startswith(PSYARXIV_DOI_PREFIX):
                        # PsyArXiv preprint — keep it, mark as preprint
                        w["is_preprint"] = True
                        print(f"  ℹ PsyArXiv preprint kept: {w['title']} (DOI: {doi})")
                    else:
                        print(
                            f"  ⊘ skipped (CrossRef type={cr_type}): {w['title'][:60]}"
                        )
                        continue
                cr_authors = cr_msg.get("author", [])
                if cr_authors:
                    w["authors"] = _format_authors_apa(cr_authors)
                # Citation count from CrossRef
                w["citations"] = cr_msg.get("is-referenced-by-count")
            except (urllib.error.URLError, urllib.error.HTTPError, Exception):
                pass  # if CrossRef is unreachable, trust ORCID
        # If ORCID already flagged it as a preprint type, check if it's PsyArXiv
        if w.get("_raw_type") in ("preprint", "working-paper") and not w.get(
            "is_preprint"
        ):
            if doi.startswith(PSYARXIV_DOI_PREFIX):
                w["is_preprint"] = True
            # (non-psyarxiv preprints were already filtered before this loop)
        # Semantic Scholar fallback when CrossRef returned nothing
        if doi and w.get("citations") is None:
            try:
                s2_url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{urllib.parse.quote(doi, safe='/')}?fields=citationCount"
                s2_req = urllib.request.Request(
                    s2_url, headers={"Accept": "application/json"}
                )
                with urllib.request.urlopen(s2_req, timeout=10) as s2_resp:
                    s2 = json.loads(s2_resp.read().decode())
                w["citations"] = s2.get("citationCount")
            except (urllib.error.URLError, urllib.error.HTTPError, Exception):
                pass
        validated.append(w)
    works = validated

    # Sort by year descending, then title
    works.sort(key=lambda w: (-(w["year"] or 0), w["title"].lower()))

    # Deduplicate by normalised title: published version always beats a preprint
    # with the same title, regardless of year order.
    published_title_norms: set[str] = set()
    for w in works:
        if not w.get("is_preprint"):
            published_title_norms.add(re.sub(r"\s+", " ", w["title"].lower().strip()))

    seen_titles: set[str] = set()
    unique: list[dict] = []
    for w in works:
        norm = re.sub(r"\s+", " ", w["title"].lower().strip())
        if norm in seen_titles:
            continue
        if w.get("is_preprint") and norm in published_title_norms:
            print(f"  ⊘ removed preprint (published version exists): {w['title'][:60]}")
            continue
        seen_titles.add(norm)
        unique.append(w)
    works = unique

    if limit:
        works = works[:limit]

    return works


def load_publications(works: list[dict]) -> list[dict]:
    """For each ORCID work, create/update a publications/<slug>/info.json.

    If info.json already exists, local edits are preserved — only missing
    fields are filled from ORCID data.
    """
    PUBLICATIONS_DIR.mkdir(exist_ok=True)

    publications = []
    for w in works:
        slug = title_to_slug(w["year"], w["title"])
        pub_dir = PUBLICATIONS_DIR / slug
        pub_dir.mkdir(exist_ok=True)

        info_path = pub_dir / "info.json"
        if info_path.exists():
            with open(info_path, encoding="utf-8") as f:
                existing = json.load(f)
        else:
            existing = {}

        # ORCID data as defaults; local edits take precedence
        merged = {
            "doi": w["doi"],
            "title": w["title"],
            "year": w["year"],
            "journal": w["journal"],
            "type": w["type"],
            "authors": w.get("authors", ""),
            "is_preprint": w.get("is_preprint", False),
        }
        # Remove internal-only keys
        merged.pop("_raw_type", None)
        merged.update(existing)  # local overrides win

        # Check for a local PDF (auto-detect; explicit null in info.json is treated as "not set")
        pdf = None
        for ext in ("pdf",):
            candidates = list(pub_dir.glob(f"*.{ext}"))
            if candidates:
                pdf = candidates[0].relative_to(ROOT).as_posix()
                break
        merged["pdf"] = merged.get("pdf") or pdf

        # Ensure keywords list is always present
        merged.setdefault("keywords", [])
        # Citations: use freshly fetched value; fall back to cached if API was unreachable
        fresh_citations = w.get("citations")
        merged["citations"] = (
            fresh_citations if fresh_citations is not None else merged.get("citations")
        )

        # Check for featured image
        featured = None
        for ext in ("png", "jpg", "jpeg", "webp"):
            candidate = pub_dir / f"featured.{ext}"
            if candidate.exists():
                featured = candidate.relative_to(ROOT).as_posix()
                break
        merged["featured"] = merged.get("featured") or featured

        merged["folder"] = pub_dir.name

        # Write back (so the file always exists for manual editing)
        with open(info_path, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)

        publications.append(merged)

    return publications


def main():
    print(f"Scanning {PEOPLE_DIR} ...")
    people = load_people()

    # Group by role for convenience
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

    # ── Publications ──
    works = fetch_orcid_works()
    publications = load_publications(works)

    pub_manifest = {"publications": publications}
    with open(PUB_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(pub_manifest, f, indent=2, ensure_ascii=False)

    print(f"\n✓ Wrote {PUB_OUTPUT.name} — {len(publications)} publication(s)")
    for pub in publications:
        yr = pub.get("year") or "n.d."
        print(f"  {yr} — {pub['title'][:70]}")

    if errors_found:
        print(f"\n⚠ {errors_found} warning(s) — review above")
        sys.exit(1)


if __name__ == "__main__":
    main()
