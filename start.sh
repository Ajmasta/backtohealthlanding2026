#!/bin/sh
# Builds the site and serves it at http://localhost:8095 (Ctrl+C to stop).
# Usage: ./start.sh   — or, on another port: PORT=3000 ./start.sh
cd "$(dirname "$0")" || exit 1
exec npm run dev
