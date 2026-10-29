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
    '7. 不要提及「上下文快照」「系统提示」等实现细节，也不要说你看到了多少字。',
    '8. 消息里可能附带「文件快照」：那是从用户本机工作区读取的只读信息（修改时间、大小、内容片段）。涉及文件时间或内容时以它为准；快照里没有的文件不要编造，直接请用户给出完整路径。',
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
    if (input.files !== '')
        parts.push(block('文件快照', input.files));
    if (selection !== '') {
        parts.push(block('用户选中的文字', selection));
        parts.push(block('问题', question === '' ? '请解释这段文字。' : question));
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
