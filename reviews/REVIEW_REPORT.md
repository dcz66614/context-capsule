# P011 T011 独立审查报告

- 任务：P011-T011 独立审查（IMPLEMENTATION_PLAN §11，风险分级 §12）
- 审查者：全新会话，未参与 T001–T010 任何核心实现；不采信施工方的自述结论，所有关键结论均为本会话独立复核
- 日期：2026-11-05（审查运行 07:26–07:35Z）
- 审查对象：`~/workspace/p011-context-capsule/`，审查时状态：T001–T009 已验证，T010 自动化部分完成（run-3：71/71），FINDING-T009-01 与 FINDING-T010-01～04 已修复，OBS-T010-05 已处理
- 结论先行：**FAIL — 0 个 P0，1 个 P1 未关闭，5 个 P2 未关闭。** 代码不以当前状态通过审查；P1 修复并重新验证后方可进入 T012 / 终审。

## 审查者自己跑的验收（真实运行，非施工方日志）

| 命令 | 退出码 | 结果 |
|---|---|---|
| `npm run typecheck` | 0 | 通过 |
| `npm run test` | 0 | 8 文件 / 49 测试，全部通过 |
| `npm run build` | 0 | 55 模块，1.79 s，`dist/assets/index-DA2UGPoR.js` 213.81 kB |
| `npm run test:e2e` | 0 | 真浏览器 3/3（flow 2.6 s、offline 1.8 s、xss 997 ms）；offline：28 个请求全部 `http://127.0.0.1:5173/...`，离线期间 0 个请求 |

日志：`/tmp/t011-acceptance-logs/`（typecheck.log、test.log、build.log、e2e.log；/tmp 为临时目录，VM 重启会清空）。

## 实际阅读的文件（全部，不是只看文件名）

规格与评估：`P011_PROJECT_BOOK.md`（全文）、`P011_IMPLEMENTATION_PLAN.md`（全文，重点 §7、§8、§10、§11、§12、§13、§15）、`evaluation/EVALUATION_REPORT.md`（全文，含 run-3 修复附录）、`evaluation/run-evaluation.ts`（全文）、`evaluation/gold.json`（结构 + 抽查）、`evaluation/results.json`（totals + 逐组）、`evaluation/logs/run-2.log`、`evaluation/logs/run-3.log`、`evaluation/control-adjudication.json`（D01 抽查）、`evaluation/control-summaries.md`（D01–D03 抽查）、`README.md`（全文）。

源码（全部 19 个）：`src/lib/extract.ts`、`src/lib/types.ts`、`src/lib/schema.ts`、`src/core/extract.ts`、`src/core/segment.ts`、`src/core/types.ts`、`src/core/schema.ts`、`src/core/conflicts.ts`、`src/core/capsule.ts`、`src/io/json.ts`、`src/io/markdown.ts`、`src/app/App.tsx`、`src/app/workflow.ts`、`src/components/Workbench.tsx`、`src/components/CandidateCard.tsx`、`src/components/SectionCard.tsx`、`src/components/PreviewPane.tsx`、`src/components/ConflictWarnings.tsx`、`src/components/labels.ts`、`src/main.tsx`、`index.html`、`vite.config.ts`、`playwright.config.ts`、`vitest.config.ts`、`tsconfig.json`、`package.json`。

测试（全部 11 个）：`tests/extract.test.ts`、`tests/conflicts.test.ts`、`tests/capsule.test.ts`、`tests/io.test.ts`、`tests/workflow.test.ts`、`tests/components.test.tsx`、`tests/regression-cc.test.ts`、`tests/perf.test.ts`、`tests/e2e/flow.spec.ts`、`tests/e2e/offline.spec.ts`、`tests/e2e/xss.spec.ts`、`tests/e2e/helpers.ts`。

独立探针（本会话自写，未复用施工方脚本，见 `reviews/t011-probe.ts`、`reviews/t011-perf.ts`、`reviews/t011-strict.ts`）：分句偏移 12 组棘手输入、金标准 71 条独立重算、分类对抗抽查 14 句、冲突检测 6 组探针、JSON 导出/导入 8 组探针、Markdown 注入复现、大输入性能分段计时。

## 已验证无问题（有证据，不是自评）

