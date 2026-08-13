/**
 * 端到端实测脚本：覆盖硅基流动全部能力。
 *
 * 用法：
 *   SILICONFLOW_API_KEY=sk-xxx bun run smoke
 *   # 或
 *   bun run smoke sk-xxx
 *
 * 说明：
 *   - 会真实调用生图 / 生视频，产生少量费用
 *   - 视频生成耗时 1~5 分钟，脚本会自动轮询
 *   - 生成的音频保存在 scripts/.out/ 下
 */
import {mkdir} from 'node:fs/promises';
import {readFileSync, writeFileSync} from 'node:fs';
import {
    AsrModel,
    ChatMessages,
    EmbeddingModel,
    FimModel,
    ImageModel,
    Model,
    RerankModel,
    TtsModel,
    VideoModel,
    createSiliconflow
} from '../src/index.ts';
import type {ModelSubType} from '../src/index.ts';

const apiKey = process.env.SILICONFLOW_API_KEY ?? process.argv[2];
if (!apiKey) {
    console.error('用法: SILICONFLOW_API_KEY=sk-xxx bun run smoke  或  bun run smoke sk-xxx');
    process.exit(2);
}

const sf = createSiliconflow({apiKey});
const log = (...args: unknown[]) => console.log('  ', ...args);
const results: {name: string; ok: boolean; detail: string}[] = [];
// 可选：命令行传步骤名过滤，只跑匹配的步骤（如 bun run smoke sk-xxx tts asr）
const filters = process.argv.slice(2).filter((arg) => arg !== apiKey);

const step = async (name: string, fn: () => Promise<void>) => {
    if (filters.length > 0 && !filters.some((f) => name.includes(f))) {
        console.log(`\n⏭ ${name}（按过滤条件跳过）`);
        return;
    }
    console.log(`\n▶ ${name}`);
    try {
        await fn();
        results.push({name, ok: true, detail: ''});
        console.log(`✓ ${name} 通过`);
    } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        results.push({name, ok: false, detail});
        console.error(`✗ ${name} 失败: ${detail}`);
    }
};

const OUT_DIR = 'scripts/.out';
const TTS_TEXT = '你好，欢迎使用硅基流动语音合成服务。';

// ---------------------------------------------------------------------------
// 1. 模型列表
// ---------------------------------------------------------------------------
await step('listModels 动态模型列表', async () => {
    const all = await sf.listModels();
    log(`全部模型: ${all.length} 个`);

    const bySubType = async (subType: ModelSubType) => (await sf.listModels({subType})).length;
    const chat = await bySubType('chat');
    const embedding = await bySubType('embedding');
    const reranker = await bySubType('reranker');
    const tti = await bySubType('text-to-image');
    const stt = await bySubType('speech-to-text');
    const ttv = await bySubType('text-to-video');
    const video = (await sf.listModels({type: 'video'})).length;
    const audio = (await sf.listModels({type: 'audio'})).length;

    log(`chat=${chat} embedding=${embedding} reranker=${reranker} 文生图=${tti} ASR=${stt} 文生视频=${ttv} 视频=${video} 音频=${audio}`);
    if (all.length < 90) {
        throw new Error(`模型总数异常: ${all.length}`);
    }
});

// ---------------------------------------------------------------------------
// 2. 对话补全
// ---------------------------------------------------------------------------
const history = new ChatMessages('你是一个乐于助人的助手。');
history.user('你好，请介绍你自己');

await step('chat 流式 + pushMessage 多轮', async () => {
    let streamed = '';
    const reply = await sf.chat({
        model: Model.DEEPSEEK_V4_FLASH,
        messages: history,
        onDelta: (delta) => {
            streamed += delta;
        },
        pushMessage: true,
        maxTokens: 64
    });
    log(`流式回复: ${reply.slice(0, 60)}...`);
    if (streamed !== reply) {
        throw new Error('onDelta 聚合与返回值不一致');
    }
    if (history.length < 3) {
        throw new Error(`pushMessage 未生效，消息条数: ${history.length}`);
    }

    // 第二轮：复用同一 history（非流式）
    history.user('再用一句话自我介绍');
    const reply2 = await sf.chat({
        model: Model.DEEPSEEK_V4_FLASH,
        messages: history,
        stream: false,
        temperature: 0.7,
        maxTokens: 64
    });
    log(`第二轮回复: ${reply2.slice(0, 60)}...`);
});

