import React from "react";
import { X, Sliders, Moon, Sun, Monitor, Globe } from "lucide-react";
import type { Settings } from "../lib/types";
import { getMonthlySearchesCount } from "../lib/web";

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onSettingsChange: (s: Settings) => void;
}

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}) => {
  if (!isOpen) return null;

  const monthlySearches = getMonthlySearchesCount();

  const handleChange = <K extends keyof Settings>(key: K, val: Settings[K]) => {
    const updated = { ...settings, [key]: val };
    onSettingsChange(updated);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#121D2C] shadow-2xl border border-[#D6E1EE] dark:border-[#24364D] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D6E1EE] dark:border-[#24364D]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6]">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                Settings
              </h2>
              <p className="text-xs text-[#6A7B91] dark:text-[#889DB5]">
                Configure model limits, theme and preferences
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings dialog"
            className="p-1.5 rounded-lg text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Max Output Tokens */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                Max output tokens
              </label>
              <span className="text-xs font-mono font-medium text-[#185FA5] dark:text-[#388EE6] px-2 py-0.5 rounded bg-[#E6F1FB] dark:bg-[#192A40]">
                {settings.maxTokens}
              </span>
            </div>
            <p className="text-xs text-[#6A7B91] dark:text-[#889DB5] mb-2">
              Raise to 8000+ if reasoning models hit output token limits before returning text.
            </p>
            <input
              type="range"
              min={256}
              max={64000}
              step={256}
              value={settings.maxTokens}
              onChange={(e) => handleChange("maxTokens", Number(e.target.value))}
              className="w-full accent-[#185FA5]"
            />
            <div className="flex justify-between text-[11px] text-[#6A7B91] mt-1 font-mono">
              <span>256</span>
              <span>4096 (default)</span>
              <span>16384</span>
              <span>64000</span>
            </div>
          </div>

          {/* History Budget */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                History budget (tokens)
              </label>
              <span className="text-xs font-mono font-medium text-[#185FA5] dark:text-[#388EE6] px-2 py-0.5 rounded bg-[#E6F1FB] dark:bg-[#192A40]">
                {settings.historyBudget}
              </span>
            </div>
            <p className="text-xs text-[#6A7B91] dark:text-[#889DB5] mb-2">
              Old messages are trimmed from the front when conversation history exceeds this limit.
            </p>
            <input
              type="range"
              min={2000}
              max={60000}
              step={1000}
              value={settings.historyBudget}
              onChange={(e) => handleChange("historyBudget", Number(e.target.value))}
              className="w-full accent-[#185FA5]"
            />
            <div className="flex justify-between text-[11px] text-[#6A7B91] mt-1 font-mono">
              <span>2,000</span>
              <span>12,000 (default)</span>
              <span>32,000</span>
              <span>60,000</span>
            </div>
          </div>

          {/* Your Name */}
          <div>
            <label className="block text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2] mb-1">
              Your name (for email sign-offs)
            </label>
            <p className="text-xs text-[#6A7B91] dark:text-[#889DB5] mb-2">
              Used to sign email reply drafts automatically.
            </p>
            <input
              type="text"
              value={settings.userName}
              onChange={(e) => handleChange("userName", e.target.value)}
              placeholder="e.g. Alex Smith"
              className="w-full px-3 py-2 text-sm rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-2 focus:ring-[#185FA5]"
            />
          </div>

          {/* Theme */}
          <div>
            <label className="block text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2] mb-2">
              Theme
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "system", label: "System", icon: Monitor },
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
              ].map((t) => {
                const Icon = t.icon;
                const active = settings.theme === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleChange("theme", t.id as any)}
                    className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-sm font-medium transition ${
                      active
                        ? "bg-[#E6F1FB] dark:bg-[#192A40] border-[#185FA5] text-[#185FA5] dark:text-[#388EE6]"
                        : "border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#142030]"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Web Searches this Month */}
          <div className="p-3.5 rounded-xl border border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC]/60 dark:bg-[#142030]/40 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-[#185FA5] dark:text-[#388EE6]" />
              <div>
                <div className="text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                  Web searches this month
                </div>
                <div className="text-[11px] text-[#6A7B91] dark:text-[#889DB5]">
                  Local browser estimate (resets 1st of month)
                </div>
              </div>
            </div>
            <span className="text-sm font-mono font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
              {monthlySearches} / 1,000
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-[#F7F9FC] dark:bg-[#0E1724] border-t border-[#D6E1EE] dark:border-[#24364D] flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#185FA5] hover:bg-[#0C447C] text-white font-medium text-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
