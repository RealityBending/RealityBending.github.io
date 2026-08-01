"""Generate publications/publications_manifest.json by fetching from ORCID.

Fetches the most recent works from ORCID for the PI, cross-validates against
CrossRef (to catch misclassified preprints), and creates/updates
publications/<doi-slug>/info.json for each entry, preserving local edits.

Run:
    python update_publications.py
"""

import json
import re
import sys
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

# The report below prints ✓/⊘ and paper titles, and a Windows console defaults
# to cp1252 — without this the script does its work and then dies on the summary
# line, which reads exactly like a failure to write the manifest. Same guard as
# update_news.py, which is where this was found the first time.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    ROOT = Path(__file__).resolve().parent
except NameError:
    ROOT = Path.cwd()

ORCID_ID = "0000-0001-5375-9967"
ORCID_API = f"https://pub.orcid.org/v3.0/{ORCID_ID}/works"
MAX_PUBLICATIONS = 20
PUBLICATIONS_DIR = ROOT / "publications"
PUB_OUTPUT = PUBLICATIONS_DIR / "publications_manifest.json"

# Preprint DOIs to suppress even when automatic title-matching fails.
# Use the base DOI without version suffix — any _vN variant will be matched.
OMIT_DOIS: set[str] = {
    "10.31234/osf.io/sae23",  # preprint of: A Distributional Response Time Analysis of the Perceptual Disfluency Effect
    "10.31234/osf.io/873th",  # Testing the Relationship between Phenomenological Control related to Illusion Sensitivity
}

errors_found = 0


def warn(scope: str, msg: str) -> None:
    global errors_found
    errors_found += 1
    print(f"  ✗ {scope}: {msg}")


def note(scope: str, msg: str) -> None:
    print(f"  ! {scope}: {msg}")


def clean_string(value) -> str:
    if value is None:
        return ""
    return str(value).strip()


def clean_int(value, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _orcid_get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def title_to_slug(year: int | None, title: str) -> str:
    yr = str(year) if year else "0000"
    clean = re.sub(r"[^\w\s]", "", title)
    words = clean.split()[:4]
    pascal = "".join(w.capitalize() for w in words)
    return f"{yr}_{pascal}"


def _pick_best_title(work_summary: dict) -> str:
    title_obj = work_summary.get("title", {})
    title_val = title_obj.get("title", {})
    return (
        title_val.get("value", "") if isinstance(title_val, dict) else str(title_val)
    ).strip() or "Untitled"


def _extract_year(work_summary: dict) -> int | None:
    pub_date = work_summary.get("publication-date")
    if pub_date and pub_date.get("year"):
        try:
            return int(pub_date["year"]["value"])
        except (ValueError, KeyError, TypeError):
            pass
    return None


def _extract_doi(ext_ids: list[dict]) -> str | None:
    for eid in ext_ids:
        if eid.get("external-id-type", "").lower() == "doi":
            return eid.get("external-id-value", "").strip()
    return None


def _extract_journal(work_summary: dict) -> str:
    jt = work_summary.get("journal-title")
    if jt and jt.get("value"):
        return jt["value"].strip()
    return ""


def _format_authors_apa(authors: list[dict]) -> str:
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
                "_raw_type": ws.get("type", ""),
            }
        )

    PSYARXIV_DOI_PREFIX = "10.31234/"
    PREPRINT_TYPES = {"preprint", "working-paper"}
    filtered_works = []
    for w in works:
        doi = w.get("doi", "") or ""
        if w["_raw_type"] in PREPRINT_TYPES:
            if doi.startswith(PSYARXIV_DOI_PREFIX):
                w["is_preprint"] = True
                filtered_works.append(w)
        else:
            filtered_works.append(w)
    works = filtered_works

    PREPRINT_DOI_PREFIXES = ("10.21203/", "10.20944/", "10.2139/")
    validated: list[dict] = []
    for w in works:
        doi = w.get("doi", "") or ""
        doi_base = re.sub(r"_v\d+$", "", doi)
        if doi_base in OMIT_DOIS:
            print(f"  ⊘ suppressed (OMIT_DOIS): {w['title'][:60]}")
            continue
        if any(doi.startswith(pfx) for pfx in PREPRINT_DOI_PREFIXES):
            print(f"  ⊘ skipped (preprint DOI prefix): {w['title'][:60]}")
            continue
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
                if cr_type in ("posted-content",):
                    if doi.startswith(PSYARXIV_DOI_PREFIX):
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
                w["citations"] = cr_msg.get("is-referenced-by-count")
            except (urllib.error.URLError, urllib.error.HTTPError, Exception):
                pass
        if w.get("_raw_type") in ("preprint", "working-paper") and not w.get(
            "is_preprint"
        ):
            if doi.startswith(PSYARXIV_DOI_PREFIX):
                w["is_preprint"] = True
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

    works.sort(key=lambda w: (-(w["year"] or 0), w["title"].lower()))

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

        merged = {
            "doi": w["doi"],
            "title": w["title"],
            "year": w["year"],
            "journal": w["journal"],
            "type": w["type"],
            "authors": w.get("authors", ""),
            "is_preprint": w.get("is_preprint", False),
        }
        merged.pop("_raw_type", None)
        merged.update(existing)

        pdf = None
        for ext in ("pdf",):
            candidates = list(pub_dir.glob(f"*.{ext}"))
            if candidates:
                pdf = candidates[0].relative_to(ROOT).as_posix()
                break
        merged["pdf"] = merged.get("pdf") or pdf
        merged.setdefault("keywords", [])

        fresh_citations = w.get("citations")
        merged["citations"] = (
            fresh_citations if fresh_citations is not None else merged.get("citations")
        )

        featured = None
        for ext in ("png", "jpg", "jpeg", "webp"):
            candidate = pub_dir / f"featured.{ext}"
            if candidate.exists():
                featured = candidate.relative_to(ROOT).as_posix()
                break
        merged["featured"] = merged.get("featured") or featured
        merged["folder"] = pub_dir.name

        with open(info_path, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)

        publications.append(merged)

    return publications


def main():
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
