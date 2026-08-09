export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
    role: ChatRole;
    content: string;
}

export class ChatMessages {
    private items: ChatMessage[] = [];

    constructor(system?: string) {
        if (system) {
            this.system(system);
        }
    }

    system(content: string): this {
        return this.push(content, 'system');
    }

    user(content: string): this {
        return this.push(content, 'user');
    }

    assistant(content: string): this {
        return this.push(content, 'assistant');
    }

    push(content: string, role: ChatRole = 'user'): this {
        this.items.push({role, content});
        return this;
    }

    toArray(): ChatMessage[] {
        return [...this.items];
    }

    clear(): this {
        this.items = [];
        return this;
    }

    get length(): number {
        return this.items.length;
    }
}
