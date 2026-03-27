<template>
  <a-modal
    :footer="null"
    :style="{ top: '30px', width: '100vw' }"
    v-model:open="modalShow"
    :maskClosable="false"
    wrapClassName="noHeaderMargin"
    dialogClass="customModal"
    :keyboard="false"
    :closable="false"
    width="90%">
    <template #title>
      <div class="ac jb titHeader" style="background: #f9faff; height: 60px; display: flex; width: 100%">
        <div>
          <span style="font-weight: bold; font-size: 18px; margin-left: 24px">分镜图生成</span>
        </div>
        <div class="closePoint" @click="cancelModal">
          <i-close theme="outline" size="18" fill="#9913FA" />
        </div>
      </div>
    </template>
    <div class="content pr">
      <draggableCanvas v-model="gridData" :generatingIds="generatingIds" @replaceShot="replaceShot" @generateImage="handleGenerateImage" />
      <div class="chatBox pa" :class="{ hoverState: gridData.length > 0 }">
        <chat ref="chatRef" :canSend="canSend" enterToSend :sendApi="sendApi" v-model="history" />
        <div class="f ac jb">
          <div></div>
          <a-button class="btn" type="primary" @click="exportAll">导出全部镜头({{ imageNumber }})</a-button>
        </div>
      </div>
    </div>
    <detectionImage
      ref="detectionImageRef"
      v-model:detectionImageShow="detectionImageShow"
      v-model:imageData="imageData"
      v-model:modalShow="modalShow"
      @save="$emit('save')" />
  </a-modal>
</template>

<script setup lang="ts">
import axios from "@/utils/axios";
import chat from "@/components/chat/index.vue";
import draggableCanvas from "./draggableCanvas.vue";
import { v4 as uuidv4 } from "uuid";
import WsClient from "@/utils/wsClient";
import { message as antMessage, message, Modal } from "ant-design-vue";
import detectionImage from "./detectionImage.vue";

type ImageDataItem = {
  id: string;
  videoPrompt: string;
  segmentId: number;
  shotIndex: number;
  prompt: string;
  duration: string;
  projectId: number;
  filePath: string;
  type: string;
  name: string;
  scriptId: number;
  src: string;
  dataUrl?: string;
};

const imageNumber = computed(() => {
  let count = 0;
  for (const grid of gridData.value) {
    count += grid.cells.reduce((acc, cell) => (cell.src ? acc + 1 : acc), 0);
  }
  return count;
});

// 定义组件 props
const props = defineProps<{
  projectId: number;
  scriptId?: number | null;
}>();

const modalShow = defineModel({
  default: false,
});
const chatRef = ref<InstanceType<typeof chat> | null>(null);

const detectionImageShow = ref(false);

const imageData = ref<ImageDataItem[]>([]);

const detectionImageRef = ref<InstanceType<typeof detectionImage> | null>(null);

const emit = defineEmits(["save"]);

let ws: WsClient | null = null;
let flagQuit = false;
let pendingMessage: any = null; // 等待发送的消息（等待 init 完成后发送）
let wsInitialized = false; // WebSocket 是否已初始化完成（收到 init 消息）

// AI 消息角色映射（与后端 AgentType 对应）
const aiMsgIdentity: Record<string, string> = {
  segmentAgent: "片段师",
  shotAgent: "分镜师",
  director: "导演",
  main: "助手",
};

const history = ref<ChatMessage[]>([
  {
    id: uuidv4(),
    identity: "assistant",
    role: "助手",
    data: [
      {
        type: "text",
        text: "欢迎使用Cosmos！我已经收到你的剧本与相关资产,请和我说“开始”启动生成分镜图的制作吧！",
      },
    ],
  },
]);
const canSend = ref(true);

