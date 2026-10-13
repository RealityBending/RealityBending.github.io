#!/usr/bin/env python
"""Serve the site locally the way it is deployed.

    python tools/serve.py            http://localhost:8777
    python tools/serve.py 9000       on another port

The deployed site is the repository with `_generated/` laid over it — deploy.yml
copies one into the other before uploading. This serves the same overlay without
copying anything: a path is looked up in `_generated/` first and in the source
tree second. So `/news/<slug>/` reloads into its generated page and a legacy
`/post/…` URL redirects, exactly as in production, while the source tree holds
nothing generate_pages.py wrote.

Run generate_pages.py first for the per-page URLs. Without `_generated/` this is
the source tree alone: the homepage and every in-page route work, and a reload
on a deep path does not.

── Cache-Control: no-store ──
`python -m http.server` sends no cache headers, so the browser goes on serving
the JS and CSS it already has while you debug a fix that has already landed.
Every response from here tells it not to keep anything.
"""

import functools
import http.server
import os
import sys

# Guarded for the same reasons as the other scripts — see build-and-deploy.md.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

try:
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
except NameError:
    ROOT = os.getcwd()

GENERATED = os.path.join(ROOT, "_generated")

if not os.path.exists(os.path.join(ROOT, "index.html")):
    sys.exit(
        f"serve: no index.html in {ROOT}\n"
        "  Run this from the repository root: `python tools/serve.py`."
    )


class OverlayHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        source = super().translate_path(path)
        generated = os.path.join(GENERATED, os.path.relpath(source, ROOT))
        # `/news/<slug>/` is a directory in both trees — the post's files in the
        # source, its page in `_generated/` — so a directory is taken from
        # whichever side holds its index.html.
        if os.path.isfile(generated) or os.path.isfile(os.path.join(generated, "index.html")):
            return generated
        return source

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8777
    if not os.path.isdir(GENERATED):
        print("  ! no _generated/ — run generate_pages.py for the per-page URLs")
    handler = functools.partial(OverlayHandler, directory=ROOT)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Serving the site with _generated/ over it at http://localhost:{port}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
