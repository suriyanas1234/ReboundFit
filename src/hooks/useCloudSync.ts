"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { db, LocalWeighIn, LocalMealLog, LocalWorkoutSet, LocalScheduledWorkout } from "@/lib/db";
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

export function useCloudSync(): CloudSyncState {
  const { user, profile } = useAuth();
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  // Helper to dispatch global window event so all tabs & screens re-render
  const notifyLocalSubscribers = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("reboundfit_sync", { detail: { timestamp: Date.now() } }));
    }
  };

  /**
   * PULL: Sync down changes from Supabase PostgreSQL (or fallback backup) to local Dexie
   */
  const pullRemoteData = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
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

        if (!weighError && remoteWeighIns && remoteWeighIns.length > 0) {
          for (const item of remoteWeighIns) {
            const localItem: LocalWeighIn = {
              id: item.id || `weigh-${user.id}-${item.logged_at}`,
              userId: user.id,
              date: item.logged_at,
              rawWeightLbs: Number(item.raw_weight_lbs),
              rawWeightKg: Number(item.raw_weight_kg || (item.raw_weight_lbs * 0.453592).toFixed(1)),
              trendWeightLbs: item.trend_weight_lbs ? Number(item.trend_weight_lbs) : undefined,
              rateOfGainLbsPerWeek: item.rate_of_gain_lbs_per_week ? Number(item.rate_of_gain_lbs_per_week) : undefined,
              notes: item.notes || undefined,
              synced: true,
              createdAt: item.created_at || new Date().toISOString(),
            };
            await db.weighIns.put(localItem);
          }
        }
      } catch (err) {
        // Table might not exist yet
      }

      // 2. Pull Meal Logs from PostgreSQL
      try {
        const { data: remoteMeals, error: mealError } = await supabase
          .from("meal_logs")
          .select("*")
          .eq("user_id", user.id)
          .order("logged_date", { ascending: false })
          .limit(100);

        if (!mealError && remoteMeals && remoteMeals.length > 0) {
          for (const item of remoteMeals) {
            const localMeal: LocalMealLog = {
              id: item.id || `meal-${user.id}-${item.logged_date}-${item.created_at}`,
              userId: user.id,
              date: item.logged_date,
              mealType: item.meal_type || "snack",
              name: item.custom_name || "Quick Log Meal",
              calories: Number(item.calories),
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
      } catch (err) {
        // Table might not exist yet
      }

      // 3. Pull Profiles table if newer
      try {
        const { data: remoteProfile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

        if (remoteProfile && profile) {
          if (remoteProfile.target_calories && remoteProfile.target_calories !== profile.targetCalories) {
            await db.profiles.update(profile.id, {
              targetCalories: remoteProfile.target_calories,
              targetProteinG: remoteProfile.target_protein_g,
              targetCarbG: remoteProfile.target_carb_g,
              targetFatG: remoteProfile.target_fat_g,
              currentWeightLbs: remoteProfile.currentWeightLbs || profile.currentWeightLbs,
            });
          }
        }
      } catch (err) {
        // Ignore table check
      }

      // 4. PUSH any unsynced local weigh-ins to Supabase
      const unsyncedWeighIns = await db.weighIns
        .where("userId")
        .equals(user.id)
        .and((w) => !w.synced)
        .toArray();

      for (const w of unsyncedWeighIns) {
        try {
          await supabase.from("weigh_ins").upsert({
            user_id: user.id,
            logged_at: w.date,
            raw_weight_lbs: w.rawWeightLbs,
            raw_weight_kg: w.rawWeightKg,
            trend_weight_lbs: w.trendWeightLbs,
            rateOfGain_lbs_per_week: w.rateOfGainLbsPerWeek,
            notes: w.notes,
          });
          await db.weighIns.update(w.id, { synced: true });
        } catch {
          // Keep synced: false for retry
        }
      }

      // 5. PUSH any unsynced local meals to Supabase
      const unsyncedMeals = await db.mealLogs
        .where("userId")
        .equals(user.id)
        .and((m) => !m.synced)
        .toArray();

      for (const m of unsyncedMeals) {
        try {
          await supabase.from("meal_logs").insert({
            user_id: user.id,
            logged_date: m.date,
            meal_type: m.mealType,
            custom_name: m.name,
            calories: m.calories,
            protein_g: m.proteinG,
            carb_g: m.carbG,
            fat_g: m.fatG,
            is_quick_dial: m.isQuickDial,
          });
          await db.mealLogs.update(m.id, { synced: true });
        } catch {
          // Keep synced: false
        }
      }

      setLastSyncedAt(new Date());
      notifyLocalSubscribers();
    } catch (err: any) {
      console.warn("Cloud sync pull note:", err);
      setError(err?.message || "Sync warning");
    } finally {
      setIsSyncing(false);
    }
  }, [user, profile]);

  /**
   * PUSH: Optimistic Weigh-In Logger with Cloud Realtime Persistence
   */
  const saveWeighIn = async (data: {
    date: string;
    rawWeightLbs: number;
    rawWeightKg?: number;
    notes?: string;
  }) => {
    if (!user) throw new Error("User required");

    const weightKg = data.rawWeightKg ?? Number((data.rawWeightLbs * 0.45359237).toFixed(1));
    const now = new Date().toISOString();

    // 1. Calculate smoothed EMA trend immediately
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

    // 2. Optimistic local Dexie update
    await db.weighIns.put(record);

    // Update profile currentWeightLbs
    if (profile) {
      await db.profiles.update(profile.id, {
        currentWeightLbs: data.rawWeightLbs,
        updatedAt: now,
      });
    }

    notifyLocalSubscribers();

    // 3. Cloud Persist to PostgreSQL + Realtime Broadcast
    if (isSupabaseConfigured) {
      try {
        const { error: pgError } = await supabase.from("weigh_ins").upsert({
          user_id: user.id,
          logged_at: data.date,
          raw_weight_lbs: data.rawWeightLbs,
          raw_weight_kg: weightKg,
          trend_weight_lbs: record.trendWeightLbs,
          rate_of_gain_lbs_per_week: record.rateOfGainLbsPerWeek,
          notes: data.notes,
        });

        if (!pgError) {
          await db.weighIns.update(record.id, { synced: true });
        }

        // Broadcast to other devices (mobile -> desktop or vice versa)
        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "weigh_in_logged",
            payload: record,
          });
        }
      } catch (cloudErr) {
        console.warn("PostgreSQL weigh-in sync deferred:", cloudErr);
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
    if (!user) throw new Error("User required");

    const dateStr = data.date || new Date().toISOString().split("T")[0];
    const now = new Date().toISOString();
    const id = `meal-${user.id}-${Date.now()}`;

    const meal: LocalMealLog = {
      id,
      userId: user.id,
      date: dateStr,
      mealType: data.mealType,
      name: data.name,
      calories: data.calories,
      proteinG: data.proteinG,
      carbG: data.carbG,
      fatG: data.fatG,
      isQuickDial: Boolean(data.isQuickDial),
      synced: false,
      createdAt: now,
    };

    // 1. Optimistic Dexie write
    await db.mealLogs.put(meal);
    notifyLocalSubscribers();

    // 2. Cloud Persist to Supabase + Broadcast
    if (isSupabaseConfigured) {
      try {
        const { error: pgError } = await supabase.from("meal_logs").insert({
          user_id: user.id,
          logged_date: dateStr,
          meal_type: data.mealType,
          custom_name: data.name,
          calories: data.calories,
          protein_g: data.proteinG,
          carb_g: data.carbG,
          fat_g: data.fatG,
          is_quick_dial: Boolean(data.isQuickDial),
        });

        if (!pgError) {
          await db.mealLogs.update(meal.id, { synced: true });
        }

        // Realtime broadcast to connected devices
        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "meal_logged",
            payload: meal,
          });
        }
      } catch (cloudErr) {
        console.warn("PostgreSQL meal log sync deferred:", cloudErr);
      }
    }

    return meal;
  };

  /**
   * PUSH: Optimistic Meal Delete with Cloud Persistence
   */
  const deleteMealLog = async (mealId: string) => {
    if (!user) return;

    // 1. Optimistic Dexie delete
    await db.mealLogs.delete(mealId);
    notifyLocalSubscribers();

    // 2. Cloud delete + Broadcast
    if (isSupabaseConfigured) {
      try {
        await supabase.from("meal_logs").delete().eq("id", mealId).eq("user_id", user.id);

        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "meal_deleted",
            payload: { mealId, userId: user.id },
          });
        }
      } catch (cloudErr) {
        console.warn("PostgreSQL meal delete note:", cloudErr);
      }
    }
  };

  /**
   * PUSH: Optimistic Workout Set Logger with Cloud Persistence
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
    if (!user) return;

    const id = `set-${user.id}-${Date.now()}-${data.setNumber}`;
    const setRecord: LocalWorkoutSet = {
      id,
      userId: user.id,
      workoutId: data.workoutId,
      exerciseId: data.exerciseId,
      setNumber: data.setNumber,
      weightLbs: data.weightLbs,
      reps: data.reps,
      isWarmup: Boolean(data.isWarmup),
      isPr: Boolean(data.isPr),
      synced: false,
    };

    // 1. Optimistic local write
    await db.workoutSets.put(setRecord);
    notifyLocalSubscribers();

    // 2. Cloud Persist + Broadcast
    if (isSupabaseConfigured) {
      try {
        await supabase.from("workout_sets").insert({
          workout_id: data.workoutId,
          exercise_id: data.exerciseId,
          set_number: data.setNumber,
          weight_lbs: data.weightLbs,
          weight_kg: Number((data.weightLbs * 0.453592).toFixed(1)),
          reps: data.reps,
          is_warmup: Boolean(data.isWarmup),
          is_pr: Boolean(data.isPr),
        });

        if (channelRef.current) {
          await channelRef.current.send({
            type: "broadcast",
            event: "workout_set_logged",
            payload: setRecord,
          });
        }
      } catch (cloudErr) {
        console.warn("PostgreSQL workout set sync note:", cloudErr);
      }
    }
  };

  /**
   * Realtime Channel Setup & Lifecycle
   */
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    // Online/offline tracking
    setIsOnline(navigator.onLine);
    const handleOnline = () => {
      setIsOnline(true);
      pullRemoteData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Initial pull
    pullRemoteData();

    // 1. Subscribe to Supabase Realtime Channel
    const channelName = `reboundfit_sync_${user.id}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { ack: false, self: false },
      },
    });

    // Listen for Realtime Broadcasts from other devices
    channel
      .on("broadcast", { event: "weigh_in_logged" }, async ({ payload }) => {
        if (payload && payload.userId === user.id) {
          await db.weighIns.put({ ...payload, synced: true });
          notifyLocalSubscribers();
        }
      })
      .on("broadcast", { event: "meal_logged" }, async ({ payload }) => {
        if (payload && payload.userId === user.id) {
          await db.mealLogs.put({ ...payload, synced: true });
          notifyLocalSubscribers();
        }
      })
      .on("broadcast", { event: "meal_deleted" }, async ({ payload }) => {
        if (payload && payload.mealId) {
          await db.mealLogs.delete(payload.mealId);
          notifyLocalSubscribers();
        }
      })
      .on("broadcast", { event: "workout_set_logged" }, async ({ payload }) => {
        if (payload && payload.userId === user.id) {
          await db.workoutSets.put({ ...payload, synced: true });
          notifyLocalSubscribers();
        }
      })
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "weigh_ins", filter: `user_id=eq.${user.id}` },
        () => {
          pullRemoteData();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meal_logs", filter: `user_id=eq.${user.id}` },
        () => {
          pullRemoteData();
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Channel active
        }
      });

    channelRef.current = channel;

    // 2. Tab focus & visibility sync (seamless catching up when user switches devices)
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
      }
    };
  }, [user, pullRemoteData]);

  return {
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
}
