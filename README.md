# siliconflow-sdk

基于 [SiliconFlow 云平台](https://cloud.siliconflow.cn) 封装的通用 TypeScript 方法，覆盖**对话补全（流式 / 非流式）**与**文生图 / 图生图**。全链路类型化、无全局状态、支持多实例；**API Key 由调用方传入，模块内部不读取环境变量**。

## 安装

```bash
npm install siliconflow-sdk
# 或 bun：
bun add siliconflow-sdk
```

`openai`（OpenAI 官方 SDK）作为 peerDependency，npm 7+ 与 bun 会**自动安装**，无需手动安装。

底层使用 OpenAI 官方 SDK 作为兼容层（`chat` 走 OpenAI 协议），图像接口因参数差异走原生 `fetch`。

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

## 快速开始

```ts
import { ChatMessages, Model, createSiliconflow } from 'siliconflow-sdk';

// Key 由外部传入（这里从环境变量读取）
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

console.log(reply);
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

`DeepSeek-R1` 等推理模型的思考过程通过 `onReasoning` 回调获取：

```ts
await sf.chat({
    model: Model.DEEPSEEK_R1,
    messages,
    onReasoning: (delta) => console.error(`[思考] ${delta}`),
    onDelta: (delta) => process.stdout.write(delta)
});
```

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

## 文生图 / 图生图

```ts
import { ImageModel, createSiliconflow } from 'siliconflow-sdk';

const sf = createSiliconflow({ apiKey: process.env.SILICONFLOW_API_KEY ?? '' });

// 文生图
const urls = await sf.generateImage({
    model: ImageModel.KOLORS,
    prompt: '一只橘猫坐在窗台上看日落',
    size: '1024x1024' // 512x512 | 768x768 | 1024x1024
});

// 图生图 / 图像编辑（传入 image 参数即可，如 Qwen-Image-Edit）
const edited = await sf.generateImage({
    model: ImageModel.QWEN_IMAGE_EDIT,
    prompt: '把背景换成夜晚星空',
    image: urls[0] ?? ''
});

console.log(urls); // 图片 URL 列表，有效期约 1 小时，建议下载保存
```

## 模型列表

模型 ID 均通过官方 `GET /v1/models` 验证可用。

### 对话 / 推理模型（`Model`）

| 枚举成员 | 模型 ID | 说明 |
|---|---|---|
| `DEEPSEEK_V4_PRO` | `deepseek-ai/DeepSeek-V4-Pro` | |
| `DEEPSEEK_V4_FLASH` | `deepseek-ai/DeepSeek-V4-Flash` | 快速廉价 |
| `DEEPSEEK_V3_2` | `deepseek-ai/DeepSeek-V3.2` | |
| `DEEPSEEK_V3_1_TERMINUS` | `deepseek-ai/DeepSeek-V3.1-Terminus` | |
| `DEEPSEEK_V3` | `deepseek-ai/DeepSeek-V3` | |
| `DEEPSEEK_R1` | `deepseek-ai/DeepSeek-R1` | 推理模型，思维链走 `onReasoning` |
| `QWEN_36_35B_A3B` | `Qwen/Qwen3.6-35B-A3B` | MoE，性价比高 |
| `QWEN_36_27B` | `Qwen/Qwen3.6-27B` | |
| `QWEN_35_397B_A17B` | `Qwen/Qwen3.5-397B-A17B` | 旗舰 |
| `QWEN_35_122B_A10B` | `Qwen/Qwen3.5-122B-A10B` | |
| `QWEN_35_35B_A3B` | `Qwen/Qwen3.5-35B-A3B` | |
| `QWEN_35_27B` | `Qwen/Qwen3.5-27B` | |
| `QWEN_35_9B` | `Qwen/Qwen3.5-9B` | |
| `QWEN_35_4B` | `Qwen/Qwen3.5-4B` | 轻量 |
| `QWEN3_32B` / `QWEN3_14B` / `QWEN3_8B` | `Qwen/Qwen3-32B` / `-14B` / `-8B` | |
| `QWEN3_CODER_30B_A3B` | `Qwen/Qwen3-Coder-30B-A3B-Instruct` | 代码 |
| `KIMI_K27_CODE` | `moonshotai/Kimi-K2.7-Code` | 代码 |
| `KIMI_K26_PRO` | `Pro/moonshotai/Kimi-K2.6` | 付费高配额 |
| `GLM_52` | `zai-org/GLM-5.2` | |
| `GLM_45_AIR` | `zai-org/GLM-4.5-Air` | |
| `GLM_45_VISION` | `zai-org/GLM-4.5V` | 视觉 |
| `MINIMAX_M25` | `MiniMaxAI/MiniMax-M2.5` | |
| `STEP_35_FLASH` | `stepfun-ai/Step-3.5-Flash` | |
| `LING_FLASH_20` / `LING_MINI_20` | `inclusionAI/Ling-flash-2.0` / `Ling-mini-2.0` | |
| `HUNYUAN_A13B` | `tencent/Hunyuan-A13B-Instruct` | |
| `SEED_OSS_36B` | `ByteDance-Seed/Seed-OSS-36B-Instruct` | |
| `NEX_N2_PRO` | `nex-agi/Nex-N2-Pro` | |
| `LONG_CAT_20` | `meituan-longcat/LongCat-2.0` | |

### 图像模型（`ImageModel`）

| 枚举成员 | 模型 ID | 说明 |
|---|---|---|
| `KOLORS` | `Kwai-Kolors/Kolors` | 文生图 |
| `QWEN_IMAGE` | `Qwen/Qwen-Image` | 文生图 |
| `QWEN_IMAGE_EDIT` | `Qwen/Qwen-Image-Edit` | 图生图 / 编辑 |
| `Z_IMAGE` / `Z_IMAGE_TURBO` | `Tongyi-MAI/Z-Image` / `Z-Image-Turbo` | 文生图 |
| `ERNIE_IMAGE_TURBO` | `baidu/ERNIE-Image-Turbo` | 文生图 |

## 高级用法

### 多实例 / 自定义网关

工厂模式无全局状态，可以同时创建多个实例：

```ts
const main = createSiliconflow({ apiKey });                       // 官方地址
const proxy = createSiliconflow({                                  // 走代理网关
    apiKey,
    baseURL: 'https://your-proxy.example.com/v1'
});
```

### 底层客户端

实例上暴露了 OpenAI 兼容底层客户端 `client`，需要高级能力（Embedding、Function Calling 等）时直接使用：

```ts
const sf = createSiliconflow({ apiKey });

const embedding = await sf.client.embeddings.create({
    model: 'BAAI/bge-m3',
    input: ['你好']
});
```

## 错误处理

- 缺少 API Key：`createSiliconflow({ apiKey })` 未传或为空时抛出明确错误（类型上为必填，运行时也会兜底校验）
- 请求失败（鉴权失败、余额不足、模型不可用等）：Promise reject，可用 `try/catch` 捕获，错误信息包含 HTTP 状态码与接口返回详情

```ts
try {
    const reply = await sf.chat({ model, messages });
} catch (error) {
    console.error('对话失败:', error.message);
}
```

## 目录结构

```
siliconflow/
├── src/
│   ├── index.ts      # 统一导出
│   ├── client.ts     # createSiliconflow 工厂 + 底层 OpenAI 客户端
│   ├── chat.ts       # chat 对话补全（流式 / 非流式 / 推理）
│   ├── image.ts      # generateImage 文生图 / 图生图
│   ├── messages.ts   # ChatMessages 对话历史
│   └── models.ts     # Model / ImageModel 枚举
├── dist/             # 构建产物（npm 发布内容）
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── README.md
```
