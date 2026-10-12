import React, { useState, useEffect, useCallback } from 'react';
import { Trip, Booking, LuggagePackage, ScreenId, User } from '../types';
import { api } from '../api';
import { 
  Calendar, 
  Car, 
  Package, 
  Clock, 
  MapPin, 
  X, 
  AlertTriangle, 
  CheckCircle2,
  XCircle,
  Download,
  RefreshCw,
  Users,
  Check,
  ArrowRight,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface TripsViewProps {
  trips?: Trip[];
  luggagePackages?: LuggagePackage[];
  currentUser?: User | null;
  onSelectTrip: (trip: Trip) => void;
  onCancelTrip?: (tripId: string, reason: string) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  showToast: (msg: string) => void;
}

/**
 * Robust date/time parser matching TopRide canonical format ('Sat, 31 Oct' or '2026-10-31' and 'HH:mm').
 */
export function parseTripDateTime(dateStr?: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();

  let year: number = 2026;
  let month: number | null = null;
  let day: number | null = null;

  // 1. Check ISO format YYYY-MM-DD
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    year = parseInt(isoMatch[1], 10);
    month = parseInt(isoMatch[2], 10) - 1;
    day = parseInt(isoMatch[3], 10);
  } else {
    // 2. Textual format e.g. "Sat, 31 Oct" or "31 Oct 2026"
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const words = trimmed.replace(/,/g, ' ').split(/\s+/).filter(Boolean);

    for (const w of words) {
      const lower = w.toLowerCase().slice(0, 3);
      if (months[lower] !== undefined && month === null) {
        month = months[lower];
      } else if (/^\d+$/.test(w)) {
        const n = parseInt(w, 10);
        if (n > 1900) {
          year = n;
        } else if (n >= 1 && n <= 31 && day === null) {
          day = n;
        }
      }
    }
  }

  if (day === null || month === null) {
    return null;
  }

  let hours = 0;
  let minutes = 0;
  if (timeStr && timeStr.includes(':')) {
    const parts = timeStr.trim().split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h)) hours = h;
    if (!isNaN(m)) minutes = m;
  }

  return new Date(year, month, day, hours, minutes);
}

/**
 * Check if a trip/booking departure is still upcoming in the future.
 */
export function isTripUpcoming(dateStr?: string, timeStr?: string, status?: string): boolean {
  if (status === 'cancelled' || status === 'completed') return false;
  const d = parseTripDateTime(dateStr, timeStr);
  if (!d) return true; // Keep active if parsing unavailable and status is upcoming
  return d.getTime() >= Date.now();
}

