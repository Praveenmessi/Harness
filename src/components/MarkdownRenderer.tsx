import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check, ExternalLink, FileText } from "lucide-react";
import type { SourceLink, PassageRef } from "../lib/types";

interface MarkdownRendererProps {
  content: string;
  sources?: SourceLink[];
  passages?: PassageRef[];
  onSelectPassage?: (p: PassageRef) => void;
}

const CodeBlock: React.FC<{ language?: string; value: string }> = ({ language, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden border border-[#D6E1EE] dark:border-[#24364D] bg-[#0E1724] text-gray-100 font-mono text-xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#142030] border-b border-[#24364D] text-[#889DB5]">
        <span className="text-[11px] uppercase font-semibold">{language || "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 text-[11px] text-[#889DB5] hover:text-white transition"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto leading-relaxed">
        <code>{value}</code>
      </pre>
    </div>
  );
};

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({
  content,
  sources = [],
  passages = [],
  onSelectPassage,
}) => {
  // Custom transform for text nodes to render citation chips for [W1]..[W8] and [file p.N]
  const renderFormattedText = (text: string) => {
    // Regex matches [W1]..[W9] OR [filename p.123] OR [filename]
    // Group 1: web source ID (e.g. W1)
    // Group 2: doc citation with page or doc citation
    const regex = /\[(W\d+)\]|\[([^\]\n]+?)(?:\s+p\.(\d+))?\]/g;
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        elements.push(text.slice(lastIndex, match.index));
      }

      if (match[1]) {
        // Web citation [W1]
        const wId = match[1];
        const num = parseInt(wId.slice(1), 10);
        const sourceIndex = num - 1;
        const source = sources[sourceIndex];

        if (source && source.url) {
          elements.push(
            <a
              key={`web_${match.index}`}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              title={source.title}
              className="inline-flex items-center gap-0.5 mx-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-mono font-medium bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6] hover:underline"
            >
              <span>{wId}</span>
              <ExternalLink className="w-2.5 h-2.5 inline" />
            </a>,
          );
        } else {
          elements.push(match[0]);
        }
      } else if (match[2]) {
        // Doc citation [filename p.N] or [filename]
        const docNameOrMatch = match[2].trim();
        const pageNum = match[3] ? parseInt(match[3], 10) : null;

        // Find matching passage
        const matchedPassage = passages.find((p) => {
          const nameMatches =
            p.docName.toLowerCase() === docNameOrMatch.toLowerCase() ||
            p.docName.toLowerCase().startsWith(docNameOrMatch.toLowerCase());
          if (pageNum !== null) {
            return nameMatches && p.page === pageNum;
          }
          return nameMatches;
        });

        if (matchedPassage && onSelectPassage) {
          elements.push(
            <button
              key={`doc_${match.index}`}
              type="button"
              onClick={() => onSelectPassage(matchedPassage)}
              className="inline-flex items-center gap-1 mx-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6] hover:bg-[#D6E7FA] dark:hover:bg-[#203652] transition cursor-pointer"
            >
              <FileText className="w-2.5 h-2.5 inline" />
              <span>{match[0].slice(1, -1)}</span>
            </button>,
          );
        } else {
          elements.push(match[0]);
        }
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      elements.push(text.slice(lastIndex));
    }

    return elements;
  };

  return (
    <div className="prose dark:prose-invert max-w-none text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Render code blocks with copy button
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const isInline = !match && !String(children).includes("\n");
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 font-mono text-xs text-[#0F1F33] dark:text-[#E3EAF2]"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <CodeBlock
                language={match ? match[1] : ""}
                value={String(children).replace(/\n$/, "")}
              />
            );
          },
          // Custom paragraph to format citations
          p({ children }) {
            return (
              <p className="my-2.5 leading-relaxed">
                {React.Children.map(children, (child) => {
                  if (typeof child === "string") {
                    return renderFormattedText(child);
                  }
                  return child;
                })}
              </p>
            );
          },
          li({ children }) {
            return (
              <li className="my-1">
                {React.Children.map(children, (child) => {
                  if (typeof child === "string") {
                    return renderFormattedText(child);
                  }
                  return child;
                })}
              </li>
            );
          },
          // Links open in new tab with noopener noreferrer
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#185FA5] dark:text-[#388EE6] hover:underline font-medium inline-flex items-center gap-0.5"
              >
                {children}
                <ExternalLink className="w-3 h-3 inline" />
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="my-4 overflow-x-auto rounded-xl border border-[#D6E1EE] dark:border-[#24364D]">
                <table className="min-w-full divide-y divide-[#D6E1EE] dark:divide-[#24364D] text-xs">
                  {children}
                </table>
              </div>
            );
          },
          th({ children }) {
            return (
              <th className="px-3 py-2 bg-[#F7F9FC] dark:bg-[#142030] text-left font-semibold text-[#0F1F33] dark:text-[#E3EAF2]">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-3 py-2 border-t border-[#D6E1EE] dark:border-[#24364D]">
                {children}
              </td>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
