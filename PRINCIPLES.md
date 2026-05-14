# Principles — 10 Core Principles

> Operational rules are in `AGENT.md`; this file explains "**why**". Read this when you are unsure how to judge an edge case.

---

## 1. The purpose of testing is to find bugs, not to prove the program is useful

"All tests are green" is a **meaningless sentence** unless you can add "when the implementation is broken, at least 95% of the time they will fail".

→ Coverage is a lagging indicator; **mutation testing** is the real report card.

## 2. Independence

Every test must also pass when run **on its own**, regardless of order.

→ CI will shard / parallelize; when debugging one test, you will not run the whole suite. Setup is responsible for itself, and cleanup uses transaction rollback / fixture isolation.

## 3. Determinism — Flakiness is a defect, not a personality trait

The same input must always produce the same output. **Tolerate it once, and the whole team learns to ignore red lights.**

Main sources of flakiness: time (inject fake clock), randomness (seeded RNG), order (sorted assertion), concurrency (deterministic synchronization), external IO (isolate boundaries).

**Iron rules:**
- When you see flaky behavior, find the root cause immediately; do not retry / skip
- Flake 3 consecutive times -> automatic quarantine (time-bound 7 days; delete if not fixed by expiration)
- **Strictly forbidden**: using framework retry flags (`jest --retry` / `flaky: true`) as the solution
- See `TEST-STRATEGY.md` §7

## 4. Readability > concision

Tests are **executable specification documents**. A future reader must be able to see within 30 seconds: (1) what is being verified, (2) why this result is expected, and (3) what is broken if it fails.

Do not abstract for DRY until the test becomes unreadable; duplication in tests costs less than abstraction.

## 5. Arrange-Act-Assert (AAA)

```
Arrange — prepare input and environment
Act     — trigger the behavior under test (ideally one line)
Assert  — verify the result
```

Need to act twice = two tests.

## 6. One test verifies one concept

Multiple `expect` calls are allowed, but they must **jointly describe the same concept**.

Example: "user registration succeeds" may verify `returns user.id` + `DB has this row` + `welcome email is scheduled` at the same time; the three together **constitute** successful registration.
But "registration succeeds + duplicate email fails + password too short fails" is **3 tests forced into 1**.

## 7. Failure messages must locate the root cause

The more concrete the assertion, the faster the diagnosis.

✗ `expect(x).toBeTruthy()` — failure only tells you "not truthy"; is it null / 0 / "" / false?
✓ `expect(x.status).toBe(200)` then `expect(x.body.userId).toBe(...)`

**Do not use `toBeTruthy` / `toBeDefined` / `not.toBeNull` as the main assertion**, unless you **really** only care that "it exists".

## 8. Verify behavior, not implementation

Tests tied to implementation ("called `cache.get` three times") break heavily during refactors but **do not catch any bugs**.

Default to black-box (give input / observe output / observe side effect). **Verify interactions only when "the interaction itself is the spec"** (example: "placing an order must emit an OrderPlaced event").

## 9. Believe green only after seeing red

**A new test must first be seen failing once** before you can trust that it "will protect you when the implementation breaks".

Non-TDD approach: after writing the test, **intentionally break the implementation** (change a comparison operator, comment out one line) -> run -> red -> restore -> run -> green.

The 10-second action is the only verification of whether "the test is real or fake".

## 10. Tests declare their own intent (self-documenting)

Each test should tell you, **without reading the implementation**, from the function name + docstring: what is being verified, how it is arranged, and what failure means.

**Naming:** describe behavior in a complete sentence.

```
returns 401 when token is expired
rejects transfer when balance is insufficient
TestStartFeatureBranch
TestFinishWithMergeConflict
```

**Mandatory docstring:**

```
// <one sentence: what this test verifies>
// Steps:
// 1. <prepare>
// 2. <trigger>
// 3. <verify>
```

**One function, one scenario.** Exception: pure function input/output mappings may use table-driven tests. Integration / behavior tests are always split. See `ANTI-PATTERNS.md` §12.

---

## Appendix: Priority When Principles Conflict

```
correctness > determinism > readability > concision > speed
```

Example: it is acceptable to make tests slower for determinism (use a real DB instead of a mock); it is not acceptable to introduce flakiness for speed.
