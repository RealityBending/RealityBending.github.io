"""Give every piece of content a real URL, and put its text in the raw HTML.

Run after the three update_*.py scripts and after tools/build_legacy_map.py:

    python update_people.py && python update_publications.py && python update_news.py
    python tools/build_legacy_map.py
    python generate_pages.py

── What this writes ──
    news/<slug>/index.html          one per post
    news/index.html                 the archive, every post as a real <a href>
    people/<folder>/index.html      one per member
    people/index.html               the lab, every member linked
    people/memories/<slug>/index.html   one per photograph, the picture as og:image
    publications/<slug>/index.html  one per publication
    publications/index.html         the list, every publication linked
    research/ information/ join/ services/ + their tabs
    <old path>/index.html           redirect stubs, from legacy_map.json
    sitemap.xml                     all of the above
    robots.txt                      the crawl policy + the sitemap pointer
    llms.txt                        rewritten against the real paths

── How a generated page differs from index.html ──
Not much, and that is the point. It IS index.html — same shell, same scripts,
same stylesheets — with four changes:

  1. the head's title / description / canonical / og:* describe this one thing
  2. a second JSON-LD block describes it in schema.org terms
  3. <body data-route="…"> tells deep-link.js which route the page is for
  4. a #prerender block holds the content as plain semantic HTML

(4) is the whole trick. The inline bootstrap in index.html removes it before
the first paint, so a reader with JavaScript never sees it — the modules open
the real panel over the same content, exactly as they do for any other route,
and the site looks and behaves identically. A crawler that runs nothing keeps
it, and so does a reader with no JavaScript.

Because nobody with JavaScript ever sees it, the markup here does NOT have to
match what news.js or people.js build. It only has to be correct and readable.
That is what keeps this script from becoming a second renderer that has to be
held in step with the first — the tax that usually kills this kind of thing.

── <base> is what makes a page at depth work, and it is relative ──
A page at /news/x/ cannot resolve `css/01-base.css` on its own, and neither can
`fetch("news/news_manifest.json")` inside news.js — the modules resolve their
URLs against the *document*. So every page carries a `<base>`: `./` for
index.html, `../` per level for a generated one.

Relative, never `/`. A root-absolute base is right only if the site is mounted
at the domain root — true in production, false for the site served under a
sub-path, and false over file://, both of which it breaks completely (no
stylesheets, no modules, a bare page). A relative base is
resolved once at parse time against the document's own URL and then frozen,
which is equally proof against `writeRoute` moving the path afterwards.

Everything in the generated markup is therefore relative to that base. The only
absolute URLs are the ones crawlers require: canonical, og:*, JSON-LD @ids,
sitemap entries and the redirect stubs' targets.
"""

import html
import json
import random
import re
import sys
import textwrap
from pathlib import Path

# ── Two lines that a notebook does not have ──
# A Windows console defaults to cp1252 and these scripts print ✓/✗ and names, so
# without the reconfigure they do their work and then die on the summary line —
# which reads exactly like a failure to write the files. But `sys.stdout` in a
# Jupyter/IPython cell is an ipykernel `OutStream`, which has no `reconfigure`,
# and `__file__` is not defined there at all. Both are guarded rather than
# assumed, the same way the three update_*.py scripts already do it: this is a
# repository people open in a notebook.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    ROOT = Path(__file__).resolve().parent
except NameError:
    ROOT = Path.cwd()

TEMPLATE = ROOT / "index.html"

# ── And then the guess is checked, because this script *writes* ──
# The `Path.cwd()` fallback above is a guess, and unlike the update_*.py scripts
# — which write one manifest into a folder they also read — this one writes ~250
# files and two site-wide indexes. A wrong ROOT means a site scattered into
# whatever directory the notebook happened to start in. index.html is the one
# file that must be here, so its absence is the cheapest possible proof that
# ROOT is wrong, and it is checked before anything is created.
if not TEMPLATE.exists():
    raise SystemExit(
        f"generate_pages: no index.html in {ROOT}\n"
        "  This script must run from the repository root. From a notebook, "
        "`__file__` does not exist and the working directory is used instead — "
        "os.chdir() to the repo root first, or run it as "
        "`python generate_pages.py`."
    )


def _site_url() -> str:
    """The deployed origin, read from index.html's own canonical.

    ── Why it is not a constant here ──
    It used to be, and it was one of four copies of the same fact — this
    module, `shared/page-meta.js`, `robots.txt`, and index.html's
    canonical/og/JSON-LD — with nothing keeping them in step. A wrong one never
    404s: Pages still answers on `realitybending.github.io` and 301s to the
    custom domain, so a stale copy quietly points every indexed page at the
    wrong host while every link a human clicks still works. That is exactly how
    it went unnoticed for months.

    So there is one literal now, in the one file a crawler actually reads it
    from, and everything else derives:

        index.html <link rel="canonical">   the source
          ├── this module (and so sitemap.xml, llms.txt, robots.txt)
          └── shared/page-meta.js, off the live DOM

    CNAME is checked against it rather than being a fifth copy: it is the
    deployed artifact's only record of the domain, it is what Pages serves on,
    and the two disagreeing is a misconfiguration nothing else would report.
    """
    head = TEMPLATE.read_text(encoding="utf-8")
    found = re.search(r'<link rel="canonical" href="(https?://[^"]+?)/?"', head)
    if not found:
        raise SystemExit(
            "generate_pages: index.html has no absolute <link rel=\"canonical\">. "
            "That tag is where the deployed origin is written, and every "
            "absolute URL this script emits derives from it."
        )
    origin = found.group(1).rstrip("/")

    cname = ROOT / "CNAME"
    if cname.exists():
        host = cname.read_text(encoding="utf-8").strip()
        if host and host != origin.split("//", 1)[1]:
            raise SystemExit(
                f"generate_pages: CNAME says '{host}' but index.html's canonical "
                f"says '{origin}'. Pages serves on the CNAME; every canonical, "
                f"og:url and sitemap entry would point somewhere else."
            )
    return origin


SITE_URL = _site_url()

SECTION_IDS = {
    "people": "sec-people-full",
    "research": "sec-research-full",
    "news": "sec-news-full",
    "publications": "sec-publications-full",
    "information": "sec-contact-full",
    "join": "sec-contact-full",
    "services": "sec-contact-full",
}

written: list[str] = []
sitemap_urls: list[str] = []


# ── helpers ──────────────────────────────────────────────────────────────────


def esc(value) -> str:
    """Escape for HTML text and attributes.

    Everything that is *data* goes through this. The two things that do not are
    a post's `content` and a member's `summary`/`details`, which are HTML by
    design — written by the lab, in the lab's own repository, and reviewed like
    every other file here. That is the same contract news.js and people.js
    already work to.
    """
    return html.escape("" if value is None else str(value), quote=True)


