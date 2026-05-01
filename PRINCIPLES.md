# Principles — 10 條核心原則

> 操作層守則在 `AGENT.md`，這份是「**為什麼**」。當你在 edge case 不確定怎麼判斷時讀這份。

---

## 1. 測試的目的是發現 bug，不是證明程式有用

「測試全綠」是**無意義的句子**，除非你能加上「實作被破壞時，至少 95% 會 fail」。

→ Coverage 是 lagging indicator，**mutation testing** 才是真實成績單。

## 2. 獨立性

每條測試**單獨跑**也要通過，與順序無關。

→ CI 會 shard / 平行；單獨 debug 時你不會跑整個 suite。Setup 自己負責，cleanup 用 transaction rollback / fixture isolation。

## 3. 確定性 — Flakiness 是 defect 不是個性

同樣輸入永遠同樣輸出。**容忍一次，整個團隊就學會無視紅燈。**

主要 flakiness 來源：時間（注入 fake clock）、隨機（seeded RNG）、順序（sorted assertion）、並行（deterministic synchronization）、外部 IO（隔離邊界）。

**鐵律：**
- 看到 flaky 立刻找根因，不要 retry / skip
- 連續 flake 3 次 → 自動 quarantine（time-bound 7 天，到期未修就刪）
- **嚴禁** 用 framework retry flag（`jest --retry` / `flaky: true`）當解法
- 詳見 `TEST-STRATEGY.md` §7

## 4. 可讀性 > 簡潔性

測試是**可執行的規格文件**。將來的 reader 必須在 30 秒內看出：(1) 在驗什麼、(2) 為什麼預期是這個結果、(3) 失敗代表什麼壞了。

不要為了 DRY 抽象到看不懂——測試的重複比抽象的代價更低。

## 5. Arrange-Act-Assert（AAA）

```
Arrange — 準備輸入與環境
Act     — 觸發被測行為（**理想上一行**）
Assert  — 驗證結果
```

需要 act 兩次 = 兩條測試。

## 6. 一條測試只測一個概念

允許多個 `expect`，但它們必須**共同描述同一個概念**。

例：「user 註冊成功」可同時驗 `回傳 user.id` + `DB 有這筆` + `歡迎信被排程`——三件事**共同構成**註冊成功。
但「註冊成功 + 重複 email 失敗 + 密碼太短失敗」是 **3 條測試硬塞成 1 條**。

## 7. 失敗訊息必須能定位根因

斷言越具體，診斷越快。

✗ `expect(x).toBeTruthy()` — 失敗只告訴你「不是 truthy」，是 null / 0 / "" / false 哪一個？
✓ `expect(x.status).toBe(200)` 然後 `expect(x.body.userId).toBe(...)`

**不用 `toBeTruthy` / `toBeDefined` / `not.toBeNull` 當主要斷言**，除非你**真的**只在乎「存在」。

## 8. 驗證行為，不驗證實作

綁實作的測試（「呼叫了 `cache.get` 三次」）在 refactor 時大量壞掉但**抓不到任何 bug**。

預設用 black-box（給輸入 / 看輸出 / 看可觀察 side effect）。**只在「互動本身就是規格」時才驗互動**（例：「下單必須發 OrderPlaced event」）。

## 9. 看到 red 才相信 green

**新測試必須先看到它 fail 一次**，才能相信它「會在實作壞掉時保護你」。

非 TDD 時的做法：寫完測試後**故意把實作打壞**（改一個比較運算子、註解掉一行）→ 跑 → 紅 → 還原 → 跑 → 綠。

10 秒的動作，是「測試是真貨還是假貨」的唯一驗證。

## 10. 測試自己聲明意圖（self-documenting）

每條測試**不看實作**，從函式名 + docstring 就應該知道：在驗什麼、怎麼安排、失敗代表什麼。

**命名：** 完整句子描述行為。

```
returns 401 when token is expired
rejects transfer when balance is insufficient
TestStartFeatureBranch
TestFinishWithMergeConflict
```

**強制 docstring：**

```
// <一句話：這個測試在驗什麼>
// Steps:
// 1. <準備>
// 2. <觸發>
// 3. <驗證>
```

**一個 function 一個 scenario。** 例外：純函式 input/output 對照可用 table-driven。整合 / 行為測試一律拆。詳見 `ANTI-PATTERNS.md` §12。

---

## 附錄：原則衝突時的優先順序

```
正確性 > 確定性 > 可讀性 > 簡潔性 > 速度
```

例：可以為了確定性讓測試變慢（用真 DB 而非 mock）；不該為了速度引入 flakiness。
