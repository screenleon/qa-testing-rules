# Backlog

## Open

### [medium] Add Semgrep fixture tests for the rule pack

**Source**: qa-tester gate finding, PR #3 (gate-20260611-092758)

The `semgrep/qa-testing-rules.yml` rule pack ships 11 machine-checkable rules
but has no committed fixture tests. Schema validation (`semgrep --validate`) is
the only protection; a rule that validates but matches the wrong pattern will go
undetected until it fires (or fails to fire) in a consuming project.

**Required work:**

Add a `semgrep/fixtures/` directory with representative positive (should match)
and negative (must not match) samples for each rule, then wire them into CI.

Suggested layout:

```
semgrep/fixtures/
  js/
    sleep-in-test.ts          # positive: time.sleep / setTimeout assert smell
    sleep-in-test.clean.ts    # negative: waitFor / fake-clock usage
    weak-assertion.ts         # positive: toBeTruthy / toBeDefined as main
    weak-assertion.clean.ts   # negative: toBe(expected)
    focused-skip.ts           # positive: test.only / test.skip
    ...
  go/
    sleep-in-test_test.go     # positive: time.Sleep
    chdir-in-test_test.go     # positive: os.Chdir
    ...
  python/
    sleep-in-test.py          # positive: time.sleep
    ...
```

CI job addition:

```yaml
semgrep-fixtures:
  name: Semgrep fixture coverage
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - run: pipx install 'semgrep==1.75.0'
    - run: semgrep --config semgrep/qa-testing-rules.yml semgrep/fixtures/js semgrep/fixtures/go semgrep/fixtures/python --error
      # Positives must match (exit non-zero if no findings in positive files)
    - run: semgrep --config semgrep/qa-testing-rules.yml semgrep/fixtures/js/**.clean.* --error --invert
      # Negatives must not match
```

**Priority**: medium — the rule pack is advisory-only (consumed in other repos) so
no immediate breakage, but fixture coverage is required before claiming the pack
is "tested" rather than "parseable".

---

### [medium] Pin GitHub Actions to commit SHAs

**Source**: security-reviewer gate finding, PR #3

`.github/workflows/ci.yml` references third-party Actions by mutable tags:

- `actions/checkout@v4`
- `DavidAnson/markdownlint-cli2-action@v19`
- `lycheeverse/lychee-action@v2`

Pin each to its current SHA to reduce supply-chain risk. Use
`# tag: vX.Y.Z` comments to preserve readability. Tools like
[`pin-github-action`](https://github.com/mheap/pin-github-action) can automate
this.

**Priority**: medium — non-blocking with current read-only workflow permissions,
but good hygiene before relying on the gate as release infrastructure.
