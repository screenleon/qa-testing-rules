# Generative Testing — Property-based, Fuzzing, Model-based

> Manual enumeration of boundaries and negative inputs (categories #2, #3) is never complete — you only test the cases you thought of. Generative testing produces hundreds or thousands of inputs automatically, checks an **invariant**, and **shrinks** any failure to the minimal counterexample. It is a complement, not a replacement: keep your hand-picked example tests (they document the spec); add generative tests where enumeration is hopeless.

## When to use

| SUT shape | Generative approach |
|---|---|
| Parser / serializer / codec | **Roundtrip**: `parse(format(x)) === x` for all valid `x` |
| Two implementations (new vs old, optimized vs naive) | **Oracle**: both produce identical output for the same input |
| Normalizer / sanitizer / migration | **Idempotence**: `f(f(x)) === f(x)` |
| Calculation with algebraic structure | **Invariant**: `splitAmount(total, n)` parts always sum to `total`; sort output always ordered |
| Transformation with a relation between runs | **Metamorphic**: `search(q, filter)` results ⊆ `search(q)` results |
| State machine with many valid transitions | **Model-based**: simulate a simple reference model alongside the real SUT |
| User-controlled strings / bytes accepted | **Fuzzing**: all malformed inputs are rejected cleanly, never a crash |
| Permission matrix | **Monotonicity**: adding permission cannot reduce access |

## When not to use

- **Tiny deterministic mapping**: `add(2, 3) === 5` — a hand-written example test is clearer and faster
- **Behavior not yet specified**: if the invariant is unclear, PBT will assert the wrong thing
- **Output depends on external system**: the generator cannot control third-party behavior
- **Property restates the implementation**: `result === impl(x)` is circular (see `ANTI-PATTERNS.md` §9)
- **One-off setup with complex fixtures**: cost of writing a good generator exceeds the value gained

## Common property shapes

| Shape | Template | Example |
|---|---|---|
| Roundtrip | `decode(encode(x)) == x` | JSON, protobuf, URL encoding |
| Oracle | `newImpl(x) == oldImpl(x)` | Optimized vs naive sort |
| Idempotence | `f(f(x)) == f(x)` | Normalize, dedupe, format |
| Invariant | `∀x, P(f(x))` | Parts sum to total; balance ≥ 0 |
| Metamorphic | `f(transform(x))` relates to `f(x)` | Adding filter only narrows results |
| Commutativity | `f(a, b) == f(b, a)` | Merge, union, max |
| Monotonicity | more input → more (or same) output | Adding permission cannot remove access |

## Shrinking

When a property fails, the framework automatically shrinks the counterexample to a minimal case. **This is the primary value of PBT frameworks over hand-rolled random testing.**

Rules:
1. **Always save a shrunk counterexample as a permanent regression test.** PBT found the bug; a hard-coded test keeps it found. PBT runs are randomized — do not rely on it re-finding the same case.
2. **Record the seed** when CI fails. Most frameworks print it on failure; include it in the regression test comment so future runs can reproduce on demand.

## Tools

| Language | Property-based testing | Fuzzing |
|---|---|---|
| JS / TS | `fast-check` | `@jazzer.js/fuzzer` |
| Python | `Hypothesis` | Python's built-in `atheris` or `hypothesis[fuzz]` |
| Go | `gopter` | `go test -fuzz` (stdlib, Go 1.18+) |
| Java / Kotlin | `jqwik` | `jazzer` |
| Rust | `proptest` | `cargo-fuzz` / `libfuzzer` |

## Rules

1. **Every shrunk counterexample becomes a permanent example test** — see *Shrinking* above.
2. **Constrain generators to the valid input domain**, then write a *separate* property for invalid inputs ("all malformed inputs are rejected with `ParseError`, never a crash") — that second property is fuzzing, and covers #3 injection cases systematically.
3. **Properties must not duplicate the implementation** (`ANTI-PATTERNS.md` §9): assert relations (`sum === total`), not recomputed expected values.
4. **In CI, run with a fixed iteration count**; on failure the framework prints the seed — record it in the regression test.

## Examples

### Invariant property (JS/TS — fast-check)

```ts
import fc from 'fast-check';

// Invariant: splitting an amount across n parties loses no cents
test('splitAmount parts always sum to the total', () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 10_000_000 }),
      fc.integer({ min: 1, max: 100 }),
      (totalCents, parts) => {
        const split = splitAmount(totalCents, parts);
        expect(split.reduce((a, b) => a + b, 0)).toBe(totalCents); // relation, not recomputation
        expect(Math.max(...split) - Math.min(...split)).toBeLessThanOrEqual(1);
      }
    )
  );
});
```

### Roundtrip property (Python — Hypothesis)

```python
from hypothesis import given, strategies as st
from mylib import encode, decode

@given(st.text())
def test_roundtrip(s):
    assert decode(encode(s)) == s
```

### Fuzzing (Go — stdlib)

```go
func FuzzParseConfig(f *testing.F) {
    // Seed corpus from known-good inputs
    f.Add([]byte(`{"timeout": 30}`))

    f.Fuzz(func(t *testing.T, data []byte) {
        cfg, err := ParseConfig(data)
        if err != nil {
            return // malformed input → rejection is fine
        }
        // Invariant: valid config round-trips cleanly
        out, _ := json.Marshal(cfg)
        cfg2, err2 := ParseConfig(out)
        if err2 != nil || cfg2.Timeout != cfg.Timeout {
            t.Fatalf("roundtrip broken: %v", data)
        }
    })
}
```

See `EXAMPLES.md` Example 6 for a full bad-vs-good comparison with shrunk counterexample pinning.

## Integration with the 12-category matrix

PBT supplements — not replaces — categories #2 and #3:

- **#2 Boundary**: instead of hand-picking 3 edge points, assert an invariant that holds across the entire valid domain, then let the framework find the boundary that breaks it.
- **#3 Negative inputs**: write a separate "all malformed inputs are rejected" property; the framework generates injection strings, type mismatches, and out-of-range values automatically.
- **#5 State transitions**: use model-based testing to verify that a state machine matches a simple reference model across thousands of random transition sequences.
