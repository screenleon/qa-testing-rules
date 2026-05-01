# Checklist — 寫前 / 寫後 / Review

三段 checklist。每段都是強制走完，不是「有空再看」。

---

## A. 寫測試前（Pre-write）

> 在打開測試檔之前完成。預估 5–15 分鐘，視 SUT 大小。

- [ ] 我能用一句話說出 SUT **在做什麼**（「這個函式 / endpoint / class 的責任是 ___」）
- [ ] 我選好了**測試層級**（unit / integration / contract / E2E），理由能說清楚（[`TEST-STRATEGY.md`](./TEST-STRATEGY.md) §2）
- [ ] 我列出了 SUT 的**所有輸入維度**（參數、隱式依賴：current user、time、env、feature flag）
- [ ] 我列出了 SUT 的**所有輸出 / side effect**（回傳值、throw、DB write、event、HTTP call、log）
- [ ] 我過完 [`TEST-CATEGORIES.md`](./TEST-CATEGORIES.md) 11 類，標記每類**適用 / N/A** + 具體案例
- [ ] 對每個分支（if / switch / try-catch / early return）我有對應測試
- [ ] 我識別了**哪些是邊界**（對任何 `<`、`>`、`length`、`limit`，至少測 3 點）
- [ ] 我識別了**哪些 mock 是合法的**（外部 IO 邊界）vs **不該 mock 的**（SUT 自己的邏輯）
- [ ] 如果牽涉時間 / 隨機 / 並行，我規劃了如何讓它**確定性**（不靠 sleep）

**輸出：** 一份「測試矩陣」（見 `TEST-CATEGORIES.md` 結尾範例）。沒有矩陣不准開始寫測試。

---

## B. 寫完測試後（Post-write）

> 在交付 / 提 PR 前完成。每條測試逐項過。

### B1. 確定性檢查

- [ ] 沒有 `sleep` / `setTimeout` 用作同步機制
- [ ] 沒有對 `new Date()` / `Date.now()` / `Math.random()` 的隱式依賴
- [ ] 沒有依賴 map / set 的 iteration 順序
- [ ] 連續跑 10 次都綠（最起碼跑 3 次）

### B2. Mutation 自我測試（最重要）

對你新寫的每條核心測試，**至少做一次以下其一**：

- [ ] 把實作的某行註解掉 → 對應測試是否 fail？
- [ ] 把比較運算子翻轉（`>` ↔ `<`、`==` ↔ `!=`） → 是否 fail？
- [ ] 把回傳值改成常數 → 是否 fail？
- [ ] 把 throw 拿掉、改成靜默 return → error path 測試是否 fail？

**任何一個 mutation 沒讓測試 fail = 那條測試對該 mutation 沒有保護力**，要補 assertion 或補測試。

### B3. Assertion 品質

- [ ] 沒有靠 `toBeTruthy` / `toBeDefined` 撐場
- [ ] 數值 / 字串斷言用具體寫死的值（不是「實作算一次」算出來的）
- [ ] error path 不只斷言「會 throw」，還斷言 error type / message / code
- [ ] side effect 不只斷言「有發生」，還斷言「**不該發生時真的沒發生**」

### B4. 隔離與獨立

- [ ] 每條測試單獨跑（`--testNamePattern` 指定）都通過
- [ ] 隨機順序跑（`--randomize`）都通過
- [ ] 測試之間沒有共享可變狀態
- [ ] cleanup 在 fail 路徑也會跑（用 `afterEach` / try-finally / fixture）

### B5. 可讀性

- [ ] 測試名是完整句子描述行為（`returns 401 when token is expired`，不是 `test1`）
- [ ] 每條測試上方有結構化 docstring：一句話描述 + `Steps:` 編號 + 預期結果（[`PRINCIPLES.md` §10](./PRINCIPLES.md#10-測試自己聲明意圖self-documenting-tests)）
- [ ] 一個 test function 只覆蓋一個 scenario（不是把多 case 塞進 table-driven 來節省行數，例外只限純函式 input/output 對照）
- [ ] AAA 三段視覺上可分辨
- [ ] 一條測試只測一個概念
- [ ] 失敗訊息能讓不熟此模組的人 30 秒理解問題

---

## C. Review 別人 / 其他 agent 寫的測試

> 立場：**悲觀的審查者**。假設對方在偷懶，你的工作是抓出來。

### C1. 一眼掃描（30 秒）

- [ ] 測試名是真行為描述還是「test_1」「should_work」
- [ ] 每條測試是否有結構化 docstring（一句話 + Steps）
- [ ] 是否只有 happy path？（看測試數量 vs SUT 複雜度）
- [ ] 是否有 `skip` / `xit` / `only` 殘留
- [ ] 是否有 `setTimeout` / `sleep` 等待 async
- [ ] 是否有 table-driven 把多個獨立 scenario 塞進同一個 function
- [ ] 是否依賴 cwd / env / global state（`os.Chdir` / `process.chdir` / `os.Setenv` 而非 `t.Setenv`）

### C2. 細看 mock

- [ ] mock 是否止於外部邊界？SUT 自己的邏輯有沒有被 mock 掉？
- [ ] 把 mock 列出來：如果這些東西全壞了，這個測試會發現嗎？

### C3. 細看 assertion

- [ ] 主斷言是 `toBe(具體值)` 還是 `toBeTruthy`？
- [ ] error path 有檢查 error type / message 嗎？
- [ ] side effect 有檢查「不該發生時沒發生」嗎？
- [ ] 是否有 assertion 抄 production code 的計算？

### C4. Mutation 心算

- [ ] 對每條測試：「如果我把實作的 `>` 改成 `>=`，這條會 fail 嗎？」
- [ ] 「如果我把整個 function body 換成 `return null`，幾條測試會 fail？」（如果是 0 條，這個 SUT 沒有有效保護）

### C5. 分類覆蓋

- [ ] 對著 [`TEST-CATEGORIES.md`](./TEST-CATEGORIES.md) 11 類，每一類問「有測嗎？」
- [ ] 缺哪一類就直接在 review comment 列出來：「請補 boundary、negative、error path 三類，至少 X 條」

### C6. Review 結論模板

回應格式建議：

```
分類覆蓋：
  ✓ Happy path        2 條
  ✓ Boundary          1 條（建議補 0 / negative number 邊界）
  ✗ Negative inputs   缺
  ✗ Error paths       缺（DB failure、external service timeout）
  ...

具體問題：
  - L42: assertion 是 `toBeTruthy`，請改為 `toEqual({ id: ..., status: 'active' })`
  - L57: mock 了 `validate()`，但 `validate()` 是 SUT 自己的邏輯，不應 mock
  - L78: 用 `setTimeout(..., 100)` 等待 async，請改為 await event

Mutation 檢查（我心算）：
  - 把 L23 `if (n > 0)` 改成 `if (n >= 0)` → 沒測試會 fail，請補 boundary 測試
```

不要說「整體看起來不錯」。要嘛找到具體問題，要嘛說「我已逐項過完上述 checklist，無發現」。
