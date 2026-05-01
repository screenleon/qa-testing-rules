# Examples — 壞測試 vs 好測試對照

每組範例：先看「**壞**」找出問題，再看「**好**」學怎麼修。範例使用通用 pseudocode（接近 JavaScript / Python 風格），但原則跨語言通用。

---

## 範例 1：邊界值（quantity discount）

**SUT 規格：**
- `qty < 1` → throw `InvalidQuantity`
- `1 <= qty < 10` → 無折扣
- `10 <= qty < 100` → 9 折
- `qty >= 100` → 8 折

### 壞

```js
test('applies discount', () => {
  expect(price(50, 5)).toBe(250);     // 5 件，無折扣
  expect(price(50, 200)).toBe(8000);  // 200 件，8 折
});
```

**問題：**
- 完全沒測 boundary（9、10、99、100 — off-by-one 黃金 bug 區）
- 沒測 negative input（`qty=0`、`qty=-1`）
- 折扣級距 `[10, 100)` 完全沒驗證

### 好

```js
describe('price()', () => {
  // 邊界：每個 break point 都測 inside / on / outside
  test('throws on qty < 1', () => {
    expect(() => price(50, 0)).toThrow(InvalidQuantity);
    expect(() => price(50, -1)).toThrow(InvalidQuantity);
  });

  test('no discount for 1..9', () => {
    expect(price(50, 1)).toBe(50);
    expect(price(50, 9)).toBe(450);  // 邊界：9 仍無折扣
  });

  test('10% off for 10..99', () => {
    expect(price(50, 10)).toBe(450);   // 邊界：剛好觸發
    expect(price(50, 50)).toBe(2250);
    expect(price(50, 99)).toBe(4455);  // 邊界：上限
  });

  test('20% off for 100+', () => {
    expect(price(50, 100)).toBe(4000); // 邊界：剛好觸發
    expect(price(50, 1000)).toBe(40000);
  });
});
```

**做了什麼：**
- 每個級距斷點 `1, 9, 10, 99, 100` 都有測試，off-by-one 跑不掉
- `qty < 1` 的 negative input 明確覆蓋
- 具體數字寫死，不是用實作公式算出 expected

---

## 範例 2：Error path 不只測「會 throw」

**SUT：** `transferMoney(fromId, toId, amount)`，餘額不足時拒絕並**不可**動到任何帳戶。

### 壞

```js
test('rejects when balance insufficient', () => {
  expect(() => transferMoney('a', 'b', 9999)).toThrow();
});
```

**問題：**
- 沒檢查 throw 的是哪種 error（如果之後實作改成 throw `DBConnectionError`，這個測試會「通過」但語意全錯）
- 沒檢查**最關鍵的 side effect**：A 帳戶有沒有被扣？B 帳戶有沒有被加？

### 好

```js
test('rejects when balance insufficient and leaves both accounts untouched', async () => {
  const a = await seedAccount({ id: 'a', balance: 100 });
  const b = await seedAccount({ id: 'b', balance: 0 });

  await expect(transferMoney('a', 'b', 9999))
    .rejects.toThrow(InsufficientBalance);  // 具體 error 類型

  // 關鍵：side effect 沒發生
  expect(await getBalance('a')).toBe(100);
  expect(await getBalance('b')).toBe(0);
  expect(await listTransactionsFor('a')).toEqual([]);  // 沒留下任何痕跡
});
```

**做了什麼：**
- 斷言具體 error 類型 → 之後若改寫成 `DBConnectionError` 會被抓到
- 明確驗證「**不該發生的真的沒發生**」（兩個帳戶餘額不變、無交易紀錄）

---

## 範例 3：Async — 不要靠 sleep

**SUT：** `enqueueEmail()` 把工作丟進 queue，worker 處理後寫入 `sent_emails` 表。

### 壞

```js
test('email gets sent', async () => {
  await enqueueEmail({ to: 'a@b.c', subject: 'hi' });
  await sleep(2000);  // 等 worker 跑完
  const sent = await db.query('SELECT * FROM sent_emails');
  expect(sent.length).toBe(1);
});
```

**問題：**
- 慢機器 2 秒不夠 → CI flaky
- 快機器 2 秒太多 → 測試套件變慢
- 中間 worker crash 也只看到「沒發生」，不知道為什麼

### 好（方案 A：deterministic 觸發）

