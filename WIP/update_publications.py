"""Generate publications/publications_manifest.json by fetching from ORCID.

Fetches the most recent works from ORCID for the PI, cross-validates against
CrossRef (to catch misclassified preprints), and creates/updates
publications/<doi-slug>/info.json for each entry, preserving local edits.

Run:
    python update_publications.py
"""

import html
import json
import re
import sys
import unicodedata
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

# None means "everything ORCID has", which is what the site shows. This was 20
# while the section was being built. Raising it is not free: the whole list is
# cross-validated one DOI at a time against CrossRef, so a full run makes ~100
# requests and takes a few minutes, where the capped one took seconds. If you
# are iterating on the *rendering* rather than the data, set it back to a small
# number for the round trip and put it back to None before committing — the
# manifest is what the page reads and a truncated one looks exactly like a
# correct one.
MAX_PUBLICATIONS = None
PUBLICATIONS_DIR = ROOT / "publications"
PUB_OUTPUT = PUBLICATIONS_DIR / "publications_manifest.json"

# Preprint DOIs to suppress even when automatic title-matching fails.
# Use the base DOI without version suffix — any _vN variant will be matched.
OMIT_DOIS: set[str] = {
    "10.31234/osf.io/sae23",  # preprint of: A Distributional Response Time Analysis of the Perceptual Disfluency Effect
    "10.31234/osf.io/873th",  # Testing the Relationship between Phenomenological Control related to Illusion Sensitivity
    # Preprint of 10.1111/psyp.70164 (2025_WhichHeartRateVariability). The
    # automatic dedupe missed it because it removes a preprint only when a
    # published entry has the *same* title, and these differ past the shared
    # opening: "…Should I Use? A Data-driven Answer" against "…Should I Use for
    # Psychophysiological Research?". Retitling between preprint and journal is
    # ordinary, so this is the expected way that rule fails — the tell is two
    # entries whose slugs collide on the first four words.
    "10.31234/osf.io/jz6yq",
    "10.31234/osf.io/mwa6x",  # Unveiling the HRV structure, later got published in a different form.
}

# The mirror of OMIT_DOIS: works to include that the ORCID profile does not
# list. ORCID is self-claimed and therefore incomplete as well as occasionally
# wrong — a paper simply never added to it is invisible to this script, and
# there is nothing in a run that would report the absence.
#
# Each is fetched from CrossRef in full (title, venue, year, authors), so a DOI
# is the whole entry. That costs one extra request per DOI on top of the
# validation pass, which re-fetches the same record; two requests for a handful
# of papers is cheaper than a second code path.
EXTRA_DOIS: dict[str, str] = {
    # Not on the ORCID profile. The old Hugo site carried it, and its figure is
    # imported by import_publication_figures.py.
    "10.3917/bupsy.549.0163": "Centenaire Ribot (première partie) — Bulletin de psychologie",
}

# The same suppression for a work with no DOI to name it by. "D. Makowski" is
# not a unique name and ORCID records are self-claimed, so a profile picks up
# the occasional paper by someone else — and a work with no DOI is exactly the
# one that cannot be caught by cross-validation, because there is nothing to
# look up. Matched on the normalised title (case and whitespace folded).
OMIT_TITLES: set[str] = {
    # A hardware paper by a different D. Makowski. No DOI, no CrossRef record,
    # no authors — it renders as a bare title in a psychology publication list.
    "novel digital camera with the pcie interface",
}

