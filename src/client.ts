import OpenAI from 'openai';
import {chat} from './chat.ts';
import type {ChatOptions} from './chat.ts';
import {generateImage} from './image.ts';
import type {ImageGenerationOptions} from './image.ts';
import {asr, tts, voices} from './audio.ts';
import type {AsrOptions, SiliconflowVoices, TtsOptions} from './audio.ts';
import {generateVideo} from './video.ts';
import type {VideoGenerationOptions, VideoGenerationResult} from './video.ts';
import {rerank} from './rerank.ts';
import type {RerankOptions, RerankResult} from './rerank.ts';
import {embedding} from './embedding.ts';
import type {EmbeddingOptions, EmbeddingResult} from './embedding.ts';
import {fim} from './fim.ts';
import type {FimOptions} from './fim.ts';
import {batches, files} from './files.ts';
import type {SiliconflowBatches, SiliconflowFiles} from './files.ts';
import {listModels} from './models-api.ts';
import type {ListModelsOptions, ModelInfo} from './models-api.ts';

export const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

export interface SiliconflowConfig {
    apiKey: string;
    baseURL?: string;
}

export interface SiliconflowInstance {
    /** OpenAI 兼容底层客户端，高级能力（Function Calling 等）可直接使用 */
    client: OpenAI;
    /** 对话补全（流式 / 非流式 / 思维链） */
    chat: (options: ChatOptions) => Promise<string>;
    /** 文生图 / 图生图 / 图像编辑，返回图片 URL 列表 */
    generateImage: (options: ImageGenerationOptions) => Promise<string[]>;
    /** 文本嵌入，返回向量列表 */
    embedding: (options: EmbeddingOptions) => Promise<EmbeddingResult>;
    /** 重排序，返回按相关度排序的结果 */
    rerank: (options: RerankOptions) => Promise<RerankResult>;
    /** 文本转语音，返回音频字节 */
    tts: (options: TtsOptions) => Promise<Uint8Array>;
    /** 语音转文本，返回转写文本 */
    asr: (options: AsrOptions) => Promise<string>;
    /** 语音克隆：上传参考音频 / 列表 / 删除 */
    voices: SiliconflowVoices;
    /** 文生视频 / 图生视频：提交并自动轮询到完成 */
    generateVideo: (options: VideoGenerationOptions) => Promise<VideoGenerationResult>;
    /** FIM 代码中间填充 */
    fim: (options: FimOptions) => Promise<string>;
    /** 文件管理（批量任务输入文件等） */
    files: SiliconflowFiles;
    /** 批量任务 */
    batches: SiliconflowBatches;
    /** 动态获取账号可用模型列表 */
    listModels: (options?: ListModelsOptions) => Promise<ModelInfo[]>;
}

export const createSiliconflow = (config: SiliconflowConfig): SiliconflowInstance => {
    if (!config.apiKey) {
        throw new Error('[siliconflow] 缺少 API Key：请通过 createSiliconflow({ apiKey }) 传入');
    }

    const client = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL ?? SILICONFLOW_BASE_URL,
    });

    return {
        client,
        chat: (options) => chat(client, options),
        generateImage: (options) => generateImage(client, options),
        embedding: (options) => embedding(client, options),
        rerank: (options) => rerank(client, options),
        tts: (options) => tts(client, options),
        asr: (options) => asr(client, options),
        voices: voices(client),
        generateVideo: (options) => generateVideo(client, options),
        fim: (options) => fim(client, options),
        files: files(client),
        batches: batches(client),
        listModels: (options) => listModels(client, options)
    };
};
