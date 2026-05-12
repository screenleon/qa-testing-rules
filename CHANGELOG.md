# Changelog

All notable changes to qa-testing-rules are documented here.
Format inspired by [Keep a Changelog](https://keepachangelog.com/).
Versions follow [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

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

### Changed
- Nothing breaking in this batch.

---

## [1.0.0] - 2026-04-XX (initial structured release)

### Added
- Two-tier hot-path / reference model (AGENT.md + 5 reference files)
- 12-category test matrix
- 15 anti-patterns
- 3 examples (JS: transferMoney, async email, order state machine)
- TEST-STRATEGY.md: 8 sections covering layers, CI lanes, coverage, flakiness
- PRINCIPLES.md: 10 core principles
