import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Search, X, Loader2, Navigation } from 'lucide-react';
import { LocationData } from '../types';
import { searchMapboxLocations, isMapboxAvailable } from '../services/mapbox';

interface LocationSearchInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  onSelectLocation?: (location: LocationData) => void;
  iconType?: 'origin' | 'destination' | 'search';
  required?: boolean;
  className?: string;
}

export const LocationSearchInput: React.FC<LocationSearchInputProps> = ({
  label,
  placeholder = 'Search city, landmark, or area...',
  value,
  onChange,
  onSelectLocation,
  iconType = 'search',
  required = false,
  className = '',
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<any>(null);

  // Synchronize internal query state with prop value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (text: string) => {
    setQuery(text);
    onChange(text);

    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

    if (!isMapboxAvailable() || text.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);

    debounceTimerRef.current = setTimeout(async () => {
      const places = await searchMapboxLocations(text);
      setResults(places);
      setIsLoading(false);
    }, 280);
  };

  const handleSelect = (loc: LocationData) => {
    setQuery(loc.name);
    onChange(loc.name);
    setIsOpen(false);
    setResults([]);
    if (onSelectLocation) {
      onSelectLocation(loc);
    }
  };

  const handleClear = () => {
    setQuery('');
    onChange('');
    setResults([]);
    setIsOpen(false);
  };

  const renderIcon = () => {
    if (isLoading) {
      return <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />;
    }
    if (iconType === 'origin') {
      return (
        <span className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-emerald-50 shrink-0" />
      );
    }
    if (iconType === 'destination') {
      return <MapPin className="w-4 h-4 text-rose-500 shrink-0" />;
    }
    return <Search className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  return (
    <div ref={wrapperRef} className={`relative w-full ${className}`}>
      {label && (
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 shadow-xs focus-within:border-slate-950 focus-within:ring-1 focus-within:ring-slate-950 transition-all">
        <div className="pl-3.5 pr-2 flex items-center justify-center">
          {renderIcon()}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          className="w-full py-3.5 pr-9 text-xs sm:text-sm font-semibold text-slate-900 bg-transparent focus:outline-hidden placeholder:text-slate-400"
        />

        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Clear"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden z-50 divide-y divide-slate-100 max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="px-3.5 py-1.5 bg-slate-50 text-[10px] font-bold tracking-wider uppercase text-slate-500 flex items-center gap-1.5">
            <Navigation className="w-3 h-3 text-slate-400" />
            <span>Mapbox Verified Locations</span>
          </div>
          {results.map((loc, idx) => (
            <button
              key={loc.placeId || idx}
              type="button"
              onClick={() => handleSelect(loc)}
              className="w-full px-3.5 py-2.5 text-left flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer group"
            >
              <MapPin className="w-4 h-4 text-slate-400 group-hover:text-slate-900 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {loc.name}
                </div>
                {loc.formattedAddress && (
                  <div className="text-[11px] text-slate-500 truncate mt-0.5">
                    {loc.formattedAddress}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Empty State / Unavailable State */}
      {isOpen && !isLoading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl border border-slate-200 shadow-xl p-3 text-center text-xs text-slate-500 z-50">
          {!isMapboxAvailable()
            ? 'Map service is currently unavailable.'
            : 'No matching places found. You can still use this as custom text.'}
        </div>
      )}
    </div>
  );
};
