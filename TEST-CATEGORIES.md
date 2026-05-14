# Test Categories — 12-category enumeration checklist + optional privacy supplement

> `AGENT.md` already includes a one-line quick reference for the 12 categories. This file is the **deep version**; read the corresponding section when you do not know what concrete cases to test for a category. §13 is an optional supplement for telemetry SUTs.
>
> Default stance: unless you can say "this category is not applicable because ___", **you must write it**. "Could not think of one" is not a valid N/A reason.

---

## 1. Happy path
The most common, most typical successful input produces the expected output.
**Trap:** the agent's default is only this category. If your tests contain **only** this category, stop and reread this file.

## 2. Boundary values

Any value near a "quantity" or "range". **Anywhere `<`, `<=`, `>`, `>=`, `length`, or `count` appears, test at least 3 points (just inside / exactly on boundary / just outside).**

| Dimension | Boundaries |
|---|---|
| Numeric | `0`, `-1`, `1`, `MAX`, `MIN`, `MAX+1`, `MIN-1`, floating-point precision |
| Collection | `[]`, `[single]`, very large, exactly limit, limit+1 |
| String | `""`, single character, Unicode (emoji / CJK / combining character é vs e+◌́), very long |
| Time | epoch, 1970, 2038, across day / month / year, DST transition, leap year (2/29), leap second |
| Pagination | first page, last page (exactly full / not full), out of range |

## 3. Negative inputs

Things callers "should not pass but **might pass**":

- `null`, `undefined`
- Wrong type (string provided where number is expected)
- Format errors (malformed JSON, invalid email, non-UTF-8)
- Injection characters (SQL quotes, shell metachar, HTML script, path `..`)
- Type is correct but semantics are invalid (negative age, future birthday, empty string name)

Decide how the SUT should handle it (throw / return error / return null) -> **the spec must be explicit**; tests solidify the spec.

## 4. Error paths

How should the SUT behave when dependencies / environment break?

- External service timeout / 5xx / connection refused
- DB connection broken / transaction rollback
- Disk full, insufficient permission, file does not exist
- Auth token expired / invalid / missing
- Upstream returns malformed payload

**Key point**: do not only test "it throws"; test:
1. **what is thrown** (concrete error type / message / code)
2. **what was not done** (did not write DB, did not send email, did not charge money)

## 5. State transitions

If the SUT is stateful (state machine, order flow, session, multi-step form):

- List all valid states -> list all valid transitions -> one test per transition
- List all **invalid** transitions -> one test per transition (should be rejected, **and state remains unchanged**)
- Idempotency: when the same action is called repeatedly, should the result be consistent or should it fail? The spec decides

## 6. Concurrency / race conditions

- Double-click submit (is the same order created twice?)
- Simultaneous edits (last-write-wins? optimistic locking conflict returns 409?)
- Stock deduction race (last item ordered by two people at the same time)
- Cache stampede / thundering herd
- Message redelivery (under at-least-once delivery, is the consumer idempotent?)

**Approach:** do not use `sleep` to create concurrency; use deterministic tools (barrier / latch / controlled scheduler).

## 7. Side effects

Externally observable effects must verify **what should happen happens, and what should not happen really does not happen**.

- DB writes: the correct row changed the correct columns
- HTTP outbound: correct URL, payload, header (especially auth)
- Events: emitted to the correct topic / with the correct schema
- Files: create / delete / permissions / contents
- Logs / metrics: critical events are recorded

**Also test counterexample scenarios:** "when validation fails, DB **should not** be written" -> explicitly assert DB was not touched.

## 8. Resource lifecycle

- Are opened connections, files, and handles closed?
- **Even when a throw happens midway, does cleanup still run?** (finally / using / defer)
- Under long-running execution, is there any memory leak / file descriptor leak?

## 9. Security