await step('chat 思维链（enableThinking + onReasoning）', async () => {
    let reasoning = '';
    const reply = await sf.chat({
        model: Model.DEEPSEEK_V3_2,
        messages: history,
        stream: false,
        enableThinking: true,
        maxTokens: 128,
        onReasoning: (delta) => {
            reasoning += delta;
        }
    });
    log(`思考内容: ${reasoning.slice(0, 60)}${reasoning.length > 60 ? '...' : ''}（共 ${reasoning.length} 字）`);
    log(`最终回复: ${reply.slice(0, 60)}...`);
    if (!reasoning) {
        throw new Error('未收到思维链内容');
    }
});

// ---------------------------------------------------------------------------
// 3. 嵌入 / 重排 / FIM
// ---------------------------------------------------------------------------
await step('embedding 文本嵌入', async () => {
    const result = await sf.embedding({
        model: EmbeddingModel.BGE_M3,
        input: ['你好', '世界']
    });
    log(`bge-m3 向量数: ${result.vectors.length}，维度: ${(result.vectors[0] as number[]).length}`);

    const truncated = await sf.embedding({
        model: EmbeddingModel.QWEN3_EMBEDDING_0P6B,
        input: '你好世界',
        dimensions: 128
    });
    log(`Qwen3-Embedding-0.6B dimensions=128 实际维度: ${(truncated.vectors[0] as number[]).length}`);
    if ((truncated.vectors[0] as number[]).length !== 128) {
        throw new Error('dimensions 截断未生效');
    }
});

await step('rerank 重排序', async () => {
    const result = await sf.rerank({
        model: RerankModel.BGE_RERANKER_V2_M3,
        query: '苹果',
        documents: ['香蕉', '苹果', '水果', '蔬菜'],
        topN: 2,
        returnDocuments: true
    });
    for (const item of result.results) {
        log(`#${item.index} ${item.document} 得分=${item.relevanceScore.toFixed(4)}`);
    }
    if (result.results.length !== 2) {
        throw new Error(`topN=2 但返回 ${result.results.length} 条`);
    }
    if (result.results[0]?.document !== '苹果') {
        throw new Error('重排结果第一名不是“苹果”');
    }
});

await step('fim 代码中间填充', async () => {
    const code = 'def quick_sort(arr):\n    if len(arr) <= 1:\n        return arr\n';
    let streamed = '';
    const filled = await sf.fim({
        model: FimModel.DEEPSEEK_R1,
        prompt: code,
        suffix: '    return arr',
        maxTokens: 128,
        stream: true,
        onDelta: (delta) => {
            streamed += delta;
        }
    });
    log(`补全内容: ${filled.slice(0, 60)}...`);
    if (!filled || filled !== streamed) {
        throw new Error('FIM 补全为空或流式聚合不一致');
    }
});

// ---------------------------------------------------------------------------
// 4. 语音：TTS → ASR 回译 → 语音克隆
// ---------------------------------------------------------------------------
let ttsPath = '';
await step('tts 文本转语音', async () => {
    const audio = await sf.tts({
        model: TtsModel.COSYVOICE2_05B,
        input: TTS_TEXT,
        voice: 'FunAudioLLM/CosyVoice2-0.5B:alex', // CosyVoice2 需要预设音色或参考音频
        responseFormat: 'mp3'
    });
    await mkdir(OUT_DIR, {recursive: true});
    ttsPath = `${OUT_DIR}/tts.mp3`;
    writeFileSync(ttsPath, audio);
    log(`音频大小: ${audio.length} 字节 → ${ttsPath}`);
    if (audio.length < 1000) {
        throw new Error(`音频异常偏小: ${audio.length} 字节`);
    }
});

await step('asr 语音转文本（回译 TTS 音频）', async () => {
    const audioPath = ttsPath || `${OUT_DIR}/tts.mp3`; // tts 步骤被过滤跳过时复用已有产物
    const audioFile = new File([readFileSync(audioPath)], 'tts.mp3', {type: 'audio/mpeg'});
    const text = await sf.asr({
        model: AsrModel.SENSEVOICE_SMALL,
        file: audioFile
    });
    log(`转写结果: ${text}`);
    if (!text.includes('语音合成')) {
        throw new Error(`转写内容与原文不符: ${text}`);
    }
});

let voiceUri = '';
await step('voices 语音克隆：上传 / 列表 / 删除', async () => {
    const audioPath = ttsPath || `${OUT_DIR}/tts.mp3`; // tts 步骤被过滤跳过时复用已有产物
    voiceUri = await sf.voices.upload({
        model: TtsModel.COSYVOICE2_05B,
        customName: 'sdk-test-voice',
        text: TTS_TEXT,
        file: new File([readFileSync(audioPath)], 'tts.mp3', {type: 'audio/mpeg'})
    });
    log(`上传成功 uri: ${voiceUri}`);

    const list = await sf.voices.list();
    const found = list.find((item) => item.customName === 'sdk-test-voice');
    log(`音色列表共 ${list.length} 个，找到 sdk-test-voice: ${Boolean(found)}`);
    if (!found) {
        throw new Error('音色列表中未找到刚上传的音色');
    }

    await sf.voices.delete(voiceUri);
    log('删除成功');
});

