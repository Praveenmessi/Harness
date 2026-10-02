import { readSSE } from "../sse";
import { throwIfBad } from "../errors";
import { endCheck } from "./openai";
import type { ChatArgs } from "./types";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export async function listGemini(key: string) {
  const r = await fetch(`${BASE}/models?pageSize=1000`, { headers: { "x-goog-api-key": key } });
  await throwIfBad(r);
  const j: any = await r.json();
  return (j.models || [])
    .filter((m: any) => (m.supportedGenerationMethods || []).includes("generateContent") && /gemini/i.test(m.name) && !/(embedding|image|tts|audio|live)/i.test(m.name))
    .map((m: any) => ({ id: String(m.name).replace(/^models\//, ""), label: m.displayName || m.name }))
    .sort((x: any, y: any) => y.id.localeCompare(x.id));
}

export async function streamGemini(a: ChatArgs) {
  const body: any = {
    contents: a.messages.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { maxOutputTokens: a.maxTokens },
  };
  if (a.system) body.systemInstruction = { parts: [{ text: a.system }] };
  const r = await fetch(`${BASE}/models/${encodeURIComponent(a.model)}:streamGenerateContent?alt=sse`, {
    method: "POST", signal: a.signal,
    headers: { "x-goog-api-key": a.key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  await throwIfBad(r);
  let got = false, finish = "", input = 0, output = 0, blocked = false;
  for await (const data of readSSE(r.body!)) {
    let j: any; try { j = JSON.parse(data); } catch { continue; }
    if (j.error) throw new Error(`MODEL_ERR: Google Gemini: ${j.error.message}`);
    if (j.promptFeedback?.blockReason) blocked = true;
    const c = j.candidates?.[0];
    for (const p of c?.content?.parts || []) {
      if (p.text && !p.thought) { got = true; a.emit({ type: "delta", text: p.text }); }
    }
    if (c?.finishReason) finish = c.finishReason;
    if (j.usageMetadata) { input = j.usageMetadata.promptTokenCount ?? input; output = j.usageMetadata.candidatesTokenCount ?? output; }
  }
  a.emit({ type: "usage", input, output });
  endCheck(got, finish === "MAX_TOKENS", blocked || ["SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "RECITATION"].includes(finish), a);
}
