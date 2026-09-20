/** 日更视频展示门槛：与 config/video-fetch.yaml 的关键词/拒绝表对齐。 */

export const VIDEO_REJECT_RE = /涉黄|绕过审核|锟斤拷|\uFFFD/;

/** 英文用词边界；不含 bilibili/哔哩。`ai` 不能当子串。 */
export const VIDEO_AI_RE =
  /(?:\b(?:chatgpt|claude|gemini|deepseek|cursor|copilot|codex|kimi|qwen|prompt|llm|gpt|openai|anthropic|agent)\b|\bai\b|通义|豆包|大模型|人工智能|智能体)/i;

export function isDisplayableVideo(video) {
  const text = `${video?.title || ''} ${video?.summary || ''}`;
  if (!text.trim()) return false;
  if (text.includes('\uFFFD') || VIDEO_REJECT_RE.test(text)) return false;
  return VIDEO_AI_RE.test(text);
}
