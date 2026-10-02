import { throwIfBad } from "./errors";

export type WebResult = { title: string; url: string; content: string };

export async function tavilySearch(key: string, query: string, maxResults: number): Promise<WebResult[]> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 20_000);
  try {
    const r = await fetch("https://api.tavily.com/search", {
      method: "POST", signal: ac.signal,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        search_depth: "basic",      // 1 credit per search. Never use "advanced" (2 credits).
        topic: "general",
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
      }),
    });
    await throwIfBad(r);
    const j: any = await r.json();
    return (j.results || [])
      .filter((x: any) => x && x.url)
      .map((x: any) => ({
        title: String(x.title || x.url).slice(0, 200),
        url: String(x.url),
        content: String(x.content || "").slice(0, 1500),
      }));
  } catch (e: any) {
    if (e?.name === "AbortError") throw new Error("MODEL_ERR: Tavily: search timed out. Try again.");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
