import type OpenAI from 'openai';
import type {FimModel, StringCompat} from './models.ts';

export interface FimOptions {
    model: FimModel | StringCompat;
    /** 前缀内容 */
    prompt: string;
    /** 后缀内容 */
    suffix?: string;
    maxTokens?: number;
    stream?: boolean;
    onDelta?: (delta: string) => void;
}

/** FIM（Fill in the Middle）代码中间填充，走 /v1/completions 协议 */
export const fim = async (client: OpenAI, options: FimOptions): Promise<string> => {
    const {model, prompt, suffix, maxTokens, stream = false, onDelta} = options;

    const params = {
        model,
        prompt,
        ...(suffix ? {suffix} : {}),
        ...(maxTokens !== undefined ? {max_tokens: maxTokens} : {}),
    };

    if (stream) {
        const response = await client.completions.create({
            ...params,
            stream: true
        });

        let content = '';
        for await (const chunk of response) {
            const delta = chunk.choices[0]?.text;
            if (!delta) {
                continue;
            }
            content += delta;
            onDelta?.(delta);
        }
        return content;
    }

    const response = await client.completions.create({
        ...params,
        stream: false
    });
    return response.choices[0]?.text ?? '';
};
