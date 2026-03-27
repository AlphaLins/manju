const fs = require("fs");
const path = require("path");

const initDbPath = path.join(__dirname, "..", "src", "lib", "initDB.ts");
const poetryAgentPath = path.join(__dirname, "..", "src", "agents", "poetryOutlineScript", "index.ts");

const readFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf-8");
};

const assertIncludes = (text, needle, message) => {
  if (!text.includes(needle)) {
    throw new Error(message);
  }
};

const assertNotIncludes = (text, needle, message) => {
  if (text.includes(needle)) {
    throw new Error(message);
  }
};

const initDbText = readFile(initDbPath);
const poetryAgentText = readFile(poetryAgentPath);

// 1) initDB.ts 中古诗大纲提示词不应出现“小说”术语
const initDbMainSegment = initDbText.split("poetryOutlineScript-main")[1] || "";
const initDbA1Segment = initDbText.split("poetryOutlineScript-a1")[1] || "";
const initDbA2Segment = initDbText.split("poetryOutlineScript-a2")[1] || "";

assertNotIncludes(
  initDbMainSegment,
  "小说章节",
  "initDB.ts 中 poetryOutlineScript-main 仍包含 '小说章节'"
);

assertNotIncludes(
  initDbA1Segment,
  "分析小说原文",
  "initDB.ts 中 poetryOutlineScript-a1 仍包含 '分析小说原文'"
);

assertNotIncludes(
  initDbA2Segment,
  "网文转短剧",
  "initDB.ts 中 poetryOutlineScript-a2 仍包含 '网文转短剧'"
);

// 2) 环境上下文标签必须使用“当前已加载的古诗章节列表”
assertIncludes(
  poetryAgentText,
  "当前已加载的古诗章节列表",
  "poetryOutlineScript/index.ts 未使用 '当前已加载的古诗章节列表' 标签"
);

// 3) 作品信息字段不应使用“小说”术语
assertNotIncludes(
  poetryAgentText,
  "小说名称",
  "poetryOutlineScript/index.ts 仍使用 '小说名称'"
);

assertNotIncludes(
  poetryAgentText,
  "小说简介",
  "poetryOutlineScript/index.ts 仍使用 '小说简介'"
);

assertNotIncludes(
  poetryAgentText,
  "小说类型",
  "poetryOutlineScript/index.ts 仍使用 '小说类型'"
);

assertNotIncludes(
  poetryAgentText,
  "目标短剧类型",
  "poetryOutlineScript/index.ts 仍使用 '目标短剧类型'"
);

assertNotIncludes(
  poetryAgentText,
  "短剧画幅",
  "poetryOutlineScript/index.ts 仍使用 '短剧画幅'"
);

console.log("✅ poetry outline prompt checks passed");
