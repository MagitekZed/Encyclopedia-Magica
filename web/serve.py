#!/usr/bin/env python3
"""Tiny static server for the web roller (dev convenience).

The single-file build (`magica_roller.html`) opens straight from the filesystem,
but during development this serves the unbundled `web/` over http and opens it.

    python3 web/serve.py [port]
"""

from __future__ import annotations

import http.server
import os
import socketserver
import sys
import webbrowser

os.chdir(os.path.dirname(os.path.abspath(__file__)))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8777


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, *args):
        pass


def main() -> None:
    with socketserver.TCPServer(("127.0.0.1", PORT), Handler) as httpd:
        url = f"http://127.0.0.1:{PORT}/index.html"
        print(f"Encyclopedia Magica Roller — serving {url}  (Ctrl+C to stop)")
        try:
            webbrowser.open(url)
        except Exception:
            pass
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped.")


if __name__ == "__main__":
    main()
