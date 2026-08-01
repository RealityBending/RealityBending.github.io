"""Copy the old Hugo site's publication figures and PDFs into publications/.

The old site kept one folder per publication under `content/publication/`, named
by a citation key (`makowski2015emotion`), each with a `featured.*` beside its
`index.md`. This site names a folder `<year>_<FirstFourTitleWords>` and builds
it from ORCID, so the two trees share no key at all — the join is the DOI in the
old front matter, falling back to an exact normalised title where the DOIs
disagree (15 of 39 do: the old front matter predates several of these papers'
final DOIs).

Run once after `update_publications.py` has created the folders:

    python import_publication_assets.py
    python update_publications.py     # picks the new files up into the manifest

Re-running is safe: a publication that already has a `featured.*` or a `*.pdf`
is left alone for that asset, so this cannot overwrite one chosen by hand.

**PDFs are copied byte for byte, and they are the bulk of what this moves** —
39 files, 56.9 MB against the figures' 2.1 MB, one of them 11.6 MB. They are
not re-encoded because there is no ghostscript, qpdf or pikepdf here, and a
lossy pass over a published paper is not something to do blind. This does not
touch page weight — a PDF is fetched only when a reader presses the badge — but
it is 57 MB in every clone, which is the trade to be aware of. The alternative
is to drop `copy_pdfs` and let the DOI link carry the reader to the publisher.

Nothing here is wired into the site. It exists so that the imported files have
a written-down provenance, and so the import can be repeated if the publication
folders are ever regenerated from scratch.
"""

import json
import re
import sys
from pathlib import Path

from PIL import Image

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent
OLD_PUBLICATIONS = ROOT.parent / "content" / "publication"
NEW_PUBLICATIONS = ROOT / "publications"
MANIFEST = NEW_PUBLICATIONS / "publications_manifest.json"

# The documented budget for a publication figure (see "The size budget" in
# CLAUDE.md). It is displayed in a 13rem column under `object-fit: cover`, so
# 1000px is already generous; the old files are up to 1956px and 617 KB.
MAX_EDGE = 1000
QUALITY = 82
# .gif is in the list because one of the old figures is one, and leaving it out
# meant that publication was passed over in silence — no match line, no error,
# just 37 imports where 38 were expected, which is not a number anybody checks.
# An animated source is reduced to its first frame: these are cropped into a
# 13rem column by `object-fit: cover`, and one card animating in a list of
# sixty-eight is a distraction rather than a figure.
SOURCE_NAMES = ("featured.png", "featured.jpg", "featured.jpeg", "featured.webp", "featured.gif")


def normalise_title(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()


def read_front_matter(index_md: Path) -> dict:
    """The two fields needed to join on, without a YAML dependency.

    Hugo front matter is YAML between `---` fences, but only `doi:` and `title:`
    are wanted and both are single-line scalars, so a regex is honest here —
    pulling in PyYAML for two lines would be the larger cost.
    """
    text = index_md.read_text(encoding="utf-8", errors="replace")
    doi = re.search(r"^doi:\s*[\"']?([^\"'\n]*)", text, re.M)
    title = re.search(r"^title:\s*[\"']?(.*?)[\"']?\s*$", text, re.M)
    return {
        "doi": (doi.group(1).strip() if doi else "").lower(),
        "title": title.group(1).strip() if title else "",
    }


def encode(source: Path, target_dir: Path) -> tuple[Path, int, int]:
    """Re-encode to the budget. Returns (written path, source KB, target KB).

    JPEG is the right default for a photograph or a rendered chart and the
    wrong one for the flat-colour diagrams and wordmarks that several of these
    are: a first pass wrote five files *larger* than their PNG sources
    (33 KB → 86 KB for one). So both are encoded and the smaller kept — the
    same lesson as the GIFs in "Assets", where a re-encode at the wrong
    settings also came out bigger than the original.
    """
    im = Image.open(source)
    im.seek(0)  # first frame; an animated source is reduced to a still
    # Flatten rather than keep alpha: the card crops these with `object-fit:
    # cover` against a near-white field, so transparency buys nothing. White
    # rather than the card's own colour because the crop means the background
    # is rarely visible at all.
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA")
        flat = Image.new("RGB", im.size, (255, 255, 255))
        flat.paste(im, mask=im.getchannel("A"))
        im = flat
    else:
        im = im.convert("RGB")

    resized = max(im.size) > MAX_EDGE
    if resized:  # never upscale
        scale = MAX_EDGE / max(im.size)
        im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)

    # Already inside the budget and already well compressed: several of these
    # went through a PNG optimiser years ago and PIL's encoder cannot match it,
    # so re-encoding is pure loss — 33 KB in, 70 KB out, for a file nobody
    # needed to touch. Copy it instead. Only when no resize was needed: a
    # verbatim copy of an oversized source is the thing this script exists to
    # avoid, and .gif is excluded because a still is the point of the import.
    if not resized and source.suffix.lower() in (".png", ".jpg", ".jpeg", ".webp"):
        verbatim = target_dir / ("featured" + source.suffix.lower())
        candidate = target_dir / "_probe.jpg"
        im.save(candidate, "JPEG", quality=QUALITY, optimize=True)
        probe_size = candidate.stat().st_size
        candidate.unlink()
        if source.stat().st_size <= probe_size:
            verbatim.write_bytes(source.read_bytes())
            return verbatim, round(source.stat().st_size / 1024), round(verbatim.stat().st_size / 1024)

    as_jpeg = target_dir / "featured.jpg"
    as_png = target_dir / "featured.png"
    im.save(as_jpeg, "JPEG", quality=QUALITY, optimize=True)
    im.save(as_png, "PNG", optimize=True)

    if as_png.stat().st_size < as_jpeg.stat().st_size:
        as_jpeg.unlink()
        written = as_png
    else:
        as_png.unlink()
        written = as_jpeg

    return written, round(source.stat().st_size / 1024), round(written.stat().st_size / 1024)


