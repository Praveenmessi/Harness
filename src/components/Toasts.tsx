import React from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";

export interface ToastItem {
  id: string;
  message: string;
  type?: "info" | "success" | "error" | "warning";
  action?: {
    label: string;
    onClick?: () => void;
    href?: string;
  };
}

interface ToastsProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export const Toasts: React.FC<ToastsProps> = ({ toasts, onDismiss }) => {
  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
      {toasts.map((t) => {
        const type = t.type || "info";
        let icon = <Info className="w-5 h-5 text-blue-500 shrink-0" />;
        let borderClass = "border-blue-200 dark:border-blue-800";
        if (type === "success") {
          icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />;
          borderClass = "border-emerald-200 dark:border-emerald-800";
        } else if (type === "error") {
          icon = <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" />;
          borderClass = "border-red-200 dark:border-red-800";
        } else if (type === "warning") {
          icon = <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />;
          borderClass = "border-amber-200 dark:border-amber-800";
        }

        return (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-white dark:bg-[#121D2C] shadow-lg border ${borderClass} text-sm text-[#0F1F33] dark:text-[#E3EAF2] transition-all`}
          >
            {icon}
            <div className="flex-1 min-w-0">
              <p className="leading-snug break-words">{t.message}</p>
              {t.action && (
                <div className="mt-2">
                  {t.action.href ? (
                    <a
                      href={t.action.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-semibold text-[#185FA5] dark:text-[#388EE6] hover:underline"
                    >
                      {t.action.label} ↗
                    </a>
                  ) : (
                    <button
                      onClick={t.action.onClick}
                      className="inline-flex items-center text-xs font-semibold text-[#185FA5] dark:text-[#388EE6] hover:underline"
                    >
                      {t.action.label}
                    </button>
                  )}
                </div>
              )}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss toast"
              className="text-[#6A7B91] hover:text-[#0F1F33] dark:hover:text-[#E3EAF2] p-0.5 rounded transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
