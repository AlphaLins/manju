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
    const pid = Number(projectId);
    const data = await u.db("t_poetry_storyline").where("projectId", pid).first();
    console.log("[poetry_outline/getStoryline] projectId:", pid, "found:", !!data);
    res.status(200).send(success(data));
  }
);
