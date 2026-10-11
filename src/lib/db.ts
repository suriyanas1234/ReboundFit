import Dexie, { Table } from 'dexie';

export interface LocalProfile {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  heightCm: number;
  currentWeightLbs: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';
  unitPreference: 'imperial' | 'metric';
  targetGainRateLbsPerWeek: number;
  proteinRatioPerLb: number;
  fatPercentage: number;
  baseTdee: number;
  smoothedTdee: number;
  targetCalories: number;
  targetProteinG: number;
  targetCarbG: number;
  targetFatG: number;
  updatedAt: string;
}

export interface LocalWeighIn {
  id: string;
  date: string; // YYYY-MM-DD
  rawWeightLbs: number;
  rawWeightKg: number;
  trendWeightLbs?: number;
  rateOfGainLbsPerWeek?: number;
  notes?: string;
  synced: boolean;
  createdAt: string;
}

export interface LocalMealLog {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'post_workout' | 'snack';
  name: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  isQuickDial: boolean;
  synced: boolean;
  createdAt: string;
}

export interface LocalExercise {
  id: string;
  name: string;
  muscleGroup: 'chest' | 'back' | 'quads' | 'hamstrings' | 'shoulders' | 'biceps' | 'triceps' | 'calves' | 'abs' | 'full_body';
  isCompound: boolean;
  defaultRestSeconds: number;
}

export interface LocalWorkout {
  id: string;
  name: string;
  startedAt: string;
  completedAt?: string | null;
  totalVolumeLbs: number;
  synced: boolean;
}

export interface LocalWorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  weightLbs: number;
  reps: number;
  rpe?: number;
  isWarmup: boolean;
  isPr: boolean;
  prType?: 'weight' | 'reps' | 'volume';
  previousBestWeightLbs?: number;
  previousBestReps?: number;
  synced: boolean;
}

export interface LocalProgressPhoto {
  id: string;
  date: string;
  weekNumber: number;
  pose: 'front_relaxed' | 'front_flexed' | 'side_left' | 'side_right' | 'back_lat_spread';
  weightLbs: number;
  photoDataUrl: string; // Base64 data URL for instant offline local access
  notes?: string;
  synced: boolean;
}

export interface LocalSyncQueueItem {
  id: string;
  table: string;
  action: 'insert' | 'update' | 'delete';
  recordId: string;
  payload: any;
  timestamp: string;
  status: 'pending' | 'in_progress' | 'failed';
  retryCount: number;
}

export class ReboundFitDatabase extends Dexie {
  profiles!: Table<LocalProfile, string>;
  weighIns!: Table<LocalWeighIn, string>;
  mealLogs!: Table<LocalMealLog, string>;
  exercises!: Table<LocalExercise, string>;
  workouts!: Table<LocalWorkout, string>;
  workoutSets!: Table<LocalWorkoutSet, string>;
  photos!: Table<LocalProgressPhoto, string>;
  syncQueue!: Table<LocalSyncQueueItem, string>;

  constructor() {
    super('ReboundFitLocalDB');
    this.version(1).stores({
      profiles: 'id',
      weighIns: 'id, date, synced',
      mealLogs: 'id, date, mealType, synced',
      exercises: 'id, muscleGroup, isCompound',
      workouts: 'id, startedAt, synced',
      workoutSets: 'id, workoutId, exerciseId, synced',
      photos: 'id, date, weekNumber, pose, synced',
      syncQueue: 'id, table, status, timestamp',
    });
  }
}

export const db = new ReboundFitDatabase();

/**
 * Initializes default user profile and compound exercise library on first run.
 */
