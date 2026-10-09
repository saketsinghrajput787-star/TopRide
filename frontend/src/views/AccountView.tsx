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
  ChevronRight, 
  ArrowLeft, 
  Plus, 
  Check, 
  Upload, 
  Building2, 
  Trash2,
  Sparkles
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
  // Navigation within Account on desktop or mobile
  const [activeSection, setActiveSection] = useState<string>('profile');

  // Form states for Personal Details
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone);
  const [bio, setBio] = useState(user.bio);

  // Form states for Add Vehicle
  const [newMake, setNewMake] = useState('Honda');
  const [newModel, setNewModel] = useState('Elevate');
  const [newYear, setNewYear] = useState(2024);
  const [newColor, setNewColor] = useState('Lunar Silver');
  const [newPlate, setNewPlate] = useState('KA 01 PQ 9999');

  // Form states for Payout
  const [payoutMethod, setPayoutMethod] = useState<'bank' | 'upi'>('bank');
  const [payoutUpi, setPayoutUpi] = useState('saket@okhdfcbank');
  const [payoutBank, setPayoutBank] = useState('HDFC Bank •••• 4821');

  // Form states for Student verification
  const [selectedUniId, setSelectedUniId] = useState(universities[0].id);
  const [studentEmail, setStudentEmail] = useState('saket.kumar@algomau.ca');
  const [studentStatus, setStudentStatus] = useState<'verified' | 'pending' | 'unverified'>(
    user.isStudentVerified ? 'verified' : 'unverified'
  );

  // Form state for Password
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');

  // Form state for Language
  const [language, setLanguage] = useState('English');

  // ID verification state
  const [idType, setIdType] = useState('Driving License');
  const [idStatus, setIdStatus] = useState<'verified' | 'pending'>('verified');

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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ================= ACCOUNT HERO CARD ================= */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#F05A28] text-white font-black text-xl flex items-center justify-center shadow-sm">
            {user.initials}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-slate-950">{user.name}</h1>
              {user.isVerified && (
                <span title="Verified Profile">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </span>
              )}

            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              Member since {user.joinedDate} • ★ {user.rating} ({user.tripsCount} trips)
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

      {/* ================= TWO-COLUMN DESKTOP / DRILL-DOWN MOBILE ================= */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: NAVIGATION MENU (4 cols) */}
        <div className="md:col-span-4 bg-white rounded-3xl p-3 border border-slate-200 shadow-sm space-y-1">
          {menuItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full p-3 rounded-2xl flex items-center justify-between text-left transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-100 text-slate-950 font-bold'
                    : item.danger
                    ? 'text-rose-600 hover:bg-rose-50 font-semibold'
                    : 'text-slate-700 hover:bg-slate-50 font-semibold'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.icon}
                  <span className="text-xs sm:text-sm">{item.label}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400" />
              </button>
            );
          })}

          <div className="pt-2 border-t border-slate-100">
            <button
              onClick={onLogout}
              className="w-full p-3 rounded-2xl text-left text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              Sign out of session
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: ACTIVE SECTION PANEL (8 cols) */}
        <div className="md:col-span-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
          {/* 1. PERSONAL DETAILS */}
          {activeSection === 'profile' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-950">Personal Details</h2>
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden"
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden"
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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-hidden"
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
                    className="w-full p-4 rounded-xl border border-slate-200 text-sm leading-relaxed focus:outline-hidden"
                  />
                </div>

                <button
                  type="submit"
                  className="py-3 px-6 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Save changes
                </button>
              </form>
            </div>
          )}

          {/* 2. VEHICLES */}
          {activeSection === 'vehicles' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">Registered Vehicles</h2>
                  <p className="text-xs text-slate-500">Vehicles you drive for offering passenger rides</p>
                </div>
              </div>

              <div className="space-y-3">
                {vehicles.map((v) => (
                  <div
                    key={v.id}
                    className="p-4 rounded-2xl border border-slate-200 flex items-center justify-between bg-slate-50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center">
                        <Car className="w-5 h-5 text-slate-700" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{v.make} {v.model}</span>
                          {v.isDefault && (
                            <span className="px-2 py-0.2 bg-slate-900 text-white text-[10px] font-bold rounded-md">
                              Primary
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 font-mono mt-0.5">
                          {v.plateNumber} • {v.color} ({v.year})
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        onDeleteVehicle(v.id);
                        showToast(`Removed vehicle ${v.make}`);
                      }}
                      className="text-xs text-rose-600 hover:text-rose-800 font-bold p-2 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add Vehicle Form */}
              <div className="pt-4 border-t border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 mb-3">Add a new vehicle</h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Make (e.g. Tata)"
                    value={newMake}
                    onChange={(e) => setNewMake(e.target.value)}
                    className="p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="Model (e.g. Nexon)"
                    value={newModel}
                    onChange={(e) => setNewModel(e.target.value)}
                    className="p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="Plate Number"
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    className="p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="Color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onAddVehicle({
                      id: `veh_${Date.now()}`,
                      make: newMake,
                      model: newModel,
                      year: newYear,
                      color: newColor,
                      plateNumber: newPlate,
                      isDefault: false,
                    });
                    showToast('Vehicle added successfully');
                  }}
                  className="py-2.5 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                >
                  + Add vehicle
                </button>
              </div>
            </div>
          )}

          {/* 3. PAYMENTS & PAYOUTS */}
          {activeSection === 'payments' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-950">Payments & Payouts</h2>

              <div className="p-5 bg-gradient-to-r from-slate-950 to-slate-800 text-white rounded-3xl space-y-3">
                <span className="text-xs text-slate-300 font-semibold block">Available Payout Balance</span>
                <div className="text-3xl font-black">₹{user.availablePayout}</div>
                <p className="text-xs text-slate-400">
                  Earnings from completed rides are automatically ready for withdrawal.
                </p>
              </div>

              {/* Request Payout Method */}
              <div className="space-y-3">
                <h3 className="font-bold text-sm text-slate-900">Request withdrawal</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setPayoutMethod('bank')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      payoutMethod === 'bank' ? 'border-slate-950 bg-slate-50' : 'border-slate-200'
                    }`}
                  >
                    <Building2 className="w-4 h-4 text-slate-700 mb-1" />
                    <div className="font-bold text-xs text-slate-900">Direct Bank Transfer</div>
                    <div className="text-[11px] text-slate-500">{payoutBank}</div>
                  </button>

                  <button
                    onClick={() => setPayoutMethod('upi')}
                    className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer ${
                      payoutMethod === 'upi' ? 'border-slate-950 bg-slate-50' : 'border-slate-200'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-slate-700 mb-1" />
                    <div className="font-bold text-xs text-slate-900">Instant UPI Transfer</div>
                    <div className="text-[11px] text-slate-500">{payoutUpi}</div>
                  </button>
                </div>

                <button
                  disabled={user.availablePayout === 0}
                  onClick={() => {
                    onRequestPayout(user.availablePayout, payoutMethod);
                    showToast(`Payout request of ₹${user.availablePayout} submitted to your ${payoutMethod.toUpperCase()}`);
                  }}
                  className="py-3 px-6 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  Withdraw ₹{user.availablePayout} now
                </button>
              </div>
            </div>
          )}

          {/* 4. ID VERIFICATION */}
          {activeSection === 'id-verify' && (
            <div className="space-y-6">
              <h2 className="text-xl font-black text-slate-950">ID Verification</h2>
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-xs text-emerald-900 block">Identity Verified</span>
                  <p className="text-xs text-emerald-700">
                    Your Government ID is approved. You enjoy verified driver and passenger status.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Document on record
                </label>
                <div className="p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-800 flex justify-between">
                  <span>Aadhaar / Driving License (•••• 9021)</span>
                  <span className="text-emerald-600">✓ Verified</span>
                </div>

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
                  className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold text-xs cursor-pointer"
                >
                  Upload updated document
                </button>
              </div>
            </div>
          )}

          {/* 5. UNIVERSITY / STUDENT VERIFICATION */}
          {activeSection === 'student' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-slate-950">University & Student Status</h2>
                  <p className="text-xs text-slate-500">Access exclusive student carpools and discounts</p>
                </div>
                <GraduationCap className="w-6 h-6 text-indigo-600" />
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-xs text-indigo-900 block">
                    {user.studentUniversity || 'Algoma University'}
                  </span>
                  <span className="text-xs text-indigo-700">Student badge valid for campus routes</span>
                </div>
                <span className="px-2.5 py-1 bg-indigo-600 text-white font-bold text-xs rounded-full">
                  Verified Student
                </span>
              </div>

              <div className="space-y-3 pt-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Change University
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
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-hidden"
                />

                <button
                  type="button"
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
                  className="py-3 px-6 rounded-xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer"
                >
                  Send verification code to campus email
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
                  { label: 'Chattiness', desc: 'I enjoy chatting during long highway trips', state: true },
                  { label: 'Air Conditioning', desc: 'Keep AC on at moderate cooling throughout', state: true },
                  { label: 'Music', desc: 'Acoustic playlists or podcasts preferred', state: true },
                  { label: 'Pets', desc: 'Comfortable with small caged pets in car', state: false },
                  { label: 'Smoking in car', desc: 'Strictly smoke-free vehicle', state: true },
                ].map((pref, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl border border-slate-100">
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
