# Toonflow 架构重构：统一 Agent 模式选择系统

## 给新对话的完整交接文档

---

## 一、项目基本信息

| 项目 | 路径 |
|------|------|
| **项目根目录** | `G:\anime\toonflow_fresh` |
| **后端项目** | `G:\anime\toonflow_fresh\Toonflow-app` (Express + TypeScript + SQLite) |
| **前端项目** | `G:\anime\toonflow_fresh\Toonflow-web` (Vue 3 + Vite + Ant Design Vue) |
| **数据库文件** | `G:\anime\toonflow_fresh\Toonflow-app\db.sqlite` |
| **后端启动** | `cd Toonflow-app && npm run dev` (端口 60000) |
| **前端启动** | `cd Toonflow-web && npm run dev` |
| **GitHub** | `https://github.com/AlphaLins/manju.git` |

---

## 二、改造目标

### 当前问题
现在创建项目时必须选择"短剧模式"或"古诗词模式"，两种模式各有完全独立的前端页面、后端路由、数据库表、Agent 代码，导致大量代码重复、维护困难。

### 改造后的效果
1. **创建项目时不再区分模式** — 所有项目使用统一的工作流程
2. **在项目设置中选择 Agent 风格** — 新增一个 `agentStyle` 字段（`short_drama` | `poetry`），决定该项目使用哪套 Agent 提示词
3. **统一数据库表** — 删除所有 `t_poetry_*` 表，所有数据存入统一的 `t_*` 表
4. **统一前端视图** — 删除 `poetryProjectDetail`，所有项目进入同一个 `projectDetail` 页面
5. **合并后端路由** — 删除所有 `poetry_*` 路由，统一路由根据项目设置动态选择 Agent 类
6. **保留两套 Agent 代码** — `outlineScript` 和 `poetryOutlineScript` 都保留，在路由层通过动态 import 切换

---

## 三、当前架构清单（待改造的文件）

### 3.1 数据库表（SQLite）

**保留的表**（短剧模式的统一表）：
- `t_novel` — 小说/原文章节
- `t_outline` — 大纲
- `t_script` — 剧本
- `t_storyboard` — 分镜
- `t_storyline` — 故事线
- `t_assets` — 角色/道具/场景资产
- `t_chatHistory` — 聊天记录
- `t_project` — 项目信息
- `t_prompts` — Agent 提示词配置
- `t_aiModelMap` — AI 模型映射

**需删除的表**：
- `t_poetry_novel`
- `t_poetry_outline`
- `t_poetry_script`
- `t_poetry_storyboard`
- `t_poetry_storyline`
- `t_poetry_assets`
- `t_poetry_chatHistory`

### 3.2 后端 Agent 代码

| Agent 文件 | 操作 |
|-----------|------|
| [src/agents/outlineScript/index.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/agents/outlineScript/index.ts) | **保留** — 短剧大纲 Agent |
| [src/agents/poetryOutlineScript/index.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/agents/poetryOutlineScript/index.ts) | **保留** — 古诗大纲 Agent，但需修改内部 DB 表名从 `t_poetry_*` → `t_*` |
| `src/agents/storyboard/*` | **保留** — 短剧分镜 Agent |
| `src/agents/poetryStoryboard/*` | **保留** — 古诗分镜 Agent，但需修改内部 DB 表名从 `t_poetry_*` → `t_*` |

> [!IMPORTANT]
> `poetryOutlineScript` 和 `poetryStoryboard` 内部所有 `t_poetry_outline` → `t_outline`、`t_poetry_novel` → `t_novel` 等表名引用必须全部替换。但提示词 code 引用（`poetryOutlineScript-main` 等）保持不变，因为它们在 `t_prompts` 表中仍然是独立的记录。

### 3.3 后端路由

