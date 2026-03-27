# 古诗模式多智能体架构设计文档

## 文档信息

| 项目 | 说明 |
|------|------|
| 创建日期 | 2026-03-14 |
| 作者 | Claude Code |
| 状态 | 待审核 |
| 关联项目 | Toonflow (Cosmos) - AI 短剧工厂 |

---

## 1. 概述

### 1.1 背景

当前古诗模式采用单次 LLM 调用方式，缺乏多智能体协作能力，不支持多轮对话交互。为提升用户体验和创作质量，需要参照 AI 短剧模式的架构，为古诗模式设计多智能体系统。

### 1.2 目标

- 参照 `OutlineScript` Agent 架构，构建古诗模式的多智能体系统
- 支持对话式交互 + 快捷操作按钮的混合交互模式
- 实现快速创作的核心使用场景
- 保持与现有系统的兼容性

### 1.3 核心功能

| 编号 | 功能 | 说明 |
|------|------|------|
| 1 | 深度解析诗词 | 分析意境、意象、情感、韵律、典故等 |
| 2 | 生成创作方案 | 整体艺术风格规划、分镜数量建议、节奏设计 |
| 3 | 生成分镜脚本 | 每句诗的画面描述、运镜方式、转场设计 |
| 4 | 优化图像提示词 | 润色 prompt、适配特定画风模型 |
| 5 | 设计音乐方案 | 风格选择、歌词创作、情绪曲线 |
| 6 | 一键魔法创作 | 全自动流水线：解析→方案→提示词→生成 |
| 7 | 导出/分享 | 剪映草稿、视频合成、分享链接 |

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                    PoetryAgent 架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐                                            │
│  │   前端 UI    │  对话框 + 快捷按钮                          │
│  │  (Vue 组件)  │  [一键创作] [解析] [方案] [分镜] [音乐]       │
│  └──────┬──────┘                                            │
│         │ WebSocket / HTTP                                  │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PoetryAgent (主控 Agent)                │   │
│  │  ├── history: ModelMessage[]    (对话历史)           │   │
│  │  ├── emitter: EventEmitter      (事件系统)           │   │
│  │  └── Tools:                                         │   │
│  │      ├── getAnalysis / saveAnalysis                 │   │
│  │      ├── getPlan / savePlan                         │   │
│  │      ├── getPrompts / savePrompts                   │   │
│  │      ├── generateImage / generateVideo / generateMusic │ │
│  └──────┬──────────────────────────────────────────────┘   │
│         │ 调用 Sub-Agent                                    │
│         ▼                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                   Sub-Agents                         │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ │   │
│  │  │ 诗词分析师 │ │ 视觉导演  │ │ 运镜导演  │ │音乐作曲│ │   │
│  │  │ Analyst  │ │ VisualDir│ │ MotionDir│ │Composer│ │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └────────┘ │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    数据层                            │   │
│  │  t_poetry_session │ t_poetry_analysis │ t_poetry_plan │
│  │  t_poetry_prompt  │ t_poetry_video    │ t_poetry_music │
│  │  t_poetry_chat    │ t_poetry_task                      │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Sub-Agent 角色定义

| Agent | 代码名 | 职责 | 输出 |
|-------|--------|------|------|
| **诗词分析师** | `analyst` | 深度解析诗词：意境、意象、情感、韵律、典故 | `PoetryAnalysis` |
| **视觉导演** | `visualDirector` | 设计画面构图、艺术风格、生成图像提示词 | `VisualPrompt[]` |
| **运镜导演** | `motionDirector` | 设计镜头运动、转场效果、生成视频提示词 | `VideoPrompt[]` |
| **音乐作曲** | `composer` | 分析韵律节奏、确定音乐风格、生成音乐提示词 | `MusicPrompt` |

### 2.3 协作流程

```
用户请求: "帮我创作《静夜思》，用水墨风格"
                    │
                    ▼
┌─────────────────────────────────────────────────────────┐
│              PoetryAgent (主控)                          │
│                                                         │
│  1. 判断任务类型 → "一键创作"                             │
│  2. 制定执行计划 → analyst → visualDirector →           │
│                    motionDirector → composer            │
│  3. 依次调用 Sub-Agent，传递上下文                        │
└─────────────────────────────────────────────────────────┘
                    │
        ┌───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
   │ analyst │ │visualDir│ │motionDir│ │ composer│
   │ 诗词分析 │ │ 视觉导演 │ │ 运镜导演 │ │ 音乐作曲 │
   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘
        │           │           │           │
        ▼           ▼           ▼           ▼
   保存分析结果  保存图像提示词  保存视频提示词  保存音乐提示词
   到数据库      到数据库       到数据库       到数据库
```

