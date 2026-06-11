# Legacy Testing — Adding tests to untested code

> Applies when: the SUT exists, has no (trustworthy) tests, and you must change it — refactor, bug fix, or new feature on top. Read this together with `AGENT.md` §2.1.
>
> Greenfield rules assume you know the spec. Legacy work has a harder problem: **nobody knows the spec anymore; the code is the only witness.**

---

## §1. Characterization tests — freeze current behavior first

A **characterization test** asserts what the code **does today**, not what it should do. It exists so you can refactor without silently changing behavior.

**Workflow:**

1. Write a test with a deliberately wrong expected value: `expect(fee(100)).toBe(-999)`
2. Run it → red. The failure message shows the **actual** current behavior
3. Copy the actual value into the assertion → green
4. **Label it** so nobody mistakes frozen behavior for verified spec:

```js
/**
 * CHARACTERIZATION — captures current behavior as of 2026-06; NOT a verified spec.
 * fee(100) currently returns 12.5. If this looks wrong to you, it might be:
 * confirm with product before "fixing" either the code or this test.
 */
test('[characterization] fee(100) returns 12.5', () => {
  expect(fee(100)).toBe(12.5);
});
```

**Resolving the tension with `AGENT.md` §2.1 ("do not freeze a bug as a spec"):**

| | Bad freeze | Characterization |
|---|---|---|
| Intent | "this is correct" | "this is what it does — pinned so refactoring can't silently change it" |
| Label | none — looks like a spec test | explicitly marked `[characterization]` + docstring |
| Lifecycle | permanent | **scaffolding**: each one is either promoted to a spec test (behavior confirmed correct) or becomes a bug ticket (behavior confirmed wrong) |

A characterization test that finds suspicious behavior is a **success**: you found a latent bug before refactoring buried it deeper. File it; do not silently "correct" the behavior mid-refactor.

**Coverage target:** every branch of the code **you are about to change** — not the whole module. Use the change as the scope (see §4).

---

## §2. Seams — getting untestable code under test without refactoring it first

Legacy code resists testing because dependencies are hard-wired (`new Database()` inside the function, global config, static calls). A **seam** is a place where you can alter behavior without editing the code under test. Find the cheapest seam; do not start with a grand refactor — you have no tests yet to protect it.

| Seam | Technique | Cost |
|---|---|---|
| **Parameter seam** | the dependency is already a parameter — just pass a fake | free |
| **Constructor / setter** | add an optional injected dependency, defaulting to the current hard-wired one | low, backward compatible |
| **Extract-and-override** | wrap the hard-wired call in a protected method; test subclass overrides it | low, slightly ugly — acceptable scaffolding |
| **Link / module seam** | module mocking (`jest.mock`), monkeypatching at import boundary | low, but couples test to module path |
| **Environment seam** | config / env var switches the dependency | use `t.Setenv`-style restorable mechanisms only (`ANTI-PATTERNS.md` §13) |

Red Line #2 still applies: the seam must sit at an **external boundary** (DB / network / clock / filesystem). Carving a seam through the SUT's own logic to make testing "easier" produces over-mocked tests (`ANTI-PATTERNS.md` §3).

---

## §3. Sprout and wrap — adding features to untested code

When adding behavior to a function you cannot yet test:

- **Sprout:** write the new logic as a **new, fully-tested function**; the legacy function gains only a one-line call. New code meets full `AGENT.md` standards even if the host doesn't.
- **Wrap:** create a new function that calls the legacy one and adds behavior before/after; callers move to the wrapper. Use when the new behavior surrounds rather than sits inside.

Both contain the untested zone instead of growing it. **Do not** inline new logic into a 300-line untested function "because it's just a few lines" — that is how the function got to 300 lines.

---

## §4. Approval testing — golden files done right

For outputs too large to hand-assert (rendered documents, generated SQL, report files), **approval tests** compare against a reviewed golden file. This is the legitimate version of snapshots — `ANTI-PATTERNS.md` §11 describes the degenerate form. The difference is discipline:

- **Scrub non-determinism before comparing:** timestamps, UUIDs, hostnames, ordering → normalize or mask, or the test is flaky by construction
- **The golden file is reviewed code:** updating it requires reading the diff and explaining the change in the PR — never blind `--update`
- **Scope to semantically stable output:** a generated invoice PDF's text layer, not a UI pixel dump that changes with every CSS tweak
- **One golden file per behavior**, named by intent (`invoice_with_discount.approved.txt`), not `output1.txt`

If you cannot articulate what a golden-file diff would *mean*, use concrete assertions on extracted fields instead.

---

## §5. Prioritization — cover the blast radius, not the codebase

You will not retrofit tests for everything. Order of attack:

1. **The lines you are changing** — characterization on every affected branch, before touching anything
2. **The bug's neighbors** — same root cause, other entry points (`AGENT.md` §2.2)
3. **High-traffic / high-damage paths** — payments, auth, data deletion: risk-based priority (`AGENT.md` Step 2) applies to retrofitting too
4. Everything else: leave it; opportunistic coverage when you next touch it

---

## §6. Agent workflow for "add tests to legacy code"

1. Identify the **change scope** (which functions/branches will the diff touch)
2. Find the **cheapest seam** (§2) for each hard-wired dependency — record which seams you introduced
3. Write **characterization tests** (§1) for every affected branch; label them
4. Anything suspicious found → **report it, don't fix it silently**; ask a person (per `AGENT.md` §2.1)
5. Now make the change; characterization tests catch unintended behavior shifts
6. **Promote or retire:** tests covering behavior the change intentionally altered get rewritten as spec tests with the new expected values; confirmed-correct characterization tests get relabeled as spec tests
7. Run the standard `AGENT.md` Step 4–6 (mutation self-test, checklist, delivery report) on the final state
