# QA Testing Cheatsheet

> 快速參考。完整說明可接著看 [AGENT.md](./AGENT.md)。

---

## 三條紅線

1. **不要寫一條你不確定會在實作壞掉時 fail 的測試。** 寧願不寫。
2. **不要 mock SUT 自己的邏輯。** Mock 只能止於外部邊界（DB / network / time / filesystem / 第三方 SDK）。
3. **不要靠 `sleep(N)` 等待 async 結果。** 用 deterministic event / fake clock / `waitFor`。

---

## 選測試層級

| 條件 | 層級 |
|---|---|
| 純邏輯、無 IO | Unit |
| 與自己擁有的基礎設施互動（DB / queue / cache / HTTP handler） | **Integration**（首選）|
| 跨服務 / 跨團隊邊界 | Contract |
| 關鍵商業流程端到端煙霧（≤10 條） | E2E |

**預設：** unit 與 integration 都能驗時 → **Integration**。

---

## 12 類測試（寫第一行測試前枚舉）

| # | Category | 一行提示 |
|---|---|---|
| 1 | Happy path | 最典型成功流程 |
| 2 | Boundary | `<` `>` `length` 附近至少 3 點（剛內 / 剛邊上 / 剛外）|
| 3 | Negative inputs | null / 錯型別 / malformed / injection 字符 |
| 4 | Error paths | 依賴失敗時 throw 什麼 + 不該發生的側效果沒發生 |
| 5 | State transitions | 合法 + **非法**轉換；非法時狀態不變 |
| 6 | Concurrency | 雙擊 / 競態 / idempotent consumer |
| 7 | Side effects | 該寫的有寫；**失敗時真的沒寫** |
| 8 | Resource lifecycle | 連線 / handle 是否清乾淨（含 throw 路徑）|
| 9 | Security | authn / authz / 跨 tenant 拒絕 / injection |
| 10 | Perf / scale | n=0 / n=1 / n=large 仍合約內 |
| 11 | Contract | API schema / event payload 跨服務相容 |
| 12 | Backward compat | 舊資料能讀 / migration idempotent |

---

## 每條測試必須有

1. **行為敘述式函式名**：`returns 401 when token is expired`
2. **結構化 docstring**：
   ```
   <一句話：在驗什麼>
   Steps:
   1. 準備
   2. 觸發
   3. 驗證
   ```
3. **AAA 三段視覺可分**（Arrange / Act / Assert）
4. **具體 assertion**：`toBe(350)` 不是 `toBeTruthy()`
5. **Error path** 斷言具體 error type + 不該發生的側效果沒發生

---

## Test Doubles 速查

| 類型 | 用途 | 驗互動？|
|---|---|---|
| **Stub** | 回傳固定值 | 否 |
| **Mock** | 互動本身是規格（必須發 event）| 是 |
| **Fake** | 輕量真實實作（in-memory DB）| 否 |
| **Spy** | 真實行為 + 觀察呼叫 | 是 |

規則：「互動是規格（少呼叫用戶有感）→ Mock；互動是細節 → Stub/Fake」。

---

## Top anti-pattern symptoms

- `should work` / `test1` / 沒 docstring，CI 紅燈時看不出 intent
- `toBeTruthy` / `toBeDefined` 當主斷言，沒有具體 expected
- Mock 比真實程式碼還多，甚至 mock SUT 自己的 helper
- `sleep` / 加 timeout / retry 掩蓋 flake，而非等 deterministic condition
- Error path 只驗 `toThrow()`，沒驗具體 error type 和「沒副作用」
- Table-driven 把不同 scenario 塞進同一個測試，失敗難定位
- `os.Chdir` / `process.chdir` / `os.Setenv` 污染全域狀態

---

## 交付前 5 項自查

- [ ] 每條測試有行為名 + docstring
- [ ] 每條單獨跑都通過（無順序依賴）
- [ ] 沒有 `sleep` / `setTimeout` 等 async 等待
- [ ] Error path 斷言**具體 error type**
- [ ] 核心測試做過 mutation 自我測試（打壞實作 → 確認測試變紅）

---

## 30 秒 Reviewer 紅旗

- 函式名 `test1` / `should work` / 沒 docstring
- `toBeTruthy` / `toBeDefined` 當主斷言
- Mock 比真實程式碼還多
- `test.skip` / `only` 在 main 分支
- `jest --retry` / `flaky: true` 蓋住 flake
- `os.Chdir` / `process.chdir` / `os.Setenv` 而非 `t.Setenv`
