# semgrep/

## Files

| File | Purpose |
|---|---|
| `qa-testing-rules.yml` | The rule pack — machine-checkable anti-patterns for JS/TS, Go, Python, Java, C#, and Rust |
| `qa-testing-rules.go` | Semgrep fixture tests — Go rules |
| `qa-testing-rules.py` | Semgrep fixture tests — Python rules |
| `qa-testing-rules.ts` | Semgrep fixture tests — JS/TS rules |
| `qa-testing-rules.java` | Semgrep fixture tests — Java rules |
| `qa-testing-rules.cs` | Semgrep fixture tests — C# rules |
| `qa-testing-rules.rs` | Semgrep fixture tests — Rust rules |

## Why the fixture files are named `qa-testing-rules.*`

`semgrep --test <dir>` discovers test files by matching the **rule file stem**:
rule file `qa-testing-rules.yml` → test files such as
`qa-testing-rules.{go,py,ts,java,cs,rs}`.

This is the semgrep test-discovery convention, not a language test-file convention.
The files do **not** need to end in `_test.go` / `test_*.py` / `*.test.ts`.

> **`semgrep --test` ignores `paths:` filters by design.**
> From the semgrep docs: *"Semgrep's test runner ignores the `paths` key in rules
> when running tests. This allows you to test a rule against files that don't
> match the paths you've specified."*

So a rule with `paths.include: ["*_test.go"]` **will** fire on `qa-testing-rules.go`
when run under `semgrep --test`.

## Running locally

```sh
# Validate rule syntax
semgrep --validate --config semgrep/qa-testing-rules.yml

# Run fixture tests
semgrep --test semgrep/

# Use in a consuming project
semgrep --config https://raw.githubusercontent.com/screenleon/qa-testing-rules/main/semgrep/qa-testing-rules.yml
```

## Fixture annotation format

Lines in the fixture files use `# ruleid: <rule-id>` (or `// ruleid: ...`) to
mark code that **must** be matched by the named rule. Lines without an annotation
are clean alternatives that verify the rule does not fire on correct code.