// Tool 名称映射为可读文本（与后端工具对应）
const TOOL_NAME_MAP: Record<string, string> = {
  segmentAgent: "调用片段师",
  shotAgent: "调用分镜师",
  director: "调用导演",
  getScript: "获取剧本",
  getSegments: "获取片段数据",
  updateSegments: "更新片段数据",
  addShots: "添加分镜",
  updateShots: "更新分镜",
  deleteShots: "删除分镜",
  generateShotImage: "生成分镜图",
  getAssets: "获取素材",
};

// ==================== 统一的流式消息状态管理 ====================
interface StreamState {
  msgId: string | null; // 当前流式消息ID
  source: "main" | string | null; // 消息来源
}

const streamState: StreamState = {
  msgId: null,
  source: null,
};

// 更新 gridData 向后端发送数据
function replaceShot(options: { segmentId: number; cellId: number; cell: string }) {
  console.log("Replace shot triggered");
  ws?.send({
    type: "replaceShot",
    data: {
      segmentId: options.segmentId,
      cellId: options.cellId,
      cell: options.cell,
    },
  });
}

// 结束当前流式消息（切换前调用）
function endCurrentStream() {
  streamState.msgId = null;
  streamState.source = null;
}

// 移除思考中消息
function removeThinkingMessage() {
  const idx = history.value.findIndex(
    (item) => item.identity === "assistant" && Array.isArray(item.data) && item.data.some((d: any) => d.type === "thinking"),
  );
  if (idx !== -1) history.value.splice(idx, 1);
}

// 创建或获取流式消息
function getOrCreateStreamMessage(source: "main" | string, role: string): string {
  // 如果来源不同，先结束当前消息
  if (streamState.source !== source) {
    endCurrentStream();
  }

  // 如果没有当前消息，创建新的
  if (!streamState.msgId) {
    removeThinkingMessage();
    streamState.msgId = uuidv4();
    streamState.source = source;
    history.value.push({
      id: streamState.msgId,
      identity: "assistant",
      role,
      data: [{ type: "text", text: "" }],
    });
  }

  return streamState.msgId;
}

// 追加文本到当前流式消息
function appendToStream(text: string) {
  if (!streamState.msgId || !text) return;

  const msg = history.value.find((m) => m.id === streamState.msgId);
  if (msg && Array.isArray(msg.data) && msg.data[0]) {
    (msg.data[0] as any).text += text;
    // 流式更新时触发滚动
    chatRef.value?.scrollBottom();
  }
}

// 初始化 WebSocket 连接
function initWsClient() {
  const url = `/storyboard/chatStoryboard?projectId=${props.projectId}${props.scriptId ? `&scriptId=${props.scriptId}` : ""}`;

  ws = new WsClient(url, {
    onOpen: () => {
      console.log("WebSocket 连接已建立，等待后端 init 消息...");
      // 不再在这里发送消息，等待收到 init 消息后再发送
    },
    onMessage: async (msg: string) => {
      try {
        const msgData = JSON.parse(msg);
        handleWsMessage(msgData);
      } catch (e) {
        console.error("ws message parse error", e);
        pushNoticeMsg("消息解析失败");
      }
      chatRef.value?.scrollBottom();
    },
    onError: (err: Error) => {
      canSend.value = true;
      pushNoticeMsg("WebSocket连接异常，请重试");
      ws = null;
    },
    onClose: (e) => {
      canSend.value = true;
      wsInitialized = false;
      pendingMessage = null;
      if (e.code === 500) {
        pushNoticeMsg(e.reason ?? "WebSocket连接关闭");
        antMessage.error(e.reason ?? "WebSocket连接关闭");
      }
      ws = null;
    },
  });
}

