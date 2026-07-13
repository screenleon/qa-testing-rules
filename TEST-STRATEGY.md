# Test Strategy — Layers, CI, environment, coverage, flakiness

`TEST-CATEGORIES.md` answers "**which scenarios to test**"; this file answers "**at which layer / when to run / how to route**". The two dimensions are orthogonal.

---

## §1. Four test layers

| Layer | Speed | Realism | Primary use | Not suitable for |
|---|---|---|---|---|
| **Unit** | ms | low | pure logic, transforms, calculations, state transitions, complex error branches | system boundary interaction, cross-service collaboration |
| **Integration** | s | high | DB, API handler, queue consumer, cache, external client adapter | pure logic (unit is faster), cross-service contracts |
| **Contract** | s | medium | cross-service / cross-team schema / payload / event contracts | any SUT internal behavior |
| **E2E** | 10s+ | highest | small number of full-chain smoke tests for critical business flows | boundaries, error branches, combinatorial explosion |

### 1.1 Unit
- Almost no mocking — unless collaboration itself is the subject under test
- Do not mock language/runtime built-ins (for example `Array.prototype.map`)
- Do not snapshot giant objects

### 1.2 Integration (the primary layer in mature teams)
Run **real infrastructure in containers** (testcontainers / docker-compose). One real integration test often beats ten over-mocked "unit tests".

### 1.3 Contract
- Contracts are **versioned** (v1, v2...), not "whatever they happen to look like right now"
- Provider verifies compatibility with old contracts before release
- Consumer writes tests against the **expected contract**, not against "the other side's actual response today"

#### Consumer-Driven Contract Testing (Pact pattern)

Traditional contract tests let the provider define the contract and consumers align by documentation; once documentation expires, the link breaks. Consumer-Driven Contract Testing reverses the direction:

1. **Consumer** writes tests in its own repo describing "what I expect the provider to return"
2. After consumer tests run, they generate a **Pact file** (JSON contract)
3. **Provider** CI uses this Pact file to verify its own API
4. If a provider change breaks any consumer's Pact, CI turns red

Tools: JS/TS use `@pact-foundation/pact`; Go uses `github.com/pact-foundation/pact-go`; multiple consumers use Pact Broker / PactFlow for management.

This is not a requirement to "fully adopt Pact". When there is only one consumer, a versioned OpenAPI schema + provider-side validation test is usually enough. Pact is worth introducing when: **≥ 2 consumers and independent deployment cycles**.

### 1.4 E2E (small number)
**Use only for 5-10 critical flows:** login / checkout / core CRUD / permission boundary / deploy smoke.

Do not: cover every permutation, bind to unstable UI details, use E2E as the primary source of confidence.

> Hundreds of brittle E2E tests usually mean other layers are underdeveloped.

### 1.5 Writing the few E2E tests well

Keeping E2E *few* is half the policy; the other half is keeping them *non-brittle*:

- **Selectors:** target what the user perceives — role/label (`getByRole('button', { name: 'Checkout' })`) or a dedicated `data-testid`. Never CSS chains (`div.col > span:nth-child(3)`) — they break on every markup change while catching no bugs.
- **Network boundary:** your own backend is real (that is the point of E2E); **third-party services are stubbed** (payment provider sandbox / mocked webhook) — otherwise their downtime is your flake.
- **Auth:** log in once per worker via API, persist storage state, and reuse it. Logging in through the UI in every test makes the login page the most-tested feature and the slowest suite.
- **Each test creates its own data** through API/seed hooks; never depend on "the staging database happens to have user X" (`ANTI-PATTERNS.md` §5 at E2E scale).
- **Waiting:** web-first assertions / `waitFor` conditions, never fixed sleeps — Red Line #3 applies doubly here.

**UI-layer supplements (separate suites, not inside functional E2E):**

| Suite | Tool & policy |
|---|---|
| **Visual regression** | screenshot-diff (Playwright snapshots / Chromatic) only for **stable, design-system-level** components; review every diff like a golden file (`LEGACY-TESTING.md` §4) — blind `--update` is snapshot rot |
| **Accessibility** | axe-core scan (`@axe-core/playwright` / `jest-axe`) on critical pages as a CI gate for mechanically detectable violations; a clean scan does not replace manual/assisted review → `ACCESSIBILITY-TESTING.md` |

---

## §2. Which layer should you choose?

```
1. Pure logic (no IO)?                    → Unit
2. Interacts with infrastructure you own? → Integration (preferred)
3. Cross-service / cross-team boundary?   → Contract
4. "If broken, users cannot complete the core goal"? → Add one E2E (no more than 5-10)
```

**Default stance:** when both unit and integration can verify it -> **integration**, unless:
- SUT is a pure function -> unit is faster and sufficient
- Testing complex calculations / state combinations that require many inputs quickly

> The "test pyramid" is a 2009 worldview. Testcontainers can start Postgres in seconds — the pyramid is gradually becoming a trapezoid / trophy shape: integration is widest, unit protects pure logic, and E2E stays thin at the top.

---

## §3. CI routing strategy

