import express from "express";
import u from "@/utils";
import { z } from "zod";
import { success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
const router = express.Router();

// 修改项目
export default router.post(
  "/",
  validateFields({
    id: z.number(),
    intro: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
    artStyle: z.string().optional().nullable(),
    videoRatio: z.string().optional().nullable(),
  }),
  async (req, res) => {
    const { id, intro, type, artStyle, videoRatio } = req.body;
    const updateData = {
      ...(intro !== undefined ? { intro } : {}),
      ...(type !== undefined ? { type } : {}),
      ...(artStyle !== undefined ? { artStyle } : {}),
      ...(videoRatio !== undefined ? { videoRatio } : {}),
    };

    if (Object.keys(updateData).length === 0) {
      return res.status(200).send(success({ message: "修改成功" }));
    }

    await u.db("t_project").where("id", id).update(updateData);

    res.status(200).send(success({ message: "修改成功" }));
  }
);
