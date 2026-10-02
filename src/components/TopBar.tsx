import React from "react";
import {
  KeyRound,
  Sliders,
  Menu,
  MessageSquare,
  FileText,
  Mail,
  PanelRightOpen,
  PanelRightClose,
} from "lucide-react";
import type { Provider, ApiKeys } from "../lib/types";
import { ModelPicker } from "./ModelPicker";

interface TopBarProps {
  activeTab: "chat" | "docs" | "email";
  onTabChange: (tab: "chat" | "docs" | "email") => void;
  keys: ApiKeys;
  currentProvider: Provider;
  currentModel: string;
  onSelectModel: (provider: Provider, modelId: string) => void;
  onOpenKeys: (target?: "tavily" | "gmail") => void;
  onOpenSettings: () => void;
  onToggleSidebar: () => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onTabChange,
  keys,
  currentProvider,
  currentModel,
  onSelectModel,
  onOpenKeys,
  onOpenSettings,
  onToggleSidebar,
  isRightPanelOpen,
  onToggleRightPanel,
}) => {
  const hasAnyKey =
    !!keys.openai || !!keys.anthropic || !!keys.gemini || !!keys.xai;

  return (
    <header className="h-14 border-b border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] px-3 sm:px-4 flex items-center justify-between gap-2 shrink-0 z-30">
      {/* Left: Mobile menu toggle + Logo + Title */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
          className="p-1.5 rounded-lg text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] md:hidden transition"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2 select-none">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#185FA5] to-[#0C447C] flex items-center justify-center text-white font-bold text-sm shadow-xs">
            S
          </div>
          <span className="font-bold text-base tracking-tight text-[#0F1F33] dark:text-[#E3EAF2] hidden sm:inline">
            Switchboard
          </span>
        </div>

        {/* Model Picker */}
        <div className="ml-1 sm:ml-2">
          <ModelPicker
            keys={keys}
            currentProvider={currentProvider}
            currentModel={currentModel}
            onSelectModel={onSelectModel}
            onOpenKeys={() => onOpenKeys()}
          />
        </div>
      </div>

      {/* Center: Tabs (desktop) */}
      <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1 bg-[#F7F9FC] dark:bg-[#142030] p-1 rounded-xl border border-[#D6E1EE] dark:border-[#24364D]">
        <button
          type="button"
          onClick={() => onTabChange("chat")}
          className={`flex items-center gap-2 px-3.5 py-1 rounded-lg text-xs font-semibold transition ${
            activeTab === "chat"
              ? "bg-white dark:bg-[#121D2C] text-[#185FA5] dark:text-[#388EE6] shadow-xs"
              : "text-[#6A7B91] dark:text-[#889DB5] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2]"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          Chat
        </button>

        <button
          type="button"
          onClick={() => onTabChange("docs")}
          className={`flex items-center gap-2 px-3.5 py-1 rounded-lg text-xs font-semibold transition ${
            activeTab === "docs"
              ? "bg-white dark:bg-[#121D2C] text-[#185FA5] dark:text-[#388EE6] shadow-xs"
              : "text-[#6A7B91] dark:text-[#889DB5] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2]"
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Docs
        </button>

        <button
          type="button"
          onClick={() => onTabChange("email")}
          className={`flex items-center gap-2 px-3.5 py-1 rounded-lg text-xs font-semibold transition ${
            activeTab === "email"
              ? "bg-white dark:bg-[#121D2C] text-[#185FA5] dark:text-[#388EE6] shadow-xs"
              : "text-[#6A7B91] dark:text-[#889DB5] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2]"
          }`}
        >
          <Mail className="w-3.5 h-3.5" />
          Email
        </button>
      </nav>

      {/* Right: Keys button + Settings + Right Panel Toggle */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          onClick={() => onOpenKeys()}
          aria-label="Manage API keys"
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] transition"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              hasAnyKey ? "bg-emerald-500 shadow-xs shadow-emerald-400" : "bg-gray-400"
            }`}
          />
          <KeyRound className="w-3.5 h-3.5 text-[#6A7B91]" />
          <span>Keys</span>
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Settings"
          className="p-2 rounded-lg text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] transition border border-transparent hover:border-[#D6E1EE] dark:hover:border-[#24364D]"
        >
          <Sliders className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={onToggleRightPanel}
          aria-label={isRightPanelOpen ? "Close context panel" : "Open context panel"}
          className={`p-2 rounded-lg transition border hidden sm:flex ${
            isRightPanelOpen
              ? "bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6] border-[#185FA5]/30"
              : "text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] border-transparent hover:border-[#D6E1EE] dark:hover:border-[#24364D]"
          }`}
        >
          {isRightPanelOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};
