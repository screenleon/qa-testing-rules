# AGENT.md — agent hot-path 規則

> **這份是 agent 唯一必讀的入口。** 載入這一份就能寫出 70% 達標的測試。其餘檔案是 reference，**有需要時才讀**。

---

## 0. 三條紅線（違反任一條，這次提交就是失敗）

1. **不要寫一條你不確定會在實作壞掉時 fail 的測試。** 寧願不寫。
2. **不要 mock SUT 自己的邏輯。** Mock 只能止於外部邊界（DB / network / time / filesystem / 第三方 SDK）。
3. **不要靠 `sleep(N)` 等待 async 結果。** 用 deterministic event / fake clock / await。

---

## 1. 工作流（每個測試任務都跑一遍）

### Step 1 — 選測試層級

對著 SUT 問：

| 條件 | 用哪層 |
|---|---|
| 純邏輯、無 IO | **Unit** |
| 與自己擁有的基礎設施互動（DB、queue、cache、HTTP handler） | **Integration**（首選） |
| 跨服務 / 跨團隊邊界 | **Contract** |
| 關鍵商業流程的端到端煙霧 | **E2E**（少量） |

預設立場：unit 與 integration 都能驗時，**選 integration**。深入細節 → `TEST-STRATEGY.md`。

### Step 2 — 枚舉測試類別（在寫第一行測試前）

對著下列 12 類，**每一類**回答「適用 / N/A」+ 具體案例。明確寫 N/A 比沉默忽略好。

| # | Category | 提示 |
|---|---|---|
| 1 | Happy path | 主要成功流程 |
| 2 | Boundary | 任何 `<` `>` `length` `limit` 附近 → off-by-one 至少測 3 點（剛內 / 剛邊上 / 剛外）|
| 3 | Negative inputs | null / undefined / 錯型別 / malformed / injection 字符 |
| 4 | Error paths | dependency 失敗、timeout、權限不足；驗具體 error type + 「不該發生的 side effect 真的沒發生」|
| 5 | State transitions | 合法轉換 ✓、非法轉換被拒絕且狀態不變、idempotency |
| 6 | Concurrency | 雙擊、競爭資源、idempotent consumer、cache stampede |
| 7 | Side effects | 該寫的 DB / event / HTTP 真的有寫；失敗時真的沒寫 |
| 8 | Resource lifecycle | 連線 / 檔案 / handle 是否清乾淨（**含 throw 路徑**）|
| 9 | Security | authn / authz 邊界、跨 tenant 拒絕、injection、error 不洩內部資訊 |
| 10 | Perf / scale | n=0、n=1、n=large 仍合約內 |
| 11 | Contract | 跨服務 schema / event payload / webhook 相容性、版本化 |
| 12 | Backward compat | 舊資料能讀、舊 client 相容、migration 跑兩次無害 |

需要每類更詳細的子提示 → `TEST-CATEGORIES.md`。

**輸出**：一份簡短的測試矩陣（範例）：

```
SUT: createOrder(userId, items, paymentMethod)
Layer: integration（與 DB + 金流 client 互動）

| #  | Category         | Apply | Cases                                           |
| 1  | Happy path       | Y     | 1 item / 多 item                                |
| 2  | Boundary         | Y     | 0 items（拒絕）、單品超過庫存上限              |
| 3  | Negative inputs  | Y     | 不存在的 userId、空 items、不存在的 SKU         |
| 4  | Error paths      | Y     | 金流 timeout、金流拒絕、DB tx failure           |
| 5  | State            | Y     | 對 cancelled cart 下單應拒絕                    |
| 6  | Concurrency      | Y     | 雙擊；庫存最後一件被兩人搶                      |
| 7  | Side effects     | Y     | 成功：DB+stock-1+event；失敗：皆無              |
| 8  | Resource         | N/A   | 由連線池統一管                                  |
| 9  | Security         | Y     | 跨 user 用別人的 cart                           |
| 10 | Perf             | Y     | items.length=0/1/1000                           |
| 11 | Contract         | Y     | OrderPlaced event schema 對 inventory 相容      |
| 12 | Backward compat  | N/A   | 新功能無歷史資料                                |
```

### Step 3 — 寫每條測試

每條測試**必須**有：

