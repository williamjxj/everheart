# Everheart / Whodunit Voice — 记忆功能提升方案（修订版）

**Date:** 2026-09-21 · **Status:** 草案，待 review · **Author:** Codex

> 本文合并并修订了 Claude 的四份稿子（`claude_00_memory_analysis_and_decision.md`、
> `claude_01_everheart_memory_spec.md`、`claude_02_everheart_implementation_plan.md`、
> `claude_03_whodunit_voice_memory_addendum.md`）。修订依据是逐条对照两个仓库的实际代码，
> 与原稿不一致的地方在 §2 明确列出，并已在后续方案中吸收。
>
> 覆盖范围：`everheart`（本仓库）与 `whodunit-voice`（`~/my-tests/my-audio/whodunit-voice`）。
> 本文件的 Everheart 部分即本仓库的实施依据；Whodunit 部分为跨仓库参考，落地时在对方仓库执行。

---

## 1. 结论摘要

两份原稿的方向都成立，但前提与代码现状有 4 处偏差，修正后工作量明显下降：

- **Everheart 不需要"从零建记忆系统"**——记忆引擎（facts / entities / episodes / summary）
  已经完整实现，只是全部跑在浏览器 localStorage。真正的工作是"把它搬到服务端"，
  外加一个原稿没发现的接线缺口：生产路径（流式对话）根本没有记忆写入。
- **Everheart 的真正前置阻塞是用户身份**，不是 schema。`/api/companions` 目前硬编码
  `DEMO_USER_ID = "demo-user"`，没有身份就做不了服务端记忆。
- **Whodunit 的问题不是 token 成本**——服务端早已硬截断到最近 12 条消息，成本有上界。
  真问题是"第 12 轮之前的审讯内容对嫌疑人彻底消失"，即**连续性**问题。
- **Whodunit 的线索解锁在客户端**，服务端 prompt 的任何改动都碰不到它，原稿担心的
  风险本就不存在。

建议的落地顺序（两个 P0 合计约 2 天，均不触碰数据模型、可独立回滚）：

| 序号 | 应用 | 事项 | 预估 |
|---|---|---|---|
| 1 | everheart | ~~P0 接线修复~~ ✅ 已完成 2026-09-21 | 0.5–1 天 |
| 2 | whodunit-voice | P0 审讯滚动摘要（零 schema 版） | 0.5–1 天 |
| 3 | everheart | ~~P1 服务端持久化~~ ✅ 已完成 2026-09-21 | 2–3 天 |
| 4 | everheart | ~~P2 隐私控制 UI 服务端化~~ ✅ 已完成 2026-09-21 | 1 天 |
| 5 | whodunit-voice | P1 摘要迁到服务端表（可选） | 0.5 天 |
| — | 两者 | pgvector / 向量检索 | 暂不做 |

---

## 2. 现状核对：与原稿不一致的 4 处

| 原稿的判断 | 代码实况（含证据） | 对方案的影响 |
|---|---|---|
| everheart 的记忆表只有 schema、没有读写代码（`claude_00` §7-1） | 记忆引擎**已完整存在**：`src/lib/memory/` 下 6 个文件（memory-store / retrieval / context-assembler / fact-extractor / fact-extractor-llm / export），共约 710 行，跑在浏览器 localStorage（`everheart_mem_<companionId>`，见 `src/lib/memory/memory-store.ts:8`） | 方案由"从零实现记忆"改为"把现有引擎服务端化"，可复用其数据形状与 UI |
| 应新建扁平 facts 模型（category enum + factKey + confidence） | 仓库已有更成熟的三层结构：`userProfile`（facts）/ `entities` / `episodes` / `summary`，带 importance、时效衰减、容量上限，且 `MemoryPanel` 与 Markdown 导出（`src/lib/memory/export.ts`）已按此形状实现 | 沿用现有形状，不推翻重做；DB 侧按此建模 |
| everheart 的 Phase 0 只是"让消息落库" | `Message` / `MemoryFact` / `Summary` 三个模型确实零接线（全仓库只有 `eh_companion` / `eh_user` / `eh_entitlement` / `eh_ledger_entry` 被引用），但**真正的阻塞是没有用户身份**：`src/app/api/companions/route.ts:12` 硬编码 `DEMO_USER_ID = "demo-user"`，`.env.local` 里有 Clerk key 但全仓库没有一行 Clerk 代码 | 必须先定身份方案，否则服务端记忆会全局串号 |
| whodunit 的隐患是"全部问答塞进 prompt，token 成本线性增长"（`claude_03` §2.1） | 服务端早已硬截断：`sanitizeMessages` 只保留最近 12 条 × 每条 600 字（`server.js:810`） | 成本不是问题，问题是**连续性**：第 12 轮以前的审讯内容对嫌疑人完全消失 |

