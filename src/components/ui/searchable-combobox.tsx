"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

export type ComboboxOption = {
  id: string;
  label: string;
  secondaryLabel?: string;
  badge?: string;
  searchTerms?: string[];
  meta?: unknown;
};

type SearchableComboboxProps = {
  label: string;
  placeholder: string;
  options: ComboboxOption[];
  valueId: string;
  displayValue?: string;
  onSelect: (option: ComboboxOption | null) => void;
  onQueryChange?: (query: string) => void;
  extraOptions?: ComboboxOption[];
  extraSectionLabel?: string;
  onSelectExtra?: (option: ComboboxOption) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string | null;
  emptyText?: string;
  minSearchLength?: number;
  allowClear?: boolean;
  className?: string;
  testId?: string;
};

const RU_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function translitRuToLat(input: string): string {
  return input
    .toLowerCase()
    .split("")
    .map((c) => RU_TO_LAT[c] ?? c)
    .join("");
}

function translitVariants(input: string): string[] {
  const lower = input.toLowerCase();
  const base = translitRuToLat(lower);
  const softJ = translitRuToLat(lower.replace(/дж/g, "j"));
  const variants = [lower];
  if (base && base !== lower) variants.push(base);
  if (softJ && !variants.includes(softJ)) variants.push(softJ);
  return variants;
}

const DEFAULT_PAGE_SIZE = 60;

