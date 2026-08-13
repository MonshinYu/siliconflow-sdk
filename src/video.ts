import type OpenAI from 'openai';
import type {StringCompat, VideoModel} from './models.ts';

export type VideoTaskStatus = 'Succeed' | 'InQueue' | 'InProgress' | 'Failed';

export interface VideoGenerationOptions {
    model: VideoModel | StringCompat;
    prompt: string;
    /** 视频尺寸，默认 960x960 */
    imageSize?: '1280x720' | '720x1280' | '960x960';
    /** 图生视频（Wan2.2-I2V-A14B）：base64 data URL 或图片 URL */
    image?: string;
    negativePrompt?: string;
    seed?: number;
    /** 状态轮询间隔，默认 5000ms */
    pollIntervalMs?: number;
    /** 最长等待时间，默认 10 分钟 */
    maxWaitMs?: number;
    /** 每次轮询的状态回调 */
    onStatus?: (status: VideoTaskStatus) => void;
    extra?: Record<string, unknown>;
}

export interface VideoGenerationResult {
    requestId: string;
    /** 视频 URL 列表（有效期 1 小时，建议及时下载） */
    videos: string[];
    seed?: number;
    timings?: {inference?: number};
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** 文生视频 / 图生视频：提交任务并自动轮询直到完成（或超时/失败） */
export const generateVideo = async (
    client: OpenAI,
    options: VideoGenerationOptions
): Promise<VideoGenerationResult> => {
    const {
        model,
        prompt,
        imageSize,
        image,
        negativePrompt,
        seed,
        pollIntervalMs = 5000,
        maxWaitMs = 600_000,
        onStatus,
        extra
    } = options;

    const baseURL = client.baseURL.replace(/\/+$/, '');

    // 1. 提交任务
    const submitResponse = await fetch(`${baseURL}/video/submit`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${client.apiKey}`,
        },
        body: JSON.stringify({
            model,
            prompt,
            ...(imageSize ? {image_size: imageSize} : {}),
            ...(image ? {image} : {}),
            ...(negativePrompt ? {negative_prompt: negativePrompt} : {}),
            ...(seed !== undefined ? {seed} : {}),
            ...extra
        }),
    });

    if (!submitResponse.ok) {
        const detail = await submitResponse.text();
        throw new Error(`[siliconflow] 视频生成任务提交失败 (${submitResponse.status}): ${detail}`);
    }

    const submitted = (await submitResponse.json()) as {requestId?: string};
    const requestId = submitted.requestId;
    if (!requestId) {
        throw new Error('[siliconflow] 视频生成提交成功但响应中未包含 requestId');
    }

    // 2. 轮询状态
    const deadline = Date.now() + maxWaitMs;
    while (true) {
        if (Date.now() > deadline) {
            throw new Error(
                `[siliconflow] 视频生成轮询超时（${maxWaitMs}ms），requestId: ${requestId}，可稍后通过状态接口查询`
            );
        }

        const statusResponse = await fetch(`${baseURL}/video/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${client.apiKey}`,
            },
            body: JSON.stringify({requestId}),
        });

        if (!statusResponse.ok) {
            const detail = await statusResponse.text();
            throw new Error(`[siliconflow] 视频生成状态查询失败 (${statusResponse.status}): ${detail}`);
        }

        const result = (await statusResponse.json()) as {
            status?: VideoTaskStatus;
            reason?: string;
            results?: {videos?: {url?: string}[]; timings?: {inference?: number}; seed?: number};
        };
        const status = result.status ?? 'InQueue';
        onStatus?.(status);

        if (status === 'Succeed') {
            const videos = (result.results?.videos ?? [])
                .map((item) => item.url)
                .filter((url): url is string => Boolean(url));
            if (videos.length === 0) {
                throw new Error('[siliconflow] 视频生成成功但响应中未包含视频 URL');
            }
            return {
                requestId,
                videos,
                seed: result.results?.seed,
                timings: result.results?.timings,
            };
        }

        if (status === 'Failed') {
            throw new Error(`[siliconflow] 视频生成失败：${result.reason ?? '未知原因'}（requestId: ${requestId}）`);
        }

        await sleep(pollIntervalMs);
    }
};
