# 项目交接概要（Toonflow / Cosmos）

## 基本信息
- 仓库根目录：`G:/anime/cosmos`
- 前端：`Toonflow-web`（Vue 3 + Vite）
- 后端：`Toonflow-app`（Express + Knex/SQLite）
- 当前分支：`master`

## 已完成内容（关键变更）
### 1) 项目创建：Agent 风格选择与展示
- **创建项目弹窗**：已确认存在“Agent 风格”（普通/古诗特化）并提交 `agentStyle`。
  - 文件：[Toonflow-web/src/views/project/components/addProject.vue](Toonflow-web/src/views/project/components/addProject.vue)
- **项目列表**：在时间行左侧追加“风格：xxx”显示。
  - 文件：[Toonflow-web/src/views/project/index.vue](Toonflow-web/src/views/project/index.vue)
  - 变更要点：
    - 项目类型增加 `agentStyle?: string | null`
    - UI 显示：`风格：{{ project.agentStyle === "poetry" ? "古诗特化" : "普通" }}`

### 3) 大纲/剧本管理在诗歌模式下返回空数据（已定位并修复）
**问题**：
- 诗歌模式项目进入“大纲管理/剧本管理”时，右侧数据为空或“生成剧本”按钮不显示。

**根因**：
- `/outline/getOutline`、`/script/geScriptApi` 固定读取 `t_outline/t_script`，
- 诗歌模式写入 `t_poetry_outline/t_poetry_script`，导致查询为空。

**修复**：
- 后端按 `project.agentStyle` 动态选择表。
  - [Toonflow-app/src/routes/outline/getOutline.ts](Toonflow-app/src/routes/outline/getOutline.ts)
  - [Toonflow-app/src/routes/script/geScriptApi.ts](Toonflow-app/src/routes/script/geScriptApi.ts)

**额外说明（按钮不显示）**：
- “生成剧本”按钮依赖 `item.element?.length`，而 `element` 由资产 **按名称精确匹配** 生成。
- 若资产名称与大纲中的角色/道具/场景名称不完全一致（如“主角” vs “沈云舟”），`element` 会为空 → 按钮隐藏。
- 解决：统一资产名称与大纲名称，或调整前端条件。

## 关键流程说明（避免再踩坑）
- 前端 `getStoryLine()` 使用 axios 拦截器返回的 `response.data`，因此正确读取路径是：
  - `res.data?.content`（而非 `res.data?.data?.content`）
- WebSocket `refresh` 事件收到 `storyline` 时会触发 `getStoryLine()`。
  - 文件：[Toonflow-web/src/views/projectDetail/components/outlineManager/index.vue](Toonflow-web/src/views/projectDetail/components/outlineManager/index.vue)

## 可能仍在运行的服务
- 后端 dev 服务：曾以 `npm --prefix G:/anime/cosmos/Toonflow-app run dev` 启动（端口 60000）。
- 前端 dev 服务：Vite（端口 5173）。

## 近期排查记录（简要）
- 通过控制台日志确认 `getStoryLine()` 被调用，但 API 返回 `data: null`。
- 通过后端日志确认 `saveStoryline` 已写入。
- 结论：读取表与写入表不一致。

## 未完成 / 待确认
1) **自动化：每五次更新项目后自动更新该记录文件**
   - 已配置 PostToolUse hook：Write|Edit 触发
   - 计数器：`record/.record-update.count`
   - 每 5 次覆盖生成当前交接摘要

## 建议的后续动作
- 若需关闭服务，可手动停止 dev 进程（当前会话内未执行停止命令）。
- 若继续开发，建议先确认 `agentStyle` 在数据库中的历史项目兼容性。

---

> 生成日期：2026-03-25
