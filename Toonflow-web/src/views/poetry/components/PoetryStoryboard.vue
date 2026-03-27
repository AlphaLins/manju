<template>
  <div class="poetry-storyboard">
    <!-- Grid View Section -->
    <div v-if="gridPrompt && !slicesExtracted" class="grid-view-section mb-4 p-4 border rounded">
      <div class="grid-header">
        <h3>🍱 九宫格整体预览</h3>
        <p class="grid-prompt-text text-gray-500 text-sm mb-4">{{ gridPrompt }}</p>
        <div class="grid-actions flex gap-2 mb-4">
          <a-button type="primary" @click="generateGridImage" :loading="generatingGrid">
            🎨 生成九宫格图
          </a-button>
          <a-button type="primary" ghost @click="extractGrid" :loading="extractingGrid" :disabled="!gridImageUrl">
            ✂️ 一键切片分发
          </a-button>
        </div>
      </div>
      <div class="grid-image-preview flex justify-center items-center bg-gray-50 min-h-[200px] border border-dashed rounded">
        <img v-if="gridImageUrl" :src="gridImageUrl" alt="Grid Image" class="max-w-full max-h-[600px] object-contain shadow-md" />
        <div v-else class="empty-grid-placeholder text-gray-400 flex flex-col items-center">
          <span>暂未生成九宫格图</span>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="toolbar">
      <div class="toolbar-left">
        <a-button type="primary" @click="generateAllImages" :loading="generatingAll">
          🎨 一键生成全部画面
        </a-button>
        <a-button @click="selectAll" :disabled="!localPrompts.length">☑️ 全选</a-button>
        <a-button @click="deselectAll" :disabled="!selectedIds.size">◻️ 取消全选</a-button>
        <a-button @click="regenerateSelected" :disabled="!selectedIds.size" :loading="regeneratingSelected">
          🔄 重新生成选中 ({{ selectedIds.size }})
        </a-button>
      </div>
      <div class="toolbar-right">
        <a-button @click="$emit('next')" :disabled="!allImagesGenerated" type="primary" ghost>
          进入下一步 →
        </a-button>
      </div>
    </div>

    <!-- Progress -->
    <div v-if="generatingAll || regeneratingSelected" class="progress-bar">
      <a-progress :percent="progressPercent" :status="progressPercent >= 100 ? 'success' : 'active'" />
    </div>

    <!-- Card List -->
    <div class="card-grid">
      <div
        class="story-card"
        v-for="(item, index) in localPrompts"
        :key="item.id"
        :class="{ selected: selectedIds.has(item.id) }"
      >
        <!-- Header -->
        <div class="card-header">
          <a-checkbox
            :checked="selectedIds.has(item.id)"
            @change="(e: any) => toggleSelect(item.id, e.target.checked)"
          />
          <span class="index-badge">{{ index + 1 }}</span>
          <span class="sentence">{{ item.sentence }}</span>
        </div>

        <!-- Image Area -->
        <div class="image-area" @click="openPreview(index)">
          <template v-if="item.image_path">
            <img :src="item.image_path" alt="preview" />
            <div class="hover-overlay">
              <span>🔍 点击放大</span>
            </div>
          </template>
          <template v-else-if="item.generating">
            <div class="state-overlay">
              <a-spin />
              <span>生成中...</span>
            </div>
          </template>
          <template v-else>
            <div class="state-overlay empty">
              <i-image :size="32" style="color:var(--td-text-color-placeholder)" />
              <span>等待生成</span>
            </div>
          </template>
        </div>

        <!-- Prompt Editor -->
        <div class="prompt-section">
          <a-textarea
            v-model:value="item.visual_prompt"
            :rows="2"
            placeholder="画面英文提示词"
            class="prompt-input"
            @blur="onPromptEdit(item)"
          />
          <div v-if="item.video_prompt" class="video-prompt-tag">
            🎬 {{ item.video_prompt.slice(0, 60) }}...
          </div>
        </div>

        <!-- Actions -->
        <div class="card-actions">
          <a-button size="small" @click="regenerateSingle(item)" :loading="item.generating">
            🔄 重新生成
          </a-button>
          <a-button size="small" @click="generateSingle(item)" :loading="item.generating" :disabled="!!item.image_path">
            🎨 生成
          </a-button>
        </div>
      </div>
    </div>

    <!-- Image Preview Modal -->
    <a-modal
      v-model:open="previewVisible"
      :title="previewTitle"
      :footer="null"
      width="80%"
      class="preview-modal"
      centered
    >
      <div class="preview-body">
        <a-button class="nav-btn prev" @click="prevPreview" :disabled="previewIndex <= 0">
          ‹
        </a-button>
        <div class="preview-image-container">
          <img v-if="previewSrc" :src="previewSrc" alt="full preview" />
          <div v-else class="no-image">暂无图片</div>
        </div>
        <a-button class="nav-btn next" @click="nextPreview" :disabled="previewIndex >= localPrompts.length - 1">
          ›
        </a-button>
      </div>
      <div class="preview-info">
        <p class="preview-sentence">{{ previewSentence }}</p>
        <p class="preview-prompt">{{ previewPromptText }}</p>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { message } from "ant-design-vue";
