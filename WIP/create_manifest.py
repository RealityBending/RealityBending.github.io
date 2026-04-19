"""Generate people_manifest.json and publications_manifest.json.

People:
  Each subfolder of people/ should contain:
    - profile.json   (required) with keys: name, category, email, details, website (optional)
    - avatar.*       (optional) first image file matching avatar.png/.jpg/.jpeg/.webp

Publications:
  Fetches the most recent works from ORCID for the PI.
  Creates publications/<doi-slug>/info.json for each entry.
  Local edits to info.json are preserved (manual overrides).

Run:
    python create_manifest.py

Output: people_manifest.json and publications_manifest.json in the same directory.
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
OPTIONAL_FIELDS = ["email", "details", "website", "keywords", "hook"]
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Resolve ROOT from the script's own location.  If __file__ is not available
# (e.g. frozen / interactive), fall back to cwd.
try:
    ROOT = Path(__file__).resolve().parent
except NameError:
    ROOT = Path.cwd()

PEOPLE_DIR = ROOT / "people"
OUTPUT = ROOT / "people_manifest.json"

# ── Publications ──
ORCID_ID = "0000-0001-5375-9967"
ORCID_API = f"https://pub.orcid.org/v3.0/{ORCID_ID}/works"
MAX_PUBLICATIONS = 4  # limit for development
PUBLICATIONS_DIR = ROOT / "publications"
PUB_OUTPUT = ROOT / "publications_manifest.json"

errors_found = 0


def warn(folder: str, msg: str) -> None:
    global errors_found
    errors_found += 1
    print(f"  ✗ {folder}: {msg}")


def find_avatar(person_dir: Path) -> str | None:
    """Return the relative path (from site root) to the avatar image, or None."""
    for ext in ("png", "jpg", "jpeg", "webp"):
        candidate = person_dir / f"avatar.{ext}"
        if candidate.exists():
            return candidate.relative_to(ROOT).as_posix()
    return None


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
            "name": data["name"].strip(),
            "category": data["category"].strip(),
            "email": data.get("email", "").strip(),
            "details": data.get("details", "").strip(),
            "website": data.get("website", "").strip(),
            "keywords": data.get("keywords", []),
            "hook": data.get("hook", "").strip(),
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

    # Filter out preprints (ORCID type)
    PREPRINT_TYPES = {"preprint", "working-paper"}
    works = [w for w in works if w["_raw_type"] not in PREPRINT_TYPES]

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
        # Fast-reject known preprint DOI registrants
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
                cr_type = cr.get("message", {}).get("type", "")
                if cr_type in ("posted-content",):  # CrossRef type for preprints
                    print(f"  ⊘ skipped (CrossRef type={cr_type}): {w['title'][:60]}")
                    continue
            except (urllib.error.URLError, urllib.error.HTTPError, Exception):
                pass  # if CrossRef is unreachable, trust ORCID
        validated.append(w)
    works = validated

    # Sort by year descending, then title
    works.sort(key=lambda w: (-(w["year"] or 0), w["title"].lower()))

    # Deduplicate by normalised title (keeps the first = most recent/preferred)
    seen_titles: set[str] = set()
    unique: list[dict] = []
    for w in works:
        norm = re.sub(r"\s+", " ", w["title"].lower().strip())
        if norm in seen_titles:
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
        }
        # Remove internal-only keys
        merged.pop("_raw_type", None)
        merged.update(existing)  # local overrides win

        # Check for a local PDF
        pdf = None
        for ext in ("pdf",):
            candidates = list(pub_dir.glob(f"*.{ext}"))
            if candidates:
                pdf = candidates[0].relative_to(ROOT).as_posix()
                break
        merged["pdf"] = merged.get("pdf") or pdf
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

    if errors_found:
        print(f"\n⚠ {errors_found} warning(s) — review above")
        sys.exit(1)

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


if __name__ == "__main__":
    main()
