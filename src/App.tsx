import { useState, useEffect, useRef, useTransition } from "react";
import type MiniSearch from "minisearch";
import type {
  Session,
  Message,
  Doc,
  ApiKeys,
  Settings,
  Provider,
  PassageRef,
  SourceLink,
} from "./lib/types";
import {
  loadApiKeys,
  saveApiKeys,
} from "./lib/keys";
import {
  loadSettings,
  saveSettings,
  getSessions,
  saveSessions,
  getMessages,
  saveMessages,
  getDocs,
  saveDocs,
  deleteSessionData,
  createNewSession,
  autoGenerateTitle,
  isIdbFailed,
  getActiveModelPreference,
  saveActiveModelPreference,
} from "./lib/store";
import { buildHistory } from "./lib/history";
import {
  createDocsSearchIndex,
  getRelevantPassages,
  formatDocumentsPrompt,
  DOCS_SYSTEM_PROMPT,
} from "./lib/docs";
import {
  runWebSearch,
  formatWebResultsPrompt,
  WEB_SYSTEM_PROMPT,
} from "./lib/web";
import { streamChat } from "./lib/api";

import { TopBar } from "./components/TopBar";
import { Sidebar } from "./components/Sidebar";
import { RightPanel } from "./components/RightPanel";
import { ChatView } from "./components/ChatView";
import { DocsView } from "./components/DocsView";
import { EmailView } from "./components/EmailView";
import { KeysDialog } from "./components/KeysDialog";
import { SettingsDialog } from "./components/SettingsDialog";
import { PassageDrawer } from "./components/PassageDrawer";
import { Toasts, type ToastItem } from "./components/Toasts";