import axios from "@/utils/axios";

const props = defineProps<{
  sessionId: number | null;
  prompts: any[];
  gridPrompt?: string | null;
  musicPrompt?: any;
  imageManufacturer?: string;
}>();

const emit = defineEmits(["next"]);

// === Local state ===
const localPrompts = ref<any[]>([]);
watch(
  () => props.prompts,
  (val) => {
    localPrompts.value = JSON.parse(JSON.stringify(val));
    localPrompts.value.forEach((p) => {
      p.generating = false;
    });
  },
  { immediate: true, deep: true }
);

// === Selection ===
const selectedIds = ref<Set<number>>(new Set());

function toggleSelect(id: number, checked: boolean) {
  if (checked) selectedIds.value.add(id);
  else selectedIds.value.delete(id);
  // Force reactivity
  selectedIds.value = new Set(selectedIds.value);
}

function selectAll() {
  selectedIds.value = new Set(localPrompts.value.map((p) => p.id));
}

function deselectAll() {
  selectedIds.value = new Set();
}

// === Generation ===
const generatingAll = ref(false);
const regeneratingSelected = ref(false);
const progressPercent = ref(0);

// === Grid Processing ===
const slicesExtracted = ref(false);
const generatingGrid = ref(false);
const extractingGrid = ref(false);
const gridImageUrl = ref("");

function getGridDimensions(count: number) {
  if (count <= 0) return { rows: 1, cols: 1 };
  if (count === 3) return { rows: 1, cols: 3 };
  if (count === 5) return { rows: 1, cols: 5 };
  const n = Math.ceil(Math.sqrt(count));
  const m = Math.ceil(count / n);
  return { rows: m, cols: n };
}

async function generateGridImage() {
  generatingGrid.value = true;
  try {
    const res = await axios.post("/poetry/generateGridImage", {
      gridPrompt: props.gridPrompt,
      imageManufacturer: props.imageManufacturer,
    });
    if (res.code === 200 && res.data?.url) {
      gridImageUrl.value = res.data.url;
      message.success("九宫格大图生成成功");
    }
  } catch(err) {
    message.error("九宫格大图生成失败");
  } finally {
    generatingGrid.value = false;
  }
}

async function extractGrid() {
  if (!gridImageUrl.value) return;
  extractingGrid.value = true;
  const dims = getGridDimensions(localPrompts.value.length);
  try {
    const res = await axios.post("/poetry/extractGrid", {
      sessionId: props.sessionId,
      gridImageUrl: gridImageUrl.value,
      rows: dims.rows,
      cols: dims.cols
    });
    if (res.code === 200 && res.data?.prompts) {
      localPrompts.value = res.data.prompts;
      message.success("切片分发完成！");
      slicesExtracted.value = true;
    }
  } catch (err) {
    message.error("切片失败");
  } finally {
    extractingGrid.value = false;
  }
}

