import React, { useState, useEffect } from 'react';
import { Trip, User, ScreenId, PaymentOrderResponse } from '../types';
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Luggage, 
  ShieldCheck, 
  AlertCircle, 
  Lock, 
  MessageSquare, 
  RotateCcw, 
  Info, 
  Receipt, 
  Users, 
  Clock, 
  Car, 
  Star, 
  CheckCircle2, 
  Sparkles, 
  Ban, 
  Calendar, 
  MapPin 
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

type BookingStep = 
  | 'rules'      // Figma Frame: What you need to know
  | 'details'    // Figma Frame: Review trip details
  | 'driver'     // Figma Frame: Meet the driver
  | 'seats'      // Figma Frame 7: Seats and pricing stepper
  | 'message'    // Figma Frame: Message to driver
  | 'expiry'     // Figma Frame: Booking expiry
  | 'checkout'   // Figma Frame: Request to book / Razorpay checkout
  | 'confirmed'; // Figma Frame: Booking confirmed

type PaymentError = 
  | { type: 'none'; message?: string }
  | { type: 'seat_conflict'; message: string }
  | { type: 'payment_failed'; message: string }
  | { type: 'verification_failed'; message: string }
  | { type: 'checkout_cancelled'; message: string }
  | { type: 'driver_self_booking'; message: string }
  | { type: 'generic'; message: string };

type ActivePaymentError = Exclude<PaymentError, { type: 'none' }>;

