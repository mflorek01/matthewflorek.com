#!/usr/bin/env bash
set -Eeuo pipefail

command -v curl >/dev/null 2>&1 || {
  printf 'Required command is unavailable: curl\n' >&2
  exit 2
}

portfolio_health="$(curl -fsS -o /dev/null -w '%{http_code}' 'https://matthewflorek.com/api/health?db=1')"
portfolio_script="$(curl -fsS -o /dev/null -w '%{http_code}' 'https://analytics.matthewflorek.com/script.js')"
metamorphysis_status="$(curl -fsS -o /dev/null -w '%{http_code}' 'https://metamorphysis.ai/')"
www_location="$(curl -fsS -o /dev/null -w '%{http_code} %{redirect_url}' 'https://www.matthewflorek.com/work')"
dashboard_status="$(curl -sS -o /dev/null -w '%{http_code}' 'https://analytics.matthewflorek.com/login')"

[[ "$portfolio_health" == 200 ]] || {
  printf 'Portfolio health failed: %s\n' "$portfolio_health" >&2
  exit 1
}
[[ "$portfolio_script" == 200 ]] || {
  printf 'Umami tracker failed: %s\n' "$portfolio_script" >&2
  exit 1
}
[[ "$metamorphysis_status" == 200 ]] || {
  printf 'Metamorphysis check failed: %s\n' "$metamorphysis_status" >&2
  exit 1
}
[[ "$www_location" == '301 https://matthewflorek.com/work' || "$www_location" == '308 https://matthewflorek.com/work' ]] || {
  printf 'www redirect failed: %s\n' "$www_location" >&2
  exit 1
}
[[ "$dashboard_status" == 404 ]] || {
  printf 'Umami dashboard is unexpectedly public: %s\n' "$dashboard_status" >&2
  exit 1
}

printf 'Public cutover checks passed.\n'
printf 'Portfolio health: %s\n' "$portfolio_health"
printf 'Umami tracker: %s\n' "$portfolio_script"
printf 'www redirect: %s\n' "$www_location"
printf 'Private Umami dashboard: %s\n' "$dashboard_status"
printf 'Metamorphysis: %s\n' "$metamorphysis_status"
