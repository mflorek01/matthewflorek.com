#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PORTFOLIO_ENV_FILE:-$ROOT_DIR/.env}"
COMPOSE_FILE="$ROOT_DIR/compose.yml"
COMPOSE_FILES=(-f "$COMPOSE_FILE")
if [[ -f "$ROOT_DIR/compose.umami.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT_DIR/compose.umami.yml")
fi
compose() { docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" "$@"; }

for command in docker curl mktemp; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 2
  }
done

[[ -f "$ENV_FILE" ]] || {
  printf 'Portfolio environment file not found: %s\n' "$ENV_FILE" >&2
  exit 2
}
grep -Eq '^UMAMI_WEBSITE_ID=.+$' "$ENV_FILE" || {
  printf 'UMAMI_WEBSITE_ID is missing from %s.\n' "$ENV_FILE" >&2
  exit 2
}

portfolio_container="$(compose ps -q portfolio)"
[[ -n "$portfolio_container" ]] || {
  printf 'The portfolio container is not running. Deploy the site first.\n' >&2
  exit 3
}

read -r -p 'Umami username: ' umami_username
read -r -s -p 'Umami password: ' umami_password
printf '\n'

[[ -n "$umami_username" && -n "$umami_password" ]] || {
  printf 'Both values are required. No changes were made.\n' >&2
  exit 2
}
if [[ "$umami_username" == *"'"* || "$umami_password" == *"'"* ]]; then
  printf "For safe .env storage, these values cannot contain a single quote. No changes were made.\n" >&2
  exit 2
fi

if ! docker exec \
  -e UMAMI_CHECK_USERNAME="$umami_username" \
  -e UMAMI_CHECK_PASSWORD="$umami_password" \
  "$portfolio_container" \
  node -e "fetch('http://umami:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:process.env.UMAMI_CHECK_USERNAME,password:process.env.UMAMI_CHECK_PASSWORD})}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
  printf 'Umami rejected those credentials. No changes were made.\n' >&2
  exit 4
fi

temp_file="$(mktemp "${ENV_FILE}.tmp.XXXXXX")"
cleanup() { rm -f "$temp_file"; }
trap cleanup EXIT
chmod --reference="$ENV_FILE" "$temp_file"

write_updated_env() {
  local key="$1"
  local value="$2"
  local source="$3"
  local destination="$4"
  local found=0
  : > "$destination"
  while IFS= read -r line || [[ -n "$line" ]]; do
    if [[ "$line" == "$key="* ]]; then
      printf "%s='%s'\n" "$key" "$value" >> "$destination"
      found=1
    else
      printf '%s\n' "$line" >> "$destination"
    fi
  done < "$source"
  if [[ "$found" -eq 0 ]]; then
    printf "%s='%s'\n" "$key" "$value" >> "$destination"
  fi
}

next_file="$(mktemp "${ENV_FILE}.next.XXXXXX")"
trap 'rm -f "$temp_file" "$next_file"' EXIT
chmod --reference="$ENV_FILE" "$next_file"

write_updated_env 'UMAMI_API_URL' 'http://umami:3000' "$ENV_FILE" "$temp_file"
write_updated_env 'UMAMI_API_USERNAME' "$umami_username" "$temp_file" "$next_file"
write_updated_env 'UMAMI_API_PASSWORD' "$umami_password" "$next_file" "$temp_file"
mv -f "$temp_file" "$ENV_FILE"
rm -f "$next_file"
trap - EXIT

current_image="$(docker inspect --format '{{.Config.Image}}' "$portfolio_container")"
PORTFOLIO_IMAGE="$current_image" compose up -d --no-deps --force-recreate portfolio

host_port="${PORTFOLIO_HOST_PORT:-3101}"
for _ in $(seq 1 30); do
  if curl --fail --silent --max-time 3 "http://127.0.0.1:${host_port}/api/health?db=1" >/dev/null; then
    printf 'Private admin analytics is configured. Open /admin/analytics after signing in.\n'
    exit 0
  fi
  sleep 2
done

printf 'The portfolio did not become healthy after it was recreated. Check docker compose logs portfolio.\n' >&2
exit 5
