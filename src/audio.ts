import type OpenAI from 'openai';
import type {AsrModel, StringCompat, TtsModel} from './models.ts';

/** 音频来源：标准 File/Blob，或原始字节 + 文件名 */
export type AudioSource = File | Blob | {name?: string; data: Uint8Array | ArrayBuffer | Blob};

const toBlobSource = (source: AudioSource): {blob: Blob; name: string} => {
    if (source instanceof Blob) {
        return {blob: source, name: (source as File).name || 'audio.mp3'};
    }
    const {data} = source;
    return {
        blob: data instanceof Blob ? data : new Blob([data as Uint8Array<ArrayBuffer>]),
        name: source.name ?? 'audio.mp3'
    };
};

export interface TtsOptions {
    model: TtsModel | StringCompat;
    input: string;
    /** 预设音色（如 `FunAudioLLM/CosyVoice2-0.5B:alex`），或克隆音色 uri（`speech:xxx:...`）。
     * CosyVoice2-0.5B 必需；MOSS-TTSD-v0.5 可选（不传则用默认说话人） */
    voice?: string;
    responseFormat?: 'mp3' | 'opus' | 'wav' | 'pcm';
    sampleRate?: number;
    /** 语速 0.25 ~ 4.0，默认 1.0 */
    speed?: number;
    /** 增益 -10 ~ 10，默认 0 */
    gain?: number;
    /** 流式接收音频分片；默认 false，返回完整音频字节 */
    stream?: boolean;
    onAudio?: (chunk: Uint8Array) => void;
    /** 透传任意额外参数（如 MOSS-TTSD 的 references 多说话人） */
    extra?: Record<string, unknown>;
}

const concatChunks = (chunks: Uint8Array[]): Uint8Array => {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out;
};

/** 文本转语音，返回音频字节（默认完整音频；stream: true 时通过 onAudio 收分片） */
export const tts = async (client: OpenAI, options: TtsOptions): Promise<Uint8Array> => {
    const {
        model,
        input,
        voice,
        responseFormat = 'mp3',
        sampleRate,
        speed,
        gain,
        stream = false,
        onAudio,
        extra
    } = options;

    const baseURL = client.baseURL.replace(/\/+$/, '');
    const response = await fetch(`${baseURL}/audio/speech`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${client.apiKey}`,
        },
        body: JSON.stringify({
            model,
            input,
            ...(voice ? {voice} : {}),
            response_format: responseFormat,
            ...(sampleRate !== undefined ? {sample_rate: sampleRate} : {}),
            ...(speed !== undefined ? {speed} : {}),
            ...(gain !== undefined ? {gain} : {}),
            // 接口默认 stream=true，显式传 false 以保证拿到完整音频
            stream,
            ...extra
        }),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`[siliconflow] 语音合成失败 (${response.status}): ${detail}`);
    }

    if (stream) {
        const reader = response.body?.getReader();
        if (!reader) {
            return new Uint8Array(await response.arrayBuffer());
        }
        const chunks: Uint8Array[] = [];
        while (true) {
            const {done, value} = await reader.read();
            if (done) {
                break;
            }
            chunks.push(value);
            onAudio?.(value);
        }
        return concatChunks(chunks);
    }

    return new Uint8Array(await response.arrayBuffer());
};

export interface AsrOptions {
    model: AsrModel | StringCompat;
    file: AudioSource;
}

/** 语音转文本，返回转写文本 */
export const asr = async (client: OpenAI, options: AsrOptions): Promise<string> => {
    const {model, file} = options;
    const {blob, name} = toBlobSource(file);

    const baseURL = client.baseURL.replace(/\/+$/, '');
    const form = new FormData();
    form.append('file', blob, name);
    form.append('model', model);

    const response = await fetch(`${baseURL}/audio/transcriptions`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${client.apiKey}`,
        },
        body: form,
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`[siliconflow] 语音转写失败 (${response.status}): ${detail}`);
    }

    const result = (await response.json()) as {text?: string};
    return result.text ?? '';
};