# Folder names, where the four-words-of-the-title rule produces a bad one.
#
# It is a mechanical rule and it shows: it truncates mid-phrase and keeps the
# filler word it landed on ("…PriorsIn", "…OutliersAn", "TheBeautyAndThe"), and
# it renders a software paper as its subtitle rather than as the name of the
# thing ("ModelbasedAnRPackage"). A folder here is the join key for a figure, a
# PDF and an info.json, and under Tier 3 it becomes a URL — so it is worth
# being a name a person would choose.
#
# **Keyed by the slug the rule generates, not by DOI.** DOI is the stabler key
# and this is the more readable one, which matters more for a map edited by
# hand. The failure mode is visible rather than silent: if an upstream title
# changes, the generated slug changes, the override stops matching, and the
# publication reappears under a fresh auto-name while the old folder — figure,
# PDF and all — is listed as an orphan at the end of the run.
#
# Three shapes, all of them taken from the eight worked examples:
#   - drop a trailing filler word            ChoosingInformativePriorsIn → …Priors
#   - name the thing, not the paper about it ModelbasedAnRPackage → Modelbased
#   - finish a phrase cut off mid-way        TheBeautyAndThe → TheBeautyAndTheSelf
SLUG_OVERRIDES: dict[str, str] = {
    # ── the eight worked examples ──
    "2026_ChoosingInformativePriorsIn": "2026_ChoosingInformativePriors",
    "2025_TheMintScaleA": "2025_Mint",
    "2025_SequentialsamplingmodelsjlSimulatingAndEvaluating": "2025_Sequentialsamplingmodels",
    "2025_ModelbasedAnRPackage": "2025_Modelbased",
    "2024_TheBeautyAndThe": "2024_TheBeautyAndTheSelf",
    "2024_CheckYourOutliersAn": "2024_CheckYourOutliers",
    "2024_BeyondEmpathyCognitiveCapabilities": "2024_BeyondEmpathy",
    # ── software, instruments and models: the name of the thing ──
    "2022_DatawizardAnRPackage": "2022_Datawizard",
    "2021_Neurokit2APythonToolbox": "2021_Neurokit2",
    "2021_PerformanceAnRPackage": "2021_Performance",
    "2021_SeeAnRPackage": "2021_See",
    "2020_EffectsizeEstimationOfEffect": "2020_Effectsize",
    "2020_ExtractingComputingAndExploring": "2020_Parameters",
    "2020_MethodsAndAlgorithmsFor": "2020_Correlation",
    "2019_BayestestrDescribingEffectsAnd": "2019_Bayestestr",
    "2019_InsightAUnifiedInterface": "2019_Insight",
    "2018_ThePsychoPackageAn": "2018_Psycho",
    "2017_NeuropsydiapyAPythonModule": "2017_Neuropsydia",
    "2021_AParametricFrameworkTo": "2021_Pyllusion",
    "2025_IntroducingTheChoiceconfidenceChoco": "2025_Choco",
    "2025_BadNewsTestingGamified": "2025_BadNews",
    "2025_MeasuringDepressionAndAnxiety": "2025_PHQ4",
    "2026_MegaanalysisOfTheInteroceptive": "2026_MegaanalysisIAS",
    "2020_AdaptationAndValidationOf": "2020_AffectiveStyleQuestionnaire",
    # ── trailing filler dropped, or a cut-off phrase finished ──
    "2026_AttentionAndPhysiologicalResponses": "2026_MisophoniaAttention",
    "2026_TowardsAnActiveInference": "2026_ActiveInferencePersonality",
    "2025_ADistributionalResponseTime": "2025_PerceptualDisfluency",
    "2025_TooBeautifulToBe": "2025_TooBeautifulToBeFake",
    "2024_ExploringTheRoleOf": "2024_NewsOutletsConspiracyTheory",
    "2023_ANovelVisualIllusion": "2023_VisualIllusionParadigm",
    "2023_AttenuatingSubjectiveCrowdingThrough": "2023_AttenuatingSubjectiveCrowding",
    "2023_CheckYourOutliersAn": "2023_CheckYourOutliers",
    "2023_DisentanglingTheSocialFrom": "2023_DisentanglingTheSocial",
    "2022_TheIllusionGameA": "2022_TheIllusionGame",
    "2021_HeartRateVariabilityIn": "2021_HeartRateVariabilityPsychology",
    "2020_BeautyIsInThe": "2020_BeautyIsInTheEye",
    "2020_TheHeartOfCognitive": "2020_TheHeartOfCognitiveControl",
    "2020_TheImpactOfState": "2020_MindfulnessProspectiveMemory",
    "2019_DispositionalMindfulnessAttenuatesThe": "2019_DispositionalMindfulness",
    "2019_PhenomenalBodilyAndBrain": "2019_FictionalReappraisal",
    "2018_CognitiveNeuropsychologyOfImplicit": "2018_ImplicitEmotionRegulation",
    "2017_HowVirtualEmbodimentAffects": "2017_VirtualEmbodimentMemory",
    "2017_TheDistinctiveRoleOf": "2017_ExecutiveFunctionsEmotionRegulation",
    "2016_CanMentalFatigueBe": "2016_MentalFatigueWeberCompass",
    "2016_TheProtectiveRoleOf": "2016_LongTermMeditationExecutive",
    "2015_EmotionRegulationAndThe": "2015_EmotionRegulationAging",
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


def title_to_slug(year: int | None, title: str, words_used: int = 4) -> str:
    """A folder name, which on this site is also a URL path.

    Folded to ASCII first. `\\w` is Unicode-aware in Python 3, so a French title
    produced `2017_CentenaireRibotPremièrePartie` — a directory name that has to
    be percent-encoded in every `<img src>` built from it, and that git and
    Dropbox normalise differently on Windows and macOS (NFC vs NFD), which is
    how a repository ends up with two folders whose names look identical.
    Every other folder here is ASCII by accident of the titles being English;
    this makes it so on purpose. Accents are dropped rather than transliterated
    (è → e), which is what a reader would type anyway.
    """
    yr = str(year) if year else "0000"
    folded = unicodedata.normalize("NFKD", title)
    folded = "".join(c for c in folded if not unicodedata.combining(c))
    folded = folded.encode("ascii", "ignore").decode("ascii")
    clean = re.sub(r"[^\w\s]", "", folded)
    words = clean.split()[:words_used]
    pascal = "".join(w.capitalize() for w in words)
    return f"{yr}_{pascal}"


def unique_slug(year: int | None, title: str, taken: set[str]) -> str:
    """A folder name no other publication in this run has claimed.

    Four words of a title was unique across twenty publications and is not
    across a hundred: "Sensitivity to visual illusions ..." and "Sensitivity to
    visual illusions and ..." from the same year collapse to one folder, and
    because the directory is created with exist_ok the second simply overwrites
    the first — no error, one publication missing from a list of a hundred that
    nobody counts by hand.

    So: lengthen the slug with the title's own next word until it is unique,
    which keeps the name derived from the content and therefore stable across
    runs. The counter at the end is the last resort for two genuinely
    identically-titled works in one year, and it is order-dependent, so it
    warns.
    """
    for words_used in range(4, 9):
        slug = title_to_slug(year, title, words_used)
        if slug not in taken:
            return slug
    base = title_to_slug(year, title)
    n = 2
    while f"{base}_{n}" in taken:
        n += 1
    warn("slug", f"'{base}' collides even at 8 words — using {base}_{n}")
    return f"{base}_{n}"


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


def _crossref_get(doi: str) -> dict | None:
    """The CrossRef record for a DOI, or None. Used by both passes."""
    url = f"https://api.crossref.org/works/{urllib.parse.quote(doi, safe='')}"
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "User-Agent": "RealityBendingLab/1.0 (mailto:realitybending@sussex.ac.uk)",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode()).get("message", {})
    except (urllib.error.URLError, urllib.error.HTTPError, ValueError):
        return None


