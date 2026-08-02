#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${PORTFOLIO_ENV_FILE:-$ROOT_DIR/.env}"
COMPOSE_FILE="$ROOT_DIR/compose.yml"
BACKUP_ROOT="${BACKUP_ROOT:-/home/codexdiag/backups/portfolio}"

for command in docker curl; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 2
  }
done
[[ -f "$ENV_FILE" ]] || { printf 'Portfolio environment file not found: %s\n' "$ENV_FILE" >&2; exit 2; }
[[ -f "$COMPOSE_FILE" ]] || { printf 'Portfolio Compose file not found: %s\n' "$COMPOSE_FILE" >&2; exit 2; }

portfolio_container="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q portfolio)"
[[ -n "$portfolio_container" ]] || {
  printf 'The portfolio container is not running. Deploy the site first.\n' >&2
  exit 3
}

ADMIN_NODE_SCRIPT='import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
  if (process.env.RESET_ADMIN_MODE === "list") {
    const users = await prisma.adminUser.findMany({ where: { isActive: true }, select: { email: true }, orderBy: { email: "asc" } });
    for (const user of users) console.log(user.email);
    process.exitCode = users.length ? 0 : 1;
  } else if (process.env.RESET_ADMIN_MODE === "verify") {
    const email = process.env.RESET_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.RESET_ADMIN_PASSWORD;
    const user = email ? await prisma.adminUser.findUnique({ where: { email } }) : null;
    if (!user || !user.isActive || !password || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new Error("The stored administrator password did not pass verification.");
    }
  } else {
    if (process.env.CONFIRM_RESET_ADMIN !== "YES") throw new Error("Reset confirmation is missing.");
    const email = process.env.RESET_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.RESET_ADMIN_PASSWORD;
    if (!email || /^\S+@\S+\.\S+$/.test(email) === false) throw new Error("The administrator email is invalid.");
    if (!password || password.length < 14) throw new Error("The administrator password must be at least 14 characters.");
    const user = await prisma.adminUser.findUnique({ where: { email } });
    if (!user || !user.isActive) throw new Error("No active administrator exists with that email.");
    const passwordHash = await bcrypt.hash(password, 12);
    await prisma.$transaction([
      prisma.adminUser.update({ where: { id: user.id }, data: { passwordHash } }),
      prisma.adminSession.deleteMany({ where: { adminUserId: user.id } })
    ]);
    console.log(`Reset administrator ${user.email}; existing sessions were revoked.`);
  }
} finally {
  await prisma.$disconnect();
}'

run_admin_node() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" --profile operations run --rm -T \
    -e RESET_ADMIN_MODE="${RESET_ADMIN_MODE:-}" \
    -e RESET_ADMIN_EMAIL="${RESET_ADMIN_EMAIL:-}" \
    -e RESET_ADMIN_PASSWORD="${RESET_ADMIN_PASSWORD:-}" \
    -e CONFIRM_RESET_ADMIN="${CONFIRM_RESET_ADMIN:-}" \
    portfolio-migrate node --input-type=module - <<<"$ADMIN_NODE_SCRIPT"
}

RESET_ADMIN_MODE=list
admin_emails="$(run_admin_node)"
[[ -n "$admin_emails" ]] || {
  printf 'No active portfolio administrator was found. No changes were made.\n' >&2
  exit 4
}

printf 'Active portfolio administrator email addresses:\n%s\n' "$admin_emails"
read -r -p 'Email address to reset: ' admin_email
admin_email="$(printf '%s' "$admin_email" | tr '[:upper:]' '[:lower:]' | xargs)"
if ! printf '%s\n' "$admin_emails" | grep -Fxiq -- "$admin_email"; then
  printf 'That address is not an active portfolio administrator. No changes were made.\n' >&2
  exit 4
fi

read -r -s -p 'New portfolio admin password (14+ characters): ' new_password
printf '\n'
read -r -s -p 'Repeat new portfolio admin password: ' repeated_password
printf '\n'
if [[ ${#new_password} -lt 14 ]]; then
  printf 'Use a password with at least 14 characters. No changes were made.\n' >&2
  exit 2
fi
if [[ "$new_password" != "$repeated_password" ]]; then
  printf 'The passwords did not match. No changes were made.\n' >&2
  exit 2
fi

printf '\nThis resets only the selected portfolio administrator and revokes existing admin sessions.\n'
read -r -p 'Type RESET-PORTFOLIO-ADMIN to continue: ' confirmation
[[ "$confirmation" == 'RESET-PORTFOLIO-ADMIN' ]] || {
  printf 'Confirmation not received. No changes were made.\n' >&2
  exit 2
}

printf 'Creating a verified portfolio database backup before the reset...\n'
BACKUP_ROOT="$BACKUP_ROOT" PORTFOLIO_ENV_FILE="$ENV_FILE" bash "$ROOT_DIR/scripts/backup/backup.sh"

RESET_ADMIN_MODE=reset RESET_ADMIN_EMAIL="$admin_email" RESET_ADMIN_PASSWORD="$new_password" CONFIRM_RESET_ADMIN=YES run_admin_node

if ! RESET_ADMIN_MODE=verify RESET_ADMIN_EMAIL="$admin_email" RESET_ADMIN_PASSWORD="$new_password" run_admin_node; then
  printf 'The password was updated, but login verification failed. Review the backup and app logs.\n' >&2
  exit 5
fi

unset new_password repeated_password
printf 'Portfolio administrator password reset successfully. Existing admin sessions were revoked.\n'
