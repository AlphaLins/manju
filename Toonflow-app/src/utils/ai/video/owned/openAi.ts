/**
 * 通用/自定义视频生成处理器
 * 参考 Guui_software/api/video_client.py 的设计
 *
 * 默认走 SunnyAPI 统一格式: POST /v1/video/create + GET /v1/video/query
 * 根据模型名自动构建不同的 Payload
 * 用户只需填写 baseURL = https://api.xxx.com 即可
 */
import "../type";
import axios from "axios";
import FormData from "form-data";
import { pollTask } from "@/utils/ai/utils";

// ==================== 模型类型识别 ====================

type ModelType = "veo" | "grok" | "sora" | "doubao" | "minimax" | "generic";

function getModelType(model: string): ModelType {
    const m = model.toLowerCase();
    if (m.startsWith("veo") || m.includes("veo")) return "veo";
    if (m.startsWith("grok") || m.includes("grok")) return "grok";
    if (m.startsWith("sora") || m.includes("sora")) return "sora";
    if (m.includes("seedance") || m.startsWith("doubao")) return "doubao";
    if (m.includes("minimax") || m.includes("hailuo")) return "minimax";
    return "generic";
}

// ==================== Payload 构建器 ====================

function buildVeoPayload(model: string, prompt: string, images: string[], aspectRatio: string) {
    const payload: any = {
        model,
        prompt,
        enhance_prompt: true,
        enable_upsample: true,
    };
    if (images.length > 0) payload.images = images;
    if (model.startsWith("veo3") || model.startsWith("veo2")) {
        payload.aspect_ratio = aspectRatio || "16:9";
    }
    return payload;
}

function buildGrokPayload(model: string, prompt: string, images: string[], aspectRatio: string) {
    return {
        model,
        prompt: `${prompt} --mode=custom`,
        aspect_ratio: aspectRatio || "3:2",
        size: "720P",
        images: images.slice(0, 1), // Grok 通常只支持单张
    };
}

function buildSoraPayload(model: string, prompt: string, images: string[], duration: number) {
    return {
        model,
        images: images.slice(0, 1),
        prompt,
        orientation: "landscape",
        duration: duration || 5,
        watermark: false,
        size: "small",
        private: false,
    };
}

function buildDoubaoPayload(model: string, prompt: string, images: string[]) {
    const content: any[] = [{ type: "text", text: prompt }];
    if (images.length > 0) {
        content.push({
            type: "image_url",
            image_url: { url: images[0] },
            role: "first_frame",
        });
    }
    if (images.length > 1) {
        content.push({
            type: "image_url",
            image_url: { url: images[1] },
            role: "last_frame",
        });
    }
    return { model, content };
}

function buildMinimaxPayload(model: string, prompt: string, images: string[], duration: number) {
    const payload: any = {
        model,
        prompt,
        duration: duration || 6,
        prompt_optimizer: true,
    };
    if (images.length > 0) payload.first_frame_image = images[0];
    if (images.length > 1) payload.last_frame_image = images[1];
    return payload;
}

function buildGenericPayload(model: string, prompt: string, images: string[], aspectRatio: string) {
    const payload: any = { model, prompt };
    if (images.length > 0) payload.images = images;
    if (aspectRatio) payload.aspect_ratio = aspectRatio;
    return payload;
}

// ==================== 端点路由 ====================

function getEndpointAndPayload(
    modelType: ModelType,
    model: string,
    prompt: string,
    images: string[],
    aspectRatio: string,
    duration: number,
): { endpoint: string; payload: any } {
    switch (modelType) {
        case "veo":
            return { endpoint: "/v1/video/create", payload: buildVeoPayload(model, prompt, images, aspectRatio) };
        case "grok":
            return { endpoint: "/v1/video/create", payload: buildGrokPayload(model, prompt, images, aspectRatio) };
        case "sora":
            return { endpoint: "/v1/video/create", payload: buildSoraPayload(model, prompt, images, duration) };
        case "doubao":
            return { endpoint: "/volc/v1/contents/generations/tasks", payload: buildDoubaoPayload(model, prompt, images) };
        case "minimax":
            return { endpoint: "/minimax/v1/video_generation", payload: buildMinimaxPayload(model, prompt, images, duration) };
        default:
            return { endpoint: "/v1/video/create", payload: buildGenericPayload(model, prompt, images, aspectRatio) };
    }
}

