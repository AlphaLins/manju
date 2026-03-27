<template>
  <!-- 通知消息 -->
  <div v-if="msg.identity === 'notice'" class="notice-message">
    <span class="notice-text">{{ msg.data }}</span>
  </div>

  <!-- 对话消息 -->
  <div v-else class="message-wrapper" :class="[msg.identity === 'user' ? 'user' : 'assistant']">
    <!-- AI 头像 -->
    <div class="avatar" v-if="msg.identity === 'assistant'">
      <a-avatar :size="36" class="ai-avatar">
        <template #icon>
          <span class="avatar-text">{{ msg.role?.[0] || "AI" }}</span>
        </template>
      </a-avatar>
    </div>

    <!-- 消息内容 -->
    <div class="message-content-wrapper">
      <!-- AI 消息 - 使用解析后的数据 -->
      <template v-if="msg.identity === 'assistant' && parsedData">
        <div v-for="item in parsedData" :key="item.index" class="message-bubble assistant-bubble">
          <!-- 文本消息（包含思考解析） -->
          <template v-if="item.type === 'text'">
            <!-- 思考过程折叠块 -->
            <div v-if="item.thinking" class="thinking-block">
              <div class="thinking-block-header" @click="toggleThinking(item.index)">
                <span class="thinking-icon">💭</span>
                <span class="thinking-title">思考过程</span>
                <span class="thinking-toggle" :class="{ collapsed: isCollapsed(item.index) }">
                  <DownOutlined />
                </span>
              </div>
              <Transition name="collapse">
                <div v-show="!isCollapsed(item.index)" class="thinking-block-content">
                  <div class="thinking-text">{{ item.thinking }}</div>
                </div>
              </Transition>
            </div>
            <!-- 正文内容 -->
            <span v-if="item.content" class="text-content">{{ item.content }}</span>
          </template>

          <!-- 图片消息 -->
          <a-image
            v-if="item.type === 'image_url' && item.image_url"
            class="image-content"
            :src="item.image_url.url"
            :preview-src="item.image_url.url" />

          <!-- 带确认的消息 -->
          <div v-if="item.type === 'textWithConfirm'" class="confirm-content">
            <p class="confirm-text">{{ item.text }}</p>

            <div class="confirm-actions" v-if="item.confirm === undefined">
              <a-button
                v-for="sub in item.button"
                :key="sub.text"
                @click="handleClick(sub, item as any)"
                size="small"
                :type="sub.type ?? 'default'"
                class="confirm-btn">
                {{ sub.text }}
              </a-button>
            </div>

            <div v-else class="confirm-result">
              <div class="result-icon" :class="item.confirm ? 'success' : 'error'">
                <i-check-one v-if="item.confirm" size="18" />
                <i-close-one v-else size="18" />
              </div>
              <span class="result-text">{{ item.confirm ? "已确认" : "已取消" }}</span>
            </div>
          </div>

          <!-- 思考中动画 -->
          <div v-if="item.type === 'thinking'" class="thinking-content">
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
            <span class="thinking-dot"></span>
          </div>
        </div>
      </template>

      <!-- 用户消息 -->
      <template v-else>
        <div v-for="(item, index) in msg.data" :key="index" class="message-bubble user-bubble">
          <span v-if="item.type === 'text'" class="text-content">{{ item.text }}</span>
          <a-image v-if="item.type === 'image_url'" class="image-content" :src="item.image_url.url" :preview-src="item.image_url.url" />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive } from "vue";
import { UserOutlined, DownOutlined } from "@ant-design/icons-vue";

const props = defineProps<{
  msg: ChatMessage;
  sendApi: (msg: string) => void;
}>();

// 思考块折叠状态
const thinkingCollapsed = reactive<Record<number, boolean>>({});

// 解析文本中的 <think>...</think> 标签
function parseThinkingContent(text: string): { thinking: string | null; content: string } {
  const thinkRegex = /<think>([\s\S]*?)<\/think>/;
  const match = text.match(thinkRegex);

  if (match) {
    const thinking = match[1].trim();
    const content = text.replace(thinkRegex, "").trim();
    return { thinking, content };
  }

  return { thinking: null, content: text };
}

// 解析后的消息项类型
interface ParsedMessageItem {
  type: string;
  index: number;
  thinking?: string | null;
  content?: string;
  text?: string;
  image_url?: { url: string };
  button?: { text: string; type?: "primary" | "ghost" | "dashed" | "link" | "text" | "default"; fn?: Function }[];
  confirm?: boolean;
}

