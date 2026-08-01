#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

RELEASE_ID="${1:-}"
if [[ -z "$RELEASE_ID" ]]; then
  printf 'Usage: %s <previous-immutable-release-id>\n' "$0" >&2
  exit 2
fi

ENV_FILE="${PORTFOLIO_ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Missing environment file: %s\n' "$ENV_FILE" >&2
  exit 2
fi

for command in docker curl; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 2
  }
done

if [[ ! "$RELEASE_ID" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  printf 'Release ID contains unsupported characters: %s\n' "$RELEASE_ID" >&2
  exit 2
fi

export PORTFOLIO_IMAGE="${PORTFOLIO_IMAGE:-portfolio-redesign:${RELEASE_ID}}"
export VCS_REF="$RELEASE_ID"
docker image inspect "$PORTFOLIO_IMAGE" >/dev/null
docker compose --env-file "$ENV_FILE" -f compose.yml config --quiet
docker compose --env-file "$ENV_FILE" -f compose.yml up -d portfolio

for attempt in {1..12}; do
  if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${PORTFOLIO_HOST_PORT:-3101}/api/health?db=1" >/dev/null; then
    container_id="$(docker compose --env-file "$ENV_FILE" -f compose.yml ps -q portfolio)"
    image_revision="$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$container_id")"
    if [[ "$image_revision" == "$RELEASE_ID" ]]; then
      printf 'Rolled back to immutable image %s; database readiness and image revision verified.\n' "$PORTFOLIO_IMAGE"
      exit 0
    fi
    printf 'Running portfolio image reports revision %s, expected %s.\n' "$image_revision" "$RELEASE_ID" >&2
    break
  fi
  sleep 5
done

printf 'Rollback image did not become healthy.\n' >&2
docker compose --env-file "$ENV_FILE" -f compose.yml ps >&2 || true
exit 1
