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
| [`CHEATSHEET.md`](./CHEATSHEET.md) | 快速回顧 layer 選擇、12 類別、anti-pattern index 時 |

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

## Versioning

qa-testing-rules 遵循 [Semantic Versioning](https://semver.org/)：
- **MAJOR**：刪除現有規則或改變 `AGENT.md` 工作流 step 順序（agent 必須重新學習）
- **MINOR**：新增類別、範例、Anti-pattern，或擴展現有規則（向後相容）
- **PATCH**：文字修正、格式改善、不影響規則語意的改動

其他 repo 應 pin release tag 或 commit SHA，而非 `main` branch。把 `vX.Y.Z` 換成實際存在的 release tag：
```md
## Testing rules
When writing or reviewing tests, read:
https://github.com/screenleon/qa-testing-rules/blob/vX.Y.Z/AGENT.md
Only consult the deeper reference files when AGENT.md explicitly points you there.
```

### Release 流程

1. 完成 changes 並確認 `main` 測試通過
2. 更新 `CHANGELOG.md`（移動 `[Unreleased]` → `[vX.Y.Z]` + 加日期）
3. `git tag vX.Y.Z && git push origin vX.Y.Z`

變更歷史見 [`CHANGELOG.md`](./CHANGELOG.md)。

## 致謝

濃縮自：
- [khasky/testing-strategy-playbook](https://github.com/khasky/testing-strategy-playbook) — 測試層級、CI 分流、coverage / flakiness 政策
- [gittower/git-flow-next](https://github.com/gittower/git-flow-next/blob/main/TESTING_GUIDELINES.md) — 結構化 docstring、命名 pattern、一個 function 一個 scenario、cwd anti-pattern
- [SolidOS testing_guidelines](https://github.com/SolidOS/solidos/blob/main/documentation/guidelines/testing_guidelines.md) — bug-first reproducing test、custom matchers

差異定位：把上述參考整合成「**agent 可逐步執行的工作流**」（hot path 5k tokens 內，深層細節按需載入）。

## 授權

MIT
