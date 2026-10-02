import { readSSE } from "../sse";
import { throwIfBad } from "../errors";
import { endCheck } from "./openai";
import type { ChatArgs } from "./types";

const H = (key: string) => ({
  "x-api-key": key,
  "anthropic-version": "2023-06-01",
  "Content-Type": "application/json"
});

export async function listAnthropic(key: string) {
  const r = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: H(key) });
  await throwIfBad(r);
  const j: any = await r.json();
  return (j.data || []).map((m: any) => ({ id: m.id, label: m.display_name || m.id }));
}

export async function streamAnthropic(a: ChatArgs) {
  const body: any = { model: a.model, max_tokens: a.maxTokens, messages: a.messages, stream: true };
  if (a.system) body.system = a.system;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", signal: a.signal, headers: H(a.key), body: JSON.stringify(body),
  });
  await throwIfBad(r);
  let got = false, stop = "", input = 0, output = 0;
  for await (const data of readSSE(r.body!)) {
    let j: any; try { j = JSON.parse(data); } catch { continue; }
    if (j.type === "message_start") input = j.message?.usage?.input_tokens ?? 0;
    else if (j.type === "content_block_delta" && j.delta?.type === "text_delta") {
      got = true; a.emit({ type: "delta", text: j.delta.text });
    } else if (j.type === "message_delta") {
      output = j.usage?.output_tokens ?? output; stop = j.delta?.stop_reason || stop;
    } else if (j.type === "error") {
      throw new Error(`MODEL_ERR: Anthropic: ${j.error?.message || "stream error"}`);
    }
  }
  a.emit({ type: "usage", input, output });
  endCheck(got, stop === "max_tokens", stop === "refusal", a);
}
