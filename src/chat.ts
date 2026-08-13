import type OpenAI from 'openai';
import type {ChatMessages} from './messages.ts';
import type {Model, StringCompat} from './models.ts';

export interface ChatOptions {
    model: Model | StringCompat;
    messages: ChatMessages;
    system?: string;
    stream?: boolean;
    onDelta?: (delta: string) => void;
    onReasoning?: (delta: string) => void;
    pushMessage?: boolean;
    temperature?: number;
    maxTokens?: number;
    /** 思维链开关（支持模型见官方文档 enable_thinking 字段说明） */
    enableThinking?: boolean;
    /** 思维链最大 token 数，范围 128 ~ 32768 */
    thinkingBudget?: number;
    /** 推理强度（仅 deepseek-ai/DeepSeek-V4-Flash）：high | max */
    reasoningEffort?: 'high' | 'max';
    minP?: number;
    topP?: number;
    topK?: number;
    frequencyPenalty?: number;
    stop?: string | string[];
    /** 生成条数（>1 时本方法取第一条返回） */
    n?: number;
    /** 透传任意额外参数（如 response_format、tools 等，见官方文档） */
    extra?: Record<string, unknown>;
}

interface ReasoningDelta {
    content?: string | null;
    reasoning_content?: string | null;
}

export const chat = async (client: OpenAI, options: ChatOptions): Promise<string> => {
    const {
        model,
        messages,
        system,
        stream = true,
        onDelta,
        onReasoning,
        pushMessage = false,
        temperature,
        maxTokens,
        enableThinking,
        thinkingBudget,
        reasoningEffort,
        minP,
        topP,
        topK,
        frequencyPenalty,
        stop,
        n,
        extra
    } = options;

    const requestMessages = [
        ...(system ? [{role: 'system' as const, content: system}] : []),
        ...messages.toArray()
    ];

    const commonParams = {
        model,
        temperature,
        max_tokens: maxTokens,
        ...(enableThinking !== undefined ? {enable_thinking: enableThinking} : {}),
        ...(thinkingBudget !== undefined ? {thinking_budget: thinkingBudget} : {}),
        ...(reasoningEffort ? {reasoning_effort: reasoningEffort} : {}),
        ...(minP !== undefined ? {min_p: minP} : {}),
        ...(topP !== undefined ? {top_p: topP} : {}),
        ...(topK !== undefined ? {top_k: topK} : {}),
        ...(frequencyPenalty !== undefined ? {frequency_penalty: frequencyPenalty} : {}),
        ...(stop !== undefined ? {stop} : {}),
        ...(n !== undefined ? {n} : {}),
        ...extra
    } as Parameters<typeof client.chat.completions.create>[0];

    if (stream) {
        const response = await client.chat.completions.create({
            ...commonParams,
            messages: requestMessages,
            stream: true
        });

        let content = '';
        for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta as ReasoningDelta | undefined;
            if (delta?.reasoning_content) {
                onReasoning?.(delta.reasoning_content);
            }
            if (!delta?.content) {
                continue;
            }
            content += delta.content;
            onDelta?.(delta.content);
        }

        if (pushMessage) {
            messages.assistant(content);
        }
        return content;
    }

    const response = await client.chat.completions.create({
        ...commonParams,
        messages: requestMessages,
        stream: false
    });

    const message = response.choices[0]?.message as
        | {content?: string | null; reasoning_content?: string | null}
        | undefined;
    if (message?.reasoning_content) {
        onReasoning?.(message.reasoning_content);
    }
    const content = message?.content ?? '';
    if (pushMessage) {
        messages.assistant(content);
    }
    return content;
};
