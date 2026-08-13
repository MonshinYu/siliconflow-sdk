/**
 * 模型枚举。
 *
 * 全部 91 个模型 ID 均通过官方 GET /v1/models 接口实测验证可用（2026-08）。
 * 平台会不定期上下线模型，最新列表可运行时通过 `listModels()` 获取；
 * 各接口的 model 字段均放宽为 `枚举 | (string & {})`，可直接传入任意模型 ID。
 */
export type StringCompat = string & {};

/** 对话 / 推理 / 多模态模型（chat completions，64 个） */
export enum Model {
    // DeepSeek
    DEEPSEEK_V4_PRO = 'deepseek-ai/DeepSeek-V4-Pro',
    DEEPSEEK_V4_FLASH = 'deepseek-ai/DeepSeek-V4-Flash',
    DEEPSEEK_V3_2 = 'deepseek-ai/DeepSeek-V3.2',
    PRO_DEEPSEEK_V3_2 = 'Pro/deepseek-ai/DeepSeek-V3.2',
    DEEPSEEK_V3_1_TERMINUS = 'deepseek-ai/DeepSeek-V3.1-Terminus',
    PRO_DEEPSEEK_V3_1_TERMINUS = 'Pro/deepseek-ai/DeepSeek-V3.1-Terminus',
    DEEPSEEK_V3 = 'deepseek-ai/DeepSeek-V3',
    PRO_DEEPSEEK_V3 = 'Pro/deepseek-ai/DeepSeek-V3',
    DEEPSEEK_R1 = 'deepseek-ai/DeepSeek-R1', // 推理模型，思维链走 onReasoning
    PRO_DEEPSEEK_R1 = 'Pro/deepseek-ai/DeepSeek-R1',
    DEEPSEEK_R1_0528_QWEN3_8B = 'deepseek-ai/DeepSeek-R1-0528-Qwen3-8B',
    DEEPSEEK_OCR = 'deepseek-ai/DeepSeek-OCR', // OCR 文档识别

    // Qwen3.6 / 3.5
    QWEN_36_35B_A3B = 'Qwen/Qwen3.6-35B-A3B', // MoE，性价比高
    QWEN_36_27B = 'Qwen/Qwen3.6-27B',
    QWEN_35_397B_A17B = 'Qwen/Qwen3.5-397B-A17B', // 旗舰
    QWEN_35_122B_A10B = 'Qwen/Qwen3.5-122B-A10B',
    QWEN_35_35B_A3B = 'Qwen/Qwen3.5-35B-A3B',
    QWEN_35_27B = 'Qwen/Qwen3.5-27B',
    QWEN_35_9B = 'Qwen/Qwen3.5-9B',
    QWEN_35_4B = 'Qwen/Qwen3.5-4B', // 轻量

    // Qwen3
    QWEN3_32B = 'Qwen/Qwen3-32B',
    QWEN3_14B = 'Qwen/Qwen3-14B',
    QWEN3_8B = 'Qwen/Qwen3-8B',
    QWEN3_30B_A3B_INSTRUCT_2507 = 'Qwen/Qwen3-30B-A3B-Instruct-2507',
    QWEN3_CODER_30B_A3B = 'Qwen/Qwen3-Coder-30B-A3B-Instruct', // 代码

    // Qwen3-VL（视觉）
    QWEN3_VL_32B_INSTRUCT = 'Qwen/Qwen3-VL-32B-Instruct',
    QWEN3_VL_32B_THINKING = 'Qwen/Qwen3-VL-32B-Thinking',
    QWEN3_VL_8B_INSTRUCT = 'Qwen/Qwen3-VL-8B-Instruct',
    QWEN3_VL_8B_THINKING = 'Qwen/Qwen3-VL-8B-Thinking',
    QWEN3_VL_30B_A3B_INSTRUCT = 'Qwen/Qwen3-VL-30B-A3B-Instruct',
    QWEN3_VL_30B_A3B_THINKING = 'Qwen/Qwen3-VL-30B-A3B-Thinking',