1. **七栏契约完整。** `SECTION_KEYS` 固定七栏、固定导出顺序；`src/lib/schema.ts` 与 `src/io/json.ts` 的 Zod 校验强制七栏齐全；导出 Markdown/JSON 均为七栏；空栏显示“未提供”。E2E 与单元测试覆盖。
2. **候选来源可核对。** 探针验证：12 组棘手输入（多空行分隔、带空格空行、跨段重复句、邮箱/IP/小数/版本号、URL 查询串、`Dr.` 缩写、省略号、粘连 `!`、emoji 代理对、空输入、段内换行、尾随换行）下所有分句 `source.slice(start, end) === text` 且无重叠；去重保留首次出现来源（CC-06 测试亦覆盖）。
3. **确认状态不可绕过。** `buildCapsule` / `buildCapsuleFromSections`（`src/core/capsule.ts`）只收 `confirmed`；`exportMarkdown` 额外防御性过滤；端到端导出路径 `previewJSON` / `previewMarkdown` 均先经 `buildCapsuleFromSections`。单元测试（CC-08）+ E2E 全流程测试验证。唯一缺口见 FINDING-T011-03（库函数级）。
4. **冲突不自动裁决、不删除。** `detectConflicts` 只返回报告，不改输入（探针验证输入 JSON 前后一致）；原因文本引用冲突双方；已拒绝项排除；D03 两处决策变更配对正确（探针复核）。
5. **JSON 导入不执行脚本、不污染状态。** `JSON.parse` + Zod 严格校验（顶层与条目级 `.strict()`、版本 `1.0.0`、数量/长度上限）；源码中无 `eval` / `new Function` / `dangerouslySetInnerHTML` / `innerHTML`（仅 XSS 测试的断言里出现 `innerHTML`）；React 渲染自动转义，E2E XSS 测试在真浏览器中验证 `<script>alert(1)</script>` 被转义、无弹窗、无脚本节点。
6. **原始对话不上传、不持久化、不记录。** 源码 grep：无 `fetch` / `XMLHttpRequest` / `WebSocket` / `localStorage` / `sessionStorage` / `indexedDB` / `sendBeacon` / `console.*`；`dist` 产物中唯一的外部 URL 字串是 XML 命名空间 URI 与 React 错误解码器 URL（常量，未发起请求）；E2E offline 日志：28 个请求全部指向本地开发服务器，离线期间 0 个请求。
7. **删除后不复活。** `deleteItem` 从状态中移除；E2E CC-11 验证删除后预览与新导出均无该条目；清空经确认对话框，E2E CC-12 验证。
8. **T010 run-3 的 71/71 独立复核通过。** 本会话用自写代码（非施工方 runner）重算：按冻结金标准（`gold.json`，mtime 2026-11-05 07:19，修复前）逐条核对导出胶囊，正确栏目 71/71、任意栏目 71/71。金标准未被事后调整的证据：同一份金标准在修复前 run-2 日志中为 59/71 = 83.1%（`evaluation/logs/run-2.log`），修复后才变为 71/71；`evaluation/gold.json` mtime（07:19）早于修复文件 mtime（07:25）。对照摘要 62/71 依赖 T010 作者的人工逐条判定，本会话只抽查了 D01（5/7，与摘要文本一致），未逐条重审全部 71 条。

## 问题清单（状态全部为 OPEN；本审查不修复代码）

### FINDING-T011-01（P1）—— 长文本下冲突检测 O(n²)，界面长时间冻结

- 位置：`src/core/conflicts.ts:154` `detectConflicts`（176–177 行双重循环，每对候选重算两次 `coreOf`）；触发点 `src/app/App.tsx:62` `useMemo(() => computeConflicts(sections), [sections])`——每次确认/拒绝/编辑/删除都重新全量计算；输入无上限：`src/components/Workbench.tsx:65` 粘贴框无 `maxLength`，`generateSections` 无截断。
- 复现（探针 `reviews/t011-perf.ts`，不同句子、去重不折叠工作量，云端 VM 实测）：
  - 20,000 字 / 511 条候选：`extractCandidates` 4 ms，`detectConflicts` **1,782 ms**；
  - 100,000 字 / 2,374 条候选：`detectConflicts` **38,681 ms**；
  - 200,000 字 / 4,647 条候选：`detectConflicts` **148,426 ms**。
  - 每次确认/拒绝/编辑都会重新触发同等耗时（主线程阻塞，页面无响应）。
