# Everheart 后续计划（按优先级）

## ✅ 已完成（当前）

- [x] 项目骨架 + Prisma schema
- [x] 角色创建 Pipeline（多阶段 LLM）
- [x] Chat Orchestrator + 流式 API
- [x] **完整流式聊天页面**（侧边栏 + 消息列表 + 实时流式输出 + 停止按钮）
- [x] 3 个演示虚拟人物（Elena / Kai / Lyra）本地种子
- [x] localStorage 临时持久化（消息 + 伴侣列表）
- [x] Stripe 一次性购买 + webhook 骨架
- [x] **离线兜底引擎**（合并自 codex-everheart）：无 key 也能聊天/创建
- [x] **18+ AgeGate**（NSFW 伴侣进入前确认；正式版换身份验证）
- [x] **数据库迁移到 Supabase Postgres**（Prisma provider 切 postgresql，全部表 `eh_` 前缀）
- [x] **角色肖像图**（8 个演示角色，ComfyUI 本地生成 + 微动短视频，`public/companions/`）

> 2026-08-23：已与 codex-everheart 合并，本仓库为唯一 Everheart 应用。
> 原 codex-everheart 目录已移出 my-business（备份见 /private/tmp）。

## 🔜 下一步（建议顺序）

### P0 — 让主业务真正可用
1. **接入真实 DeepSeek Key**  
   - 在 `.env.local` 填入 `DEEPSEEK_API_KEY` / `DEEPSEEK_MODEL`  
   - 确认 `/api/chat` 流式返回正常

2. **Auth + 用户账号**  
   - Clerk 或 NextAuth  
   - 把当前 localStorage 数据写入 Supabase 的 `eh_user` / `eh_companion` 表

3. **把创建出的角色写入 DB / localStorage**  
   - Create 页面生成后自动跳转聊天  
   - 保存到 companions 列表（后续落 `eh_companion`）

4. **额度 / 权限检查**  
   - 聊天前检查 credits 或 BYOK  
   - 未购买用户限流

### P1 — 体验与变现
5. Stripe 测试支付完整闭环（成功页 + 解锁 NSFW）
6. 基础人像生成（fal / Replicate）
7. 记忆真正写入 DB（`eh_memory_fact` + `eh_summary`）
8. 简单 18+ 验证占位（先 checkbox，后接 Veriff/Stripe Identity）

### P2 — 增长与扩展
9. AppSumo / Gumroad 一次性链接
10. 角色卡导出 PNG（SillyTavern 兼容）
11. 语音（XTTS / Kokoro）
12. 创作者市场（Phase 2）
13. Tauri 桌面端

## 当前如何体验流式聊天

1. `cd everheart && pnpm install`
2. 配置 `DEEPSEEK_API_KEY`
3. `pnpm dev`
4. 打开 http://localhost:3000/chat（platform 下为 http://localhost:4904/chat）  
   或直接：
   - /chat/demo-elena  （神秘图书管理员）
   - /chat/demo-kai    （温暖咖啡师）
   - /chat/demo-lyra   （18+ 亲密伴侣）

聊天会实时流式输出，支持停止生成。消息保存在浏览器 localStorage。
