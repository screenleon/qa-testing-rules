# Test Strategy — 測試層級、CI 分流、環境政策

`TEST-CATEGORIES.md` 回答的是「**要測哪些 scenario**」（boundary、negative、error…）。
這份文件回答的是「**要在哪一層測**」與「**測試套件怎麼跑、跑在哪、什麼時候跑**」。

兩個問題正交，都要答對。

---

## §1. 四個測試層級

每個 SUT、每個 scenario，都要先回答：「我該用哪一層測？」

| 層級 | 速度 | 真實度 | 主要用途 | 不適合用途 |
|---|---|---|---|---|
| **Unit** | 毫秒 | 低 | 純邏輯、轉換、驗證、計算、狀態轉換、複雜的 error 分支 | 系統邊界互動、資料持久化、跨服務協作 |
| **Integration** | 秒 | 高 | 資料庫存取、API handler、queue consumer、cache、外部 client adapter | 純邏輯（用 unit 更快）、跨服務契約 |
| **Contract** | 秒 | 中 | 服務之間的 schema / payload / 事件契約 | 任何 SUT 內部的行為驗證 |
| **End-to-end** | 十秒 ~ 分 | 最高 | 少數關鍵商業流程的全鏈路煙霧測試 | 任何邊界、錯誤分支、組合爆炸 |

### 1.1 Unit tests

**好用於：**
- 領域規則（business rules）、資料轉換、驗證邏輯、計算
- 狀態機轉換
- 心理上難推理的 error branching

**好的 unit test 標準：**
- 一個明確的行為
- Setup 極小
- 輸入與預期輸出可讀
- 沒有不必要的整合考量
- **幾乎不 mock**——除非 collaboration 本身就是被測對象

**不要做：**
- mock 語言/runtime 內建行為（例如 mock `Array.prototype.map`）
- snapshot 巨型物件而不理解內容
- 斷言實作瑣碎細節而非商業行為

### 1.2 Integration tests

**這是成熟團隊真正建立信心的層級。**

**好用於：**
- Repository 對真實 DB 的行為
- API handler 對真實 web stack
- Queue consumer 處理真實 message payload
- Cache 與持久層的互動
- 外部 client adapter 對 local fake / sandbox

**首選做法：** 用 **container 跑真實基礎設施**（testcontainers / docker-compose），能 local 就 local，不要共享環境。

> 一條較慢、真實的 integration test，常常勝過十條過度 mock 從未碰真實邊界的「unit test」。

### 1.3 Contract tests

**當服務 / 團隊間整合時，contract drift 是高貴的代價。**

**好用於：**
- Consumer-provider 的 API 邊界
- Frontend-backend 的 schema 保證
- Event payload 相容性
- Webhook delivery 契約

**核心要求：**
- Contract **被版本化**（schema 有 v1、v2，不是「現在長這樣」）
- Provider 在發布前**主動驗證**相容性
- Consumer 對**期待的 contract** 做測試，而不是對「對方今天剛好是這樣」做測試

Contract test 是 integration test 與 production incident 之間最常缺席的中間層。

### 1.4 End-to-end tests

**有價值，但只能少量用。**

**好用於：少數高價值流程**
- 登入 / 註冊
- 下單 / 結帳
- 核心 CRUD
- 權限邊界
- Deployment smoke check
- 1–2 個關鍵後台流程

**不要做：**
- 涵蓋每一種排列組合
- 在每條 assertion 裡綁不穩定的 UI 細節
- 把 E2E 當成主要信心來源

> 當一個團隊有上百條脆弱的 E2E test，通常代表其他層級的測試發育不良。

---

## §2. 該選哪一層？

對著 SUT 與 scenario 問三個問題：

1. **這個行為是純邏輯還是與外部系統互動？**
   - 純邏輯 → unit
   - 與外部系統互動 → integration

2. **互動的對象是「自己擁有的基礎設施」還是「另一個服務 / 團隊」？**
   - 自己擁有（DB、queue、cache） → integration
   - 跨團隊 / 跨服務 → contract

3. **這條流程是否關鍵到「不通則用戶無法完成核心目的」？**
   - 是 → 加一條 E2E（不要超過 5–10 條）
   - 否 → 留在 integration 層

### 2.1 預設立場

當 unit test 與 integration test 兩者都能驗證同一件事，**選 integration**——除非：

- 這個 SUT 是純函式（無 IO），那 unit 又快又夠
- 你正在測複雜的計算 / 狀態轉換組合，需要快速跑大量輸入

> 「測試金字塔」是 2009 年的世界觀，當時 integration 很慢、container 很貴。現在 testcontainers 起一個 Postgres 是秒級的事，**金字塔逐漸變梯形 / 獎盃形**：integration 是最寬的一層，unit 在其上保護純邏輯，E2E 在頂端非常薄。

---

## §3. CI 分流策略

**一條 CI pipeline 不夠。** 把測試切成多個 lane，讓**對的訊號在對的階段送達**。

### 3.1 建議分流

#### Fast lane（PR 上每次推送）
目標：**5 分鐘內**給 PR 作者「會不會明顯壞掉」的訊號

- Lint
- Type check
- Unit tests
- 最快的 integration tests（跑得快的核心案例）
- 便宜的 security 檢查（secret scan、dep audit）

#### Confidence lane（merge 到 main 後）
目標：**保護 main 不退化**