def fetch_extra_works(known_dois: set[str]) -> list[dict]:
    """Build a work entry from CrossRef for each DOI in EXTRA_DOIS.

    Skips any the ORCID profile already carries, so moving a paper onto the
    profile later does not silently produce two copies of it — the title-level
    dedupe further down would catch that, but only by luck of the titles
    matching exactly.
    """
    extras: list[dict] = []
    for doi, label in EXTRA_DOIS.items():
        if doi.lower() in known_dois:
            print(f"  ℹ EXTRA_DOIS entry is now on ORCID, skipping duplicate: {label}")
            continue
        cr = _crossref_get(doi)
        if cr is None:
            warn("EXTRA_DOIS", f"CrossRef has no record for {doi} ({label})")
            continue
        titles = cr.get("title") or []
        containers = cr.get("container-title") or []
        extras.append(
            {
                "doi": doi,
                "title": (titles[0] if titles else label).strip(),
                "year": _crossref_year(cr),
                "journal": (containers[0].strip() if containers else ""),
                "type": cr.get("type", "").replace("-", " ").title(),
                "_raw_type": cr.get("type", ""),
                "abstract": _clean_abstract(cr.get("abstract")),
                "keywords": _crossref_keywords(cr),
            }
        )
        print(f"  + added from EXTRA_DOIS: {extras[-1]['title'][:60]}")
    return extras