// ---------------------------------------------------------------------------
// 5. 图像 / 视频生成
// ---------------------------------------------------------------------------
await step('generateImage 文生图（Kolors 512x512）', async () => {
    const urls = await sf.generateImage({
        model: ImageModel.KOLORS,
        prompt: '一只橘猫坐在窗台上看日落',
        size: '512x512',
        count: 1
    });
    log(`图片 URL（有效期约 1 小时，请及时下载）: ${urls[0]}`);
});

await step('generateVideo 文生视频（Wan2.2-T2V，自动轮询）', async () => {
    const result = await sf.generateVideo({
        model: VideoModel.WAN22_T2V_A14B,
        prompt: '一只橘猫在草地上奔跑，阳光明媚，电影质感',
        imageSize: '960x960',
        pollIntervalMs: 5000,
        maxWaitMs: 600_000,
        onStatus: (status) => log(`轮询状态: ${status}`)
    });
    log(`requestId: ${result.requestId}`);
    log(`视频 URL（有效期 1 小时，请及时下载）: ${result.videos[0]}`);
});

// ---------------------------------------------------------------------------
// 6. 文件 / 批量任务
// ---------------------------------------------------------------------------
let fileId = '';
let batchId = '';
await step('files 文件上传 / 列表 / 删除', async () => {
    const jsonl = [
        JSON.stringify({
            custom_id: 'r1',
            method: 'POST',
            url: '/v1/chat/completions',
            body: {model: 'deepseek-ai/DeepSeek-V3', messages: [{role: 'user', content: '说一个字：好'}], max_tokens: 16}
        }),
        JSON.stringify({
            custom_id: 'r2',
            method: 'POST',
            url: '/v1/chat/completions',
            body: {model: 'deepseek-ai/DeepSeek-V3', messages: [{role: 'user', content: '说一个字：行'}], max_tokens: 16}
        })
    ].join('\n');

    const info = await sf.files.upload({name: 'requests.jsonl', data: jsonl}, 'batch');
    fileId = info.id;
    log(`上传成功 id: ${fileId}, filename: ${info.filename}, bytes: ${info.bytes}, line_count: ${info.line_count}`);

    const list = await sf.files.list();
    log(`文件列表共 ${list.length} 个，包含刚上传的: ${list.some((f) => f.id === fileId)}`);
    if (!list.some((f) => f.id === fileId)) {
        throw new Error('文件列表中未找到刚上传的文件');
    }
});

await step('batches 批量任务：创建 / 查询 / 取消', async () => {
    try {
        const batch = await sf.batches.create({
            inputFileId: fileId,
            endpoint: '/v1/chat/completions',
            completionWindow: '24h'
        });
        batchId = batch.id;
        log(`创建成功 id: ${batchId}, status: ${batch.status}`);

        const fetched = await sf.batches.get(batchId);
        log(`查询 status: ${fetched.status}, input_file_id: ${fetched.input_file_id}`);

        const list = await sf.batches.list();
        log(`批量任务列表共 ${list.length} 个，包含刚创建的: ${list.some((b) => b.id === batchId)}`);

        try {
            await sf.batches.cancel(batchId);
            log('取消成功');
        } catch (error) {
            log(`取消失败（任务可能已开始执行，不影响整体验证）: ${error instanceof Error ? error.message : error}`);
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes('402') || message.includes('balance')) {
            // 测试账号无预付费余额：接口调用本身已通过鉴权与参数校验（402 为服务端余额拦截）
            log(`⚠ 账号余额不足（402），批量任务接口已验证到服务端校验层，跳过执行验证`);
            return;
        }
        throw error;
    }
});

await step('files 清理：删除测试文件', async () => {
    if (!fileId) {
        log('无测试文件需要清理');
        return;
    }
    await sf.files.delete(fileId);
    log(`已删除 ${fileId}`);
});

// ---------------------------------------------------------------------------
// 汇总
// ---------------------------------------------------------------------------
console.log('\n================ 实测结果汇总 ================');
let failed = 0;
for (const result of results) {
    console.log(`${result.ok ? '✓' : '✗'} ${result.name}${result.ok ? '' : ` — ${result.detail}`}`);
    if (!result.ok) {
        failed++;
    }
}
console.log('=============================================');
console.log(`通过 ${results.length - failed}/${results.length}`);
if (failed > 0) {
    process.exit(1);
}
