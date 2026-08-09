import type OpenAI from 'openai';
import type {ChatMessages} from './messages.ts';
import type {Model} from './models.ts';

export interface ChatOptions {
    model: Model;
    messages: ChatMessages;
    system?: string;
    stream?: boolean;
    onDelta?: (delta: string) => void;
    onReasoning?: (delta: string) => void;
    pushMessage?: boolean;
    temperature?: number;
    maxTokens?: number;
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
        maxTokens
    } = options;

    const requestMessages = [
        ...(system ? [{role: 'system' as const, content: system}] : []),
        ...messages.toArray()
    ];

    if (stream) {
        const response = await client.chat.completions.create({
            model,
            messages: requestMessages,
            stream: true,
            temperature,
            max_tokens: maxTokens
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
        model,
        messages: requestMessages,
        stream: false,
        temperature,
        max_tokens: maxTokens
    });

    const content = response.choices[0]?.message?.content ?? '';
    if (pushMessage) {
        messages.assistant(content);
    }
    return content;
};
