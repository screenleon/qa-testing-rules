# QA Testing Cheatsheet

> Quick reference. For full explanation, continue with [AGENT.md](./AGENT.md).

---

## Three Red Lines

1. **Do not write a test unless you are sure it will fail when the implementation breaks.** Better not to write it.
2. **Do not mock the SUT's own logic.** Mocking must stop at external boundaries (DB / network / time / filesystem / third-party SDK).
3. **Do not rely on `sleep(N)` to wait for async results.** Use deterministic event / fake clock / `waitFor`.

---

## Choose the Test Layer

| Condition | Layer |
|---|---|
| Pure logic, no IO | Unit |
| Interacts with infrastructure you own (DB / queue / cache / HTTP handler) | **Integration** (preferred) |
| Cross-service / cross-team boundary | Contract |
| End-to-end smoke for critical business flows (≤10 tests) | E2E |

**Default:** when both unit and integration can verify it -> **Integration**.

---

## 12 Test Categories (enumerate before writing the first line of test code)

| # | Category | One-line prompt |
|---|---|---|
| 1 | Happy path | Most typical successful flow |
| 2 | Boundary | at least 3 points near `<` `>` `length` (just inside / exactly on boundary / just outside) |
| 3 | Negative inputs | null / wrong type / malformed / injection characters |
| 4 | Error paths | what is thrown when dependency fails + side effect that should not happen did not happen |
| 5 | State transitions | valid + **invalid** transitions; state unchanged when invalid |
| 6 | Concurrency | double-click / race / idempotent consumer |
| 7 | Side effects | what should be written was written; **on failure, it really was not written** |
| 8 | Resource lifecycle | whether connections / handles are cleaned up (including throw paths) |
| 9 | Security | authn / authz / cross-tenant rejection / injection |
| 10 | Perf / scale | n=0 / n=1 / n=large still within contract |
| 11 | Contract | API schema / event payload cross-service compatibility |
| 12 | Backward compat | old data can be read / migration idempotent |

---

## Every Test Must Have

1. **Behavior-descriptive function name**: `returns 401 when token is expired`
2. **Structured docstring**:
   ```
   <one sentence: what is being verified>
   Steps:
   1. prepare
   2. trigger
   3. verify
   ```
3. **AAA visually separated into three parts** (Arrange / Act / Assert)
4. **Concrete assertion**: `toBe(350)`, not `toBeTruthy()`
5. **Error path** asserts concrete error type + side effect that should not happen did not happen

---

## Test Doubles Quick Reference

| Type | Purpose | Verify interaction? |
|---|---|---|
| **Stub** | returns fixed value | No |
| **Mock** | interaction itself is the spec (must emit event) | Yes |
| **Fake** | lightweight real implementation (in-memory DB) | No |
| **Spy** | real behavior + observe calls | Yes |

Rule: "interaction is spec (user feels fewer calls) -> Mock; interaction is detail -> Stub/Fake".

---

## Top anti-pattern symptoms

- `should work` / `test1` / no docstring, so CI red gives no visible intent
- `toBeTruthy` / `toBeDefined` as the main assertion, without concrete expected
- Mocks outnumber real code, or even mock the SUT's own helper
- `sleep` / adding timeout / retry hides flake instead of waiting for a deterministic condition
- Error path only verifies `toThrow()`, without verifying concrete error type and "no side effects"
- Table-driven stuffs different scenarios into one test, making failures hard to locate
- `os.Chdir` / `process.chdir` / `os.Setenv` pollutes global state

---

## 5-item Pre-delivery Self-check

- [ ] Every test has a behavior name + docstring
- [ ] Every test passes when run on its own (no order dependency)
- [ ] No `sleep` / `setTimeout` or similar async waiting
- [ ] Error path asserts **concrete error type**
- [ ] Core tests have mutation self-test (break implementation -> confirm tests turn red)

---

## 30-second Reviewer Red Flags

- Function name `test1` / `should work` / no docstring
- `toBeTruthy` / `toBeDefined` as main assertion
- Mocks outnumber real code
- `test.skip` / `only` on the main branch
- `jest --retry` / `flaky: true` hides flake
- `os.Chdir` / `process.chdir` / `os.Setenv` instead of `t.Setenv`
