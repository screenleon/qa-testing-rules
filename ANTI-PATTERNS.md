# Anti-Patterns — 17 種測試反模式

> 每條：**症狀 → why bad → fix**。寫完測試 / review 別人測試時 grep 對照。

---

## 1. Happy-path-only

**症狀：** 一個 SUT 只有一條測試，餵正常輸入、斷言正常輸出。
**Why bad：** 99% 的 bug 在邊界 / error / 無效輸入；這類測試把覆蓋率撐到 70% 但抓不到任何真實 bug。
**Fix：** 過 `TEST-CATEGORIES.md` 12 類枚舉，每個 SUT 至少 happy + boundary + negative + error 四類。

## 2. Testing implementation details

**症狀：** 斷言「`UserService` 內部呼叫 `cache.get` 三次」、「private `_normalize` 被呼叫」。
**Why bad：** Refactor 時測試大量壞掉但**沒抓到任何 bug**——測試在阻撓改善而非保護正確性。
**Fix：** Black-box 為主（給輸入 / 看輸出 / 看可觀察 side effect）。只在「互動本身就是規格」時驗互動（例：「下單必須發 OrderPlaced event」）。

## 3. Over-mocking

**症狀：** Mock 了 SUT 所有依賴（含 SUT 自己呼叫的 helper）。最後測試只在驗 mock 被照預期呼叫。
**Why bad：** Mock 掉的東西如果有 bug，測試永遠看不到。極端情況：實作整個被刪掉、測試還會通過。
**Fix：**
- Mock **止於外部邊界**（DB / network / time / filesystem / 第三方 SDK）
- SUT 自己的 helper / pure function：**不要 mock**
- 寧用 fake / in-memory implementation 也不要 mock

## 4. Always-passing tests

**症狀：** Async assertion 沒 `await`、callback 沒被呼叫、assertion 拼錯 method 名 → assertion 從未執行。

```js
// 壞：promise 沒 await
test('user is created', () => {
  service.create(input).then(u => expect(u.id).toBeDefined());  // never awaited
});
```

**Why bad：** 看似綠燈、其實裸奔。
**Fix：**
- Async 測試強制 `await`
- 寫完故意把實作打壞驗證測試會 fail（mutation 自我測試）
- 用 `expect.assertions(n)` 確保至少 n 個 assert 跑過

## 5. Order-dependent tests

**症狀：** Test A 建資料、test B 查資料、test C 改資料。單獨跑 B 就 fail。
**Why bad：** 平行 / shard 執行時隨機壞、單獨 debug 時不可重現、新增測試打壞看似不相關的另一條。
**Fix：** 每條測試 setup 自己需要的全部前置狀態，cleanup 還原。Fixture / transaction rollback / 每測試獨立 schema。

## 6. Shared mutable state

**症狀：** 共用 module-level 變數 / 全域 singleton / 沒重置的 cache。
**Why bad：** 一條測試改了 state，下一條看到污染後 state——典型 flaky 來源。
**Fix：** `beforeEach` reset，不要 `beforeAll` 共用。

## 7. Time / async flakiness

**症狀：**
- `setTimeout(() => expect(...), 100)` 等 callback
- `await sleep(500)` 等 race 解決
- 直接用 `new Date()` / `Date.now()`，跨日 / 跨時區壞

**Why bad：** Sleep 在快機太快、慢機太慢；timezone 切換改變語意。
**Fix：**
- 注入時間（clock abstraction）→ 測試裡用 fake clock
- 用 deterministic event（promise resolve / event emitter / queue drain）替代 sleep
- 真的需要等：用 `waitFor(condition, timeout)` 但 condition 必須**可重複檢查**

## 8. Network / external IO in unit tests

**症狀：** Unit test 真打 production API、真連外部 DB、真讀 `~/.config`。
**Why bad：** 慢、不穩、依賴外部可用性、可能改到別人的資料。
**Fix：** Unit / component：mock / fake 外部邊界。Integration：用 testcontainers / docker-compose。E2E：才碰真鏈路。

## 9. Assertion duplicates production logic

**症狀：**
```js
const expected = items.reduce((s, i) => s + i.price * i.qty, 0);  // 跟實作一樣
expect(calculateTotal(items)).toBe(expected);
```

**Why bad：** 在用「實作算一次」對「實作算一次」。實作公式錯了，expected 也跟著錯，測試還是綠的。
**Fix：** 用**手算過、寫死的具體值**：
```js
const items = [{ price: 100, qty: 2 }, { price: 50, qty: 3 }];
expect(calculateTotal(items)).toBe(350);  // 100*2 + 50*3
```

## 10. God test

