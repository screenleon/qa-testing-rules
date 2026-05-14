# Anti-Patterns — 17 testing anti-patterns

> Each entry: **symptom → why bad → fix**. After writing tests / when reviewing others' tests, grep and compare against this.

---

## 1. Happy-path-only

**Symptom:** A SUT has only one test: feed normal input, assert normal output.
**Why bad:** 99% of bugs live in boundaries / errors / invalid input; this kind of test pushes coverage to 70% but catches no real bugs.
**Fix:** Go through the 12-category enumeration in `TEST-CATEGORIES.md`; every SUT should have at least happy + boundary + negative + error categories.

## 2. Testing implementation details

**Symptom:** Asserting that "`UserService` internally calls `cache.get` three times" or that private `_normalize` is called.
**Why bad:** During refactor, tests break heavily but **catch no bugs** — tests are obstructing improvement instead of protecting correctness.
**Fix:** Prefer black-box (give input / observe output / observe side effect). Verify interactions only when "the interaction itself is the spec" (example: "placing an order must emit an OrderPlaced event").

## 3. Over-mocking

**Symptom:** Mocking every dependency of the SUT (including helpers called by the SUT itself). In the end, the test only verifies that mocks were called as expected.
**Why bad:** If mocked-out things have bugs, tests will never see them. Extreme case: the whole implementation is deleted and tests still pass.
**Fix:**
- Mocking **stops at external boundaries** (DB / network / time / filesystem / third-party SDK)
- The SUT's own helper / pure function: **do not mock**
- Prefer fake / in-memory implementation over mock

## 4. Always-passing tests

**Symptom:** Async assertion is not `await`ed, callback is never called, assertion method name is misspelled -> assertion never runs.

```js
// Bad: promise is not awaited
test('user is created', () => {
  service.create(input).then(u => expect(u.id).toBeDefined());  // never awaited
});
```

**Why bad:** Looks green, actually unprotected.
**Fix:**
- Async tests must `await`
- After writing, intentionally break the implementation to verify the test fails (mutation self-test)
- Use `expect.assertions(n)` to ensure at least n asserts ran

## 5. Order-dependent tests

**Symptom:** Test A creates data, test B queries data, test C modifies data. Running B alone fails.
**Why bad:** Random failures under parallel / sharded execution, cannot reproduce when debugging alone, adding tests breaks another seemingly unrelated test.
**Fix:** Each test sets up all prerequisite state it needs and cleans up after itself. Fixture / transaction rollback / independent schema per test.

## 6. Shared mutable state

**Symptom:** Shared module-level variables / global singleton / cache not reset.
**Why bad:** One test changes state, the next sees polluted state — a classic source of flakiness.
**Fix:** Reset in `beforeEach`; do not share via `beforeAll`.

## 7. Time / async flakiness

**Symptom:**
- `setTimeout(() => expect(...), 100)` to wait for callback
- `await sleep(500)` to wait for race resolution
- Direct use of `new Date()` / `Date.now()`, breaking across day / timezone transitions

**Why bad:** Sleep is too fast on fast machines and too slow on slow machines; timezone changes alter semantics.
**Fix:**
- Inject time (clock abstraction) -> use fake clock in tests
- Use deterministic event (promise resolve / event emitter / queue drain) instead of sleep
- If you truly need to wait: use `waitFor(condition, timeout)`, but the condition must be **repeatably checkable**

## 8. Network / external IO in unit tests

**Symptom:** Unit test hits production API, connects to external DB, reads `~/.config`.
**Why bad:** Slow, unstable, depends on external availability, may modify someone else's data.
**Fix:** Unit / component: mock / fake external boundary. Integration: use testcontainers / docker-compose. E2E: only there touch the real chain.

## 9. Assertion duplicates production logic

**Symptom:**
```js
const expected = items.reduce((s, i) => s + i.price * i.qty, 0);  // same as implementation
expect(calculateTotal(items)).toBe(expected);
```

**Why bad:** This is "implementation computes once" compared with "implementation computes once". If the implementation formula is wrong, expected is wrong too, and the test still stays green.
**Fix:** Use **manually calculated, hard-coded concrete values**:
```js
const items = [{ price: 100, qty: 2 }, { price: 50, qty: 3 }];
expect(calculateTotal(items)).toBe(350);  // 100*2 + 50*3
```

## 10. God test

