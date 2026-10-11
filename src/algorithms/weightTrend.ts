/**
 * ReboundFit Weight Smoothing Engine
 * Exponential Moving Average (EMA) & Rate-of-Gain Classifier
 */

export interface DailyWeighIn {
  date: string; // ISO format 'YYYY-MM-DD'
  rawWeightLbs: number;
}

export interface SmoothedWeightPoint {
  date: string;
  rawWeightLbs: number;
  trendWeightLbs: number;
  rateOfGainLbsPerWeek: number; // 7-day smoothed slope
  gainZone: GainZone;
}

export type GainZone = 
  | 'loss'         // < 0 lbs/wk (Deficit / muscle loss risk)
  | 'stagnant'     // 0.0 to +0.15 lbs/wk (Maintenance / under-fueling)
  | 'sweet_spot'   // +0.25 to +0.50 lbs/wk (Optimal hypertrophy-to-fat ratio)
  | 'mild_gain'    // +0.15 to +0.25 lbs/wk (Very conservative lean bulk)
  | 'excess_gain'  // +0.50 to +0.75 lbs/wk (Approaching surplus ceiling)
  | 'rapid_gain';  // > +0.75 lbs/wk (Unnecessary adipose tissue accumulation)

/**
 * Smoothing Factor Alpha for EMA.
 * For daily morning weigh-ins, alpha = 0.20 corresponds to an effective ~9-day 
 * half-life memory window (alpha = 2 / (N + 1) with N ≈ 9).
 * This eliminates standard water/glycogen spikes without introducing the 'cliff effect'
 * of a standard 7-day Simple Moving Average (SMA).
 */
export const DEFAULT_WEIGHT_SMOOTHING_ALPHA = 0.20;

/**
 * Computes 7-day Exponential Moving Average (EMA) trendline from historical weigh-ins.
 * Handles missing dates by interpolating between nearest recorded entries.
 */
export function calculateWeightTrend(
  weighIns: DailyWeighIn[],
  alpha: number = DEFAULT_WEIGHT_SMOOTHING_ALPHA
): SmoothedWeightPoint[] {
  if (!weighIns || weighIns.length === 0) return [];

  // 1. Sort ascending chronologically
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));

  // 2. Continuous day interpolation to prevent gaps from distorting the trend
  const continuousEntries = fillMissingDays(sorted);

  const results: SmoothedWeightPoint[] = [];
  let currentEMA = continuousEntries[0].rawWeightLbs;

  for (let i = 0; i < continuousEntries.length; i++) {
    const entry = continuousEntries[i];

    if (i === 0) {
      currentEMA = entry.rawWeightLbs;
    } else {
      // EMA formula: EMA_today = (Raw_today * alpha) + (EMA_yesterday * (1 - alpha))
      currentEMA = entry.rawWeightLbs * alpha + currentEMA * (1 - alpha);
    }

    // 3. Compute 7-day rate of gain slope
    // Look back 7 days (or furthest available if fewer than 7 days)
    const lookbackIndex = Math.max(0, i - 7);
    const lookbackPoint = results[lookbackIndex] || { trendWeightLbs: currentEMA, date: entry.date };
    const dayDifference = Math.max(1, i - lookbackIndex);
    
    // Scale daily delta to a weekly rate: (delta / days) * 7
    const deltaLbs = currentEMA - lookbackPoint.trendWeightLbs;
    const rateOfGainLbsPerWeek = i >= 3 ? Number(((deltaLbs / dayDifference) * 7).toFixed(2)) : 0;

    results.push({
      date: entry.date,
      rawWeightLbs: Number(entry.rawWeightLbs.toFixed(2)),
      trendWeightLbs: Number(currentEMA.toFixed(2)),
      rateOfGainLbsPerWeek,
      gainZone: classifyGainZone(rateOfGainLbsPerWeek)
    });
  }

  return results;
}

/**
 * Categorizes current rate of gain into actionable visual zones for the speedometer
 */
export function classifyGainZone(rateLbsPerWeek: number): GainZone {
  if (rateLbsPerWeek < 0) return 'loss';
  if (rateLbsPerWeek < 0.15) return 'stagnant';
  if (rateLbsPerWeek < 0.25) return 'mild_gain';
  if (rateLbsPerWeek <= 0.50) return 'sweet_spot';
  if (rateLbsPerWeek <= 0.75) return 'excess_gain';
  return 'rapid_gain';
}

/**
 * Fills missing calendar days with linear interpolation so missing a Sunday weigh-in
 * doesn't break the recursive mathematical continuity.
 */
function fillMissingDays(entries: DailyWeighIn[]): DailyWeighIn[] {
  const result: DailyWeighIn[] = [];

  for (let i = 0; i < entries.length; i++) {
    const curr = entries[i];
    result.push(curr);

    if (i < entries.length - 1) {
      const next = entries[i + 1];
      const currDate = new Date(curr.date);
      const nextDate = new Date(next.date);
      const diffTime = Math.abs(nextDate.getTime() - currDate.getTime());
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 1) {
        // Linearly interpolate missing points
        const weightStep = (next.rawWeightLbs - curr.rawWeightLbs) / diffDays;
        for (let gap = 1; gap < diffDays; gap++) {
          const gapDate = new Date(currDate);
          gapDate.setDate(currDate.getDate() + gap);
          result.push({
            date: gapDate.toISOString().split('T')[0],
            rawWeightLbs: curr.rawWeightLbs + weightStep * gap
          });
        }
      }
    }
  }

  return result;
}
