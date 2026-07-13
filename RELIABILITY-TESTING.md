# Reliability Testing — failure boundaries and production-safe evidence

> Read this for services with dependencies, queues, capacity limits, rollout risk, or operational recovery requirements. It supplements the error, concurrency, resource, performance, and rollback categories in `AGENT.md`.

## 1. Failure-mode matrix

For each critical dependency or resource, state the expected user-visible and operational behavior for:

| Failure mode | Test evidence |
|---|---|
| timeout / high latency | latency budget, cancellation, clear degraded response |
| transient error | bounded retry and backoff; no retry storm |
| persistent error | circuit opens, work is shed or degraded safely |
| recovery | half-open probe and normal service recovery |
| partial dependency failure | unaffected functions continue where designed |
| queue backlog / redelivery | backpressure, idempotency, poison-message handling |
| capacity boundary | graceful rejection or degradation before exhaustion |
| configuration drift | validated startup/config contract and observable mismatch |
| data recovery | restore is exercised and data is usable, not merely backed up |

Use controlled clocks, test doubles at external boundaries, fault injection, and isolated environments. Do not create these conditions with arbitrary sleeps.

## 2. Production and rollout testing

Production-safe synthetic probes should be isolated, reversible, and non-destructive. For releases, define:

- a canary cohort and success signals;
- automatic stop/rollback thresholds;
- observation window and owner;
- rollback rehearsal and restoration evidence;
- alerting that distinguishes a product failure from a test/probe failure.

Stress tests find system boundaries; they are not merely performance benchmarks. Run them in environments that represent the relevant dependencies and capacity constraints, with explicit safety limits.

## 3. Reliability evidence

For each high-risk behavior, record the dependency, fault injected, expected degradation, oracle source, observable signal, and recovery proof. A passing retry loop alone is not reliability: it may merely hide latency, duplicate side effects, or overload a failing dependency.