- **Authn**: unauthenticated, invalid login, expired token
- **Authz**: logged in but wrong role, **cross-tenant access** (user A tries to read user B's resource), vertical privilege escalation
- **Input validation**: SQL / NoSQL / command / LDAP / XML / template injection
- **Output encoding**: XSS, open redirect, SSRF
- **Rate limiting / abuse**: brute force attempts, enumeration (are error messages the same for different accounts?)
- **Data leakage**: does the error message expose stack trace / SQL / internal hostname

**At minimum:** any endpoint that reads or writes resources must have a "cross-tenant rejection" test.

**Supplement: high-frequency OWASP Top 10 items:**

| Type | Test points |
|---|---|
| **CSRF** | Does a state-changing endpoint verify CSRF token / SameSite cookie? Are cross-origin requests rejected? |
| **CORS** | Does an untrusted origin's preflight / simple request return 403 or omit `Access-Control-Allow-Origin`? |
| **IDOR / BOLA** | For `GET /orders/{id}`, when using user B's token to read user A's resource, does it return 403 / 404 instead of 200? Cover ownership checks for path params / query params. |
| **Security headers** | Are `X-Frame-Options`, `Content-Security-Policy`, `X-Content-Type-Options`, and `Referrer-Policy` present and configured correctly? |
| **Path traversal** | When filename / path params receive `../../etc/passwd` or `%2F..%2F`, are they rejected or sanitized? This is a black-box path traversal test. |
| **File upload** | MIME type validation (not only extension); uploaded files cannot be executed directly; storage path must not use user-supplied filename; size limit is enforced server-side. |
| **Mass assignment** | Can PATCH / PUT body let a user modify fields that should not be open, such as `role` / `is_admin`? |

Testing principle: every OWASP-item test should be **black-box** — provide specific input, then verify HTTP status + data that should not be returned really does not appear.

## 10. Performance / scale boundaries

This is not benchmark; it is a **spec boundary**:
- `n=0` does not explode
- `n=1` does not regress (special paths often contain bugs)
- `n=large` remains within contract (not O(n²) while claiming O(n))
- When exceeding limit, does it reject gracefully or OOM?

## 11. Contract / interface compatibility

When the SUT crosses **team / service / package** boundaries:

- **API schema**: request / response fields, types, and requiredness match consumer expectations (OpenAPI / JSON Schema validation)
- **Event payload**: events published to the message bus remain parseable by all consumers
- **Webhook delivery**: outbound payloads still satisfy the receiver's contract
- **Public package API**: function signature, type export, and semver promises are consistent

**Do:** version contracts (v1/v2), verify provider compatibility before release, have consumers write tests against the **expected contract**.
**Do not:** conflate contract tests with integration tests — contract tests do not care about SUT internals, only boundary protocols.

See `TEST-STRATEGY.md` §1.3.

## 12. Backward compatibility / migration

If the SUT handles "data written in the past" or "requests from old clients":

- Rows from the old schema can still be read
- Missing new fields have reasonable defaults
- New API versions remain compatible with old clients (or are intentionally incompatible and return the correct error)
- Migration script can run twice harmlessly (idempotent)

## 13. Privacy / Telemetry Leakage (optional)

> Applicable: any system with structured logging / distributed tracing / metrics / error reporting.
> Not applicable to SUTs with no telemetry at all (explicit N/A + reason).

Modern observability tools (Datadog / Sentry / OpenTelemetry) can easily leak PII in logs or traces, and these problems are usually discovered only in production.

**Test points:**

| Scenario | What to verify |
|---|---|
| Normal request | Log structure does not contain sensitive values such as password / token / credit card / SSN / DOB |
| Error response body | Does not include SQL query, stack trace, internal hostname, file path |
| Auth error | 401/403 body does not expose `"user not found"` vs `"password wrong"` (enumeration protection) |
| Distributed trace span | span attributes do not carry PII; tag keys have an allow-list |
| Metrics labels | Do not use user ID / email as metric label (cardinality + PII double problem) |
| Error reporting (Sentry etc.) | breadcrumbs / extra do not contain session token / raw request body |

**Testing approach:**
1. Capture log output (stdout / structured log) in the test and assert it does NOT contain known PII fields
2. Call error endpoints and assert `response.body` does not contain known internal strings
3. If using OpenTelemetry SDK, set a test exporter and assert span attributes against an allowlist

**Example (Go):**
```go
func TestCreateUser_LogDoesNotLeakPassword(t *testing.T) {
    var buf bytes.Buffer
    logger := zap.New(zapcore.NewCore(
        zapcore.NewJSONEncoder(zap.NewProductionEncoderConfig()),
        zapcore.AddSync(&buf), zap.InfoLevel,
    ))
    svc := NewService(db, logger)

    _, _ = svc.CreateUser(ctx, CreateUserRequest{Email: "a@b.com", Password: "s3cr3t"})

    if strings.Contains(buf.String(), "s3cr3t") {
        t.Errorf("log must not contain raw password; got: %s", buf.String())
    }
}
```

---

## Matrix Output Format

Produce this before writing tests; attach it at the top of the test file or in the delivery message:

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
