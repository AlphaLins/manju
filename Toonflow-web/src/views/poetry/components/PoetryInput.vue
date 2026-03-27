<template>
  <div class="poetry-input-box">
    <div class="input-row">
      <!-- Left: Text Input -->
      <div class="input-col">
        <div class="section-title">📝 输入诗词</div>
        <p class="hint">请输入中国古典诗词，每句诗另起一行。系统将自动解析诗句并生成图像提示词。</p>
        <a-textarea
          v-model:value="content"
          placeholder="春苑月裴回&#10;竹堂侵夜开&#10;惊鸟排林度&#10;风花隔水来"
          :rows="10"
          class="poetry-textarea"
        />
        <div class="btn-row">
          <a-button size="small" @click="loadExample">📄 加载示例</a-button>
          <a-button size="small" @click="content = ''">🗑️ 清空</a-button>
        </div>
      </div>

      <!-- Right: Config Panel -->
      <div class="config-col">
        <!-- Style Presets -->
        <div class="config-section">
          <div class="section-title">🎨 艺术风格</div>
          <a-select v-model:value="artStyle" style="width:100%" placeholder="选择风格预设..." allow-clear>
            <a-select-option v-for="s in stylePresets" :key="s.id" :value="s.id">{{ s.name }}</a-select-option>
          </a-select>
        </div>

        <!-- Custom Style -->
        <div class="config-section">
          <div class="section-title">✏️ 自定义风格</div>
          <a-textarea
            v-model:value="customStyle"
            placeholder="例如：A traditional Chinese ink painting style, with soft brushstrokes and muted colors..."
            :rows="3"
          />
        </div>

        <!-- Generation Options -->
        <div class="config-section">
          <div class="section-title">⚙️ 生成选项</div>
          <a-form layout="horizontal" :label-col="{ span: 10 }" :wrapper-col="{ span: 14 }">
            <a-form-item label="每句诗生成">
              <a-select v-model:value="exampleCount" style="width:100%">
                <a-select-option :value="1">1 组</a-select-option>
                <a-select-option :value="2">2 组</a-select-option>
                <a-select-option :value="3">3 组</a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="画幅比例">
              <a-select v-model:value="aspectRatio" style="width:100%">
                <a-select-option value="16:9">16:9 横屏</a-select-option>
                <a-select-option value="9:16">9:16 竖屏</a-select-option>
                <a-select-option value="1:1">1:1 方图</a-select-option>
                <a-select-option value="4:3">4:3 传统</a-select-option>
              </a-select>
            </a-form-item>
          </a-form>
        </div>

        <!-- 9-Grid Mode -->
        <div class="config-section grid-section">
          <a-checkbox v-model:checked="gridMode">🔲 九宫格模式</a-checkbox>
          <template v-if="gridMode">
            <a-form layout="horizontal" :label-col="{ span: 10 }" :wrapper-col="{ span: 14 }" style="margin-top:8px">
              <a-form-item label="分辨率">
                <a-select v-model:value="resolution" style="width:100%">
                  <a-select-option value="4k">4K</a-select-option>
                  <a-select-option value="2k">2K</a-select-option>
                  <a-select-option value="1080p">1080p</a-select-option>
                </a-select>
              </a-form-item>
            </a-form>
          </template>
        </div>

        <!-- Model Selection -->
        <div class="config-section">
          <div class="section-title">🤖 模型选择</div>
          <a-form layout="horizontal" :label-col="{ span: 10 }" :wrapper-col="{ span: 14 }">
            <a-form-item label="文本模型">
              <a-select v-model:value="textManufacturer" style="width:100%" placeholder="默认" allow-clear>
                <a-select-option v-for="m in textModels" :key="m.manufacturer" :value="m.manufacturer">
                  {{ m.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
            <a-form-item label="图片模型">
              <a-select v-model:value="imageManufacturer" style="width:100%" placeholder="默认" allow-clear>
                <a-select-option v-for="m in imageModels" :key="m.manufacturer" :value="m.manufacturer">
                  {{ m.label }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-form>
        </div>

        <!-- Submit Button -->
        <a-button type="primary" size="large" :loading="loading" @click="submit(false)" block class="submit-btn" style="margin-bottom: 12px;">
          ✨ 智能解析分镜 (分步创作)
        </a-button>
        <a-button type="default" danger size="large" :loading="loading" @click="submit(true)" block class="submit-btn">
          👑 一键魔法创作 (全自动流水线)
        </a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { message } from "ant-design-vue";
import axios from "@/utils/axios";
import { useRoute } from "vue-router";

const emit = defineEmits(["parsed"]);
const route = useRoute();

// === State ===
const content = ref("");
const artStyle = ref<string | undefined>(undefined);
const customStyle = ref("");
const exampleCount = ref(1);
const aspectRatio = ref("16:9");
const gridMode = ref(false);
const resolution = ref("4k");
const loading = ref(false);

// === Model Selection ===
const textManufacturer = ref<string | undefined>(undefined);
const imageManufacturer = ref<string | undefined>(undefined);
const textModels = ref<any[]>([]);
const imageModels = ref<any[]>([]);

onMounted(async () => {
  try {
    const res = await axios.get("/poetry/models");
    if (res.code === 200 && res.data) {
      textModels.value = res.data.textModels || [];
      imageModels.value = res.data.imageModels || [];
    }
  } catch (e) {
    console.warn("Failed to load model list", e);
  }
});

// === Style Presets ===
const stylePresets = [
  { id: "ink", name: "🖌️ 中国水墨画" },
  { id: "watercolor", name: "🎨 中国水彩画" },
  { id: "gongbi", name: "🏛️ 工笔画" },
  { id: "oil", name: "🖼️ 西方油画" },
  { id: "anime", name: "🌸 日式动漫" },
  { id: "realistic", name: "📷 写实摄影" },
  { id: "abstract", name: "🔷 抽象艺术" },
  { id: "minimalist", name: "◻️ 极简主义" },
  { id: "impressionist", name: "🌻 印象派" },
];

const styleDescriptions: Record<string, string> = {
  ink: "A traditional Chinese ink painting style, characterized by bold brushstrokes, monochrome palette with varying ink density, and emphasis on empty space (liubai).",
  watercolor: "A delicate Chinese watercolor style with soft colors, gentle gradients, and ethereal atmosphere.",
  gongbi: "A detailed Chinese gongbi style with precise brushwork, rich colors, and meticulous detail.",
  oil: "Western oil painting style with rich textures, vivid colors, thick brush strokes, and dramatic lighting, reminiscent of classical European art.",
  anime: "Japanese anime art style with vibrant colors, expressive characters, clean lines, cel-shaded rendering, and dramatic atmospheric effects.",
  realistic: "Photo-realistic style with accurate details, natural lighting, realistic textures, true-to-life colors, and precise spatial depth.",
  abstract: "Abstract art style with non-representational forms, bold color blocks, geometric shapes, emotional expression through color and composition.",
  minimalist: "Minimalist design with clean composition, limited color palette, essential elements only, negative space emphasis, modern aesthetic.",
  impressionist: "Impressionist style with visible brushstrokes, light colors, and emphasis on light and atmosphere.",
};

// === Example Poetry ===
const examplePoems = [
  "春苑月裴回\n竹堂侵夜开\n惊鸟排林度\n风花隔水来",
  "床前明月光\n疑是地上霜\n举头望明月\n低头思故乡",
  "独在异乡为异客\n每逢佳节倍思亲\n遥知兄弟登高处\n遍插茱萸少一人",
  "白日依山尽\n黄河入海流\n欲穷千里目\n更上一层楼",
];

function loadExample() {
  const idx = Math.floor(Math.random() * examplePoems.length);
  content.value = examplePoems[idx];
}

// === Build final style string ===
function buildStyleString(): string {
  let parts: string[] = [];
  if (artStyle.value && styleDescriptions[artStyle.value]) {
    parts.push(styleDescriptions[artStyle.value]);
  }
  if (customStyle.value.trim()) {
    parts.push(customStyle.value.trim());
  }
  if (parts.length === 0) {
    parts.push("中国风，唯美，高画质");
  }
  return parts.join(". ");
}

// === Submit ===
const submit = async (isMagic = false) => {
  if (!content.value.trim()) {
    return message.warning("请输入诗词内容");
  }

  loading.value = true;
  try {
    const res = await axios.post("/poetry/parse", {
      content: content.value,
      style: buildStyleString(),
      projectId: route.query.id,
      exampleCount: exampleCount.value,
      aspectRatio: aspectRatio.value,
      gridMode: gridMode.value,
      resolution: resolution.value,
      textManufacturer: textManufacturer.value,
    });

    if (res.code === 200) {
      message.success("解析成功！");
      // Attach model selections to the emitted data for downstream use
      const emitData = {
        ...res.data,
        imageManufacturer: imageManufacturer.value,
        isMagic, // Append the workflow trigger
      };
      emit("parsed", emitData);
    } else {
      message.error(res.message || "解析失败");
    }
  } catch (err: any) {
    message.error("大模型对话异常：请检查模型配置是否正确");
  } finally {
    loading.value = false;
  }
};
</script>

<style lang="scss" scoped>
.poetry-input-box {
  padding: 1rem;

  .input-row {
    display: flex;
    gap: 2rem;
    align-items: flex-start;

    @media (max-width: 900px) {
      flex-direction: column;
    }
  }

  .input-col {
    flex: 1.2;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;

    .hint {
      color: var(--td-text-color-secondary);
      font-size: 13px;
      margin: 0;
    }

    .poetry-textarea {
      font-family: "STKaiti", "KaiTi", "FangSong", serif;
      font-size: 1.125rem;
      line-height: 2;
      background: var(--td-bg-color-secondarycontainer);
      border-radius: 8px;
    }

    .btn-row {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
  }

  .config-col {
    flex: 0.8;
    min-width: 280px;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    background: var(--td-bg-color-secondarycontainer);
    padding: 1.25rem;
    border-radius: 12px;
    border: 1px solid var(--td-border-level-1-color);

    .config-section {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .grid-section {
      padding: 0.75rem;
      border: 1px dashed var(--td-border-level-2-color);
      border-radius: 8px;
    }

    .submit-btn {
      margin-top: 0.5rem;
      height: 48px;
      font-size: 1rem;
      font-weight: 600;
    }
  }

  .section-title {
    font-weight: 600;
    font-size: 14px;
    color: var(--td-text-color-primary);
  }
}
</style>
