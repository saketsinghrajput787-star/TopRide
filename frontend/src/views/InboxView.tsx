import React, { useState, useEffect } from 'react';
import { Conversation, Message, User, ScreenId } from '../types';
import { 
  Send, 
  Phone, 
  ShieldCheck, 
  Star, 
  ArrowLeft, 
  CheckCheck, 
  MessageSquare,
  Sparkles,
  Paperclip
} from 'lucide-react';

interface InboxViewProps {
  conversations: Conversation[];
  activeConversationId?: string;
  currentUser: User;
  onSendMessage: (conversationId: string, text: string) => void;
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
  const [selectedId, setSelectedId] = useState<string>(activeConversationId || conversations[0]?.id || '');
  const [inputText, setInputText] = useState('');

  // Keep selectedId synchronized with active conversation or incoming list
  useEffect(() => {
    if (activeConversationId && conversations.some(c => c.id === activeConversationId)) {
      setSelectedId(activeConversationId);
    } else if ((!selectedId || !conversations.some(c => c.id === selectedId)) && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [activeConversationId, conversations]);

  // Find active conversation
  const activeConv = conversations.find((c) => c.id === selectedId) || conversations[0];

  const quickReplies = [
    'I will be there in 5 mins',
    'Where is the exact pickup point?',
    'Near the main gate',
    'Perfect, thank you!',
  ];

  const handleSend = (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || !activeConv) return;
    onSendMessage(activeConv.id, text);
    setInputText('');
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden min-h-[640px] grid grid-cols-1 md:grid-cols-12">
        {/* ================= LEFT COLUMN: CONVERSATION LIST (4 cols on desktop) ================= */}
        <div className={`md:col-span-4 border-r border-slate-200 flex flex-col ${activeConv && selectedId ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h1 className="font-black text-lg text-slate-950">Messages</h1>
            <span className="text-xs text-slate-400 font-semibold">{conversations.length} conversations</span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {conversations.map((c) => {
              const isSelected = c.id === selectedId;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`p-4 flex items-start gap-3 transition-colors cursor-pointer ${
                    isSelected ? 'bg-slate-100/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full bg-slate-950 text-white font-black text-sm flex items-center justify-center shrink-0">
                      {c.partnerInitials}
                    </div>
                    {c.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-rose-500 rounded-full border-2 border-white"></span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-bold text-sm text-slate-900 truncate">{c.partnerName}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200 text-slate-700 font-bold">
                          {c.partnerRole}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-1">
                        {c.lastMessageTime}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 font-semibold truncate mb-1">
                      {c.tripRoute}
                    </div>

                    <p className={`text-xs truncate ${c.unreadCount > 0 ? 'font-bold text-slate-900' : 'text-slate-400'}`}>
                      {c.lastMessage}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ================= RIGHT COLUMN: ACTIVE CHAT THREAD (8 cols on desktop) ================= */}
        <div className={`md:col-span-8 flex flex-col h-[640px] ${!activeConv || !selectedId ? 'hidden md:flex' : 'flex'}`}>
          {activeConv ? (
            <>
              {/* Chat Header */}
              <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-white">
                <div className="flex items-center gap-3">
                  {/* Mobile Back to List Button */}
                  <button
                    onClick={() => setSelectedId('')}
                    className="md:hidden w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>

                  <div className="w-10 h-10 rounded-full bg-slate-950 text-white font-bold text-xs flex items-center justify-center">
                    {activeConv.partnerInitials}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-slate-900">{activeConv.partnerName}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold border border-slate-200">
                        {activeConv.partnerRole}
                      </span>
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                    <div className="text-xs text-slate-500">
                      ★ {activeConv.partnerRating} • {activeConv.tripRoute}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => showToast(`Calling ${activeConv.partnerName} simulated`)}
                    className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                    title="Simulate Call"
                  >
                    <Phone className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-[#f8fafc]">
                {activeConv.messages.map((m) => {
                  const partnerInitials = activeConv.partnerInitials || (m.senderName ? m.senderName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'TR');
                  const currentInitials = currentUser?.initials || (currentUser?.name ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() : 'ME');

                  return (
                    <div
                      key={m.id}
                      className={`flex items-end gap-2.5 ${m.isMe ? 'justify-end' : 'justify-start'}`}
                    >
                      {/* Incoming: Other participant avatar */}
                      {!m.isMe && (
                        <div
                          className="w-8 h-8 rounded-full bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0 mb-4 shadow-xs"
                          title={activeConv.partnerName}
                        >
                          {partnerInitials}
                        </div>
                      )}

                      <div className={`flex flex-col ${m.isMe ? 'items-end' : 'items-start'} max-w-[78%] sm:max-w-[70%]`}>
                        {/* Sender Label */}
                        <span className="text-[11px] font-semibold text-slate-500 mb-1 px-1">
                          {m.isMe ? (currentUser?.name ? `${currentUser.name} (You)` : 'You') : (m.senderName || activeConv.partnerName)}
                        </span>

                        {/* Bubble */}
                        <div
                          className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed ${
                            m.isMe
                              ? 'bg-slate-950 text-white rounded-tr-xs shadow-xs'
                              : 'bg-white text-slate-900 border border-slate-200 rounded-tl-xs shadow-xs'
                          }`}
                        >
                          {m.text}
                        </div>

                        {/* Timestamp & Status */}
                        <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 px-1">
                          <span>{m.timestamp}</span>
                          {m.isMe && <CheckCheck className="w-3 h-3 text-emerald-600" />}
                        </div>
                      </div>

                      {/* Outgoing: Current user avatar */}
                      {m.isMe && (
                        <div
                          className="w-8 h-8 rounded-full bg-slate-200 text-slate-800 font-bold text-[11px] flex items-center justify-center shrink-0 mb-4 shadow-xs"
                          title={currentUser?.name || 'You'}
                        >
                          {currentInitials}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Quick Reply Chips */}
              <div className="px-4 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {quickReplies.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    className="px-3 py-1 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Input Bar */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSend();
                }}
                className="p-3 sm:p-4 bg-white border-t border-slate-200 flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => showToast('Attachment simulated')}
                  className="w-10 h-10 rounded-xl bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm focus:outline-hidden focus:border-slate-950"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim()}
                  className="w-10 h-10 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <MessageSquare className="w-12 h-12 stroke-1 mb-2" />
              <p className="text-sm">Select a conversation to view chat</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