另外两个核对中发现的补充事实：

- whodunit 的线索解锁是**客户端**行为：`public/app.js:903` 的 `unlockClues()` 对玩家的问题文本
  做关键词包含匹配，keywords 由 `/api/case` 下发（`server.js:1250`）。因此服务端 prompt 的
  任何改动都不可能影响线索解锁——原稿的"必须继续对全部原始问答做关键词匹配"这一顾虑，
  实际风险为零（但"摘要不参与判定"的原则仍应遵守）。
- whodunit 的审讯记录**已经服务端持久化**：存档 blob 内含 `conversations`（客户端裁到每嫌疑人
  30 条，`public/app.js:440` 经 `PUT /api/state` 存入 `game_states`）。因此服务端已有足够原料
  生成摘要，无需新建"记录原始问答"的管道。

---

## 3. Everheart 方案

### P0 · 接线修复（0.5–1 天，不动数据模型）

**这是原稿未发现的缺口，也是当前性价比最高的一步。**

现状：

1. 生产路径是流式对话（聊天页固定 `stream: true`），而 `streamReply`
   （`src/lib/llm/chat-orchestrator.ts:195`）里**没有任何记忆写入或抽取逻辑**；
2. `summarizeConversation`（`src/lib/memory/fact-extractor-llm.ts:62`）与
   `shouldSummarize`（`src/lib/memory/context-assembler.ts:116`）是死代码，从未被调用；
3. 聊天页把相关性召回结果算出来后**丢弃了 facts**：`bundleForQuery()` 返回的
   `recalled.facts` 未被使用，实际注入的是"重要度排序前 10 条"
   （`src/app/chat/[companionId]/page.tsx:466`），entities / episodes 则用了召回结果。

改动：

- [x] 请求体改为 `facts: recalled.facts`，并强制拼接 boundary 类（用户明确设过的边界）常驻；
- [x] LLM 抽取 + 摘要折叠合并成**一次调用**（facts 与 summary 读同一批消息，分开做会双倍 token）；
- [x] 折叠结果先回传客户端并落 localStorage（本 Phase 不引入服务端存储），
      保持离线链路（`src/lib/offline/brain.js`）完全不变；
- [x] 补一组最小回归：离线模式（无 key）下对话与记忆仍可用。

**实现记录（2026-09-21，已完成）**：改用独立端点 `POST /api/memory/extract`，
而不是原计划里的 `after()`。原因是 `after()` 在响应发出后才执行，**拿不到返回值**，
而 P0 阶段记忆还在浏览器里，抽取结果必须回传给客户端；`after()` 要到 P1
（记忆落库）才是正确工具，届时这段逻辑会搬回 `/api/chat` 的 `after()` 里。

**验收**：连续对话 20+ 轮后，还能正确引用早前提过的偏好；浏览器 devtools 里能看到
流式首字节时间（TTFB）不受影响。

### P1 · 服务端持久化（2–3 天，合并原稿的 Phase 0 + 1 + 2）

#### P1.1 先定身份（阻塞项）

两条路：

- **接 Clerk**：`.env.local` 已配好 key，但代码零接入。工作量不小，不过做
  entitlement / 付费闭环迟早要做，属于"一次投入长期收益"。
- **匿名 `playerId` 过渡（推荐先用这条）**：uuid 存 localStorage，随请求带上，
  复用 whodunit 已验证的模式。可立刻解锁 P1.2–P1.4，登录系统就绪后再做归并
  （把匿名身份的记忆迁移到真实账号）。

#### P1.2 schema 调整