**保留的路由**（`src/routes/`）：
| 目录 | 功能 |
|------|------|
| `outline/` | 大纲路由（含 WebSocket [agentsOutline.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/routes/outline/agentsOutline.ts)）|
| `script/` | 剧本路由 |
| `storyboard/` | 分镜路由（含 WebSocket）|
| `video/` | 视频路由 |
| `novel/` | 小说章节 CRUD |
| `assets/` | 资产 CRUD |
| `project/` | 项目 CRUD |
| `setting/` | 设置 |
| `prompt/` | 提示词管理 |
| `user/` | 用户 |
| `task/` | 任务 |
| `other/` | 其他 |
| `index/` | 索引 |

**需删除的路由**：
| 目录 | 说明 |
|------|------|
| `poetry_outline/` | 古诗大纲路由（合并到 `outline/`）|
| `poetry_script/` | 古诗剧本路由（合并到 `script/`）|
| `poetry_storyboard/` | 古诗分镜路由（合并到 `storyboard/`）|
| `poetry_video/` | 古诗视频路由（合并到 `video/`）|
| `poetry_novel/` | 古诗小说路由（合并到 `novel/`）|
| `poetry_assets/` | 古诗资产路由（合并到 `assets/`）|
| `poetry/` | 旧版诗词漫游录独立流水线 |

**路由注册文件**: [src/router.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/router.ts) — 需删除所有 `poetry_*` 路由注册

### 3.4 前端视图

| 目录 | 操作 |
|------|------|
| `src/views/projectDetail/` | **保留** — 统一工作台 |
| `src/views/poetryProjectDetail/` | **删除** — 古诗专用工作台 |
| `src/views/poetry/` | **删除** — 旧版诗词漫游录 |
| `src/views/project/` | **修改** — 项目列表，需去除模式分流逻辑 |
| `src/views/setting/` | **修改** — 设置页，需合并 Agent 配置 |

