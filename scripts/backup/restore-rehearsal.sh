#!/usr/bin/env bash
set -Eeuo pipefail

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" || "$BACKUP_FILE" != /* || ! -f "$BACKUP_FILE" ]]; then
  printf 'Usage: %s /absolute/path/to/portfolio-<timestamp>.dump\n' "$0" >&2
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
case "$BACKUP_FILE" in
  "$ROOT_DIR"|"$ROOT_DIR"/*)
    printf 'Refusing to restore a dump located inside the repository.\n' >&2
    exit 2
    ;;
esac

CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [[ ! -f "$CHECKSUM_FILE" ]]; then
  printf 'Missing checksum sidecar: %s\n' "$CHECKSUM_FILE" >&2
  exit 2
fi

if ! (cd "$(dirname "$BACKUP_FILE")" && sha256sum -c "$(basename "$CHECKSUM_FILE")"); then
  printf 'Backup checksum verification failed.\n' >&2
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  printf 'Docker is required.\n' >&2
  exit 2
fi

container="portfolio-restore-rehearsal-$$"
backup_dir="$(dirname "$BACKUP_FILE")"
backup_name="$(basename "$BACKUP_FILE")"
cleanup() { docker rm -f "$container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

docker run --detach --rm --name "$container" --network none \
  -e POSTGRES_DB=portfolio_restore \
  -e POSTGRES_USER=restore \
  -e POSTGRES_PASSWORD=restore-only \
  -v "$backup_dir:/restore:ro" postgres:16.14-alpine >/dev/null

for attempt in {1..30}; do
  if docker exec "$container" pg_isready -U restore -d portfolio_restore >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    printf 'Disposable restore database did not become ready.\n' >&2
    exit 1
  fi
  sleep 2
done

docker exec "$container" pg_restore -U restore -d portfolio_restore --exit-on-error --no-owner --no-acl "/restore/$backup_name"
printf 'Restore rehearsal succeeded in disposable container %s; no live volume was used.\n' "$container"
