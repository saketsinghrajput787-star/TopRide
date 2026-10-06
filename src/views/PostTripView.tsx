import React, { useState } from 'react';
import { Vehicle, Trip, ScreenId, User, LocationData } from '../types';
import { 
  ArrowLeft, 
  ArrowRight, 
  Car, 
  Calendar, 
  Clock, 
  Sparkles,
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { LocationSearchInput } from '../components/LocationSearchInput';
import { MapRoutePreview } from '../components/MapRoutePreview';

interface PostTripViewProps {
  vehicles: Vehicle[];
  currentUser: User;
  onPublishTrip: (newTrip: Trip) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  showToast: (msg: string) => void;
}

export const PostTripView: React.FC<PostTripViewProps> = ({
  vehicles,
  currentUser,
  onPublishTrip,
  onNavigateScreen,
  showToast,
}) => {
  const [step, setStep] = useState<'form' | 'review' | 'success'>('form');

  // Form Fields
  const [origin, setOrigin] = useState('Bengaluru');
  const [originLocation, setOriginLocation] = useState<LocationData | null>({
    name: 'Bengaluru',
    formattedAddress: 'Bengaluru, Karnataka, India',
    latitude: 12.9716,
    longitude: 77.5946,
  });
  const [originDetail, setOriginDetail] = useState('Koramangala Sony World / Electronic City Toll');

  const [destination, setDestination] = useState('Hyderabad');
  const [destLocation, setDestLocation] = useState<LocationData | null>({
    name: 'Hyderabad',
    formattedAddress: 'Hyderabad, Telangana, India',
    latitude: 17.3850,
    longitude: 78.4867,
  });
  const [destinationDetail, setDestinationDetail] = useState('Gachibowli DLF / Hitec City');

  const [date, setDate] = useState('Sat, 10 Oct');
  const [time, setTime] = useState('08:00');
  const [seats, setSeats] = useState<number>(3);
  const [price, setPrice] = useState<number>(650);
  const [luggageAllowed, setLuggageAllowed] = useState<'None' | 'Small' | 'Medium' | 'Large'>('Medium');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(vehicles[0]?.id || '');
  const [rules, setRules] = useState<string[]>(['No smoking', 'AC on full trip', 'Punctual passengers only']);

  const selectedVehicle = vehicles.find((v) => v.id === selectedVehicleId) || (vehicles.length > 0 ? vehicles[0] : null);

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('review');
  };

  const handlePublish = () => {
    const newTripPayload: any = {
      driverId: currentUser.id,
      driverName: currentUser.name,
      driverInitials: currentUser.initials,
      driverRating: currentUser.rating,
      driverTripsCount: currentUser.tripsCount + 1,
      driverIsVerified: currentUser.isVerified,
      origin: originLocation?.name || origin,
      originDetail: originDetail || originLocation?.formattedAddress || '',
      originLatitude: originLocation?.latitude,
      originLongitude: originLocation?.longitude,
      originPlaceId: originLocation?.placeId,
      originAddress: originLocation?.formattedAddress,
      destination: destLocation?.name || destination,
      destinationDetail: destinationDetail || destLocation?.formattedAddress || '',
      destinationLatitude: destLocation?.latitude,
      destinationLongitude: destLocation?.longitude,
      destinationPlaceId: destLocation?.placeId,
      destinationAddress: destLocation?.formattedAddress,
      date,
      departureTime: time,
      arrivalTime: '16:30',
      duration: '8h 30m',
      totalSeats: seats,
      availableSeats: seats,
      pricePerSeat: price,
      currency: '₹',
      vehicleId: selectedVehicle?.id || undefined,
      vehicle: selectedVehicle || undefined,
      luggageAllowed,
      luggageDetails: `${luggageAllowed} luggage allowed in boot`,
      instantBooking: true,
      tripRules: rules,
      isDriverTrip: true,
      status: 'upcoming',
    };

    onPublishTrip(newTripPayload);
    setStep('success');
    showToast('Your trip was published successfully!');
  };

  // ================= 1. FORM STEP =================
  if (step === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateScreen('home')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Post a trip</h1>
            <p className="text-xs text-slate-500">Offer empty seats and share travel expenses</p>
          </div>
        </div>

        <form onSubmit={handleReview} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          {/* Origin & Destination with Mapbox Location Search */}
          <div className="space-y-4">
            <div>
              <LocationSearchInput
                label="Departure point (Origin)"
                required
                iconType="origin"
                placeholder="Search city, neighborhood, airport (e.g. Koramangala, Bengaluru)"
                value={origin}
                onChange={(val) => {
                  setOrigin(val);
                  if (originLocation && originLocation.name !== val) {
                    setOriginLocation({ name: val, latitude: 12.9716, longitude: 77.5946 });
                  }
                }}
                onSelectLocation={(loc) => {
                  setOrigin(loc.name);
                  setOriginLocation(loc);
                  if (loc.formattedAddress) {
                    setOriginDetail(loc.formattedAddress);
                  }
                }}
              />
              <input
                type="text"
                value={originDetail}
                onChange={(e) => setOriginDetail(e.target.value)}
                placeholder="Exact pickup spot details (e.g. Sony World signal / Metro gate 1)"
                className="w-full mt-1.5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-hidden"
              />
            </div>

            <div>
              <LocationSearchInput
                label="Arrival point (Destination)"
                required
                iconType="destination"
                placeholder="Search destination, city, hub (e.g. Hitech City, Hyderabad)"
                value={destination}
                onChange={(val) => {
                  setDestination(val);
                  if (destLocation && destLocation.name !== val) {
                    setDestLocation({ name: val, latitude: 17.3850, longitude: 78.4867 });
                  }
                }}
                onSelectLocation={(loc) => {
                  setDestination(loc.name);
                  setDestLocation(loc);
                  if (loc.formattedAddress) {
                    setDestinationDetail(loc.formattedAddress);
                  }
                }}
              />
              <input
                type="text"
                value={destinationDetail}
                onChange={(e) => setDestinationDetail(e.target.value)}
                placeholder="Drop-off point details (e.g. DLF Cyber City Gate 2)"
                className="w-full mt-1.5 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Live Mapbox Route Preview on Form */}
          {origin && destination && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 px-0.5">
                <span className="flex items-center gap-1.5 text-slate-700 font-bold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Mapbox Route Preview
                </span>
                <span>{origin} → {destination}</span>
              </div>
              <MapRoutePreview
                origin={originLocation?.name || origin}
                destination={destLocation?.name || destination}
                originCoords={originLocation ? { latitude: originLocation.latitude, longitude: originLocation.longitude } : undefined}
                destCoords={destLocation ? { latitude: destLocation.latitude, longitude: destLocation.longitude } : undefined}
                height="h-44 sm:h-52"
              />
            </div>
          )}

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Date
              </label>
              <input
                type="text"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-900 text-sm focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Departure Time
              </label>
              <input
                type="text"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-900 text-sm focus:outline-hidden"
              />
            </div>
          </div>

          {/* Seats & Price */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Available Seats
              </label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeats(s)}
                    className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer ${
                      seats === s ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Price per seat (₹)
              </label>
              <input
                type="number"
                min="100"
                max="5000"
                step="50"
                value={price}
                onChange={(e) => setPrice(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-black text-slate-900 text-base focus:outline-hidden"
              />
            </div>
          </div>

          {/* Luggage Allowance */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Luggage allowance in car
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(['None', 'Small', 'Medium', 'Large'] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLuggageAllowed(l)}
                  className={`py-2 px-2 text-center rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    luggageAllowed === l ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Vehicle Selection */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Select vehicle
            </label>
            {vehicles.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {vehicles.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      selectedVehicleId === v.id ? 'border-slate-950 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="font-bold text-slate-900 text-xs">{v.make} {v.model}</div>
                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">{v.plateNumber}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-300 text-xs text-slate-500">
                <span>No vehicle registered yet. (Trip will be posted as verified standard ride)</span>
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full mt-4 py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Review trip details</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }

  // ================= 2. REVIEW STEP =================
  if (step === 'review') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('form')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Review your trip</h1>
            <p className="text-xs text-slate-500">Check details before making it visible to travelers</p>
          </div>
        </div>

        {/* Real Mapbox Route Preview */}
        <MapRoutePreview
          origin={originLocation?.name || origin}
          destination={destLocation?.name || destination}
          originCoords={originLocation ? { latitude: originLocation.latitude, longitude: originLocation.longitude } : undefined}
          destCoords={destLocation ? { latitude: destLocation.latitude, longitude: destLocation.longitude } : undefined}
          height="h-56 sm:h-64"
        />

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="p-4 bg-slate-50 rounded-2xl space-y-3">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Itinerary</span>
              <div className="text-lg font-black text-slate-950 mt-0.5">
                {origin} → {destination}
              </div>
              <div className="text-xs text-slate-600 mt-1">
                Pickup: {originDetail} <br />
                Drop-off: {destinationDetail}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">Date</span>
                <span className="font-bold text-slate-900">{date}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Time</span>
                <span className="font-bold text-slate-900">{time}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Available</span>
                <span className="font-bold text-slate-900">{seats} Seats</span>
              </div>
              <div>
                <span className="text-slate-400 block">Seat Fare</span>
                <span className="font-bold text-slate-900">₹{price}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block">Vehicle</span>
              <span className="font-bold text-slate-900">
                {selectedVehicle ? `${selectedVehicle.make} ${selectedVehicle.model}` : 'Personal Vehicle'}
              </span>
              <span className="text-slate-500 font-mono block">
                {selectedVehicle ? selectedVehicle.plateNumber : 'Standard Ride'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-slate-400 block">Luggage</span>
              <span className="font-bold text-slate-900">{luggageAllowed}</span>
            </div>
          </div>

          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Instant booking enabled. Passengers can book automatically.</span>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setStep('form')}
              className="w-1/3 py-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm cursor-pointer"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handlePublish}
              className="w-2/3 py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Publish Ride Now</span>
              <Sparkles className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 3. SUCCESS STEP =================
  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center space-y-6">
      <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div>
        <h1 className="text-2xl font-black text-slate-950">Ride Published!</h1>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          Your journey from {origin} to {destination} is live on TopRide. Passengers can find and book seats.
        </p>
      </div>

      <div className="p-4 bg-white rounded-2xl border border-slate-200 text-left text-xs space-y-1">
        <div className="font-bold text-slate-900">{origin} → {destination}</div>
        <div className="text-slate-500">{date} at {time} • {seats} seats at ₹{price}</div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => onNavigateScreen('trips')}
          className="w-full py-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer shadow-sm"
        >
          View in My Trips
        </button>
        <button
          onClick={() => onNavigateScreen('home')}
          className="w-full py-3.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm cursor-pointer"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};
