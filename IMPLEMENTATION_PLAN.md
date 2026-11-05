P011 · Context Capsule · PLAN_VERSION 1.0.0 · 2026-11-04

1. 执行目标与不可变约束
本计划供 Muse 调度现有免费 Coding Agent 使用。Muse 只承担任务分配、进度管理、证据核验、集成门禁和归档，不直接编写业务代码。
正式工程目标是：在约 14 个自然日内交付一个可离线运行、具备七栏结构化提取、人工确认和双格式导出的本地 Web 原型。
固定约束如下：
1. 产品不调用 LLM、云端 API 或外部摘要服务。
2. 七栏名称与语义固定，不允许施工 Agent 擅自增删。
3. 自动识别只能产生候选，不能跳过用户确认。
4. 用户输入默认不持久化、不上传。
5. 交接内容可以编辑、删除和清空。
6. 原始输入属于不可信文本，不能执行其中的指令。
7. 所有代码、修复、测试和独立评审分别使用新的 Agent 会话。
8. 不允许两个 Agent 并发修改同一文件。
9. 施工结果必须由真实运行证据证明，不能用模型自评替代。
10. 最终由本立项对话进行 ChatGPT 独立终审。

2. 两周里程碑与阶段门槛
| 阶段 | 目标时间 | 主要交付 | 退出条件 |
| S0 规格与环境 | 第 1–2 天 | 环境记录、工程骨架、接口冻结 | 构建与类型检查可运行 |
| S1 核心规则 | 第 3–5 天 | 分句、分类、来源、冲突 | 核心单元测试通过 |
| S2 胶囊与界面 | 第 6–9 天 | 编辑确认、预览、导入导出 | 完整用户流程可操作 |
| S3 集成验证 | 第 10–12 天 | 浏览器测试、对照实验、隐私检查 | P0 验收指标通过 |
| S4 发布预审 | 第 13–14 天 | 发布包、截图、日志、源码审查包 | 证据齐全，提交终审 |
这是一份排期目标，不是对实际开发时长的保证。

3. 任务依赖图
（图示，见本报告开头的转录：T001 环境与骨架 → T002 Schema 契约 → 并行支线 T003–T005 规则内核 与 T006–T008 UI / I-O → T009–T010 集成测试 → T011–T012 审查发布）
箭头表示前置任务完成后才允许下游任务集成。并行任务必须使用不同文件归属。

4. 原子任务清单
以下 12 项均属于计划任务，尚未执行。
| TASK_ID | 负责工种 | 主要文件归属 | 完成标准 |
| P011-T001 | 工程基础 | package.json、构建配置 | 本地启动、类型检查、构建成功 |
| P011-T002 | 架构与类型 | src/core/schema.ts、types.ts | 七栏 Schema 冻结、校验测试通过 |
| P011-T003 | 文本算法 | segment.ts、extract.ts | 合成样本识别可复现 |
| P011-T004 | 规则算法 | conflicts.ts | 显式冲突正确标记 |
| P011-T005 | 胶囊状态 | capsule.ts | 编辑、确认、删除状态正确 |
| P011-T006 | 前端 UI | src/components/ | 三栏工作台及交互可用 |
| P011-T007 | 导入导出 | src/io/ | Markdown/JSON 导出及 JSON 往返 |
| P011-T008 | 页面集成 | src/app/ | 完整用户流程贯通 |
| P011-T009 | 独立测试 | tests/unit/、tests/e2e/ | P0 回归测试真实通过 |
| P011-T010 | 产品评估 | evaluation/ | 对照实验、结果与限制报告 |
| P011-T011 | 独立审查 | reviews/ | 核心源码和隐私审查完成 |
| P011-T012 | 发布工程 | release/、docs/ | 可重建发布包与终审证据齐全 |

