import express from "express";
import u from "@/utils";
import { success } from "@/lib/responseFormat";
import { z } from "zod";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

interface Asset {
  id: number;
  type: string; // "角色" 或其他
  name: string;
  filePath: string;
}

interface ScriptRow {
  id: number;
  name: string;
  content: string;
  outlineId: number;
  projectId: number;
  data: string;
}
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
  }),
  async (req, res) => {
    const { projectId } = req.body;

    //查询剧本和大纲数据
    const rows: ScriptRow[] = await u
  .db("t_poetry_outline")
  .leftJoin("t_poetry_script", "t_poetry_outline.id", "t_poetry_script.outlineId")
  .where("t_poetry_outline.projectId", projectId)
  .select(
    "t_poetry_script.id",
    "t_poetry_script.name",
    "t_poetry_script.content",
    "t_poetry_script.outlineId",
    "t_poetry_script.projectId",
    "t_poetry_outline.data"
  );

    // 查询所有的资产
    const assets: Asset[] = await u
      .db("t_poetry_assets")
      .where("projectId", projectId)
      .andWhere("type", "<>", "分镜")
      .select("id", "type", "name", "filePath", "intro", "prompt");

    const data = rows.map((item) => {
      const parseData = JSON.parse(item.data);
      const charData = parseData.characters.map((i: Asset) => i.name);
      const propsData = parseData.props.map((i: Asset) => i.name);
      const sceneData = parseData.scenes.map((i: Asset) => i.name);
      return {
        ...item,
        element: [
          ...assets.filter((i) => i.type == "道具" && propsData.includes(i.name)),
          ...assets.filter((i) => i.type == "角色" && charData.includes(i.name)),
          ...assets.filter((i) => i.type == "场景" && sceneData.includes(i.name)),
        ],
      };
    });

    await Promise.all(
      data.map(async (script) => {
        await Promise.all(
          script.element.map(async (el) => {
            el.filePath = el.filePath ? await u.oss.getFileUrl(el.filePath) : "";
          })
        );
      })
    );

    res.status(200).send(success(data));
  }
);