- [ ] `eh_memory_fact` / `eh_summary` 补 `userId`：目前两者只有 `companionId`，
      记忆必须按 (userId, companionId) 隔离，否则共用设备或分享 companion 会串记忆；
- [ ] 删除 `MemoryFact.embedding`：现为 SQLite 遗留的 `Bytes` 类型却注释写着 pgvector(1536)，
      与 postgresql datasource 不一致（本方案已决定不做向量检索，见 P3）；
- [ ] `eh_message` 补 `(userId, companionId, createdAt)` 复合索引（现有索引是
      `(companionId, createdAt)`）；
- [ ] `pnpm prisma db push`。

#### P1.3 存储形态（二选一）

- **方案 A（推荐）：四张表** — `eh_memory_fact`（facts，加 `category` 以标记 boundary）
  + `eh_memory_entity` + `eh_memory_episode` + `eh_summary`。优点：可按条删除、可按类强制注入，
  直接满足 P2 的需求。
- **方案 B（一天版）：单张 `eh_companion_memory`** — 把整个 `CompanionMemory` blob 存
  JSONB。改动最小、最贴近当前代码，缺点是无法按 fact 粒度查询/删除。

#### P1.4 读写接线

- [ ] `/api/chat` 在 assistant 回复结束后写入 user / assistant 两条 `eh_message`
      （用 `after()`，不阻塞响应）；
- [ ] 新增只读端点 `GET /api/companions/:id/messages` 用于历史回填；
      聊天页改为优先从服务端拉历史，localStorage 降级为离线兜底缓存；
- [ ] `context-assembler` 的输入源由 localStorage 改为服务端层（接口形状不变）。

**验收**：换浏览器登录同一身份后，聊天记录与记忆（facts + summary）能完整恢复；
离线模式不受影响。

**风险**：历史用户的消息只存在 localStorage，本次改动不会自动迁移。
是否需要一次性导入脚本（从 localStorage 回填服务端）需另行评估，**不在本方案默认范围内**。

#### P1 实现记录（2026-09-21，已完成）

- **身份**：采用"匿名 `playerId` 过渡"方案。客户端 `src/lib/auth/player-id.ts` 生成 UUID 存
  localStorage（`everheart_player`）；服务端 `src/lib/auth/player.ts` 的 `ensurePlayer()`
  用它 upsert `eh_user`，校验正则 `^[A-Za-z0-9_-]{8,64}$`（非法值返回 400）。
  **注意**：这不是认证——playerId 是 bearer 标识，只授权匿名游戏数据；接 Clerk 时把行迁到真实
  用户 id 并停止信任该字段。
- **schema**：`eh_memory_fact` 补 `userId` + `category`（`fact` | `boundary`）、删掉 SQLite 遗留的
  `embedding`；`eh_summary` 变成 per-(user, companion) 的**头记录**（`content` 可为空，
  另存 `messageCount` / `lastSummaryAt` / `version`，因为计数器在第一次摘要前就存在）；
  新增 `eh_memory_entity` / `eh_memory_episode`；`eh_message` 补 `(userId, companionId, createdAt)` 索引。
- **存储层**：`src/lib/memory/server-store.ts` —— `loadServerMemory` / `saveServerMemory`
  （事务内 delete+insert 的**整体替换**，幂等，重试不会重复插入）/ `deleteServerMemory` /
  `deleteServerFact`。另有 `ensureCompanionRow()`：用户自建伴侣只存在于浏览器注册表，
  记忆表有 FK 指向 `eh_companion`，缺失时补一行占位，避免外键报错。
- **API**：`GET/PUT/DELETE /api/memory`、`DELETE /api/memory/fact`（按 fact 文本定位）、
  `GET /api/memory/export`（JSON 附件下载）、`GET /api/companions/:id/messages`（历史回读）。
  `/api/chat` 新增 `playerId` + `companionId`，用 Next `after()` 在响应结束后写 user/assistant
  两条 `eh_message`（流式用 Promise 接力拿到完整回复，90s 超时兜住被放弃的流），写失败只记日志。
