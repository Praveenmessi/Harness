import { readSSE } from "../sse";
import { throwIfBad } from "../errors";
import type { ChatArgs } from "./types";

const BASE: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  xai: "https://api.x.ai/v1",
};

export async function listOpenAICompat(provider: "openai" | "xai", key: string) {
  const r = await fetch(`${BASE[provider]}/models`, { headers: { Authorization: `Bearer ${key}` } });
  await throwIfBad(r);
  const j: any = await r.json();
  const ids: string[] = (j.data || []).map((m: any) => m.id);
  const bad = /(embed|whisper|tts|audio|realtime|transcribe|image|dall-e|moderation|search|instruct|babbage|davinci|sora|imagine|vision-preview)/i;
  const keep = provider === "openai"
    ? ids.filter(id => /^(gpt-|o\d|chatgpt-)/i.test(id) && !bad.test(id))
    : ids.filter(id => /grok/i.test(id) && !bad.test(id));
  return keep.sort((a, b) => b.localeCompare(a)).map(id => ({ id, label: id }));
}

export async function streamOpenAICompat(provider: "openai" | "xai", a: ChatArgs) {
  const messages = [
    ...(a.system ? [{ role: "system", content: a.system }] : []),
    ...a.messages,
  ];
  const body: any = { model: a.model, messages, stream: true };
  if (provider === "openai") {
    body.max_completion_tokens = a.maxTokens;
    body.stream_options = { include_usage: true };
  } else {
    body.max_tokens = a.maxTokens;
  }
  const r = await fetch(`${BASE[provider]}/chat/completions`, {
    method: "POST", signal: a.signal,
    headers: { Authorization: `Bearer ${a.key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfBad(r);
  let got = false, finish = "";
  for await (const data of readSSE(r.body!)) {
    if (data === "[DONE]") break;
    let j: any; try { j = JSON.parse(data); } catch { continue; }
    if (j.error) throw new Error(`MODEL_ERR: ${j.error.message || "Provider error"}`);
    const t = j.choices?.[0]?.delta?.content;
    if (t) { got = true; a.emit({ type: "delta", text: t }); }
    if (j.choices?.[0]?.finish_reason) finish = j.choices[0].finish_reason;
    if (j.usage) a.emit({ type: "usage", input: j.usage.prompt_tokens ?? 0, output: j.usage.completion_tokens ?? 0 });
  }
  endCheck(got, finish === "length", finish === "content_filter", a);
}

export function endCheck(got: boolean, hitLimit: boolean, blocked: boolean, a: ChatArgs) {
  if (!got) {
    if (hitLimit) throw new Error("MODEL_EMPTY: The model returned no text. It used all output tokens (probably on thinking). Raise 'Max output tokens' in Settings to 8000 or more.");
    if (blocked) throw new Error("MODEL_EMPTY: The model blocked this request for safety reasons. Rephrase and try again.");
    throw new Error("MODEL_EMPTY: The model returned an empty reply. Try again or pick another model.");
  }
  if (hitLimit) a.emit({ type: "notice", message: "Reply was cut off at the token limit. Raise 'Max output tokens' in Settings to get longer answers." });
}
