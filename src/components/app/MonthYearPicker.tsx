import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface MonthYearPickerProps {
  date: Date;
  onChange: (d: Date) => void;
}

const MonthYearPicker = ({ date, onChange }: MonthYearPickerProps) => {
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

  return (
    <div className="relative flex-shrink-0" ref={pickerRef}>
      <div className="relative flex items-center px-0 py-1 min-h-[28px] min-w-[70px] overflow-visible">
        <button onClick={(e) => { e.stopPropagation(); onChange(new Date(date.getFullYear(), date.getMonth() - 1, 1)); }} className="absolute left-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground transition-colors z-10 pointer-events-auto flex items-center justify-center">
          <ChevronLeft size={10} />
        </button>
        <button onClick={() => { setViewYear(date.getFullYear()); setIsOpen(!isOpen); }} className="w-full text-center text-xs font-black text-foreground tabular-nums tracking-tight hover:text-primary transition-colors px-4 min-w-0">
          {date.getFullYear()}.{String(date.getMonth() + 1).padStart(2, '0')}
        </button>
        <button onClick={(e) => { e.stopPropagation(); onChange(new Date(date.getFullYear(), date.getMonth() + 1, 1)); }} className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground transition-colors z-10 pointer-events-auto flex items-center justify-center">
          <ChevronRight size={10} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-card border border-border rounded-2xl shadow-2xl z-50 w-64 p-4 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <button onClick={() => setViewYear(viewYear - 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><ChevronLeft size={16} /></button>
            <span className="font-bold text-lg text-foreground">{viewYear}년</span>
            <button onClick={() => setViewYear(viewYear + 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full"><ChevronRight size={16} /></button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <button
                key={i}
                onClick={() => handleMonthSelect(i)}
                className={`py-2 rounded-lg text-sm font-bold transition-colors ${date.getMonth() === i && date.getFullYear() === viewYear ? 'bg-primary text-primary-foreground' : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-muted-foreground'}`}
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
