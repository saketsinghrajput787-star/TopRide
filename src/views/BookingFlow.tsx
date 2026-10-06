import React, { useState } from 'react';
import { Trip, User, ScreenId } from '../types';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  CreditCard, 
  Luggage, 
  ShieldCheck, 
  AlertCircle, 
  Sparkles,
  Smartphone,
  Building2,
  Lock,
  Download,
  MessageSquare
} from 'lucide-react';

import { api } from '../api';

interface BookingFlowProps {
  trip: Trip;
  currentUser: User;
  onConfirmBooking: (bookedTrip: Trip, seatCount: number, totalPaid: number) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  onOpenChat: (driverId: string, driverName: string) => void;
  showToast: (msg: string) => void;
}

export const BookingFlow: React.FC<BookingFlowProps> = ({
  trip,
  currentUser,
  onConfirmBooking,
  onNavigateScreen,
  onOpenChat,
  showToast,
}) => {
  // Step: 1. seat & luggage -> 2. review & pay -> 3. confirmed
  const [step, setStep] = useState<'selection' | 'checkout' | 'confirmed'>('selection');

  // Booking selections
  const [selectedSeatCount, setSelectedSeatCount] = useState<number>(1);
  const [luggageTier, setLuggageTier] = useState<'small' | 'medium' | 'heavy'>('small');
  const [passengerNotes, setPassengerNotes] = useState<string>('');
  
  // Payment states (Mock Razorpay)
  const [paymentTab, setPaymentTab] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [upiId, setUpiId] = useState('demo@okhdfcbank');
  const [cardNumber, setCardNumber] = useState('4532 •••• •••• 8912');
  const [cardExpiry, setCardExpiry] = useState('08/28');
  const [cardCvv, setCardCvv] = useState('•••');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [bookingRef, setBookingRef] = useState('TR-90421');

  // Calculations
  const seatFare = trip.pricePerSeat * selectedSeatCount;
  const luggageFee = luggageTier === 'medium' ? 100 : luggageTier === 'heavy' ? 200 : 0;
  const platformFee = 0; // TopRide promo: 0 fee
  const totalAmount = seatFare + luggageFee + platformFee;

  const handleProcessPayment = async (simulateFailure = false) => {
    setIsProcessing(true);
    setPaymentFailed(false);

    if (simulateFailure) {
      setTimeout(() => {
        setIsProcessing(false);
        setPaymentFailed(true);
        showToast('Payment simulation failed — please try again');
      }, 1000);
      return;
    }

    try {
      const res = await api.createBooking({
        tripId: trip.id,
        seatsCount: selectedSeatCount,
        luggageTier,
        passengerNotes,
        totalAmount,
      });
      setBookingRef(res.bookingRef);
      setIsProcessing(false);
      setStep('confirmed');
      onConfirmBooking(res.trip || trip, selectedSeatCount, totalAmount);
      showToast('Payment successful! Booking confirmed.');
    } catch (err: any) {
      setIsProcessing(false);
      const errMsg = err?.message || 'Booking failed. Please try again.';
      showToast(errMsg);
    }
  };

  // ================= STEP 1: SEAT & LUGGAGE SELECTION =================
  if (step === 'selection') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateScreen('trip-details')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Select seats & luggage</h1>
            <p className="text-xs text-slate-500">{trip.origin} → {trip.destination} • {trip.date}</p>
          </div>
        </div>

        {/* Step 1 Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          {/* Seat count selector */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
              How many seats do you need?
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].slice(0, trip.availableSeats).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setSelectedSeatCount(count)}
                  className={`py-4 px-3 rounded-2xl border-2 text-center transition-all cursor-pointer ${
                    selectedSeatCount === count
                      ? 'border-slate-950 bg-slate-50 font-black text-slate-950 shadow-xs'
                      : 'border-slate-200 hover:border-slate-300 font-bold text-slate-600'
                  }`}
                >
                  <div className="text-xl">{count}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{count === 1 ? 'Seat' : 'Seats'}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Car Seating Layout Visualization */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600 block mb-3">Vehicle Cabin Layout</span>
            <div className="max-w-xs mx-auto border-2 border-dashed border-slate-300 rounded-3xl p-4 bg-white space-y-4">
              {/* Front row */}
              <div className="flex justify-between items-center px-4">
                <div className="w-12 h-12 rounded-xl bg-slate-900 text-white text-[10px] font-bold flex flex-col items-center justify-center">
                  <span>Driver</span>
                  <span className="text-[8px] text-slate-400">Arjun</span>
                </div>
                <div className="w-12 h-12 rounded-xl border-2 border-dashed border-slate-300 text-slate-400 text-[10px] font-bold flex items-center justify-center">
                  Empty
                </div>
              </div>
              {/* Rear row */}
              <div className="flex justify-between items-center px-4">
                <div className="w-12 h-12 rounded-xl bg-slate-950 text-white text-[10px] font-bold flex flex-col items-center justify-center ring-2 ring-emerald-500">
                  <span>Seat 1</span>
                  <span className="text-[8px] text-emerald-300">You</span>
                </div>
                <div className={`w-12 h-12 rounded-xl text-[10px] font-bold flex flex-col items-center justify-center ${
                  selectedSeatCount >= 2 ? 'bg-slate-950 text-white ring-2 ring-emerald-500' : 'border-2 border-slate-200 text-slate-400'
                }`}>
                  <span>Seat 2</span>
                  <span className="text-[8px] text-slate-400">{selectedSeatCount >= 2 ? 'You' : 'Free'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Luggage options */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
              Luggage allowance
            </h2>
            <div className="space-y-3">
              <label
                onClick={() => setLuggageTier('small')}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  luggageTier === 'small' ? 'border-slate-950 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Luggage className="w-5 h-5 text-slate-700" />
                  <div>
                    <div className="font-bold text-sm text-slate-900">1 Small bag / Cabin backpack</div>
                    <div className="text-xs text-slate-500">Fits on lap or in cabin footwell</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Included
                </span>
              </label>

              <label
                onClick={() => setLuggageTier('medium')}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  luggageTier === 'medium' ? 'border-slate-950 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Luggage className="w-5 h-5 text-slate-700" />
                  <div>
                    <div className="font-bold text-sm text-slate-900">1 Medium suitcase in boot</div>
                    <div className="text-xs text-slate-500">Up to 20kg trolley bag</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-slate-900">+₹100</span>
              </label>
            </div>
          </div>

          {/* Notes for Driver */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Pickup instructions / Note for Driver (Optional)
            </label>
            <input
              type="text"
              value={passengerNotes}
              onChange={(e) => setPassengerNotes(e.target.value)}
              placeholder="e.g. Will carry a small musical instrument, waiting by gate 2"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden focus:border-slate-950"
            />
          </div>

          {/* Bottom Bar / Summary */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Total estimated fare</div>
              <div className="text-2xl font-black text-slate-950">₹{totalAmount}</div>
            </div>

            <button
              onClick={() => setStep('checkout')}
              className="py-4 px-8 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-sm transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <span>Continue to payment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= STEP 2: REVIEW & MOCK RAZORPAY PAYMENT =================
  if (step === 'checkout') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('selection')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Review & Pay</h1>
            <p className="text-xs text-slate-500">Secure checkout via Razorpay</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* LEFT: PAYMENT METHODS (col 7) */}
          <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            {/* Razorpay Banner */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900 tracking-tight">TopRide Checkout</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  Razorpay Sandbox
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>256-bit Encrypted</span>
              </div>
            </div>

            {/* Payment Method Selector Tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPaymentTab('upi')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  paymentTab === 'upi' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                UPI (GPay / PhonePe)
              </button>
              <button
                type="button"
                onClick={() => setPaymentTab('card')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  paymentTab === 'card' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Cards
              </button>
              <button
                type="button"
                onClick={() => setPaymentTab('netbanking')}
                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  paymentTab === 'netbanking' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Netbanking
              </button>
            </div>

            {/* TAB CONTENT: UPI */}
            {paymentTab === 'upi' && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  {['Google Pay', 'PhonePe', 'Paytm'].map((app) => (
                    <button
                      key={app}
                      type="button"
                      onClick={() => setUpiId(`${app.toLowerCase().replace(' ', '')}@okaxis`)}
                      className="p-3 border border-slate-200 rounded-xl text-center hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer"
                    >
                      <Smartphone className="w-4 h-4 mx-auto mb-1 text-slate-700" />
                      <span>{app}</span>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Or enter UPI VPA / ID
                  </label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-hidden focus:border-slate-950"
                    placeholder="username@okhdfcbank"
                  />
                </div>
              </div>
            )}

            {/* TAB CONTENT: CARDS */}
            {paymentTab === 'card' && (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Card Number (Demo)
                  </label>
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-hidden"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      value={cardExpiry}
                      onChange={(e) => setCardExpiry(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-hidden"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                      CVV
                    </label>
                    <input
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-hidden"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: NETBANKING */}
            {paymentTab === 'netbanking' && (
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Select Popular Bank
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank'].map((b) => (
                    <button
                      key={b}
                      type="button"
                      className="p-3 border border-slate-200 rounded-xl text-left text-xs font-bold text-slate-800 hover:bg-slate-50 cursor-pointer flex items-center gap-2"
                    >
                      <Building2 className="w-4 h-4 text-slate-600 shrink-0" />
                      <span>{b}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Failure Simulation Alert */}
            {paymentFailed && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>Payment declined by bank simulator. Click "Pay" to retry.</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-3 space-y-2">
              <button
                disabled={isProcessing}
                onClick={() => handleProcessPayment(false)}
                className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Processing with Razorpay...</span>
                  </span>
                ) : (
                  <span>Pay ₹{totalAmount}</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleProcessPayment(true)}
                className="w-full py-2 text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer text-center"
              >
                [Dev Test: Simulate Failed Payment]
              </button>
            </div>
          </div>

          {/* RIGHT: TRIP ORDER SUMMARY (col 5) */}
          <div className="md:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">Trip Summary</h2>
            
            <div>
              <div className="font-black text-lg text-slate-950">
                {trip.origin} → {trip.destination}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {trip.date} • Departure {trip.departureTime}
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Driver</span>
                <span className="font-semibold text-slate-900">{trip.driverName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Vehicle</span>
                <span className="font-semibold text-slate-900">{trip.vehicle.make} {trip.vehicle.model}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Passenger</span>
                <span className="font-semibold text-slate-900">{currentUser.name}</span>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="pt-3 border-t border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Seat Price ({selectedSeatCount} × ₹{trip.pricePerSeat})</span>
                <span className="font-bold text-slate-900">₹{seatFare}</span>
              </div>
              {luggageFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Luggage Add-on</span>
                  <span className="font-bold text-slate-900">₹{luggageFee}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Platform Fee</span>
                <span className="font-bold text-emerald-600">₹0 (Free Promo)</span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex justify-between text-base font-black text-slate-950">
                <span>Total Payable</span>
                <span>₹{totalAmount}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= STEP 3: BOOKING CONFIRMED SCREEN =================
  if (step === 'confirmed') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-12 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <Check className="w-10 h-10 stroke-[2.5]" />
        </div>

        <div>
          <span className="inline-block px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200 mb-2">
            Payment Confirmed
          </span>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Your seat is reserved!
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Reference code: <span className="font-mono font-bold text-slate-900">{bookingRef}</span>
          </p>
        </div>

        {/* Confirmed Details Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm text-left space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-400 font-semibold block">Route</span>
              <span className="text-base font-black text-slate-900">{trip.origin} → {trip.destination}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400 font-semibold block">Paid</span>
              <span className="text-base font-black text-slate-950">₹{totalAmount}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-slate-400 block">Date & Time</span>
              <span className="font-bold text-slate-900">{trip.date} at {trip.departureTime}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Driver</span>
              <span className="font-bold text-slate-900">{trip.driverName}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Pickup Point</span>
              <span className="font-bold text-slate-900 truncate block">{trip.originDetail || trip.origin}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Seats Reserved</span>
              <span className="font-bold text-slate-900">{selectedSeatCount} {selectedSeatCount === 1 ? 'Seat' : 'Seats'}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <button
            onClick={() => onNavigateScreen('trips')}
            className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm cursor-pointer"
          >
            View in My Trips
          </button>

          <button
            onClick={() => onOpenChat(trip.driverId, trip.driverName)}
            className="w-full py-3.5 px-6 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Open chat with driver</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};
