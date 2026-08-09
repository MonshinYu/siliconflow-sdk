import type OpenAI from 'openai';
import type {ImageModel} from './models.ts';

export interface ImageGenerationOptions {
    model: ImageModel;
    prompt: string;
    size?: '512x512' | '768x768' | '1024x1024';
    count?: number;
    image?: string;
}

interface ImageGenerationResponse {
    images?: { url?: string }[];
    data?: { url?: string }[];
}

export const generateImage = async (
    client: OpenAI,
    options: ImageGenerationOptions
): Promise<string[]> => {
    const {model, prompt, size = '1024x1024', count = 1, image} = options;
    const baseURL = client.baseURL.replace(/\/+$/, '');

    const response = await fetch(`${baseURL}/images/generations`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${client.apiKey}`,
        },
        body: JSON.stringify({
            model,
            prompt,
            image_size: size,
            batch_size: count,
            ...(image ? {image} : {})
        }),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`[siliconflow] 图片生成失败 (${response.status}): ${detail}`);
    }

    const result = (await response.json()) as ImageGenerationResponse;
    const urls = (result.images ?? result.data ?? [])
        .map((item) => item.url)
        .filter((url): url is string => Boolean(url));

    if (urls.length === 0) {
        throw new Error('[siliconflow] 图片生成成功但响应中未包含图片 URL');
    }
    return urls;
};
