"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { db, LocalWeighIn, LocalMealLog, LocalWorkoutSet } from "@/lib/db";
import { useAuth } from "@/context/AuthContext";
import { calculateWeightTrend } from "@/algorithms/weightTrend";

export interface CloudSyncState {
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  isOnline: boolean;
  error: string | null;
  syncNow: () => Promise<void>;
  saveWeighIn: (data: {
    date: string;
    rawWeightLbs: number;
    rawWeightKg?: number;
    notes?: string;
  }) => Promise<void>;
  saveMealLog: (data: {
    name: string;
    mealType: LocalMealLog["mealType"];
    calories: number;
    proteinG: number;
    carbG: number;
    fatG: number;
    isQuickDial?: boolean;
    date?: string;
  }) => Promise<LocalMealLog>;
  deleteMealLog: (mealId: string) => Promise<void>;
  saveWorkoutSet: (data: {
    workoutId: string;
    exerciseId: string;
    setNumber: number;
    weightLbs: number;
    reps: number;
    isWarmup?: boolean;
    isPr?: boolean;
  }) => Promise<void>;
}

const CloudSyncContext = createContext<CloudSyncState | null>(null);

export function CloudSyncProvider({ children }: { children: React.ReactNode }) {
  const { user, profile } = useAuth();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<any>(null);
  const isPullingRef = useRef<boolean>(false);
  const lastNotifyTimeRef = useRef<number>(0);

  // Debounced notification to prevent cascade loop renders
  const notifyLocalSubscribers = useCallback(() => {
    if (typeof window === "undefined") return;
    const now = Date.now();
    if (now - lastNotifyTimeRef.current < 800) return;
    lastNotifyTimeRef.current = now;
    window.dispatchEvent(new CustomEvent("reboundfit_sync", { detail: { timestamp: now } }));
  }, []);

  /**
   * PULL: Sync down changes from Supabase PostgreSQL to local Dexie
   */
  const pullRemoteData = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured || isPullingRef.current) return;
    isPullingRef.current = true;
    setIsSyncing(true);
    setError(null);

    try {
      // 1. Pull Weigh-Ins from PostgreSQL
      try {
        const { data: remoteWeighIns, error: weighError } = await supabase
          .from("weigh_ins")
          .select("*")
          .eq("user_id", user.id)
          .order("logged_at", { ascending: false })
          .limit(60);

        if (!weighError && Array.isArray(remoteWeighIns) && remoteWeighIns.length > 0) {
          for (const item of remoteWeighIns) {
            const rawLbs = Number(item.raw_weight_lbs || 0);
            if (rawLbs <= 0) continue;
            const localItem: LocalWeighIn = {
              id: item.id || `weigh-${user.id}-${item.logged_at}`,
              userId: user.id,
              date: item.logged_at,
              rawWeightLbs: rawLbs,
              rawWeightKg: Number(item.raw_weight_kg || (rawLbs * 0.453592).toFixed(1)),
              trendWeightLbs: item.trend_weight_lbs ? Number(item.trend_weight_lbs) : rawLbs,
              rateOfGainLbsPerWeek: item.rate_of_gain_lbs_per_week ? Number(item.rate_of_gain_lbs_per_week) : 0,
              notes: item.notes || undefined,
              synced: true,
              createdAt: item.created_at || new Date().toISOString(),
            };
            await db.weighIns.put(localItem);
          }
        }
      } catch {
        // Table may not exist yet
      }

      // 2. Pull Meal Logs from PostgreSQL
      try {
        const { data: remoteMeals, error: mealError } = await supabase
          .from("meal_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("logged_date", { ascending: false })
          .limit(100);

        if (!mealError && Array.isArray(remoteMeals) && remoteMeals.length > 0) {
          for (const item of remoteMeals) {
            const localMeal: LocalMealLog = {
              id: item.id || `meal-${user.id}-${item.logged_date}-${item.created_at}`,
              userId: user.id,
              date: item.logged_date,
              mealType: item.meal_type || "snack",
              name: item.custom_name || "Quick Log Meal",
              calories: Number(item.calories || 0),
              proteinG: Number(item.protein_g || 0),
              carbG: Number(item.carb_g || 0),
              fatG: Number(item.fat_g || 0),
              isQuickDial: Boolean(item.is_quick_dial),
              synced: true,
              createdAt: item.created_at || new Date().toISOString(),
            };
            await db.mealLogs.put(localMeal);
          }
        }
      } catch {
        // Table may not exist yet
      }

      setLastSyncedAt(new Date());
      notifyLocalSubscribers();
    } catch (err: any) {
      setError(err?.message || "Sync error");
    } finally {
      setIsSyncing(false);
      isPullingRef.current = false;
    }
  }, [user?.id, notifyLocalSubscribers]);

  /**
   * PUSH: Optimistic Weigh-In Logger with Cloud Realtime Persistence
   */
  const saveWeighIn = async (data: {
    date: string;
    rawWeightLbs: number;
    rawWeightKg?: number;
    notes?: string;
  }) => {
    if (!user) return;

    const weightKg = data.rawWeightKg ?? Number((data.rawWeightLbs * 0.45359237).toFixed(1));
    const now = new Date().toISOString();

    const existing = await db.weighIns.where("userId").equals(user.id).toArray();
    const updatedList = [
      ...existing.filter((w) => w.date !== data.date),
      {
        id: `weigh-${user.id}-${data.date}`,
        userId: user.id,
        date: data.date,
        rawWeightLbs: data.rawWeightLbs,
        rawWeightKg: weightKg,
        synced: false,
        createdAt: now,
      },
    ];

    const smoothed = calculateWeightTrend(
      updatedList.map((w) => ({ date: w.date, rawWeightLbs: w.rawWeightLbs }))
    );
    const latestSmoothed = smoothed.find((s) => s.date === data.date);

    const record: LocalWeighIn = {
      id: `weigh-${user.id}-${data.date}`,
      userId: user.id,
      date: data.date,
      rawWeightLbs: data.rawWeightLbs,
      rawWeightKg: weightKg,
      trendWeightLbs: latestSmoothed?.trendWeightLbs ?? data.rawWeightLbs,
      rateOfGainLbsPerWeek: latestSmoothed?.rateOfGainLbsPerWeek ?? 0,
      notes: data.notes,
      synced: false,
      createdAt: now,
    };

    // 1. Optimistic local update
    await db.weighIns.put(record);

    if (profile?.id) {
      await db.profiles.update(profile.id, {
        currentWeightLbs: data.rawWeightLbs,
        updatedAt: now,
      });
    }

    notifyLocalSubscribers();

    // 2. Cloud Persist to PostgreSQL + Broadcast
    if (isSupabaseConfigured) {
      try {
        await supabase.from("weigh_ins").upsert({
          user_id: user.id,
          logged_at: data.date,
          raw_weight_lbs: data.rawWeightLbs,
          raw_weight_kg: weightKg,
          trend_weight_lbs: record.trendWeightLbs,
          rate_of_gain_lbs_per_week: record.rateOfGainLbsPerWeek,
          notes: data.notes,
        });

        await db.weighIns.update(record.id, { synced: true });

        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "weigh_in_logged",
            payload: record,
          });
        }
      } catch {
        // Will retry later
      }
    }
  };

  /**
   * PUSH: Optimistic Meal Logger with Cloud Realtime Persistence
   */
  const saveMealLog = async (data: {
    name: string;
    mealType: LocalMealLog["mealType"];
    calories: number;
    proteinG: number;
    carbG: number;
    fatG: number;
    isQuickDial?: boolean;
    date?: string;
  }): Promise<LocalMealLog> => {
    const userId = user?.id || "anonymous";
    const dateStr = data.date || new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();
    const id = `meal-${userId}-${Date.now()}`;

    const meal: LocalMealLog = {
      id,
      userId,
      date: dateStr,
      mealType: data.mealType,
      name: data.name,
      calories: Math.max(0, Number(data.calories || 0)),
      proteinG: Math.max(0, Number(data.proteinG || 0)),
      carbG: Math.max(0, Number(data.carbG || 0)),
      fatG: Math.max(0, Number(data.fatG || 0)),
      isQuickDial: Boolean(data.isQuickDial),
      synced: false,
      createdAt: now,
    };

    // 1. Optimistic Dexie write
    await db.mealLogs.put(meal);
    notifyLocalSubscribers();

    // 2. Cloud Persist to Supabase + Broadcast
    if (isSupabaseConfigured && user?.id) {
      try {
        await supabase.from("meal_logs").insert({
          user_id: user.id,
          logged_date: dateStr,
          meal_type: data.mealType,
          custom_name: data.name,
          calories: meal.calories,
          protein_g: meal.proteinG,
          carb_g: meal.carbG,
          fat_g: meal.fatG,
          is_quick_dial: meal.isQuickDial,
        });

        await db.mealLogs.update(meal.id, { synced: true });

        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "meal_logged",
            payload: meal,
          });
        }
      } catch {
        // Handled silently
      }
    }

    return meal;
  };

  /**
   * PUSH: Optimistic Meal Delete
   */
  const deleteMealLog = async (mealId: string) => {
    await db.mealLogs.delete(mealId);
    notifyLocalSubscribers();

    if (isSupabaseConfigured && user?.id) {
      try {
        await supabase.from("meal_logs").delete().eq("id", mealId).eq("user_id", user.id);

        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "meal_deleted",
            payload: { mealId, userId: user.id },
          });
        }
      } catch {
        // Handled silently
      }
    }
  };

  /**
   * PUSH: Optimistic Workout Set Logger
   */
  const saveWorkoutSet = async (data: {
    workoutId: string;
    exerciseId: string;
    setNumber: number;
    weightLbs: number;
    reps: number;
    isWarmup?: boolean;
    isPr?: boolean;
  }) => {
    const userId = user?.id || "anonymous";
    const id = `set-${userId}-${Date.now()}-${data.setNumber}`;
    const setRecord: LocalWorkoutSet = {
      id,
      userId,
      workoutId: data.workoutId,
      exerciseId: data.exerciseId,
      setNumber: data.setNumber,
      weightLbs: Number(data.weightLbs || 0),
      reps: Number(data.reps || 0),
      isWarmup: Boolean(data.isWarmup),
      isPr: Boolean(data.isPr),
      synced: false,
    };

    await db.workoutSets.put(setRecord);
    notifyLocalSubscribers();

    if (isSupabaseConfigured && user?.id) {
      try {
        await supabase.from("workout_sets").insert({
          workout_id: data.workoutId,
          exercise_id: data.exerciseId,
          set_number: data.setNumber,
          weight_lbs: setRecord.weightLbs,
          weight_kg: Number((setRecord.weightLbs * 0.453592).toFixed(1)),
          reps: setRecord.reps,
          is_warmup: setRecord.isWarmup,
          is_pr: setRecord.isPr,
        });

        if (channelRef.current) {
          channelRef.current.send({
            type: "broadcast",
            event: "workout_set_logged",
            payload: setRecord,
          });
        }
      } catch {
        // Handled silently
      }
    }
  };

  /**
   * Realtime Channel Setup (SINGLE instance at Provider root)
   */
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured) return;

    if (typeof navigator !== "undefined") {
      setIsOnline(navigator.onLine);
    }

    const handleOnline = () => {
      setIsOnline(true);
      pullRemoteData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial pull
    pullRemoteData();

    // Setup SINGLE Supabase channel
    const channelName = `reboundfit_sync_${user.id}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

    channel
      .on("broadcast", { event: "weigh_in_logged" }, async ({ payload }) => {
        if (payload?.userId === user.id) {
          await db.weighIns.put({ ...payload, synced: true });
          notifyLocalSubscribers();
        }
      })
      .on("broadcast", { event: "meal_logged" }, async ({ payload }) => {
        if (payload?.userId === user.id) {
          await db.mealLogs.put({ ...payload, synced: true });
          notifyLocalSubscribers();
        }
      })
      .on("broadcast", { event: "meal_deleted" }, async ({ payload }) => {
        if (payload?.mealId) {
          await db.mealLogs.delete(payload.mealId);
          notifyLocalSubscribers();
        }
      })
      .on("broadcast", { event: "workout_set_logged" }, async ({ payload }) => {
        if (payload?.userId === user.id) {
          await db.workoutSets.put({ ...payload, synced: true });
          notifyLocalSubscribers();
        }
      })
      .subscribe();

    channelRef.current = channel;

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        pullRemoteData();
      }
    };
    window.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleVisibility);

      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [user?.id, pullRemoteData, notifyLocalSubscribers]);

  const value: CloudSyncState = {
    isSyncing,
    lastSyncedAt,
    isOnline,
    error,
    syncNow: pullRemoteData,
    saveWeighIn,
    saveMealLog,
    deleteMealLog,
    saveWorkoutSet,
  };

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
}

export function useCloudSync(): CloudSyncState {
  const context = useContext(CloudSyncContext);
  if (context) return context;

  // Fallback safe implementations if used outside provider
  return {
    isSyncing: false,
    lastSyncedAt: null,
    isOnline: true,
    error: null,
    syncNow: async () => {},
    saveWeighIn: async () => {},
    saveMealLog: async (data: any) => ({
      id: `meal-${Date.now()}`,
      userId: "",
      date: new Date().toISOString().split("T")[0],
      mealType: data.mealType,
      name: data.name,
      calories: data.calories,
      proteinG: data.proteinG,
      carbG: data.carbG,
      fatG: data.fatG,
      isQuickDial: false,
      synced: false,
      createdAt: new Date().toISOString(),
    }),
    deleteMealLog: async () => {},
    saveWorkoutSet: async () => {},
  };
}