def _clean_abstract(raw) -> str:
    """CrossRef's abstract, as plain text.

    It arrives as JATS XML — `<jats:p>`, `<jats:sec>`, a `<jats:title>Abstract</jats:title>`
    heading, occasionally MathML. Three things happen to it and each is
    deliberate:

    - **Every tag is stripped rather than translated.** Content on this site is
      lab-authored and reviewed, and that is the assumption `normalizeRichHtml`
      and the news pipeline are written on. This is the one string here fetched
      from a third party, so it must not be able to carry markup into the page
      at all. The value stored is plain text and must be inserted as text,
      never as HTML.
    - **Entities are unescaped between two tag-stripping passes.** A doubly
      encoded `&lt;script&gt;` would otherwise survive the first pass and
      decode into markup afterwards. The tag pattern requires a letter after
      the `<`, so an abstract containing "p < .05 and n > 30" keeps it.
    - **A leading "Abstract" heading is dropped.** A fair number of publishers
      put the word inside the abstract, where it renders as a label above a
      field that is already labelled.

    Returns "" for anything missing or empty, so the caller can treat the
    field as simply absent.
    """
    if not raw or not isinstance(raw, str):
        return ""
    tag = re.compile(r"</?[a-zA-Z][^>]*>")
    text = tag.sub(" ", raw)
    text = html.unescape(text)
    text = tag.sub(" ", text)
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"^(abstract|summary)\b[:.\s—-]*", "", text, flags=re.I).strip()
    return text


def _crossref_keywords(cr_msg: dict) -> list[str]:
    """CrossRef's `subject` list, tidied.

    Sparse and being deprecated upstream, so this is a bonus rather than a
    source to rely on — a publication with none is normal, not a fault.
    """
    subjects = cr_msg.get("subject") or []
    out = []
    for s in subjects:
        s = clean_string(s)
        if s and s not in out:
            out.append(s)
    return out


