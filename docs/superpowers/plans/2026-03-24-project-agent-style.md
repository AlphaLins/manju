# 按项目选择 Agent 风格 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 移除“古诗模式”分流，新增项目级 agentStyle，并在短剧流程内按项目选择普通/古诗特化 Agent。

**Architecture:** 为 `t_project` 增加 `agentStyle` 字段并在创建项目时写入；运行时在大纲/脚本生成入口根据该字段选择提示词 code；前端移除 poetry 分流并在创建项目弹窗提供风格选择。

**Tech Stack:** Electron/Node (Express, Knex, SQLite), Vue 3 + TypeScript, Ant Design Vue / TDesign

---

## 文件结构与影响面

### 后端（Toonflow-app）
- Modify: `Toonflow-app/src/lib/initDB.ts` — 初始化 `t_project` 字段默认值（如有示例插入/建表）。
- Modify: `Toonflow-app/src/lib/fixDB.ts` — 兼容旧库新增 `agentStyle` 字段。
- Modify: `Toonflow-app/src/routes/project/addProject.ts` — 接收并保存 `agentStyle`。
- Modify: `Toonflow-app/src/routes/project/updateProject.ts`（如存在）— 保留字段但本期不开放修改。
- Modify: `Toonflow-app/src/routes/outline/agentsOutline.ts` — 按 `agentStyle` 选择提示词 code。
- Modify: 其它生成入口（如 `script` 相关路由）— 按 `agentStyle` 选择提示词 code。

### 前端（Toonflow-web）
- Modify: `Toonflow-web/src/views/project/components/addProject.vue` — “Agent 风格”选择，提交 `agentStyle`。
- Modify: `Toonflow-web/src/views/project/index.vue` — 移除 poetry 分流逻辑。
- (可选) Modify: `Toonflow-web/src/views/projectDetail/index.vue` — 若有显示项目类型的 UI，统一短剧入口。

---

## Chunk 1: 数据层与项目创建

### Task 1: 新增 t_project.agentStyle 字段并兼容旧库

**Files:**
- Modify: `Toonflow-app/src/lib/initDB.ts`
- Modify: `Toonflow-app/src/lib/fixDB.ts`

- [ ] **Step 1: 写失败用例（旧库缺字段时应补齐）**

```ts
// tests/db/migrations/t_project_agentStyle.spec.ts
import { expect } from "chai";
import createTestDb from "../helpers/createTestDb";
import runFixDb from "../../src/lib/fixDB";

describe("t_project agentStyle migration", () => {
  it("adds agentStyle column when missing", async () => {
    const db = await createTestDb();
    await db.schema.createTable("t_project", (t) => {
      t.integer("id").notNullable();
      t.text("name");
      t.primary(["id"]);
    });

    const before = await db.schema.hasColumn("t_project", "agentStyle");
    expect(before).to.equal(false);

    await runFixDb(db);

    const after = await db.schema.hasColumn("t_project", "agentStyle");
    expect(after).to.equal(true);
  });
});
```

- [ ] **Step 2: 运行测试确保失败**

Run: `npm --prefix Toonflow-app test`
Expected: FAIL（缺少字段或测试环境未配置）

- [ ] **Step 3: 实现迁移逻辑（含默认值与非空约束）**

```ts
// Toonflow-app/src/lib/fixDB.ts
await addColumn("t_project", "agentStyle", "text", "normal");
```

- [ ] **Step 4: 初始化建表定义（如 initDB 负责建表）**

```ts
// Toonflow-app/src/lib/initDB.ts
// 建表时添加：t.text("agentStyle").notNullable().defaultTo("normal")
// 插入项目时带上 agentStyle: "normal"
```

- [ ] **Step 5: 运行测试确保通过**

Run: `npm --prefix Toonflow-app test`
Expected: PASS（若测试环境可用）

- [ ] **Step 6: 提交**

```bash
git add Toonflow-app/src/lib/fixDB.ts Toonflow-app/src/lib/initDB.ts tests/db/migrations/t_project_agentStyle.spec.ts
git commit -m "feat: add agentStyle to projects"
```

### Task 2: 创建项目写入 agentStyle

**Files:**
- Modify: `Toonflow-app/src/routes/project/addProject.ts`
- (Optional) Modify: `Toonflow-app/src/routes/project/updateProject.ts`

