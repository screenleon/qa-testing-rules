# qa-testing-rules

語言/框架無關的 QA 測試規範，給 AI coding agent（Claude Code、Cursor、Copilot、Codex、OpenCode 等）以及人類工程師一份**可被 `@import` 的單一事實來源**，避免每次新專案都要從零講一次「請寫真的測試，不要只寫快樂路徑」。

## 為什麼存在這個 repo

LLM agent 在沒有明確指引時，預設會產出「**happy-path-only**」測試：給 SUT 一個正常輸入，斷言它回傳正常輸出，覆蓋率數字漂亮但**幾乎抓不到任何 bug**。這種測試在實作壞掉時往往仍會通過，等於 0 分。

本 repo 的設計目標：

1. 強迫 agent 在寫測試前**枚舉測試類別**（boundary、negative、error、concurrency…），不是隨手寫一兩條就交差
2. 提供**反模式對照**（壞測試 vs 好測試），讓 agent 有具體 diff 可比照
3. 提供**寫完之後的自我審查 checklist**（mutation 思維、移除 assertion 試試）
4. 不綁定特定語言或框架——範例用 pseudocode，原則普世適用

## 使用方式

### 給 agent（推薦）

在你的專案 `CLAUDE.md` / `AGENTS.md` / `.cursorrules` / `GEMINI.md` 加入：

```md
## Testing rules

When writing or reviewing tests, follow the rules in:
https://github.com/screenleon/qa-testing-rules

Before writing tests, read TEST-CATEGORIES.md and CHECKLIST.md and explicitly
enumerate which categories apply to the SUT. After writing tests, run through
the post-write checklist in CHECKLIST.md.
```

支援 `@import` 語法的工具（Claude Code 等）可以直接：

```md
@github:screenleon/qa-testing-rules/AGENT-USAGE.md
```

### 給人類

當 code review 別人/agent 寫的測試時，把 `CHECKLIST.md` 的 review 段當作 review checklist。

## 檔案索引

| 檔案 | 用途 | 何時讀 |
|---|---|---|
| [`AGENT-USAGE.md`](./AGENT-USAGE.md) | 給 agent 看的「如何使用本 repo」入口 | agent 接到測試任務時 |
| [`PRINCIPLES.md`](./PRINCIPLES.md) | 10 條核心原則 | 任何時候有疑問 |
| [`TEST-STRATEGY.md`](./TEST-STRATEGY.md) | 測試層級（unit/integration/contract/E2E）、CI 分流、環境政策、coverage 與 flakiness 哲學 | 設計測試前選層級時、設計 CI 流程時 |
| [`TEST-CATEGORIES.md`](./TEST-CATEGORIES.md) | 12 類測試分類，寫測試前的枚舉清單 | 寫測試**之前** |
| [`ANTI-PATTERNS.md`](./ANTI-PATTERNS.md) | 15 種反模式 | 寫完自我檢查、code review |
| [`CHECKLIST.md`](./CHECKLIST.md) | 寫前 / 寫後 / review 三段式 checklist | 寫前、寫後、review |
| [`EXAMPLES.md`](./EXAMPLES.md) | 壞測試 vs 好測試對照 | 不確定該怎麼寫時 |

## 核心立場（一句話版本）

> **測試的目的是發現 bug，不是證明程式有用。**
> 一條測試在實作被破壞時不會失敗，這條測試就等於不存在。

## 致謝（Acknowledgments）

本 repo 在內容上參考並濃縮了以下幾份優秀的測試文件：

- [khasky/testing-strategy-playbook](https://github.com/khasky/testing-strategy-playbook) — 測試層級（unit / integration / contract / E2E）的策略觀、CI 分流、coverage 與 flakiness 政策的主要靈感來源
- [gittower/git-flow-next TESTING_GUIDELINES.md](https://github.com/gittower/git-flow-next/blob/main/TESTING_GUIDELINES.md) — 強制性測試 docstring 格式、命名 pattern、「一個 function 一個 scenario」規則、testutil helper 與 cwd 隱形依賴 anti-pattern 的具體靈感
- [SolidOS testing_guidelines.md](https://github.com/SolidOS/solidos/blob/main/documentation/guidelines/testing_guidelines.md) — bug 先寫 reproducing test、custom matchers、漸進測試策略

差異定位：上述參考各自偏重某一面向（策略、規則、實務），本 repo 試圖把三者整合成「**agent 可逐步執行的工作流**」（先選層級 → 枚舉 categories → 寫 + docstring → mutation 自我審查 → review），並用 anti-patterns + good/bad 對照當主要 agent 對齊機制。

## 授權

MIT
