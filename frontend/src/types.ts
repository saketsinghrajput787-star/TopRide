export type NavigationTab = 'home' | 'find' | 'trips' | 'inbox' | 'account';

export type ScreenId = 
  | 'welcome'
  | 'onboard'
  | 'login'
  | 'signup'
  | 'verify-code'
  | 'age-verify'
  | 'profile-photo'
  | 'profile-bio'
  | 'profile-complete'
  | 'home'
  | 'find'
  | 'results'
  | 'trip-details'
  | 'booking'
  | 'booking-confirmed'
  | 'post-trip'
  | 'post-trip-review'
  | 'post-request'
  | 'luggage'
  | 'luggage-results'
  | 'luggage-confirm'
  | 'trips'
  | 'inbox'
  | 'chat'
  | 'account'
  | 'account-profile'
  | 'account-vehicles'
  | 'account-add-vehicle'
  | 'account-payments'
  | 'account-payout'
  | 'account-id-verify'
  | 'account-student'
  | 'account-preferences'
  | 'account-password'
  | 'account-language'
  | 'account-referrals'
  | 'account-close'
  | 'notifications'
  | 'help';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  initials: string;
  rating: number;
  tripsCount: number;
  isVerified: boolean;
  isStudentVerified: boolean;
  studentUniversity?: string;
  bio: string;
  joinedDate: string;
  availablePayout: number;
  accessToken?: string;
  refreshToken?: string;
}

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
  isDefault?: boolean;
}

export interface LocationData {
  name: string;
  formattedAddress?: string;
  latitude: number;
  longitude: number;
  placeId?: string;
}

export interface Trip {
  id: string;
  driverId: string;
  driverName: string;
  driverAvatar?: string;
  driverInitials: string;
  driverRating: number;
  driverTripsCount: number;
  driverIsVerified: boolean;
  origin: string;
  originDetail?: string;
  destination: string;
  destinationDetail?: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  totalSeats: number;
  availableSeats: number;
  pricePerSeat: number;
  currency: string;
  vehicle: Vehicle;
  luggageAllowed: 'None' | 'Small' | 'Medium' | 'Large';
  luggageDetails: string;
  instantBooking: boolean;
  tripRules: string[];
  stops?: string[];
  isPassengerTrip?: boolean; // if logged in user is passenger
  isDriverTrip?: boolean; // if logged in user is driver
  status: 'upcoming' | 'in-progress' | 'completed' | 'cancelled';
  bookedSeatCount?: number;
  totalPaid?: number;
  originLatitude?: number;
  originLongitude?: number;
  originPlaceId?: string;
  originAddress?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  destinationPlaceId?: string;
  destinationAddress?: string;
  routeGeometry?: any;
  basePrice?: number;
  currentMarketPrice?: number;
  pricingMetadata?: any;
  priceUpdatedAt?: string;
}

export interface PassengerRequest {
  id: string;
  passengerId: string;
  passengerName: string;
  passengerAvatar?: string;
  passengerInitials: string;
  passengerRating: number;
  origin: string;
  destination: string;
  date: string;
  timeWindow: string;
  seatsNeeded: number;
  budgetPerSeat: number;
  preferences: string[];
  status: 'active' | 'matched' | 'completed' | 'cancelled';
  notes?: string;
  originLatitude?: number;
  originLongitude?: number;
  originPlaceId?: string;
  originAddress?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  destinationPlaceId?: string;
  destinationAddress?: string;
}

export interface LuggagePackage {
  id: string;
  senderId?: string;
  senderName: string;
  senderAvatar?: string;
  senderInitials: string;
  origin: string;
  destination: string;
  date: string;
  size: 'Document' | 'Small (< 5kg)' | 'Medium (< 15kg)' | 'Large (< 25kg)';
  dimensions?: string;
  description: string;
  priceOffer: number;
  status: 'active' | 'in-transit' | 'delivered' | 'cancelled';
  receiverName?: string;
  receiverPhone?: string;
  originLatitude?: number;
  originLongitude?: number;
  originPlaceId?: string;
  originAddress?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  destinationPlaceId?: string;
  destinationAddress?: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: string;
  isMe: boolean;
  status?: 'sent' | 'delivered' | 'read';
}