// ---------------------------------------------------------------------------
// 语音克隆（上传参考音频 / 列表 / 删除）
// ---------------------------------------------------------------------------

export interface VoiceInfo {
    model: string;
    customName: string;
    text: string;
    uri: string;
}

export interface UploadVoiceOptions {
    model: string;
    /** 自定义音色名称（删除 / 合成时引用） */
    customName: string;
    /** 参考音频对应的文本内容 */
    text: string;
    /** 参考音频文件（与 audio 二选一） */
    file?: AudioSource;
    /** 参考音频 base64 data URL（`data:audio/...;base64,...`，与 file 二选一） */
    audio?: string;
}

export interface SiliconflowVoices {
    /** 上传参考音频克隆音色，返回 uri（用于 TTS 的 voice 参数） */
    upload: (options: UploadVoiceOptions) => Promise<string>;
    /** 获取已克隆音色列表 */
    list: () => Promise<VoiceInfo[]>;
    /** 删除已克隆音色 */
    delete: (uri: string) => Promise<void>;
}

interface Envelope<T> {
    code?: number;
    message?: string;
    status?: boolean;
    data?: T;
}

const unwrapData = <T>(json: unknown): T | undefined => {
    if (json === null || typeof json !== 'object') {
        return undefined;
    }
    const envelope = json as Envelope<T>;
    return (envelope.data ?? envelope) as T;
};

const uploadVoice = async (client: OpenAI, options: UploadVoiceOptions): Promise<string> => {
    const {model, customName, text, file, audio} = options;
    const baseURL = client.baseURL.replace(/\/+$/, '');

    let init: RequestInit;
    if (file) {
        const {blob, name} = toBlobSource(file);
        const form = new FormData();
        form.append('model', model);
        form.append('customName', customName);
        form.append('text', text);
        form.append('file', blob, name);
        init = {method: 'POST', body: form};
    } else if (audio) {
        init = {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({model, customName, text, audio}),
        };
    } else {
        throw new Error('[siliconflow] 上传参考音频需要提供 file 或 audio 之一');
    }

    const response = await fetch(`${baseURL}/uploads/audio/voice`, {
        ...init,
        headers: {
            Authorization: `Bearer ${client.apiKey}`,
            ...init.headers,
        },
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`[siliconflow] 上传参考音频失败 (${response.status}): ${detail}`);
    }

    const json = (await response.json()) as {uri?: string} | Envelope<{uri?: string}>;
    const uri = unwrapData<{uri?: string}>(json)?.uri;
    if (!uri) {
        throw new Error('[siliconflow] 上传参考音频成功但响应中未包含 uri');
    }
    return uri;
};

const listVoices = async (client: OpenAI): Promise<VoiceInfo[]> => {
    const baseURL = client.baseURL.replace(/\/+$/, '');
    const response = await fetch(`${baseURL}/audio/voice/list`, {
        headers: {Authorization: `Bearer ${client.apiKey}`},
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`[siliconflow] 获取音色列表失败 (${response.status}): ${detail}`);
    }

    // 接口字段为 result（单数）；兼容 results / 信封 data 嵌套
    interface VoiceListBody {
        result?: VoiceInfo[];
        results?: VoiceInfo[];
    }
    const json = (await response.json()) as VoiceInfo[] | VoiceListBody | Envelope<VoiceInfo[] | VoiceListBody>;
    const data = unwrapData<VoiceInfo[] | VoiceListBody>(json);
    if (Array.isArray(data)) {
        return data;
    }
    return data?.results ?? data?.result ?? [];
};

const deleteVoice = async (client: OpenAI, uri: string): Promise<void> => {
    const baseURL = client.baseURL.replace(/\/+$/, '');
    const response = await fetch(`${baseURL}/audio/voice/deletions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${client.apiKey}`,
        },
        body: JSON.stringify({uri}),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`[siliconflow] 删除音色失败 (${response.status}): ${detail}`);
    }
};

export const voices = (client: OpenAI): SiliconflowVoices => ({
    upload: (options) => uploadVoice(client, options),
    list: () => listVoices(client),
    delete: (uri) => deleteVoice(client, uri)
});
