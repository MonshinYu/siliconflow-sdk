import type OpenAI from 'openai';

export type ModelType = 'text' | 'image' | 'audio' | 'video';

export type ModelSubType =
    | 'chat'
    | 'embedding'
    | 'reranker'
    | 'text-to-image'
    | 'image-to-image'
    | 'speech-to-text'
    | 'text-to-video';

export interface ListModelsOptions {
    /** 大类过滤 */
    type?: ModelType;
    /** 细类过滤（可不依赖 type 单独使用） */
    subType?: ModelSubType;
}

export interface ModelInfo {
    id: string;
    object: 'model';
    created: number;
    owned_by: string;
}

/** 动态获取账号可用模型列表（与模型广场一致），支持 type / sub_type 过滤 */
export const listModels = async (client: OpenAI, options: ListModelsOptions = {}): Promise<ModelInfo[]> => {
    const baseURL = client.baseURL.replace(/\/+$/, '');
    const params = new URLSearchParams();
    if (options.type) {
        params.set('type', options.type);
    }
    if (options.subType) {
        params.set('sub_type', options.subType);
    }
    const qs = params.toString();

    const response = await fetch(`${baseURL}/models${qs ? `?${qs}` : ''}`, {
        headers: {Authorization: `Bearer ${client.apiKey}`},
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`[siliconflow] 获取模型列表失败 (${response.status}): ${detail}`);
    }

    const result = (await response.json()) as {data?: ModelInfo[]};
    return result.data ?? [];
};
