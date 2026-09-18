#!/usr/bin/env python3
"""Serve the included Expo web export with client-side routing support."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
import argparse
import os

parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8080)
args = parser.parse_args()
os.chdir(Path(__file__).resolve().parent.parent / 'dist')

class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if not Path(self.translate_path(self.path)).exists() and '.' not in self.path.rsplit('/', 1)[-1].split('?')[0]:
            self.path = '/index.html'
        super().do_GET()

print(f'TrainWith is ready at http://localhost:{args.port}', flush=True)
ThreadingHTTPServer(('127.0.0.1', args.port), Handler).serve_forever()
