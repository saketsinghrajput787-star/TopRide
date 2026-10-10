import React, { useState, useEffect, useRef } from 'react';
import { Conversation, Message, User, ScreenId } from '../types';
import { 
  Send, 
  ShieldCheck, 
  Star, 
  ArrowLeft, 
  CheckCheck, 
  MessageSquare, 
  Search, 
  Plus, 
  User as UserIcon, 
  AlertTriangle, 
  ExternalLink,
  MapPin,
  Car
} from 'lucide-react';
import { TopRideLogo } from '../components/TopRideLogo';

interface InboxViewProps {
  conversations: Conversation[];
  activeConversationId?: string;
  currentUser: User;
  onSendMessage: (conversationId: string, text: string) => Promise<void> | void;
  onNavigateScreen: (screen: ScreenId) => void;
  showToast: (msg: string) => void;
}

export const InboxView: React.FC<InboxViewProps> = ({
  conversations,
  activeConversationId,
  currentUser,
  onSendMessage,
  onNavigateScreen,
  showToast,
}) => {
  const [selectedId, setSelectedId] = useState<string>(activeConversationId || '');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Synchronize with external activeConversationId or incoming list
  useEffect(() => {
    if (activeConversationId && conversations.some(c => c.id === activeConversationId)) {
      setSelectedId(activeConversationId);
    } else if (selectedId && !conversations.some(c => c.id === selectedId)) {
      setSelectedId('');
    }
  }, [activeConversationId, conversations]);

  // Find active conversation
  const activeConv = conversations.find((c) => c.id === selectedId);

  // Auto-scroll to bottom of message thread on new message
  useEffect(() => {
    if (activeConv) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeConv?.messages.length, selectedId]);

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || !activeConv || isSending) return;

    try {
      setIsSending(true);
      await onSendMessage(activeConv.id, text);
      // Clear input ONLY after accepted by backend
      setInputText('');
    } catch (err: any) {
      showToast(`Failed to send message: ${err?.message || 'Error'}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
      {/* ================= FIGMA FRAME 877:2228 TOP BAR (Mobile / Desktop) ================= */}
      <div className="flex items-center justify-between mb-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <TopRideLogo size="sm" showText={true} />

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateScreen('find')}
            className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Find</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateScreen('post-trip')}
            className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Post</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateScreen('account')}
            className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            title="Profile & Account"
          >
            <UserIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ================= MAIN CONTAINER ================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[640px] grid grid-cols-1 md:grid-cols-12">
        {/* ================= LEFT COLUMN: CONVERSATION LIST (Figma Frame 877:2228) ================= */}
        <div className={`md:col-span-5 border-r border-slate-200 flex flex-col ${selectedId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <h1 className="font-black text-2xl text-slate-950">Inbox</h1>
            {conversations.length > 0 && (
              <span className="text-xs text-slate-400 font-semibold">{conversations.length} {conversations.length === 1 ? 'chat' : 'chats'}</span>
            )}
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {conversations.length === 0 ? (
              /* Figma Frame 877:2228 Empty State: Prepare your TOP ride */
              <div className="p-4 sm:p-6 flex flex-col items-center justify-center my-auto">
                <div className="w-full bg-[#FFF9E6] border border-amber-200/70 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-xs relative overflow-hidden">
                  <div className="space-y-1 relative z-10">
                    <h3 className="font-black text-xl sm:text-2xl text-slate-950 tracking-tight">
                      Prepare your <span className="text-[#F05A28]">TOP</span> ride
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-600 max-w-xs mx-auto">
                      Your travel undertaking will be detailed here
                    </p>
                  </div>

                  {/* Visual Illustration: Traveler & Car */}
                  <div className="relative py-4 flex items-center justify-center">
                    <div className="w-24 h-24 rounded-full bg-amber-100/80 flex items-center justify-center">
                      <Car className="w-12 h-12 text-amber-600 stroke-[1.5]" />
                    </div>
                  </div>

                  {/* Figma Black Pill Button with Circle Arrow */}
                  <button
                    type="button"
                    onClick={() => onNavigateScreen('find')}
                    className="inline-flex items-center gap-2 py-3 px-6 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-all cursor-pointer shadow-md active:scale-95 mx-auto"
                  >
                    <span>Get started</span>
                    <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs">
                      ›
                    </span>
                  </button>
                </div>
              </div>
            ) : (
              /* Figma Conversation Items */
              conversations.map((c) => {
                const isSelected = c.id === selectedId;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={`p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                      isSelected ? 'bg-slate-100/90' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="relative shrink-0">
                      {c.partnerAvatar ? (
                        <img
                          src={c.partnerAvatar}
                          alt={c.partnerName}
                          className="w-12 h-12 rounded-full object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-slate-950 text-white font-black text-sm flex items-center justify-center shadow-xs">
                          {c.partnerInitials || c.partnerName.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="font-bold text-sm text-slate-900 truncate">{c.partnerName}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200/80">
                            {c.partnerRole}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 font-medium shrink-0 ml-1">
                          {c.lastMessageTime}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 font-semibold truncate mb-1">
                        {c.tripRoute}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs truncate ${c.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-500'}`}>
                          {c.lastMessage}
                        </p>
                        {/* Figma Solid Black Circular Unread Badge */}
                        {c.unreadCount > 0 && (
                          <span className="w-5 h-5 rounded-full bg-slate-950 text-white text-[10px] font-black flex items-center justify-center shrink-0">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: CHAT THREAD (Figma Frame 877:4162) ================= */}
        <div className={`md:col-span-7 flex flex-col h-[640px] ${!selectedId ? 'hidden md:flex' : 'flex'}`}>
          {activeConv ? (
            <>
              {/* Header: Partner info & Back button */}
              <div className="p-3 sm:p-4 border-b border-slate-200 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedId('')}
                    className="md:hidden w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer transition-colors"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    {activeConv.partnerInitials || activeConv.partnerName.slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900">{activeConv.partnerName}</span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>{activeConv.partnerRating}</span>
                      <span>•</span>
                      <span>{activeConv.partnerRole}</span>
                    </div>
                  </div>
                </div>

                {activeConv.tripId && (
                  <button
                    type="button"
                    onClick={() => onNavigateScreen('trip-details')}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1"
                  >
                    <span>Trip</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Figma Frame 877:4162 Trip Summary Banner with Route, Date, Green Price, and Seats */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs shrink-0">
                <div>
                  <span className="font-black text-slate-900 block text-sm">{activeConv.tripRoute}</span>
                  <span className="text-[11px] text-slate-500 font-medium">Regular corridor ride</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-black text-emerald-600 text-sm">₹650</span>
                  <span className="text-slate-400 text-[11px] font-semibold">3 seats</span>
                </div>
              </div>

              {/* Figma Frame 877:4162 Vibrant Orange CTA Button: Request to book */}
              <div className="px-4 pt-3 pb-1 bg-white shrink-0">
                <button
                  type="button"
                  onClick={() => onNavigateScreen('trip-details')}
                  className="w-full py-3 px-4 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] text-white font-bold text-xs sm:text-sm transition-all shadow-xs cursor-pointer active:scale-98 flex items-center justify-center gap-2"
                >
                  <span>Request to book</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Figma Frame 877:4162 Trip Description Box */}
              <div className="px-4 py-2 bg-white shrink-0">
                <div className="p-3 bg-slate-100/80 rounded-2xl border border-slate-200/60 text-xs space-y-1">
                  <span className="font-bold text-slate-800 block text-[11px]">
                    {activeConv.partnerName} wrote this trip description
                  </span>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Pickup locations along highway exits. Small to medium luggage accepted. Please arrive 10 minutes prior to departure.
                  </p>
                </div>
              </div>

              {/* Figma Frame 877:4162 Safety Alert Banner (Pastel Yellow) */}
              <div className="px-4 py-2 bg-amber-50 border-y border-amber-200/80 flex items-center gap-2 text-[11px] text-amber-900 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>To prevent scams and phishing, never message or pay outside TopRide.</span>
              </div>

              {/* Message Feed */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-[#F8F9FA]">
                {/* Figma Centered Date Divider */}
                <div className="flex items-center justify-center">
                  <span className="px-3 py-1 rounded-full bg-slate-200/80 text-slate-600 text-[10px] font-bold uppercase tracking-wider">
                    Today
                  </span>
                </div>

                {activeConv.messages.map((m) => {
                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${m.isMe ? 'items-end' : 'items-start'} space-y-1`}
                    >
                      <div
                        className={`max-w-[80%] sm:max-w-[70%] px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                          m.isMe
                            ? 'bg-[#F05A28] text-white rounded-2xl rounded-tr-xs shadow-xs font-medium'
                            : 'bg-white text-slate-900 border border-slate-200/80 rounded-2xl rounded-tl-xs shadow-xs'
                        }`}
                      >
                        {m.text}
                      </div>

                      <div className="flex items-center gap-1 text-[10px] text-slate-400 px-1">
                        <span>{m.timestamp}</span>
                        {m.isMe && <CheckCheck className="w-3 h-3 text-slate-400" />}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Figma Frame 877:4162 Input Composer Bar with Pin Icon */}
              <form
                onSubmit={handleSend}
                className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
              >
                <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus-within:border-[#F05A28] focus-within:bg-white transition-colors">
                  <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={inputText}
                    disabled={isSending}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Message to ${activeConv.partnerName.toLowerCase()}...`}
                    className="flex-1 bg-transparent text-xs sm:text-sm focus:outline-hidden text-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending}
                  className="w-11 h-11 rounded-2xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            /* Desktop Unselected Placeholder */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 stroke-1 mb-2 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">Select a conversation</p>
              <p className="text-xs text-slate-400 mt-1">Choose a conversation from the list to view trip messages</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