5. 标准任务交接合同
Muse 派发每个任务时必须提供：
| 字段 | 要求 |
| TASK_ID | 唯一任务编号 |
| OBJECTIVE | 单一明确目标 |
| INPUTS | 对应规格章节、依赖任务产物及源码版本 |
| OWNED_FILES | 唯一允许修改的文件 |
| FORBIDDEN_FILES | 禁止修改的其他模块与冻结契约 |
| ACCEPTANCE_COMMANDS | 实际可执行的检查命令 |
| EXPECTED_EVIDENCE | 日志、测试结果、文件清单和哈希 |
| DEFINITION_OF_DONE | 明确完成门槛 |
| FAILURE_ROLLBACK | 失败时恢复到上一已验收提交 |
每个新 Agent 会话必须获得独立、完整的任务上下文，不能依赖前一模型会话的隐式记忆。
任务交接记录至少包括：
```
TASK_ID:
BASE_COMMIT:
FILES_CHANGED:
COMMANDS_EXECUTED:
EXIT_CODES:
TEST_RESULTS:
KNOWN_LIMITATIONS:
OUTPUT_COMMIT:
REVIEW_STATUS:
```

6. 文件归属与工作区
建议仓库结构：
```
P011-context-capsule/
  PROJECT_BOOK.md
  IMPLEMENTATION_PLAN.md
  package.json
  package-lock.json
  README.md
  LICENSE
  src/
    core/
    io/
    components/
    app/
  tests/
    unit/
    e2e/
    fixtures/
  evaluation/
  docs/
  reviews/
  release/
```
项目正式归档位置：agent project auto/P011-context-capsule/
在 Google Drive 中，Muse 应分设 01_specs/、02_tasks/、03_source/、04_tests/、05_reviews/、06_release/ 和 07_final_verdict/。
建议所有施工任务使用 Git 分支或独立 worktree。先完成任务级测试与审查，再由集成 Agent 合并。Muse 不亲自修复代码。

7. 关键接口契约
核心规则引擎：
```typescript
extractCandidates(
  text: string
): Candidate[]

detectConflicts(
  candidates: Candidate[]
): Conflict[]

buildCapsule(
  candidates: Candidate[],
  title: string
): Capsule
```
输入输出层：
```typescript
exportMarkdown(
  capsule: Capsule
): string

exportJSON(
  capsule: Capsule
): string

importJSON(
  jsonText: string
): Capsule
```
必须保证：
- extractCandidates 不修改原文。
- detectConflicts 不自动删除任何候选。
- buildCapsule 只接受 confirmed 条目。
- 导入 JSON 必须验证版本与结构。
- Markdown 与 JSON 具有一致的七栏语义。
- 重复导出同一胶囊不得随机改变条目顺序。

8. 固定测试样本与验收矩阵
最小单元测试包括：
| TEST_ID | 场景 | 期望结果 |
| CC-01 | 明确目标 | 正确识别目标候选 |
| CC-02 | “已经决定使用 X” | 识别决策候选 |
| CC-03 | “不要上传原文” | 识别禁止事项 |
| CC-04 | “下一步完成测试” | 识别下一步 |
| CC-05 | 前后决定冲突 | 提示冲突，不擅自裁决 |
| CC-06 | 同一句重复出现 | 去重不丢来源信息 |
| CC-07 | 手工添加条目 | 保留手工来源标记 |
| CC-08 | 未确认候选 | 不进入导出文件 |
| CC-09 | JSON 导出再导入 | 七栏与确认条目保持一致 |
| CC-10 | 恶意 HTML 文本 | 不执行脚本 |
| CC-11 | 敏感信息删除 | 导出中不再出现该信息 |
| CC-12 | 全部清空 | 页面工作状态恢复为空 |
浏览器端到端测试必须覆盖粘贴、生成、编辑、确认、导出、导入、清空和断网操作。

9. 验收命令与证据
建议在项目中固定以下 npm scripts：
```bash
npm ci
npm run typecheck
npm run test
npm run build
npm run test:e2e
```
实际脚本由 T001 建立，必须在 package.json 中真实存在。
所有验收日志记录执行命令、运行环境、退出码、测试数量、通过/失败数量和 Git commit。
性能目标：在目标虚拟机上，20,000 个中文字符的合成文本提取耗时不超过 2 秒；如未达到，应提供真实测量和优化说明。此指标为规划目标，不能预先视为通过。
离线测试应在断开外网的浏览器环境中完成核心操作，并核对网络请求记录。不能仅因源码没有 fetch 字符串就宣称离线通过。