**前端路由文件**: [src/router/index.ts](file:///G:/anime/toonflow_fresh/Toonflow-web/src/router/index.ts) — 需删除 `/poetry` 路由

### 3.5 后端工具函数

| 文件 | 操作 |
|------|------|
| [src/utils/generateScript.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/utils/generateScript.ts) | **保留** |
| [src/utils/generatePoetryScript.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/utils/generatePoetryScript.ts) | **保留**，修改内部表名 |
| [src/utils/editImage.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/utils/editImage.ts) | **保留** |
| [src/utils/editPoetryImage.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/utils/editPoetryImage.ts) | **保留**，修改内部表名 |
| [src/utils.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/utils.ts) | 检查是否需要调整导出 |

### 3.6 数据库初始化

**关键文件**: [src/lib/initDB.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/lib/initDB.ts)
- 第 1415-1452 行：`poetryOutlineScript-*` 的提示词定义 — **保留**（提示词记录需要保留）
- 需要修改提示词内容中的 `小说` → `古诗` 等词汇（这是一个已知但未修复的 bug）
- 需要删除 `t_poetry_*` 建表语句
- 需要在 `t_project` 表中新增 `agentStyle` 字段（默认值 `short_drama`）

---

## 四、详细实施方案（分 6 个阶段）

### 阶段 1：数据库迁移

1. **在 `t_project` 表中新增 `agentStyle` 字段**
   ```sql
   ALTER TABLE t_project ADD COLUMN agentStyle TEXT DEFAULT 'short_drama';
   ```
   - 已有项目中 `type = 'poetry'` 的记录，将 `agentStyle` 设为 `'poetry'`

2. **将 `t_poetry_*` 表中的数据迁移到对应的 `t_*` 表**
   - `t_poetry_novel` → `t_novel`
   - `t_poetry_outline` → `t_outline`
   - `t_poetry_script` → `t_script`
   - `t_poetry_storyboard` → `t_storyboard`
   - `t_poetry_storyline` → `t_storyline`
   - `t_poetry_assets` → `t_assets`
   - `t_poetry_chatHistory` → `t_chatHistory`
   
   > [!WARNING]
   > 迁移时注意 [id](file:///G:/anime/toonflow_fresh/Toonflow-web/src/views/setting/components/aiConfog.vue#52-67) 冲突！使用 `INSERT INTO ... SELECT` 时让 SQLite 自动分配新 id，或先查最大 id 再偏移。

3. **删除所有 `t_poetry_*` 表**
   ```sql
   DROP TABLE IF EXISTS t_poetry_novel;
   DROP TABLE IF EXISTS t_poetry_outline;
   -- ... 同理
   ```

4. **修改 [initDB.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/lib/initDB.ts)**
   - 删除所有 `t_poetry_*` 建表语句
   - 在 `t_project` 建表时加入 `agentStyle` 字段
   - 修复 `poetryOutlineScript-*` 提示词中的 `小说` → `古诗` 文本替换问题

### 阶段 2：后端路由合并

**核心改造文件**: [src/routes/outline/agentsOutline.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/routes/outline/agentsOutline.ts)

当前逻辑：
```typescript
import OutlineScript from "@/agents/outlineScript";
// ... 直接实例化 OutlineScript
```

改造后逻辑：
```typescript
// 根据项目的 agentStyle 动态选择 Agent
const project = await u.db("t_project").where({ id: Number(projectId) }).first();
const agentStyle = project?.agentStyle || "short_drama";

let agent;
if (agentStyle === "poetry") {
  const { default: PoetryOutlineScript } = await import("@/agents/poetryOutlineScript");
  agent = new PoetryOutlineScript(Number(projectId));
} else {
  const { default: OutlineScript } = await import("@/agents/outlineScript");
  agent = new OutlineScript(Number(projectId));
}
```

**需要对以下路由文件做同样的改造**：
- [src/routes/outline/agentsOutline.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/routes/outline/agentsOutline.ts) — 大纲 WebSocket
- `src/routes/storyboard/` 中的 WebSocket 文件 — 分镜 WebSocket
- `src/routes/script/generateScriptApi.ts` — 剧本生成（根据 agentStyle 选择 [generateScript](file:///G:/anime/toonflow_fresh/Toonflow-app/src/utils/generateScript.ts#94-145) 或 [generatePoetryScript](file:///G:/anime/toonflow_fresh/Toonflow-app/src/utils/generatePoetryScript.ts#94-145)）
- `src/routes/script/generateScriptSave.ts` — 同上
- [src/routes/storyboard/generateStoryboardApi.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/routes/storyboard/generateStoryboardApi.ts) — 分镜生成（根据 agentStyle 选择 `editImage` 或 `editPoetryImage`）

**然后**：
1. 删除整个 `src/routes/poetry_outline/` 目录
2. 删除整个 `src/routes/poetry_script/` 目录
3. 删除整个 `src/routes/poetry_storyboard/` 目录
4. 删除整个 `src/routes/poetry_video/` 目录
5. 删除整个 `src/routes/poetry_novel/` 目录
6. 删除整个 `src/routes/poetry_assets/` 目录
7. 删除整个 `src/routes/poetry/` 目录
8. 在 [src/router.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/router.ts) 中删除所有 `poetry_*` 路由注册

### 阶段 3：Agent 代码修改

修改 [poetryOutlineScript/index.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/agents/poetryOutlineScript/index.ts) 和 `poetryStoryboard/*`，将所有内部的 DB 表名引用从 `t_poetry_*` 改为 `t_*`：

| 文件 | 替换规则 |
|------|----------|
| [src/agents/poetryOutlineScript/index.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/agents/poetryOutlineScript/index.ts) | `t_poetry_novel` → `t_novel`，`t_poetry_outline` → `t_outline`，`t_poetry_script` → `t_script`，`t_poetry_storyline` → `t_storyline`，`t_poetry_assets` → `t_assets` |
| `src/agents/poetryStoryboard/*` | `t_poetry_storyboard` → `t_storyboard`，`t_poetry_script` → `t_script` |

同时修复 [poetryOutlineScript/index.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/agents/poetryOutlineScript/index.ts) 中的已知问题：
- 第 131-136 行 [getNovelInfo()](file:///G:/anime/toonflow_fresh/Toonflow-app/src/agents/poetryOutlineScript/index.ts#126-142) 中的 `小说名称` → `作品名称` 等
- 第 569 行 [buildEnvironmentContext()](file:///G:/anime/toonflow_fresh/Toonflow-app/src/agents/outlineScript/index.ts#556-582) 中的 `已加载章节列表` → `当前已加载的古诗章节列表`

同理修改工具函数：
- [src/utils/generatePoetryScript.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/utils/generatePoetryScript.ts) — 内部表名 `t_poetry_*` → `t_*`
- [src/utils/editPoetryImage.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/utils/editPoetryImage.ts) — 内部表名 `t_poetry_*` → `t_*`

### 阶段 4：前端改造

#### 4.1 项目创建/设置
- **项目创建对话框**（在 `src/views/project/` 中）：去除 `type: 'poetry'` 的选项逻辑。所有项目创建后 `agentStyle` 默认为 `short_drama`
- **项目设置**：新增 "Agent 风格" 下拉选择器，可选 `短剧模式` / `古诗词模式`。修改后向后端 `POST /project/updateProject` 发送 `agentStyle` 字段

#### 4.2 项目列表跳转
- 当前 `src/views/project/` 中存在根据 `type === 'poetry'` 跳转到 `/poetry` 路由的逻辑 — **删除这段分流逻辑**，所有项目统一跳转到 `/projectDetail`

#### 4.3 删除多余前端文件
- 删除整个 `src/views/poetryProjectDetail/` 目录
- 删除整个 `src/views/poetry/` 目录
- 在 [src/router/index.ts](file:///G:/anime/toonflow_fresh/Toonflow-web/src/router/index.ts) 中删除 `/poetry` 路由

#### 4.4 设置页面  
- `src/views/setting/` — 目前可能有针对古诗词 Agent 的独立配置区域，需要合并或确认其是否已经通过 `t_prompts` 和 `t_aiModelMap` 的 code 前缀自动区分

### 阶段 5：清理

1. 删除所有不再需要的 `t_poetry_*` 相关死代码
2. 搜索全项目中所有 `poetry` 关键字，确认无遗留引用
3. 清理 [initDB.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/lib/initDB.ts) 中的 `t_poetry_*` 建表语句

### 阶段 6：验证

1. 重启后端，确认无报错
2. 重启前端，确认无编译错误
3. 创建新项目 → 确认不再要求选择模式
4. 进入项目设置 → 切换 Agent 风格为"古诗词模式"
5. 进入大纲管理 → 导入一首古诗 → 发送"开始" → 确认使用的是古诗 Agent 的提示词
6. 在另一个项目中保持"短剧模式" → 确认使用的是短剧 Agent
7. 检查数据库确认只有 `t_*` 表，无 `t_poetry_*` 表

---

## 五、关键注意事项

> [!CAUTION]
> **数据迁移必须在代码改造之前完成！** 否则改造后的代码会去读 `t_*` 表，但古诗项目的数据还在 `t_poetry_*` 表中。

> [!IMPORTANT]
> **`t_prompts` 中的 `poetryOutlineScript-*` 记录必须保留！** 它们是古诗 Agent 的提示词配置，不能删除。只是不再需要 `t_poetry_*` 数据表。

> [!WARNING]  
> **[initDB.ts](file:///G:/anime/toonflow_fresh/Toonflow-app/src/lib/initDB.ts) 中 `poetryOutlineScript-main` 的 `defaultValue`（第 1420 行）仍然包含"小说章节"等错误文本**，必须在此次改造中一并修复为"古诗章节"。同时 `poetryOutlineScript-a1`（第 1430 行）包含"分析小说原文"也需修复。
