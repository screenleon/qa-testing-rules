# qa-testing-rules

語言/框架無關的 QA 測試規範，給 AI coding agent 與人類工程師一份可被 `@import` 的單一事實來源。

## 為什麼存在

LLM agent 在沒有明確指引時預設產出「**happy-path-only**」測試——覆蓋率漂亮但抓不到 bug。本 repo 強迫：(1) 寫測試前**枚舉測試類別**、(2) 提供**反模式對照**、(3) 提供**寫完的 mutation 自我審查**。

## 兩層結構（重要）

**Tier 1（agent hot path，永遠載入，~3.7k tokens）：**
- [`AGENT.md`](./AGENT.md) — agent 的唯一必讀入口。workflow + 12 類速查表 + 紅線 + 自查清單。

**Tier 2（reference，**有需要時才讀**）：**

| 檔案 | 何時讀 |
|---|---|
| [`PRINCIPLES.md`](./PRINCIPLES.md) | 在 edge case 不確定怎麼判斷時 |
| [`TEST-STRATEGY.md`](./TEST-STRATEGY.md) | 選測試層級、設計 CI / 環境 / coverage / flakiness 政策時 |
| [`TEST-CATEGORIES.md`](./TEST-CATEGORIES.md) | 卡在某類 category 的具體子案例時 |
| [`ANTI-PATTERNS.md`](./ANTI-PATTERNS.md) | Review / 看到 smell 想確認是不是 anti-pattern 時 |
| [`EXAMPLES.md`](./EXAMPLES.md) | 需要好 vs 壞 code 對照時 |

## 使用方式（給 agent）

在你的專案 `CLAUDE.md` / `AGENTS.md` / `.cursorrules` / `GEMINI.md` 加：

```md
## Testing rules

When writing or reviewing tests, read:
https://github.com/screenleon/qa-testing-rules/blob/main/AGENT.md

Only consult the deeper reference files (PRINCIPLES / TEST-STRATEGY /
TEST-CATEGORIES / ANTI-PATTERNS / EXAMPLES) when AGENT.md explicitly
points you to them, to keep token usage low.
```

## 核心立場

> **測試的目的是發現 bug，不是證明程式有用。**
> 一條測試在實作被破壞時不會失敗，這條測試就等於不存在。

## 致謝

濃縮自：
- [khasky/testing-strategy-playbook](https://github.com/khasky/testing-strategy-playbook) — 測試層級、CI 分流、coverage / flakiness 政策
- [gittower/git-flow-next](https://github.com/gittower/git-flow-next/blob/main/TESTING_GUIDELINES.md) — 結構化 docstring、命名 pattern、一個 function 一個 scenario、cwd anti-pattern
- [SolidOS testing_guidelines](https://github.com/SolidOS/solidos/blob/main/documentation/guidelines/testing_guidelines.md) — bug-first reproducing test、custom matchers

差異定位：把上述參考整合成「**agent 可逐步執行的工作流**」（hot path 5k tokens 內，深層細節按需載入）。

## 授權

MIT