export const TripsView: React.FC<TripsViewProps> = ({
  trips: initialTrips = [],
  luggagePackages: initialLuggage = [],
  currentUser,
  onSelectTrip,
  onCancelTrip,
  onNavigateScreen,
  showToast,
}) => {
  // Tabs: 'upcoming' | 'past' | 'luggage'
  const [tab, setTab] = useState<'upcoming' | 'past' | 'luggage'>('upcoming');
  const [roleFilter, setRoleFilter] = useState<'all' | 'passenger' | 'driver'>('all');

  // Authoritative data state
  const [driverTrips, setDriverTrips] = useState<Trip[]>([]);
  const [passengerBookings, setPassengerBookings] = useState<Booking[]>([]);
  const [userLuggage, setUserLuggage] = useState<LuggagePackage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Cancel Modal state (supports both driver trips and passenger bookings)
  const [cancellingTarget, setCancellingTarget] = useState<
    | { type: 'driver_trip'; trip: Trip }
    | { type: 'passenger_booking'; booking: Booking }
    | null
  >(null);
  const [cancelReason, setCancelReason] = useState<string>('Change in travel plans');
  const [isSubmittingAction, setIsSubmittingAction] = useState<boolean>(false);

  // Complete Trip modal state
  const [completingTrip, setCompletingTrip] = useState<Trip | null>(null);

  // Fetch live user trips, bookings and luggage
  const loadUserTripsData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [dTripsRes, pBookingsRes, myLuggageRes] = await Promise.allSettled([
        api.listMyTrips(),
        api.listBookings(false),
        api.listMyLuggage(),
      ]);

      if (dTripsRes.status === 'fulfilled' && Array.isArray(dTripsRes.value)) {
        setDriverTrips(dTripsRes.value);
      } else {
        // Fallback to driver-owned trips from initialTrips if backend call was unauthenticated
        const fallbackDriver = initialTrips.filter((t) => t.isDriverTrip);
        setDriverTrips(fallbackDriver);
      }

      if (pBookingsRes.status === 'fulfilled' && Array.isArray(pBookingsRes.value)) {
        setPassengerBookings(pBookingsRes.value);
      } else {
        setPassengerBookings([]);
      }

      if (myLuggageRes.status === 'fulfilled' && Array.isArray(myLuggageRes.value)) {
        setUserLuggage(myLuggageRes.value);
      } else {
        setUserLuggage(initialLuggage);
      }
    } catch (err: any) {
      console.warn('[TripsView] Error loading trips data:', err);
      setLoadError(err?.message || 'Failed to fetch trips. Please retry.');
    } finally {
      setIsLoading(false);
    }
  }, [initialTrips, initialLuggage]);

  useEffect(() => {
    loadUserTripsData();
  }, [loadUserTripsData]);

  // Handle Driver Trip Cancellation
  const handleConfirmCancel = async () => {
    if (!cancellingTarget) return;
    setIsSubmittingAction(true);

    try {
      if (cancellingTarget.type === 'driver_trip') {
        const tripId = cancellingTarget.trip.id;
        if (onCancelTrip) {
          onCancelTrip(tripId, cancelReason);
        } else {
          await api.cancelTrip(tripId, cancelReason);
        }
        showToast('Driver trip cancelled. Seats restored and passenger refunds notified.');
      } else {
        const bookingId = cancellingTarget.booking.id;
        await api.cancelBooking(bookingId, cancelReason);
        showToast('Passenger reservation cancelled. 100% refund initiated.');
      }
      setCancellingTarget(null);
      await loadUserTripsData();
    } catch (err: any) {
      console.error('[TripsView] Cancellation error:', err);
      showToast(err?.message || 'Could not cancel at this moment.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Driver Trip Completion
  const handleConfirmComplete = async () => {
    if (!completingTrip) return;
    setIsSubmittingAction(true);
    try {
      await api.completeTrip(completingTrip.id);
      showToast('Trip marked completed! Driver payout and passenger history recorded.');
      setCompletingTrip(null);
      await loadUserTripsData();
    } catch (err: any) {
      console.error('[TripsView] Trip completion error:', err);
      showToast(err?.message || 'Failed to complete trip.');
    } finally {
      setIsSubmittingAction(false);
    }
  };

  // Handle Receipt Download / View
  const handleDownloadReceipt = (bookingRef: string, totalPaid: number, route: string) => {
    const text = `TOPRIDE BOOKING RECEIPT\nBooking Reference: ${bookingRef}\nRoute: ${route}\nTotal Paid: ₹${totalPaid}\nPayment Status: Completed (Razorpay)\nDate: ${new Date().toLocaleDateString()}`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TopRide_Receipt_${bookingRef}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Receipt for ${bookingRef} downloaded.`);
  };

  // ================= FILTER LOGIC =================
  // 1. Driver trips partitioning
  const upcomingDriverTrips = driverTrips.filter((t) => {
    if (t.status === 'cancelled' || t.status === 'completed') return false;
    return isTripUpcoming(t.date, t.departureTime, t.status);
  });

  const pastDriverTrips = driverTrips.filter((t) => {
    if (t.status === 'completed' || t.status === 'cancelled') return true;
    return !isTripUpcoming(t.date, t.departureTime, t.status);
  });

  // 2. Passenger bookings partitioning
  const upcomingPassengerBookings = passengerBookings.filter((b) => {
    if (b.bookingStatus === 'cancelled' || b.status === 'cancelled') return false;
    if (b.bookingStatus === 'completed' || b.status === 'completed') return false;
    const tripDate = b.trip?.date;
    const tripTime = b.trip?.departureTime;
    return isTripUpcoming(tripDate, tripTime, b.trip?.status);
  });

  const pastPassengerBookings = passengerBookings.filter((b) => {
    if (b.bookingStatus === 'completed' || b.status === 'completed') return true;
    if (b.bookingStatus === 'cancelled' || b.status === 'cancelled') return true;
    const tripDate = b.trip?.date;
    const tripTime = b.trip?.departureTime;
    return !isTripUpcoming(tripDate, tripTime, b.trip?.status);
  });

  // 3. Counts based on selected role filter
  const upcomingCount =
    roleFilter === 'all'
      ? upcomingDriverTrips.length + upcomingPassengerBookings.length
      : roleFilter === 'driver'
      ? upcomingDriverTrips.length
      : upcomingPassengerBookings.length;

  const pastCount =
    roleFilter === 'all'
      ? pastDriverTrips.length + pastPassengerBookings.length
      : roleFilter === 'driver'
      ? pastDriverTrips.length
      : pastPassengerBookings.length;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            My Trips & Shipments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Track your upcoming rides, past journeys, and package dispatches
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => loadUserTripsData()}
            disabled={isLoading}
            className="p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
            title="Refresh trips"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-slate-950' : ''}`} />
          </button>

          <button
            onClick={() => onNavigateScreen('post-trip')}
            className="px-4 py-2.5 rounded-xl bg-[#F05A28] text-white font-bold text-xs hover:bg-[#d84a1b] transition-colors cursor-pointer shadow-xs active:scale-98 flex items-center gap-1.5"
          >
            <span>+ Post a new drive</span>
          </button>
        </div>
      </div>

      {/* Tabs & Role Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setTab('upcoming')}
            className={`py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              tab === 'upcoming' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Upcoming ({upcomingCount})
          </button>
          <button
            onClick={() => setTab('past')}
            className={`py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              tab === 'past' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Past & Completed ({pastCount})
          </button>
          <button
            onClick={() => setTab('luggage')}
            className={`py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              tab === 'luggage' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Luggage ({userLuggage.length})
          </button>
        </div>

        {/* Role toggle for Trips */}
        {tab !== 'luggage' && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 font-semibold mr-1">Role:</span>
            {(['all', 'passenger', 'driver'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-lg capitalize font-bold transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm animate-pulse space-y-4">
              <div className="flex justify-between items-center">
                <div className="h-6 w-32 bg-slate-200 rounded-full" />
                <div className="h-6 w-20 bg-slate-200 rounded-lg" />
              </div>
              <div className="h-6 w-3/4 bg-slate-200 rounded-lg" />
              <div className="h-12 bg-slate-100 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {!isLoading && loadError && (
        <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center space-y-3">
          <AlertTriangle className="w-8 h-8 text-rose-500 mx-auto" />
          <h3 className="font-bold text-sm text-rose-900">Unable to load trips</h3>
          <p className="text-xs text-rose-600 max-w-sm mx-auto">{loadError}</p>
          <button
            onClick={() => loadUserTripsData()}
            className="px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-colors cursor-pointer"
          >
            Try again
          </button>
        </div>
      )}

      {/* ================= TAB 1: UPCOMING TRIPS ================= */}
      {!isLoading && !loadError && tab === 'upcoming' && (
        <div className="space-y-4">
          {upcomingCount === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-base text-slate-900 mb-1">
                {roleFilter === 'driver'
                  ? 'No upcoming drives'
                  : roleFilter === 'passenger'
                  ? 'No upcoming passenger rides'
                  : 'No upcoming trips'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                {roleFilter === 'driver'
                  ? "You haven't posted any scheduled drives. Post a ride to share your empty seats."
                  : roleFilter === 'passenger'
                  ? "You don't have any booked seats right now. Find a ride heading your way."
                  : "You don't have any scheduled rides as a passenger or driver right now."}
              </p>
              <div className="flex items-center justify-center gap-3">
                {roleFilter !== 'driver' && (
                  <button
                    onClick={() => onNavigateScreen('find')}
                    className="px-5 py-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer shadow-xs"
                  >
                    Find a ride
                  </button>
                )}
                {roleFilter !== 'passenger' && (
                  <button
                    onClick={() => onNavigateScreen('post-trip')}
                    className="px-5 py-2.5 rounded-xl bg-[#F05A28] text-white font-bold text-xs hover:bg-[#d84a1b] transition-colors cursor-pointer shadow-xs"
                  >
                    Post a drive
                  </button>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* 1. Driver-owned upcoming trips */}
              {(roleFilter === 'all' || roleFilter === 'driver') &&
                upcomingDriverTrips.map((trip) => (
                  <div
                    key={`driver-${trip.id}`}
                    className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-50 text-purple-700 border border-purple-200 tracking-wide">
                          YOU ARE DRIVING
                        </span>
                        <span className="text-xs text-slate-400 font-semibold">
                          • {trip.date} at {trip.departureTime}
                        </span>
                      </div>

                      <div className="text-right">
                        <span className="font-black text-lg text-slate-950">
                          ₹{trip.pricePerSeat}
                          <span className="text-xs text-slate-500 font-medium ml-1">/ seat</span>
                        </span>
                        <span className="text-[11px] text-purple-700 font-bold block">
                          {trip.availableSeats} of {trip.totalSeats} seats open
                        </span>
                      </div>
                    </div>

                    <div className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <span>{trip.origin}</span>
                      <ArrowRight className="w-4 h-4 text-slate-400" />
                      <span>{trip.destination}</span>
                    </div>

                    {/* Vehicle & Luggage specs */}
                    <div className="p-3 bg-slate-50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-slate-400" />
                        <span>
                          Vehicle: <strong>{trip.vehicle.make} {trip.vehicle.model}</strong> ({trip.vehicle.plateNumber || 'Verified'})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span>Luggage policy: <strong>{trip.luggageAllowed}</strong></span>
                      </div>
                    </div>

                    {/* Passenger Bookings on this drive */}
                    {trip.passengerBookings && trip.passengerBookings.length > 0 ? (
                      <div className="p-3.5 bg-purple-50/50 border border-purple-100 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-purple-900">
                          <span className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-purple-600" />
                            <span>Booked Passengers ({trip.passengerBookings.length})</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {trip.passengerBookings.map((pb) => (
                            <div
                              key={pb.id}
                              className="bg-white p-2.5 rounded-xl border border-purple-100 flex items-center justify-between text-xs"
                            >
                              <div>
                                <span className="font-bold text-slate-900 block">{pb.passengerName}</span>
                                <span className="text-[10px] text-slate-400">
                                  Ref: {pb.bookingRef} • {pb.seatsCount} seat(s)
                                </span>
                              </div>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 capitalize">
                                {pb.bookingStatus}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic bg-slate-50/50 p-2.5 rounded-xl">
                        No passenger reservations yet. Seats will automatically confirm as passengers book.
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                      <button
                        onClick={() => onSelectTrip(trip)}
                        className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
                      >
                        View details
                      </button>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setCompletingTrip(trip)}
                          className="px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50/60 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Mark completed</span>
                        </button>

                        <button
                          onClick={() => setCancellingTarget({ type: 'driver_trip', trip })}
                          className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 font-bold text-xs transition-colors cursor-pointer"
                        >
                          Cancel drive
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

              {/* 2. Passenger-owned upcoming bookings */}
              {(roleFilter === 'all' || roleFilter === 'passenger') &&
                upcomingPassengerBookings.map((booking) => {
                  const trip = booking.trip;
                  return (
                    <div
                      key={`passenger-${booking.id}`}
                      className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 tracking-wide">
                            CONFIRMED PASSENGER
                          </span>
                          <span className="text-xs text-slate-400 font-semibold">
                            • {trip?.date || 'Upcoming'} at {trip?.departureTime || 'TBD'}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="font-black text-lg text-slate-950">₹{booking.totalPaid}</span>
                          <span className="text-[10px] text-emerald-700 font-bold block">
                            {booking.seatsCount} seat(s) booked • Paid
                          </span>
                        </div>
                      </div>

                      <div className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <span>{trip?.origin || 'Departure point'}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span>{trip?.destination || 'Arrival destination'}</span>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
                        <div>
                          <span>
                            Driver: <strong>{trip?.driverName || 'Driver'}</strong> ({trip?.driverRating || 5.0}★)
                          </span>
                          <span className="mx-2 text-slate-300">|</span>
                          <span>
                            Vehicle: <strong>{trip?.vehicle?.make} {trip?.vehicle?.model}</strong> (
                            {trip?.vehicle?.plateNumber || 'Verified'})
                          </span>
                        </div>
                        <div>
                          <span>
                            Ref: <strong className="font-mono text-slate-800">{booking.bookingRef}</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                        {trip ? (
                          <button
                            onClick={() => onSelectTrip(trip)}
                            className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
                          >
                            View details
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">Reservation confirmed</span>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              handleDownloadReceipt(
                                booking.bookingRef,
                                booking.totalPaid,
                                `${trip?.origin || ''} → ${trip?.destination || ''}`
                              )
                            }
                            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Receipt</span>
                          </button>
                          <button
                            onClick={() => setCancellingTarget({ type: 'passenger_booking', booking })}
                            className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 font-semibold text-xs transition-colors cursor-pointer"
                          >
                            Cancel seat
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      )}

      {/* ================= TAB 2: PAST & COMPLETED ================= */}
      {!isLoading && !loadError && tab === 'past' && (
        <div className="space-y-4">
          {pastCount === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 text-slate-500 text-sm">
              No historical or completed journeys on record.
            </div>
          ) : (
            <>
              {/* 1. Driver past trips */}
              {(roleFilter === 'all' || roleFilter === 'driver') &&
                pastDriverTrips.map((trip) => {
                  const isCancelled = trip.status === 'cancelled';
                  const isCompleted = trip.status === 'completed';
                  return (
                    <div
                      key={`driver-past-${trip.id}`}
                      className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3 opacity-95 hover:border-slate-300 transition-all"
                    >
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {isCancelled ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-xs flex items-center gap-1 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Cancelled Drive</span>
                            </span>
                          ) : isCompleted ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center gap-1 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Completed Drive</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>Past Journey</span>
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-semibold">• {trip.date}</span>
                        </div>

                        <span className="font-bold text-sm text-slate-900">
                          ₹{trip.pricePerSeat} / seat
                        </span>
                      </div>

                      <div className="font-black text-base text-slate-900 flex items-center gap-2">
                        <span>{trip.origin}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span>{trip.destination}</span>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center justify-between">
                        <span>
                          Vehicle: {trip.vehicle.make} {trip.vehicle.model} ({trip.vehicle.plateNumber || 'Verified'})
                        </span>
                        {trip.passengerBookings && trip.passengerBookings.length > 0 && (
                          <span className="text-purple-700 font-semibold">
                            {trip.passengerBookings.length} passenger(s) booked
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}

              {/* 2. Passenger past bookings */}
              {(roleFilter === 'all' || roleFilter === 'passenger') &&
                pastPassengerBookings.map((booking) => {
                  const trip = booking.trip;
                  const isCancelled = booking.bookingStatus === 'cancelled' || booking.status === 'cancelled';
                  const isCompleted = booking.bookingStatus === 'completed' || booking.status === 'completed' || trip?.status === 'completed';

                  return (
                    <div
                      key={`passenger-past-${booking.id}`}
                      className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3 opacity-95 hover:border-slate-300 transition-all"
                    >
                      <div className="flex justify-between items-center flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          {isCancelled ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-xs flex items-center gap-1 border border-rose-200">
                              <XCircle className="w-3.5 h-3.5 text-rose-600" />
                              <span>Cancelled Reservation</span>
                            </span>
                          ) : isCompleted ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs flex items-center gap-1 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Completed Journey</span>
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              <span>Past Journey</span>
                            </span>
                          )}
                          <span className="text-xs text-slate-400 font-semibold">• {trip?.date || 'Past'}</span>
                        </div>

                        <div className="text-right">
                          <span className="font-bold text-sm text-slate-900 block">₹{booking.totalPaid}</span>
                          <span className="text-[10px] text-slate-400">Ref: {booking.bookingRef}</span>
                        </div>
                      </div>

                      <div className="font-black text-base text-slate-900 flex items-center gap-2">
                        <span>{trip?.origin || 'Origin'}</span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span>{trip?.destination || 'Destination'}</span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                        <span>
                          Driver: {trip?.driverName || 'Driver'} • {trip?.vehicle?.make || 'Car'}
                        </span>
                        <button
                          onClick={() =>
                            handleDownloadReceipt(
                              booking.bookingRef,
                              booking.totalPaid,
                              `${trip?.origin || ''} → ${trip?.destination || ''}`
                            )
                          }
                          className="text-slate-700 hover:text-slate-950 font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>Receipt</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </>
          )}
        </div>
      )}

      {/* ================= TAB 3: LUGGAGE PACKAGES ================= */}
      {!isLoading && !loadError && tab === 'luggage' && (
        <div className="space-y-4">
          {userLuggage.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 space-y-4">
              <Package className="w-12 h-12 text-slate-300 mx-auto" />
              <h3 className="font-bold text-base text-slate-900">No luggage shipments</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Send packages with trusted drivers heading along your delivery corridor.
              </p>
              <button
                onClick={() => onNavigateScreen('luggage')}
                className="px-5 py-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Send a package
              </button>
            </div>
          ) : (
            userLuggage.map((pkg) => (
              <div key={pkg.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-amber-600" />
                    <span className="capitalize">{pkg.status}</span>
                  </span>
                  <span className="font-black text-slate-950 text-base">₹{pkg.priceOffer}</span>
                </div>

                <div className="font-black text-base text-slate-900 flex items-center gap-2">
                  <span>{pkg.origin}</span>
                  <ArrowRight className="w-4 h-4 text-slate-400" />
                  <span>{pkg.destination}</span>
                </div>

                <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                  {pkg.description} ({pkg.size})
                </p>

                {pkg.receiverName && (
                  <div className="text-xs text-slate-500">
                    Recipient: <strong>{pkg.receiverName}</strong> ({pkg.receiverPhone})
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ================= CANCEL CONFIRMATION MODAL ================= */}
      {cancellingTarget && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-black text-lg text-slate-900">
                  {cancellingTarget.type === 'driver_trip' ? 'Cancel Drive' : 'Cancel Reservation'}
                </h3>
              </div>
              <button
                onClick={() => setCancellingTarget(null)}
                disabled={isSubmittingAction}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {cancellingTarget.type === 'driver_trip' ? (
                <>
                  Are you sure you want to cancel your scheduled drive on{' '}
                  <strong className="text-slate-900">
                    {cancellingTarget.trip.origin} → {cancellingTarget.trip.destination}
                  </strong>{' '}
                  ({cancellingTarget.trip.date})? All booked passengers will be notified and issued refunds.
                </>
              ) : (
                <>
                  Are you sure you want to cancel your booking on{' '}
                  <strong className="text-slate-900">
                    {cancellingTarget.booking.trip?.origin || 'this route'} →{' '}
                    {cancellingTarget.booking.trip?.destination || 'destination'}
                  </strong>
                  ?
                </>
              )}
            </p>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Reason for cancellation
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden bg-white"
              >
                <option value="Change in travel plans">Change in travel plans</option>
                <option value="Found alternative ride">Found alternative ride</option>
                <option value="Timing no longer suits">Timing no longer suits</option>
                <option value="Personal emergency">Personal emergency</option>
                <option value="Vehicle issue">Vehicle issue</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              <strong>100% Refund policy guarantee:</strong> Any payments made will be reversed to the original payment method without deduction.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCancellingTarget(null)}
                disabled={isSubmittingAction}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer disabled:opacity-50"
              >
                Keep active
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isSubmittingAction}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmittingAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm Cancel</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= COMPLETE TRIP CONFIRMATION MODAL ================= */}
      {completingTrip && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
                <h3 className="font-black text-lg text-slate-900">Complete Drive</h3>
              </div>
              <button
                onClick={() => setCompletingTrip(null)}
                disabled={isSubmittingAction}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Have you safely reached the destination for{' '}
              <strong className="text-slate-900">
                {completingTrip.origin} → {completingTrip.destination}
              </strong>
              ? Marking this drive complete will finalize passenger trips and record earnings to your account.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCompletingTrip(null)}
                disabled={isSubmittingAction}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Not yet
              </button>
              <button
                onClick={handleConfirmComplete}
                disabled={isSubmittingAction}
                className="flex-1 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSubmittingAction && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>Yes, Drive Completed</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
