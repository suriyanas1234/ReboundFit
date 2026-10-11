/**
 * ReboundFit Adaptive TDEE & Macro Engine
 * Dynamic Expenditure Algorithm (MacroFactor-style) + Mifflin-St Jeor + Macro Allocation
 */

export interface UserPhysiqueProfile {
  gender: 'male' | 'female' | 'other';
  age: number;
  heightCm: number;
  currentWeightLbs: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'very_active' | 'extra_active';
  targetGainRateLbsPerWeek: number; // e.g., 0.35 lbs/wk
  proteinRatioPerLb: number;        // e.g., 0.90 to 1.0g / lb
  fatPercentage: number;             // e.g., 0.25 (25% of calories)
}

export interface MacroTargets {
  calories: number;
  proteinGrams: number;
  carbGrams: number;
  fatGrams: number;
  surplusKcal: number;
}

export interface DailyNutritionLog {
  date: string;
  calories: number;
}

export interface DynamicTdeeUpdateResult {
  previousTdee: number;
  newSmoothedTdee: number;
  calculatedRawTdee: number;
  weeklyDeltaKcal: number;
  newTargets: MacroTargets;
  auditExplanation: string;
}

const ACTIVITY_MULTIPLIERS: Record<UserPhysiqueProfile['activityLevel'], number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very_active: 1.725,
  extra_active: 1.9,
};

const KCAL_PER_LB_TISSUE = 3500;
const MAX_WEEKLY_TDEE_ADJUSTMENT = 150; // Guardrail to prevent extreme swings

/**
 * 1. Base TDEE Calculation via Mifflin-St Jeor Formula
 */
export function calculateBaseBMR(
  gender: 'male' | 'female' | 'other',
  weightKg: number,
  heightCm: number,
  age: number
): number {
  // Mifflin-St Jeor equation
  // BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) + s
  const s = gender === 'female' ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + s;
  return Math.round(bmr);
}

export function calculateInitialTdee(profile: UserPhysiqueProfile): number {
  const weightKg = profile.currentWeightLbs * 0.45359237;
  const bmr = calculateBaseBMR(profile.gender, weightKg, profile.heightCm, profile.age);
  const multiplier = ACTIVITY_MULTIPLIERS[profile.activityLevel];
  return Math.round(bmr * multiplier);
}

/**
 * 2. Lean Bulk Macro Allocation
 * Prioritizes high protein for muscle protein synthesis, healthy fats for hormone optimization,
 * and high carbohydrates to power glycogen recovery and progressive overload.
 */
export function calculateMacroTargets(
  currentTdee: number,
  profile: UserPhysiqueProfile
): MacroTargets {
  // Surplus: (lbs/week * 3500 kcal/lb) / 7 days
  const dailySurplus = Math.round((profile.targetGainRateLbsPerWeek * KCAL_PER_LB_TISSUE) / 7);
  const targetCalories = currentTdee + dailySurplus;

  // Protein: 0.85 - 1.0g per lb of body weight
  const proteinGrams = Math.round(profile.currentWeightLbs * profile.proteinRatioPerLb);
  const proteinCalories = proteinGrams * 4;

  // Fat: 20-30% of total calories (default 25%)
  const fatCalories = targetCalories * profile.fatPercentage;
  const fatGrams = Math.round(fatCalories / 9);

  // Carbs: Remainder of daily calories
  const remainingCalories = targetCalories - proteinCalories - (fatGrams * 9);
  const carbGrams = Math.max(50, Math.round(remainingCalories / 4));

  return {
    calories: targetCalories,
    proteinGrams,
    carbGrams,
    fatGrams,
    surplusKcal: dailySurplus
  };
}

/**
 * 3. Dynamic TDEE Update Engine (Rolling Expenditure Smoother)
 * Uses First Principles Energy Balance:
 * Expenditure = Average Energy In - (Delta Trend Weight * 3,500 kcal / Days)
 * Clamped with guardrails and smoothed with an exponential dampening factor (beta = 0.30)
 */
export function recalculateDynamicTdee(
  profile: UserPhysiqueProfile,
  previousSmoothedTdee: number,
  nutritionLogs: DailyNutritionLog[],
  startTrendWeightLbs: number,
  endTrendWeightLbs: number,
  daysInWindow: number = 14
): DynamicTdeeUpdateResult {
  if (nutritionLogs.length < 5) {
    // Insufficient logging days in the window; preserve current TDEE
    return {
      previousTdee: previousSmoothedTdee,
      newSmoothedTdee: previousSmoothedTdee,
      calculatedRawTdee: previousSmoothedTdee,
      weeklyDeltaKcal: 0,
      newTargets: calculateMacroTargets(previousSmoothedTdee, profile),
      auditExplanation: 'Fewer than 5 logged nutrition days; maintaining current expenditure baseline.'
    };
  }

  // Calculate average intake in window
  const totalCaloriesLogged = nutritionLogs.reduce((sum, log) => sum + log.calories, 0);
  const avgIntakeCalories = totalCaloriesLogged / nutritionLogs.length;

  // Delta in smoothed trend weight
  const weightDeltaLbs = endTrendWeightLbs - startTrendWeightLbs;
  const dailyEnergyDelta = (weightDeltaLbs * KCAL_PER_LB_TISSUE) / daysInWindow;

  // Raw estimated TDEE
  const calculatedRawTdee = Math.round(avgIntakeCalories - dailyEnergyDelta);

  // Exponential dampening (beta = 0.35) between historical baseline and current observation
  const dampeningBeta = 0.35;
  const unconstrainedNewTdee = Math.round(
    previousSmoothedTdee * (1 - dampeningBeta) + calculatedRawTdee * dampeningBeta
  );

  // Guardrail: Clamp max delta per week to prevent overcorrection from logging inaccuracies
  const rawDelta = unconstrainedNewTdee - previousSmoothedTdee;
  const clampedDelta = Math.max(
    -MAX_WEEKLY_TDEE_ADJUSTMENT,
    Math.min(MAX_WEEKLY_TDEE_ADJUSTMENT, rawDelta)
  );
  const newSmoothedTdee = previousSmoothedTdee + clampedDelta;

  const newTargets = calculateMacroTargets(newSmoothedTdee, profile);

  const direction = clampedDelta >= 0 ? `+${clampedDelta}` : `${clampedDelta}`;
  const auditExplanation = `Expenditure updated by ${direction} kcal/day based on ${nutritionLogs.length} logged days and ${weightDeltaLbs >= 0 ? '+' : ''}${weightDeltaLbs.toFixed(2)} lbs trend change.`;

  return {
    previousTdee: previousSmoothedTdee,
    newSmoothedTdee,
    calculatedRawTdee,
    weeklyDeltaKcal: clampedDelta,
    newTargets,
    auditExplanation
  };
}