// 处理 WebSocket 消息
function handleWsMessage(msgData: { type: string; data: any }) {
  // 只有 AI 响应相关的消息才移除 thinking 消息
  const responseTypes = ["stream", "response", "response_end", "subAgentStream", "subAgentEnd"];
  if (responseTypes.includes(msgData.type)) {
    removeThinkingMessage();
  }

  const messageHandlers: Record<string, (data: any) => void> = {
    // 初始化完成
    init: () => {
      console.log("WebSocket 初始化完成");
      wsInitialized = true;
      // 如果有待发送的消息，现在发送
      if (pendingMessage) {
        console.log("发送待处理的消息:", pendingMessage);
        ws?.send(pendingMessage);
        pendingMessage = null;
      }
    },

    // 主 Agent 流式传输
    stream: (data) => handleStreamData(data.data),

    // 主 Agent 响应结束（不再推送额外消息，流式消息已包含完整内容）
    response_end: () => {
      endCurrentStream();
      canSend.value = true;
    },

    // 响应（不再推送额外消息）
    response: () => {
      endCurrentStream();
      canSend.value = true;
    },

    // Sub-Agent 流式传输
    subAgentStream: (data) => handleSubAgentStream(data.data),

    // Sub-Agent 结束
    subAgentEnd: (data) => handleSubAgentEnd(data.data),

    // Agent 切换
    transfer: (data) => {
      const toAgent = data.data?.to;
      // 结束当前流式消息
      endCurrentStream();
      if (toAgent && aiMsgIdentity[toAgent]) {
        pushNoticeMsg(`${aiMsgIdentity[toAgent]} 正在思考`);
      }
    },

    // Tool 调用
    toolCall: (data) => handleToolCall(data.data),

    // 刷新数据
    refresh: (data) => {
      console.log("Refresh:", data.data);
    },

    // 片段数据更新
    segmentsUpdated: (data) => {
      console.log("Segments Updated:", data.data);
      // 可以在这里处理片段数据，用于后续扩展
    },

    // 分镜数据更新 - 同步到 gridData
    shotsUpdated: (data) => {
      console.log("Shots Updated:", data.data);
      updateGridDataFromShots(data.data);
    },

    // 分镜图生成开始
    shotImageGenerateStart: (data) => {
      console.log("Shot Image Generate Start:", data.data);
      const shotIds = data.data?.shotIds || [];
      for (const shotId of shotIds) {
        if (!generatingIds.value.includes(shotId)) {
          generatingIds.value.push(shotId);
        }
      }
      const titles = shotIds
        .map((id: number | undefined) => {
          const grid = gridData.value.find((g) => g.id === id);
          return grid?.title || `分镜 ${id}`;
        })
        .join("、");
      pushNoticeMsg(`🎨 开始为${titles}生成分镜图...`);
    },

    // 分镜图生成进度
    shotImageGenerateProgress: (data) => {
      console.log("Shot Image Generate Progress:", data.data);
      const { shotId, status, message, progress } = data.data || {};
      if (shotId !== undefined) {
        // 确保该分镜在生成中状态
        if (!generatingIds.value.includes(shotId)) {
          generatingIds.value.push(shotId);
        }

        // 更新 gridData 中对应分镜的生成状态信息（通过 id 匹配）
        const gridItem = gridData.value.find((g) => (g as any).id === shotId);
        if (gridItem) {
          (gridItem as any).generatingStatus = { status, message, progress };
        }

        // 根据状态显示不同的提示（仅在状态变化时显示，避免过多通知）
        if (status !== "saving" || progress === 100) {
          const statusIcon: Record<string, string> = {
            generating: "🎨",
            splitting: "✂️",
            saving: "💾",
          };
          const icon = statusIcon[status] || "⏳";
          const title = gridItem?.title || `分镜 ${shotId}`;
          pushNoticeMsg(`${icon} ${title}: ${message || status}`);
        }
      }
    },

    // 分镜图生成完成
    shotImageGenerateComplete: (data) => {
      console.log("Shot Image Generate Complete:", data.data);
      const shotId = data.data?.shotId;
      if (shotId !== undefined) {
        generatingIds.value = generatingIds.value.filter((id) => id !== shotId);
        const grid = gridData.value.find((g) => g.id === shotId);
        const title = grid?.title || `分镜 ${shotId}`;
        pushNoticeMsg(`✅ ${title}分镜图生成完成`);
      }
    },

    // 分镜图生成错误
    shotImageGenerateError: (data) => {
      console.log("Shot Image Generate Error:", data.data);
      const shotIds = data.data?.shotIds || (data.data?.shotId ? [data.data.shotId] : []);
      generatingIds.value = generatingIds.value.filter((id) => !shotIds.includes(id));
      const errorMsg = data.data?.error || "未知错误";
      pushNoticeMsg(`❌ 分镜图生成失败: ${errorMsg}`);
      antMessage.error(`分镜图生成失败: ${errorMsg}`);
    },

    // 错误
    error: (data) => {
      endCurrentStream();
      canSend.value = true;
      pushNoticeMsg(`错误: ${data.data}`);
      antMessage.error(data.data);
    },

    // 通知
    notice: (data) => pushNoticeMsg(data.data),
  };

  const handler = messageHandlers[msgData.type];
  if (handler) {
    handler(msgData);
  } else {
    console.warn("未知的消息类型:", msgData.type, msgData);
  }
}

