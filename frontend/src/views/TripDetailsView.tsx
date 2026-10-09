import React from 'react';
import { Trip, ScreenId } from '../types';
import { MapPreview } from '../components/MapPreview';
import { 
  Star, 
  ShieldCheck, 
  Car, 
  Clock, 
  Luggage, 
  CheckCircle2, 
  MessageSquare, 
  ArrowRight, 
  ArrowLeft,
  Calendar,
  AlertCircle,
  MapPin,
  Sparkles
} from 'lucide-react';

interface TripDetailsViewProps {
  trip: Trip;
  onBookNow: (trip: Trip) => void;
  onOpenChat: (driverId: string, driverName: string) => void;
  onNavigateScreen: (screen: ScreenId) => void;
}

export const TripDetailsView: React.FC<TripDetailsViewProps> = ({
  trip,
  onBookNow,
  onOpenChat,
  onNavigateScreen,
}) => {
  const effectiveUnitPrice = trip.currentMarketPrice ?? trip.pricePerSeat;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ================= TOP BACK BUTTON & ROUTE HEADER ================= */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigateScreen('find')}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer shrink-0 transition-colors"
          title="Back to search results"
          aria-label="Back to search results"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                {trip.date}
              </span>
              {trip.instantBooking && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 text-xs font-bold border border-amber-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  <span>Instant Confirmation</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              {trip.origin} → {trip.destination}
            </h1>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-3xl font-black text-slate-950">
              {trip.currency}{effectiveUnitPrice}
            </div>
            <span className="text-xs text-slate-400 font-medium">per passenger seat</span>
          </div>
        </div>
      </div>

      {/* ================= MAP ROUTE PREVIEW ================= */}
      <MapPreview 
        origin={trip.origin} 
        destination={trip.destination} 
        originCoords={trip.originLatitude && trip.originLongitude ? { latitude: trip.originLatitude, longitude: trip.originLongitude } : undefined}
        destCoords={trip.destinationLatitude && trip.destinationLongitude ? { latitude: trip.destinationLatitude, longitude: trip.destinationLongitude } : undefined}
        routeGeometry={trip.routeGeometry}
        height="h-60 sm:h-80" 
      />

      {/* ================= MAIN TWO-COLUMN CONTENT ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: ITINERARY, DRIVER & VEHICLE (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Detailed Route Timeline */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-base font-bold text-slate-900">Trip Itinerary</h2>

            <div className="space-y-6 relative before:absolute before:left-3.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {/* Departure */}
              <div className="relative flex items-start gap-4">
                <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 z-10 font-bold text-xs">
                  A
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-base text-slate-950">{trip.departureTime}</span>
                    <span className="font-bold text-slate-800">{trip.origin}</span>
                  </div>
                  {trip.originDetail && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Pickup location: <span className="text-slate-800 font-semibold">{trip.originDetail}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Waypoints / Stops */}
              {trip.stops && trip.stops.length > 0 && (
                <div className="relative flex items-start gap-4">
                  <div className="w-7 h-7 rounded-full bg-amber-400 text-white flex items-center justify-center shrink-0 z-10 font-bold text-xs">
                    •
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block">
                      En route stops & rest breaks
                    </span>
                    <ul className="text-xs text-slate-500 mt-1 space-y-1">
                      {trip.stops.map((stop, i) => (
                        <li key={i} className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-300"></span>
                          <span>{stop}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Arrival */}
              <div className="relative flex items-start gap-4">
                <div className="w-7 h-7 rounded-full bg-slate-950 text-white flex items-center justify-center shrink-0 z-10 font-bold text-xs">
                  B
                </div>
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="font-black text-base text-slate-950">{trip.arrivalTime}</span>
                    <span className="font-bold text-slate-800">{trip.destination}</span>
                    <span className="text-xs text-slate-400">({trip.duration})</span>
                  </div>
                  {trip.destinationDetail && (
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Drop-off location: <span className="text-slate-800 font-semibold">{trip.destinationDetail}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Driver Profile */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Your Driver</h2>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-slate-950 text-white font-black text-lg flex items-center justify-center">
                  {trip.driverInitials}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-black text-lg text-slate-900">{trip.driverName}</span>
                    {trip.driverIsVerified && (
                      <span title="Govt ID Verified">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      </span>
                    )}

                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                    <span className="flex items-center gap-1 font-bold text-slate-800">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      {trip.driverRating}
                    </span>
                    <span>•</span>
                    <span>{trip.driverTripsCount} completed trips</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onOpenChat(trip.driverId, trip.driverName)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Message</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block mb-0.5">Vehicle</span>
                <span className="font-bold text-slate-900">
                  {trip.vehicle.make} {trip.vehicle.model}
                </span>
                <span className="text-[11px] text-slate-500 block">{trip.vehicle.color}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block mb-0.5">Plate Number</span>
                <span className="font-mono font-bold text-slate-900">
                  {trip.vehicle.plateNumber}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold block">Commercial / Fastag OK</span>
              </div>
            </div>
          </div>

          {/* ================= FIGMA SEATING PLAN CARD ================= */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">Cabin Seating Plan</h2>
                <p className="text-xs text-slate-500 mt-0.5">Spacious seating with max 2 passengers in back row</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200">
                {trip.availableSeats} of {trip.totalSeats} seats open
              </span>
            </div>

            {/* Cabin Layout Graphic */}
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 max-w-sm mx-auto space-y-4">
              <div className="text-center text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Front of Vehicle (Dashboard)
              </div>

              {/* Front Row */}
              <div className="flex justify-around items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 text-white flex flex-col items-center justify-center text-xs font-bold shadow-xs">
                    <span className="text-base">🚗</span>
                    <span className="text-[9px]">Driver</span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">{trip.driverName.split(' ')[0]}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-2xl border-2 flex flex-col items-center justify-center text-xs font-bold shadow-xs ${
                    trip.availableSeats >= 1 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-100 text-slate-400'
                  }`}>
                    <span className="text-sm">💺</span>
                    <span className="text-[9px]">Front</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {trip.availableSeats >= 1 ? 'Available' : 'Booked'}
                  </span>
                </div>
              </div>

              {/* Center Divider / Armrest */}
              <div className="w-full h-px bg-slate-200"></div>

              {/* Rear Row */}
              <div className="flex justify-around items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-2xl border-2 flex flex-col items-center justify-center text-xs font-bold shadow-xs ${
                    trip.availableSeats >= 2 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-100 text-slate-400'
                  }`}>
                    <span className="text-sm">💺</span>
                    <span className="text-[9px]">Back L</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {trip.availableSeats >= 2 ? 'Available' : 'Booked'}
                  </span>
                </div>

                {/* Middle (blocked for passenger comfort if 3 total seats) */}
                <div className="flex flex-col items-center gap-1 opacity-50">
                  <div className="w-10 h-10 rounded-xl bg-slate-200 border border-slate-300 flex items-center justify-center text-[10px] font-bold text-slate-500">
                    Space
                  </div>
                  <span className="text-[9px] text-slate-400">Empty</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className={`w-12 h-12 rounded-2xl border-2 flex flex-col items-center justify-center text-xs font-bold shadow-xs ${
                    trip.availableSeats >= 3 ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-300 bg-slate-100 text-slate-400'
                  }`}>
                    <span className="text-sm">💺</span>
                    <span className="text-[9px]">Back R</span>
                  </div>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    {trip.availableSeats >= 3 ? 'Available' : 'Booked'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Luggage Policy & Trip Instructions */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Luggage & House Rules</h2>

            <div className="p-4 bg-slate-50 rounded-2xl flex items-start gap-3">
              <Luggage className="w-5 h-5 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Luggage Allowance: {trip.luggageAllowed}
                </span>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  {trip.luggageDetails}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
                Driver's Trip Instructions
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {trip.tripRules.map((rule, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: BOOKING SUMMARY CARD (5 cols sticky) */}
        <div className="lg:col-span-5 sticky top-24 space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            <h2 className="text-lg font-black text-slate-950">Book your seat</h2>

            <div className="p-4 bg-slate-50 rounded-2xl space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Available Seats</span>
                <span className="font-bold text-slate-900">{trip.availableSeats} of {trip.totalSeats} remaining</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Base Fare</span>
                <span className="font-bold text-slate-900">{trip.currency}{effectiveUnitPrice}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Booking Guarantee</span>
                <span className="font-bold text-emerald-600">Included (Free)</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-950">
                <span>Total for 1 seat</span>
                <span>{trip.currency}{effectiveUnitPrice}</span>
              </div>
            </div>

            <button
              disabled={trip.availableSeats === 0}
              onClick={() => onBookNow(trip)}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 ${
                trip.availableSeats > 0
                  ? 'bg-[#F05A28] hover:bg-[#d84a1b] text-white'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>{trip.availableSeats > 0 ? 'Select seats & continue' : 'Trip Sold Out'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={() => onOpenChat(trip.driverId, trip.driverName)}
              className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Ask driver a question</span>
            </button>

            <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <span>Free cancellation up to 24 hours before departure with full refund.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
