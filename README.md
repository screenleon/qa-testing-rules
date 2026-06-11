# qa-testing-rules

Language/framework-agnostic QA testing rules — a single source of truth that AI coding agents and human engineers can `@import`.

## Why this exists

Without explicit guidance, LLM agents default to **happy-path-only** tests — pretty coverage numbers that catch no bugs. This repo forces three habits: (1) **enumerate test categories** before writing tests, (2) compare against an **anti-pattern catalog**, and (3) run a **mutation self-review** after writing.

## Two-tier structure (important)

**Tier 1 (agent hot path, always loaded, ~3k tokens — budget enforced in CI):**

- [`AGENT.md`](./AGENT.md) — the agent's only required entry point. Workflow + 12-category quick reference + red lines + self-checklist.

**Tier 2 (reference, read only when needed):**

| File | When to read |
|---|---|
| [`PRINCIPLES.md`](./PRINCIPLES.md) | unsure how to judge an edge case |
| [`TEST-STRATEGY.md`](./TEST-STRATEGY.md) | choosing test layers, designing CI / environments / coverage / flakiness / mutation-testing policy |
| [`TEST-CATEGORIES.md`](./TEST-CATEGORIES.md) | stuck on concrete sub-cases for a category |
| [`GENERATIVE-TESTING.md`](./GENERATIVE-TESTING.md) | boundary / negative enumeration is endless (parser, serializer, money math) — property-based, fuzzing, model-based |
| [`ANTI-PATTERNS.md`](./ANTI-PATTERNS.md) | reviewing / saw a smell and want to confirm it is an anti-pattern |
| [`EXAMPLES.md`](./EXAMPLES.md) | need good-vs-bad code comparisons |
| [`LLM-TESTING.md`](./LLM-TESTING.md) | the SUT calls an LLM / output is non-deterministic |
| [`LEGACY-TESTING.md`](./LEGACY-TESTING.md) | adding tests to untested legacy code before changing it |
| [`CHEATSHEET.md`](./CHEATSHEET.md) | quick recall of layer choice, 12 categories, anti-pattern index |

## Usage (for agents)

Add to your project's `CLAUDE.md` / `AGENTS.md` / `.cursorrules` / `GEMINI.md`:

```md
## Testing rules

When writing or reviewing tests, read:
https://github.com/screenleon/qa-testing-rules/blob/main/AGENT.md

Only consult the deeper reference files (PRINCIPLES / TEST-STRATEGY /
TEST-CATEGORIES / ANTI-PATTERNS / EXAMPLES / GENERATIVE-TESTING / LLM-TESTING / LEGACY-TESTING)
when AGENT.md explicitly points you to them, to keep token usage low.
```

## Enforcement (machine-checkable subset)

Documentation does not stop violations; linters do. [`semgrep/qa-testing-rules.yml`](./semgrep/qa-testing-rules.yml) encodes the mechanically detectable anti-patterns (sleep-in-test, `.only` / `.skip`, weak assertions, bare `toThrow()`, `os.Chdir` / `os.Setenv` in tests, `jest.retryTimes`) as Semgrep rules for JS/TS, Go, and Python:

```sh
semgrep --config https://raw.githubusercontent.com/screenleon/qa-testing-rules/main/semgrep/qa-testing-rules.yml
```

Severity convention: `ERROR` = red-line violation (block CI), `WARNING` = fix or justify, `INFO` = needs human judgment.

## Core stance

> **The purpose of testing is to find bugs, not to prove the program works.**
> A test that does not fail when the implementation breaks might as well not exist.

## Versioning

qa-testing-rules follows [Semantic Versioning](https://semver.org/). Tags use `vX.Y.Z` (e.g. `v1.1.0`):

- **MAJOR**: removing existing rules or changing the `AGENT.md` workflow step order (agents must relearn)
- **MINOR**: new categories, examples, anti-patterns, or backward-compatible rule extensions
- **PATCH**: wording fixes, formatting, changes that do not affect rule semantics

Other repos should pin a release tag or commit SHA, not the `main` branch. Replace `vX.Y.Z` with an existing release tag:

```md
## Testing rules
When writing or reviewing tests, read:
https://github.com/screenleon/qa-testing-rules/blob/vX.Y.Z/AGENT.md
Only consult the deeper reference files when AGENT.md explicitly points you there.
```

### Release process

1. Make changes and let CI validate them (markdownlint, internal link check, `AGENT.md` token budget, changelog structure, semgrep rule validation — see [`.github/workflows/ci.yml`](./.github/workflows/ci.yml)). Locally: `npx markdownlint-cli2 '**/*.md'` and `bash scripts/check-agent-token-budget.sh`
2. Update `CHANGELOG.md` (move `[Unreleased]` → `[vX.Y.Z]` + date)
3. `git tag vX.Y.Z && git push origin vX.Y.Z`

See [`CHANGELOG.md`](./CHANGELOG.md) for history.

## Acknowledgements

Condensed from:

- [khasky/testing-strategy-playbook](https://github.com/khasky/testing-strategy-playbook) — test layers, CI routing, coverage / flakiness policy
- [gittower/git-flow-next](https://github.com/gittower/git-flow-next/blob/main/TESTING_GUIDELINES.md) — structured docstrings, naming patterns, one scenario per function, cwd anti-pattern
- [SolidOS testing_guidelines](https://github.com/SolidOS/solidos/blob/main/documentation/guidelines/testing_guidelines.md) — bug-first reproducing tests, custom matchers

Differentiation: the references above are integrated into an **agent-executable step-by-step workflow** (hot path under budget, deep details loaded on demand), plus an enforceable Semgrep rule pack.

## License

MIT
