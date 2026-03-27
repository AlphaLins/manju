import express from "express";
import { success, error } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { z } from "zod";
import axios from "axios";

const router = express.Router();

export default router.post(
    "/",
    validateFields({
        apiKey: z.string(),
        baseURL: z.string().optional(),
        manufacturer: z.string().optional(),
    }),
    async (req, res) => {
        try {
            const { apiKey, baseURL, manufacturer } = req.body;

            // 默认的 base URL
            let fetchUrl = baseURL;
            if (!fetchUrl) {
                if (manufacturer === 'deepseek') fetchUrl = 'https://api.deepseek.com';
                else if (manufacturer === 'zhipu') fetchUrl = 'https://open.bigmodel.cn/api/paas/v4';
                else if (manufacturer === 'openai') fetchUrl = 'https://api.openai.com/v1';
                else if (manufacturer === 'volcengine') fetchUrl = 'https://ark.cn-beijing.volces.com/api/v3';
                else return res.status(400).send(error("缺少 Base URL。"));
            }

            // 去除末尾斜杠
            if (fetchUrl.endsWith('/')) fetchUrl = fetchUrl.slice(0, -1);

            let url = `${fetchUrl}/v1/models`;
            if (fetchUrl.endsWith('/v1') || fetchUrl.endsWith('/v3') || fetchUrl.endsWith('/v4')) {
                url = `${fetchUrl}/models`; // 避免出现 /v1/v1/models
            }

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            if (response.data && response.data.data && Array.isArray(response.data.data)) {
                const models = response.data.data.map((item: any) => item.id);
                res.status(200).send(success(models));
            } else {
                res.status(500).send(error("远程服务未返回格式化的模型列表", response.data));
            }
        } catch (err: any) {
            console.error("获取模型列表失败", err.message);
            res.status(500).send(error("获取提示词列表失败: " + err.message));
        }
    },
);