export async function initializeDefaultLocalData() {
  const profileCount = await db.profiles.count();
  if (profileCount === 0) {
    const defaultProfile: LocalProfile = {
      id: 'local-user-default',
      name: 'Rebound Athlete',
      gender: 'male',
      age: 26,
      heightCm: 178,
      currentWeightLbs: 175.5,
      activityLevel: 'moderate',
      unitPreference: 'imperial',
      targetGainRateLbsPerWeek: 0.35,
      proteinRatioPerLb: 0.95,
      fatPercentage: 0.25,
      baseTdee: 2650,
      smoothedTdee: 2650,
      targetCalories: 2925,
      targetProteinG: 167,
      targetCarbG: 390,
      targetFatG: 81,
      updatedAt: new Date().toISOString(),
    };
    await db.profiles.put(defaultProfile);
  }

  const exerciseCount = await db.exercises.count();
  if (exerciseCount === 0) {
    const defaultExercises: LocalExercise[] = [
      { id: 'ex-1', name: 'Barbell Flat Bench Press', muscleGroup: 'chest', isCompound: true, defaultRestSeconds: 150 },
      { id: 'ex-2', name: 'Incline Dumbbell Press', muscleGroup: 'chest', isCompound: true, defaultRestSeconds: 120 },
      { id: 'ex-3', name: 'Barbell Back Squat', muscleGroup: 'quads', isCompound: true, defaultRestSeconds: 180 },
      { id: 'ex-4', name: 'Romanian Deadlift (RDL)', muscleGroup: 'hamstrings', isCompound: true, defaultRestSeconds: 150 },
      { id: 'ex-5', name: 'Standing Overhead Press (OHP)', muscleGroup: 'shoulders', isCompound: true, defaultRestSeconds: 150 },
      { id: 'ex-6', name: 'Weighted Pull-Up', muscleGroup: 'back', isCompound: true, defaultRestSeconds: 120 },
      { id: 'ex-7', name: 'Barbell Chest-Supported Row', muscleGroup: 'back', isCompound: true, defaultRestSeconds: 120 },
      { id: 'ex-8', name: 'Cable Lateral Raise', muscleGroup: 'shoulders', isCompound: false, defaultRestSeconds: 90 },
      { id: 'ex-9', name: 'Incline Dumbbell Curl', muscleGroup: 'biceps', isCompound: false, defaultRestSeconds: 90 },
      { id: 'ex-10', name: 'Triceps Overhead Cable Extension', muscleGroup: 'triceps', isCompound: false, defaultRestSeconds: 90 },
    ];
    await db.exercises.bulkPut(defaultExercises);
  }

  // Pre-seed 10 days of sample weigh-in and meal data for immediate visualization
  const weighInCount = await db.weighIns.count();
  if (weighInCount === 0) {
    const today = new Date();
    const sampleWeighIns: LocalWeighIn[] = [];
    const sampleMeals: LocalMealLog[] = [];

    const weights = [174.2, 174.6, 174.4, 174.9, 175.1, 174.8, 175.3, 175.2, 175.6, 175.5];
    for (let i = 9; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const rawWeight = weights[9 - i];

      sampleWeighIns.push({
        id: `weigh-${dateStr}`,
        date: dateStr,
        rawWeightLbs: rawWeight,
        rawWeightKg: Number((rawWeight * 0.453592).toFixed(2)),
        trendWeightLbs: Number((174.2 + (0.13 * (9 - i))).toFixed(2)),
        rateOfGainLbsPerWeek: 0.34,
        synced: true,
        createdAt: d.toISOString(),
      });

      // Sample meals for today
      if (i === 0) {
        sampleMeals.push(
          {
            id: `meal-${dateStr}-1`,
            date: dateStr,
            mealType: 'breakfast',
            name: '4 Eggs, 80g Rolled Oats & Banana',
            calories: 680,
            proteinG: 38,
            carbG: 82,
            fatG: 22,
            isQuickDial: false,
            synced: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: `meal-${dateStr}-2`,
            date: dateStr,
            mealType: 'lunch',
            name: '200g Chicken Breast, 150g White Rice & Broccoli',
            calories: 550,
            proteinG: 62,
            carbG: 65,
            fatG: 6,
            isQuickDial: false,
            synced: true,
            createdAt: new Date().toISOString(),
          },
          {
            id: `meal-${dateStr}-3`,
            date: dateStr,
            mealType: 'snack',
            name: 'Quick Dial: Post-Workout Shake + Honey',
            calories: 420,
            proteinG: 35,
            carbG: 55,
            fatG: 4,
            isQuickDial: true,
            synced: true,
            createdAt: new Date().toISOString(),
          }
        );
      }
    }

    await db.weighIns.bulkPut(sampleWeighIns);
    await db.mealLogs.bulkPut(sampleMeals);
  }
}
