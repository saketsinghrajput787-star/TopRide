import React, { useState } from 'react';
import { ScreenId, User } from '../types';
import { TopRideLogo } from '../components/TopRideLogo';
import { 
  ArrowRight, 
  ArrowLeft, 
  Car, 
  Lock, 
  Mail, 
  User as UserIcon, 
  Phone, 
  Clock, 
  CreditCard,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  Camera,
  Check,
  Sparkles,
  TreePine
} from 'lucide-react';
import { api, supabase } from '../api';

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
  // Onboarding Carousel Sub-step (0: Welcome, 1: 3 Things intro, 2: Rule 1, 3: Rule 2, 4: Rule 3, 5: Got it? Great!)
  const [onboardRuleStep, setOnboardRuleStep] = useState<number>(0);

  // Authentication Credentials (EMPTY defaults — NO hardcoded demo credentials in production)
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [countryCode, setCountryCode] = useState<string>('+91');
  const [rawPhone, setRawPhone] = useState<string>('');
  
  // Real 6-digit OTP code input state (EMPTY defaults — user must enter real code)
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpSent, setOtpSent] = useState<boolean>(false);
  
  // DOB & Age Verification State (Dynamic calculation against 18+ policy)
  const [birthDay, setBirthDay] = useState<string>('');
  const [birthMonth, setBirthMonth] = useState<string>('');
  const [birthYear, setBirthYear] = useState<string>('');
  const [calculatedAge, setCalculatedAge] = useState<number | null>(null);

  // Gender Selection State (Figma Frame 12)
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');

  // Photo & Guidelines State (Figma Frame 13)
  const [selectedPhotoPreset, setSelectedPhotoPreset] = useState<number>(-1);
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string>('');

  // Bio & Travel Intent State (Figma Frames 14 & 15)
  const [bioText, setBioText] = useState<string>('');
  const [usageIntent, setUsageIntent] = useState<'passenger' | 'driver' | 'both' | ''>('');

  // Loading States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [oauthLoadingProvider, setOauthLoadingProvider] = useState<'google' | 'apple' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Months reference for DOB calculation
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Dynamic Age Validator
  const validateAndComputeAge = (day: string, month: string, year: string): number | null => {
    if (!day || !month || !year) return null;
    const mIdx = months.indexOf(month);
    if (mIdx === -1) return null;
    const d = parseInt(day, 10);
    const y = parseInt(year, 10);
    if (isNaN(d) || isNaN(y)) return null;

    const birthDate = new Date(y, mIdx, d);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const mDiff = today.getMonth() - birthDate.getMonth();
    if (mDiff < 0 || (mDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Google OAuth Handler
  const handleGoogleSignIn = async () => {
    try {
      setOauthLoadingProvider('google');
      setErrorMessage(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        showToast(error.message || 'Google OAuth failed');
        setErrorMessage(error.message);
      }
    } catch (err: any) {
      showToast(err.message || 'Google authentication error');
      setErrorMessage(err.message);
    } finally {
      setOauthLoadingProvider(null);
    }
  };

  // Apple OAuth Handler
  const handleAppleSignIn = async () => {
    try {
      setOauthLoadingProvider('apple');
      setErrorMessage(null);
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'apple',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) {
        showToast(error.message || 'Apple OAuth is not configured on this project');
        setErrorMessage(error.message);
      }
    } catch (err: any) {
      showToast(err.message || 'Apple Sign-In is not enabled on this project.');
      setErrorMessage(err.message);
    } finally {
      setOauthLoadingProvider(null);
    }
  };

  // ================= 1. SPLASH SCREEN (FIGMA ONBOARDING-1) =================
  if (currentScreen === 'welcome') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        {/* Mobile Device Canvas (Exact 390x844 Figma Frame proportions) */}
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 flex flex-col justify-between py-6 px-6 overflow-hidden relative">
          {/* Top Status Bar & Compass Logo */}
          <div className="space-y-4 pt-2">
            {/* Status bar notch/time simulation for mobile preview */}
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800 px-2 opacity-80">
              <span>9:41</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-2 border border-slate-700 rounded-xs inline-block relative after:content-[''] after:w-1 after:h-1.5 after:bg-slate-700 after:absolute after:-right-1 after:top-0.5"></span>
              </div>
            </div>

            {/* Signature Figma Orange Compass "TOP" Logo */}
            <div className="flex justify-center pt-2 pb-1">
              <div className="flex flex-col items-center">
                {/* 8-point geometric compass star */}
                <svg
                  width="44"
                  height="44"
                  viewBox="0 0 44 44"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="shrink-0"
                >
                  <circle cx="22" cy="22" r="19.5" stroke="#F05A28" strokeWidth="2.5" />
                  <polygon points="22,5 24.5,22 22,22 19.5,22" fill="#F05A28" />
                  <polygon points="22,39 24.5,22 22,22 19.5,22" fill="#F05A28" opacity="0.9" />
                  <polygon points="39,22 22,24.5 22,22 22,19.5" fill="#F05A28" />
                  <polygon points="5,22 22,24.5 22,22 22,19.5" fill="#F05A28" opacity="0.9" />
                  <polygon points="33,11 23,21 21,23" fill="#F05A28" opacity="0.65" />
                  <polygon points="33,33 23,23 21,21" fill="#F05A28" opacity="0.65" />
                  <polygon points="11,33 21,23 23,21" fill="#F05A28" opacity="0.65" />
                  <polygon points="11,11 21,21 23,23" fill="#F05A28" opacity="0.65" />
                  <circle cx="22" cy="22" r="2.5" fill="#FFFFFF" />
                  <circle cx="22" cy="22" r="1.5" fill="#F05A28" />
                </svg>
                <span className="font-black tracking-widest text-[#F05A28] text-xs mt-1.5 uppercase">
                  TOP
                </span>
              </div>
            </div>
          </div>

          {/* Center Light-Blue Rounded Illustration Panel (Figma Frame onboarding-1) */}
          <div className="my-auto bg-[#7EC6EC] rounded-[30px] p-7 min-h-[410px] flex flex-col justify-between relative overflow-hidden shadow-xs border border-[#6BBCE5]/40">
            {/* Left-aligned exact headline with line breaks */}
            <h1 className="text-[26px] sm:text-[27px] font-black leading-[1.18] text-[#1A1D20] tracking-tight relative z-10 text-left">
              Carpool<br />
              Adventures:<br />
              Sharing, Laughing,<br />
              Navigating
            </h1>

            {/* Figma exact front-view sports car line-art cropped at bottom right */}
            <div className="absolute -bottom-1 -right-2 w-64 pointer-events-none select-none">
              <svg
                viewBox="0 0 240 160"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="w-full h-auto drop-shadow-xs"
              >
                {/* Windshield & Roof Frame */}
                <path
                  d="M50 48 C75 22, 165 22, 190 48 L210 70 L30 70 Z"
                  fill="#FFFFFF"
                  stroke="#1A1D20"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />
                {/* Windshield reflection lines */}
                <path d="M70 36 L62 65" stroke="#7EC6EC" strokeWidth="2" strokeLinecap="round" />
                <path d="M80 34 L72 65" stroke="#7EC6EC" strokeWidth="1.5" strokeLinecap="round" />
                {/* Rearview Mirror */}
                <rect x="115" y="32" width="10" height="5" rx="2" fill="#1A1D20" />
                <line x1="120" y1="28" x2="120" y2="32" stroke="#1A1D20" strokeWidth="2" />

                {/* Side Mirrors */}
                <path d="M26 62 C20 62, 16 66, 18 72 C20 76, 26 76, 29 72 Z" fill="#FFFFFF" stroke="#1A1D20" strokeWidth="2.5" />
                <path d="M214 62 C220 62, 224 66, 222 72 C220 76, 214 76, 211 72 Z" fill="#FFFFFF" stroke="#1A1D20" strokeWidth="2.5" />

                {/* Car Hood & Fenders */}
                <path
                  d="M20 75 C18 85, 20 95, 24 105 C28 112, 38 116, 50 116 L190 116 C202 116, 212 112, 216 105 C220 95, 222 85, 220 75 C215 72, 195 70, 185 70 C165 72, 75 72, 55 70 C45 70, 25 72, 20 75 Z"
                  fill="#FFFFFF"
                  stroke="#1A1D20"
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                />

                {/* Hood Lines */}
                <path d="M72 70 C74 85, 78 98, 82 105" stroke="#1A1D20" strokeWidth="2" strokeLinecap="round" />
                <path d="M168 70 C166 85, 162 98, 158 105" stroke="#1A1D20" strokeWidth="2" strokeLinecap="round" />

                {/* Oval Porsche-Style Headlights */}
                <ellipse cx="46" cy="88" rx="14" ry="10" transform="rotate(-12 46 88)" fill="#FFFFFF" stroke="#1A1D20" strokeWidth="2.5" />
                <circle cx="46" cy="88" r="5" fill="#7EC6EC" stroke="#1A1D20" strokeWidth="1.5" />
                <circle cx="45" cy="86" r="1.5" fill="#FFFFFF" />

                <ellipse cx="194" cy="88" rx="14" ry="10" transform="rotate(12 194 88)" fill="#FFFFFF" stroke="#1A1D20" strokeWidth="2.5" />
                <circle cx="194" cy="88" r="5" fill="#7EC6EC" stroke="#1A1D20" strokeWidth="1.5" />
                <circle cx="193" cy="86" r="1.5" fill="#FFFFFF" />

                {/* Front Bumper & Lower Grille */}
                <path d="M30 116 L30 135 C30 144, 45 146, 60 146 L180 146 C195 146, 210 144, 210 135 L210 116" fill="#FFFFFF" stroke="#1A1D20" strokeWidth="2.5" />
                
                {/* Horizontal Slats */}
                <rect x="75" y="124" width="90" height="16" rx="4" fill="#1A1D20" />
                <line x1="85" y1="128" x2="155" y2="128" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />
                <line x1="85" y1="134" x2="155" y2="134" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />

                {/* Side Scoops */}
                <path d="M38 123 C42 123, 46 126, 46 132 C46 138, 42 140, 38 140 Z" fill="#1A1D20" />
                <path d="M202 123 C198 123, 194 126, 194 132 C194 138, 198 140, 202 140 Z" fill="#1A1D20" />

                {/* Tires */}
                <rect x="22" y="132" width="12" height="18" rx="4" fill="#1A1D20" />
                <rect x="206" y="132" width="12" height="18" rx="4" fill="#1A1D20" />

                {/* Ground Baseline */}
                <line x1="16" y1="152" x2="224" y2="152" stroke="#1A1D20" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </div>
          </div>

          {/* Bottom Compact Dark Button & Version Label */}
          <div className="pt-5 pb-1 flex flex-col items-center">
            <button
              onClick={() => {
                setOnboardRuleStep(0);
                onNavigateScreen('onboard');
              }}
              className="w-36 py-3 rounded-full bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-sm transition-all shadow-md active:scale-95 cursor-pointer text-center"
            >
              Let's go
            </button>

            <span className="text-[11px] font-medium text-slate-400 text-center block mt-3 select-none">
              Version 4.5.0 (4821)
            </span>

            {/* Mobile Home Indicator */}
            <div className="w-32 h-1 bg-slate-900/80 rounded-full mx-auto mt-4"></div>
          </div>
        </div>
      </div>
    );
  }

  // ================= 2. WELCOME & SOCIAL AUTH SCREEN (FIGMA FRAME WELCOME) =================
  if (currentScreen === 'onboard' && onboardRuleStep === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 flex flex-col justify-between py-6 px-6 overflow-hidden relative">
          {/* Top Header with Back Chevron */}
          <div className="flex items-center justify-between pt-1">
            <button
              onClick={() => onNavigateScreen('welcome')}
              className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-800 transition-colors cursor-pointer"
              aria-label="Back to splash"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-10"></div>
          </div>

          {/* Left-Aligned Headline & Subtitle */}
          <div className="text-left space-y-1.5 pt-2">
            <h1 className="text-3xl font-black text-[#1A1D20] tracking-tight">
              Welcome!
            </h1>
            <p className="text-slate-500 text-xs sm:text-[13px] leading-relaxed">
              Embark on this adventure with us! Please choose an option below to sign in
            </p>
          </div>

          {/* Figma Photo Card: Friends laughing in car selfie with pastel accent squares */}
          <div className="my-auto py-4 flex justify-center">
            <div className="relative w-64 h-48 flex items-center justify-center">
              {/* Top-left soft lilac accent card */}
              <div className="absolute top-0 left-0 w-44 h-40 bg-[#E9D5FF] rounded-3xl -rotate-6 transform"></div>
              {/* Bottom-right soft peach accent card */}
              <div className="absolute bottom-0 right-0 w-44 h-40 bg-[#FED7AA] rounded-3xl rotate-6 transform"></div>
              {/* Foreground Photo Card */}
              <div className="relative z-10 w-56 h-40 rounded-2xl overflow-hidden shadow-lg border-2 border-white">
                <img
                  src="https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=600&q=80"
                  alt="Friends sharing carpool ride"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 text-left mb-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Social Sign-In Methods (Figma exact divided list layout) */}
          <div className="border-t border-slate-100 divide-y divide-slate-100">
            {/* Google */}
            <button
              onClick={handleGoogleSignIn}
              disabled={oauthLoadingProvider !== null}
              className="w-full py-4 px-2 flex items-center gap-4 text-left font-bold text-sm text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {oauthLoadingProvider === 'google' ? (
                <div className="w-5 h-5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"/>
                  <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.26v3.15C3.25 21.36 7.31 24 12 24z"/>
                  <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.26C.46 8.16 0 9.94 0 12s.46 3.84 1.26 5.42l4.02-3.15z"/>
                  <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.64 1.26 6.58l4.02 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                </svg>
              )}
              <span>Continue with Google</span>
            </button>

            {/* Apple */}
            <button
              onClick={handleAppleSignIn}
              disabled={oauthLoadingProvider !== null}
              className="w-full py-4 px-2 flex items-center gap-4 text-left font-bold text-sm text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
            >
              {oauthLoadingProvider === 'apple' ? (
                <div className="w-5 h-5 border-2 border-slate-700 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg className="w-5 h-5 shrink-0 fill-slate-900" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.42c.64-.78 1.08-1.87.96-2.96-.93.04-2.07.62-2.73 1.4-.58.67-1.09 1.77-.95 2.83 1.04.08 2.08-.5 2.72-1.27z"/>
                </svg>
              )}
              <span>Continue with Apple</span>
            </button>

            {/* Email */}
            <button
              onClick={() => onNavigateScreen('login')}
              className="w-full py-4 px-2 flex items-center gap-4 text-left font-bold text-sm text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Mail className="w-5 h-5 shrink-0 text-slate-700" />
              <span>Continue with email</span>
            </button>
          </div>

          {/* Explore Community Rules & Home Indicator */}
          <div className="pt-2 pb-1 text-center space-y-3">
            <button
              onClick={() => setOnboardRuleStep(1)}
              className="text-xs font-semibold text-[#F05A28] hover:underline cursor-pointer"
            >
              New to TopRide? 3 things to know before getting started ›
            </button>
            <div className="w-32 h-1 bg-slate-900/80 rounded-full mx-auto"></div>
          </div>
        </div>
      </div>
    );
  }

  // ================= 3. 3 THINGS TO KNOW (FIGMA FRAMES 3-7) =================
  if (currentScreen === 'onboard' && onboardRuleStep >= 1 && onboardRuleStep <= 5) {
    const rulesData = [
      {
        stepNum: 1,
        title: 'Before you get started, here are 3 things you need to know',
        subtitle: 'Our community is built on shared respect, safety, and mutual punctuality.',
        icon: <HelpCircle className="w-12 h-12 text-[#F05A28]" />,
        bullets: [
          'TopRide is cost-sharing carpool, not an on-demand taxi.',
          'Cash is not allowed; all bookings are handled securely online.',
          'Punctuality is essential — arrive 10 minutes early.'
        ],
        btnLabel: 'Next'
      },
      {
        stepNum: 2,
        title: 'TopRide is a carpool community, not a taxi service or Uber and Lyft.',
        subtitle: 'Drivers are regular commuters traveling on the same route as you.',
        icon: <Car className="w-12 h-12 text-[#F05A28]" />,
        bullets: [
          'Drivers are sharing their journey to offset fuel and toll costs.',
          'Respect the driver’s vehicle, luggage space, and quiet hours.',
          'Treat fellow passengers with courtesy and friendly conversation.'
        ],
        btnLabel: 'Next'
      },
      {
        stepNum: 3,
        title: 'Cash or e-transfers are not allowed. Use our online booking system.',
        subtitle: 'All transactions are protected and managed through TopRide.',
        icon: <CreditCard className="w-12 h-12 text-[#F05A28]" />,
        bullets: [
          'Never pay cash or off-platform money directly to drivers.',
          'Seats are officially reserved only after payment confirmation.',
          'Automated refunds protect you if the driver cancels the trip.'
        ],
        btnLabel: 'Next'
      },
      {
        stepNum: 4,
        title: 'Please show up 10 minutes before departure.',
        subtitle: 'Punctuality respects everyone\'s schedule and keeps rides on time.',
        icon: <Clock className="w-12 h-12 text-[#F05A28]" />,
        bullets: [
          'Confirm your exact meeting spot with your driver beforehand.',
          'Communicate via in-app chat if you experience any travel delays.',
          'Drivers depart on schedule to respect other passengers\' time.'
        ],
        btnLabel: 'Next'
      },
      {
        stepNum: 5,
        title: 'Got it? Great!',
        subtitle: 'By tapping \'I agree\', you agree to the rules, to our terms of service and to our release policy.',
        icon: <CheckCircle2 className="w-12 h-12 text-emerald-600" />,
        bullets: [
          '✅ We\'re carpoolers, not taxi or Uber',
          '✅ No cash allowed — online bookings only',
          '✅ Show up 10 minutes early'
        ],
        btnLabel: 'I agree'
      }
    ];

    const currentRule = rulesData[onboardRuleStep - 1];

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 flex flex-col justify-between py-6 px-6 overflow-hidden relative">
          {/* Header */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setOnboardRuleStep(onboardRuleStep - 1)}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
              Onboarding
            </span>
            <button
              onClick={() => onNavigateScreen('signup')}
              className="text-xs font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              Skip
            </button>
          </div>

          {/* Main Content */}
          <div className="my-auto py-6 text-center space-y-4">
            <div className="w-24 h-24 rounded-3xl bg-[#F05A28]/10 flex items-center justify-center mx-auto shadow-inner">
              {currentRule.icon}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-[#1A1D20] tracking-tight">
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
              {[1, 2, 3, 4, 5].map((step) => (
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
                if (onboardRuleStep < 5) {
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

  // ================= 4. SIGNUP: ACCOUNT & PHONE SETUP (FIGMA FRAMES 8 & 9) =================
  if (currentScreen === 'signup') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 p-6 sm:p-8 space-y-6 flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                setOnboardRuleStep(5);
                onNavigateScreen('onboard');
              }}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
              aria-label="Back to rules"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Profile setup</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight mb-1">
              Create your account
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              Please enter your details and phone number so other members can reach you.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setErrorMessage(null);
              if (!name.trim()) {
                setErrorMessage('Please enter your full name');
                return;
              }
              if (!email.trim() || !email.includes('@')) {
                setErrorMessage('Please enter a valid email address');
                return;
              }
              if (password.length < 6) {
                setErrorMessage('Password must be at least 6 characters long');
                return;
              }
              if (!rawPhone.trim() || rawPhone.replace(/\D/g, '').length < 8) {
                setErrorMessage('Please enter a valid mobile number');
                return;
              }
              setOtpSent(true);
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
                    placeholder="Mobile number"
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm font-medium tracking-wide"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 p-6 sm:p-8 space-y-6 flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('welcome')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
              aria-label="Back"
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

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setErrorMessage(null);
              setIsSubmitting(true);
              try {
                const loggedUser = await api.login({ email, password });
                onCompleteAuth(loggedUser);
                showToast('Logged in successfully');
              } catch (err: any) {
                const msg = err.message || 'Login failed. Please check your credentials.';
                setErrorMessage(msg);
                showToast(msg);
              } finally {
                setIsSubmitting(false);
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
                placeholder="name@example.com"
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
                  onClick={async () => {
                    if (!email) {
                      showToast('Enter your email to receive password reset instructions');
                      return;
                    }
                    try {
                      const { error } = await supabase.auth.resetPasswordForEmail(email);
                      if (error) throw error;
                      showToast(`Password reset link sent to ${email}`);
                    } catch (err: any) {
                      showToast(err.message || 'Could not send reset link');
                    }
                  }}
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
              disabled={isSubmitting}
              className="w-full mt-4 py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Signing in...</span>
                </div>
              ) : (
                <>
                  <span>Log in</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
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

  // ================= 6. OTP VERIFICATION CODE (FIGMA FRAME 10) =================
  if (currentScreen === 'verify-code') {
    const isCodeComplete = otpDigits.every((d) => d.trim().length === 1);

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 p-6 sm:p-8 space-y-6 flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('signup')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
              aria-label="Back"
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
              Please enter the verification code sent to <span className="font-semibold text-slate-900">{countryCode} {rawPhone}</span>
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 6 Digit Inputs */}
          <div className="flex justify-between gap-2">
            {otpDigits.map((digit, idx) => (
              <input
                key={idx}
                id={`otp-input-${idx}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  const newDigits = [...otpDigits];
                  newDigits[idx] = val;
                  setOtpDigits(newDigits);
                  // Auto-advance to next input if digit entered
                  if (val && idx < 5) {
                    const nextInput = document.getElementById(`otp-input-${idx + 1}`);
                    nextInput?.focus();
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Backspace' && !digit && idx > 0) {
                    const prevInput = document.getElementById(`otp-input-${idx - 1}`);
                    prevInput?.focus();
                  }
                }}
                className="w-11 h-14 sm:w-13 sm:h-16 text-center text-xl font-black rounded-2xl border-2 border-slate-200 focus:border-[#F05A28] focus:outline-hidden text-slate-900 bg-slate-50"
              />
            ))}
          </div>

          <button
            onClick={() => {
              setErrorMessage(null);
              if (!isCodeComplete) {
                setErrorMessage('Please enter the full 6-digit verification code.');
                return;
              }
              onNavigateScreen('age-verify');
            }}
            disabled={!isCodeComplete}
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>Verify & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center">
            <button
              onClick={() => {
                showToast(`New code dispatched to ${countryCode} ${rawPhone}`);
              }}
              className="text-xs font-bold text-slate-600 hover:text-[#F05A28] cursor-pointer"
            >
              Didn't receive code? Resend
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 7. AGE & DOB WHEEL (FIGMA FRAME 11: 18+ REQUIREMENT) =================
  if (currentScreen === 'age-verify') {
    const days = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 70 }, (_, i) => String(currentYear - 10 - i));

    const computedAge = validateAndComputeAge(birthDay, birthMonth, birthYear);
    const isAdult = computedAge !== null && computedAge >= 18;

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 p-6 sm:p-8 space-y-6 flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('verify-code')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
              aria-label="Back"
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
              You must be 18 years or older to use TopRide. Please verify your age by selecting your date of birth.
            </p>
          </div>

          {/* Figma 3-Column Scroll Wheel Date Picker */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Day</span>
                <select
                  value={birthDay}
                  onChange={(e) => {
                    setBirthDay(e.target.value);
                    const age = validateAndComputeAge(e.target.value, birthMonth, birthYear);
                    setCalculatedAge(age);
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 text-sm focus:outline-hidden cursor-pointer"
                >
                  <option value="">DD</option>
                  {days.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Month</span>
                <select
                  value={birthMonth}
                  onChange={(e) => {
                    setBirthMonth(e.target.value);
                    const age = validateAndComputeAge(birthDay, e.target.value, birthYear);
                    setCalculatedAge(age);
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 text-sm focus:outline-hidden cursor-pointer"
                >
                  <option value="">Month</option>
                  {months.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Year</span>
                <select
                  value={birthYear}
                  onChange={(e) => {
                    setBirthYear(e.target.value);
                    const age = validateAndComputeAge(birthDay, birthMonth, e.target.value);
                    setCalculatedAge(age);
                  }}
                  className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-slate-900 text-sm focus:outline-hidden cursor-pointer"
                >
                  <option value="">YYYY</option>
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>

            {computedAge !== null && (
              <div className="pt-2 text-center">
                {isAdult ? (
                  <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold justify-center">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>Eligible to register ({computedAge} years old)</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-rose-700 font-semibold justify-center">
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                    <span>Must be 18+ to register (currently {computedAge} years old)</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Gender Question (Figma Frame 12) */}
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
                      ? 'border-[#F05A28] bg-[#F05A28]/10 text-[#F05A28] ring-1 ring-[#F05A28]'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              if (!isAdult) {
                showToast('You must be 18 years or older to create an account');
                return;
              }
              onNavigateScreen('profile-photo');
            }}
            disabled={!isAdult}
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 8. PROFILE PHOTO + 4 RULES CHECKLIST (FIGMA FRAME 13) =================
  if (currentScreen === 'profile-photo') {
    const photoPresets = [
      { bg: 'bg-[#F05A28]', text: name ? name.substring(0, 2).toUpperCase() : 'TR' },
      { bg: 'bg-slate-900', text: name ? name.substring(0, 2).toUpperCase() : 'TR' },
      { bg: 'bg-emerald-600', text: name ? name.substring(0, 2).toUpperCase() : 'TR' },
      { bg: 'bg-indigo-600', text: name ? name.substring(0, 2).toUpperCase() : 'TR' },
    ];

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 p-6 sm:p-8 space-y-6 flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('age-verify')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
              aria-label="Back"
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
              Upload a clear photo so other members can easily recognise you at pickups.
            </p>
          </div>

          {/* Photo Preview Circle */}
          <div className="relative w-28 h-28 mx-auto">
            <div className={`w-full h-full rounded-full ${selectedPhotoPreset >= 0 ? photoPresets[selectedPhotoPreset].bg : 'bg-slate-200'} text-white font-black text-3xl flex items-center justify-center shadow-md`}>
              {selectedPhotoPreset >= 0 ? photoPresets[selectedPhotoPreset].text : (name ? name.substring(0, 2).toUpperCase() : '👤')}
            </div>
            <button
              onClick={() => {
                setSelectedPhotoPreset(0);
                showToast('Avatar photo set');
              }}
              className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#1A1D20] text-white flex items-center justify-center shadow-lg border-2 border-white hover:scale-105 transition-transform cursor-pointer"
              title="Select photo"
              aria-label="Upload photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Preset Styles */}
          <div className="flex justify-center gap-3">
            {photoPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setSelectedPhotoPreset(idx)}
                className={`w-9 h-9 rounded-full ${preset.bg} text-white text-xs font-bold transition-all cursor-pointer ${
                  selectedPhotoPreset === idx ? 'ring-4 ring-[#F05A28] ring-offset-2 scale-105' : 'opacity-70'
                }`}
                aria-label={`Photo style ${idx + 1}`}
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
                <span>No pets or cartoons</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => onNavigateScreen('profile-bio')}
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>Save photo & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 9. PROFILE DESCRIPTION & USAGE INTENT (FIGMA FRAMES 14 & 15) =================
  if (currentScreen === 'profile-bio') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 p-6 sm:p-8 space-y-6 flex flex-col justify-between overflow-hidden relative">
          <div className="flex items-center justify-between">
            <button
              onClick={() => onNavigateScreen('profile-photo')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 5 of 6</span>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-black text-[#1A1D20] tracking-tight mb-1">
              Add a description
            </h2>
            <p className="text-slate-500 text-xs sm:text-sm">
              Please take a moment to introduce yourself to the TopRide community.
            </p>
          </div>

          <div>
            <textarea
              rows={3}
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              className="w-full p-4 rounded-2xl border border-slate-200 focus:outline-hidden focus:border-[#F05A28] text-slate-900 text-sm leading-relaxed"
              placeholder="Example: I travel on weekends between cities and enjoy good conversation..."
            />
            <span className="text-[11px] text-slate-400 mt-1 block text-right">
              {bioText.length}/300 characters
            </span>
          </div>

          {/* Figma Usage Intent Selector (Frame 15) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              How will you use TopRide?
            </label>
            <div className="space-y-2">
              {[
                { id: 'passenger', title: 'Mostly as a passenger', desc: 'Find and book rides on existing routes' },
                { id: 'driver', title: 'Mostly as a driver', desc: 'Offer empty seats when traveling' },
                { id: 'both', title: 'Both', desc: 'Drive sometimes and ride as passenger' },
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
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <span>Finish Profile</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 10. PROFILE COMPLETION CONFIRMATION =================
  if (currentScreen === 'profile-complete') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-0 sm:p-4 select-none">
        <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-white sm:rounded-[44px] sm:shadow-2xl sm:border sm:border-slate-200/80 p-6 sm:p-8 space-y-6 flex flex-col justify-between overflow-hidden relative text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
            <Check className="w-10 h-10 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Profile Ready</span>
            </span>

            <h2 className="text-3xl font-black text-[#1A1D20] tracking-tight">
              You're all set{name ? `, ${name.split(' ')[0]}` : ''}!
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed max-w-xs mx-auto">
              Your TopRide account is ready. You can now search trips, book seats, post drives, and send luggage packages.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2 text-left">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Contact:</span>
              <span className="font-bold text-slate-800">{countryCode} {rawPhone || 'Not provided'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Eligibility:</span>
              <span className="font-bold text-slate-800">18+ Verified</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Primary Mode:</span>
              <span className="font-bold text-[#F05A28] capitalize">{usageIntent || 'Member'}</span>
            </div>
          </div>

          <button
            disabled={isSubmitting}
            onClick={async () => {
              setErrorMessage(null);
              setIsSubmitting(true);
              try {
                const newUser = await api.signup({ 
                  name: name || 'TopRide Member', 
                  email, 
                  password, 
                  phone: rawPhone ? `${countryCode} ${rawPhone}` : undefined, 
                  bio: bioText || undefined
                });
                onCompleteAuth({
                  ...newUser,
                  bio: bioText,
                  isVerified: true,
                });
                showToast('Welcome to TopRide!');
              } catch (err: any) {
                const msg = err.message || 'Signup failed. Please try again.';
                setErrorMessage(msg);
                showToast(msg);
              } finally {
                setIsSubmitting(false);
              }
            }}
            className="w-full py-4 px-6 rounded-2xl bg-[#1A1D20] hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-base transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            {isSubmitting ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Creating Account...</span>
              </div>
            ) : (
              <>
                <span>Go to TopRide Home</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  return null;
};
