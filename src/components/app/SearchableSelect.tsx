import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, X, ChevronRight } from 'lucide-react';

interface SelectOption {
  id: string;
  label: string;
  sub?: string;
}

interface SearchableSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  recentIds?: string[];
  autoFocusSearch?: boolean;
  searchable?: boolean;
  compact?: boolean;
  clearable?: boolean;
}

const SearchableSelect = ({
  options,
  value,
  onChange,
  placeholder,
  recentIds = [],
  autoFocusSearch = true,
  searchable = true,
  compact = false,
  clearable = true,
}: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [openUpward, setOpenUpward] = useState(false);
  const [panelMaxHeight, setPanelMaxHeight] = useState(320);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.id === value);

  const sortedOptions = useMemo(() => {
    const allOption = options.find((o) => o.id === '');
    const otherOptions = options.filter((o) => o.id !== '');
    const recents = otherOptions.filter((o) => recentIds.includes(o.id));
    const others = otherOptions.filter((o) => !recentIds.includes(o.id));
    const uniqueRecents = Array.from(new Set(recents.map((o) => o.id)))
      .map((id) => recents.find((o) => o.id === id)!)
      .filter(Boolean);
    const uniqueOthers = others.filter((o) => !uniqueRecents.some((r) => r.id === o.id));

    const ordered = [...(allOption ? [allOption] : []), ...uniqueRecents, ...uniqueOthers];
    return ordered.filter(
      (o) =>
        !search ||
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
    );
  }, [options, recentIds, search]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && autoFocusSearch && inputRef.current) inputRef.current.focus();
  }, [isOpen, searchable, autoFocusSearch]);

  const updateMenuLayout = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const boundaryEl = wrapperRef.current.closest('[data-dropdown-boundary]') as HTMLElement | null;
    const boundaryRect = boundaryEl?.getBoundingClientRect();
    const topBoundary = boundaryRect ? boundaryRect.top : 0;
    const bottomBoundary = boundaryRect ? boundaryRect.bottom : viewportHeight;
    const gap = 8;
    const below = bottomBoundary - rect.bottom - gap;
    const above = rect.top - topBoundary - gap;
    const shouldOpenUp = below < 220 && above > below;
    const available = shouldOpenUp ? above : below;
    const hardCap = Math.min(
      Math.floor(viewportHeight * 0.55),
      Math.floor((bottomBoundary - topBoundary) - 12)
    );
    const nextMaxHeight = Math.max(0, Math.min(hardCap, Math.floor(available)));
    setOpenUpward(shouldOpenUp);
    setPanelMaxHeight(nextMaxHeight);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updateMenuLayout();
    window.addEventListener('resize', updateMenuLayout);
    window.addEventListener('scroll', updateMenuLayout, true);
    return () => {
      window.removeEventListener('resize', updateMenuLayout);
      window.removeEventListener('scroll', updateMenuLayout, true);
    };
  }, [isOpen, updateMenuLayout]);

  return (
    <div className={`relative w-full isolate ${isOpen ? 'z-[90]' : 'z-0'}`} ref={wrapperRef}>
      <div
        className={`w-full rounded-xl bg-muted border text-body font-bold cursor-pointer flex justify-between items-center transition-all hover:bg-gray-100 dark:hover:bg-gray-800 ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-border text-foreground'} min-h-[44px] px-2.5 pr-4 ${compact ? 'py-2' : 'py-2.5'}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span
          className={`text-body font-black ${selectedOption ? 'text-foreground' : 'text-muted-foreground'} text-base truncate flex-1 min-w-0 max-w-full pr-2`}
          title={selectedOption ? selectedOption.label : placeholder}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="icon-text-container flex items-center flex-shrink-0 pr-0.5">
          {clearable && value && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearch('');
              }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full icon-wrapper flex-shrink-0"
            >
              <X size={12} className="icon-sm icon-stroke-normal" />
            </div>
          )}
          <div className="icon-wrapper flex-shrink-0">
            <ChevronRight
              size={14}
              className={`icon-stroke-normal text-muted-foreground transition-transform ${isOpen ? 'rotate-[-90deg]' : 'rotate-90'}`}
            />
          </div>
        </div>
      </div>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 bg-card border border-border rounded-xl shadow-xl z-[80] overflow-hidden overflow-x-hidden flex flex-col animate-fade-in w-full min-w-0 ${openUpward ? 'bottom-full mb-1' : 'top-full mt-1'}`}
          style={{ maxHeight: panelMaxHeight }}
        >
          {searchable && (
            <div className="p-2 border-b border-border sticky top-0 bg-card z-10">
              <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-transparent focus-within:border-primary/50 transition-colors min-h-[42px]">
                <Search size={12} className="flex-shrink-0 text-muted-foreground" />
                <input
                  ref={inputRef}
                  type="text"
                  className="flex-1 bg-transparent text-sm font-semibold outline-none text-foreground py-1 min-w-0"
                  placeholder="검색어 입력..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          )}
          <div className="overflow-y-auto flex-1 overscroll-contain">
            {sortedOptions.length === 0 && (
              <div className="p-4 text-center text-sm font-semibold text-muted-foreground">
                검색 결과가 없습니다.
              </div>
            )}
            {sortedOptions.map((opt, idx) => {
              const isRecent = recentIds.includes(opt.id);
              return (
                <button
                  key={`${opt.id}-${idx}`}
                  onClick={() => {
                    onChange(opt.id);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2.5 hover:bg-[#f5f5f5] hover:!text-black text-[15px] md:text-sm leading-[1.35] font-semibold transition-all duration-200 ease border-b border-border last:border-0 flex justify-between items-center gap-2 group min-h-[44px] ${value === opt.id ? 'bg-gray-200 text-gray-900' : 'text-foreground'}`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold group-hover:!text-black transition-colors truncate">
                      {opt.label}
                    </div>
                    {opt.sub && <div className="text-caption text-muted-foreground truncate">{opt.sub}</div>}
                  </div>
                  {isRecent && (
                    <span className="text-micro bg-muted text-muted-foreground px-1.5 py-0.5 rounded flex-shrink-0">
                      최근
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
