# Examples — 壞 vs 好對照（精選 3 例）

> ANTI-PATTERNS 已含每條反模式的小對照範例。本檔保留**最常出錯且最值得完整看一遍**的 3 個情境。

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

## 寫完拿這 3 例當 mental check

1. **Error / 邊界**：error 路徑驗了**具體 error type** + 「不該發生的真的沒發生」？（範例 1）
2. **Async**：有沒有用 `sleep` 偽裝同步？換成 deterministic 觸發或 `waitFor`？（範例 2）
3. **State**：合法 + **非法**轉換都列舉？非法情境驗了「狀態不被污染」？（範例 3）
