import React, { useState, useEffect } from "react";
import {
  Mail,
  RefreshCw,
  Search,
  Sparkles,
  Copy,
  Check,
  ExternalLink,
  RotateCcw,
  FileCheck,
  AlertCircle,
  Loader2,
  Trash2,
} from "lucide-react";
import type {
  ApiKeys,
  Provider,
  MailSummary,
  MailDetail,
} from "../lib/types";
import {
  fetchMailList,
  fetchMailGet,
  fetchMailDraft,
  streamChat,
} from "../lib/api";
import {
  buildEmailSystemPrompt,
  buildEmailUserPrompt,
  copyText,
  openInGmail,
} from "../lib/email";
import { loadPinnedModels } from "../lib/store";

interface EmailViewProps {
  keys: ApiKeys;
  currentProvider: Provider;
  currentModel: string;
  userName?: string;
  onOpenKeys: (target?: "tavily" | "gmail") => void;
  onShowToast: (
    message: string,
    type?: "info" | "success" | "error" | "warning",
    action?: { label: string; href?: string; onClick?: () => void },
  ) => void;
}

export const EmailView: React.FC<EmailViewProps> = ({
  keys,
  currentProvider,
  currentModel,
  userName,
  onOpenKeys,
  onShowToast,
}) => {
  const hasGmail = !!(keys.gmailUser && keys.gmailPass);
  const [activeSubTab, setActiveSubTab] = useState<"inbox" | "paste">(
    hasGmail ? "inbox" : "paste",
  );

  // Email form state
  const [fromField, setFromField] = useState("");
  const [subjectField, setSubjectField] = useState("");
  const [bodyField, setBodyField] = useState("");
  const [isFromGmail, setIsFromGmail] = useState(false);
  const [selectedMailMeta, setSelectedMailMeta] = useState<MailDetail | null>(null);

  // Reply generator options
  const [tone, setTone] = useState<"Formal" | "Friendly" | "Brief">("Friendly");
  const [length, setLength] = useState<"Short" | "Medium">("Short");
  const [instruction, setInstruction] = useState("");
  const [replyDraft, setReplyDraft] = useState("");
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Gmail Inbox state
  const [searchQuery, setSearchQuery] = useState("");
  const [inboxList, setInboxList] = useState<MailSummary[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(false);
  const [inboxError, setInboxError] = useState<string | null>(null);
  const [selectedUid, setSelectedUid] = useState<number | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Save to Gmail Drafts state
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [manualToAddress, setManualToAddress] = useState("");
  const [showManualTo, setShowManualTo] = useState(false);

  // Model override for "Try another model"
  const [overrideModel, setOverrideModel] = useState<{
    provider: Provider;
    model: string;
  } | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);

  const pinnedModels = loadPinnedModels();

  const activeDraftProvider = overrideModel ? overrideModel.provider : currentProvider;
  const activeDraftModel = overrideModel ? overrideModel.model : currentModel;
  const hasModelKey = !!keys[activeDraftProvider];

  // Auto switch subtab if Gmail connected status changes
  useEffect(() => {
    if (hasGmail && activeSubTab === "paste" && !bodyField) {
      setActiveSubTab("inbox");
    }
  }, [hasGmail]);

  // Load inbox when tab becomes active and credentials exist
  useEffect(() => {
    if (hasGmail && activeSubTab === "inbox") {
      loadInbox();
    }
  }, [hasGmail, activeSubTab]);

  const loadInbox = async (query = searchQuery) => {
    if (!keys.gmailUser || !keys.gmailPass) return;
    setIsLoadingInbox(true);
    setInboxError(null);
    try {
      const list = await fetchMailList(keys.gmailUser, keys.gmailPass, query);
      setInboxList(list);
    } catch (e: any) {
      setInboxError(e?.message || "Failed to load Gmail inbox.");
    } finally {
      setIsLoadingInbox(false);
    }
  };

  const handleSelectEmail = async (item: MailSummary) => {
    if (!keys.gmailUser || !keys.gmailPass) return;
    setSelectedUid(item.uid);
    setIsLoadingDetail(true);
    setInboxError(null);

    try {
      const detail = await fetchMailGet(keys.gmailUser, keys.gmailPass, item.uid);
      setSelectedMailMeta(detail);
      setFromField(detail.from);
      setSubjectField(detail.subject);
      setBodyField(detail.text);
      setIsFromGmail(true);
      setShowManualTo(false);
    } catch (e: any) {
      setInboxError(e?.message || "That email no longer exists. Refresh the inbox.");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleClearEmail = () => {
    setFromField("");
    setSubjectField("");
    setBodyField("");
    setIsFromGmail(false);
    setSelectedMailMeta(null);
    setSelectedUid(null);
    setShowManualTo(false);
    setManualToAddress("");
  };

  const handleGenerateReply = async (modelOverride?: { provider: Provider; model: string }) => {
    const prov = modelOverride ? modelOverride.provider : activeDraftProvider;
    const mod = modelOverride ? modelOverride.model : activeDraftModel;
    const key = keys[prov];

    if (!key) {
      setDraftError(`Add a key for ${prov} in Keys.`);
      return;
    }
    if (!bodyField.trim()) {
      setDraftError("The email body is empty.");
      return;
    }

    setIsDrafting(true);
    setDraftError(null);
    setReplyDraft("");

    const system = buildEmailSystemPrompt(tone, length, userName);
    const userPrompt = buildEmailUserPrompt(fromField, subjectField, bodyField, instruction);

    const ac = new AbortController();

    try {
      await streamChat(
        {
          provider: prov,
          model: mod,
          system,
          messages: [{ role: "user", content: userPrompt }],
          maxTokens: 2048,
        },
        key,
        ac.signal,
        (event) => {
          if (event.type === "delta" && event.text) {
            setReplyDraft((prev) => prev + event.text);
          } else if (event.type === "error") {
            setDraftError(event.message || "Failed to generate reply.");
          }
        },
      );
    } catch (e: any) {
      setDraftError(e?.message || "Failed to generate email reply.");
    } finally {
      setIsDrafting(false);
    }
  };

  const handleCopyReply = async () => {
    const ok = await copyText(replyDraft);
    if (ok) {
      setCopiedDraft(true);
      setTimeout(() => setCopiedDraft(false), 2000);
      onShowToast("Reply copied to clipboard", "success");
    } else {
      onShowToast("Press Ctrl+C to copy", "info");
    }
  };

  const handleOpenInGmail = () => {
    const res = openInGmail(fromField, subjectField, replyDraft);
    if (res.copied) {
      onShowToast("Reply copied. Paste it into Gmail with Ctrl+V (Cmd+V on Mac).", "info");
    }
    if (!res.opened) {
      onShowToast("Popup blocked by browser", "warning", {
        label: "Open Gmail Compose",
        href: res.url,
      });
    }
  };

  const handleSaveToGmailDrafts = async () => {
    if (!keys.gmailUser || !keys.gmailPass) {
      onShowToast("Gmail credentials required to save drafts", "error");
      return;
    }

    // Determine recipient To address
    let to = selectedMailMeta?.replyToAddress;
    if (!to) {
      const match = fromField.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      if (match) to = match[0];
    }
    if (!to && manualToAddress.trim()) {
      to = manualToAddress.trim();
    }

    if (!to) {
      setShowManualTo(true);
      onShowToast("No recipient address. Enter one below.", "warning");
      return;
    }

    if (!replyDraft.trim()) {
      onShowToast("The reply is empty", "warning");
      return;
    }

    setIsSavingDraft(true);
    try {
      const subject = subjectField.trim()
        ? /^re:/i.test(subjectField.trim())
          ? subjectField.trim()
          : `Re: ${subjectField.trim()}`
        : "Re: (no subject)";

      await fetchMailDraft(keys.gmailUser, keys.gmailPass, {
        to,
        subject,
        body: replyDraft,
        inReplyTo: selectedMailMeta?.messageId,
        references: selectedMailMeta?.references,
      });

      onShowToast("Saved to Gmail Drafts", "success", {
        label: "Open Drafts",
        href: "https://mail.google.com/mail/u/0/#drafts",
      });
    } catch (e: any) {
      onShowToast(e?.message || "Failed to save draft to Gmail", "error");
    } finally {
      setIsSavingDraft(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#F7F9FC] dark:bg-[#0B131F]">
      {/* Top Banner / Helper */}
      {!hasGmail && (
        <div className="bg-blue-50 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900 px-4 py-2 text-xs text-[#185FA5] dark:text-[#388EE6] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 shrink-0" />
            <span>Want your inbox here? Add a Gmail App Password in Keys.</span>
          </div>
          <button
            type="button"
            onClick={() => onOpenKeys("gmail")}
            className="font-semibold underline hover:text-[#0C447C]"
          >
            Add Gmail
          </button>
        </div>
      )}

      {/* Two Columns Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-px bg-[#D6E1EE] dark:bg-[#24364D] overflow-hidden">
        {/* Left Column: Email you received */}
        <div className="flex flex-col bg-white dark:bg-[#121D2C] overflow-hidden">
          {/* Sub-tabs if Gmail connected */}
          {hasGmail ? (
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC]/60 dark:bg-[#142030]/60 shrink-0">
              <div className="flex items-center gap-1 bg-[#E6F1FB] dark:bg-[#192A40] p-0.5 rounded-lg border border-[#D6E1EE] dark:border-[#24364D]">
                <button
                  type="button"
                  onClick={() => setActiveSubTab("inbox")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    activeSubTab === "inbox"
                      ? "bg-white dark:bg-[#121D2C] text-[#185FA5] dark:text-[#388EE6] shadow-2xs"
                      : "text-[#6A7B91] hover:text-[#0F1F33]"
                  }`}
                >
                  Inbox
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubTab("paste")}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${
                    activeSubTab === "paste"
                      ? "bg-white dark:bg-[#121D2C] text-[#185FA5] dark:text-[#388EE6] shadow-2xs"
                      : "text-[#6A7B91] hover:text-[#0F1F33]"
                  }`}
                >
                  Paste
                </button>
              </div>

              {activeSubTab === "inbox" && (
                <button
                  type="button"
                  onClick={() => loadInbox()}
                  disabled={isLoadingInbox}
                  aria-label="Refresh inbox"
                  className="p-1.5 rounded-lg text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] hover:bg-black/5 transition"
                >
                  <RefreshCw
                    className={`w-4 h-4 ${isLoadingInbox ? "animate-spin" : ""}`}
                  />
                </button>
              )}
            </div>
          ) : (
            <div className="px-5 py-3 border-b border-[#D6E1EE] dark:border-[#24364D] flex items-center justify-between shrink-0">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#6A7B91] dark:text-[#889DB5]">
                Email you received
              </span>
              {(fromField || subjectField || bodyField) && (
                <button
                  type="button"
                  onClick={handleClearEmail}
                  className="inline-flex items-center gap-1 text-xs text-[#6A7B91] hover:text-red-600 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              )}
            </div>
          )}

          {/* Sub-tab content */}
          {hasGmail && activeSubTab === "inbox" ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search box */}
              <div className="p-3 border-b border-[#D6E1EE] dark:border-[#24364D]">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6A7B91]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") loadInbox(searchQuery);
                    }}
                    placeholder="Gmail search, e.g. is:unread from:someone@x.com"
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-[#F7F9FC] dark:bg-[#142030] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                  />
                </div>
              </div>

              {/* Error notice */}
              {inboxError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-start justify-between gap-2">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{inboxError}</span>
                  </div>
                  {inboxError.includes("rejected") && (
                    <button
                      onClick={() => onOpenKeys("gmail")}
                      className="underline font-semibold shrink-0"
                    >
                      Open Keys
                    </button>
                  )}
                </div>
              )}

              {/* Inbox emails list */}
              <div className="flex-1 overflow-y-auto divide-y divide-[#D6E1EE]/60 dark:divide-[#24364D]/60">
                {isLoadingInbox ? (
                  <div className="p-4 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="space-y-1.5">
                        <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
                        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-800 animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : inboxList.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#6A7B91]">
                    No emails found.
                  </div>
                ) : (
                  inboxList.map((m) => {
                    const isSelected = selectedUid === m.uid;
                    return (
                      <div
                        key={m.uid}
                        onClick={() => handleSelectEmail(m)}
                        className={`p-3 cursor-pointer transition flex items-start gap-2.5 ${
                          isSelected
                            ? "bg-[#E6F1FB] dark:bg-[#192A40]"
                            : "hover:bg-[#F7F9FC] dark:hover:bg-[#142030]/50"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${
                            m.unread ? "bg-blue-600" : "bg-transparent"
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between text-xs mb-0.5">
                            <span
                              className={`truncate ${
                                m.unread
                                  ? "font-bold text-[#0F1F33] dark:text-[#E3EAF2]"
                                  : "text-[#6A7B91] dark:text-[#889DB5]"
                              }`}
                            >
                              {m.from}
                            </span>
                            <span className="text-[10px] text-[#6A7B91] shrink-0 ml-2">
                              {m.date ? new Date(m.date).toLocaleDateString() : ""}
                            </span>
                          </div>
                          <div
                            className={`text-xs truncate ${
                              m.unread
                                ? "font-semibold text-[#0F1F33] dark:text-[#E3EAF2]"
                                : "text-[#0F1F33] dark:text-[#E3EAF2]"
                            }`}
                          >
                            {m.subject}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            /* Paste Form */
            <div className="flex-1 flex flex-col p-4 sm:p-5 space-y-3 overflow-y-auto">
              {isFromGmail && (
                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-[#E6F1FB] dark:bg-[#192A40] text-xs text-[#185FA5] dark:text-[#388EE6]">
                  <span className="font-semibold">Loaded from Gmail</span>
                  <button
                    type="button"
                    onClick={handleClearEmail}
                    className="hover:underline text-[11px]"
                  >
                    Clear email
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#6A7B91] dark:text-[#889DB5] mb-1">
                    From (optional)
                  </label>
                  <input
                    type="text"
                    value={fromField}
                    onChange={(e) => setFromField(e.target.value)}
                    placeholder="Sender name or email@x.com"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#F7F9FC] dark:bg-[#142030] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#6A7B91] dark:text-[#889DB5] mb-1">
                    Subject (optional)
                  </label>
                  <input
                    type="text"
                    value={subjectField}
                    onChange={(e) => setSubjectField(e.target.value)}
                    placeholder="e.g. Project proposal"
                    className="w-full px-3 py-1.5 text-xs rounded-lg bg-[#F7F9FC] dark:bg-[#142030] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                  />
                </div>
              </div>

              <div className="flex-1 flex flex-col min-h-[220px]">
                <label className="block text-xs font-semibold text-[#6A7B91] dark:text-[#889DB5] mb-1">
                  Email Body (required)
                </label>
                <textarea
                  value={bodyField}
                  onChange={(e) => setBodyField(e.target.value)}
                  placeholder="Paste the email you received here..."
                  className="flex-1 w-full p-3 text-xs sm:text-sm rounded-xl bg-[#F7F9FC] dark:bg-[#142030] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-1 focus:ring-[#185FA5] resize-none leading-relaxed"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Your Reply */}
        <div className="flex flex-col bg-white dark:bg-[#121D2C] p-4 sm:p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between pb-1 border-b border-[#D6E1EE] dark:border-[#24364D]">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#6A7B91] dark:text-[#889DB5]">
              Your Reply
            </span>
            <div className="text-xs text-[#6A7B91]">
              Using: <span className="font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">{activeDraftModel}</span>
            </div>
          </div>

          {/* Tone & Length Segments */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#6A7B91] dark:text-[#889DB5] mb-1">
                Tone
              </label>
              <div className="grid grid-cols-3 gap-1 bg-[#F7F9FC] dark:bg-[#142030] p-1 rounded-lg border border-[#D6E1EE] dark:border-[#24364D]">
                {(["Formal", "Friendly", "Brief"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`py-1 text-xs font-semibold rounded-md transition ${
                      tone === t
                        ? "bg-white dark:bg-[#121D2C] text-[#185FA5] dark:text-[#388EE6] shadow-2xs"
                        : "text-[#6A7B91] hover:text-[#0F1F33]"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#6A7B91] dark:text-[#889DB5] mb-1">
                Length
              </label>
              <div className="grid grid-cols-2 gap-1 bg-[#F7F9FC] dark:bg-[#142030] p-1 rounded-lg border border-[#D6E1EE] dark:border-[#24364D]">
                {(["Short", "Medium"] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLength(l)}
                    className={`py-1 text-xs font-semibold rounded-md transition ${
                      length === l
                        ? "bg-white dark:bg-[#121D2C] text-[#185FA5] dark:text-[#388EE6] shadow-2xs"
                        : "text-[#6A7B91] hover:text-[#0F1F33]"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Instructions input */}
          <div>
            <label className="block text-xs font-semibold text-[#6A7B91] dark:text-[#889DB5] mb-1">
              What should the reply say? (optional)
            </label>
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder="e.g. accept the meeting, ask for the invoice, decline politely"
              className="w-full px-3 py-2 text-xs rounded-lg bg-[#F7F9FC] dark:bg-[#142030] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
            />
          </div>

          {/* Draft button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => handleGenerateReply()}
              disabled={isDrafting || !bodyField.trim() || !hasModelKey}
              className="flex-1 py-2 px-4 rounded-xl bg-[#185FA5] hover:bg-[#0C447C] text-white text-xs font-semibold shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
            >
              {isDrafting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Drafting reply...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Draft reply</span>
                </>
              )}
            </button>
          </div>

          {/* Error notice */}
          {draftError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-600 dark:text-red-400 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-snug">{draftError}</div>
            </div>
          )}

          {/* Editable Draft Output */}
          <div className="flex-1 flex flex-col min-h-[180px] space-y-1">
            <label className="block text-xs font-semibold text-[#6A7B91] dark:text-[#889DB5]">
              Reply Draft
            </label>
            <textarea
              value={replyDraft}
              onChange={(e) => setReplyDraft(e.target.value)}
              placeholder="Your generated reply will appear here and can be edited directly..."
              className="flex-1 w-full p-3 text-xs sm:text-sm rounded-xl bg-[#F7F9FC] dark:bg-[#142030] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-1 focus:ring-[#185FA5] resize-none leading-relaxed"
            />
          </div>

          {/* Manual To Field if required for Gmail drafts */}
          {showManualTo && (
            <div className="p-3 rounded-xl bg-[#E6F1FB]/60 dark:bg-[#192A40]/60 border border-[#185FA5]/30 space-y-2">
              <label className="block text-xs font-semibold text-[#185FA5] dark:text-[#388EE6]">
                Recipient email address (To):
              </label>
              <input
                type="email"
                value={manualToAddress}
                onChange={(e) => setManualToAddress(e.target.value)}
                placeholder="recipient@example.com"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
              />
            </div>
          )}

          {/* Action buttons row */}
          {replyDraft && (
            <div className="space-y-2 pt-2 border-t border-[#D6E1EE] dark:border-[#24364D]">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleCopyReply}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] transition"
                >
                  {copiedDraft ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleOpenInGmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] transition"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Gmail</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleGenerateReply()}
                  disabled={isDrafting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] transition"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Regenerate</span>
                </button>

                {/* Try another model dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] transition"
                  >
                    <span>Try another model ▾</span>
                  </button>

                  {isModelMenuOpen && (
                    <div className="absolute left-0 bottom-8 w-52 rounded-xl bg-white dark:bg-[#121D2C] shadow-xl border border-[#D6E1EE] dark:border-[#24364D] p-1.5 z-30 space-y-1">
                      {Object.entries(pinnedModels).flatMap(([prov, models]) =>
                        models.map((mod) => (
                          <button
                            key={`email_retry_${prov}_${mod}`}
                            type="button"
                            onClick={() => {
                              setIsModelMenuOpen(false);
                              setOverrideModel({ provider: prov as Provider, model: mod });
                              handleGenerateReply({ provider: prov as Provider, model: mod });
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

              {/* Save to Gmail Drafts (if Gmail connected) */}
              {hasGmail && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSaveToGmailDrafts}
                    disabled={isSavingDraft || !replyDraft.trim()}
                    className="w-full py-2 px-4 rounded-xl bg-[#185FA5] hover:bg-[#0C447C] text-white text-xs font-semibold shadow-xs disabled:opacity-40 transition flex items-center justify-center gap-2"
                  >
                    {isSavingDraft ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Saving to Gmail Drafts...</span>
                      </>
                    ) : (
                      <>
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Save to Gmail Drafts</span>
                      </>
                    )}
                  </button>
                  <p className="text-[11px] text-[#6A7B91] dark:text-[#889DB5] text-center mt-1.5">
                    Review and press Send in Gmail.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