**症狀：** 一條測試 setup 三屏、act 五次、assert 二十條，名字叫 `test full flow`。
**Why bad：** Fail 時看不出哪段壞了；改一個小行為要改整個測試；新人不敢動。
**Fix：** 拆成多條，每條一個概念。共用 setup 抽 fixture。

## 11. Snapshot rot

**症狀：** Snapshot 測試 `--update` 一鍵更新，沒人看 diff，過幾個月不知道在保護什麼。
**Why bad：** Snapshot 變成「凍結現狀」而不是「規格」，bug 進去也會被當成預期變化更新掉。
**Fix：**
- Snapshot 限縮到**穩定且語意明確的輸出**（serialize 後的 DTO、accessibility tree）
- 不要 snapshot 整個 HTML / 整個 console output
- 更新 snapshot 必須在 PR 中**逐項過 diff**並說明變更原因
- 替代：用具體 assertion（`expect(rendered.title).toBe('Welcome')`）

## 12. Table-driven 塞獨立 scenario

**症狀：** 一個 test function 跑 5–10 個 case，但每個 case 是**獨立行為**（不同 setup / assertion 模式 / error path）。

```go
// 壞
for _, tc := range []struct{ name, in, expected string }{
    {"branch_default",         "merge",  "merge"},
    {"command_overrides",      "merge",  "rebase"},   // 不同情境
    {"flag_overrides_command", "rebase", "merge"},    // 不同情境
} {
    t.Run(tc.name, func(t *testing.T) { /* 不同 setup */ })
}
```

**Why bad：** 失敗訊息混在 sub-test 裡要兩層才定位；修一個 case 可能誤動共用 setup；函式名變模糊；不易部分執行。
**Fix：** 一個 scenario 一個 function：
```go
func TestMergeStrategyBranchDefaultIsMerge(t *testing.T) { ... }
func TestMergeStrategyCommandConfigOverridesBranch(t *testing.T) { ... }
func TestMergeStrategyFlagOverridesCommandConfig(t *testing.T) { ... }
```

**例外：** 純函式 input/output 對照（`validateEmail` / `parseVersion`），每 row 只是不同輸入相同 assertion 模式 → 可 table-driven。

## 13. 隱形的 cwd / env / global state 依賴

**症狀：** 測試靠 `os.Chdir()` / `process.chdir()` 切目錄、靠某 env var 已被設好、靠某 global singleton 已初始化才能通過。

```go
// 壞：依賴 cwd 全域狀態
os.Chdir(testRepoDir)  // 全域！
git.Checkout("develop")  // 內部函式靠 cwd 找 repo
```

**Why bad：** 平行測試立刻互相污染；defer 沒跑（panic / 早 return）就污染後續；CI 與 local cwd 不同 → 一邊綠一邊紅。
**Fix：**
- 改用接受 dir / config 為參數的函式：`git.CheckoutInDir(dir, "develop")`
- Helper 內部 `cmd.Dir = testRepoDir`，外部完全不需 chdir
- 改 env 用 `t.Setenv`（自動還原）而非 `os.Setenv`

## 14. 測試沒有 intent

**症狀：** 名字 `test 1` / `should work` / 沒 docstring。
**Why bad：** CI 紅燈時「test 1 failed」毫無診斷價值；reviewer / agent 無法不讀實作就理解測試。
**Fix：** 完整句子敘述行為 + 結構化 docstring（見 `PRINCIPLES.md` §10）：

```js
/**
 * Returns 401 when access token is expired.
 * Steps:
 * 1. Issue token, fast-forward fake clock past expiry
 * 2. Call protected endpoint with that token
 * 3. Assert response.status === 401 and body.code === "TOKEN_EXPIRED"
 */
test('returns 401 when access token is expired', async () => { ... });
```

## 15. 信任 placeholder helper

**症狀：** 用 `runGitFlow(t, dir, "init")` 等 helper，但沒人驗證它真的執行了命令——可能是半成品 stub、或被改過、或在錯誤分支提早 return。
**Why bad：** Anti-pattern #4 的特化版，因為 helper 是抽象層更隱蔽。
**Fix：**
- Helper 失敗時 **`t.Fatalf` 並印 output**——任何「沒跑成功」的情況**爆炸而非靜默通過**
- 加一條 meta test：呼叫正確路徑後檢查 side effect 真的存在
- 加一條 negative meta test：餵錯參數確認 helper 真的回 error 而非 swallow

```go
output, err := testutil.RunGitFlow(t, dir, "feature", "start", "x")
if err != nil {
    t.Fatalf("RunGitFlow failed: %v\nOutput: %s", err, output)  // 含 output 方便 debug
}
```

## 16. Test doubles 混淆：把 mock 當萬能解法

