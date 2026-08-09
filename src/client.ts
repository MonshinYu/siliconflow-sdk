import OpenAI from 'openai';
import {chat} from './chat.ts';
import type {ChatOptions} from './chat.ts';
import {generateImage} from './image.ts';
import type {ImageGenerationOptions} from './image.ts';

export const SILICONFLOW_BASE_URL = 'https://api.siliconflow.cn/v1';

export interface SiliconflowConfig {
    apiKey: string;
    baseURL?: string;
}

export interface SiliconflowInstance {
    client: OpenAI;
    chat: (options: ChatOptions) => Promise<string>;
    generateImage: (options: ImageGenerationOptions) => Promise<string[]>;
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
        generateImage: (options) => generateImage(client, options)
    };
};
