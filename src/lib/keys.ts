import type { ApiKeys, Provider } from "./types";

const REMEMBER_KEY = "switchboard_remember_keys";
const STORAGE_KEYS_KEY = "switchboard_api_keys";

// In-memory fallback if storage is blocked
let memoryKeys: ApiKeys = {};
let isStorageBlocked = false;

function safeGetStorage(useLocal: boolean): Storage | null {
  try {
    const s = useLocal ? window.localStorage : window.sessionStorage;
    const testKey = "__sb_test__";
    s.setItem(testKey, "1");
    s.removeItem(testKey);
    return s;
  } catch {
    isStorageBlocked = true;
    return null;
  }
}

export function isRememberKeysEnabled(): boolean {
  try {
    return window.localStorage.getItem(REMEMBER_KEY) === "true";
  } catch {
    return false;
  }
}

export function setRememberKeysEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(REMEMBER_KEY, enabled ? "true" : "false");
  } catch {
    isStorageBlocked = true;
  }

  // Transfer keys between storages
  const keys = loadApiKeys();
  try {
    if (enabled) {
      window.sessionStorage.removeItem(STORAGE_KEYS_KEY);
      window.localStorage.setItem(STORAGE_KEYS_KEY, JSON.stringify(keys));
    } else {
      window.localStorage.removeItem(STORAGE_KEYS_KEY);
      window.sessionStorage.setItem(STORAGE_KEYS_KEY, JSON.stringify(keys));
    }
  } catch {
    isStorageBlocked = true;
  }
}

export function loadApiKeys(): ApiKeys {
  if (isStorageBlocked) return { ...memoryKeys };
  const remember = isRememberKeysEnabled();
  const storage = safeGetStorage(remember);
  if (!storage) return { ...memoryKeys };

  try {
    const raw = storage.getItem(STORAGE_KEYS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      memoryKeys = { ...parsed };
      return parsed;
    }
  } catch {}

  // Check the other storage as fallback
  const fallbackStorage = safeGetStorage(!remember);
  if (fallbackStorage) {
    try {
      const raw = fallbackStorage.getItem(STORAGE_KEYS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        memoryKeys = { ...parsed };
        return parsed;
      }
    } catch {}
  }

  return { ...memoryKeys };
}

export function saveApiKeys(keys: ApiKeys): void {
  memoryKeys = { ...keys };
  const remember = isRememberKeysEnabled();
  const storage = safeGetStorage(remember);
  if (storage) {
    try {
      storage.setItem(STORAGE_KEYS_KEY, JSON.stringify(keys));
    } catch {
      isStorageBlocked = true;
    }
  }
}

export function clearAllApiKeys(): void {
  memoryKeys = {};
  try {
    window.sessionStorage.removeItem(STORAGE_KEYS_KEY);
    window.localStorage.removeItem(STORAGE_KEYS_KEY);
  } catch {
    isStorageBlocked = true;
  }
}

export function checkStorageBlocked(): boolean {
  return isStorageBlocked;
}

export function cleanKey(key: string): string {
  let k = String(key || "").trim();
  // Strip surrounding quotes
  k = k.replace(/^["'`]|["'`]$/g, "").trim();
  // Strip leading Bearer
  k = k.replace(/^Bearer\s+/i, "").trim();
  return k;
}

export function cleanGmailAddress(addr: string): string {
  return String(addr || "").trim().toLowerCase();
}

export function cleanGmailPassword(pass: string): string {
  return String(pass || "").replace(/\s+/g, "");
}

export function validateGmailCredentials(email: string, pass: string): string | null {
  const u = cleanGmailAddress(email);
  const p = cleanGmailPassword(pass);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(u)) {
    return "Enter a full email address.";
  }
  if (!/^[a-zA-Z]{16}$/.test(p)) {
    return "An App Password has 16 letters. Copy it again from Google.";
  }
  return null;
}

export function checkKeyPrefixWarning(provider: Provider | "tavily", key: string): string | null {
  const k = cleanKey(key);
  if (!k) return null;

  if (k.startsWith("sk-ant-") && provider !== "anthropic") {
    return "This looks like an Anthropic key. Move it to the Anthropic row.";
  }
  if (k.startsWith("AIza") && provider !== "gemini") {
    return "This looks like a Google Gemini key. Move it to the Google Gemini row.";
  }
  if (k.startsWith("xai-") && provider !== "xai") {
    return "This looks like an xAI key. Move it to the xAI row.";
  }
  if (k.startsWith("tvly-") && provider !== "tavily") {
    return "This looks like a Tavily key. Move it to the Tavily row.";
  }

  // Check expected prefix
  if (provider === "openai" && !k.startsWith("sk-")) {
    return "This doesn't look like an OpenAI key. Test it to be sure.";
  }
  if (provider === "anthropic" && !k.startsWith("sk-ant-")) {
    return "This doesn't look like an Anthropic key. Test it to be sure.";
  }
  if (provider === "gemini" && !k.startsWith("AIza")) {
    return "This doesn't look like a Google Gemini key. Test it to be sure.";
  }
  if (provider === "xai" && !k.startsWith("xai-")) {
    return "This doesn't look like an xAI key. Test it to be sure.";
  }
  if (provider === "tavily" && !k.startsWith("tvly-")) {
    return "This doesn't look like a Tavily key. Test it to be sure.";
  }

  return null;
}
