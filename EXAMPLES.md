# Examples — 壞 vs 好對照（精選 5 例）

> ANTI-PATTERNS 已含每條反模式的小對照範例。本檔保留**最常出錯且最值得完整看一遍**的 5 個情境。

---

## 範例 1：邊界 + Error path 都漏（最常見的「快樂測試」病灶）

**SUT：** `transferMoney(fromId, toId, amount)`，餘額不足時拒絕並**不可**動到任何帳戶。

### 壞

```js
test('transfer works', async () => {
  await transferMoney('a', 'b', 100);
  expect(await getBalance('b')).toBeGreaterThan(0);
});

test('rejects when balance insufficient', () => {
  expect(() => transferMoney('a', 'b', 9999)).toThrow();
});
```

**問題：**
- Happy 用 `toBeGreaterThan(0)`（可被任何垃圾通過）
- Error 沒檢查具體 error type（將來改 throw `DBConnectionError` 也會通過、語意全錯）
- 沒檢查最關鍵的 side effect：**A 帳戶有沒有被扣？B 帳戶有沒有被加？失敗時是否真的沒動？**

### 好

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
    .rejects.toThrow(InsufficientBalance);  // 具體 error type

  // 關鍵：side effect 沒發生
  expect(await getBalance('a')).toBe(100);
  expect(await getBalance('b')).toBe(0);
  expect(await listTransactionsFor('a')).toEqual([]);
});
```

**做了什麼：**
- 具體寫死的 expected（`70`、`30`）而非「比 0 大」
- Error 斷言**具體 error class**
- 失敗路徑明確驗證「**不該發生的真的沒發生**」（兩帳戶餘額 + 無交易紀錄）
- 結構化 docstring 讓 reviewer / agent 不讀實作就懂測試矩陣

---

## 範例 2：Async — sleep 的代價

**SUT：** `enqueueEmail()` 把工作丟進 queue，worker 處理後寫入 `sent_emails` 表。

### 壞

```js
test('email gets sent', async () => {
  await enqueueEmail({ to: 'a@b.c' });
  await sleep(2000);  // 等 worker 跑完
  const sent = await db.query('SELECT * FROM sent_emails');
  expect(sent.length).toBe(1);
});
```

**問題：** 慢機 2 秒不夠 → CI flaky；快機 2 秒太多 → 套件變慢；中間 worker crash 也只看到「沒發生」，不知為何。

### 好（方案 A：deterministic 觸發）

```js
test('email gets sent and records correct payload', async () => {
  const worker = startWorkerInProcess();  // 同程序、可控

  await enqueueEmail({ to: 'a@b.c', subject: 'hi' });
  await worker.processNext();  // 顯式跑一個 job，沒 sleep

  const sent = await db.query('SELECT * FROM sent_emails');
  expect(sent).toHaveLength(1);
  expect(sent[0]).toMatchObject({ to: 'a@b.c', subject: 'hi', status: 'sent' });
});
```

### 好（方案 B：waitFor 條件輪詢）

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

**做了什麼：** 不睡固定時間。要嘛由測試**控制觸發**，要嘛**輪詢可重複檢查的條件**。條件達成立刻往下走（快機快），條件不達成 timeout 才 fail（明確錯誤）。

---

## 範例 3：State machine — 合法 + 非法轉換都要測

**SUT：** Order 狀態機 `pending → paid → shipped → delivered`，可在 `pending`/`paid` 階段 `cancel`。

### 壞

```js
test('order flow', () => {
  const o = createOrder();
  pay(o);
  ship(o);
  deliver(o);
  expect(o.status).toBe('delivered');
});
```

**問題：** 只測 happy 一條線，所有非法轉換完全沒驗。

### 好

```js
describe('order state machine', () => {
  // 合法轉換
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

  // 非法轉換（每條一個 sub-test，符合「一個 scenario 一個」原則）
  test.each([
    ['delivered', 'cancel'],
    ['cancelled', 'pay'],
    ['shipped',   'cancel'],   // 已出貨不可取消
    ['pending',   'ship'],     // 沒付款不可出貨
    ['paid',      'deliver'],  // 沒出貨不可送達
  ])('illegal: %s + %s rejected, status unchanged', (from, action) => {
    const o = makeOrderInState(from);
    expect(() => apply(o, action)).toThrow(IllegalTransition);
    expect(o.status).toBe(from);  // 關鍵：失敗後狀態沒被污染
  });
});
```

**做了什麼：**
- 合法 + 非法都列舉
- 非法情境驗證 (1) 對的 error type、(2) **狀態沒被污染**
- `test.each` 在這裡是**純表格對應**（input → expected）的合理用法——每 row 是同模式不同輸入，**不是不同行為**。對照 `ANTI-PATTERNS.md` §12 的反例。

---

## 寫完先拿前 3 例當 mental check

1. **Error / 邊界**：error 路徑驗了**具體 error type** + 「不該發生的真的沒發生」？（範例 1）
2. **Async**：有沒有用 `sleep` 偽裝同步？換成 deterministic 觸發或 `waitFor`？（範例 2）
3. **State**：合法 + **非法**轉換都列舉？非法情境驗了「狀態不被污染」？（範例 3）

---

## 範例 4：Go 後端 Integration Test（pgx + testcontainers 風格）

**SUT：** `CreateOrder(ctx, db, params)` — 在 Postgres 中建立訂單，不足庫存時拒絕。

### 壞

```go
func TestCreateOrder(t *testing.T) {
    db := setupTestDB(t)  // 沒 t.Cleanup — 連線可能洩漏
    _, err := CreateOrder(ctx, db, OrderParams{UserID: "u1", SKU: "sku1", Qty: 5})
    if err != nil {
        t.Error("should not error")  // 沒具體斷言，沒驗 DB 狀態
    }
}
```

**問題：**
- `setupTestDB` 沒 `t.Cleanup` 關連線 / terminate container → 平行跑時 handle 洩漏
- Happy path only，沒驗庫存不足路徑
- 沒驗 DB 寫入了正確 row（可能實作全刪了測試還過）
- error 只 `t.Error` 繼續跑，後面 assert 可能在 nil pointer 上執行

### 好

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
    db := newTestDB(t)
    seedProduct(t, db, "sku1", 10)
    seedUser(t, db, "u1")

    orderID, err := CreateOrder(ctx, db, OrderParams{UserID: "u1", SKU: "sku1", Qty: 3})
    if err != nil {
        t.Fatalf("unexpected error: %v", err)  // Fatal 立刻停，不繼續空指標
    }

    // 驗 DB 真的有寫
    row := queryOrder(t, db, orderID)
    if row.Qty != 3 {
        t.Errorf("qty: got %d, want 3", row.Qty)
    }
    // 驗 side effect：庫存被扣
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
    db := newTestDB(t)
    seedProduct(t, db, "sku1", 2)
    seedUser(t, db, "u1")

    _, err := CreateOrder(ctx, db, OrderParams{UserID: "u1", SKU: "sku1", Qty: 5})

    var insErr *InsufficientStockError
    if !errors.As(err, &insErr) {
        t.Fatalf("want InsufficientStockError, got %T: %v", err, err)
    }
    // 關鍵：DB 沒被動到
    if stock := queryStock(t, db, "sku1"); stock != 2 {
        t.Errorf("stock should be unchanged: got %d, want 2", stock)
    }
    if count := queryOrderCount(t, db, "u1"); count != 0 {
        t.Errorf("no order should be created, got %d rows", count)
    }
}
```

