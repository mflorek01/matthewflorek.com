#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PORTFOLIO_ENV_FILE:-$ROOT_DIR/.env}"
COMPOSE_FILE="$ROOT_DIR/compose.umami.yml"
PORTFOLIO_COMPOSE_FILE="$ROOT_DIR/compose.yml"
BACKUP_DIR="${PORTFOLIO_BACKUP_DIR:-$ROOT_DIR/../backups/portfolio}"
COMPOSE_FILES=(-f "$PORTFOLIO_COMPOSE_FILE" -f "$COMPOSE_FILE")
compose() { docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" "$@"; }

for command in docker curl mktemp python3 sha256sum; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 2
  }
done

[[ -f "$ENV_FILE" ]] || {
  printf 'Portfolio environment file not found: %s\n' "$ENV_FILE" >&2
  exit 2
}
[[ -f "$COMPOSE_FILE" ]] || {
  printf 'Umami compose file not found: %s\n' "$COMPOSE_FILE" >&2
  exit 2
}

set -a
. "$ENV_FILE"
set +a

: "${UMAMI_POSTGRES_DB:?UMAMI_POSTGRES_DB is missing from $ENV_FILE}"
: "${UMAMI_POSTGRES_USER:?UMAMI_POSTGRES_USER is missing from $ENV_FILE}"

umami_db_container="$(compose ps -q umami-postgres)"
[[ -n "$umami_db_container" ]] || {
  printf 'The Umami database container is not running. Start the analytics services first.\n' >&2
  exit 3
}

portfolio_container="$(compose ps -q portfolio)"
[[ -n "$portfolio_container" ]] || {
  printf 'The portfolio container is not running. Deploy the site first.\n' >&2
  exit 3
}

admin_users="$(compose exec -T umami-postgres \
  psql --no-psqlrc -v ON_ERROR_STOP=1 -U "$UMAMI_POSTGRES_USER" -d "$UMAMI_POSTGRES_DB" -Atq \
  -c 'SELECT username FROM "user" WHERE role = '\''admin'\'' AND deleted_at IS NULL ORDER BY username;' </dev/null)"

[[ -n "$admin_users" ]] || {
  printf 'No active Umami administrator account was found. No changes were made.\n' >&2
  exit 4
}

printf 'Active Umami administrator usernames:\n%s\n' "$admin_users"
read -r -p 'Username to reset [admin]: ' target_username
target_username="${target_username:-admin}"

if ! printf '%s\n' "$admin_users" | grep -Fxq -- "$target_username"; then
  printf 'That username is not an active Umami administrator. No changes were made.\n' >&2
  exit 4
fi

read -r -s -p 'New Umami password (12+ characters): ' new_password
printf '\n'
read -r -s -p 'Repeat new Umami password: ' repeated_password
printf '\n'

if [[ ${#new_password} -lt 12 ]]; then
  printf 'Use a password with at least 12 characters. No changes were made.\n' >&2
  exit 2
fi
if [[ "$new_password" != "$repeated_password" ]]; then
  printf 'The passwords did not match. No changes were made.\n' >&2
  exit 2
fi

printf '\nThis updates only the selected Umami account password and keeps all analytics data.\n'
read -r -p 'Type RESET-UMAMI to continue: ' confirmation
[[ "$confirmation" == 'RESET-UMAMI' ]] || {
  printf 'Confirmation not received. No changes were made.\n' >&2
  exit 2
}

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_file="$BACKUP_DIR/umami-before-password-reset-$timestamp.dump"

printf 'Creating a database backup before the password change...\n'
compose exec -T umami-postgres \
  pg_dump -U "$UMAMI_POSTGRES_USER" -d "$UMAMI_POSTGRES_DB" --format=custom </dev/null > "$backup_file"
sha256sum "$backup_file" > "$backup_file.sha256"
chmod 600 "$backup_file" "$backup_file.sha256"

new_hash="$(printf '%s' "$new_password" | python3 -c 'import bcrypt, sys; print(bcrypt.hashpw(sys.stdin.buffer.read(), bcrypt.gensalt(rounds=12)).decode("ascii"), end="")')"
update_sql="$(RESET_HASH="$new_hash" RESET_USERNAME="$target_username" python3 - <<'PY'
import os

def sql_literal(value):
    return "'" + value.replace("'", "''") + "'"

print(
    'UPDATE "user" SET password = '
    + sql_literal(os.environ['RESET_HASH'])
    + ', updated_at = NOW() WHERE username = '
    + sql_literal(os.environ['RESET_USERNAME'])
    + " AND role = 'admin' AND deleted_at IS NULL;"
)
PY
)"
compose exec -T umami-postgres \
  psql --no-psqlrc -v ON_ERROR_STOP=1 \
  -U "$UMAMI_POSTGRES_USER" -d "$UMAMI_POSTGRES_DB" -c "$update_sql" </dev/null

if ! docker exec \
  -e UMAMI_CHECK_USERNAME="$target_username" \
  -e UMAMI_CHECK_PASSWORD="$new_password" \
  "$portfolio_container" \
  node -e "fetch('http://umami:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:process.env.UMAMI_CHECK_USERNAME,password:process.env.UMAMI_CHECK_PASSWORD})}).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; then
  printf 'The password was updated, but the login verification failed. Backup: %s\n' "$backup_file" >&2
  exit 5
fi

unset new_password repeated_password new_hash
printf 'Umami password reset successfully for %s. Analytics data was preserved.\n' "$target_username"
printf 'Backup: %s\n' "$backup_file"
