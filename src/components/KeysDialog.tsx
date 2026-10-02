import React, { useState, useEffect, useRef } from "react";
import {
  X,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  KeyRound,
  Mail,
  Globe,
} from "lucide-react";
import type { ApiKeys, Provider } from "../lib/types";
import {
  cleanKey,
  cleanGmailAddress,
  cleanGmailPassword,
  validateGmailCredentials,
  checkKeyPrefixWarning,
  isRememberKeysEnabled,
  setRememberKeysEnabled,
  saveApiKeys,
  clearAllApiKeys,
  checkStorageBlocked,
} from "../lib/keys";
import { fetchModels, fetchSearch, fetchMailTest } from "../lib/api";
import { ConfirmModal } from "./ConfirmModal";

interface KeysDialogProps {
  isOpen: boolean;
  onClose: () => void;
  keys: ApiKeys;
  onKeysChange: (newKeys: ApiKeys) => void;
  initialScrollTarget?: "tavily" | "gmail" | null;
  onKeysTestedSuccess?: (provider: Provider, modelsCount: number) => void;
}

interface TestState {
  loading: boolean;
  success?: boolean;
  message?: string;
}

export const KeysDialog: React.FC<KeysDialogProps> = ({
  isOpen,
  onClose,
  keys,
  onKeysChange,
  initialScrollTarget,
  onKeysTestedSuccess,
}) => {
  const [localKeys, setLocalKeys] = useState<ApiKeys>(keys);
  const [remember, setRemember] = useState(isRememberKeysEnabled());
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [testStates, setTestStates] = useState<Record<string, TestState>>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const tavilyRef = useRef<HTMLDivElement>(null);
  const gmailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalKeys(keys);
    setRemember(isRememberKeysEnabled());
  }, [keys, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (initialScrollTarget === "tavily" && tavilyRef.current) {
      setTimeout(() => {
        tavilyRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    } else if (initialScrollTarget === "gmail" && gmailRef.current) {
      setTimeout(() => {
        gmailRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 100);
    }
  }, [isOpen, initialScrollTarget]);

  if (!isOpen) return null;

  const handleKeyChange = (field: keyof ApiKeys, rawValue: string) => {
    let cleaned = rawValue;
    if (field === "gmailUser") {
      cleaned = cleanGmailAddress(rawValue);
    } else if (field === "gmailPass") {
      cleaned = cleanGmailPassword(rawValue);
    } else {
      cleaned = cleanKey(rawValue);
    }
    const updated = { ...localKeys, [field]: cleaned };
    setLocalKeys(updated);
    saveApiKeys(updated);
    onKeysChange(updated);

    // Reset test state for that provider
    setTestStates((prev) => ({ ...prev, [field]: { loading: false } }));
  };

  const handleRememberToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setRemember(val);
    setRememberKeysEnabled(val);
  };

  const handleClearAll = () => {
    clearAllApiKeys();
    const emptyKeys: ApiKeys = {};
    setLocalKeys(emptyKeys);
    onKeysChange(emptyKeys);
    setTestStates({});
    setShowClearConfirm(false);
  };

  const testProviderKey = async (provider: Provider) => {
    const key = localKeys[provider];
    if (!key) {
      setTestStates((prev) => ({
        ...prev,
        [provider]: { loading: false, success: false, message: "No API key entered." },
      }));
      return;
    }

    setTestStates((prev) => ({ ...prev, [provider]: { loading: true } }));
    try {
      const models = await fetchModels(provider, key);
      const count = models.length;
      setTestStates((prev) => ({
        ...prev,
        [provider]: { loading: false, success: true, message: `Works · ${count} models` },
      }));
      onKeysTestedSuccess?.(provider, count);
    } catch (e: any) {
      setTestStates((prev) => ({
        ...prev,
        [provider]: {
          loading: false,
          success: false,
          message: e?.message || "Failed to reach provider.",
        },
      }));
    }
  };

  const testTavilyKey = async () => {
    const key = localKeys.tavily;
    if (!key) {
      setTestStates((prev) => ({
        ...prev,
        tavily: { loading: false, success: false, message: "No Tavily key entered." },
      }));
      return;
    }

    setTestStates((prev) => ({ ...prev, tavily: { loading: true } }));
    try {
      await fetchSearch("test", key, 1);
      setTestStates((prev) => ({
        ...prev,
        tavily: { loading: false, success: true, message: "Works" },
      }));
    } catch (e: any) {
      setTestStates((prev) => ({
        ...prev,
        tavily: {
          loading: false,
          success: false,
          message: e?.message || "Failed to test Tavily key.",
        },
      }));
    }
  };

  const testGmail = async () => {
    const email = localKeys.gmailUser || "";
    const pass = localKeys.gmailPass || "";

    const validationError = validateGmailCredentials(email, pass);
    if (validationError) {
      setTestStates((prev) => ({
        ...prev,
        gmail: { loading: false, success: false, message: validationError },
      }));
      return;
    }

    setTestStates((prev) => ({ ...prev, gmail: { loading: true } }));
    try {
      const res = await fetchMailTest(email, pass);
      setTestStates((prev) => ({
        ...prev,
        gmail: { loading: false, success: true, message: `Connected as ${res.email}` },
      }));
    } catch (e: any) {
      setTestStates((prev) => ({
        ...prev,
        gmail: {
          loading: false,
          success: false,
          message: e?.message || "Failed to connect to Gmail.",
        },
      }));
    }
  };

  const modelProviders: {
    id: Provider;
    label: string;
    sublabel: string;
    placeholder: string;
    link: string;
  }[] = [
    {
      id: "openai",
      label: "OpenAI (GPT)",
      sublabel: "primary",
      placeholder: "sk-...",
      link: "https://platform.openai.com/api-keys",
    },
    {
      id: "gemini",
      label: "Google (Gemini)",
      sublabel: "primary, free tier",
      placeholder: "AIza...",
      link: "https://aistudio.google.com/apikey",
    },
    {
      id: "anthropic",
      label: "Anthropic (Claude)",
      sublabel: "optional",
      placeholder: "sk-ant-...",
      link: "https://console.anthropic.com/settings/keys",
    },
    {
      id: "xai",
      label: "xAI (Grok)",
      sublabel: "optional",
      placeholder: "xai-...",
      link: "https://console.x.ai",
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
        <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white dark:bg-[#121D2C] shadow-2xl border border-[#D6E1EE] dark:border-[#24364D] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#D6E1EE] dark:border-[#24364D] shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6]">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                  API Keys & Credentials
                </h2>
                <p className="text-xs text-[#6A7B91] dark:text-[#889DB5]">
                  Bring your own keys. Works with any one provider.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 rounded-lg text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Storage Warning if blocked */}
          {checkStorageBlocked() && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/50 px-6 py-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                This browser is blocking storage. Keys are kept in memory only and will be lost when you close this tab.
              </span>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Model Providers */}
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-[#6A7B91] dark:text-[#889DB5]">
                AI Model Providers
              </div>

              {modelProviders.map((p) => {
                const value = localKeys[p.id] || "";
                const prefixWarning = checkKeyPrefixWarning(p.id, value);
                const testState = testStates[p.id] || { loading: false };
                const isVisible = showSecrets[p.id] || false;

                return (
                  <div
                    key={p.id}
                    className="p-3.5 rounded-xl border border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC]/60 dark:bg-[#142030]/40 space-y-2 transition-all hover:border-[#B8CEE5] dark:hover:border-[#334D6E]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                          {p.label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-md bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6]">
                          {p.sublabel}
                        </span>
                      </div>
                      <a
                        href={p.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#185FA5] dark:text-[#388EE6] hover:underline"
                      >
                        Get a key
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <input
                          type={isVisible ? "text" : "password"}
                          value={value}
                          onChange={(e) => handleKeyChange(p.id, e.target.value)}
                          placeholder={p.placeholder}
                          className="w-full pl-3 pr-9 py-2 text-sm font-mono rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-2 focus:ring-[#185FA5] dark:focus:ring-[#388EE6]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setShowSecrets((prev) => ({ ...prev, [p.id]: !prev[p.id] }))
                          }
                          aria-label={isVisible ? "Hide key" : "Show key"}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2]"
                        >
                          {isVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => testProviderKey(p.id)}
                        disabled={testState.loading || !value}
                        className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#E6F1FB] dark:hover:bg-[#192A40] disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
                      >
                        {testState.loading ? (
                          <span className="flex items-center gap-1.5">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Testing...
                          </span>
                        ) : (
                          "Test"
                        )}
                      </button>
                    </div>

                    {/* Prefix warning */}
                    {prefixWarning && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{prefixWarning}</span>
                      </div>
                    )}

                    {/* Test result status line */}
                    {testState.message && (
                      <div
                        className={`flex items-start gap-1.5 text-xs ${
                          testState.success
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {testState.success ? (
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        )}
                        <span className="break-words leading-snug">{testState.message}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Divider: Web Search (optional) */}
            <div ref={tavilyRef} className="pt-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px bg-[#D6E1EE] dark:bg-[#24364D] flex-1" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6A7B91] dark:text-[#889DB5] flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5" />
                  Web search (optional)
                </span>
                <div className="h-px bg-[#D6E1EE] dark:bg-[#24364D] flex-1" />
              </div>

              <div className="p-3.5 rounded-xl border border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC]/60 dark:bg-[#142030]/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                      Tavily (Web search)
                    </span>
                    <p className="text-xs text-[#6A7B91] dark:text-[#889DB5]">
                      Free plan: 1,000 searches a month, no card needed.
                    </p>
                  </div>
                  <a
                    href="https://app.tavily.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#185FA5] dark:text-[#388EE6] hover:underline"
                  >
                    Get a key
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type={showSecrets.tavily ? "text" : "password"}
                      value={localKeys.tavily || ""}
                      onChange={(e) => handleKeyChange("tavily", e.target.value)}
                      placeholder="tvly-..."
                      className="w-full pl-3 pr-9 py-2 text-sm font-mono rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-2 focus:ring-[#185FA5] dark:focus:ring-[#388EE6]"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowSecrets((prev) => ({ ...prev, tavily: !prev.tavily }))
                      }
                      aria-label={showSecrets.tavily ? "Hide key" : "Show key"}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2]"
                    >
                      {showSecrets.tavily ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={testTavilyKey}
                    disabled={testStates.tavily?.loading || !localKeys.tavily}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#E6F1FB] dark:hover:bg-[#192A40] disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
                  >
                    {testStates.tavily?.loading ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Testing...
                      </span>
                    ) : (
                      "Test"
                    )}
                  </button>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#6A7B91] dark:text-[#889DB5]">
                  <span>Testing calls Tavily search.</span>
                  <span>Uses 1 free credit.</span>
                </div>

                {checkKeyPrefixWarning("tavily", localKeys.tavily || "") && (
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{checkKeyPrefixWarning("tavily", localKeys.tavily || "")}</span>
                  </div>
                )}

                {testStates.tavily?.message && (
                  <div
                    className={`flex items-start gap-1.5 text-xs ${
                      testStates.tavily.success
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {testStates.tavily.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    )}
                    <span className="break-words leading-snug">
                      {testStates.tavily.message}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Divider: Gmail (optional) */}
            <div ref={gmailRef} className="pt-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px bg-[#D6E1EE] dark:bg-[#24364D] flex-1" />
                <span className="text-xs font-semibold uppercase tracking-wider text-[#6A7B91] dark:text-[#889DB5] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" />
                  Gmail (optional)
                </span>
                <div className="h-px bg-[#D6E1EE] dark:bg-[#24364D] flex-1" />
              </div>

              <div className="p-3.5 rounded-xl border border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC]/60 dark:bg-[#142030]/40 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                      Gmail via IMAP (Inbox & Drafts)
                    </span>
                    <p className="text-xs text-[#6A7B91] dark:text-[#889DB5] mt-0.5 leading-relaxed">
                      Needs 2-Step Verification on your Google account. This is NOT your normal Gmail password. You can revoke it any time at the link.
                    </p>
                  </div>
                  <a
                    href="https://myaccount.google.com/apppasswords"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-[#185FA5] dark:text-[#388EE6] hover:underline whitespace-nowrap"
                  >
                    How to get an App Password
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-[#6A7B91] dark:text-[#889DB5] mb-1">
                      Gmail address
                    </label>
                    <input
                      type="email"
                      value={localKeys.gmailUser || ""}
                      onChange={(e) => handleKeyChange("gmailUser", e.target.value)}
                      placeholder="your.email@gmail.com"
                      className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-[#6A7B91] dark:text-[#889DB5] mb-1">
                      16-letter App Password
                    </label>
                    <div className="relative">
                      <input
                        type={showSecrets.gmailPass ? "text" : "password"}
                        value={localKeys.gmailPass || ""}
                        onChange={(e) => handleKeyChange("gmailPass", e.target.value)}
                        placeholder="abcd efgh ijkl mnop"
                        className="w-full pl-3 pr-9 py-2 text-sm font-mono rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets((prev) => ({ ...prev, gmailPass: !prev.gmailPass }))
                        }
                        aria-label={showSecrets.gmailPass ? "Hide password" : "Show password"}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2]"
                      >
                        {showSecrets.gmailPass ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="text-[11px] text-[#6A7B91] dark:text-[#889DB5]">
                    Spaces are removed automatically.
                  </div>
                  <button
                    type="button"
                    onClick={testGmail}
                    disabled={
                      testStates.gmail?.loading ||
                      !localKeys.gmailUser ||
                      !localKeys.gmailPass
                    }
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#E6F1FB] dark:hover:bg-[#192A40] disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
                  >
                    {testStates.gmail?.loading ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Connecting...
                      </span>
                    ) : (
                      "Test connection"
                    )}
                  </button>
                </div>

                {testStates.gmail?.message && (
                  <div
                    className={`flex items-start gap-1.5 text-xs ${
                      testStates.gmail.success
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {testStates.gmail.success ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    )}
                    <span className="break-words leading-snug">
                      {testStates.gmail.message}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Storage options */}
            <div className="pt-2 border-t border-[#D6E1EE] dark:border-[#24364D] space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={handleRememberToggle}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-[#185FA5] focus:ring-[#185FA5]"
                />
                <div>
                  <span className="text-sm font-medium text-[#0F1F33] dark:text-[#E3EAF2]">
                    Remember keys on this device
                  </span>
                  <p className="text-xs text-[#6A7B91] dark:text-[#889DB5] mt-0.5">
                    {remember
                      ? "Keys are saved in this browser only (localStorage). Anyone using this browser can see them."
                      : "Keys are saved for this tab session only (sessionStorage) and cleared when closed."}
                  </p>
                </div>
              </label>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear all keys
                </button>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="px-6 py-3.5 bg-[#F7F9FC] dark:bg-[#0E1724] border-t border-[#D6E1EE] dark:border-[#24364D] flex items-center justify-between text-xs text-[#6A7B91] dark:text-[#889DB5]">
            <span>
              Keys go to this app's server only to reach the provider. They are never stored or logged there.
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] text-white font-medium transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showClearConfirm}
        title="Remove all keys?"
        message="Remove all keys from this browser? This cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={handleClearAll}
        onCancel={() => setShowClearConfirm(false)}
      />
    </>
  );
};
