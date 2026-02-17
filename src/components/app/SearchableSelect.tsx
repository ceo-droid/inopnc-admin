import React, { useState, useEffect, useRef, useMemo } from 'react';
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
}

const SearchableSelect = ({ options, value, onChange, placeholder, recentIds = [] }: SearchableSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(o => o.id === value);

  const sortedOptions = useMemo(() => {
    const allOption = options.find(o => o.id === '');
    const otherOptions = options.filter(o => o.id !== '');
    const recents = otherOptions.filter(o => recentIds.includes(o.id));
    const others = otherOptions.filter(o => !recentIds.includes(o.id));
    const uniqueRecents = Array.from(new Set(recents.map(o => o.id))).map(id => recents.find(o => o.id === id)!);
    const uniqueOthers = others.filter(o => !uniqueRecents.some(r => r.id === o.id));
    
    // "전체" 옵션을 맨 위로, 그 다음 최근 항목, 그 다음 나머지 순서
    const all = allOption ? [allOption] : [];
    return [...all, ...uniqueRecents, ...uniqueOthers].filter(o => !search || o.label.toLowerCase().includes(search.toLowerCase()) || (o.sub && o.sub.toLowerCase().includes(search.toLowerCase())));
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
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  return (
    <div className="relative w-full isolate" ref={wrapperRef}>
      <div
        className={`w-full p-2.5 md:p-2.5 rounded-xl bg-muted border text-body font-bold cursor-pointer flex justify-between items-center transition-all hover:bg-gray-100 dark:hover:bg-gray-800 ${isOpen ? 'border-primary ring-1 ring-primary' : 'border-border text-foreground'} min-h-[44px]`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span
          className={`text-body font-black ${selectedOption ? 'text-foreground' : 'text-muted-foreground'} text-base md:text-base truncate flex-1 min-w-0 max-w-full pr-2`}
          title={selectedOption ? selectedOption.label : placeholder}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="icon-text-container flex items-center flex-shrink-0">
          {value && (
            <div
              onClick={(e) => { e.stopPropagation(); onChange(''); setSearch(''); }}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full icon-wrapper flex-shrink-0"
            >
              <X size={12} className="icon-sm icon-stroke-normal" />
            </div>
          )}
          <div className="icon-wrapper flex-shrink-0">
            <ChevronRight size={14} className={`icon-stroke-normal text-muted-foreground transition-transform ${isOpen ? 'rotate-[-90deg]' : 'rotate-90'}`} />
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-xl shadow-xl z-[60] max-h-60 overflow-hidden flex flex-col animate-fade-in w-full min-w-0">
          <div className="p-2 border-b border-border sticky top-0 bg-card z-10">
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2 border border-transparent focus-within:border-primary/50 transition-colors">
              <Search size={12} className="flex-shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                className="flex-1 bg-transparent text-sm font-semibold outline-none text-foreground py-1"
                placeholder="검색어 입력..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {sortedOptions.length === 0 && <div className="p-4 text-center text-base md:text-sm font-semibold text-muted-foreground">검색 결과가 없습니다.</div>}
            {sortedOptions.map((opt, idx) => {
              const isRecent = recentIds.includes(opt.id);
              return (
                <button
                  key={`${opt.id}-${idx}`}
                  onClick={() => { onChange(opt.id); setIsOpen(false); setSearch(''); }}
                  className={`w-full text-left px-3 py-3 md:py-2.5 hover:bg-[#f5f5f5] hover:!text-black text-base md:text-sm font-semibold transition-all duration-200 ease border-b border-border last:border-0 flex justify-between items-center group min-h-[44px] ${value === opt.id ? 'bg-gray-200 text-gray-900' : 'text-foreground'}`}
                >
                  <div>
                    <div className="font-semibold group-hover:!text-black transition-colors">{opt.label}</div>
                    {opt.sub && <div className="text-caption text-muted-foreground">{opt.sub}</div>}
                  </div>
                  {isRecent && <span className="text-micro bg-muted text-muted-foreground px-1.5 py-0.5 rounded">최근</span>}
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
