import type OpenAI from 'openai';
import type {ImageModel, StringCompat} from './models.ts';

export interface ImageGenerationOptions {
    model: ImageModel | StringCompat;
    prompt: string;
    /** 输出尺寸，各模型支持范围不同（Kolors: 512x512/768x768/1024x1024 等；Qwen-Image: 1328x1328 等） */
    size?: string;
    /** 一次生成的图片数量，1 ~ 4（仅 Kolors 支持 batch_size > 1） */
    count?: number;
    /** 图生图 / 图像编辑：base64 data URL 或图片 URL */
    image?: string;
    /** 仅 Qwen-Image-Edit-2509：第二 / 第三张参考图 */
    image2?: string;
    image3?: string;
    negativePrompt?: string;
    /** 推理步数 1 ~ 100，默认 20 */
    numInferenceSteps?: number;
    /** 引导系数 0 ~ 20，默认 7.5（仅 Kolors） */
    guidanceScale?: number;
    /** 随机种子 0 ~ 9999999999 */
    seed?: number;
}

interface ImageGenerationResponse {
    images?: {url?: string}[];
    data?: {url?: string}[];
}

export const generateImage = async (
    client: OpenAI,
    options: ImageGenerationOptions
): Promise<string[]> => {
    const {
        model,
        prompt,
        size = '1024x1024',
        count = 1,
        image,
        image2,
        image3,
        negativePrompt,
        numInferenceSteps,
        guidanceScale,
        seed
    } = options;

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
            ...(image ? {image} : {}),
            ...(image2 ? {image2} : {}),
            ...(image3 ? {image3} : {}),
            ...(negativePrompt ? {negative_prompt: negativePrompt} : {}),
            ...(numInferenceSteps !== undefined ? {num_inference_steps: numInferenceSteps} : {}),
            ...(guidanceScale !== undefined ? {guidance_scale: guidanceScale} : {}),
            ...(seed !== undefined ? {seed} : {})
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