- [ ] **Step 1: 写失败用例（新增字段入库与值域）**

```ts
// tests/routes/project/addProject_agentStyle.spec.ts
import request from "supertest";
import app from "../../src/app";
import { expect } from "chai";

describe("addProject with agentStyle", () => {
  it("persists agentStyle", async () => {
    const res = await request(app)
      .post("/project/addProject")
      .send({ name: "demo", agentStyle: "poetry" })
      .expect(200);

    const project = res.body.data;
    expect(project.agentStyle).to.equal("poetry");
  });

  it("falls back to normal when invalid", async () => {
    const res = await request(app)
      .post("/project/addProject")
      .send({ name: "demo", agentStyle: "invalid" })
      .expect(200);

    const project = res.body.data;
    expect(project.agentStyle).to.equal("normal");
  });
});
```

- [ ] **Step 2: 运行测试确保失败**

Run: `npm --prefix Toonflow-app test`
Expected: FAIL（字段未保存/值域未校验）

- [ ] **Step 3: 实现保存与回退逻辑**

```ts
// Toonflow-app/src/routes/project/addProject.ts
const rawStyle = body.agentStyle;
const agentStyle = rawStyle === "poetry" ? "poetry" : "normal";
// insert/update 时写入 agentStyle
```

- [ ] **Step 4: 限制 updateProject（本期不开放修改）**

```ts
// Toonflow-app/src/routes/project/updateProject.ts
// 忽略 agentStyle 或仅允许 normal/poetry 且不在前端暴露入口
```

- [ ] **Step 5: 运行测试确保通过**

Run: `npm --prefix Toonflow-app test`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add Toonflow-app/src/routes/project/addProject.ts Toonflow-app/src/routes/project/updateProject.ts tests/routes/project/addProject_agentStyle.spec.ts
git commit -m "feat: save project agentStyle"
```

---

## Chunk 2: 运行时选择提示词与前端入口

### Task 3: 按 agentStyle 选择提示词 code

**Files:**
- Modify: `Toonflow-app/src/routes/outline/agentsOutline.ts`
- Modify: `Toonflow-app/src/routes/storyboard/chatStoryboard.ts`
- Modify: `Toonflow-app/src/agents/outlineScript/index.ts`
- Modify: `Toonflow-app/src/agents/poetryOutlineScript/index.ts`
- Modify: `Toonflow-app/src/agents/storyboard/index.ts`
- Modify: `Toonflow-app/src/agents/poetryStoryboard/index.ts`

- [ ] **Step 1: 写失败用例（poetry 选择诗词提示词）**

```ts
// tests/routes/outline/agentsOutline_agentStyle.spec.ts
import request from "supertest";
import app from "../../src/app";
import { expect } from "chai";

describe("agentsOutline agentStyle", () =
> {
  it("uses poetry agent when agentStyle=poetry", async () =
> {
    const res = await request(app)
      .post("/outline/agentsOutline")
      .send({ projectId: 1 })
      .expect(200);
    expect(res.body.debugAgentStyle).to.equal("poetry");
  });
});
```

- [ ] **Step 2: 运行测试确保失败**

Run: `npm --prefix Toonflow-app test`
Expected: FAIL（debug 字段不存在或未切换）

- [ ] **Step 3: 实现提示词选择与未知值回退**

```ts
// Toonflow-app/src/routes/outline/agentsOutline.ts
const rawStyle = project?.agentStyle;
const agentStyle = rawStyle === "poetry" ? "poetry" : "normal";
if (rawStyle
> && rawStyle !== "normal" && rawStyle !== "poetry") {
  console.warn("[agentStyle] unknown value", rawStyle);
}
const AgentClass = agentStyle === "poetry" ? PoetryOutlineScript : OutlineScript;
```

```ts
// Toonflow-app/src/routes/storyboard/chatStoryboard.ts
const rawStyle = project?.agentStyle;
const agentStyle = rawStyle === "poetry" ? "poetry" : "normal";
if (rawStyle
> && rawStyle !== "normal" && rawStyle !== "poetry") {
  console.warn("[agentStyle] unknown value", rawStyle);
}
const AgentClass = agentStyle === "poetry" ? PoetryStoryboard : Storyboard;
```

- [ ] **Step 4: 调整测试方式（WebSocket 不便于断言）**

将测试改为单元测试：在 `OutlineScript`/`PoetryOutlineScript` 构造中暴露只读 `agentStyleTag` 字段，断言 route 选择的类是否正确。

```ts
// tests/agents/agentStyle.spec.ts
import OutlineScript from "../../src/agents/outlineScript";
import PoetryOutlineScript from "../../src/agents/poetryOutlineScript";
import { expect } from "chai";