export interface Conversation {
  id: string;
  tripId?: string;
  tripRoute: string;
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  partnerInitials: string;
  partnerRole: 'Driver' | 'Passenger' | 'Traveler';
  partnerRating: number;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  messages: Message[];
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  time: string;
  read: boolean;
  type: 'booking' | 'trip' | 'chat' | 'payment' | 'system';
  targetScreen?: ScreenId;
  targetId?: string;
}

export interface UniversityOption {
  id: string;
  name: string;
  domain: string;
  city: string;
  verifiedCount: number;
}

export interface PaymentOrderResponse {
  orderId: string;
  amount: number; // in paise for Razorpay
  amountRupees: number;
  currency: string;
  keyId: string;
  tripId: string;
  seatsCount: number;
  receipt: string;
}

export interface PaymentVerifyResponse {
  verified: boolean;
  booking: {
    id: string;
    bookingRef: string;
    trip?: Trip;
    seatsCount?: number;
    totalPaid?: number;
    priceAtBooking?: number;
    status?: string;
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
  };
  orderId: string;
  paymentId: string;
  status: string;
}

export interface FeatureBreakdown {
  route: number;
  pickup: number;
  drop: number;
  time: number;
  price: number;
  rating: number;
  vehicle: number;
}

export interface ScoringWeights {
  route: number;
  pickup: number;
  drop: number;
  time: number;
  price: number;
  rating: number;
  vehicle: number;
}

export interface FeatureRaw {
  pickup_distance_km: number;
  drop_distance_km: number;
  time_difference_minutes: number;
  price_difference: number;
  driver_average_rating: number;
  driver_rating_count: number;
  driver_is_new: boolean;
  vehicle_matched: boolean;
}

export interface CandidateMatch {
  trip_id: string;
  trip: Trip;
  match_score: number;
  breakdown: FeatureBreakdown;
  weights: ScoringWeights;
  raw: FeatureRaw;
  explanation: string;
  is_eligible: boolean;
}

export interface MatchingResponse {
  request_id: string;
  candidates: CandidateMatch[];
  total_candidates: number;
  best_match?: CandidateMatch | null;
  other_options?: CandidateMatch[];
  total_matches?: number;
  status: 'matched' | 'no_matches';
  message: string;
}

export interface AssignmentRequest {
  origin: string | LocationData;
  destination: string | LocationData;
  date: string;
  departure_time?: string;
  seats: number;
  budget?: number;
  vehicle_preference?: string;
  origin_latitude?: number;
  origin_longitude?: number;
  destination_latitude?: number;
  destination_longitude?: number;
  preferences?: string[];
  notes?: string;
  preferred_trip_id?: string;
  max_fallback_attempts?: number;
  luggage_tier?: 'small' | 'medium' | 'heavy';
  passenger_notes?: string;
}

export interface AssignmentResponse {
  assignment_id: string;
  status: 'assigned' | 'failed' | 'fallback_assigned';
  booking?: {
    id: string;
    bookingRef: string;
    trip: Trip;
    seatsCount: number;
    totalPaid: number;
    priceAtBooking?: number;
    status: string;
  };
  assigned_trip?: Trip;
  match_score?: number;
  breakdown?: FeatureBreakdown;
  attempts: number;
  fallback_used: boolean;
  message: string;
}

export interface PriceBreakdown {
  basePrice: number;
  demandCount: number;
  supplySeats: number;
  demandSupplyRatio: number;
  demandMultiplier: number;
  timeMultiplier: number;
  occupancyMultiplier: number;
  rawPrice: number;
  priceFloor: number;
  priceCeiling: number;
  finalPrice: number;
  explanation: string;
  marketSegment: string;
}

export interface PriceEstimateRequest {
  origin: string;
  destination: string;
  travelDate: string;
  departureTime: string;
  originLat?: number;
  originLon?: number;
  destLat?: number;
  destLon?: number;
  totalSeats?: number;
  availableSeats?: number;
  vehicleCategory?: string;
  durationStr?: string;
  routeGeometry?: any;
}


