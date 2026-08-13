import type OpenAI from 'openai';

// ---------------------------------------------------------------------------
// 通用请求（解包 {code, message, status, data} 信封）
// ---------------------------------------------------------------------------

interface Envelope<T> {
    code?: number;
    message?: string;
    status?: boolean;
    data?: T;
}

const request = async <T>(client: OpenAI, path: string, init: RequestInit = {}): Promise<T | undefined> => {
    const baseURL = client.baseURL.replace(/\/+$/, '');
    const isForm = init.body instanceof FormData;
    const response = await fetch(`${baseURL}${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${client.apiKey}`,
            ...(init.body !== undefined && !isForm ? {'Content-Type': 'application/json'} : {}),
            ...init.headers,
        },
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`[siliconflow] 请求失败 (${response.status}): ${detail}`);
    }

    const text = await response.text();
    if (!text) {
        return undefined;
    }
    const json = JSON.parse(text) as Envelope<T> & T;
    if (json !== null && typeof json === 'object' && 'data' in json) {
        return (json as Envelope<T>).data;
    }
    return json as T;
};

// ---------------------------------------------------------------------------
// 文件
// ---------------------------------------------------------------------------

/** 文件来源：标准 File/Blob，或 {name, data}（data 可为文本 / 字节） */
export type FileSource = File | Blob | {name: string; data: string | Uint8Array | ArrayBuffer | Blob};

export interface FileInfo {
    id: string;
    object: string;
    bytes: number;
    created_at?: number;
    filename: string;
    purpose: string;
    line_count?: number;
}

export interface SiliconflowFiles {
    /** 上传文件（默认 purpose=batch，用于批量任务；仅支持 JSONL） */
    upload: (file: FileSource, purpose?: string) => Promise<FileInfo>;
    /** 获取文件列表（接口要求按 purpose 过滤，默认 batch） */
    list: (purpose?: string, limit?: number) => Promise<FileInfo[]>;
    /** 删除文件 */
    delete: (id: string) => Promise<void>;
}

const toBlobSource = (source: FileSource): {blob: Blob; name: string} => {
    if (source instanceof Blob) {
        return {blob: source, name: (source as File).name || 'file.jsonl'};
    }
    const {data} = source;
    return {
        blob: data instanceof Blob ? data : new Blob([data as Uint8Array<ArrayBuffer>]),
        name: source.name
    };
};

const uploadFile = async (client: OpenAI, file: FileSource, purpose = 'batch'): Promise<FileInfo> => {
    const {blob, name} = toBlobSource(file);
    const form = new FormData();
    form.append('file', blob, name);
    form.append('purpose', purpose);

    const data = await request<FileInfo>(client, '/files', {method: 'POST', body: form});
    if (!data) {
        throw new Error('[siliconflow] 文件上传成功但响应中未包含数据');
    }
    return data;
};

const listFiles = async (client: OpenAI, purpose = 'batch', limit?: number): Promise<FileInfo[]> => {
    // GET /files 必须带 purpose 参数；响应是信封 data 内再嵌套 data 数组
    const params = new URLSearchParams({purpose});
    if (limit !== undefined) {
        params.set('limit', String(limit));
    }
    const data = await request<FileInfo[] | {data?: FileInfo[]}>(client, `/files?${params.toString()}`, {
        method: 'GET'
    });
    if (Array.isArray(data)) {
        return data;
    }
    return data?.data ?? [];
};

const deleteFile = async (client: OpenAI, id: string): Promise<void> => {
    await request(client, `/files/${id}`, {method: 'DELETE'});
};

export const files = (client: OpenAI): SiliconflowFiles => ({
    upload: (file, purpose) => uploadFile(client, file, purpose),
    list: (purpose, limit) => listFiles(client, purpose, limit),
    delete: (id) => deleteFile(client, id)
});

// ---------------------------------------------------------------------------
// 批量任务
// ---------------------------------------------------------------------------

export interface BatchInfo {
    id: string;
    object: string;
    endpoint: string;
    input_file_id: string;
    completion_window: string;
    status: string;
    output_file_id?: string;
    error_file_id?: string;
    created_at?: number;
    in_progress_at?: number;
    expires_at?: number;
    completed_at?: number;
    failed_at?: number;
    cancelled_at?: number;
    request_counts?: Record<string, number>;
    errors?: unknown;
}

export interface CreateBatchOptions {
    /** 上传文件返回的 id */
    inputFileId: string;
    /** 默认 '/v1/chat/completions' */
    endpoint?: string;
    /** 默认 '24h'（支持 24 ~ 336h） */
    completionWindow?: string;
    metadata?: Record<string, string>;
    /** 统一覆盖模型（文件内每行未指定 model 时使用） */
    model?: string;
}

export interface SiliconflowBatches {
    create: (options: CreateBatchOptions) => Promise<BatchInfo>;
    list: (limit?: number, after?: string) => Promise<BatchInfo[]>;
    get: (id: string) => Promise<BatchInfo>;
    cancel: (id: string) => Promise<BatchInfo>;
}

const createBatch = async (client: OpenAI, options: CreateBatchOptions): Promise<BatchInfo> => {
    const {inputFileId, endpoint = '/v1/chat/completions', completionWindow = '24h', metadata, model} = options;
    const data = await request<BatchInfo>(client, '/batches', {
        method: 'POST',
        body: JSON.stringify({
            input_file_id: inputFileId,
            endpoint,
            completion_window: completionWindow,
            ...(metadata ? {metadata} : {}),
            ...(model ? {replace: {model}} : {}),
        }),
    });
    if (!data) {
        throw new Error('[siliconflow] 批量任务创建成功但响应中未包含数据');
    }
    return data;
};

const listBatches = async (client: OpenAI, limit?: number, after?: string): Promise<BatchInfo[]> => {
    const params = new URLSearchParams();
    if (limit !== undefined) {
        params.set('limit', String(limit));
    }
    if (after) {
        params.set('after', after);
    }
    const qs = params.toString();
    const data = await request<BatchInfo[]>(client, `/batches${qs ? `?${qs}` : ''}`, {method: 'GET'});
    return data ?? [];
};

const getBatch = async (client: OpenAI, id: string): Promise<BatchInfo> => {
    const data = await request<BatchInfo>(client, `/batches/${id}`, {method: 'GET'});
    if (!data) {
        throw new Error('[siliconflow] 获取批量任务详情失败：响应中未包含数据');
    }
    return data;
};

const cancelBatch = async (client: OpenAI, id: string): Promise<BatchInfo> => {
    const data = await request<BatchInfo>(client, `/batches/${id}/cancel`, {method: 'POST'});
    if (!data) {
        throw new Error('[siliconflow] 取消批量任务失败：响应中未包含数据');
    }
    return data;
};

// 注意：平台暂未提供文件内容下载 API（GET /files/{id}/content 返回 404），
// 批量任务的结果文件（output_file_id / error_file_id）需在控制台查看下载，
// 结果保留 30 天。故 SDK 不提供 content / results 方法。

export const batches = (client: OpenAI): SiliconflowBatches => ({
    create: (options) => createBatch(client, options),
    list: (limit, after) => listBatches(client, limit, after),
    get: (id) => getBatch(client, id),
    cancel: (id) => cancelBatch(client, id)
});