// ==================== 主导出函数 ====================

export default async (input: VideoConfig, config: any) => {
    if (!config.apiKey) throw new Error("缺少API Key");
    if (!config.baseURL) throw new Error("缺少baseURL");

    // 支持 | 分隔的自定义轮询 URL
    const parts = config.baseURL.split("|");
    const rawBaseUrl = parts[0].replace(/\/$/, "");
    const customQueryUrl = parts[1]?.replace(/\/$/, "");

    // 收集图片（已经是 data:image/...;base64,... 格式）
    const images: string[] = input.imageBase64 && input.imageBase64.length > 0 ? input.imageBase64 : [];

    // --- 检查用户是否明确指定了端点路径 ---

    // 1. 用户明确写了 /chat/completions → 走 Chat Completions 协议
    if (rawBaseUrl.includes("/chat/completions")) {
        console.log(`[Video] 模型: ${config.model} → Chat Completions 协议: ${rawBaseUrl}`);
        return await handleChatCompletions(rawBaseUrl, config, input, images);
    }

    // 2. 用户明确写了 /videos (OpenAI 官方视频格式) → 走 FormData 协议
    if (rawBaseUrl.endsWith("/videos") || rawBaseUrl.includes("/videos/generations")) {
        console.log(`[Video] 模型: ${config.model} → OpenAI /videos 协议: ${rawBaseUrl}`);
        return await handleOpenAIVideos(rawBaseUrl, customQueryUrl, config, input, images);
    }

    // --- 默认: 统一视频格式 (基于模型名智能路由) ---
    const modelType = getModelType(config.model);
    const { endpoint, payload } = getEndpointAndPayload(
        modelType, config.model, input.prompt, images,
        input.aspectRatio || "16:9", input.duration || 5,
    );

    // 如果用户 baseUrl 已经包含 /video/create 等具体路径，直接用；否则拼接
    let submitUrl: string;
    if (rawBaseUrl.includes("/video/create") || rawBaseUrl.includes("/volc/") || rawBaseUrl.includes("/minimax/")) {
        submitUrl = rawBaseUrl;
    } else {
        submitUrl = `${rawBaseUrl}${endpoint}`;
    }

    console.log(`[Video] 模型: ${config.model} (${modelType}) → 端点: ${submitUrl}`);

    // 提交任务
    const res = await axios.post(submitUrl, payload, {
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
        },
    });

    // 检查是否返回了 HTML（常见错误: URL 指向了网站前端）
    if (typeof res.data === "string" && res.data.includes("<!DOCTYPE")) {
        throw new Error("API 返回了 HTML 页面而非 JSON，请检查 Base URL 是否正确（应填写 API 地址如 https://api.xxx.com，而非网站地址）");
    }

    const taskId = res.data?.id || res.data?.data?.id || res.data?.task_id;
    if (!taskId) throw new Error("视频任务提交失败: " + JSON.stringify(res.data).slice(0, 500));

    // 如果响应直接包含视频 URL（某些 API 同步返回）
    const directUrl = res.data?.video_url || res.data?.url || res.data?.data?.video_url;
    if (directUrl) return directUrl;

    // 轮询任务状态
    const queryBaseUrl = customQueryUrl || `${rawBaseUrl}/v1/video/query`;
    console.log(`[Video] 任务已提交: ${taskId}, 轮询: ${queryBaseUrl}`);

    const videoUrl = await pollTask(async () => {
        const pollEndpoint = queryBaseUrl.includes("?")
            ? `${queryBaseUrl}&id=${taskId}`
            : `${queryBaseUrl}?id=${taskId}`;

        const pollRes = await axios.get(pollEndpoint, {
            headers: { Authorization: `Bearer ${config.apiKey}` },
        });

        const data = pollRes.data;
        const status = data?.status || data?.data?.status || "";
        const videoUrl = data?.video_url || data?.data?.video_url || data?.data?.url || data?.url;

        // 成功
        if (status === "completed" || status === "success" || status === "SUCCESS" || videoUrl) {
            return { completed: true, url: videoUrl };
        }
        // 失败
        if (["failed", "error", "FAILURE", "CANCEL", "cancelled"].includes(status)) {
            const errMsg = data?.error || data?.message || data?.data?.error || "未知原因";
            return { completed: false, error: `视频任务失败 (${status}): ${errMsg}` };
        }
        // 进行中
        return { completed: false };
    });

    return videoUrl;
};