**做了什麼：**
- `t.Helper` 讓 helper 失敗時 stack trace 指向呼叫端
- `t.Cleanup` 確保 DB pool / container 資源清理（含 panic 路徑）
- `t.Fatalf` 取代 `t.Error` 讓 fail-fast，後續不在 nil 上繼續
- 具體寫死的 expected 值（`3`、`7`、`2`）
- 失敗路徑驗「**不該發生的真的沒發生**」（stock 不變 + 無 order row）
- 具體 error type 用 `errors.As` 而非 `err != nil`

---

## 範例 5：React Native 元件測試（@testing-library/react-native）

**SUT：** `<LoginForm onSuccess={cb} />` — 輸入 email + password 後呼叫 API，成功回呼 `onSuccess`，失敗顯示 error 訊息。

### 壞

```tsx
test('login form works', () => {
  const { getByPlaceholderText, getByText } = render(<LoginForm onSuccess={jest.fn()} />);
  fireEvent.changeText(getByPlaceholderText('Email'), 'a@b.com');
  fireEvent.changeText(getByPlaceholderText('Password'), 'pw123');
  fireEvent.press(getByText('Login'));
  // 沒 await → async 狀態更新沒完成就斷言 → act() 警告
  expect(getByText('Welcome')).toBeTruthy();  // toBeTruthy 弱斷言
});
```

**問題：**
- `fireEvent.press` 觸發 async API call，但沒 `await waitFor` → React 狀態更新掛在空中 → `act()` 警告
- `toBeTruthy()` 只驗「存在」，任何非 falsy 元素都過
- 沒驗 `onSuccess` 真的被呼叫（核心 side effect 沒斷言）
- 沒測 API 失敗路徑

### 好

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('../apiClient');

const mockLogin = jest.mocked(apiClient.login);

beforeEach(() => {
  mockLogin.mockReset();
  // mock 止於外部邊界（API client），不 mock LoginForm 自己的邏輯
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

  // waitFor 等 async 狀態穩定 → 無 act() 警告
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
  const { getByPlaceholderText, getByText } = render(
    <LoginForm onSuccess={onSuccess} />
  );

  fireEvent.changeText(getByPlaceholderText('Email'), 'a@b.com');
  fireEvent.changeText(getByPlaceholderText('Password'), 'wrong');
  fireEvent.press(getByText('Login'));

  await waitFor(() => {
    expect(getByText('Invalid credentials')).toBeTruthy();  // error UI 出現
  });
  expect(onSuccess).not.toHaveBeenCalled();  // 關鍵：成功 callback 沒被呼叫
});
```

**做了什麼：**
- `await waitFor(...)` 讓 async 狀態 settle 再斷言 → 消除 `act()` 警告
- Mock 止於 `apiClient`（外部邊界），不 mock 元件自己的邏輯
- 具體驗 `onSuccess` 被呼叫且帶正確值（核心 side effect）
- 失敗路徑驗「error UI 出現 + onSuccess 沒被呼叫」

**4 個 act() 警告根因（常見排雷）：**
1. `fireEvent` 後沒 `await waitFor` → 加 `await waitFor`
2. `render` 本身觸發 async query（如 React Query）→ 用 `waitFor(() => expect(...).not.toBeNull())` 等初始載入完成
3. `jest.useFakeTimers()` 但沒 `act(() => jest.runAllTimers())` → 在 act 內推進 timer
4. Teardown 時仍有 pending state → `afterEach(() => { jest.clearAllMocks(); })`