const allImagesGenerated = computed(() => {
  if (!localPrompts.value.length) return false;
  return localPrompts.value.every((p) => p.image_path && p.image_path.length > 5);
});

async function generateSingle(item: any) {
  if (item.image_path) return;
  item.generating = true;
  try {
    const res = await axios.post("/poetry/generateImage", {
      promptId: item.id,
      visualPrompt: item.visual_prompt,
      imageManufacturer: props.imageManufacturer,
    });
    if (res.code === 200 && res.data?.url) {
      item.image_path = res.data.url;
      message.success(`分镜 "${item.sentence.slice(0, 8)}..." 图片生成成功`);
    }
  } catch (err) {
    message.error(`生成失败: ${item.sentence.slice(0, 10)}`);
  } finally {
    item.generating = false;
  }
}

async function regenerateSingle(item: any) {
  item.generating = true;
  item.image_path = "";
  try {
    const res = await axios.post("/poetry/regenerateImage", {
      promptId: item.id,
      visualPrompt: item.visual_prompt,
      imageManufacturer: props.imageManufacturer,
    });
    if (res.code === 200 && res.data?.url) {
      item.image_path = res.data.url;
      message.success(`已重新生成: "${item.sentence.slice(0, 8)}..."`);
    }
  } catch (err) {
    message.error(`重新生成失败: ${item.sentence.slice(0, 10)}`);
  } finally {
    item.generating = false;
  }
}

async function generateAllImages() {
  generatingAll.value = true;
  progressPercent.value = 0;
  const toGenerate = localPrompts.value.filter((p) => !p.image_path);
  if (!toGenerate.length) {
    message.info("所有图片已生成");
    generatingAll.value = false;
    return;
  }
  message.info(`开始排队生成 ${toGenerate.length} 张画面...`);

  let done = 0;
  for (const item of toGenerate) {
    await generateSingle(item);
    done++;
    progressPercent.value = Math.round((done / toGenerate.length) * 100);
  }
  generatingAll.value = false;
  message.success("全部画面生成结束！");
}

async function regenerateSelected() {
  if (!selectedIds.value.size) return;
  regeneratingSelected.value = true;
  progressPercent.value = 0;
  const items = localPrompts.value.filter((p) => selectedIds.value.has(p.id));
  let done = 0;
  for (const item of items) {
    await regenerateSingle(item);
    done++;
    progressPercent.value = Math.round((done / items.length) * 100);
  }
  regeneratingSelected.value = false;
  deselectAll();
  message.success("选中的图片已重新生成！");
}

function onPromptEdit(item: any) {
  // 如果图片已经生成了，编辑提示词后不自动覆盖
  // 用户需要手动点击"重新生成"
}

// === Image Preview ===
const previewVisible = ref(false);
const previewIndex = ref(0);

const previewSrc = computed(() => localPrompts.value[previewIndex.value]?.image_path || "");
const previewSentence = computed(() => localPrompts.value[previewIndex.value]?.sentence || "");
const previewPromptText = computed(() => localPrompts.value[previewIndex.value]?.visual_prompt || "");
const previewTitle = computed(() => `预览 ${previewIndex.value + 1} / ${localPrompts.value.length}`);

function openPreview(index: number) {
  if (!localPrompts.value[index]?.image_path) return;
  previewIndex.value = index;
  previewVisible.value = true;
}

function prevPreview() {
  if (previewIndex.value > 0) previewIndex.value--;
}

function nextPreview() {
  if (previewIndex.value < localPrompts.value.length - 1) previewIndex.value++;
}

defineExpose({
  async autoStart() {
    if (props.gridPrompt && !slicesExtracted.value) {
      await generateGridImage();
      if (gridImageUrl.value) {
        await extractGrid();
      }
    } else {
      await generateAllImages();
    }
    emit('next');
  }
});
</script>