// 处理主 Agent 流式数据
function handleStreamData(text: string) {
  if (!text) return;
  getOrCreateStreamMessage("main", "助手");
  appendToStream(text);
}

// 处理 Sub-Agent 流式数据
function handleSubAgentStream(data: { agent: string; text: string }) {
  if (!data?.text) return;
  const role = aiMsgIdentity[data.agent] || "助手";
  getOrCreateStreamMessage(data.agent, role);
  appendToStream(data.text);
}

// 处理 Sub-Agent 结束
function handleSubAgentEnd(data: { agent: string; content?: string }) {
  // 结束当前流式消息（流式消息已包含完整内容，不再推送额外消息）
  endCurrentStream();
}

// 处理 Tool 调用
function handleToolCall(data: { agent?: string; name: string; args?: any }) {
  // Tool 调用前结束当前流式消息
  endCurrentStream();

  const agentName = data.agent ? aiMsgIdentity[data.agent] || data.agent : "助手";
  const toolName = TOOL_NAME_MAP[data.name] || data.name;

  // 构建参数描述
  let argsDesc = "";
  if (data.args) {
    if (data.args.taskDescription) {
      // 调用 sub-agent 时只显示简短描述
      argsDesc = data.args.taskDescription.length > 50 ? data.args.taskDescription.substring(0, 50) + "..." : data.args.taskDescription;
    }
  }

  const message = argsDesc ? `🔧 ${agentName}正在${toolName}：${argsDesc}` : `🔧 ${agentName}正在${toolName}`;
  pushNoticeMsg(message);
}

// 推送通知消息
function pushNoticeMsg(text: string) {
  history.value.push({
    id: uuidv4(),
    identity: "notice",
    data: text,
  });
}

// 推送思考中消息
function pushThinkingMsg() {
  history.value.push({
    id: uuidv4(),
    identity: "assistant",
    role: "",
    data: [{ type: "thinking", text: "生成中..." }],
  });
}

// 发送消息 API
async function sendApi(message: string) {
  if (!message.trim()) {
    antMessage.warning("请输入内容");
    return;
  }

  // 设置页面离开提示
  if (!flagQuit) {
    window.onbeforeunload = function (e) {
      e.preventDefault();
      e.returnValue = "当前任务未完成，退出内容不会保留";
      return "当前任务未完成，退出内容不会保留";
    };
  }
  flagQuit = true;

  canSend.value = false;

  // 添加用户消息到历史
  history.value.push({
    id: uuidv4(),
    identity: "user",
    data: [{ type: "text", text: message }],
  });

  // 发送消息
  const msgPayload = {
    type: "msg",
    data: { type: "user", data: message },
  };

  if (!ws || ws.ws?.readyState !== WebSocket.OPEN) {
    // WebSocket 未连接，先初始化，消息存入待发送队列等待 init 完成后发送
    pendingMessage = msgPayload;
    wsInitialized = false;
    initWsClient();
  } else if (!wsInitialized) {
    // WebSocket 已连接但未初始化完成，消息存入待发送队列
    pendingMessage = msgPayload;
  } else {
    // WebSocket 已连接且已初始化，直接发送
    ws.send(msgPayload);
  }

  pushThinkingMsg();
}

