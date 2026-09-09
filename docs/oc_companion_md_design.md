# Everheart — Companion Markdown (SOUL.md) Design Spec

**Date:** 2026-09-08 · **Status:** Implemented (2026-09-08) · **Author:** OpenCode (oc_)

## 1. Vision

每个聊天对象（companion）由**一个人类可读、可手写的 Markdown 文件**定义。
这个文件就是该角色的**唯一事实源**（single source of truth）——它是什么性格、
什么背景、什么语气，全部写在一个 `.md` 里，用户可以随意打开、编辑、分享、备份。

概念上借用 Hermes Agent 的 **SOUL.md / USER.md 双文件分离**：

| Hermes 概念 | Everheart 对应物 | 状态 |
|---|---|---|
| SOUL.md（角色是谁，静态，用户可编辑） | **伴侣 md 文件**（本设计） | 🆕 新建 |
| USER.md（对方了解"你"的档案，动态，agent 维护） | **既有记忆系统**（localStorage facts/entities/episodes） | ✅ 已建 |

原则：**md 定义"他是谁"，记忆决定"他记得你什么"**。两者分开存储、分开演进。
SillyTavern JSON card 只是 md 的**运行时派生视图**，不再是真相。

## 2. 已确认的设计决策

1. **md 是唯一事实源** —— `companions/<id>.md` 是角色的权威定义，运行时解析成
   `CharacterCardSchema` 供聊天/TTS/肖像等消费。数据库不再持有角色真相。
2. **记忆留在 localStorage + 可选导出** —— 记忆系统（`CompanionMemory`）保持现状，
   新增**手动**一键导出为可读 markdown（USER.md 快照），便于备份/迁移。
3. **全浏览器存储** —— 演示角色：仓库内的 md 随包下发（PWA 预缓存）；
   用户创建/拥有的角色：md 全文存 IndexedDB（可导出下载）。无登录、无 DB 依赖。
4. **演示角色 md 手写** —— 8 个演示角色的 md 放 `companions/` 目录，人工维护，
   不从 `demo-companions.ts` 生成。`demo-companions.ts` 退役或被 md 驱动。
5. **单文件自包含** —— 每个角色一个 `.md`，`first_mes` / `mes_example` 等长文
   也写在正文内，不拆分 sidecar。一个文件 = 一个可移植制品。

## 3. md 文件格式

### 3.1 文件位置与命名

```
companions/
├── elena.md
├── kai.md
├── lyra.md
└── ...（8 个演示角色 + 后续模板）
```

命名：`<companion-id>.md`，id 即现有 companion 的 slug（如 `demo-elena`、`elena`）。

### 3.2 结构：frontmatter（结构化）+ 正文（散文）

```
---
id: demo-elena
name: Elena
age: 28
isNsfw: false
tags: [mysterious, bookworm, mentor]
voice:
  en: en-US-AriaNeural
  zh: zh-CN-XiaoxiaoNeural
  rate: 1.0
portraitUrl: /companions/elena/portrait.png
alternateUrl: /companions/elena/alternate.png
clipUrl: /companions/elena/clip.mp4
---

# Elena — 神秘图书管理员

## 性格 personality
安静、克制、带着书卷气的幽默。她观察多于表达，……
（此处为散文，≥20 字，对应 CharacterCard.personality）

## 简介 description
暴雨夜的旧书店里，她是躲在那儿的管理员。（对应 CharacterCard.description）

## 背景 backstory
曾是大都会博物馆的修复师，因一场大火辞职，……
（≥30 字，对应 CharacterCard.everheart/compiled backstory）

## 场景 scenario
深夜，窗外暴雨，旧书店只剩你们两个人……

## 开场白 first_mes
"雨这么大，你还要站在门口吗？"

## 对话范例 mes_example
<START>
{{user}}: 我喜欢下雨天。
Elena: 因为雨声让人专注？我也这么觉得……
（整段为代码块或缩进文本，对应 mes_example）

## 关系动态 relationshipDynamic
她从导师逐渐变成知己，距离慢慢缩短。（可选）

## 癖好 kinks
- 专注时的轻声哼歌（可选，NSFW 角色）

## 界限 limits
- 不主动打探用户现实身份
- 不冒充真人
```

### 3.3 约定

- **frontmatter**（YAML，经 `gray-matter` 解析）只放机器关键字段：
  `id` / `name` / `age` / `isNsfw` / `tags` / `voice` / 三个资源 URL。
- **正文**用 `## <中文名> <english-key>` 二级标题分节，`english-key` 是解析锚点
  （跨语言稳定），中文名是给人看的。
- 固定分节顺序：`personality` → `description` → `backstory` → `scenario` →
  `first_mes` → `mes_example` → `relationshipDynamic` → `kinks` → `limits`。
  解析器按 key 读取，不依赖顺序；缺省可选分节则为空。
- `mes_example` 建议整段包在 fenced code block 里，避免 markdown 干扰解析。
- 长文上限对齐现有 schema 的行为约束（personality ≥20 字等），由 zod 校验兜底。

## 4. 解析与序列化（`src/lib/cards/md.ts`）

纯函数模块，双向转换：

```
md.parse(text: string): CharacterCard          // md → card（zod 校验）
md.serialize(card: CharacterCard): string      // card → md（用于用户创建角色）
```

- 解析：`gray-matter` 拆 frontmatter → 按 `## key` 正则切分正文分节 → 组装成
  `CharacterCard` → `CharacterCardSchema.parse()` 校验；失败抛出带分节名的错误。