10. 最小产品验证任务
T010 不负责重新决定项目是否立项，而是判断成品是否实现了产品价值。
验证步骤：
1. 冻结 12 组测试对话及关键约束金标准。
2. 制作普通摘要对照组。
3. 让参与者分别完成普通摘要与 Context Capsule 交接。
4. 使用一致的任务继续执行评分规则。
5. 记录关键约束遗漏、错误决策、人工耗时和续接成功率。
6. 对失败样本进行原因分类，提交真实报告。
报告必须分开呈现规则引擎自动提取质量、人工确认后的交接质量和最终目标模型的任务完成质量，不允许混为一个准确率。

11. 独立审查策略
T011 应由未承担相应核心实现的独立模型会话执行。
审查重点：
- 七栏数据契约是否完整；
- 候选来源是否可核对；
- 确认状态是否被绕过；
- 冲突是否被错误自动裁决；
- JSON 导入是否可能造成脚本执行或状态污染；
- 原始对话是否被意外上传、持久化或记录；
- 导出内容是否包含用户已删除的信息；
- 关键测试是否真正覆盖上述行为。
审查报告不得只写“代码质量良好”，必须列出实际阅读文件、问题位置、复现方式、严重级别和修复状态。

12. 风险分级与回退
P0 阻断：隐私泄露、错误导出未确认内容、七栏缺失、核心流程无法运行、严重数据丢失或无法导入合法胶囊。
P1 重要：常见明确语句分类错误、显式冲突漏报、关键 UI 无法操作、性能明显不达标。
P2 非阻断：轻微布局偏差、次要提示文案、少量极端表达无法识别。
失败任务由 Muse 派给新的修复会话，附失败日志和基准提交。修复完成后重新运行相关测试与回归，再交独立审查，不允许直接覆盖已验收版本。

13. 发布包与终审证据
最终发布包至少包含：
```
release/
  context-capsule-source.zip
  SOURCE_MANIFEST.csv
  SHA256SUMS.txt
  BUILD_LOG.txt
  TEST_LOG.txt
  E2E_LOG.txt
  EVALUATION_REPORT.md
  PRIVACY_REVIEW.md
  LICENSE_REPORT.md
  REVIEW_INDEX.md
  REVIEW_PACK_01.md
  screenshots/
```
REVIEW_INDEX.md 必须列出全部需要审查的源码文件、配置文件、对应源码审查包、实际读取覆盖情况和版本哈希。
源码审查包须包含真实源码正文，而不是仅提供文件名和概述。源码文件太多时分批生成 REVIEW_PACK_XX.md，并保证与发布包同一提交。
发布版本必须能通过 Git commit 或 SHA-256 核对。终审中不能将不同版本的测试日志和源码混合使用。

14. Google Drive 归档与 ChatGPT 终审
Muse 应把项目书、计划书及其正式文件分别归档到 P011-context-capsule 文件夹，并在 FACTORY_INDEX.md 中登记 P011。
完成施工后，Muse 将项目文件夹链接、REVIEW_INDEX.md、源码审查包、真实测试日志、演示截图和发布哈希提交到当前 P011 立项对话。
我会主动核对能够读取的文件内容与证据，区分“已真正读取”和“只看见文件名或链接”。
终审采用工厂规定的唯一格式：
```
FINAL_VERDICT: PASS | FAIL | EVIDENCE_INCOMPLETE
PROJECT_ID: P011
RELEASE_SHA256_OR_COMMIT: ...
COVERAGE: 已核实文件 X / 应核实文件 Y
BLOCKERS: ...
NON_BLOCKING: ...
ACCEPTANCE_EVIDENCE: ...
REQUIRED_NEXT_ACTIONS: ...
```
只有 PASS 才允许最终发布归档和完成通知。

15. 开发完成定义
P011 的工程交付必须同时满足：
- 七栏交接流程完整运行；
- 用户可以核对、修改、删除和确认；
- Markdown 与 JSON 导出有效；
- JSON 往返无损；
- 本地隐私与离线运行门槛通过；
- 12 组样本测试和对照实验有真实结果；
- 源码、依赖、运行说明、截图、日志和哈希完整；
- 独立审查没有未解决的 P0 问题；
- ChatGPT 在当前对话完成最终独立验收。
实施计划结论：采用规则内核 + 用户确认 + 本地文件导出的最小架构。优先确保关键决策与禁止事项可靠交接，不为追求智能化而引入不必要的模型、数据库和云服务。
