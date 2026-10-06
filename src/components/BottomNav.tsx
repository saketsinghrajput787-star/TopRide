import React from 'react';
import { NavigationTab, ScreenId } from '../types';
import { Home, Search, Calendar, MessageSquare, User as UserIcon } from 'lucide-react';

interface BottomNavProps {
  currentTab: NavigationTab;
  currentScreen: ScreenId;
  onNavigateTab: (tab: NavigationTab) => void;
  unreadMessagesCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  currentTab,
  currentScreen,
  onNavigateTab,
  unreadMessagesCount,
}) => {
  // Hide bottom nav on specific immersive flows like checkout, chat thread, full wizard
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

  if (isAuthScreen) return null;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1 safe-area-pb">
      <div className="flex items-center justify-around h-15 max-w-md mx-auto">
        {/* Home */}
        <button
          onClick={() => onNavigateTab('home')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors cursor-pointer ${
            currentTab === 'home'
              ? 'text-slate-950 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Home className={`w-5 h-5 mb-0.5 ${currentTab === 'home' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[11px] leading-tight">Home</span>
        </button>

        {/* Find */}
        <button
          onClick={() => onNavigateTab('find')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors cursor-pointer ${
            currentTab === 'find'
              ? 'text-slate-950 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Search className={`w-5 h-5 mb-0.5 ${currentTab === 'find' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[11px] leading-tight">Find</span>
        </button>

        {/* Trips */}
        <button
          onClick={() => onNavigateTab('trips')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors cursor-pointer ${
            currentTab === 'trips'
              ? 'text-slate-950 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <Calendar className={`w-5 h-5 mb-0.5 ${currentTab === 'trips' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[11px] leading-tight">Trips</span>
        </button>

        {/* Inbox */}
        <button
          onClick={() => onNavigateTab('inbox')}
          className={`relative flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors cursor-pointer ${
            currentTab === 'inbox'
              ? 'text-slate-950 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <div className="relative">
            <MessageSquare className={`w-5 h-5 mb-0.5 ${currentTab === 'inbox' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
            {unreadMessagesCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1 py-0.2 bg-slate-900 text-white font-bold text-[9px] rounded-full">
                {unreadMessagesCount}
              </span>
            )}
          </div>
          <span className="text-[11px] leading-tight">Inbox</span>
        </button>

        {/* Account */}
        <button
          onClick={() => onNavigateTab('account')}
          className={`flex flex-col items-center justify-center flex-1 py-1 rounded-xl transition-colors cursor-pointer ${
            currentTab === 'account'
              ? 'text-slate-950 font-bold'
              : 'text-slate-500 hover:text-slate-800 font-medium'
          }`}
        >
          <UserIcon className={`w-5 h-5 mb-0.5 ${currentTab === 'account' ? 'stroke-[2.5]' : 'stroke-[1.75]'}`} />
          <span className="text-[11px] leading-tight">Account</span>
        </button>
      </div>
    </nav>
  );
};
