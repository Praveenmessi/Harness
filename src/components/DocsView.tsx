import React, { useState, useRef } from "react";
import {
  Upload,
  FileText,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sliders,
  AlertTriangle,
} from "lucide-react";
import type { Doc, Settings } from "../lib/types";
import {
  readPdf,
  readDocx,
  readPlainText,
  chunkPages,
} from "../lib/docs";
import { ConfirmModal } from "./ConfirmModal";

interface DocsViewProps {
  docs: Doc[];
  settings: Settings;
  onDocsChange: (docs: Doc[]) => void;
  onSettingsChange: (s: Settings) => void;
}

export const DocsView: React.FC<DocsViewProps> = ({
  docs,
  settings,
  onDocsChange,
  onSettingsChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [docToDelete, setDocToDelete] = useState<Doc | null>(null);
  const [fileToReplace, setFileToReplace] = useState<{ file: File; existingDoc: Doc } | null>(null);
  const [readingProgress, setReadingProgress] = useState<Record<string, number>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalTokens = docs
    .filter((d) => d.status === "ready")
    .reduce((acc, d) => acc + d.tokens, 0);

  const isWholeDocDisabled = totalTokens > 30000;

  const processFile = async (file: File) => {
    setGeneralError(null);
    const fileName = file.name;
    const lowerName = fileName.toLowerCase();

    // 1. Extension check
    if (lowerName.endsWith(".doc")) {
      setGeneralError("Old .doc files aren't supported. Save it as .docx and upload again.");
      return;
    }
    const isPdf = lowerName.endsWith(".pdf");
    const isDocx = lowerName.endsWith(".docx");
    const isTxt = lowerName.endsWith(".txt") || lowerName.endsWith(".md");

    if (!isPdf && !isDocx && !isTxt) {
      setGeneralError("Only PDF, DOCX, TXT and MD files are supported.");
      return;
    }

    // 2. Size check
    if (file.size > 20 * 1024 * 1024) {
      setGeneralError(`${fileName} is over 20 MB.`);
      return;
    }
    if (file.size === 0) {
      setGeneralError(`${fileName} is empty.`);
      return;
    }

    // 3. Max 10 docs check
    const existingIndex = docs.findIndex((d) => d.name.toLowerCase() === fileName.toLowerCase());
    if (existingIndex === -1 && docs.length >= 10) {
      setGeneralError("Max 10 documents per session. Remove one first.");
      return;
    }

    // 4. Duplicate check
    if (existingIndex !== -1) {
      setFileToReplace({ file, existingDoc: docs[existingIndex] });
      return;
    }

    await parseAndAddDoc(file);
  };

  const parseAndAddDoc = async (file: File, replaceId?: string) => {
    const docId = replaceId || "doc_" + Math.random().toString(36).slice(2, 9);
    const lowerName = file.name.toLowerCase();

    // Create preliminary reading doc
    const newDoc: Doc = {
      id: docId,
      name: file.name,
      type: file.type || "application/octet-stream",
      pages: 0,
      tokens: 0,
      status: "reading",
      chunks: [],
    };

    let updatedDocs = replaceId
      ? docs.map((d) => (d.id === replaceId ? newDoc : d))
      : [...docs, newDoc];

    onDocsChange(updatedDocs);
    setReadingProgress((prev) => ({ ...prev, [docId]: 10 }));

    try {
      const buf = await file.arrayBuffer();
      let pages: { page: number | null; text: string }[] = [];

      if (lowerName.endsWith(".pdf")) {
        pages = await readPdf(buf, (p) => {
          setReadingProgress((prev) => ({ ...prev, [docId]: Math.round(p * 100) }));
        });
      } else if (lowerName.endsWith(".docx")) {
        pages = await readDocx(buf);
      } else {
        pages = await readPlainText(file);
      }

      const totalChars = pages.reduce((acc, p) => acc + p.text.length, 0);
      const estTokens = Math.ceil(totalChars / 4);
      const chunks = chunkPages(docId, file.name, pages);

      const readyDoc: Doc = {
        id: docId,
        name: file.name,
        type: file.type,
        pages: pages.length,
        tokens: estTokens,
        status: "ready",
        chunks,
      };

      updatedDocs = updatedDocs.map((d) => (d.id === docId ? readyDoc : d));
      onDocsChange(updatedDocs);
    } catch (e: any) {
      const errorDoc: Doc = {
        id: docId,
        name: file.name,
        type: file.type,
        pages: 0,
        tokens: 0,
        status: "error",
        error: e?.message || "Failed to read document.",
        chunks: [],
      };
      updatedDocs = updatedDocs.map((d) => (d.id === docId ? errorDoc : d));
      onDocsChange(updatedDocs);
    } finally {
      setReadingProgress((prev) => {
        const next = { ...prev };
        delete next[docId];
        return next;
      });
    }
  };

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      processFile(file);
    });
  };

  const handleDelete = (docId: string) => {
    const updated = docs.filter((d) => d.id !== docId);
    onDocsChange(updated);
    setDocToDelete(null);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-[#F7F9FC] dark:bg-[#0B131F]">
      {/* Main Docs Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        <div>
          <h2 className="text-lg font-bold text-[#0F1F33] dark:text-[#E3EAF2]">
            Session Documents
          </h2>
          <p className="text-xs text-[#6A7B91] dark:text-[#889DB5] mt-0.5">
            Upload PDFs, Word documents, Markdown or text files to ask questions with citations.
          </p>
        </div>

        {/* General Error notice */}
        {generalError && (
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 flex items-center justify-between text-xs text-red-700 dark:text-red-400 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{generalError}</span>
            </div>
            <button
              onClick={() => setGeneralError(null)}
              className="font-semibold text-xs hover:underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dropzone */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
            isDragging
              ? "border-[#185FA5] bg-[#E6F1FB]/60 dark:bg-[#192A40]/40"
              : "border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] hover:border-[#185FA5]/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.docx,.txt,.md"
            onChange={(e) => handleFiles(e.target.files)}
            className="hidden"
          />

          <div className="flex flex-col items-center gap-3">
            <div className="p-3 rounded-2xl bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6]">
              <Upload className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                Drag and drop your documents here
              </p>
              <p className="text-xs text-[#6A7B91] dark:text-[#889DB5] mt-1">
                Supported: PDF, DOCX, TXT, MD · Up to 20 MB · Max 10 docs
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#185FA5] hover:bg-[#0C447C] text-white text-xs font-semibold shadow-xs transition"
            >
              Browse files
            </button>
          </div>
        </div>

        {/* Uploaded Documents List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-[#6A7B91] dark:text-[#889DB5] uppercase tracking-wider px-1">
            <span>Uploaded files ({docs.length})</span>
            {docs.length > 0 && (
              <span>~{totalTokens.toLocaleString()} tokens total</span>
            )}
          </div>

          {docs.length === 0 ? (
            <div className="p-8 text-center rounded-2xl border border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] text-xs text-[#6A7B91]">
              No documents in this session yet. Upload a document above to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {docs.map((doc) => {
                const progress = readingProgress[doc.id];
                const isReady = doc.status === "ready";
                const isReading = doc.status === "reading";
                const isError = doc.status === "error";

                return (
                  <div
                    key={doc.id}
                    className="p-3.5 rounded-xl border border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] flex items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-2 rounded-lg bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6] shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#0F1F33] dark:text-[#E3EAF2] truncate">
                            {doc.name}
                          </span>
                        </div>

                        {/* Status / metadata */}
                        <div className="mt-1 flex items-center gap-2 text-xs text-[#6A7B91] dark:text-[#889DB5]">
                          {isReading && (
                            <span className="flex items-center gap-1.5 text-[#185FA5] dark:text-[#388EE6] font-medium">
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Reading… {progress || 20}%
                            </span>
                          )}

                          {isReady && (
                            <div className="flex items-center gap-2 flex-wrap text-xs">
                              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Ready
                              </span>
                              <span>·</span>
                              <span>{doc.pages} {doc.pages === 1 ? "page" : "pages"}</span>
                              <span>·</span>
                              <span>{doc.chunks.length} chunks</span>
                              <span>·</span>
                              <span className="font-mono">~{doc.tokens.toLocaleString()} tokens</span>
                            </div>
                          )}

                          {isError && (
                            <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {doc.error || "Failed to read document"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setDocToDelete(doc)}
                      aria-label="Delete document"
                      className="p-2 rounded-lg text-[#6A7B91] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Retrieval Settings */}
      <div className="w-full md:w-72 bg-white dark:bg-[#121D2C] border-t md:border-t-0 md:border-l border-[#D6E1EE] dark:border-[#24364D] p-5 space-y-6 shrink-0">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#6A7B91] dark:text-[#889DB5]">
          <Sliders className="w-4 h-4" />
          <span>Retrieval Settings</span>
        </div>

        {/* Mode radio */}
        <div className="space-y-3">
          <label className="block text-xs font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
            Document injection mode
          </label>

          <div className="space-y-2">
            {[
              {
                id: "auto",
                label: "Auto (recommended)",
                desc: "Sends whole document if total <= 12k tokens, otherwise searches best parts.",
              },
              {
                id: "search",
                label: "Search best parts",
                desc: "Always uses in-browser vector/keyword search to find relevant passages.",
              },
              {
                id: "whole",
                label: "Send whole document",
                desc: "Injects all chunks into prompt context (disabled if > 30k tokens).",
                disabled: isWholeDocDisabled,
              },
            ].map((opt) => (
              <label
                key={opt.id}
                className={`flex items-start gap-2.5 p-3 rounded-xl border transition cursor-pointer ${
                  opt.disabled
                    ? "opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-900 border-[#D6E1EE] dark:border-[#24364D]"
                    : settings.retrievalMode === opt.id
                    ? "bg-[#E6F1FB] dark:bg-[#192A40] border-[#185FA5] text-[#185FA5] dark:text-[#388EE6]"
                    : "border-[#D6E1EE] dark:border-[#24364D] hover:bg-[#F7F9FC] dark:hover:bg-[#142030]"
                }`}
              >
                <input
                  type="radio"
                  name="retrievalMode"
                  value={opt.id}
                  disabled={opt.disabled}
                  checked={settings.retrievalMode === opt.id}
                  onChange={() =>
                    onSettingsChange({
                      ...settings,
                      retrievalMode: opt.id as any,
                    })
                  }
                  className="mt-0.5 accent-[#185FA5]"
                />
                <div className="text-xs">
                  <div className="font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                    {opt.label}
                  </div>
                  <div className="text-[#6A7B91] dark:text-[#889DB5] text-[11px] mt-0.5 leading-snug">
                    {opt.desc}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {isWholeDocDisabled && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Too big to send whole. Use search.</span>
            </div>
          )}
        </div>

        {/* Parts to send slider */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
              Parts to send
            </span>
            <span className="font-mono font-medium text-[#185FA5] dark:text-[#388EE6] px-2 py-0.5 rounded bg-[#E6F1FB] dark:bg-[#192A40]">
              {settings.retrievalParts} chunks
            </span>
          </div>
          <p className="text-[11px] text-[#6A7B91] dark:text-[#889DB5]">
            Number of most relevant passages sent to the model per query.
          </p>
          <input
            type="range"
            min={3}
            max={12}
            step={1}
            value={settings.retrievalParts}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                retrievalParts: Number(e.target.value),
              })
            }
            className="w-full accent-[#185FA5]"
          />
          <div className="flex justify-between text-[10px] text-[#6A7B91] font-mono">
            <span>3</span>
            <span>6 (default)</span>
            <span>12</span>
          </div>
        </div>
      </div>

      {/* Delete Doc Confirm Modal */}
      <ConfirmModal
        isOpen={!!docToDelete}
        title="Delete document?"
        message={`Delete "${docToDelete?.name}"? The search index will be rebuilt immediately.`}
        confirmText="Delete"
        cancelText="Cancel"
        isDestructive={true}
        onConfirm={() => {
          if (docToDelete) handleDelete(docToDelete.id);
        }}
        onCancel={() => setDocToDelete(null)}
      />

      {/* Replace Doc Confirm Modal */}
      <ConfirmModal
        isOpen={!!fileToReplace}
        title="Replace existing file?"
        message={`A document named "${fileToReplace?.file.name}" is already uploaded. Do you want to replace it?`}
        confirmText="Replace"
        cancelText="Cancel"
        isDestructive={false}
        onConfirm={() => {
          if (fileToReplace) {
            parseAndAddDoc(fileToReplace.file, fileToReplace.existingDoc.id);
            setFileToReplace(null);
          }
        }}
        onCancel={() => setFileToReplace(null)}
      />
    </div>
  );
};