**症狀：** 所有「我需要替換外部依賴」的情況一律用 `jest.mock` / `when(...).thenReturn(...)` — 不管是要替換網路、替換 helper、替換 pure function 都用 mock。

**Four types of test doubles（選錯代價高）：**

| 類型 | 是什麼 | 何時用 | 常見誤用 |
|---|---|---|---|
| **Stub** | 回傳固定值，不驗互動 | 讓依賴回「我需要的資料」 | 驗 stub 幾次被呼叫（stub 不應驗呼叫）|
| **Mock** | 驗互動（呼叫次數 / 參數）| 「互動本身是規格」時（如：必須發 OrderPlaced event） | 把所有 stub 都加 `.verify()` |
| **Fake** | 輕量真實實作（in-memory DB、fake queue）| 需要真實語意但不想起真實服務 | 認為 fake 比 mock 麻煩所以不用 |
| **Spy** | 包住真實實作 + 記錄互動 | 真實行為要跑，但需要觀察副作用 | 用 spy 替換掉真實邏輯（變成 mock 了）|

**Why bad（選錯 double 的代價）：**
- Mock 驗互動 → 實作 refactor 時大量測試壞掉，但沒抓到任何 bug（測試阻礙改善）
- Stub 用來驗「被呼叫幾次」→ 讓 stub 承擔 mock 的責任，語意混亂
- 所有依賴用 mock 而非 fake → 遺漏真實語意（假設 in-memory set 與真實 DB 行為一致，其實不然）

**Fix：**
```
問自己：「互動本身是規格（必須呼叫）還是實作細節（可以改）？」
- 互動是規格 → Mock（驗呼叫）
- 互動是細節 → Stub / Fake（只要回傳值正確）
- 需要真實語意 → Fake
- 真實實作要跑但想觀察 → Spy
```

**Go 語法提示：**
```go
// Fake（in-memory repo，有真實行為）
type fakeOrderRepo struct { orders map[string]Order }
func (r *fakeOrderRepo) Save(o Order) error { r.orders[o.ID] = o; return nil }
func (r *fakeOrderRepo) FindByID(id string) (Order, error) {
    o, ok := r.orders[id]
    if !ok { return Order{}, ErrNotFound }
    return o, nil
}
// → 比 mock 更接近真實，重構時測試不壞掉
```

## 17. Over-specification：驗互動細節而非行為結果

**症狀：**
```js
// 驗「第一次呼叫用 200ms TTL、第二次用 500ms TTL、共呼叫三次」
expect(cache.set).toHaveBeenNthCalledWith(1, 'key', value, { ttl: 200 });
expect(cache.set).toHaveBeenNthCalledWith(2, 'key', value, { ttl: 500 });
expect(cache.set).toHaveBeenCalledTimes(3);
```

**Why bad：** 這在測「我怎麼實作的」而不是「我提供了什麼行為」。只要 cache 策略稍微調整（TTL 合併、合批寫入），測試立刻紅燈——但用戶感受不到任何差異。

**判斷標準：** 如果你把這段斷言說給 product manager 聽，他會說「所以呢？」→ 這段斷言在測實作細節。

**Fix：** 把斷言拉到**可觀察的行為**（用戶能感受到的結果）：
```js
// 驗行為：同一個 key 在 TTL 內再次查詢，快取有命中（行為正確）
const first = await service.getProduct('sku1');
const second = await service.getProduct('sku1');  // 應命中快取

expect(second).toEqual(first);           // 回傳值相同（行為正確）
expect(apiClient.fetchProduct).toHaveBeenCalledTimes(1);  // 只打一次 API（可觀察）
```

**例外：** 「互動本身就是規格」—— `OrderPlaced` event **必須** 發出一次（多發 = bug）→ 驗呼叫次數是合法的。判斷標準：「少呼叫 / 多呼叫，用戶行為有沒有差？」有差 → 驗；沒差 → 不驗。

---

## Reviewer 紅旗清單（30 秒掃描）

- ✗ 測試名都是 `should work` / `test 1` / `happy case`
- ✗ 測試裡只有 `toBeTruthy` / `toBeDefined`
- ✗ Mock 比真實程式碼還多
- ✗ `test.skip` / `xit` / `only` 出現在 main 分支
- ✗ Retry 機制（`jest --retry` / `flaky: true`）
- ✗ Commit message 寫「fix flaky test」但 diff 是加 sleep / 改 timeout
- ✗ PR 加 200 行實作但只加 1 條測試
- ✗ Table-driven 每個 case 是不同行為
- ✗ 測試 import `internal/` 套件直接呼叫——應透過 testutil helper
- ✗ 看到 `os.Chdir` / `process.chdir` / `os.Setenv` 而非 `t.Setenv`
- ✗ Helper 失敗只 `t.Log` 沒 `t.Fatal`
