# Anti-Patterns — 11 種測試反模式

每一條：**症狀 → 為什麼壞 → 怎麼修。**

---

## 1. Happy-Path-Only（快樂路徑測試）

**症狀：** 一個 SUT 只有一條測試，餵正常輸入、斷言正常輸出。

**為什麼壞：** 99% 的 bug 在邊界、錯誤路徑、無效輸入裡。只測快樂路徑等於把覆蓋率撐到 70% 但抓不到任何真實 bug，反而給團隊一種「有測試保護」的虛假安全感。

**怎麼修：** 強迫過 [`TEST-CATEGORIES.md`](./TEST-CATEGORIES.md) 的 11 類枚舉。每個 SUT 至少要有 **happy + boundary + negative + error** 四類。

---

## 2. Testing implementation details（綁實作而非行為）

**症狀：** 測試斷言「`UserService` 內部呼叫了 `cache.get` 三次」、「private method `_normalize` 被呼叫了」。

**為什麼壞：** Refactor 時測試大量壞掉，但**沒有任何 bug 被抓到**——測試在阻撓改善而非保護正確性。久了團隊會怕動程式碼。

**怎麼修：** 改成 black-box：給輸入、看輸出 / 看可觀察 side effect。只在「互動本身就是規格」時才驗證互動（例如「下單必須發 OrderPlaced event」）。

---

## 3. Over-mocking（過度 mock）

**症狀：** 測試裡 mock 了 SUT 所有依賴，包括 SUT 自己呼叫的 helper。最後測試其實只在驗證 mock 被照預期呼叫。

**為什麼壞：** 你 mock 掉的東西如果有 bug，你的測試永遠看不到。極端情況下：實作整個被刪掉、測試還會通過。

**怎麼修：**
- mock **止於外部邊界**（DB、network、time、filesystem、第三方 SDK）
- SUT 自己的 helper / pure function：**不要 mock**，讓真的程式碼被執行
- 寧可用 fake / in-memory implementation 也不要 mock

---

## 4. Always-passing tests（永遠通過的測試）

**症狀：** assertion 寫錯（拼錯 method、assert 在 callback 裡但 callback 沒被呼叫、async assertion 沒被 `await`）導致 assertion 從未真正執行。

**為什麼壞：** 看似綠燈、其實裸奔。

**例：**
```js
// 壞：promise 沒 await，測試在 assertion 跑之前就結束
test('user is created', () => {
  service.create(input).then(u => expect(u.id).toBeDefined());  // never awaited
});
```

**怎麼修：**
- async 測試強制 `await`
- 寫完測試後**故意把實作打壞**驗證測試會 fail（mutation 自我測試）
- assertion 計數器：用 `expect.assertions(n)` 確保至少 n 個 assert 跑過

---

## 5. Order-dependent tests（執行順序依賴）

**症狀：** Test A 建資料、test B 查資料、test C 改資料。單獨跑 B 就 fail。

**為什麼壞：** 平行 / shard 執行時隨機壞、單獨 debug 時無法重現、新增一條測試可能打壞看似不相關的另一條。

**怎麼修：** 每條測試 setup 自己需要的全部前置狀態，cleanup 時還原。fixture / transaction rollback / 每測試獨立 schema。

---

## 6. Shared mutable state（共用可變狀態）

**症狀：** 測試共用一個 module-level 變數 / 全域 singleton / 沒重置的 cache。

**為什麼壞：** 一條測試改了 state，下一條看到污染後的 state 而通過或失敗——典型的 flaky 來源。

**怎麼修：** 每條測試 fresh 一份。`beforeEach` reset，不要 `beforeAll` 然後共用。

---

## 7. Time / async flakiness（時間相依不穩定）

**症狀：**
- `setTimeout(() => expect(...), 100)` 等回呼
- `await sleep(500)` 等 race 解決
- 直接用 `new Date()`、`Date.now()`，到了某個時區 / 跨日就壞

**為什麼壞：** sleep 在快機器上太快（assertion 跑之前 callback 還沒完成）、慢機器上太慢（CI 超時）、timezone 切換時直接改變語意。

