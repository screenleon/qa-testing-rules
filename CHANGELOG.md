# Changelog

All notable changes to qa-testing-rules are documented here.
Format inspired by [Keep a Changelog](https://keepachangelog.com/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added
- `semgrep/fixtures/`: positive-case fixture tests for all 11 Semgrep rules (Go, Python, JS/TS) — `semgrep --test` now verifies rules fire where expected

### Changed
- `.github/workflows/ci.yml`: added `semgrep-fixture-tests` job; pinned all Actions to commit SHAs (`actions/checkout` upgraded v4→v6.0.3, `markdownlint-cli2-action` v19.1.0, `lychee-action` v2.8.0); Semgrep pinned to 1.75.0

### Added
- `LLM-TESTING.md`: new Tier 2 reference for SUTs that call an LLM — deterministic-shell vs non-deterministic-core split, assertion ladder, eval suites with statistical pass-rate thresholds, LLM-as-judge calibration, LLM-specific readings of the 12 categories, LLM testing anti-patterns
- `LEGACY-TESTING.md`: new Tier 2 reference for adding tests to untested code — characterization tests (and how they differ from "freezing a bug as spec"), seams, sprout/wrap, approval testing (golden files done right), blast-radius prioritization, agent workflow
- `GENERATIVE-TESTING.md`: new Tier 2 reference — property-based, fuzzing, and model-based testing; full property-shape guide (roundtrip / oracle / idempotence / invariant / metamorphic / monotonicity), tool matrix, shrinking strategy, examples (fast-check / Hypothesis / go fuzz)
- `TEST-CATEGORIES.md`: §14 condensed to summary + pointer to `GENERATIVE-TESTING.md`
- `TEST-STRATEGY.md`: §1.5 Writing the few E2E tests well — selector strategy, network boundary, auth state reuse, deterministic waiting; plus visual regression and accessibility (axe-core) supplements
- `TEST-STRATEGY.md`: §6.1 Automating mutation testing — tools per language, CI lane placement (incremental on PR, full on nightly), score floors on critical modules, equivalent-mutant handling
- `EXAMPLES.md`: Example 6 (property-based testing with fast-check — invariants, shrinking, pinning counterexamples)
- `AGENT.md`: SUT-type table row for LLM-powered features; §2.1 characterization-test exception; §3 pointers to the new reference files including `GENERATIVE-TESTING.md`
- `semgrep/qa-testing-rules.yml`: machine-checkable rule pack (11 rules, JS/TS + Go + Python) covering sleep-in-test, chdir/setenv in tests, `jest.retryTimes`, `.only` / `.skip`, weak assertions, bare `toThrow()`
- CI (`.github/workflows/ci.yml`): markdownlint, offline internal-link check, `AGENT.md` token-budget gate (`scripts/check-agent-token-budget.sh`), changelog structure check, semgrep rule validation (pinned to semgrep==1.75.0)
- `.markdownlint-cli2.jsonc`: lint configuration matching the repo's writing style
- `CHEATSHEET.md`: "Special SUTs — where to look" section (PBT / LLM / legacy)

### Changed
- `README.md`: translated to English for consistency with the rule files; added Enforcement section (semgrep pack); documented CI-backed release process; standardized tag format to `vX.Y.Z`
- `TEST-CATEGORIES.md`: retitled supplements section to cover §13 and §14

---

## [v1.1.0] - 2026-05-12

### Added
- `EXAMPLES.md`: Example 4 (Go integration test with testcontainers-go / pgx)
- `EXAMPLES.md`: Example 5 (React Native / TypeScript component test with `waitFor`)
- `ANTI-PATTERNS.md`: #16 Test doubles taxonomy (Stub / Mock / Fake / Spy)
- `ANTI-PATTERNS.md`: #17 Over-specification (verifying call count instead of behavior)
- `CHEATSHEET.md`: 1-page at-a-glance quick-reference
- `AGENT.md`: Step 1 SUT-type decision table (GraphQL, gRPC, message queue, background job)
- `AGENT.md`: Risk-based priority guide (which categories must not be skipped)
- `AGENT.md`: N/A quality gate (when N/A is and is not valid)
- `TEST-CATEGORIES.md`: §9 OWASP supplement (CSRF, CORS, IDOR/BOLA, security headers, path traversal, file upload, mass assignment)
- `TEST-CATEGORIES.md`: §13 Privacy / Telemetry Leakage (PII in logs, traces, metrics, error responses)
- `TEST-STRATEGY.md`: §1.3 Consumer-Driven Contract Testing (Pact pattern)
- `README.md`: Versioning section with semver policy and pin instructions
- `CHANGELOG.md`: This file

### Fixed
- `ANTI-PATTERNS.md`: Corrected title from "15 種" to "17 種" after adding #16 and #17
- `README.md`: Added `git diff --check main` as concrete release validation command
- `README.md`: Added `CHEATSHEET.md` to reference table; replaced version tag placeholder

### Changed
- Nothing breaking in this batch.

---

## [v1.0.0] - 2026-05-01 (initial structured release)

### Added
- Two-tier hot-path / reference model (AGENT.md + 5 reference files)
- 12-category test matrix
- 15 anti-patterns
- 3 examples (JS: transferMoney, async email, order state machine)
- TEST-STRATEGY.md: 8 sections covering layers, CI lanes, coverage, flakiness
- PRINCIPLES.md: 10 core principles