---

## 3. Tool 定义

### 3.1 Tool 完整列表

#### 诗词分析类

| Tool | 描述 | 输入 | 输出 |
|------|------|------|------|
| `getAnalysis` | 获取当前会话的诗词分析结果 | - | `PoetryAnalysis` |
| `saveAnalysis` | 保存诗词分析结果 | `PoetryAnalysis` | 成功/失败 |
| `getPoemText` | 获取诗词原文 | - | `string` |

#### 创作方案类

| Tool | 描述 | 输入 | 输出 |
|------|------|------|------|
| `getPlan` | 获取创作方案 | - | `CreationPlan` |
| `savePlan` | 保存创作方案 | `CreationPlan` | 成功/失败 |
| `updatePlan` | 更新创作方案 | `Partial<CreationPlan>` | 成功/失败 |

#### 提示词类

| Tool | 描述 | 输入 | 输出 |
|------|------|------|------|
| `getPrompts` | 获取所有分镜提示词 | - | `Prompt[]` |
| `saveVisualPrompts` | 保存图像提示词 | `VisualPrompt[]` | 成功/失败 |
| `saveVideoPrompts` | 保存视频提示词 | `VideoPrompt[]` | 成功/失败 |
| `saveMusicPrompt` | 保存音乐提示词 | `MusicPrompt` | 成功/失败 |
| `updatePrompt` | 更新单个提示词 | `PromptUpdate` | 成功/失败 |

#### 生成类

| Tool | 描述 | 输入 | 输出 |
|------|------|------|------|
| `generateImage` | 生成单张图片 | `promptId, style?` | `imageUrl` |
| `batchGenerateImages` | 批量生成图片 | `promptIds[]` | `taskId` |
| `generateVideo` | 生成视频 | `promptId` | `taskId` |
| `generateMusic` | 生成音乐 | `sessionId` | `taskId` |
| `getTaskStatus` | 查询任务状态 | `taskId` | `status, result?` |

#### 导出类

| Tool | 描述 | 输入 | 输出 |
|------|------|------|------|
| `exportJianying` | 导出剪映草稿 | `sessionId` | `downloadUrl` |

### 3.2 Sub-Agent 工具权限

| Tool | analyst | visualDirector | motionDirector | composer |
|------|:-------:|:--------------:|:--------------:|:--------:|
| `getAnalysis` | ✅ | ✅ | ✅ | ✅ |
| `saveAnalysis` | ✅ | ❌ | ❌ | ❌ |
| `getPlan` | ✅ | ✅ | ✅ | ✅ |
| `savePlan` | ✅ | ✅ | ❌ | ❌ |
| `getPrompts` | ❌ | ✅ | ✅ | ✅ |
| `saveVisualPrompts` | ❌ | ✅ | ❌ | ❌ |
| `saveVideoPrompts` | ❌ | ❌ | ✅ | ❌ |
| `saveMusicPrompt` | ❌ | ❌ | ❌ | ✅ |
| `generateImage` | ❌ | ✅ | ❌ | ❌ |
| `generateVideo` | ❌ | ❌ | ✅ | ❌ |
| `generateMusic` | ❌ | ❌ | ❌ | ✅ |

### 3.3 Schema 定义