def strip_tags(value) -> str:
    """Plain text from HTML, for a meta description or an og:description."""
    text = re.sub(r"<[^>]+>", " ", value or "")
    return re.sub(r"\s+", " ", html.unescape(text)).strip()


def clip(text: str, limit: int = 300) -> str:
    """A description long enough to be useful and short enough not to be cut.

    Trimmed at a word boundary — a description that ends mid-word reads as
    broken rather than as truncated.
    """
    text = (text or "").strip()
    if len(text) <= limit:
        return text
    return text[:limit].rsplit(" ", 1)[0].rstrip(",;:.") + "…"


def absolute(path: str) -> str:
    """A site-relative path as the absolute URL og:* and JSON-LD require."""
    if not path:
        return ""
    if path.startswith(("http://", "https://")):
        return path
    return SITE_URL + "/" + path.lstrip("/")


def rebase_content_images(content: str, base: str) -> str:
    """`<img src="mint.jpg">` names a file in the post's own folder.

    news.js re-bases these at runtime; a generated page has to do the same, or
    every figure in the pre-rendered copy is a broken link in the one version a
    crawler actually reads.
    """

    def fix(match):
        attr, url = match.group(1), match.group(2)
        if url.startswith(("http://", "https://", "/", "data:", "#")):
            return match.group(0)
        return f'{attr}="{base}/{url}"'

    return re.sub(r'\b(src|poster)="([^"]+)"', fix, content or "")


# ── the shell ────────────────────────────────────────────────────────────────


# Relative to the page's <base>, not root-absolute — so a generated page works
# wherever the site is mounted, exactly as index.html now does.
ANCHOR_PATHS = {
    "sec-people-full": "people/",
    "sec-research-full": "research/",
    "sec-news-full": "news/",
    "sec-publications-full": "publications/",
    "sec-contact-full": "information/",
}
TAB_PATHS = {"join": "information/join/", "services": "information/services/"}


def link_fragments_to_paths(shell: str) -> str:
    """`href="#sec-people-full"` becomes `href="/people/"` — on generated pages only.

    This is the site's only real internal link graph. The homepage's nav is all
    fragments, which a crawler reads as links to the page it is already on;
    these are followable links from every generated page to all six sections,
    and they are why no footer link row was needed.

    The trade is deliberate. script.js intercepts `#sec-…` clicks and scrolls
    without reloading, so leaving them alone would keep generated pages feeling
    exactly like the homepage — at the cost of the link graph. A real section
    path costs one page load and lands in the same place, which for a reader who
    arrived from a search result is ordinary behaviour rather than a loss.

    index.html itself is untouched: the homepage's nav is still fragments, still
    scrolled in place.
    """

    def fix(match):
        tag, anchor = match.group(0), match.group(1)
        target = re.search(r'data-contact-tab-target="([^"]+)"', tag)
        path = (TAB_PATHS.get(target.group(1)) if target else None) or ANCHOR_PATHS.get(
            anchor
        )
        return tag.replace(f'href="#{anchor}"', f'href="{path}"') if path else tag

    return re.sub(r'<a\b[^>]*href="#(sec-[a-z-]+)"[^>]*>', fix, shell)


def load_template() -> str:
    """index.html, with its section anchors turned into section paths.

    **Asset URLs are deliberately left relative.** An earlier version rewrote
    every `src=`/`href=` to root-absolute, which works only if the site is
    mounted at the domain root — true in production, false for the site served
    under a sub-path, and false over file://. The `<base>` each page carries
    does the same job without the assumption, so there is nothing here to
    rewrite.

    That `<base>` is what makes a page at depth work at all: the modules
    resolve their own URLs against the *document*, not against themselves —
    `fetch("news/news_manifest.json")`, `fetch(post.file)`, every
    manifest-held avatar and figure path. index.html carries `./`; each
    generated page gets its own `../`-per-level in `build_page`.
    """
    shell = TEMPLATE.read_text(encoding="utf-8")

    if '<base href="./" />' not in shell:
        raise SystemExit(
            'generate_pages: index.html has no <base href="./" />. Every '
            "site-relative URL on a generated page would resolve against that "
            "page's own directory and 404, silently — as blank panels rather "
            "than as an error. Restore it before generating."
        )

    return link_fragments_to_paths(shell)


