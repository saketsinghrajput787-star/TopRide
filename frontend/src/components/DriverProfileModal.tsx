import React from 'react';
import { X, Star, ShieldCheck, MapPin, Calendar, Award } from 'lucide-react';

interface DriverProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  driverName: string;
  driverRating?: number;
  driverTripsCount?: number;
  driverBio?: string;
  driverAvatar?: string;
  isVerified?: boolean;
}

export const DriverProfileModal: React.FC<DriverProfileModalProps> = ({
  isOpen,
  onClose,
  driverName,
  driverRating = 4.9,
  driverTripsCount = 20,
  driverBio = 'Exceptional driver with a keen sense of navigation. I enjoy traveling and meeting new people on long distance trips.',
  driverAvatar,
  isVerified = true,
}) => {
  if (!isOpen) return null;

  const initials = driverName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center cursor-pointer transition-colors backdrop-blur-xs"
          aria-label="Close profile"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header with Figma Graffiti / Street Art Banner */}
        <div className="relative h-36 bg-gradient-to-r from-slate-900 via-slate-800 to-amber-900 overflow-hidden shrink-0">
          <div className="absolute inset-0 opacity-30 mix-blend-overlay bg-[radial-gradient(#F05A28_1px,transparent_1px)] [background-size:16px_16px]"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 pt-0 overflow-y-auto flex-1 space-y-5 -mt-12">
          {/* Avatar & Driver Identity */}
          <div className="flex items-end justify-between">
            <div className="relative">
              {driverAvatar ? (
                <img
                  src={driverAvatar}
                  alt={driverName}
                  className="w-22 h-22 rounded-full border-4 border-white object-cover shadow-md bg-white"
                />
              ) : (
                <div className="w-22 h-22 rounded-full border-4 border-white bg-slate-900 text-white font-black text-2xl flex items-center justify-center shadow-md">
                  {initials}
                </div>
              )}
              {isVerified && (
                <span className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-emerald-500 text-white border-2 border-white flex items-center justify-center shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </span>
              )}
            </div>

            <div className="text-right pb-1">
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>ID Verified</span>
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-950 tracking-tight">{driverName}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Member since August 2023 • Top rated driver
            </p>
          </div>

          {/* Stats Bar (Figma: Rides driven, Rides taken, KM shared) */}
          <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-center">
            <div className="p-1">
              <div className="text-xl font-black text-slate-950">{driverTripsCount}</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Rides driven</div>
            </div>
            <div className="p-1 border-x border-slate-200">
              <div className="text-xl font-black text-slate-950">8</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">Rides taken</div>
            </div>
            <div className="p-1">
              <div className="text-xl font-black text-slate-950">2.4k</div>
              <div className="text-[10px] uppercase font-bold text-slate-400 mt-0.5">KM shared</div>
            </div>
          </div>

          {/* About Bio */}
          <div className="space-y-1.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">About</h3>
            <p className="text-xs text-slate-700 leading-relaxed bg-slate-50/70 p-3.5 rounded-2xl border border-slate-100">
              {driverBio}
            </p>
          </div>

          {/* Figma Reviews Section */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Reviews</h3>
              <div className="flex items-center gap-1 text-xs font-bold text-slate-900">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{driverRating}</span>
                <span className="text-slate-400 font-normal">({driverTripsCount} reviews)</span>
              </div>
            </div>

            <div className="space-y-2.5">
              {/* Review 1: Katrine */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                      K
                    </div>
                    <span className="font-bold text-xs text-slate-900">Katrine</span>
                  </div>
                  <div className="flex items-center text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "Exceptional driver with a keen sense of navigation, made my journey comfortable and efficient."
                </p>
              </div>

              {/* Review 2: Luke */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                      L
                    </div>
                    <span className="font-bold text-xs text-slate-900">Luke</span>
                  </div>
                  <div className="flex items-center text-amber-400">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className="w-3 h-3 fill-amber-400" />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed italic">
                  "Great conversation and super punctual. The car was spotless and the ride was very smooth!"
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