| Lane | Trigger | Runs | Goal |
|---|---|---|---|
| **Fast** | every PR push | lint + type + unit + fastest integration + cheap security | tell whether the PR is obviously broken **within 5 minutes** |
| **Confidence** | merge to main | full integration + contract + migration + core E2E | protect main from regression |
| **Deep** | nightly / scheduled | full E2E + perf baseline + chaos + cross-version compatibility | slow but deep confidence |

**Do not:** put E2E in the PR fast lane (PR authors wait 30 minutes every time -> build `--no-verify` muscle memory); write every lane into the same yaml job; ignore nightly failures.

---

## §4. Environment policy

| Stage | Runs |
|---|---|
| Local | unit + integration related to the module being changed |
| PR CI | unit + focused integration + smoke E2E (< 2 minutes) |
| Merge / main | broader integration + contract + core E2E |
| Nightly | full E2E + slow + migration + resilience |
| Pre-release | rollback rehearsal + production-like smoke + alert sanity + canary validation |

> Testing is not a wall; it is **a sequence of confidence gates with increasing cost**.

---

## §5. Test data strategy

**Prefer:**
- Factory / Builder: `makeUser({ role: 'admin' })`, omitted fields have reasonable defaults
- Small and clear fixture: explicit intent (`expiredTokenFixture`, not `fixture42.json`)
- Test owns its own seed
- Disposable environment: transaction rollback / per-test schema / per-test container

**Reject:**
- Mutable fixture shared across suites
- Giant "typical" dataset (200-line `mockUser.json`)
- Production data dump (PII, compliance, missing corner cases)
- Seed that depends on external sandbox (not reproducible)

**Custom matchers:** extract only when the same assertion pattern appears **3+ times**, to avoid premature abstraction.
```js
expect(graphA).toEqualGraph(graphB);
expect(response).toBeAuthorizedFor('admin');
```

---

## §6. Coverage philosophy

**Coverage is a weak signal, not proof of quality.**

| Use for | Do not use for |
|---|---|
| finding obviously untested areas | proving quality |
| preventing critical module regression (set a floor for critical path) | rewarding test quantity |
| guiding review conversations | forcing one uniform threshold on every package regardless of risk |

**Track these more than coverage:**
- **Mutation score** (PIT, Stryker): what % is caught when the implementation is broken
- **Flake rate**: flaky proportion and repair time
- **Mean time to red signal**: commit -> CI red
- **Time-to-fix flaky test**

### 6.1 Automating mutation testing

`AGENT.md` Step 4's manual mutation self-test is per-change discipline; it does not scale to a whole codebase. Automate it:

| Language | Tool |
|---|---|
| JS / TS | [Stryker](https://stryker-mutator.io/) |
| Java / Kotlin | [PIT](https://pitest.org/) |
| Python | mutmut / cosmic-ray |
| Go | gremlins / go-mutesting |
| Rust | cargo-mutants |
| C# | Stryker.NET |

**CI placement (maps to §3 lanes):**
- **PR lane: incremental mode only** — mutate only the lines changed in the diff (Stryker `--incremental`, PIT `--targetClasses` on the diff). Full-codebase runs take hours; never put them in the PR lane.
- **Nightly / deep lane:** full run on critical modules; publish the score trend.

**Reading the score:**
- Set a **floor on critical modules** (e.g. payments ≥ 80%), not one global threshold — same philosophy as coverage above.
- A surviving mutant means "if a developer made exactly this mistake, no test would notice." Triage it like a missing-test report: add the test, or consciously accept the gap.
- **Equivalent mutants** (mutations that don't change observable behavior) are noise — mark them ignored in tool config rather than writing contorted tests to kill them. They typically cap real-world scores around 85–95%; **do not chase 100%**.

---

## §7. Flakiness policy

**A flaky test is a defect.** Tolerate it once, and the whole team learns to ignore red lights.

**Policy (recommended for team standards):**
1. Treat flaky test as a **bug ticket** and open it immediately
2. Flake N consecutive times (for example 3 times) -> **automatic quarantine** (isolated but visible)
3. Quarantine is **time-bound** (for example 7 days); delete if not fixed by expiration
4. Review flake rate weekly / monthly
5. Allow retries only for detection, classification, or temporary containment. A retry-pass must remain visibly **FLAKY**, with owner, ticket, first-seen date, expiry/review date, and diagnostic artifacts; it is not a clean pass or a fix.

**Order for fixing flaky tests:**
1. Find the root cause (time / concurrency / shared state / real IO)
2. Run locally 100 times to confirm reproducibility
3. Refactor to determinism (fake clock / deterministic event / isolated state)
4. Run a risk-appropriate repeated-run count (100 is a recommended high-confidence example) green -> considered fixed
5. **Do not "fix" by increasing timeout / adding sleep**

---

## §8 One-sentence summary

- **Layers**: unit for pure logic / integration as the main force / contract for service boundaries / E2E only for critical flows
- **CI**: fast / confidence / deep lanes; send the right signal to the right stage
- **Environment**: if it can run locally, do not throw it to CI; if it can run in CI, do not wait for nightly
- **Data**: factory > fixture > dump; test owns its own seed
- **Coverage**: weak signal; watch mutation and flake rate
- **Flakiness**: defect; retries may classify it but must not hide it
