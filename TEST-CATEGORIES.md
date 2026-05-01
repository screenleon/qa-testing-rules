# Test Categories — 寫測試前的枚舉清單

**這份文件回答的是「要測哪些 scenario」。** 在動筆前，請先回答另一個正交問題：「**這個 scenario 該在哪一層測？**」（unit / integration / contract / E2E）——詳見 [`TEST-STRATEGY.md`](./TEST-STRATEGY.md) §1–§2。兩個維度都要答對。

**這份文件的使用方式：** 在寫**第一行測試之前**，對你的 SUT 逐項過完這 12 類，明確標記每一類「適用 / 不適用」。明確寫 N/A 比沉默忽略好——因為這逼你想過一次。

> 預設立場：除非你能說出「這類不適用，因為 ___」，否則**就要寫**。
> 「想不到」不是不適用的理由，「想不到」代表你還沒有設計完。

---

## 1. Happy path（正向流程）

最常見、最典型的成功輸入產生預期輸出。

**陷阱：** 這是 agent 預設只寫的那一類。如果你的測試**只有**這一類，停下來重讀本文件。

**範例 prompt：**
- 給定典型輸入，函式回傳典型輸出？
- 主要的成功流程能完整跑完嗎？

---

## 2. Boundary values（邊界值）

任何「數量」或「範圍」附近的值。

**通用清單：**
- 數值：`0`、`-1`、`1`、`MAX`、`MIN`、`MAX+1`、`MIN-1`、浮點精度邊界
- 集合：`[]`（空）、`[單一元素]`、極大集合、剛好等於 limit、limit + 1
- 字串：`""`（空）、單字元、Unicode（含 emoji、CJK、組合字符 é vs e + 重音）、超長
- 時間：epoch、年份邊界（1970、2038）、跨日 / 跨月 / 跨年、DST 切換、leap year（2 月 29 日）、leap second
- 分頁：第一頁、最後一頁（剛好滿 / 不滿）、超出範圍頁碼

**規則：** 任何 `<`、`<=`、`>`、`>=`、`length`、`size`、`count` 出現的地方，都有 off-by-one 風險，邊界至少 3 點（剛好內 / 剛好邊上 / 剛好外）。

---

## 3. Negative inputs（無效輸入）

呼叫者「不應該」傳但**可能會傳**的東西。

**通用清單：**
- `null`、`undefined`
- 錯誤型別（給 string 卻收到 number）
- 格式錯誤（malformed JSON、無效 email、非 UTF-8 byte）
- 注入字符（SQL 引號、shell metachar、HTML script 標籤、路徑 `..`）
- 型別正確但語意無效（負數年齡、未來的出生日期、空字串名字）

**判斷 SUT 該如何處理：** 是 throw？回傳 error result？回傳 null？**規格必須明確**——測試在固化這個規格。

---

## 4. Error paths（明確失敗的情境）

當依賴 / 環境壞掉時，SUT 應該怎麼表現？

**通用清單：**
- 外部服務超時 / 5xx / 連線拒絕
- DB connection 斷掉 / transaction rollback
- 磁碟滿、權限不足、檔案不存在
- Auth token 過期 / 無效 / 缺失
- 上游回傳格式錯誤的 payload

**重點：** 不是只測「會 throw」，要測「**throw 的是什麼**」（error 類型、訊息、code）以及「**沒做什麼**」（沒寫 DB、沒發信、沒扣款）。

---

## 5. State transitions（狀態轉換）

如果 SUT 是有狀態的（state machine、訂單流程、會話、多步驟表單）：

- 列出所有合法狀態
- 列出所有合法轉換 → 每個一個測試
- 列出所有**非法**轉換 → 每個一個測試（應被拒絕，且狀態不變）
- idempotency：對同一個動作重複呼叫，結果應一致還是失敗？規格說了算

---

## 6. Concurrency / race conditions

任何牽涉「同一個資源被多個請求碰到」的場景。

**通用清單：**
- 雙擊 submit（同一筆訂單建立兩次？）
- 同時編輯（last-write-wins？optimistic locking 衝突回 409？）
- 庫存扣減競態（最後一件商品被兩人同時下單）
- Cache stampede / thundering herd
- 訊息重送（at-least-once delivery 下，consumer 是否 idempotent？）

**做法：** 不要靠 `sleep` 製造並行，要用 deterministic 工具（barrier、latch、controlled scheduler）。

---

## 7. Side effects（副作用）

對外可觀察的影響，必須驗證**該發生的有發生、不該發生的真的沒發生**。

**通用清單：**
- DB writes：對的 row 改了對的欄位
- HTTP outbound：對的 URL、對的 payload、對的 header（特別是 auth）
- Events / messages：被 emit 到對的 topic / 帶對的 schema
- Files：建立 / 刪除 / 權限 / 內容
- Logs / metrics：關鍵事件有被記錄

