import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthYearPickerProps {
  date: Date;
  onChange: (d: Date) => void;
  showAll?: boolean;
  onSelectAll?: () => void;
}

const MonthYearPicker = ({ date, onChange, showAll = false, onSelectAll }: MonthYearPickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(date.getFullYear());
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMonthSelect = (month: number) => {
    onChange(new Date(viewYear, month, 1));
    setIsOpen(false);
  };

  const displayMonth = `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
  const triggerLabel = showAll ? '전체' : displayMonth;
  const handleCenterClick = () => {
    setViewYear(date.getFullYear());
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative w-full min-w-0 h-full flex items-center" ref={pickerRef}>
      <div className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center h-full w-full min-w-[132px] px-1 gap-1 overflow-hidden">
        <button type="button" onClick={(e) => { e.stopPropagation(); onChange(new Date(date.getFullYear(), date.getMonth() - 1, 1)); }} className="h-full w-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground transition-colors flex items-center justify-center flex-shrink-0 touch-manipulation">
          <ChevronLeft size={12} />
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); handleCenterClick(); }} className="h-full min-w-0 truncate text-center text-[13px] sm:text-[14px] font-black text-foreground tabular-nums tracking-tight hover:text-primary transition-colors leading-none px-1 flex items-center justify-center">
          {triggerLabel}
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onChange(new Date(date.getFullYear(), date.getMonth() + 1, 1)); }} className="h-full w-7 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground transition-colors flex items-center justify-center flex-shrink-0 touch-manipulation">
          <ChevronRight size={12} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card dark:bg-[#242424] border border-border dark:border-[#3a3a3a] rounded-2xl shadow-2xl z-50 w-64 p-4 animate-fade-in">
          {onSelectAll && (
            <button
              onClick={() => { onSelectAll(); setIsOpen(false); }}
              className={`w-full mb-3 h-9 rounded-lg text-sm font-bold border transition-colors flex items-center justify-center ${
                showAll
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-gray-100 dark:hover:bg-[#353535] text-muted-foreground dark:text-[#d6d6d6] border-border dark:border-[#3a3a3a]'
              }`}
            >
              전체 조회
            </button>
          )}
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setViewYear(viewYear - 1)} className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#353535] rounded-full"><ChevronLeft size={16} /></button>
            <span className="font-bold text-lg text-foreground dark:text-[#f3f3f3]">{viewYear}년</span>
            <button onClick={() => setViewYear(viewYear + 1)} className="h-8 w-8 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-[#353535] rounded-full"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                onClick={() => handleMonthSelect(i)}
                className={`h-9 flex items-center justify-center rounded-lg text-sm font-bold transition-colors ${date.getMonth() === i && date.getFullYear() === viewYear ? 'bg-primary text-primary-foreground' : 'hover:bg-gray-100 dark:hover:bg-[#353535] text-muted-foreground dark:text-[#d6d6d6]'}`}
              >
                {i + 1}월
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthYearPicker;
