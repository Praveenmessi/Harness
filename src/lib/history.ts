type M = { role: "user" | "assistant"; content: string };

export function buildHistory(
  all: { role: "user" | "assistant"; text: string; status?: string }[],
  budgetTokens: number,
): { msgs: M[]; trimmed: boolean } {
  // 1) keep only finished, non-empty messages (+ the new user message which is last)
  const m: M[] = all
    .filter((x) => x.text && x.text.trim() && x.status !== "error" && x.status !== "streaming")
    .map((x) => ({ role: x.role, content: x.text }));

  // 2) merge consecutive same-role messages
  const merged: M[] = [];
  for (const x of m) {
    const last = merged[merged.length - 1];
    if (last && last.role === x.role) {
      last.content += "\n\n" + x.content;
    } else {
      merged.push({ ...x });
    }
  }

  // 3) trim from the front to fit budget (chars/4), always keep the last message
  const est = (s: string) => Math.ceil(s.length / 4);
  let total = 0;
  const out: M[] = [];
  for (let i = merged.length - 1; i >= 0; i--) {
    const t = est(merged[i].content);
    if (out.length > 0 && total + t > budgetTokens) break;
    total += t;
    out.unshift(merged[i]);
  }

  // 4) must start with a user message (Anthropic + Gemini require it)
  while (out.length && out[0].role !== "user") {
    out.shift();
  }

  return { msgs: out, trimmed: out.length < merged.length };
}
