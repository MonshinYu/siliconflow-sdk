# siliconflow-sdk

基于 [SiliconFlow 云平台](https://cloud.siliconflow.cn) 封装的通用 TypeScript 方法，覆盖平台**全部能力**：

| 能力 | 方法 |
|---|---|
| 对话补全（流式 / 非流式 / 思维链） | `sf.chat()` |
| 文本嵌入 | `sf.embedding()` |
| 重排序 | `sf.rerank()` |
| 文生图 / 图生图 / 图像编辑 | `sf.generateImage()` |
| 文本转语音（TTS） | `sf.tts()` |
| 语音转文本（ASR） | `sf.asr()` |
| 语音克隆（上传 / 列表 / 删除） | `sf.voices.upload / list / delete()` |
| 文生视频 / 图生视频（自动轮询） | `sf.generateVideo()` |
| FIM 代码中间填充 | `sf.fim()` |
| 文件管理 | `sf.files.upload / list / delete()` |
| 批量任务 | `sf.batches.create / list / get / cancel()` |
| 动态模型列表 | `sf.listModels()` |

全链路类型化、无全局状态、支持多实例；**API Key 由调用方传入，模块内部不读取环境变量**。

## 安装

```bash
npm install siliconflow-sdk
# 或 bun：
bun add siliconflow-sdk
```

`openai`（OpenAI 官方 SDK）作为 peerDependency，npm 7+ 与 bun 会**自动安装**，无需手动安装。

底层使用 OpenAI 官方 SDK 作为兼容层（chat / embedding / asr / fim 走 OpenAI 协议）；图像、TTS、视频、重排、语音克隆、文件、批量等参数差异较大的接口走原生 `fetch`，均使用同一实例的 baseURL 与 API Key。

## API Key 由外部传入

模块内部**不读取环境变量**，Key 必须通过 `createSiliconflow({ apiKey })` 传入。在应用层自行决定 Key 来源（环境变量、配置文件、请求鉴权等）。

在项目根目录 `.env` 中配置后（Bun 会自动加载；Node.js 需自行使用 dotenv 加载）：

```
SILICONFLOW_API_KEY=sk-xxx
```

应用层读取后传入：

```ts
const sf = createSiliconflow({
    apiKey: process.env.SILICONFLOW_API_KEY ?? ''
});
```

Key 在 [SiliconFlow 控制台 → API 密钥](https://cloud.siliconflow.cn/account/ak) 获取。

## 快速开始（对话补全）

```ts
import {ChatMessages, Model, createSiliconflow} from 'siliconflow-sdk';

const sf = createSiliconflow({
    apiKey: process.env.SILICONFLOW_API_KEY ?? ''
});

const messages = new ChatMessages('你是一个乐于助人的助手。');
messages.user('你好，请介绍你自己');

// 流式输出（默认）：onDelta 收到每个增量，返回完整回复
const reply = await sf.chat({
    model: Model.DEEPSEEK_V4_FLASH,
    messages,
    onDelta: (delta) => process.stdout.write(delta),
    pushMessage: true // 回复自动写回 messages，支持多轮对话
});
```

### 非流式

```ts
const reply = await sf.chat({
    model: Model.DEEPSEEK_V4_FLASH,
    messages,
    stream: false,
    temperature: 0.7,
    maxTokens: 1024
});
```

### 推理模型（思维链）

`DeepSeek-R1` 等推理模型的思考过程通过 `onReasoning` 回调获取（流式与非流式均支持）：

```ts
await sf.chat({
    model: Model.DEEPSEEK_R1,
    messages,
    onReasoning: (delta) => console.error(`[思考] ${delta}`),
    onDelta: (delta) => process.stdout.write(delta)
});
```

### 思维链开关（enableThinking）

`DeepSeek-V3.2`、`Qwen3` 系列等支持思维链开关的模型，可用 `enableThinking` 控制，并用 `thinkingBudget` 限制思考长度：

```ts
const reply = await sf.chat({
    model: Model.DEEPSEEK_V3_2,
    messages,
    stream: false,
    enableThinking: true,
    thinkingBudget: 2048,      // 思维链最大 token 数（128 ~ 32768）
    onReasoning: (delta) => console.error(`[思考] ${delta}`)
});
```

其他可用参数：`reasoningEffort`（DeepSeek-V4-Flash：`high` | `max`）、`minP`、`topP`、`topK`、`frequencyPenalty`、`stop`、`n`；任意官方参数可通过 `extra` 透传（如 `response_format`、`tools`）。

## 对话历史（ChatMessages）

维护多轮对话，所有方法支持链式调用：

```ts
const messages = new ChatMessages('系统提示词'); // 也可 new ChatMessages() 后调用
messages
    .user('第一轮问题')
    .assistant('第一轮回答') // 手动补充历史
    .user('第二轮问题');

messages.toArray(); // 导出消息副本（不暴露内部数组）
messages.length;    // 消息条数
messages.clear();   // 清空历史
```

## 图像生成

```ts
import {ImageModel, createSiliconflow} from 'siliconflow-sdk';

const sf = createSiliconflow({apiKey: process.env.SILICONFLOW_API_KEY ?? ''});

// 文生图
const urls = await sf.generateImage({
    model: ImageModel.KOLORS,
    prompt: '一只橘猫坐在窗台上看日落',
    size: '512x512',        // Kolors: 512x512/768x768/1024x1024/720x1280...；Qwen-Image: 1328x1328...
    count: 1,               // 1 ~ 4（仅 Kolors 支持 >1）
    numInferenceSteps: 20,
    guidanceScale: 7.5,     // 仅 Kolors
    negativePrompt: '模糊，低质量',
    seed: 42
});

// 图生图 / 图像编辑（传入 image 参数即可）
const edited = await sf.generateImage({
    model: ImageModel.QWEN_IMAGE_EDIT,
    prompt: '把背景换成夜晚星空',
    image: urls[0] ?? ''
});

console.log(urls); // 图片 URL 列表，有效期约 1 小时，建议下载保存
```

## 音频

### 文本转语音（TTS）

```ts
import {TtsModel, createSiliconflow} from 'siliconflow-sdk';

// 返回完整音频字节（Uint8Array）
const audio = await sf.tts({
    model: TtsModel.COSYVOICE2_05B,
    input: '你好，欢迎使用硅基流动语音合成服务。',
    voice: 'FunAudioLLM/CosyVoice2-0.5B:alex', // 预设音色，或克隆音色 uri（speech:xxx）
    responseFormat: 'mp3', // mp3 | opus | wav | pcm
    speed: 1.0,            // 0.25 ~ 4.0
    gain: 0                // -10 ~ 10
});
await Bun.write('out.mp3', audio); // Node.js 用 fs.writeFileSync

// 流式：边生成边接收音频分片（返回值仍为完整音频，可直接落盘）
await sf.tts({
    model: TtsModel.COSYVOICE2_05B,
    input: '长文本...',
    voice: 'FunAudioLLM/CosyVoice2-0.5B:alex',
    stream: true,
    onAudio: (chunk) => console.log(`收到音频分片 ${chunk.length} 字节`)
});
```

### 语音转文本（ASR）

```ts
import {AsrModel} from 'siliconflow-sdk';

const text = await sf.asr({
    model: AsrModel.SENSEVOICE_SMALL,
    file: Bun.file('audio.mp3') // File / Blob，或 {name, data}
});
console.log(text); // 转写文本
```

### 语音克隆

```ts
// 上传参考音频克隆音色，返回 uri
const uri = await sf.voices.upload({
    model: 'FunAudioLLM/CosyVoice2-0.5B',
    customName: 'my-voice',
    text: '参考音频对应的文本内容',
    file: Bun.file('reference.mp3') // 或 audio: 'data:audio/mpeg;base64,...'
});

// 列表 / 删除
const voices = await sf.voices.list();
await sf.voices.delete(uri);

// 用克隆音色合成
await sf.tts({
    model: TtsModel.COSYVOICE2_05B,
    input: '用克隆音色说话',
    voice: uri
});
```

## 视频生成

```ts
import {VideoModel} from 'siliconflow-sdk';

// 文生视频：自动提交 + 轮询直到完成（或超时 / 失败）
const result = await sf.generateVideo({
    model: VideoModel.WAN22_T2V_A14B,
    prompt: '一只橘猫在草地上奔跑，阳光明媚',
    imageSize: '960x960',       // 1280x720 | 720x1280 | 960x960
    pollIntervalMs: 5000,       // 轮询间隔
    maxWaitMs: 600_000,         // 最长等待 10 分钟
    onStatus: (status) => console.log('状态:', status) // Succeed | InQueue | InProgress | Failed
});
console.log(result.videos); // 视频 URL，有效期 1 小时，建议及时下载

// 图生视频
await sf.generateVideo({
    model: VideoModel.WAN22_I2V_A14B,
    prompt: '让画面中的猫转头看向镜头',
    image: 'https://.../photo.png', // 或 base64 data URL
    imageSize: '960x960'
});
```

## 嵌入 / 重排 / FIM

```ts
import {EmbeddingModel, RerankModel, FimModel} from 'siliconflow-sdk';

// 文本嵌入
const {vectors, usage} = await sf.embedding({
    model: EmbeddingModel.BGE_M3,
    input: ['你好', '世界']
});

// 维度截断（Qwen3-Embedding 系列）
const {vectors: v128} = await sf.embedding({
    model: EmbeddingModel.QWEN3_EMBEDDING_0P6B,
    input: '你好世界',
    dimensions: 128
});

// 重排序
const {results} = await sf.rerank({
    model: RerankModel.BGE_RERANKER_V2_M3,
    query: '苹果',
    documents: ['香蕉', '苹果', '水果', '蔬菜'],
    topN: 2,
    returnDocuments: true
});
// results[0].relevanceScore 最高者排第一

// FIM 代码中间填充
const filled = await sf.fim({
    model: FimModel.DEEPSEEK_R1,
    prompt: 'def quick_sort(arr):\n    if len(arr) <= 1:\n        return arr\n',
    suffix: '    return arr',
    maxTokens: 256,
    stream: true,
    onDelta: (delta) => process.stdout.write(delta)
});
```

## 文件 / 批量任务

```ts
// 上传批量任务输入文件（JSONL，每行一个请求）
const jsonl = [
    {custom_id: 'r1', method: 'POST', url: '/v1/chat/completions',
     body: {model: 'deepseek-ai/DeepSeek-V3', messages: [{role: 'user', content: '你好'}], max_tokens: 32}},
].map((line) => JSON.stringify(line)).join('\n');

const file = await sf.files.upload({name: 'requests.jsonl', data: jsonl}, 'batch');

// 创建批量任务
const batch = await sf.batches.create({
    inputFileId: file.id,
    endpoint: '/v1/chat/completions',
    completionWindow: '24h' // 24 ~ 336h，批量价格约为实时 5 折
});

// 查询 / 取消
const info = await sf.batches.get(batch.id);
await sf.batches.cancel(batch.id);

// 文件管理
const files = await sf.files.list();
await sf.files.delete(file.id);
```

> 注意：平台暂未提供文件内容下载 API，批量任务的结果文件（`output_file_id` / `error_file_id`）需在控制台查看下载，结果保留 30 天，请及时转存。

## 动态模型列表

平台会不定期上下线模型，可通过 `listModels` 运行时获取账号下全部可用模型：

```ts
const all = await sf.listModels();                    // 全部 91 个
const chat = await sf.listModels({subType: 'chat'});  // 按细类过滤
const video = await sf.listModels({type: 'video'});   // 按大类过滤
```

## 模型列表

以下枚举的模型 ID 均通过官方 `GET /v1/models` 验证可用；各接口的 `model` 字段同时接受**任意字符串**，可传入未来新增或下方未列出的模型。

### 对话 / 推理 / 多模态（`Model`，64 个）

| 枚举成员 | 模型 ID | 说明 |
|---|---|---|
| `DEEPSEEK_V4_PRO` / `DEEPSEEK_V4_FLASH` | `deepseek-ai/DeepSeek-V4-Pro` / `-Flash` | 旗舰 / 快速廉价 |
| `DEEPSEEK_V3_2` / `PRO_DEEPSEEK_V3_2` | `deepseek-ai/DeepSeek-V3.2` / `Pro/...` | |
| `DEEPSEEK_V3_1_TERMINUS` / `PRO_...` | `deepseek-ai/DeepSeek-V3.1-Terminus` / `Pro/...` | |
| `DEEPSEEK_V3` / `PRO_DEEPSEEK_V3` | `deepseek-ai/DeepSeek-V3` / `Pro/...` | |
| `DEEPSEEK_R1` / `PRO_DEEPSEEK_R1` | `deepseek-ai/DeepSeek-R1` / `Pro/...` | 推理，思维链走 `onReasoning` |
| `DEEPSEEK_R1_0528_QWEN3_8B` | `deepseek-ai/DeepSeek-R1-0528-Qwen3-8B` | 推理蒸馏 |
| `DEEPSEEK_OCR` | `deepseek-ai/DeepSeek-OCR` | OCR 文档识别 |
| `QWEN_36_35B_A3B` / `QWEN_36_27B` | `Qwen/Qwen3.6-35B-A3B` / `Qwen3.6-27B` | MoE / 常规 |
| `QWEN_35_397B_A17B` | `Qwen/Qwen3.5-397B-A17B` | 旗舰 |
| `QWEN_35_122B_A10B` / `QWEN_35_35B_A3B` / `QWEN_35_27B` / `QWEN_35_9B` / `QWEN_35_4B` | `Qwen/Qwen3.5-122B-A10B` / `-35B-A3B` / `-27B` / `-9B` / `-4B` | 4B 为轻量 |
| `QWEN3_32B` / `QWEN3_14B` / `QWEN3_8B` | `Qwen/Qwen3-32B` / `-14B` / `-8B` | |
| `QWEN3_30B_A3B_INSTRUCT_2507` | `Qwen/Qwen3-30B-A3B-Instruct-2507` | |
| `QWEN3_CODER_30B_A3B` | `Qwen/Qwen3-Coder-30B-A3B-Instruct` | 代码 |
| `QWEN3_VL_32B_INSTRUCT` / `QWEN3_VL_32B_THINKING` | `Qwen/Qwen3-VL-32B-Instruct` / `-Thinking` | 视觉 |
| `QWEN3_VL_8B_INSTRUCT` / `QWEN3_VL_8B_THINKING` | `Qwen/Qwen3-VL-8B-Instruct` / `-Thinking` | 视觉 |
| `QWEN3_VL_30B_A3B_INSTRUCT` / `QWEN3_VL_30B_A3B_THINKING` | `Qwen/Qwen3-VL-30B-A3B-Instruct` / `-Thinking` | 视觉 MoE |
| `QWEN3_OMNI_30B_A3B_INSTRUCT` / `..._THINKING` / `..._CAPTIONER` | `Qwen/Qwen3-Omni-30B-A3B-Instruct` / `-Thinking` / `-Captioner` | 多模态 |
| `QWEN25_72B_INSTRUCT_128K` | `Qwen/Qwen2.5-72B-Instruct-128K` | 长上下文 |
| `QWEN25_72B/32B/14B/7B_INSTRUCT` | `Qwen/Qwen2.5-72B/32B/14B/7B-Instruct` | |
| `PRO_QWEN25_7B_INSTRUCT` | `Pro/Qwen/Qwen2.5-7B-Instruct` | Pro 付费高配额 |
| `LORA_QWEN25_72B/32B/14B/7B_INSTRUCT` | `LoRA/Qwen/Qwen2.5-72B/32B/14B/7B-Instruct` | LoRA 微调版 |
| `KIMI_K27_CODE` | `moonshotai/Kimi-K2.7-Code` | 代码 |
| `KIMI_K26_PRO` | `Pro/moonshotai/Kimi-K2.6` | Pro 付费高配额 |
| `GLM_52` / `PRO_GLM_51` | `zai-org/GLM-5.2` / `Pro/zai-org/GLM-5.1` | |
| `GLM_45_AIR` / `GLM_45_VISION` | `zai-org/GLM-4.5-Air` / `zai-org/GLM-4.5V` | 视觉 |
| `GLM_4_32B_0414` / `GLM_Z1_9B_0414` / `GLM_4_9B_0414` | `THUDM/GLM-4-32B-0414` / `THUDM/GLM-Z1-9B-0414` / `THUDM/GLM-4-9B-0414` | Z1 为推理 |
| `MINIMAX_M25` / `PRO_MINIMAX_M25` | `MiniMaxAI/MiniMax-M2.5` / `Pro/...` | |
| `STEP_35_FLASH` | `stepfun-ai/Step-3.5-Flash` | |
| `LING_FLASH_20` / `LING_MINI_20` | `inclusionAI/Ling-flash-2.0` / `Ling-mini-2.0` | |
| `HUNYUAN_A13B` / `HUNYUAN_MT_7B` | `tencent/Hunyuan-A13B-Instruct` / `tencent/Hunyuan-MT-7B` | MT 为翻译 |
| `SEED_OSS_36B` | `ByteDance-Seed/Seed-OSS-36B-Instruct` | |
| `NEX_N2_PRO` | `nex-agi/Nex-N2-Pro` | |
| `LONG_CAT_20` | `meituan-longcat/LongCat-2.0` | |
| `PADDLE_OCR_VL_15` | `PaddlePaddle/PaddleOCR-VL-1.5` | OCR 文档识别 |

### 图像模型（`ImageModel`，7 个）

| 枚举成员 | 模型 ID | 说明 |
|---|---|---|
| `KOLORS` | `Kwai-Kolors/Kolors` | 文生图 |
| `QWEN_IMAGE` | `Qwen/Qwen-Image` | 文生图 |
| `QWEN_IMAGE_EDIT` | `Qwen/Qwen-Image-Edit` | 图生图 / 编辑 |
| `QWEN_IMAGE_EDIT_2509` | `Qwen/Qwen-Image-Edit-2509` | 编辑，支持 image2/image3 多图 |
| `Z_IMAGE` / `Z_IMAGE_TURBO` | `Tongyi-MAI/Z-Image` / `Z-Image-Turbo` | 文生图 |
| `ERNIE_IMAGE_TURBO` | `baidu/ERNIE-Image-Turbo` | 文生图 |

### 嵌入模型（`EmbeddingModel`，8 个）

| 枚举成员 | 模型 ID | 说明 |
|---|---|---|
| `BGE_M3` / `PRO_BGE_M3` | `BAAI/bge-m3` / `Pro/...` | 多语言 1024 维 |
| `BGE_LARGE_ZH_V15` / `BGE_LARGE_EN_V15` | `BAAI/bge-large-zh-v1.5` / `-en-v1.5` | 中 / 英 1024 维 |
| `QWEN3_EMBEDDING_8B` / `_4B` / `_0P6B` | `Qwen/Qwen3-Embedding-8B/4B/0.6B` | 支持 dimensions 截断 |
| `QWEN3_VL_EMBEDDING_8B` | `Qwen/Qwen3-VL-Embedding-8B` | 图文混合嵌入 |

### 重排序模型（`RerankModel`，6 个）

| 枚举成员 | 模型 ID | 说明 |
|---|---|---|
| `BGE_RERANKER_V2_M3` / `PRO_...` | `BAAI/bge-reranker-v2-m3` / `Pro/...` | |
| `QWEN3_RERANKER_8B` / `_4B` / `_0P6B` | `Qwen/Qwen3-Reranker-8B/4B/0.6B` | 支持 instruction |
| `QWEN3_VL_RERANKER_8B` | `Qwen/Qwen3-VL-Reranker-8B` | 图文重排 |

### 音频 / 视频模型

| 枚举 | 成员 | 模型 ID | 说明 |
|---|---|---|---|
| `TtsModel` | `MOSS_TTSD_V05` | `fnlp/MOSS-TTSD-v0.5` | 中英双语对话合成，[S1]/[S2] 多说话人 |
| | `COSYVOICE2_05B` | `FunAudioLLM/CosyVoice2-0.5B` | 情感 / 方言指令 + 音色克隆 |
| `AsrModel` | `SENSEVOICE_SMALL` | `FunAudioLLM/SenseVoiceSmall` | 语音转文本 |
| | `TELESPEECH_ASR` | `TeleAI/TeleSpeechASR` | 语音转文本 |
| `VideoModel` | `WAN22_T2V_A14B` | `Wan-AI/Wan2.2-T2V-A14B` | 文生视频 |
| | `WAN22_I2V_A14B` | `Wan-AI/Wan2.2-I2V-A14B` | 图生视频 |

## 高级用法

### 多实例 / 自定义网关

工厂模式无全局状态，可以同时创建多个实例：

```ts
const main = createSiliconflow({apiKey});                       // 官方地址
const proxy = createSiliconflow({                                  // 走代理网关
    apiKey,
    baseURL: 'https://your-proxy.example.com/v1'
});
```

### 底层客户端

实例上暴露了 OpenAI 兼容底层客户端 `client`，需要高级能力（Function Calling、多模态消息体等）时直接使用：

```ts
const sf = createSiliconflow({apiKey});

const embedding = await sf.client.embeddings.create({
    model: 'BAAI/bge-m3',
    input: ['你好']
});
```

## 实测脚本

仓库自带端到端实测脚本，覆盖全部接口（会真实调用生图 / 生视频，产生少量费用）：

```bash
SILICONFLOW_API_KEY=sk-xxx bun run smoke
```

## 错误处理

- 缺少 API Key：`createSiliconflow({ apiKey })` 未传或为空时抛出明确错误（类型上为必填，运行时也会兜底校验）
- 请求失败（鉴权失败、余额不足、模型不可用等）：Promise reject，可用 `try/catch` 捕获，错误信息包含 HTTP 状态码与接口返回详情
- 视频生成：任务失败（`Failed`）或轮询超时会抛错；成功返回的 URL 有效期 1 小时

```ts
try {
    const reply = await sf.chat({model, messages});
} catch (error) {
    console.error('对话失败:', error.message);
}
```

## 目录结构

```
siliconflow/
├── src/
│   ├── index.ts       # 统一导出
│   ├── client.ts      # createSiliconflow 工厂 + 底层 OpenAI 客户端
│   ├── chat.ts        # chat 对话补全（流式 / 非流式 / 思维链）
│   ├── image.ts       # generateImage 文生图 / 图生图 / 编辑
│   ├── audio.ts       # tts / asr / voices 语音克隆
│   ├── video.ts       # generateVideo 文生视频 / 图生视频（自动轮询）
│   ├── embedding.ts   # embedding 文本 / 图文嵌入
│   ├── rerank.ts      # rerank 重排序
│   ├── fim.ts         # fim 代码中间填充
│   ├── files.ts       # files 文件管理 + batches 批量任务
│   ├── models-api.ts  # listModels 动态模型列表
│   ├── messages.ts    # ChatMessages 对话历史
│   └── models.ts      # Model / ImageModel / EmbeddingModel / RerankModel / TtsModel / AsrModel / VideoModel / FimModel 枚举
├── scripts/
│   └── smoke.ts       # 端到端实测脚本（bun run smoke）
├── dist/              # 构建产物（npm 发布内容）
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```
