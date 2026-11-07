"""Local development server for the temple (not part of the app).

Same as `python -m http.server`, but tells the browser to re-check every file on
each load (Cache-Control: no-cache), so a normal refresh always picks up edits.

Usage (from the project folder):  python tools/serve.py [port]
"""
import functools
import http.server
import os
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".webp": "image/webp",
        ".woff2": "font/woff2",
        ".mp3": "audio/mpeg",
        ".ogg": "audio/ogg",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5520
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    handler = functools.partial(NoCacheHandler, directory=root)
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as httpd:
        print(f"Temple at http://127.0.0.1:{port}/  (Ctrl+C to stop)")
        httpd.serve_forever()