- **客户端**：聊天页 mount 时**服务端优先**读取历史与记忆，失败回落 localStorage；
  记忆更新走 700ms 防抖的整体 PUT；服务端为空而本地有数据时把本地推上去（迁移 P1 前的浏览器数据）。
  首次历史写入时若最旧一条是用户消息，会把 `first_mes` 开场白补回，保持对话完整。

**踩坑记录（重要）**：`prisma db push` 在**当前这个 Supabase 项目上不可用**——库里还有另一个项目
的表（`public.dr_users` → `auth.users`）构成跨 schema 外键，introspection 直接以 P4002 失败，
README 里那条命令是过时的。另外 Prisma CLI 只读 `.env`，而本仓库只有 `.env.local`（`.env` 被
gitignore），所以 `db push` 连环境变量都拿不到。改为：

```bash
cp -n .env.local .env                                  # Prisma CLI 只认 .env
npx prisma db execute --file prisma/sql/2026-09-21-memory-p1.sql --schema prisma/schema.prisma
npx prisma generate
```

迁移前用 `node --env-file=.env scripts/db-inspect.mjs` 确认 `eh_message` / `eh_memory_fact` /
`eh_summary` 均为 0 行（`eh_user` 1 行、`eh_companion` 10 行），所以 NOT NULL 回填不会丢数据。
`scripts/db-inspect.mjs` 已留在仓库里备用。

**未做**：`/api/companions` 仍硬编码 `demo-user`（伴侣花名册走 md 注册表，与记忆无关），
身份只作用于消息与记忆；localStorage 历史的一次性迁移脚本仍未做（服务端为空时会把本地记忆推上去，
但**历史消息**不做回填）。

### P2 · 隐私控制（1 天）

比原稿估计少很多——UI 基本已存在（`MemoryPanel`、清空按钮、Markdown 导出），
缺的是服务端端点与"删除单条"：

- [ ] `GET /api/memory?companionId=` —列出当前用户的 facts + summary；
- [ ] `DELETE /api/memory/:factId` — 删除单条；
- [ ] `DELETE /api/memory?companionId=` — 清空该 companion 的记忆；
- [ ] `GET /api/memory/export?companionId=` — JSON 导出（呼应"own forever"的产品承诺，
      与现有 Markdown 导出并存）；
- [ ] 账号 / companion 删除流程接入级联删除（message / summary / fact）；
- [ ] boundary 类记忆在 UI 中显式展示且可撤销。

**验收**：删除某条 fact 后，下一轮对话中该事实不再出现。

#### P2 实现记录（2026-09-21，已完成）

- `MemoryPanel` 拆成三段：**你设过的边界**（`Boundary:` 前缀，琥珀色高亮，独立的撤销按钮）、
  关于你（每条一个 ✕「忘掉这条」）、人物 / 事物、回忆片段。
- 头部新增「导出 JSON」链接，指向 `GET /api/memory/export`（服务端导出，含 `attachment` 文件名），
  与原有的 Markdown 导出并存。
- 「清空记忆」现在同时清本地与服务端（`DELETE /api/memory`）；删单条走
  `DELETE /api/memory/fact`，先改本地再打服务端，避免下一次整体 PUT 把已删事实又写回来。
- 级联删除依赖 schema 上的 `onDelete: Cascade`（user / companion 删除时带走记忆与消息）。

#### P1 / P2 验证记录（2026-09-21，真实 Supabase + 真实浏览器）

接口层（临时冒烟脚本打真实服务，10/10 通过）：新玩家无记忆 · 非法 playerId → 400 ·
PUT 记忆 · 回读时 facts/boundary/entity/episode/summary/计数器全部保真 · JSON 导出带 attachment ·
删单条 fact `removed=1` · 流式对话落库（`roles=user,assistant`）· 清空后为 null · 玩家之间互相隔离。

浏览器层（Playwright + `next start`，真实 DeepSeek）：

