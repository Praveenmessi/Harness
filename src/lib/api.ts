import type { ModelInfo, Provider, SourceLink, MailSummary, MailDetail } from "./types";

export async function streamChat(
  body: object,
  key: string,
  signal: AbortSignal,
  on: (e: any) => void,
) {
  let res: Response;
  try {
    res = await fetch("/api/chat", {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", "X-Provider-Key": key },
      body: JSON.stringify(body),
    });
  } catch (e: any) {
    if (e?.name === "AbortError") throw e;
    throw new Error("Can't reach the Switchboard server. Check your internet and try again.");
  }
  if (!res.ok || !res.body) {
    let msg = `Server error ${res.status}.`;
    try {
      const j = await res.json();
      if (j?.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let sawEnd = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      for (const line of block.split("\n")) {
        if (!line.startsWith("data:")) continue;
        try {
          const e = JSON.parse(line.slice(5).trim());
          if (e.type === "done" || e.type === "error") sawEnd = true;
          on(e);
        } catch {}
      }
    }
  }
  if (!sawEnd) throw new Error("The connection dropped before the reply finished. Press Retry.");
}

export async function fetchModels(provider: Provider, key: string): Promise<ModelInfo[]> {
  const r = await fetch(`/api/models?provider=${provider}`, {
    headers: { "X-Provider-Key": key },
  });
  if (!r.ok) {
    let msg = `Error ${r.status}`;
    try {
      const j = await r.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  const j = await r.json();
  return j.models || [];
}

export async function fetchSearch(
  query: string,
  key: string,
  maxResults = 5,
): Promise<SourceLink[]> {
  const r = await fetch("/api/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Provider-Key": key,
    },
    body: JSON.stringify({ query, maxResults }),
  });
  if (!r.ok) {
    let msg = `Search error ${r.status}`;
    try {
      const j = await r.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  const j = await r.json();
  return (j.results || []).map((x: any) => ({
    title: x.title,
    url: x.url,
    content: x.content,
  }));
}

export async function fetchMailTest(user: string, pass: string): Promise<{ ok: boolean; email: string }> {
  const r = await fetch("/api/mail/test", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mail-User": user,
      "X-Mail-Pass": pass,
    },
    body: JSON.stringify({}),
  });
  if (!r.ok) {
    let msg = "Connection failed";
    try {
      const j = await r.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return await r.json();
}

export async function fetchMailList(user: string, pass: string, query = ""): Promise<MailSummary[]> {
  const r = await fetch("/api/mail/list", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mail-User": user,
      "X-Mail-Pass": pass,
    },
    body: JSON.stringify({ query }),
  });
  if (!r.ok) {
    let msg = "Failed to list emails";
    try {
      const j = await r.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  const j = await r.json();
  return j.messages || [];
}

export async function fetchMailGet(user: string, pass: string, uid: number): Promise<MailDetail> {
  const r = await fetch("/api/mail/get", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mail-User": user,
      "X-Mail-Pass": pass,
    },
    body: JSON.stringify({ uid }),
  });
  if (!r.ok) {
    let msg = "Failed to fetch email";
    try {
      const j = await r.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  const j = await r.json();
  return j.message;
}

export async function fetchMailDraft(
  user: string,
  pass: string,
  draft: {
    to: string;
    subject: string;
    body: string;
    inReplyTo?: string;
    references?: string[];
  },
): Promise<{ ok: boolean }> {
  const r = await fetch("/api/mail/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Mail-User": user,
      "X-Mail-Pass": pass,
    },
    body: JSON.stringify(draft),
  });
  if (!r.ok) {
    let msg = "Failed to save draft to Gmail";
    try {
      const j = await r.json();
      if (j.error) msg = j.error;
    } catch {}
    throw new Error(msg);
  }
  return await r.json();
}
