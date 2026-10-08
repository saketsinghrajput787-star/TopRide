import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { 
  toCanonicalIsoDate, 
  formatDisplayDate, 
  getTodayIso, 
  isPastDate,
  MONTH_NAMES 
} from '../utils/dateUtils';

interface CalendarPickerProps {
  value: string; // Canonical YYYY-MM-DD or legacy string
  onChange: (canonicalIso: string) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  value,
  onChange,
  label = 'Date',
  disabled = false,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canonical date string: YYYY-MM-DD
  const canonicalValue = toCanonicalIsoDate(value);
  const todayIso = getTodayIso();

  // Navigation state (year & month displayed in calendar)
  const initialYear = parseInt(canonicalValue.substring(0, 4), 10) || new Date().getFullYear();
  const initialMonth = parseInt(canonicalValue.substring(5, 7), 10) - 1 || new Date().getMonth();

  const [currentYear, setCurrentYear] = useState(initialYear);
  const [currentMonth, setCurrentMonth] = useState(initialMonth);

  // Sync viewed month when value changes
  useEffect(() => {
    if (canonicalValue) {
      const y = parseInt(canonicalValue.substring(0, 4), 10);
      const m = parseInt(canonicalValue.substring(5, 7), 10) - 1;
      if (!isNaN(y) && !isNaN(m)) {
        setCurrentYear(y);
        setCurrentMonth(m);
      }
    }
  }, [canonicalValue]);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(y => y - 1);
    } else {
      setCurrentMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(y => y + 1);
    } else {
      setCurrentMonth(m => m + 1);
    }
  };

  const handleSelectDate = (iso: string) => {
    if (isPastDate(iso)) return;
    onChange(iso);
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    onChange(todayIso);
    setIsOpen(false);
  };

  // Build calendar matrix (Mon - Sun)
  // First day of month (0 = Sun, 1 = Mon ... 6 = Sat)
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  // Adjust so Mon = 0, Sun = 6
  const startOffset = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Days array: null for padding before 1st, then 1..daysInMonth
  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < startOffset; i++) {
    calendarCells.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarCells.push(d);
  }

  // Check if prev month is fully in the past
  const thisMonthStartIso = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
  const isPrevMonthDisabled = (() => {
    const todayY = parseInt(todayIso.substring(0, 4), 10);
    const todayM = parseInt(todayIso.substring(5, 7), 10) - 1;
    return currentYear < todayY || (currentYear === todayY && currentMonth <= todayM);
  })();

  const displayString = formatDisplayDate(canonicalValue);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
          {label}
        </label>
      )}

      {/* Modern Read-Only Date Button */}
      <button
        type="button"
        id="btn-calendar-picker"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-950 focus:border-transparent transition-all px-3.5 py-3 cursor-pointer text-left group"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <CalendarIcon className="w-4 h-4 text-slate-500 group-hover:text-slate-800 transition-colors shrink-0" />
          <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
            {displayString || 'Select date'}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-600 shrink-0 ml-1">
          Change
        </span>
      </button>

      {/* Calendar Popover / Modal */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 z-40 sm:hidden backdrop-blur-2xs"
            onClick={() => setIsOpen(false)}
          />

          <div 
            className="fixed inset-x-4 bottom-4 z-50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:right-0 sm:mt-2 w-auto sm:w-80 bg-white rounded-3xl sm:rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-4.5 animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-label="Select Date"
          >
            {/* Header: Month / Year & Prev/Next Navigation */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <span className="text-sm font-black text-slate-900 tracking-tight">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  disabled={isPrevMonthDisabled}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                  title="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="sm:hidden w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 ml-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 gap-1 text-center py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
              <span>Sun</span>
            </div>

            {/* Calendar Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {calendarCells.map((dayNum, idx) => {
                if (dayNum === null) {
                  return <div key={`empty-${idx}`} className="h-9 w-full" />;
                }

                const dayIso = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                const isPast = isPastDate(dayIso);
                const isSelected = dayIso === canonicalValue;
                const isToday = dayIso === todayIso;

                return (
                  <button
                    key={dayIso}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleSelectDate(dayIso)}
                    className={`h-9 w-full rounded-xl text-xs font-bold transition-all flex items-center justify-center cursor-pointer relative ${
                      isSelected
                        ? 'bg-slate-950 text-white shadow-xs scale-102 z-10'
                        : isPast
                        ? 'text-slate-300 cursor-not-allowed'
                        : isToday
                        ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
                    }`}
                  >
                    {dayNum}
                    {isToday && !isSelected && (
                      <span className="absolute bottom-1 w-1 h-1 rounded-full bg-emerald-600" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer Actions: Today & Done */}
            <div className="flex items-center justify-between pt-3 mt-2 border-t border-slate-100 text-xs">
              <button
                type="button"
                onClick={handleSelectToday}
                className="font-bold text-slate-700 hover:text-slate-950 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="font-bold bg-slate-950 hover:bg-slate-800 text-white px-4 py-1.5 rounded-xl transition-colors cursor-pointer shadow-2xs"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
