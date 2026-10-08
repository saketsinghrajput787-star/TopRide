import React, { useState, useMemo, useRef, useCallback } from 'react';
import { Trip, PassengerRequest, LuggagePackage, ScreenId, CandidateMatch } from '../types';
import { api } from '../api';
import { LocationSearchInput } from '../components/LocationSearchInput';
import { CalendarPicker } from '../components/CalendarPicker';
import { toCanonicalIsoDate, formatDisplayDate } from '../utils/dateUtils';
import { 
  Search, 
  ArrowLeftRight, 
  Star, 
  ShieldCheck, 
  Car, 
  Package, 
  SlidersHorizontal, 
  X, 
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Calendar as CalendarIcon,
  ChevronDown
} from 'lucide-react';

interface FindViewProps {
  initialOrigin?: string;
  initialDestination?: string;
  initialDate?: string;
  initialMode?: 'passenger' | 'driver' | 'luggage';
  trips: Trip[];
  passengerRequests: PassengerRequest[];
  luggagePackages: LuggagePackage[];
  onSelectTrip: (trip: Trip) => void;
  onSelectLuggage: (pkg: LuggagePackage) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  showToast: (msg: string) => void;
}

export const FindView: React.FC<FindViewProps> = ({
  initialOrigin = 'Bengaluru',
  initialDestination = 'Hyderabad',
  initialDate = '2026-10-10',
  initialMode = 'passenger',
  passengerRequests,
  luggagePackages,
  onSelectTrip,
  onSelectLuggage,
  onNavigateScreen,
  showToast,
}) => {
  // Mode: passenger | driver | luggage
  const [mode, setMode] = useState<'passenger' | 'driver' | 'luggage'>(initialMode);
  
  // Search inputs & coordinates
  const [origin, setOrigin] = useState(initialOrigin);
  const [destination, setDestination] = useState(initialDestination);
  const [originCoords, setOriginCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [destCoords, setDestCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Canonical ISO date format: YYYY-MM-DD
  const [dateIso, setDateIso] = useState<string>(() => toCanonicalIsoDate(initialDate));

  // Filters & Sorting
  const [sortBy, setSortBy] = useState<'best' | 'cheapest' | 'earliest' | 'rating'>('best');
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyInstant, setOnlyInstant] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(1000);
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // Search & Matching State (IDLE BY DEFAULT: hasSearched is false, 0 API calls on mount)
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [bestMatch, setBestMatch] = useState<CandidateMatch | null>(null);
  const [otherOptions, setOtherOptions] = useState<CandidateMatch[]>([]);
  const [totalMatchesCount, setTotalMatchesCount] = useState<number>(0);
  const [showAllOtherOptions, setShowAllOtherOptions] = useState(false);
  const [searchSummaryRoute, setSearchSummaryRoute] = useState({ origin: initialOrigin, destination: initialDestination, date: initialDate });

  // Race-condition & double-click protection refs
  const inFlightRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const searchRequestIdRef = useRef<number>(0);

  // Swap Origin and Destination (Pure state update, NO API call)
  const handleSwap = () => {
    const tempOrigin = origin;
    const tempCoords = originCoords;
    setOrigin(destination);
    setOriginCoords(destCoords);
    setDestination(tempOrigin);
    setDestCoords(tempCoords);
    showToast('Locations swapped');
  };

  // Perform exactly ONE authoritative backend search request on explicit Search button click
  const performSearch = useCallback(async () => {
    if (mode !== 'passenger') return;

    const trimmedOrigin = origin.trim();
    const trimmedDest = destination.trim();

    if (!trimmedOrigin) {
      showToast('Please enter an origin city or pickup location');
      return;
    }
    if (!trimmedDest) {
      showToast('Please enter a destination city or drop location');
      return;
    }
    if (!dateIso) {
      showToast('Please select a travel date');
      return;
    }

    // Double-click guard
    if (inFlightRef.current || isLoading) {
      return;
    }

    // Cancel any previous in-flight request so stale responses are discarded
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Monotonic request ID for latest-response-wins protection
    const currentReqId = ++searchRequestIdRef.current;

    inFlightRef.current = true;
    setIsLoading(true);
    setHasSearched(true);
    setShowAllOtherOptions(false);
    setSearchSummaryRoute({ origin: trimmedOrigin, destination: trimmedDest, date: dateIso });

    try {
      const matchRes = await api.findMatches({
        origin: originCoords ? { name: trimmedOrigin, latitude: originCoords.latitude, longitude: originCoords.longitude } : trimmedOrigin,
        destination: destCoords ? { name: trimmedDest, latitude: destCoords.latitude, longitude: destCoords.longitude } : trimmedDest,
        date: dateIso, // Canonical YYYY-MM-DD
        seats: 1,
        budget: maxPrice < 1000 ? maxPrice : undefined,
        origin_latitude: originCoords?.latitude,
        origin_longitude: originCoords?.longitude,
        destination_latitude: destCoords?.latitude,
        destination_longitude: destCoords?.longitude,
      }, controller.signal);

      // Stale response check: ignore if a newer search was initiated
      if (currentReqId !== searchRequestIdRef.current) {
        return;
      }

      if (matchRes && matchRes.status === 'matched') {
        const best = matchRes.best_match || (matchRes.candidates && matchRes.candidates[0]) || null;
        const others = matchRes.other_options || (matchRes.candidates ? matchRes.candidates.slice(1) : []);
        setBestMatch(best);
        setOtherOptions(others);
        setTotalMatchesCount(matchRes.total_matches ?? (matchRes.candidates?.length || (best ? 1 + others.length : 0)));
      } else {
        setBestMatch(null);
        setOtherOptions([]);
        setTotalMatchesCount(0);
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        return; // Ignore aborted requests
      }
      if (currentReqId !== searchRequestIdRef.current) {
        return;
      }
      console.warn('Search request error:', e);
      setBestMatch(null);
      setOtherOptions([]);
      setTotalMatchesCount(0);
    } finally {
      if (currentReqId === searchRequestIdRef.current) {
        inFlightRef.current = false;
        setIsLoading(false);
      }
    }
  }, [mode, origin, destination, originCoords, destCoords, dateIso, maxPrice, isLoading, showToast]);

  // Client-side quick filter toggles on candidate trips
  const applyCandidateFilters = useCallback((candidateList: CandidateMatch[]): CandidateMatch[] => {
    let result = [...candidateList];

    if (onlyVerified) {
      result = result.filter(c => c.trip.driverIsVerified);
    }
    if (onlyInstant) {
      result = result.filter(c => c.trip.instantBooking);
    }
    if (maxPrice < 1000) {
      result = result.filter(c => {
        const p = c.trip.currentMarketPrice ?? c.trip.pricePerSeat;
        return p <= maxPrice;
      });
    }
    if (timeFilter !== 'all') {
      result = result.filter(c => {
        try {
          const hour = parseInt(c.trip.departureTime.split(':')[0], 10);
          if (timeFilter === 'morning') return hour >= 6 && hour < 12;
          if (timeFilter === 'afternoon') return hour >= 12 && hour < 17;
          if (timeFilter === 'evening') return hour >= 17;
        } catch {
          return true;
        }
        return true;
      });
    }

    if (sortBy === 'cheapest') {
      result.sort((a, b) => {
        const pa = a.trip.currentMarketPrice ?? a.trip.pricePerSeat;
        const pb = b.trip.currentMarketPrice ?? b.trip.pricePerSeat;
        return pa - pb;
      });
    } else if (sortBy === 'earliest') {
      result.sort((a, b) => (a.trip.departureTime || '').localeCompare(b.trip.departureTime || ''));
    } else if (sortBy === 'rating') {
      result.sort((a, b) => b.trip.driverRating - a.trip.driverRating);
    } else {
      // Default: respect backend match score ranking
      result.sort((a, b) => b.match_score - a.match_score);
    }

    return result;
  }, [onlyVerified, onlyInstant, maxPrice, timeFilter, sortBy]);

  // Filtered and Sorted Candidate other options
  const displayedOtherOptions = useMemo(() => {
    return applyCandidateFilters(otherOptions);
  }, [otherOptions, applyCandidateFilters]);

  // Initial limit: up to 3 other options displayed
  const visibleOtherOptions = useMemo(() => {
    if (showAllOtherOptions) {
      return displayedOtherOptions;
    }
    return displayedOtherOptions.slice(0, 3);
  }, [displayedOtherOptions, showAllOtherOptions]);

  // Filtered Passenger Requests (when mode === 'driver')
  const filteredRequests = useMemo(() => {
    return (passengerRequests || []).filter((r) => {
      const rOrigin = (r?.origin || '').toLowerCase();
      const rDest = (r?.destination || '').toLowerCase();
      const matchOrigin = !origin || rOrigin.includes(origin.toLowerCase());
      const matchDest = !destination || rDest.includes(destination.toLowerCase());
      return matchOrigin && matchDest;
    });
  }, [passengerRequests, origin, destination]);

  // Filtered Luggage (when mode === 'luggage')
  const filteredLuggage = useMemo(() => {
    return (luggagePackages || []).filter((l) => {
      const lOrigin = (l?.origin || '').toLowerCase();
      const lDest = (l?.destination || '').toLowerCase();
      const matchOrigin = !origin || lOrigin.includes(origin.toLowerCase());
      const matchDest = !destination || lDest.includes(destination.toLowerCase());
      return matchOrigin && matchDest;
    });
  }, [luggagePackages, origin, destination]);

  const handleSelectRide = (selected: Trip) => {
    // Flow: Search -> Rank candidates -> User selects ride -> View details -> Select seat -> Booking -> Pay
    onSelectTrip(selected);
  };

  // Popular route selection updates form state ONLY without making API calls
  const handlePopularRouteClick = (fromCity: string, toCity: string, preferredIsoDate: string) => {
    setOrigin(fromCity);
    setDestination(toCity);
    setDateIso(toCanonicalIsoDate(preferredIsoDate));
    setOriginCoords(null);
    setDestCoords(null);
  };

  // Intelligent label based on backend score
  const getMatchScoreBadge = (score: number) => {
    const roundScore = Math.round(score);
    let label = 'Best available match';
    if (roundScore >= 95) {
      label = 'Perfect Match';
    } else if (roundScore >= 85) {
      label = 'Best Match';
    }

    return {
      label,
      percent: `${roundScore}% Match`,
      score: roundScore,
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ================= PAGE HEADER ================= */}
      <div className="text-center sm:text-left space-y-1">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
          Find Your Perfect Ride
        </h1>
        <p className="text-sm text-slate-500 font-medium">
          Smart matching. Fair prices. Verified users.
        </p>
      </div>

      {/* ================= MODE SELECTION TABS ================= */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl max-w-xl mx-auto sm:mx-0">
        <button
          type="button"
          onClick={() => { setMode('passenger'); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === 'passenger'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>I need a ride</span>
        </button>

        <button
          type="button"
          onClick={() => { setMode('driver'); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === 'driver'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>I'm driving</span>
        </button>

        <button
          type="button"
          onClick={() => { setMode('luggage'); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === 'luggage'
              ? 'bg-white text-slate-950 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Luggage</span>
        </button>
      </div>

      {/* ================= SEARCH FORM CARD ================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-xs border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          {/* Origin */}
          <div className="md:col-span-4">
            <LocationSearchInput
              label="From (Origin)"
              placeholder="City, airport, campus or landmark"
              value={origin}
              onChange={(val) => {
                setOrigin(val);
                setOriginCoords(null);
              }}
              onSelectLocation={(loc) => {
                setOrigin(loc.name);
                setOriginCoords({ latitude: loc.latitude, longitude: loc.longitude });
              }}
              iconType="origin"
            />
          </div>

          {/* Swap Button (Desktop / Tablet) */}
          <div className="hidden md:flex md:col-span-1 justify-center pb-2">
            <button
              type="button"
              onClick={handleSwap}
              className="w-10 h-10 rounded-full border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 shadow-2xs hover:scale-105 transition-all cursor-pointer"
              title="Swap locations"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
          </div>

          {/* Destination */}
          <div className="md:col-span-4">
            <LocationSearchInput
              label="To (Destination)"
              placeholder="Destination point or neighborhood"
              value={destination}
              onChange={(val) => {
                setDestination(val);
                setDestCoords(null);
              }}
              onSelectLocation={(loc) => {
                setDestination(loc.name);
                setDestCoords({ latitude: loc.latitude, longitude: loc.longitude });
              }}
              iconType="destination"
            />
          </div>

          {/* Modern Calendar Picker (Zero manual editable text entry, stores canonical YYYY-MM-DD) */}
          <div className="md:col-span-2">
            <CalendarPicker
              label="Date"
              value={dateIso}
              onChange={(newIsoDate) => {
                setDateIso(newIsoDate);
                // Zero matching API calls on date selection
              }}
            />
          </div>

          {/* Explicit Search Button (The ONLY trigger for matching search) */}
          <div className="md:col-span-1">
            <button
              type="button"
              id="btn-search-rides"
              onClick={performSearch}
              disabled={isLoading}
              className="w-full py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 active:scale-98 text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer shadow-xs disabled:opacity-60"
              title="Search"
            >
              <Search className="w-4 h-4 mr-1.5" />
              <span className="md:hidden">Search</span>
            </button>
          </div>
        </div>

        {/* Mobile Swap Link */}
        <div className="md:hidden flex justify-end mt-2">
          <button
            type="button"
            onClick={handleSwap}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Swap From and To</span>
          </button>
        </div>

        {/* Popular route suggestions (Pure state update, ZERO API calls until Search clicked) */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs text-slate-500 no-scrollbar">
          <span className="font-semibold text-slate-700 shrink-0">Popular routes:</span>
          {[
            { label: 'Bengaluru → Hyderabad', from: 'Bengaluru', to: 'Hyderabad', date: '2026-10-10' },
            { label: 'Mumbai → Pune', from: 'Mumbai', to: 'Pune', date: '2026-10-12' },
            { label: 'BLR Airport → Whitefield', from: 'BLR Airport', to: 'Whitefield', date: '2026-10-10' },
          ].map((preset, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                handlePopularRouteClick(preset.from, preset.to, preset.date);
              }}
              className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 transition-colors cursor-pointer font-medium"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* ================= RESULTS / IDLE CONTAINER ================= */}
      <div className="space-y-6">
        {/* 1. PROFESSIONAL SEARCHING / LOADING STATE */}
        {isLoading && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs max-w-3xl mx-auto space-y-6 animate-in fade-in duration-150">
            <div className="flex items-start gap-4">
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 animate-spin" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Finding the best match for you...
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We're checking available rides, routes, departure times and prices.
                </p>
              </div>
            </div>

            {/* Visual Step Progress (purely visual, zero extra API calls, removed instantly when response arrives) */}
            <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
              <div className="flex items-center gap-2.5 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">Searching available rides</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">Checking route compatibility</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">Comparing departure times</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700">
                <div className="w-4 h-4 rounded-full border-2 border-emerald-600 border-t-transparent animate-spin shrink-0"></div>
                <span className="font-semibold text-emerald-800">Finding the best match</span>
              </div>
            </div>
          </div>
        )}

        {/* 2. INITIAL IDLE STATE (Zero search triggered yet) */}
        {!hasSearched && !isLoading && mode === 'passenger' && (
          <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-xs max-w-3xl mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-500 flex items-center justify-center mx-auto border border-slate-100">
              <Search className="w-6 h-6" />
            </div>
            <div className="space-y-1.5 max-w-md mx-auto">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Ready to find your ride?
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Enter your departure and arrival points above, pick a travel date, and click Search to get your best verified match.
              </p>
            </div>
          </div>
        )}

        {/* 3. SEARCH RESULTS (PASSENGER MODE AFTER SEARCH) */}
        {hasSearched && !isLoading && mode === 'passenger' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Results Sub-header with filter controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
              <div>
                <p className="text-xs text-slate-500 font-medium">
                  {searchSummaryRoute.origin} → {searchSummaryRoute.destination} · {formatDisplayDate(searchSummaryRoute.date)}
                  {totalMatchesCount > 0 && ` · ${totalMatchesCount} available ${totalMatchesCount === 1 ? 'ride' : 'rides'}`}
                </p>
              </div>

              {bestMatch && (
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {/* Sort selector */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 shadow-2xs">
                    <span className="text-xs text-slate-500 font-medium">Sort:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="bg-transparent text-xs font-bold text-slate-800 focus:outline-hidden cursor-pointer"
                    >
                      <option value="best">Best match</option>
                      <option value="cheapest">Cheapest first</option>
                      <option value="earliest">Earliest departure</option>
                      <option value="rating">Highest rated driver</option>
                    </select>
                  </div>

                  {/* Filter modal trigger */}
                  <button
                    type="button"
                    onClick={() => setShowFilterModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Filters</span>
                    {(onlyVerified || onlyInstant || timeFilter !== 'all' || maxPrice < 1000) && (
                      <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* A. NO RESULTS STATE */}
            {!bestMatch ? (
              <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200 shadow-xs space-y-6">
                <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                  <Car className="w-7 h-7" />
                </div>
                
                <div className="space-y-1.5 max-w-md mx-auto">
                  <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                    No matching rides found right now
                  </h3>
                  <p className="text-slate-500 text-xs sm:text-sm leading-relaxed">
                    We couldn't find a ride that fits your route and preferences for this date.
                  </p>
                </div>

                {/* Helpful Suggestions */}
                <div className="bg-slate-50 rounded-2xl p-4 max-w-md mx-auto text-left text-xs text-slate-600 space-y-2 border border-slate-100">
                  <p className="font-bold text-slate-800">Suggestions:</p>
                  <ul className="space-y-1.5 list-disc list-inside text-slate-600">
                    <li>Try another travel date</li>
                    <li>Adjust your departure window</li>
                    <li>Increase your price range</li>
                    <li>Try a nearby pickup or drop location</li>
                  </ul>
                </div>

                {/* Action Buttons: Modify search & Post a ride request */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onNavigateScreen('post-request')}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
                  >
                    Post a ride request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOnlyVerified(false);
                      setOnlyInstant(false);
                      setTimeFilter('all');
                      setMaxPrice(1000);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Modify search
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* B. SECTION 10: ONE PRIMARY VISUALLY DOMINANT BEST MATCH */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-black text-slate-900 tracking-tight">
                        ✨ Best Match
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 font-medium">
                      Your best ride for this journey
                    </span>
                  </div>

                  {(() => {
                    const trip = bestMatch.trip;
                    const badge = getMatchScoreBadge(bestMatch.match_score);
                    const displayPrice = trip.currentMarketPrice ?? trip.pricePerSeat;

                    return (
                      <div 
                        onClick={() => handleSelectRide(trip)}
                        className="bg-white rounded-3xl p-6 sm:p-7 border-2 border-emerald-500/40 shadow-md hover:shadow-lg hover:border-emerald-600 transition-all cursor-pointer relative overflow-hidden group space-y-5"
                      >
                        {/* Top Accent Stripe */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-600" />

                        {/* Top Header: Driver Info & Price */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-full bg-slate-900 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                              {trip.driverInitials || trip.driverName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-black text-slate-950 text-base">{trip.driverName}</span>
                                {trip.driverIsVerified && (
                                  <span title="Verified Driver">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                                <div className="flex items-center text-amber-500 font-semibold">
                                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 mr-0.5" />
                                  <span>{trip.driverRating.toFixed(1)}</span>
                                </div>
                                <span>•</span>
                                <span>{trip.driverTripsCount} rides</span>
                              </div>
                            </div>
                          </div>

                          {/* Dynamic Market Price */}
                          <div className="text-right">
                            <span className="text-3xl font-black text-slate-950 tracking-tight">
                              {trip.currency || '₹'}{displayPrice}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium block">per seat</span>
                          </div>
                        </div>

                        {/* Route Timeline Box */}
                        <div className="bg-slate-50 rounded-2xl p-4 sm:p-5 border border-slate-100">
                          <div className="flex items-start gap-3.5">
                            <div className="flex flex-col items-center gap-1 mt-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                              <div className="w-0.5 h-8 bg-slate-300"></div>
                              <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                            </div>

                            <div className="flex-1 space-y-3.5">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-black text-sm text-slate-950 mr-2.5">{trip.departureTime}</span>
                                  <span className="font-bold text-slate-800 text-sm">{trip.origin}</span>
                                </div>
                                {trip.originDetail && (
                                  <span className="text-[11px] text-slate-400 truncate max-w-[150px] hidden sm:inline">
                                    {trip.originDetail}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="font-black text-sm text-slate-950 mr-2.5">{trip.arrivalTime}</span>
                                  <span className="font-bold text-slate-800 text-sm">{trip.destination}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-xs text-slate-500 font-semibold">{trip.duration}</span>
                                  {trip.date && (
                                    <span className="text-[11px] text-slate-400 block font-medium">{formatDisplayDate(trip.date)}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Vehicle & Seats & Prominent Action */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="px-3 py-1 rounded-full bg-slate-100 font-bold text-slate-800">
                              {trip.availableSeats} {trip.availableSeats === 1 ? 'seat' : 'seats'} left
                            </span>
                            {trip.vehicle && (
                              <span className="text-slate-600 font-medium">
                                {trip.vehicle.make} {trip.vehicle.model}
                              </span>
                            )}
                            {trip.instantBooking && (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-600" />
                                <span>Instant</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 justify-between sm:justify-end">
                            {/* Match Score Badge */}
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{badge.percent}</span>
                            </div>

                            {/* View & Book CTA */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectRide(trip);
                              }}
                              className="px-5 py-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer shadow-xs group-hover:scale-102"
                            >
                              <span>View &amp; Book</span>
                              <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* C. SECTION 12: OTHER OPTIONS (UP TO 3 INITIALLY) */}
                {displayedOtherOptions.length > 0 && (
                  <div className="space-y-3 pt-3">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">
                        Other options
                      </h3>
                      <span className="text-xs text-slate-400 font-medium">
                        {displayedOtherOptions.length} other eligible {displayedOtherOptions.length === 1 ? 'ride' : 'rides'}
                      </span>
                    </div>

                    <div className="space-y-3">
                      {visibleOtherOptions.map((candidate) => {
                        const trip = candidate.trip;
                        const matchPct = Math.round(candidate.match_score);
                        const displayPrice = trip.currentMarketPrice ?? trip.pricePerSeat;

                        return (
                          <div
                            key={candidate.trip_id}
                            onClick={() => handleSelectRide(trip)}
                            className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer group space-y-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0">
                                  {trip.driverInitials || trip.driverName.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-slate-900 text-sm">{trip.driverName}</span>
                                    {trip.driverIsVerified && (
                                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs text-slate-500">
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                                    <span className="font-semibold text-slate-700">{trip.driverRating.toFixed(1)}</span>
                                    <span>·</span>
                                    <span>{trip.driverTripsCount} rides</span>
                                  </div>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-xl font-black text-slate-950">
                                  {trip.currency || '₹'}{displayPrice}
                                </span>
                                <div className="text-[11px] font-bold text-emerald-700">
                                  {matchPct}% match
                                </div>
                              </div>
                            </div>

                            {/* Middle info */}
                            <div className="flex items-center justify-between text-xs text-slate-700 bg-slate-50 rounded-xl px-3 py-2">
                              <div>
                                <span className="font-bold text-slate-900">{trip.departureTime}</span>
                                <span className="mx-1.5 text-slate-400">→</span>
                                <span className="font-bold text-slate-900">{trip.arrivalTime}</span>
                                <span className="ml-2 text-slate-500 font-medium">{trip.origin} to {trip.destination}</span>
                              </div>
                              <span className="text-slate-400 font-medium">{trip.duration}</span>
                            </div>

                            {/* Bottom row */}
                            <div className="flex items-center justify-between text-xs pt-0.5">
                              <div className="flex items-center gap-2 text-slate-500">
                                {trip.vehicle && (
                                  <span>{trip.vehicle.make} {trip.vehicle.model}</span>
                                )}
                                <span>·</span>
                                <span>{trip.availableSeats} {trip.availableSeats === 1 ? 'seat' : 'seats'} left</span>
                              </div>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelectRide(trip);
                                }}
                                className="font-bold text-slate-900 hover:text-slate-700 flex items-center gap-1 cursor-pointer group-hover:translate-x-0.5 transition-transform"
                              >
                                <span>View details</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* View more rides button if more than 3 options exist */}
                    {displayedOtherOptions.length > 3 && !showAllOtherOptions && (
                      <div className="text-center pt-2">
                        <button
                          type="button"
                          onClick={() => setShowAllOtherOptions(true)}
                          className="px-5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>View {displayedOtherOptions.length - 3} more rides</span>
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* 4. DRIVER MODE: PASSENGER REQUESTS */}
        {mode === 'driver' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="text-lg font-black text-slate-950">Passenger Requests</h2>
            {filteredRequests.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
                <p className="text-slate-500 text-sm">No passenger requests match this route right now.</p>
              </div>
            ) : (
              filteredRequests.map((req) => (
                <div key={req.id} className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                        {req.passengerInitials}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900">{req.passengerName}</div>
                        <div className="text-[11px] text-slate-400">★ {req.passengerRating} • Needs {req.seatsNeeded} seat(s)</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-slate-950">₹{req.budgetPerSeat}</div>
                      <span className="text-[10px] text-slate-400">budget</span>
                    </div>
                  </div>

                  <div className="text-sm font-semibold text-slate-800">
                    {req.origin} → {req.destination}
                  </div>
                  <div className="text-xs text-slate-500">
                    Preferred: {req.timeWindow} • {req.date}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => showToast(`Sent ride offer to ${req.passengerName}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Offer ride
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* 5. LUGGAGE MODE */}
        {mode === 'luggage' && (
          <div className="max-w-4xl mx-auto space-y-4">
            <h2 className="text-lg font-black text-slate-950">Luggage Packages</h2>
            {filteredLuggage.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 text-center border border-slate-200">
                <p className="text-slate-500 text-sm">No luggage packages on this corridor.</p>
              </div>
            ) : (
              filteredLuggage.map((pkg) => (
                <div key={pkg.id} className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-800 flex items-center justify-center">
                        <Package className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-slate-900">{pkg.senderName}</div>
                        <div className="text-[11px] text-slate-400">Package: {pkg.size}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-slate-950">₹{pkg.priceOffer}</div>
                      <span className="text-[10px] text-slate-400">fee offered</span>
                    </div>
                  </div>

                  <div className="text-sm font-bold text-slate-800">
                    {pkg.origin} → {pkg.destination}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">Date: {pkg.date}</span>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectLuggage(pkg);
                        onNavigateScreen('luggage-confirm');
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Accept to carry
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* ================= FILTERS MODAL (Applies on explicit Apply Filters) ================= */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">Trip Filters</h3>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Max Price Slider */}
            <div>
              <div className="flex justify-between text-xs font-bold text-slate-700 mb-2">
                <span>Maximum Price</span>
                <span className="text-slate-950 text-sm font-black">₹{maxPrice}</span>
              </div>
              <input
                type="range"
                min="200"
                max="1200"
                step="50"
                value={maxPrice}
                onChange={(e) => setMaxPrice(parseInt(e.target.value, 10))}
                className="w-full accent-slate-950 cursor-pointer"
              />
            </div>

            {/* Departure Time */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">Departure Window</label>
              <div className="grid grid-cols-4 gap-2">
                {(['all', 'morning', 'afternoon', 'evening'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTimeFilter(t)}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                      timeFilter === t
                        ? 'bg-slate-950 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-800">Verified Drivers Only</span>
                <input
                  type="checkbox"
                  checked={onlyVerified}
                  onChange={(e) => setOnlyVerified(e.target.checked)}
                  className="w-4 h-4 accent-slate-950 rounded cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-bold text-slate-800">Instant Booking Only</span>
                <input
                  type="checkbox"
                  checked={onlyInstant}
                  onChange={(e) => setOnlyInstant(e.target.checked)}
                  className="w-4 h-4 accent-slate-950 rounded cursor-pointer"
                />
              </label>
            </div>

            <div className="pt-4 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setOnlyVerified(false);
                  setOnlyInstant(false);
                  setTimeFilter('all');
                  setMaxPrice(1000);
                  setShowFilterModal(false);
                }}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="flex-1 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
