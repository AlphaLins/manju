import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 删除项目
export default router.post(
  "/",
  validateFields({
    id: z.number(),
  }),
  async (req, res) => {
    const { id } = req.body;

    // ==================== 普通模式数据清理 ====================
    const scriptData = await u.db("t_script").where("projectId", id).select("id");
    const scriptIds = scriptData.map((item: any) => item.id);

    const assetsData = await u.db("t_assets").where("projectId", id).select("id");
    const assetsIds = assetsData.map((item: any) => item.id);

    const videoData = await u.db("t_video").whereIn("scriptId", scriptIds).select("id");
    const videoIds = videoData.map((item: any) => item.id);

    // 删除项目基础数据
    await u.db("t_project").where("id", id).delete();
    await u.db("t_novel").where("projectId", id).delete();
    await u.db("t_storyline").where("projectId", id).delete();
    await u.db("t_outline").where("projectId", id).delete();
    await u.db("t_script").where("projectId", id).delete();
    await u.db("t_assets").where("projectId", id).delete();

    // 删除图片数据
    const tempAssetsQuery = u.db("t_image").where("projectId", id);
    if (assetsIds.length > 0) {
      tempAssetsQuery.orWhereIn("assetsId", assetsIds);
    }
    if (scriptIds.length > 0) {
      tempAssetsQuery.orWhereIn("scriptId", scriptIds);
    }
    if (videoIds.length > 0) {
      tempAssetsQuery.orWhereIn("videoId", videoIds);
    }
    await tempAssetsQuery.delete();

    await u.db("t_video").whereIn("scriptId", scriptIds).delete();
    await u.db("t_chatHistory").where("projectId", id).delete();

    // ==================== 诗歌模式数据清理 ====================
    // 获取诗歌模式的脚本ID
    const poetryScriptData = await u.db("t_poetry_script").where("projectId", id).select("id");
    const poetryScriptIds = poetryScriptData.map((item: any) => item.id);

    // 获取诗歌模式的资产ID
    const poetryAssetsData = await u.db("t_poetry_assets").where("projectId", id).select("id");
    const poetryAssetsIds = poetryAssetsData.map((item: any) => item.id);

    // 删除诗歌模式所有相关表
    await u.db("t_poetry_novel").where("projectId", id).delete();
    await u.db("t_poetry_storyline").where("projectId", id).delete();
    await u.db("t_poetry_outline").where("projectId", id).delete();
    await u.db("t_poetry_script").where("projectId", id).delete();
    await u.db("t_poetry_assets").where("projectId", id).delete();
    await u.db("t_poetry_chatHistory").where("projectId", id).delete();

    // 删除诗歌模式的图片数据
    if (poetryAssetsIds.length > 0 || poetryScriptIds.length > 0) {
      const poetryImageQuery = u.db("t_poetry_image").where(function() {
        this.where("assetsId", "in", poetryAssetsIds)
          .orWhereIn("scriptId", poetryScriptIds);
      });
      await poetryImageQuery.delete();
    }

    // ==================== OSS 文件清理 ====================
    try {
      await u.oss.deleteDirectory(`${id}/`);
      console.log(`项目 ${id} 的OSS文件夹删除成功`);
    } catch (error: any) {
      console.log(`项目 ${id} 没有对应的OSS文件夹，跳过删除`);
    }

    res.status(200).send(success({ message: "删除项目成功" }));
  }
);