def _crossref_year(cr_msg: dict) -> int | None:
    """The year CrossRef holds, whichever of its date fields carries it.

    `published` is the one to prefer — `issued` can be the online-first date and
    `created` is when the record was deposited, which for a paper registered
    ahead of print is the year before it appears.
    """
    for key in ("published", "published-print", "published-online", "issued"):
        parts = (cr_msg.get(key) or {}).get("date-parts") or []
        if parts and parts[0] and parts[0][0]:
            try:
                return int(parts[0][0])
            except (TypeError, ValueError):
                continue
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

    # Before the preprint filtering below, so an extra is held to the same
    # rules as anything ORCID supplied rather than being waved through.
    works.extend(fetch_extra_works({(w.get("doi") or "").lower() for w in works}))

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
    # One network round trip per DOI, so an uncapped run is minutes rather than
    # seconds. Without a heartbeat that is indistinguishable from a hang, and
    # the temptation is to kill it half way and be left with a manifest that
    # was never written.
    print(f"  Cross-validating {len(works)} works against CrossRef ...")
    for index, w in enumerate(works, start=1):
        if index % 10 == 0:
            print(f"    … {index}/{len(works)}")
        doi = w.get("doi", "") or ""
        doi_base = re.sub(r"_v\d+$", "", doi)
        if doi_base in OMIT_DOIS:
            print(f"  ⊘ suppressed (OMIT_DOIS): {w['title'][:60]}")
            continue
        if re.sub(r"\s+", " ", w["title"].lower().strip()) in OMIT_TITLES:
            print(f"  ⊘ suppressed (OMIT_TITLES): {w['title'][:60]}")
            continue
        if any(doi.startswith(pfx) for pfx in PREPRINT_DOI_PREFIXES):
            print(f"  ⊘ skipped (preprint DOI prefix): {w['title'][:60]}")
            continue
        if doi:
            try:
                cr_msg = _crossref_get(doi) or {}
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
                # The abstract costs nothing: this response is already fetched
                # and parsed for the type check, the authors and the citation
                # count. Coverage is about 58% — the misses cluster on Springer,
                # Taylor & Francis and JOSS — so an entry without one is normal.
                w["abstract"] = _clean_abstract(cr_msg.get("abstract"))
                w["keywords"] = _crossref_keywords(cr_msg)
                # An ORCID entry can carry no publication-date at all — the
                # misophonia paper is one. Untreated that is a `0000_` folder
                # and an "n.d." on the card, for a paper CrossRef dates
                # perfectly well, so take the year from there when ORCID has
                # none. Never override ORCID's own year: this runs before the
                # sort and before the slug, so both pick the correction up.
                if not w.get("year"):
                    w["year"] = _crossref_year(cr_msg)
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
    # Every override is reserved up front, so an *auto* slug that happens to
    # equal a chosen one is lengthened rather than colliding with it — the
    # generated name yields to the deliberate one, whichever order they arrive
    # in.
    taken_slugs: set[str] = set(SLUG_OVERRIDES.values())
    used_overrides: set[str] = set()
    for w in works:
        auto = unique_slug(w["year"], w["title"], taken_slugs)
        # Two keys to try, and both are needed. The plain four-word slug is
        # what a folder is normally called, but a folder whose name was
        # *lengthened* to resolve a collision is called something `title_to_slug`
        # never returns — `2025_WhichHeartRateVariabilityHrv` is five words
        # because the published paper of nearly the same name took the four-word
        # one first. Keying only on the short form silently missed it.
        generated = title_to_slug(w["year"], w["title"])
        key = generated if generated in SLUG_OVERRIDES else auto
        slug = SLUG_OVERRIDES.get(key, auto)
        if key in SLUG_OVERRIDES:
            used_overrides.add(key)
        taken_slugs.add(slug)
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

        # ── Three fields where "existing wins" needs qualifying ──
        # `merged.update(existing)` is what lets a hand-written value survive
        # every future run, and that is right for all three. But it also freezes
        # an *empty* one: a publication whose abstract CrossRef did not have on
        # the first run would keep `""` for ever, even once the publisher
        # deposits it. So existing wins only when it actually holds something.
        merged["abstract"] = merged.get("abstract") or w.get("abstract", "")
        merged["keywords"] = merged.get("keywords") or w.get("keywords", [])
        # `summary` is lab-written and has no upstream source, so it is only
        # ever seeded empty — but it is seeded in every info.json on purpose.
        # Nobody fills in a field they do not know exists, and this is the
        # highest-value text on a publication page: two or three plain
        # sentences on what the paper found are the one thing about it that is
        # not already on the publisher's site, on PubMed and on ResearchGate.
        # An abstract makes the page longer; this is what makes it worth
        # indexing. See SEO-PLAN.md.
        merged.setdefault("summary", "")

        pdf = None
        for ext in ("pdf",):
            candidates = list(pub_dir.glob(f"*.{ext}"))
            if candidates:
                pdf = candidates[0].relative_to(ROOT).as_posix()
                break
        # A file found on disk WINS over whatever info.json remembers, which is
        # the opposite of every other field here. `pdf` and `featured` are not
        # metadata, they are paths built out of the folder's own name — so the
        # moment a folder is renamed, the remembered value is a path to a file
        # that no longer exists, and `existing or detected` pins it there
        # permanently. That is exactly what happened across the SLUG_OVERRIDES
        # rename: 27 of 68 entries pointed into folders that had been renamed
        # out from under them, and the cards rendered a broken image.
        #
        # `detected or existing` rather than plain `detected`, so a hand-written
        # path to something this glob cannot see — a PDF hosted elsewhere —
        # still survives a run that finds no local file.
        merged["pdf"] = pdf or merged.get("pdf")

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
        merged["featured"] = featured or merged.get("featured")  # see `pdf` above
        merged["folder"] = pub_dir.name

        with open(info_path, "w", encoding="utf-8") as f:
            json.dump(merged, f, indent=2, ensure_ascii=False)

        # ── The manifest carries metadata, never the abstract ──
        # The same rule the news pipeline follows for post bodies, and for the
        # same reason: every visitor downloads this file to render a list of
        # titles, and ~38 abstracts at a median of 189 words is ~50KB that
        # nothing in the list view shows. generate_pages.py reads info.json
        # straight off disk, where it costs the page nothing; if the SPA ever
        # wants to show an abstract it fetches that one publication's
        # info.json, exactly as news.js fetches a post.json.
        #
        # `summary` and `keywords` do go in — both are short, and both are
        # worth having in the list view and in search.
        publications.append({k: v for k, v in merged.items() if k != "abstract"})

    # An override nothing matched. Either the publication left the list, or its
    # title changed upstream and the generated slug moved out from under the
    # key — in which case the paper is now sitting in a fresh auto-named folder
    # and its figure and PDF have been left behind in the old one.
    for stale in sorted(set(SLUG_OVERRIDES) - used_overrides):
        warn(
            "SLUG_OVERRIDES",
            f"'{stale}' matched no publication → '{SLUG_OVERRIDES[stale]}'",
        )

    return publications


