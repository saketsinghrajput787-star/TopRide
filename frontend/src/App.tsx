import React, { useState, useEffect } from 'react';
import { 
  NavigationTab, 
  ScreenId, 
  User, 
  Trip, 
  Vehicle, 
  PassengerRequest, 
  LuggagePackage, 
  Conversation, 
  NotificationItem 
} from './types';
import { 
  initialVehicles, 
  initialTrips, 
  initialPassengerRequests, 
  initialLuggagePackages, 
  universitiesList 
} from './data/mockData';
import { api, supabase } from './api';
import { Navbar } from './components/Navbar';
import { BottomNav } from './components/BottomNav';
import { AuthFlow } from './views/AuthFlow';
import { HomeView } from './views/HomeView';
import { FindView, SavedSearchState } from './views/FindView';
import { TripDetailsView } from './views/TripDetailsView';
import { BookingFlow } from './views/BookingFlow';
import { PostTripView } from './views/PostTripView';
import { PostRequestView } from './views/PostRequestView';
import { LuggageFlow } from './views/LuggageFlow';
import { TripsView } from './views/TripsView';
import { InboxView } from './views/InboxView';
import { AccountView } from './views/AccountView';
import { NotificationsView } from './views/NotificationsView';
import { HelpView } from './views/HelpView';

