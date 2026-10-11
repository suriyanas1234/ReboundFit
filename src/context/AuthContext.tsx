"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { db, LocalProfile, LocalWeighIn, LocalProgressPhoto, seedExerciseLibrary, purgeMockDataIfPresent } from "@/lib/db";
import { calculateInitialTdee, calculateMacroTargets, UserPhysiqueProfile } from "@/algorithms/adaptiveTdee";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
  provider: "google" | "email";
}

export interface OnboardingFormValues {
  weight: number;
  weightUnit: "lbs" | "kg";
  height: number;
  heightUnit: "cm" | "ft_in";
  heightFeet?: number;
  heightInches?: number;
  age: number;
  gender: "male" | "female";
  primaryGoal: "lean_bulk" | "recomp";
  gainRateTier: "conservative" | "moderate" | "aggressive" | "maintain";
  targetGainRateLbsPerWeek: number;
  activityLevel: "sedentary" | "light" | "moderate" | "very_active" | "extra_active";
  trainingSplit: "ppl" | "upper_lower" | "full_body" | "custom";
  baselinePhotoDataUrl?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  profile: LocalProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  hasCompletedOnboarding: boolean;
  isConfigured: boolean;
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithEmail: (email: string) => Promise<{ success: boolean; message: string; error?: string }>;
  signOut: () => Promise<void>;
  completeOnboarding: (data: OnboardingFormValues) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      try {
        await purgeMockDataIfPresent();
        await seedExerciseLibrary();

        // 1. Check Supabase Auth session
        if (isSupabaseConfigured) {
          const { data: { session }, error } = await supabase.auth.getSession();
          if (!error && session?.user) {
            const authUser: AuthUser = {
              id: session.user.id,
              email: session.user.email || "",
              name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Lifter",
              avatarUrl: session.user.user_metadata?.avatar_url,
              provider: (session.user.app_metadata?.provider as any) || "google",
            };
            setUser(authUser);
            await loadProfile(authUser.id);
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // 2. Listen for Supabase Auth state changes
    if (isSupabaseConfigured) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
          const authUser: AuthUser = {
            id: session.user.id,
            email: session.user.email || "",
            name: session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Lifter",
            avatarUrl: session.user.user_metadata?.avatar_url,
            provider: (session.user.app_metadata?.provider as any) || "google",
          };
          setUser(authUser);
          await loadProfile(authUser.id);
        } else if (event === "SIGNED_OUT") {
          setUser(null);
          setProfile(null);
        }
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const loadProfile = async (userId: string) => {
    try {
      // Check local Dexie first
      let localProf = await db.profiles.where("userId").equals(userId).first();

      // If not in Dexie and Supabase is active, check Supabase PostgreSQL
      if (!localProf && isSupabaseConfigured) {
        const { data: remote } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();

        if (remote && remote.target_calories) {
          localProf = {
            id: `profile-${userId}`,
            userId,
            email: remote.email || "",
            name: remote.display_name || "Athlete",
            onboardingCompleted: true,
            gender: remote.gender || "male",
            age: 26,
            heightCm: Number(remote.height_cm) || 178,
            currentWeightLbs: 175,
            activityLevel: remote.activity_level || "moderate",
            unitPreference: remote.unit_preference || "imperial",
            primaryGoal: remote.gain_rate_goal === "recomp_maintenance" ? "recomp" : "lean_bulk",
            targetGainRateLbsPerWeek: Number(remote.target_gain_lbs_per_week) || 0.50,
            trainingSplit: "ppl",
            proteinRatioPerLb: Number(remote.protein_ratio_per_lb) || 0.90,
            fatPercentage: Number(remote.fat_calorie_percentage) || 0.25,
            baseTdee: remote.base_tdee || 2400,
            smoothedTdee: remote.smoothed_tdee || 2400,
            targetCalories: remote.target_calories || 2650,
            targetProteinG: remote.target_protein_g || 160,
            targetCarbG: remote.target_carb_g || 330,
            targetFatG: remote.target_fat_g || 70,
            createdAt: remote.created_at || new Date().toISOString(),
            updatedAt: remote.updated_at || new Date().toISOString(),
          };
          await db.profiles.put(localProf);
        }
      }

      setProfile(localProf || null);
    } catch (err) {
      console.error("Failed to load profile for user:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  // Google OAuth Sign-In (Mandatory prompt: 'select_account' and redirect to /auth/callback)
  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    try {
      if (!isSupabaseConfigured) {
        return {
          error:
            "Missing Supabase configuration. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file or Vercel Environment Variables.",
        };
      }

      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          queryParams: {
            prompt: "select_account",
            access_type: "offline",
          },
          redirectTo: redirectUrl,
        },
      });

      if (error) return { error: error.message };
      return {};
    } catch (err: any) {
      return { error: err.message || "Failed to initiate Google sign in" };
    }
  };

  // Magic Link / Email Sign-In
  const signInWithEmail = async (email: string) => {
    try {
      if (!isSupabaseConfigured) {
        return {
          success: false,
          message:
            "Missing Supabase configuration. Please define NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file or Vercel Environment Variables.",
          error: "Supabase not configured",
        };
      }

      const redirectUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/auth/callback`
          : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: redirectUrl,
        },
      });

      if (error) return { success: false, message: error.message, error: error.message };
      return { success: true, message: `Magic link sent to ${email}! Check your inbox.` };
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  };

  // Sign Out
  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
  };

  // Complete Onboarding Flow
  const completeOnboarding = async (data: OnboardingFormValues) => {
    if (!user) throw new Error("User must be authenticated to complete onboarding");

    const weightLbs = data.weightUnit === "kg" ? Number((data.weight * 2.20462).toFixed(1)) : data.weight;
    
    let heightCm = data.height;
    if (data.heightUnit === "ft_in") {
      const feet = data.heightFeet || 5;
      const inches = data.heightInches || 10;
      heightCm = Number(((feet * 12 + inches) * 2.54).toFixed(1));
    }

    const physiqueProfile: UserPhysiqueProfile = {
      gender: data.gender,
      age: data.age,
      heightCm,
      currentWeightLbs: weightLbs,
      activityLevel: data.activityLevel,
      targetGainRateLbsPerWeek: data.targetGainRateLbsPerWeek,
      proteinRatioPerLb: 0.90,
      fatPercentage: 0.25,
    };

    const baseTdee = calculateInitialTdee(physiqueProfile);
    const macroTargets = calculateMacroTargets(baseTdee, physiqueProfile);

    const now = new Date().toISOString();
    const today = now.split("T")[0];

    const newProfile: LocalProfile = {
      id: `profile-${user.id}`,
      userId: user.id,
      email: user.email,
      name: user.name,
      onboardingCompleted: true,
      gender: data.gender,
      age: data.age,
      heightCm,
      currentWeightLbs: weightLbs,
      activityLevel: data.activityLevel,
      unitPreference: data.weightUnit === "kg" ? "metric" : "imperial",
      primaryGoal: data.primaryGoal,
      targetGainRateLbsPerWeek: data.targetGainRateLbsPerWeek,
      trainingSplit: data.trainingSplit,
      proteinRatioPerLb: 0.90,
      fatPercentage: 0.25,
      baseTdee,
      smoothedTdee: baseTdee,
      targetCalories: macroTargets.calories,
      targetProteinG: macroTargets.proteinGrams,
      targetCarbG: macroTargets.carbGrams,
      targetFatG: macroTargets.fatGrams,
      createdAt: now,
      updatedAt: now,
    };

    // Save to local Dexie
    await db.profiles.put(newProfile);

    // Day 1 Baseline weigh-in
    const startingWeighIn: LocalWeighIn = {
      id: `weigh-${user.id}-${today}`,
      userId: user.id,
      date: today,
      rawWeightLbs: weightLbs,
      rawWeightKg: Number((weightLbs * 0.453592).toFixed(1)),
      trendWeightLbs: weightLbs,
      rateOfGainLbsPerWeek: 0,
      notes: "Starting Baseline Weigh-In",
      synced: false,
      createdAt: now,
    };
    await db.weighIns.put(startingWeighIn);

    // Save Baseline Photo if provided
    if (data.baselinePhotoDataUrl) {
      const baselinePhoto: LocalProgressPhoto = {
        id: `photo-baseline-${user.id}-${Date.now()}`,
        userId: user.id,
        date: today,
        weekNumber: 1,
        pose: "front_relaxed",
        weightLbs,
        photoDataUrl: data.baselinePhotoDataUrl,
        notes: "Starting Baseline Physique",
        isBaseline: true,
        synced: false,
      };
      await db.photos.put(baselinePhoto);
    }

    // Also persist to Supabase PostgreSQL if connected
    if (isSupabaseConfigured) {
      try {
        await supabase.from("profiles").upsert({
          id: user.id,
          email: user.email,
          display_name: user.name,
          gender: data.gender,
          birth_date: new Date(Date.now() - data.age * 365.25 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
          height_cm: heightCm,
          activity_level: data.activityLevel,
          unit_preference: data.weightUnit === "kg" ? "metric" : "imperial",
          gain_rate_goal: data.primaryGoal === "recomp" ? "recomp_maintenance" : "lean_bulk_standard",
          target_gain_lbs_per_week: data.targetGainRateLbsPerWeek,
          base_tdee: baseTdee,
          smoothed_tdee: baseTdee,
          target_calories: macroTargets.calories,
          target_protein_g: macroTargets.proteinGrams,
          target_carb_g: macroTargets.carbGrams,
          target_fat_g: macroTargets.fatGrams,
        });
      } catch (e) {
        console.warn("Supabase profile sync skipped (local-first active):", e);
      }
    }

    setProfile(newProfile);
  };

  const hasCompletedOnboarding = Boolean(profile?.onboardingCompleted);
  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isLoading,
        isAuthenticated,
        hasCompletedOnboarding,
        isConfigured: isSupabaseConfigured,
        signInWithGoogle,
        signInWithEmail,
        signOut,
        completeOnboarding,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
