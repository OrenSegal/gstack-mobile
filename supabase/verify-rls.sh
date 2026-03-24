#!/usr/bin/env bash
# verify-rls.sh — smoke test that anon key is locked out after 002_tighten_rls.sql
#
# Run manually after deploying the migration:
#   bash supabase/verify-rls.sh
#
# All 9 checks should PASS (anon key denied for reads AND writes).
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
. "$SCRIPT_DIR/config.sh"

URL="$GSTACK_SUPABASE_URL"
KEY="$GSTACK_SUPABASE_ANON_KEY"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local method="$2"
  local path="$3"
  local data="${4:-}"

  local args=(-sf -o /dev/null -w '%{http_code}' --max-time 10
    -H "apikey: ${KEY}"
    -H "Authorization: Bearer ${KEY}"
    -H "Content-Type: application/json")

  if [ "$method" = "GET" ]; then
    HTTP="$(curl "${args[@]}" "${URL}/rest/v1/${path}" 2>/dev/null || echo "000")"
  elif [ "$method" = "POST" ]; then
    HTTP="$(curl "${args[@]}" -X POST "${URL}/rest/v1/${path}" -H "Prefer: return=minimal" -d "$data" 2>/dev/null || echo "000")"
  elif [ "$method" = "PATCH" ]; then
    HTTP="$(curl "${args[@]}" -X PATCH "${URL}/rest/v1/${path}" -d "$data" 2>/dev/null || echo "000")"
  fi

  # Only 401/403 prove RLS denial. 200 (even empty) means access is granted.
  # 5xx means something errored but access wasn't denied by policy.
  case "$HTTP" in
    401|403)
      echo "  PASS  $desc (HTTP $HTTP, denied by RLS)"
      PASS=$(( PASS + 1 ))
      ;;
    200)
      # 200 means the request was accepted — check if data was returned
      if [ "$method" = "GET" ]; then
        BODY="$(curl -sf --max-time 10 "${URL}/rest/v1/${path}" -H "apikey: ${KEY}" -H "Authorization: Bearer ${KEY}" -H "Content-Type: application/json" 2>/dev/null || echo "")"
        if [ "$BODY" = "[]" ] || [ -z "$BODY" ]; then
          echo "  WARN  $desc (HTTP $HTTP, empty — may be RLS or empty table, verify manually)"
          FAIL=$(( FAIL + 1 ))
        else
          echo "  FAIL  $desc (HTTP $HTTP, got data)"
          FAIL=$(( FAIL + 1 ))
        fi
      else
        echo "  FAIL  $desc (HTTP $HTTP, write accepted)"
        FAIL=$(( FAIL + 1 ))
      fi
      ;;
    201)
      echo "  FAIL  $desc (HTTP $HTTP, write succeeded!)"
      FAIL=$(( FAIL + 1 ))
      ;;
    000)
      echo "  WARN  $desc (connection failed)"
      FAIL=$(( FAIL + 1 ))
      ;;
    *)
      # 404, 406, 500, etc. — access not definitively denied by RLS
      echo "  WARN  $desc (HTTP $HTTP — not a clean RLS denial)"
      FAIL=$(( FAIL + 1 ))
      ;;
  esac
}

echo "RLS Lockdown Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Read denial checks:"
check "SELECT telemetry_events" GET "telemetry_events?select=*&limit=1"
check "SELECT installations"    GET "installations?select=*&limit=1"
check "SELECT update_checks"    GET "update_checks?select=*&limit=1"
check "SELECT crash_clusters"   GET "crash_clusters?select=*&limit=1"
check "SELECT skill_sequences"  GET "skill_sequences?select=skill_a&limit=1"

echo ""
echo "Write denial checks:"
check "INSERT telemetry_events" POST "telemetry_events" '{"gstack_version":"test","os":"test","event_timestamp":"2026-01-01T00:00:00Z","outcome":"test"}'
check "INSERT update_checks"    POST "update_checks"    '{"gstack_version":"test","os":"test"}'
check "INSERT installations"    POST "installations"    '{"installation_id":"test_verify_rls"}'
check "UPDATE installations"    PATCH "installations?installation_id=eq.test_verify_rls" '{"gstack_version":"hacked"}'

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Results: $PASS passed, $FAIL failed (of 9 checks)"

if [ "$FAIL" -gt 0 ]; then
  echo "VERDICT: FAIL — anon key still has access"
  exit 1
else
  echo "VERDICT: PASS — anon key fully locked out"
  exit 0
fi
