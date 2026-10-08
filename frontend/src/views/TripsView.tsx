import React, { useState } from 'react';
import { Trip, LuggagePackage, ScreenId } from '../types';
import { 
  Calendar, 
  Car, 
  Package, 
  Clock, 
  MapPin, 
  X, 
  AlertTriangle, 
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Download
} from 'lucide-react';

interface TripsViewProps {
  trips: Trip[];
  luggagePackages: LuggagePackage[];
  onSelectTrip: (trip: Trip) => void;
  onCancelTrip: (tripId: string, reason: string) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  showToast: (msg: string) => void;
}

export const TripsView: React.FC<TripsViewProps> = ({
  trips,
  luggagePackages,
  onSelectTrip,
  onCancelTrip,
  onNavigateScreen,
  showToast,
}) => {
  // Tabs: 'upcoming' | 'past' | 'luggage'
  const [tab, setTab] = useState<'upcoming' | 'past' | 'luggage'>('upcoming');
  const [roleFilter, setRoleFilter] = useState<'all' | 'passenger' | 'driver'>('all');

  // Cancel Modal state
  const [cancellingTrip, setCancellingTrip] = useState<Trip | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('Change in travel plans');

  // Filter trips
  const upcomingTrips = trips.filter((t) => {
    if (t.status !== 'upcoming') return false;
    if (roleFilter === 'passenger' && !t.isPassengerTrip) return false;
    if (roleFilter === 'driver' && !t.isDriverTrip) return false;
    return true;
  });

  const pastTrips = trips.filter((t) => {
    if (t.status !== 'completed' && t.status !== 'cancelled') return false;
    if (roleFilter === 'passenger' && !t.isPassengerTrip) return false;
    if (roleFilter === 'driver' && !t.isDriverTrip) return false;
    return true;
  });

  const handleConfirmCancel = () => {
    if (!cancellingTrip) return;
    onCancelTrip(cancellingTrip.id, cancelReason);
    setCancellingTrip(null);
    showToast('Trip cancelled. Full refund initiated to original payment method.');
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            My Trips & Shipments
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Track your upcoming rides, past journeys, and package dispatches
          </p>
        </div>

        {/* Post trip CTA */}
        <button
          onClick={() => onNavigateScreen('post-trip')}
          className="self-start sm:self-auto px-4 py-2 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
        >
          + Post a new drive
        </button>
      </div>

      {/* Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-200">
        <div className="flex bg-slate-100 p-1 rounded-xl self-start">
          <button
            onClick={() => setTab('upcoming')}
            className={`py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              tab === 'upcoming' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Upcoming ({upcomingTrips.length})
          </button>
          <button
            onClick={() => setTab('past')}
            className={`py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              tab === 'past' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Past & Completed
          </button>
          <button
            onClick={() => setTab('luggage')}
            className={`py-2 px-4 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              tab === 'luggage' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Luggage ({luggagePackages.length})
          </button>
        </div>

        {/* Role toggle */}
        {tab !== 'luggage' && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-slate-400 font-semibold mr-1">Role:</span>
            {(['all', 'passenger', 'driver'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-2.5 py-1 rounded-lg capitalize font-semibold transition-all cursor-pointer ${
                  roleFilter === r ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ================= TAB CONTENT ================= */}
      {tab === 'upcoming' && (
        <div className="space-y-4">
          {upcomingTrips.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-base text-slate-900 mb-1">No upcoming trips</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
                You don't have any scheduled rides as a passenger or driver right now.
              </p>
              <button
                onClick={() => onNavigateScreen('find')}
                className="px-5 py-2.5 rounded-xl bg-slate-950 text-white font-bold text-xs hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Find a ride
              </button>
            </div>
          ) : (
            upcomingTrips.map((trip) => (
              <div
                key={trip.id}
                className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-sm space-y-4 hover:border-slate-300 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                      trip.isDriverTrip
                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {trip.isDriverTrip ? 'YOU ARE DRIVING' : 'CONFIRMED PASSENGER'}
                    </span>
                    <span className="text-xs text-slate-400 font-semibold">• {trip.date} at {trip.departureTime}</span>
                  </div>

                  <div className="text-right">
                    <span className="font-black text-lg text-slate-950">
                      ₹{trip.totalPaid || trip.pricePerSeat}
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      {trip.isDriverTrip ? `${trip.availableSeats} seats open` : 'Paid'}
                    </span>
                  </div>
                </div>

                <div className="text-lg font-black text-slate-900">
                  {trip.origin} → {trip.destination}
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-600 gap-2">
                  <div>
                    <span>Driver: <strong>{trip.driverName}</strong></span>
                    <span className="mx-2 text-slate-300">|</span>
                    <span>Vehicle: <strong>{trip.vehicle.make} {trip.vehicle.model}</strong> ({trip.vehicle.plateNumber})</span>
                  </div>
                  <div>
                    <span>Luggage: <strong>{trip.luggageAllowed}</strong></span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 flex-wrap gap-2">
                  <button
                    onClick={() => onSelectTrip(trip)}
                    className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
                  >
                    View details
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => showToast('Receipt downloaded for trip ' + trip.id)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Receipt</span>
                    </button>
                    <button
                      onClick={() => setCancellingTrip(trip)}
                      className="px-3 py-2 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 font-semibold text-xs transition-colors cursor-pointer"
                    >
                      Cancel trip
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ================= PAST TRIPS ================= */}
      {tab === 'past' && (
        <div className="space-y-4">
          {pastTrips.length === 0 ? (
            <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 text-slate-500 text-sm">
              No completed trips on record.
            </div>
          ) : (
            pastTrips.map((trip) => (
              <div key={trip.id} className="bg-white rounded-3xl p-5 border border-slate-200 space-y-3 opacity-90">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {trip.status === 'completed' ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Completed</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-xs flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                        <span>Cancelled</span>
                      </span>
                    )}
                    <span className="text-xs text-slate-400 font-semibold">{trip.date}</span>
                  </div>
                  <span className="font-bold text-sm text-slate-900">₹{trip.totalPaid || trip.pricePerSeat}</span>
                </div>

                <div className="font-bold text-base text-slate-900">
                  {trip.origin} → {trip.destination}
                </div>
                <div className="text-xs text-slate-500">
                  Driver: {trip.driverName} • {trip.vehicle.make}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ================= LUGGAGE TRIPS ================= */}
      {tab === 'luggage' && (
        <div className="space-y-4">
          {luggagePackages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <div className="flex justify-between items-center">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-amber-600" />
                  <span className="capitalize">{pkg.status}</span>
                </span>
                <span className="font-black text-slate-950 text-base">₹{pkg.priceOffer}</span>
              </div>

              <div className="font-black text-base text-slate-900">
                {pkg.origin} → {pkg.destination}
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
          ))}
        </div>
      )}

      {/* ================= CANCEL TRIP CONFIRMATION MODAL ================= */}
      {cancellingTrip && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-black text-lg text-slate-900">Cancel Reservation</h3>
              </div>
              <button
                onClick={() => setCancellingTrip(null)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to cancel your seat on{' '}
              <strong className="text-slate-900">{cancellingTrip.origin} → {cancellingTrip.destination}</strong> scheduled for{' '}
              <strong className="text-slate-900">{cancellingTrip.date}</strong>?
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
                <option value="Emergency">Personal emergency</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
              <strong>Refund policy guarantee:</strong> 100% full refund (₹{cancellingTrip.totalPaid || cancellingTrip.pricePerSeat}) will be reversed to your account within 2-4 hours.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setCancellingTrip(null)}
                className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Keep booking
              </button>
              <button
                onClick={handleConfirmCancel}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
              >
                Confirm Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
