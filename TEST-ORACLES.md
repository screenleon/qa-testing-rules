# Test Oracles — evidence provenance and AI-generated test governance

> Read this when writing, reviewing, or changing an assertion, snapshot, golden file, eval row, or test produced by an AI coding agent. This file governs **why an expected result is trustworthy**; it does not replace the layer and category workflow in `AGENT.md`.

## 1. Start with the oracle, not the assertion

A test can be executable, deterministic, and mutation-sensitive yet still preserve the wrong behavior. Before asserting an important result, identify the independent evidence that says the result is correct.

| Oracle source | Evidence | What it establishes |
|---|---|---|
| `requirement` | acceptance criterion, product decision, regulation | intended user or business behavior |
| `contract` | OpenAPI, JSON Schema, event schema, public API version | boundary compatibility |
| `invariant` | security rule, domain law, mathematical property | a rule that must always hold |
| `reference_model` | independent implementation or simplified trusted model | agreement with a separately reasoned model |
| `approval` | reviewed golden file or golden eval dataset | approved stable output |
| `characterization` | current implementation or runtime trace | current behavior only; not correctness |

**An LLM, agent, or code generator is not an oracle source.** It may help locate evidence, draft a test, or calculate a candidate, but “the agent says the answer is 105” is not evidence.

Likewise, an expected value copied from the implementation or an observed runtime result is `characterization`, not a verified specification.

## 2. Record provenance at the useful granularity

Do not add boilerplate metadata to every trivial assertion. Record it for important behavior, every approval artifact, and any test whose expected value is not self-evident. Put it in a nearby docstring, test metadata, or the PR's **Test evidence** section.

```yaml
test_evidence:
  oracle_source: contract
  source_ref: openapi/order-v2.yaml#/paths/~1orders/post
  status: verified_spec
  generated_by: agent
  fault_check: changed tenant comparison from == to !=; test failed
```

Allowed statuses:

- `verified_spec`: independently confirmed requirement, contract, invariant, reference model, or reviewed approval.
- `provisional`: a proposed behavior awaiting the named owner’s decision; do not present it as established correctness.
- `characterization`: pins observed current behavior during legacy work. It must be visibly labeled `[characterization]` and follow the lifecycle in `LEGACY-TESTING.md`.

## 3. Oracle changes are high-risk changes

The following changes need explicit evidence and review, even if production code changes beside them:

| Change | Default risk |
|---|---|
| Test helper, setup, non-semantic fixture | low to medium |
| Selector, transport mock, container setup | medium |
| Assertion expected value | high |
| Snapshot, golden file, approved eval row | high |
| Requirement or contract reference | high |
| Characterization promoted to specification | high |

When a PR changes production code and an assertion, snapshot, or golden value:

1. Link an independent requirement, contract, incident, or approved decision.
2. State the previous and intended behavior.
3. Show why the new expected value follows from that evidence.
4. Obtain a domain-owner review for high-risk behavior.
5. Never use “the new implementation returns this” as the justification.

Known approval paths such as `__snapshots__/`, `golden/`, and `*.approved.*` should require an `oracle-change-reviewed` label or equivalent human review gate. Do not attempt to infer oracle correctness with a linter.

## 4. Tests written or modified by AI agents

`LLM-TESTING.md` is about testing a **system that calls an LLM**. These rules are about tests written or changed by an AI coding agent.

An AI-generated test is acceptable only when all applicable gates pass:

1. **Buildable** — uses real APIs and compiles.
2. **Executable** — assertions run; it is not always passing.
3. **Deterministic** — isolated runs and repeat runs agree.
4. **Oracle identified** — expected behavior has independent provenance or is visibly characterization.
5. **Fault-sensitive** — a relevant mutation, known defect, or deliberately broken implementation makes it fail.
6. **Non-duplicative** — it covers a distinct behavior, not renamed existing coverage.
7. **Reviewed** — a human reviews assertion semantics, not merely green CI.
8. **Measured** — teams track accepted, materially edited, removed, and surviving-mutant tests where practical.

Coverage, a first-run pass, and a green build are useful filters; none proves that the expected behavior is correct.

## 5. Choose test timing from oracle confidence

> Prefer test-first when the intended behavior and oracle are known. When either is unknown, establish the oracle first.

| Work | Default timing |
|---|---|
| Known bug | regression test first: red → fix → green |
| New deterministic behavior | test-first when practical |
| API or event boundary | contract-first, then implementation |
| Untested legacy behavior | characterization-first, then confirm/promote or ticket |
| Unknown library or design | time-boxed spike; discard or isolate it, then restart from a known contract |
| Non-deterministic LLM quality | eval-first; use normal test-first for deterministic shell code |
| Performance change | benchmark/performance assertion first, then optimize |
| Security defect | exploit or reproduction test first, then fix |

For genuine test-first work, retain minimal evidence that the test was red for the intended missing/broken behavior, then green after the change. An import error or broken fixture is not a meaningful red phase.

## 6. PR template

```md
## Test evidence

- Test timing: test-first | characterization-first | contract-first | eval-first | test-after (justify)
- Oracle source and reference:
- Is any test characterization or provisional?
- Does this change an assertion, snapshot, golden, approved eval row, requirement, or contract?
- Fault check / known defect that proves the test can fail:
- Domain-owner review required and received:
```

## 7. What automation can and cannot decide

Semgrep can detect skipped tests, sleeps, focused tests, and some weak assertions. Mutation tools can measure sensitivity to selected simulated faults. Neither can determine whether an expected value follows from a requirement, whether a snapshot update is legitimate, or whether two tests cover the same concept. Those are evidence and review decisions.
