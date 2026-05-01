# Test Categories — 12 類枚舉清單

> `AGENT.md` 已含一行版的 12 類速查表。本檔是**深度版**，當某類你不知道該測什麼具體案例時讀對應段。
>
> 預設立場：除非你能說「這類不適用因為 ___」，否則**就要寫**。「想不到」不是 N/A 的理由。

---

## 1. Happy path
最常見、最典型的成功輸入產生預期輸出。
**陷阱：** agent 的預設只有這一類。如果你的測試**只有**這一類，停下重讀本文件。

## 2. Boundary values

任何「數量」或「範圍」附近的值。**任何 `<`、`<=`、`>`、`>=`、`length`、`count` 出現的地方至少測 3 點（剛內 / 剛邊上 / 剛外）。**

| 維度 | 邊界 |
|---|---|
| 數值 | `0`、`-1`、`1`、`MAX`、`MIN`、`MAX+1`、`MIN-1`、浮點精度 |
| 集合 | `[]`、`[單一]`、極大、剛好 limit、limit+1 |
| 字串 | `""`、單字元、Unicode（emoji / CJK / 組合字元 é vs e+◌́）、超長 |
| 時間 | epoch、1970、2038、跨日 / 月 / 年、DST 切換、leap year（2/29）、leap second |
| 分頁 | 第一頁、最後頁（剛滿 / 不滿）、超出範圍 |

## 3. Negative inputs

呼叫者「不應該傳但**可能會傳**」的：

- `null`、`undefined`
- 錯型別（給 string 收到 number）
- Format 錯誤（malformed JSON、無效 email、非 UTF-8）
- Injection 字符（SQL 引號、shell metachar、HTML script、路徑 `..`）
- 型別正確但語意無效（負年齡、未來生日、空字串名字）

判斷 SUT 該如何處理（throw / return error / return null）→ **規格必須明確**，測試在固化規格。

## 4. Error paths

當依賴 / 環境壞掉時 SUT 應該怎麼表現？

- 外部服務 timeout / 5xx / 連線拒絕
- DB connection 斷 / transaction rollback
- 磁碟滿、權限不足、檔案不存在
- Auth token 過期 / 無效 / 缺
- 上游回傳 malformed payload

**重點**：不是只測「會 throw」，要測：
1. **throw 的是什麼**（具體 error type / message / code）
2. **沒做什麼**（沒寫 DB、沒發信、沒扣款）

## 5. State transitions

如果 SUT 是有狀態的（state machine、訂單流程、會話、多步驟表單）：

- 列出所有合法狀態 → 列出所有合法轉換 → 每個一條測試
- 列出所有**非法**轉換 → 每個一條測試（應被拒絕，**且狀態不變**）
- Idempotency：同動作重複呼叫，結果應一致還是失敗？規格說了算

## 6. Concurrency / race conditions

- 雙擊 submit（同筆訂單建立兩次？）
- 同時編輯（last-write-wins？optimistic locking 衝突回 409？）
- 庫存扣減競態（最後一件被兩人同時下單）
- Cache stampede / thundering herd
- 訊息重送（at-least-once delivery 下，consumer 是否 idempotent？）

**做法：** 不靠 `sleep` 製造並行，用 deterministic 工具（barrier / latch / controlled scheduler）。

## 7. Side effects

對外可觀察的影響，必須驗證**該發生的有發生、不該發生的真的沒發生**。

- DB writes：對的 row 改了對的欄位
- HTTP outbound：對的 URL、payload、header（特別是 auth）
- Events：被 emit 到對的 topic / 帶對的 schema
- Files：建立 / 刪除 / 權限 / 內容
- Logs / metrics：關鍵事件有被記錄

**反例情境也要測：** 「驗證失敗時，**不應該**寫 DB」→ 明確 assert DB 沒被動到。

## 8. Resource lifecycle

- 開啟的連線、檔案、handle 是否被關閉？
- **即使中途 throw 了，cleanup 是否仍執行？**（finally / using / defer）
- 長期執行下是否漏 memory / 漏 file descriptor？

## 9. Security

- **Authn**：未登入、登入無效、過期 token
- **Authz**：登入但角色不對、**跨 tenant 存取**（user A 試圖讀 user B 的資源）、垂直權限提升
- **Input validation**：SQL / NoSQL / command / LDAP / XML / template injection
- **Output encoding**：XSS、open redirect、SSRF
- **Rate limiting / abuse**：暴力嘗試、enumeration（不同帳號錯誤訊息相同？）
- **資料外洩**：error message 是否吐 stack trace / SQL / internal hostname

**至少：** 任何讀寫資源的 endpoint 都要有「跨 tenant 拒絕」測試。

## 10. Performance / scale 邊界

不是 benchmark，是**規格邊界**：
- `n=0` 不爆炸
- `n=1` 不退化（特殊路徑常出 bug）
- `n=large` 仍在合約內（不是 O(n²) 卻宣稱 O(n)）
- 超過 limit 時優雅拒絕還是 OOM？

## 11. Contract / interface compatibility

當 SUT 跨**團隊 / 服務 / 套件**邊界時：

- **API schema**：request / response 欄位、型別、必填性符合 consumer 期待（OpenAPI / JSON Schema 驗證）
- **Event payload**：發布到 message bus 的 event 對所有 consumer 仍可解析
- **Webhook delivery**：對外送出的 payload 對接收方仍滿足 contract
- **公開套件 API**：function signature、type export 與 semver 承諾一致

**要做：** Contract 版本化（v1/v2）、provider 發布前驗相容、consumer 對**期待 contract** 寫測試。
**不要：** 把 contract test 跟 integration test 混為一談——contract test 不關心 SUT 內部行為，只關心邊界協議。

詳見 `TEST-STRATEGY.md` §1.3。

## 12. Backward compatibility / migration

如果 SUT 處理「過去寫入的資料」或「舊 client 的請求」：

- 舊版 schema 的 row 仍能被讀取
- 缺少新欄位有合理 default
- API 新版本對舊 client 仍相容（或刻意不相容並回對的 error）
- Migration script 跑兩次無害（idempotent）

---

## 矩陣輸出格式

寫測試前產出，附在測試檔頂端或交付訊息中：

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
