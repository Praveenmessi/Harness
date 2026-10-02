import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import mammoth from "mammoth";
import MiniSearch from "minisearch";
import type { Chunk, Doc, PassageRef } from "./types";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export async function readPdf(
  buf: ArrayBuffer,
  onProgress: (p: number) => void,
): Promise<{ page: number; text: string }[]> {
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  } catch (e: any) {
    if (e?.name === "PasswordException") {
      throw new Error("This PDF is password-protected. Remove the password and upload again.");
    }
    throw new Error("This PDF could not be read. It may be damaged.");
  }

  const pages: { page: number; text: string }[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    let text = "";
    for (const it of tc.items as any[]) {
      text += it.str;
      text += it.hasEOL ? "\n" : " ";
    }
    pages.push({ page: p, text: text.replace(/[ \t]+/g, " ").trim() });
    onProgress(p / pdf.numPages);
  }

  const chars = pages.reduce((n, x) => n + x.text.length, 0);
  if (chars < 20 * pdf.numPages && chars < 200) {
    throw new Error("This PDF looks scanned (no text layer). Scanned PDFs aren't supported yet.");
  }
  return pages;
}

export async function readDocx(buf: ArrayBuffer): Promise<{ page: number | null; text: string }[]> {
  try {
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    const trimmed = (value || "").replace(/[ \t]+/g, " ").trim();
    if (!trimmed) {
      throw new Error("No text found in this document.");
    }
    return [{ page: null, text: trimmed }];
  } catch (e: any) {
    if (e?.message === "No text found in this document.") throw e;
    throw new Error("Could not read DOCX file. It may be damaged.");
  }
}

export async function readPlainText(file: File): Promise<{ page: number | null; text: string }[]> {
  const text = (await file.text()).replace(/[ \t]+/g, " ").trim();
  if (!text) {
    throw new Error("This file is empty.");
  }
  return [{ page: null, text }];
}

export function chunkPages(
  docId: string,
  docName: string,
  pages: { page: number | null; text: string }[],
): Chunk[] {
  const chunks: Chunk[] = [];
  let chunkIdx = 0;

  for (const p of pages) {
    const paragraphs = p.text
      .split(/\n\s*\n/)
      .map((x) => x.trim())
      .filter(Boolean);

    let currentChunk = "";
    let lastOverlap = "";

    const addChunk = (txt: string) => {
      if (!txt.trim()) return;
      chunks.push({
        id: `${docId}_c${chunkIdx++}`,
        docId,
        docName,
        page: p.page,
        index: chunkIdx,
        text: txt.trim(),
      });
      lastOverlap = txt.slice(-400);
      currentChunk = lastOverlap ? lastOverlap + "\n" : "";
    };

    for (const para of paragraphs) {
      if (para.length > 3200) {
        // Split long paragraph by sentence ends
        const sentences = para.split(/(?<=[.!?])\s+/);
        for (const s of sentences) {
          if (s.length > 3200) {
            // Hard split
            let rest = s;
            while (rest.length > 0) {
              const slice = rest.slice(0, 3200);
              rest = rest.slice(3200);
              if (currentChunk.length + slice.length > 3200) {
                addChunk(currentChunk);
              }
              currentChunk += (currentChunk ? " " : "") + slice;
            }
          } else {
            if (currentChunk.length + s.length > 3200) {
              addChunk(currentChunk);
            }
            currentChunk += (currentChunk ? " " : "") + s;
          }
        }
      } else {
        if (currentChunk.length + para.length > 3200) {
          addChunk(currentChunk);
        }
        currentChunk += (currentChunk ? "\n\n" : "") + para;
      }
    }

    if (currentChunk.trim() && currentChunk !== lastOverlap) {
      addChunk(currentChunk);
    }
  }

  return chunks;
}

export function createDocsSearchIndex(chunks: Chunk[]): MiniSearch {
  const ms = new MiniSearch({
    fields: ["text", "docName"],
    storeFields: ["text", "docName", "page", "index", "docId"],
    searchOptions: { prefix: true, fuzzy: 0.2, combineWith: "OR", boost: { text: 2 } },
  });
  if (chunks.length > 0) {
    ms.addAll(chunks);
  }
  return ms;
}

export function getRelevantPassages(
  docs: Doc[],
  searchIndex: MiniSearch | null,
  question: string,
  mode: "auto" | "search" | "whole",
  partsCount = 6,
): { passages: PassageRef[]; usedMode: "whole" | "search" } {
  const readyDocs = docs.filter((d) => d.status === "ready");
  if (!readyDocs.length) return { passages: [], usedMode: "search" };

  const totalTokens = readyDocs.reduce((acc, d) => acc + d.tokens, 0);
  const allChunks = readyDocs.flatMap((d) => d.chunks);

  const shouldSendWhole =
    mode === "whole" || (mode === "auto" && totalTokens <= 12000);

  if (shouldSendWhole && totalTokens <= 30000) {
    return {
      passages: allChunks.map((c, i) => ({
        docName: c.docName,
        page: c.page,
        text: c.text,
        id: i + 1,
      })),
      usedMode: "whole",
    };
  }

  // Search mode
  if (searchIndex && allChunks.length > 0) {
    const hits = searchIndex.search(question);
    if (hits.length > 0) {
      const topHits = hits.slice(0, partsCount);
      const passages: PassageRef[] = topHits.map((h, i) => ({
        docName: (h as any).docName,
        page: (h as any).page,
        text: (h as any).text,
        id: i + 1,
      }));
      return { passages, usedMode: "search" };
    }
  }

  // Fallback to first K chunks if search yields no results
  const firstK = allChunks.slice(0, partsCount).map((c, i) => ({
    docName: c.docName,
    page: c.page,
    text: c.text,
    id: i + 1,
  }));
  return { passages: firstK, usedMode: "search" };
}

export function formatDocumentsPrompt(passages: PassageRef[]): string {
  if (!passages.length) return "";
  const parts = passages
    .map(
      (p, i) =>
        `<excerpt file="${p.docName}" page="${p.page !== null ? p.page : "-"}" id="${i + 1}">\n${p.text}\n</excerpt>`,
    )
    .join("\n\n");
  return `<documents>\n${parts}\n</documents>\n\n`;
}

export const DOCS_SYSTEM_PROMPT =
  'Answer using only the document excerpts provided. After each fact, cite its source like [{file} p.{page}] (use [{file}] if there is no page). If the answer is not in the excerpts, reply exactly: "I couldn\'t find that in the document." Do not use outside knowledge unless the user asks.';
