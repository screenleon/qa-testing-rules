# Test Strategy — 層級、CI、環境、coverage、flakiness

`TEST-CATEGORIES.md` 答「**測哪些 scenario**」；本檔答「**在哪一層測 / 何時跑 / 怎麼分流**」。兩個維度正交。

---

## §1. 四個測試層級

| 層級 | 速度 | 真實度 | 主用 | 不適合 |
|---|---|---|---|---|
| **Unit** | ms | 低 | 純邏輯、轉換、計算、狀態轉換、複雜 error 分支 | 系統邊界互動、跨服務協作 |
| **Integration** | s | 高 | DB、API handler、queue consumer、cache、外部 client adapter | 純邏輯（用 unit 更快）、跨服務契約 |
| **Contract** | s | 中 | 跨服務 / 跨團隊的 schema / payload / event 契約 | 任何 SUT 內部行為 |
| **E2E** | 10s+ | 最高 | 少數關鍵商業流程的全鏈路煙霧 | 邊界、錯誤分支、組合爆炸 |

### 1.1 Unit
- 幾乎不 mock — 除非 collaboration 本身就是被測對象
- 不要 mock 語言/runtime 內建（例如 `Array.prototype.map`）
- 不要 snapshot 巨型物件

### 1.2 Integration（成熟團隊主力）
用 **container 跑真實基礎設施**（testcontainers / docker-compose）。一條真實的 integration test 常勝過十條過度 mock 的「unit test」。

### 1.3 Contract
- Contract **被版本化**（v1, v2…），不是「現在剛好長這樣」
- Provider 在發布前驗證對舊 contract 仍相容
- Consumer 對**期待的 contract** 寫測試，不是對「對方今天的實際回應」

#### Consumer-Driven Contract Testing（Pact 模式）

傳統 contract test 讓 provider 定義 contract，consumer 靠文件對齊；文件一旦過期就失聯。Consumer-Driven Contract Testing 反轉方向：

1. **Consumer** 在自己的 repo 寫測試，描述「我期待 provider 回傳什麼」
2. Consumer 測試執行後生成 **Pact 檔案**（JSON contract）
3. **Provider** 的 CI 拿這份 Pact 檔驗自己的 API
4. 若 provider 改動破壞任何 consumer 的 Pact，CI 紅燈

工具：JS/TS 用 `@pact-foundation/pact`；Go 用 `github.com/pact-foundation/pact-go`；多 consumer 用 Pact Broker / PactFlow 管理。

這不是「全面引入 Pact」的要求。只有一個 consumer 時，版本化 OpenAPI schema + provider-side validation test 通常足夠。Pact 值得引入的條件：**≥ 2 個 consumer 且有獨立部署週期**。

### 1.4 E2E（少量）
**只用於 5–10 條關鍵流程：** 登入 / 結帳 / 核心 CRUD / 權限邊界 / 部署 smoke。

不要：覆蓋每種排列、綁不穩定的 UI 細節、把 E2E 當主要信心來源。

> 上百條脆弱 E2E 通常代表其他層級發育不良。

---

## §2. 該選哪一層？

```
1. 純邏輯（無 IO）？           → Unit
2. 與自己擁有的基礎設施互動？   → Integration（首選）
3. 跨服務 / 跨團隊邊界？        → Contract
4. 「不通則用戶無法完成核心目的」？ → 加一條 E2E（不超過 5–10 條）
```

**預設立場：** unit 與 integration 都能驗時 → **integration**，除非：
- SUT 是純函式 → unit 又快又夠
- 在測複雜計算 / 狀態組合，需要快速跑大量輸入

> 「測試金字塔」是 2009 年世界觀。Testcontainers 起 Postgres 已是秒級——金字塔逐漸變梯形 / 獎盃形：integration 最寬，unit 守純邏輯，E2E 頂端薄。

---

## §3. CI 分流策略