**Symptom:** One test has three screens of setup, five acts, twenty assertions, and is named `test full flow`.
**Why bad:** When it fails, you cannot tell which part broke; changing one small behavior requires changing the whole test; newcomers are afraid to touch it.
**Fix:** Split into multiple tests, one concept each. Extract shared setup into fixtures.

## 11. Snapshot rot

**Symptom:** Snapshot tests are updated with one `--update` command, nobody reads the diff, and after a few months nobody knows what they protect.
**Why bad:** Snapshot becomes "freeze current state" instead of "spec"; bugs can be updated as expected changes.
**Fix:**
- Limit snapshot to **stable outputs with clear semantics** (serialized DTO, accessibility tree)
- Do not snapshot the entire HTML / entire console output
- Updating snapshot must include **reviewing each diff item** in the PR and explaining the reason for the change
- Alternative: use concrete assertion (`expect(rendered.title).toBe('Welcome')`)

## 12. Table-driven stuffing of independent scenarios

**Symptom:** One test function runs 5-10 cases, but each case is an **independent behavior** (different setup / assertion pattern / error path).

```go
// Bad
for _, tc := range []struct{ name, in, expected string }{
    {"branch_default",         "merge",  "merge"},
    {"command_overrides",      "merge",  "rebase"},   // different scenario
    {"flag_overrides_command", "rebase", "merge"},    // different scenario
} {
    t.Run(tc.name, func(t *testing.T) { /* different setup */ })
}
```

**Why bad:** Failure messages are buried two levels deep in sub-tests; fixing one case may accidentally disturb shared setup; function names become vague; partial execution is harder.
**Fix:** One scenario, one function:
```go
func TestMergeStrategyBranchDefaultIsMerge(t *testing.T) { ... }
func TestMergeStrategyCommandConfigOverridesBranch(t *testing.T) { ... }
func TestMergeStrategyFlagOverridesCommandConfig(t *testing.T) { ... }
```

**Exception:** pure function input/output mappings (`validateEmail` / `parseVersion`), where each row is a different input with the same assertion pattern -> table-driven is acceptable.

## 13. Hidden cwd / env / global state dependency

**Symptom:** A test depends on `os.Chdir()` / `process.chdir()` to change directories, on some env var already being set, or on a global singleton already being initialized.

```go
// Bad: depends on global cwd state
os.Chdir(testRepoDir)  // global!
git.Checkout("develop")  // internal function finds repo via cwd
```

**Why bad:** Parallel tests immediately pollute each other; if defer does not run (panic / early return), later tests are polluted; CI and local cwd differ -> green on one side, red on the other.
**Fix:**
- Use functions that accept dir / config as parameters: `git.CheckoutInDir(dir, "develop")`
- Helper sets `cmd.Dir = testRepoDir` internally, so callers never need chdir
- For env changes, use `t.Setenv` (auto-restored) instead of `os.Setenv`

## 14. Test has no intent

**Symptom:** Name is `test 1` / `should work` / no docstring.
**Why bad:** When CI turns red, "test 1 failed" has no diagnostic value; reviewer / agent cannot understand the test without reading the implementation.
**Fix:** Full-sentence behavior description + structured docstring (see `PRINCIPLES.md` §10):

```js
/**
 * Returns 401 when access token is expired.
 * Steps:
 * 1. Issue token, fast-forward fake clock past expiry
 * 2. Call protected endpoint with that token
 * 3. Assert response.status === 401 and body.code === "TOKEN_EXPIRED"
 */
test('returns 401 when access token is expired', async () => { ... });
```

## 15. Trusting placeholder helper

**Symptom:** Using helpers such as `runGitFlow(t, dir, "init")`, but nobody verifies they actually executed the command — it may be a half-finished stub, modified later, or return early on an error branch.
**Why bad:** A specialized version of Anti-pattern #4, because helpers are a more hidden abstraction layer.
**Fix:**
- When helper fails, **`t.Fatalf` and print output** — any "did not run successfully" case should **explode instead of silently passing**
- Add a meta test: after calling the correct path, verify the side effect really exists
- Add a negative meta test: feed wrong parameters and confirm the helper really returns an error instead of swallowing it

```go
output, err := testutil.RunGitFlow(t, dir, "feature", "start", "x")
if err != nil {
    t.Fatalf("RunGitFlow failed: %v\nOutput: %s", err, output)  // include output for easier debug
}
```

## 16. Test doubles confusion: treating mock as a universal solution

