import express from "express";
import path from "node:path";
import { streamOpenAICompat, listOpenAICompat } from "./server/providers/openai";
import { streamAnthropic, listAnthropic } from "./server/providers/anthropic";
import { streamGemini, listGemini } from "./server/providers/gemini";
import { friendlyError } from "./server/errors";
import { tavilySearch } from "./server/search";
import { mailCreds, mailTest, mailList, mailGet, mailSaveDraft, MailError } from "./server/mail";

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const PROVIDERS = ["openai", "anthropic", "gemini", "xai"] as const;
type Provider = typeof PROVIDERS[number];

app.use(express.json({ limit: "5mb" }));

// tiny in-memory rate limit: 60 req/min/IP
const hits = new Map<string, { n: number; t: number }>();
app.use("/api", (req, res, next) => {
  const ip = req.ip || "x";
  const now = Date.now();
  const h = hits.get(ip) ?? { n: 0, t: now };
  if (now - h.t > 60_000) { h.n = 0; h.t = now; }
  h.n++; hits.set(ip, h);
  if (h.n > 60) return res.status(429).json({ error: "Too many requests. Wait a minute." });
  next();
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

function readKey(req: express.Request): string {
  return String(req.header("x-provider-key") || "").trim();
}
function isProvider(p: unknown): p is Provider {
  return typeof p === "string" && (PROVIDERS as readonly string[]).includes(p);
}

app.get("/api/models", async (req, res) => {
  const provider = req.query.provider;
  const key = readKey(req);
  if (!isProvider(provider)) return res.status(400).json({ error: "Unknown provider." });
  if (!key) return res.status(400).json({ error: "No API key sent." });
  try {
    const models =
      provider === "anthropic" ? await listAnthropic(key) :
      provider === "gemini"    ? await listGemini(key) :
                                 await listOpenAICompat(provider, key);
    res.json({ models });
  } catch (e) {
    const f = friendlyError(provider, e);
    res.status(f.status).json({ error: f.message });
  }
});

app.post("/api/chat", async (req, res) => {
  const { provider, model, system, messages, maxTokens } = req.body ?? {};
  const key = readKey(req);
  if (!isProvider(provider)) return res.status(400).json({ error: "Unknown provider." });
  if (!key) return res.status(400).json({ error: "No API key sent." });
  if (!model || typeof model !== "string") return res.status(400).json({ error: "No model selected." });
  if (!Array.isArray(messages) || messages.length === 0) return res.status(400).json({ error: "No messages." });

  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const ac = new AbortController();
  res.on("close", () => { if (!res.writableEnded) ac.abort(); });
  const send = (o: object) => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(o)}\n\n`); };
  const ping = setInterval(() => { if (!res.writableEnded) res.write(": ping\n\n"); }, 15_000);

  const args = {
    model, system: typeof system === "string" ? system : "",
    messages, maxTokens: Math.min(Math.max(Number(maxTokens) || 4096, 256), 64000),
    key, signal: ac.signal, emit: send,
  };
  try {
    if (provider === "anthropic") await streamAnthropic(args);
    else if (provider === "gemini") await streamGemini(args);
    else await streamOpenAICompat(provider, args);
    send({ type: "done" });
  } catch (e: any) {
    if (e?.name !== "AbortError") send({ type: "error", message: friendlyError(provider, e).message });
  } finally {
    clearInterval(ping);
    if (!res.writableEnded) res.end();
  }
});

app.post("/api/search", async (req, res) => {
  const key = readKey(req);
  const query = String(req.body?.query || "").trim().slice(0, 380);
  const maxResults = Math.min(Math.max(Number(req.body?.maxResults) || 5, 1), 10);
  if (!key) return res.status(400).json({ error: "No Tavily key. Add it in Keys." });
  if (!query) return res.status(400).json({ error: "Search query is empty." });
  try {
    res.json({ results: await tavilySearch(key, query, maxResults) });
  } catch (e) {
    const f = friendlyError("tavily", e);
    res.status(f.status).json({ error: f.message });
  }
});

// Gmail routes
function mailRoute(fn: (user: string, pass: string, body: any) => Promise<any>) {
  return async (req: express.Request, res: express.Response) => {
    try {
      const { user, pass } = mailCreds(req.header("x-mail-user"), req.header("x-mail-pass"));
      res.json(await fn(user, pass, req.body || {}));
    } catch (e: any) {
      if (e instanceof MailError) return res.status(e.status).json({ error: e.message });
      res.status(502).json({ error: "Gmail request failed. Try again." });   // never echo raw errors
    }
  };
}
app.post("/api/mail/test",  mailRoute((u, p) => mailTest(u, p)));
app.post("/api/mail/list",  mailRoute(async (u, p, b) => ({ messages: await mailList(u, p, String(b.query || "").slice(0, 200)) })));
app.post("/api/mail/get",   mailRoute(async (u, p, b) => {
  const uid = Number(b.uid);
  if (!Number.isInteger(uid) || uid <= 0) throw new MailError(400, "Bad email id.");
  return { message: await mailGet(u, p, uid) };
}));
app.post("/api/mail/draft", mailRoute(async (u, p, b) => mailSaveDraft(u, p, {
  to: String(b.to || "").trim(),
  subject: String(b.subject || "").slice(0, 300),
  body: String(b.body || "").slice(0, 50000),
  inReplyTo: b.inReplyTo ? String(b.inReplyTo) : undefined,
  references: Array.isArray(b.references) ? b.references.map(String).slice(0, 50) : [],
})));

app.use("/api", (_req, res) => res.status(404).json({ error: "Not found." }));

if (process.env.NODE_ENV !== "production") {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
} else {
  const dist = path.resolve("dist");
  app.use(express.static(dist));
  app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
}

app.listen(PORT, "0.0.0.0", () => console.log(`Switchboard on :${PORT}`));
