import { createClient } from '@supabase/supabase-js';
import { 
  User, Vehicle, Trip, PassengerRequest, LuggagePackage, 
  Conversation, Message, NotificationItem, UniversityOption 
} from './types';

// Supabase Client Initialization
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://jocpolzoovgpnbnhluoq.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__zePG8Nbo4XvSq-0QHmzwQ_HKhIOoRA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Backend API Base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  // Attach Supabase Access Token if available
  const authHeaders: Record<string, string> = {};
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) {
      authHeaders['Authorization'] = `Bearer ${session.access_token}`;
    }
  } catch (err) {
    console.warn('Could not read Supabase session:', err);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ detail: res.statusText }));
    const errorDetail = errorBody.detail || JSON.stringify(errorBody);
    console.error(`[TopRide API Error] HTTP ${res.status} | Endpoint: ${options.method || 'GET'} ${endpoint} | Body:`, errorBody);
    throw new Error(`[${res.status}] ${endpoint}: ${errorDetail}`);
  }
  return res.json();
}

export const api = {
  // Auth
  async signup(data: { name: string; email: string; password: string; phone?: string; bio?: string }): Promise<User> {
    // 1. Sign up directly with Supabase Auth to create auth.users entry
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          name: data.name,
          phone: data.phone || '',
        }
      }
    });

    if (authError) {
      throw new Error(authError.message || 'Sign up failed');
    }

    // 2. Ensure active session in browser
    if (!authData.session) {
      await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      }).catch(() => {});
    }

    // 3. Register user profile in backend / public.profiles
    return request<User>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async login(data: { email: string; password: string }): Promise<User> {
    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (authError || !authData.session) {
      throw new Error(authError?.message || 'Invalid email or password');
    }

    // 2. Fetch authoritative profile from backend
    const profile = await request<User>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    return profile;
  },

  async getMe(): Promise<User> {
    return request<User>('/api/auth/me');
  },

  // Profile
  async getProfile(): Promise<User> {
    return request<User>('/api/profile');
  },

  async updateProfile(updates: Partial<User>): Promise<User> {
    return request<User>('/api/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  },

  // Vehicles
  async listVehicles(): Promise<Vehicle[]> {
    return request<Vehicle[]>('/api/vehicles');
  },

  async addVehicle(vehicle: Omit<Vehicle, 'id'>): Promise<Vehicle> {
    return request<Vehicle>('/api/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicle),
    });
  },

  async deleteVehicle(id: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/vehicles/${id}`, {
      method: 'DELETE',
    });
  },

  // Trips
  async listTrips(): Promise<Trip[]> {
    return request<Trip[]>('/api/trips');
  },

  async getTrip(tripId: string): Promise<Trip> {
    return request<Trip>(`/api/trips/${tripId}`);
  },

  async searchTrips(params: {
    origin?: string;
    destination?: string;
    date?: string;
    onlyVerified?: boolean;
    onlyInstant?: boolean;
    maxPrice?: number;
    timeFilter?: string;
    sortBy?: string;
  }): Promise<Trip[]> {
    const query = new URLSearchParams();
    if (params.origin) query.append('origin', params.origin);
    if (params.destination) query.append('destination', params.destination);
    if (params.date) query.append('date', params.date);
    if (params.onlyVerified) query.append('onlyVerified', 'true');
    if (params.onlyInstant) query.append('onlyInstant', 'true');
    if (params.maxPrice) query.append('maxPrice', params.maxPrice.toString());
    if (params.timeFilter) query.append('timeFilter', params.timeFilter);
    if (params.sortBy) query.append('sortBy', params.sortBy);

    return request<Trip[]>(`/api/trips/search?${query.toString()}`);
  },

  async createTrip(tripData: any): Promise<Trip> {
    return request<Trip>('/api/trips', {
      method: 'POST',
      body: JSON.stringify(tripData),
    });
  },

  async cancelTrip(tripId: string, reason: string): Promise<any> {
    return request(`/api/trips/${tripId}/cancel?reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
    });
  },

  // Bookings with atomic seat reservation
  async createBooking(bookingData: {
    tripId: string;
    seatsCount: number;
    luggageTier: string;
    passengerNotes?: string;
    totalAmount: number;
    selectedSeatNumbers?: number[];
  }): Promise<{ id: string; bookingRef: string; trip?: Trip }> {
    return request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  async listBookings(asDriver: boolean = false): Promise<any[]> {
    return request<any[]>(`/api/bookings?as_driver=${asDriver}`);
  },

  async getBooking(bookingId: string): Promise<any> {
    return request<any>(`/api/bookings/${bookingId}`);
  },

  async cancelBooking(bookingId: string, reason: string = 'User cancelled'): Promise<any> {
    return request(`/api/bookings/${bookingId}/cancel?reason=${encodeURIComponent(reason)}`, {
      method: 'POST',
    });
  },

  // Passenger Requests
  async listRequests(): Promise<PassengerRequest[]> {
    return request<PassengerRequest[]>('/api/requests');
  },

  async listMyRequests(): Promise<PassengerRequest[]> {
    return request<PassengerRequest[]>('/api/requests/my');
  },

  async createRequest(reqData: any): Promise<PassengerRequest> {
    return request<PassengerRequest>('/api/requests', {
      method: 'POST',
      body: JSON.stringify(reqData),
    });
  },

  async cancelRequest(reqId: string): Promise<any> {
    return request(`/api/requests/${reqId}/cancel`, {
      method: 'POST',
    });
  },

  // Luggage
  async listLuggage(): Promise<LuggagePackage[]> {
    return request<LuggagePackage[]>('/api/luggage');
  },

  async listMyLuggage(): Promise<LuggagePackage[]> {
    return request<LuggagePackage[]>('/api/luggage/my');
  },

  async createLuggage(pkgData: any): Promise<LuggagePackage> {
    return request<LuggagePackage>('/api/luggage', {
      method: 'POST',
      body: JSON.stringify(pkgData),
    });
  },

  async cancelLuggage(pkgId: string): Promise<any> {
    return request(`/api/luggage/${pkgId}/cancel`, {
      method: 'POST',
    });
  },

  // Chat
  async listConversations(): Promise<Conversation[]> {
    return request<Conversation[]>('/api/conversations');
  },

  async getOrCreateConversation(partnerId: string, tripId?: string): Promise<Conversation> {
    return request<Conversation>('/api/conversations', {
      method: 'POST',
      body: JSON.stringify({ partnerId, tripId }),
    });
  },

  async sendMessage(convId: string, text: string): Promise<Message> {
    return request<Message>(`/api/conversations/${convId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ conversationId: convId, text }),
    });
  },

  async markConversationRead(convId: string): Promise<{ success: boolean }> {
    return request<{ success: boolean }>(`/api/conversations/${convId}/read`, {
      method: 'PUT',
    });
  },

  // Notifications
  async listNotifications(): Promise<NotificationItem[]> {
    return request<NotificationItem[]>('/api/notifications');
  },

  async markNotificationRead(notifId: string): Promise<void> {
    await request(`/api/notifications/${notifId}/read`, { method: 'PUT' });
  },

  async markAllNotificationsRead(): Promise<void> {
    await request('/api/notifications/read-all', { method: 'PUT' });
  },

  // Verification & Universities
  async listUniversities(): Promise<UniversityOption[]> {
    return request<UniversityOption[]>('/api/universities');
  },

  async verifyStudent(universityId: string, studentEmail: string): Promise<any> {
    return request('/api/verification/student', {
      method: 'POST',
      body: JSON.stringify({ universityId, studentEmail }),
    });
  },

  async verifyId(documentType: string): Promise<any> {
    return request('/api/verification/id', {
      method: 'POST',
      body: JSON.stringify({ documentType }),
    });
  },

  // Support
  async createSupportTicket(category: string, message: string): Promise<{ success: boolean; ticketRef: string }> {
    return request('/api/support/ticket', {
      method: 'POST',
      body: JSON.stringify({ category, message }),
    });
  },

  async listSupportTickets(): Promise<any[]> {
    return request<any[]>('/api/support/tickets');
  },

  // Payouts
  async requestPayout(amount: number, method: 'bank' | 'upi'): Promise<{ success: boolean; remainingPayout: number }> {
    return request('/api/payments/payout', {
      method: 'POST',
      body: JSON.stringify({ amount, method }),
    });
  },
};