- 序列化：`CharacterCard` → frontmatter + 分节正文（用户创建的角色的正式落盘格式）。
- **运行时契约永远是 `CharacterCardSchema`**。md 只是它的可读序列化。
  聊天 / TTS / 记忆 / 肖像管线**零改动**。

```
companions/*.md (bundled) 或 IndexedDB (用户创建)
    → md.ts 解析 (gray-matter + 分节 → CharacterCardSchema)
    → companion registry (bundled + 用户创建合并)
    → 现有管线: card + memory bundle → /api/chat（不变）✓
```

## 5. 存储架构（全浏览器）

| 来源 | 物理存放 | 生命周期 |
|---|---|---|
| 8 个演示角色 | 仓库 `companions/*.md`（随包，PWA service worker 预缓存） | 只读，随版本升级 |
| 用户创建/拥有的角色 | **IndexedDB** 存 md 全文（单 object store，按 id 索引） | 用户完全拥有 |
| 导出 | 下载 `<id>.md`（`Blob` + `URL.createObjectURL`） | 可移植、可备份、可分享 |

- IndexedDB 封装：`src/lib/companions/store.ts`，提供 `list / get / put / delete`。
- registry：`src/lib/companions/registry.ts`，合并 bundled（静态导入/预缓存）+ IndexedDB
  用户角色，优先用户角色（同名覆盖）。
- **Supabase `eh_companion` 彻底退出聊天主路径**。它保留为"市场/公开展示"的未来
  通道，不在本设计中做任何改动。
- PWA 预缓存清单加入 `companions/*.md`（离线可用）。

## 6. 记忆（USER.md 那半）与导出

- **存储不动**：`CompanionMemory` 继续在 localStorage（`everheart_mem_<id>`）。
- **新增手动导出按钮**（🧠 记忆面板内）：
  - 点击 → 把 `userProfile` facts / entities / episodes 渲染成可读 markdown
    （章节 + 时间戳），下载为 `<id>.memory.md`。
  - 内容结构借用 Hermes USER.md 风格：`## Facts` / `## Entities` / `## Episodes`
    （分项为散文一行条目）。
  - 这是"他记得你什么"的用户侧快照，可备份、迁移、换浏览器后（可选）导入。
- **不**做自动定时导出（用户已确认手动足够）。
- 记忆文件不是唯一事实源的一部分——它是**私密运行时数据**的用户侧备份。

## 7. 离线 brain / persona 生成器如何处理

- 手写演示卡平时走 md。无 key 时 `offline/brain.js` 照常消费解析出的 card。
- `offline/persona.js`（角色生成器）仍产出 `CharacterCard`，创建流程末尾
  调用 `md.serialize(card)` 落成 md 存 IndexedDB——**方向一致**，无特殊分支。

## 8. 迁移

1. 手写 8 个演示角色的 `companions/*.md`（内容取自现有 `demo-companions.ts` 的 card
   + `CompanionData` 的 voice / portrait 配置）。
2. `demo-companions.ts` 由"数据源"降级为"兼容层"（读 md 结果）或直接删除引用点，
   新增 `companions/*.md` 为唯一演示数据源。
3. `scripts/seed-companions-db.ts` 改为从 md 生成的 card 种库（仅当需要保留 DB 同步时；
   主路径不需要）。
4. 既有 localStorage 记忆 key 不动，用户已产生的记忆不受影响。

## 9. 文件落点（新增/改动）

```
新增:
  companions/*.md                          # 8 个演示角色（手写）
  src/lib/cards/md.ts                      # md ↔ CharacterCard（gray-matter + zod）
  src/lib/companions/store.ts              # IndexedDB 封装
  src/lib/companions/registry.ts           # bundled + 用户角色合并
  src/components/chat/MemoryExportButton.tsx  # 记忆手动导出
改动:
  src/lib/demo-companions.ts               # 改读 md 或移除
  public/sw.js                            # 预缓存 companions/*.md
  src/app/api/companions/route.ts          # （可选）改为 md 驱动 / 保持现状
```

## 10. 边界与错误处理

- **md 解析失败**：registry 跳过坏文件并 console.warn（带文件名）；不阻塞其余角色；
  用户创建的角色解析失败 → 明确报错并保留 IndexedDB 原文（不覆盖、不删除）。
- **schema 校验失败**：同上，错误信息含具体分节/字段。
- **IndexedDB 不可用**（隐私模式）：回退到 localStorage 存 md 文本（尽力而为）。
- **同名冲突**：用户角色覆盖 bundled（用户拥有的优先）。
- **导出**：序列化 localStorage 记忆为 markdown；导出失败仅 toast，不阻塞聊天。

## 11. 测试

- `md.ts` 单测：手写样例 md → parse → 校验通过；坏 md 报错含分节名；
  serialize(card) → parse 往返等价。
- `registry.ts` 单测：merged 顺序、同名覆盖、坏文件跳过。
- `store.ts` 集成测试（无头 IndexedDB，如 `fake-indexeddb`）或手动验证。
- 记忆导出：给定 mock `CompanionMemory` → 输出 md 包含三个章节与条目。

## 12. 明确不做（非目标，MVP）

- 服务端存储 md / 账号体系 / 云同步（路由到 ROADMAP P1 auth 之后）
- 记忆自动导出 / 定时备份
- 市场 / 模板库 / 多端同步（phase 2）
- 修改聊天/TTS/记忆/肖像既有管线