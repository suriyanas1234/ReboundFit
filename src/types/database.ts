/**
 * ReboundFit Database & Domain Model Types
 */

export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';
export type UnitPreference = 'imperial' | 'metric';
export type GainRateGoal = 'lean_bulk_slow' | 'lean_bulk_standard' | 'recomp_maintenance' | 'aggressive_bulk';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'post_workout' | 'snack';
export type MuscleGroup = 'chest' | 'back' | 'quads' | 'hamstrings' | 'shoulders' | 'biceps' | 'triceps' | 'calves' | 'abs' | 'full_body';
export type ExerciseCategory = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'weighted_bodyweight';
export type PRType = 'weight' | 'reps' | 'estimated_1rm' | 'volume';
export type PhotoPose = 'front_relaxed' | 'front_flexed' | 'side_left' | 'side_right' | 'back_lat_spread' | 'back_relaxed';

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  gender: Gender;
  birthDate: string;
  heightCm: number;
  activityLevel: ActivityLevel;
  unitPreference: UnitPreference;
  gainRateGoal: GainRateGoal;
  targetGainLbsPerWeek: number;
  proteinRatioPerLb: number;
  fatCaloriePercentage: number;
  baseTdee: number;
  smoothedTdee: number;
  targetCalories: number;
  targetProteinG: number;
  targetCarbG: number;
  targetFatG: number;
  appleHealthSyncToken?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WeighInRecord {
  id: string;
  userId: string;
  loggedAt: string; // YYYY-MM-DD
  rawWeightLbs: number;
  rawWeightKg: number;
  trendWeightLbs?: number;
  trendWeightKg?: number;
  rateOfGainLbsPerWeek?: number;
  notes?: string;
}

export interface FoodItem {
  id: string;
  userId?: string | null;
  name: string;
  brand?: string;
  barcode?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  fiberG?: number;
  isVerified: boolean;
}

export interface MealLogEntry {
  id: string;
  userId: string;
  foodId?: string | null;
  loggedDate: string;
  mealType: MealType;
  customName: string;
  servings: number;
  calories: number;
  proteinG: number;
  carbG: number;
  fatG: number;
  isQuickDial: boolean;
  createdAt: string;
}

export interface MealTemplate {
  id: string;
  userId: string;
  name: string;
  mealType: MealType;
  totalCalories: number;
  totalProteinG: number;
  totalCarbG: number;
  totalFatG: number;
}

export interface Exercise {
  id: string;
  userId?: string | null;
  name: string;
  muscleGroup: MuscleGroup;
  category: ExerciseCategory;
  isCompound: boolean;
  defaultRestSeconds: number;
  instructions?: string;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  routineId?: string | null;
  name: string;
  startedAt: string;
  completedAt?: string | null;
  notes?: string;
  totalVolumeLbs: number;
  sets: WorkoutSet[];
}

export interface WorkoutSet {
  id: string;
  workoutId: string;
  exerciseId: string;
  setNumber: number;
  weightLbs: number;
  weightKg: number;
  reps: number;
  rpe?: number;
  isWarmup: boolean;
  isPr: boolean;
  prType?: PRType;
  previousBestWeightLbs?: number;
  previousBestReps?: number;
}

export interface ProgressPhoto {
  id: string;
  userId: string;
  storagePath: string;
  thumbnailPath?: string;
  pose: PhotoPose;
  loggedDate: string;
  weekNumber: number;
  weightAtTimeLbs?: number;
  cameraAspectRatio?: string;
  devicePitchDegrees?: number;
  deviceHeightCm?: number;
  guideSilhouetteId?: string;
  notes?: string;
  isBaseline: boolean;
}

export interface HealthMetricRecord {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  weightLbs?: number;
  weightKg?: number;
  activeEnergyBurnedKcal?: number;
  basalEnergyBurnedKcal?: number;
  totalEnergyBurnedKcal?: number;
  stepCount?: number;
  distanceKm?: number;
  sleepHours?: number;
  deepSleepHours?: number;
  restingHeartRateBpm?: number;
  source: string;
  rawPayload?: any;
  createdAt: string;
  updatedAt: string;
}

