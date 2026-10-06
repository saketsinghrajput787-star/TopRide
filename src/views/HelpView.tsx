import React, { useState } from 'react';
import { faqList } from '../data/mockData';
import { ScreenId } from '../types';
import { 
  Search, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  MessageSquare, 
  Phone, 
  Mail, 
  ArrowLeft,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api';

interface HelpViewProps {
  onNavigateScreen: (screen: ScreenId) => void;
  showToast: (msg: string) => void;
}

export const HelpView: React.FC<HelpViewProps> = ({
  onNavigateScreen,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);
  const [issueCategory, setIssueCategory] = useState('Booking or cancellation query');
  const [ticketMessage, setTicketMessage] = useState('');
  const [ticketSubmitted, setTicketSubmitted] = useState(false);
  const [ticketRef, setTicketRef] = useState('TR-SUP-401');

  const filteredFaqs = faqList.filter((f) => {
    return (
      f.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.a.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleTicketSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createSupportTicket(issueCategory, ticketMessage);
      setTicketRef(res.ticketRef);
      setTicketSubmitted(true);
      showToast(`Support ticket #${res.ticketRef} submitted`);
    } catch (err) {
      setTicketSubmitted(true);
      showToast('Support ticket #TR-SUP-401 submitted');
    }
  };


  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => onNavigateScreen('account')}
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-950">Help & Support</h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Frequently asked questions, safety guidelines, and support tickets
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search help topics (e.g. luggage rules, refund, student discount)..."
          className="w-full pl-12 pr-4 py-4 rounded-2xl bg-white border border-slate-200 shadow-sm text-sm font-semibold focus:outline-hidden focus:border-slate-950"
        />
      </div>

      {/* Two Column Desktop Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* FAQs (7 cols) */}
        <div className="md:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900">Frequently Asked Questions</h2>

          <div className="divide-y divide-slate-100">
            {filteredFaqs.map((faq, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div key={idx} className="py-3">
                  <button
                    onClick={() => setOpenFaqIndex(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between text-left py-2 gap-3 cursor-pointer group"
                  >
                    <span className="font-bold text-xs sm:text-sm text-slate-900 group-hover:text-slate-700">
                      {faq.q}
                    </span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <p className="text-xs text-slate-600 leading-relaxed pt-1 pb-2">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contact Support Ticket Form (5 cols) */}
        <div className="md:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-slate-900" />
            <h2 className="text-base font-bold text-slate-900">Contact Support Team</h2>
          </div>

          {ticketSubmitted ? (
            <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
              <div className="font-bold text-xs text-emerald-900">Ticket #{ticketRef} Logged</div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                Our support team will respond to your registered email (demo@topride.app) within 2 business hours.
              </p>
              <button
                onClick={() => setTicketSubmitted(false)}
                className="mt-2 text-xs font-bold text-slate-900 underline cursor-pointer"
              >
                Send another message
              </button>
            </div>
          ) : (
            <form onSubmit={handleTicketSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Issue Topic
                </label>
                <select
                  value={issueCategory}
                  onChange={(e) => setIssueCategory(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden bg-white"
                >
                  <option value="Booking or cancellation query">Booking or cancellation query</option>
                  <option value="Payment / Refund issue">Payment / Refund issue</option>
                  <option value="Luggage shipment help">Luggage shipment help</option>
                  <option value="University verification help">University verification help</option>
                  <option value="Driver behavior report">Driver / Traveler feedback</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Describe your problem
                </label>
                <textarea
                  rows={4}
                  required
                  value={ticketMessage}
                  onChange={(e) => setTicketMessage(e.target.value)}
                  placeholder="Provide trip ID, date, or detailed issue..."
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs focus:outline-hidden"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
              >
                Submit support ticket
              </button>
            </form>
          )}

          <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <div className="flex items-center gap-2">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>support@topride.app</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>Toll Free: 1800-TOP-RIDE (24/7)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
