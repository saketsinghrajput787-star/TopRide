import React, { useState, useMemo } from 'react';
import { Trip, PassengerRequest, LuggagePackage, ScreenId } from '../types';
import { api } from '../api';
import { MapPreview } from '../components/MapPreview';
import { LocationSearchInput } from '../components/LocationSearchInput';
import { 
  Search, 
  ArrowLeftRight, 
  Calendar, 
  Filter, 
  Star, 
  ShieldCheck, 
  Car, 
  Package, 
  SlidersHorizontal, 
  X, 
  Check, 
  ArrowRight,
  Clock,
  MapPin,
  Luggage,
  Sparkles
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
  initialDate = 'Sat, 10 Oct',
  initialMode = 'passenger',
  trips,
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
  const [date, setDate] = useState(initialDate);

  // Filters
  const [sortBy, setSortBy] = useState<'cheapest' | 'earliest' | 'rating'>('cheapest');
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [onlyInstant, setOnlyInstant] = useState(false);
  const [maxPrice, setMaxPrice] = useState<number>(1000);
  const [timeFilter, setTimeFilter] = useState<'all' | 'morning' | 'afternoon' | 'evening'>('all');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Swap Origin and Destination
  const handleSwap = () => {
    const tempOrigin = origin;
    const tempCoords = originCoords;
    setOrigin(destination);
    setOriginCoords(destCoords);
    setDestination(tempOrigin);
    setDestCoords(tempCoords);
    showToast('Locations swapped');
  };

  // Real Search Results from API
  const [apiTrips, setApiTrips] = useState<Trip[]>(trips);

  const fetchSearchResults = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.searchTrips({
        origin: origin.trim() || undefined,
        destination: destination.trim() || undefined,
        date: (date && date.trim()) || undefined,
        onlyVerified,
        onlyInstant,
        maxPrice,
        timeFilter,
        sortBy,
      });
      setApiTrips(res);
    } catch (e) {
      console.warn('Real search error:', e);
    } finally {
      setIsLoading(false);
    }
  }, [origin, destination, date, onlyVerified, onlyInstant, maxPrice, timeFilter, sortBy]);

  React.useEffect(() => {
    fetchSearchResults();
  }, [fetchSearchResults]);

  // Sync if prop trips change and search is default
  React.useEffect(() => {
    if (trips && trips.length > 0 && !origin && !destination) {
      setApiTrips(trips);
    }
  }, [trips]);

  const filteredTrips = apiTrips;

  // Filtered Passenger Requests (when mode === 'driver')
  const filteredRequests = useMemo(() => {
    return passengerRequests.filter((r) => {
      const matchOrigin = !origin || r.origin.toLowerCase().includes(origin.toLowerCase());
      const matchDest = !destination || r.destination.toLowerCase().includes(destination.toLowerCase());
      return matchOrigin && matchDest;
    });
  }, [passengerRequests, origin, destination]);

  // Filtered Luggage (when mode === 'luggage')
  const filteredLuggage = useMemo(() => {
    return luggagePackages.filter((l) => {
      const matchOrigin = !origin || l.origin.toLowerCase().includes(origin.toLowerCase());
      const matchDest = !destination || l.destination.toLowerCase().includes(destination.toLowerCase());
      return matchOrigin && matchDest;
    });
  }, [luggagePackages, origin, destination]);

  const triggerSearch = () => {
    fetchSearchResults();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ================= MODE SELECTION TABS ================= */}
      <div className="flex bg-slate-200/80 p-1.5 rounded-2xl max-w-xl mx-auto">
        <button
          onClick={() => { setMode('passenger'); triggerSearch(); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === 'passenger'
              ? 'bg-white text-slate-950 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Car className="w-4 h-4" />
          <span>I need a ride</span>
        </button>

        <button
          onClick={() => { setMode('driver'); triggerSearch(); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === 'driver'
              ? 'bg-white text-slate-950 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>I'm driving</span>
        </button>

        <button
          onClick={() => { setMode('luggage'); triggerSearch(); }}
          className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            mode === 'luggage'
              ? 'bg-white text-slate-950 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Luggage</span>
        </button>
      </div>

      {/* ================= SEARCH FORM CARD ================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200">
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

          {/* Date Picker */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
              Date
            </label>
            <div className="relative flex items-center bg-white rounded-2xl border border-slate-200 shadow-xs focus-within:border-slate-950 focus-within:ring-1 focus-within:ring-slate-950 transition-all px-3 py-3.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-transparent font-semibold text-slate-900 text-xs sm:text-sm focus:outline-hidden"
              />
            </div>
          </div>

          {/* Search Button */}
          <div className="md:col-span-1">
            <button
              onClick={triggerSearch}
              className="w-full py-3.5 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm flex items-center justify-center transition-all cursor-pointer"
              title="Search"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Swap Link */}
        <div className="md:hidden flex justify-end mt-2">
          <button
            onClick={handleSwap}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Swap From and To</span>
          </button>
        </div>

        {/* Quick location tag suggestions */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto text-xs text-slate-500 no-scrollbar">
          <span className="font-semibold text-slate-700 shrink-0">Popular:</span>
          {['Bengaluru → Hyderabad', 'Mumbai → Pune', 'BLR Airport → Whitefield', 'Algoma Campus → City Center'].map((preset, i) => (
            <button
              key={i}
              onClick={() => {
                const parts = preset.split(' → ');
                setOrigin(parts[0]);
                setDestination(parts[1]);
                setOriginCoords(null);
                setDestCoords(null);
                triggerSearch();
              }}
              className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 shrink-0 transition-colors cursor-pointer"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* ================= REAL MAPBOX CORRIDOR ROUTE PREVIEW ================= */}
      {origin && destination && (
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Route Highway Map</span>
            </div>
            <span className="text-xs text-slate-500 font-semibold">{origin} → {destination}</span>
          </div>
          <MapPreview
            origin={origin}
            destination={destination}
            originCoords={originCoords || undefined}
            destCoords={destCoords || undefined}
            height="h-44 sm:h-56"
          />
        </div>
      )}


      {/* ================= RESULTS HEADER & FILTER CONTROLS ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-slate-950 tracking-tight">
            {mode === 'passenger' && `${filteredTrips.length} rides available`}
            {mode === 'driver' && `${filteredRequests.length} passenger requests waiting`}
            {mode === 'luggage' && `${filteredLuggage.length} luggage delivery requests`}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {origin || 'Anywhere'} → {destination || 'Anywhere'} • {date}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {/* Sort selector */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 focus:outline-hidden cursor-pointer"
          >
            <option value="cheapest">Cheapest first</option>
            <option value="earliest">Earliest departure</option>
            <option value="rating">Highest rated driver</option>
          </select>

          {/* Filter button */}
          <button
            onClick={() => setShowFilterModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {(onlyVerified || onlyInstant || timeFilter !== 'all' || maxPrice < 1000) && (
              <span className="w-2 h-2 rounded-full bg-slate-950"></span>
            )}
          </button>
        </div>
      </div>

      {/* ================= TWO-COLUMN DESKTOP LAYOUT (RESULTS + MAP) ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT: RESULTS CARDS (col 7 on desktop) */}
        <div className="lg:col-span-7 space-y-4">
          {isLoading ? (
            // Loading skeleton state
            <div className="space-y-4">
              {[1, 2, 3].map((n) => (
                <div key={n} className="bg-white rounded-3xl p-5 border border-slate-200 animate-pulse space-y-3">
                  <div className="flex justify-between">
                    <div className="w-24 h-4 bg-slate-200 rounded"></div>
                    <div className="w-16 h-4 bg-slate-200 rounded"></div>
                  </div>
                  <div className="w-48 h-6 bg-slate-200 rounded"></div>
                  <div className="w-full h-10 bg-slate-100 rounded-xl"></div>
                </div>
              ))}
            </div>
          ) : mode === 'passenger' ? (
            // ---------------- PASSENGER MODE: RIDES FOUND ----------------
            filteredTrips.length === 0 ? (
              <div className="bg-white rounded-3xl p-8 sm:p-12 text-center border border-slate-200">
                <div className="w-16 h-16 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-4">
                  <Car className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-1">No trips found</h3>
                <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto mb-6">
                  No drivers are currently scheduled for this exact route and filter combination.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={() => {
                      setOnlyVerified(false);
                      setOnlyInstant(false);
                      setTimeFilter('all');
                      setMaxPrice(1000);
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
                  >
                    Reset filters
                  </button>
                  <button
                    onClick={() => onNavigateScreen('post-request')}
                    className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Post a passenger request
                  </button>
                </div>
              </div>
            ) : (
              filteredTrips.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => onSelectTrip(trip)}
                  className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
                >
                  {/* Top row: Driver info & Price */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                        {trip.driverInitials}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 text-sm">{trip.driverName}</span>
                          {trip.driverIsVerified && (
                            <span title="Verified Driver">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            </span>
                          )}

                        </div>
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span className="font-semibold text-slate-700">{trip.driverRating}</span>
                          <span>•</span>
                          <span>{trip.driverTripsCount} rides</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-black text-slate-950">
                        {trip.currency}{trip.pricePerSeat}
                      </div>
                      <span className="text-[11px] text-slate-400 font-medium">per seat</span>
                    </div>
                  </div>

                  {/* Route Timeline */}
                  <div className="bg-slate-50 rounded-2xl p-4 mb-4">
                    <div className="flex items-start gap-3">
                      {/* Visual indicators */}
                      <div className="flex flex-col items-center gap-1 mt-1">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                        <div className="w-0.5 h-7 bg-slate-300"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                      </div>

                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm text-slate-900 mr-2">{trip.departureTime}</span>
                            <span className="font-semibold text-slate-800 text-sm">{trip.origin}</span>
                          </div>
                          {trip.originDetail && (
                            <span className="text-[11px] text-slate-400 truncate max-w-[140px] hidden sm:inline">
                              {trip.originDetail}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-bold text-sm text-slate-900 mr-2">{trip.arrivalTime}</span>
                            <span className="font-semibold text-slate-800 text-sm">{trip.destination}</span>
                          </div>
                          <span className="text-xs text-slate-400 font-medium">{trip.duration}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Row: Badges & CTA */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 font-bold text-slate-700">
                        {trip.availableSeats} {trip.availableSeats === 1 ? 'seat' : 'seats'} left
                      </span>
                      {trip.instantBooking && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 font-bold border border-amber-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-amber-600" />
                          <span>Instant</span>
                        </span>
                      )}
                      <span className="text-slate-400 hidden sm:inline">
                        {trip.vehicle.make} {trip.vehicle.model}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTrip(trip);
                      }}
                      className="px-4 py-2 rounded-xl bg-slate-950 group-hover:bg-slate-800 text-white font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <span>Select seat</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )
          ) : mode === 'driver' ? (
            // ---------------- DRIVER MODE: PASSENGER REQUESTS ----------------
            filteredRequests.length === 0 ? (
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
                  {req.notes && (
                    <div className="p-2.5 bg-slate-50 rounded-xl text-xs text-slate-600 italic">
                      "{req.notes}"
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex gap-1.5 flex-wrap">
                      {req.preferences.map((p, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-slate-100 rounded-md text-[10px] font-semibold text-slate-600">
                          {p}
                        </span>
                      ))}
                    </div>
                    <button
                      onClick={() => showToast(`Sent ride offer to ${req.passengerName}`)}
                      className="px-3.5 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Offer ride
                    </button>
                  </div>
                </div>
              ))
            )
          ) : (
            // ---------------- LUGGAGE MODE ----------------
            filteredLuggage.length === 0 ? (
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
                  <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                    {pkg.description}
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-400">Date: {pkg.date}</span>
                    <button
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
            )
          )}
        </div>



        {/* RIGHT: LIVE INTERACTIVE HIGHWAY MAP & QUICK ROUTE INFO (col 5 on desktop) */}
        <div className="hidden lg:block lg:col-span-5 sticky top-24 space-y-4">
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-black text-sm text-slate-900">Corridor Route Preview</h3>
                <span className="text-xs text-slate-400">Live distance and transit conditions</span>
              </div>
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-full">
                Smooth Traffic
              </span>
            </div>

            <MapPreview origin={origin} destination={destination} height="h-64" />

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Average Duration</span>
                <span className="font-bold text-slate-900 text-sm">8h 15m</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block mb-0.5">Avg Seat Fare</span>
                <span className="font-bold text-slate-900 text-sm">₹600 - ₹750</span>
              </div>
            </div>

            <div className="p-3 bg-slate-100 rounded-2xl flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Looking for a custom departure?</span>
              <button
                onClick={() => onNavigateScreen('post-request')}
                className="text-slate-950 underline font-bold cursor-pointer"
              >
                Post request
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ================= FILTERS MODAL ================= */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-lg text-slate-900">Trip Filters</h3>
              <button
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
