import React, { useState } from 'react';
import { ScreenId, User } from '../types';
import { TopRideLogo } from '../components/TopRideLogo';
import { 
  ArrowRight, 
  ArrowLeft, 
  Car, 
  Package, 
  Users, 
  Camera, 
  Check, 
  Sparkles,
  Lock, 
  Mail, 
  User as UserIcon, 
  Phone, 
  Clock,
  ShieldCheck,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Calendar
} from 'lucide-react';
import { api } from '../api';

interface AuthFlowProps {
  currentScreen: ScreenId;
  onNavigateScreen: (screen: ScreenId) => void;
  onCompleteAuth: (userUpdates: Partial<User>) => void;
  showToast: (msg: string) => void;
}

export const AuthFlow: React.FC<AuthFlowProps> = ({
  currentScreen,
  onNavigateScreen,
  onCompleteAuth,
  showToast,
}) => {
  // Onboarding Carousel Sub-step (0: 3 Things to know, 1: Rule 1, 2: Rule 2, 3: Rule 3, 4: Got it? Great!)
  const [onboardRuleStep, setOnboardRuleStep] = useState(0);

  // Form State
  const [email, setEmail] = useState('demo@topride.app');
  const [password, setPassword] = useState('somepassword123');
  const [name, setName] = useState('Saket Kumar');
  const [countryCode, setCountryCode] = useState('+91');
  const [rawPhone, setRawPhone] = useState('9876543210');
  
  // Verification code state (6 boxes)
  const [otpDigits, setOtpDigits] = useState(['4', '8', '2', '1', '9', '0']);
  
  // DOB / Age Verification State
  const [birthDay, setBirthDay] = useState('15');
  const [birthMonth, setBirthMonth] = useState('August');
  const [birthYear, setBirthYear] = useState('1998');
  const [isAgeVerified, setIsAgeVerified] = useState<boolean>(true);

  // Gender Selection State
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('male');

  // Photo & Guidelines State
  const [selectedPhotoPreset, setSelectedPhotoPreset] = useState<number>(0);

  // Bio & Travel Intent State
  const [bioText, setBioText] = useState('Friendly professional traveling regularly for weekend getaways and work. Punctual and love good music.');
  const [usageIntent, setUsageIntent] = useState<'passenger' | 'driver' | 'both'>('both');

  const photoPresets = [
    { label: 'Avatar 1', bg: 'bg-[#F05A28]', text: 'SK' },
    { label: 'Avatar 2', bg: 'bg-slate-900', text: 'SK' },
    { label: 'Avatar 3', bg: 'bg-emerald-600', text: 'SK' },
    { label: 'Avatar 4', bg: 'bg-indigo-600', text: 'SK' },
  ];

  // ================= 1. SPLASH SCREEN (FIGMA BLUE CARPOOL SKY) =================
  if (currentScreen === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-gradient-to-b from-[#67C2EC] to-[#4EA8DE]">
        <div className="w-full max-w-md bg-white rounded-3xl overflow-hidden shadow-2xl border border-white/40 flex flex-col justify-between min-h-[640px]">
          {/* Top Sky Illustration Card */}
          <div className="bg-gradient-to-b from-[#72D2FF] to-[#56CCF2] p-8 text-center relative overflow-hidden flex-1 flex flex-col items-center justify-center">
            {/* Soft decorative clouds */}
            <div className="absolute top-4 left-6 w-16 h-8 bg-white/70 rounded-full blur-[1px]"></div>
            <div className="absolute top-8 right-8 w-20 h-9 bg-white/60 rounded-full blur-[1px]"></div>
            <div className="absolute top-20 left-12 w-12 h-6 bg-white/50 rounded-full"></div>

            {/* TopRide Logo in center */}
            <div className="relative z-10 mb-6 transform hover:scale-105 transition-transform">
              <TopRideLogo size="lg" />
            </div>

            {/* Cute Car Illustration Container */}
            <div className="relative z-10 w-44 h-24 mx-auto mb-2 flex items-center justify-center">
              <div className="w-28 h-16 bg-[#1A1D20] rounded-2xl relative shadow-lg flex items-center justify-center text-white border-2 border-white/20">
                {/* Windshield */}
                <div className="w-16 h-7 bg-[#A0E7E5] rounded-t-lg mx-auto opacity-90 absolute top-1"></div>
                {/* Car wheels */}
                <div className="w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-400 absolute -bottom-2.5 left-3"></div>
                <div className="w-5 h-5 rounded-full bg-slate-950 border-2 border-slate-400 absolute -bottom-2.5 right-3"></div>
                {/* Orange TopRide Emblem on car door */}
                <div className="w-5 h-5 rounded-full bg-[#F05A28] text-[8px] font-black text-white flex items-center justify-center absolute bottom-2 z-10">
                  TR
                </div>
              </div>
            </div>

            {/* Road stripe */}
            <div className="w-52 h-1 bg-white/50 rounded-full mt-4 mx-auto"></div>
          </div>

          {/* Bottom Card Content */}
          <div className="p-7 bg-white text-center space-y-4">
            <h1 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight">
              Carpool for the planet
            </h1>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
              Share comfortable rides, reduce road emissions, and travel affordably with verified commuters.
            </p>

            <div className="pt-2 space-y-3">
              <button
                onClick={() => onNavigateScreen('onboard')}
                className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <span>Let's go</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigateScreen('login')}
                className="w-full py-3.5 px-6 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-sm transition-all cursor-pointer"
              >
                I already have an account
              </button>
            </div>

            <div className="pt-2 flex items-center justify-center gap-3 text-xs text-slate-400">
              <span>Verified ID</span>
              <span>•</span>
              <span>Zero booking fees</span>
              <span>•</span>
              <span>Safe travel</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ================= 2. WELCOME & SOCIAL AUTH SCREEN =================
  if (currentScreen === 'onboard' && onboardRuleStep === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-6">
          {/* Header Back & Logo */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('welcome')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <TopRideLogo size="sm" />
            <div className="w-10"></div>
          </div>

          {/* Happy Travelers Photo Card (From Figma Welcome frame) */}
          <div className="relative rounded-2xl overflow-hidden shadow-inner h-44 bg-slate-100 flex items-center justify-center border border-slate-200">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent z-10" />
            <img 
              src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=800&q=80" 
              alt="Happy travelers carpooling"
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-3 left-4 right-4 z-20 text-left text-white">
              <span className="text-[11px] font-bold uppercase tracking-wider bg-[#F05A28] px-2 py-0.5 rounded-md">
                Verified Community
              </span>
              <p className="text-xs font-semibold mt-1 text-slate-100">
                Thousands of commuters sharing daily journeys
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight">
              Welcome to TopRide!
            </h2>
            <p className="text-slate-500 text-sm">
              Connect with trusted drivers and passengers in seconds.
            </p>
          </div>

          {/* Social Auth Buttons (Google, Apple, Email) */}
          <div className="space-y-3 pt-1">
            <button
              onClick={() => setOnboardRuleStep(1)}
              className="w-full py-3.5 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm text-slate-800 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-2xs"
            >
              {/* Google G Logo */}
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

            <button
              onClick={() => setOnboardRuleStep(1)}
              className="w-full py-3.5 px-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 font-bold text-sm text-slate-800 transition-all flex items-center justify-center gap-3 cursor-pointer shadow-2xs"
            >
              {/* Apple Logo */}
              <svg className="w-4 h-4 fill-slate-900" viewBox="0 0 24 24">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.42c.64-.78 1.08-1.87.96-2.96-.93.04-2.07.62-2.73 1.4-.58.67-1.09 1.77-.95 2.83 1.04.08 2.08-.5 2.72-1.27z"/>
              </svg>
              <span>Continue with Apple</span>
            </button>

            <button
              onClick={() => setOnboardRuleStep(1)}
              className="w-full py-3.5 px-4 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 font-bold text-sm text-white transition-all flex items-center justify-center gap-3 cursor-pointer shadow-sm"
            >
              <Mail className="w-4 h-4" />
              <span>Continue with Email</span>
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <button
              onClick={() => onNavigateScreen('login')}
              className="font-bold text-[#F05A28] hover:underline cursor-pointer"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ================= 3. 3 THINGS TO KNOW (FIGMA RULES CAROUSEL) =================
  if (currentScreen === 'onboard' && onboardRuleStep >= 1 && onboardRuleStep <= 4) {
    const rulesData = [
      {
        stepNum: 1,
        title: '3 things you need to know',
        subtitle: 'Before you get started with TopRide, here is how our carpool community works:',
        icon: <HelpCircle className="w-12 h-12 text-[#F05A28]" />,
        bullets: [
          'TopRide is cost-sharing carpool, not an on-demand taxi.',
          'All bookings and mock payments are handled securely in-app.',
          'Punctuality is essential — please arrive 5-10 minutes early.'
        ],
        btnLabel: 'Next: Rule 1'
      },
      {
        stepNum: 2,
        title: 'Carpool, not taxi',
        subtitle: 'Drivers are regular commuters traveling on the same route as you.',
        icon: <Car className="w-12 h-12 text-[#F05A28]" />,
        bullets: [
          'Drivers are sharing their journey to offset fuel and toll costs.',
          'Respect the driver’s vehicle, luggage space, and quiet hours.',
          'Treat fellow passengers with courtesy and friendly conversation.'
        ],
        btnLabel: 'Next: Rule 2'
      },
      {
        stepNum: 3,
        title: 'No cash, online booking',
        subtitle: 'All transactions are protected and managed through TopRide.',
        icon: <CreditCard className="w-12 h-12 text-[#F05A28]" />,
        bullets: [
          'Never pay cash or off-platform money directly to drivers.',
          'Seats are officially reserved only after payment confirmation.',
          'Automated refunds protect you if the driver cancels the trip.'
        ],
        btnLabel: 'Next: Rule 3'
      },
      {
        stepNum: 4,
        title: 'Got it? Great!',
        subtitle: 'You’re ready to complete your quick profile setup.',
        icon: <CheckCircle2 className="w-12 h-12 text-emerald-600" />,
        bullets: [
          '✅ Verified Government ID & phone protection',
          '✅ Real ratings and peer reviews from real travelers',
          '✅ 24/7 community support & journey tracking'
        ],
        btnLabel: 'I agree & continue'
      }
    ];

    const currentRule = rulesData[onboardRuleStep - 1];

    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col justify-between min-h-[560px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setOnboardRuleStep(onboardRuleStep - 1)}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
              Rule {onboardRuleStep} of 4
            </span>
            <button
              onClick={() => onNavigateScreen('signup')}
              className="text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              Skip
            </button>
          </div>

          {/* Main Visual & Content */}
          <div className="my-auto py-6 text-center space-y-4">
            <div className="w-24 h-24 rounded-3xl bg-[#F05A28]/10 flex items-center justify-center mx-auto shadow-inner">
              {currentRule.icon}
            </div>

            <div className="space-y-1">
              <h2 className="text-2xl font-black text-[#1A1D20] tracking-tight">
                {currentRule.title}
              </h2>
              <p className="text-slate-500 text-xs sm:text-sm leading-relaxed max-w-xs mx-auto">
                {currentRule.subtitle}
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-4 text-left border border-slate-100 space-y-2.5 max-w-sm mx-auto">
              {currentRule.bullets.map((bullet, i) => (
                <div key={i} className="flex items-start gap-2.5 text-xs text-slate-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#F05A28] mt-1.5 shrink-0"></div>
                  <span>{bullet}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Progress dots & CTA */}
          <div className="space-y-4">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`h-2 rounded-full transition-all ${
                    step === onboardRuleStep ? 'w-8 bg-[#F05A28]' : 'w-2 bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <button
              onClick={() => {
                if (onboardRuleStep < 4) {
                  setOnboardRuleStep(onboardRuleStep + 1);
                } else {
                  onNavigateScreen('signup');
                }
              }}
              className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span>{currentRule.btnLabel}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 4. SIGNUP & PHONE SCREEN (FIGMA PHONE STEP 1) =================
  if (currentScreen === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setOnboardRuleStep(4)}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 1 of 6</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight mb-1">
              What's your phone number?
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              We'll send a 6-digit verification code to confirm your device.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              onNavigateScreen('verify-code');
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <UserIcon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Saket Kumar"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm font-medium"
                />
              </div>
            </div>

            {/* Figma Country Code + Phone Input */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Mobile Number
              </label>
              <div className="flex gap-2">
                <div className="relative">
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="h-full pl-3 pr-7 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 font-bold text-xs text-slate-800 appearance-none focus:outline-hidden cursor-pointer"
                  >
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+61">🇦🇺 +61</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <div className="relative flex-1">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    value={rawPhone}
                    onChange={(e) => setRawPhone(e.target.value)}
                    placeholder="98765 43210"
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm font-medium tracking-wide"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Set Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Send Verification Code</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="text-center text-xs text-slate-500">
            Already have an account?{' '}
            <button
              onClick={() => onNavigateScreen('login')}
              className="font-bold text-[#F05A28] hover:underline cursor-pointer"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ================= 5. LOGIN SCREEN =================
  if (currentScreen === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('welcome')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <TopRideLogo size="sm" />
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight mb-1">
              Welcome back
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              Sign in to manage your rides, bookings, and messages.
            </p>
          </div>

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                const loggedUser = await api.login({ email, password });
                onCompleteAuth(loggedUser);
                showToast('Logged in successfully');
              } catch (err: any) {
                showToast(err.message || 'Login failed. Please check your credentials.');
              }
            }}
            className="space-y-4"
          >
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="demo@topride.app"
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm font-medium"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => showToast('Password reset link sent to demo email')}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  Forgot?
                </button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Log in</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-2 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Don't have an account?{' '}
              <button
                onClick={() => onNavigateScreen('signup')}
                className="font-bold text-[#F05A28] hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ================= 6. OTP VERIFICATION CODE (FIGMA STEP 2) =================
  if (currentScreen === 'verify-code') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('signup')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 2 of 6</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight mb-1">
              Enter 6-digit code
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              We sent a code to <span className="font-semibold text-slate-900">{countryCode} {rawPhone}</span>
            </p>
          </div>

          <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800 flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>SMS simulation mode: pre-filled code <strong>482190</strong>.</span>
          </div>

          {/* 6 Digit Underline / Box Inputs */}
          <div className="flex justify-between gap-2">
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => {
                  const newDigits = [...otpDigits];
                  newDigits[idx] = e.target.value;
                  setOtpDigits(newDigits);
                }}
                className="w-11 h-14 sm:w-13 sm:h-16 text-center text-xl font-black rounded-2xl border-2 border-slate-200 focus:border-[#F05A28] focus:outline-hidden text-slate-900 bg-slate-50"
              />
            ))}
          </div>

          <button
            onClick={() => onNavigateScreen('age-verify')}
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Verify & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center">
            <button
              onClick={() => showToast('New code sent via simulated SMS')}
              className="text-xs font-bold text-slate-600 hover:text-[#F05A28] cursor-pointer"
            >
              Didn't receive code? Resend in 30s
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 7. AGE & DOB WHEEL (FIGMA STEP 3: 18+ REQUIREMENT) =================
  if (currentScreen === 'age-verify') {
    const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const years = Array.from({ length: 50 }, (_, i) => String(2006 - i)); // 2006 = 18 years old in 2024

    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('verify-code')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 3 of 6</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight mb-1">
              What's your date of birth?
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              TopRide requires all travelers to be at least 18 years old.
            </p>
          </div>

          {/* Figma 3-Column Scroll Wheel Date Picker */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Day</span>
                <select
                  value={birthDay}
                  onChange={(e) => setBirthDay(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 text-sm focus:outline-hidden cursor-pointer"
                >
                  {days.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Month</span>
                <select
                  value={birthMonth}
                  onChange={(e) => setBirthMonth(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 text-sm focus:outline-hidden cursor-pointer"
                >
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Year</span>
                <select
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 text-sm focus:outline-hidden cursor-pointer"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 text-xs text-emerald-700 font-semibold justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Verified 18+ eligible ({2026 - parseInt(birthYear)} years old)</span>
            </div>
          </div>

          {/* Gender Question (Figma Step 4) */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              What is your gender?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'male', label: 'Male' },
                { id: 'female', label: 'Female' },
                { id: 'other', label: 'Other' },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGender(g.id as any)}
                  className={`py-3 px-2 rounded-2xl font-bold text-xs border transition-all cursor-pointer ${
                    gender === g.id
                      ? 'border-[#F05A28] bg-[#F05A28]/10 text-[#F05A28]'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateScreen('profile-photo')}
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 8. PROFILE PHOTO + 4 RULES CHECKLIST (FIGMA STEP 4/5) =================
  if (currentScreen === 'profile-photo') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('age-verify')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 4 of 6</span>
          </div>

          <div className="text-center">
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight mb-1">
              Add your profile photo
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              Helps drivers and passengers recognize each other at pickups.
            </p>
          </div>

          {/* Photo Preview Circle */}
          <div className="relative w-28 h-28 mx-auto">
            <div className={`w-full h-full rounded-full ${photoPresets[selectedPhotoPreset].bg} text-white font-black text-3xl flex items-center justify-center shadow-md`}>
              {photoPresets[selectedPhotoPreset].text}
            </div>
            <button
              onClick={() => showToast('File picker simulated — preset applied')}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#1A1D20] text-white flex items-center justify-center shadow-lg border-2 border-white hover:scale-105 transition-transform cursor-pointer"
              title="Upload photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Preset Styles */}
          <div className="flex justify-center gap-3">
            {photoPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedPhotoPreset(idx)}
                className={`w-9 h-9 rounded-full ${preset.bg} text-white text-xs font-bold transition-all cursor-pointer ${
                  selectedPhotoPreset === idx ? 'ring-4 ring-[#F05A28] ring-offset-2 scale-105' : 'opacity-70'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          {/* Figma 4 Photo Guidelines Checklist */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
              Photo Guidelines:
            </span>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Face clearly visible</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>No sunglasses or hats</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Solo photo (no groups)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>No pets or avatars</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateScreen('profile-bio')}
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Save photo & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 9. PROFILE DESCRIPTION & USAGE INTENT (FIGMA STEP 5) =================
  if (currentScreen === 'profile-bio') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 space-y-6">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('profile-photo')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 5 of 6</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight mb-1">
              Tell travelers about yourself
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              A short description builds trust and helps match compatible passengers.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Bio / About You
            </label>
            <textarea
              rows={3}
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm leading-relaxed"
              placeholder="e.g. Regular commuter between BLR and HYD, calm passenger..."
            />
            <span className="text-[11px] text-slate-400 mt-1 block text-right">
              {bioText.length}/300 characters
            </span>
          </div>

          {/* Figma Usage Intent Selector */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              How do you plan to use TopRide?
            </label>
            <div className="space-y-2">
              {[
                { id: 'passenger', title: 'Mostly as a passenger', desc: 'Find and book rides on existing routes' },
                { id: 'driver', title: 'Mostly as a driver', desc: 'Offer empty seats when traveling' },
                { id: 'both', title: 'Both equally', desc: 'Drive sometimes and ride as passenger' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setUsageIntent(opt.id as any)}
                  className={`w-full p-3.5 rounded-2xl text-left border transition-all cursor-pointer ${
                    usageIntent === opt.id
                      ? 'border-[#F05A28] bg-[#F05A28]/5 ring-1 ring-[#F05A28]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="font-bold text-xs text-slate-900">{opt.title}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => onNavigateScreen('profile-complete')}
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Complete Profile</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 10. PROFILE COMPLETION CONFIRMATION (FIGMA STEP 6) =================
  if (currentScreen === 'profile-complete') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#F8F9FA]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <Check className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Profile 100% Complete</span>
            </span>

            <h2 className="text-3xl font-black text-[#1A1D20] tracking-tight">
              You're all set, {name.split(' ')[0]}!
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
              Your TopRide account is verified. You can now search trips, book seats, post drives, and send luggage packages.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Phone verified:</span>
              <span className="font-bold text-slate-800">{countryCode} {rawPhone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Age:</span>
              <span className="font-bold text-slate-800">{2026 - parseInt(birthYear)} (18+ verified)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Mode:</span>
              <span className="font-bold text-[#F05A28] capitalize">{usageIntent}</span>
            </div>
          </div>

          <button
            onClick={async () => {
              try {
                const newUser = await api.signup({ 
                  name, 
                  email, 
                  password, 
                  phone: `${countryCode} ${rawPhone}`, 
                  bio: bioText 
                });
                onCompleteAuth({
                  ...newUser,
                  bio: bioText,
                  isVerified: true,
                });
                showToast('Welcome to TopRide!');
              } catch (err: any) {
                showToast(err.message || 'Signup failed. Please try again.');
              }
            }}
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>Go to TopRide Home</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
};