def set_tag(shell: str, pattern: str, replacement: str, label: str) -> str:
    """One targeted head substitution, and it must hit.

    Prettier wraps these attributes across lines, so the patterns are written
    with DOTALL and are easy to break by reformatting index.html. A silent miss
    would mean 120 pages all describing themselves as the homepage, which is
    the exact failure this whole exercise is meant to remove — so a miss is
    fatal rather than warned about.
    """
    out, count = re.subn(pattern, lambda _: replacement, shell, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(
            f"generate_pages: could not set {label} in index.html — the head's "
            f"markup has changed and this pattern no longer matches:\n  {pattern}"
        )
    return out


def build_page(
    shell: str,
    *,
    route,
    path,
    title,
    description,
    image,
    prerender,
    jsonld=None,
    canonical=None,
) -> str:
    """One generated page: the shell, re-headed and given its content.

    `canonical` overrides the self-canonical for the handful of paths that are a
    second address for a page that already exists — see CANONICAL_ALIASES.
    """
    url = SITE_URL + path
    canonical_url = SITE_URL + (canonical or path)
    desc = clip(strip_tags(description)) or (
        "The Reality Bending Lab at the University of Sussex — the neuropsychology "
        "of reality and its distortions."
    )
    page_title = f"{title} — Reality Bending Lab"

    out = shell

    # One `../` per level of this page's own path, so every relative URL on it
    # resolves back to the site root wherever the site happens to be mounted.
    # `/news/2023-new-logo/` is two deep; `/news/` is one.
    depth = len([p for p in path.split("/") if p])
    out = set_tag(
        out,
        r'<base href="\./" />',
        f'<base href="{"../" * depth or "./"}" />',
        "<base>",
    )

    out = set_tag(
        out, r"<title>.*?</title>", f"<title>{esc(page_title)}</title>", "<title>"
    )
    out = set_tag(
        out,
        r'<meta\s+name="description"\s+content=".*?"\s*/>',
        f'<meta name="description" content="{esc(desc)}" />',
        "meta description",
    )
    out = set_tag(
        out,
        r'<link rel="canonical" href=".*?" />',
        # Self-canonical unless the caller names an alias. Pointing a
        # publication page at its DOI or its publisher is the instinctively
        # honest thing to do and it deindexes the page completely; the
        # relationship belongs in JSON-LD instead. The exception is a path that
        # is genuinely a *second address for the same view* — see
        # CANONICAL_ALIASES — where self-canonical is what creates the
        # duplicate rather than what prevents it.
        f'<link rel="canonical" href="{esc(canonical_url)}" />',
        "canonical",
    )
    out = set_tag(
        out,
        r'<meta property="og:title" content=".*?" />',
        f'<meta property="og:title" content="{esc(title)}" />',
        "og:title",
    )
    out = set_tag(
        out,
        r'<meta\s+property="og:description"\s+content=".*?"\s*/>',
        f'<meta property="og:description" content="{esc(desc)}" />',
        "og:description",
    )
    out = set_tag(
        out,
        r'<meta property="og:url" content=".*?" />',
        f'<meta property="og:url" content="{esc(url)}" />',
        "og:url",
    )
    if image:
        out = set_tag(
            out,
            r'<meta property="og:image" content=".*?" />',
            f'<meta property="og:image" content="{esc(absolute(image))}" />',
            "og:image",
        )
        # The homepage's card is a known 1200×630. An arbitrary figure or avatar
        # is not, and a wrong declared size crops the preview badly — better to
        # let the crawler measure the file.
        out = re.sub(
            r'\s*<meta property="og:image:(width|height)" content="\d+" />', "", out
        )

    # A second JSON-LD block rather than a rewrite of the first: the graph in
    # index.html describes the lab and the website, which is true on every page,
    # and consumers merge multiple blocks.
    if jsonld:
        block = (
            '        <script type="application/ld+json">\n'
            + json.dumps(jsonld, indent=4, ensure_ascii=False)
            + "\n        </script>\n    </head>"
        )
        out = out.replace("    </head>", block, 1)

    out = out.replace("<body>", f'<body data-route="{esc(route)}">', 1)
    out = out.replace(
        f'<body data-route="{esc(route)}">',
        f'<body data-route="{esc(route)}">\n{prerender}',
        1,
    )
    return out


# ── the pre-render block ─────────────────────────────────────────────────────

PRERENDER_CSS = """
        <style>
            /* Only ever seen by a reader with no JavaScript — the inline
               bootstrap removes this block before the first paint for everyone
               else. Deliberately plain: it is a legible fallback, not a second
               design to maintain. */
            #prerender {
                max-width: 44rem;
                margin: 0 auto;
                padding: 2rem 1.25rem 4rem;
                background: #f5f4ef;
                color: #23262b;
                font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                line-height: 1.65;
                position: relative;
                z-index: 20;
            }
            #prerender img { max-width: 100%; height: auto; }
            #prerender a { color: #2f5fa8; }
            #prerender h1 { font-size: 1.9rem; line-height: 1.2; }
            #prerender .crumbs, #prerender .meta { color: #6b7078; font-size: 0.92rem; }
            #prerender ul { padding-left: 1.1rem; }
            #prerender li { margin-bottom: 0.6rem; }
        </style>
"""


def prerender(body: str) -> str:
    return f'        <div id="prerender">{PRERENDER_CSS}{body}\n        </div>'


def crumbs(*parts) -> str:
    """`Reality Bending Lab › News › this post`, as real links.

    These are the only internal links in the raw HTML, so they are also how a
    crawler that follows links rather than sitemaps walks the site.
    """
    links = ['<a href="./">Reality Bending Lab</a>']
    for label, href in parts:
        links.append(f'<a href="{esc(href)}">{esc(label)}</a>' if href else esc(label))
    return '<p class="crumbs">' + " › ".join(links) + "</p>"


# ── page builders ────────────────────────────────────────────────────────────


def write(path: str, content: str) -> None:
    target = ROOT / path.strip("/")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    written.append(path)


def related_posts(post: dict, posts: list, count: int = 3) -> list:
    """The three "Keep reading" links at the foot of a post's page.

    `related_publications` below, for the news: three links turn the archive
    into a graph a crawler can walk rather than 48 leaves hanging off one hub.

    Random, not related — on purpose. news.js draws its three at random from
    the rest of the archive on every open, and the page does the same, because
    a scored pick (category, author) sent every Awards post to three other
    Awards posts and every essay to three essays: a closed loop that never
    showed a reader another shelf. The publications keep their keyword scoring
    because 63 papers on a dozen topics *have* shelves worth walking; 48 posts
    across six categories do not.

    **Re-rolled on every build, unlike the publications' three.** Those are
    deterministic so that a page's links settle; here a fresh three per deploy
    is the point — every deploy re-mixes the archive, and the generated pages
    are not in git, so there is no diff to churn.
    """
    others = [other for other in posts if other["slug"] != post["slug"]]
    return random.sample(others, min(count, len(others)))


def build_news(shell, posts):
    for post in posts:
        slug = post["slug"]
        detail = json.loads(
            (ROOT / "news" / slug / "post.json").read_text(encoding="utf-8")
        )
        content = detail.get("content") or ""
        if isinstance(content, list):
            content = "".join(content)
        content = rebase_content_images(content, f"news/{slug}")

        authors = ", ".join(
            a["name"] if isinstance(a, dict) else str(a)
            for a in (post.get("authors") or [])
        )
        summary = post.get("summary") or strip_tags(content)
        hero = f'<img src="{post["image"]}" alt="" />' if post.get("image") else ""

        related = related_posts(post, posts)
        see_also = (
            "<h2>Keep reading</h2><ul>"
            + "".join(
                f'<li><a href="news/{esc(other["slug"])}/">{esc(other["title"])}</a>'
                f' <span class="meta">— {esc(other.get("date", ""))}, {esc(other.get("category", ""))}</span></li>'
                for other in related
            )
            + "</ul>"
            if related
            else ""
        )

        body = f"""
            <article>
                {crumbs(("News", "news/"), (post["title"], None))}
                <h1>{esc(post["title"])}</h1>
                <p class="meta">{esc(post.get("date", ""))} · {esc(post.get("category", ""))}{" · " + esc(authors) if authors else ""}</p>
                {hero}
                {content}
                {see_also}
            </article>"""

        jsonld = {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            "headline": post["title"],
            "datePublished": post.get("date"),
            "url": f"{SITE_URL}/news/{slug}/",
            "mainEntityOfPage": f"{SITE_URL}/news/{slug}/",
            "author": [
                {
                    "@type": "Person",
                    "name": a["name"] if isinstance(a, dict) else str(a),
                }
                for a in (post.get("authors") or [])
            ],
            "publisher": {"@id": f"{SITE_URL}/#organization"},
            "articleSection": post.get("category"),
        }
        if post.get("image"):
            jsonld["image"] = absolute(post["image"])
        if summary:
            jsonld["description"] = clip(strip_tags(summary))

        write(
            f"news/{slug}/index.html",
            build_page(
                shell,
                route=f"post-{slug}",
                path=f"/news/{slug}/",
                title=post["title"],
                description=summary,
                image=post.get("image"),
                prerender=prerender(body),
                jsonld=jsonld,
            ),
        )
        sitemap_urls.append(f"/news/{slug}/")

    items = "\n".join(
        f'                    <li><a href="news/{esc(p["slug"])}/">{esc(p["title"])}</a>'
        f' <span class="meta">— {esc(p.get("date",""))}, {esc(p.get("category",""))}</span>'
        f"<br />{esc(clip(strip_tags(p.get('summary')), 200))}</li>"
        for p in posts
    )
    body = f"""
            <div>
                {crumbs(("News", None))}
                <h1>News</h1>
                <p>Posts, essays and announcements from the Reality Bending Lab.</p>
                <ul>
{items}
                </ul>
            </div>"""
    write(
        "news/index.html",
        build_page(
            shell,
            route="news",
            path="/news/",
            title="News",
            description="Posts, essays and announcements from the Reality Bending Lab at the University of Sussex.",
            image=None,
            prerender=prerender(body),
        ),
    )
    sitemap_urls.append("/news/")


def build_people(shell, members):
    for m in members:
        folder = m["folder"]
        bio = (m.get("summary") or "") + (m.get("details") or "")
        # A list of {label, url}, not a mapping — update_people.py keeps the
        # order the profile panel shows them in.
        socials = [s for s in (m.get("socials") or []) if s.get("url")]
        links = "".join(
            f'<li><a href="{esc(s["url"])}" rel="noopener noreferrer">{esc(s.get("label") or s["url"])}</a></li>'
            for s in socials
        )
        avatar = (
            f'<img src="{m["avatar"]}" alt="{esc(m["name"])}" width="220" />'
            if m.get("avatar")
            else ""
        )

        body = f"""
            <article>
                {crumbs(("People", "people/"), (m["name"], None))}
                <h1>{esc(m["name"])}</h1>
                <p class="meta">{esc(m.get("title") or m.get("category") or "")}{" · " + esc(m["affiliation"]) if m.get("affiliation") else ""}</p>
                {avatar}
                {bio}
                {f"<ul>{links}</ul>" if links else ""}
            </article>"""

        jsonld = {
            "@context": "https://schema.org",
            "@type": "Person",
            "name": m["name"],
            "url": f"{SITE_URL}/people/{folder}/",
            "affiliation": {"@id": f"{SITE_URL}/#organization"},
            "worksFor": {"@id": f"{SITE_URL}/#organization"},
        }
        if m.get("title"):
            jsonld["jobTitle"] = m["title"]
        if m.get("avatar"):
            jsonld["image"] = absolute(m["avatar"])
        if socials:
            jsonld["sameAs"] = [s["url"] for s in socials]
        # `interests` is the research-facing list and is what knowsAbout means;
        # `keywords` here is the three-word tag set the People grid filters on.
        if m.get("interests") or m.get("keywords"):
            jsonld["knowsAbout"] = m.get("interests") or m.get("keywords")

        write(
            f"people/{folder}/index.html",
            build_page(
                shell,
                route=folder,
                path=f"/people/{folder}/",
                title=m["name"],
                description=m.get("hook") or strip_tags(m.get("summary")),
                image=m.get("avatar"),
                prerender=prerender(body),
                jsonld=jsonld,
            ),
        )
        sitemap_urls.append(f"/people/{folder}/")

    items = "\n".join(
        f'                    <li><a href="people/{esc(m["folder"])}/">{esc(m["name"])}</a>'
        f' <span class="meta">— {esc(m.get("title") or m.get("category") or "")}</span></li>'
        for m in members
    )
    body = f"""
            <div>
                {crumbs(("People", None))}
                <h1>People</h1>
                <p>The Reality Bending Lab, University of Sussex.</p>
                <ul>
{items}
                </ul>
            </div>"""
    write(
        "people/index.html",
        build_page(
            shell,
            route="people",
            path="/people/",
            title="People",
            description="Members of the Reality Bending Lab at the University of Sussex.",
            image=None,
            prerender=prerender(body),
        ),
    )
    sitemap_urls.append("/people/")


def build_memories(shell, memories, members):
    """One page per photograph in the Memories tab.

    ── Why these get pages at all ──
    A memory is the one thing on this site whose *point* is the picture, and a
    link to a picture is shared into a chat client far more often than it is
    typed into a search bar. Without a page of its own, every one of the 32
    resolved to the homepage and previewed as the site's own og-card — so the
    thing being sent was never the thing that arrived. The page's `og:image` is
    the photograph, which is the whole of what this is for.

    `/people/memories/<slug>/` — three segments, the only route on the site that
    is. It nests under the tab because that is where closing the viewer leaves
    the reader (see routes.js, MEMORY_BASE), and because a slug that deep cannot
    collide with a member folder.

    ── The people in it are real links ──
    Both directions of that were already in the data (`people` on the memory,
    and the profile panel's own strip), and they are the only internal links a
    crawler can follow out of one of these pages other than the crumbs. A folder
    that names no member is dropped rather than linked: guests appear in these
    photographs too.
    """
    names = {m["folder"]: m["name"] for m in members}

    for memory in memories:
        slug = memory.get("slug")
        if not slug:
            continue

        title = memory.get("title") or memory.get("filename") or "Memory"
        caption = memory.get("caption") or ""
        when = str(memory.get("year") or "").strip()
        shown = [f for f in (memory.get("people") or []) if f in names]

        people_links = ", ".join(
            f'<a href="people/{esc(f)}/">{esc(names[f])}</a>' for f in shown
        )
        meta = " · ".join(part for part in (when, people_links) if part)

        body = f"""
            <figure>
                {crumbs(("People", "people/"), ("Memories", "people/memories/"), (title, None))}
                <h1>{esc(title)}</h1>
                <img src="{esc(memory["file"])}" alt="{esc(caption or title)}" />
                <figcaption>
                    {f"<p>{esc(caption)}</p>" if caption else ""}
                    {f'<p class="meta">{meta}</p>' if meta else ""}
                </figcaption>
            </figure>"""

        jsonld = {
            "@context": "https://schema.org",
            "@type": "ImageObject",
            "name": title,
            "contentUrl": absolute(memory["file"]),
            "url": f"{SITE_URL}/people/memories/{slug}/",
            "isPartOf": {"@id": f"{SITE_URL}/#website"},
            "copyrightHolder": {"@id": f"{SITE_URL}/#organization"},
        }
        if caption:
            jsonld["caption"] = caption
        if when:
            jsonld["datePublished"] = when
        if shown:
            jsonld["about"] = [
                {"@type": "Person", "name": names[f], "url": f"{SITE_URL}/people/{f}/"}
                for f in shown
            ]

        write(
            f"people/memories/{slug}/index.html",
            build_page(
                shell,
                route=f"memory-{slug}",
                path=f"/people/memories/{slug}/",
                title=title,
                # The caption is the only prose a memory has; the title is
                # already the <title>, so falling back to it would make the
                # description a duplicate of it rather than a second sentence.
                description=caption or f"{title} — the Reality Bending Lab.",
                image=memory["file"],
                prerender=prerender(body),
                jsonld=jsonld,
            ),
        )
        sitemap_urls.append(f"/people/memories/{slug}/")


def apa_reference(p: dict) -> str:
    """The APA reference, in the exact shape publications.js prints in the panel.

    Two copies of one format is a thing to be uneasy about, and the alternative
    was worse: the reference is the single most copied string on a publication
    page, so it has to be in the raw HTML (a crawler and a reader with no
    JavaScript both want it), *and* in the panel (which is where a reader
    actually is). A generated JSON of pre-rendered references would be a third
    artefact to keep in step. If these two drift, this is the pair to look at.
    """
    year = f"({p['year']})" if p.get("year") else "(n.d.)"
    journal = f" {p['journal']}." if p.get("journal") else ""
    doi = f" https://doi.org/{p['doi']}" if p.get("doi") else ""
    return f"{p.get('authors') or 'Unknown'} {year}. {p.get('title', '')}.{journal}{doi}"


def related_publications(p: dict, publications: list, count: int = 3) -> list:
    """The three "See also" links at the foot of a publication page.

    ── Why these exist at all ──
    Before them a publication page's only outgoing internal links were its
    breadcrumbs, so 67 of the site's ~250 pages were leaves: a crawler that
    walks links rather than the sitemap reached one and had nowhere to go but
    back up. Three related papers turn the archive into a graph, and they are
    the reason `keywords` was filled in on every entry.

    ── Ranked, and deterministic — unlike the panel's ──
    publications.js re-rolls its three on every open, out of the best-scoring
    band, because a reader who opens the same paper twice should be offered
    something new. A *page* must not: a build that produced different internal
    links every time would churn 67 files per deploy and never let a link
    settle. So the tie-breaks here are total — shared keywords, then the
    nearest year, then the folder name — and the same build always emits the
    same three.

    Entries whose title matches are dropped along with the paper itself. That
    is a backstop, not the plan — a preprint and its journal version must never
    both reach the manifest, and update_publications.py is where that is
    enforced — but it is one line here and "see also: this same paper" reads as
    a bug to every reader who meets it.
    """
    mine = {kw.lower() for kw in (p.get("keywords") or [])}
    own_title = re.sub(r"[^a-z0-9]+", " ", (p.get("title") or "").lower()).strip()
    year = p.get("year") or 0

    candidates = [
        other
        for other in publications
        if other["folder"] != p["folder"]
        and re.sub(r"[^a-z0-9]+", " ", (other.get("title") or "").lower()).strip()
        != own_title
    ]
    candidates.sort(
        key=lambda other: (
            -len(mine & {kw.lower() for kw in (other.get("keywords") or [])}),
            abs((other.get("year") or 0) - year),
            other["folder"],
        )
    )
    return candidates[:count]


def build_publications(shell, publications):
    for p in publications:
        folder = p["folder"]
        info_path = ROOT / "publications" / folder / "info.json"
        info = (
            json.loads(info_path.read_text(encoding="utf-8"))
            if info_path.exists()
            else p
        )
        abstract = (info.get("abstract") or "").strip()
        summary = (info.get("summary") or "").strip()
        doi = p.get("doi") or ""
        keywords = p.get("keywords") or []

        bits = []
        if summary:
            bits.append(f"<p><strong>{esc(summary)}</strong></p>")
        if abstract:
            bits.append(f"<h2>Abstract</h2><p>{esc(abstract)}</p>")
        if p.get("featured"):
            bits.append(f'<img src="{p["featured"]}" alt="" />')
        refs = []
        if doi:
            refs.append(
                f'<li>DOI: <a href="https://doi.org/{esc(doi)}">{esc(doi)}</a></li>'
            )
        if p.get("pdf"):
            refs.append(f'<li><a href="{esc(p["pdf"])}">Full text (PDF)</a></li>')
        if refs:
            bits.append("<ul>" + "".join(refs) + "</ul>")
        if keywords:
            # Text, not links. A keyword is a filter in the panel, but that
            # filter is client state with no URL of its own — the site has had
            # no query-string state since Publications' own `?section=&tab=`
            # went (see docs/routing.md), and inventing one here would be a
            # link that looks like it does something and does not.
            bits.append(
                '<p class="meta">Keywords: '
                + esc(" · ".join(keywords))
                + "</p>"
            )
        # The reference, spelled out. It is the most copied string on one of
        # these pages and the reason somebody lands here from a search for the
        # title, so it belongs in the raw HTML rather than only in the panel.
        bits.append(f"<h2>Cite</h2><p>{esc(apa_reference(p))}</p>")

        # `Journal, 2025 · Preprint`, with nothing left dangling when a part is
        # missing. It was an f-string that pasted `", " + year` onto the
        # journal, so the 12 entries with no journal — preprints, the thesis,
        # the book chapter — each opened with a bare comma.
        state = " · ".join(
            part
            for part in (
                ", ".join(
                    bit
                    for bit in (p.get("journal") or "", str(p["year"]) if p.get("year") else "")
                    if bit
                ),
                "Preprint" if p.get("is_preprint") else "",
            )
            if part
        )

        related = related_publications(p, publications)
        if related:
            bits.append(
                "<h2>See also</h2><ul>"
                + "".join(
                    f'<li><a href="publications/{esc(other["folder"])}/">{esc(other["title"])}</a>'
                    f' <span class="meta">— {esc(other.get("authors", ""))}'
                    f' ({esc(other.get("year") or "n.d.")})</span></li>'
                    for other in related
                )
                + "</ul>"
            )

        body = f"""
            <article>
                {crumbs(("Publications", "publications/"), (p["title"], None))}
                <h1>{esc(p["title"])}</h1>
                <p class="meta">{esc(p.get("authors", ""))}</p>
                {f'<p class="meta">{esc(state)}</p>' if state else ""}
                {"".join(bits)}
            </article>"""

        jsonld = {
            "@context": "https://schema.org",
            "@type": "ScholarlyArticle",
            "headline": p["title"],
            "name": p["title"],
            "url": f"{SITE_URL}/publications/{folder}/",
            "author": {"@id": f"{SITE_URL}/#dominique-makowski"},
            "publisher": {"@id": f"{SITE_URL}/#organization"},
        }
        if p.get("year"):
            jsonld["datePublished"] = str(p["year"])
        if p.get("journal"):
            jsonld["isPartOf"] = {"@type": "Periodical", "name": p["journal"]}
        if doi:
            # The DOI is the relationship, expressed where it cannot cost the
            # page its own index entry. See the canonical note in build_page.
            jsonld["identifier"] = f"https://doi.org/{doi}"
            jsonld["sameAs"] = f"https://doi.org/{doi}"
        if abstract:
            jsonld["abstract"] = abstract
        if p.get("keywords"):
            jsonld["keywords"] = p["keywords"]

        write(
            f"publications/{folder}/index.html",
            build_page(
                shell,
                route=f"pub-{folder}",
                path=f"/publications/{folder}/",
                title=p["title"],
                description=summary
                or abstract
                or f'{p.get("authors","")} ({p.get("year","")}). {p.get("journal","")}',
                image=p.get("featured"),
                prerender=prerender(body),
                jsonld=jsonld,
            ),
        )
        sitemap_urls.append(f"/publications/{folder}/")

    items = "\n".join(
        f'                    <li><a href="publications/{esc(p["folder"])}/">{esc(p["title"])}</a>'
        f' <span class="meta">— {esc(p.get("authors",""))} ({esc(p.get("year") or "n.d.")})'
        f'{", " + esc(p["journal"]) if p.get("journal") else ""}</span></li>'
        for p in publications
    )
    body = f"""
            <div>
                {crumbs(("Publications", None))}
                <h1>Publications</h1>
                <p>Journal articles, preprints and book chapters from the Reality Bending Lab.</p>
                <ul>
{items}
                </ul>
            </div>"""
    write(
        "publications/index.html",
        build_page(
            shell,
            route="publications",
            path="/publications/",
            title="Publications",
            description="Journal articles, preprints and book chapters from the Reality Bending Lab at the University of Sussex.",
            image=None,
            prerender=prerender(body),
        ),
    )
    sitemap_urls.append("/publications/")


def service_card_pages():
    """One page per Services card, read out of services-content.js.

    Turning a card over writes `/services/<id>/`, so by the site's own rule
    every one of those has to be a real file — the reader who reloads or shares
    what is in the address bar must not get a 404. They were 404s until this
    existed, which is the failure that rule was written to prevent.

    Scraped rather than hand-listed, and that is the trade: the join stages
    above *are* hand-listed and there are three of them that change once a
    decade, while this list is the lab's client work and grows. A second copy of
    a growing list goes stale silently; a regex against the file it lives in
    cannot. It is narrow on purpose — `id:` at the indentation the entries are
    written at, inside `entries:` only — and raises if it finds nothing, because
    a content module that has been reformatted past it must not quietly produce
    zero pages.

    A card's page is a signpost, like the tab pages: its back face carries the
    same invitation as every other card's, so there is nothing per-card to
    pre-render beyond the title that names it.
    """
    source = (ROOT / "information" / "services-content.js").read_text(encoding="utf-8")
    entries = re.search(r"\n    entries:\s*\[(.*?)\n    \],", source, re.S)
    if not entries:
        raise SystemExit(
            "generate_pages.py: could not find `entries:` in services-content.js"
        )

    cards = re.findall(r'^\s*id:\s*"([^"]+)"', entries.group(1), re.M)
    titles = dict(
        re.findall(r'id:\s*"([^"]+)".*?title:\s*"([^"]+)"', entries.group(1), re.S)
    )
    if not cards:
        raise SystemExit(
            "generate_pages.py: no service card ids found in services-content.js"
        )

    return [
        (
            f"services-{card}",
            f"/services/{card}/",
            titles.get(card, "Services") + " — Services",
            f"{titles.get(card, 'Work')} — one of the projects and services the Reality Bending Lab delivers.",
        )
        for card in cards
    ]


# ── Two addresses for one view ──
# `/join/` and `/services/` show exactly what `/information/join/` and
# `/information/services/` show: the same tab of the same section, with the same
# pre-render. Both shapes have to exist as files — routes.js can produce either,
# and the old site's `jobs` index redirects to the first — but only one of each
# pair should be a search result, or they compete with each other for it.
#
# The `/information/…` form wins because it is the one the *site* writes: press
# the Join tab and `activateContactTab` puts `/information/join/` in the address
# bar, so it is the URL readers will actually share and link. The short form is
# a way in, not a destination.
#
# Canonical rather than a redirect stub, deliberately. A stub would be the
# stronger signal, but these are live routes the router still writes — turning
# one into a meta-refresh means a reader who lands on `/join/` gets a page
# reload on arrival, and that is exactly the self-redirect trap that cost two
# section hubs (see build_stubs). They also drop out of sitemap.xml below: a
# sitemap advertises destinations, and a page that points its canonical
# elsewhere is not one.
#
# The News pair is the same shape for a different reason: they were the two
# tabs of the News section, the section now has one view, and `news.js` no
# longer writes either route. They stay files because they were the addresses
# the tab bar wrote for a year and are indexed, linked and bookmarked, and
# `news.js` still *lands* them — `/news/featured/` opens the index with the
# Featured chip on, which is the same set of posts the tab showed. What they
# must not go on being is two more search results for the index, which is what
# `/news/` is; hence the canonical, and hence dropping out of sitemap.xml.
CANONICAL_ALIASES = {
    "/join/": "/information/join/",
    "/services/": "/information/services/",
    "/news/all/": "/news/",
    "/news/featured/": "/news/",
}


def build_sections(shell):
    """The routes that are a view rather than a thing.

    They exist so that every path routes.js can produce is a real file — a
    reader who presses a tab and then reloads must not get a 404 — and so the
    hubs have somewhere to point. Their pre-render is a signpost, not content:
    what is on these tabs is built by the modules from data that has no static
    form.
    """
    pages = [
        (
            "research",
            "/research/",
            "Research",
            "How the lab studies the construction and distortion of reality.",
        ),
        (
            "research-overview",
            "/research/overview/",
            "Research — Overview",
            "An illustrated tour of the lab's research programme.",
        ),
        (
            "research-creations",
            "/research/creations/",
            "Research — Creations",
            "Inventions and open-source tools built by the Reality Bending Lab.",
        ),
        (
            "contact",
            "/information/",
            "Information",
            "Contact, how to join the lab, and the services it offers.",
        ),
        # `/information/contact/` as well as bare `/information/`, and it is not
        # redundant: `activateContactTab` writes `contact-<tab>` for every tab
        # including the default one, exactly as People writes `people-lab` (and
        # as News wrote `news-all` before it lost its tabs). It was the one
        # default tab whose page was
        # missing, so pressing the *first* tab of the last section — the most
        # ordinary thing a reader can do there — left an address that 404s on
        # reload.
        (
            "contact-contact",
            "/information/contact/",
            "Contact",
            "How to reach the Reality Bending Lab at the University of Sussex.",
        ),
        (
            "contact-join",
            "/information/join/",
            "Join the Lab",
            "Research assistant, PhD and postdoc routes into the Reality Bending Lab.",
        ),
        (
            "contact-services",
            "/information/services/",
            "Services",
            "Consulting and collaboration with the Reality Bending Lab.",
        ),
        # Bare `/join/` and `/services/` exist because routes.js can produce
        # them (`pathForRoute("join")`) and because legacy_map.json points the
        # old site's `jobs` index at the first. The rule this keeps is that
        # every path the router can write is a real file. They are canonicalised
        # away — see CANONICAL_ALIASES.
        (
            "join",
            "/join/",
            "Join the Lab",
            "Research assistant, PhD and postdoc routes into the Reality Bending Lab.",
        ),
        (
            "services",
            "/services/",
            "Services",
            "Consulting, analysis and collaboration with the Reality Bending Lab.",
        ),
        (
            "join-research-assistant",
            "/join/research-assistant/",
            "Join as a Research Assistant",
            "Assistantships, placements and JRA schemes with the Reality Bending Lab.",
        ),
        (
            "join-phd",
            "/join/phd/",
            "PhD in the Reality Bending Lab",
            "How a PhD in the Reality Bending Lab actually works, and where the funding comes from.",
        ),
        (
            "join-postdoc",
            "/join/postdoc/",
            "Postdoc in the Reality Bending Lab",
            "Fellowships and postdoctoral routes into the Reality Bending Lab.",
        ),
        (
            "people-lab",
            "/people/lab/",
            "The Lab",
            "Members of the Reality Bending Lab.",
        ),
        (
            "people-collaborations",
            "/people/collaborations/",
            "Collaborations",
            "The lab's collaboration network, close collaborators and consultants.",
        ),
        (
            "people-memories",
            "/people/memories/",
            "Memories",
            "Photographs from the life of the Reality Bending Lab.",
        ),
        # The News section's two former tabs. Files, not 404s, because they were
        # live addresses; canonicalised to /news/ because that is now the only
        # view — see CANONICAL_ALIASES.
        (
            "news-all",
            "/news/all/",
            "News",
            "Every post from the Reality Bending Lab.",
        ),
        (
            "news-featured",
            "/news/featured/",
            "Featured posts",
            "Selected posts from the Reality Bending Lab.",
        ),
        (
            "publications-list",
            "/publications/list/",
            "Publications — List",
            "The lab's publications as a list.",
        ),
        (
            "publications-gallery",
            "/publications/gallery/",
            "Publications — Gallery",
            "The lab's publications as a gallery of figures.",
        ),
    ]
    pages += service_card_pages()

    for route, path, title, description in pages:
        section = SECTION_IDS.get(route.split("-")[0], "sec-people-full")
        body = f"""
            <div>
                {crumbs((title, None))}
                <h1>{esc(title)}</h1>
                <p>{esc(description)}</p>
                <p><a href="./#{esc(section)}">Open this section on the Reality Bending Lab site.</a></p>
            </div>"""
        alias = CANONICAL_ALIASES.get(path)
        write(
            path.strip("/") + "/index.html",
            build_page(
                shell,
                route=route,
                path=path,
                title=title,
                description=description,
                image=None,
                prerender=prerender(body),
                canonical=alias,
            ),
        )
        # A page whose canonical points elsewhere is not a destination, so it is
        # not advertised. The file still exists and still serves.
        if not alias:
            sitemap_urls.append(path)


def build_stubs():
    """Redirect stubs for the old Hugo site's URLs.

    GitHub Pages has no server redirects, so each old path gets a file. A
    `rel=canonical` plus an instant meta-refresh is what Google documents as a
    permanent-redirect signal where a real 301 is unavailable, and the visible
    link is what makes it work for anything that honours neither.

    `noindex` is deliberate and is not in tension with the canonical: the stub
    itself must never be a result, while the canonical says which page this URL
    now *is*.
    """
    map_path = ROOT / "legacy_map.json"
    if not map_path.exists():
        print(
            "  ! legacy_map.json is missing — run tools/build_legacy_map.py first; no stubs written"
        )
        return 0

    mapping = json.loads(map_path.read_text(encoding="utf-8"))

    # ── A stub may never land on a page this run has already written ──
    # Two of the old site's section indexes (`people`, `research`) live at the
    # same path on this site, so their "redirect" was a page whose meta-refresh
    # pointed at itself: an infinite reload, `noindex`, and none of the hub's
    # content, at two of the six section URLs — while sitemap.xml went on
    # advertising both. `tools/build_legacy_map.py` no longer emits an identity
    # mapping, and this is the second half of that fix: the stub writer is the
    # only thing that can clobber a real page, so it is where the invariant
    # belongs. Any hand-edit of legacy_map.json is covered too.
    claimed = {p.strip("/") for p in written}
    skipped = []
    for old, new in sorted(mapping.items()):
        stub_path = f"{old.strip('/')}/index.html"
        if stub_path.strip("/") in claimed or old.strip("/") == new.strip("/"):
            skipped.append(old)
            continue
        target = "/" + new.lstrip("/")
        stub = f"""<!doctype html>
<html lang="en-GB">
    <head>
        <meta charset="UTF-8" />
        <title>Moved — Reality Bending Lab</title>
        <link rel="canonical" href="{esc(SITE_URL + target)}" />
        <meta name="robots" content="noindex, follow" />
        <meta http-equiv="refresh" content="0; url={esc(target)}" />
    </head>
    <body>
        <p>This page has moved to <a href="{esc(target)}">{esc(SITE_URL + target)}</a>.</p>
    </body>
</html>
"""
        write(stub_path, stub)

    for old in skipped:
        print(f"  ! no stub for {old}/ — that path is already a real page on this site")
    return len(mapping) - len(skipped)


def build_robots():
    """robots.txt, generated so its `Sitemap:` line cannot go stale.

    It was hand-written and carried the deployed URL as a fourth copy — see
    `_site_url`. There is nothing else in it that a human needs to edit in a
    hurry: the policy is four lines and the reasoning is here.

    ── The policy, and why it is a choice rather than an omission ──
    Everything is open, including to the LLM crawlers (GPTBot, ClaudeBot,
    PerplexityBot, Google-Extended). This is a public research lab, and being
    quotable by an assistant asked "who studies interoception at Sussex" is
    worth more than withholding the text. To opt out of AI training while
    staying in search, disallow those agents by name — blocking them does not
    affect ranking.
    """
    (ROOT / "robots.txt").write_text(
        "# Reality Bending Lab\n"
        "#\n"
        "# Generated by generate_pages.py alongside sitemap.xml and llms.txt.\n"
        "# Do not hand-edit: the Sitemap line below is derived from index.html's\n"
        "# canonical, which is the one place this site's URL is written.\n"
        "#\n"
        "# Open to everything, including the LLM crawlers, deliberately. To opt\n"
        "# out of AI training while staying in search, disallow GPTBot,\n"
        "# ClaudeBot, PerplexityBot and Google-Extended by name in build_robots().\n"
        "\n"
        "User-agent: *\n"
        "Allow: /\n"
        "\n"
        f"Sitemap: {SITE_URL}/sitemap.xml\n",
        encoding="utf-8",
    )


def build_sitemap():
    """One entry per real URL, homepage first.

    No `<lastmod>`: there is nothing here that knows when a page's content last
    changed, and a lastmod that is really "when the generator last ran" is a
    date Google learns to ignore.
    """
    urls = ["/"] + sorted(set(sitemap_urls))
    entries = "\n".join(
        f"    <url>\n        <loc>{SITE_URL}{u}</loc>\n"
        f"        <priority>{'1.0' if u == '/' else '0.8' if u.count('/') == 2 else '0.6'}</priority>\n"
        f"    </url>"
        for u in urls
    )
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<!--\n"
        "    Generated by generate_pages.py. Do not hand-edit: the next run\n"
        "    overwrites it. Every URL here is a real file with the content in\n"
        "    its raw HTML — which is what makes a sitemap worth having at all.\n"
        "    Redirect stubs for the old site's paths are deliberately absent:\n"
        "    a sitemap advertises destinations, not the way to them.\n"
        "-->\n"
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        f"{entries}\n"
        "</urlset>\n",
        encoding="utf-8",
    )
    return len(urls)


