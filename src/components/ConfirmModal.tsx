import React from "react";
import { AlertTriangle } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  isDestructive = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#121D2C] p-6 shadow-2xl border border-[#D6E1EE] dark:border-[#24364D] space-y-4">
        <div className="flex items-start gap-3">
          {isDestructive ? (
            <div className="p-2.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          ) : (
            <div className="p-2.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#185FA5] dark:text-[#388EE6] shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
              {title}
            </h3>
            <p className="mt-1 text-sm text-[#6A7B91] dark:text-[#889DB5] leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40] rounded-lg border border-[#D6E1EE] dark:border-[#24364D] transition"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm font-medium rounded-lg text-white transition ${
              isDestructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#185FA5] hover:bg-[#0C447C]"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