```typescript
// 诗词分析结果
const poetryAnalysisSchema = z.object({
  title: z.string().describe("诗词标题"),
  author: z.string().describe("作者"),
  verses: z.array(z.string()).describe("诗句数组，按行分割"),
  imagery: z.array(z.object({
    name: z.string().describe("意象名称"),
    description: z.string().describe("意象描述"),
    emotion: z.string().describe("关联情感")
  })).describe("意象列表"),
  emotion: z.object({
    primary: z.string().describe("主要情感"),
    secondary: z.array(z.string()).describe("次要情感"),
    curve: z.string().describe("情感曲线描述")
  }).describe("情感分析"),
  rhythm: z.object({
    pattern: z.string().describe("韵律格式"),
    meter: z.string().describe("格律类型")
  }).describe("韵律分析"),
  allusions: z.array(z.object({
    text: z.string().describe("典故原文"),
    source: z.string().describe("出处"),
    meaning: z.string().describe("含义")
  })).optional().describe("典故列表")
});

// 创作方案
const creationPlanSchema = z.object({
  styleDirection: z.string().describe("整体艺术风格方向"),
  colorPalette: z.array(z.string()).describe("色彩方案"),
  shotCount: z.number().describe("分镜数量建议"),
  rhythmDesign: z.string().describe("节奏设计"),
  visualTheme: z.string().describe("视觉主题"),
  musicStyle: z.string().describe("音乐风格建议"),
  referenceArtworks: z.array(z.string()).optional().describe("参考作品")
});

// 图像提示词
const visualPromptSchema = z.object({
  verseIndex: z.number().describe("诗句索引"),
  verse: z.string().describe("诗句原文"),
  imagePrompt: z.string().describe("图像生成提示词"),
  style: z.string().describe("艺术风格"),
  composition: z.string().describe("构图说明"),
  lighting: z.string().describe("光影描述"),
  colorScheme: z.array(z.string()).describe("色彩方案")
});

// 视频提示词
const videoPromptSchema = z.object({
  verseIndex: z.number().describe("诗句索引"),
  verse: z.string().describe("诗句原文"),
  videoPrompt: z.string().describe("视频生成提示词"),
  cameraMovement: z.string().describe("运镜方式"),
  transition: z.string().describe("转场效果"),
  duration: z.number().describe("时长(秒)"),
  dynamicElements: z.array(z.string()).describe("动态元素")
});

// 音乐提示词
const musicPromptSchema = z.object({
  stylePrompt: z.string().describe("Suno 风格提示词"),
  title: z.string().describe("音乐标题"),
  lyrics: z.string().describe("歌词"),
  instrumental: z.boolean().describe("是否纯音乐"),
  mood: z.string().describe("情绪基调"),
  tempo: z.string().describe("节奏速度")
});
```

---

## 4. 数据库设计

### 4.1 表结构

#### t_poetry_session - 会话主表（扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键 |
| `poem_text` | TEXT | 诗词原文 |
| `art_style` | VARCHAR(50) | 艺术风格 |
| `style_description` | TEXT | 自定义风格描述 |
| `settings` | TEXT (JSON) | 生成设置 |
| `status` | VARCHAR(20) | 状态：draft/analyzing/creating/completed |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

#### t_poetry_analysis - 诗词分析表（新增）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键 |
| `session_id` | INTEGER FK | 关联会话 |
| `title` | VARCHAR(100) | 诗词标题 |
| `author` | VARCHAR(50) | 作者 |
| `verses` | TEXT (JSON) | 诗句数组 |
| `imagery` | TEXT (JSON) | 意象列表 |
| `emotion` | TEXT (JSON) | 情感分析 |
| `rhythm` | TEXT (JSON) | 韵律分析 |
| `allusions` | TEXT (JSON) | 典故列表 |
| `created_at` | DATETIME | 创建时间 |

#### t_poetry_plan - 创作方案表（新增）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键 |
| `session_id` | INTEGER FK | 关联会话 |
| `style_direction` | TEXT | 艺术风格方向 |
| `color_palette` | TEXT (JSON) | 色彩方案 |
| `shot_count` | INTEGER | 分镜数量 |
| `rhythm_design` | TEXT | 节奏设计 |
| `visual_theme` | TEXT | 视觉主题 |
| `music_style` | TEXT | 音乐风格建议 |
| `reference_artworks` | TEXT (JSON) | 参考作品 |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

#### t_poetry_prompt - 分镜提示词表（扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键 |
| `session_id` | INTEGER FK | 关联会话 |
| `verse_index` | INTEGER | 诗句索引 |
| `verse` | TEXT | 诗句原文 |
| `image_prompt` | TEXT | 图像提示词 |
| `video_prompt` | TEXT | 视频提示词 |
| `image_url` | TEXT | 生成的图片 URL |
| `video_url` | TEXT | 生成的视频 URL |
| `style` | VARCHAR(50) | 艺术风格 |
| `composition` | TEXT | 构图说明 |
| `camera_movement` | VARCHAR(50) | 运镜方式 |
| `transition` | VARCHAR(50) | 转场效果 |
| `duration` | INTEGER | 时长(秒) |
| `created_at` | DATETIME | 创建时间 |
| `updated_at` | DATETIME | 更新时间 |

#### t_poetry_music - 音乐表（扩展）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键 |
| `session_id` | INTEGER FK | 关联会话 |
| `style_prompt` | TEXT | Suno 风格提示词 |
| `title` | VARCHAR(100) | 音乐标题 |
| `lyrics` | TEXT | 歌词 |
| `instrumental` | BOOLEAN | 是否纯音乐 |
| `mood` | VARCHAR(50) | 情绪基调 |
| `tempo` | VARCHAR(30) | 节奏速度 |
| `audio_url` | TEXT | 生成的音频 URL |
| `task_id` | VARCHAR(100) | 任务 ID |
| `status` | VARCHAR(20) | 状态 |
| `created_at` | DATETIME | 创建时间 |

