<template>
  <div class="poetry-videomusic">
    <!-- Music Section -->
    <div class="music-section">
      <div class="section-header">
        <h3>🎵 背景音乐 (Suno)</h3>
      </div>
      
      <div class="music-form">
        <a-tabs v-model:activeKey="musicForm.mode" size="small">
          <a-tab-pane key="inspiration" tab="灵感模式">
            <a-textarea 
              v-model:value="musicForm.gpt_description_prompt" 
              placeholder="描述你想要的歌曲，如：一首动听的古风抒情歌曲" 
              :rows="3" 
            />
            <div style="margin-top: 10px;">
              <a-checkbox v-model:checked="musicForm.make_instrumental">生成纯音乐 (无歌词)</a-checkbox>
            </div>
          </a-tab-pane>
          
          <a-tab-pane key="custom" tab="自定义模式">
            <a-space direction="vertical" style="width: 100%;">
              <a-input v-model:value="musicForm.title" placeholder="歌曲标题 (必填)" />
              <a-input v-model:value="musicForm.tags" placeholder="风格标签 (例如：pop, chinese traditional)" />
              <a-textarea 
                v-model:value="musicForm.prompt" 
                placeholder="在此输入完整的歌词..." 
                :rows="4" 
              />
            </a-space>
          </a-tab-pane>
        </a-tabs>

        <div class="music-controls" style="margin-top: 15px; display: flex; gap: 10px; align-items: center;">
          <a-select v-model:value="musicForm.mv" style="width: 120px" size="small">
            <a-select-option value="chirp-v3-5">Model v3.5</a-select-option>
            <a-select-option value="chirp-v3-0">Model v3.0</a-select-option>
          </a-select>
          <a-button type="primary" @click="generateMusic('new')" :loading="musicGenerating" size="small">
            {{ musicGenerating ? '生成中...' : '生成歌曲' }}
          </a-button>
        </div>
      </div>

      <a-divider style="margin: 12px 0;" />

      <div v-if="musicUrl" class="audio-player">
        <div style="display: flex; gap: 10px; align-items: center; margin-bottom: 8px;">
          <a-tag color="blue">当前音乐</a-tag>
          <a-button size="small" @click="showExtendModal = true" v-if="musicTaskId">续写 (Extend)</a-button>
        </div>
        <audio :src="musicUrl" controls style="width:100%"></audio>
      </div>
      <div v-else class="empty-music">
        <span v-if="musicGenerating"><a-spin size="small" /> 音乐任务已提交，约需2-5分钟...</span>
        <span v-else>暂无配乐，调整上方参数后点击生成</span>
      </div>

      <!-- 续写弹窗 -->
      <a-modal v-model:open="showExtendModal" title="续写歌曲" @ok="generateMusic('extend')" :confirmLoading="musicGenerating">
        <a-form layout="vertical">
          <a-form-item label="续写时间点 (秒)">
            <a-input-number v-model:value="extendForm.continue_at" style="width: 100%" placeholder="例如: 120" />
          </a-form-item>
          <a-form-item label="续写部分的歌词">
            <a-textarea v-model:value="extendForm.prompt" :rows="4" placeholder="[Verse]\n..." />
          </a-form-item>
          <a-form-item label="标题">
            <a-input v-model:value="extendForm.title" />
          </a-form-item>
          <a-form-item label="风格">
            <a-input v-model:value="extendForm.tags" />
          </a-form-item>
        </a-form>
      </a-modal>
    </div>

    <!-- Video Section -->
    <div class="video-section">
      <div class="section-header">
        <h3>🎬 分镜视频</h3>
        <div class="video-actions">
          <a-select v-model:value="videoModelId" placeholder="选择视频模型" style="width: 180px; margin-right: 10px;" size="small">
            <a-select-option v-for="m in videoModels" :key="m.id" :value="m.id">
              {{ m.label }}
            </a-select-option>
          </a-select>
          <a-button type="primary" @click="generateAllVideos" :loading="videoGenerating" size="small">
            一键生成全部视频
          </a-button>
          <a-button @click="exportFinalVideo" :disabled="!canExport" size="small" type="primary" ghost>
            📥 导出/剪映
          </a-button>
        </div>
      </div>

      <div class="video-grid">
        <div class="video-card" v-for="(item, index) in localPrompts" :key="item.id">
          <div class="video-header">
            <span class="index-badge">{{ index + 1 }}</span>
            <span class="text">{{ item.sentence }}</span>
          </div>
          <div class="video-container">
            <template v-if="item.video_path">
              <video :src="item.video_path" controls muted loop></video>
            </template>
            <template v-else-if="item.image_path">
              <div class="placeholder-img" :style="{ backgroundImage: `url(${item.image_path})` }">
                <div class="overlay">
                  <a-spin v-if="item.videoGenerating" />
                  <span v-if="item.videoGenerating">视频生成中...</span>
                  <a-button v-else size="small" type="primary" ghost @click="generateSingleVideo(item)">
                    生成视频
                  </a-button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="overlay">
                <span>请先生成图片</span>
              </div>
            </template>
          </div>
          <div class="video-prompt" style="padding: 8px;">
            <a-textarea 
              v-model:value="item.video_prompt" 
              placeholder="视频提示词（支持英文运镜描述）" 
              :rows="2" 
              style="font-size: 12px;"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from "vue";
