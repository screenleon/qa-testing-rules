# AGENT.md — agent hot-path rules

> **This is the agent's only required entry point.** Loading this file is enough to write tests that are 70% compliant. The other files are references; **read them only when needed**.

---

## 0. Three Red Lines (violating any one means this submission has failed)

1. **Do not write a test unless you are sure it will fail when the implementation breaks.** Better not to write it.
2. **Do not mock the SUT's own logic.** Mocking must stop at external boundaries (DB / network / time / filesystem / third-party SDK).
3. **Do not rely on `sleep(N)` to wait for async results.** Use deterministic event / fake clock / await.

---

## 1. Workflow (run this for every test task)

### Step 1 — Choose the test layer

Ask the SUT:

| Condition | Which layer |
|---|---|
| Pure logic, no IO | **Unit** |
| Interacts with infrastructure you own (DB, queue, cache, HTTP handler) | **Integration** (preferred) |
| Cross-service / cross-team boundary | **Contract** |
| End-to-end smoke for critical business flows | **E2E** (small number) |

Default stance: when both unit and integration can verify it, **choose integration**. Deeper details → `TEST-STRATEGY.md`.

### SUT Type Quick Reference (common but non-obvious layering)

| SUT Type | Recommended Layer | Reason |
|---|---|---|
| GraphQL resolver | Integration | resolver semantics depend on DB / dataloader interaction |
| gRPC service | Integration | verify the proto contract with testserver / bufconn |
| message queue consumer | Integration + Contract | in-process broker / testcontainers; contract verifies payload schema |
| background job / cron | Unit (pure logic) + Integration (side effects) | scheduler call -> unit; DB write inside job -> integration |
| HTTP middleware | Integration | middleware depends on request/response object semantics; use httptest |
| Repository / DAO | Integration | do not mock DB; run directly against a real DB |
| Pure function / transformer | Unit | no IO, fast, highly deterministic |

### Step 2 — Enumerate test categories (before writing the first line of test code)

For each of the following 12 categories, answer **each one** with "Applicable / N/A" + concrete cases. Explicit N/A is better than silent omission.

| # | Category | Prompt |
|---|---|---|
| 1 | Happy path | Primary successful flow |
| 2 | Boundary | Around any `<` `>` `length` `limit` -> test at least 3 off-by-one points (just inside / exactly on boundary / just outside) |
| 3 | Negative inputs | null / undefined / wrong type / malformed / injection characters |
| 4 | Error paths | dependency failure, timeout, insufficient permission; assert concrete error type + "the side effect that should not happen really did not happen" |
| 5 | State transitions | valid transitions ✓, invalid transitions rejected and state unchanged, idempotency |
| 6 | Concurrency | double-clicks, competing resources, idempotent consumer, cache stampede |
| 7 | Side effects | DB / event / HTTP that should be written really was written; when failing, it really was not written |
| 8 | Resource lifecycle | whether connections / files / handles are cleaned up (including throw paths) |
| 9 | Security | authn / authz boundaries, cross-tenant rejection, injection, errors do not leak internal info |
| 10 | Perf / scale | n=0, n=1, n=large still within contract |
| 11 | Contract | cross-service schema / event payload / webhook compatibility, versioning |
| 12 | Backward compat | old data can be read, old clients remain compatible, migration can run twice harmlessly |

Need more detailed sub-prompts for each category → `TEST-CATEGORIES.md`.

**Output**: a brief test matrix (example):

```
SUT: createOrder(userId, items, paymentMethod)
Layer: integration (interacts with DB + payment client)

| #  | Category         | Apply | Cases                                           |
| 1  | Happy path       | Y     | 1 item / multiple items                         |
| 2  | Boundary         | Y     | 0 items (reject), single item exceeds stock cap |
| 3  | Negative inputs  | Y     | nonexistent userId, empty items, nonexistent SKU |
| 4  | Error paths      | Y     | payment timeout, payment rejection, DB tx failure |
| 5  | State            | Y     | placing order on cancelled cart should reject   |
| 6  | Concurrency      | Y     | double-click; last stock item grabbed by two people |
| 7  | Side effects     | Y     | success: DB+stock-1+event; failure: none        |
| 8  | Resource         | N/A   | managed uniformly by connection pool            |
| 9  | Security         | Y     | cross-user access to someone else's cart        |
| 10 | Perf             | Y     | items.length=0/1/1000                           |
| 11 | Contract         | Y     | OrderPlaced event schema compatible with inventory |
| 12 | Backward compat  | N/A   | new feature has no historical data              |
```

### Risk-based priority when time is short

The full 12 categories are the goal; when time is limited, prioritize by the SUT's **risk exposure**:

**Cover first for any SUT:** #4 Error paths (dependency failures are the most common production bugs), #7 Side effects (what should not happen really does not happen), #9 Security (when there are authn/authz boundaries).

**Add for high-risk SUTs:** when there is a DB write / payment flow / state machine, add #5 State transitions and #6 Concurrency.

**Add if there is capacity:** #2 Boundary, #10 Perf/scale, #12 Backward compat.

