# Examples — Bad vs good comparisons (selected 5 examples)

> ANTI-PATTERNS already includes a small comparison example for each anti-pattern. This file keeps the 5 scenarios that are **most commonly done wrong and most worth reading in full**.

---

## Example 1: Boundary + Error path both missing (the most common "happy test" lesion)

**SUT:** `transferMoney(fromId, toId, amount)`, rejects when balance is insufficient and **must not** touch any account.

### Bad

```js
test('transfer works', async () => {
  await transferMoney('a', 'b', 100);
  expect(await getBalance('b')).toBeGreaterThan(0);
});

test('rejects when balance insufficient', () => {
  expect(() => transferMoney('a', 'b', 9999)).toThrow();
});
```

**Problems:**
- Happy uses `toBeGreaterThan(0)` (anything garbage can pass)
- Error does not check concrete error type (if it later throws `DBConnectionError`, it still passes and the semantics are completely wrong)
- Does not check the most critical side effect: **Was account A deducted? Was account B credited? When failing, did nothing really change?**

### Good

```js
/**
 * Transfers exact amount from sender to receiver and writes audit log.
 * Steps:
 * 1. Seed accounts A=100, B=0
 * 2. transferMoney('a', 'b', 30)
 * 3. Assert balances A=70, B=30
 * 4. Assert audit log has one entry with correct amount + timestamp
 */
test('transfers exact amount and writes audit log', async () => {
  await seedAccount({ id: 'a', balance: 100 });
  await seedAccount({ id: 'b', balance: 0 });

  await transferMoney('a', 'b', 30);

  expect(await getBalance('a')).toBe(70);
  expect(await getBalance('b')).toBe(30);
  const log = await listTransactionsFor('a');
  expect(log).toHaveLength(1);
  expect(log[0]).toMatchObject({ amount: 30, to: 'b' });
});

/**
 * Rejects when balance insufficient with InsufficientBalance,
 * leaves both accounts and audit log untouched.
 */
test('rejects insufficient balance and leaves accounts untouched', async () => {
  await seedAccount({ id: 'a', balance: 100 });
  await seedAccount({ id: 'b', balance: 0 });

  await expect(transferMoney('a', 'b', 9999))
    .rejects.toThrow(InsufficientBalance);  // concrete error type

  // Key: side effect did not happen
  expect(await getBalance('a')).toBe(100);
  expect(await getBalance('b')).toBe(0);
  expect(await listTransactionsFor('a')).toEqual([]);
});
```

**What this does:**
- Uses concrete, hard-coded expected values (`70`, `30`) instead of "greater than 0"
- Error assertion uses a **concrete error class**
- Failure path explicitly verifies "**what should not happen really did not happen**" (both account balances + no transaction record)
- Structured docstring lets reviewer / agent understand the test matrix without reading the implementation

---

## Example 2: Async — the cost of sleep

**SUT:** `enqueueEmail()` puts work into a queue, and the worker writes to the `sent_emails` table after processing.

### Bad

```js
test('email gets sent', async () => {
  await enqueueEmail({ to: 'a@b.c' });
  await sleep(2000);  // wait for worker to finish
  const sent = await db.query('SELECT * FROM sent_emails');
  expect(sent.length).toBe(1);
});
```

**Problems:** 2 seconds is not enough on slow machines -> CI flaky; 2 seconds is too much on fast machines -> suite gets slower; if the worker crashes in the middle, you only see "it did not happen" and not why.

### Good (Option A: deterministic trigger)

```js
test('email gets sent and records correct payload', async () => {
  const worker = startWorkerInProcess();  // same process, controllable

  await enqueueEmail({ to: 'a@b.c', subject: 'hi' });
  await worker.processNext();  // explicitly run one job, no sleep

  const sent = await db.query('SELECT * FROM sent_emails');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ to: 'a@b.c', subject: 'hi', status: 'sent' });
});
```

### Good (Option B: waitFor condition polling)

```js
test('email gets sent', async () => {
  await enqueueEmail({ to: 'a@b.c' });

  await waitFor(
    async () => (await db.query('SELECT COUNT(*) FROM sent_emails'))[0].count === 1,
    { timeout: 5000, interval: 50 }
  );

  const sent = await db.query('SELECT * FROM sent_emails');
  expect(sent[0].to).toBe('a@b.c');
});
```

**What this does:** No fixed-duration sleep. Either the test **controls the trigger**, or it **polls a repeatably checkable condition**. It continues immediately when the condition is met (fast machines are fast), and fails only when the condition is not met by timeout (clear error).

---

## Example 3: State machine — valid + invalid transitions must both be tested

**SUT:** Order state machine `pending → paid → shipped → delivered`; can `cancel` during `pending`/`paid`.

### Bad

```js
test('order flow', () => {
  const o = createOrder();
  pay(o);
  ship(o);
  deliver(o);
  expect(o.status).toBe('delivered');
});
```

**Problem:** Only tests the happy line; all invalid transitions are completely unverified.

### Good

