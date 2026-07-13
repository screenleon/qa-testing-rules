# Test Design — selecting high-value cases from a large input space

> The 12 categories in `AGENT.md` identify risk dimensions. This guide selects efficient cases within those dimensions. Choose techniques by context and risk; do not blindly enumerate combinations.

## 1. Match the technique to the SUT

| SUT characteristic | Primary technique | Typical result |
|---|---|---|
| Many values in a range | equivalence partitioning + boundary analysis | one representative per partition plus edges |
| Several conditions determine an outcome | decision table | one case per meaningful rule |
| Browser × role × region × flag combinations | pairwise or t-way combinatorial | reduced interaction set plus risk cases |
| State and event order matter | state-transition or model-based | valid and invalid transitions |
| No single expected output | metamorphic relations | output changes predictably after input transformation |
| Trusted old version or simple model exists | differential testing | implementations agree on generated cases |
| Specs are incomplete or risk unknown | exploratory charter | discoveries become tests or decisions |
| Need evidence of discrimination | mutation testing | known simulated fault is detected |

Techniques complement one another. Pairwise coverage does not replace privilege-boundary cases; mutation does not prove requirements; a decision table does not replace exploratory work.

## 2. Core techniques

### Equivalence partitions and boundaries

Partition inputs by behavior, then choose one representative from each partition and values just below, on, and above each threshold. A quantity with a maximum of 100 normally needs 99, 100, and 101, not every number from 0 to 100.

### Decision tables

Use a table when several booleans or categorical conditions jointly determine an outcome. State the policy rules first, then make every meaningful rule observable in a test. This prevents tests from accidentally following implementation order rather than the business policy.

### Pairwise and t-way combinations

Do not blindly run all combinations. For example, `role × region × feature flag × client × account state` may produce 108 cases. Generate pairwise or risk-selected t-way coverage, then manually add:

- security and privilege boundaries;
- combinations implicated by incidents;
- regulated or high-damage paths;
- known compatibility constraints.

Record the generator, strength, parameters, exclusions, and manually added cases so a future change can update the set deliberately.

### State-transition and model-based testing

Write states and legal transitions before tests. Test each legal transition, each relevant illegal transition, no unintended side effect on rejection, and idempotency/retry behavior where applicable. For complex state machines, generate event sequences from a small trusted model.

### Metamorphic and differential testing

Use metamorphic relations where an exact output is difficult but relationships are known: adding a filter cannot increase results; sorting twice equals sorting once; serialize then parse restores the same value. Use differential testing only against an independent trusted version/model; two implementations copied from the same logic are not independent evidence.

## 3. Exploratory testing is evidence discovery

Use a time-boxed charter when the design, integration behavior, or risk is unknown. Write the question, scope, data, observations, and follow-up. A finding must become one of: a requirement decision, a regression test, a characterization test, a contract update, or an explicitly accepted risk. A spike or exploratory observation is not a production specification by itself.

## 4. Design record

For non-trivial test selection, record:

```text
Risk: cross-tenant access under flag/config combinations
Technique: pairwise for ordinary combinations; manually added 3-way admin × EU × flag-on
Oracle: ASVS-v5.0.0-<requirement-id> + authorization policy
Fault check: inverted tenant comparison fails the rejection test
```
