import express from "express";
import u from "@/utils";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { generatePoetryScript } from "@/utils/generatePoetryScript";
const router = express.Router();
interface NovelChapter {
  id: number;
  reel: string;
  chapter: string;
  chapterData: string;
  projectId: number;
}
function mergeNovelText(novelData: NovelChapter[]): string {
  if (!Array.isArray(novelData)) return "";
  return novelData
    .map((chap) => {
      return `${chap.chapter.trim()}\n\n${chap.chapterData.trim().replace(/\r?\n/g, "\n")}\n`;
    })
    .join("\n");
}

// 生成剧本
export default router.post(
  "/",
  validateFields({
    outlineId: z.number(),
    scriptId: z.number(),
  }),
    async (req, res) => {
    const { outlineId, scriptId } = req.body;

    // 先根据 scriptId 判断诗歌/普通，并拿到 projectId
    const poetryScript = await u.db("t_poetry_script").where({ id: scriptId }).first();
    const normalScript = poetryScript ? null : await u.db("t_script").where({ id: scriptId }).first();
    const scriptRow = poetryScript || normalScript;
    if (!scriptRow) return res.status(500).send(success({ message: "剧本不存在" }));

    const projectId = scriptRow.projectId;
    const project = await u.db("t_project").where({ id: projectId }).first();
    const isPoetry = project?.agentStyle === "poetry";

    const outlineTable = isPoetry ? "t_poetry_outline" : "t_outline";
    const novelTable = isPoetry ? "t_poetry_novel" : "t_novel";
    const scriptTable = isPoetry ? "t_poetry_script" : "t_script";

    const outlineData = await u.db(outlineTable).where("id", outlineId).select("*").first();
    if (!outlineData) return res.status(500).send(success({ message: "大纲为空" }));
    const parameter = JSON.parse(outlineData.data!);

    const novelData = (await u
      .db(novelTable)
      .whereIn("chapterIndex", parameter.chapterRange)
      .where("projectId", outlineData.projectId)
      .select("*")) as NovelChapter[];

    if (novelData.length == 0) return res.status(500).send(success({ message: "原文为空" }));

    const result: string = mergeNovelText(novelData);
    try {
      const data = await generatePoetryScript(parameter ?? "", result ?? "");
      console.log("poetry script length:", data?.length || 0);
      if (!data) return res.status(500).send({ message: "生成剧本失败" });

      await u.db(scriptTable).where("id", scriptId).update({ content: data });
      res.status(200).send(success({ message: "生成剧本成功" }));
    } catch (e) {
      const errMsg = u.error(e).message || "生成剧本失败";
      res.status(500).send(error(errMsg));
    }
  },
);