| 检查 | 结果 |
|---|---|
| 发一条消息后查服务端 | `serverRoles: ["user","assistant"]`；`facts: ["User has a corgi named Rex.", "User brought Rex through the portal into the Archives…"]`（第二条是 LLM 抽取，证明 P0 抽取 → P1 落库链路通） |
| 清空 localStorage 的 `everheart_msgs_*` / `everheart_mem_*` 后刷新 | `historyRestored: true`（历史来自 `eh_message`）、`memoryPanelHasCorgi: true`（记忆来自 `eh_memory_fact`） |
| 记忆面板 | 2 条事实各带 ✕；点 ✕ 后服务端只剩 1 条 |
| 导出 | `attachment; filename="everheart-memory-demo-elena.json"`，569 字节含 `userProfile` |
| 边界段 | 渲染为 `⛔do not call the user 哥哥✕`、amber 样式、点 ✕ 后服务端已移除 |
| 控制台 | 0 errors / 0 warnings |

构建与测试：`tsc --noEmit` 干净、`npm test` 26 条全过（新增 `sanitizePlayerId` 用例）、
`next build` 通过（`/api/memory`、`/api/memory/fact`、`/api/memory/export`、
`/api/companions/[id]/messages` 均已注册）。

### P3 · 向量检索：建议无限期推迟

`src/lib/memory/retrieval.ts` 已实现"词法重叠 + 时效衰减（14 天半衰期）+ 重要度"的
复合打分（CrewAI 风格），对单个 companion 几十到几百条 fact 完全够用。

- 不引入 embedding 供应商，等于同时解掉原稿的待确认问题 1；
- 保住了"一次性付费、压低边际成本"的产品定位（原稿 §5 的第 1 条理由）；
- 等真实数据证明词法召回不足，再启用 pgvector：届时补 `embedding vector(1536)` 列
  + 回填脚本 + `context-assembler` 的超阈值分支。

**触发条件**：不是"要做得更智能"，而是"实测中确实出现召回不足"。

---

## 4. Whodunit Voice 方案

原稿（`claude_03`）的单增量点是对的，但定性需要改写：**这不是成本优化，是连续性记忆。**

### P0 · 审讯滚动摘要（0.5–1 天）

问题重述：服务端只向嫌疑人 prompt 发送最近 12 条消息，因此玩家说"你刚才明明说钥匙在
你口袋里"时，嫌疑人已经完全不知道那回事——长审讯的人设连续性会崩。

设计要点：

- **触发条件按窗口算**：每 8 轮问答折叠一次，阈值做成常量 + 环境变量
  （`INTERROGATION_SUMMARY_EVERY=8`），便于按真实游玩数据调整；
- **存储二选一**：
  - 方案 i（原稿）：新增 `interrogation_summary` 表，主键 `(case_id, suspect_id,
    player_session_id)`。需要给 `/api/chat` 请求体补 `playerId`（当前未传）。
  - **方案 ii（推荐先做，零 schema 改动）**：服务端生成摘要后随响应返回，客户端塞进
    现有存档 blob 的新字段；跨设备照样同步，因为 blob 本就存在服务端
    （`game_states`）。只需给 `/api/chat` 请求体补 `summary`。
- **prompt 组装**：摘要注入 `buildSuspectSystemPrompt`，并明确写"这只是你记得的对话经过"，
  避免摘要复述 `secret`（服务端持有、不下发）或与 mood 状态冲突；
- **异步与失败降级**：生成摘要是第二次 LLM 调用，必须失败静默降级为"无摘要"，绝不阻塞回复；
  **注意：若部署在 Vercel，响应结束后的后台任务随时可能被冻结**，那种情况下应在折叠点
  由客户端调用一个专门的摘要端点，而不是依赖 `setImmediate`/fire-and-forget；
- **现有存档窗口差异**：客户端裁到每嫌疑人 30 条、服务端只用 12 条，引入摘要时这个差异要
  在代码里写清楚，避免以后误判。

**不改动**：线索解锁逻辑（客户端关键词匹配）与 `secret` / `revealRules` 的服务端持有设计。

**验收**（替代原稿 §3 的第 1 条，因为"prompt 不再线性增长"现在就已满足）：

1. 对同一嫌疑人连续问 20+ 轮后，嫌疑人仍能正确引用第 13 轮以前的证词；
2. 摘要折叠前后，人设一致性与语气无明显劣化（人工抽查）；
3. 线索解锁回归：折叠开启前后，同一组关键词测试用例解锁结果一致；
4. 玩家刷新 / 关页后续玩，摘要能正确恢复。

### P1 · 可选、优先级低（另开文档）