#### t_poetry_chat - 对话历史表（新增）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键 |
| `session_id` | INTEGER FK | 关联会话 |
| `role` | VARCHAR(20) | 角色：user/assistant |
| `content` | TEXT | 消息内容 |
| `agent_type` | VARCHAR(30) | 生成此消息的 Agent 类型 |
| `tool_calls` | TEXT (JSON) | 工具调用记录 |
| `created_at` | DATETIME | 创建时间 |

#### t_poetry_task - 任务队列表（新增）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | INTEGER PK | 主键 |
| `session_id` | INTEGER FK | 关联会话 |
| `task_type` | VARCHAR(30) | 任务类型：image/video/music |
| `task_id` | VARCHAR(100) | 外部任务 ID |
| `target_id` | INTEGER | 关联的 prompt/music ID |
| `status` | VARCHAR(20) | 状态：pending/processing/completed/failed |
| `result` | TEXT (JSON) | 任务结果 |
| `error` | TEXT | 错误信息 |
| `created_at` | DATETIME | 创建时间 |
| `completed_at` | DATETIME | 完成时间 |

### 4.2 ER 关系图

```
┌──────────────────┐
│ t_poetry_session │
│──────────────────│
│ id (PK)          │
│ poem_text        │
│ art_style        │
│ status           │
└────────┬─────────┘
         │
         │ 1:1
         ▼
┌──────────────────┐     ┌──────────────────┐
│ t_poetry_analysis│     │  t_poetry_plan   │
│──────────────────│     │──────────────────│
│ id (PK)          │     │ id (PK)          │
│ session_id (FK)  │     │ session_id (FK)  │
│ imagery (JSON)   │     │ style_direction  │
│ emotion (JSON)   │     │ shot_count       │
└──────────────────┘     └──────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐     ┌──────────────────┐
│ t_poetry_prompt  │     │ t_poetry_music   │
│──────────────────│     │──────────────────│
│ id (PK)          │     │ id (PK)          │
│ session_id (FK)  │     │ session_id (FK)  │
│ verse_index      │     │ style_prompt     │
│ image_prompt     │     │ audio_url        │
│ video_prompt     │     └──────────────────┘
│ image_url        │
│ video_url        │
└──────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐     ┌──────────────────┐
│  t_poetry_task   │     │  t_poetry_chat   │
│──────────────────│     │──────────────────│
│ id (PK)          │     │ id (PK)          │
│ session_id (FK)  │     │ session_id (FK)  │
│ task_type        │     │ role             │
│ status           │     │ content          │
│ result (JSON)    │     │ agent_type       │
└──────────────────┘     └──────────────────┘
```

---

## 5. 前端设计

### 5.1 组件架构

```
poetry/
├── index.vue                          # 主页面（改造）
├── components/
│   ├── PoetryInput.vue               # 输入组件（保留）
│   ├── PoetryChat.vue                # 对话组件（新增）
│   ├── PoetryQuickActions.vue        # 快捷操作按钮（新增）
│   ├── PoetryAnalysis.vue            # 分析结果展示（新增）
│   ├── PoetryPlan.vue                # 创作方案展示（新增）
│   ├── PoetryStoryboard.vue          # 分镜组件（保留，扩展）
│   ├── PoetryVideoMusic.vue          # 视频/音乐组件（保留）
│   └── PoetryExport.vue              # 导出组件（新增）
└── composables/
    ├── usePoetryChat.ts              # 对话逻辑 Hook（新增）
    ├── usePoetrySession.ts           # 会话管理 Hook（新增）
    └── usePoetryWebSocket.ts         # WebSocket Hook（新增）
```

### 5.2 页面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  📜 诗词漫游                              [历史记录] [新建会话]   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    诗词输入区域                          │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  快捷操作                                                │   │
│  │  [🚀 一键创作] [📝 解析诗词] [📋 生成方案]               │   │
│  │  [🎨 生成分镜] [🎬 生成视频] [🎵 生成音乐]               │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌───────────────────────────┬─────────────────────────────┐   │
│  │     分析结果 / 方案       │        分镜预览区           │   │
│  └───────────────────────────┴─────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  💬 对话助手                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 WebSocket 事件

