import React, { useState } from 'react';
import { LuggagePackage, ScreenId, User, LocationData } from '../types';
import { 
  ArrowLeft, 
  ArrowRight, 
  Package, 
  Check, 
  Search, 
  Calendar, 
  MapPin, 
  ShieldCheck, 
  Star, 
  Clock, 
  Sparkles 
} from 'lucide-react';
import { LocationSearchInput } from '../components/LocationSearchInput';
import { MapRoutePreview } from '../components/MapRoutePreview';

interface LuggageFlowProps {
  currentUser: User;
  onConfirmLuggage: (pkg: LuggagePackage) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  showToast: (msg: string) => void;
}

export const LuggageFlow: React.FC<LuggageFlowProps> = ({
  currentUser,
  onConfirmLuggage,
  onNavigateScreen,
  showToast,
}) => {
  const [step, setStep] = useState<'form' | 'search' | 'confirm' | 'success'>('form');

  const [origin, setOrigin] = useState('Bengaluru (Indiranagar)');
  const [originLocation, setOriginLocation] = useState<LocationData | null>({
    name: 'Bengaluru',
    formattedAddress: 'Indiranagar, Bengaluru, Karnataka, India',
    latitude: 12.9784,
    longitude: 77.6408,
  });

  const [destination, setDestination] = useState('Hyderabad (Banjara Hills)');
  const [destLocation, setDestLocation] = useState<LocationData | null>({
    name: 'Hyderabad',
    formattedAddress: 'Banjara Hills, Hyderabad, Telangana, India',
    latitude: 17.4156,
    longitude: 78.4357,
  });

  const [date, setDate] = useState('Sat, 10 Oct');
  const [size, setSize] = useState<'Document' | 'Small (< 5kg)' | 'Medium (< 15kg)' | 'Large (< 25kg)'>('Small (< 5kg)');
  const [description, setDescription] = useState('Sealed academic transcripts and laptop charger in a bubble bag.');
  const [priceOffer, setPriceOffer] = useState<number>(300);
  const [receiverName, setReceiverName] = useState('Sanjay Kulkarni');
  const [receiverPhone, setReceiverPhone] = useState('+91 94480 11223');

  // Simulated available travelers
  const availableTravelers = [
    {
      id: 'trv_1',
      name: 'Nisha Kulkarni',
      initials: 'NK',
      rating: 4.9,
      trips: 18,
      route: 'Bengaluru → Hyderabad',
      departureTime: '08:30 AM',
      date: 'Sat, 10 Oct',
      fee: 300,
      car: 'Honda City',
    },
    {
      id: 'trv_2',
      name: 'Pravin Kumar',
      initials: 'PK',
      rating: 4.8,
      trips: 12,
      route: 'Bengaluru → Hyderabad',
      departureTime: '10:00 AM',
      date: 'Sat, 10 Oct',
      fee: 350,
      car: 'Maruti Ertiga',
    },
  ];

  const [selectedTraveler, setSelectedTraveler] = useState(availableTravelers[0]);

  const handleFinish = () => {
    const newPkg: LuggagePackage = {
      id: `lug_${Date.now()}`,
      senderName: currentUser.name,
      senderInitials: currentUser.initials,
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
      size,
      description,
      priceOffer,
      receiverName,
      receiverPhone,
      status: 'active',
    };

    onConfirmLuggage(newPkg);
    setStep('success');
    showToast('Luggage delivery request confirmed!');
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
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Send luggage with a traveler</h1>
            <p className="text-xs text-slate-500">Fast, affordable door-to-corridor package delivery</p>
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setStep('search');
          }}
          className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5"
        >
          {/* Origin & Destination with Mapbox Location Search */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <LocationSearchInput
                label="Pickup Location"
                required
                iconType="origin"
                placeholder="Search pickup address or area"
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
                label="Delivery Location"
                required
                iconType="destination"
                placeholder="Search delivery address or area"
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

          {/* Date & Package Size */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Date Needed By
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
                Package Size Category
              </label>
              <select
                value={size}
                onChange={(e) => setSize(e.target.value as any)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold text-slate-900 text-sm focus:outline-hidden bg-white"
              >
                <option value="Document">Envelope / Document</option>
                <option value="Small (< 5kg)">Small (&lt; 5kg)</option>
                <option value="Medium (< 15kg)">Medium (&lt; 15kg)</option>
                <option value="Large (< 25kg)">Large (&lt; 25kg)</option>
              </select>
            </div>
          </div>

          {/* Package Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
              Package contents description
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Books, boxed electronics, keys, clothes..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Prohibited items: liquids, combustibles, cash, hazardous or illegal materials.
            </span>
          </div>

          {/* Compensation offer & Receiver Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Offer Fee (₹)
              </label>
              <input
                type="number"
                min="100"
                max="3000"
                step="50"
                value={priceOffer}
                onChange={(e) => setPriceOffer(parseInt(e.target.value, 10))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 font-black text-slate-900 text-base focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Receiver Name
              </label>
              <input
                type="text"
                required
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                Receiver Phone
              </label>
              <input
                type="tel"
                required
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Search travelers on route</span>
            <Search className="w-4 h-4" />
          </button>
        </form>
      </div>
    );
  }

  // ================= 2. MATCHED TRAVELERS =================
  if (step === 'search') {
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
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Select traveler to carry</h1>
            <p className="text-xs text-slate-500">{origin} → {destination}</p>
          </div>
        </div>

        <div className="space-y-4">
          {availableTravelers.map((trv) => (
            <div
              key={trv.id}
              onClick={() => {
                setSelectedTraveler(trv);
                setStep('confirm');
              }}
              className="bg-white rounded-3xl p-5 border-2 border-slate-200 hover:border-slate-950 transition-all cursor-pointer shadow-sm group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-slate-900 text-white font-black text-sm flex items-center justify-center">
                    {trv.initials}
                  </div>
                  <div>
                    <div className="font-bold text-sm text-slate-900">{trv.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                      <span>{trv.rating} • {trv.trips} trips</span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-2xl font-black text-slate-950">₹{trv.fee}</div>
                  <span className="text-[10px] text-slate-400">delivery fee</span>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 flex justify-between items-center">
                <span>Departs {trv.departureTime} • {trv.car}</span>
                <span className="font-bold text-slate-950 group-hover:underline flex items-center gap-1">
                  <span>Select & Confirm</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ================= 3. CONFIRMATION REVIEW =================
  if (step === 'confirm') {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('search')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-black text-slate-950">Confirm luggage request</h1>
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
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">Package</span>
                <div className="text-lg font-black text-slate-950">{size}</div>
                <p className="text-xs text-slate-600 mt-1">{description}</p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-slate-950">₹{selectedTraveler.fee}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 block">Traveler</span>
                <span className="font-bold text-slate-900">{selectedTraveler.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Date</span>
                <span className="font-bold text-slate-900">{date}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Pickup</span>
                <span className="font-bold text-slate-900">{origin}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Delivery To</span>
                <span className="font-bold text-slate-900">{receiverName} ({receiverPhone})</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleFinish}
            className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Confirm & Pay ₹{selectedTraveler.fee}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 4. SUCCESS =================
  if (step === 'success') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <Check className="w-10 h-10 stroke-[2.5]" />
        </div>

        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 mb-2">
            Delivery Scheduled
          </span>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Package booked with {selectedTraveler.name}!
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            The traveler has been notified to pick up the package on {date}.
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
