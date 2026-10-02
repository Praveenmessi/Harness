import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Square,
  Globe,
  FileText,
  Copy,
  Check,
  RotateCcw,
  KeyRound,
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ExternalLink,
  ChevronUp,
} from "lucide-react";
import type {
  Session,
  Message,
  Doc,
  ApiKeys,
  Provider,
  PassageRef,
} from "../lib/types";
import { MarkdownRenderer } from "./MarkdownRenderer";
import { copyText } from "../lib/email";
import { loadPinnedModels } from "../lib/store";

interface ChatViewProps {
  session: Session;
  messages: Message[];
  docs: Doc[];
  keys: ApiKeys;
  isStreaming: boolean;
  isSearchingWeb: boolean;
  serverWakingBanner: boolean;
  historyTrimmed: boolean;
  useDocuments: boolean;
  onToggleUseDocuments: (val: boolean) => void;
  onToggleWebSearch: () => void;
  onSendMessage: (text: string) => void;
  onStopStreaming: () => void;
  onRetryMessage: (msgId: string, modelOverride?: { provider: Provider; model: string }) => void;
  onOpenKeys: (target?: "tavily" | "gmail") => void;
  onSelectPassage: (p: PassageRef) => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  session,
  messages,
  docs,
  keys,
  isStreaming,
  isSearchingWeb,
  serverWakingBanner,
  historyTrimmed,
  useDocuments,
  onToggleUseDocuments,
  onToggleWebSearch,
  onSendMessage,
  onStopStreaming,
  onRetryMessage,
  onOpenKeys,
  onSelectPassage,
}) => {
  const [inputText, setInputText] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openRetryMenuId, setOpenRetryMenuId] = useState<string | null>(null);
  const [openSourcesId, setOpenSourcesId] = useState<Record<string, boolean>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNearBottomRef = useRef(true);

  const readyDocs = docs.filter((d) => d.status === "ready");
  const hasModelKey = !!keys[session.provider];
  const hasAnyKey =
    !!keys.openai || !!keys.anthropic || !!keys.gemini || !!keys.xai;

  const pinnedModels = loadPinnedModels();

  // Scroll detection to stick to bottom
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
  };

  useEffect(() => {
    if (isNearBottomRef.current && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, isSearchingWeb]);

  // Auto-grow textarea up to 8 lines (~190px)
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const maxHeight = 190;
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        maxHeight,
      )}px`;
    }
  }, [inputText]);

  const handleSend = () => {
    const trimmed = inputText.trim();
    if (!trimmed || isStreaming || !hasModelKey) return;
    setInputText("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    onSendMessage(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyMessage = async (m: Message) => {
    const ok = await copyText(m.text);
    if (ok) {
      setCopiedId(m.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Close retry menus on click elsewhere
  useEffect(() => {
    const handleDocClick = () => setOpenRetryMenuId(null);
    document.addEventListener("click", handleDocClick);
    return () => document.removeEventListener("click", handleDocClick);
  }, []);

  // Welcome state if no keys added at all
  if (!hasAnyKey && messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-full max-w-md p-8 rounded-2xl bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] shadow-xl space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br from-[#185FA5] to-[#0C447C] flex items-center justify-center text-white shadow-md">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#0F1F33] dark:text-[#E3EAF2]">
              Add an API key to start
            </h2>
            <p className="mt-1.5 text-xs text-[#6A7B91] dark:text-[#889DB5] leading-relaxed">
              Switchboard connects directly to OpenAI, Google Gemini, Anthropic, or xAI using your own API keys. Keys stay private in your browser.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenKeys()}
            className="w-full py-2.5 px-4 rounded-xl bg-[#185FA5] hover:bg-[#0C447C] text-white font-semibold text-sm shadow-xs transition"
          >
            Open Keys
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-[#0B131F]">
      {/* Waking up server banner */}
      {serverWakingBanner && (
        <div className="px-4 py-2 bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 text-xs text-[#185FA5] dark:text-[#388EE6] flex items-center justify-center gap-2 animate-in fade-in">
          <span className="w-2 h-2 rounded-full bg-[#185FA5] animate-ping" />
          <span>Waking up the server… this can take up to a minute the first time.</span>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-6"
      >
        <div className="max-w-[760px] mx-auto space-y-6">
          {/* History trimmed notice if applicable */}
          {historyTrimmed && (
            <div className="flex items-center gap-3 my-4">
              <div className="h-px bg-[#D6E1EE] dark:bg-[#24364D] flex-1" />
              <span className="text-[11px] text-[#6A7B91] dark:text-[#889DB5] italic">
                Earlier messages were not sent to the model (history limit)
              </span>
              <div className="h-px bg-[#D6E1EE] dark:bg-[#24364D] flex-1" />
            </div>
          )}

          {messages.length === 0 && (
            <div className="py-16 text-center select-none text-[#6A7B91] dark:text-[#889DB5]">
              <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-[#F7F9FC] dark:bg-[#142030] flex items-center justify-center text-[#185FA5] dark:text-[#388EE6]">
                <Globe className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                How can Switchboard help today?
              </h3>
              <p className="mt-1 text-xs">
                Switch models any time, ask about uploaded documents, or search the web.
              </p>
            </div>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";

            if (isUser) {
              return (
                <div key={m.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-[#E6F1FB] dark:bg-[#192A40] text-[#0F1F33] dark:text-[#E3EAF2] text-sm whitespace-pre-wrap leading-relaxed shadow-2xs">
                    {m.text}
                  </div>
                </div>
              );
            }

            // Assistant message
            const isError = m.status === "error";
            const isKeyError =
              isError &&
              /key|rejected|auth|401|403|billing/i.test(m.error || m.text);

            return (
              <div key={m.id} className="flex flex-col space-y-2">
                {isError ? (
                  <div className="p-4 rounded-xl border border-red-300 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 text-xs text-red-700 dark:text-red-400 space-y-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
                      <div className="flex-1 leading-relaxed">
                        {m.error || m.text}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onRetryMessage(m.id)}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition"
                      >
                        Retry
                      </button>
                      {isKeyError && (
                        <button
                          type="button"
                          onClick={() => onOpenKeys()}
                          className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-800 bg-white dark:bg-[#121D2C] text-red-700 dark:text-red-300 font-semibold transition"
                        >
                          Open Keys
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm text-[#0F1F33] dark:text-[#E3EAF2] leading-relaxed">
                      <MarkdownRenderer
                        content={m.text}
                        sources={m.sources}
                        passages={m.passages}
                        onSelectPassage={onSelectPassage}
                      />
                    </div>

                    {/* Stopped tag */}
                    {m.status === "stopped" && (
                      <span className="inline-block text-[11px] text-[#6A7B91] dark:text-[#889DB5] italic">
                        (stopped)
                      </span>
                    )}

                    {/* Amber Notice */}
                    {m.notice && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>{m.notice}</span>
                      </div>
                    )}

                    {/* Sources collapsible list */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSourcesId((prev) => ({
                              ...prev,
                              [m.id]: !prev[m.id],
                            }))
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#185FA5] dark:text-[#388EE6] hover:underline"
                        >
                          <span>Sources ({m.sources.length})</span>
                          {openSourcesId[m.id] ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {openSourcesId[m.id] && (
                          <div className="mt-2 pl-2 border-l-2 border-[#D6E1EE] dark:border-[#24364D] space-y-1.5">
                            {m.sources.map((s, idx) => {
                              let domain = s.url;
                              try {
                                domain = new URL(s.url).hostname;
                              } catch {}
                              return (
                                <div
                                  key={`src_${idx}`}
                                  className="text-xs flex items-center gap-2"
                                >
                                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[#6A7B91]">
                                    W{idx + 1}
                                  </span>
                                  <a
                                    href={s.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="truncate text-[#0F1F33] dark:text-[#E3EAF2] hover:text-[#185FA5] hover:underline flex items-center gap-1"
                                  >
                                    <span>{s.title}</span>
                                    <span className="text-[11px] text-[#6A7B91] shrink-0">
                                      ({domain})
                                    </span>
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Meta line */}
                    {m.status !== "streaming" && (
                      <div className="flex items-center gap-3 pt-1 text-[11px] text-[#6A7B91] dark:text-[#889DB5]">
                        <span className="capitalize">
                          {m.provider} · {m.model}
                        </span>
                        {m.usage && (
                          <span>
                            · in {m.usage.input} · out {m.usage.output}
                          </span>
                        )}

                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={() => handleCopyMessage(m)}
                            className="inline-flex items-center gap-1 hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] px-1.5 py-0.5 rounded transition"
                          >
                            {copiedId === m.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-500" />
                                <span>Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>

                          {/* Retry with menu */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenRetryMenuId(
                                  openRetryMenuId === m.id ? null : m.id,
                                );
                              }}
                              className="inline-flex items-center gap-0.5 hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] px-1.5 py-0.5 rounded transition"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>Retry with ▾</span>
                            </button>

                            {openRetryMenuId === m.id && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-0 bottom-6 w-52 rounded-xl bg-white dark:bg-[#121D2C] shadow-xl border border-[#D6E1EE] dark:border-[#24364D] p-1.5 z-30 space-y-1"
                              >
                                <div className="text-[10px] font-semibold text-[#6A7B91] px-2 py-1 uppercase tracking-wider">
                                  Retry with model
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenRetryMenuId(null);
                                    onRetryMessage(m.id);
                                  }}
                                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] text-[#0F1F33] dark:text-[#E3EAF2] flex items-center justify-between"
                                >
                                  <span>Current model</span>
                                  <span className="text-[10px] text-[#6A7B91]">
                                    {session.model}
                                  </span>
                                </button>

                                {Object.entries(pinnedModels).flatMap(([prov, models]) =>
                                  models.map((mod) => (
                                    <button
                                      key={`${prov}_${mod}`}
                                      type="button"
                                      onClick={() => {
                                        setOpenRetryMenuId(null);
                                        onRetryMessage(m.id, {
                                          provider: prov as Provider,
                                          model: mod,
                                        });
                                      }}
                                      className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] text-[#0F1F33] dark:text-[#E3EAF2] flex items-center justify-between"
                                    >
                                      <span className="truncate">{mod}</span>
                                      <span className="text-[10px] text-[#6A7B91] uppercase font-mono">
                                        {prov}
                                      </span>
                                    </button>
                                  )),
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Web search progress indicator */}
          {isSearchingWeb && (
            <div className="flex items-center gap-2 text-xs text-[#185FA5] dark:text-[#388EE6] italic animate-pulse">
              <Globe className="w-4 h-4 animate-spin" />
              <span>Searching the web…</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Composer Section */}
      <div className="border-t border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC]/80 dark:bg-[#0E1724]/80 p-3 sm:p-4 shrink-0">
        <div className="max-w-[760px] mx-auto space-y-2">
          {/* Controls Bar above input */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Ready Docs chips */}
              {readyDocs.length > 0 && (
                <button
                  type="button"
                  onClick={() => onToggleUseDocuments(!useDocuments)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                    useDocuments
                      ? "bg-[#E6F1FB] dark:bg-[#192A40] border-[#185FA5] text-[#185FA5] dark:text-[#388EE6]"
                      : "bg-white dark:bg-[#121D2C] border-[#D6E1EE] dark:border-[#24364D] text-[#6A7B91] hover:text-[#0F1F33]"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Use documents ({readyDocs.length})</span>
                </button>
              )}

              {/* Web Search toggle (always visible) */}
              <button
                type="button"
                onClick={onToggleWebSearch}
                title={
                  !keys.tavily
                    ? "Tavily API key required for live web search (Click to add key)"
                    : session.webSearch
                    ? "Web search is ON (uses Tavily)"
                    : "Web search is OFF"
                }
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition ${
                  session.webSearch
                    ? "bg-[#E6F1FB] dark:bg-[#192A40] border-[#185FA5] text-[#185FA5] dark:text-[#388EE6] shadow-xs"
                    : "bg-white dark:bg-[#121D2C] border-[#D6E1EE] dark:border-[#24364D] text-[#6A7B91] hover:text-[#0F1F33]"
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Web search</span>
                {session.webSearch && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                )}
                {!keys.tavily && (
                  <span className="text-[10px] px-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 font-normal">
                    Key needed
                  </span>
                )}
              </button>
            </div>

            {/* Provider/Model Hint */}
            {!hasModelKey && (
              <span className="text-[11px] text-amber-600 dark:text-amber-400">
                Add a key for {session.provider} to send
              </span>
            )}
          </div>

          {/* Textarea + Action button */}
          <div className="relative flex items-end gap-2 bg-white dark:bg-[#121D2C] rounded-2xl border border-[#D6E1EE] dark:border-[#24364D] p-2 focus-within:ring-2 focus-within:ring-[#185FA5] transition-all shadow-xs">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                !hasModelKey
                  ? `Add ${session.provider} key in Keys to chat...`
                  : "Message Switchboard... (Shift+Enter for new line)"
              }
              rows={1}
              className="flex-1 max-h-[190px] px-2 py-1 text-sm bg-transparent border-none text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none resize-none leading-relaxed"
            />

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                aria-label="Stop generating reply"
                className="p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold transition shrink-0 shadow-xs"
              >
                <Square className="w-4 h-4 fill-white" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSend}
                disabled={!inputText.trim() || !hasModelKey}
                aria-label="Send message"
                className="p-2.5 rounded-xl bg-[#185FA5] hover:bg-[#0C447C] text-white disabled:opacity-40 disabled:cursor-not-allowed transition shrink-0 shadow-xs"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