import { message } from "ant-design-vue";
import axios from "@/utils/axios";

const props = defineProps<{
  sessionId: number | null;
  prompts: any[];
  musicPrompt?: any;
}>();

const localPrompts = ref<any[]>([]);
const pollTasks = ref<Record<number, ReturnType<typeof setInterval>>>({});

const videoModels = ref<any[]>([]);
const videoModelId = ref<number | null>(null);

onMounted(async () => {
  try {
    const res = await axios.get("/poetry/models");
    if (res.code === 200 && res.data?.videoModels) {
      videoModels.value = res.data.videoModels;
      if (videoModels.value.length > 0) {
        videoModelId.value = videoModels.value[0].id;
      }
    }
  } catch (err) {}
});

const startVideoPolling = (item: any, videoId: number) => {
  if (pollTasks.value[videoId]) return;
  item.videoGenerating = true;

  pollTasks.value[videoId] = setInterval(async () => {
    try {
      const res = await axios.get(`/poetry/videoStatus/${videoId}`);
      if (res.code === 200 && res.data) {
        if (res.data.status === 'success') {
          clearInterval(pollTasks.value[videoId]);
          delete pollTasks.value[videoId];
          item.video_path = res.data.video_url;
          item.videoGenerating = false;
          message.success(`分镜视频生成成功`);
        } else if (res.data.status === 'failed') {
          clearInterval(pollTasks.value[videoId]);
          delete pollTasks.value[videoId];
          item.videoGenerating = false;
          message.error(`分镜视频生成失败`);
        }
      }
    } catch (err) {
      console.warn("Polling error:", err);
    }
  }, 3000);
};

watch(
  () => props.prompts,
  (val) => {
    localPrompts.value = JSON.parse(JSON.stringify(val));
    localPrompts.value.forEach((p) => {
      // If there is an ongoing task without a final video, resume polling
      if (!p.video_path && p.video_task_id) {
        p.videoGenerating = true;
        startVideoPolling(p, p.video_task_id);
      } else {
        p.videoGenerating = false;
      }
    });
  },
  { immediate: true, deep: true }
);

const musicGenerating = ref(false);
const videoGenerating = ref(false);
const musicUrl = ref("");
const musicTaskId = ref("");

// Music Advanced Forms
const musicForm = ref({
  mode: 'inspiration',
  gpt_description_prompt: '',
  make_instrumental: true,
  mv: 'chirp-v3-5',
  prompt: '',
  title: '',
  tags: ''
});

const showExtendModal = ref(false);
const extendForm = ref({
  continue_at: 0,
  prompt: '',
  title: '延伸部分',
  tags: ''
});

watch(() => props.musicPrompt, (val) => {
  if (val && !musicForm.value.gpt_description_prompt) {
    musicForm.value.gpt_description_prompt = val.style_prompt || "中国风传统古典纯音乐 优美 治愈 抒情";
    musicForm.value.tags = val.style_prompt || "";
    musicForm.value.title = val.title || "";
    // 如果 LLM 返回了详细的歌词，自动切换到自定义模式
    if (val.lyrics) {
      musicForm.value.mode = 'custom';
      musicForm.value.prompt = val.lyrics;
      musicForm.value.make_instrumental = false;
    }
  }
}, { immediate: true });

const canExport = computed(() => {
  return localPrompts.value.every((p) => p.video_path) && !!musicUrl.value;
});

// === Music ===
let musicPollTask: ReturnType<typeof setInterval> | null = null;
const startMusicPolling = (musicId: number) => {
  if (musicPollTask) return;
  
  musicPollTask = setInterval(async () => {
    try {
      const res = await axios.get(`/poetry/musicStatus/${musicId}`);
      if (res.code === 200 && res.data) {
        if (res.data.status === 'success' || res.data.status === 'SUCCESS') {
          clearInterval(musicPollTask!);
          musicPollTask = null;
          // 使用代理解决外部音频 URL 的 CORS 问题
          const audioUrl = res.data.audio_url;
          if (audioUrl) {
            // 如果是本地 OSS URL 或 data URL，直接使用；否则通过代理
            if (audioUrl.startsWith('http://127.0.0.1') || audioUrl.startsWith('http://localhost') || audioUrl.startsWith('data:')) {
              musicUrl.value = audioUrl;
            } else {
              musicUrl.value = `/poetry/audioProxy?url=${encodeURIComponent(audioUrl)}`;
            }
          }
          if (res.data.task_id) {
            musicTaskId.value = res.data.task_id;
          }
          musicGenerating.value = false;
          message.success("音乐生成成功！");
        } else if (res.data.status === 'failed' || res.data.status === 'FAILED' || res.data.status === 'error') {
          clearInterval(musicPollTask!);
          musicPollTask = null;
          musicGenerating.value = false;
          message.error("音乐生成失败");
        }
      }
    } catch (err) {
      console.warn("Music polling error:", err);
    }
  }, 5000);
};

