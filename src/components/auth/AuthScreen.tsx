"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  Flame,
  Scale,
  Dumbbell,
  Camera,
  ArrowRight,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Key,
} from "lucide-react";

export function AuthScreen() {
  const { signInWithGoogle, signInWithEmail, isConfigured } = useAuth();
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  useEffect(() => {
    // Check for query parameter errors returned from /auth/callback
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      if (authError) {
        setStatusMessage({
          text: `Authentication error: ${decodeURIComponent(authError)}`,
          isError: true,
        });
      }
    }
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await signInWithGoogle();
      if (res.error) {
        setStatusMessage({ text: res.error, isError: true });
      }
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Sign in failed", isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatusMessage({ text: "Please enter a valid email address.", isError: true });
      return;
    }
    setIsSubmitting(true);
    setStatusMessage(null);
    try {
      const res = await signInWithEmail(email);
      setStatusMessage({ text: res.message, isError: !res.success });
    } catch (err: any) {
      setStatusMessage({ text: err.message || "Failed to send magic link", isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-white selection:bg-brand-cyan/20 selection:text-brand-cyan relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-80 h-80 bg-brand-emerald/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-brand-cyan to-brand-emerald text-black font-black text-2xl shadow-xl shadow-brand-cyan/20">
            R
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
              ReboundFit
            </h1>
            <p className="text-sm font-medium text-gray-400 mt-1">
              Zero-friction physique recomposition.
            </p>
          </div>
        </div>

        {/* Feature Highlights Card */}
        <div className="grid grid-cols-2 gap-3 p-4 rounded-3xl bg-surface/80 border border-surface-border backdrop-blur-md">
          <div className="flex items-center space-x-2.5 text-xs text-gray-300">
            <Scale className="w-4 h-4 text-brand-cyan flex-shrink-0" />
            <span>7-Day EMA Smoothing</span>
          </div>
          <div className="flex items-center space-x-2.5 text-xs text-gray-300">
            <Flame className="w-4 h-4 text-brand-emerald flex-shrink-0" />
            <span>Dynamic TDEE Engine</span>
          </div>
          <div className="flex items-center space-x-2.5 text-xs text-gray-300">
            <Dumbbell className="w-4 h-4 text-brand-cyan flex-shrink-0" />
            <span>Progressive Overload</span>
          </div>
          <div className="flex items-center space-x-2.5 text-xs text-gray-300">
            <Camera className="w-4 h-4 text-brand-emerald flex-shrink-0" />
            <span>Ghost Silhouette Align</span>
          </div>
        </div>

        {/* Configuration Notice (if keys not yet supplied) */}
        {!isConfigured && (
          <div className="p-4 rounded-2xl bg-brand-amber/10 border border-brand-amber/30 text-brand-amber text-xs space-y-1">
            <div className="flex items-center space-x-1.5 font-bold">
              <Key className="w-4 h-4 flex-shrink-0" />
              <span>Supabase Configuration Required</span>
            </div>
            <p className="text-[11px] text-gray-300 leading-relaxed">
              Add <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to your{" "}
              <code className="text-white font-mono bg-black/40 px-1 py-0.5 rounded">.env.local</code> and Vercel Environment Variables.
            </p>
          </div>
        )}

        {/* Auth Action Container */}
        <div className="p-8 rounded-3xl bg-surface border border-surface-border shadow-2xl space-y-6">
          <div className="text-center">
            <h2 className="text-base font-bold text-white">Sign In to Continue</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Authenticate to initialize your isolated profile and database.
            </p>
          </div>

          {/* Status Message */}
          {statusMessage && (
            <div
              className={`p-3.5 rounded-2xl flex items-start space-x-2 text-xs border ${
                statusMessage.isError
                  ? "bg-brand-rose/10 border-brand-rose/30 text-brand-rose"
                  : "bg-brand-emerald/10 border-brand-emerald/30 text-brand-emerald"
              }`}
            >
              {statusMessage.isError ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              <span className="leading-tight">{statusMessage.text}</span>
            </div>
          )}

          {/* Primary Action: Google OAuth Button */}
          <button
            onClick={handleGoogleSignIn}
            disabled={isSubmitting}
            className="w-full py-3.5 px-4 rounded-2xl bg-white hover:bg-gray-100 text-black font-bold text-sm flex items-center justify-center space-x-3 transition-all active:scale-98 shadow-md disabled:opacity-50"
          >
            {isSubmitting ? (
              <Loader2 className="w-5 h-5 animate-spin text-black" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            )}
            <span>Continue with Google</span>
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-surface-border w-full" />
            <span className="bg-surface px-3 text-[11px] font-mono uppercase text-gray-500 absolute">
              or email magic link
            </span>
          </div>

          {/* Alternative: Magic Link / Email Form */}
          <form onSubmit={handleEmailSignIn} className="space-y-3">
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-elevated border border-surface-border text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-cyan transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !email}
              className="w-full py-3 rounded-xl bg-surface-elevated border border-surface-border hover:border-brand-cyan/40 text-xs font-bold text-gray-200 hover:text-white flex items-center justify-center space-x-2 transition-all active:scale-98 disabled:opacity-50"
            >
              <span>Send Magic Link</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <p className="text-[11px] text-gray-500 text-center leading-relaxed">
            Selecting Google triggers the real Google Account selector with <code className="text-gray-400 font-mono">prompt=select_account</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
