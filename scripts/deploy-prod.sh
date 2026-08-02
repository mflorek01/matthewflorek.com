#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  cat <<'EOF'
Usage: ./scripts/deploy-prod.sh [--ref <commit-or-ref>] [--with-migrations] [--refresh-content] [--skip-backup]

Builds and promotes a reviewed portfolio release in an isolated temporary Git
worktree. By default, it uses origin/codex/portfolio-redesign when that branch
exists; otherwise it deploys the current checked-out commit.

--ref <commit-or-ref>  Deploy this local or remote Git reference.
--with-migrations      Required when the release changes Prisma schema/migrations.
--refresh-content      Publish the reviewed checked-in overview and PUBLIC project copy.
--skip-backup          Skip the pre-deploy database backup (not recommended).

The script shows the proposed release and requires the literal word DEPLOY.
It does not modify the root-owned Caddy configuration or DNS.
EOF
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${PORTFOLIO_ENV_FILE:-$ROOT_DIR/.env}"
BACKUP_ROOT="${BACKUP_ROOT:-/home/codexdiag/backups/portfolio}"
RELEASE_BRANCH="${PORTFOLIO_RELEASE_BRANCH:-codex/portfolio-redesign}"
RELEASE_REF=""
WITH_MIGRATIONS=0
SKIP_BACKUP=0
REFRESH_CONTENT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h)
      usage
      exit 0
      ;;
    --ref)
      [[ $# -ge 2 ]] || { printf '%s requires a reference.\n' "$1" >&2; exit 2; }
      RELEASE_REF="$2"
      shift 2
      ;;
    --with-migrations)
      WITH_MIGRATIONS=1
      shift
      ;;
    --skip-backup)
      SKIP_BACKUP=1
      shift
      ;;
    --refresh-content)
      REFRESH_CONTENT=1
      shift
      ;;
    *)
      printf 'Unknown option: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

for command in git docker curl mktemp; do
  command -v "$command" >/dev/null 2>&1 || {
    printf 'Required command is unavailable: %s\n' "$command" >&2
    exit 2
  }
done
docker compose version >/dev/null 2>&1 || {
  printf 'Docker Compose v2 is required.\n' >&2
  exit 2
}
[[ -f "$ENV_FILE" ]] || {
  printf 'Production environment file is missing: %s\n' "$ENV_FILE" >&2
  exit 2
}

COMPOSE_FILES=(-f "$ROOT_DIR/compose.yml")
if [[ -f "$ROOT_DIR/compose.umami.yml" ]]; then
  COMPOSE_FILES+=(-f "$ROOT_DIR/compose.umami.yml")
fi
compose() { docker compose --env-file "$ENV_FILE" "${COMPOSE_FILES[@]}" "$@"; }

git_release() {
  git -c safe.directory="$ROOT_DIR" "$@"
}

cd "$ROOT_DIR"
if [[ -n "$(git_release status --porcelain)" ]]; then
  printf 'Refusing to deploy from a dirty production checkout.\n' >&2
  git_release status --short >&2
  exit 3
fi

current_ref="$(git_release rev-parse HEAD)"
if [[ -z "$RELEASE_REF" ]]; then
  if git_release remote get-url origin >/dev/null 2>&1 \
    && git_release ls-remote --exit-code --heads origin "refs/heads/$RELEASE_BRANCH" >/dev/null 2>&1; then
    git_release fetch --quiet origin "$RELEASE_BRANCH:refs/remotes/origin/$RELEASE_BRANCH"
    RELEASE_REF="origin/$RELEASE_BRANCH"
  else
    RELEASE_REF="HEAD"
    printf 'No remote portfolio release branch is available; using the current checkout.\n'
  fi
fi

target_ref="$(git_release rev-parse --verify "${RELEASE_REF}^{commit}")" || {
  printf 'Unable to resolve the requested release reference: %s\n' "$RELEASE_REF" >&2
  exit 3
}
target_short="$(git_release rev-parse --short=12 "$target_ref")"