// 处理后的消息数据
const parsedData = computed<ParsedMessageItem[] | null>(() => {
  if (props.msg.identity !== "assistant") return null;

  return props.msg.data.map((item, index): ParsedMessageItem => {
    if (item.type === "text") {
      const { thinking, content } = parseThinkingContent(item.text);
      return {
        type: item.type,
        text: item.text,
        thinking,
        content,
        index,
      };
    }
    return { ...item, index } as ParsedMessageItem;
  });
});

// 切换思考块折叠状态
function toggleThinking(index: number) {
  thinkingCollapsed[index] = !thinkingCollapsed[index];
}

// 获取折叠状态（默认折叠）
function isCollapsed(index: number): boolean {
  return thinkingCollapsed[index] !== false;
}

function handleClick(
  sub: {
    text: string;
    type?: "primary" | "ghost" | "dashed" | "link" | "text" | "default";
    fn?: Function;
  },
  item: AssistantMessageTextWithConfirm,
) {
  sub.fn ? sub.fn() : props.sendApi(sub.text);
  item.confirm = true;
}
</script>

<style lang="scss" scoped>
.notice-message {
  display: flex;
  justify-content: center;
  padding: 8px 0;

  .notice-text {
    padding: 6px 16px;
    background: rgba(0, 0, 0, 0.04);
    border-radius: 16px;
    font-size: 12px;
    color: #888;
  }
}

.message-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  max-width: 85%;

  &.user {
    flex-direction: row-reverse;
    margin-left: auto;
  }

  &.assistant {
    margin-right: auto;
  }
}

.avatar {
  flex-shrink: 0;

  .ai-avatar {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    .avatar-text {
      font-size: 14px;
      font-weight: 600;
    }
  }

  .user-avatar {
    background: var(--mainGradient);
  }
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.message-bubble {
  position: relative;
  padding: 12px 16px;
  border-radius: 18px;
  word-break: break-word;
  line-height: 1.6;
  font-size: 14px;

  &.assistant-bubble {
    background: #fff;
    color: #1a1a1a;
    border: 1px solid #eee;
    border-bottom-left-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }

  &.user-bubble {
    background: var(--mainGradient);
    color: #fff;
    border-bottom-right-radius: 6px;
    box-shadow: 0 2px 8px rgba(152, 16, 250, 0.25);
  }
}

.text-content {
  display: block;
  white-space: pre-wrap;
}

.image-content {
  max-width: 280px;
  border-radius: 12px;
  overflow: hidden;
}

.confirm-content {
  .confirm-text {
    margin: 0 0 12px;
  }

  .confirm-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;

    .confirm-btn {
      border-radius: 8px;
    }
  }

  .confirm-result {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;

    .result-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;

      &.success {
        background: rgba(82, 196, 26, 0.1);
        color: #52c41a;
      }

      &.error {
        background: rgba(255, 77, 79, 0.1);
        color: #ff4d4f;
      }
    }

    .result-text {
      font-size: 12px;
      color: #888;
    }
  }
}

.thinking-content {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 0;

  .thinking-dot {
    width: 8px;
    height: 8px;
    background: #bbb;
    border-radius: 50%;
    animation: bounce 1.4s infinite ease-in-out both;

    &:nth-child(1) {
      animation-delay: -0.32s;
    }

    &:nth-child(2) {
      animation-delay: -0.16s;
    }
  }
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: scale(0.6);
    opacity: 0.5;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}

// 折叠动画
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 400px;
}

// 思考过程折叠块样式
.thinking-block {
  background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
  border: 1px solid #e8ecf4;
  border-radius: 12px;
  overflow: hidden;

  .thinking-block-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover {
      background: rgba(102, 126, 234, 0.06);
    }

    .thinking-icon {
      font-size: 16px;
    }

    .thinking-title {
      flex: 1;
      font-size: 13px;
      font-weight: 500;
      color: #667eea;
    }

    .thinking-toggle {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      color: #667eea;
      transition: transform 0.3s ease;

      &.collapsed {
        transform: rotate(-90deg);
      }
    }
  }

  .thinking-block-content {
    border-top: 1px solid #e8ecf4;
    background: rgba(255, 255, 255, 0.6);

    .thinking-text {
      padding: 12px 14px;
      font-size: 13px;
      line-height: 1.8;
      color: #5a6078;
      white-space: pre-wrap;
      max-height: 300px;
      overflow-y: auto;

      // 自定义滚动条
      &::-webkit-scrollbar {
        width: 4px;
      }

      &::-webkit-scrollbar-track {
        background: transparent;
      }

      &::-webkit-scrollbar-thumb {
        background: #d0d5e0;
        border-radius: 2px;
      }
    }
  }
}
</style>
