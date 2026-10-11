"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Dumbbell,
  Calendar,
  Camera,
  Wifi,
  WifiOff,
  Flame,
  LogOut,
  User,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { db } from "@/lib/db";

interface AppShellProps {
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/lift", label: "Workouts & Schedule", icon: Calendar },
  { href: "/food", label: "Food Log", icon: UtensilsCrossed },
  { href: "/vault", label: "Photo Vault", icon: Camera },
];

export function AppShell({ children }: AppShellProps) {
  const { user, profile, isLoading, isAuthenticated, hasCompletedOnboarding, signOut } = useAuth();
  const pathname = usePathname();
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [pendingSyncs, setPendingSyncs] = useState<number>(0);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const checkSyncQueue = async () => {
      try {
        const count = await db.syncQueue.where("status").equals("pending").count();
        setPendingSyncs(count);
      } catch {
        // Dexie may be initializing
      }
    };
    checkSyncQueue();
    const interval = setInterval(checkSyncQueue, 10000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-white">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-cyan to-brand-emerald flex items-center justify-center font-black text-black text-xl mb-4 shadow-xl shadow-brand-cyan/20 animate-pulse">
          R
        </div>
        <Loader2 className="w-6 h-6 animate-spin text-brand-cyan" />
        <span className="text-xs font-mono text-gray-400 mt-3 uppercase tracking-wider">
          Initializing Rebound Engine...
        </span>
      </div>
    );
  }

  // 2. Authentication Gate: If not logged in, block dashboard and show AuthScreen
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // 3. Guided Onboarding Gate: If logged in but onboarding not completed, show wizard
  if (!hasCompletedOnboarding) {
    return <OnboardingWizard />;
  }

  // 4. Authenticated & Onboarded Main Application Shell
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-white antialiased font-sans">
      {/* =========================================================================
          DESKTOP SIDEBAR NAVIGATION
          ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 border-r border-surface-border bg-surface flex-shrink-0">
        {/* Brand Header */}
        <div className="p-6 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-cyan to-brand-emerald flex items-center justify-center font-black text-black text-lg shadow-lg shadow-brand-cyan/20">
              R
            </div>
            <div>
              <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                ReboundFit
              </h1>
              <p className="text-[11px] font-mono text-brand-cyan uppercase tracking-wider">
                {profile?.primaryGoal === "recomp" ? "Body Recomposition" : "Lean Bulk Engine"}
              </p>
            </div>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div className="px-6 py-3 border-b border-surface-border/50 bg-surface-elevated/40">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center space-x-1.5 text-gray-400">
              {isOnline ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-brand-emerald" />
                  <span className="text-gray-300">Local-First (Online)</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-brand-amber animate-pulse" />
                  <span className="text-brand-amber font-medium">Offline Mode</span>
                </>
              )}
            </span>
            {pendingSyncs > 0 && (
              <span className="bg-brand-amber/20 text-brand-amber px-2 py-0.5 rounded text-[10px] font-mono">
                {pendingSyncs} queued
              </span>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-brand-cyan/15 text-brand-cyan border border-brand-cyan/30 shadow-md shadow-brand-cyan/5"
                    : "text-gray-400 hover:text-white hover:bg-surface-elevated"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-brand-cyan" : "text-gray-400"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bulking Target Snapshot Footer */}
        <div className="p-4 m-3 rounded-2xl bg-surface-elevated border border-surface-border">
          <div className="flex items-center space-x-2 text-xs font-semibold text-brand-emerald mb-1">
            <Flame className="w-3.5 h-3.5" />
            <span>Target Surplus Active</span>
          </div>
          <div className="text-sm font-bold text-white">
            {profile?.targetGainRateLbsPerWeek ? `+${profile.targetGainRateLbsPerWeek} lbs/week` : "Maintenance"}
          </div>
          <div className="text-[11px] text-gray-400 mt-1 font-mono">
            Target: {profile?.targetCalories || 0} kcal | {profile?.targetProteinG || 0}g Pro
          </div>
        </div>

        {/* User Account / Sign Out Row */}
        <div className="p-4 border-t border-surface-border flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-surface-elevated border border-surface-border flex items-center justify-center text-xs font-bold text-gray-300 flex-shrink-0">
              <User className="w-3.5 h-3.5" />
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">
                {user?.name || "Athlete"}
              </div>
              <div className="text-[10px] text-gray-500 font-mono truncate">
                {user?.email || ""}
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-rose hover:bg-surface-elevated transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* =========================================================================
          MAIN CONTENT AREA
          ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Mobile Top Header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface/90 backdrop-blur-md border-b border-surface-border flex-shrink-0 pt-safe">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-brand-cyan to-brand-emerald flex items-center justify-center font-black text-black text-sm">
              R
            </div>
            <span className="font-bold text-base tracking-tight text-white">ReboundFit</span>
          </div>

          <div className="flex items-center space-x-2">
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono border ${
                isOnline
                  ? "bg-brand-emerald/10 border-brand-emerald/30 text-brand-emerald"
                  : "bg-brand-amber/10 border-brand-amber/30 text-brand-amber"
              }`}
            >
              {isOnline ? "ONLINE" : "OFFLINE"}
            </span>

            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg text-gray-400 hover:text-brand-rose"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8 pb-24 md:pb-8">
          {children}
        </main>

        {/* =========================================================================
            MOBILE NATIVE BOTTOM NAVIGATION
            ========================================================================= */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur-xl border-t border-surface-border pb-safe z-50">
          <div className="flex items-center justify-around py-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center w-16 py-1 transition-colors ${
                    isActive ? "text-brand-cyan" : "text-gray-400 hover:text-gray-200"
                  }`}
                >
                  <div
                    className={`relative p-1 rounded-xl transition-all ${
                      isActive ? "bg-brand-cyan/20" : ""
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-medium mt-0.5">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