// 清空历史记录
function cleanHistory() {
  if (ws && ws.ws?.readyState === WebSocket.OPEN) {
    ws.send({ type: "cleanHistory", data: null });
  }
  // 重置历史消息
  history.value = [
    {
      id: uuidv4(),
      identity: "assistant",
      role: "助手",
      data: [
        {
          type: "textWithConfirm",
          text: "欢迎使用Cosmos！我已经收到你的剧本与相关资产,请和我说“开始”启动生成分镜图的制作吧！",
          button: [{ text: "开始制作", type: "primary" }],
          confirm: undefined,
        },
      ],
    },
  ];
}

// 关闭弹窗
function cancelModal() {
  if (flagQuit) {
    Modal.confirm({
      title: "确认退出",
      content: "当前任务未完成，退出内容不会保留，确定退出吗？",
      onOk() {
        closeAndCleanup();
      },
    });
  } else {
    closeAndCleanup();
  }
}

// 关闭并清理资源
function closeAndCleanup() {
  modalShow.value = false;
  if (ws) {
    ws.close();
    ws = null;
  }
  window.onbeforeunload = null;
}

// 组件卸载时清理资源
onBeforeUnmount(() => {
  if (ws) {
    ws.close();
    ws = null;
  }
  window.onbeforeunload = null;
});

