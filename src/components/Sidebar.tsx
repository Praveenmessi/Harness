import React, { useState } from "react";
import {
  Plus,
  MessageSquare,
  MoreVertical,
  Edit2,
  Trash2,
  Sliders,
  X,
} from "lucide-react";
import type { Session } from "../lib/types";
import { ConfirmModal } from "./ConfirmModal";

interface SidebarProps {
  sessions: Session[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenSettings: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const Sidebar: React.FC<SidebarProps> = ({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  onOpenSettings,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [sessionToDelete, setSessionToDelete] = useState<Session | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const startRename = (s: Session, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title);
    setOpenMenuId(null);
  };

  const handleFinishRename = (id: string, oldTitle: string) => {
    const trimmed = editTitle.trim();
    if (trimmed && trimmed !== oldTitle) {
      onRenameSession(id, trimmed);
    }
    setEditingId(null);
  };

  const sortedSessions = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);

  const sidebarContent = (
    <aside className="w-60 h-full flex flex-col bg-[#F7F9FC] dark:bg-[#0E1724] border-r border-[#D6E1EE] dark:border-[#24364D] select-none shrink-0">
      {/* Header with New Session button */}
      <div className="p-3 border-b border-[#D6E1EE] dark:border-[#24364D] flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            onNewSession();
            onCloseMobile();
          }}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-[#185FA5] hover:bg-[#0C447C] text-white text-xs font-semibold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>New session</span>
        </button>

        {/* Close button for mobile drawer */}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close sidebar"
          className="p-2 rounded-lg text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] md:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="px-2 py-1 text-[11px] font-semibold text-[#6A7B91] dark:text-[#889DB5] uppercase tracking-wider">
          Sessions ({sessions.length})
        </div>

        {sortedSessions.map((s) => {
          const isActive = s.id === activeSessionId;
          const isEditing = editingId === s.id;
          const isMenuOpen = openMenuId === s.id;

          return (
            <div
              key={s.id}
              onClick={() => {
                if (!isEditing) {
                  onSelectSession(s.id);
                  onCloseMobile();
                }
              }}
              className={`group relative flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition ${
                isActive
                  ? "bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6] font-semibold shadow-2xs"
                  : "text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-white dark:hover:bg-[#142030]"
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-70" />
                {isEditing ? (
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleFinishRename(s.id, s.title)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleFinishRename(s.id, s.title);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    autoFocus
                    className="w-full px-1.5 py-0.5 rounded bg-white dark:bg-[#121D2C] border border-[#185FA5] text-xs font-normal focus:outline-none"
                  />
                ) : (
                  <div className="min-w-0 flex-1">
                    <p className="truncate leading-snug">{s.title}</p>
                    <span className="text-[10px] text-[#6A7B91] dark:text-[#889DB5] font-normal">
                      {formatRelativeTime(s.updatedAt)}
                    </span>
                  </div>
                )}
              </div>

              {/* Action menu trigger */}
              {!isEditing && (
                <div className="relative shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(isMenuOpen ? null : s.id);
                    }}
                    aria-label="Session options"
                    className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition"
                  >
                    <MoreVertical className="w-3.5 h-3.5 text-[#6A7B91]" />
                  </button>

                  {isMenuOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-0 top-6 w-32 rounded-lg bg-white dark:bg-[#121D2C] shadow-lg border border-[#D6E1EE] dark:border-[#24364D] py-1 z-20"
                    >
                      <button
                        type="button"
                        onClick={(e) => startRename(s, e)}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40]"
                      >
                        <Edit2 className="w-3 h-3 text-[#6A7B91]" />
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId(null);
                          setSessionToDelete(s);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: Gear icon at bottom of sidebar (as specified in §11) */}
      <div className="p-3 border-t border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC] dark:bg-[#0E1724]">
        <button
          type="button"
          onClick={() => {
            onOpenSettings();
            onCloseMobile();
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-white dark:hover:bg-[#142030] border border-transparent hover:border-[#D6E1EE] dark:hover:border-[#24364D] transition"
        >
          <Sliders className="w-4 h-4 text-[#6A7B91]" />
          <span>Settings</span>
        </button>
      </div>

      <ConfirmModal
        isOpen={!!sessionToDelete}
        title="Delete session?"
        message={`Delete "${sessionToDelete?.title}"? All chat messages and uploaded documents in this session will be removed.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (sessionToDelete) {
            onDeleteSession(sessionToDelete.id);
            setSessionToDelete(null);
          }
        }}
        onCancel={() => setSessionToDelete(null)}
      />
    </aside>
  );

  return (
    <>
      {/* Desktop view */}
      <div className="hidden md:block h-full">{sidebarContent}</div>

      {/* Mobile drawer view */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-40 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs"
            onClick={onCloseMobile}
          />
          <div className="relative z-50 animate-in slide-in-from-left duration-200 h-full">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