| Lane | 觸發 | 跑什麼 | 目標 |
|---|---|---|---|
| **Fast** | PR 每次推送 | lint + type + unit + 最快 integration + cheap security | **5 分鐘內**告知 PR 是否明顯壞 |
| **Confidence** | merge 到 main | 完整 integration + contract + migration + 核心 E2E | 保護 main 不退化 |
| **Deep** | nightly / scheduled | 完整 E2E + perf baseline + chaos + 跨版本相容 | 慢但深入信心 |

**不要：** 把 E2E 放進 PR fast lane（PR 作者每次等 30 分鐘 → 養成 `--no-verify` 肌肉記憶）；所有 lane 寫進同一個 yaml job；沒人定期看 nightly 失敗。

---

## §4. 環境政策

| 階段 | 跑什麼 |
|---|---|
| Local | unit + 與正在改的模組相關的 integration |
| PR CI | unit + focused integration + smoke E2E（< 2 分鐘）|
| Merge / main | broader integration + contract + 核心 E2E |
| Nightly | 全 E2E + slow + migration + resilience |
| Pre-release | rollback rehearsal + production-like smoke + alert sanity + canary 驗證 |

> 測試不是一道牆，是**一連串遞增成本的信心關卡**。

---

## §5. 測試資料策略

**偏好：**
- Factory / Builder：`makeUser({ role: 'admin' })`，省略欄位有合理 default
- 小而清晰的 fixture：意圖明確（`expiredTokenFixture`，不是 `fixture42.json`）
- Test 自己擁有 seed
- Disposable 環境：transaction rollback / per-test schema / per-test container

**反對：**
- 跨 suite 共用可變 fixture
- 巨型「典型」資料集（200 行 `mockUser.json`）
- Production data dump（個資、合規、缺 corner case）
- 依賴外部 sandbox 的 seed（不可重現）

**Custom matchers：** 同一個斷言模式出現 **3 次以上**才抽，避免過早抽象。
```js
expect(graphA).toEqualGraph(graphB);
expect(response).toBeAuthorizedFor('admin');
```

---

## §6. Coverage 哲學

**Coverage 是 weak signal，不是品質證明。**

| 拿來 | 不拿來 |
|---|---|
| 找明顯沒測到的區域 | 證明品質 |
| 防止關鍵 module 退化（critical path 設下限）| 獎勵測試數量 |
| 引導 review 對話 | 對每個 package 強制統一門檻而不分風險 |

**比 coverage 更該追蹤：**
- **Mutation score**（PIT、Stryker）：實作被打壞時多少 % 被抓到
- **Flake rate**：flaky 比例與修復時間
- **Mean time to red signal**：commit → CI 紅燈
- **Time-to-fix flaky test**

---

## §7. Flakiness 政策

**Flaky 測試是 defect。** 容忍一次，整個團隊就學會無視紅燈。

**政策（建議寫進團隊規範）：**
1. Flaky test 視為 **bug ticket**，立刻開單
2. 連續 flake N 次（例如 3 次）→ **自動 quarantine**（隔離但 visible）
3. Quarantine **time-bound**（例如 7 天），到期未修 → **刪除**
4. 每週 / 每月看 flake rate
5. **嚴禁** retry 機制（`jest --retry`、`flaky: true`）—— retry 把 flake 從可見變不可見，更糟

**修 flaky 的順序：**
1. 找根因（時間 / 並行 / 共享狀態 / 真實 IO 之一）
2. 本地連跑 100 次確認可重現
3. 重構成確定性（fake clock / deterministic event / isolated state）
4. 重新連跑 100 次都綠 → 算修好
5. **不要靠加長 timeout / 加 sleep 來「修」**

---

## §8 一句話總結

- **層級**：unit 給純邏輯 / integration 主力 / contract 守服務邊界 / E2E 只放關鍵流程
- **CI**：fast / confidence / deep 三 lane，對的訊號送對的階段
- **環境**：local 跑得到的不丟 CI；CI 跑得到的不等 nightly
- **資料**：factory > fixture > dump；test 自己擁有 seed
- **Coverage**：弱信號，看 mutation 與 flake rate
- **Flakiness**：defect，不可容忍，不可 retry 蓋住