```typescript
interface PoetryWebSocketEvents {
  // Agent 事件
  'agent:transfer': { to: AgentType };
  'agent:stream': { agent: AgentType, text: string };
  'agent:complete': { agent: AgentType };

  // Tool 事件
  'tool:call': { name: string, args: any };
  'tool:result': { name: string, result: any };

  // 数据刷新
  'refresh:analysis': PoetryAnalysis;
  'refresh:plan': CreationPlan;
  'refresh:prompts': Prompt[];
  'refresh:music': MusicPrompt;

  // 任务状态
  'task:progress': { taskId: string, progress: number };
  'task:complete': { taskId: string, result: any };
  'task:error': { taskId: string, error: string };
}
```

---

## 6. API 设计

### 6.1 WebSocket 接口

| 路径 | 说明 |
|------|------|
| `ws://host/poetry/ws/:sessionId` | Agent 对话 WebSocket 连接 |

### 6.2 REST 接口

#### 会话管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/poetry/sessions` | 获取会话列表 |
| POST | `/api/poetry/session` | 创建新会话 |
| GET | `/api/poetry/session/:id` | 获取会话详情 |
| PUT | `/api/poetry/session/:id` | 更新会话设置 |
| DELETE | `/api/poetry/session/:id` | 删除会话 |

#### Agent 调用

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/poetry/agent/call` | 调用 Agent（HTTP 模式） |

#### 数据操作

| 方法 | 路径 | 说明 |
|------|------|------|
| GET/PUT | `/api/poetry/analysis/:sessionId` | 诗词分析 CRUD |
| GET/PUT | `/api/poetry/plan/:sessionId` | 创作方案 CRUD |
| GET/PUT | `/api/poetry/prompts/:sessionId` | 分镜提示词 CRUD |
| GET/PUT | `/api/poetry/music/:sessionId` | 音乐信息 CRUD |

#### 生成任务

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/poetry/generate/image` | 生成单张图片 |
| POST | `/api/poetry/generate/images/batch` | 批量生成图片 |
| POST | `/api/poetry/generate/video` | 生成视频 |
| POST | `/api/poetry/generate/music` | 生成音乐 |
| GET | `/api/poetry/task/:taskId/status` | 查询任务状态 |

#### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/poetry/export/jianying` | 导出剪映草稿 |

---

## 7. 后端文件结构

```
Toonflow-app/src/
├── agents/
│   └── poetry/                        # 新增目录
│       ├── index.ts                   # PoetryAgent 主类
│       ├── tools/                     # Tool 实现
│       │   ├── analysisTools.ts       # 分析相关工具
│       │   ├── planTools.ts           # 方案相关工具
│       │   ├── promptTools.ts         # 提示词相关工具
│       │   └── generateTools.ts       # 生成相关工具
│       └── prompts/                   # Agent Prompt 配置
│           ├── main.ts                # 主控 Agent Prompt
│           ├── analyst.ts             # 诗词分析师 Prompt
│           ├── visualDirector.ts      # 视觉导演 Prompt
│           ├── motionDirector.ts      # 运镜导演 Prompt
│           └── composer.ts            # 音乐作曲 Prompt
│
├── routes/
│   └── poetry/
│       ├── index.ts                   # 路由入口（改造）
│       ├── session.ts                 # 会话管理接口
│       ├── agent.ts                   # Agent 调用接口
│       ├── websocket.ts               # WebSocket 处理（新增）
│       ├── generate.ts                # 生成任务接口
│       └── export.ts                  # 导出接口
│
└── lib/
    └── initDB.ts                      # 添加新表初始化
```

---

## 8. 迁移策略

| 阶段 | 内容 |
|------|------|
| **Phase 1** | 新增表结构，保留现有 `parse` 接口 |
| **Phase 2** | 新增 Agent + WebSocket 接口 |
| **Phase 3** | 前端切换到新接口 |
| **Phase 4** | 下线旧接口（可选） |

---

## 9. 风险与注意事项

1. **兼容性**：保留现有 API，确保旧版本前端可正常使用
2. **性能**：WebSocket 连接数需要监控，考虑连接池管理
3. **Prompt 配置**：Agent Prompt 需要在数据库中可配置（参照 `t_prompts` 表）
4. **错误处理**：Sub-Agent 调用失败时需要有回退机制

---

## 10. 待确认事项

- [ ] Agent Prompt 是否需要在 `t_prompts` 表中配置？
- [ ] 是否需要支持多用户并发访问同一会话？
- [ ] 任务队列是否需要持久化？

---

## 附录：参考资料

- [OutlineScript Agent 实现](../../Toonflow-app/src/agents/outlineScript/index.ts)
- [Storyboard Agent 实现](../../Toonflow-app/src/agents/storyboard/index.ts)
- [现有古诗模式实现](../../Toonflow-app/src/routes/poetry/index.ts)