**Never skip because "there is not enough time":** #4 + #7 + #9 (when there is a security boundary).

### N/A Quality Gate

The following categories **must include a concrete reason** when marked N/A; if the reason is "could not think of one", it is not a valid N/A:

**never N/A without a concrete reason:** #2 Boundary, #4 Error paths, #7 Side effects, #9 Security.

| Category | Valid N/A (example) | Invalid reason |
|---|---|---|
| #2 Boundary | pure boolean flag, no quantity dimension | "did not think of one" / "API is not external" |
| #4 Error paths | pure function and no IO | "tried but do not know how to cause an error" |
| #7 Side effects | query-only, no DB write / event / outbound HTTP | "side effects should be fine, right?" |
| #9 Security | no authn/authz boundary and does not accept external input | "another layer already protects it" |

**Never N/A:** #1 Happy path. Without a happy path, there is no test baseline.

### Step 3 — Write each test

Each test **must** have:

1. **Behavior-descriptive function name**: `returns 401 when token is expired`, not `test1`
2. **Structured docstring**:

   ```
   <one sentence: what behavior is being verified>
   Steps:
   1. <prepare>
   2. <trigger>
   3. <verify>
   ```

3. **AAA visually separated into three parts** (Arrange / Act / Assert)
4. **Concrete assertion**: use `toBe(specific value)` / `toEqual({...})`, **not** `toBeTruthy` / `toBeDefined` as the main assertion
5. **Error path** asserts concrete error type + that the side effect really did not happen

**One scenario per test function.** Do not use table-driven tests to stuff multiple independent behaviors into one function (except pure function input/output mappings).

### Step 4 — Mutation self-test (before delivery)

For each core test, do **at least one**:

- Comment out one line of the implementation -> does the corresponding test fail?
- Flip a comparison operator (`>` ↔ `<`) -> does it fail?
- Remove the throw -> does the error path test fail?

**Any mutation that does not make the test fail = that test does not protect against that mutation**, so add coverage.

### Step 5 — Pre-delivery self-checklist

- [ ] Every test has a behavior-descriptive name + structured docstring
- [ ] Every test passes when run on its own (does not depend on execution order)
- [ ] No `sleep` / `setTimeout` used as a synchronization mechanism
- [ ] No `os.Chdir` / `process.chdir` / changing global `process.env` (use restorable mechanisms such as `t.Setenv`)
- [ ] No mocking of the SUT's own helper / pure function (mocking stops at external boundaries)
- [ ] Error path asserts concrete error type, not unspecified `toThrow()`
- [ ] Also verified that side effects "really do not happen when they should not happen"
- [ ] Assertions use concrete hard-coded values, not implementation formulas to compute expected values
- [ ] Mutation self-test has been done for core tests
- [ ] Green across 3 consecutive runs

### Step 6 — Delivery report

Proactively state:
- I chose the **layer**: unit / integration / contract / E2E + reason
- Which categories I covered; which were **intentionally N/A** + reasons
- Which mutation self-tests I performed

---

## 2. Task Variants

### 2.1 Adding tests for existing code

Additional rules:
- **Do not write tests to accommodate the existing implementation**; that freezes a bug as a spec
- List every SUT branch (if / switch / try-catch / early return / async error path), at least one test per branch
- If the SUT logic is unclear, **ask a person first**; do not make assumptions yourself

### 2.2 Bug regression test

1. **First write a failing test that reproduces the bug** (red)
2. Fix the SUT and see green
3. Think about the bug's "neighbors": could the same root cause create a similar bug at another entry point? Add tests for those neighbors too
4. Test name / docstring references the issue / commit

### 2.3 Reviewing tests written by others / other agents

Stance: **pessimistic reviewer**.

- ✗ Name is `test 1` / `should work` / no docstring → reject
- ✗ Only happy path → add boundary / negative / error categories
- ✗ `toBeTruthy` as the main assertion → change to concrete value
- ✗ Mock covers the SUT's own logic → move the mock to an external boundary
- ✗ `sleep` / shared mutable state / cwd dependency → rewrite
- ✗ Table-driven test stuffs independent scenarios → split into multiple functions

For each test, **mentally run mutation**: "If the implementation's `>` is changed to `>=`, will this test fail?" If the answer is no, reject it.

---

## 3. When to Read Reference Files

| What you are doing | Read |
|---|---|
| Unsure which test layer to use | `TEST-STRATEGY.md` §1–§2 |
| Designing CI / environment policy / coverage threshold / flakiness policy | `TEST-STRATEGY.md` §3–§7 |
| Stuck on concrete sub-cases for a category | the corresponding section in `TEST-CATEGORIES.md` |
| See a smell in a test and want to confirm whether it is an anti-pattern | `ANTI-PATTERNS.md` |
| Need good vs bad code comparisons | `EXAMPLES.md` |
| Want to understand the why behind the principles | `PRINCIPLES.md` |

**Do not read them when unnecessary** — this AGENT.md already covers 80% of tasks.
