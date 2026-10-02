export const PROVIDERS = ["openai", "anthropic", "gemini", "xai"] as const;
export type Provider = typeof PROVIDERS[number];

export interface ModelInfo {
  id: string;
  label: string;
}

export interface Chunk {
  id: string;
  docId: string;
  docName: string;
  page: number | null;
  index: number;
  text: string;
}

export interface Doc {
  id: string;
  name: string;
  type: string;
  pages: number;
  tokens: number;
  status: "reading" | "ready" | "error";
  error?: string;
  chunks: Chunk[];
}

export interface SourceLink {
  title: string;
  url: string;
  content?: string;
}

export interface PassageRef {
  docName: string;
  page: number | null;
  text: string;
  id?: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  provider?: Provider;
  model?: string;
  usage?: { input: number; output: number };
  notice?: string;
  sources?: SourceLink[];
  passages?: PassageRef[];
  status: "done" | "error" | "stopped" | "streaming";
  error?: string;
  createdAt: number;
}

export interface Session {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  provider: Provider;
  model: string;
  systemPrompt: string;
  webSearch: boolean;
}

export interface ApiKeys {
  openai?: string;
  anthropic?: string;
  gemini?: string;
  xai?: string;
  tavily?: string;
  gmailUser?: string;
  gmailPass?: string;
}

export interface Settings {
  maxTokens: number;
  historyBudget: number;
  userName: string;
  theme: "system" | "light" | "dark";
  webResultsCount: number;
  retrievalMode: "auto" | "search" | "whole";
  retrievalParts: number;
}

export interface MailSummary {
  uid: number;
  subject: string;
  from: string;
  date: string | null;
  unread: boolean;
}

export interface MailDetail {
  uid: number;
  from: string;
  replyToAddress: string;
  subject: string;
  date: string | null;
  messageId: string;
  references: string[];
  text: string;
}
