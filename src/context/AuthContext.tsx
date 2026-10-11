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
  provider: "google" | "email" | "guest";
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
  signInWithGoogle: () => Promise<{ error?: string }>;
  signInWithEmail: (email: string) => Promise<{ success: boolean; message: string; error?: string }>;
  signOut: () => Promise<void>;
  completeOnboarding: (data: OnboardingFormValues) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_AUTH_KEY = "reboundfit_auth_session";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize Auth & Profile
  useEffect(() => {
    const initAuth = async () => {
      try {
        await purgeMockDataIfPresent();
        await seedExerciseLibrary();

        // 1. Check Supabase Auth if configured
        if (isSupabaseConfigured) {
          const { data: { session } } = await supabase.auth.getSession();
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
            setIsLoading(false);
            return;
          }
        }

        // 2. Check local authenticated session
        const storedAuth = localStorage.getItem(LOCAL_AUTH_KEY);
        if (storedAuth) {
          try {
            const parsedUser: AuthUser = JSON.parse(storedAuth);
            setUser(parsedUser);
            await loadProfile(parsedUser.id);
          } catch {
            localStorage.removeItem(LOCAL_AUTH_KEY);
          }
        }
      } catch (err) {
        console.error("Auth init error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    // Listen for Supabase auth state changes if configured
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
      const existing = await db.profiles.where("userId").equals(userId).first();
      if (existing) {
        setProfile(existing);
      } else {
        setProfile(null);
      }
    } catch (err) {
      console.error("Failed to load profile for user:", err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user.id);
    }
  };

  // Google OAuth Sign-In
  const signInWithGoogle = async (): Promise<{ error?: string }> => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) return { error: error.message };
        return {};
      } else {
        // High-fidelity zero-friction OAuth local flow
        const googleUser: AuthUser = {
          id: `usr_google_${Date.now()}`,
          email: "athlete@reboundfit.app",
          name: "Rebound Athlete",
          provider: "google",
        };
        localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(googleUser));
        setUser(googleUser);
        await loadProfile(googleUser.id);
        return {};
      }
    } catch (err: any) {
      return { error: err.message || "Failed to sign in with Google" };
    }
  };

  // Magic Link / Email Sign-In
  const signInWithEmail = async (email: string) => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
          },
        });
        if (error) return { success: false, message: error.message, error: error.message };
        return { success: true, message: "Magic link sent! Check your email to log in." };
      } else {
        // Local email authentication session
        const emailUser: AuthUser = {
          id: `usr_${email.replace(/[^a-zA-Z0-9]/g, "_")}`,
          email,
          name: email.split("@")[0],
          provider: "email",
        };
        localStorage.setItem(LOCAL_AUTH_KEY, JSON.stringify(emailUser));
        setUser(emailUser);
        await loadProfile(emailUser.id);
        return { success: true, message: `Signed in as ${email}` };
      }
    } catch (err: any) {
      return { success: false, message: err.message, error: err.message };
    }
  };

  // Sign Out
  const signOut = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem(LOCAL_AUTH_KEY);
    setUser(null);
    setProfile(null);
  };

  // Complete Onboarding Flow
  const completeOnboarding = async (data: OnboardingFormValues) => {
    if (!user) throw new Error("User must be authenticated to complete onboarding");

    // Convert weight to lbs
    const weightLbs = data.weightUnit === "kg" ? Number((data.weight * 2.20462).toFixed(1)) : data.weight;
    
    // Convert height to cm
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
      proteinRatioPerLb: 0.90, // 0.90g per lb lean bulk standard
      fatPercentage: 0.25,     // 25% healthy fats
    };

    // Calculate baseline TDEE & initial target macros
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

    // Save profile to Dexie
    await db.profiles.put(newProfile);

    // Save Day 1 starting baseline weigh-in
    const startingWeighIn: LocalWeighIn = {
      id: `weigh-${today}`,
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

    // If baseline photo was provided, save it as isBaseline: true
    if (data.baselinePhotoDataUrl) {
      const baselinePhoto: LocalProgressPhoto = {
        id: `photo-baseline-${Date.now()}`,
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
