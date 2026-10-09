import React from 'react';
import { NavigationTab, ScreenId, User } from '../types';
import { Bell, Plus, ArrowLeft, ShieldCheck } from 'lucide-react';
import { TopRideLogo } from './TopRideLogo';

interface NavbarProps {
  currentTab: NavigationTab;
  currentScreen: ScreenId;
  onNavigateTab: (tab: NavigationTab) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  onBack: () => void;
  unreadCount: number;
  unreadMessagesCount: number;
  user: User;
  canGoBack: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  currentScreen,
  onNavigateTab,
  onNavigateScreen,
  onBack,
  unreadCount,
  unreadMessagesCount,
  user,
  canGoBack,
}) => {
  // Determine if this is a subscreen where back button should be prominent on mobile
  const isRootTabScreen = ['home', 'find', 'trips', 'inbox', 'account'].includes(currentScreen);

  // Screen title for mobile header
  const getScreenTitle = (screen: ScreenId): string => {
    switch (screen) {
      case 'home': return 'TopRide';
      case 'find': return 'Find';
      case 'results': return 'Trip Results';
      case 'trip-details': return 'Trip Details';
      case 'booking': return 'Booking & Seats';
      case 'booking-confirmed': return 'Confirmed';
      case 'post-trip': return 'Post a Trip';
      case 'post-trip-review': return 'Review Trip';
      case 'post-request': return 'Post Request';
      case 'luggage': return 'Send Luggage';
      case 'luggage-results': return 'Luggage Travelers';
      case 'luggage-confirm': return 'Confirm Luggage';
      case 'trips': return 'My Trips';
      case 'inbox': return 'Inbox';
      case 'chat': return 'Chat';
      case 'account': return 'Account';
      case 'account-profile': return 'Personal Details';
      case 'account-vehicles': return 'My Vehicles';
      case 'account-add-vehicle': return 'Add Vehicle';
      case 'account-payments': return 'Payments & Payouts';
      case 'account-payout': return 'Request Payout';
      case 'account-id-verify': return 'ID Verification';
      case 'account-student': return 'Student Verification';
      case 'account-preferences': return 'Travel Preferences';
      case 'account-password': return 'Security';
      case 'account-language': return 'Language';
      case 'account-referrals': return 'Referrals';
      case 'account-close': return 'Close Account';
      case 'notifications': return 'Notifications';
      case 'help': return 'Help & Support';
      default: return 'TopRide';
    }
  };

  return (
    <>
      {/* ================= DESKTOP HEADER (md and up) ================= */}
      <header className="hidden md:block sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
          {/* Exact Figma Logo & Brand */}
          <div className="flex items-center gap-8">
            <button
              onClick={() => onNavigateTab('home')}
              className="flex items-center group cursor-pointer focus:outline-hidden"
              aria-label="TopRide Home"
            >
              <TopRideLogo size="md" showText={true} />
            </button>

            {/* Desktop Navigation Links */}
            <nav className="flex items-center gap-1">
              <button
                onClick={() => onNavigateTab('home')}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'home' && isRootTabScreen
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                Home
              </button>
              <button
                onClick={() => onNavigateTab('find')}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'find' || currentScreen === 'find' || currentScreen === 'results'
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                Find
              </button>
              <button
                onClick={() => onNavigateTab('trips')}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'trips' && isRootTabScreen
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                Trips
              </button>
              <button
                onClick={() => onNavigateTab('inbox')}
                className={`relative px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'inbox' || currentScreen === 'inbox' || currentScreen === 'chat'
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                Inbox
                {unreadMessagesCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-slate-900 text-white rounded-full">
                    {unreadMessagesCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => onNavigateTab('account')}
                className={`px-3.5 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                  currentTab === 'account'
                    ? 'bg-slate-100 text-slate-950'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                Account
              </button>
            </nav>
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigateScreen('post-trip')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-semibold text-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Post a trip</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={() => onNavigateScreen('notifications')}
              className="relative p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>

            {/* User Profile Pill */}
            <button
              onClick={() => onNavigateTab('account')}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center">
                {user.initials}
              </div>
              <span className="text-sm font-medium text-slate-800">{user.name.split(' ')[0]}</span>
              {user.isVerified && (
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ================= MOBILE HEADER (below md) ================= */}
      <header className="md:hidden sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 h-15 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {canGoBack && !isRootTabScreen ? (
            <button
              onClick={onBack}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-800 active:scale-95 transition-transform cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => onNavigateTab('home')}
              className="flex items-center gap-2 cursor-pointer focus:outline-hidden"
            >
              <TopRideLogo size="sm" />
            </button>
          )}

          {!isRootTabScreen && (
            <h1 className="text-base font-bold text-slate-900 truncate max-w-[190px]">
              {getScreenTitle(currentScreen)}
            </h1>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Icon */}
          <button
            onClick={() => onNavigateScreen('notifications')}
            className="relative w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 active:scale-95 transition-transform cursor-pointer"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white"></span>
            )}
          </button>

          {/* Quick Post button on root screens */}
          {isRootTabScreen && currentScreen !== 'account' && (
            <button
              onClick={() => onNavigateScreen('post-trip')}
              className="w-9 h-9 rounded-full bg-slate-900 text-white flex items-center justify-center active:scale-95 transition-transform cursor-pointer"
              aria-label="Post trip"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>
    </>
  );
};
