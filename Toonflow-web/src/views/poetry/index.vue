<template>
  <div class="poetry-container">
    <div class="header">
      <div class="back-btn" @click="router.back()">
        <i-left :size="20" />
        返回
      </div>
      <h2 class="title">诗词漫游录</h2>
      <div class="step-nav">
        <a-button @click="exportToJianying" v-if="sessionId" type="primary" style="margin-right: 16px;" :loading="exportingJianying">✂️ 一键导出剪映</a-button>
        <a-button @click="openHistory" style="margin-right: 16px;">🕰️ 历史记录</a-button>
        <a-button
          v-for="(s, i) in steps"
          :key="i"
          :type="currentStep === i ? 'primary' : 'default'"
          size="small"
          @click="currentStep = i"
          :disabled="i > maxReachedStep"
        >
          {{ s }}
        </a-button>
      </div>
    </div>

    <div class="main-content">
      <!-- Step 0: Input -->
      <div v-if="currentStep === 0" class="step-content">
        <PoetryInput @parsed="onPoetryParsed" />
      </div>

      <!-- Step 1: Storyboard / Image Gallery -->
      <div v-if="currentStep === 1" class="step-content">
        <PoetryStoryboard
          ref="storyboardRef"
          :sessionId="sessionId"
          :prompts="prompts"
          :gridPrompt="gridPrompt"
          :musicPrompt="musicPrompt"
          :imageManufacturer="imageManufacturer"
          @next="nextStep"
        />
      </div>

      <!-- Step 2: Video & Music -->
      <div v-if="currentStep === 2" class="step-content">
        <PoetryVideoMusic 
          ref="videoMusicRef"
          :sessionId="sessionId" 
          :prompts="prompts" 
          :musicPrompt="musicPrompt" 
        />
      </div>
    </div>

    <!-- History Drawer -->
    <a-drawer
      title="🕰️ 历史记录"
      placement="right"
      :open="historyVisible"
      @close="closeHistory"
      width="400"
    >
      <div v-if="loadingHistory" class="flex justify-center py-10">
        <a-spin />
      </div>
      <div v-else class="history-list">
        <template v-if="historyList.length">
          <div v-for="item in historyList" :key="item.id" class="history-item" @click="resumeSession(item.id)">
            <div class="history-item-header">
              <h4 class="history-title">{{ item.title || '未命名作品' }}</h4>
              <a-button type="text" danger size="small" @click.stop="deleteSession(item.id)">删除</a-button>
            </div>
            <p class="history-content">{{ item.poetry_content }}</p>
            <div class="history-time">
              {{ new Date(item.create_time).toLocaleString() }}
            </div>
          </div>
        </template>
        <div v-else class="text-center text-gray-400 py-10">
          暂无历史记录
        </div>
      </div>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import { message } from "ant-design-vue";
import axios from "@/utils/axios";
import PoetryInput from "./components/PoetryInput.vue";
import PoetryStoryboard from "./components/PoetryStoryboard.vue";
import PoetryVideoMusic from "./components/PoetryVideoMusic.vue";

const router = useRouter();
const route = useRoute();
const currentStep = ref(0);
const maxReachedStep = ref(0);

const storyboardRef = ref<any>(null);
const videoMusicRef = ref<any>(null);

const steps = ["输入诗词", "生成画面", "合成视频与音乐"];

// 数据流转状态
const sessionId = ref<number | null>(null);
const prompts = ref<any[]>([]);
const gridPrompt = ref<string | null>(null);
const musicPrompt = ref<any>(null);
const imageManufacturer = ref<string | undefined>(undefined);
const isMagicMode = ref(false);

function onPoetryParsed(data: any) {
  sessionId.value = data.sessionId;
  prompts.value = data.prompts;
  gridPrompt.value = data.gridPrompt || null;
  musicPrompt.value = data.musicPrompt || null;
  imageManufacturer.value = data.imageManufacturer || undefined;
  isMagicMode.value = !!data.isMagic;
  
  currentStep.value = 1;
  maxReachedStep.value = Math.max(maxReachedStep.value, 1);

  if (isMagicMode.value) {
    nextTick(() => {
      storyboardRef.value?.autoStart();
    });
  }
}