<style lang="scss" scoped>
.poetry-storyboard {
  height: 100%;
  display: flex;
  flex-direction: column;

  .grid-view-section {
    background-color: var(--td-bg-color-container);
    border: 1px solid var(--td-component-border);
    margin-bottom: 1rem;
    padding: 1rem;
    border-radius: 8px;

    .grid-header {
      h3 { margin-bottom: 0.5rem; }
      .grid-prompt-text {
        font-size: 13px;
        color: var(--td-text-color-secondary);
        margin-bottom: 1rem;
      }
      .grid-actions {
        display: flex;
        gap: 8px;
        margin-bottom: 1rem;
      }
    }

    .grid-image-preview {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 200px;
      border: 1px dashed var(--td-component-border);
      background-color: var(--td-bg-color-secondarycontainer);
      border-radius: 8px;
      overflow: hidden;

      img {
        max-width: 100%;
        max-height: 50vh;
        object-fit: contain;
      }

      .empty-grid-placeholder {
        color: var(--td-text-color-placeholder);
      }
    }
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 0.5rem;

    .toolbar-left, .toolbar-right {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
  }

  .progress-bar {
    margin-bottom: 1rem;
  }

  .card-grid {
    flex: 1;
    overflow-y: auto;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
    align-content: start;
  }

  .story-card {
    background: var(--td-bg-color-secondarycontainer);
    border: 2px solid transparent;
    border-radius: 12px;
    overflow: hidden;
    transition: border-color 0.2s, box-shadow 0.2s;

    &.selected {
      border-color: var(--td-brand-color);
      box-shadow: 0 0 0 2px var(--td-brand-color-light);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      background: var(--td-bg-color-container);
      border-bottom: 1px solid var(--td-border-level-1-color);

      .index-badge {
        background: var(--td-brand-color);
        color: #fff;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        display: inline-flex;
        justify-content: center;
        align-items: center;
        font-size: 0.75rem;
        font-weight: bold;
        flex-shrink: 0;
      }

      .sentence {
        font-family: "STKaiti", "KaiTi", serif;
        font-size: 1.125rem;
        color: var(--td-text-color-primary);
      }
    }

    .image-area {
      aspect-ratio: 16 / 9;
      background: #111;
      position: relative;
      cursor: pointer;
      overflow: hidden;

      img {
        width: 100%;
        height: 100%;
        object-fit: contain;
      }

      .hover-overlay {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-size: 1rem;
        opacity: 0;
        transition: opacity 0.2s;
      }

      &:hover .hover-overlay {
        opacity: 1;
      }

      .state-overlay {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        color: #fff;
        gap: 0.5rem;

        &.empty {
          color: var(--td-text-color-placeholder);
        }
      }
    }

    .prompt-section {
      padding: 0.75rem 1rem;

      .prompt-input {
        font-family: monospace;
        font-size: 12px;
        background: var(--td-bg-color-page);
      }

      .video-prompt-tag {
        margin-top: 0.5rem;
        font-size: 11px;
        color: var(--td-text-color-secondary);
        background: var(--td-bg-color-container);
        padding: 4px 8px;
        border-radius: 4px;
      }
    }

    .card-actions {
      padding: 0.5rem 1rem 0.75rem;
      display: flex;
      gap: 0.5rem;
    }
  }
}

/* Preview Modal */
.preview-modal {
  .preview-body {
    display: flex;
    align-items: center;
    gap: 1rem;

    .preview-image-container {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
      background: #000;
      border-radius: 8px;
      overflow: hidden;

      img {
        max-width: 100%;
        max-height: 70vh;
        object-fit: contain;
      }

      .no-image {
        color: #888;
        font-size: 1.25rem;
      }
    }

    .nav-btn {
      font-size: 2rem;
      height: 60px;
      width: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }

  .preview-info {
    margin-top: 1rem;
    text-align: center;

    .preview-sentence {
      font-family: "STKaiti", serif;
      font-size: 1.25rem;
      color: var(--td-text-color-primary);
      margin-bottom: 0.5rem;
    }

    .preview-prompt {
      font-size: 12px;
      color: var(--td-text-color-secondary);
      font-family: monospace;
    }
  }
}
</style>
