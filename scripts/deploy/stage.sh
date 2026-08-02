#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

ENV_FILE="${PORTFOLIO_ENV_FILE:-.env}"
if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Missing environment file: %s\n' "$ENV_FILE" >&2
  exit 2
fi

COMPOSE_FILES=(-f compose.yml)
if [[ -f compose.umami.yml ]]; then
  COMPOSE_FILES+=(-f compose.umami.yml)
fi
compose() { docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" "$@"; }

for command in docker git; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 2
  }
done

if [[ ! -f prisma/migrations/.keep ]] && ! find prisma/migrations -mindepth 2 -maxdepth 2 -name migration.sql -print -quit 2>/dev/null | grep -q .; then
  printf 'No Prisma migration baseline found under prisma/migrations; refusing staging validation until one exists.\n' >&2
  exit 4
fi

export VCS_REF="${VCS_REF:-$(git rev-parse HEAD)}"
export PORTFOLIO_IMAGE="${PORTFOLIO_IMAGE:-portfolio-redesign:${VCS_REF}}"
export PORTFOLIO_MIGRATOR_IMAGE="${PORTFOLIO_MIGRATOR_IMAGE:-portfolio-redesign-migrator:${VCS_REF}}"

compose config --quiet
compose build --pull=false portfolio portfolio-migrate

printf 'Staging images built: %s and %s\n' "$PORTFOLIO_IMAGE" "$PORTFOLIO_MIGRATOR_IMAGE"
printf 'Next bounded checks: start the candidate with the staging environment, run migrations against a disposable database, then exercise /api/health?db=1.\n'
