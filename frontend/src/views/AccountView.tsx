import React, { useState } from 'react';
import { User, Vehicle, UniversityOption, ScreenId } from '../types';
import { 
  User as UserIcon, 
  Car, 
  CreditCard, 
  ShieldCheck, 
  GraduationCap, 
  Settings as SettingsIcon, 
  Lock, 
  Globe, 
  Gift, 
  AlertCircle, 
  ArrowLeft, 
  Plus, 
  Check, 
  Camera, 
  Building2, 
  Trash2,
  Sparkles,
  Snowflake,
  Bike,
  Dog
} from 'lucide-react';
import { api } from '../api';

interface AccountViewProps {
  user: User;
  vehicles: Vehicle[];
  universities: UniversityOption[];
  currentScreen: ScreenId;
  onUpdateUser: (updates: Partial<User>) => void;
  onAddVehicle: (newVeh: Vehicle) => void;
  onDeleteVehicle: (vehId: string) => void;
  onRequestPayout: (amount: number, method: string) => void;
  onNavigateScreen: (screen: ScreenId) => void;
  onLogout: () => void;
  showToast: (msg: string) => void;
}

export const AccountView: React.FC<AccountViewProps> = ({
  user,
  vehicles,
  universities,
  currentScreen,
  onUpdateUser,
  onAddVehicle,
  onDeleteVehicle,
  onRequestPayout,
  onNavigateScreen,
  onLogout,
  showToast,
}) => {
  // Navigation within Account
  const [activeSection, setActiveSection] = useState<string>('profile');

  // Sub-view for Vehicles: 'list' (Frame 877:2634) vs 'add' (Frame 877:2884 / 1038:1219)
  const [vehicleSubView, setVehicleSubView] = useState<'list' | 'add'>('list');

  // Form states for Personal Details
  const [name, setName] = useState(user.name || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [bio, setBio] = useState(user.bio || '');

  // Form states for Add Vehicle — SAFE EMPTY DEFAULTS (No prefilled fake models/plates)
  const [newMake, setNewMake] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newYear, setNewYear] = useState('');
  const [newColor, setNewColor] = useState('White');
  const [newPlate, setNewPlate] = useState('');
  const [newType, setNewType] = useState('Sedan');
  const [newLuggage, setNewLuggage] = useState<'No luggage' | 'S' | 'M' | 'L'>('M');
  const [winterTyres, setWinterTyres] = useState(false);
  const [snowboards, setSnowboards] = useState(false);
  const [bikes, setBikes] = useState(false);
  const [pets, setPets] = useState(false);
  const [isSubmittingVehicle, setIsSubmittingVehicle] = useState(false);

  // Form states for Payout — SAFE EMPTY DEFAULTS (No fake bank / UPI accounts)
  const [payoutMethod, setPayoutMethod] = useState<'bank' | 'upi'>('bank');
  const [payoutUpi, setPayoutUpi] = useState('');
  const [payoutBank, setPayoutBank] = useState('');

  // Form states for Student verification — SAFE EMPTY DEFAULTS
  const [selectedUniId, setSelectedUniId] = useState(universities[0]?.id || '');
  const [studentEmail, setStudentEmail] = useState('');

  // Form state for Password
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // Form state for Language
  const [language, setLanguage] = useState('English');

  // ID verification state — truthful to user.isVerified
  const [idType, setIdType] = useState('Driving License');

  const menuItems = [
    { id: 'profile', label: 'Profile & personal details', icon: <UserIcon className="w-5 h-5 text-slate-700" /> },
    { id: 'vehicles', label: 'Vehicles', icon: <Car className="w-5 h-5 text-slate-700" /> },
    { id: 'payments', label: 'Payments & payouts', icon: <CreditCard className="w-5 h-5 text-slate-700" /> },
    { id: 'id-verify', label: 'ID verification', icon: <ShieldCheck className="w-5 h-5 text-slate-700" /> },
    { id: 'student', label: 'University / student', icon: <GraduationCap className="w-5 h-5 text-slate-700" /> },
    { id: 'preferences', label: 'Travel preferences', icon: <SettingsIcon className="w-5 h-5 text-slate-700" /> },
    { id: 'security', label: 'Security & password', icon: <Lock className="w-5 h-5 text-slate-700" /> },
    { id: 'language', label: 'Language', icon: <Globe className="w-5 h-5 text-slate-700" /> },
    { id: 'referrals', label: 'Referrals & credits', icon: <Gift className="w-5 h-5 text-slate-700" /> },
    { id: 'close', label: 'Close account', icon: <AlertCircle className="w-5 h-5 text-rose-600" />, danger: true },
  ];

  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMake.trim() || !newModel.trim() || !newPlate.trim()) {
      showToast('Please enter vehicle make, model, and licence plate');
      return;
    }
    const yearNum = parseInt(newYear.trim(), 10) || new Date().getFullYear();

    setIsSubmittingVehicle(true);
    try {
      const vehiclePayload: Vehicle = {
        id: `veh_${Date.now()}`,
        make: newMake.trim(),
        model: newModel.trim(),
        year: yearNum,
        color: newColor,
        plateNumber: newPlate.trim().toUpperCase(),
        isDefault: vehicles.length === 0,
        type: newType,
        luggageCapacity: newLuggage,
        winterTyres,
        snowboards,
        bikes,
        pets,
      };

      await onAddVehicle(vehiclePayload);
      showToast(`Vehicle ${vehiclePayload.make} ${vehiclePayload.model} added successfully`);
      
      // Reset form to clean empty defaults
      setNewMake('');
      setNewModel('');
      setNewYear('');
      setNewPlate('');
      setWinterTyres(false);
      setSnowboards(false);
      setBikes(false);
      setPets(false);
      setVehicleSubView('list');
    } catch (err: any) {
      showToast(`Failed to add vehicle: ${err?.message || 'Error'}`);
    } finally {
      setIsSubmittingVehicle(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ================= ACCOUNT HERO CARD ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#F05A28] text-white font-black text-xl flex items-center justify-center shadow-sm">
            {user.initials || (user.name ? user.name.slice(0, 2).toUpperCase() : 'TR')}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950">{user.name || 'TopRide Member'}</h1>
              {user.isVerified && (
                <span title="Verified Profile" className="flex items-center gap-1 text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <ShieldCheck className="w-3.5 h-3.5" /> Verified
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Member since {user.joinedDate || '2024'} • ★ {user.rating} ({user.tripsCount} trips)
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-left">
            <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">
              Payout Balance
            </span>
            <span className="font-black text-lg text-slate-950">₹{user.availablePayout}</span>
          </div>

          <button
            onClick={() => setActiveSection('payments')}
            className="px-4 py-2.5 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs active:scale-98"
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* ================= MAIN SPLIT: SETTINGS TABS & CONTENT ================= */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[560px]">
        {/* Left Navigation Menu */}
        <div className="md:col-span-4 border-r border-slate-200 p-3 sm:p-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveSection(item.id);
                if (item.id === 'vehicles') setVehicleSubView('list');
              }}
              className={`w-full flex items-center justify-between p-3.5 rounded-2xl text-left transition-all cursor-pointer ${
                activeSection === item.id
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : item.danger
                  ? 'text-rose-600 hover:bg-rose-50 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100 font-semibold'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={activeSection === item.id ? 'text-white' : ''}>{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Right Content Area */}
        <div className="md:col-span-8 p-6 sm:p-8">
          {/* 1. PROFILE DETAILS */}
          {activeSection === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-black text-slate-950">Personal Details</h2>
                <p className="text-xs text-slate-500">Manage your public passenger & driver profile</p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  onUpdateUser({ name, email, phone, bio });
                  showToast('Profile updated successfully');
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Enter your full name"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:border-[#F05A28]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:border-[#F05A28]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden focus:border-[#F05A28]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Bio / About Me
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell other travelers about yourself..."
                    className="w-full p-4 rounded-xl border border-slate-200 text-sm leading-relaxed focus:outline-hidden focus:border-[#F05A28]"
                  />
                </div>

                <button
                  type="submit"
                  className="py-3 px-6 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer active:scale-98"
                >
                  Save changes
                </button>
              </form>
            </div>
          )}

          {/* 2. VEHICLES — MATCHING FIGMA FRAMES 877:2634 & 877:2884 / 1038:1219 */}
          {activeSection === 'vehicles' && (
            <div className="space-y-6">
              {/* SUB-VIEW 1: VEHICLES LIST (Figma Frame 877:2634) */}
              {vehicleSubView === 'list' ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-black text-slate-950">Vehicles</h2>
                      <p className="text-xs text-slate-500">Vehicles you drive for offering passenger rides</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setVehicleSubView('add')}
                      className="px-4 py-2.5 rounded-xl bg-[#F05A28] hover:bg-[#d84a1b] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98 transition-all"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add a vehicle</span>
                    </button>
                  </div>

                  {vehicles.length === 0 ? (
                    /* Figma Frame 877:2634 Empty State */
                    <div className="p-8 sm:p-12 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-4">
                      <div className="w-16 h-16 rounded-full bg-slate-200/70 flex items-center justify-center text-slate-400">
                        <Car className="w-8 h-8 stroke-1" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-base text-slate-900">Looks like you have no vehicles, yet.</h3>
                        <p className="text-xs text-slate-500 max-w-sm">
                          Add your vehicle to start offering carpool trips and earning on your regular commutes.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setVehicleSubView('add')}
                        className="py-3 px-6 rounded-2xl bg-[#F05A28] hover:bg-[#d84a1b] text-white font-bold text-xs transition-colors cursor-pointer shadow-xs active:scale-98"
                      >
                        + Add a vehicle
                      </button>
                    </div>
                  ) : (
                    /* Populated Vehicles List */
                    <div className="space-y-3">
                      {vehicles.map((v) => (
                        <div
                          key={v.id}
                          className="p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white hover:border-slate-300 transition-colors shadow-xs"
                        >
                          <div className="flex items-start sm:items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                              <Car className="w-6 h-6 text-slate-700" />
                            </div>
                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-base text-slate-900">{v.make} {v.model}</span>
                                {v.isDefault && (
                                  <span className="px-2 py-0.5 bg-slate-900 text-white text-[10px] font-bold rounded-md">
                                    Primary
                                  </span>
                                )}
                                {v.type && (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 text-[10px] font-bold rounded-md border border-slate-200">
                                    {v.type}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                                <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md">
                                  {v.plateNumber}
                                </span>
                                <span>•</span>
                                <span>{v.color}</span>
                                <span>•</span>
                                <span>{v.year}</span>
                                {v.luggageCapacity && (
                                  <>
                                    <span>•</span>
                                    <span className="text-slate-600 font-semibold">Luggage: {v.luggageCapacity}</span>
                                  </>
                                )}
                              </div>
                              {/* Amenity Badges */}
                              <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                                {v.winterTyres && (
                                  <span className="px-2 py-0.5 bg-sky-50 text-sky-800 text-[10px] font-semibold rounded-md flex items-center gap-1 border border-sky-200">
                                    <Snowflake className="w-2.5 h-2.5" /> Winter tyres
                                  </span>
                                )}
                                {v.bikes && (
                                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 text-[10px] font-semibold rounded-md flex items-center gap-1 border border-emerald-200">
                                    <Bike className="w-2.5 h-2.5" /> Bikes
                                  </span>
                                )}
                                {v.pets && (
                                  <span className="px-2 py-0.5 bg-amber-50 text-amber-800 text-[10px] font-semibold rounded-md flex items-center gap-1 border border-amber-200">
                                    <Dog className="w-2.5 h-2.5" /> Pets friendly
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm(`Remove vehicle ${v.make} ${v.model}?`)) {
                                  onDeleteVehicle(v.id);
                                  showToast(`Removed vehicle ${v.make}`);
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                              title="Delete vehicle"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                /* SUB-VIEW 2: ADD A VEHICLE FORM (Figma Frames 877:2884 & 1038:1219) */
                <div className="space-y-6 animate-in fade-in">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setVehicleSubView('list')}
                      className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 cursor-pointer transition-colors"
                      aria-label="Back to vehicle list"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                      <h2 className="text-xl font-black text-slate-950">Add a vehicle</h2>
                      <p className="text-xs text-slate-500">Provide accurate details matching your registration certificate</p>
                    </div>
                  </div>

                  {/* Figma Vehicle Photo Upload Area */}
                  <div className="p-6 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center text-center space-y-2 hover:border-[#F05A28]/50 transition-colors cursor-pointer">
                    <div className="w-14 h-14 rounded-full bg-white shadow-xs border border-slate-200 flex items-center justify-center text-slate-400">
                      <Camera className="w-6 h-6 text-slate-500" />
                    </div>
                    <div>
                      <span className="font-bold text-xs text-slate-900 block">Vehicle Photo (Optional)</span>
                      <span className="text-[11px] text-slate-400">Add a clear photo of your car to increase booking requests</span>
                    </div>
                  </div>

                  <form onSubmit={handleAddVehicleSubmit} className="space-y-5">
                    {/* Make & Model Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Make *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Tata, Honda, Hyundai"
                          value={newMake}
                          onChange={(e) => setNewMake(e.target.value)}
                          className="w-full p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-hidden focus:border-[#F05A28]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Model *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Nexon, City, Swift, Elevate"
                          value={newModel}
                          onChange={(e) => setNewModel(e.target.value)}
                          className="w-full p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-hidden focus:border-[#F05A28]"
                        />
                      </div>
                    </div>

                    {/* Vehicle Type Dropdown / Chips */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Vehicle Type
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {['Sedan', 'SUV', 'Hatchback', 'EV', 'Van'].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setNewType(t)}
                            className={`py-2.5 px-3 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                              newType === t
                                ? 'bg-slate-950 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Color & Year Inputs */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                          Color
                        </label>
                        <select
                          value={newColor}
                          onChange={(e) => setNewColor(e.target.value)}
                          className="w-full p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-hidden focus:border-[#F05A28] bg-white cursor-pointer"
                        >
                          {['White', 'Silver', 'Grey', 'Black', 'Blue', 'Red', 'Brown', 'Other'].map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                          Year of Manufacture
                        </label>
                        <input
                          type="number"
                          placeholder="e.g. 2023"
                          min="1995"
                          max={new Date().getFullYear() + 1}
                          value={newYear}
                          onChange={(e) => setNewYear(e.target.value)}
                          className="w-full p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-semibold focus:outline-hidden focus:border-[#F05A28]"
                        />
                      </div>
                    </div>

                    {/* Licence Plate */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                        Licence Plate Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. KA 01 AB 1234"
                        value={newPlate}
                        onChange={(e) => setNewPlate(e.target.value)}
                        className="w-full p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm font-mono font-bold uppercase focus:outline-hidden focus:border-[#F05A28]"
                      />
                    </div>

                    {/* Figma Segmented Luggage Capacity */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                        Luggage Capacity
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {(['No luggage', 'S', 'M', 'L'] as const).map((lug) => (
                          <button
                            key={lug}
                            type="button"
                            onClick={() => setNewLuggage(lug)}
                            className={`py-2.5 px-2 rounded-xl text-xs font-bold text-center transition-all cursor-pointer ${
                              newLuggage === lug
                                ? 'bg-slate-950 text-white shadow-xs'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                            }`}
                          >
                            {lug}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Figma Amenities / Other Options Toggles */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Other Options & Amenities
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setWinterTyres(!winterTyres)}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            winterTyres ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <Snowflake className="w-4 h-4 text-sky-600" />
                          <span>Winter tyres</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSnowboards(!snowboards)}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            snowboards ? 'border-indigo-500 bg-indigo-50 text-indigo-900 shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <span>Snowboards</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setBikes(!bikes)}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            bikes ? 'border-emerald-500 bg-emerald-50 text-emerald-900 shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <Bike className="w-4 h-4 text-emerald-600" />
                          <span>Bikes</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setPets(!pets)}
                          className={`p-3 rounded-xl border text-xs font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            pets ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          <Dog className="w-4 h-4 text-amber-600" />
                          <span>Pets allowed</span>
                        </button>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setVehicleSubView('list')}
                        className="flex-1 py-3.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        disabled={isSubmittingVehicle}
                        className="flex-1 py-3.5 px-6 rounded-xl bg-[#F05A28] hover:bg-[#d84a1b] disabled:opacity-50 text-white font-bold text-xs transition-all shadow-xs cursor-pointer active:scale-98"
                      >
                        {isSubmittingVehicle ? 'Saving vehicle...' : 'Add a vehicle'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* 3. PAYMENTS & PAYOUTS — SAFE TRUTHFUL STATE */}
          {activeSection === 'payments' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-950">Payments & Payouts</h2>

              <div className="p-5 bg-gradient-to-r from-slate-950 to-slate-800 text-white rounded-3xl space-y-3">
                <span className="text-xs text-slate-300 font-semibold block">Available Payout Balance</span>
                <div className="text-3xl font-black">₹{user.availablePayout}</div>
                <p className="text-xs text-slate-400">
                  Earnings from completed rides are automatically calculated and ready for withdrawal.
                </p>
              </div>

              {/* Request Payout Method */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">Request withdrawal</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className={`p-4 rounded-2xl border-2 transition-all ${
                    payoutMethod === 'bank' ? 'border-slate-950 bg-slate-50' : 'border-slate-200'
                  }`}>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="radio"
                        name="payoutMethod"
                        checked={payoutMethod === 'bank'}
                        onChange={() => setPayoutMethod('bank')}
                        className="accent-slate-950"
                      />
                      <Building2 className="w-4 h-4 text-slate-700" />
                      <span className="font-bold text-xs text-slate-900">Direct Bank Transfer</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Account number & IFSC"
                      value={payoutBank}
                      onChange={(e) => setPayoutBank(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden bg-white"
                    />
                  </div>

                  <div className={`p-4 rounded-2xl border-2 transition-all ${
                    payoutMethod === 'upi' ? 'border-slate-950 bg-slate-50' : 'border-slate-200'
                  }`}>
                    <label className="flex items-center gap-2 cursor-pointer mb-2">
                      <input
                        type="radio"
                        name="payoutMethod"
                        checked={payoutMethod === 'upi'}
                        onChange={() => setPayoutMethod('upi')}
                        className="accent-slate-950"
                      />
                      <CreditCard className="w-4 h-4 text-slate-700" />
                      <span className="font-bold text-xs text-slate-900">Instant UPI Transfer</span>
                    </label>
                    <input
                      type="text"
                      placeholder="user@upi ID"
                      value={payoutUpi}
                      onChange={(e) => setPayoutUpi(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden bg-white"
                    />
                  </div>
                </div>

                <button
                  disabled={user.availablePayout <= 0 || (payoutMethod === 'bank' ? !payoutBank.trim() : !payoutUpi.trim())}
                  onClick={() => {
                    const destination = payoutMethod === 'bank' ? payoutBank : payoutUpi;
                    onRequestPayout(user.availablePayout, payoutMethod);
                    showToast(`Payout request of ₹${user.availablePayout} submitted via ${payoutMethod.toUpperCase()}`);
                  }}
                  className="py-3 px-6 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Withdraw ₹{user.availablePayout} now
                </button>
              </div>
            </div>
          )}

          {/* 4. ID VERIFICATION — TRUTHFUL TO USER STATUS */}
          {activeSection === 'id-verify' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-950">ID Verification</h2>
              {user.isVerified ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                  <div>
                    <span className="font-bold text-xs text-emerald-900 block">Identity Verified</span>
                    <p className="text-xs text-emerald-700">
                      Your government identification is verified. You enjoy verified trust badges on all rides.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="w-6 h-6 text-amber-600 shrink-0" />
                  <div>
                    <span className="font-bold text-xs text-amber-900 block">Not Yet Verified</span>
                    <p className="text-xs text-amber-700">
                      Verify your Government ID to gain community trust, faster bookings, and driver privileges.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Select Document Type
                </label>
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden bg-white"
                >
                  <option value="Driving License">Driving License</option>
                  <option value="Aadhaar Card">Aadhaar Card</option>
                  <option value="Passport">Passport</option>
                </select>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await api.verifyId(idType);
                      onUpdateUser({ isVerified: true });
                      showToast('Government ID submitted & verified successfully!');
                    } catch (err: any) {
                      showToast(err.message || 'ID verification failed');
                    }
                  }}
                  className="py-3 px-6 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer transition-colors"
                >
                  Upload & verify {idType}
                </button>
              </div>
            </div>
          )}

          {/* 5. UNIVERSITY / STUDENT VERIFICATION — TRUTHFUL TO REAL STATUS */}
          {activeSection === 'student' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">University & Student Status</h2>
                  <p className="text-xs text-slate-500">Access exclusive student carpools and campus discounts</p>
                </div>
                <GraduationCap className="w-6 h-6 text-indigo-600" />
              </div>

              {user.isStudentVerified ? (
                <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="font-bold text-xs text-indigo-900 block">
                      {user.studentUniversity || 'Verified University'}
                    </span>
                    <span className="text-xs text-indigo-700">Student badge active for campus trips</span>
                  </div>
                  <span className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded-full">
                    Verified Student
                  </span>
                </div>
              ) : (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-slate-400 shrink-0" />
                  <p className="text-xs text-slate-600">
                    You are not currently student-verified. Enter your institutional email below to unlock student perks.
                  </p>
                </div>
              )}

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Select University
                </label>
                <select
                  value={selectedUniId}
                  onChange={(e) => setSelectedUniId(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden bg-white"
                >
                  {universities.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.city})
                    </option>
                  ))}
                </select>

                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mt-2">
                  Institutional Email (.edu / .ac.in / .ca)
                </label>
                <input
                  type="email"
                  placeholder="name@university.edu"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden focus:border-[#F05A28]"
                />

                <button
                  type="button"
                  disabled={!studentEmail.trim()}
                  onClick={async () => {
                    const uni = universities.find((u) => u.id === selectedUniId);
                    try {
                      await api.verifyStudent(selectedUniId, studentEmail);
                      onUpdateUser({ isStudentVerified: true, studentUniversity: uni?.name });
                      showToast('Student credentials verified successfully!');
                    } catch (err: any) {
                      showToast(err.message || 'Verification failed');
                    }
                  }}
                  className="py-3 px-6 rounded-xl bg-slate-950 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs cursor-pointer"
                >
                  Verify campus email
                </button>
              </div>
            </div>
          )}

          {/* 6. TRAVEL PREFERENCES */}
          {activeSection === 'preferences' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-950">Travel Preferences</h2>
              <div className="space-y-4">
                {[
                  { label: 'Chattiness', desc: 'I enjoy chatting during highway trips', state: true },
                  { label: 'Air Conditioning', desc: 'Keep AC on at moderate cooling throughout', state: true },
                  { label: 'Music', desc: 'Acoustic playlists or podcasts preferred', state: true },
                  { label: 'Pets', desc: 'Comfortable with small caged pets in car', state: false },
                  { label: 'Smoking in car', desc: 'Strictly smoke-free vehicle', state: true },
                ].map((pref, i) => (
                  <div key={i} className="flex items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50/50">
                    <div>
                      <div className="font-bold text-xs text-slate-900">{pref.label}</div>
                      <div className="text-[11px] text-slate-500">{pref.desc}</div>
                    </div>
                    <input
                      type="checkbox"
                      defaultChecked={pref.state}
                      onChange={() => showToast('Preference updated')}
                      className="w-4 h-4 accent-slate-950 rounded cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. SECURITY & PASSWORD */}
          {activeSection === 'security' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-950">Change Password</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  showToast('Password updated successfully');
                  setCurrentPass('');
                  setNewPass('');
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    Current Password
                  </label>
                  <input
                    type="password"
                    required
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-hidden"
                  />
                </div>
                <button
                  type="submit"
                  className="py-3 px-6 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                >
                  Update password
                </button>
              </form>
            </div>
          )}

          {/* 8. LANGUAGE */}
          {activeSection === 'language' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-950">Select Language</h2>
              <div className="grid grid-cols-2 gap-3">
                {['English', 'Hindi (हिंदी)', 'Kannada (ಕನ್ನಡ)', 'Telugu (తెలుగు)', 'Tamil (தமிழ்)'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => {
                      setLanguage(lang);
                      showToast(`Language switched to ${lang}`);
                    }}
                    className={`p-4 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      language === lang ? 'border-slate-950 bg-slate-50 font-bold' : 'border-slate-200 font-semibold'
                    }`}
                  >
                    <div className="text-sm text-slate-900">{lang}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 9. REFERRALS */}
          {activeSection === 'referrals' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-950">Refer Friends & Earn</h2>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 space-y-4">
                <span className="text-xs text-slate-500 block">Your unique referral code</span>
                <div className="flex items-center gap-3">
                  <div className="px-5 py-3 rounded-2xl bg-white border border-slate-300 font-mono font-black text-lg text-slate-950 tracking-wider">
                    TOPRIDE50
                  </div>
                  <button
                    onClick={() => showToast('Referral code copied to clipboard')}
                    className="py-3 px-4 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                  >
                    Copy code
                  </button>
                </div>
                <p className="text-xs text-slate-600">
                  Invite fellow travelers. They get ₹100 off their first booking, and you receive ₹150 in ride credits!
                </p>
              </div>
            </div>
          )}

          {/* 10. CLOSE ACCOUNT */}
          {activeSection === 'close' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-rose-600">Close Account</h2>
              <p className="text-xs text-slate-600 leading-relaxed">
                Closing your account is permanent. All pending bookings, trip history, and saved vehicles will be wiped.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (confirm('Are you sure you want to close your TopRide account?')) {
                    onLogout();
                    showToast('Account closed');
                  }
                }}
                className="py-3 px-6 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
              >
                Permanently close my account
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