async function refreshPrompts() {
  if (!sessionId.value) return;
  try {
    const res = await axios.get(`/poetry/session/${sessionId.value}`);
    if (res.code === 200 && res.data?.prompts) {
      prompts.value = res.data.prompts;
    }
  } catch (e) {
    console.warn("刷新 prompts 失败:", e);
  }
}

async function nextStep() {
  if (currentStep.value < 2) {
    // 在进入下一步之前，重新从 DB 获取最新的 prompts（含 image_path）
    await refreshPrompts();
    currentStep.value++;
    maxReachedStep.value = Math.max(maxReachedStep.value, currentStep.value);
    
    if (isMagicMode.value && currentStep.value === 2) {
      nextTick(() => {
        videoMusicRef.value?.autoStart();
      });
    }
  }
}

// === 导出剪映 ===
const exportingJianying = ref(false);
async function exportToJianying() {
  if (!sessionId.value) return;
  exportingJianying.value = true;
  message.loading({ content: "正在导出并组装剪映草稿...", key: "exportJy", duration: 0 });
  try {
    const res = await axios.post("/poetry/exportJianying", { sessionId: sessionId.value });
    if (res.code === 200) {
      message.success({ content: "导出成功！已尝试唤起剪映", key: "exportJy", duration: 3 });
    } else {
      message.error({ content: res.message || "导出失败", key: "exportJy", duration: 3 });
    }
  } catch (err: any) {
    message.error({ content: "导出服务异常", key: "exportJy", duration: 3 });
  } finally {
    exportingJianying.value = false;
  }
}

// === History Sidebar ===
const historyVisible = ref(false);
const loadingHistory = ref(false);
const historyList = ref<any[]>([]);

function openHistory() {
  historyVisible.value = true;
  fetchHistory();
}

function closeHistory() {
  historyVisible.value = false;
}

async function fetchHistory() {
  loadingHistory.value = true;
  try {
    const res = await axios.get("/poetry/sessions");
    if (res.code === 200) historyList.value = res.data || [];
  } catch(e) { 
    message.error("获取记录失败"); 
  } finally {
    loadingHistory.value = false;
  }
}

async function deleteSession(id: number) {
  try {
    const res = await axios.delete(`/poetry/session/${id}`);
    if (res.code === 200) {
      message.success("删除成功");
      fetchHistory();
    }
  } catch(e) { message.error("删除失败"); }
}

async function resumeSession(id: number) {
  try {
    const res = await axios.get(`/poetry/session/${id}`);
    if (res.code === 200 && res.data) {
      onPoetryParsed(res.data);
      closeHistory();
      message.success("已恢复会话");
    }
  } catch(e) { message.error("恢复会话失败"); }
}
</script>

<style lang="scss" scoped>
.poetry-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem;

  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;

    .back-btn {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
      color: var(--td-text-color-secondary);
      &:hover { color: var(--td-brand-color); }
    }
    .title {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--td-text-color-primary);
    }
    .step-nav {
      display: flex;
      gap: 0.5rem;
      align-items: center;
    }
  }

  .main-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--td-bg-color-container);
    border-radius: 12px;
    padding: 1.5rem;
    box-shadow: var(--td-shadow-1);
    overflow: hidden;

    .step-content {
      flex: 1;
      overflow-y: auto;
    }
  }
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .history-item {
    border: 1px solid var(--td-component-border);
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    transition: all 0.2s;
    background: var(--td-bg-color-container);

    &:hover {
      box-shadow: var(--td-shadow-1);
      border-color: var(--td-brand-color);
    }

    .history-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;

      .history-title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }
    }

    .history-content {
      font-size: 13px;
      color: var(--td-text-color-secondary);
      margin: 0 0 8px 0;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }

    .history-time {
      font-size: 12px;
      color: var(--td-text-color-placeholder);
    }
  }
}
</style>
