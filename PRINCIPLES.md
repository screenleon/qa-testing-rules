# Principles — 9 條核心原則

這些原則語言無關、框架無關。任何時候疑惑「這個測試該不該寫 / 這樣寫對不對」，回到這份文件。

---

## 1. 測試的目的是發現 bug，不是證明程式有用

> 「我寫了 100 條測試，全部通過。」是無意義的句子。
> 真正有意義的句子是：「**我寫了 100 條測試，當實作被破壞時，至少 95 條會 fail，而且失敗訊息能定位到根因。**」

**推論：**
- 若一條測試在你**故意**把實作改錯時仍然通過，這條測試對該 mutation 沒有保護力，應補強或刪除。
- 覆蓋率（line / branch coverage）是 lagging indicator，**mutation testing** 才是真正的成績單（即使你不跑 mutation 工具，也要在腦中模擬）。

---

## 2. 獨立性（Independence）

每條測試必須能**單獨執行**並通過，與執行順序無關。

**反例：** test A 建立 user，test B 假設那個 user 已存在。
**為什麼：** CI 可能 shard / 平行執行；單獨除錯時你不會想跑整個 suite。

**做法：** 每條測試自己 setup 自己需要的狀態，自己清乾淨（或用 transaction rollback / fixture 隔離）。

---

## 3. 確定性（Determinism）

同樣的輸入永遠得到同樣的結果。**Flaky 測試是測試套件的癌症**——它會逼團隊養成「再跑一次看看」的習慣，從此真實的 bug 也會被當成偶發失敗忽略。

**主要 flakiness 來源：**
- 時間（`Date.now()`、`new Date()`、timezone）→ 用 fake clock / 注入時間
- 隨機（`Math.random()`、UUID）→ 注入 seeded RNG
- 順序（依賴 map 的 iteration order）→ 用 sorted assertions
- 並行（race condition）→ 用 deterministic synchronization 而不是 sleep
- 外部 IO（network、real DB on shared host）→ 隔離邊界

**鐵律：** 看到 flaky 測試**先停下來找根因**，不要 retry、不要 skip。

**Flakiness 是 defect，不是個性：**
- 連續 flake N 次（例如 3 次）→ 自動 quarantine（隔離但 visible），開 bug ticket
- Quarantine 期 time-bound（例如 7 天）；到期未修 → **刪除**
- **嚴禁** 用 framework retry flag（`jest --retry`、`flaky: true` 等）當解法——retry 把 flake 從可見變不可見，是更壞的選擇
- 詳見 [`TEST-STRATEGY.md`](./TEST-STRATEGY.md) §7

---

## 4. 可讀性 > 簡潔性

測試是**可執行的規格文件**。將來有人改壞了 SUT，他第一個會看的是失敗的那條測試——他必須能在 30 秒內理解：
- 這條測試在驗證什麼商業 / 技術行為
- 為什麼預期是這個結果
- 失敗代表什麼壞了

**做法：**
- 測試名稱用完整句子描述行為，不用駝峰簡稱：`returns 401 when token is expired` 勝過 `testExpiredToken`
- 一條測試只說一件事
- 不要為了「DRY」抽象到看不懂——測試的重複比抽象的代價更低

---

## 5. Arrange-Act-Assert（AAA）

每條測試肉眼可分成三段：

```
// Arrange — 準備輸入與環境
const user = makeUser({ role: 'admin' });

// Act — 觸發被測行為（理想上一行）
const result = canDelete(user, post);

// Assert — 驗證結果
expect(result).toBe(true);
```

**Act 應該只有一個動作。** 如果你需要 act 兩次，那是兩條測試。

---

## 6. 一條測試只測一個概念（不是一行 assertion）

允許多個 `expect`，但它們必須共同描述**同一個概念**。

**好：** 一個「user 註冊成功」的測試，可以同時驗證「回傳 user object 有 id」、「DB 裡有這筆」、「歡迎信被排程」——這三件事**共同構成**「註冊成功」的定義。

**壞：** 一個測試又驗證「註冊成功」、又驗證「重複 email 會失敗」、又驗證「密碼太短會失敗」——這是三條測試硬塞成一條。

---

## 7. 失敗訊息必須能定位根因

斷言寫得越具體，失敗時診斷越快。