def organization() -> dict:
    """The `ResearchOrganization` node out of index.html's JSON-LD.

    That block is the site's machine-readable statement of what the lab is, and
    the one a crawler reads without running anything — so it is the source for
    the lab's description, email and address rather than a parallel copy of
    them. See `_site_url` for the same argument about the origin.
    """
    found = re.search(
        r'<script type="application/ld\+json">(.*?)</script>', TEMPLATE.read_text(encoding="utf-8"), re.S
    )
    if not found:
        raise SystemExit(
            "generate_pages: index.html has no JSON-LD block. llms.txt takes the "
            "lab's description, email and address from it."
        )
    graph = json.loads(found.group(1)).get("@graph", [])
    for node in graph:
        if node.get("@type") == "ResearchOrganization":
            return node
    raise SystemExit(
        "generate_pages: no ResearchOrganization node in index.html's JSON-LD."
    )


def build_llms(posts, members, publications):
    """llms.txt, rewritten against the real paths.

    The hand-written version pointed at the JSON manifests, because until now
    they were the only fetchable content. They still are listed, but the pages
    come first: an agent that can read a page should be given the page.
    """

    def lines(rows):
        return "\n".join(rows)

    # The lab's own description, email and address are not retyped here. They
    # are in index.html's JSON-LD, which is the machine-readable statement of
    # what this organisation is and the copy a crawler already reads — so it is
    # the source, and this is a second rendering of it. Three hand-written
    # copies of an address is how one of them ends up out of date.
    org = organization()
    address = org.get("address", {})
    postal = ", ".join(
        part
        for part in (
            address.get("streetAddress"),
            address.get("addressLocality"),
            address.get("postalCode"),
        )
        if part
    )

    blurb = textwrap.fill(
        org.get("description", ""), width= 78, initial_indent="> ", subsequent_indent="> "
    )

    text = f"""# {org.get("name", "Reality Bending Lab")}

{blurb}

Every page below is a real URL whose content is in the raw HTML — no JavaScript
is needed to read any of it.

Contact: {org.get("email", "")} · {postal}.

## Sections

- [People]({SITE_URL}/people/): {len(members)} current and former lab members.
- [Research]({SITE_URL}/research/): the lab's research programme, and the tools it has built.
- [News]({SITE_URL}/news/): {len(posts)} posts, essays and announcements.
- [Publications]({SITE_URL}/publications/): {len(publications)} journal articles, preprints and book chapters.
- [Join the Lab]({SITE_URL}/information/join/): research assistant, PhD and postdoc routes.

## People

{lines(f'- [{m["name"]}]({SITE_URL}/people/{m["folder"]}/): {strip_tags(m.get("hook") or clip(strip_tags(m.get("summary")), 140))}' for m in members)}

## Publications

{lines(f'- [{p["title"]}]({SITE_URL}/publications/{p["folder"]}/): {p.get("authors","")} ({p.get("year") or "n.d."}). {p.get("journal","")}' + (f' Keywords: {", ".join(p["keywords"])}.' if p.get("keywords") else "") for p in publications)}

## News

{lines(f'- [{p["title"]}]({SITE_URL}/news/{p["slug"]}/): {p.get("date","")}. {clip(strip_tags(p.get("summary")), 160)}' for p in posts)}

## Notes for crawlers

- Everything here is open to automated agents, including those that train
  models. See [robots.txt]({SITE_URL}/robots.txt).
- When citing a paper, prefer its DOI over this site's URL — the publisher's
  record is canonical for a publication.
- Generated by generate_pages.py alongside sitemap.xml. Do not hand-edit.
"""
    (ROOT / "llms.txt").write_text(text, encoding="utf-8")


