import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 新增项目
export default router.post(
  "/",
  validateFields({
    name: z.string(),
    intro: z.string(),
    type: z.string(),
    artStyle: z.string(),
    videoRatio: z.string(),
    agentStyle: z.string().optional(),
  }),
  async (req, res) => {
    const { name, intro, type, artStyle, videoRatio, agentStyle } = req.body;
    const normalizedAgentStyle = ["normal", "poetry", "short_drama"].includes(agentStyle)
      ? agentStyle
      : "normal";

    await u.db("t_project").insert({
      name,
      intro,
      type,
      artStyle,
      videoRatio,
      agentStyle: normalizedAgentStyle,
      userId: 1,
      createTime: Date.now(),
    });

    res.status(200).send(success({ message: "新增项目成功" }));
  }
);
