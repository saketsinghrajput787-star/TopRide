import React, { useState } from 'react';
import { PassengerRequest, ScreenId, User, LocationData } from '../types';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Users, 
  Calendar, 
  Clock, 
  Sparkles,
  MapPin, 
  CheckCircle2 
} from 'lucide-react';
import { LocationSearchInput } from '../components/LocationSearchInput';
import { MapRoutePreview } from '../components/MapRoutePreview';

interface PostRequestViewProps {
  currentUser: User;
  onPublishRequest: (req: PassengerRequest) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  showToast: (msg: string) => void;
}

export const PostRequestView: React.FC<PostRequestViewProps> = ({
  currentUser,
  onPublishRequest,
  onNavigateScreen,
  showToast,
}) => {
  const [step, setStep] = useState<'form' | 'review' | 'success'>('form');

  const [origin, setOrigin] = useState('Bengaluru');
  const [originLocation, setOriginLocation] = useState<LocationData | null>({
    name: 'Bengaluru',
    formattedAddress: 'Bengaluru, Karnataka, India',
    latitude: 12.9716,
    longitude: 77.5946,
  });

  const [destination, setDestination] = useState('Hyderabad');
  const [destLocation, setDestLocation] = useState<LocationData | null>({
    name: 'Hyderabad',
    formattedAddress: 'Hyderabad, Telangana, India',
    latitude: 17.3850,
    longitude: 78.4867,
  });

  const [date, setDate] = useState('Sat, 10 Oct');
  const [timeWindow, setTimeWindow] = useState('Morning (08:00 - 11:00)');
  const [seats, setSeats] = useState<number>(1);
  const [budget, setBudget] = useState<number>(650);
  const [notes, setNotes] = useState('Traveling with a laptop backpack and 1 small trolley bag.');
  const [selectedPreferences, setSelectedPreferences] = useState<string[]>([
    'AC Required',
    'Non-smoking',
    'Verified Driver Only',
  ]);

  const togglePref = (pref: string) => {
    if (selectedPreferences.includes(pref)) {
      setSelectedPreferences(selectedPreferences.filter((p) => p !== pref));
    } else {
      setSelectedPreferences([...selectedPreferences, pref]);
    }
  };

  const handlePublish = () => {
    const newReq: PassengerRequest = {
      id: `req_${Date.now()}`,
      passengerId: currentUser.id,
      passengerName: currentUser.name,
      passengerInitials: currentUser.initials,
      passengerRating: currentUser.rating,
      origin: originLocation?.name || origin,
      originLatitude: originLocation?.latitude,
      originLongitude: originLocation?.longitude,
      originPlaceId: originLocation?.placeId,
      originAddress: originLocation?.formattedAddress,
      destination: destLocation?.name || destination,
      destinationLatitude: destLocation?.latitude,
      destinationLongitude: destLocation?.longitude,
      destinationPlaceId: destLocation?.placeId,
      destinationAddress: destLocation?.formattedAddress,
      date,
      timeWindow,
      seatsNeeded: seats,
      budgetPerSeat: budget,
      preferences: selectedPreferences,
      notes,
      status: 'active',
    };

    onPublishRequest(newReq);
    setStep('success');
    showToast('Passenger ride request submitted!');
  };

  // ================= 1. FORM =================
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
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Post a ride request</h1>
            <p className="text-xs text-slate-500">Let drivers heading your way send you ride offers</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep('review');
          }}
          className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5"
        >
          {/* Origin & Destination with Mapbox location search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <LocationSearchInput
                label="From (Pickup)"
                required
                iconType="origin"
                placeholder="Search pickup point (e.g. Koramangala)"
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
                }}
              />
            </div>

            <div>
              <LocationSearchInput
                label="To (Drop-off)"
                required
                iconType="destination"
                placeholder="Search destination (e.g. Hitech City)"
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
                }}
              />
            </div>
          </div>

          {/* Date & Time Window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                Preferred Departure Time
              </label>
              <select
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-900 text-sm focus:outline-hidden bg-white"
              >
                <option value="Early Morning (05:00 - 08:00)">Early Morning (05:00 - 08:00)</option>
                <option value="Morning (08:00 - 11:00)">Morning (08:00 - 11:00)</option>
                <option value="Afternoon (12:00 - 16:00)">Afternoon (12:00 - 16:00)</option>
                <option value="Evening (17:00 - 21:00)">Evening (17:00 - 21:00)</option>
                <option value="Flexible All Day">Flexible All Day</option>
              </select>
            </div>
          </div>

          {/* Seats needed & Budget */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Seats Needed
              </label>
              <div className="flex gap-2">
                {[1, 2, 3].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeats(s)}
                    className={`flex-1 py-2.5 rounded-xl font-black text-sm transition-all cursor-pointer ${
                      seats === s ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Budget / Seat (₹)
              </label>
              <input
                type="number"
                value={budget}
                onChange={(e) => setBudget(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-black text-slate-900 text-base focus:outline-hidden"
              />
            </div>
          </div>

          {/* Travel Preferences */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Preferences
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                'AC Required',
                'Non-smoking',
                'Female Co-traveler Only',
                'Verified Driver Only',
                'Pet-friendly',
                'Luggage in Boot',
              ].map((pref) => {
                const active = selectedPreferences.includes(pref);
                return (
                  <button
                    key={pref}
                    type="button"
                    onClick={() => togglePref(pref)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      active ? 'bg-slate-950 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {active ? `✓ ${pref}` : `+ ${pref}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Luggage details or note
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Review request</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }

  // ================= 2. REVIEW =================
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
          <h1 className="text-xl sm:text-2xl font-black text-slate-950">Review request</h1>
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
            <div className="text-lg font-black text-slate-950">
              {origin} → {destination}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block">Date</span>
                <span className="font-bold text-slate-900">{date}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Window</span>
                <span className="font-bold text-slate-900">{timeWindow}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Seats</span>
                <span className="font-bold text-slate-900">{seats}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Target Fare</span>
                <span className="font-bold text-slate-900">₹{budget}</span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Preferences</span>
            <div className="flex gap-1.5 flex-wrap">
              {selectedPreferences.map((p, i) => (
                <span key={i} className="px-2.5 py-1 bg-slate-100 rounded-lg text-xs font-semibold text-slate-700">
                  {p}
                </span>
              ))}
            </div>
          </div>

          <div className="pt-3 flex gap-3">
            <button
              onClick={() => setStep('form')}
              className="flex-1 py-4 px-6 rounded-2xl bg-slate-100 text-slate-800 font-bold text-sm cursor-pointer"
            >
              Edit
            </button>
            <button
              onClick={handlePublish}
              className="flex-1 py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm cursor-pointer"
            >
              Publish request
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 3. SUCCESS =================
  if (step === 'success') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <Check className="w-10 h-10 stroke-[2.5]" />
        </div>

        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 mb-2">
            Request Active
          </span>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Request posted!
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Drivers traveling from {origin} to {destination} will receive notifications and can send you direct ride offers.
          </p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onNavigateScreen('trips')}
            className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm cursor-pointer"
          >
            View in My Trips
          </button>
          <button
            onClick={() => onNavigateScreen('home')}
            className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm cursor-pointer"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return null;
};