```js
describe('order state machine', () => {
  // Legal transitions
  test.each([
    ['pending', 'pay',     'paid'],
    ['paid',    'ship',    'shipped'],
    ['shipped', 'deliver', 'delivered'],
    ['pending', 'cancel',  'cancelled'],
    ['paid',    'cancel',  'cancelled'],
  ])('legal: %s + %s -> %s', (from, action, to) => {
    const o = makeOrderInState(from);
    apply(o, action);
    expect(o.status).toBe(to);
  });

  // Invalid transitions (one sub-test per case, following the "one scenario, one" principle)
  test.each([
    ['delivered', 'cancel'],
    ['cancelled', 'pay'],
    ['shipped',   'cancel'],   // already shipped cannot cancel
    ['pending',   'ship'],     // cannot ship before payment
    ['paid',      'deliver'],  // cannot deliver before shipment
  ])('illegal: %s + %s rejected, status unchanged', (from, action) => {
    const o = makeOrderInState(from);
    expect(() => apply(o, action)).toThrow(IllegalTransition);
    expect(o.status).toBe(from);  // Key: state was not polluted after failure
  });
});
```

**What this does:**
- Enumerates both valid + invalid transitions
- Invalid scenarios verify (1) correct error type, (2) **state was not polluted**
- `test.each` is a reasonable use of **pure table mapping** here (input -> expected) — each row is the same pattern with different input, **not a different behavior**. Compare the counterexample in `ANTI-PATTERNS.md` §12.

---

## After writing, use the first 3 examples as a mental check

1. **Error / boundary**: did the error path verify **concrete error type** + "what should not happen really did not happen"? (Example 1)
2. **Async**: are you using `sleep` to fake synchronization? Replace with deterministic trigger or `waitFor`. (Example 2)
3. **State**: did you enumerate valid + **invalid** transitions? Did invalid scenarios verify "state was not polluted"? (Example 3)

---

## Example 4: Go backend Integration Test (pgx + testcontainers style)

**SUT:** `CreateOrder(ctx, db, params)` — creates an order in Postgres and rejects when stock is insufficient.

### Bad

```go
func TestCreateOrder(t *testing.T) {
    db := setupTestDB(t)  // no t.Cleanup — connection may leak
    _, err := CreateOrder(ctx, db, OrderParams{UserID: "u1", SKU: "sku1", Qty: 5})
    if err != nil {
        t.Error("should not error")  // no concrete assertion, does not verify DB state
    }
}
```

**Problems:**
- `setupTestDB` has no `t.Cleanup` to close connection / terminate container -> handle leak under parallel runs
- Happy path only; insufficient-stock path is not verified
- Does not verify DB wrote the correct row (implementation could be entirely deleted and test would still pass)
- Error only uses `t.Error` and continues; later asserts may run on nil pointer

### Good

```go
func newTestDB(t *testing.T) *pgxpool.Pool {
    t.Helper()

    ctx := context.Background()
    container, err := postgres.RunContainer(ctx,
        testcontainers.WithImage("postgres:16-alpine"),
        postgres.WithDatabase("app_test"),
        postgres.WithUsername("postgres"),
        postgres.WithPassword("postgres"),
        testcontainers.WithWaitStrategy(
            wait.ForListeningPort("5432/tcp").WithStartupTimeout(30*time.Second),
        ),
    )
    if err != nil {
        t.Fatalf("start postgres container: %v", err)
    }
    t.Cleanup(func() {
        if err := container.Terminate(context.Background()); err != nil {
            t.Logf("terminate postgres container: %v", err)
        }
    })

    dsn, err := container.ConnectionString(ctx, "sslmode=disable")
    if err != nil {
        t.Fatalf("postgres dsn: %v", err)
    }
    db, err := pgxpool.New(ctx, dsn)
    if err != nil {
        t.Fatalf("connect postgres: %v", err)
    }
    t.Cleanup(db.Close)

    runMigrations(t, db)
    return db
}

// Creates order successfully and decrements stock.
// Steps:
// 1. Seed product with stock=10, user u1
// 2. CreateOrder(qty=3)
// 3. Assert order row in DB; assert stock=7
func TestCreateOrder_HappyPath(t *testing.T) {
    ctx := context.Background()
    db := newTestDB(t)
    seedProduct(t, db, "sku1", 10)
    seedUser(t, db, "u1")

    orderID, err := CreateOrder(ctx, db, OrderParams{UserID: "u1", SKU: "sku1", Qty: 3})
    if err != nil {
        t.Fatalf("unexpected error: %v", err)  // Fatal stops immediately; do not continue to nil pointer
    }

    // Verify DB really wrote
    row := queryOrder(t, db, orderID)
    if row.Qty != 3 {
        t.Errorf("qty: got %d, want 3", row.Qty)
    }
    // Verify side effect: stock was decremented
    if stock := queryStock(t, db, "sku1"); stock != 7 {
        t.Errorf("stock: got %d, want 7", stock)
    }
}

// Rejects when stock insufficient; leaves DB untouched.
// Steps:
// 1. Seed product with stock=2
// 2. CreateOrder(qty=5) — should fail
// 3. Assert InsufficientStock error; assert stock unchanged
func TestCreateOrder_InsufficientStock(t *testing.T) {
    ctx := context.Background()
    db := newTestDB(t)
    seedProduct(t, db, "sku1", 2)
    seedUser(t, db, "u1")

    _, err := CreateOrder(ctx, db, OrderParams{UserID: "u1", SKU: "sku1", Qty: 5})

    var insErr *InsufficientStockError
    if !errors.As(err, &insErr) {
        t.Fatalf("want InsufficientStockError, got %T: %v", err, err)
    }
    // Key: DB was not touched
    if stock := queryStock(t, db, "sku1"); stock != 2 {
        t.Errorf("stock should be unchanged: got %d, want 2", stock)
    }
    if count := queryOrderCount(t, db, "u1"); count != 0 {
        t.Errorf("no order should be created, got %d rows", count)
    }
}
```

