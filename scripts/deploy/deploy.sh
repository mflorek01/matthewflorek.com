#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

EXPECTED_REF="${1:-}"
if [[ -z "$EXPECTED_REF" ]]; then
  printf 'Usage: %s <reviewed-commit-sha>\n' "$0" >&2
  exit 2
fi

ENV_FILE="${PORTFOLIO_ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Missing environment file: %s\n' "$ENV_FILE" >&2
  exit 2
fi

for command in docker git curl; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 2
  }
done

if [[ ! -f prisma/migrations/.keep ]] && ! find prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql -print -quit 2>/dev/null | grep -q .; then
  printf 'No Prisma migration baseline found under prisma/migrations; refusing deployment. Create and review a forward-only migration first.\n' >&2
  exit 4
fi

if [[ -n "$(git status --porcelain)" ]]; then
  printf 'Refusing deployment from a dirty checkout.\n' >&2
  exit 3
fi

ACTUAL_REF="$(git rev-parse HEAD)"
if [[ "$ACTUAL_REF" != "$EXPECTED_REF" ]]; then
  printf 'Checkout is %s, expected reviewed commit %s.\n' "$ACTUAL_REF" "$EXPECTED_REF" >&2
  exit 3
fi

export VCS_REF="$ACTUAL_REF"
export PORTFOLIO_IMAGE="${PORTFOLIO_IMAGE:-portfolio-redesign:${ACTUAL_REF}}"
export PORTFOLIO_MIGRATOR_IMAGE="${PORTFOLIO_MIGRATOR_IMAGE:-portfolio-redesign-migrator:${ACTUAL_REF}}"

docker compose --env-file "$ENV_FILE" -f compose.yml config --quiet
docker compose --env-file "$ENV_FILE" -f compose.yml build --pull=false portfolio portfolio-migrate
docker compose --env-file "$ENV_FILE" -f compose.yml up -d postgres
for attempt in {1..30}; do
  if docker compose --env-file "$ENV_FILE" -f compose.yml exec -T postgres \
    sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == 30 ]]; then
    printf 'Portfolio PostgreSQL did not become ready.\n' >&2
    docker compose --env-file "$ENV_FILE" -f compose.yml ps >&2 || true
    exit 1
  fi
  sleep 2
done
docker compose --env-file "$ENV_FILE" -f compose.yml run --rm portfolio-migrate npx prisma migrate deploy
docker compose --env-file "$ENV_FILE" -f compose.yml up -d portfolio

for attempt in {1..12}; do
  if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${PORTFOLIO_HOST_PORT:-3101}/api/health?db=1" >/dev/null; then
    container_id="$(docker compose --env-file "$ENV_FILE" -f compose.yml ps -q portfolio)"
    image_revision="$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$container_id")"
    if [[ "$image_revision" == "$ACTUAL_REF" ]]; then
      printf 'Portfolio release %s is healthy and reports the expected image revision.\n' "$ACTUAL_REF"
      exit 0
    fi
    printf 'Running portfolio image reports revision %s, expected %s.\n' "$image_revision" "$ACTUAL_REF" >&2
    break
  fi
  sleep 5
done

printf 'Portfolio did not become healthy.\n' >&2
docker compose --env-file "$ENV_FILE" -f compose.yml ps >&2 || true
docker compose --env-file "$ENV_FILE" -f compose.yml logs --tail=100 portfolio >&2 || true
exit 1