**怎麼修：**
- 注入時間（clock abstraction）→ 測試裡用 fake clock
- 用 deterministic event（promise resolve、event emitter、queue drain）替代 sleep
- 真的需要等：用 `waitFor(condition, timeout)` 但 condition 必須是**可重複檢查**的

---

## 8. Network / external IO in unit tests

**症狀：** unit test 真的去打 production API、真的連線到外部 DB、真的讀 `~/.config`。

**為什麼壞：** 慢、不穩、依賴外部可用性、可能改到別人的資料、CI 環境不一定有這些資源。

**怎麼修：**
- Unit / component 層：mock / fake 外部邊界
- Integration 層：用 docker-compose / testcontainers 起隔離的真服務
- E2E 層：才碰真的鏈路

---

## 9. Assertion duplicates production logic（斷言抄實作）

**症狀：**
```js
// 壞
const expected = items.reduce((s, i) => s + i.price * i.qty, 0);
expect(calculateTotal(items)).toBe(expected);
```

**為什麼壞：** 你在用「實作算一次」對「實作算一次」。如果實作的公式錯了，你的 expected 也跟著錯，測試還是綠的。

**怎麼修：** 用**手算過、寫死的具體值**：
```js
// 好
const items = [{ price: 100, qty: 2 }, { price: 50, qty: 3 }];
expect(calculateTotal(items)).toBe(350);  // 100*2 + 50*3
```

---

## 10. God test（巨型測試）

**症狀：** 一條測試 setup 三屏、act 五次、assert 二十條，名字叫 `test full flow`。

**為什麼壞：** fail 時看不出哪段壞了；改一個小行為要改整個測試；新人不敢動。

**怎麼修：** 拆成多條，每條一個概念。共用 setup 抽 fixture。

---

## 11. Snapshot rot（殭屍 snapshot）

**症狀：** snapshot 測試 `--update` 一鍵更新，沒人真的看 diff，過幾個月 snapshot 已經不知道在保護什麼。

**為什麼壞：** snapshot 變成「凍結現狀」而不是「規格」，bug 進去也會被當成預期變化更新掉。

**怎麼修：**
- snapshot 限縮到**穩定的、語意明確的輸出**（serialize 後的 DTO、render 後的 accessibility tree）
- 不要 snapshot 整個 HTML / 整個 console output
- 更新 snapshot 必須在 PR 中**逐項過 diff**並在描述說明變更原因
- 替代方案：用具體 assertion（`expect(rendered.title).toBe('Welcome')`）取代 snapshot

---

---

## 12. Table-driven 塞整合 / 行為 scenario

**症狀：** 一個 test function 內用 `testCases := []struct{...}` 跑 5–10 個案例，但每個案例其實都是**獨立的行為**（不同的 setup、不同的 assertion 模式、不同的 error path）。

```go
// 壞
func TestMergeStrategy(t *testing.T) {
    for _, tc := range []struct {
        name, branchConfig, commandConfig, flag, expected string
    }{
        {"branch_default",          "merge",  "",             "",            "merge"},
        {"command_overrides",       "merge",  "rebase=true",  "",            "rebase"},
        {"flag_overrides_command",  "merge",  "rebase=true",  "--no-rebase", "merge"},
    } {
        t.Run(tc.name, func(t *testing.T) { /* ... */ })
    }
}
```

**為什麼壞：**
- 失敗訊息混在 sub-test report 裡，要兩層才能定位
- 修一個 case 可能誤動共用 setup 影響其他 case
- 函式名變模糊（`TestMergeStrategy` 不告訴你具體在驗哪條規則）
- 不易部分執行 / 暫時 skip 單一 case

**怎麼修：** 一個 scenario 一個 function，名字描述具體規則：

```go
// 好
func TestMergeStrategyBranchDefaultIsMerge(t *testing.T) { /* ... */ }
func TestMergeStrategyCommandConfigOverridesBranch(t *testing.T) { /* ... */ }
func TestMergeStrategyFlagOverridesCommandConfig(t *testing.T) { /* ... */ }
```

**唯一可接受 table-driven 的場景：** 純函式的 input/output 對照（`validateEmail`、`parseVersion` 之類），其中每個 row 只是不同輸入、相同 assertion 模式。

---

## 13. 隱形的 cwd / env / global state 依賴

