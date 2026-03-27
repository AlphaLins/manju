# 短剧流程按项目选择 Agent 风格设计

日期：2026-03-24

## 目标
- 移除“古诗模式”作为独立模式与路由分流。
- 在短剧流程内按项目选择“普通/古诗特化 agent”。
- 除 agent 选择外，其它流程（文章导入、短剧工作台等）保持短剧共用。

## 范围与非目标
- **范围**
  - 新增 `t_project.agentStyle` 字段（默认 `normal`）。
  - 创建项目时选择 agent 风格并写入项目。
  - 运行时根据 `agentStyle` 选择提示词 code（`outlineScript-*` vs `poetryOutlineScript-*`）。
  - 前端删除 `poetry` 模式分流逻辑。
- **非目标**
  - 不做步骤级覆盖（不在每一步单独选择）。
  - 不改变提示词编辑器与模型配置页结构。

## 架构设计
### 数据层
- 表：`t_project`
- 新字段：`agentStyle TEXT NOT NULL DEFAULT 'normal'`
- 兼容旧库：`fixDB.ts` 补齐字段；旧项目默认 `normal`。
- 值域约定（前后端一致）：
  - `normal` = 普通 agent
  - `poetry` = 古诗特化 agent

### 运行时提示词选择规则
- 在以下入口读取 `project.agentStyle` 并选择提示词 code：
  - `outline/agentsOutline` 大纲生成
  - `scriptManager` 相关生成入口（若沿用同一 Agent 基类，使用相同切换规则）
- 规则：
  - `normal` → `outlineScript-*`
  - `poetry` → `poetryOutlineScript-*`
- 提示词读取规则不变：`customValue` 优先，空则回退 `defaultValue`。
- 未知值回退在后端提示词选择处处理，并记录 warn 日志。

### 前端交互
- 创建项目对话框新增“Agent 风格”选择：`普通 / 古诗特化`。
- 项目列表去除 `poetry` 分流，统一进入短剧工作台。
- 创建后仍可进入短剧流程；差异仅在调用不同 agent。
- 本期不提供“修改已创建项目风格”的入口（保持数据稳定；如需变更后续再扩展）。

## 错误处理
- 未设置 `agentStyle` 时后端默认按 `normal` 处理。
- 任何未知值回退 `normal`（防止旧数据异常），并记录日志。

## 验证策略
- 手动：创建项目选择“古诗特化 agent”，进入工作台生成大纲，通过后端日志或调试输出确认使用 `poetryOutlineScript-*`。
- 回归：普通项目仍使用 `outlineScript-*`。

## 影响面
- 后端：`t_project` 迁移、`agentsOutline.ts` 及相关生成入口。
- 前端：`addProject.vue`、`project/index.vue`。
