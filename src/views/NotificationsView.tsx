import React, { useState } from 'react';
import { NotificationItem, ScreenId } from '../types';
import { 
  Bell, 
  Check, 
  MessageSquare, 
  Calendar, 
  CreditCard, 
  Sparkles, 
  ArrowLeft,
  CheckCheck
} from 'lucide-react';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  onMarkAllRead: () => void;
  onSelectNotification: (item: NotificationItem) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  showToast: (msg: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  notifications,
  onMarkAllRead,
  onSelectNotification,
  onNavigateScreen,
  showToast,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filtered = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'booking':
        return <Calendar className="w-5 h-5 text-emerald-600" />;
      case 'chat':
        return <MessageSquare className="w-5 h-5 text-indigo-600" />;
      case 'payment':
        return <CreditCard className="w-5 h-5 text-amber-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-slate-700" />;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => onNavigateScreen('home')}
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-950">Notifications</h1>
            <p className="text-xs text-slate-500">Trip alerts, messages, and wallet updates</p>
          </div>
        </div>

        <button
          onClick={() => {
            onMarkAllRead();
            showToast('All notifications marked as read');
          }}
          className="text-xs font-bold text-slate-700 hover:text-slate-950 flex items-center gap-1 cursor-pointer"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Mark all read</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setFilter('all')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            filter === 'all' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            filter === 'unread' ? 'bg-white text-slate-950 shadow-xs' : 'text-slate-600'
          }`}
        >
          Unread
        </button>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 text-slate-400">
            <Bell className="w-10 h-10 mx-auto mb-2 stroke-1" />
            <p className="text-xs">No notifications to show</p>
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectNotification(item)}
              className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 ${
                !item.read
                  ? 'bg-white border-slate-300 shadow-xs'
                  : 'bg-slate-50/60 border-slate-200 opacity-80'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                {getIcon(item.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                    {item.title}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0 ml-2">{item.time}</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>

              {!item.read && (
                <span className="w-2 h-2 rounded-full bg-slate-950 mt-1 shrink-0"></span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
