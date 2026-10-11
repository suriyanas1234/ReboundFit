import Dexie, { Table } from 'dexie';

export interface LocalProfile {
  id: string;
  userId: string;
  email: string;
  name: string;
  onboardingCompleted: boolean;
  gender: 'male' | 'female';
  age: number;
  heightCm: number;
  currentWeightLbs: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';
  unitPreference: 'imperial' | 'metric';
  primaryGoal: 'lean_bulk' | 'recomp';
  targetGainRateLbsPerWeek: number;
  trainingSplit: 'ppl' | 'upper_lower' | 'full_body' | 'custom';
  proteinRatioPerLb: number;
  fatPercentage: number;
  baseTdee: number;
  smoothedTdee: number;
  targetCalories: number;
  targetProteinG: number;
  targetCarbG: number;
  targetFatG: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocalWeighIn {
  id: string;
  userId: string;
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
  userId: string;
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
  userId: string;
  name: string;
  routineId?: string;
  startedAt: string;
  completedAt?: string | null;
  totalVolumeLbs: number;
  synced: boolean;
}

export interface LocalWorkoutSet {
  id: string;
  userId: string;
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
  userId: string;
  date: string;
  weekNumber: number;
  pose: 'front_relaxed' | 'front_flexed' | 'side_left' | 'side_right' | 'back_lat_spread';
  weightLbs: number;
  photoDataUrl: string; // Base64 data URL
  notes?: string;
  isBaseline: boolean;
  synced: boolean;
}

export interface LocalScheduledWorkout {
  id: string; // `sched-${userId}-${date}`
  userId: string;
  date: string; // YYYY-MM-DD
  routineName: string;
  splitType: 'ppl' | 'upper_lower' | 'full_body' | 'custom';
  dayType: 'workout' | 'rest';
  focusMuscleGroups: string[];
  exerciseIds: string[];
  scheduledTime?: string; // HH:mm, e.g. "08:00"
  durationMinutes: number; // default 60
  isCompleted: boolean;
  completedWorkoutId?: string;
  googleCalendarEventId?: string;
  notes?: string;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
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
  scheduledWorkouts!: Table<LocalScheduledWorkout, string>;

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
    this.version(2).stores({
      profiles: 'id, userId, onboardingCompleted',
      weighIns: 'id, userId, date, synced',
      mealLogs: 'id, userId, date, mealType, synced',
      exercises: 'id, muscleGroup, isCompound',
      workouts: 'id, userId, startedAt, synced',
      workoutSets: 'id, userId, workoutId, exerciseId, synced',
      photos: 'id, userId, date, weekNumber, isBaseline, synced',
      syncQueue: 'id, table, status, timestamp',
    });
    this.version(3).stores({
      profiles: 'id, userId, email, onboardingCompleted',
      weighIns: 'id, userId, date, synced',
      mealLogs: 'id, userId, date, mealType, synced',
      exercises: 'id, muscleGroup, isCompound',
      workouts: 'id, userId, startedAt, synced',
      workoutSets: 'id, userId, workoutId, exerciseId, synced',
      photos: 'id, userId, date, weekNumber, isBaseline, synced',
      syncQueue: 'id, table, status, timestamp',
    });
    this.version(4).stores({
      profiles: 'id, userId, email, onboardingCompleted',
      weighIns: 'id, userId, date, synced',
      mealLogs: 'id, userId, date, mealType, synced',
      exercises: 'id, muscleGroup, isCompound',
      workouts: 'id, userId, startedAt, synced',
      workoutSets: 'id, userId, workoutId, exerciseId, synced',
      photos: 'id, userId, date, weekNumber, isBaseline, synced',
      syncQueue: 'id, table, status, timestamp',
      scheduledWorkouts: 'id, userId, date, dayType, isCompleted',
    });
  }
}

export const db = new ReboundFitDatabase();

/**
 * Ensures the standard library of lifts is available for routine scaffolding.
 * NO MOCK LOGS, NO FAKE WEIGH-INS, NO FAKE MEALS ARE GENERATED.
 */
export async function seedExerciseLibrary() {
  const count = await db.exercises.count();
  if (count === 0) {
    const exercises: LocalExercise[] = [
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
      { id: 'ex-11', name: 'Leg Press', muscleGroup: 'quads', isCompound: true, defaultRestSeconds: 150 },
      { id: 'ex-12', name: 'Lying Leg Curl', muscleGroup: 'hamstrings', isCompound: false, defaultRestSeconds: 90 },
      { id: 'ex-13', name: 'Standing Calf Raise', muscleGroup: 'calves', isCompound: false, defaultRestSeconds: 60 },
    ];
    await db.exercises.bulkPut(exercises);
  }
}

/**
 * Removes legacy dummy/mock seed entries from early prototypes if present.
 */
export async function purgeMockDataIfPresent() {
  try {
    // Purge mock default profile if it exists
    await db.profiles.delete('local-user-default');
    
    // Purge any dummy weigh-in with id starting with 'weigh-2026' or mock items
    const allWeighIns = await db.weighIns.toArray();
    const mockWeighIns = allWeighIns.filter(w => !w.userId || w.id.includes('weigh-2026-10-0'));
    if (mockWeighIns.length > 0) {
      await db.weighIns.bulkDelete(mockWeighIns.map(w => w.id));
    }

    const allMeals = await db.mealLogs.toArray();
    const mockMeals = allMeals.filter(m => !m.userId || m.id.includes('meal-2026-10-0'));
    if (mockMeals.length > 0) {
      await db.mealLogs.bulkDelete(mockMeals.map(m => m.id));
    }
  } catch (err) {
    console.warn('Data purge check:', err);
  }
}