describe("agent style tag", () => {
  it("normal agent tag", () => {
    const agent = new OutlineScript(1);
    expect(agent.agentStyleTag).to.equal("normal");
  });

  it("poetry agent tag", () => {
    const agent = new PoetryOutlineScript(1);
    expect(agent.agentStyleTag).to.equal("poetry");
  });
});
```

- [ ] **Step 5: 运行测试确保通过**

Run: `npm --prefix Toonflow-app test`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add Toonflow-app/src/routes/outline/agentsOutline.ts Toonflow-app/src/routes/storyboard/chatStoryboard.ts Toonflow-app/src/agents/outlineScript/index.ts Toonflow-app/src/agents/poetryOutlineScript/index.ts Toonflow-app/src/agents/storyboard/index.ts Toonflow-app/src/agents/poetryStoryboard/index.ts tests/routes/outline/agentsOutline_agentStyle.spec.ts tests/agents/agentStyle.spec.ts
git commit -m "feat: switch agents by agentStyle"
```

### Task 4: 前端创建项目与路由分流调整

**Files:**
- Modify: `Toonflow-web/src/views/project/components/addProject.vue`
- Modify: `Toonflow-web/src/views/project/index.vue`

- [ ] **Step 1: 写失败用例（创建项目提交 agentStyle）**

```ts
// Toonflow-web/tests/views/addProject_agentStyle.spec.ts
import { mount } from "@vue/test-utils";
import AddProject from "@/views/project/components/addProject.vue";

describe("addProject agentStyle", () =
> {
  it("submits agentStyle", async () =
> {
    const wrapper = mount(AddProject);
    // 选择古诗特化并触发提交
    // 断言提交 payload 含 agentStyle
  });
});
```

- [ ] **Step 2: 运行测试确保失败**

Run: `npm --prefix Toonflow-web test`
Expected: FAIL（测试环境缺失或字段未提交）

- [ ] **Step 3: 实现 UI 与提交字段**

```vue

<!-- addProject.vue -->
<a-radio-group v-model:value="form.agentStyle">
  <a-radio-button value="normal">普通</a-radio-button>
  <a-radio-button value="poetry">古诗特化</a-radio-button>
</a-radio-group>
```

```ts
// addProject.vue
const form = reactive({ ... , agentStyle: "normal" });
// 提交时携带 agentStyle
```

- [ ] **Step 4: 移除 poetry 分流逻辑**

```ts
// project/index.vue
// 删除 if (project.type === "poetry") 跳转 /poetry 逻辑
```

- [ ] **Step 5: 运行测试确保通过**

Run: `npm --prefix Toonflow-web test`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add Toonflow-web/src/views/project/components/addProject.vue Toonflow-web/src/views/project/index.vue Toonflow-web/tests/views/addProject_agentStyle.spec.ts
git commit -m "feat: add project agentStyle selection"
```

---

## Chunk 3: 手动验收与文档记录

### Task 5: 手动验证与记录

**Files:**
- Modify: `docs/superpowers/plans/2026-03-24-project-agent-style.md`（本计划）

- [ ] **Step 1: 启动服务**

Run: `npm --prefix Toonflow-app run dev`
Expected: 后端服务启动无错误

Run: `npm --prefix Toonflow-web run dev`
Expected: 前端服务启动无错误

- [ ] **Step 2: 前端创建项目（poetry）**

- 选择“古诗特化 agent”，创建项目
- 进入短剧工作台（无 poetry 分流）
- 触发大纲生成，确认使用 `poetryOutlineScript-*`

- [ ] **Step 3: 前端创建项目（normal 回归）**

- 选择“普通 agent”，创建项目
- 触发大纲生成，确认使用 `outlineScript-*`

- [ ] **Step 4: 记录结果**

在本计划末尾追加手动验收结论与日期。

- [ ] **Step 5: 提交**

```bash
git add docs/superpowers/plans/2026-03-24-project-agent-style.md
git commit -m "docs: add project agentStyle plan verification"
```