const generateMusic = async (action: 'new' | 'extend') => {
  if (!props.sessionId) return;
  
  let submitParams: any = {};
  if (action === 'extend') {
    if (!musicTaskId.value) {
      message.error("缺少原始歌曲的 Task ID，无法续写");
      return;
    }
    submitParams = {
      mode: 'extend',
      continue_at: extendForm.value.continue_at,
      continue_clip_id: musicTaskId.value,
      prompt: extendForm.value.prompt,
      title: extendForm.value.title,
      tags: extendForm.value.tags,
      mv: musicForm.value.mv
    };
    showExtendModal.value = false;
  } else {
    // new generate
    if (musicForm.value.mode === 'custom' && !musicForm.value.title) {
      message.error("自定义模式下必须输入歌曲标题");
      return;
    }
    submitParams = { ...musicForm.value };
  }

  musicGenerating.value = true;
  message.info("正在提交任务...");
  
  try {
    const res = await axios.post("/poetry/generateMusic", {
      sessionId: props.sessionId,
      musicParams: submitParams,
    });
    
    if (res.code === 200 && res.data?.musicId) {
      message.success("任务已提交，开始轮询进度...");
      startMusicPolling(res.data.musicId);
    } else {
      musicGenerating.value = false;
    }
  } catch (err: any) {
    message.error(err.response?.data?.message || "任务提交失败");
    musicGenerating.value = false;
  }
};

// ---- 视频生成 ----
const generateSingleVideo = async (item: any) => {
  if (!item.image_path) {
    message.warning("请先生成分镜图片");
    return;
  }
  try {
    const res = await axios.post("/poetry/generateVideo", {
      promptId: item.id,
      duration: 5,
      videoPrompt: item.video_prompt,
      videoModelId: videoModelId.value
    });
    if (res.code === 200) {
      message.success("视频生成任务已提交");
      item.video_task_id = res.data.videoId;
      startVideoPolling(item, res.data.videoId);
    }
  } catch (err: any) {
    message.error(err.response?.data?.message || err.message || "视频生成任务提交失败");
  }
};

const generateAllVideos = async () => {
  videoGenerating.value = true;
  message.info("开始排队生成分镜视频...");

  for (const item of localPrompts.value) {
    if (item.video_path) continue;
    if (!item.image_path) continue;
    await generateSingleVideo(item);
  }
  videoGenerating.value = false;
  message.success("全部视频任务提交完成！");
};

const exportFinalVideo = () => {
  message.success("后期功能即将上线：一键调起 JianYing / CapCut 进行合成！");
};

// 组件卸载时清理所有轮询任务，防止内存泄漏
onUnmounted(() => {
  // 清理视频轮询任务
  Object.keys(pollTasks.value).forEach((key) => {
    const videoId = Number(key);
    if (pollTasks.value[videoId]) {
      clearInterval(pollTasks.value[videoId]);
      delete pollTasks.value[videoId];
    }
  });

  // 清理音乐轮询任务
  if (musicPollTask) {
    clearInterval(musicPollTask);
    musicPollTask = null;
  }
});

defineExpose({
  async autoStart() {
    // start generating music asynchronously
    generateMusic('new');
    // wait for video generation queue to finish
    await generateAllVideos();
  }
});
</script>

<style lang="scss" scoped>
.poetry-videomusic {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;

    h3 {
      margin: 0;
      font-size: 1rem;
      color: var(--td-text-color-primary);
    }

    .music-actions,
    .video-actions {
      display: flex;
      gap: 0.5rem;
    }
  }

  .music-section {
    background: var(--td-bg-color-secondarycontainer);
    padding: 1.25rem;
    border-radius: 12px;

    .music-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 0.75rem;

      .music-style {
        font-size: 12px;
        color: var(--td-text-color-secondary);
      }
    }

    .empty-music {
      color: var(--td-text-color-placeholder);
      font-size: 13px;
    }
  }

  .video-section {
    flex: 1;
    display: flex;
    flex-direction: column;

    .video-grid {
      flex: 1;
      overflow-y: auto;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1rem;
      align-content: start;
    }

    .video-card {
      background: var(--td-bg-color-container);
      border: 1px solid var(--td-border-level-1-color);
      border-radius: 8px;
      overflow: hidden;

      .video-header {
        padding: 0.5rem 0.75rem;
        background: var(--td-bg-color-secondarycontainer);
        border-bottom: 1px solid var(--td-border-level-1-color);
        display: flex;
        gap: 0.5rem;
        align-items: center;

        .index-badge {
          background: var(--td-brand-color);
          color: #fff;
          width: 22px;
          height: 22px;
          border-radius: 50%;
          display: inline-flex;
          justify-content: center;
          align-items: center;
          font-size: 0.7rem;
        }

        .text {
          font-family: "STKaiti", serif;
          font-size: 1rem;
        }
      }

      .video-container {
        aspect-ratio: 16 / 9;
        background: #000;
        position: relative;

        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .placeholder-img {
          width: 100%;
          height: 100%;
          background-size: cover;
          background-position: center;
          position: relative;
        }

        .overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #fff;
          gap: 0.5rem;
        }
      }
    }
  }
}
</style>