export default function App() {
  const [keys, setKeys] = useState<ApiKeys>(loadApiKeys());
  const [settings, setSettings] = useState<Settings>(loadSettings());
  const [activeTab, setActiveTab] = useState<"chat" | "docs" | "email">("chat");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);

  // Search index for RAG
  const searchIndexRef = useRef<MiniSearch | null>(null);

  // UI state
  const [isKeysOpen, setIsKeysOpen] = useState(false);
  const [keysTarget, setKeysTarget] = useState<"tavily" | "gmail" | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSidebarOpenMobile, setIsSidebarOpenMobile] = useState(false);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [selectedPassage, setSelectedPassage] = useState<PassageRef | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  // Chat Streaming State
  const [isStreaming, setIsStreaming] = useState(false);
  const [isSearchingWeb, setIsSearchingWeb] = useState(false);
  const [serverWakingBanner, setServerWakingBanner] = useState(false);
  const [historyTrimmed, setHistoryTrimmed] = useState(false);
  const [useDocuments, setUseDocuments] = useState(true);

  const abortControllerRef = useRef<AbortController | null>(null);
  const wakingTimerRef = useRef<any>(null);
  const [, startTransition] = useTransition();

  // Helper for toasts
  const addToast = (
    message: string,
    type: "info" | "success" | "error" | "warning" = "info",
    action?: { label: string; href?: string; onClick?: () => void },
  ) => {
    const id = "toast_" + Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    const isDark =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);

    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [settings.theme]);

  // Initial load
  useEffect(() => {
    async function init() {
      const loadedSessions = await getSessions();
      if (loadedSessions.length === 0) {
        const pref = getActiveModelPreference();
        const initial = createNewSession(pref.provider, pref.model);
        await saveSessions([initial]);
        setSessions([initial]);
        setActiveSessionId(initial.id);
      } else {
        setSessions(loadedSessions);
        setActiveSessionId(loadedSessions[0].id);
      }
    }
    init();
  }, []);

  // Load messages and docs whenever activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) return;

    let mounted = true;
    async function loadData() {
      if (!activeSessionId) return;
      const msgs = await getMessages(activeSessionId);
      const sessionDocs = await getDocs(activeSessionId);

      if (mounted) {
        setMessages(msgs);
        setDocs(sessionDocs);

        // Rebuild MiniSearch index for ready docs
        const readyChunks = sessionDocs
          .filter((d) => d.status === "ready")
          .flatMap((d) => d.chunks);
        searchIndexRef.current = createDocsSearchIndex(readyChunks);
      }
    }
    loadData();

    return () => {
      mounted = false;
    };
  }, [activeSessionId]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Save session updates
  const updateActiveSession = async (updates: Partial<Session>) => {
    if (!activeSessionId) return;
    const updatedSessions = sessions.map((s) =>
      s.id === activeSessionId ? { ...s, ...updates, updatedAt: Date.now() } : s,
    );
    setSessions(updatedSessions);
    try {
      await saveSessions(updatedSessions);
    } catch {
      addToast("Browser storage is full. Delete old sessions or documents.", "error");
    }
  };

  // Model selection
  const handleSelectModel = (provider: Provider, modelId: string) => {
    saveActiveModelPreference({ provider, model: modelId });
    updateActiveSession({ provider, model: modelId });
  };

  // Create new session
  const handleNewSession = async () => {
    const pref = getActiveModelPreference();
    const newSess = createNewSession(pref.provider, pref.model);
    const updated = [newSess, ...sessions];
    setSessions(updated);
    setActiveSessionId(newSess.id);
    setMessages([]);
    setDocs([]);
    searchIndexRef.current = null;
    try {
      await saveSessions(updated);
    } catch {
      addToast("Browser storage is full. Delete old sessions or documents.", "error");
    }
  };

  // Rename session
  const handleRenameSession = async (id: string, newTitle: string) => {
    const updated = sessions.map((s) => (s.id === id ? { ...s, title: newTitle } : s));
    setSessions(updated);
    await saveSessions(updated);
  };

  // Delete session
  const handleDeleteSession = async (id: string) => {
    const remaining = sessions.filter((s) => s.id !== id);
    await deleteSessionData(id);

    if (remaining.length === 0) {
      const pref = getActiveModelPreference();
      const fresh = createNewSession(pref.provider, pref.model);
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      await saveSessions([fresh]);
    } else {
      setSessions(remaining);
      if (activeSessionId === id) {
        setActiveSessionId(remaining[0].id);
      }
      await saveSessions(remaining);
    }
  };

  // Update docs for active session
  const handleDocsChange = async (newDocs: Doc[]) => {
    setDocs(newDocs);
    if (!activeSessionId) return;

    // Rebuild index
    const readyChunks = newDocs
      .filter((d) => d.status === "ready")
      .flatMap((d) => d.chunks);
    searchIndexRef.current = createDocsSearchIndex(readyChunks);

    try {
      await saveDocs(activeSessionId, newDocs);
    } catch {
      addToast("Browser storage is full. Delete old sessions or documents.", "error");
    }
  };

  // Toggle Web search
  const handleToggleWebSearch = () => {
    if (!keys.tavily) {
      setKeysTarget("tavily");
      setIsKeysOpen(true);
      return;
    }
    updateActiveSession({ webSearch: !activeSession.webSearch });
  };

  // Stop streaming
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearTimeout(wakingTimerRef.current);
    setServerWakingBanner(false);
    setIsStreaming(false);
    setIsSearchingWeb(false);

    // Mark last streaming message as stopped
    setMessages((prev) => {
      const updated = prev.map((m) =>
        m.status === "streaming" ? { ...m, status: "stopped" as const } : m,
      );
      if (activeSessionId) saveMessages(activeSessionId, updated).catch(() => {});
      return updated;
    });
  };

  // Send message
  const handleSendMessage = async (text: string) => {
    if (!activeSession || isStreaming) return;

    const userMessage: Message = {
      id: "msg_user_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now(),
      role: "user",
      text,
      createdAt: Date.now(),
      status: "done",
    };

    // Auto-generate title if session is new
    if (
      activeSession.title === "New session" &&
      messages.filter((m) => m.role === "user").length === 0
    ) {
      const autoTitle = autoGenerateTitle(text);
      updateActiveSession({ title: autoTitle });
    }

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    if (activeSessionId) {
      try {
        await saveMessages(activeSessionId, nextMessages);
      } catch {
        addToast("Browser storage is full. Delete old sessions or documents.", "error");
      }
    }

    await executeAssistantTurn(text, nextMessages, activeSession.provider, activeSession.model);
  };

  // Retry message
  const handleRetryMessage = async (
    msgId: string,
    modelOverride?: { provider: Provider; model: string },
  ) => {
    if (isStreaming) return;

    const msgIndex = messages.findIndex((m) => m.id === msgId);
    if (msgIndex === -1) return;

    // Find previous user message
    let userMsg: Message | null = null;
    for (let i = msgIndex - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        userMsg = messages[i];
        break;
      }
    }
    if (!userMsg) return;

    // Keep prior sources if they exist (W9: Retry re-runs with same saved sources)
    const existingAssistant = messages[msgIndex];
    const savedSources = existingAssistant?.sources;

    // Remove the failed/old assistant message
    const filtered = messages.filter((m) => m.id !== msgId);
    setMessages(filtered);

    const prov = modelOverride ? modelOverride.provider : activeSession.provider;
    const mod = modelOverride ? modelOverride.model : activeSession.model;

    if (modelOverride) {
      updateActiveSession({ provider: prov, model: mod });
    }

    await executeAssistantTurn(userMsg.text, filtered, prov, mod, savedSources);
  };

  // Core turn execution
  const executeAssistantTurn = async (
    userText: string,
    allMessages: Message[],
    provider: Provider,
    model: string,
    existingSources?: SourceLink[],
  ) => {
    const key = keys[provider];
    if (!key) {
      addToast(`No API key found for ${provider}. Add it in Keys.`, "error");
      return;
    }

    setIsStreaming(true);
    let webResults: SourceLink[] = existingSources || [];
    let webNotice: string | undefined = undefined;

    // 1. Web Search if enabled and not re-using existing sources
    if (activeSession.webSearch && keys.tavily && !existingSources) {
      setIsSearchingWeb(true);
      const searchRes = await runWebSearch(userText, keys.tavily, settings.webResultsCount);
      setIsSearchingWeb(false);
      webResults = searchRes.results;
      if (searchRes.notice) webNotice = searchRes.notice;
      if (searchRes.error) webNotice = searchRes.error;
    }

    // 2. Documents retrieval
    let usedPassages: PassageRef[] = [];
    let docsPromptBlock = "";
    let systemAdditions = activeSession.systemPrompt ? `${activeSession.systemPrompt}\n\n` : "";

    const readyDocs = docs.filter((d) => d.status === "ready");
    if (useDocuments && readyDocs.length > 0) {
      const { passages } = getRelevantPassages(
        docs,
        searchIndexRef.current,
        userText,
        settings.retrievalMode,
        settings.retrievalParts,
      );
      usedPassages = passages;
      docsPromptBlock = formatDocumentsPrompt(passages);
      systemAdditions += `${DOCS_SYSTEM_PROMPT}\n\n`;
    }

    // 3. Web search prompt block
    let webPromptBlock = "";
    if (webResults.length > 0) {
      webPromptBlock = formatWebResultsPrompt(webResults);
      systemAdditions += `${WEB_SYSTEM_PROMPT}\n\n`;
    }

    // 4. History builder
    const { msgs: historyMsgs, trimmed } = buildHistory(allMessages, settings.historyBudget);
    setHistoryTrimmed(trimmed);

    // Replace the content of the last user message in the request with documents and web blocks
    const finalRequestMessages = historyMsgs.map((m, idx) => {
      if (idx === historyMsgs.length - 1 && m.role === "user") {
        let content = "";
        if (docsPromptBlock) content += docsPromptBlock;
        if (webPromptBlock) content += webPromptBlock;
        if (docsPromptBlock || webPromptBlock) {
          content += `Question: ${userText}`;
        } else {
          content = userText;
        }
        return { role: m.role, content };
      }
      return m;
    });

    // 5. Create streaming assistant message
    const assistantId =
      "msg_ast_" + Math.random().toString(36).slice(2, 9) + "_" + Date.now();
    const initialAssistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      text: "",
      provider,
      model,
      sources: webResults.length > 0 ? webResults : undefined,
      passages: usedPassages.length > 0 ? usedPassages : undefined,
      notice: webNotice,
      status: "streaming",
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, initialAssistantMsg]);

    // Setup abort controller and waking timer
    const ac = new AbortController();
    abortControllerRef.current = ac;

    wakingTimerRef.current = setTimeout(() => {
      setServerWakingBanner(true);
    }, 4000);

    let accumulatedText = "";
    let finalUsage: { input: number; output: number } | undefined = undefined;
    let finalNotice = webNotice;
    let finalError: string | undefined = undefined;

    try {
      await streamChat(
        {
          provider,
          model,
          system: systemAdditions.trim(),
          messages: finalRequestMessages,
          maxTokens: settings.maxTokens,
        },
        key,
        ac.signal,
        (event) => {
          clearTimeout(wakingTimerRef.current);
          setServerWakingBanner(false);

          if (event.type === "delta" && event.text) {
            accumulatedText += event.text;
            startTransition(() => {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, text: accumulatedText } : m,
                ),
              );
            });
          } else if (event.type === "usage") {
            finalUsage = { input: event.input, output: event.output };
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, usage: finalUsage } : m,
              ),
            );
          } else if (event.type === "notice") {
            finalNotice = event.message || webNotice;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, notice: finalNotice } : m,
              ),
            );
          } else if (event.type === "error") {
            finalError = event.message || "An error occurred";
          }
        },
      );

      // Finish streaming successfully or with error
      setMessages((prev) => {
        const updated = prev.map((m) => {
          if (m.id === assistantId) {
            return {
              ...m,
              text: accumulatedText,
              usage: finalUsage,
              notice: finalNotice,
              status: finalError ? ("error" as const) : ("done" as const),
              error: finalError,
            };
          }
          return m;
        });
        if (activeSessionId) {
          saveMessages(activeSessionId, updated).catch((e) => {
            if (e?.name === "QuotaExceededError") {
              addToast("Browser storage is full. Delete old sessions or documents.", "error");
            }
          });
        }
        return updated;
      });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        // Handled by stop streaming
        return;
      }
      clearTimeout(wakingTimerRef.current);
      setServerWakingBanner(false);

      const errText = e?.message || "Failed to reach model.";
      setMessages((prev) => {
        const updated = prev.map((m) => {
          if (m.id === assistantId) {
            return {
              ...m,
              text: accumulatedText,
              status: "error" as const,
              error: errText,
            };
          }
          return m;
        });
        if (activeSessionId) saveMessages(activeSessionId, updated).catch(() => {});
        return updated;
      });
    } finally {
      clearTimeout(wakingTimerRef.current);
      setServerWakingBanner(false);
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#F7F9FC] dark:bg-[#0B131F] text-[#0F1F33] dark:text-[#E3EAF2] overflow-hidden select-text">
      {/* Top Bar */}
      <TopBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        keys={keys}
        currentProvider={activeSession?.provider || "openai"}
        currentModel={activeSession?.model || "gpt-4o"}
        onSelectModel={handleSelectModel}
        onOpenKeys={(target) => {
          setKeysTarget(target || null);
          setIsKeysOpen(true);
        }}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onToggleSidebar={() => setIsSidebarOpenMobile(!isSidebarOpenMobile)}
        isRightPanelOpen={isRightPanelOpen}
        onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
      />

      {/* Main Container */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <Sidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={setActiveSessionId}
          onNewSession={handleNewSession}
          onRenameSession={handleRenameSession}
          onDeleteSession={handleDeleteSession}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isOpenMobile={isSidebarOpenMobile}
          onCloseMobile={() => setIsSidebarOpenMobile(false)}
        />

        {/* Center View */}
        <main className="flex-1 flex flex-col h-full overflow-hidden relative">
          {isIdbFailed() && (
            <div className="bg-amber-100 dark:bg-amber-950/60 border-b border-amber-300 dark:border-amber-800 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 text-center font-medium">
              History can't be saved in this browser. It will be lost when you close the tab.
            </div>
          )}

          {activeTab === "chat" && activeSession && (
            <ChatView
              session={activeSession}
              messages={messages}
              docs={docs}
              keys={keys}
              isStreaming={isStreaming}
              isSearchingWeb={isSearchingWeb}
              serverWakingBanner={serverWakingBanner}
              historyTrimmed={historyTrimmed}
              useDocuments={useDocuments}
              onToggleUseDocuments={setUseDocuments}
              onToggleWebSearch={handleToggleWebSearch}
              onSendMessage={handleSendMessage}
              onStopStreaming={handleStopStreaming}
              onRetryMessage={handleRetryMessage}
              onOpenKeys={(target) => {
                setKeysTarget(target || null);
                setIsKeysOpen(true);
              }}
              onSelectPassage={setSelectedPassage}
            />
          )}

          {activeTab === "docs" && (
            <DocsView
              docs={docs}
              settings={settings}
              onDocsChange={handleDocsChange}
              onSettingsChange={(s) => {
                setSettings(s);
                saveSettings(s);
              }}
            />
          )}

          {activeTab === "email" && activeSession && (
            <EmailView
              keys={keys}
              currentProvider={activeSession.provider}
              currentModel={activeSession.model}
              userName={settings.userName}
              onOpenKeys={(target) => {
                setKeysTarget(target || null);
                setIsKeysOpen(true);
              }}
              onShowToast={addToast}
            />
          )}
        </main>

        {/* Right Context Panel (only shown in Chat tab on desktop) */}
        {activeTab === "chat" && activeSession && (
          <RightPanel
            session={activeSession}
            messages={messages}
            onUpdateSystemPrompt={(prompt) => updateActiveSession({ systemPrompt: prompt })}
            onSelectPassage={setSelectedPassage}
            isOpen={isRightPanelOpen}
            onClose={() => setIsRightPanelOpen(false)}
          />
        )}
      </div>

      {/* Mobile Bottom Tab Bar */}
      <nav aria-label="Mobile Navigation" className="md:hidden h-14 bg-white dark:bg-[#121D2C] border-t border-[#D6E1EE] dark:border-[#24364D] flex items-center justify-around px-2 z-30 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("chat")}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold ${
            activeTab === "chat"
              ? "text-[#185FA5] dark:text-[#388EE6]"
              : "text-[#6A7B91] dark:text-[#889DB5]"
          }`}
        >
          <span>Chat</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("docs")}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold ${
            activeTab === "docs"
              ? "text-[#185FA5] dark:text-[#388EE6]"
              : "text-[#6A7B91] dark:text-[#889DB5]"
          }`}
        >
          <span>Docs ({docs.filter((d) => d.status === "ready").length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("email")}
          className={`flex flex-col items-center gap-1 text-[11px] font-semibold ${
            activeTab === "email"
              ? "text-[#185FA5] dark:text-[#388EE6]"
              : "text-[#6A7B91] dark:text-[#889DB5]"
          }`}
        >
          <span>Email</span>
        </button>
      </nav>

      {/* Keys Dialog */}
      <KeysDialog
        isOpen={isKeysOpen}
        onClose={() => {
          setIsKeysOpen(false);
          setKeysTarget(null);
        }}
        keys={keys}
        onKeysChange={(k) => {
          setKeys(k);
          saveApiKeys(k);
        }}
        initialScrollTarget={keysTarget}
        onKeysTestedSuccess={(_prov, count) => {
          addToast(`Connection verified · ${count} models ready`, "success");
        }}
      />

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSettingsChange={(s) => {
          setSettings(s);
          saveSettings(s);
        }}
      />

      {/* Citation Passage Drawer */}
      <PassageDrawer
        passage={selectedPassage}
        onClose={() => setSelectedPassage(null)}
      />

      {/* Toast notifications */}
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