    // Qwen3-Omni（多模态输入输出）
    QWEN3_OMNI_30B_A3B_INSTRUCT = 'Qwen/Qwen3-Omni-30B-A3B-Instruct',
    QWEN3_OMNI_30B_A3B_THINKING = 'Qwen/Qwen3-Omni-30B-A3B-Thinking',
    QWEN3_OMNI_30B_A3B_CAPTIONER = 'Qwen/Qwen3-Omni-30B-A3B-Captioner',

    // Qwen2.5
    QWEN25_72B_INSTRUCT_128K = 'Qwen/Qwen2.5-72B-Instruct-128K',
    QWEN25_72B_INSTRUCT = 'Qwen/Qwen2.5-72B-Instruct',
    QWEN25_32B_INSTRUCT = 'Qwen/Qwen2.5-32B-Instruct',
    QWEN25_14B_INSTRUCT = 'Qwen/Qwen2.5-14B-Instruct',
    QWEN25_7B_INSTRUCT = 'Qwen/Qwen2.5-7B-Instruct',
    PRO_QWEN25_7B_INSTRUCT = 'Pro/Qwen/Qwen2.5-7B-Instruct', // Pro 付费高配额
    LORA_QWEN25_72B_INSTRUCT = 'LoRA/Qwen/Qwen2.5-72B-Instruct', // LoRA 微调版
    LORA_QWEN25_32B_INSTRUCT = 'LoRA/Qwen/Qwen2.5-32B-Instruct',
    LORA_QWEN25_14B_INSTRUCT = 'LoRA/Qwen/Qwen2.5-14B-Instruct',
    LORA_QWEN25_7B_INSTRUCT = 'LoRA/Qwen/Qwen2.5-7B-Instruct',

    // Kimi
    KIMI_K27_CODE = 'moonshotai/Kimi-K2.7-Code', // 代码
    KIMI_K26_PRO = 'Pro/moonshotai/Kimi-K2.6', // Pro 付费高配额

    // GLM
    GLM_52 = 'zai-org/GLM-5.2',
    PRO_GLM_51 = 'Pro/zai-org/GLM-5.1',
    GLM_45_AIR = 'zai-org/GLM-4.5-Air',
    GLM_45_VISION = 'zai-org/GLM-4.5V', // 视觉
    GLM_4_32B_0414 = 'THUDM/GLM-4-32B-0414',
    GLM_Z1_9B_0414 = 'THUDM/GLM-Z1-9B-0414', // 推理
    GLM_4_9B_0414 = 'THUDM/GLM-4-9B-0414',

    // 其他
    MINIMAX_M25 = 'MiniMaxAI/MiniMax-M2.5',
    PRO_MINIMAX_M25 = 'Pro/MiniMaxAI/MiniMax-M2.5',
    STEP_35_FLASH = 'stepfun-ai/Step-3.5-Flash',
    LING_FLASH_20 = 'inclusionAI/Ling-flash-2.0',
    LING_MINI_20 = 'inclusionAI/Ling-mini-2.0',
    HUNYUAN_A13B = 'tencent/Hunyuan-A13B-Instruct',
    HUNYUAN_MT_7B = 'tencent/Hunyuan-MT-7B', // 翻译
    SEED_OSS_36B = 'ByteDance-Seed/Seed-OSS-36B-Instruct',
    NEX_N2_PRO = 'nex-agi/Nex-N2-Pro',
    LONG_CAT_20 = 'meituan-longcat/LongCat-2.0',
    PADDLE_OCR_VL_15 = 'PaddlePaddle/PaddleOCR-VL-1.5' // OCR 文档识别
}