- 完整 integration suite
- Contract 驗證
- Migration 檢查
- 選定的 E2E（核心路徑）

#### Deep lane（nightly / scheduled）
目標：**慢但深入的信心**

- 完整 E2E 矩陣
- Performance baseline
- 韌性 / chaos 場景（成熟團隊才做）
- 跨版本相容性

### 3.2 不要做

- 把 E2E 放進 PR fast lane → PR 作者每次等 30 分鐘 → 大家養成 `--no-verify` 的肌肉記憶
- 把所有 lane 寫進同一個 yaml job → 一個慢 test 拖慢全部
- 沒人定期看 nightly 的失敗 → 等於沒跑

---

## §4. 環境政策

| 階段 | 跑什麼 |
|---|---|
| **Local（開發者機器）** | unit + 與你正在改的模組相關的 integration |
| **PR CI** | unit + focused integration + smoke E2E（如果 < 2 分鐘） |
| **Merge / main** | broader integration + contract + 核心 E2E |
| **Nightly** | 全 E2E + slow suite + migration check + resilience |
| **Pre-release** | rollback rehearsal + production-like smoke + alert sanity + canary 驗證 |

**測試不是一道牆，是一連串遞增成本的信心關卡。**

---

## §5. 測試資料策略

### 5.1 偏好

- **Factory / Builder**：可讀的物件建構（`makeUser({ role: 'admin' })`），具名引數，省略的欄位有合理 default
- **小而清晰的 fixture**：意圖明確（`expiredTokenFixture`，不是 `fixture42.json`）
- **Test 自己擁有 seed 資料**：每條測試自己 setup，不依賴「之前某條測試留下的東西」
- **Disposable 環境**：盡可能用 transaction rollback / per-test schema / per-test container

### 5.2 反對

- **共用可變 fixture** 跨 suite：A 改了 B 看到不一樣的 state
- **巨型「典型」資料集**（`mockUser.json` 200 行）：沒人知道哪些欄位是這條測試在意的
- **Production data 的 dump**：個資、合規、遺漏 corner case
- **依賴外部 sandbox 的 seed**（「這個 test account 在 stripe sandbox 已經設好了」）：不可重現

### 5.3 Custom matchers

對於**領域內反覆出現的斷言**，寫 custom matcher 提升可讀性：

```js
// 好：表達領域意圖
expect(graphA).toEqualGraph(graphB);
expect(response).toBeAuthorizedFor('admin');
expect(order).toBeInState('pending');

// 不好：每次手寫
expect(graphA.triples.sort()).toEqual(graphB.triples.sort());
```

**規則：** 只有當同一個斷言模式出現 **3 次以上**，才抽 custom matcher——避免過早抽象。

---

## §6. Coverage 哲學

**Coverage 是 weak signal，不是品質證明。**

### 6.1 Coverage 可以拿來：
- 找明顯沒測到的區域（「這個 module 0% 覆蓋率，至少先補一條」）
- 防止關鍵 module 意外退化（critical path 設下限門檻）
- 引導 review 對話（「這個 PR 把覆蓋率從 80% 砍到 60%，為什麼？」）

### 6.2 Coverage 不要拿來：
- 證明品質（高覆蓋率 + 弱 assertion = 沒保護的假象）
- 獎勵測試數量
- 對每個 package 強制統一門檻而不分風險

### 6.3 比 coverage 更該追蹤的指標
- **Mutation score**（PIT、Stryker 等工具）：實作被打壞時，多少 % 的 mutation 會被測試抓到
- **Flake rate**：測試套件中 flaky 測試的比例與修復時間
- **Mean time to red signal**：commit 到 CI 報錯之間的時間
- **Time-to-fix flaky test**：發現 flaky 到修好的時間

---

## §7. Flakiness 政策

**Flaky 測試是 defect，不是個性。** 容忍它一次，整個團隊就學會無視紅燈。

### 7.1 政策（建議寫進團隊規範）

1. Flaky test 視為 **bug ticket**，立刻開單
2. 連續 flake N 次（例如 3 次） → **自動 quarantine**（隔離但 visible）
3. Quarantine 期 **time-bound**（例如 7 天），到期未修 → **刪除**
4. 每週 / 每月看一次 flake rate，超過閾值就停下來修
5. **不允許 retry 機制當解法**（jest `--retry`、test framework 的 retry flag）——retry 是把 flake 從可見變不可見

### 7.2 修 flaky test 的順序

1. **找根因**——通常是時間 / 並行 / 共享狀態 / 真實 IO 之一
2. **本地連跑 100 次** 確認可重現
3. 重構成確定性（fake clock、deterministic event、isolated state）
4. **重新連跑 100 次** 都綠，才算修好
5. **不要靠 `sleep` 加長 timeout 來「修」**——那是把症狀蓋住

---

## §8. 一句話總結每段

- **層級**：unit 給純邏輯、integration 是主力、contract 守服務邊界、E2E 只放關鍵流程
- **CI**：分 fast / confidence / deep 三 lane，對的訊號送對的階段
- **環境**：local 跑得到的事不要丟 CI；CI 跑得到的事不要等 nightly
- **資料**：factory > fixture > dump；test 自己擁有 seed
- **Coverage**：弱信號，看 mutation 與 flake rate 才是真實
- **Flakiness**：defect，不可容忍，不可 retry 蓋住