**Symptom:** Every "I need to replace an external dependency" situation uses `jest.mock` / `when(...).thenReturn(...)` — regardless of whether it replaces network, helper, or pure function.

**Four types of test doubles (choosing wrong is costly):**

| Type | What it is | When to use | Common misuse |
|---|---|---|---|
| **Stub** | returns fixed values, does not verify interaction | let dependency return "the data I need" | verifying how many times the stub was called (stubs should not verify calls) |
| **Mock** | verifies interaction (call count / parameters) | when "the interaction itself is the spec" (such as: must emit OrderPlaced event) | adding `.verify()` to every stub |
| **Fake** | lightweight real implementation (in-memory DB, fake queue) | need real semantics but do not want to start a real service | avoiding fake because it seems more troublesome than mock |
| **Spy** | wraps real implementation + records interaction | real behavior should run, but side effects need observation | replacing real logic with spy (turning it into a mock) |

**Why bad (cost of choosing the wrong double):**
- Mock verifies interaction -> many tests break during implementation refactors, but no bugs are caught (tests obstruct improvement)
- Stub used to verify "how many times it was called" -> makes stub carry mock responsibilities, confusing semantics
- All dependencies use mocks instead of fakes -> real semantics are missed (assuming an in-memory set behaves like the real DB, which is not true)

**Fix:**
```
Ask yourself: "Is the interaction itself the spec (must be called), or an implementation detail (can change)?"
- Interaction is spec -> Mock (verify call)
- Interaction is detail -> Stub / Fake (only needs correct return value)
- Need real semantics -> Fake
- Need real implementation to run but want to observe -> Spy
```

**Go syntax hint:**
```go
// Fake (in-memory repo with real behavior)
type fakeOrderRepo struct { orders map[string]Order }
func (r *fakeOrderRepo) Save(o Order) error { r.orders[o.ID] = o; return nil }
func (r *fakeOrderRepo) FindByID(id string) (Order, error) {
    o, ok := r.orders[id]
    if !ok { return Order{}, ErrNotFound }
    return o, nil
}
// -> closer to reality than mock; tests do not break during refactor
```

## 17. Over-specification: verifying interaction details instead of behavior results

**Symptom:**
```js
// Verifies "first call uses 200ms TTL, second uses 500ms TTL, called three times total"
expect(cache.set).toHaveBeenNthCalledWith(1, 'key', value, { ttl: 200 });
expect(cache.set).toHaveBeenNthCalledWith(2, 'key', value, { ttl: 500 });
expect(cache.set).toHaveBeenCalledTimes(3);
```

**Why bad:** This tests "how I implemented it" instead of "what behavior I provide". As soon as the cache strategy changes slightly (TTL merge, batch write), the test turns red — but users feel no difference.

**Judgment standard:** If you explain this assertion to a product manager and they say "so what?" -> this assertion is testing implementation details.

**Fix:** Move assertions to **observable behavior** (results users can feel):
```js
// Verify behavior: querying the same key again within TTL hits cache (behavior is correct)
const first = await service.getProduct('sku1');
const second = await service.getProduct('sku1');  // should hit cache

expect(second).toEqual(first);           // return value is the same (behavior is correct)
expect(apiClient.fetchProduct).toHaveBeenCalledTimes(1);  // only one API call (observable)
```

**Exception:** "the interaction itself is the spec" — `OrderPlaced` event **must** be emitted once (more than once = bug) -> verifying call count is valid. Judgment standard: "Does calling fewer / more times change user behavior?" If yes -> verify; if no -> do not verify.

---

## Reviewer Red Flag Checklist (30-second scan)

- ✗ Test names are all `should work` / `test 1` / `happy case`
- ✗ Tests only contain `toBeTruthy` / `toBeDefined`
- ✗ Mocks outnumber real code
- ✗ `test.skip` / `xit` / `only` appears on the main branch
- ✗ Retry mechanisms (`jest --retry` / `flaky: true`)
- ✗ Commit message says "fix flaky test" but diff adds sleep / changes timeout
- ✗ PR adds 200 lines of implementation but only 1 test
- ✗ Every table-driven case is a different behavior
- ✗ Test imports `internal/` package directly — should go through testutil helper
- ✗ See `os.Chdir` / `process.chdir` / `os.Setenv` instead of `t.Setenv`
- ✗ Helper failure only `t.Log`s and does not `t.Fatal`
