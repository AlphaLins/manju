/**
 * 配置导入脚本
 * 从 JSON 文件导入 AI 模型配置到新 PC
 *
 * 使用方法: npx tsx scripts/import-config.ts [config-file-path]
 * 默认路径: config-backup.json
 */

import fs from "fs";
import path from "path";
import knex from "knex";

// 数据库连接配置
const db = knex({
  client: "sqlite3",
  connection: {
    filename: path.join(process.cwd(), "db.sqlite"),
  },
  useNullAsDefault: true,
});

interface ConfigExport {
  version: string;
  exportTime: string;
  configs: Array<{
    id: number;
    type: string;
    model: string;
    modelType: string | null;
    apiKey: string;
    baseUrl: string | null;
    manufacturer: string | null;
    createTime: number | null;
    index: number | null;
    userId: number | null;
  }>;
  settings: Array<{
    id: number;
    userId: number | null;
    tokenKey: string | null;
    imageModel: string | null;
    languageModel: string | null;
    projectId: number | null;
  }>;
  videoModels: Array<{
    id: number;
    manufacturer: string | null;
    model: string | null;
    durationResolutionMap: string | null;
    aspectRatio: string | null;
    audio: number | null;
    type: string | null;
  }>;
}

async function importConfig(configPath: string) {
  console.log("📥 开始导入配置...\n");

  try {
    // 检查文件是否存在
    if (!fs.existsSync(configPath)) {
      console.error(`❌ 配置文件不存在: ${configPath}`);
      process.exit(1);
    }

    // 读取配置文件
    const content = fs.readFileSync(configPath, "utf-8");
    const data: ConfigExport = JSON.parse(content);

    console.log(`📅 配置导出时间: ${data.exportTime}`);
    console.log(`📋 配置版本: ${data.version}\n`);

    // 导入 t_config 表
    if (data.configs && data.configs.length > 0) {
      // 先清空现有配置
      await db("t_config").del();
      // 插入新配置
      for (const config of data.configs) {
        await db("t_config").insert(config);
      }
      console.log(`✅ 已导入 ${data.configs.length} 条 AI 模型配置`);
    }

    // 导入 t_setting 表
    if (data.settings && data.settings.length > 0) {
      for (const setting of data.settings) {
        const existing = await db("t_setting").where({ id: setting.id }).first();
        if (existing) {
          await db("t_setting").where({ id: setting.id }).update(setting);
        } else {
          await db("t_setting").insert(setting);
        }
      }
      console.log(`✅ 已导入 ${data.settings.length} 条系统设置`);
    }

    // 导入 t_videoModel 表
    if (data.videoModels && data.videoModels.length > 0) {
      await db("t_videoModel").del();
      for (const vm of data.videoModels) {
        await db("t_videoModel").insert(vm);
      }
      console.log(`✅ 已导入 ${data.videoModels.length} 条视频模型配置`);
    }

    console.log("\n🎉 配置导入完成！");
    console.log("\n💡 提示: 现在可以直接启动应用，无需重新配置 API 密钥");

  } catch (error) {
    console.error("❌ 导入失败:", error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

// 获取命令行参数
const configPath = process.argv[2] || path.join(process.cwd(), "config-backup.json");
importConfig(configPath);
