import React from 'react';
import { ScreenId, User, Trip } from '../types';
import { MapPreview } from '../components/MapPreview';
import { 
  Car, 
  PlusCircle, 
  Package, 
  UserCheck, 
  Search, 
  Calendar, 
  ArrowRight, 
  Star, 
  ShieldCheck, 
  Clock, 
  ChevronRight,
  TrendingUp,
  MapPin
} from 'lucide-react';

interface HomeViewProps {
  user: User;
  activeTrips: Trip[];
  onNavigateScreen: (screen: ScreenId) => void;
  onSelectTrip: (trip: Trip) => void;
  onQuickSearch: (origin: string, dest: string, date: string, mode: 'passenger' | 'driver' | 'luggage') => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  activeTrips,
  onNavigateScreen,
  onSelectTrip,
  onQuickSearch,
}) => {
  // Find booked user trip if any
  const bookedTrip = activeTrips.find((t) => t.isPassengerTrip && t.status === 'upcoming');
  const driverTrip = activeTrips.find((t) => t.isDriverTrip && t.status === 'upcoming');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* ================= GREETING & STATUS BANNER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <span>Welcome back</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight flex items-center gap-2">
            <span>Hello, {user.name.split(' ')[0]}</span>
            <span className="text-2xl">👋</span>
          </h1>
        </div>

        {/* User Badges */}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 shadow-2xs">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span>{user.rating} rating</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-500">{user.tripsCount} trips</span>
          </div>
          {user.isVerified && (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Verified ID</span>
            </div>
          )}
          {user.isStudentVerified && (
            <button
              onClick={() => onNavigateScreen('account-student')}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-800 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <span>🎓 Student</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= DESKTOP / TABLET HERO SEARCH BAR ================= */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 shadow-sm border border-slate-200">
        <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4 flex items-center justify-between">
          <span>Search or match journeys</span>
          <span className="text-xs font-normal text-slate-500">City, Campus, Airport or Exact Point</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              From
            </span>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></div>
              <input
                type="text"
                defaultValue="Bengaluru"
                id="hero-from"
                className="w-full bg-transparent font-bold text-slate-900 text-sm focus:outline-hidden"
                placeholder="Origin city or address"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              To
            </span>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></div>
              <input
                type="text"
                defaultValue="Hyderabad"
                id="hero-to"
                className="w-full bg-transparent font-bold text-slate-900 text-sm focus:outline-hidden"
                placeholder="Destination"
              />
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Date
            </span>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                defaultValue="Sat, 10 Oct"
                id="hero-date"
                className="w-full bg-transparent font-bold text-slate-900 text-sm focus:outline-hidden"
              />
            </div>
          </div>

          <button
            onClick={() => {
              const fromVal = (document.getElementById('hero-from') as HTMLInputElement)?.value || 'Bengaluru';
              const toVal = (document.getElementById('hero-to') as HTMLInputElement)?.value || 'Hyderabad';
              const dateVal = (document.getElementById('hero-date') as HTMLInputElement)?.value || 'Sat, 10 Oct';
              onQuickSearch(fromVal, toVal, dateVal, 'passenger');
            }}
            className="w-full py-3.5 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <Search className="w-4 h-4" />
            <span>Search trips</span>
          </button>
        </div>
      </div>

      {/* ================= ACTIVE / UPCOMING TRIP BANNER (IF ANY) ================= */}
      {(bookedTrip || driverTrip) && (
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-3xl p-5 sm:p-6 shadow-md relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[11px] uppercase tracking-wider border border-emerald-500/30">
                  {bookedTrip ? 'Confirmed Booking' : 'Your Scheduled Drive'}
                </span>
                <span className="text-xs text-slate-300">
                  {bookedTrip ? bookedTrip.date : driverTrip?.date} • {bookedTrip ? bookedTrip.departureTime : driverTrip?.departureTime}
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                {bookedTrip ? `${bookedTrip.origin} → ${bookedTrip.destination}` : `${driverTrip?.origin} → ${driverTrip?.destination}`}
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-1">
                {bookedTrip ? `Driver: ${bookedTrip.driverName} • ${bookedTrip.vehicle.make} ${bookedTrip.vehicle.model}` : `Available seats: ${driverTrip?.availableSeats}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (bookedTrip) onSelectTrip(bookedTrip);
                  else if (driverTrip) onSelectTrip(driverTrip);
                }}
                className="px-5 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-sm hover:bg-slate-100 transition-colors shadow-xs cursor-pointer"
              >
                View details
              </button>
              {bookedTrip && (
                <button
                  onClick={() => onNavigateScreen('chat')}
                  className="px-4 py-2.5 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-white font-semibold text-sm transition-colors cursor-pointer"
                >
                  Chat
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= INTERACTIVE ROUTE MAP PREVIEW ================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">Live Route Highway</h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">Active Corridor</span>
          </div>
          <button
            onClick={() => onNavigateScreen('find')}
            className="text-xs font-bold text-slate-900 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Explore routes</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
        <MapPreview origin="Bengaluru" destination="Hyderabad" height="h-60 sm:h-72" />
      </div>

      {/* ================= WHAT DO YOU NEED? (QUICK ACTION GRID) ================= */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">What would you like to do?</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Find a ride */}
          <button
            onClick={() => onNavigateScreen('find')}
            className="p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition-all hover:shadow-sm cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-900 flex items-center justify-center mb-4 transition-colors">
              <Car className="w-6 h-6" />
            </div>
            <div className="font-black text-slate-950 text-base">Find a ride</div>
            <div className="text-xs text-slate-500 mt-1">Book a seat with a verified driver</div>
          </button>

          {/* 2. Post a trip */}
          <button
            onClick={() => onNavigateScreen('post-trip')}
            className="p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition-all hover:shadow-sm cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-900 flex items-center justify-center mb-4 transition-colors">
              <PlusCircle className="w-6 h-6" />
            </div>
            <div className="font-black text-slate-950 text-base">Post a trip</div>
            <div className="text-xs text-slate-500 mt-1">I’m driving and have empty seats</div>
          </button>

          {/* 3. Send Luggage */}
          <button
            onClick={() => onNavigateScreen('luggage')}
            className="p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition-all hover:shadow-sm cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-900 flex items-center justify-center mb-4 transition-colors">
              <Package className="w-6 h-6" />
            </div>
            <div className="font-black text-slate-950 text-base">Send luggage</div>
            <div className="text-xs text-slate-500 mt-1">Send parcels with travelers</div>
          </button>

          {/* 4. Post Passenger Request */}
          <button
            onClick={() => onNavigateScreen('post-request')}
            className="p-5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-left transition-all hover:shadow-sm cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-2xl bg-slate-100 group-hover:bg-slate-900 group-hover:text-white text-slate-900 flex items-center justify-center mb-4 transition-colors">
              <UserCheck className="w-6 h-6" />
            </div>
            <div className="font-black text-slate-950 text-base">Post request</div>
            <div className="text-xs text-slate-500 mt-1">Need a custom ride or timing</div>
          </button>
        </div>
      </div>

      {/* ================= POPULAR ROUTES & HIGHLIGHTS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
        {/* Popular corridors */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-base text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>Popular TopRide Routes</span>
            </h3>
            <span className="text-xs text-slate-400">Regular daily departures</span>
          </div>

          <div className="divide-y divide-slate-100">
            {[
              { from: 'Bengaluru', to: 'Hyderabad', fare: '₹650', time: '8h 30m', frequency: '12 daily rides' },
              { from: 'Mumbai', to: 'Pune', fare: '₹380', time: '3h 15m', frequency: '24 daily rides' },
              { from: 'Bengaluru', to: 'Chennai', fare: '₹500', time: '5h 30m', frequency: '9 daily rides' },
              { from: 'Algoma Campus', to: 'Downtown Station', fare: '₹200', time: '35m', frequency: 'Student shuttle' },
            ].map((route, i) => (
              <button
                key={i}
                onClick={() => onQuickSearch(route.from, route.to, 'Sat, 10 Oct', 'passenger')}
                className="w-full py-3 flex items-center justify-between text-left hover:bg-slate-50 px-2 rounded-xl transition-colors cursor-pointer group"
              >
                <div>
                  <div className="font-bold text-sm text-slate-900 group-hover:text-slate-700">
                    {route.from} → {route.to}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {route.time} • {route.frequency}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-sm text-slate-900">{route.fare}</div>
                  <div className="text-[11px] text-emerald-600 font-semibold">Instant booking</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Community Trust / University banner */}
        <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-bold border border-indigo-500/30">
                Campus & Student Network
              </span>
            </div>
            <h3 className="text-xl font-black tracking-tight mb-2">
              Verified university communities
            </h3>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              Connect your university email (e.g. Algoma, IISc, IITs) to unlock exclusive campus routes, peer carpooling, and waived platform fees.
            </p>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800">
            <div className="text-xs text-slate-400">
              <span className="font-bold text-white">4,200+</span> verified students active
            </div>
            <button
              onClick={() => onNavigateScreen('account-student')}
              className="px-4 py-2 rounded-xl bg-white text-slate-950 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Verify student status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