- 判定理由：计划 §9 的性能目标只考核提取（≤2 s，提取本身 4 ms，通过），但产品的核心场景就是“长 AI 会话”粘贴，一次长会话很容易超过 100,000 字；20,000 字时每次点击卡约 1.8 s 已可感知，100,000 字时每次点击冻结约 39 s，工具在该量级下基本不可用。属计划 §12 “性能明显不达标”（P1）。
- 修复方向（供修复会话参考，不由审查执行）：按 `coreOf` 分组后再配对（冲突只可能发生在同 core 之间）、每条候选的 core 只算一次、或对输入规模设上限并提示；修复后须补回归测试（分段计时断言）并重跑验收与 T010 评估。

### FINDING-T011-02（P2）—— 决策变更配对是启发式，会配错对象

- 位置：`src/core/conflicts.ts:221–232`（取“最近一条更早的决策候选”作为被取代对象）。
- 复现（探针）：决策候选依次为「决定用 MySQL 存数据。」「决定买十四寸屏幕。」「决定改用 SQLite。」→ 报告称 SQLite“可能取代了”**买十四寸屏幕**，实际应取代 MySQL。D03 的两处变更配对正确只是因为那里没有无关决策插在中间。
- 缓解因素：原因文本已写“可能取代”并要求人工核对，且不自动裁决、不删除；因此定 P2 而非 P1。但粗心确认者可能据此拒绝错误的旧决策。修复方向：按内容 token/主题匹配配对，配不上时只报“有决策变更”而不指名对象；并补回归测试。

### FINDING-T011-03（P2）—— `exportJSON` 没有已确认项防御过滤

- 位置：`src/io/json.ts:112` `exportJSON`（直接序列化所给胶囊的全部条目）；对照 `src/io/markdown.ts:19–28`（防御性过滤 `confirmed`）。
- 复现（探针）：用 `importJSON` 导入一份含 `status: "candidate"` 条目的合法 wire JSON，再 `exportJSON`，输出包含该候选条目（`status: "candidate"` 原样导出）。
- 影响范围：端到端应用路径是安全的（`previewJSON` 先经 `buildCapsuleFromSections`，只含已确认项），所以不是已生效的泄露；但 `exportJSON` 作为公开导出函数违背了规格 §8“导出胶囊只包含确认项”的不变量，任何后续调用方直接导出未建胶囊都会泄漏未确认内容。修复方向：`exportJSON` 内同样只导出 `confirmed`（与 Markdown 一致），并补回归测试。

### FINDING-T011-04（P2）—— `importJSON` 接受重复条目 id，确认/删除会误伤另一条

- 位置：`src/io/json.ts:53–66` wire schema 未校验 id 唯一；`src/core/capsule.ts:31–41` `mapItem` 按 id 作用于**所有**匹配条目。
- 复现（探针）：导入两条 id 均为 `same` 的 goal 条目（“目标一”“目标二”），导入成功；对 id `same` 执行一次确认后，两条同时变为 `confirmed`（删除、编辑同理）。React 的 `key={item.id}` 也会因此重复。
- 影响范围：应用内生成的 id 唯一（`extracted-<序号>`、`manual-<时间戳>-<随机>`），只有手工构造或外部导入的文件能触发；但 JSON 导入是明确的用户流程。修复方向：导入时拒绝重复 id（大声失败，符合“导入失败不静默修复”原则），并补回归测试。

### FINDING-T011-05（P2）—— 手动/编辑条目中的换行可破坏 Markdown 导出结构

- 位置：`src/io/markdown.ts:28`（`lines.push(`- ${item.text}`)`，不对条目文本做换行处理）。
- 复现（探针）：手动添加条目后编辑其文本为 `恶意行\n## 已作决策\n- 伪造决策`，确认并导出，得到的 Markdown 中出现一个伪造的 `## 已作决策` 标题与一条伪造的列表项（甚至出现两次“已作决策”标题）。规则提取的条目不会触发（分句器按换行切分），只有手动添加/编辑的文本可以触发——属于用户自写内容，但导出的七栏结构是本产品的契约，导出文件会被粘贴进另一个 AI 会话。
- 修复方向：导出时把条目文本内的换行折叠为空格（或拒绝含换行的条目文本），JSON 导出不受影响（字符串转义）；补回归测试。

### FINDING-T011-06（P2）—— `importJSON` 的“严格”宣称不成立：多余的栏目键与 source 内多余字段被静默丢弃

