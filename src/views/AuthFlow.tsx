import React, { useState } from 'react';
import { ScreenId, User } from '../types';
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
  Clock
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
  // Onboarding Carousel State
  const [onboardSlide, setOnboardSlide] = useState(0);

  // Form State
  const [email, setEmail] = useState('demo@topride.app');
  const [password, setPassword] = useState('somepassword123');
  const [name, setName] = useState('Saket Kumar');
  const [phone, setPhone] = useState('+91 98765 43210');
  
  // Verification code state (6 boxes)
  const [otpDigits, setOtpDigits] = useState(['4', '8', '2', '1', '9', '0']);
  const [isAgeVerified, setIsAgeVerified] = useState<boolean | null>(null);
  const [selectedPhotoPreset, setSelectedPhotoPreset] = useState<number>(0);
  const [bioText, setBioText] = useState('Friendly traveler and software developer. I travel regularly between Bengaluru and Hyderabad.');

  const onboardSlides = [
    {
      title: 'Move together. Go further.',
      desc: 'Fill empty seats in your car or find a comfortable, affordable ride with verified travelers on any route.',
      icon: <Car className="w-12 h-12 text-slate-900" />,
      tag: 'Smart Carpooling',
    },
    {
      title: 'Send luggage securely',
      desc: 'Have a package, documents, or personal belongings to send? Match with travelers already heading that way.',
      icon: <Package className="w-12 h-12 text-slate-900" />,
      tag: 'P2P Logistics',
    },
    {
      title: 'Verified & Trusted community',
      desc: 'Government ID verification, student badges, driver ratings, and safe mock payments built in.',
      icon: <Users className="w-12 h-12 text-slate-900" />,
      tag: '100% Safe Travel',
    },
  ];

  const photoPresets = [
    { label: 'Avatar 1', bg: 'bg-emerald-600', text: 'SK' },
    { label: 'Avatar 2', bg: 'bg-indigo-600', text: 'SK' },
    { label: 'Avatar 3', bg: 'bg-amber-600', text: 'SK' },
    { label: 'Avatar 4', bg: 'bg-slate-800', text: 'SK' },
  ];

  // ================= 1. WELCOME SCREEN =================
  if (currentScreen === 'welcome') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f8f9fa]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center">
          {/* Logo */}
          <div className="w-20 h-20 rounded-3xl bg-slate-950 text-white flex items-center justify-center font-black text-3xl mx-auto mb-6 shadow-md">
            TOP
          </div>
          <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold tracking-wider uppercase mb-3">
            TopRide Platform
          </span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-950 tracking-tight leading-tight mb-3">
            Move together.<br />Go further.
          </h1>
          <p className="text-slate-500 text-sm sm:text-base leading-relaxed mb-8 max-w-xs mx-auto">
            Share rides, find passengers, send luggage and travel smarter between cities and destinations.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => onNavigateScreen('onboard')}
              className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Get started</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigateScreen('login')}
              className="w-full py-4 px-6 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-base border border-slate-200 transition-all cursor-pointer"
            >
              I already have an account
            </button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-center gap-4 text-xs text-slate-400">
            <span>Verified community</span>
            <span>•</span>
            <span>Zero hidden fees</span>
            <span>•</span>
            <span>Safe travel</span>
          </div>
        </div>
      </div>
    );
  }

  // ================= 2. ONBOARDING CAROUSEL =================
  if (currentScreen === 'onboard') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f8f9fa]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 flex flex-col justify-between min-h-[580px]">
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
              {onboardSlide + 1} / {onboardSlides.length}
            </span>
            <button
              onClick={() => onNavigateScreen('welcome')}
              className="text-sm font-semibold text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              Skip
            </button>
          </div>

          {/* Slide Content */}
          <div className="my-auto py-8 text-center">
            <div className="w-24 h-24 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto mb-6 shadow-inner">
              {onboardSlides[onboardSlide].icon}
            </div>
            <span className="inline-block px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-3">
              {onboardSlides[onboardSlide].tag}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-3">
              {onboardSlides[onboardSlide].title}
            </h2>
            <p className="text-slate-500 text-sm sm:text-base leading-relaxed max-w-sm mx-auto">
              {onboardSlides[onboardSlide].desc}
            </p>
          </div>

          {/* Dots & Navigation */}
          <div>
            <div className="flex items-center justify-center gap-2 mb-6">
              {onboardSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setOnboardSlide(i)}
                  className={`h-2 rounded-full transition-all cursor-pointer ${
                    i === onboardSlide ? 'w-8 bg-slate-950' : 'w-2 bg-slate-200'
                  }`}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>

            <button
              onClick={() => {
                if (onboardSlide < onboardSlides.length - 1) {
                  setOnboardSlide(onboardSlide + 1);
                } else {
                  onNavigateScreen('signup');
                }
              }}
              className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{onboardSlide === onboardSlides.length - 1 ? 'Create Account' : 'Continue'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 3. SIGNUP SCREEN =================
  if (currentScreen === 'signup') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f8f9fa]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onNavigateScreen('onboard')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 1 of 5</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-2">
            Create your account
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            Join verified drivers, passengers, and travelers across India and beyond.
          </p>

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
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-950 text-slate-900 text-sm font-medium"
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
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-950 text-slate-900 text-sm font-medium"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Phone Number
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-950 text-slate-900 text-sm font-medium"
                />
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
                  placeholder="At least 8 characters"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-950 text-slate-900 text-sm font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue to verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Already have an account?{' '}
            <button
              onClick={() => onNavigateScreen('login')}
              className="font-bold text-slate-900 hover:underline cursor-pointer"
            >
              Log in
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ================= 4. LOGIN SCREEN =================
  if (currentScreen === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f8f9fa]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onNavigateScreen('welcome')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-white font-black text-xs">
              TOP
            </div>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-2">
            Welcome back
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            Sign in to manage your rides, bookings, and messages.
          </p>

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
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-950 text-slate-900 text-sm font-medium"
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
                className="w-full px-4 py-3.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-950 text-slate-900 text-sm font-medium"
              />
            </div>

            <button
              type="submit"
              className="w-full mt-4 py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Log in</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Don't have an account?{' '}
              <button
                onClick={() => onNavigateScreen('signup')}
                className="font-bold text-slate-900 hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ================= 5. VERIFICATION CODE UI (WITHOUT REAL SMS) =================
  if (currentScreen === 'verify-code') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f8f9fa]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onNavigateScreen('signup')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 2 of 5</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-2">
            Enter 6-digit code
          </h2>
          <p className="text-slate-500 text-sm mb-4">
            We sent a verification code to <span className="font-semibold text-slate-900">{phone}</span>.
          </p>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 mb-6 flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 text-amber-600" />
            <span>SMS simulation mode: pre-filled demo code <strong>482190</strong>.</span>
          </div>

          {/* 6 Digit Input Boxes */}
          <div className="flex justify-between gap-2 mb-6">
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
                className="w-12 h-14 sm:w-14 sm:h-16 text-center text-xl font-black rounded-xl border-2 border-slate-200 focus:border-slate-950 focus:outline-hidden text-slate-900 bg-slate-50"
              />
            ))}
          </div>

          <button
            onClick={() => onNavigateScreen('age-verify')}
            className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Verify & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="mt-6 text-center">
            <button
              onClick={() => showToast('New code sent via simulated SMS')}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Didn't receive code? Resend (30s)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= 6. AGE VERIFICATION (18+) =================
  if (currentScreen === 'age-verify') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f8f9fa]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onNavigateScreen('verify-code')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 3 of 5</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-2">
            Are you 18 or older?
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            TopRide community safety rules require all drivers, passengers, and senders to meet the minimum age requirement.
          </p>

          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setIsAgeVerified(true)}
              className={`p-5 rounded-2xl text-left border-2 transition-all cursor-pointer ${
                isAgeVerified === true
                  ? 'border-slate-950 bg-slate-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold mb-3">
                18+
              </div>
              <div className="font-bold text-slate-900 text-base">Yes, I am</div>
              <div className="text-xs text-slate-500 mt-0.5">I am 18 years or older</div>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAgeVerified(false);
                showToast('Users under 18 cannot create an independent account');
              }}
              className={`p-5 rounded-2xl text-left border-2 transition-all cursor-pointer ${
                isAgeVerified === false
                  ? 'border-rose-500 bg-rose-50'
                  : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold mb-3">
                &lt;18
              </div>
              <div className="font-bold text-slate-900 text-base">No, I'm under 18</div>
              <div className="text-xs text-slate-500 mt-0.5">Not eligible yet</div>
            </button>
          </div>

          <button
            disabled={isAgeVerified !== true}
            onClick={() => onNavigateScreen('profile-photo')}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer ${
              isAgeVerified === true
                ? 'bg-slate-950 hover:bg-slate-800 text-white'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <span>Confirm & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 7. ADD PROFILE PICTURE =================
  if (currentScreen === 'profile-photo') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f8f9fa]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onNavigateScreen('age-verify')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 4 of 5</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-2">
            Add your profile photo
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            A clear photo helps travelers recognize you at pickup points.
          </p>

          {/* Avatar Preview */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            <div className={`w-full h-full rounded-full ${photoPresets[selectedPhotoPreset].bg} text-white font-black text-4xl flex items-center justify-center shadow-md`}>
              {photoPresets[selectedPhotoPreset].text}
            </div>
            <button
              onClick={() => showToast('File picker simulated — preset applied')}
              className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-slate-950 text-white flex items-center justify-center shadow-lg border-2 border-white hover:scale-105 transition-transform cursor-pointer"
              title="Upload photo"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          {/* Preset Styles */}
          <div className="flex justify-center gap-3 mb-8">
            {photoPresets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedPhotoPreset(idx)}
                className={`w-10 h-10 rounded-full ${preset.bg} text-white text-xs font-bold transition-all cursor-pointer ${
                  selectedPhotoPreset === idx ? 'ring-4 ring-slate-950 ring-offset-2 scale-105' : 'opacity-70'
                }`}
              >
                {idx + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => onNavigateScreen('profile-bio')}
            className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Save photo & Continue</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 8. PROFILE DESCRIPTION / BIO =================
  if (currentScreen === 'profile-bio') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f8f9fa]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => onNavigateScreen('profile-photo')}
              className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 hover:bg-slate-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-slate-400">Step 5 of 5</span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black text-slate-950 tracking-tight mb-2">
            Tell travelers about you
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            Share a short note about your travel habits, interests, or general travel style.
          </p>

          <div className="mb-6">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Bio / About Me
            </label>
            <textarea
              rows={4}
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
              className="w-full p-4 rounded-xl border border-slate-200 focus:outline-hidden focus:border-slate-950 text-slate-900 text-sm leading-relaxed"
              placeholder="e.g. Daily commuter, love acoustic music, quiet passenger..."
            />
            <span className="text-xs text-slate-400 mt-1 block">
              {bioText.length}/300 characters
            </span>
          </div>

          <button
            onClick={() => onNavigateScreen('profile-complete')}
            className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Complete profile</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // ================= 9. PROFILE COMPLETION CONFIRMATION =================
  if (currentScreen === 'profile-complete') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-[#f8f9fa]">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-6">
            <Check className="w-10 h-10 stroke-[2.5]" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold mb-3 border border-emerald-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Profile 100% Complete</span>
          </span>

          <h2 className="text-3xl font-black text-slate-950 tracking-tight mb-2">
            You're all set, {name.split(' ')[0]}!
          </h2>
          <p className="text-slate-500 text-sm sm:text-base mb-8">
            Your TopRide account is active. You can now post trips, book seats, and send packages across routes.
          </p>

          <button
            onClick={async () => {
              try {
                const newUser = await api.signup({ name, email, password, phone, bio: bioText });
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
            className="w-full py-4 px-6 rounded-2xl bg-slate-950 hover:bg-slate-800 text-white font-bold text-base transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
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