/** 图像模型（文生图 / 图生图 / 图像编辑，7 个） */
export enum ImageModel {
    KOLORS = 'Kwai-Kolors/Kolors', // 文生图
    QWEN_IMAGE = 'Qwen/Qwen-Image', // 文生图
    QWEN_IMAGE_EDIT = 'Qwen/Qwen-Image-Edit', // 图生图 / 编辑
    QWEN_IMAGE_EDIT_2509 = 'Qwen/Qwen-Image-Edit-2509', // 编辑（支持 image2/image3 多图）
    Z_IMAGE = 'Tongyi-MAI/Z-Image', // 文生图
    Z_IMAGE_TURBO = 'Tongyi-MAI/Z-Image-Turbo', // 文生图，快速
    ERNIE_IMAGE_TURBO = 'baidu/ERNIE-Image-Turbo' // 文生图
}

/** 嵌入模型（8 个） */
export enum EmbeddingModel {
    BGE_M3 = 'BAAI/bge-m3', // 多语言 1024 维
    PRO_BGE_M3 = 'Pro/BAAI/bge-m3',
    BGE_LARGE_ZH_V15 = 'BAAI/bge-large-zh-v1.5', // 中文 1024 维
    BGE_LARGE_EN_V15 = 'BAAI/bge-large-en-v1.5', // 英文 1024 维
    QWEN3_EMBEDDING_8B = 'Qwen/Qwen3-Embedding-8B', // 支持 dimensions 截断
    QWEN3_EMBEDDING_4B = 'Qwen/Qwen3-Embedding-4B',
    QWEN3_EMBEDDING_0P6B = 'Qwen/Qwen3-Embedding-0.6B',
    QWEN3_VL_EMBEDDING_8B = 'Qwen/Qwen3-VL-Embedding-8B' // 图文混合嵌入
}

/** 重排序模型（6 个） */
export enum RerankModel {
    BGE_RERANKER_V2_M3 = 'BAAI/bge-reranker-v2-m3',
    PRO_BGE_RERANKER_V2_M3 = 'Pro/BAAI/bge-reranker-v2-m3',
    QWEN3_RERANKER_8B = 'Qwen/Qwen3-Reranker-8B',
    QWEN3_RERANKER_4B = 'Qwen/Qwen3-Reranker-4B',
    QWEN3_RERANKER_0P6B = 'Qwen/Qwen3-Reranker-0.6B',
    QWEN3_VL_RERANKER_8B = 'Qwen/Qwen3-VL-Reranker-8B' // 图文重排
}

/** 文本转语音模型（2 个） */
export enum TtsModel {
    MOSS_TTSD_V05 = 'fnlp/MOSS-TTSD-v0.5', // 中英双语对话合成，[S1]/[S2] 多说话人
    COSYVOICE2_05B = 'FunAudioLLM/CosyVoice2-0.5B' // 支持情感/方言指令与音色克隆
}

/** 语音转文本模型（2 个） */
export enum AsrModel {
    SENSEVOICE_SMALL = 'FunAudioLLM/SenseVoiceSmall',
    TELESPEECH_ASR = 'TeleAI/TeleSpeechASR'
}

/** 视频生成模型（2 个） */
export enum VideoModel {
    WAN22_T2V_A14B = 'Wan-AI/Wan2.2-T2V-A14B', // 文生视频
    WAN22_I2V_A14B = 'Wan-AI/Wan2.2-I2V-A14B' // 图生视频
}

/** FIM（代码中间填充）模型。
 * 官方文档（guides/fim）支持的 DeepSeek-V2.5 / R1-Distill-Qwen / Qwen2.5-Coder 系列
 * 部分已不在当前模型列表中，可直接用字符串 ID 传入（model 字段已放宽为 string）。 */
export enum FimModel {
    DEEPSEEK_R1 = 'deepseek-ai/DeepSeek-R1',
    PRO_DEEPSEEK_R1 = 'Pro/deepseek-ai/DeepSeek-R1',
    DEEPSEEK_V3 = 'deepseek-ai/DeepSeek-V3',
    PRO_DEEPSEEK_V3 = 'Pro/deepseek-ai/DeepSeek-V3'
}
