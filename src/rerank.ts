import type OpenAI from 'openai';
import type {RerankModel, StringCompat} from './models.ts';

export interface RerankOptions {
    model: RerankModel | StringCompat;
    query: string;
    documents: string[];
    /** 只返回前 N 个结果 */
    topN?: number;
    /** 结果中携带原文 */
    returnDocuments?: boolean;
    /** 仅 Qwen3-Reranker 系列支持 */
    instruction?: string;
    /** 长文档分块上限（仅 bge-reranker-v2-m3 系列支持） */
    maxChunksPerDoc?: number;
    /** 相邻分块重叠 token 数，0 ~ 80 */
    overlapTokens?: number;
}

export interface RerankItem {
    /** 在原 documents 数组中的下标 */
    index: number;
    /** 原文（returnDocuments 为 true 时返回） */
    document?: string;
    /** 相关度得分 0 ~ 1，越高越相关 */
    relevanceScore: number;
}

export interface RerankResult {
    /** 按相关度降序排列 */
    results: RerankItem[];
    meta?: {tokens?: Record<string, number>};
}

/** 重排序：对候选文档按与 query 的相关度排序 */
export const rerank = async (client: OpenAI, options: RerankOptions): Promise<RerankResult> => {
    const {
        model,
        query,
        documents,
        topN,
        returnDocuments = false,
        instruction,
        maxChunksPerDoc,
        overlapTokens
    } = options;

    const baseURL = client.baseURL.replace(/\/+$/, '');
    const response = await fetch(`${baseURL}/rerank`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${client.apiKey}`,
        },
        body: JSON.stringify({
            model,
            query,
            documents,
            ...(topN !== undefined ? {top_n: topN} : {}),
            ...(returnDocuments ? {return_documents: true} : {}),
            ...(instruction ? {instruction} : {}),
            ...(maxChunksPerDoc !== undefined ? {max_chunks_per_doc: maxChunksPerDoc} : {}),
            ...(overlapTokens !== undefined ? {overlap_tokens: overlapTokens} : {}),
        }),
    });

    if (!response.ok) {
        const detail = await response.text();
        throw new Error(`[siliconflow] 重排序失败 (${response.status}): ${detail}`);
    }

    const json = (await response.json()) as {
        results?: {index?: number; document?: unknown; relevance_score?: number}[];
        meta?: {tokens?: Record<string, number>};
    };

    // 接口对 return_documents 返回的 document 可能是对象（如 {text: "..."}），归一化为字符串
    const normalizeDocument = (document: unknown): string | undefined => {
        if (typeof document === 'string') {
            return document;
        }
        if (document !== null && typeof document === 'object') {
            const text = (document as {text?: unknown}).text;
            if (typeof text === 'string') {
                return text;
            }
            return JSON.stringify(document);
        }
        return undefined;
    };

    return {
        results: (json.results ?? [])
            .map((item) => {
                const document = normalizeDocument(item.document);
                return {
                    index: item.index ?? 0,
                    ...(document !== undefined ? {document} : {}),
                    relevanceScore: item.relevance_score ?? 0
                };
            })
            .sort((a, b) => b.relevanceScore - a.relevanceScore),
        meta: json.meta
    };
};