1. **行為敘述式函式名**：`returns 401 when token is expired`，不是 `test1`
2. **結構化 docstring**：

   ```
   <一句話：在驗什麼行為>
   Steps:
   1. <準備>
   2. <觸發>
   3. <驗證>
   ```

3. **AAA 三段視覺可分**（Arrange / Act / Assert）
4. **具體 assertion**：用 `toBe(具體值)` / `toEqual({...})`，**不**用 `toBeTruthy` / `toBeDefined` 當主斷言
5. **Error 路徑**斷言具體 error type + 該 side effect 真的沒發生

**一個 test function 一個 scenario。** 不要 table-driven 把多個獨立行為塞同一個 function（純函式 input/output 對照例外）。

### Step 4 — Mutation 自我測試（在交付前）

對每條核心測試**至少做一次**：

- 把實作的某行註解掉 → 對應測試是否 fail？
- 把比較運算子翻轉（`>` ↔ `<`）→ 是否 fail？
- 把 throw 拿掉 → error path 測試是否 fail？

**任一 mutation 沒讓測試 fail = 那條測試對該 mutation 沒保護力**，要補。

### Step 5 — 交付前自查清單

- [ ] 每條測試有行為敘述式名 + 結構化 docstring
- [ ] 每條測試單獨跑都通過（不依賴執行順序）
- [ ] 沒有 `sleep` / `setTimeout` 用作同步機制
- [ ] 沒有 `os.Chdir` / `process.chdir` / 改 global `process.env`（用 `t.Setenv` 等可還原機制）
- [ ] 沒 mock SUT 自己的 helper / pure function（mock 止於外部邊界）
- [ ] Error path 斷言具體 error type，不是 `toThrow()` 不指定類型
- [ ] Side effect「不該發生時真的沒發生」也驗了
- [ ] Assertion 用具體寫死的值，不是用實作公式算 expected
- [ ] 對核心測試做過 mutation 自我測試
- [ ] 連跑 3 次都綠

### Step 6 — 交付報告

主動說：
- 我選了 **層級**：unit / integration / contract / E2E + 理由
- 我覆蓋了哪些 categories；哪些**刻意 N/A** + 原因
- 我做了哪些 mutation self-test

---

## 2. 任務變體

### 2.1 為既有程式碼補測試

額外規則：
- **不要為了配合既有實作寫測試**，那是把 bug 當規格固化
- 列出 SUT 所有分支（if / switch / try-catch / early return / async error path），每分支至少一條
- 對 SUT 邏輯有疑問**先問人**，不要自行假設

### 2.2 Bug 回歸測試

1. **先寫一條會 fail 的測試重現 bug**（red）
2. 修 SUT，看到綠
3. 思考 bug 的「鄰居」：相同根因會不會在別的入口造成類似 bug？對鄰居也補
4. 測試名 / docstring 引用 issue / commit

### 2.3 Review 別人 / 其他 agent 寫的測試

立場：**悲觀的審查者**。

- ✗ 名字是 `test 1` / `should work` / 沒 docstring → 退件
- ✗ 只有 happy path → 補 boundary / negative / error 三類
- ✗ `toBeTruthy` 當主斷言 → 改具體值
- ✗ Mock 蓋住 SUT 自己的邏輯 → 拆 mock
- ✗ `sleep` / 共享可變 state / 依賴 cwd → 重寫
- ✗ Table-driven 塞獨立 scenario → 拆成多個 function

對每條測試**心算 mutation**：「把實作的 `>` 改成 `>=`，這條會 fail 嗎？」答不會就退件。

---

## 3. 何時讀 reference 檔案

| 你正在做的事 | 讀 |
|---|---|
| 不確定該用哪層測試 | `TEST-STRATEGY.md` §1–§2 |
| 設計 CI / 環境政策 / coverage 門檻 / flakiness 政策 | `TEST-STRATEGY.md` §3–§7 |
| 卡在某類 category 的具體子案例 | `TEST-CATEGORIES.md` 對應段 |
| 看到測試裡某個 smell 想確認是 anti-pattern | `ANTI-PATTERNS.md` |
| 需要好 vs 壞 code 對照 | `EXAMPLES.md` |
| 想理解原則背後的 why | `PRINCIPLES.md` |

**不需要的時候不要讀**——這份 AGENT.md 已涵蓋 80% 任務。