- 把摘要从客户端 blob 迁到 `interrogation_summary` 表；
- 跨嫌疑人 / 跨案件的玩家画像（如"玩家对 A 撒了谎"）。

### 记录（不在本次范围）

线索 keywords 直接下发到客户端，且分数依赖客户端上报 `cluesFound` 后服务端重算
（`server.js:631`）。若以后做排行榜防作弊，这里需要先加固——与记忆功能无关，
仅作记录。

---

## 5. 待决策问题

**原稿 4 问的处置：**

1. ~~Embedding 供应商~~ → **建议取消**（见 P3，不引入向量检索）。
2. Fact 抽取用的模型 → 沿用 DeepSeek。抽取走 `MODEL_LADDER.cheap`，当前实现里各档位
   都映射到同一个 `DEEPSEEK_MODEL`（`src/lib/llm/deepseek.ts:45`），所以"控成本"目前
   没有实际差别，除非另接轻量模型。
3. 是否对 `factValue` 做应用层加密 → **待定**。18+ 场景下记忆可能含敏感偏好，
   建议至少确认 Supabase 静态加密已开启，并评估是否对敏感类别做应用层加密。
4. 消息保留策略 → **待定**。影响存储成本与合规，建议先明确"无限期保留"还是
   "N 天后归档为摘要"。

**新增：**

5. Everheart 身份方案：现在接 Clerk，还是先用匿名 `playerId` 过渡？（建议后者）
6. Everheart 存储形态：四张表 vs 单张 JSONB blob？（建议先四张表；若要一天版则 JSONB）
7. Whodunit 摘要存储：客户端 blob 回传 vs 新增服务端表？（建议先前者）
8. **方向性确认**：Everheart README 把"对话数据只留在浏览器"写成 intentional design
   （`README.md:125`，`src/app/api/companions/route.ts:6` 的注释也这么说）。从代码看更像
   "没有用户身份"导致的结果而非隐私主张。如果它确实是刻意的隐私立场，P1 就要改成
   "端到端可选存储"而不是"默认服务端持久化"，前提完全不同，需先确认。

---

## 6. 附：关键文件索引

**Everheart**

| 文件 | 作用 |
|---|---|
| `src/lib/memory/memory-store.ts` | 记忆数据模型与 localStorage 读写（facts / entities / episodes / summary） |
| `src/lib/memory/retrieval.ts` | 词法召回 + 时效衰减 + 重要度复合打分 |
| `src/lib/memory/context-assembler.ts` | 把 card + 记忆 + 最近消息组装成 prompt |
| `src/lib/memory/fact-extractor.ts` | 离线规则抽取（facts / entities / episode 压缩） |
| `src/lib/memory/fact-extractor-llm.ts` | LLM 抽取与滚动摘要（`extractMemoryDelta`，P0 起被调用） |
| `src/lib/memory/export.ts` | Markdown 记忆导出 |
| `src/lib/llm/chat-orchestrator.ts` | 对话编排；`streamReply` 是生产路径（**无记忆写入**） |
| `src/app/chat/[companionId]/page.tsx` | 聊天页：记忆装载、注入、召回（P0 已改为注入召回 facts + boundary） |
| `src/app/api/chat/route.ts` | 对话端点（接收 card + memory） |
| `src/app/api/memory/extract/route.ts` | 🆕 P0：一次调用抽取 facts + 刷新滚动摘要 |
| `src/app/api/companions/route.ts` | 唯一在用 Prisma 的 API；硬编码 demo user |
| `prisma/schema.prisma` | `eh_message` / `eh_memory_fact` / `eh_summary` 三张未接线表 |

**Whodunit Voice**

| 文件 | 作用 |
|---|---|
| `server.js` | 零依赖 http 服务；`/api/chat`（`sanitizeMessages` 截断到 12 条）、`buildSuspectSystemPrompt` |
| `public/app.js` | 客户端状态机：会话历史、`unlockClues()` 关键词解锁、存档 blob 组装 |
| `data/db.mjs` | SQLite / Turso 双后端：`players` / `play_sessions` / `game_states` |
| `data/cases/*` | 案件 JSON（线索 keywords、嫌疑人 secret / revealRules） |