- 位置：`src/io/json.ts:35` `wireSourceSchema` 与 `:53` `wireSectionsSchema` 均未 `.strict()`；而模块头注释宣称“未知字段会被拒绝，而不是被剥离”。顶层与条目级是 `.strict()` 的。
- 复现（探针）：wire JSON 增加一个多余栏目键（如 `extraSection: []`）→ 导入成功、多余栏目被丢弃；`source` 内加 `bogus` 字段 → 同样成功并丢弃。其余探针均按预期拒绝：多余顶层键、多余条目字段、缺失标题、标题超 500 字、空条目文本。
- 影响：低——多余数据被丢弃而非执行；但“导入成功”会掩盖数据丢失（例如未来版本新增栏目时，旧版导入会静默丢内容）。修复方向：两个 schema 补 `.strict()`，并补回归测试。

## 观察项（不阻断，留终审或 T012 处理）

- **OBS-T011-01（P2）—— FR12 离线是“已加载页面断网可用”，冷启动离线不支持。** 无 Service Worker；`dist/index.html` 引用绝对路径 `/assets/index-DA2UGPoR.js`，双击打开或无本地服务器时加载失败。计划 §9 的验收方法（加载后断网、核对网络请求）已通过，但“本地离线运行”的部署假设（需本地 HTTP 服务）未写进 README。建议 T012 在发布说明中写明，或补 Service Worker。
- **OBS-T011-02—— 规格 §8 与 §9 空栏措辞不一致。** §8 规定空栏显示“未提供”，§9 示例用“暂无”；实现按 §8，README 已记录该差异。这不是代码缺陷，需终审裁定规格措辞，代码无需改。
- **OBS-T011-03—— 界面与 README 的任务状态文字已过期。** `src/app/App.tsx:179` 页脚仍写“T009 独立测试、T010 产品评估、T011 独立审查、T012 发布工程待办”；README “Pending”节亦然。T009/T010 已完成。建议 T012 更新（纯文案）。
- **OBS-T011-04—— T010 人类参与部分仍未测量。** (b) 人工确认后的交接质量、(c) 任务续接质量与整理耗时（目标 −25%）均无数据；已确认决策错误率 ≤5% 在 oracle 确认下无法判定。T010 报告已诚实标注，终审不得把 (a) 的 71/71 当作产品整体结论。
- **OBS-T011-05—— 英文缩写分句。** `Dr. Smith` 会被切成两段（`.` 后为空格即判句界）。中文场景可接受，记录在案。
- **OBS-T011-06—— “测试还没做。”归入进度是正确的。** 探针初判以为应属事实，核对规格 §4.2 后确认：`还没做`属“尚未开始”类进度信号，分类正确，非问题。
- **OBS-T011-07—— `openQuestions` 的 `TODO` 只匹配大写**（该规则无 `/i`），而禁止规则有；极小不一致。
- **OBS-T011-08—— `groupCandidatesBySection` 的 `source` 参数未使用**（`void source`），死代码；`src/core/*` 复导出与 `src/lib/*` 双路径实现已在 README 记录，无行为重复。

## 测试覆盖评价（逐文件核对，非笼统判断）

- 8 个单元测试文件 + 3 个 E2E 均断言真实行为：CC-01～CC-12 均有对应断言（CC-05 冲突、CC-06 去重保来源、CC-07 手工来源、CC-08 未确认不导出、CC-09 往返、CC-10 转义、CC-11 删除不复活、CC-12 清空）；性能测试用恰好 20,000 字真实计时；E2E 在真浏览器中断言下载文件内容与离线网络记录。未发现“只断言自身输出”的空测试。
- 覆盖缺口（与上述问题一一对应，修复会话应补）：无冲突检测规模/耗时回归测试；无决策变更错配回归测试；无 `exportJSON` 传入候选条目的测试；无重复 id 导入测试；无条目换行导出测试；无多余栏目键导入测试。

## 审查结论（Verdict）

**T011 VERDICT: FAIL**

- P0：0 个（无隐私泄露、无未确认内容导出、无七栏缺失、无核心流程不可运行、无严重数据丢失）。
- P1：1 个未关闭——FINDING-T011-01（长文本冲突检测 O(n²) 冻结界面）。
- P2：5 个未关闭——FINDING-T011-02～06。
- 观察项：8 个（OBS-T011-01～08），不阻断。

