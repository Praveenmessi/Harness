import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Search,
  Star,
  Plus,
  Loader2,
  AlertCircle,
  KeyRound,
  Check,
} from "lucide-react";
import type { Provider, ModelInfo, ApiKeys } from "../lib/types";
import { fetchModels } from "../lib/api";
import {
  loadPinnedModels,
  savePinnedModels,
  loadCustomModels,
  saveCustomModels,
  loadCachedModels,
  saveCachedModels,
} from "../lib/store";

interface ModelPickerProps {
  keys: ApiKeys;
  currentProvider: Provider;
  currentModel: string;
  onSelectModel: (provider: Provider, modelId: string) => void;
  onOpenKeys: () => void;
}

const PROVIDER_METAS: { id: Provider; label: string }[] = [
  { id: "openai", label: "OpenAI" },
  { id: "anthropic", label: "Anthropic" },
  { id: "gemini", label: "Google Gemini" },
  { id: "xai", label: "xAI" },
];

export const ModelPicker: React.FC<ModelPickerProps> = ({
  keys,
  currentProvider,
  currentModel,
  onSelectModel,
  onOpenKeys,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [modelsMap, setModelsMap] = useState<Record<string, ModelInfo[]>>({});
  const [pinned, setPinned] = useState<Record<string, string[]>>(loadPinnedModels());
  const [customModels, setCustomModels] = useState<Record<string, string[]>>(loadCustomModels());
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check if current provider has a key
  const hasKeyForCurrent = !!keys[currentProvider];
  const hasAnyKey = PROVIDER_METAS.some((p) => !!keys[p.id]);

  // Load cached models initially
  useEffect(() => {
    const cached = loadCachedModels();
    setModelsMap((prev) => ({ ...cached, ...prev }));
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const loadProviderModels = async (p: Provider, force = false) => {
    const key = keys[p];
    if (!key) return;
    if (!force && modelsMap[p] && modelsMap[p].length > 0) return;

    setLoading((prev) => ({ ...prev, [p]: true }));
    setErrors((prev) => ({ ...prev, [p]: "" }));

    try {
      const list = await fetchModels(p, key);
      setModelsMap((prev) => ({ ...prev, [p]: list }));
      saveCachedModels(p, list);
    } catch (e: any) {
      setErrors((prev) => ({ ...prev, [p]: e?.message || "Failed to load models." }));
    } finally {
      setLoading((prev) => ({ ...prev, [p]: false }));
    }
  };

  const handleOpenDropdown = () => {
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    if (nextOpen) {
      // Fetch models for each provider that has a key
      PROVIDER_METAS.forEach((p) => {
        if (keys[p.id]) {
          loadProviderModels(p.id);
        }
      });
    }
  };

  const togglePin = (provider: Provider, modelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentPinned = pinned[provider] || [];
    const isPinned = currentPinned.includes(modelId);
    const updated = isPinned
      ? currentPinned.filter((id) => id !== modelId)
      : [...currentPinned, modelId];

    const next = { ...pinned, [provider]: updated };
    setPinned(next);
    savePinnedModels(next);
  };

  const handleAddCustomModel = (provider: Provider) => {
    const val = (customInputs[provider] || "").trim();
    if (!val) return;

    const currentList = customModels[provider] || [];
    if (!currentList.includes(val)) {
      const updated = [...currentList, val];
      const next = { ...customModels, [provider]: updated };
      setCustomModels(next);
      saveCustomModels(next);
    }

    setCustomInputs((prev) => ({ ...prev, [provider]: "" }));
    onSelectModel(provider, val);
    setIsOpen(false);
  };

  // Collect all pinned models
  const allPinnedItems: { provider: Provider; modelId: string; label: string }[] = [];
  PROVIDER_METAS.forEach((p) => {
    const pPinned = pinned[p.id] || [];
    pPinned.forEach((mId) => {
      const found = (modelsMap[p.id] || []).find((m) => m.id === mId);
      allPinnedItems.push({
        provider: p.id,
        modelId: mId,
        label: found ? found.label : mId,
      });
    });
  });

  const getButtonText = () => {
    if (!hasAnyKey) return "No keys added";
    if (!hasKeyForCurrent || !currentModel) return "Pick a model";
    return currentModel;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={handleOpenDropdown}
        aria-expanded={isOpen}
        aria-label="Select model"
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs sm:text-sm font-medium transition ${
          isOpen
            ? "border-[#185FA5] bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6]"
            : "border-[#D6E1EE] dark:border-[#24364D] bg-white dark:bg-[#121D2C] text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40]"
        }`}
      >
        <span className="font-semibold text-[11px] uppercase tracking-wider text-[#6A7B91] dark:text-[#889DB5] shrink-0">
          {hasKeyForCurrent ? PROVIDER_METAS.find((p) => p.id === currentProvider)?.label : ""}
        </span>
        <span className="max-w-[130px] sm:max-w-[180px] truncate">{getButtonText()}</span>
        <ChevronDown className="w-3.5 h-3.5 text-[#6A7B91] shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-80 sm:w-96 max-h-[80vh] flex flex-col rounded-xl bg-white dark:bg-[#121D2C] shadow-2xl border border-[#D6E1EE] dark:border-[#24364D] z-50 overflow-hidden animate-in fade-in duration-100">
          {/* Search box */}
          <div className="p-2.5 border-b border-[#D6E1EE] dark:border-[#24364D] bg-[#F7F9FC]/60 dark:bg-[#142030]/60 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#6A7B91]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                autoFocus
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-white dark:bg-[#121D2C] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
              />
            </div>
          </div>

          {/* Model lists */}
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            {/* Pinned models at top */}
            {!search && allPinnedItems.length > 0 && (
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-semibold text-[#6A7B91] dark:text-[#889DB5] uppercase tracking-wider">
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  Pinned Models
                </div>
                <div className="space-y-0.5 mt-0.5">
                  {allPinnedItems.map((item) => {
                    const isSelected =
                      currentProvider === item.provider && currentModel === item.modelId;
                    return (
                      <div
                        key={`pinned_${item.provider}_${item.modelId}`}
                        onClick={() => {
                          onSelectModel(item.provider, item.modelId);
                          setIsOpen(false);
                        }}
                        className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                          isSelected
                            ? "bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6] font-medium"
                            : "text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40]/50"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/5 dark:bg-white/10 uppercase">
                            {item.provider}
                          </span>
                          <span className="truncate">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                          <button
                            type="button"
                            onClick={(e) => togglePin(item.provider, item.modelId, e)}
                            className="p-1 hover:text-amber-500 text-amber-500"
                            aria-label="Unpin model"
                          >
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Provider Groups */}
            {PROVIDER_METAS.map((p) => {
              const hasKey = !!keys[p.id];
              const isLoading = loading[p.id];
              const error = errors[p.id];
              const provModels = modelsMap[p.id] || [];
              const provCustom = customModels[p.id] || [];

              // Filter by search
              const filteredList = provModels.filter(
                (m) =>
                  m.id.toLowerCase().includes(search.toLowerCase()) ||
                  m.label.toLowerCase().includes(search.toLowerCase()),
              );

              const filteredCustom = provCustom.filter((m) =>
                m.toLowerCase().includes(search.toLowerCase()),
              );

              return (
                <div key={p.id} className="space-y-1">
                  <div className="flex items-center justify-between px-2 py-1 text-[11px] font-semibold text-[#6A7B91] dark:text-[#889DB5] uppercase tracking-wider">
                    <span>{p.label}</span>
                    {hasKey && provModels.length > 0 && (
                      <span className="text-[10px] font-normal lowercase">
                        {filteredList.length} models
                      </span>
                    )}
                  </div>

                  {!hasKey ? (
                    <div className="px-2.5 py-2 rounded-lg bg-gray-50 dark:bg-[#142030]/30 border border-[#D6E1EE]/50 dark:border-[#24364D]/50 flex items-center justify-between text-xs text-[#6A7B91]">
                      <div className="flex items-center gap-2">
                        <KeyRound className="w-3.5 h-3.5 opacity-60" />
                        <span>No key added</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          onOpenKeys();
                        }}
                        className="text-[#185FA5] dark:text-[#388EE6] font-medium hover:underline"
                      >
                        Add key
                      </button>
                    </div>
                  ) : isLoading ? (
                    <div className="space-y-1.5 p-2">
                      <div className="h-6 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
                      <div className="h-6 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
                      <div className="h-6 rounded-md bg-gray-200 dark:bg-gray-800 animate-pulse" />
                    </div>
                  ) : error ? (
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400 flex items-start justify-between gap-2">
                      <div className="flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        <span className="line-clamp-2 leading-tight">{error}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => loadProviderModels(p.id, true)}
                        className="font-semibold underline shrink-0 hover:text-red-700"
                      >
                        Retry
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-0.5">
                      {filteredCustom.map((cId) => {
                        const isSelected = currentProvider === p.id && currentModel === cId;
                        return (
                          <div
                            key={`custom_${p.id}_${cId}`}
                            onClick={() => {
                              onSelectModel(p.id, cId);
                              setIsOpen(false);
                            }}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                              isSelected
                                ? "bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6] font-medium"
                                : "text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40]/50"
                            }`}
                          >
                            <span className="truncate">{cId} (custom)</span>
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                          </div>
                        );
                      })}

                      {filteredList.map((m) => {
                        const isSelected = currentProvider === p.id && currentModel === m.id;
                        const isPinned = (pinned[p.id] || []).includes(m.id);
                        return (
                          <div
                            key={`m_${p.id}_${m.id}`}
                            onClick={() => {
                              onSelectModel(p.id, m.id);
                              setIsOpen(false);
                            }}
                            className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition ${
                              isSelected
                                ? "bg-[#E6F1FB] dark:bg-[#192A40] text-[#185FA5] dark:text-[#388EE6] font-medium"
                                : "text-[#0F1F33] dark:text-[#E3EAF2] hover:bg-[#F7F9FC] dark:hover:bg-[#192A40]/50"
                            }`}
                          >
                            <span className="truncate">{m.label || m.id}</span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {isSelected && <Check className="w-3.5 h-3.5" />}
                              <button
                                type="button"
                                onClick={(e) => togglePin(p.id, m.id, e)}
                                aria-label={isPinned ? "Unpin model" : "Pin model"}
                                className={`p-1 transition ${
                                  isPinned
                                    ? "text-amber-500 fill-amber-500"
                                    : "text-[#6A7B91] hover:text-amber-500 opacity-0 group-hover:opacity-100 hover:opacity-100"
                                }`}
                              >
                                <Star
                                  className={`w-3.5 h-3.5 ${isPinned ? "fill-amber-500" : ""}`}
                                />
                              </button>
                            </div>
                          </div>
                        );
                      })}

                      {filteredList.length === 0 && filteredCustom.length === 0 && (
                        <div className="px-2.5 py-1.5 text-xs text-[#6A7B91] italic">
                          No models matching "{search}"
                        </div>
                      )}

                      {/* Custom model ID input */}
                      <div className="pt-1 px-1">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={customInputs[p.id] || ""}
                            onChange={(e) =>
                              setCustomInputs((prev) => ({ ...prev, [p.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddCustomModel(p.id);
                            }}
                            placeholder="Use a custom model ID..."
                            className="flex-1 px-2.5 py-1 text-xs rounded-md bg-[#F7F9FC] dark:bg-[#142030] border border-[#D6E1EE] dark:border-[#24364D] text-[#0F1F33] dark:text-[#E3EAF2] placeholder-[#6A7B91]/50 focus:outline-none focus:ring-1 focus:ring-[#185FA5]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddCustomModel(p.id)}
                            disabled={!customInputs[p.id]?.trim()}
                            aria-label="Add custom model"
                            className="p-1 rounded-md bg-[#185FA5] text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#0C447C] transition shrink-0"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
