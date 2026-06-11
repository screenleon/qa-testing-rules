# LLM Testing — Testing SUTs that call an LLM

> Applies when the SUT contains an LLM call (chat completion, agent loop, RAG pipeline, classification-by-prompt). Read this when the standard rules collide with non-deterministic output.
>
> The 12 categories in `TEST-CATEGORIES.md` still apply. What changes is **how you assert**, **where you run**, and **what "green" means**.

---

## §1. Split the SUT: deterministic shell vs non-deterministic core

Most "LLM features" are 80% deterministic code wrapped around one non-deterministic call. **Test the two parts differently.**

| Part | Examples | How to test |
|---|---|---|
| **Deterministic shell** | prompt construction, context truncation, tool dispatch, output parsing, retry/fallback logic, guardrails | Normal rules apply: unit / integration, concrete assertions, mutation self-test. **Mock the LLM API — it is an external boundary (Red Line #2 allows this).** |
| **Non-deterministic core** | "does the model produce a good answer for this input" | Eval suite (§3) with statistical assertions (§4), not regular CI tests |

**Most common mistake:** writing one "end-to-end" test that hits the live API to verify prompt construction. Split it: assert the exact prompt string with a mocked client (deterministic), and evaluate answer quality separately (eval suite).

```ts
// Deterministic shell test — LLM client mocked at the boundary
test('includes the 5 most recent orders in the prompt context', async () => {
  const llm = fakeLLMClient({ reply: 'irrelevant' });
  const svc = new SupportAgent(llm, db);
  await seedOrders('u1', 8);

  await svc.answer('u1', 'where is my package?');

  const prompt = llm.lastRequest().messages;
  expect(countOrderBlocks(prompt)).toBe(5);          // truncation rule is the spec
  expect(prompt).not.toContain('credit_card');        // PII guardrail (category #13)
});
```

---

## §2. Assertion ladder — use the strongest rung that holds

Prefer the top; descend only when the output genuinely cannot be pinned down.

| Rung | Assertion | When it holds |
|---|---|---|
| 1 | **Exact match** | structured output (JSON mode / tool call / enum classification) with `temperature=0` |
| 2 | **Schema / structural** | output must parse as a schema; required fields present, types correct |
| 3 | **Property / invariant** | "answer cites only provided documents", "summary shorter than input", "no URLs outside allowlist" |
| 4 | **Contains / regex anchor** | a specific fact must appear ("refund window is 30 days") regardless of phrasing |
| 5 | **Semantic similarity** | embedding distance to a reference answer above threshold |
| 6 | **LLM-as-judge** | open-ended quality (helpfulness, tone) — last resort, see §5 |

**Do:** force structured output wherever possible (tool calls, JSON schema) — it moves you to rungs 1–2 where normal testing rules work again.
**Do not:** assert exact strings of free-form text. That is the LLM equivalent of snapshot rot (`ANTI-PATTERNS.md` §11): the first model upgrade turns everything red without any real regression.

---

## §3. Eval suite — the golden dataset is the spec

For the non-deterministic core, the unit of testing is not "a test function" but **a dataset of (input, expected-judgment) pairs + a scoring function**.

- **Curate from reality:** seed with real (anonymized) production queries and known failure cases, not invented examples. Every production incident adds a row — same rule as bug regression tests (`AGENT.md` §2.2).
- **Size:** 20–50 rows catches gross regressions; statistical confidence needs 100+. Start small, grow from incidents.
- **Keep eval data out of the prompt.** If a golden example leaks into few-shot examples or fine-tuning data, the eval measures memorization, not capability.
- **Version the dataset** alongside the prompt. A prompt change PR must show the eval diff, like a snapshot review.

**Where it runs (CI routing, extends `TEST-STRATEGY.md` §3):**

| Lane | What runs |
|---|---|
| PR fast lane | deterministic shell tests only (mocked LLM) — **never live API calls** (cost, latency, flakiness) |
| Merge / nightly | eval suite against the real model, with pass-rate thresholds |
| Pre-release / model upgrade | full eval suite + side-by-side comparison old vs new model/prompt |

---

## §4. Statistical assertions — "green" is a threshold, not 100%

A single eval row may legitimately fail 1 run in 20. Asserting "always passes" makes the suite flaky; asserting nothing makes it useless.

- Run each row **N times** (or the whole set once per run across N scheduled runs) and assert **pass-rate ≥ threshold** (e.g. ≥ 95% overall, 100% for safety-critical rows).
- **This is not the flakiness exemption.** `PRINCIPLES.md` §3 still holds for everything deterministic: shell tests, parsing, guardrails. Only the model's open-ended output gets statistical treatment, and the threshold is explicit and reviewed — not a hidden `retry: 3`.
- Track the pass-rate trend. A drop from 98% → 91% with green CI is a regression; alert on trend, not only on threshold breach.

---

## §5. LLM-as-judge — calibrate before trusting

Using a model to grade another model's output is legitimate for open-ended quality, but **an uncalibrated judge is an always-passing test** (`ANTI-PATTERNS.md` §4).

1. **Calibrate:** human-label 20–30 outputs, run the judge on them, require ≥ 90% agreement before the judge gates anything.
2. **Binary or small rubric** (pass / fail / specific defect), not a 1–10 score — scores drift, judgments are checkable.
3. **Judge prompt is code:** version it, and re-calibrate when it or the judge model changes.
4. **Mutation self-test the judge** (`AGENT.md` Step 4): feed it a known-bad output — does it fail it? If not, the judge protects nothing.

---

## §6. What the 12 categories mean for an LLM SUT

| # | Category | LLM-specific reading |
|---|---|---|
| 2 | Boundary | context-window overflow, empty input, 1-token input, max-length output truncation |
| 3 | Negative inputs | prompt injection ("ignore previous instructions"), jailbreak attempts, non-target language, HTML/markdown smuggling |
| 4 | Error paths | API timeout / 429 / 5xx → retry policy, fallback model, degraded answer; **assert the user-visible behavior, not just "it retried"** |
| 6 | Concurrency | parallel tool calls, streaming cancellation mid-response |
| 7 | Side effects | agent tool calls: the dangerous tool was **not** called when it should not be (mock tools, assert call list) |
| 9 | Security | system-prompt extraction, cross-tenant data in RAG context, PII echoed back |
| 10 | Perf / scale | token cost budget per request, p95 latency budget — assert against an explicit budget, fail on 2x cost regression |
| 11 | Contract | structured output schema is the contract; version it like any API |

---

## §7. Anti-patterns specific to LLM testing

- ✗ **Live API in the PR lane** — slow, costly, flaky; mock the boundary
- ✗ **Exact-string assertions on free text** — snapshot rot with extra cost
- ✗ **Uncalibrated LLM-as-judge** — always-passing test wearing a lab coat
- ✗ **Eval examples leaked into the prompt** — measures memorization
- ✗ **"It worked when I tried it"** — n=1 sampling of a distribution is not a test
- ✗ **Ignoring cost/latency** — a prompt change that triples token usage is a regression even if quality holds
