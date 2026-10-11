"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Flame,
  Dumbbell,
  Scale,
  Wifi,
  WifiOff,
  LogOut,
  User,
  Loader2,
  X,
  ChevronRight,
  Plus,
  RefreshCw,
  CheckCircle2,
  Sliders,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCloudSync } from "@/hooks/useCloudSync";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { QuickWeighInModal } from "@/components/dashboard/QuickWeighInModal";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

interface AppLayoutProps {
  children: React.ReactNode;
}

// 4 Native Apple Health Tab Destinations
const NAV_ITEMS = [
  { href: "/", label: "Summary", icon: Activity, accent: "#0A84FF" },
  { href: "/food", label: "Nutrition", icon: Flame, accent: "#FF9500" },
  { href: "/lift", label: "Workouts", icon: Dumbbell, accent: "#0A84FF" },
  { href: "/vault", label: "Body", icon: Scale, accent: "#AF52DE" },
];

export function AppLayout({ children }: AppLayoutProps) {
  const { user, profile, isLoading, isAuthenticated, hasCompletedOnboarding, signOut } = useAuth();
  const { isSyncing, lastSyncedAt, isOnline, syncNow } = useCloudSync();
  const pathname = usePathname();

  const [isProfileSheetOpen, setIsProfileSheetOpen] = useState<boolean>(false);
  const [isWeighInOpen, setIsWeighInOpen] = useState<boolean>(false);

  // 1. Loading State (Apple Health minimal spinner)
  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-black text-white">
        <div className="w-14 h-14 rounded-2xl bg-[#1C1C1E] border border-[#38383A] flex items-center justify-center mb-4 shadow-2xl">
          <Activity className="w-7 h-7 text-[#0A84FF] animate-pulse" />
        </div>
        <Loader2 className="w-5 h-5 animate-spin text-[#8E8E93]" />
        <span className="text-xs font-semibold text-[#8E8E93] mt-3 tracking-tight">
          Loading Health Data...
        </span>
      </div>
    );
  }

  // 2. Authentication Gate: If not logged in, show AuthScreen
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // 3. Guided Onboarding Gate: If logged in but onboarding not completed, show wizard
  if (!hasCompletedOnboarding) {
    return <OnboardingWizard />;
  }

  const userInitial = user?.name ? user.name.charAt(0).toUpperCase() : "A";

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-black text-white antialiased font-sans">
      {/* =========================================================================
          DESKTOP SIDEBAR NAVIGATION (iOS HIG Mac / iPad Analytical Layout)
          Sticky left navigation with profile chip, cloud sync badge, and quick loggers
          ========================================================================= */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 border-r border-[#38383A] bg-[#1C1C1E]/85 backdrop-blur-2xl flex-shrink-0 h-screen sticky top-0 select-none z-30">
        {/* Apple Health Brand Header */}
        <div className="p-5 lg:p-6 border-b border-[#38383A] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#0A84FF] flex items-center justify-center shadow-lg shadow-[#0A84FF]/25">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-base lg:text-lg tracking-tight text-white leading-tight">
                ReboundFit
              </h1>
              <p className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider">
                Apple Health Engine
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsProfileSheetOpen(true)}
            className="w-8 h-8 rounded-full bg-[#2C2C2E] border border-[#38383A] text-xs font-bold text-white flex items-center justify-center hover:ring-2 hover:ring-[#0A84FF] transition-all"
            title="Open HealthKit Profile"
          >
            {userInitial}
          </button>
        </div>

        {/* Real-time Cloud Synchronization Indicator Badge */}
        <div className="px-5 py-2.5 border-b border-[#38383A]/50 bg-[#2C2C2E]/30 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-[#8E8E93] min-w-0">
            {isOnline ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#30D158] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[#30D158]"></span>
                </span>
                <span className="text-[11px] font-medium text-gray-300 truncate">
                  {isSyncing ? "Syncing..." : "Cloud Synced"}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-[#FF9500] animate-pulse" />
                <span className="text-[11px] font-medium text-[#FF9500]">Offline Storage</span>
              </>
            )}
          </div>

          <button
            onClick={() => syncNow()}
            disabled={isSyncing}
            className="p-1 rounded-md text-[#8E8E93] hover:text-white transition-colors disabled:opacity-50"
            title="Force Cloud Refresh"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin text-[#0A84FF]" : ""}`} />
          </button>
        </div>

        {/* Desktop Quick Log Actions */}
        <div className="px-4 pt-4 pb-2">
          <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider px-2 block mb-2">
            Quick Actions
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setIsWeighInOpen(true)}
              className="px-3 py-2 rounded-xl bg-[#2C2C2E] hover:bg-[#38383A] border border-[#38383A]/50 text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-all active:scale-95"
            >
              <Scale className="w-3.5 h-3.5 text-[#AF52DE]" />
              <span>Log Weight</span>
            </button>
            <Link
              href="/food"
              className="px-3 py-2 rounded-xl bg-[#2C2C2E] hover:bg-[#38383A] border border-[#38383A]/50 text-xs font-semibold text-white flex items-center justify-center space-x-1.5 transition-all active:scale-95"
            >
              <Flame className="w-3.5 h-3.5 text-[#FF9500]" />
              <span>Quick Meal</span>
            </Link>
          </div>
        </div>

        {/* Navigation Destination Links */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider px-2 block mb-1">
            Health Categories
          </span>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
                  isActive
                    ? "bg-[#0A84FF] text-white shadow-md shadow-[#0A84FF]/25 font-bold"
                    : "text-[#8E8E93] hover:text-white hover:bg-[#2C2C2E]"
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? "text-white" : "text-[#8E8E93]"}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Account / Profile Footer */}
        <div className="p-4 border-t border-[#38383A] bg-[#1C1C1E] flex items-center justify-between">
          <div
            onClick={() => setIsProfileSheetOpen(true)}
            className="flex items-center space-x-2.5 min-w-0 cursor-pointer hover:opacity-85 transition-opacity"
          >
            <div className="w-7 h-7 rounded-full bg-[#2C2C2E] border border-[#38383A] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {userInitial}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-white truncate">
                {user?.name || "Athlete"}
              </div>
              <div className="text-[10px] text-[#8E8E93] truncate">{user?.email || ""}</div>
            </div>
          </div>

          <button
            onClick={() => signOut()}
            className="p-1.5 rounded-lg text-[#8E8E93] hover:text-[#FF2D55] hover:bg-[#2C2C2E] transition-colors"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* =========================================================================
          MAIN APPLICATION VIEWPORT
          Responsive container: Mobile single-stream vs Desktop wide analytical grid
          ========================================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-black">
        {/* Dynamic iOS / Desktop Route Content */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 pt-safe">
          <div className="w-full max-w-7xl mx-auto space-y-6">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </main>

        {/* =========================================================================
            NATIVE APPLE HEALTH BOTTOM TAB DOCK (Mobile only: md:hidden)
            Frosted translucent glass, safe area inset, 4 HIG symbols
            ========================================================================= */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-2xl bg-black/85 border-t border-[#38383A] pb-safe z-50">
          <div className="flex items-center justify-around py-1.5 px-2">
            {NAV_ITEMS.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
                    isActive ? "text-[#0A84FF]" : "text-[#8E8E93] hover:text-white"
                  }`}
                >
                  <div className="relative">
                    <Icon className="w-6 h-6 stroke-[2.2]" />
                  </div>
                  <span className="text-[10px] font-medium tracking-tight mt-0.5">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

      {/* =========================================================================
          APPLE HEALTH PROFILE ACTION SHEET / MODAL
          ========================================================================= */}
      {isProfileSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 animate-fade-in">
          <div className="w-full max-w-md rounded-t-[28px] sm:rounded-3xl bg-[#1C1C1E] border border-[#38383A] p-6 shadow-2xl space-y-5 animate-slide-up pb-safe">
            {/* Grab handle on mobile */}
            <div className="sm:hidden w-10 h-1 bg-[#38383A] rounded-full mx-auto -mt-2 mb-3" />

            <div className="flex items-center justify-between pb-3 border-b border-[#38383A]">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-[#0A84FF] text-white flex items-center justify-center text-lg font-bold shadow-lg">
                  {userInitial}
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-white tracking-tight truncate">
                    {user?.name || "Athlete"}
                  </h3>
                  <p className="text-xs text-[#8E8E93] truncate">{user?.email}</p>
                </div>
              </div>

              <button
                onClick={() => setIsProfileSheetOpen(false)}
                className="w-8 h-8 rounded-full bg-[#2C2C2E] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Profile Health Metrics Summary */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#8E8E93] uppercase tracking-wider">
                HealthKit Profile Targets
              </span>
              <div className="p-4 rounded-2xl bg-[#2C2C2E] border border-[#38383A] divide-y divide-[#38383A]">
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-[#8E8E93]">Primary Goal</span>
                  <span className="font-semibold text-white capitalize">
                    {profile?.primaryGoal === "recomp" ? "Body Recomposition" : "Lean Bulking"}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-[#8E8E93]">Dynamic Calorie Target</span>
                  <span className="font-semibold text-[#FF9500] font-mono">
                    {profile?.targetCalories || 2600} kcal / day
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-[#8E8E93]">Protein Target</span>
                  <span className="font-semibold text-[#FF2D55] font-mono">
                    {profile?.targetProteinG || 160} g / day
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 text-xs">
                  <span className="text-[#8E8E93]">Training Split</span>
                  <span className="font-semibold text-[#0A84FF] uppercase font-mono">
                    {profile?.trainingSplit || "PPL"} ({profile?.workoutDaysPerWeek || 6} days/wk)
                  </span>
                </div>
              </div>
            </div>

            {/* Manual Sync Cloud Button */}
            <button
              onClick={async () => {
                await syncNow();
              }}
              disabled={isSyncing}
              className="w-full py-3 rounded-2xl bg-[#2C2C2E] border border-[#38383A] text-white font-semibold text-xs flex items-center justify-center space-x-2 hover:bg-[#38383A] transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin text-[#0A84FF]" : ""}`} />
              <span>
                {isSyncing
                  ? "Syncing Cloud..."
                  : lastSyncedAt
                  ? `Sync Cloud (Last: ${lastSyncedAt.toLocaleTimeString()})`
                  : "Sync Cloud Now"}
              </span>
            </button>

            {/* Sign Out Button */}
            <div className="pt-1">
              <button
                onClick={() => {
                  setIsProfileSheetOpen(false);
                  signOut();
                }}
                className="w-full py-3.5 rounded-2xl bg-[#FF2D55]/15 border border-[#FF2D55]/30 text-[#FF2D55] font-bold text-sm flex items-center justify-center space-x-2 active:scale-95 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out of Apple Health Session</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Quick Weigh-In Modal */}
      <QuickWeighInModal
        isOpen={isWeighInOpen}
        onClose={() => setIsWeighInOpen(false)}
        lastWeightLbs={profile?.currentWeightLbs || 175}
        onWeightLogged={() => {
          syncNow();
        }}
      />
    </div>
  );
}