```js
test('email gets sent', async () => {
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
  await enqueueEmail({ to: 'a@b.c', subject: 'hi' });

  // 重複檢查條件，最長 5 秒，每 50ms
  await waitFor(
    async () => (await db.query('SELECT COUNT(*) FROM sent_emails'))[0].count === 1,
    { timeout: 5000, interval: 50 }
  );

  const sent = await db.query('SELECT * FROM sent_emails');
  expect(sent[0].to).toBe('a@b.c');
});
```

**做了什麼：**
- 不睡固定時間，要嘛由測試**控制觸發**，要嘛**輪詢可重複檢查的條件**
- 條件達成立刻往下走（快機快），條件不達成 timeout 才 fail（明確錯誤）

---

## 範例 4：不要 mock SUT 自己的邏輯

**SUT：** `OrderService.create()` 內部用了同 module 的 `validateItems()` helper。

### 壞

```js
test('creates order', () => {
  jest.spyOn(OrderService, 'validateItems').mockReturnValue(true);
  jest.spyOn(db, 'insert').mockResolvedValue({ id: 1 });

  const r = await OrderService.create({ items: [/* 任何垃圾 */] });
  expect(r.id).toBe(1);
});
```

**問題：**
- 把 `validateItems` mock 掉了，這個函式裡面的 bug 永遠抓不到
- 餵任何垃圾進去都會「通過」，這條測試其實什麼也沒驗證
- 改了 `validateItems` 邏輯不會觸發任何測試紅燈

### 好

```js
test('creates order with valid items', async () => {
  // 只 mock 真正的外部邊界
  const dbInsert = jest.spyOn(db, 'insert').mockResolvedValue({ id: 1 });

  const r = await OrderService.create({
    items: [{ sku: 'A1', qty: 2, price: 100 }],  // 真實會通過 validation 的資料
  });

  expect(r.id).toBe(1);
  expect(dbInsert).toHaveBeenCalledWith(
    'orders',
    expect.objectContaining({ total: 200 }),
  );
});

test('rejects invalid items without writing to db', async () => {
  const dbInsert = jest.spyOn(db, 'insert');

  await expect(OrderService.create({ items: [{ sku: '', qty: -1, price: 0 }] }))
    .rejects.toThrow(InvalidItems);

  expect(dbInsert).not.toHaveBeenCalled();  // 不該發生的真的沒發生
});
```

---

## 範例 5：Assertion 不要抄 production code

**SUT：** `calculateTax(items, region)`

### 壞

```js
test('calculates tax', () => {
  const items = [{ price: 100 }, { price: 200 }];
  const expected = items.reduce((s, i) => s + i.price * 0.05, 0);  // 算法跟實作一樣
  expect(calculateTax(items, 'TW')).toBe(expected);
});
```

**問題：** 如果實作把 `0.05` 寫成 `0.5`，`expected` 也會跟著變成 150，測試還是通過。

### 好

```js
test('calculates 5% tax for TW', () => {
  const items = [{ price: 100 }, { price: 200 }];
  expect(calculateTax(items, 'TW')).toBe(15);  // 手算寫死：(100+200) * 0.05
});

test('calculates 10% tax for JP', () => {
  expect(calculateTax([{ price: 100 }], 'JP')).toBe(10);
});

test('rounds half-up to 2 decimal places', () => {
  // 邊界：0.005 應 round up 還是 down？規格說了算
  expect(calculateTax([{ price: 33.33 }], 'TW')).toBe(1.67);
});
```

---

## 範例 6：Snapshot 不要 snapshot 整個 HTML

### 壞

```js
test('renders user card', () => {
  const html = render(<UserCard user={mockUser} />);
  expect(html).toMatchSnapshot();  // 100 行 HTML
});
```

**問題：** class 名稱、元素順序、內部 wrapper 換了，snapshot 就壞，但**沒有任何 user-facing 行為改變**。久了大家 `--update` 一鍵更新，bug 跟著被「批准」。

### 好

```js
test('user card shows name and avatar', () => {
  const { getByRole, getByText } = render(<UserCard user={mockUser} />);

  expect(getByText(mockUser.name)).toBeInTheDocument();
  expect(getByRole('img', { name: /avatar/i })).toHaveAttribute('src', mockUser.avatarUrl);
});

test('user card has clickable profile link', async () => {
  const { getByRole } = render(<UserCard user={mockUser} />);
  await userEvent.click(getByRole('link', { name: mockUser.name }));
  expect(mockNavigate).toHaveBeenCalledWith(`/users/${mockUser.id}`);
});
```