// ==================== Chat Completions 协议 ====================

async function handleChatCompletions(
    url: string, config: any, input: VideoConfig, images: string[],
): Promise<string> {
    const messages: any[] = [{ role: "user", content: [] as any[] }];
    if (input.prompt) {
        messages[0].content.push({ type: "text", text: input.prompt });
    }
    if (images.length > 0) {
        messages[0].content.push({
            type: "image_url",
            image_url: { url: images[0] },
        });
    }
    // 简化：如果只有文本，用 string 而非数组
    if (messages[0].content.length === 1 && messages[0].content[0].type === "text") {
        messages[0].content = input.prompt;
    }

    const res = await axios.post(url, {
        model: config.model,
        messages,
    }, {
        headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
        },
    });

    const content = res.data?.choices?.[0]?.message?.content;
    if (!content) throw new Error("聊天响应中未找到内容: " + JSON.stringify(res.data).slice(0, 500));

    const urlMatch = content.match(/https?:\/\/[^\s"'<>]+/);
    if (urlMatch) return urlMatch[0];
    return content;
}

// ==================== OpenAI /videos FormData 协议 ====================

async function handleOpenAIVideos(
    url: string, queryUrl: string | undefined, config: any, input: VideoConfig, images: string[],
): Promise<string> {
    let endpoint = url;

    // 如果有图片先上传
    let uploadedImageRef: string | undefined;
    if (images.length > 0) {
        const base64Data = images[0].replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, "base64");
        const formData = new FormData();
        formData.append("file", buffer, { filename: "image.jpg", contentType: "image/jpeg" });
        const uploadRes = await axios.post(endpoint, formData, {
            headers: { Authorization: `Bearer ${config.apiKey}`, ...formData.getHeaders() },
        });
        uploadedImageRef = uploadRes.data?.id || uploadRes.data?.url;
    }

    // 创建任务
    const formData = new FormData();
    formData.append("model", config.model);
    formData.append("prompt", input.prompt);
    formData.append("seconds", String(input.duration || 5));
    const sizeMap: Record<string, string> = {
        "16:9": "1920x1080", "9:16": "1080x1920", "1:1": "1080x1080",
        "4:3": "1440x1080", "3:4": "1080x1440", "21:9": "2560x1080",
    };
    formData.append("size", sizeMap[input.aspectRatio || "16:9"] || "1920x1080");
    if (uploadedImageRef) formData.append("input_reference", uploadedImageRef);

    const createRes = await axios.post(endpoint, formData, {
        headers: { Authorization: `Bearer ${config.apiKey}`, ...formData.getHeaders() },
    });

    const taskId = createRes.data?.id || createRes.data?.task_id;
    if (!taskId) throw new Error("视频任务创建失败: " + JSON.stringify(createRes.data).slice(0, 500));

    if (createRes.data?.url || createRes.data?.video_url) {
        return createRes.data.url || createRes.data.video_url;
    }

    const pollUrl = queryUrl || `${endpoint}/${taskId}`;
    const videoUrl = await pollTask(async () => {
        const pollRes = await axios.get(pollUrl, {
            headers: { Authorization: `Bearer ${config.apiKey}` },
        });
        const { status, imageUrl, video_url, failReason } = pollRes.data;
        const resUrl = imageUrl || video_url;
        if (status === "SUCCESS" || status === "completed" || resUrl) return { completed: true, url: resUrl };
        if (["FAILURE", "CANCEL", "failed"].includes(status)) {
            return { completed: false, error: `任务失败: ${failReason || "未知"}` };
        }
        return { completed: false };
    });

    return videoUrl;
}