// Ensure Razorpay web checkout script is loaded
const ensureRazorpayLoaded = (): Promise<boolean> => {
  if (typeof window !== 'undefined' && (window as any).Razorpay) {
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const BookingFlow: React.FC<BookingFlowProps> = ({
  trip,
  currentUser,
  onConfirmBooking,
  onNavigateScreen,
  onOpenChat,
  showToast,
}) => {
  // Current wizard step in the Figma journey
  const [step, setStep] = useState<BookingStep>('rules');

  // Step 1: Rules agreement
  const [agreedToRules, setAgreedToRules] = useState<boolean>(true);

  // Step 4: Seat count and luggage
  const [selectedSeatCount, setSelectedSeatCount] = useState<number>(1);
  const [luggageTier, setLuggageTier] = useState<'small' | 'medium' | 'heavy'>('small');

  // Step 5: Message to driver
  const [passengerNotes, setPassengerNotes] = useState<string>('');

  // Step 6: Expiry option
  const [expiryHours, setExpiryHours] = useState<'6' | '24'>('24');
  
  // Payment states (Razorpay Test Mode)
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<PaymentError>({ type: 'none' });
  const [checkoutDismissed, setCheckoutDismissed] = useState<boolean>(false);
  const [bookingRef, setBookingRef] = useState<string>('TR-90421');
  const [lastOrderId, setLastOrderId] = useState<string>('');
  const [lastPaymentId, setLastPaymentId] = useState<string>('');
  const [lastSignature, setLastSignature] = useState<string>('');

  // Cache existing created order to prevent duplicate Razorpay order creations on repeated clicks
  const [activeOrder, setActiveOrder] = useState<PaymentOrderResponse | null>(null);

  // Authoritative calculations (uses dynamic market price if available)
  const effectiveUnitPrice = trip.currentMarketPrice ?? trip.pricePerSeat;
  const seatFare = effectiveUnitPrice * selectedSeatCount;
  const luggageFee = luggageTier === 'medium' ? 100 : luggageTier === 'heavy' ? 200 : 0;
  const platformFee = 0; // TopRide promo: 0 fee
  const totalAmount = seatFare + luggageFee + platformFee;

  // Authoritative seat availability calculations
  const maxAvailable = Math.max(0, trip.availableSeats ?? trip.totalSeats ?? 0);

  useEffect(() => {
    if (maxAvailable > 0 && selectedSeatCount > maxAvailable) {
      setSelectedSeatCount(maxAvailable);
    }
  }, [maxAvailable, selectedSeatCount]);

  // Categorize errors cleanly to distinguish seat conflicts (409) from Razorpay failures
  const categorizeError = (err: any): ActivePaymentError => {
    const status = err?.status;
    const msg = String(err?.message || err?.detail || '');
    
    if (
      status === 409 || 
      msg.includes('409') || 
      msg.toLowerCase().includes('seats unavailable') || 
      msg.toLowerCase().includes('not enough seats') || 
      msg.toLowerCase().includes('no longer available') ||
      msg.toLowerCase().includes('already booked')
    ) {
      return {
        type: 'seat_conflict',
        message: 'These seats are no longer available.',
      };
    }

    if (msg.toLowerCase().includes('own trip') || msg.toLowerCase().includes('cannot book your own')) {
      return {
        type: 'driver_self_booking',
        message: 'You cannot book your own trip as a passenger.',
      };
    }

    if (msg.toLowerCase().includes('signature') || msg.toLowerCase().includes('verification failed')) {
      return {
        type: 'verification_failed',
        message: 'Payment verification failed. Please try again.',
      };
    }

    if (msg.toLowerCase().includes('cancelled') || msg.toLowerCase().includes('dismissed')) {
      return {
        type: 'checkout_cancelled',
        message: 'Checkout was closed before completion. You have not been charged.',
      };
    }

    return {
      type: 'payment_failed',
      message: msg || 'Payment processing failed. Please check test payment details and retry.',
    };
  };

  // Launch Razorpay Checkout in Test Mode
  const handleProceedToRazorpay = async () => {
    setPaymentError({ type: 'none' });
    setCheckoutDismissed(false);

    if (trip.driverId === currentUser.id) {
      setPaymentError({
        type: 'driver_self_booking',
        message: 'You are the driver of this trip and cannot book a seat on it.',
      });
      return;
    }

    if (maxAvailable === 0 || selectedSeatCount > maxAvailable) {
      setPaymentError({
        type: 'seat_conflict',
        message: 'These seats are no longer available.',
      });
      return;
    }

    setIsProcessing(true);

    try {
      const isLoaded = await ensureRazorpayLoaded();
      if (!isLoaded || !(window as any).Razorpay) {
        throw new Error('Razorpay payment gateway script could not be loaded. Please check your network.');
      }

      let currentOrder = activeOrder;
      if (!currentOrder || currentOrder.amountRupees !== totalAmount) {
        currentOrder = await api.createRazorpayOrder({
          tripId: trip.id,
          seatsCount: selectedSeatCount,
          luggageTier,
        });
        setActiveOrder(currentOrder);
      }

      setLastOrderId(currentOrder.orderId);

      const options = {
        key: currentOrder.keyId,
        amount: currentOrder.amount,
        currency: currentOrder.currency || 'INR',
        name: 'TopRide Carpool',
        description: `Booking ${selectedSeatCount} seat(s): ${trip.origin} → ${trip.destination}`,
        order_id: currentOrder.orderId,
        prefill: {
          name: currentUser.name,
          email: currentUser.email,
          contact: currentUser.phone || '9876543210',
        },
        theme: {
          color: '#F05A28',
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setCheckoutDismissed(true);
            setPaymentError({
              type: 'checkout_cancelled',
              message: 'Checkout was closed before payment was completed.',
            });
          },
        },
        handler: async (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) => {
          setIsProcessing(true);
          try {
            setLastPaymentId(response.razorpay_payment_id);
            setLastSignature(response.razorpay_signature);

            const verifyResult = await api.verifyRazorpayPayment({
              tripId: trip.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
              seatsCount: selectedSeatCount,
              luggageTier,
              passengerNotes,
            });

            if (verifyResult.verified) {
              const generatedRef = verifyResult.booking?.bookingRef || `TR-${Math.floor(10000 + Math.random() * 90000)}`;
              setBookingRef(generatedRef);
              setStep('confirmed');
              onConfirmBooking(
                {
                  ...trip,
                  availableSeats: Math.max(0, trip.availableSeats - selectedSeatCount),
                  bookedSeatCount: selectedSeatCount,
                  isPassengerTrip: true,
                  status: 'upcoming',
                },
                selectedSeatCount,
                totalAmount
              );
              showToast(`Payment successful! Booked ${selectedSeatCount} seat(s).`);
            } else {
              setPaymentError({
                type: 'verification_failed',
                message: 'Payment signature could not be verified by server.',
              });
            }
          } catch (err: any) {
            setPaymentError(categorizeError(err));
          } finally {
            setIsProcessing(false);
          }
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.on('payment.failed', (resp: any) => {
        setIsProcessing(false);
        const reason = resp?.error?.description || resp?.error?.reason || 'Payment failed in test mode.';
        setPaymentError({
          type: 'payment_failed',
          message: reason,
        });
      });

      razorpayInstance.open();
    } catch (err: any) {
      setIsProcessing(false);
      setPaymentError(categorizeError(err));
    }
  };

  // Step indicator component
  const stepIndexMap: Record<BookingStep, number> = {
    rules: 1,
    details: 2,
    driver: 3,
    seats: 4,
    message: 5,
    expiry: 6,
    checkout: 7,
    confirmed: 8,
  };

  const currentStepNum = stepIndexMap[step];

  // ================= 1. FIGMA FRAME: WHAT YOU NEED TO KNOW =================
  if (step === 'rules') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigateScreen('trip-details')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            aria-label="Back to trip details"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-xs font-bold text-slate-400">Step 1 of 7</div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            What you need to know
          </h1>
          <p className="text-xs text-slate-500">
            TopRide is a trusted carpooling community. Review our basic rules before requesting.
          </p>
        </div>

        <div className="space-y-4">
          {/* Rule 1: Carpool not a taxi */}
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Car className="w-6 h-6 stroke-2" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900">This is not a taxi service</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                TopRide is a community of carpoolers sharing empty seats. Drivers are traveling for their own journey and sharing costs, not running a commercial taxi service.
              </p>
            </div>
          </div>

          {/* Rule 2: Online booking only, no cash */}
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <Ban className="w-6 h-6 stroke-2" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900">Cash is not allowed</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Cash or offline transfers are strictly prohibited. Always use our online booking system to stay protected under TopRide guarantees and refund policies.
              </p>
            </div>
          </div>

          {/* Rule 3: Arrive 10 minutes early */}
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Clock className="w-6 h-6 stroke-2" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-slate-900">Please show up 10 minutes early</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Arrive at the designated pickup point ahead of time so the ride departs on schedule for all passengers.
              </p>
            </div>
          </div>
        </div>

        {/* Checkbox agreement */}
        <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200/70 cursor-pointer">
          <input
            type="checkbox"
            checked={agreedToRules}
            onChange={(e) => setAgreedToRules(e.target.checked)}
            className="mt-1 w-4 h-4 rounded text-[#F05A28] focus:ring-[#F05A28] cursor-pointer"
          />
          <span className="text-xs text-slate-700 leading-relaxed">
            I understand that TopRide is a carpool community and agree to follow all safety and community house rules.
          </span>
        </label>

        <button
          disabled={!agreedToRules}
          onClick={() => setStep('details')}
          className="w-full py-4 px-6 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] disabled:opacity-40 text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <span>Next: Review Trip Details</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ================= 2. FIGMA FRAME: REVIEW TRIP DETAILS =================
  if (step === 'details') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep('rules')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            aria-label="Back to rules"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-xs font-bold text-slate-400">Step 2 of 7</div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Review trip details
          </h1>
          <p className="text-xs text-slate-500">
            Check the route itinerary and driver notes before booking.
          </p>
        </div>

        {/* Departure notice (Figma yellow box) */}
        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/80 text-amber-900 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>The departure time of this ride is an estimate because the driver is en route.</span>
        </div>

        {/* Trip Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-xs text-slate-400 font-semibold block">{trip.date}</span>
              <span className="text-lg font-black text-slate-950">
                {trip.origin} → {trip.destination}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-black text-slate-950">₹{effectiveUnitPrice}</span>
              <span className="text-[10px] text-slate-400 block">per seat</span>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">
                A
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Pickup Location</span>
                <span className="text-slate-600">{trip.originDetail || `${trip.origin} City Center`}</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">Departs at {trip.departureTime}</span>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 font-bold text-[10px]">
                B
              </div>
              <div>
                <span className="font-bold text-slate-900 block">Drop-off Location</span>
                <span className="text-slate-600">{trip.destinationDetail || `${trip.destination} Junction`}</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">Estimated arrival {trip.arrivalTime} ({trip.duration})</span>
              </div>
            </div>
          </div>

          {/* Trip Description by Driver */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1.5">
            <span className="text-xs font-bold text-slate-900 block">
              {trip.driverName.split(' ')[0]} wrote this trip description:
            </span>
            <p className="text-xs text-slate-600 leading-relaxed italic">
              "Comfortable ride with AC on. Please arrive 10 minutes prior to departure. Small to medium luggage welcome."
            </p>
          </div>
        </div>

        <button
          onClick={() => setStep('driver')}
          className="w-full py-4 px-6 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <span>Next: Meet the Driver</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ================= 3. FIGMA FRAME: MEET THE DRIVER =================
  if (step === 'driver') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep('details')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            aria-label="Back to trip details"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-xs font-bold text-slate-400">Step 3 of 7</div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Meet the driver
          </h1>
          <p className="text-xs text-slate-500">
            Travel with trusted, ID-verified members of the TopRide community.
          </p>
        </div>

        {/* Driver Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-slate-950 text-white font-black text-xl flex items-center justify-center shadow-xs">
              {trip.driverInitials}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="font-black text-lg text-slate-950">{trip.driverName}</span>
                {trip.driverIsVerified && (
                  <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" /> ID Verified
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="flex items-center gap-1 text-slate-800 font-bold">
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  {trip.driverRating}
                </span>
                <span>•</span>
                <span>{trip.driverTripsCount} completed rides</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1 text-xs">
            <span className="font-bold text-slate-900 block">About {trip.driverName.split(' ')[0]}</span>
            <p className="text-slate-600 leading-relaxed">
              "Regular commuter traveling between cities. Focused on safe driving, comfortable cabin atmosphere, and punctuality."
            </p>
          </div>

          {/* Vehicle Info */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Car className="w-6 h-6 stroke-1.5" />
            </div>
            <div className="text-xs">
              <span className="font-bold text-slate-900 block text-sm">
                {trip.vehicle.make} {trip.vehicle.model}
              </span>
              <span className="text-slate-500">
                {trip.vehicle.color} • {trip.vehicle.year} • Plate: <strong className="font-mono text-slate-800">{trip.vehicle.plateNumber}</strong>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setStep('seats')}
          className="w-full py-4 px-6 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <span>Next: Select Seats & Pricing</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ================= 4. FIGMA FRAME 7: SEATS AND PRICING (STEPPER) =================
  if (step === 'seats') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep('driver')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            aria-label="Back to meet driver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-xs font-bold text-slate-400">Step 4 of 7</div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Seats and pricing
          </h1>
          <p className="text-xs text-slate-500">
            Choose how many seats you need for your journey.
          </p>
        </div>

        {/* Stepper Card */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-6">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
                  Seats needed
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  How many passenger seats would you like to book?
                </p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                maxAvailable > 0
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}>
                {maxAvailable} of {trip.totalSeats} seats open
              </span>
            </div>

            {maxAvailable === 0 ? (
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>This ride is fully booked. Zero seats currently available.</span>
              </div>
            ) : (
              <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-slate-900 block">Number of seats</span>
                  <span className="text-xs text-slate-500">₹{effectiveUnitPrice} per passenger seat</span>
                </div>

                {/* Figma Stepper */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={selectedSeatCount <= 1}
                    onClick={() => {
                      if (selectedSeatCount > 1) {
                        setSelectedSeatCount(selectedSeatCount - 1);
                        setActiveOrder(null);
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-white border border-slate-300 text-slate-800 font-black text-lg flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 shadow-xs"
                    aria-label="Decrease seat count"
                  >
                    −
                  </button>

                  <span className="w-8 text-center font-black text-2xl text-slate-900 select-none">
                    {selectedSeatCount}
                  </span>

                  <button
                    type="button"
                    disabled={selectedSeatCount >= maxAvailable}
                    onClick={() => {
                      if (selectedSeatCount < maxAvailable) {
                        setSelectedSeatCount(selectedSeatCount + 1);
                        setActiveOrder(null);
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-white border border-slate-300 text-slate-800 font-black text-lg flex items-center justify-center hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-all active:scale-95 shadow-xs"
                    aria-label="Increase seat count"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Luggage Tier */}
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mb-3">
              Luggage allowance
            </h2>
            <div className="space-y-3">
              <label
                onClick={() => {
                  setLuggageTier('small');
                  setActiveOrder(null);
                }}
                className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
                  luggageTier === 'small' ? 'border-slate-950 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Luggage className="w-5 h-5 text-slate-700" />
                  <div>
                    <div className="font-bold text-sm text-slate-900">1 Small bag / Backpack</div>
                    <div className="text-xs text-slate-500">Fits on lap or in cabin footwell</div>
                  </div>
                </div>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                  Included
                </span>
              </label>

              <label
                onClick={() => {
                  setLuggageTier('medium');
                  setActiveOrder(null);
                }}
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

          {/* Price Breakdown */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400">Total estimated fare</div>
              <div className="text-2xl font-black text-slate-950">₹{totalAmount}</div>
            </div>

            <button
              disabled={maxAvailable === 0}
              onClick={() => setStep('message')}
              className={`py-4 px-6 rounded-2xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 ${
                maxAvailable > 0
                  ? 'bg-[#F05A28] hover:bg-[#d84a1b] text-white cursor-pointer active:scale-98'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Next: Message to Driver</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 5. FIGMA FRAME: MESSAGE TO DRIVER =================
  if (step === 'message') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep('seats')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            aria-label="Back to seats"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-xs font-bold text-slate-400">Step 5 of 7</div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Message to driver
          </h1>
          <p className="text-xs text-slate-500">
            Tell the driver why you're travelling and any pickup preferences.
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
            Your note to {trip.driverName.split(' ')[0]}
          </label>
          <textarea
            rows={5}
            value={passengerNotes}
            onChange={(e) => setPassengerNotes(e.target.value)}
            placeholder="e.g. Hi! Traveling for weekend work, will be carrying a small backpack. Waiting near the main gate."
            className="w-full p-4 rounded-2xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-[#F05A28] leading-relaxed resize-none"
          />
          <p className="text-[11px] text-slate-400">
            A polite introductory note helps drivers quickly approve your booking request.
          </p>
        </div>

        <button
          onClick={() => setStep('expiry')}
          className="w-full py-4 px-6 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <span>Next: Booking Expiry</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ================= 6. FIGMA FRAME: BOOKING EXPIRY =================
  if (step === 'expiry') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setStep('message')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            aria-label="Back to message"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-xs font-bold text-slate-400">Step 6 of 7</div>
        </div>

        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
            Booking expiry
          </h1>
          <p className="text-xs text-slate-500">
            How quickly do you need the driver to approve the request?
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <label
            onClick={() => setExpiryHours('6')}
            className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
              expiryHours === '6' ? 'border-[#F05A28] bg-orange-50/30' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="expiry"
                checked={expiryHours === '6'}
                onChange={() => setExpiryHours('6')}
                className="accent-[#F05A28]"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 block">Within 6 hours</span>
                <span className="text-xs text-slate-500">Recommended for departures within next 24-48 hours</span>
              </div>
            </div>
            <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
              Fast response
            </span>
          </label>

          <label
            onClick={() => setExpiryHours('24')}
            className={`p-4 rounded-2xl border-2 flex items-center justify-between cursor-pointer transition-all ${
              expiryHours === '24' ? 'border-[#F05A28] bg-orange-50/30' : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="expiry"
                checked={expiryHours === '24'}
                onChange={() => setExpiryHours('24')}
                className="accent-[#F05A28]"
              />
              <div>
                <span className="font-bold text-sm text-slate-900 block">Within 24 hours</span>
                <span className="text-xs text-slate-500">Standard response window for advance trip bookings</span>
              </div>
            </div>
            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full">
              Standard
            </span>
          </label>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>
              If the driver does not respond before the expiry window, your reservation request is automatically cancelled and funds remain uncaptured.
            </span>
          </div>
        </div>

        <button
          onClick={() => setStep('checkout')}
          className="w-full py-4 px-6 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] text-white font-bold text-sm transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer active:scale-98"
        >
          <span>Continue to Payment</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ================= 7. FIGMA FRAME: REVIEW & RAZORPAY TEST MODE CHECKOUT =================
  if (step === 'checkout') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              setStep('expiry');
              setPaymentError({ type: 'none' });
            }}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            aria-label="Back to expiry"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-xs font-bold text-slate-400">Step 7 of 7</div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
          {/* LEFT: RAZORPAY TEST CHECKOUT PANEL (col 7) */}
          <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
            {/* Razorpay Banner */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="font-black text-sm text-slate-900 tracking-tight">TopRide Checkout</span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-bold border border-blue-200">
                  Razorpay Test Mode
                </span>
              </div>
              <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-semibold">
                <Lock className="w-3.5 h-3.5" />
                <span>256-bit Encrypted</span>
              </div>
            </div>

            {/* Test Mode Instructions Card */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                <Info className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Sandbox Test Payment Information</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Clicking the button below opens the official <strong>Razorpay Test Checkout</strong> modal. 
                You can simulate successful or failed payments using test UPI apps, test Netbanking, or cards without any real money charges.
              </p>
            </div>

            {/* Price breakdown inside checkout */}
            <div className="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>Trip Route</span>
                <span className="font-bold text-slate-900">{trip.origin} → {trip.destination}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Selected Seats</span>
                <span className="font-bold text-slate-900">{selectedSeatCount} {selectedSeatCount === 1 ? 'seat' : 'seats'}</span>
              </div>
              <div className="flex justify-between text-slate-600 items-center">
                <span>Price Per Seat</span>
                <span className="font-bold text-slate-950 flex items-center gap-1.5">
                  ₹{effectiveUnitPrice}
                  {trip.pricingMetadata?.demandMultiplier && trip.pricingMetadata.demandMultiplier > 1.05 && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full font-medium">
                      High demand
                    </span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Fare ({selectedSeatCount} × ₹{effectiveUnitPrice})</span>
                <span className="font-bold text-slate-900">₹{seatFare}</span>
              </div>
              {luggageFee > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Luggage ({luggageTier})</span>
                  <span className="font-bold text-slate-900">₹{luggageFee}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between text-sm font-black text-slate-950">
                <span>Total Amount</span>
                <span>₹{totalAmount}</span>
              </div>
            </div>

            {/* 1. SEAT CONFLICT / 409 ERROR ALERT */}
            {paymentError.type === 'seat_conflict' && (
              <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-xs space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-amber-900 text-sm">These seats are no longer available</div>
                    <div className="text-amber-800 mt-0.5">{paymentError.message}</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('seats');
                    setPaymentError({ type: 'none' });
                  }}
                  className="w-full py-2.5 px-4 bg-amber-900 hover:bg-amber-950 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Select another seat</span>
                </button>
              </div>
            )}

            {/* 2. RAZORPAY PAYMENT DECLINED / FAILED ALERT */}
            {paymentError.type === 'payment_failed' && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-900 text-sm">Payment failed or was declined</div>
                    <div className="text-rose-800 mt-0.5">{paymentError.message}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 3. SIGNATURE VERIFICATION FAILED ALERT */}
            {paymentError.type === 'verification_failed' && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-900 text-sm">Signature verification error</div>
                    <div className="text-rose-800 mt-0.5">{paymentError.message}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 4. DRIVER SELF-BOOKING ERROR ALERT */}
            {paymentError.type === 'driver_self_booking' && (
              <div className="p-4 bg-purple-50 border border-purple-300 rounded-2xl text-xs space-y-2">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-purple-900 text-sm">Driver self-booking disallowed</div>
                    <div className="text-purple-800 mt-0.5">{paymentError.message}</div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. CHECKOUT CANCELLED NOTICE */}
            {paymentError.type === 'checkout_cancelled' && (
              <div className="p-4 bg-slate-100 border border-slate-200 rounded-2xl text-xs text-slate-700 flex items-center gap-2">
                <Info className="w-4 h-4 text-slate-500 shrink-0" />
                <span>{paymentError.message}</span>
              </div>
            )}

            {/* CTA BUTTONS: INITIAL CHECKOUT vs RETRY */}
            {paymentError.type === 'none' || paymentError.type === 'checkout_cancelled' ? (
              <button
                type="button"
                disabled={isProcessing || maxAvailable === 0}
                onClick={handleProceedToRazorpay}
                className="w-full py-4 px-6 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] disabled:opacity-50 text-white font-black text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                {isProcessing ? (
                  <>
                    <div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
                    <span>Initializing Test Checkout...</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>Pay ₹{totalAmount} (Razorpay Test Mode)</span>
                  </>
                )}
              </button>
            ) : paymentError.type === 'payment_failed' || paymentError.type === 'verification_failed' ? (
              <div className="space-y-2">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={handleProceedToRazorpay}
                  className="w-full py-4 px-6 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Retry Test Payment (₹{totalAmount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep('seats');
                    setPaymentError({ type: 'none' });
                  }}
                  className="w-full py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition-colors cursor-pointer text-center"
                >
                  Change Seat Selection
                </button>
              </div>
            ) : null}
          </div>

          {/* RIGHT: TRIP SUMMARY CARD (col 5) */}
          <div className="md:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Trip Summary</h2>
            
            <div className="space-y-3 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {trip.driverInitials}
                </div>
                <div>
                  <div className="font-bold text-slate-900">{trip.driverName}</div>
                  <div className="text-slate-400">★ {trip.driverRating} · {trip.vehicle.make} {trip.vehicle.model}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1 border border-slate-100">
                <div className="font-semibold text-slate-800">{trip.origin} → {trip.destination}</div>
                <div className="text-slate-500">{trip.date} • Departs {trip.departureTime}</div>
                <div className="text-slate-500">Seats: {selectedSeatCount} • Luggage: {luggageTier}</div>
                {passengerNotes && (
                  <div className="text-slate-600 italic pt-1 border-t border-slate-200/60 mt-1">
                    Note: "{passengerNotes}"
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 bg-emerald-50 rounded-xl text-emerald-800 text-[11px] font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Full refund if cancelled 24h prior to departure.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= 8. FIGMA FRAME: BOOKING CONFIRMED =================
  if (step === 'confirmed') {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 space-y-6">
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
            <Check className="w-8 h-8 stroke-[3]" />
          </div>

          <div className="space-y-1">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200 inline-block mb-1">
              Payment Verified (Test Mode)
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight">
              Booking confirmed!
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Your ride request is confirmed. We have sent the trip details to your account.
            </p>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 text-left space-y-3 text-xs border border-slate-100">
            <div className="flex justify-between items-center pb-2 border-b border-slate-200">
              <span className="text-slate-500 font-medium">Booking Reference</span>
              <span className="font-mono font-black text-slate-900 text-sm">{bookingRef}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Route</span>
              <span className="font-bold text-slate-900">{trip.origin} → {trip.destination}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Departure</span>
              <span className="font-bold text-slate-900">{trip.date} at {trip.departureTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Booked Seats</span>
              <span className="font-bold text-slate-900">{selectedSeatCount} {selectedSeatCount === 1 ? 'seat' : 'seats'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Driver</span>
              <span className="font-bold text-slate-900">{trip.driverName}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-900">Total Paid</span>
              <span className="font-black text-slate-950">₹{totalAmount}</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              onClick={() => onOpenChat(trip.driverId, trip.driverName)}
              className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <MessageSquare className="w-4 h-4" />
              <span>Message Driver</span>
            </button>
            <button
              onClick={() => onNavigateScreen('trips')}
              className="w-full sm:w-1/2 py-3.5 px-4 rounded-xl bg-[#F05A28] hover:bg-[#d84a1b] text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
            >
              <span>View in My Trips</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
