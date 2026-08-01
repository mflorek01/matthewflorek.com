#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "$(id -u)" != 0 ]]; then
  printf 'This script must run as root. Use: sudo bash %s\n' "$0" >&2
  exit 2
fi

SCRIPT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EDGE_ROOT="${EDGE_ROOT:-/root/repo}"
CADDY_CONTAINER="${CADDY_CONTAINER:-metamorphysis-caddy}"
ENV_FILE="${EDGE_ROOT}/.env"
CADDYFILE="${EDGE_ROOT}/Caddyfile"
COMPOSE_OVERRIDE="${EDGE_ROOT}/docker-compose.portfolio-edge.yml"
BACKUP_ROOT="${EDGE_BACKUP_ROOT:-/root/portfolio-edge-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"

for command in docker sha256sum install cmp awk mktemp; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 2
  }
done

for path in "$EDGE_ROOT/docker-compose.yml" "$EDGE_ROOT/docker-compose.prod.yml" "$ENV_FILE" "$CADDYFILE"; do
  [[ -f "$path" ]] || {
    printf 'Required Metamorphysis file is missing: %s\n' "$path" >&2
    exit 2
  }
done

[[ -f "$SCRIPT_ROOT/ops/edge/portfolio-edge.caddy" ]] || {
  printf 'Missing reviewed Caddy fragment in %s\n' "$SCRIPT_ROOT" >&2
  exit 2
}
[[ -f "$SCRIPT_ROOT/docker-compose.portfolio-edge.yml" ]] || {
  printf 'Missing reviewed Compose override in %s\n' "$SCRIPT_ROOT" >&2
  exit 2
}
docker inspect "$CADDY_CONTAINER" >/dev/null 2>&1 || {
  printf 'Caddy container was not found: %s\n' "$CADDY_CONTAINER" >&2
  exit 2
}

if [[ -f "$COMPOSE_OVERRIDE" ]] && ! cmp -s "$SCRIPT_ROOT/docker-compose.portfolio-edge.yml" "$COMPOSE_OVERRIDE"; then
  printf 'Existing edge Compose override differs from the reviewed version; refusing to overwrite it.\n' >&2
  exit 3
fi

mkdir -p "$BACKUP_ROOT"
chmod 700 "$BACKUP_ROOT"
backup_caddyfile="$BACKUP_ROOT/Caddyfile.$STAMP"
install -m 600 "$CADDYFILE" "$backup_caddyfile"

if grep -q '^# BEGIN Matthew Florek portfolio managed block$' "$CADDYFILE"; then
  replacement_file="$(mktemp "$BACKUP_ROOT/.Caddyfile.${STAMP}.XXXXXX")"
  trap 'rm -f "$replacement_file"' EXIT

  awk -v fragment="$SCRIPT_ROOT/ops/edge/portfolio-edge.caddy" '
    $0 == "# BEGIN Matthew Florek portfolio managed block" {
      if (replaced) exit 2
      while ((getline line < fragment) > 0) print line
      close(fragment)
      inside = 1
      next
    }
    $0 == "# END Matthew Florek portfolio managed block" {
      if (!inside) exit 3
      inside = 0
      replaced = 1
      next
    }
    !inside { print }
    END {
      if (inside || !replaced) exit 4
    }
  ' "$CADDYFILE" > "$replacement_file"
  install -m 600 "$replacement_file" "$CADDYFILE"
  printf 'Updated the existing managed portfolio Caddy block.\n'
else
  if grep -q '^matthewflorek\.com[[:space:]]*{' "$CADDYFILE"; then
    printf 'A matthewflorek.com block exists without the managed marker; refusing to append a duplicate.\n' >&2
    printf 'Review %s and the backup at %s.\n' "$CADDYFILE" "$backup_caddyfile" >&2
    exit 3
  fi
  printf '\n' >> "$CADDYFILE"
  cat "$SCRIPT_ROOT/ops/edge/portfolio-edge.caddy" >> "$CADDYFILE"
fi

if [[ ! -f "$COMPOSE_OVERRIDE" ]]; then
  install -m 600 "$SCRIPT_ROOT/docker-compose.portfolio-edge.yml" "$COMPOSE_OVERRIDE"
fi

docker network inspect portfolio_private >/dev/null 2>&1 || {
  printf 'Required Docker network is missing: portfolio_private\n' >&2
  exit 4
}
docker network inspect portfolio_umami_private >/dev/null 2>&1 || {
  printf 'Required Docker network is missing: portfolio_umami_private\n' >&2
  exit 4
}

if ! docker network inspect portfolio_private --format '{{json .Containers}}' | grep -q 'metamorphysis-caddy'; then
  docker network connect portfolio_private "$CADDY_CONTAINER"
fi
if ! docker network inspect portfolio_umami_private --format '{{json .Containers}}' | grep -q 'metamorphysis-caddy'; then
  docker network connect portfolio_umami_private "$CADDY_CONTAINER"
fi

docker exec "$CADDY_CONTAINER" caddy validate \
  --config /etc/caddy/Caddyfile --adapter caddyfile

docker compose --env-file "$ENV_FILE" \
  -f "$EDGE_ROOT/docker-compose.yml" \
  -f "$EDGE_ROOT/docker-compose.prod.yml" \
  -f "$COMPOSE_OVERRIDE" config --quiet

docker compose --env-file "$ENV_FILE" \
  -f "$EDGE_ROOT/docker-compose.yml" \
  -f "$EDGE_ROOT/docker-compose.prod.yml" \
  -f "$COMPOSE_OVERRIDE" up -d caddy

docker exec "$CADDY_CONTAINER" caddy validate \
  --config /etc/caddy/Caddyfile --adapter caddyfile
docker exec "$CADDY_CONTAINER" caddy reload \
  --config /etc/caddy/Caddyfile --adapter caddyfile

docker compose --env-file "$ENV_FILE" \
  -f "$EDGE_ROOT/docker-compose.yml" \
  -f "$EDGE_ROOT/docker-compose.prod.yml" \
  -f "$COMPOSE_OVERRIDE" ps caddy

printf 'Caddy edge change applied.\n'
printf 'Caddyfile backup: %s\n' "$backup_caddyfile"
printf 'Caddyfile checksum: '
sha256sum "$backup_caddyfile"
printf 'Do not change DNS until the checks above succeed.\n'