**What this does:**
- `t.Helper` makes helper failures point stack trace at the caller
- `t.Cleanup` ensures DB pool / container resources are cleaned up (including panic paths)
- `t.Fatalf` replaces `t.Error` to fail fast, so later code does not continue on nil
- Concrete, hard-coded expected values (`3`, `7`, `2`)
- Failure path verifies "**what should not happen really did not happen**" (stock unchanged + no order row)
- Concrete error type uses `errors.As` instead of `err != nil`

---

## Example 5: React Native component test (@testing-library/react-native)

**SUT:** `<LoginForm onSuccess={cb} />` — after entering email + password, calls API, calls `onSuccess` on success, and shows error message on failure.

### Bad

```tsx
test('login form works', () => {
  const { getByPlaceholderText, getByText } = render(<LoginForm onSuccess={jest.fn()} />);
  fireEvent.changeText(getByPlaceholderText('Email'), 'a@b.com');
  fireEvent.changeText(getByPlaceholderText('Password'), 'pw123');
  fireEvent.press(getByText('Login'));
  // no await -> async state update not complete before assertion -> act() warning
  expect(getByText('Welcome')).toBeTruthy();  // weak assertion with toBeTruthy
});
```

**Problems:**
- `fireEvent.press` triggers async API call, but there is no `await waitFor` -> React state update is left hanging -> `act()` warning
- `toBeTruthy()` only verifies "exists"; any non-falsy element passes
- Does not verify `onSuccess` was actually called (core side effect is not asserted)
- Does not test API failure path

### Good

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { apiClient } from '../apiClient'; // project-specific API client
import { AuthError } from '../errors';

jest.mock('../apiClient');

const mockLogin = jest.mocked(apiClient.login);

beforeEach(() => {
  mockLogin.mockReset();
  // mock stops at external boundary (API client), does not mock LoginForm's own logic
  mockLogin.mockResolvedValue({ token: 'tok123' });
});

/**
 * Calls onSuccess with token when credentials are valid.
 * Steps:
 * 1. Render LoginForm with onSuccess mock
 * 2. Fill email + password, press Login
 * 3. waitFor: onSuccess called with token
 */
test('calls onSuccess with token on valid credentials', async () => {
  const onSuccess = jest.fn();
  const { getByPlaceholderText, getByText } = render(<LoginForm onSuccess={onSuccess} />);

  fireEvent.changeText(getByPlaceholderText('Email'), 'a@b.com');
  fireEvent.changeText(getByPlaceholderText('Password'), 'pw123');
  fireEvent.press(getByText('Login'));

  // waitFor waits for async state to stabilize -> no act() warning
  await waitFor(() => {
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith({ token: 'tok123' });
  });
});

/**
 * Shows inline error message when API returns 401.
 * Steps:
 * 1. Mock apiClient.login to reject with AuthError
 * 2. Submit form
 * 3. waitFor: error text visible; onSuccess not called
 */
test('shows error message on 401 and does not call onSuccess', async () => {
  mockLogin.mockRejectedValue(new AuthError('Invalid credentials'));
  const onSuccess = jest.fn();
  const { getByPlaceholderText, getByText, queryByText } = render(
    <LoginForm onSuccess={onSuccess} />
  );

  fireEvent.changeText(getByPlaceholderText('Email'), 'a@b.com');
  fireEvent.changeText(getByPlaceholderText('Password'), 'wrong');
  fireEvent.press(getByText('Login'));

  await waitFor(() => {
    expect(queryByText('Invalid credentials')).not.toBeNull();  // error UI appears
  });
  expect(onSuccess).not.toHaveBeenCalled();  // Key: success callback was not called
});
```

**What this does:**
- `await waitFor(...)` lets async state settle before assertion -> eliminates `act()` warning
- Mock stops at `apiClient` (external boundary), does not mock the component's own logic
- Specifically verifies `onSuccess` was called with the correct value (core side effect)
- Failure path verifies "error UI appears + onSuccess was not called"

**4 root causes of act() warnings (common troubleshooting):**
1. No `await waitFor` after `fireEvent` -> add `await waitFor`
2. `render` itself triggers async query (such as React Query) -> use `waitFor(() => expect(...).not.toBeNull())` to wait for initial load
3. `jest.useFakeTimers()` but no `act(() => jest.runAllTimers())` -> advance timer inside act
4. Pending state remains during teardown -> `afterEach(() => { jest.clearAllMocks(); })`