def main():
    works = fetch_orcid_works()
    publications = load_publications(works)

    pub_manifest = {"publications": publications}
    with open(PUB_OUTPUT, "w", encoding="utf-8") as f:
        json.dump(pub_manifest, f, indent=2, ensure_ascii=False)

    # A folder whose publication is no longer in the list — the title changed
    # and took the slug with it, or the work left the ORCID profile. Reported
    # rather than deleted: a stale folder may hold a PDF or a figure that was
    # put there by hand, and the new folder will not have it.
    live = {p["folder"] for p in publications}
    orphans = sorted(
        d.name for d in PUBLICATIONS_DIR.iterdir() if d.is_dir() and d.name not in live
    )
    if orphans:
        print(
            f"\n! {len(orphans)} folder(s) no longer in the manifest — check for files worth keeping, then delete:"
        )
        for name in orphans:
            kept = [
                f.name
                for f in (PUBLICATIONS_DIR / name).iterdir()
                if f.name != "info.json"
            ]
            print(
                f"    publications/{name}{('  (also holds ' + ', '.join(kept) + ')') if kept else ''}"
            )

    print(f"\n✓ Wrote {PUB_OUTPUT.name} — {len(publications)} publication(s)")
    for pub in publications:
        yr = pub.get("year") or "n.d."
        print(f"  {yr} — {pub['title'][:70]}")

    if errors_found:
        print(f"\n⚠ {errors_found} warning(s) — review above")
        sys.exit(1)


if __name__ == "__main__":
    main()
