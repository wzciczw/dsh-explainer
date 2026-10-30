/** The fixed persona. Short by design: the answer shape is the product. */
export const SYSTEM_PROMPT = [
    '你是 DSH 里的「快问」解释器。用户会选中对话中的一段文字来提问，或者直接问你一个问题。',
    '你的任务是用最短的篇幅把事情解释清楚。',
    '',
    '规则：',
    '1. 先给结论，再给必要解释。不要寒暄，不要复述问题，不要「好的，我来解释」。',
    '2. 默认 3 句以内；需要列举时最多 3 条。用户明确要求详细时才展开。',
    '3. 用用户提问的语言回答：中文问题用中文，英文问题用英文。',
    '4. 只解释与问题相关的部分；不编造事实、文件路径、API 或不存在的代码。',
    '5. 涉及代码时，给出最短的关键行或最小示例，不要贴大段无关代码。',
    '6. 信息不足时，先用一句话说明缺什么，再给最可能的解释。',
    '7. 用户自己提了问题时，优先回答问题，再补该有的翻译或解释。',
    '8. 消息里可能附带「文件快照」：那是从用户本机工作区读取的只读信息（修改时间、大小、内容片段）。涉及文件时间或内容时以它为准；快照里没有的文件不要编造，直接请用户给出完整路径。',
    '9. 用户没提问、选中的是英文正文（句子、段落、列表、说明文字）时：先给出完整中文翻译，译完再用一句话点出要点。不要再额外解释语法或用词。',
    '10. 用户没提问、选中的只是一个名词、术语、缩写或概念（几个词、没有构成句子，可能前后多带一两个词）时：不要翻译，直接用中文解释它是什么、为什么重要，必要时给一个最小例子。',
    '11. 用户没提问、选中的是一个问句（以问号结尾）时：直接回答它，不要翻译问题。',
    '12. 涉及「最新 / 当前 / 价格 / 发布日期」这类时效信息时：先说明你的知识可能已经过期，不要断言某个版本是「最新」；建议用主会话联网或查证。',
].join('\n');
const SELECTION_MAX = 40_000;
const QUESTION_MAX = 4_000;
/** Clean untrusted input before it enters a prompt. */
export function normalizeText(value, max) {
    if (typeof value !== 'string')
        return '';
    return value.replace(/\u0000/g, '').replace(/\r\n/g, '\n').trim().slice(0, max);
}
/** One labeled fenced block, or empty when the body is empty. */
function block(label, body) {
    return body === '' ? '' : `[${label}]\n<<<\n${body}\n>>>`;
}
const WORD = /[A-Za-z][A-Za-z'\u2019-]*/g;
const CJK = /[\u3400-\u9fff\u3040-\u30ff]/g;
const CODE = /[{}<>\x60=]|=>|\bfunction\b|\bconst\b|\bimport\b|\bdef\b|\bclass\b|\breturn\b/;
/** Unambiguous finite verbs: a noun phrase rarely contains one. */
const FINITE = /\b(is|are|was|were|be|been|has|have|had|does|do|did|can|could|will|would|shall|should|may|might|must|means|refers|describes|explains|allows|requires|contains|includes|supports|provides|creates|makes|uses|happens|works|becomes|seems|appears|shows|needs|returns|calls|says|tells|thinks|knows|sees|comes|goes|gives|takes|finds|keeps|holds|carries|brings|adds|removes|reads|writes|loads|saves|opens|closes|starts|stops|sends|receives|waits|fails|succeeds|exists)\b/i;
/** Definition frames around a term, in both languages. */
const FILLER_START = /^(?:the\s+)?(?:concept|notion|idea|term|definition|meaning)\s+of\s+|^what\s+(?:is|are)\s+|^(?:explain|define)\s+|^(?:什么是|所谓|解释一下|解释|这个词|这个概念|术语)\s*/i;
const FILLER_END = /\s*(?:的概念|这个概念|这个术语|术语|是什么意思|指的是什么|指什么|是什么|的定义)\s*[?？!！]?\s*$/;
/**
 * Classify a selection so the default answer is the one the user expects.
 *
 * - english-prose: a sentence or clause — translate it.
 * - term: a noun phrase, even with a couple of filler words around it —
 *   explain the concept instead of translating it.
 * - question: a real question — answer it.
 * - other: Chinese text, code, or anything ambiguous — explain it.
 * @param selection - the selected text, already trimmed.
 * @returns the shape that picks the default instruction.
 */
export function selectionShape(selection) {
    const original = selection.trim();
    if (original === '')
        return 'other';
    if (CODE.test(original))
        return 'other';
    let text = original.replace(FILLER_START, '').replace(FILLER_END, '').trim();
    text = text.replace(/^[「“\x22'(\[]+|[」”\x22')\]]+$/g, '').trim();
    if (text === '')
        return 'other';
    const latin = text.match(WORD) ?? [];
    const cjk = text.match(CJK) ?? [];
    if (latin.length === 0)
        return 'other';
    if (cjk.length >= latin.join('').length / 2)
        return 'other';
    if (/[?？]\s*$/.test(text))
        return 'question';
    const words = latin.length;
    const sentences = (text.match(/[.!?](?=\s+[A-Z0-9])/g) ?? []).length;
    if (words <= 2)
        return 'term';
    if (sentences >= 1)
        return 'english-prose';
    if (words >= 8)
        return 'english-prose';
    if (FINITE.test(text))
        return 'english-prose';
    return 'term';
}
/** The default instruction for a selection the user did not type a question for. */
export function defaultInstruction(shape) {
    if (shape === 'english-prose')
        return '先把这段英文完整翻译成中文，然后用一句话点出要点。';
    if (shape === 'term')
        return '解释这个术语/概念：它是什么、为什么重要，必要时给一个最小例子。';
    if (shape === 'question')
        return '直接回答选中的问题。';
    return '请解释这段文字。';
}
/** The first user turn of a quick-ask thread. */
export function composeOpening(input) {
    const selection = normalizeText(input.selection, SELECTION_MAX);
    const question = normalizeText(input.question, QUESTION_MAX);
    const parts = [];
    if (input.context !== '') {
        parts.push('以下是我正在进行的对话的只读快照，只用来理解上下文。你不需要回应它，也不要假设你能继续操作那个对话。');
        parts.push(block('当前对话的只读快照', input.context));
    }
    if (input.file !== '')
        parts.push('[当前文件]\n' + input.file);
    if (selection === '' && question === '' && input.file !== '') {
        parts.push(block('问题', '请概括这个文件并解释重点。 / Summarize this file and explain the key points.'));
    }
    if (input.files !== '')
        parts.push(block('文件快照', input.files));
    if (selection !== '') {
        parts.push(block('用户选中的文字', selection));
        parts.push(block('问题', question === '' ? defaultInstruction(selectionShape(selection)) : question));
    }
    else {
        parts.push(block('问题', question === '' ? '请简单介绍一下你自己能做什么。' : question));
    }
    return parts.join('\n\n');
}
/** A follow-up turn appended to an existing quick-ask thread. */
export function composeFollowUp(question, files = '') {
    const text = normalizeText(question, QUESTION_MAX);
    const parts = [];
    if (files !== '')
        parts.push(block('文件快照', files));
    parts.push(block('追问', text === '' ? '请再展开一点。' : text));
    return parts.join('\n\n');
}