export function SearchableCombobox({
  label,
  placeholder,
  options,
  valueId,
  displayValue,
  onSelect,
  onQueryChange,
  extraOptions = [],
  extraSectionLabel,
  onSelectExtra,
  disabled = false,
  loading = false,
  error = null,
  emptyText = "Ничего не найдено",
  minSearchLength = 2,
  allowClear = true,
  className = "",
  testId,
}: SearchableComboboxProps) {
  const listId = useId();
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.id === valueId) || null,
    [options, valueId]
  );

  const resolvedLabel = selectedOption?.label ?? displayValue ?? "";

  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [inputText, setInputText] = useState(resolvedLabel);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [visibleLimit, setVisibleLimit] = useState<number>(DEFAULT_PAGE_SIZE);

  // Sync display text when valueId changes externally (e.g., reset or parent change)
  useEffect(() => {
    if (!isEditing) {
      setInputText(resolvedLabel);
    }
  }, [resolvedLabel, isEditing]);

  // Reset pagination when options list or search changes
  useEffect(() => {
    setVisibleLimit(DEFAULT_PAGE_SIZE);
  }, [options, inputText, isOpen]);

  // Close on click outside
  useEffect(() => {
    function handleOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setIsEditing(false);
        setInputText(resolvedLabel);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [resolvedLabel]);

  // Filter & rank options when user is typing
  const filteredOptions = useMemo(() => {
    if (!isEditing) return options;
    const raw = inputText.trim().toLowerCase();
    if (raw.length < minSearchLength) return options;

    const queryVars = translitVariants(raw);
    const tokens = raw.split(/\s+/).filter(Boolean);

    const matched: Array<{ opt: ComboboxOption; score: number; idx: number }> = [];
    for (let idx = 0; idx < options.length; idx++) {
      const opt = options[idx];
      const labelLower = opt.label.toLowerCase();
      const haystack = [
        opt.label,
        opt.secondaryLabel || "",
        ...(opt.searchTerms || []),
      ]
        .join(" ")
        .toLowerCase();

      const fullMatch = queryVars.some((qv) => haystack.includes(qv));
      const allTokens =
        fullMatch ||
        tokens.every((tok) => translitVariants(tok).some((tv) => haystack.includes(tv)));
      if (!allTokens) continue;

      let score = 0;
      if (queryVars.some((qv) => labelLower === qv)) score += 200;
      else if (queryVars.some((qv) => labelLower.startsWith(qv))) score += 120;
      else if (fullMatch) score += 60;
      score -= Math.min(25, labelLower.length);
      matched.push({ opt, score, idx });
    }

    matched.sort((a, b) => b.score - a.score || a.idx - b.idx);
    return matched.map((m) => m.opt);
  }, [options, isEditing, inputText, minSearchLength]);

  const visibleFilteredOptions = useMemo(
    () => filteredOptions.slice(0, visibleLimit),
    [filteredOptions, visibleLimit]
  );

  type FlatItem = { kind: "extra" | "option"; option: ComboboxOption };

  const flatItems: FlatItem[] = useMemo(() => {
    const items: FlatItem[] = [];
    if (isEditing && inputText.trim().length >= minSearchLength && extraOptions.length > 0) {
      for (const eo of extraOptions) {
        items.push({ kind: "extra", option: eo });
      }
    }
    for (const opt of visibleFilteredOptions) {
      items.push({ kind: "option", option: opt });
    }
    return items;
  }, [extraOptions, visibleFilteredOptions, isEditing, inputText, minSearchLength]);

  useEffect(() => {
    if (!isOpen || activeIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-item-index="${activeIndex}"]`);
    if (el && typeof (el as HTMLElement).scrollIntoView === "function") {
      (el as HTMLElement).scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen]);

  function handleOpenToggle() {
    if (disabled) return;
    if (isOpen) {
      setIsOpen(false);
      setIsEditing(false);
      setInputText(resolvedLabel);
      setActiveIndex(-1);
    } else {
      setIsOpen(true);
      // Opening via chevron shows the full available list right away
      setIsEditing(false);
      setActiveIndex(-1);
    }
  }

  function handleInputFocus() {
    if (disabled) return;
    setIsOpen(true);
  }

  function handleInputChange(next: string) {
    setInputText(next);
    setIsEditing(true);
    setIsOpen(true);
    setActiveIndex(0);
    if (onQueryChange) {
      onQueryChange(next);
    }
    if (!next.trim() && valueId) {
      onSelect(null);
    }
  }

  function commitSelection(item: FlatItem) {
    setIsOpen(false);
    setIsEditing(false);
    setActiveIndex(-1);
    if (item.kind === "extra" && onSelectExtra) {
      setInputText(item.option.label);
      onSelectExtra(item.option);
    } else {
      setInputText(item.option.label);
      onSelect(item.option);
    }
  }

  function handleClear() {
    setInputText("");
    setIsEditing(false);
    setIsOpen(false);
    setActiveIndex(-1);
    onSelect(null);
    if (onQueryChange) onQueryChange("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev + 1) % flatItems.length);
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(Math.max(0, flatItems.length - 1));
      } else if (flatItems.length > 0) {
        setActiveIndex((prev) => (prev <= 0 ? flatItems.length - 1 : prev - 1));
      }
    } else if (e.key === "Enter") {
      if (isOpen && flatItems.length > 0) {
        e.preventDefault();
        const targetIndex = activeIndex >= 0 && activeIndex < flatItems.length ? activeIndex : 0;
        commitSelection(flatItems[targetIndex]);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsOpen(false);
      setIsEditing(false);
      setInputText(resolvedLabel);
      setActiveIndex(-1);
    }
  }

  const showClear = allowClear && !disabled && (Boolean(valueId) || Boolean(inputText));
  const extraCount = isEditing && inputText.trim().length >= minSearchLength ? extraOptions.length : 0;

  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`} data-testid={testId}>
      <label
        htmlFor={inputId}
        className="block text-[10px] font-bold uppercase tracking-wider text-[#888b8d]"
      >
        {label}
      </label>

      <div className="relative mt-1.5 flex items-center">
        <input
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          disabled={disabled}
          value={inputText}
          placeholder={placeholder}
          onFocus={handleInputFocus}
          onClick={() => {
            if (!disabled && !isOpen) setIsOpen(true);
          }}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={`min-h-10 w-full border bg-[#17191b] py-2 pl-3 text-xs font-semibold text-[#f1f0eb] outline-none transition placeholder:font-normal placeholder:text-[#737d80] disabled:cursor-not-allowed disabled:opacity-50 ${
            showClear ? "pr-16" : "pr-9"
          } ${
            isOpen ? "border-[#ff6428]" : "border-[#414749] hover:border-[#6a7275] focus:border-[#ff6428]"
          }`}
        />

        <div className="absolute right-1 flex items-center gap-0.5">
          {showClear && (
            <button
              type="button"
              aria-label={`Очистить: ${label}`}
              onClick={handleClear}
              className="flex h-7 w-7 items-center justify-center text-sm font-bold text-[#888b8d] transition hover:text-[#ff6428]"
            >
              ×
            </button>
          )}
          <button
            type="button"
            aria-label={isOpen ? `Закрыть список: ${label}` : `Открыть список: ${label}`}
            disabled={disabled}
            onClick={handleOpenToggle}
            className="flex h-7 w-7 items-center justify-center text-[#888b8d] transition hover:text-[#f1f0eb] disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-150 ${isOpen ? "rotate-180 text-[#ff6428]" : ""}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Dropdown Panel */}
      {isOpen && !disabled && (
        <div
          id={listId}
          ref={listRef}
          role="listbox"
          className="absolute left-0 right-0 top-full z-40 mt-1 max-h-64 overflow-y-auto border border-[#ff6428]/70 bg-[#17191b] shadow-2xl"
        >
          {loading && (
            <div className="px-3 py-2.5 text-[11px] text-[#888b8d]">
              Загрузка справочника…
            </div>
          )}

          {error && (
            <div className="border-b border-red-900/40 bg-red-950/30 px-3 py-2.5 text-[11px] text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && flatItems.length === 0 && (
            <div className="px-3 py-3 text-[11px] text-[#888b8d]">
              {emptyText}
            </div>
          )}

          {!loading && !error && filteredOptions.length > DEFAULT_PAGE_SIZE && (
            <div className="sticky top-0 z-10 border-b border-[#2b3033] bg-[#1a1d20] px-3 py-1.5 text-[10px] text-[#888b8d]">
              Показано <strong className="text-[#f1f0eb]">{visibleFilteredOptions.length}</strong> из{" "}
              <strong className="text-[#f1f0eb]">{filteredOptions.length}</strong> · введите название для быстрого поиска
            </div>
          )}

          {extraCount > 0 && (
            <div>
              {extraSectionLabel && (
                <div className="border-b border-[#2b3033] bg-[#1e2124] px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-[#ff865c]">
                  {extraSectionLabel}
                </div>
              )}
              {flatItems.slice(0, extraCount).map((item, idx) => {
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={`extra-${item.option.id}`}
                    type="button"
                    role="option"
                    aria-selected={isActive}
                    data-item-index={idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commitSelection(item);
                    }}
                    onClick={() => commitSelection(item)}
                    className={`flex w-full items-center justify-between gap-2 border-b border-[#262a2d] px-3 py-2.5 text-left text-xs transition ${
                      isActive ? "bg-[#2a211e] text-[#ff865c]" : "text-[#f1f0eb] hover:bg-[#202325]"
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="block truncate font-bold text-[#ff865c]">
                        {item.option.label}
                      </span>
                      {item.option.secondaryLabel && (
                        <span className="block truncate text-[10px] text-[#888b8d]">
                          {item.option.secondaryLabel}
                        </span>
                      )}
                    </div>
                    {item.option.badge && (
                      <span className="shrink-0 border border-[#ff6428]/50 bg-[#ff6428]/10 px-1.5 py-0.5 text-[9px] font-bold uppercase text-[#ff865c]">
                        {item.option.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {flatItems.slice(extraCount).map((item, relIdx) => {
            const idx = relIdx + extraCount;
            const isSelected = item.option.id === valueId;
            const isActive = idx === activeIndex;
            return (
              <button
                key={item.option.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-item-index={idx}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commitSelection(item);
                }}
                onClick={() => commitSelection(item)}
                className={`flex w-full items-center justify-between gap-2 border-b border-[#222629] px-3 py-2.5 text-left text-xs transition last:border-b-0 ${
                  isSelected
                    ? "bg-[#ff6428]/15 text-[#ff865c]"
                    : isActive
                    ? "bg-[#24282b] text-[#f1f0eb]"
                    : "text-[#f1f0eb] hover:bg-[#202325]"
                }`}
              >
                <div className="min-w-0">
                  <span className="block truncate font-semibold">{item.option.label}</span>
                  {item.option.secondaryLabel && (
                    <span className="block truncate text-[10px] text-[#888b8d]">
                      {item.option.secondaryLabel}
                    </span>
                  )}
                </div>
                {item.option.badge && (
                  <span className="shrink-0 text-[10px] text-[#888b8d]">{item.option.badge}</span>
                )}
              </button>
            );
          })}

          {!loading && !error && filteredOptions.length > visibleFilteredOptions.length && (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setVisibleLimit((prev) => prev + DEFAULT_PAGE_SIZE);
              }}
              onClick={() => setVisibleLimit((prev) => prev + DEFAULT_PAGE_SIZE)}
              className="w-full border-t border-[#343a3d] bg-[#1c2023] px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#ff865c] transition hover:bg-[#24282b] hover:text-[#f1f0eb]"
            >
              Показать ещё ({Math.min(DEFAULT_PAGE_SIZE, filteredOptions.length - visibleFilteredOptions.length)} из оставшихся{" "}
              {filteredOptions.length - visibleFilteredOptions.length}) ↓
            </button>
          )}
        </div>
      )}
    </div>
  );
}
