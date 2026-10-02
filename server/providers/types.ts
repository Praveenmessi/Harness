export type ChatArgs = {
  model: string;
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
  key: string;
  signal: AbortSignal;
  emit: (e: object) => void;
};