**爛：** `expect(response).toBeTruthy()` — 失敗只告訴你「不是 truthy」，請問是 `null`、`undefined`、`0`、`""`、`false` 哪一個？
**好：** `expect(response.status).toBe(200)` 然後 `expect(response.body.userId).toEqual(expectedId)`

**鐵律：** 不用 `toBeTruthy` / `toBeDefined` / `not.toBeNull` 當作主要斷言，除非你**真的**只在乎「存在」這件事。

---

## 8. 驗證行為，不驗證實作

測試應該綁在**對外可觀察的行為**上，而不是綁在「`UserService` 內部呼叫了 `cache.get` 三次」這種實作細節。

**為什麼：** 綁實作的測試在 refactor 時會大量壞掉，但**沒有任何 bug 被抓到**——它們在阻撓改善而非保護正確性。

**做法：**
- 優先 black-box 測試（給輸入、看輸出 / 看可觀察 side effect）
- 只有當「呼叫了某外部依賴」**本身就是規格的一部分**（例如：「下單成功必須發出 `OrderPlaced` event」），才驗證互動

---

## 9. 看到 red 才相信 green

**新寫的測試必須先看到它 fail 一次**，才能相信它「會在實作壞掉時保護你」。

**做法：**
- TDD：先寫測試 → 跑（紅）→ 寫實作 → 跑（綠）
- 非 TDD：寫完測試後，**故意把實作打壞**（改一個比較運算子、註解掉一行）→ 跑 → 確認測試紅了 → 還原 → 再跑綠

這個動作只花 10 秒，但它是「這條測試是真貨還是假貨」的唯一驗證。

---

## 10. 測試自己聲明意圖（Self-documenting tests）

每條測試在不看實作的前提下，**讀完函式名 + docstring 就應該知道**：
- 它在驗證什麼行為
- 它怎麼安排場景（哪幾步驟）
- 失敗代表什麼

### 10.1 命名規則

測試函式名是**完整句子**（描述行為），不是駝峰縮寫。建議結構：

```
<行為動詞 + 條件子句>
- returns 401 when token is expired
- rejects transfer when balance is insufficient
- starts feature branch from develop with default config
```

對複雜模組可加分類前綴：
- `Test<Action>`（基本功能）：`TestStartFeatureBranch`
- `Test<Action>With<Modifier>`（特定設定）：`TestStartWithCustomConfig`
- `Test<Action>WithError` / `Test<Action>FailsWhen<Reason>`（錯誤路徑）：`TestFinishWithMergeConflict`

### 10.2 強制性 docstring

每條測試函式上方要有結構化註解：

```
// <一句話：這個測試在驗證什麼>
// Steps:
// 1. <準備>
// 2. <觸發>
// 3. <驗證>
// 4. <清理（如必要）>
```

具體例：

```go
// TestFinishWithMergeConflict tests behavior when finishing a branch that has merge conflicts.
// Steps:
// 1. Sets up a test repository and initializes git-flow with defaults
// 2. Creates a feature branch
// 3. Adds conflicting changes to both feature and develop branches
// 4. Attempts to finish the feature branch
// 5. Verifies the operation fails with InsufficientBalance error and leaves both branches untouched
func TestFinishWithMergeConflict(t *testing.T) { ... }
```

### 10.3 為什麼

- **失敗時的可診斷性**：CI 紅燈時，從測試名 + docstring 就能定位語意，不需要先讀實作
- **Code review 效率**：reviewer 不必逐行讀測試實作就能判斷「測試矩陣有沒有蓋到該蓋的」
- **Agent 友善**：未來的 agent / 工具可以根據結構化註解自動生成測試矩陣 / 覆蓋率報告

### 10.4 一個測試函式，一個 scenario

不要把多個 scenario 塞進同一個 function（無論用 table-driven、用 `if` 還是用 sub-test）來「節省行數」。

**例外：** 對**純函式做 input/output 對照表驗證**時，table-driven 可接受（例如 `validateBranchName` 收 string 回 bool）。整合 / 行為測試**一律一個 function 一個 scenario**。

詳見 [`ANTI-PATTERNS.md` §12](./ANTI-PATTERNS.md)。

---

## 附錄：原則之間的優先順序

當原則衝突時：

```
正確性 > 確定性 > 可讀性 > 簡潔性 > 速度
```

例：你可以為了確定性而讓測試變慢（用真的 DB 而非 mock）；不該為了速度而引入 flakiness。
