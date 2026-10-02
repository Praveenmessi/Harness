export class UpstreamError extends Error {
  constructor(public status: number, public detail: string) { super(detail); }
}

export async function throwIfBad(r: Response) {
  if (r.ok) return;
  let detail = "";
  try {
    const t = await r.text();
    try {
      const j = JSON.parse(t);
      detail = j?.error?.message || (typeof j?.error === "string" ? j.error : "") || j?.message || t;
    } catch { detail = t; }
  } catch {}
  throw new UpstreamError(r.status, String(detail).slice(0, 300));
}

const NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  gemini: "Google Gemini",
  xai: "xAI",
  tavily: "Tavily"
};

export function friendlyError(provider: string, e: any): { status: number; message: string } {
  const name = NAMES[provider] || provider;
  if (e instanceof UpstreamError) {
    const s = e.status;
    const d = e.detail ? ` (${e.detail})` : "";
    if (s === 401 || s === 403) return { status: 401, message: `${name}: the API key was rejected. Check you copied the whole key and that billing is set up.${d}` };
    if (s === 404) return { status: 404, message: `${name}: model not found or your key has no access to it.${d}` };
    if (s === 429) return { status: 429, message: provider === "tavily"
      ? `Tavily: free search credits used up for this month (or too many searches at once). Turn off Web search, or wait for the reset on the 1st.${d}`
      : `${name}: rate limit or out of credits. Wait a minute or check your billing.${d}` };
    if (s === 432 || s === 433) return { status: 429, message: `Tavily: plan limit reached. Search is paused until your credits reset on the 1st.${d}` };
    if (s === 400) return { status: 400, message: `${name}: request rejected.${d}` };
    if (s >= 500) return { status: 502, message: `${name} is having problems right now. Try again in a minute.${d}` };
    return { status: 502, message: `${name}: error ${s}.${d}` };
  }
  if (e?.message?.startsWith?.("MODEL_")) return { status: 502, message: e.message.replace(/^MODEL_\w+: /, "") };
  return { status: 502, message: `${name}: could not reach the provider. Check the server's internet connection.` };
}