必需的下一步（按顺序）：修复会话修 FINDING-T011-01（P1 优先）及 FINDING-T011-02～06，补对应的回归测试，重跑完整验收（typecheck / test / build / test:e2e）与 T010 评估（确认保留率仍为 71/71），再交一次独立审查确认 P1 已关闭；之后方可进入 T012 与终审。终审时须注意：T010 人类参与部分的 (b)(c) 仍未测量，§9 的人类指标不得宣称为已通过。

---

## 修复记录（T011-01～06，2026-11-05 07:41Z，修复会话追加，非审查者原文）

本附录只记录修复动作，不改写上面的 FAIL 结论；新结论须由一次全新独立审查作出。

- 只改了 `src/`（`src/core/conflicts.ts` 冲突检测 + 决策变更配对，`src/io/json.ts` 严格校验/重复 id/确认项过滤，`src/io/markdown.ts` 换行折叠）与 `tests/`（`tests/conflicts.test.ts`、`tests/io.test.ts`、`tests/perf.test.ts`，新增 11 个测试：49 → 60）；`evaluation/gold.json`（冻结 07:19Z 不变）、`evaluation/dialogues/`、`reviews/` 内审查原文、`src/core/schema.ts`、`src/core/types.ts` 均未改动。
- T011-01（P1）：`detectConflicts` 改为按 core 分组后组内配对，逐候选特征只算一次，返回顺序与原 (i, j) 扫描一致。审查探针 `reviews/t011-perf.ts` 重跑：20,000 字冲突检测 1,782 ms → **7 ms**；100,000 字 38,681 ms → **27 ms**；200,000 字 148,426 ms → **53 ms**。新增性能回归测试：20,000 字 < 500 ms（实测 17.7 ms）、100,000 字 < 5,000 ms（实测 87.0 ms）。未设粘贴字数上限。
- T011-02（P2）：决策变更配对改为主题词评分（Latin/数字词串权重 3、单个汉字权重 1、停用字剔除，阈值 ≥2，最高分者胜、平局取最近）；低于阈值时报未配对警告（`unpairedChange: true`，不指名对象）。审查探针错配用例 [MySQL、十四寸屏幕、改用 SQLite] 现报未配对，不再错指屏幕；D03 两处变更：浅色→深色主题仍正确配对，SQLite→MySQL 报未配对（文本上确实无法确定）。
- T011-03（P2）：`exportJSON` 增加已确认项防御过滤，与 Markdown 一致；直接传入含候选条目的胶囊时候选不再流出。
- T011-04（P2）：`importJSON` 拒绝重复条目 id（全胶囊范围，报错 `Duplicate item id "..."`）。
- T011-05（P2）：`exportMarkdown` 把条目文本内换行折叠为空格；探针注入文本现导出为单行，不再出现伪造标题/列表项。
- T011-06（P2）：`wireSectionsSchema` 与 `wireSourceSchema` 补 `.strict()`；审查严格探针重跑：多余栏目键、多余 source 字段现均被拒绝，其余项与审查时一致（`source end=999999` 仍接受，属审查已记录的既有行为，非本次发现）。
- 审查探针 `reviews/t011-probe.ts` 重跑：除 4 处预期变化外全部通过——4 处为探针本身按旧缺陷写的断言（exportJSON 候选泄漏、重复 id 接受、最近配对启发式、“测试还没做”归事实；最后一项审查报告 OBS-T011-06 已裁定为正确归进度，非问题）。探针在重复 id 第二次导入处抛错退出（探针假定导入成功），其后 Markdown 注入段未跑到；该段已用等价输入单独验证（见 `tests/io.test.ts` T011-05，伪造标题行数 = 1，注入不存在）。
- 验收（真实运行，日志 `/tmp/p011-t011-repair-logs/`）：`npm run typecheck` 0；`npm run test` 0（8 文件 / 60 测试通过）；`npm run build` 0（55 模块，2.05 s）；`npm run test:e2e` 0（真浏览器 3/3：flow 5.1 s、offline 3.6 s、xss 1.9 s，离线期间 0 请求）。
- T010 评估重跑（`evaluation/logs/run-4.log`，`evaluation/results.json` 现为 run-4 结果）：关键约束保留率正确栏目 **71/71 = 100%**，JSON 往返 12/12，七栏完整 12/12，未确认误导出 0，20,000 字提取中位数 2.2 ms；D03 冲突仍为 2 条（1 条配对 + 1 条未配对）。
- 仍未完成：人类参与部分 (b)(c) 仍未测量；本次修复后须再交一次独立审查确认 P1 关闭，方可进入 T012 与终审。
