import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 获取故事线数据
export default router.post(
  "/",
  validateFields({
    projectId: z.number(),
  }),
  async (req, res) => {
    const { projectId } = req.body;
    const project = await u.db("t_project").where({ id: projectId }).first();
    const tableName = project?.agentStyle === "poetry" ? "t_poetry_storyline" : "t_storyline";
    const data = await u.db(tableName).where("projectId", projectId).first();
    res.status(200).send(success(data));
  }
);
