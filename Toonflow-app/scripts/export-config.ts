/**
 * 配置导出脚本
 * 将所有 AI 模型配置导出为 JSON 文件，便于在新 PC 上导入
 *
 * 使用方法: npx tsx scripts/export-config.ts
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

async function exportConfig() {
  console.log("📤 开始导出配置...\n");

  try {
    // 导出 t_config 表
    const configs = await db("t_config").select("*");
    console.log(`✅ 已导出 ${configs.length} 条 AI 模型配置`);

    // 导出 t_setting 表
    const settings = await db("t_setting").select("*");
    console.log(`✅ 已导出 ${settings.length} 条系统设置`);

    // 导出 t_videoModel 表
    const videoModels = await db("t_videoModel").select("*");
    console.log(`✅ 已导出 ${videoModels.length} 条视频模型配置`);

    // 构建导出数据
    const exportData: ConfigExport = {
      version: "1.0.0",
      exportTime: new Date().toISOString(),
      configs,
      settings,
      videoModels,
    };

    // 保存到文件
    const exportPath = path.join(process.cwd(), "config-backup.json");
    fs.writeFileSync(exportPath, JSON.stringify(exportData, null, 2), "utf-8");

    console.log(`\n🎉 配置已导出到: ${exportPath}`);
    console.log("\n⚠️  注意: 此文件包含 API 密钥，请妥善保管！");

  } catch (error) {
    console.error("❌ 导出失败:", error);
    process.exit(1);
  } finally {
    await db.destroy();
  }
}

exportConfig();
