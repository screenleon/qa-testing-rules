# Changelog

All notable changes to qa-testing-rules are documented here.
Format inspired by [Keep a Changelog](https://keepachangelog.com/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- `TEST-ORACLES.md` §4.1 — admission criteria for a permanent regression test. §4 asks whether a test is acceptable; §4.1 asks whether it has earned a permanent slot in the *blocking* suite, which is the question a review finding raises when its remedy is "add a test". Four criteria beyond §4's gates (observable contract with Red Line 4 provenance, supported behavior or a documented boundary rejection tested once, plausible-or-high-impact risk, no frozen implementation shape), five named alternatives when one fails, and a reviewer-side duty to state which criteria a finding meets. Fault sensitivity and non-duplication are **not** restated — they are already §4 gates 5 and 6. §4.1 states its precedence over the §2.2 bug-regression workflow: for a confirmed defect the reproducing test is still written first, and §4.1 decides only whether it is *retained* in the blocking suite. None of the alternatives waives a confirmed defect, and for a confirmed high-impact one accepted risk is not a standalone option — it is a bounded temporary state requiring a non-author approver, an expiry, a compensating detection control, and a recorded release/rollback decision before sign-off.
- `AGENT.md` Step 2.5 — a short Tier 1 decision trigger: a finding does not automatically earn a permanent blocking test. The trigger is in the hot path because it changes reviewer behavior at the moment the inflow starts; the criteria and alternatives live in Tier 2 and are read on demand.
- `ANTI-PATTERNS.md` #4b — a missing dependency reported as `pass` is a variant of always-passing, and it corrupts the run report: "0 skipped" then means "every script exited 0", not "every declared case ran".
- `ANTI-PATTERNS.md` #20 — source-shape proxy tests (grepping the implementation's text instead of executing it). Covers both failure directions and gives a proxy → real-requirement mapping table.
- `TEST-STRATEGY.md` §7.1 — infra failure is not a product regression. Five-status vocabulary including `infra_error`, one shared pinned toolchain across reviewer/local/CI lanes, and no authoritative success while a required case is skipped or infra-errored. Reruns are scoped so §7.1 neither duplicates nor loosens §7: an unchanged environment is never rerun, and a run after a documented correction is a *fresh validation* reported on its own merits — not a flaky-test retry, and not a reason to mark a now-clean test `FLAKY`.

### Changed

- `AGENT.md` Step 3 — structured docstrings are now required only for concurrency, security, and multi-stage scenarios. Single-assertion parser / validation / mapping cases rely on a behavior-descriptive name instead. An unreadable test file should be split, not annotated.
- **Aligned every other docstring rule with that narrowing** — `AGENT.md` §2.3 reviewer stance, `PRINCIPLES.md` §10 ("Mandatory docstring"), `ANTI-PATTERNS.md` #14, and four places in `CHEATSHEET.md` previously rejected any test without a docstring, which would have made an agent both accept and reject the same well-named trivial case. The name is now stated as the primary carrier of intent; a docstring supplements it where Step 3 requires one, and never rescues a bad name.
- `AGENT.md` Step 5 checklist — added explicit exit-code assertion for every CLI/subprocess invocation, a ban on bare `|| true`, and never-`pass` for a missing dependency. The checklist states the required-versus-optional split (required → `infra_error`, explicitly optional → reasoned `skip`) rather than a looser shorthand, so the hot path and the detailed §7.1 status policy prescribe the same outcome; the cheatsheet and red-flag lines match.
- `ANTI-PATTERNS.md` reviewer red-flag checklist — four new scan items covering the above.
- `.gitignore`: ignore `.dispatch-results/` alongside the existing agent-output directories.

---

## [v1.3.0] - 2026-07-13

### Added
- `TEST-ORACLES.md`: Tier 2 guidance for oracle provenance, characterization status, high-risk assertion/snapshot/golden changes, AI-generated-test acceptance gates, test timing, and PR evidence.
- `TEST-DESIGN.md`: technique-selection guide for partitions, boundaries, decision tables, pairwise/t-way combinations, state models, metamorphic/differential testing, and exploratory charters.
- `ACCESSIBILITY-TESTING.md`: WCAG 2.2-aligned automated and manual/assisted accessibility evidence.
- `RELIABILITY-TESTING.md`: dependency failure, retry/backoff, circuit-breaker, queue, capacity, canary, probe, restore, and recovery guidance.
- `TEST-CATEGORIES.md`: versioned ASVS/WSTG traceability metadata convention.
- Semgrep coverage for Java, C#, Rust, Python skipped tests, and Playwright retry configuration, with fixtures for the added Java/C#/Rust rules.

### Changed
- `AGENT.md` and `CHEATSHEET.md`: fourth Red Line requires independent expected-behavior evidence except for labeled characterization tests; delivery reports include test timing and oracle source.
- `PRINCIPLES.md`: mutation testing is scoped to fault-detection strength, not correctness provenance; retry policy permits visible classification/containment but never clean retry-passes.
- `LEGACY-TESTING.md`, `LLM-TESTING.md`, `ANTI-PATTERNS.md`, `TEST-STRATEGY.md`, and `README.md`: linked oracle governance, AI-test scope, accessibility/reliability supplements, revised retry policy, and anti-patterns for oracle laundering and assertion rewriting.
- `semgrep/README.md` now enumerates every supported-language fixture; `TEST-CATEGORIES.md` now specifies the OWASP versioned WSTG scenario-ID format (`WSTG-v42-<CATEGORY>-<NN>`).

---

## [v1.2.0] - 2026-06-11

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
- `semgrep/qa-testing-rules.{go,py,ts}`: positive-case fixture tests for all 11 Semgrep rules — `semgrep --test semgrep/` verifies rules fire where expected
- CI (`.github/workflows/ci.yml`): markdownlint, offline internal-link check, `AGENT.md` token-budget gate (`scripts/check-agent-token-budget.sh`), changelog structure check, semgrep rule validation, semgrep fixture tests; Actions pinned to commit SHAs (`actions/checkout` v6.0.3, `markdownlint-cli2-action` v19.1.0, `lychee-action` v2.8.0); Semgrep pinned to 1.75.0
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
- `ANTI-PATTERNS.md`: Corrected the title from "15" to "17" after adding #16 and #17
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
