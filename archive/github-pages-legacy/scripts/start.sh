#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "Serving Matthew Florek's site at http://0.0.0.0:4000"
exec python3 scripts/serve.py 4000 --host 0.0.0.0