const gridData = ref<GridItem[]>([
  // {
  //   id: 1,
  //   segmentId: 1,
  //   title: "分镜 1",
  //   x: 50,
  //   y: 50,
  //   cells: [
  //     {
  //       id: "81f760d7-3e9d-4f23-b6ed-fe4eb3bead77",
  //       prompt:
  //         "大远景，平视，三分法构图，山村小路延伸至画面纵深，碎石小路蜿蜒，两旁青草野花摇曳，王林（铁柱）位于画面中远景，独自坐于路边，背对镜头，午后斜阳洒落地面，微风拂动草丛，深景深，整体暖调，画面宁静悠远，氛围平静向往",
  //       src: "http://127.0.0.1:60000/1/scene/f5a89f03-8521-4fdc-b467-b993264ad603.jpg",
  //     },
  //     {
  //       id: "d1369c02-e94f-4e56-922c-fef24941f514",
  //       prompt:
  //         "中景，平视，中心构图，王林（铁柱）坐姿，线装古书半扬，单手搭在书页上，神情专注思索，眉目若有所思，目光微垂，粗布长衫整洁，午后柔光顺射面庞，背景为虚化山村小路，浅景深，主色调柔黄，气氛平静沉静",
  //       src: "http://127.0.0.1:60000/1/chat/1/storyboard/shot_1_take_1_1769415403072.png",
  //     },
  //     {
  //       id: "3d0e78d2-8b9d-4b47-9062-c88b40b00727",
  //       prompt:
  //         "近景，平视，三分法构图，王林（铁柱）左侧仰头看远方，眉眼间带坚毅与憧憬，呼吸微微起伏，粗布长衫衣角随风轻摆，光线侧逆光勾勒轮廓，背景远山虚化，浅景深，主色金绿，气氛青春向往",
  //       src: "http://127.0.0.1:60000/1/chat/1/storyboard/shot_1_take_2_1769415403072.png",
  //     },
  //     {
  //       id: "6d84379f-0df2-4081-a78a-089b81393ca1",
  //       prompt:
  //         "远景，微仰拍，王林（铁柱）合上线装古书，起身拍掉尘土，背影渐行，脚步坚定，阳光斜照拉出长影，小路延展至村口方向，青草随风晃动，顺光，低对比，画面主调温暖，气氛希望与启程",
  //       src: "http://127.0.0.1:60000/1/chat/1/storyboard/shot_1_take_3_1769415403072.png",
  //     },
  //   ],
  // },
  // {
  //   id: 2,
  //   segmentId: 2,
  //   title: "分镜 2",
  //   x: 900,
  //   y: 50,
  //   cells: [
  //     {
  //       id: "1d2ada99-1853-4f9a-85f1-7c29ae57ffde",
  //       prompt:
  //         "全景，俯拍，中心构图，王林家院落居画面中心，灰色砖屋、青石桌椅一览无余，院落明亮安静，王天水（父亲）身穿灰色棉布衣，坐于桌旁，手持旧烟袋，王林母亲与王林（铁柱）两侧围坐，院墙挂着木工工具，院内梅花盛放，下午阳光洒落，深景深，色调暖黄，家庭温馨",
  //       src: "http://127.0.0.1:60000/1/chat/1/storyboard/shot_2_take_0_1769415417901.png",
  //     },
  //     {
  //       id: "3ddb2f08-18a7-4e1a-89dd-60bca67c2a68",
  //       prompt:
  //         "近景，侧拍，三分法构图，王林母亲蓝底碎花布衣低髻，温柔地剥烤甘薯递到王林（铁柱）碗中，左手持甘薯，右手推碗，动作细致体贴，神情带笑，王林专注看碗，光线柔暖侧射，背景桌面饭菜，浅景深，主色橙黄蓝灰，氛围温馨",
  //       src: "http://127.0.0.1:60000/1/chat/1/storyboard/shot_2_take_1_1769415417901.png",
  //     },
  //     {
  //       id: "4b10f878-2b1e-4c7d-9f07-aad2374b8549",
  //       prompt:
  //         "中景，平视，三分法构图，王天水（父亲）笑容宽厚，目光望向王林（铁柱），一手递饭碗，一手指点旧烟袋，语重心长地叮嘱，王林双手捧饭碗，低头点头，王林母亲莞尔注视，三人围坐桌旁，光线顺光，环境安逸，浅景深，暖灰调，氛围家庭温情和鼓励",
  //       src: "http://127.0.0.1:60000/1/chat/1/storyboard/shot_2_take_2_1769415417901.png",
  //     },
  //     {
  //       id: "2a2ed0fb-50be-4ca7-9f09-fd0b0770b009",
  //       prompt:
  //         "全景，平视，对角线构图，一家三口围坐青石桌旁，院墙干柴、梅树、木工工具相伴，王天水（父亲）举筷言谈，王林（铁柱）认真应答，王林母亲含笑剥甘薯，暖阳洒落全院，深景深，色调金黄，画面温馨安详",
  //       src: "http://127.0.0.1:60000/1/chat/1/storyboard/shot_2_take_3_1769415417901.png",
  //     },
  //   ],
  // },
]);

// gridData.value = [];
// 正在生成图片的分镜ID集合（存储 Shot.id）
const generatingIds = ref<number[]>([]);

// GridItem 类型定义（与后端 Shot 一致）
interface GridItem {
  id?: number; // 分镜独立ID（来自后端 Shot.id）
  segmentId: number; // 所属片段ID
  title: string;
  x: number;
  y: number;
  cells: Array<{ src?: string; prompt?: string; id?: string }>;
  fragmentContent: string;
  assetsTags: AssetsType[];
}
interface AssetsType {
  type: "role" | "props" | "scene";
  text: string;
}
// 根据后端推送的 shots 数据更新 gridData
function updateGridDataFromShots(shots: GridItem[]) {
  if (!shots || !Array.isArray(shots)) return;

  // 后端已经是 Shot 格式，直接计算位置后使用
  const newGridData: GridItem[] = shots.map((item, index) => {
    // 如果后端已有位置信息且不为0，使用后端的位置
    if (item.x !== 0 || item.y !== 0) {
      return {
        ...item,
        id: (item as any).id, // 保留 Shot.id
        segmentId: item.segmentId,
      } as any;
    }

    // 否则自动计算位置，每行放置3个，间距450/500
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = 50 + col * 850;
    const y = 50 + row * 450;

    return {
      id: (item as any).id, // 保留 Shot.id
      segmentId: item.segmentId,
      title: item.title || `分镜 ${item.segmentId}`,
      x,
      y,
      cells: item.cells || [],
      fragmentContent: item.fragmentContent || "",
      assetsTags: item.assetsTags || [],
    };
  });

  gridData.value = newGridData;
  console.log("%c Line:543 🥥 newGridData", "background:#6ec1c2", newGridData);
  console.log("GridData 已更新:", gridData.value);
}