**反例情境也要測：** 「驗證失敗時，**不應該**寫 DB」——明確 assert DB 沒被動到。

---

## 8. Resource lifecycle（資源生命週期）

- 開啟的連線、檔案、handle 是否被關閉？
- 即使中途 throw 了，cleanup 是否仍執行？（finally / using / defer）
- 長期執行下是否漏記憶體 / 漏 file descriptor？（必要時用 stress test）

---

## 9. Security（安全邊界）

- **Authn：** 沒登入、登入無效、過期 token
- **Authz：** 登入但角色不對、跨 tenant 存取（user A 試圖讀 user B 的資源）、垂直權限提升
- **Input validation：** SQL / NoSQL / command / LDAP / XML / template injection
- **Output encoding：** XSS、open redirect、SSRF
- **Rate limiting / abuse：** 暴力嘗試、enumeration（不同帳號錯誤訊息相同？）
- **資料外洩：** error message 是否吐出內部資訊（stack trace、SQL、internal hostname）

**至少：** 任何讀寫資源的 endpoint，都要有「跨 tenant 拒絕」的測試。

---

## 10. Performance / scale 邊界

不是 benchmark，是**規格邊界**：
- `n=0` 不爆炸
- `n=1` 不退化（特殊路徑常出 bug）
- `n=large` 仍在合約內（不是 O(n²) 卻宣稱 O(n)）
- 超過 limit 時是優雅拒絕還是 OOM？

---

## 11. Contract / interface compatibility

當 SUT 跨**團隊 / 服務 / 套件**邊界時，consumer 與 provider 之間的契約必須單獨被測。

**通用清單：**
- **API schema：** request / response 的欄位、型別、必填性與 consumer 預期相符（OpenAPI / JSON Schema 驗證）
- **Event payload：** 發布到 message bus 的 event schema 對所有 consumer 仍可解析（向前相容）
- **Webhook delivery：** 對外送出的 payload 對接收方仍滿足 contract
- **Frontend ↔ backend：** UI 真實需要的欄位是否仍由 API 提供，多餘欄位是否仍可被忽略
- **公開套件 API：** 公開的 function signature、type export 與 semver 承諾相符

**要做（也要避免做）：**
- ✓ Contract 必須**版本化**（v1, v2…），不是「現在剛好長這樣」
- ✓ Provider 在發布前驗證新版本對舊 contract 仍相容
- ✓ Consumer 對**期待的 contract** 寫測試，而非「對方今天的實際回應」
- ✗ 不要把 contract test 跟 integration test 混為一談——contract test 不關心 SUT 內部行為，只關心邊界協議

詳見 [`TEST-STRATEGY.md`](./TEST-STRATEGY.md) §1.3。

---

## 12. Backward compatibility / migration

如果 SUT 處理「過去寫入的資料」或「舊 client 的請求」：

- 舊版 schema 的 row 仍能被讀取
- 缺少新欄位時有合理 default
- API 新版本對舊 client 仍相容（或刻意不相容並回對的錯誤）
- Migration script 跑兩次無害（idempotent）

---

## 矩陣輸出格式（建議）

寫測試前產出這樣一份矩陣，附在測試檔頂端或交付訊息中：

```
SUT: createOrder(userId, items, paymentMethod)

| #  | Category               | Apply | Cases                                                |
|----|------------------------|-------|------------------------------------------------------|
| 1  | Happy path             | Y     | 1 item / 多 item / 套用折扣                          |
| 2  | Boundary               | Y     | 0 items（拒絕）、1 item、單品超過庫存上限             |
| 3  | Negative inputs        | Y     | 不存在的 userId、空 items、負數量、不存在的商品 SKU  |
| 4  | Error paths            | Y     | 金流 timeout、金流拒絕、DB transaction failure        |
| 5  | State transitions      | Y     | 對已 cancelled 的 cart 下單應拒絕                     |
| 6  | Concurrency            | Y     | 同 user 雙擊；庫存最後一件被兩人搶                    |
| 7  | Side effects           | Y     | 成功：DB 有 order + 庫存 -1 + event emit；失敗：皆無  |
| 8  | Resource lifecycle     | N/A   | 無顯式 connection 由本層管                            |
| 9  | Security               | Y     | 跨 user 用別人的 cart？                               |
| 10 | Perf / scale           | Y     | items.length=0 / 1 / 1000                             |
| 11 | Contract               | Y     | OrderPlaced event schema 對 inventory service 相容    |
| 12 | Backward compat        | N/A   | 新功能無歷史資料                                      |
```