def copy_pdf(folder: Path, target_dir: Path) -> tuple[int, float]:
    """Copy the old folder's PDF across, verbatim. Returns (count, MB).

    Renamed to `<slug>.pdf` on the way: the old name is a citation key
    (`makowski2015emotion.pdf`) that means nothing in a tree keyed by year and
    title, and `update_publications.py` finds a PDF by glob rather than by name,
    so nothing depends on what it is called.

    Left alone if the target already has one — a PDF put there by hand is the
    better copy by definition.
    """
    if any(target_dir.glob("*.pdf")):
        return 0, 0.0
    sources = sorted(folder.glob("*.pdf"))
    if not sources:
        return 0, 0.0
    source = sources[0]
    target = target_dir / f"{target_dir.name}.pdf"
    target.write_bytes(source.read_bytes())
    return 1, target.stat().st_size / 1024 / 1024


def main() -> None:
    if not OLD_PUBLICATIONS.is_dir():
        print(f"✗ old site not found at {OLD_PUBLICATIONS}")
        sys.exit(1)

    publications = json.loads(MANIFEST.read_text(encoding="utf-8"))["publications"]
    by_doi = {p["doi"].lower(): p for p in publications if p.get("doi")}
    by_title = {normalise_title(p["title"]): p for p in publications}

    copied = skipped = unmatched = pdfs = 0
    saved_from = saved_to = 0
    pdf_mb = 0.0

    for index_md in sorted(OLD_PUBLICATIONS.glob("*/index.md")):
        folder = index_md.parent
        source = next((folder / name for name in SOURCE_NAMES if (folder / name).exists()), None)
        if source is None:
            # A `featured.*` in a format not listed above is the failure this
            # reports: it is indistinguishable from "no figure here" otherwise,
            # and that is exactly how a .gif was passed over in the first run.
            stray = [p.name for p in folder.glob("featured.*")]
            if stray:
                print(f"  ✗ {folder.name}: unrecognised figure format {stray} — add it to SOURCE_NAMES")
                unmatched += 1
            # Deliberately not `continue`: a folder may hold a PDF and no
            # figure, and the two are independent. Resolving the match comes
            # first for exactly that reason.

        meta = read_front_matter(index_md)
        match = by_doi.get(meta["doi"]) or by_title.get(normalise_title(meta["title"]))
        if match is None:
            # Almost always a paper no longer on the ORCID profile, so there is
            # no folder here to put it in. Reported rather than passed over —
            # the other reading is that a title changed and the join broke.
            print(f"  ? no match for {folder.name}: {meta['title'][:60]}")
            unmatched += 1
            continue

        target_dir = NEW_PUBLICATIONS / match["folder"]
        if not target_dir.is_dir():
            print(f"  ✗ {match['folder']} has no folder — run update_publications.py first")
            unmatched += 1
            continue

        # The PDF is copied whether or not there is a figure, and vice versa —
        # a publication can perfectly well have one and not the other.
        moved, mb = copy_pdf(folder, target_dir)
        pdfs += moved
        pdf_mb += mb

        if source is None or any(target_dir.glob("featured.*")):
            skipped += 1
            continue

        written, before, after = encode(source, target_dir)
        saved_from += before
        saved_to += after
        copied += 1
        print(f"  ✓ {folder.name} → {match['folder']}/{written.name}  ({before} KB → {after} KB)")

    print(f"\n✓ {copied} figure(s) imported, {skipped} skipped, {unmatched} unmatched")
    if copied:
        print(f"  figures: {saved_from / 1024:.1f} MB → {saved_to / 1024:.1f} MB")
    print(f"✓ {pdfs} PDF(s) copied verbatim — {pdf_mb:.1f} MB")
    if copied or pdfs:
        print("  Now run: python update_publications.py")


if __name__ == "__main__":
    main()
