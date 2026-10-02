import React from "react";
import { X, FileText } from "lucide-react";
import type { PassageRef } from "../lib/types";

interface PassageDrawerProps {
  passage: PassageRef | null;
  onClose: () => void;
}

export const PassageDrawer: React.FC<PassageDrawerProps> = ({ passage, onClose }) => {
  if (!passage) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-[#121D2C] shadow-2xl border-l border-[#D6E1EE] dark:border-[#24364D] flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#D6E1EE] dark:border-[#24364D]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6] shrink-0">
            <FileText className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2] truncate">
              {passage.docName}
            </h3>
            <p className="text-xs text-[#6A7B91] dark:text-[#889DB5]">
              {passage.page !== null ? `Page ${passage.page}` : "Document excerpt"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close passage viewer"
          className="p-1.5 rounded-lg text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5">
        <div className="p-4 rounded-xl bg-[#F7F9FC] dark:bg-[#0E1724] border border-[#D6E1EE] dark:border-[#24364D] text-xs sm:text-sm text-[#0F1F33] dark:text-[#E3EAF2] leading-relaxed whitespace-pre-wrap font-sans">
          {passage.text}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC]/60 dark:bg-[#142030]/60 flex justify-end">
        <button
          onClick={onClose}
          className="px-4 py-1.5 rounded-lg bg-[#185FA5] text-white text-xs font-semibold hover:bg-[#0C447C] transition"
        >
          Close
        </button>
      </div>
    </div>
  );
};
