#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

BACKUP_ROOT="${BACKUP_ROOT:-}"
if [[ -z "$BACKUP_ROOT" || "$BACKUP_ROOT" != /* ]]; then
  printf 'BACKUP_ROOT must be an explicit absolute directory outside the repository.\n' >&2
  exit 2
fi
case "$BACKUP_ROOT" in
  "$ROOT_DIR"|"$ROOT_DIR"/*)
    printf 'BACKUP_ROOT must be outside the repository: %s\n' "$BACKUP_ROOT" >&2
    exit 2
    ;;
esac

for command in docker sha256sum mktemp; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 2
  }
done

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

umask 077
mkdir -p "$BACKUP_ROOT"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="$BACKUP_ROOT/portfolio-${stamp}-$$.dump"
temporary="$(mktemp "$BACKUP_ROOT/.portfolio-${stamp}.XXXXXX")"
trap 'rm -f "$temporary"' EXIT

if ! compose exec -T postgres \
  sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
  printf 'Portfolio PostgreSQL is not ready; refusing to create a backup.\n' >&2
  exit 1
fi

compose exec -T postgres \
  sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --format=custom --no-owner --no-acl' > "$temporary"

test -s "$temporary"
compose exec -T postgres pg_restore --list < "$temporary" >/dev/null
mv "$temporary" "$target"
sha256sum "$target" > "$target.sha256"
chmod 600 "$target" "$target.sha256"
printf 'Created %s and checksum %s.sha256\n' "$target" "$target"
