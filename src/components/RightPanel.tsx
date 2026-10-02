import React, { useState, useEffect } from "react";
import { Download, Cpu, FileText, ChevronRight, X } from "lucide-react";
import type { Session, Message, PassageRef } from "../lib/types";

interface RightPanelProps {
  session: Session;
  messages: Message[];
  onUpdateSystemPrompt: (prompt: string) => void;
  onSelectPassage: (p: PassageRef) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  session,
  messages,
  onUpdateSystemPrompt,
  onSelectPassage,
  isOpen,
  onClose,
}) => {
  const [localSystemPrompt, setLocalSystemPrompt] = useState(session.systemPrompt || "");

  useEffect(() => {
    setLocalSystemPrompt(session.systemPrompt || "");
  }, [session.id, session.systemPrompt]);

  if (!isOpen) return null;

  // Calculate total tokens for session
  const totalTokens = messages.reduce((acc, m) => {
    if (m.usage) {
      return acc + (m.usage.input || 0) + (m.usage.output || 0);
    }
    return acc;
  }, 0);

  // Collect unique passages used in this session
  const allPassages: PassageRef[] = [];
  const seen = new Set<string>();
  messages.forEach((m) => {
    if (m.passages) {
      m.passages.forEach((p) => {
        const key = `${p.docName}_${p.page}_${p.text.slice(0, 40)}`;
        if (!seen.has(key)) {
          seen.add(key);
          allPassages.push(p);
        }
      });
    }
  });

  const handleExport = () => {
    const lines: string[] = [
      `# ${session.title}`,
      `*Exported on ${new Date().toLocaleString()}*`,
      `*Model: ${session.provider} - ${session.model}*`,
      "",
    ];

    if (session.systemPrompt) {
      lines.push("## System Prompt", session.systemPrompt, "");
    }

    lines.push("## Conversation", "");
    messages.forEach((m) => {
      const roleName = m.role === "user" ? "**User**" : "**Assistant**";
      lines.push(`### ${roleName} (${new Date(m.createdAt).toLocaleTimeString()})`);
      lines.push(m.text);
      if (m.sources && m.sources.length > 0) {
        lines.push("", "**Sources:**");
        m.sources.forEach((s, idx) => {
          lines.push(`- [W${idx + 1}] [${s.title}](${s.url})`);
        });
      }
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.title.replace(/[^\w\s-]/g, "").trim() || "switchboard-session"}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-72 h-full flex flex-col bg-[#F7F9FC] dark:bg-[#0E1724] border-l border-[#D6E1EE] dark:border-[#24364D] select-none shrink-0 z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#D6E1EE] dark:border-[#24364D] shrink-0">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#6A7B91] dark:text-[#889DB5]">
          Session Context
        </h3>
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="p-1 rounded-md text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Token stats */}
        <div className="p-3 rounded-xl bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#6A7B91] dark:text-[#889DB5]">
            <span className="flex items-center gap-1.5 font-medium">
              <Cpu className="w-3.5 h-3.5" />
              Total tokens
            </span>
            <span className="font-mono font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
              {totalTokens.toLocaleString()}
            </span>
          </div>
          <div className="text-[11px] text-[#6A7B91] dark:text-[#889DB5]">
            {messages.length} messages in conversation
          </div>
        </div>

        {/* System Prompt */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
            System prompt
          </label>
          <textarea
            value={localSystemPrompt}
            onChange={(e) => setLocalSystemPrompt(e.target.value)}
            onBlur={() => onUpdateSystemPrompt(localSystemPrompt)}
            placeholder="e.g. You are a senior engineer answering questions concisely..."
            rows={5}
            className="w-full p-2.5 rounded-xl bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-xs text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-1 focus:ring-[#185FA5] resize-none"
          />
          <p className="text-[11px] text-[#6A7B91] dark:text-[#889DB5]">
            Saved on blur. Applied to every message in this session.
          </p>
        </div>

        {/* Passages used */}
        {allPassages.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2] flex items-center justify-between">
              <span>Passages used</span>
              <span className="text-[11px] text-[#6A7B91] font-normal">
                {allPassages.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {allPassages.map((p, idx) => (
                <div
                  key={`p_${idx}`}
                  onClick={() => onSelectPassage(p)}
                  className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-xs cursor-pointer hover:border-[#185FA5] transition"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <FileText className="w-3.5 h-3.5 text-[#185FA5] shrink-0" />
                    <span className="truncate text-[#0F1F33] dark:text-[#E3EAF2] font-medium">
                      {p.docName}
                    </span>
                    <span className="text-[10px] text-[#6A7B91] shrink-0">
                      {p.page !== null ? `p.${p.page}` : ""}
                    </span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-[#6A7B91] shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Export */}
      <div className="p-4 border-t border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC] dark:bg-[#0E1724]">
        <button
          type="button"
          onClick={handleExport}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white dark:bg-[#121D2C] hover:bg-[#E6F1FB] dark:hover:bg-[#192A40] text-[#0F1F33] dark:text-[#E3EAF2] border border-[#D6E1EE] dark:border-[#24364D] text-xs font-semibold shadow-2xs transition"
        >
          <Download className="w-3.5 h-3.5 text-[#185FA5] dark:text-[#388EE6]" />
          <span>Export conversation (.md)</span>
        </button>
      </div>
    </aside>
  );
};
