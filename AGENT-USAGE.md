# Agent Usage — 給 AI coding agent 的入口文件

> 如果你是 AI agent 而你正在被要求寫或審查測試，先讀完這份文件，再讀對應的子文件。
> 不要跳過枚舉步驟。不要憑直覺寫測試。

## 你的任務分類

判斷你接到的是哪一類任務，然後跳到對應段落：

- **A. 為新功能 / 新模組寫測試** → 讀 §1
- **B. 為既有但無測試的程式碼補測試** → 讀 §1 + §2
- **C. 修一個 bug 後補回歸測試** → 讀 §3
- **D. Review 別人或其他 agent 寫的測試** → 讀 §4

---

## §1. 寫新測試的標準流程

**強制步驟，不可省略。**

### Step 0 — 選對測試層級

打開 [`TEST-STRATEGY.md`](./TEST-STRATEGY.md) §1–§2，回答：「這個 SUT / scenario 該用 **unit / integration / contract / E2E** 哪一層測？」

預設立場（節錄）：
- 純邏輯、無 IO → unit
- 與自己擁有的基礎設施互動（DB、queue、cache、HTTP handler）→ **integration（首選）**
- 跨服務 / 跨團隊邊界 → contract
- 關鍵商業流程的端到端煙霧 → E2E（少量）

把選擇與理由寫在矩陣最上方。

### Step 1 — 枚舉測試類別（在寫第一行測試前）

打開 [`TEST-CATEGORIES.md`](./TEST-CATEGORIES.md)，**逐項**檢視 11 個分類，對你的 SUT（system under test）回答：

> 「這個分類在這個 SUT 上**適用 / 不適用**？適用的話具體案例是什麼？」

把答案寫成一份簡短的「測試矩陣」交給使用者過目，**或**寫在你接下來的測試檔案最上方的註解區。例如：

```
Test matrix for parseUserInput():
- Happy path: valid email + name → returns User object         [WILL TEST]
- Boundary:   empty string, single char, 10000 chars            [WILL TEST]
- Negative:   null, undefined, number, malformed JSON           [WILL TEST]
- Error:      DB unavailable during validation                  [N/A — pure function]
- Concurrency: N/A — pure function
- ...
```

**不要跳過「N/A」的判定**——明確寫出 N/A 比沉默忽略好，因為你在強迫自己想過一次。

### Step 2 — 寫測試

每條測試上方加結構化 docstring（[`PRINCIPLES.md` §10](./PRINCIPLES.md#10-測試自己聲明意圖self-documenting-tests)）：

```
// <一句話描述這條測試在驗什麼>
// Steps:
// 1. <準備>
// 2. <觸發>
// 3. <驗證>
```

一個 test function 一個 scenario——不要用 table-driven 把多個獨立行為塞進同一個 function（純函式 input/output 對照除外）。

照矩陣寫。一個測試只測一個概念（一個 assertion *concept*，不是一行）。

### Step 3 — 自我審查（在交付前）

打開 [`CHECKLIST.md`](./CHECKLIST.md) 的「寫測試後」段，逐項打勾。
特別是 **mutation 思維**：「如果我把實作的 `>` 改成 `>=`，這條測試會 fail 嗎？」如果不會，這條測試對這個 mutation 沒有保護力，要補。

### Step 4 — 交付

交付時主動報告：

- 我覆蓋了哪些分類
- 我**刻意沒**覆蓋哪些分類，原因是什麼
- 我做了哪些 mutation 自我測試

---

## §2. 為既有程式碼補測試

額外規則：

1. **不要為了配合既有實作而寫測試** — 那等於把 bug 當規格固化下來
2. 先閱讀 SUT 完整程式碼，列出**所有分支**（if、switch、try/catch、early return、async error path）
3. 對每個分支至少一個測試（不是「至少一個 assertion」，是「至少一個會走到該分支」的測試）
4. 發現 SUT 邏輯有疑問時，**先問人**，不要自行假設

---

## §3. Bug 回歸測試

額外規則：

1. **先寫一條會 fail 的測試**重現 bug（red）
2. 再修 SUT，看到測試通過（green）
3. 思考 bug 的「**鄰居**」：相同根因會不會在別的入口造成類似 bug？對鄰居也補測試
4. 在測試名稱或註解中引用 issue / commit，讓未來的人知道這條測試在防什麼

---

## §4. Review 測試

讀 [`CHECKLIST.md`](./CHECKLIST.md) 的 review 段。你的任務是當一個**悲觀的審查者**：

- 假設提交者在偷懶，他在哪裡可能偷懶？
- 哪些 mock 太大，蓋住了應該被驗證的邏輯？
- 哪些 assertion 太弱（`toBeDefined`、`toBeTruthy`、不檢查訊息內容）？
- 有沒有一條測試其實不會因為實作壞掉而 fail？

具體找到問題就直接指出，不要說「整體看起來不錯」。

---

## §5. 三條不可妥協的紅線

無論任何情況：

1. **不要寫一條你不確定會在實作壞掉時 fail 的測試。** 寧願不寫。
2. **不要 mock SUT 自己。** mock 應該止於外部邊界（DB、network、time、filesystem）。
3. **不要靠 `sleep(N)` 等待 async 結果。** 用 deterministic event / fake timer / await。`sleep` 是 flakiness 的種子。

違反任何一條，這次提交就是失敗。

---

## §6. 困惑時的決策樹

```
不知道要不要測？        → 測。寧可多寫，不可漏寫。
不知道怎麼測？          → 讀 EXAMPLES.md，找最像的對照。
測試一直 flaky？        → 不要 retry 掩蓋。讀 ANTI-PATTERNS.md §7。
測試太慢？              → 先確認正確性，再談速度。慢但正確 > 快但漏。
不確定邊界值是哪些？    → 讀 TEST-CATEGORIES.md §2。
覆蓋率高但你心裡發毛？  → 信你的直覺。覆蓋率是 lagging indicator，mutation 才是。
```
