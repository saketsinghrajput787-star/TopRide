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
