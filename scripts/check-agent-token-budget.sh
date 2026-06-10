#!/usr/bin/env bash
# AGENT.md is the always-loaded agent hot path; README promises it stays small.
# Approximation: 1 token ~= 4 characters. Coarse, but enough to catch budget drift in CI.
set -euo pipefail

cd "$(dirname "$0")/.."

BUDGET_TOKENS=4500

chars=$(wc -c < AGENT.md)
approx_tokens=$(( chars / 4 ))

echo "AGENT.md: ${chars} chars ≈ ${approx_tokens} tokens (budget: ${BUDGET_TOKENS})"

if [ "${approx_tokens}" -gt "${BUDGET_TOKENS}" ]; then
  echo "ERROR: AGENT.md exceeds the hot-path token budget." >&2
  echo "Move detail into a Tier 2 reference file and leave a one-line pointer instead." >&2
  exit 1
fi
