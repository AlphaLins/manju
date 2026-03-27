import express from "express";
import fs from "fs";
import path from "path";
import { v4 as uuid } from "uuid";
import u from "@/utils";
import axios from "axios";
import sharp from "sharp";

const router = express.Router();

/**
 * @route GET /api/poetry/models
 * @desc 列出可用的文本模型和图片模型供古诗模式选择
 */
router.get("/models", async (req, res) => {
    try {
        const textModels = await u.db("t_config").where("type", "text").select("id", "manufacturer", "model", "baseUrl");
        const imageModels = await u.db("t_config").where("type", "image").select("id", "manufacturer", "model");
        const videoModels = await u.db("t_config").where("type", "video").select("id", "manufacturer", "model", "baseUrl");
        res.send({
            code: 200,
            data: {
                textModels: textModels.map((m: any) => ({ id: m.id, manufacturer: m.manufacturer, model: m.model, label: `${m.manufacturer} / ${m.model}` })),
                imageModels: imageModels.map((m: any) => ({ id: m.id, manufacturer: m.manufacturer, model: m.model, label: `${m.manufacturer} / ${m.model}` })),
                videoModels: videoModels.map((m: any) => ({ id: m.id, manufacturer: m.manufacturer, model: m.model, label: `${m.manufacturer} / ${m.model}` }))
            }
        });
    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * 计算九宫格布局 (rows, cols)
 */
function calculateGridLayout(count: number): [number, number] {
    if (count <= 0) return [1, 1];
    if (count === 3) return [1, 3];
    if (count === 5) return [1, 5];
    const n = Math.ceil(Math.sqrt(count));
    const m = Math.ceil(count / n);
    return [m, n];
}

/**
 * @route POST /api/poetry/parse
 * @desc 接收用户输入的古诗词和风格，调用大语言模型解析为逐句分镜（含视频提示词+音乐提示词+九宫格）
 */
router.post("/parse", async (req, res) => {
    try {
        const {
            content,
            style,
            projectId,
            exampleCount = 1,
            aspectRatio = "16:9",
            gridMode = false,
            resolution = "4k",
            textManufacturer
        } = req.body;

        if (!content) return res.status(400).send({ code: 400, message: "内容不能为空" });

        // 1. 获取用户在设置中的当前语言模型
        let languageModel: any = {};
        try {
            languageModel = await u.getConfig("text", textManufacturer || undefined);
        } catch (e) {
            console.error("Failed to load global text config:", e);
        }

        if (!languageModel || !languageModel.apiKey) {
            languageModel = {
                manufacturer: "openai",
                model: "gpt-4o-mini",
                apiKey: process.env.OPENAI_API_KEY || "",
                baseURL: "https://api.openai.com/v1"
            };
        }

        // 2. 构建增强版 System Prompt（移植自 Guui_software PromptGenerationThread）
        const jsonDescTemplate = Array.from({ length: exampleCount }, (_, i) =>
            `        {\n          "image": "Image Prompt ${i + 1} (English)...",\n          "video": "Video Prompt ${i + 1} (English)..."\n        }`
        ).join(",\n");

        const systemPrompt = `你是一个专业的中国古典诗词视觉艺术家和视频导演。请根据以下诗句同时生成高质量的图像提示词和专业的视频提示词。

## 图像提示词要求
每个图像描述必须包含：
1. 艺术风格（如 traditional Chinese ink painting, watercolor）
2. 构图说明（如 wide shot, close-up, bird's eye view）
3. 光影氛围（如 soft morning light, moonlit, golden hour）
4. 文化元素（如 red lanterns, calligraphy, bamboo, plum blossoms）
5. 色彩方案（如 muted earth tones, vibrant reds and golds）

## 视频提示词要求
每个视频描述必须是专业的动画制作提示词，包含：
1. **运镜方式** - 缓慢推拉、横移、摇摄、环绕、升降
2. **动画风格** - 水墨流动、水彩晕染、3D 粒子效果
3. **转场效果** - 淡入淡出、墨色散开、云雾缭绕
4. **动态元素** - 风吹柳枝、水波荡漾、落花纷飞
5. **声音** - 绝不能有背景音乐，仅保留场景环境音

## 音乐提示词 (Suno AI)
同时为整首诗生成一个专业的 Suno AI 音乐提示词。

### Style Prompt 格式
用逗号分隔的标签，按重要性排序：
[Genre] > [Vocal Style] > [Mood/Atmosphere] > [Tempo/Rhythm] > [Instrumentation]

示例风格：
- 古风：\`Traditional Chinese, Guzheng, Erhu, Ethereal Female Vocals, Melancholic, Slow, Atmospheric\`
- 现代融合：\`Cinematic, Orchestral, Chinese Folk Elements, Female Choir, Epic, Emotional\`

### 歌词结构
使用 Suno 标签：
- \`[Intro]\` - 开场引入
- \`[Verse]\` - 诗句段落
- \`[Chorus]\` - 副歌高潮
- \`[Bridge]\` - 过渡段
- \`[Outro]\` - 结尾

完整 JSON 格式：
{
  "prompts": [
    {
      "verse": "诗句原文",
      "index": 0,
      "descriptions": [
${jsonDescTemplate}
      ]
    }
  ],
  "music": {
    "style_prompt": "Traditional Chinese, Guzheng, Erhu, Ethereal Female Vocals, Melancholic, Slow tempo",
    "title": "歌曲标题",
    "lyrics_cn": "[Verse]\\n诗句1\\n诗句2\\n\\n[Chorus]\\n诗句3\\n诗句4",
    "lyrics_en": "[Verse]\\nEnglish line1\\nEnglish line2",
    "instrumental": false
  }
}`;

        const userPrompt = `## 诗句
${content}

## 视觉风格要求
${style || 'traditional Chinese art style with ink painting aesthetic'}

## 输出要求
为每句诗生成 ${exampleCount} 组不同的图像+视频提示词对。
图像提示词使用英文，注重画面构图和色彩美感。
视频提示词使用英文，注重运镜、动画风格、转场和节奏描述。
音乐风格标签 (style_prompt) 必须完全独立于视觉风格，仅基于诗词情感创作。

请严格按照上述 JSON 格式返回，不要添加任何其他文字。`;

        const aiRes: any = await u.ai.text.invoke({
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
        }, languageModel);

        // 3. 解析 JSON 响应
        const textContent = aiRes?.text || aiRes || "";
        let jsonStr = "";

        // 尝试匹配 markdown ```json ... ``` 代码块
        const codeBlockMatch = typeof textContent === 'string' ? textContent.match(/```json\s*(\{[\s\S]*?\})\s*```/) : null;
        if (codeBlockMatch) {
            jsonStr = codeBlockMatch[1];
        } else {
            // 尝试匹配最外层 {}
            const braceMatch = typeof textContent === 'string' ? textContent.match(/\{[\s\S]*\}/) : null;
            if (braceMatch) {
                jsonStr = braceMatch[0];
            } else {
                return res.status(500).send({ code: 500, message: "AI返回格式错误", data: textContent });
            }
        }

        let data: any;
        try {
            data = JSON.parse(jsonStr);
        } catch (e) {
            // 尝试修复常见 JSON 错误（末尾逗号）
            try {
                const fixed = jsonStr.replace(/,\s*\}/g, '}').replace(/,\s*\]/g, ']');
                data = JSON.parse(fixed);
            } catch {
                return res.status(500).send({ code: 500, message: "解析JSON失败", data: jsonStr.slice(0, 200) });
            }
        }

        // 4. 九宫格提示词与会话准备
        const sessionId = new Date().getTime();
        let gridPrompt: string | null = null;
        let savedPrompts: any[] = [];
        const promptsArr = data.prompts || [];
        for (const item of promptsArr) {
            const descs = item.descriptions || [];
            for (let di = 0; di < descs.length; di++) {
                const d = descs[di];
                const imageDesc = typeof d === 'string' ? d : (d.image || d.description || "");
                const videoDesc = typeof d === 'string' ? "" : (d.video || "");

                const pId = new Date().getTime() + Math.floor(Math.random() * 10000);
                savedPrompts.push({
                    id: pId,
                    session_id: sessionId,
                    sentence: item.verse,
                    visual_prompt: imageDesc,
                    video_prompt: videoDesc,
                    duration: "5",
                    sort_order: (item.index || 0) * 10 + di + 1
                });
            }
        }

        // 5. 九宫格提示词生成
        if (gridMode && savedPrompts.length > 0) {
            const count = savedPrompts.length;
            const [rows, cols] = calculateGridLayout(count);
            const poemSummary = [...new Set(savedPrompts.map(p => p.sentence))].join(" ");

            gridPrompt = `根据【${poemSummary}】，生成一张具有凝聚力的[${rows}*${cols}]的网格图像（包含${count}个镜头），`;
            gridPrompt += `严格保持人物/物体服装光线的一致性，[${resolution}]分辨率，[${aspectRatio}]画幅。`;
            gridPrompt += "生成的多宫格图每一个分镜头都需要按照序号编号。\n\n";

            savedPrompts.forEach((p, i) => {
                gridPrompt += `镜头${i + 1}: [${p.visual_prompt}]\n`;
            });
        }

        // 6. 音乐提示词
        const musicData = data.music || null;

        // 7. 保存 Session 记录
        await u.db("t_poetry_session").insert({
            id: sessionId,
            poetry_content: content,
            title: content.slice(0, 10),
            project_id: projectId || null,
            create_time: new Date().getTime(),
            overall_style: style,
            grid_prompt: gridPrompt,
            music_prompt_json: musicData ? JSON.stringify(musicData) : null,
            image_manufacturer: textManufacturer // using the request's manufacturer param as an indicator
        });

        for (const p of savedPrompts) {
            await u.db("t_poetry_prompt").insert(p);
        }

        res.send({
            code: 200,
            data: {
                sessionId,
                prompts: savedPrompts,
                gridPrompt,
                musicPrompt: musicData
            }
        });
    } catch (error: any) {
        console.error("Poetry Parse Error:", error);
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route GET /api/poetry/session/:id
 * @desc 获取分镜会话详情
 */
router.get("/session/:id", async (req, res) => {
    try {
        const sessionId = Number(req.params.id);
        const session = await u.db("t_poetry_session").where("id", sessionId).first();
        if (!session) return res.status(404).send({ code: 404, message: "Session not found" });

        const prompts = await u.db("t_poetry_prompt").where("session_id", sessionId).orderBy("sort_order", "asc");

        let musicPromptData = null;
        if (session.music_prompt_json) {
            try {
                musicPromptData = JSON.parse(session.music_prompt_json);
            } catch (e) { }
        }

        res.send({
            code: 200,
            data: {
                sessionId: session.id,
                prompts,
                gridPrompt: session.grid_prompt,
                musicPrompt: musicPromptData,
                imageManufacturer: session.image_manufacturer,
                isMagic: false, // history loading doesn't auto-run by default
                session // keep extra data if needed
            }
        });
    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route GET /api/poetry/sessions
 * @desc 获取历史会话列表
 */
router.get("/sessions", async (req, res) => {
    try {
        const list = await u.db("t_poetry_session").orderBy("create_time", "desc").limit(100);
        res.send({ code: 200, data: list });
    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route DELETE /api/poetry/session/:id
 * @desc 删除历史会话及其关联数据
 */
router.delete("/session/:id", async (req, res) => {
    try {
        const sessionId = Number(req.params.id);
        await u.db("t_poetry_prompt").where("session_id", sessionId).delete();
        await u.db("t_poetry_music").where("session_id", sessionId).delete(); // optional cleanup
        await u.db("t_poetry_session").where("id", sessionId).delete();
        res.send({ code: 200, message: "删除成功" });
    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route POST /api/poetry/generateImage
 * @desc 通过当前选择的图片模型生图
 */
router.post("/generateImage", async (req, res) => {
    try {
        const { promptId, visualPrompt, imageManufacturer } = req.body;

        // 获取图片模型（如有指定则优先使用）
        let imageModel: any = {};
        try {
            imageModel = await u.getConfig("image", imageManufacturer || undefined);
        } catch (e) {
            console.error("Failed to load global image config:", e);
        }

        if (!imageModel || !imageModel.apiKey) {
            return res.status(400).send({ code: 400, message: "请先在设置中配置图片模型" });
        }

        // 调用现有的生图工具
        const imgUrl = await u.ai.image({
            prompt: visualPrompt,
            aspectRatio: "16:9",
            size: "1K",
            imageBase64: []
        }, imageModel);

        // 更新数据库
        if (imgUrl) {
            await u.db("t_poetry_prompt").where("id", promptId).update({ image_path: imgUrl });
        }

        res.send({ code: 200, data: { url: imgUrl } });
    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route POST /api/poetry/regenerateImage
 * @desc 重新生成单张图像
 */
router.post("/regenerateImage", async (req, res) => {
    try {
        const { promptId, visualPrompt, imageManufacturer } = req.body;

        let imageModel: any = {};
        try {
            imageModel = await u.getConfig("image", imageManufacturer || undefined);
        } catch (e) {
            console.error("Failed to load global image config:", e);
        }

        if (!imageModel || !imageModel.apiKey) {
            return res.status(400).send({ code: 400, message: "请先在设置中配置图片模型" });
        }

        const imgUrl = await u.ai.image({
            prompt: visualPrompt,
            aspectRatio: "16:9",
            size: "1K",
            imageBase64: []
        }, imageModel);

        if (imgUrl) {
            await u.db("t_poetry_prompt").where("id", promptId).update({ image_path: imgUrl });
        }

        res.send({ code: 200, data: { url: imgUrl } });
    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route POST /api/poetry/generateVideo
 * @desc 提交视频生成任务
 */
router.post("/generateVideo", async (req, res) => {
    try {
        let { promptId, duration, videoModelId, videoPrompt } = req.body;

        const promptRecord = await u.db("t_poetry_prompt").where("id", promptId).first();
        if (!promptRecord || !promptRecord.image_path) {
            return res.status(400).send({ code: 400, message: "请确保已经生成了图片" });
        }

        if (videoPrompt && videoPrompt.trim() !== "") {
            await u.db("t_poetry_prompt").where("id", promptId).update({ video_prompt: videoPrompt });
            promptRecord.video_prompt = videoPrompt;
        }

        if (!videoModelId) {
            const setting: any = await u.db("t_setting").first();
            if (setting && setting.videoModel) {
                try {
                    const vSettings = JSON.parse(setting.videoModel);
                    videoModelId = vSettings.videoModel;
                } catch (e) { }
            }
        }

        if (!videoModelId) return res.status(400).send({ code: 400, message: "未选择视频模型" });

        const tokenConfig = await u.db("t_config").where("id", videoModelId).first();
        if (!tokenConfig) return res.status(400).send({ code: 400, message: "视频模型无效" });

        if (!tokenConfig.apiKey) {
            return res.status(400).send({ code: 400, message: "视频模型 Token 未配置" });
        }

        const videoTaskId = new Date().getTime().toString();
        const videoRowId = new Date().getTime();

        await u.db("t_poetry_video").insert({
            id: videoRowId,
            prompt_id: promptId,
            task_id: videoTaskId,
            status: "processing",
            create_time: new Date().getTime(),
            update_time: new Date().getTime()
        });

        await u.db("t_poetry_prompt").where("id", promptId).update({ video_task_id: videoRowId });

        res.send({
            code: 200,
            message: "视频任务已提交",
            data: { videoId: videoRowId, taskId: videoTaskId }
        });

        // 异步后台生成
        generatePoetryVideoAsync(videoRowId, promptId, duration, tokenConfig, tokenConfig);

    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

async function generatePoetryVideoAsync(videoId: number, promptId: number, duration: number, modelConfig: any, tokenConfig: any) {
    try {
        const promptRecord = await u.db("t_poetry_prompt").where("id", promptId).first();
        if (!promptRecord) return;

        const imagePath = promptRecord.image_path;
        if (!imagePath) return;

        let base64 = "";
        if (imagePath.startsWith("data:image/")) {
            base64 = imagePath;
        } else if (imagePath.startsWith("http://") || imagePath.startsWith("https://")) {
            base64 = await u.oss.getImageBase64(new URL(imagePath).pathname);
        } else {
            base64 = await u.oss.getImageBase64(imagePath);
        }

        const savePath = `/poetry_video/${uuid()}.mp4`;
        const videoPrompt = `请完全参照以下内容生成视频：\n${promptRecord.video_prompt || promptRecord.visual_prompt}\n重要强调：视频连贯，无水印。`;

        const videoUrl = await u.ai.video({
            imageBase64: [base64],
            savePath,
            prompt: videoPrompt,
            duration: duration as any,
            aspectRatio: "16:9",
            resolution: "1080p" as any,
            audio: false,
            mode: "single" as any
        }, {
            baseURL: tokenConfig.baseUrl || "",
            model: modelConfig.model,
            apiKey: tokenConfig.apiKey,
            manufacturer: modelConfig.manufacturer
        });

        if (videoUrl) {
            await u.db("t_poetry_video").where("id", videoId).update({
                status: "success",
                video_url: videoUrl,
                update_time: new Date().getTime()
            });
            await u.db("t_poetry_prompt").where("id", promptId).update({
                video_path: videoUrl
            });
        } else {
            await u.db("t_poetry_video").where("id", videoId).update({
                status: "failed",
                update_time: new Date().getTime()
            });
        }
    } catch (e: any) {
        console.error("Poetry Video Gen Error:", e);
        await u.db("t_poetry_video").where("id", videoId).update({
            status: "failed",
            update_time: new Date().getTime()
        });
    }
}

/**
 * @route GET /api/poetry/videoStatus/:id
 * @desc 轮询视频状态
 */
router.get("/videoStatus/:id", async (req, res) => {
    try {
        const record = await u.db("t_poetry_video").where("id", req.params.id).first();
        if (!record) return res.status(404).send({ code: 404, message: "任务不存在" });

        res.send({
            code: 200,
            data: {
                status: record.status, // processing, success, failed
                video_url: record.video_url
            }
        });
    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route POST /api/poetry/generateMusic
 * @desc 调用Suno生成音乐 (基于全局Suno配置)
 */
router.post("/generateMusic", async (req, res) => {
    try {
        const { sessionId, stylePrompt, musicParams } = req.body;

        const sunoConfig = await u.db("t_config").where("manufacturer", "suno").first();
        if (!sunoConfig || !sunoConfig.apiKey) {
            return res.status(400).send({ code: 400, message: "请在设置中配置Suno Music服务" });
        }

        const musicRowId = new Date().getTime();

        // 兼容处理老版本前端
        const mParams = musicParams || {
            mode: 'inspiration',
            gpt_description_prompt: stylePrompt,
            mv: 'chirp-v3-5',
            make_instrumental: true
        };

        await u.db("t_poetry_music").insert({
            id: musicRowId,
            session_id: sessionId,
            music_prompt: mParams.prompt || mParams.gpt_description_prompt || stylePrompt,
            task_id: "",
            status: "processing",
            create_time: new Date().getTime(),
            update_time: new Date().getTime()
        });

        res.send({
            code: 200,
            message: "音乐任务已提交",
            data: { musicId: musicRowId }
        });

        // 异步调用Suno生成
        generatePoetryMusicAsync(musicRowId, sessionId, mParams, sunoConfig);

    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route POST /api/poetry/generateGridImage
 * @desc 根据九宫格总提示词生成一张拼接大图
 */
router.post("/generateGridImage", async (req, res) => {
    try {
        const { gridPrompt, imageManufacturer, aspectRatio = "16:9" } = req.body;

        let imageModel: any = {};
        try {
            imageModel = await u.getConfig("image", imageManufacturer || undefined);
        } catch (e) {
            console.error("Failed to load global image config:", e);
        }

        if (!imageModel || !imageModel.apiKey) {
            return res.status(400).send({ code: 400, message: "请先在设置中配置图片模型" });
        }

        const imgUrl = await u.ai.image({
            prompt: gridPrompt,
            aspectRatio: aspectRatio,
            size: "1K",
            imageBase64: []
        }, imageModel);

        res.send({ code: 200, data: { url: imgUrl } });
    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route POST /api/poetry/extractGrid
 * @desc 切割九宫格大图并保存为分镜小图
 */
router.post("/extractGrid", async (req, res) => {
    try {
        const { sessionId, gridImageUrl, rows, cols } = req.body;

        if (!gridImageUrl) return res.status(400).send({ code: 400, message: "缺少图片URL" });

        // 1. 下载图片
        const response = await axios.get(gridImageUrl, { responseType: "arraybuffer" });
        const buffer = Buffer.from(response.data, "binary");

        // 2. 使用 sharp 获取图片尺寸
        const metadata = await sharp(buffer).metadata();
        if (!metadata.width || !metadata.height) {
            return res.status(400).send({ code: 400, message: "无法读取图片尺寸" });
        }

        // 3. 计算每个切片的宽高
        const sliceWidth = Math.floor(metadata.width / cols);
        const sliceHeight = Math.floor(metadata.height / rows);

        // 4. 获取该 session 下的所有 prompt
        const prompts = await u.db("t_poetry_prompt").where("session_id", sessionId).orderBy("sort_order", "asc");

        // 5. 进行切片处理
        const maxSlices = prompts.length;
        let count = 0;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (count >= maxSlices) break;

                const promptRecord = prompts[count];

                // 裁剪
                const sliceBuffer = await sharp(buffer)
                    .extract({ left: c * sliceWidth, top: r * sliceHeight, width: sliceWidth, height: sliceHeight })
                    .png()
                    .toBuffer();

                // 上传/保存到本地 oss
                const relPath = `poetry/grid_${sessionId}_${promptRecord.id}.png`;
                await u.oss.writeFile(relPath, sliceBuffer);
                const localUrl = await u.oss.getFileUrl(relPath);

                // 更新数据库
                await u.db("t_poetry_prompt").where("id", promptRecord.id).update({ image_path: localUrl });

                count++;
            }
        }

        // 6. 返回最新数据
        const updatedPrompts = await u.db("t_poetry_prompt").where("session_id", sessionId).orderBy("sort_order", "asc");
        res.send({ code: 200, message: "切片成功", data: { prompts: updatedPrompts } });

    } catch (error: any) {
        console.error("Extract Grid Error:", error);
        res.status(500).send({ code: 500, message: error.message });
    }
});

async function generatePoetryMusicAsync(musicId: number, sessionId: number, mParams: any, sunoConfig: any) {
    try {
        const { baseUrl, apiKey } = sunoConfig;
        const apiBase = baseUrl ? baseUrl.replace(/\/$/, '') : "https://api.sunoaiapi.com";

        // 构建请求体根据不同模式 (灵感, 自定义, 续写)
        const payload: any = {
            mv: mParams.mv || 'chirp-v3-5',
            make_instrumental: mParams.make_instrumental || false
        };

        if (mParams.mode === 'extend') {
            payload.task = "extend";
            payload.prompt = mParams.prompt || "";
            payload.title = mParams.title || "Extended Song";
            payload.tags = mParams.tags || "";
            payload.continue_at = mParams.continue_at;
            payload.continue_clip_id = mParams.continue_clip_id;
            payload.make_instrumental = undefined; // extend usually doesn't need this if inherited
        } else if (mParams.mode === 'custom') {
            payload.task = "generate";
            payload.prompt = mParams.prompt || "";
            payload.title = mParams.title || "Custom Song";
            payload.tags = mParams.tags || "";
        } else {
            // mode === 'inspiration'
            payload.gpt_description_prompt = mParams.gpt_description_prompt || mParams.prompt || "";
            payload.prompt = ""; // 文档说必填但如果是灵感通常为空
        }

        const endpoint = apiBase.includes('sunnyapi') ? '/suno/submit/music' : '/api/generate';

        // 提交生成任务
        const res = await axios.post(`${apiBase}${endpoint}`, payload, {
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            }
        });

        let taskId = "";
        // 适配不同的返回结构
        if (res.data?.data && typeof res.data.data === 'string') {
            taskId = res.data.data; // sunnyapi 结构
        } else if (res.data?.task_id) {
            taskId = res.data.task_id;
        } else if (res.data?.id) {
            taskId = res.data.id;
        } else if (res.data?.[0]?.id) {
            taskId = res.data[0].id;
        }

        if (!taskId) {
            throw new Error(`Failed to get task ID from Suno API. Response: ${JSON.stringify(res.data)}`);
        }

        await u.db("t_poetry_music").where("id", musicId).update({ task_id: taskId });

        // Polling loop
        let audioUrl = "";
        let maxRetries = 60; // 5分钟
        const pollEndpoint = apiBase.includes('sunnyapi') ? `/suno/fetch/${taskId}` : `/api/get?ids=${taskId}`;

        while (maxRetries > 0) {
            await new Promise(r => setTimeout(r, 5000));
            try {
                const statusRes = await axios.get(`${apiBase}${pollEndpoint}`, {
                    headers: { "Authorization": `Bearer ${apiKey}` }
                });

                // 兼容多层级返回结构
                const dataBlock = statusRes.data?.data || statusRes.data;
                const item = Array.isArray(dataBlock) ? dataBlock[0] : dataBlock;

                if (item && (item.status === "complete" || item.status === "SUCCESS")) {
                    audioUrl = item.audio_url || item.video_url || item.image_url;
                    break;
                } else if (item && (item.status === "error" || item.status === "FAILED")) {
                    throw new Error("Suno generation failed.");
                }
            } catch (pollErr: any) {
                console.error("Suno Poll Error:", pollErr?.response?.data || pollErr.message);
            }
            maxRetries--;
        }

        if (audioUrl) {
            await u.db("t_poetry_music").where("id", musicId).update({
                status: "success",
                audio_url: audioUrl,
                update_time: new Date().getTime()
            });
            await u.db("t_poetry_session").where("id", sessionId).update({
                audio_path: audioUrl
            });
        } else {
            throw new Error("Timeout waiting for Suno");
        }
    } catch (e: any) {
        console.error("Poetry Music Gen Error:", e);
        await u.db("t_poetry_music").where("id", musicId).update({
            status: "failed",
            update_time: new Date().getTime()
        });
    }
}

/**
 * @route GET /api/poetry/musicStatus/:id
 * @desc 轮询音乐状态
 */
router.get("/musicStatus/:id", async (req, res) => {
    try {
        const record = await u.db("t_poetry_music").where("id", req.params.id).first();
        if (!record) return res.status(404).send({ code: 404, message: "任务不存在" });

        res.send({
            code: 200,
            data: {
                status: record.status, // processing, success, failed
                audio_url: record.audio_url,
                task_id: record.task_id
            }
        });
    } catch (error: any) {
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route GET /api/poetry/audioProxy
 * @desc 代理音频文件，解决 CORS 问题
 */
router.get("/audioProxy", async (req, res) => {
    try {
        const { url } = req.query;
        if (!url || typeof url !== "string") {
            return res.status(400).send({ code: 400, message: "Missing url parameter" });
        }

        // 验证 URL 是否为有效的音频 URL
        if (!url.startsWith("http")) {
            return res.status(400).send({ code: 400, message: "Invalid URL" });
        }

        const response = await axios.get(url, {
            responseType: "arraybuffer",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
        });

        // 设置正确的 Content-Type
        const contentType = response.headers["content-type"] || "audio/mpeg";
        res.setHeader("Content-Type", contentType);
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cache-Control", "public, max-age=3600");

        res.send(response.data);
    } catch (error: any) {
        console.error("Audio proxy error:", error.message);
        res.status(500).send({ code: 500, message: error.message });
    }
});

/**
 * @route POST /api/poetry/exportJianying
 * @desc 一键导出当前 Session 到剪映草稿并打开
 */
router.post("/exportJianying", async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).send({ code: 400, message: "Missing sessionId" });
        }

        const session = await u.db("t_poetry_session").where("id", sessionId).first();
        if (!session) {
            return res.status(404).send({ code: 404, message: "Session not found" });
        }

        const prompts = await u.db("t_poetry_prompt").where("session_id", sessionId).orderBy("sort_order", "asc");

        const resolveLocalOssPath = (fileUrl: string | null | undefined) => {
            if (!fileUrl) return "";
            const ossPrefix = process.env.OSSURL || "http://127.0.0.1:60000/";
            if (fileUrl.startsWith(ossPrefix)) {
                const relPath = fileUrl.replace(ossPrefix, "");
                return path.join(process.cwd(), "uploads", relPath.replace(/\//g, path.sep));
            }
            return fileUrl;
        };

        const segments = prompts.map((p: any) => ({
            sentence: p.sentence,
            media_path: resolveLocalOssPath(p.video_path || p.image_path)
        }));

        let audioPath = session.audio_path || "";
        // Optional fallback to find an audio in t_poetry_music if audio_path null
        if (!audioPath) {
            const musicRow = await u.db("t_poetry_music").where("session_id", sessionId).whereNotNull("audio_url").first();
            if (musicRow) audioPath = musicRow.audio_url || "";
        }

        const payload = {
            title: session.title || "诗韵画境_自动导出",
            exec_path: "E:\\software\\jianying5.9\\JianyingPro\\5.9.0.11632\\JianyingPro.exe",
            audio_path: resolveLocalOssPath(audioPath),
            segments
        };

        // Write payload to a temporary JSON file to avoid passing huge JSON strings in the shell
        const tempJsonPath = path.join(process.cwd(), "uploads", `export_jy_${sessionId}.json`);
        fs.writeFileSync(tempJsonPath, JSON.stringify(payload, null, 2), "utf8");

        const pyScript = path.join(process.cwd(), "src", "scripts", "export_jianying.py");

        const { spawn } = require("child_process");
        const pythonProcess = spawn("python", [pyScript, tempJsonPath]);

        let outputData = "";
        let errorData = "";

        pythonProcess.stdout.on("data", (data: any) => {
            outputData += data.toString();
        });

        pythonProcess.stderr.on("data", (data: any) => {
            errorData += data.toString();
        });

        pythonProcess.on("close", (code: number) => {
            // cleanup temp desc file
            try { fs.unlinkSync(tempJsonPath); } catch (e) { }

            if (code !== 0) {
                console.error("JianYing Export Script Error:", errorData);
                return res.status(500).send({ code: 500, message: errorData || "Python Script Failed" });
            }

            try {
                // Try to parse the last JSON line printed by Python
                const lines = outputData.trim().split("\n");
                const result = JSON.parse(lines[lines.length - 1]);
                if (result.code === 200) {
                    res.send(result);
                } else {
                    res.status(500).send(result);
                }
            } catch (err: any) {
                res.status(500).send({ code: 500, message: "解析脚本输出失败" + outputData });
            }
        });

    } catch (error: any) {
        console.error("Export JianYing Error:", error);
        res.status(500).send({ code: 500, message: error.message });
    }
});

export default router;