**症狀：** 測試靠 `process.chdir()` / `os.Chdir()` 切到某目錄、靠某 env var 已被設好、靠某 global singleton 已初始化才能通過。

```go
// 壞：依賴 cwd 全域狀態
func TestFoo(t *testing.T) {
    os.Chdir(testRepoDir)  // 全域狀態！
    git.Checkout("develop")  // 內部函式靠 cwd 找 repo
}
```

**為什麼壞：**
- 平行測試立刻互相污染
- defer 沒跑（panic / 早 return）就污染後續測試
- CI 與 local cwd 不同 → 同樣測試一邊綠一邊紅
- 不易看出測試實際依賴的環境

**怎麼修：**
- 改用**接受 dir / config 作為參數**的函式：`git.CheckoutInDir(dir, "develop")`
- 用 helper 集中管理：所有 helper 內部 `cmd.Dir = testRepoDir`，外部完全不需要 chdir
- 必要時改 env var 必須用 `t.Setenv`（自動還原）而非 `os.Setenv`

---

## 14. 測試沒有 intent（沒名字、沒 docstring、沒 Steps）

**症狀：**

```js
test('test 1', () => { ... });
test('should work', () => { ... });
test('user', () => { ... });   // user 怎樣？
```

**為什麼壞：** CI 紅燈時，看到「test 1 failed」毫無診斷價值；reviewer 必須讀完實作才知道測試在保護什麼，效率低；agent / 工具無法自動分析覆蓋。

**怎麼修：** 測試名是完整句子描述行為 + 結構化 docstring（見 [`PRINCIPLES.md` §10](./PRINCIPLES.md#10-測試自己聲明意圖self-documenting-tests)）：

```js
// 好
/**
 * Returns 401 when access token is expired.
 * Steps:
 * 1. Issue a token, fast-forward fake clock past expiry
 * 2. Call protected endpoint with that token
 * 3. Assert response status is 401 and body contains code "TOKEN_EXPIRED"
 */
test('returns 401 when access token is expired', async () => { ... });
```

---

## 15. 信任 placeholder helper 不檢查它真的有跑

**症狀：** 用 `runGitFlow(t, dir, "init")` 之類的 helper，但沒人驗證 helper 真的有跑命令——它可能是個半成品 stub、或被人改過、或在某個錯誤分支提早 return。測試「通過」其實什麼也沒執行。

**為什麼壞：** 是 anti-pattern #4（永遠通過的測試）的特化版，但因為 helper 是抽象層，更隱蔽。

**怎麼修：**
- 在 helper 失敗時 **`t.Fatalf` 並印 output**——讓任何「沒跑成功」的情況**爆炸而非靜默通過**
- 寫 helper 時加一條 **meta test**：呼叫一次正確路徑、確認真的執行（檢查 side effect 存在）
- 寫 helper 時加一條 **negative meta test**：餵錯參數、確認 helper 真的回 error 而非 swallow

```go
// 好：helper 失敗一定爆炸
output, err := testutil.RunGitFlow(t, dir, "feature", "start", "x")
if err != nil {
    t.Fatalf("RunGitFlow failed: %v\nOutput: %s", err, output)  // 含 output 方便 debug
}
```

---

## 額外觀察：reviewer 的紅旗清單

看到這些，要警覺：

- ✗ 測試名都是 `should work` / `test 1` / `happy case`
- ✗ 測試裡只有 `toBeTruthy` / `toBeDefined`
- ✗ Mock 比真實程式碼還多
- ✗ `test.skip` / `xit` 出現在 main 分支
- ✗ retry 機制（jest `--retry`、`flaky: true` 標記）
- ✗ commit message 寫「fix flaky test」但 diff 是加 sleep / 改 timeout
- ✗ 一個 PR 加了 200 行實作但只加了 1 條測試
- ✗ table-driven test 裡每個 case 是不同行為（不是同模式不同輸入）
- ✗ 測試 import 了 `internal/` 套件並直接呼叫——應該透過 testutil helper
- ✗ 測試裡看到 `os.Chdir` / `process.chdir` / `os.Setenv` 而非 `t.Setenv`
- ✗ helper 失敗只 `t.Log` 沒 `t.Fatal`——測試以為通過實際上沒跑