function handleGenerateImage(grid: GridItem) {
  axios.post("/storyboard/generateShotImage", { ...grid, scriptId: props.scriptId, projectId: props.projectId }).then(() => {
    console.log("%c Line:516 🍑 修改成功", "background:#b03734");
  });
}

//导出全部镜头
async function exportAll() {
  if (!detectionImageRef.value) return;
  if (imageNumber.value == 0) {
    antMessage.warning("请先生成分镜图片");
    return;
  }
  const allCells = gridData.value
    .map((item) => {
      const cell = item.cells.filter((cell) => cell.src && cell.src.trim() !== "");
      if (!cell.length) return null;
      return {
        segmentId: item.segmentId,
        cells: cell,
      };
    })
    .filter(Boolean);
  if (!allCells.length) return message.warning("请先生成图片");
  try {
    // 构建带有正确 segmentId 和 shotIndex 的数据
    const imageDataList: any[] = [];
    allCells.forEach((segment) => {
      segment?.cells.forEach((cell, cellIndex) => {
        imageDataList.push({
          id: cell?.id || "",
          segmentId: segment?.segmentId || 0,
          shotIndex: cellIndex + 1, // 镜头在片段内的序号，从1开始
          videoPrompt: "",
          prompt: cell?.prompt || "",
          duration: "",
          projectId: props.projectId!,
          filePath: cell?.src || "",
          type: "分镜",
          name: "",
          scriptId: props.scriptId!,
          src: cell?.src || "",
        });
      });
    });
    // 先填充一份占位数据，便于 detectionImage 展示
    imageData.value = imageDataList;
    modalShow.value = true;
    detectionImageShow.value = true;
  } catch (e) {
    console.error(e);
    antMessage.error("生成或保存失败");
  } finally {
  }
}

function test() {
  handleWsMessage({
    type: "shotImageGenerateStart",
    data: {
      shotIds: [1],
    },
  });

  // 模拟生成进度
  setTimeout(() => {
    handleWsMessage({
      type: "shotImageGenerateProgress",
      data: {
        shotId: 1,
        status: "generating",
        message: "正在调用 AI 生成宫格图片",
        progress: 30,
      },
    });
  }, 500);

  setTimeout(() => {
    handleWsMessage({
      type: "shotImageGenerateProgress",
      data: {
        shotId: 1,
        status: "splitting",
        message: "正在切分图片",
        progress: 60,
      },
    });
  }, 1500);

  setTimeout(() => {
    handleWsMessage({
      type: "shotImageGenerateProgress",
      data: {
        shotId: 1,
        status: "saving",
        message: "正在保存图片",
        progress: 90,
      },
    });
  }, 2500);

  setTimeout(() => {
    handleWsMessage({
      type: "shotImageGenerateComplete",
      data: {
        shotId: 1,
      },
    });
  }, 3500);
}
</script>
<style lang="scss" scoped>
.content {
  height: 88vh;
  overflow: hidden;
  width: 100%;
  .chatBox {
    width: 25vw;
    height: 93%;
    top: 10px;
    right: 10px;
    bottom: 10px;
    .btn {
      margin-top: 10px;
    }
  }
  // .hoverState {
  //   transform: translateX(300px);
  //   transition: all 0.1s ease-in-out;
  //   &:hover {
  //     transform: translateX(0);
  //   }
  // }
}
.titHeader {
  .closePoint {
    cursor: pointer;
    margin-right: 24px;
  }
}
</style>
