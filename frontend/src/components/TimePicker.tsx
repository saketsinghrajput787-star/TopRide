import React, { useState, useEffect, useRef } from 'react';
import { Clock, X, Check, Sun, Sunset, Moon, Sunrise } from 'lucide-react';
import { 
  formatDisplayTime, 
  isValidTimeFormat, 
  getCurrentTimeHHmm,
  isPastTime
} from '../utils/dateUtils';

interface TimePickerProps {
  value: string; // Canonical 24h format "HH:mm" (e.g. "08:00", "14:30")
  onChange: (time: string) => void;
  label?: string;
  selectedDate?: string; // Canonical YYYY-MM-DD to check if selected date is today
  disabled?: boolean;
  className?: string;
  align?: 'left' | 'right';
  id?: string;
  required?: boolean;
  stepMinutes?: 15 | 30; // Default 15 mins for maximum flexibility
}

type TimePeriod = 'all' | 'morning' | 'afternoon' | 'evening' | 'night';

export const TimePicker: React.FC<TimePickerProps> = ({
  value,
  onChange,
  label = 'Departure Time',
  selectedDate,
  disabled = false,
  className = '',
  align = 'right',
  id = 'btn-time-picker',
  required = false,
  stepMinutes = 15,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activePeriod, setActivePeriod] = useState<TimePeriod>('morning');
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine current active period based on current value
  useEffect(() => {
    if (value && isValidTimeFormat(value)) {
      const hour = parseInt(value.split(':')[0], 10);
      if (hour >= 5 && hour < 12) setActivePeriod('morning');
      else if (hour >= 12 && hour < 17) setActivePeriod('afternoon');
      else if (hour >= 17 && hour < 21) setActivePeriod('evening');
      else setActivePeriod('night');
    }
  }, [value]);

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

  // Generate slots every stepMinutes (default 15)
  const allSlots: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      allSlots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    }
  }

  // Filter slots by period
  const filteredSlots = allSlots.filter((slot) => {
    const hour = parseInt(slot.split(':')[0], 10);
    if (activePeriod === 'all') return true;
    if (activePeriod === 'morning') return hour >= 5 && hour < 12;
    if (activePeriod === 'afternoon') return hour >= 12 && hour < 17;
    if (activePeriod === 'evening') return hour >= 17 && hour < 21;
    if (activePeriod === 'night') return hour >= 21 || hour < 5;
    return true;
  });

  const handleSelectTime = (slot: string) => {
    if (selectedDate && isPastTime(slot, selectedDate)) {
      return; // Disabled slot
    }
    onChange(slot);
    setIsOpen(false);
  };

  const displayString = formatDisplayTime(value) || value || 'Select time';

  const periodButtons: { id: TimePeriod; label: string; icon: React.ReactNode }[] = [
    { id: 'morning', label: 'Morning', icon: <Sunrise className="w-3 h-3" /> },
    { id: 'afternoon', label: 'Afternoon', icon: <Sun className="w-3 h-3" /> },
    { id: 'evening', label: 'Evening', icon: <Sunset className="w-3 h-3" /> },
    { id: 'night', label: 'Night', icon: <Moon className="w-3 h-3" /> },
    { id: 'all', label: 'All', icon: <Clock className="w-3 h-3" /> },
  ];

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      {/* Time Button Trigger */}
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-slate-950 focus:border-transparent transition-all px-3.5 py-3 cursor-pointer text-left group"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Clock className="w-4 h-4 text-slate-500 group-hover:text-slate-800 transition-colors shrink-0" />
          <span className="font-bold text-slate-900 text-xs sm:text-sm truncate">
            {displayString}
          </span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400 group-hover:text-slate-600 shrink-0 ml-1">
          Change
        </span>
      </button>

      {/* Time Picker Popover / Modal */}
      {isOpen && (
        <>
          {/* Mobile backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 z-40 sm:hidden backdrop-blur-2xs"
            onClick={() => setIsOpen(false)}
          />

          <div 
            className={`fixed inset-x-4 bottom-4 z-50 sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full ${
              align === 'left' ? 'sm:left-0 sm:right-auto' : 'sm:right-0 sm:left-auto'
            } sm:mt-2 w-auto sm:w-88 bg-white rounded-3xl sm:rounded-2xl shadow-2xl border border-slate-200 p-4 sm:p-4.5 animate-in fade-in zoom-in-95 duration-150`}
            role="dialog"
            aria-modal="true"
            aria-label="Select Departure Time"
          >
            {/* Header: Title & Close Button */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#F05A28]" />
                <span className="text-sm font-black text-slate-900 tracking-tight">
                  Departure Time
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Time of Day Tabs */}
            <div className="flex items-center gap-1 py-2.5 overflow-x-auto no-scrollbar border-b border-slate-100">
              {periodButtons.map((btn) => (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setActivePeriod(btn.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
                    activePeriod === btn.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {btn.icon}
                  <span>{btn.label}</span>
                </button>
              ))}
            </div>

            {/* Time Slots Grid (Scrollable) */}
            <div className="grid grid-cols-4 gap-1.5 py-3 max-h-56 overflow-y-auto pr-1">
              {filteredSlots.map((slot) => {
                const isSelected = slot === value;
                const isPast = selectedDate ? isPastTime(slot, selectedDate) : false;
                const formatted = formatDisplayTime(slot);

                return (
                  <button
                    key={slot}
                    type="button"
                    disabled={isPast}
                    onClick={() => handleSelectTime(slot)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-[#F05A28] text-white shadow-xs scale-102 z-10'
                        : isPast
                        ? 'bg-slate-50 text-slate-300 cursor-not-allowed border border-dashed border-slate-200'
                        : 'bg-slate-50 text-slate-800 hover:bg-slate-900 hover:text-white'
                    }`}
                  >
                    <span>{slot}</span>
                    <span className={`text-[9px] font-medium leading-none mt-0.5 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                      {formatted.split(' ')[1] || ''}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Footer with currently chosen time & Done button */}
            <div className="flex items-center justify-between pt-3 mt-1 border-t border-slate-100 text-xs">
              <div className="text-[11px] text-slate-500">
                Selected: <span className="font-bold text-slate-900">{formatDisplayTime(value) || value}</span>
              </div>
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