export function App() {
  // Navigation & Screen Stack
  const [currentScreen, setCurrentScreen] = useState<ScreenId>('welcome');
  const [currentTab, setCurrentTab] = useState<NavigationTab>('home');
  const [history, setHistory] = useState<ScreenId[]>([]);

  // Authentication & Session State (real Supabase session only, no mock user)
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);

  // Application Data States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [passengerRequests, setPassengerRequests] = useState<PassengerRequest[]>(initialPassengerRequests);
  const [luggagePackages, setLuggagePackages] = useState<LuggagePackage[]>(initialLuggagePackages);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Selected Entities
  const [selectedTrip, setSelectedTrip] = useState<Trip>(initialTrips[0]);
  const [selectedLuggage, setSelectedLuggage] = useState<LuggagePackage>(initialLuggagePackages[0]);
  const [activeChatConvId, setActiveChatConvId] = useState<string>('');

  // Search parameters forwarded from Home
  const [searchOrigin, setSearchOrigin] = useState('Bengaluru');
  const [searchDest, setSearchDest] = useState('Hyderabad');
  const [searchDate, setSearchDate] = useState('Sat, 10 Oct');
  const [searchMode, setSearchMode] = useState<'passenger' | 'driver' | 'luggage'>('passenger');
  const [savedSearchState, setSavedSearchState] = useState<SavedSearchState | null>(null);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Load initial data and verify Supabase session on startup
  useEffect(() => {
    async function fetchBackendData() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('[TopRide Auth Trace @ App Mount] session exists:', !!session, {
          userId: session?.user?.id || 'none',
          userEmail: session?.user?.email || 'none',
          hasAccessToken: !!session?.access_token,
        });
        
        // If user is authenticated, load their real profile and conversations
        if (session?.user) {
          try {
            const profile = await api.getProfile();
            if (profile && profile.id) {
              setUser(profile);
              setCurrentScreen('home');
              const [v, c, n] = await Promise.allSettled([
                api.listVehicles(),
                api.listConversations(),
                api.listNotifications()
              ]);
              if (v.status === 'fulfilled' && v.value) setVehicles(v.value);
              if (c.status === 'fulfilled' && c.value) {
                setConversations(c.value);
                if (c.value.length > 0) setActiveChatConvId(c.value[0].id);
              }
              if (n.status === 'fulfilled' && n.value) setNotifications(n.value);
            } else {
              setUser(null);
              setCurrentScreen('welcome');
            }
          } catch (e) {
            console.warn('Could not load profile for active session:', e);
            setUser(null);
            setCurrentScreen('welcome');
          }
        } else {
          setUser(null);
          setCurrentScreen('welcome');
          setConversations([]);
        }

        // Browse / Public trip data
        const [t, r, l] = await Promise.allSettled([
          api.listTrips(),
          api.listRequests(),
          api.listLuggage()
        ]);
        if (t.status === 'fulfilled' && t.value) {
          setTrips(t.value);
          if (t.value.length > 0) {
            setSelectedTrip(t.value[0]);
          }
        }
        if (r.status === 'fulfilled' && r.value && r.value.length > 0) setPassengerRequests(r.value);
        if (l.status === 'fulfilled' && l.value && l.value.length > 0) {
          setLuggagePackages(l.value);
          setSelectedLuggage(l.value[0]);
        }
      } catch (err) {
        console.warn('Backend data loaded with fallback:', err);
        setUser(null);
        setCurrentScreen('welcome');
      } finally {
        setIsAuthLoading(false);
      }
    }
    fetchBackendData();

    // Supabase Realtime channel for live updates
    const channel = supabase
      .channel('topride-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        api.listConversations().then(setConversations).catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        api.listNotifications().then(setNotifications).catch(() => {});
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => {
        api.listTrips().then(setTrips).catch(() => {});
      })
      .subscribe();

    // Supabase Auth listener for INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, SIGNED_OUT
    const authScreens = ['welcome', 'onboard', 'login', 'signup', 'verify-code', 'age-verify', 'profile-photo', 'profile-bio', 'profile-complete'];
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[TopRide Auth Trace @ onAuthStateChange] event:', event, {
        sessionExists: !!session,
        userId: session?.user?.id || 'none',
        userEmail: session?.user?.email || 'none',
        hasAccessToken: !!session?.access_token,
      });

      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        try {
          const profile = await api.getProfile();
          if (profile && profile.id) {
            setUser(profile);
            setCurrentScreen((prev) => (authScreens.includes(prev) ? 'home' : prev));
            const [userConvs, userVehs, userNotifs] = await Promise.allSettled([
              api.listConversations(),
              api.listVehicles(),
              api.listNotifications()
            ]);
            if (userConvs.status === 'fulfilled' && userConvs.value) {
              setConversations(userConvs.value);
              if (userConvs.value.length > 0) setActiveChatConvId(userConvs.value[0].id);
            }
            if (userVehs.status === 'fulfilled' && userVehs.value) setVehicles(userVehs.value);
            if (userNotifs.status === 'fulfilled' && userNotifs.value) setNotifications(userNotifs.value);
          }
        } catch (e) {
          console.warn('Auth state change error:', e);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setVehicles([]);
        setConversations([]);
        setActiveChatConvId('');
        setNotifications([]);
        setCurrentScreen('welcome');
      }
    });

    return () => {
      supabase.removeChannel(channel);
      subscription.unsubscribe();
    };
  }, []);


  // Browser History synchronization (popstate listener for browser Back/Forward navigation)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.history.replaceState({ screen: currentScreen }, '');

      const handlePopState = (event: PopStateEvent) => {
        if (event.state && event.state.screen) {
          setCurrentScreen(event.state.screen);
          setHistory((prev) => prev.slice(0, -1));
        } else {
          setCurrentScreen('home');
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, []);

  // Navigate to screen with history tracking
  const navigateScreen = (screen: ScreenId) => {
    if (screen !== currentScreen) {
      if (typeof window !== 'undefined') {
        window.history.pushState({ screen }, '');
      }
      setHistory((prev) => [...prev, currentScreen]);
      setCurrentScreen(screen);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Back button handler
  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.state && history.length > 0) {
      window.history.back();
    } else if (history.length > 0) {
      const prev = history[history.length - 1];
      setHistory((h) => h.slice(0, -1));
      setCurrentScreen(prev);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      setCurrentScreen('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Navigate Tab
  const navigateTab = (tab: NavigationTab) => {
    setCurrentTab(tab);
    switch (tab) {
      case 'home':
        navigateScreen('home');
        break;
      case 'find':
        navigateScreen('find');
        break;
      case 'trips':
        navigateScreen('trips');
        break;
      case 'inbox':
        navigateScreen('inbox');
        break;
      case 'account':
        navigateScreen('account');
        break;
    }
  };

  // Quick search from Home hero
  const handleQuickSearch = (origin: string, dest: string, date: string, mode: 'passenger' | 'driver' | 'luggage') => {
    setSearchOrigin(origin);
    setSearchDest(dest);
    setSearchDate(date);
    setSearchMode(mode);
    setCurrentTab('find');
    navigateScreen('find');
  };

  // Select Trip to View
  const handleSelectTrip = async (trip: Trip) => {
    try {
      const freshTrip = await api.getTrip(trip.id);
      setSelectedTrip(freshTrip);
    } catch {
      setSelectedTrip(trip);
    }
    navigateScreen('trip-details');
  };

  // Start Booking Flow
  const handleBookNow = (trip: Trip) => {
    setSelectedTrip(trip);
    navigateScreen('booking');
  };

  // Confirm Booking
  const handleConfirmBooking = async (bookedTrip: Trip, seatCount: number, totalPaid: number) => {
    // Update trips list locally & notify
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === bookedTrip.id) {
          return {
            ...t,
            availableSeats: Math.max(0, t.availableSeats - seatCount),
            isPassengerTrip: true,
            bookedSeatCount: seatCount,
            totalPaid,
          };
        }
        return t;
      })
    );

    // Also update selectedTrip state
    setSelectedTrip((prev) => {
      if (prev.id === bookedTrip.id) {
        return {
          ...prev,
          availableSeats: Math.max(0, prev.availableSeats - seatCount),
          isPassengerTrip: true,
          bookedSeatCount: seatCount,
          totalPaid,
        };
      }
      return prev;
    });

    // Also update savedSearchState if it includes this trip
    setSavedSearchState((prev) => {
      if (!prev) return null;
      const updatedBest = prev.bestMatch && prev.bestMatch.trip.id === bookedTrip.id
        ? { ...prev.bestMatch, trip: { ...prev.bestMatch.trip, availableSeats: Math.max(0, prev.bestMatch.trip.availableSeats - seatCount) } }
        : prev.bestMatch;
      const updatedOthers = prev.otherOptions.map((opt) =>
        opt.trip.id === bookedTrip.id
          ? { ...opt, trip: { ...opt.trip, availableSeats: Math.max(0, opt.trip.availableSeats - seatCount) } }
          : opt
      );
      return {
        ...prev,
        bestMatch: updatedBest,
        otherOptions: updatedOthers,
      };
    });

    // Add notification
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: 'Booking Confirmed!',
      description: `${bookedTrip.origin} → ${bookedTrip.destination} (${seatCount} seat) confirmed for ${bookedTrip.date}. ₹${totalPaid} paid.`,
      time: 'Just now',
      read: false,
      type: 'booking',
      targetScreen: 'trips',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Open Chat with Driver
  const handleOpenChat = async (driverId: string, driverName: string) => {
    try {
      const conv = await api.getOrCreateConversation(driverId);
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== conv.id);
        return [conv, ...filtered];
      });
      setActiveChatConvId(conv.id);
      navigateScreen('inbox');
    } catch (err) {
      console.warn('Opening chat fallback:', err);
      let existingConv = conversations.find((c) => c.partnerId === driverId);
      if (!existingConv) {
        existingConv = {
          id: `conv_${driverId}`,
          partnerId: driverId,
          partnerName: driverName,
          partnerInitials: driverName.split(' ').map((n) => n[0]).join('').slice(0, 2),
          partnerRole: 'Driver',
          partnerRating: 4.9,
          tripRoute: `${selectedTrip.origin} → ${selectedTrip.destination}`,
          lastMessage: 'Conversation started',
          lastMessageTime: 'Just now',
          unreadCount: 0,
          messages: [],
        };
        setConversations((prev) => [existingConv!, ...prev]);
      }
      setActiveChatConvId(existingConv.id);
      navigateScreen('inbox');
    }
  };

  // Send message
  const handleSendMessage = async (conversationId: string, text: string) => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('[TopRide Auth Trace] 1. supabase.auth.getSession() call completed, error:', sessionError);
      console.log('[TopRide Auth Trace] 2. session exists:', !!session);
      console.log('[TopRide Auth Trace] 3. session.user.id:', session?.user?.id || 'NO_USER_ID');
      console.log('[TopRide Auth Trace] 4. session.user.email:', session?.user?.email || 'NO_USER_EMAIL');
      console.log('[TopRide Auth Trace] 5. whether access_token exists:', !!session?.access_token);
      console.log('[TopRide Auth Trace] 6. App current authenticated user state:', {
        id: user?.id,
        name: user?.name,
        email: user?.email,
      });
      console.log('[TopRide Auth Trace] 7. exact condition check (!session):', !session, !session ? '-> Triggers "Please log in to send messages"' : '-> Proceeds with api.sendMessage');

      if (!session) {
        showToast('Please log in to send messages');
        navigateScreen('login');
        return;
      }
      const savedMsg = await api.sendMessage(conversationId, text);
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId) {
            return {
              ...c,
              lastMessage: text,
              lastMessageTime: 'Just now',
              messages: [...c.messages, savedMsg],
            };
          }
          return c;
        })
      );
    } catch (err: any) {
      console.error('[TopRide Chat Send Error]:', err);
      showToast(`Send failed: ${err.message || 'API error'}`);
    }
  };

  // Post Trip
  const handlePublishTrip = async (newTrip: any) => {
    try {
      const created = await api.createTrip(newTrip);
      setTrips((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
      setSelectedTrip(created);
    } catch (err: any) {
      console.error('Publish trip error:', err);
      showToast(err.message || 'Failed to publish trip');
      throw err;
    }

    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: 'Drive Published',
      description: `Your drive ${newTrip.origin} → ${newTrip.destination} is live on TopRide.`,
      time: 'Just now',
      read: false,
      type: 'trip',
      targetScreen: 'trips',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Post Request
  const handlePublishRequest = async (newReq: PassengerRequest) => {
    try {
      const created = await api.createRequest(newReq);
      setPassengerRequests((prev) => [created, ...prev]);
      const newNotif: NotificationItem = {
        id: `notif_${Date.now()}`,
        title: 'Ride Request Published',
        description: `Your ride request for ${created.origin} → ${created.destination} is live on TopRide.`,
        time: 'Just now',
        read: false,
        type: 'trip',
        targetScreen: 'find',
      };
      setNotifications((prev) => [newNotif, ...prev]);
    } catch (err) {
      setPassengerRequests((prev) => [newReq, ...prev]);
    }
  };

  // Confirm Luggage
  const handleConfirmLuggage = async (newPkg: LuggagePackage) => {
    try {
      const created = await api.createLuggage(newPkg);
      setLuggagePackages((prev) => [created, ...prev]);
      const newNotif: NotificationItem = {
        id: `notif_${Date.now()}`,
        title: 'Luggage Request Submitted',
        description: `Your package delivery request for ${created.origin} → ${created.destination} is active.`,
        time: 'Just now',
        read: false,
        type: 'trip',
        targetScreen: 'trips',
      };
      setNotifications((prev) => [newNotif, ...prev]);
    } catch (err) {
      setLuggagePackages((prev) => [newPkg, ...prev]);
    }
  };

  // Cancel Trip / Booking
  const handleCancelTrip = async (tripId: string, reason: string) => {
    const targetTrip = trips.find((t) => t.id === tripId);
    try {
      if (targetTrip?.isDriverTrip) {
        await api.cancelTrip(tripId, reason);
        showToast('Trip cancelled successfully.');
      } else {
        // Find passenger booking for this trip
        const bookings = await api.listBookings(false).catch(() => []);
        const activeBooking = bookings.find((b: any) => b.tripId === tripId && b.bookingStatus !== 'cancelled');
        if (activeBooking) {
          await api.cancelBooking(activeBooking.id, reason);
          showToast('Reservation cancelled. Full refund initiated.');
        } else {
          await api.cancelTrip(tripId, reason);
          showToast('Reservation cancelled.');
        }
      }
    } catch (err: any) {
      console.warn('API cancel trip fallback:', err);
      showToast(err?.message || 'Cancelled successfully.');
    }

    const releasedSeats = targetTrip?.bookedSeatCount || 1;
    setTrips((prev) =>
      prev.map((t) => {
        if (t.id === tripId) {
          return {
            ...t,
            status: targetTrip?.isDriverTrip ? 'cancelled' : t.status,
            isPassengerTrip: false,
            availableSeats: !targetTrip?.isDriverTrip ? t.availableSeats + releasedSeats : 0,
          };
        }
        return t;
      })
    );

    setSelectedTrip((prev) => {
      if (prev.id === tripId) {
        return {
          ...prev,
          status: targetTrip?.isDriverTrip ? 'cancelled' : prev.status,
          isPassengerTrip: false,
          availableSeats: !targetTrip?.isDriverTrip ? prev.availableSeats + releasedSeats : 0,
        };
      }
      return prev;
    });

    setSavedSearchState((prev) => {
      if (!prev) return null;
      const updatedBest = prev.bestMatch && prev.bestMatch.trip.id === tripId
        ? { ...prev.bestMatch, trip: { ...prev.bestMatch.trip, availableSeats: !targetTrip?.isDriverTrip ? prev.bestMatch.trip.availableSeats + releasedSeats : 0 } }
        : prev.bestMatch;
      const updatedOthers = prev.otherOptions.map((opt) =>
        opt.trip.id === tripId
          ? { ...opt, trip: { ...opt.trip, availableSeats: !targetTrip?.isDriverTrip ? opt.trip.availableSeats + releasedSeats : 0 } }
          : opt
      );
      return {
        ...prev,
        bestMatch: updatedBest,
        otherOptions: updatedOthers,
      };
    });
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: targetTrip?.isDriverTrip ? 'Trip Cancelled' : 'Reservation Cancelled',
      description: targetTrip?.isDriverTrip 
        ? `You cancelled your trip. Passengers have been notified and refunds initiated. Reason: ${reason}`
        : `Your reservation has been cancelled. Full refund initiated. Reason: ${reason}`,
      time: 'Just now',
      read: false,
      type: 'payment',
      targetScreen: 'trips',
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Request Payout
  const handleRequestPayout = async (amount: number, method: string = 'bank') => {
    try {
      await api.requestPayout(amount, method === 'upi' ? 'upi' : 'bank');
    } catch (err) {
      console.warn('API payout fallback:', err);
    }

    setUser((prev) => prev ? ({
      ...prev,
      availablePayout: 0,
    }) : null);
  };

  // Mark all notifications read
  const handleMarkAllRead = async () => {
    try {
      await api.markAllNotificationsRead();
    } catch (err) {
      console.warn('API mark read fallback:', err);
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };


  const isAuthScreen = [
    'welcome',
    'onboard',
    'login',
    'signup',
    'verify-code',
    'age-verify',
    'profile-photo',
    'profile-bio',
    'profile-complete',
  ].includes(currentScreen);

  const unreadNotifsCount = notifications.filter((n) => !n.read).length;
  const unreadMessagesCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-slate-950 text-white font-black text-sm flex items-center justify-center animate-pulse shadow-md">
            TOP
          </div>
          <span className="text-xs font-semibold text-slate-400">Connecting to TopRide...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] text-[#17202a]">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-slate-950 text-white px-5 py-3 rounded-2xl shadow-xl border border-slate-800 text-xs sm:text-sm font-bold flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Top Header Navbar (Hidden on full auth flows) */}
      {!isAuthScreen && user && (
        <Navbar
          currentTab={currentTab}
          currentScreen={currentScreen}
          onNavigateTab={navigateTab}
          onNavigateScreen={navigateScreen}
          onBack={handleBack}
          unreadCount={unreadNotifsCount}
          unreadMessagesCount={unreadMessagesCount}
          user={user}
          canGoBack={history.length > 0}
        />
      )}

      {/* Content Body */}
      <main className={`flex-1 ${!isAuthScreen ? 'pb-24 md:pb-12' : ''}`}>
        {/* 1. AUTH & ONBOARDING */}
        {isAuthScreen && (
          <AuthFlow
            currentScreen={currentScreen}
            onNavigateScreen={navigateScreen}
            onCompleteAuth={(updates) => {
              setUser(updates as User);
              api.listConversations().then((c) => {
                if (c) {
                  setConversations(c);
                  if (c.length > 0) setActiveChatConvId(c[0].id);
                }
              }).catch(() => {});
              api.listVehicles().then(setVehicles).catch(() => {});
              setCurrentScreen('home');
              setCurrentTab('home');
            }}
            showToast={showToast}
          />
        )}

        {/* 2. HOME */}
        {currentScreen === 'home' && user && (
          <HomeView
            user={user}
            activeTrips={trips}
            onNavigateScreen={navigateScreen}
            onSelectTrip={handleSelectTrip}
            onQuickSearch={handleQuickSearch}
          />
        )}

        {/* 3. FIND & SEARCH */}
        {(currentScreen === 'find' || currentScreen === 'results') && (
          <FindView
            initialOrigin={searchOrigin}
            initialDestination={searchDest}
            initialDate={searchDate}
            initialMode={searchMode}
            savedSearchState={savedSearchState}
            onSaveSearchState={setSavedSearchState}
            trips={trips}
            passengerRequests={passengerRequests}
            luggagePackages={luggagePackages}
            onSelectTrip={handleSelectTrip}
            onSelectLuggage={(pkg) => {
              setSelectedLuggage(pkg);
              navigateScreen('luggage-confirm');
            }}
            onNavigateScreen={navigateScreen}
            showToast={showToast}
          />
        )}

        {/* 4. TRIP DETAILS */}
        {currentScreen === 'trip-details' && (
          <TripDetailsView
            trip={selectedTrip}
            onBookNow={handleBookNow}
            onOpenChat={handleOpenChat}
            onNavigateScreen={navigateScreen}
          />
        )}

        {/* 5. BOOKING & CHECKOUT */}
        {(currentScreen === 'booking' || currentScreen === 'booking-confirmed') && user && (
          <BookingFlow
            trip={selectedTrip}
            currentUser={user}
            onConfirmBooking={handleConfirmBooking}
            onNavigateScreen={navigateScreen}
            onOpenChat={handleOpenChat}
            showToast={showToast}
          />
        )}

        {/* 6. POST TRIP (Driver) */}
        {(currentScreen === 'post-trip' || currentScreen === 'post-trip-review') && user && (
          <PostTripView
            vehicles={vehicles}
            currentUser={user}
            onPublishTrip={handlePublishTrip}
            onNavigateScreen={navigateScreen}
            showToast={showToast}
          />
        )}

        {/* 7. POST REQUEST (Passenger) */}
        {currentScreen === 'post-request' && user && (
          <PostRequestView
            currentUser={user}
            onPublishRequest={handlePublishRequest}
            onNavigateScreen={navigateScreen}
            showToast={showToast}
          />
        )}

        {/* 8. LUGGAGE FLOW */}
        {(currentScreen === 'luggage' || currentScreen === 'luggage-results' || currentScreen === 'luggage-confirm') && user && (
          <LuggageFlow
            currentUser={user}
            onConfirmLuggage={handleConfirmLuggage}
            onNavigateScreen={navigateScreen}
            showToast={showToast}
          />
        )}

        {/* 9. TRIPS */}
        {currentScreen === 'trips' && (
          <TripsView
            trips={trips}
            luggagePackages={luggagePackages}
            onSelectTrip={handleSelectTrip}
            onCancelTrip={handleCancelTrip}
            onNavigateScreen={navigateScreen}
            showToast={showToast}
          />
        )}

        {/* 10. INBOX & CHAT */}
        {(currentScreen === 'inbox' || currentScreen === 'chat') && user && (
          <InboxView
            conversations={conversations}
            activeConversationId={activeChatConvId}
            currentUser={user}
            onSendMessage={handleSendMessage}
            onNavigateScreen={navigateScreen}
            showToast={showToast}
          />
        )}

        {/* 11. ACCOUNT & SUBSECTIONS */}
        {currentScreen.startsWith('account') && user && (
          <AccountView
            user={user}
            vehicles={vehicles}
            universities={universitiesList}
            currentScreen={currentScreen}
            onUpdateUser={async (updates) => {
              try {
                const res = await api.updateProfile(updates);
                setUser(res);
              } catch (err) {
                setUser((prev) => (prev ? { ...prev, ...updates } : null));
              }
            }}
            onAddVehicle={async (newVeh) => {
              try {
                const res = await api.addVehicle(newVeh);
                setVehicles((prev) => [res, ...prev]);
              } catch (err) {
                setVehicles((prev) => [newVeh, ...prev]);
              }
            }}
            onDeleteVehicle={async (vehId) => {
              try {
                await api.deleteVehicle(vehId);
              } catch (err) {
                console.warn(err);
              }
              setVehicles((prev) => prev.filter((v) => v.id !== vehId));
            }}
            onRequestPayout={handleRequestPayout}
            onNavigateScreen={navigateScreen}
            onLogout={async () => {
              try {
                await supabase.auth.signOut();
              } catch (err) {
                console.warn('Sign out error:', err);
              }
              setUser(null);
              setConversations([]);
              setActiveChatConvId('');
              navigateScreen('welcome');
              showToast('Logged out of TopRide');
            }}
            showToast={showToast}
          />
        )}

        {/* 12. NOTIFICATIONS */}
        {currentScreen === 'notifications' && (
          <NotificationsView
            notifications={notifications}
            onMarkAllRead={handleMarkAllRead}
            onSelectNotification={(item) => {
              if (item.targetScreen) navigateScreen(item.targetScreen);
              api.markNotificationRead(item.id).catch(() => {});
              setNotifications((prev) =>
                prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
              );
            }}
            onNavigateScreen={navigateScreen}
            showToast={showToast}
          />
        )}

        {/* 13. HELP & SUPPORT */}
        {currentScreen === 'help' && (
          <HelpView
            onNavigateScreen={navigateScreen}
            showToast={showToast}
          />
        )}
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {!isAuthScreen && user && (
        <BottomNav
          currentTab={currentTab}
          currentScreen={currentScreen}
          onNavigateTab={navigateTab}
          unreadMessagesCount={unreadMessagesCount}
        />
      )}
    </div>
  );
}

export default App;