# ── main ─────────────────────────────────────────────────────────────────────


def main():
    shell = load_template()

    posts = json.loads(
        (ROOT / "news" / "news_manifest.json").read_text(encoding="utf-8")
    )["posts"]
    members = json.loads(
        (ROOT / "people" / "people_manifest.json").read_text(encoding="utf-8")
    )["members"]
    publications = json.loads(
        (ROOT / "publications" / "publications_manifest.json").read_text(
            encoding="utf-8"
        )
    )["publications"]
    memories = json.loads(
        (ROOT / "memories" / "memories_manifest.json").read_text(encoding="utf-8")
    )["memories"]

    build_news(shell, posts)
    build_people(shell, members)
    build_memories(shell, memories, members)
    build_publications(shell, publications)
    build_sections(shell)
    content_pages = len(written)

    stubs = build_stubs()
    build_robots()
    urls = build_sitemap()
    build_llms(posts, members, publications)

    print(f"✓ {content_pages} content pages")
    print(f"    news:          {len(posts)} + 1 hub")
    print(f"    people:        {len(members)} + 1 hub")
    print(f"    memories:      {len(memories)}")
    print(f"    publications:  {len(publications)} + 1 hub")
    print(
        f"    sections:      {content_pages - len(posts) - len(members) - len(memories) - len(publications) - 3}"
    )
    print(f"✓ {stubs} redirect stubs from legacy_map.json")
    print(f"✓ sitemap.xml — {urls} URLs")
    print("✓ robots.txt, llms.txt")


if __name__ == "__main__":
    main()
