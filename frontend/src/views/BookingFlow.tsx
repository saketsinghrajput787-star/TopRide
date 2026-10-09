import React, { useState } from 'react';
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
  Users
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
  // Step: 1. seat & luggage -> 2. review & pay -> 3. confirmed
  const [step, setStep] = useState<'selection' | 'checkout' | 'confirmed'>('selection');

  // Booking selections
  const [selectedSeatCount, setSelectedSeatCount] = useState<number>(1);
  const [luggageTier, setLuggageTier] = useState<'small' | 'medium' | 'heavy'>('small');
  const [passengerNotes, setPassengerNotes] = useState<string>('');
  
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
  const seatOptions = Array.from({ length: maxAvailable }, (_, i) => i + 1);

  React.useEffect(() => {
    if (maxAvailable > 0 && selectedSeatCount > maxAvailable) {
      setSelectedSeatCount(maxAvailable);
    }
  }, [maxAvailable, selectedSeatCount]);

  // Categorize errors cleanly to distinguish seat conflicts (409) from Razorpay failures
  const categorizeError = (err: any): ActivePaymentError => {
    const status = err?.status;
    const msg = String(err?.message || err?.detail || '');
    
    // Seat conflict: 409 or explicit seats availability message
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

    // Driver self-booking
    if (
      msg.toLowerCase().includes('drivers cannot book') || 
      msg.toLowerCase().includes('own trip')
    ) {
      return {
        type: 'driver_self_booking',
        message: 'Drivers cannot book their own trip.',
      };
    }

    // Signature verification failure
    if (
      msg.toLowerCase().includes('verification failed') ||
      msg.toLowerCase().includes('signature')
    ) {
      return {
        type: 'verification_failed',
        message: 'Payment verification failed. Please try again.',
      };
    }

    // Payment failed or declined
    if (
      msg.toLowerCase().includes('payment failed') ||
      msg.toLowerCase().includes('declined')
    ) {
      return {
        type: 'payment_failed',
        message: 'Payment failed or was declined. Please try again.',
      };
    }

    // Generic API or network error
    return {
      type: 'generic',
      message: typeof err?.detail === 'string' ? err.detail : msg || 'Unable to proceed with checkout. Please try again.',
    };
  };

  // Retry payment verification in case of temporary verification error without re-charging
  const handleRetryVerification = async () => {
    if (!lastPaymentId || !lastOrderId) return;
    setIsProcessing(true);
    setPaymentError({ type: 'none' });
    try {
      const verifyResult = await api.verifyRazorpayPayment({
        tripId: trip.id,
        seatsCount: selectedSeatCount,
        luggageTier,
        passengerNotes,
        razorpayOrderId: lastOrderId,
        razorpayPaymentId: lastPaymentId,
        razorpaySignature: lastSignature,
      });

      const confirmedBooking = verifyResult.booking;
      setActiveOrder(null);
      setBookingRef(confirmedBooking.bookingRef);
      setIsProcessing(false);
      setStep('confirmed');
      onConfirmBooking(confirmedBooking.trip || trip, selectedSeatCount, totalAmount);
      showToast('Payment verified successfully! Booking confirmed.');
    } catch (err: any) {
      setIsProcessing(false);
      const classifiedError = categorizeError(err);
      setPaymentError(classifiedError);
      showToast(classifiedError.message);
    }
  };

  // Launch official Razorpay web checkout modal
  const handleLaunchRazorpayCheckout = async () => {
    // 1. Client-side self-booking validation
    if (currentUser.id === trip.driverId) {
      const errState: PaymentError = {
        type: 'driver_self_booking',
        message: 'Drivers cannot book their own trip.',
      };
      setPaymentError(errState);
      showToast('Drivers cannot book their own trip.');
      return;
    }

    // 2. Client-side seat availability validation
    if (trip.availableSeats < selectedSeatCount) {
      const errState: PaymentError = {
        type: 'seat_conflict',
        message: 'These seats are no longer available. Please select another seat.',
      };
      setPaymentError(errState);
      showToast('These seats are no longer available. Please select another seat.');
      return;
    }

    setIsProcessing(true);
    setPaymentError({ type: 'none' });
    setCheckoutDismissed(false);

    try {
      // 3. Ensure Razorpay Checkout SDK is ready
      const isLoaded = await ensureRazorpayLoaded();
      if (!isLoaded || !(window as any).Razorpay) {
        throw new Error('Razorpay Checkout SDK failed to load. Please verify your connection.');
      }

      // 4. Retrieve or create authentic Razorpay TEST order (prevents duplicate orders on repeated clicks)
      let orderData: PaymentOrderResponse;
      if (
        activeOrder && 
        activeOrder.tripId === trip.id && 
        activeOrder.seatsCount === selectedSeatCount &&
        activeOrder.amountRupees === totalAmount
      ) {
        orderData = activeOrder;
      } else {
        orderData = await api.createRazorpayOrder({
          tripId: trip.id,
          seatsCount: selectedSeatCount,
          luggageTier,
        });
        setActiveOrder(orderData);
      }

      setLastOrderId(orderData.orderId);

      // 5. Configure Razorpay Checkout options
      const keyId = orderData.keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_TkWmgK8HUmJJGn';

      const options = {
        key: keyId,
        amount: orderData.amount, // in paise
        currency: orderData.currency || 'INR',
        name: 'TopRide',
        description: `${trip.origin} → ${trip.destination} (${selectedSeatCount} ${selectedSeatCount === 1 ? 'seat' : 'seats'})`,
        order_id: orderData.orderId,
        prefill: {
          name: currentUser.name || 'TopRide Member',
          email: currentUser.email || 'passenger@topride.app',
          contact: currentUser.phone || '+919876543210',
        },
        theme: {
          color: '#F05A28', // TopRide brand orange
        },
        modal: {
          ondismiss: () => {
            setIsProcessing(false);
            setCheckoutDismissed(true);
            setPaymentError({
              type: 'checkout_cancelled',
              message: 'Payment checkout was cancelled.',
            });
            showToast('Payment checkout was cancelled.');
            api.recordPaymentStatus({
              orderId: orderData.orderId,
              status: 'cancelled',
              reason: 'User closed Razorpay modal',
            }).catch(() => {});
          },
          confirm_close: true,
        },
        handler: async (resp: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature?: string;
        }) => {
          setIsProcessing(true);
          const paymentId = resp.razorpay_payment_id;
          const orderId = resp.razorpay_order_id || orderData.orderId;
          const signature = resp.razorpay_signature || '';
          setLastPaymentId(paymentId);
          setLastOrderId(orderId);
          setLastSignature(signature);

          try {
            // 6. Authoritative backend signature verification & atomic booking
            const verifyResult = await api.verifyRazorpayPayment({
              tripId: trip.id,
              seatsCount: selectedSeatCount,
              luggageTier,
              passengerNotes,
              razorpayOrderId: orderId,
              razorpayPaymentId: paymentId,
              razorpaySignature: signature,
            });

            const confirmedBooking = verifyResult.booking;
            setActiveOrder(null);
            setBookingRef(confirmedBooking.bookingRef);
            setIsProcessing(false);
            setStep('confirmed');
            onConfirmBooking(confirmedBooking.trip || trip, selectedSeatCount, orderData.amountRupees);
            showToast('Payment verified successfully! Booking confirmed.');
          } catch (bookErr: any) {
            setIsProcessing(false);
            const classifiedError = categorizeError(bookErr);
            setPaymentError(classifiedError);
            showToast(classifiedError.message);
          }
        },
      };

      const rzpInstance = new (window as any).Razorpay(options);
      rzpInstance.on('payment.failed', (failResp: any) => {
        setIsProcessing(false);
        // Genuine Razorpay payment failure
        setPaymentError({
          type: 'payment_failed',
          message: 'Payment failed or was declined. Please try again.',
        });
        showToast('Payment failed or was declined. Please try again.');
        api.recordPaymentStatus({
          orderId: orderData.orderId,
          status: 'failed',
          paymentId: failResp?.error?.metadata?.payment_id,
          reason: failResp?.error?.description || 'Payment declined in Razorpay Test Mode',
        }).catch(() => {});
      });

      // Open official Razorpay Checkout modal
      rzpInstance.open();
    } catch (err: any) {
      setIsProcessing(false);
      const classifiedError = categorizeError(err);
      setPaymentError(classifiedError);
      showToast(classifiedError.message);
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
          {/* Seat count selector (Figma Frame 7 Stepper: [-] [N] [+]) */}
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

          {/* Luggage options */}
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
                    <div className="font-bold text-sm text-slate-900">1 Small bag / Cabin backpack</div>
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
              disabled={maxAvailable === 0}
              onClick={() => setStep('checkout')}
              className={`py-4 px-8 rounded-2xl font-bold text-sm transition-all shadow-sm flex items-center gap-2 ${
                maxAvailable > 0
                  ? 'bg-slate-950 hover:bg-slate-800 text-white cursor-pointer'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <span>Continue to payment</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= STEP 2: REVIEW & RAZORPAY TEST MODE CHECKOUT =================
  if (step === 'checkout') {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setStep('selection');
              setPaymentError({ type: 'none' });
            }}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Review & Pay</h1>
            <p className="text-xs text-slate-500">Official Razorpay Test Mode Checkout</p>
          </div>
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

            {/* 1. SEAT CONFLICT / 409 ERROR ALERT (Distinct from Razorpay failure) */}
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
                    setStep('selection');
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
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-900 text-sm">Payment Verification Issue</div>
                    <div className="text-rose-800 mt-0.5">{paymentError.message}</div>
                  </div>
                </div>
                {lastSignature && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleRetryVerification}
                    className="w-full py-2.5 px-4 bg-rose-900 hover:bg-rose-950 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Retrying verification...</span>
                      </span>
                    ) : (
                      <span>Retry Verification (No Re-charge)</span>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* 4. CHECKOUT CANCELLED ALERT */}
            {paymentError.type === 'checkout_cancelled' && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Checkout Cancelled</div>
                  <div className="text-amber-700 mt-0.5">{paymentError.message}</div>
                </div>
              </div>
            )}

            {/* 5. DRIVER SELF-BOOKING REJECTION */}
            {paymentError.type === 'driver_self_booking' && (
              <div className="p-4 bg-rose-50 border border-rose-300 rounded-2xl text-xs space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-rose-900 text-sm">Booking Not Allowed</div>
                    <div className="text-rose-800 mt-0.5">Drivers cannot book their own trip.</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateScreen('trip-details')}
                  className="w-full py-2.5 px-4 bg-rose-900 hover:bg-rose-950 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  Return to Trip Details
                </button>
              </div>
            )}

            {/* 6. GENERIC SERVER / NETWORK ERROR */}
            {paymentError.type === 'generic' && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="text-rose-800">{paymentError.message}</div>
                </div>
                {lastSignature && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={handleRetryVerification}
                    className="w-full py-2.5 px-4 bg-rose-900 hover:bg-rose-950 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Retrying verification...</span>
                      </span>
                    ) : (
                      <span>Retry Verification</span>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* CHECKOUT DISMISSED / CANCELLED ALERT */}
            {checkoutDismissed && paymentError.type === 'none' && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                <RotateCcw className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Checkout dismissed</div>
                  <div className="text-amber-700 mt-0.5">The payment modal was closed before completing. Click below to retry when ready.</div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 space-y-3">
              <button
                disabled={isProcessing || paymentError.type === 'seat_conflict' || paymentError.type === 'driver_self_booking'}
                onClick={handleLaunchRazorpayCheckout}
                className="w-full py-4 px-6 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    <span>Opening Razorpay Checkout...</span>
                  </span>
                ) : (
                  <span>Pay ₹{totalAmount} via Razorpay (Test Mode)</span>
                )}
              </button>

              <div className="flex items-center justify-center gap-2 text-[11px] text-slate-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Razorpay Test Sandbox • No real card charged</span>
              </div>
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
                <span>Seat Price ({selectedSeatCount} × ₹{effectiveUnitPrice})</span>
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
            Payment Confirmed (Razorpay Test Mode)
          </span>
          <h1 className="text-3xl font-black text-slate-950 tracking-tight">
            Your seat is reserved!
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Booking reference: <span className="font-mono font-bold text-slate-900">{bookingRef}</span>
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

          {/* Razorpay Test Order Details */}
          {(lastOrderId || lastPaymentId) && (
            <div className="pt-3 border-t border-slate-100 text-[11px] bg-slate-50 -mx-6 -mb-6 p-4 rounded-b-3xl space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <Receipt className="w-3.5 h-3.5 text-blue-600" />
                <span>Razorpay Test Transaction Details</span>
              </div>
              {lastOrderId && (
                <div className="flex justify-between text-slate-500 font-mono">
                  <span>Order ID:</span>
                  <span className="text-slate-800">{lastOrderId}</span>
                </div>
              )}
              {lastPaymentId && (
                <div className="flex justify-between text-slate-500 font-mono">
                  <span>Payment ID:</span>
                  <span className="text-slate-800">{lastPaymentId}</span>
                </div>
              )}
            </div>
          )}
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
