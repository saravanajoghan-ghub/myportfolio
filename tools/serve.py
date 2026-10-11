#!/usr/bin/env python3
"""
Dev server for the portfolio.

    ./tools/serve.py [port]        # default 8731

Plain `python3 -m http.server` sends no Cache-Control, so browsers apply
heuristic caching and keep serving a stale styles.css / frame_*.webp long
after the files on disk have changed — which looks exactly like a CSS or
matte bug that won't go away. This sends no-store on everything instead.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8731
    root = sys.argv[2] if len(sys.argv) > 2 else "."
    handler = partial(NoCacheHandler, directory=root)
    with ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"serving {root} on http://localhost:{port}  (cache disabled)")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