running_ref=""
container_id="$(compose ps -q portfolio 2>/dev/null || true)"
if [[ -n "$container_id" ]]; then
  running_ref="$(docker inspect --format '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$container_id" 2>/dev/null || true)"
fi

if [[ "$target_ref" == "$current_ref" && "$running_ref" == "$target_ref" && "$REFRESH_CONTENT" -eq 0 ]]; then
  if curl --fail --silent --show-error --max-time 5 "http://127.0.0.1:${PORTFOLIO_HOST_PORT:-3101}/api/health?db=1" >/dev/null; then
    printf 'Checkout and running portfolio already match %s. Nothing to deploy.\n' "$target_short"
    exit 0
  fi
fi

printf 'Proposed portfolio release: %s\n' "$target_short"
printf 'Current checkout: %s\n' "$(git_release rev-parse --short=12 "$current_ref")"
printf 'Running image revision: %s\n' "${running_ref:-not available}"
if [[ "$target_ref" != "$current_ref" ]]; then
  printf '\nChanged files:\n'
  git_release diff --name-status "$current_ref" "$target_ref"
fi

migration_changes="$(git_release diff --name-only "$current_ref" "$target_ref" -- prisma/schema.prisma prisma/migrations || true)"
if [[ -n "$migration_changes" && "$WITH_MIGRATIONS" -ne 1 ]]; then
  printf '\nThis release changes the database schema or migrations:\n%s\n' "$migration_changes" >&2
  printf 'Review the migration plan, then rerun with --with-migrations.\n' >&2
  exit 4
fi

printf '\n'
read -r -p 'Type DEPLOY to build and promote this release: ' confirmation
if [[ "$confirmation" != DEPLOY ]]; then
  printf 'Release cancelled.\n'
  exit 0
fi

if [[ "$SKIP_BACKUP" -eq 0 ]]; then
  printf 'Creating a verified pre-deploy portfolio database backup...\n'
  BACKUP_ROOT="$BACKUP_ROOT" PORTFOLIO_ENV_FILE="$ENV_FILE" \
    bash "$ROOT_DIR/scripts/backup/backup.sh"
fi

releases_root="${PORTFOLIO_RELEASES_ROOT:-/home/codexdiag/portfolio-releases}"
mkdir -p "$releases_root"
release_worktree="$(mktemp -d "$releases_root/.deploy-${target_short}.XXXXXX")"
rmdir "$release_worktree"
cleanup() {
  git_release worktree remove --force "$release_worktree" >/dev/null 2>&1 || true
}
trap cleanup EXIT

printf 'Preparing immutable release worktree %s...\n' "$target_short"
git_release worktree add --detach "$release_worktree" "$target_ref" >/dev/null

printf 'Building and promoting release %s...\n' "$target_short"
PORTFOLIO_ENV_FILE="$ENV_FILE" \
  BACKUP_ROOT="$BACKUP_ROOT" \
  env -u PORTFOLIO_IMAGE -u PORTFOLIO_MIGRATOR_IMAGE -u VCS_REF \
  bash "$release_worktree/scripts/deploy/deploy.sh" "$target_ref"

if [[ "$REFRESH_CONTENT" -eq 1 ]]; then
  printf 'Publishing the reviewed portfolio content refresh...\n'
  RELEASE_COMPOSE_FILES=(-f "$release_worktree/compose.yml")
  if [[ -f "$release_worktree/compose.umami.yml" ]]; then
    RELEASE_COMPOSE_FILES+=(-f "$release_worktree/compose.umami.yml")
  fi
  PORTFOLIO_ENV_FILE="$ENV_FILE" \
    PORTFOLIO_MIGRATOR_IMAGE="portfolio-redesign-migrator:${target_ref}" \
    docker compose --env-file "$ENV_FILE" "${RELEASE_COMPOSE_FILES[@]}" run --rm \
      -e CONFIRM_CONTENT_REFRESH=YES \
      portfolio-migrate node scripts/admin/apply-content-refresh.mjs
fi

printf 'Portfolio release %s completed successfully.\n' "$target_short"
