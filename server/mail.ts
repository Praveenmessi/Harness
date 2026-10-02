import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
// @ts-ignore - CommonJS module
import MailComposer from "nodemailer/lib/mail-composer/index.js";

const ComposerClass: any = (MailComposer as any)?.default || MailComposer;

export class MailError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function mailCreds(user: unknown, pass: unknown) {
  const u = String(user || "").trim().toLowerCase();
  const p = String(pass || "").replace(/\s+/g, "");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) throw new MailError(400, "Enter a full Gmail address in Keys.");
  if (!/^[a-zA-Z]{16}$/.test(p)) throw new MailError(400, "An App Password has 16 letters. Copy it again from Google.");
  return { user: u, pass: p };
}

async function withImap<T>(user: string, pass: string, fn: (c: ImapFlow) => Promise<T>): Promise<T> {
  const c = new ImapFlow({
    host: "imap.gmail.com", port: 993, secure: true,
    auth: { user, pass },
    logger: false,                 // REQUIRED: never log (would leak credentials/mail)
    connectionTimeout: 15_000, greetingTimeout: 15_000, socketTimeout: 60_000,
  });
  c.on("error", () => {});         // REQUIRED: unhandled 'error' events crash Node
  try {
    await c.connect();
  } catch (e: any) {
    const txt = `${e?.responseText || ""} ${e?.message || ""}`;
    if (e?.authenticationFailed || /auth|credentials|password/i.test(txt))
      throw new MailError(401, "Gmail rejected the login. Use a 16-letter App Password (not your normal password). 2-Step Verification must be on.");
    throw new MailError(502, "Couldn't reach Gmail. Try again in a minute.");
  }
  try { return await fn(c); }
  finally { try { await c.logout(); } catch { c.close(); } }
}

export async function mailTest(user: string, pass: string) {
  return withImap(user, pass, async () => ({ ok: true, email: user }));
}

export async function mailList(user: string, pass: string, query: string, limit = 25) {
  return withImap(user, pass, async c => {
    const lock = await c.getMailboxLock("INBOX");
    try {
      let range: string | number[]; let byUid = true;
      if (query) {
        const found = (await c.search({ gmraw: query } as any, { uid: true })) || [];
        const ids = (found as number[]).slice(-limit);
        if (!ids.length) return [];
        range = ids;
      } else {
        const n = (c.mailbox as any)?.exists || 0;
        if (!n) return [];
        range = `${Math.max(1, n - limit + 1)}:*`; byUid = false;
      }
      const out: any[] = [];
      for await (const m of c.fetch(range as any, { uid: true, envelope: true, flags: true, internalDate: true }, { uid: byUid })) {
        const f = m.envelope?.from?.[0];
        const d = m.envelope?.date || m.internalDate;
        out.push({
          uid: m.uid,
          subject: m.envelope?.subject || "(no subject)",
          from: f ? (f.name ? `${f.name} <${f.address}>` : String(f.address)) : "(unknown sender)",
          date: d ? new Date(d as any).toISOString() : null,
          unread: !m.flags?.has("\\Seen"),
        });
      }
      return out.sort((a, b) => String(b.date).localeCompare(String(a.date)));
    } finally { lock.release(); }
  });
}

export async function mailGet(user: string, pass: string, uid: number) {
  return withImap(user, pass, async c => {
    const lock = await c.getMailboxLock("INBOX");
    try {
      const m: any = await c.fetchOne(String(uid), { source: true, flags: true }, { uid: true });
      if (!m || !m.source) throw new MailError(404, "That email no longer exists. Refresh the inbox.");
      const wasUnread = !m.flags?.has("\\Seen");
      const p = await simpleParser(m.source);
      // Opening an email in Switchboard must NOT mark it as read in Gmail
      if (wasUnread) { try { await c.messageFlagsRemove(String(uid), ["\\Seen"], { uid: true }); } catch {} }
      const refs = Array.isArray(p.references) ? p.references : (p.references ? [p.references] : []);
      const from = p.from?.value?.[0];
      const replyTo = (p.replyTo as any)?.value?.[0]?.address;
      return {
        uid,
        from: p.from?.text || "",
        replyToAddress: replyTo || from?.address || "",
        subject: p.subject || "",
        date: p.date ? p.date.toISOString() : null,
        messageId: p.messageId || "",
        references: refs,
        text: String(p.text || "").slice(0, 20000),
      };
    } finally { lock.release(); }
  });
}

export async function mailSaveDraft(user: string, pass: string, d: {
  to: string; subject: string; body: string; inReplyTo?: string; references?: string[];
}) {
  if (!d.to) throw new MailError(400, "No recipient. Add a To address.");
  if (!d.body?.trim()) throw new MailError(400, "The reply is empty.");
  const refs = [...(d.references || []), ...(d.inReplyTo ? [d.inReplyTo] : [])].filter(Boolean);
  const raw: Buffer = await new ComposerClass({
    from: user, to: d.to, subject: d.subject, text: d.body, date: new Date(),
    ...(d.inReplyTo ? { inReplyTo: d.inReplyTo } : {}),
    ...(refs.length ? { references: refs.join(" ") } : {}),
  }).compile().build();
  return withImap(user, pass, async c => {
    const boxes = await c.list();
    // Find Drafts by special-use flag (works in every Gmail language)
    const drafts = boxes.find((b: any) => b.specialUse === "\\Drafts")?.path || "[Gmail]/Drafts";
    await c.append(drafts, raw, ["\\Draft", "\\Seen"]);
    return { ok: true };
  });
}
