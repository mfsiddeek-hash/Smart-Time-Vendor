import React, { useState, useEffect } from 'react';
import { 
  Lock, Mail, User, Eye, EyeOff, ArrowRight, CheckCircle2, 
  AlertCircle, RefreshCw, KeyRound, ArrowLeft, ShieldCheck, Store, Loader2 
} from 'lucide-react';
import { supabase, loadUserProfile } from '../supabaseClient';
import { UserProfile } from '../types';

export type AuthMode = 'SIGN_IN' | 'SIGN_UP' | 'FORGOT_PASSWORD' | 'VERIFY_EMAIL' | 'RESET_PASSWORD';

interface AuthScreenProps {
  onAuthSuccess: (user: any, profile?: UserProfile | null) => void;
  initialMode?: AuthMode;
  initialEmail?: string;
  onCancelRecovery?: () => void;
  onEnterRecoveryMode?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ 
  onAuthSuccess, 
  initialMode = 'SIGN_IN',
  initialEmail = '',
  onCancelRecovery,
  onEnterRecoveryMode
}) => {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Cooldown timer for resend email
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Listen for recovery hash in URL (e.g., #type=recovery&access_token=...)
  useEffect(() => {
    const isStoredRecovery = typeof window !== 'undefined' && sessionStorage.getItem('st_password_recovery') === 'true';
    if (initialMode === 'RESET_PASSWORD' || isStoredRecovery) {
      setMode('RESET_PASSWORD');
      if (onEnterRecoveryMode) onEnterRecoveryMode();
    }

    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const href = window.location.href || '';
      if (hash.includes('type=recovery') || hash.includes('access_token') || href.includes('type=recovery')) {
        setMode('RESET_PASSWORD');
        sessionStorage.setItem('st_password_recovery', 'true');
        if (onEnterRecoveryMode) onEnterRecoveryMode();

        // Extract tokens directly if present
        const hashPart = hash.startsWith('#') ? hash.substring(1) : hash;
        const params = new URLSearchParams(hashPart);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
            .catch(err => console.warn('Recovery setSession error:', err));
        }
      }
    }
  }, [initialMode]);

  const validateEmail = (val: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  };

  const formatAuthError = (msg: string) => {
    if (!msg) return 'An error occurred. Please try again.';
    const lower = msg.toLowerCase();

    if (lower.includes('email rate limit exceeded') || lower.includes('rate limit')) {
      return 'Supabase Email Rate Limit Exceeded: The free default email service allows only 3-4 emails per hour. To log in without waiting 60 mins, turn OFF "Confirm email" in Supabase Dashboard (Authentication -> Providers -> Email).';
    }

    if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
      return 'Invalid email or password. Please check your spelling and try again.';
    }

    if (lower.includes('user already registered') || lower.includes('already exists')) {
      return 'An account with this email address already exists. Please Sign In or click Forgot Password.';
    }

    return msg;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg('Please enter your email address.');
      return;
    }
    if (!validateEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });

      if (error) {
        // Special friendly detection for unconfirmed email
        if (error.message.toLowerCase().includes('email not confirmed') || error.message.toLowerCase().includes('not confirmed')) {
          setMode('VERIFY_EMAIL');
          setErrorMsg('Your email is not verified yet. Please check your inbox or resend the activation link below.');
          return;
        }
        setErrorMsg(formatAuthError(error.message));
        return;
      }

      if (data?.user) {
        // Double check confirmation status
        if (!data.user.email_confirmed_at && (data.user as any).confirmed_at === null) {
          setMode('VERIFY_EMAIL');
          setErrorMsg('Check your email and click the verification link to activate your account.');
          return;
        }

        // Fetch user profile with local & DB fallback
        const userProfile = await loadUserProfile(data.user.id, data.user.user_metadata);
        onAuthSuccess(data.user, userProfile);
      }
    } catch (err: any) {
      setErrorMsg(formatAuthError(err.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanName = fullName.trim();
    const cleanEmail = email.trim();

    if (!cleanName) {
      setErrorMsg('Please enter your Full Name.');
      return;
    }
    if (!cleanEmail) {
      setErrorMsg('Please enter your Email Address.');
      return;
    }
    if (!validateEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email format (e.g. name@example.com).');
      return;
    }
    if (!password || password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match. Please re-type confirm password.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password: password,
        options: {
          data: {
            full_name: cleanName,
          },
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
      });

      if (error) {
        setErrorMsg(formatAuthError(error.message));
        return;
      }

      // Check if user was created or already existed
      if (data.user) {
        if (data.user.identities && data.user.identities.length === 0) {
          setErrorMsg('An account with this email already exists. Please sign in or reset your password.');
          return;
        }

        // If email verification is enabled or required (user not yet confirmed)
        if (!data.user.email_confirmed_at) {
          setMode('VERIFY_EMAIL');
          setSuccessMsg('Registration successful! Check your email and click the verification link to activate your account.');
          setResendCooldown(60);
          return;
        }

        // If email verification was disabled on project, proceed directly
        onAuthSuccess(data.user);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Signup failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    const cleanEmail = email.trim();
    if (!cleanEmail || !validateEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address to resend the verification link.');
      return;
    }

    setResendLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
        }
      });

      if (error) {
        setErrorMsg(formatAuthError(error.message));
      } else {
        setSuccessMsg(`Verification email resent to ${cleanEmail}. Please check your inbox and spam folder.`);
        setResendCooldown(60);
      }
    } catch (err: any) {
      setErrorMsg(formatAuthError(err.message || 'Failed to resend verification link.'));
    } finally {
      setResendLoading(false);
    }
  };

  const handleCheckVerification = async () => {
    setIsLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data?.user) {
        // Try refreshing session
        const { data: sData } = await supabase.auth.refreshSession();
        if (sData?.user?.email_confirmed_at) {
          const prof = await loadUserProfile(sData.user.id, sData.user.user_metadata);
          onAuthSuccess(sData.user, prof);
          return;
        }
        setErrorMsg('Email still not verified. Please click the link in your email first, then return here.');
        return;
      }

      if (data.user.email_confirmed_at) {
        setSuccessMsg('Email confirmed! Loading your store...');
        const prof = await loadUserProfile(data.user.id, data.user.user_metadata);
        setTimeout(() => {
          onAuthSuccess(data.user, prof);
        }, 800);
      } else {
        setErrorMsg('Your email is still awaiting verification. Please check your inbox.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to check verification status.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    if (!cleanEmail || !validateEmail(cleanEmail)) {
      setErrorMsg('Please enter a valid email address to receive password reset instructions.');
      return;
    }

    setIsLoading(true);
    try {
      const liveOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${liveOrigin}#type=recovery`,
      });

      if (error) {
        setErrorMsg(formatAuthError(error.message));
      } else {
        setSuccessMsg(`Password reset instructions sent to ${cleanEmail}. Please check your email inbox. If your email link starts with http://localhost:3000, simply copy the link and paste it into the box below!`);
      }
    } catch (err: any) {
      setErrorMsg(formatAuthError(err.message || 'Failed to send reset email.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyRecoveryInput = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const raw = recoveryInput.trim();
    if (!raw) {
      setErrorMsg('Please paste the reset link or 6-digit code from your email.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Check if user pasted a link (e.g. http://localhost:3000/#access_token=... or #access_token=...)
      if (raw.includes('access_token')) {
        let hashStr = raw;
        if (raw.includes('#')) {
          hashStr = raw.substring(raw.indexOf('#') + 1);
        } else if (raw.includes('?')) {
          hashStr = raw.substring(raw.indexOf('?') + 1);
        }
        const params = new URLSearchParams(hashStr);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (!accessToken || !refreshToken) {
          setErrorMsg('Could not find access tokens in the pasted link. Please make sure to copy the full link from your email.');
          return;
        }

        // Crucial: Set recovery mode in session storage, history, and parent callback BEFORE setSession!
        sessionStorage.setItem('st_password_recovery', 'true');
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', window.location.pathname + '#type=recovery');
        }
        if (onEnterRecoveryMode) {
          onEnterRecoveryMode();
        }

        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          sessionStorage.removeItem('st_password_recovery');
          setErrorMsg('The reset link has expired or is invalid. Please request a new one.');
          return;
        }

        if (data.session) {
          setMode('RESET_PASSWORD');
          setSuccessMsg('Reset link verified! Please enter your new password below.');
          return;
        }
      }

      // 2. Check if user entered an OTP code (6-digit token or confirmation token)
      const cleanToken = raw.replace(/\s+/g, '');
      const targetEmail = email.trim();
      if (!targetEmail) {
        setErrorMsg('Please enter your email address in the field above to verify this code.');
        return;
      }

      sessionStorage.setItem('st_password_recovery', 'true');
      if (typeof window !== 'undefined' && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname + '#type=recovery');
      }
      if (onEnterRecoveryMode) {
        onEnterRecoveryMode();
      }

      const { data, error } = await supabase.auth.verifyOtp({
        email: targetEmail,
        token: cleanToken,
        type: 'recovery',
      });

      if (error) {
        sessionStorage.removeItem('st_password_recovery');
        setErrorMsg(formatAuthError(error.message));
        return;
      }

      if (data.session) {
        setMode('RESET_PASSWORD');
        setSuccessMsg('Code verified! Please enter your new password below.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Verification failed. Please check the link or code.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!password || password.length < 6) {
      setErrorMsg('New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setErrorMsg(error.message);
      } else {
        sessionStorage.removeItem('st_password_recovery');
        if (typeof window !== 'undefined' && window.history?.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        setSuccessMsg('Password updated successfully! Signing you in...');
        setTimeout(() => {
          if (data.user) {
            onAuthSuccess(data.user);
          } else {
            setMode('SIGN_IN');
          }
        }, 1200);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100 relative overflow-hidden select-none">
      {/* Decorative Background Elements */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative z-10 flex flex-col">
        {/* App Branding Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25 mb-3">
            <Store size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Ledger Book</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            Smart Cloud Ledger & Multi-Shop Financial Manager
          </p>
        </div>

        {/* Global Notifications */}
        {errorMsg && (
          <div className="mb-5 p-3.5 bg-red-500/15 border border-red-500/40 rounded-2xl text-red-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
            <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-5 p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-200 text-xs flex items-start gap-2.5 animate-in fade-in duration-200">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{successMsg}</span>
          </div>
        )}

        {/* VIEW 1: SIGN IN */}
        {mode === 'SIGN_IN' && (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div className="text-center mb-2">
              <h2 className="text-lg font-bold text-white">Sign In to Your Shop</h2>
              <p className="text-xs text-slate-400">Enter your email and password to access your ledger</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="shopkeeper@example.com"
                  autoComplete="email"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setMode('FORGOT_PASSWORD');
                  }}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="pt-4 border-t border-slate-700/80 text-center">
              <p className="text-xs text-slate-400">
                Don't have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setMode('SIGN_UP');
                  }}
                  className="font-bold text-blue-400 hover:text-blue-300 underline underline-offset-4 ml-1"
                >
                  Create New Account
                </button>
              </p>
            </div>
          </form>
        )}

        {/* VIEW 2: SIGN UP */}
        {mode === 'SIGN_UP' && (
          <form onSubmit={handleSignUp} className="space-y-3.5">
            <div className="text-center mb-1">
              <h2 className="text-lg font-bold text-white">Create Shop Owner Account</h2>
              <p className="text-xs text-slate-400">Each account has isolated, secure ledger data with Supabase RLS</p>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Full Name *
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Kasun Fernando"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  autoComplete="email"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Password * (min. 6 characters)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Confirm Password *
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-3 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Registering Account...</span>
                </>
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="pt-3 border-t border-slate-700/80 text-center">
              <p className="text-xs text-slate-400">
                Already registered?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setMode('SIGN_IN');
                  }}
                  className="font-bold text-blue-400 hover:text-blue-300 underline underline-offset-4 ml-1"
                >
                  Sign In
                </button>
              </p>
            </div>
          </form>
        )}

        {/* VIEW 3: VERIFY EMAIL SCREEN (Mandatory for unverified users) */}
        {mode === 'VERIFY_EMAIL' && (
          <div className="space-y-5 text-center py-2">
            <div className="w-16 h-16 bg-blue-500/20 border border-blue-500/40 rounded-3xl mx-auto flex items-center justify-center text-blue-400 shadow-inner">
              <Mail size={32} className="animate-bounce" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-white mb-2">Verify Your Email</h2>
              <div className="bg-slate-900/70 border border-slate-700 p-4 rounded-2xl text-xs text-slate-300 leading-relaxed font-medium">
                Check your email <span className="font-bold text-blue-400 underline">{email}</span> and click the verification link to activate your account.
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={handleCheckVerification}
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-emerald-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <ShieldCheck size={18} />
                    <span>I've Verified My Email — Enter App</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleResendVerification}
                disabled={resendCooldown > 0 || resendLoading}
                className="w-full bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 rounded-xl text-xs transition-all flex items-center justify-center gap-2"
              >
                {resendLoading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} className={resendCooldown > 0 ? '' : 'text-blue-400'} />
                )}
                <span>
                  {resendCooldown > 0 
                    ? `Resend link available in ${resendCooldown}s` 
                    : 'Resend Verification Email'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  setMode('SIGN_IN');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors pt-2 flex items-center justify-center gap-1.5 mx-auto font-medium"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          </div>
        )}

        {/* VIEW 4: FORGOT PASSWORD */}
        {mode === 'FORGOT_PASSWORD' && (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="text-center mb-2">
              <div className="w-12 h-12 bg-amber-500/20 border border-amber-500/40 rounded-2xl mx-auto flex items-center justify-center text-amber-400 mb-2">
                <KeyRound size={24} />
              </div>
              <h2 className="text-lg font-bold text-white">Reset Password</h2>
              <p className="text-xs text-slate-400">
                Enter your registered email address to receive password reset instructions.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Registered Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="yourname@gmail.com"
                  autoComplete="email"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-3.5 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-blue-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Sending Instructions...</span>
                </>
              ) : (
                <>
                  <span>Send Reset Email</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            {/* Direct Link or Code Verification (for emails with localhost links or 6-digit codes) */}
            <div className="pt-3 border-t border-slate-700/80 space-y-2.5">
              <div className="text-left">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                  Already have the reset link or code?
                </span>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                  If the link in your email starts with <code className="text-amber-300 font-mono bg-slate-900 px-1 py-0.5 rounded text-[10px]">http://localhost:3000</code>, simply paste that entire link or 6-digit code below!
                </p>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                  <input
                    type="text"
                    value={recoveryInput}
                    onChange={e => setRecoveryInput(e.target.value)}
                    placeholder="Paste link or 6-digit code..."
                    className="w-full bg-slate-900/90 border border-amber-500/50 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all font-mono"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleVerifyRecoveryInput()}
                  disabled={isLoading || !recoveryInput.trim()}
                  className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md shadow-amber-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <ShieldCheck size={15} />
                  <span>Verify Link / Code & Set New Password</span>
                </button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/80 text-center">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  setMode('SIGN_IN');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5 mx-auto font-medium"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          </form>
        )}

        {/* VIEW 5: RESET PASSWORD */}
        {mode === 'RESET_PASSWORD' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="text-center mb-2">
              <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl mx-auto flex items-center justify-center text-emerald-400 mb-2">
                <Lock size={24} />
              </div>
              <h2 className="text-lg font-bold text-white">Create New Password</h2>
              <p className="text-xs text-slate-400">Set a strong new password for your account</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                New Password (min 6 characters)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-xl pl-10 pr-10 py-3 text-sm font-semibold text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold py-3.5 rounded-xl text-sm shadow-lg shadow-emerald-600/30 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Save New Password & Enter</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>

            <div className="pt-2 border-t border-slate-700/80 text-center">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg('');
                  setSuccessMsg('');
                  sessionStorage.removeItem('st_password_recovery');
                  if (typeof window !== 'undefined' && window.history?.replaceState) {
                    window.history.replaceState(null, '', window.location.pathname);
                  }
                  if (onCancelRecovery) {
                    onCancelRecovery();
                  }
                  setMode('SIGN_IN');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors flex items-center justify-center gap-1.5 mx-auto font-medium"
              >
                <ArrowLeft size={14} /> Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Security note */}
      <div className="mt-6 text-center text-[11px] text-slate-500 flex items-center gap-1.5">
        <ShieldCheck size={14} className="text-emerald-500" />
        <span>Secured with Supabase Auth & PostgreSQL Row Level Security (RLS)</span>
      </div>
    </div>
  );
};
