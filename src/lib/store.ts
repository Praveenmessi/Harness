import { get, set, del } from "idb-keyval";
import type { Session, Message, Doc, Provider, Settings } from "./types";

let inMemorySessions: Session[] = [];
let inMemoryMessages: Record<string, Message[]> = {};
let inMemoryDocs: Record<string, Doc[]> = {};
let idbFailed = false;

export function isIdbFailed(): boolean {
  return idbFailed;
}

export const DEFAULT_SETTINGS: Settings = {
  maxTokens: 4096,
  historyBudget: 12000,
  userName: "",
  theme: "system",
  webResultsCount: 5,
  retrievalMode: "auto",
  retrievalParts: 6,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem("switchboard_settings");
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem("switchboard_settings", JSON.stringify(s));
  } catch {}
}

export function loadPinnedModels(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem("switchboard_pinned_models");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    openai: ["gpt-4o", "gpt-4o-mini"],
    anthropic: ["claude-3-5-sonnet-20241022", "claude-3-5-haiku-20241022"],
    gemini: ["gemini-2.0-flash", "gemini-1.5-pro"],
    xai: ["grok-2-latest", "grok-2-vision-latest"],
  };
}

export function savePinnedModels(m: Record<string, string[]>): void {
  try {
    localStorage.setItem("switchboard_pinned_models", JSON.stringify(m));
  } catch {}
}

export function loadCustomModels(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem("switchboard_custom_models");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { openai: [], anthropic: [], gemini: [], xai: [] };
}

export function saveCustomModels(m: Record<string, string[]>): void {
  try {
    localStorage.setItem("switchboard_custom_models", JSON.stringify(m));
  } catch {}
}

export function loadCachedModels(): Record<string, { id: string; label: string }[]> {
  try {
    const raw = localStorage.getItem("switchboard_cached_models");
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

export function saveCachedModels(p: string, list: { id: string; label: string }[]): void {
  try {
    const current = loadCachedModels();
    current[p] = list;
    localStorage.setItem("switchboard_cached_models", JSON.stringify(current));
  } catch {}
}

export function getActiveModelPreference(): { provider: Provider; model: string } {
  try {
    const raw = localStorage.getItem("switchboard_default_model");
    if (raw) return JSON.parse(raw);
  } catch {}
  return { provider: "openai", model: "gpt-4o" };
}

export function saveActiveModelPreference(pref: { provider: Provider; model: string }): void {
  try {
    localStorage.setItem("switchboard_default_model", JSON.stringify(pref));
  } catch {}
}

export async function getSessions(): Promise<Session[]> {
  try {
    const list = await get<Session[]>("sessions");
    if (list && Array.isArray(list)) {
      inMemorySessions = list;
      return list;
    }
  } catch {
    idbFailed = true;
  }
  return inMemorySessions;
}

export async function saveSessions(sessions: Session[]): Promise<void> {
  inMemorySessions = [...sessions];
  try {
    await set("sessions", sessions);
  } catch (e: any) {
    if (e?.name === "QuotaExceededError") throw e;
    idbFailed = true;
  }
}

export async function getMessages(sessionId: string): Promise<Message[]> {
  try {
    const list = await get<Message[]>(`msgs:${sessionId}`);
    if (list && Array.isArray(list)) {
      // Fix any messages stuck in streaming on reload
      const fixed = list.map((m) => (m.status === "streaming" ? { ...m, status: "stopped" as const } : m));
      inMemoryMessages[sessionId] = fixed;
      return fixed;
    }
  } catch {
    idbFailed = true;
  }
  const mem = inMemoryMessages[sessionId] || [];
  return mem.map((m) => (m.status === "streaming" ? { ...m, status: "stopped" as const } : m));
}

export async function saveMessages(sessionId: string, messages: Message[]): Promise<void> {
  inMemoryMessages[sessionId] = [...messages];
  try {
    await set(`msgs:${sessionId}`, messages);
  } catch (e: any) {
    if (e?.name === "QuotaExceededError") throw e;
    idbFailed = true;
  }
}

export async function getDocs(sessionId: string): Promise<Doc[]> {
  try {
    const list = await get<Doc[]>(`docs:${sessionId}`);
    if (list && Array.isArray(list)) {
      inMemoryDocs[sessionId] = list;
      return list;
    }
  } catch {
    idbFailed = true;
  }
  return inMemoryDocs[sessionId] || [];
}

export async function saveDocs(sessionId: string, docs: Doc[]): Promise<void> {
  inMemoryDocs[sessionId] = [...docs];
  try {
    await set(`docs:${sessionId}`, docs);
  } catch (e: any) {
    if (e?.name === "QuotaExceededError") throw e;
    idbFailed = true;
  }
}

export async function deleteSessionData(sessionId: string): Promise<void> {
  delete inMemoryMessages[sessionId];
  delete inMemoryDocs[sessionId];
  try {
    await del(`msgs:${sessionId}`);
    await del(`docs:${sessionId}`);
  } catch {
    idbFailed = true;
  }
}

export function autoGenerateTitle(firstUserMsg: string): string {
  const words = firstUserMsg.trim().split(/\s+/).slice(0, 6);
  let title = words.join(" ");
  if (title.length > 40) title = title.slice(0, 37) + "...";
  return title || "New session";
}

export function createNewSession(provider: Provider = "openai", model = "gpt-4o"): Session {
  const now = Date.now();
  return {
    id: "sess_" + Math.random().toString(36).slice(2, 10) + "_" + now,
    title: "New session",
    createdAt: now,
    updatedAt: now,
    provider,
    model,
    systemPrompt: "",
    webSearch: false,
  };
}