**做了什麼：** 斷言**使用者實際感知到的行為**（看到名字、avatar src、可點），不綁 DOM 結構。

---

## 範例 7：State machine 的合法 / 非法轉換

**SUT：** Order 狀態機：`pending → paid → shipped → delivered`，可在 `pending`/`paid` 階段 `cancel`。

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

**問題：** 只測 happy path 一條線，所有非法轉換完全沒驗。

### 好（合法 + 非法都覆蓋）

```js
describe('order state machine', () => {
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

  test.each([
    ['delivered', 'cancel'],
    ['cancelled', 'pay'],
    ['shipped',   'cancel'],   // 已出貨不可取消（規格）
    ['pending',   'ship'],     // 沒付款不可出貨
    ['paid',      'deliver'],  // 沒出貨不可送達
  ])('illegal: %s + %s rejected, status unchanged', (from, action) => {
    const o = makeOrderInState(from);
    expect(() => apply(o, action)).toThrow(IllegalTransition);
    expect(o.status).toBe(from);  // 關鍵：失敗後狀態沒被污染
  });
});
```

---

## 範例 8：測試命名與 docstring（agent 可診斷）

**SUT：** `cancelOrder(orderId, userId)`，已 shipped 的訂單不可取消、跨 user 取消他人訂單應拒絕。

### 壞

```js
test('cancel test', async () => {
  const o = await makeOrder({ status: 'shipped' });
  await expect(cancelOrder(o.id, o.userId)).rejects.toThrow();
});

test('test 2', async () => {
  const a = await makeOrder({ userId: 'a' });
  await expect(cancelOrder(a.id, 'b')).rejects.toThrow();
});
```

**問題：**
- CI 紅燈時看到「cancel test failed」毫無診斷價值
- reviewer 必須讀整段實作才能判斷「測試矩陣有沒有蓋到該蓋的」
- 兩條都是 `rejects.toThrow()`，error 類型沒分開——其實第一條應該回 `IllegalStateTransition`，第二條應該回 `Forbidden`，但測試吃同一個 error 也通過

### 好

```js
/**
 * Rejects cancellation of a shipped order with IllegalStateTransition,
 * leaves order status untouched.
 *
 * Steps:
 * 1. Seed order in 'shipped' state
 * 2. Call cancelOrder() as the order owner
 * 3. Assert thrown error is IllegalStateTransition
 * 4. Assert order status is still 'shipped' in DB
 */
test('rejects cancel of shipped order with IllegalStateTransition', async () => {
  const o = await makeOrder({ status: 'shipped', userId: 'u1' });

  await expect(cancelOrder(o.id, 'u1'))
    .rejects.toThrow(IllegalStateTransition);

  expect((await getOrder(o.id)).status).toBe('shipped');
});

/**
 * Rejects cross-user cancellation with Forbidden, no state change.
 *
 * Steps:
 * 1. Seed order owned by user A
 * 2. Call cancelOrder() as user B
 * 3. Assert thrown error is Forbidden (not 404, not generic Error)
 * 4. Assert order status is unchanged
 */
test('rejects cross-user cancel with Forbidden', async () => {
  const o = await makeOrder({ status: 'pending', userId: 'a' });

  await expect(cancelOrder(o.id, 'b'))
    .rejects.toThrow(Forbidden);

  expect((await getOrder(o.id)).status).toBe('pending');
});
```

**做了什麼：**
- 函式名是完整句子，描述「rejects + 條件 + 預期 error 類型」
- docstring 編號 Steps 讓 reviewer / agent 不必讀實作就懂測試矩陣
- 兩條 error 路徑分別斷言**不同的具體 error 類型**——不再被同一個 generic Error 吃掉
- 兩條都驗證「狀態沒被污染」（不該發生的真的沒發生）

---

## 練習：拿這份對照當 review 標準

下次你（或 agent）寫完一批測試，把這 8 組範例當 mental checklist：

1. 邊界值有沒有測在斷點上？
2. error path 有沒有檢查具體 error 類型 + 沒發生的 side effect？
3. async 有沒有靠 sleep？
4. 有沒有 mock 掉 SUT 自己的邏輯？
5. assertion 是不是抄 production 公式？
6. snapshot 有沒有綁到不該綁的細節？
7. state machine 的非法轉換有沒有測？
8. 每條測試的命名 + docstring 是否能讓 reviewer / agent 不讀實作就懂在保護什麼？
