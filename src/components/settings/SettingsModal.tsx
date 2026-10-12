"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  User,
  Scale,
  Ruler,
  Flame,
  Zap,
  RefreshCw,
  LogOut,
  Check,
  ShieldCheck,
  Sparkles,
  Calendar,
  Copy,
  Download,
  Activity,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCloudSync } from "@/hooks/useCloudSync";
import { supabase } from "@/lib/supabase";
import { getStoredGoogleProviderToken } from "@/lib/googleCalendar";

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, profile, updateProfile, signOut, signInWithGoogle } = useAuth();
  const { isSyncing, lastSyncedAt, isOnline, syncNow } = useCloudSync();
  const [hasGoogleCalendarAccess, setHasGoogleCalendarAccess] = useState<boolean>(false);
  const [isConnectingGCal, setIsConnectingGCal] = useState<boolean>(false);

  useEffect(() => {
    const checkToken = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = getStoredGoogleProviderToken(session);
      setHasGoogleCalendarAccess(!!token);
    };
    if (isOpen) {
      checkToken();
    }
  }, [user, isOpen]);

  // Local Form State
  const [displayName, setDisplayName] = useState<string>(profile?.name || user?.name || "Athlete");
  const [weightUnit, setWeightUnit] = useState<"lbs" | "kg">(profile?.weightUnit || "lbs");
  const [heightCm, setHeightCm] = useState<number>(profile?.heightCm || 178);
  const [primaryGoal, setPrimaryGoal] = useState<"lean_bulk" | "recomp">(
    profile?.primaryGoal || "lean_bulk"
  );
  const [targetSurplusKcal, setTargetSurplusKcal] = useState<number>(250);
  const [targetCalories, setTargetCalories] = useState<number>(profile?.targetCalories || 2650);
  const [targetProteinG, setTargetProteinG] = useState<number>(profile?.targetProteinG || 165);
  const [activityLevel, setActivityLevel] = useState<
    "sedentary" | "light" | "moderate" | "very_active" | "extra_active"
  >(profile?.activityLevel || "moderate");

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const [syncToken, setSyncToken] = useState<string>(() => {
    return (
      profile?.appleHealthSyncToken ||
      (user?.id ? `rf_ah_${user.id.replace(/-/g, "").substring(0, 16)}` : "rf_ah_9a8b7c6d5e4f3a2b")
    );
  });
  const [copiedUrl, setCopiedUrl] = useState<boolean>(false);
  const [copiedToken, setCopiedToken] = useState<boolean>(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState<boolean>(false);
  const [testWebhookStatus, setTestWebhookStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const webhookUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/api/integrations/apple-health`
      : "https://reboundfit.vercel.app/api/integrations/apple-health";

  // Sync state when profile loads/changes or modal opens
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.name || user?.name || "Athlete");
      setWeightUnit(profile.weightUnit || "lbs");
      setHeightCm(profile.heightCm || 178);
      setPrimaryGoal(profile.primaryGoal || "lean_bulk");
      setTargetCalories(profile.targetCalories || 2650);
      setTargetProteinG(profile.targetProteinG || 165);
      setActivityLevel(profile.activityLevel || "moderate");
      if (profile.appleHealthSyncToken) {
        setSyncToken(profile.appleHealthSyncToken);
      }
    }
  }, [profile, user, isOpen]);

  if (!isOpen) return null;

  const userInitial = displayName ? displayName.charAt(0).toUpperCase() : "A";

  // Height conversion helper
  const heightFeet = Math.floor(heightCm / 30.48);
  const heightInches = Math.round((heightCm % 30.48) / 2.54);

  const handleSurplusPreset = (surplus: number) => {
    setTargetSurplusKcal(surplus);
    const base = profile?.baseTdee || 2400;
    setTargetCalories(Math.round(base + surplus));
  };

  const handleCopyWebhookUrl = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(webhookUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleCopySyncToken = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(syncToken);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleRegenerateToken = () => {
    const chars = "abcdef0123456789";
    let token = "rf_ah_";
    for (let i = 0; i < 24; i++) {
      token += chars[Math.floor(Math.random() * chars.length)];
    }
    setSyncToken(token);
    updateProfile({ appleHealthSyncToken: token });
  };

  const handleDownloadShortcutConfig = () => {
    const shortcutConfig = {
      name: "ReboundFit Apple Health Daily Sync",
      version: "1.0",
      description: "iOS Shortcut configuration for syncing Apple HealthKit metrics to ReboundFit",
      webhookUrl,
      authorizationHeader: `Bearer ${syncToken}`,
      schedule: "Daily at 08:00 AM",
      expectedPayload: {
        date: "Current Date (YYYY-MM-DD)",
        step_count: "HealthKit: Step Count (Sum for Day)",
        active_energy_burned_kcal: "HealthKit: Active Energy Burned (Sum for Day)",
        basal_energy_burned_kcal: "HealthKit: Resting Energy Burned (Sum for Day)",
        sleep_hours: "HealthKit: Sleep Analysis (Time Asleep in Hours)",
        resting_heart_rate_bpm: "HealthKit: Resting Heart Rate (Latest)",
        weight_lbs: "HealthKit: Weight / Body Mass (Latest)",
      },
      curlSample: `curl -X POST "${webhookUrl}" -H "Authorization: Bearer ${syncToken}" -H "Content-Type: application/json" -d '{"steps":8420,"activeCalories":640,"sleepHours":7.7,"heartRate":58}'`,
    };

    const blob = new Blob([JSON.stringify(shortcutConfig, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ReboundFit-Apple-Health-Shortcut.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendTestWebhook = async () => {
    setIsTestingWebhook(true);
    setTestWebhookStatus(null);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const res = await fetch("/api/integrations/apple-health", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${syncToken}`,
        },
        body: JSON.stringify({
          date: todayStr,
          step_count: 8420,
          distance_km: 6.2,
          active_energy_burned_kcal: 640,
          basal_energy_burned_kcal: 1820,
          sleep_hours: 7.7,
          deep_sleep_hours: 1.8,
          resting_heart_rate_bpm: 58,
          source: "apple_health_test_runner",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setTestWebhookStatus({
          type: "success",
          message: "✓ Test metrics received and recorded! Check your Summary tab.",
        });
        syncNow();
      } else {
        setTestWebhookStatus({
          type: "error",
          message: data.message || "Failed to deliver test health payload.",
        });
      }
    } catch (err: any) {
      setTestWebhookStatus({
        type: "error",
        message: err.message || "Network error sending test health payload.",
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateProfile({
        name: displayName.trim(),
        weightUnit,
        unitPreference: weightUnit === "kg" ? "metric" : "imperial",
        heightCm,
        primaryGoal,
        targetCalories: Number(targetCalories),
        targetProteinG: Number(targetProteinG),
        activityLevel,
        appleHealthSyncToken: syncToken,
      });

      if (user?.id) {
        try {
          await supabase
            .from("profiles")
            .update({
              display_name: displayName.trim(),
              apple_health_sync_token: syncToken,
            })
            .eq("id", user.id);
        } catch {
          // Supabase profile update notice
        }
      }

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error("Failed to update profile settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-0 sm:p-4">
      {/* Backdrop tap dismiss */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="w-full max-w-lg rounded-t-[32px] sm:rounded-3xl bg-[#1C1C1E] border border-[#38383A] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up">
        {/* iOS Drag Handle */}
        <div className="sm:hidden w-10 h-1 bg-[#38383A] rounded-full mx-auto mt-2.5 mb-1" />

        {/* Modal Sticky Header */}
        <div className="px-6 py-4 border-b border-[#2C2C2E] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0A84FF]/20 text-[#0A84FF] flex items-center justify-center">
              <User className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Health Profile & Settings
              </h2>
              <p className="text-[11px] text-[#8E8E93]">Apple HealthKit Configuration</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2C2C2E] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* =========================================================================
              1. ACCOUNT INFO & GOOGLE AUTH
              ========================================================================= */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block">
              Athlete Account
            </span>
            <div className="p-4 rounded-2xl bg-[#2C2C2E] border border-[#38383A] space-y-3">
              <div className="flex items-center space-x-3.5">
                <div className="w-12 h-12 rounded-full bg-[#0A84FF] text-white flex items-center justify-center text-lg font-black shadow-lg">
                  {userInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Athlete Name"
                    className="w-full bg-transparent text-sm font-bold text-white border-b border-transparent focus:border-[#0A84FF] focus:outline-none transition-colors"
                  />
                  <div className="flex items-center space-x-1.5 mt-0.5">
                    <span className="text-xs text-[#8E8E93] truncate">{user?.email}</span>
                    <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-[#30D158]/15 text-[#30D158] text-[9px] font-mono font-semibold">
                      <ShieldCheck className="w-2.5 h-2.5" />
                      <span>Verified</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Cloud Sync Status Strip */}
              <div className="pt-2 border-t border-[#38383A] flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 text-[#8E8E93]">
                  <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-[#30D158]" : "bg-[#FF9500]"}`} />
                  <span className="text-[11px]">
                    {isSyncing ? "Syncing with cloud..." : "Cloud synced"}
                    {lastSyncedAt ? ` (${lastSyncedAt.toLocaleTimeString()})` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => syncNow()}
                  disabled={isSyncing}
                  className="px-2.5 py-1 rounded-lg bg-[#1C1C1E] text-[11px] font-semibold text-gray-300 hover:text-white flex items-center space-x-1 border border-[#38383A]"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin text-[#0A84FF]" : ""}`} />
                  <span>Sync</span>
                </button>
              </div>
            </div>
          </div>

          {/* =========================================================================
              1.5 GOOGLE CALENDAR SYNCHRONIZATION
              ========================================================================= */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block">
              Google Calendar Synchronization
            </span>
            <div className="p-4 rounded-2xl bg-[#2C2C2E] border border-[#38383A] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#0A84FF]/20 text-[#0A84FF] flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <span>Primary Google Calendar</span>
                      {hasGoogleCalendarAccess ? (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-[#30D158]/15 text-[#30D158] text-[9px] font-semibold">
                          <Check className="w-2.5 h-2.5" />
                          <span>Connected</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-full bg-[#FF9500]/15 text-[#FF9500] text-[9px] font-semibold">
                          <span>Not Connected</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#8E8E93] truncate max-w-[200px]">
                      {user?.email || "Google Account"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  disabled={isConnectingGCal}
                  onClick={async () => {
                    setIsConnectingGCal(true);
                    try {
                      await signInWithGoogle();
                    } finally {
                      setIsConnectingGCal(false);
                    }
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-[#0A84FF] hover:bg-[#0A84FF]/90 text-white text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50 flex items-center space-x-1"
                >
                  {isConnectingGCal ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <span>{hasGoogleCalendarAccess ? "Reconnect" : "Connect"}</span>
                  )}
                </button>
              </div>
              <p className="text-[11px] text-[#8E8E93] leading-relaxed pt-2 border-t border-[#38383A]">
                Authorizes direct sync so your scheduled workouts appear in Google Calendar, and lets ReboundFit check your busy hours to auto-fit gym sessions.
              </p>
            </div>
          </div>

          {/* =========================================================================
              APPLE HEALTH & SHORTCUTS SYNC (Live HealthKit Webhook Ingestion)
              ========================================================================= */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block">
                Apple Health Webhook Sync
              </span>
              <span className="text-[10px] font-mono text-[#30D158] font-semibold bg-[#30D158]/15 px-2 py-0.5 rounded-full">
                HealthKit PWA Bridge
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-[#2C2C2E] border border-[#38383A] space-y-4">
              {/* Header & Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-[#FF2D55]/20 text-[#FF2D55] flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                      <span>Apple Health Integration</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-[#30D158]/15 text-[#30D158] text-[9px] font-semibold">
                        Live Webhook
                      </span>
                    </div>
                    <p className="text-[11px] text-[#8E8E93]">
                      Syncs Steps, Sleep, Heart Rate & Caloric Burn
                    </p>
                  </div>
                </div>
              </div>

              {/* Credentials Box */}
              <div className="space-y-3 pt-2 border-t border-[#38383A]">
                {/* Webhook Ingestion URL */}
                <div>
                  <label className="text-[10px] font-mono text-[#8E8E93] uppercase block mb-1">
                    Webhook Endpoint URL
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={webhookUrl}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#1C1C1E] border border-[#38383A] text-xs font-mono text-white select-all truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopyWebhookUrl}
                      className="px-3 py-2 rounded-xl bg-[#1C1C1E] hover:bg-[#38383A] border border-[#38383A] text-xs font-semibold text-white transition-all flex items-center space-x-1 flex-shrink-0"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#30D158]" />
                          <span className="text-[#30D158]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Personal Sync Token */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-mono text-[#8E8E93] uppercase">
                      Personal Sync Token (Bearer Auth)
                    </label>
                    <button
                      type="button"
                      onClick={handleRegenerateToken}
                      className="text-[10px] font-mono text-[#0A84FF] hover:underline"
                    >
                      Regenerate
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={syncToken}
                      className="flex-1 px-3 py-2 rounded-xl bg-[#1C1C1E] border border-[#38383A] text-xs font-mono text-[#30D158] select-all font-semibold truncate"
                    />
                    <button
                      type="button"
                      onClick={handleCopySyncToken}
                      className="px-3 py-2 rounded-xl bg-[#1C1C1E] hover:bg-[#38383A] border border-[#38383A] text-xs font-semibold text-white transition-all flex items-center space-x-1 flex-shrink-0"
                    >
                      {copiedToken ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#30D158]" />
                          <span className="text-[#30D158]">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-neutral-400" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Action Buttons: Import Shortcut & Send Test Sample */}
              <div className="pt-2 border-t border-[#38383A] flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleDownloadShortcutConfig}
                  className="flex-1 min-w-[130px] px-3 py-2 rounded-xl bg-[#0A84FF]/15 hover:bg-[#0A84FF]/25 border border-[#0A84FF]/30 text-[#0A84FF] text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all active:scale-95"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Import Shortcut</span>
                </button>

                <button
                  type="button"
                  disabled={isTestingWebhook}
                  onClick={handleSendTestWebhook}
                  className="flex-1 min-w-[130px] px-3 py-2 rounded-xl bg-[#30D158]/15 hover:bg-[#30D158]/25 border border-[#30D158]/30 text-[#30D158] text-xs font-semibold flex items-center justify-center space-x-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isTestingWebhook ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Send Test Sync</span>
                    </>
                  )}
                </button>
              </div>

              {/* Test Feedback Notice */}
              {testWebhookStatus && (
                <div
                  className={`p-3 rounded-xl text-xs border ${
                    testWebhookStatus.type === "success"
                      ? "bg-[#30D158]/10 border-[#30D158]/30 text-[#30D158]"
                      : "bg-[#FF453A]/10 border-[#FF453A]/30 text-[#FF453A]"
                  }`}
                >
                  {testWebhookStatus.message}
                </div>
              )}

              {/* Setup Guide Accordion / Steps */}
              <div className="pt-2 border-t border-[#38383A] text-[11px] text-[#8E8E93] space-y-1.5 leading-relaxed">
                <div className="font-semibold text-white">How to connect Apple Health:</div>
                <p>
                  <strong className="text-white">Option 1 (iOS Shortcuts):</strong> Create a daily automation in the Apple Shortcuts app to send step count, sleep, and heart rate to your Webhook URL with <code className="text-[#30D158]">Authorization: Bearer [Token]</code>.
                </p>
                <p>
                  <strong className="text-white">Option 2 (Health Auto Export):</strong> In Health Auto Export, enable REST API sync and paste your Webhook URL and Sync Token.
                </p>
              </div>
            </div>
          </div>

          {/* =========================================================================
              2. PHYSICAL PARAMETERS (Height, Weight Unit, Baseline Date)
              ========================================================================= */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block">
              Physical Parameters
            </span>
            <div className="p-4 rounded-2xl bg-[#2C2C2E] border border-[#38383A] space-y-4">
              {/* Weight Unit Toggle */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Scale className="w-4 h-4 text-[#AF52DE]" />
                  <span className="text-xs font-semibold text-white">Weight Display Unit</span>
                </div>
                <div className="flex rounded-xl bg-[#1C1C1E] p-1 border border-[#38383A]">
                  <button
                    type="button"
                    onClick={() => setWeightUnit("lbs")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      weightUnit === "lbs" ? "bg-[#AF52DE] text-white" : "text-[#8E8E93]"
                    }`}
                  >
                    LBS
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightUnit("kg")}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      weightUnit === "kg" ? "bg-[#AF52DE] text-white" : "text-[#8E8E93]"
                    }`}
                  >
                    KG
                  </button>
                </div>
              </div>

              {/* Height Configuration */}
              <div className="flex items-center justify-between pt-2 border-t border-[#38383A]">
                <div className="flex items-center space-x-2">
                  <Ruler className="w-4 h-4 text-[#0A84FF]" />
                  <div>
                    <span className="text-xs font-semibold text-white block">Height</span>
                    <span className="text-[10px] text-[#8E8E93]">
                      {heightFeet} ft {heightInches} in ({heightCm} cm)
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-1.5 font-mono">
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(Math.max(100, Math.min(250, Number(e.target.value))))}
                    className="w-16 px-2 py-1 rounded-lg bg-[#1C1C1E] border border-[#38383A] text-xs font-bold text-white text-center focus:outline-none focus:border-[#0A84FF]"
                  />
                  <span className="text-xs text-[#8E8E93]">cm</span>
                </div>
              </div>

              {/* Starting Baseline Information */}
              <div className="flex items-center justify-between pt-2 border-t border-[#38383A] text-xs">
                <span className="text-[#8E8E93]">Baseline Established</span>
                <span className="font-mono text-white font-semibold">
                  {profile?.currentWeightLbs ? `${profile.currentWeightLbs} lbs` : "Recorded"} • Day 1
                </span>
              </div>
            </div>
          </div>

          {/* =========================================================================
              3. GOALS & CALORIC TARGETS
              ========================================================================= */}
          <div className="space-y-3">
            <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-wider block">
              Goals & Energy Targets
            </span>
            <div className="p-4 rounded-2xl bg-[#2C2C2E] border border-[#38383A] space-y-4">
              {/* Primary Goal Toggle */}
              <div>
                <label className="text-xs font-semibold text-[#8E8E93] block mb-1.5">
                  Primary Physique Goal
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPrimaryGoal("lean_bulk")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      primaryGoal === "lean_bulk"
                        ? "bg-[#0A84FF] text-white shadow-md shadow-[#0A84FF]/25"
                        : "bg-[#1C1C1E] text-[#8E8E93] hover:text-white border border-[#38383A]"
                    }`}
                  >
                    Lean Bulking
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrimaryGoal("recomp")}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      primaryGoal === "recomp"
                        ? "bg-[#0A84FF] text-white shadow-md shadow-[#0A84FF]/25"
                        : "bg-[#1C1C1E] text-[#8E8E93] hover:text-white border border-[#38383A]"
                    }`}
                  >
                    Body Recomposition
                  </button>
                </div>
              </div>

              {/* Surplus Presets */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[#8E8E93]">
                    Target Caloric Surplus
                  </label>
                  <span className="text-xs font-mono font-bold text-[#FF9500]">
                    +{targetSurplusKcal} kcal / day
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: "Maint", val: 0 },
                    { label: "+150", val: 150 },
                    { label: "+250", val: 250 },
                    { label: "+400", val: 400 },
                  ].map((preset) => (
                    <button
                      key={preset.val}
                      type="button"
                      onClick={() => handleSurplusPreset(preset.val)}
                      className={`py-1.5 rounded-xl text-xs font-mono font-semibold transition-all ${
                        targetSurplusKcal === preset.val
                          ? "bg-[#FF9500] text-black font-bold shadow-md shadow-[#FF9500]/25"
                          : "bg-[#1C1C1E] text-[#8E8E93] hover:text-white border border-[#38383A]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Level Selector */}
              <div>
                <label className="text-xs font-semibold text-[#8E8E93] block mb-1.5">
                  Activity Level Multiplier
                </label>
                <select
                  value={activityLevel}
                  onChange={(e) => setActivityLevel(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl bg-[#1C1C1E] border border-[#38383A] text-xs font-semibold text-white focus:outline-none focus:border-[#0A84FF]"
                >
                  <option value="sedentary">Sedentary (Desk Job, little exercise)</option>
                  <option value="light">Lightly Active (1-3 gym days/wk)</option>
                  <option value="moderate">Moderately Active (3-5 gym days/wk)</option>
                  <option value="very_active">Very Active (6-7 gym days/wk)</option>
                  <option value="extra_active">Extra Active (Athlete / Physical job)</option>
                </select>
              </div>

              {/* Calorie & Protein Targets */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#38383A]">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#FF9500] font-bold block mb-1">
                    Daily Calories
                  </label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      value={targetCalories}
                      onChange={(e) => setTargetCalories(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#1C1C1E] border border-[#38383A] text-sm font-mono font-bold text-white focus:outline-none focus:border-[#FF9500]"
                    />
                    <span className="text-xs text-[#8E8E93]">kcal</span>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-[#FF2D55] font-bold block mb-1">
                    Daily Protein
                  </label>
                  <div className="flex items-center space-x-1">
                    <input
                      type="number"
                      value={targetProteinG}
                      onChange={(e) => setTargetProteinG(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-[#1C1C1E] border border-[#38383A] text-sm font-mono font-bold text-white focus:outline-none focus:border-[#FF2D55]"
                    />
                    <span className="text-xs text-[#8E8E93]">g</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =========================================================================
              4. SIGN OUT
              ========================================================================= */}
          <div className="pt-2">
            <button
              type="button"
              onClick={async () => {
                onClose();
                await signOut();
              }}
              className="w-full py-3.5 rounded-2xl bg-[#FF2D55]/15 border border-[#FF2D55]/30 text-[#FF2D55] font-bold text-sm flex items-center justify-center space-x-2 active:scale-95 transition-all hover:bg-[#FF2D55]/25"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out of Apple Health Session</span>
            </button>
          </div>
        </div>

        {/* Pinned Sticky Bottom Footer */}
        <div className="sticky bottom-0 bg-[#1C1C1E] border-t border-[#38383A] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:pb-4 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-2xl text-xs font-semibold text-[#8E8E93] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-[#0A84FF] text-white font-extrabold text-xs shadow-lg shadow-[#0A84FF]/25 hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            {saveSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3] text-white" />
                <span>Saved!</span>
              </>
            ) : (
              <span>{isSaving ? "Saving..." : "Save Changes"}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;
