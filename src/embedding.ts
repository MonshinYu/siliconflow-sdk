import type OpenAI from 'openai';
import type {EmbeddingModel, StringCompat} from './models.ts';

/** 嵌入输入：文本、数组，或图文对象（仅 Qwen3-VL-Embedding 支持 image） */
export type EmbeddingInput = string | Array<string | {text?: string; image?: string}>;

export interface EmbeddingOptions {
    model: EmbeddingModel | StringCompat;
    input: EmbeddingInput;
    /** 输出维度截断（仅 Qwen3-Embedding 系列支持） */
    dimensions?: number;
    encodingFormat?: 'float' | 'base64';
    /** 超长文本截断方向（仅 VL 模型支持） */
    truncate?: 'left' | 'right';
    /** 仅 VL 模型：请求追踪标识 */
    user?: string;
}

export interface EmbeddingResult {
    /** 与 input 顺序对应的向量（base64 格式时为字符串） */
    vectors: (number[] | string)[];
    usage?: {promptTokens?: number; totalTokens?: number};
}

/** 文本 / 图文嵌入 */
export const embedding = async (client: OpenAI, options: EmbeddingOptions): Promise<EmbeddingResult> => {
    const {model, input, dimensions, encodingFormat, truncate, user} = options;

    const response = await client.embeddings.create({
        model,
        // VL 模型支持图文对象输入，官方 SDK 类型未覆盖，此处放宽
        input: input as never,
        ...(dimensions !== undefined ? {dimensions} : {}),
        ...(encodingFormat ? {encoding_format: encodingFormat} : {}),
        ...(truncate ? {truncate} : {}),
        ...(user ? {user} : {}),
    } as Parameters<typeof client.embeddings.create>[0]);

    const vectors = [...response.data]
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding as number[] | string);

    return {
        vectors,
        usage: {
            promptTokens: response.usage?.prompt_tokens,
            totalTokens: response.usage?.total_tokens
        }
    };
};
