import { db, LocalScheduledWorkout, LocalExercise } from "@/lib/db";

export interface RoutineTemplate {
  name: string;
  splitType: "ppl" | "upper_lower" | "full_body" | "custom";
  dayType: "workout" | "rest";
  focusMuscleGroups: string[];
  exerciseIds: string[];
  defaultDurationMinutes: number;
  description: string;
}

export const ROUTINE_TEMPLATES: Record<string, RoutineTemplate> = {
  // PPL Routines
  push_a: {
    name: "Push Day A (Chest & Triceps Hypertrophy)",
    splitType: "ppl",
    dayType: "workout",
    focusMuscleGroups: ["chest", "shoulders", "triceps"],
    exerciseIds: ["ex-1", "ex-2", "ex-8", "ex-10"],
    defaultDurationMinutes: 65,
    description: "Flat bench press heavy progressive overload, incline dumbbell press, side lateral raises, and overhead triceps extension.",
  },
  pull_a: {
    name: "Pull Day A (Back & Biceps Hypertrophy)",
    splitType: "ppl",
    dayType: "workout",
    focusMuscleGroups: ["back", "biceps"],
    exerciseIds: ["ex-6", "ex-7", "ex-9"],
    defaultDurationMinutes: 60,
    description: "Weighted pull-ups, barbell chest-supported rows, and incline dumbbell curls.",
  },
  legs_a: {
    name: "Leg Day A (Quads & Calves)",
    splitType: "ppl",
    dayType: "workout",
    focusMuscleGroups: ["quads", "calves"],
    exerciseIds: ["ex-3", "ex-11", "ex-13"],
    defaultDurationMinutes: 70,
    description: "Barbell back squat heavy sets, leg press volume, and standing calf raises.",
  },
  push_b: {
    name: "Push Day B (Shoulders & Upper Chest Overload)",
    splitType: "ppl",
    dayType: "workout",
    focusMuscleGroups: ["shoulders", "chest", "triceps"],
    exerciseIds: ["ex-5", "ex-2", "ex-8", "ex-10"],
    defaultDurationMinutes: 60,
    description: "Standing overhead press (OHP) compound focus, incline press, and lateral raises.",
  },
  pull_b: {
    name: "Pull Day B (Posterior Chain & Lats)",
    splitType: "ppl",
    dayType: "workout",
    focusMuscleGroups: ["back", "hamstrings", "biceps"],
    exerciseIds: ["ex-4", "ex-7", "ex-9"],
    defaultDurationMinutes: 65,
    description: "Romanian deadlift (RDL) posterior chain development, heavy rows, and curls.",
  },
  legs_b: {
    name: "Leg Day B (Hamstrings & Quads)",
    splitType: "ppl",
    dayType: "workout",
    focusMuscleGroups: ["hamstrings", "quads", "calves"],
    exerciseIds: ["ex-4", "ex-12", "ex-11", "ex-13"],
    defaultDurationMinutes: 65,
    description: "Hamstring and posterior chain overload with leg press and calf raises.",
  },

  // Upper / Lower Routines
  upper_a: {
    name: "Upper Body A (Chest, Back & Delts Overload)",
    splitType: "upper_lower",
    dayType: "workout",
    focusMuscleGroups: ["chest", "back", "shoulders", "triceps"],
    exerciseIds: ["ex-1", "ex-6", "ex-8", "ex-10"],
    defaultDurationMinutes: 70,
    description: "Compound horizontal bench pressing, vertical pull-ups, lateral raises, and triceps.",
  },
  lower_a: {
    name: "Lower Body A (Squat & Hamstrings)",
    splitType: "upper_lower",
    dayType: "workout",
    focusMuscleGroups: ["quads", "hamstrings", "calves"],
    exerciseIds: ["ex-3", "ex-4", "ex-13"],
    defaultDurationMinutes: 70,
    description: "Heavy back squats, Romanian deadlifts (RDL), and standing calf raises.",
  },
  upper_b: {
    name: "Upper Body B (Shoulders, Rows & Arms)",
    splitType: "upper_lower",
    dayType: "workout",
    focusMuscleGroups: ["shoulders", "back", "chest", "biceps"],
    exerciseIds: ["ex-5", "ex-7", "ex-2", "ex-9"],
    defaultDurationMinutes: 65,
    description: "Overhead press (OHP), barbell rows, incline dumbbell press, and dumbbell curls.",
  },
  lower_b: {
    name: "Lower Body B (Deadlift & Quad Hypertrophy)",
    splitType: "upper_lower",
    dayType: "workout",
    focusMuscleGroups: ["hamstrings", "quads", "calves"],
    exerciseIds: ["ex-4", "ex-11", "ex-12", "ex-13"],
    defaultDurationMinutes: 65,
    description: "Posterior chain deadlift focus, leg press, lying leg curls, and calves.",
  },

  // Full Body Routines
  full_body_a: {
    name: "Full Body A (Squat, Bench, Row)",
    splitType: "full_body",
    dayType: "workout",
    focusMuscleGroups: ["quads", "chest", "back", "shoulders"],
    exerciseIds: ["ex-3", "ex-1", "ex-7", "ex-8"],
    defaultDurationMinutes: 75,
    description: "Core compound session: Barbell back squat, flat bench press, rows, and lateral raises.",
  },
  full_body_b: {
    name: "Full Body B (RDL, OHP, Pull-Up)",
    splitType: "full_body",
    dayType: "workout",
    focusMuscleGroups: ["hamstrings", "shoulders", "back", "triceps"],
    exerciseIds: ["ex-4", "ex-5", "ex-6", "ex-10"],
    defaultDurationMinutes: 75,
    description: "Posterior chain and vertical pressing: Romanian deadlift, overhead press, pull-ups, and triceps.",
  },
  full_body_c: {
    name: "Full Body C (Leg Press, Incline, Arms)",
    splitType: "full_body",
    dayType: "workout",
    focusMuscleGroups: ["quads", "chest", "biceps", "calves"],
    exerciseIds: ["ex-11", "ex-2", "ex-9", "ex-13"],
    defaultDurationMinutes: 65,
    description: "Hypertrophy finish: Leg press, incline dumbbell press, bicep curls, and calf raises.",
  },

  // Rest
  rest: {
    name: "Rest & Active Recovery",
    splitType: "custom",
    dayType: "rest",
    focusMuscleGroups: ["full_body"],
    exerciseIds: [],
    defaultDurationMinutes: 0,
    description: "Targeted caloric surplus, hydration, and muscle protein synthesis recovery.",
  },
};

/**
 * Default Day-of-Week Mapping (0 = Sunday, 1 = Monday, ... 6 = Saturday)
 */
export function getSplitWeeklyPattern(
  split: string = "ppl",
  workoutDaysPerWeek?: number,
  customSchedule?: {
    [dayOfWeek: number]: {
      dayType: "workout" | "rest";
      routineKey?: string;
      preferredTime?: string;
    };
  }
): RoutineTemplate[] {
  // 1. Direct custom day mapping if provided
  if (customSchedule) {
    const pattern: RoutineTemplate[] = [];
    for (let day = 0; day < 7; day++) {
      const cfg = customSchedule[day];
      if (cfg && cfg.dayType === "workout" && cfg.routineKey && ROUTINE_TEMPLATES[cfg.routineKey]) {
        pattern.push(ROUTINE_TEMPLATES[cfg.routineKey]);
      } else {
        pattern.push(ROUTINE_TEMPLATES.rest);
      }
    }
    return pattern;
  }

  // 2. Frequency-based split mapping (3, 4, 5, 6, 7 days/week)
  if (workoutDaysPerWeek) {
    switch (workoutDaysPerWeek) {
      case 3:
        return [
          ROUTINE_TEMPLATES.rest,        // Sun (0)
          ROUTINE_TEMPLATES.full_body_a, // Mon (1)
          ROUTINE_TEMPLATES.rest,        // Tue (2)
          ROUTINE_TEMPLATES.full_body_b, // Wed (3)
          ROUTINE_TEMPLATES.rest,        // Thu (4)
          ROUTINE_TEMPLATES.full_body_c, // Fri (5)
          ROUTINE_TEMPLATES.rest,        // Sat (6)
        ];
      case 4:
        return [
          ROUTINE_TEMPLATES.rest,        // Sun (0)
          ROUTINE_TEMPLATES.upper_a,     // Mon (1)
          ROUTINE_TEMPLATES.lower_a,     // Tue (2)
          ROUTINE_TEMPLATES.rest,        // Wed (3)
          ROUTINE_TEMPLATES.upper_b,     // Thu (4)
          ROUTINE_TEMPLATES.lower_b,     // Fri (5)
          ROUTINE_TEMPLATES.rest,        // Sat (6)
        ];
      case 5:
        return [
          ROUTINE_TEMPLATES.rest,        // Sun (0)
          ROUTINE_TEMPLATES.push_a,      // Mon (1)
          ROUTINE_TEMPLATES.pull_a,      // Tue (2)
          ROUTINE_TEMPLATES.legs_a,      // Wed (3)
          ROUTINE_TEMPLATES.rest,        // Thu (4)
          ROUTINE_TEMPLATES.upper_b,     // Fri (5)
          ROUTINE_TEMPLATES.lower_b,     // Sat (6)
        ];
      case 6:
        return [
          ROUTINE_TEMPLATES.legs_b,      // Sun (0: Leg Day B)
          ROUTINE_TEMPLATES.push_a,      // Mon (1: Push Day A)
          ROUTINE_TEMPLATES.pull_a,      // Tue (2: Pull Day A)
          ROUTINE_TEMPLATES.legs_a,      // Wed (3: Leg Day A)
          ROUTINE_TEMPLATES.rest,        // Thu (4: Mid-week Rest)
          ROUTINE_TEMPLATES.push_b,      // Fri (5: Push Day B)
          ROUTINE_TEMPLATES.pull_b,      // Sat (6: Pull Day B)
        ];
      case 7:
        return [
          ROUTINE_TEMPLATES.legs_b,
          ROUTINE_TEMPLATES.push_a,
          ROUTINE_TEMPLATES.pull_a,
          ROUTINE_TEMPLATES.legs_a,
          ROUTINE_TEMPLATES.push_b,
          ROUTINE_TEMPLATES.pull_b,
          ROUTINE_TEMPLATES.upper_a,
        ];
    }
  }

  // 3. Fallback to default split name
  switch (split) {
    case "upper_lower":
      return [
        ROUTINE_TEMPLATES.rest,        // Sun
        ROUTINE_TEMPLATES.upper_a,     // Mon
        ROUTINE_TEMPLATES.lower_a,     // Tue
        ROUTINE_TEMPLATES.rest,        // Wed
        ROUTINE_TEMPLATES.upper_b,     // Thu
        ROUTINE_TEMPLATES.lower_b,     // Fri
        ROUTINE_TEMPLATES.rest,        // Sat
      ];
    case "full_body":
      return [
        ROUTINE_TEMPLATES.rest,        // Sun
        ROUTINE_TEMPLATES.full_body_a, // Mon
        ROUTINE_TEMPLATES.rest,        // Tue
        ROUTINE_TEMPLATES.full_body_b, // Wed
        ROUTINE_TEMPLATES.rest,        // Thu
        ROUTINE_TEMPLATES.full_body_c, // Fri
        ROUTINE_TEMPLATES.rest,        // Sat
      ];
    case "ppl":
    default:
      return [
        ROUTINE_TEMPLATES.legs_b,      // Sun (day 0: Leg Day B)
        ROUTINE_TEMPLATES.push_a,      // Mon (day 1: Push Day A)
        ROUTINE_TEMPLATES.pull_a,      // Tue (day 2: Pull Day A)
        ROUTINE_TEMPLATES.legs_a,      // Wed (day 3: Leg Day A)
        ROUTINE_TEMPLATES.rest,        // Thu (day 4: Mid-week Rest)
        ROUTINE_TEMPLATES.push_b,      // Fri (day 5: Push Day B)
        ROUTINE_TEMPLATES.pull_b,      // Sat (day 6: Pull Day B)
      ];
  }
}

/**
 * Generates an array of date strings (YYYY-MM-DD) starting from reference date.
 */
export function generateDateRange(startDateStr: string, countDays: number = 7): string[] {
  const dates: string[] = [];
  const start = new Date(startDateStr + "T00:00:00");
  for (let i = 0; i < countDays; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

/**
 * Returns Monday of the week containing the specified date.
 */
export function getMondayOfWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split("T")[0];
}

/**
 * Ensures scheduled workouts exist in Dexie for the given user and dates.
 * Preserves any customized user records while populating missing dates from the split pattern.
 */
export async function ensureWorkoutSchedule(
  userId: string,
  splitType: "ppl" | "upper_lower" | "full_body" | "custom" = "ppl",
  dates: string[],
  preferredTime: string = "08:00",
  workoutDaysPerWeek?: number,
  customSchedule?: {
    [dayOfWeek: number]: {
      dayType: "workout" | "rest";
      routineKey?: string;
      preferredTime?: string;
    };
  }
): Promise<LocalScheduledWorkout[]> {
  const pattern = getSplitWeeklyPattern(splitType, workoutDaysPerWeek, customSchedule);
  const existing = await db.scheduledWorkouts
    .where("userId")
    .equals(userId)
    .and((item) => dates.includes(item.date))
    .toArray();

  const existingMap = new Map<string, LocalScheduledWorkout>();
  existing.forEach((item) => existingMap.set(item.date, item));

  const toCreate: LocalScheduledWorkout[] = [];

  for (const date of dates) {
    const d = new Date(date + "T00:00:00");
    const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, etc.
    const template = pattern[dayOfWeek] || ROUTINE_TEMPLATES.rest;
    const existingRecord = existingMap.get(date);

    if (existingRecord) {
      // If the workout was NOT completed yet, reconcile with user's configured frequency/custom schedule
      const needsFrequencyUpdate =
        !existingRecord.isCompleted &&
        (Boolean(workoutDaysPerWeek) || Boolean(customSchedule)) &&
        (existingRecord.dayType !== template.dayType ||
          (template.dayType === "workout" && existingRecord.routineName !== template.name));

      if (needsFrequencyUpdate) {
        const updatedRecord: LocalScheduledWorkout = {
          ...existingRecord,
          routineName: template.name,
          splitType: template.splitType,
          dayType: template.dayType,
          focusMuscleGroups: template.focusMuscleGroups,
          exerciseIds: template.exerciseIds,
          durationMinutes: template.defaultDurationMinutes,
          notes: template.description,
          updatedAt: new Date().toISOString(),
        };
        toCreate.push(updatedRecord);
        existingMap.set(date, updatedRecord);
      } else if (
        splitType === "ppl" &&
        !workoutDaysPerWeek &&
        !customSchedule &&
        d.getDay() === 0 &&
        existingRecord.dayType === "rest" &&
        !existingRecord.isCompleted
      ) {
        // Heal previously cached Sunday rest records in default PPL if not completed
        const templateLegs = ROUTINE_TEMPLATES.legs_b;
        const healed: LocalScheduledWorkout = {
          ...existingRecord,
          routineName: templateLegs.name,
          dayType: templateLegs.dayType,
          focusMuscleGroups: templateLegs.focusMuscleGroups,
          exerciseIds: templateLegs.exerciseIds,
          durationMinutes: templateLegs.defaultDurationMinutes,
          notes: templateLegs.description,
          updatedAt: new Date().toISOString(),
        };
        toCreate.push(healed);
        existingMap.set(date, healed);
      }
    } else {
      const record: LocalScheduledWorkout = {
        id: `sched-${userId}-${date}`,
        userId,
        date,
        routineName: template.name,
        splitType,
        dayType: template.dayType,
        focusMuscleGroups: template.focusMuscleGroups,
        exerciseIds: template.exerciseIds,
        scheduledTime: preferredTime,
        durationMinutes: template.defaultDurationMinutes,
        isCompleted: false,
        notes: template.description,
        synced: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      toCreate.push(record);
      existingMap.set(date, record);
    }
  }

  if (toCreate.length > 0) {
    await db.scheduledWorkouts.bulkPut(toCreate);
  }

  // Return sorted by date
  return dates.map((d) => existingMap.get(d)!).filter(Boolean);
}

/**
 * Overwrites/applies a customized weekly schedule across the given dates,
 * preserving any already completed workouts.
 */
export async function applyCustomWeeklySchedule(
  userId: string,
  dates: string[],
  pattern: RoutineTemplate[],
  preferredTime: string = "08:00"
): Promise<LocalScheduledWorkout[]> {
  const existing = await db.scheduledWorkouts
    .where("userId")
    .equals(userId)
    .and((item) => dates.includes(item.date))
    .toArray();

  const existingMap = new Map<string, LocalScheduledWorkout>();
  existing.forEach((item) => existingMap.set(item.date, item));

  const updatedRecords: LocalScheduledWorkout[] = [];

  for (const date of dates) {
    const d = new Date(date + "T00:00:00");
    const dayOfWeek = d.getDay();
    const template = pattern[dayOfWeek] || ROUTINE_TEMPLATES.rest;
    const existingRec = existingMap.get(date);

    const isCompleted = existingRec ? existingRec.isCompleted : false;
    const completedWorkoutId = existingRec?.completedWorkoutId;

    const record: LocalScheduledWorkout = {
      id: `sched-${userId}-${date}`,
      userId,
      date,
      routineName: template.name,
      splitType: template.splitType,
      dayType: template.dayType,
      focusMuscleGroups: template.focusMuscleGroups,
      exerciseIds: template.exerciseIds,
      scheduledTime: existingRec?.scheduledTime || preferredTime,
      durationMinutes: template.defaultDurationMinutes,
      isCompleted,
      completedWorkoutId,
      notes: template.description,
      synced: false,
      createdAt: existingRec?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    updatedRecords.push(record);
  }

  await db.scheduledWorkouts.bulkPut(updatedRecords);
  return updatedRecords;
}

/**
 * Gets or creates the scheduled workout for a specific date (e.g. today).
 */
export async function getOrCreateScheduledWorkoutForDate(
  userId: string,
  date: string,
  splitType: "ppl" | "upper_lower" | "full_body" | "custom" = "ppl",
  preferredTime: string = "08:00",
  workoutDaysPerWeek?: number,
  customSchedule?: {
    [dayOfWeek: number]: {
      dayType: "workout" | "rest";
      routineKey?: string;
      preferredTime?: string;
    };
  }
): Promise<LocalScheduledWorkout> {
  const existing = await db.scheduledWorkouts
    .where("userId")
    .equals(userId)
    .and((item) => item.date === date)
    .first();

  if (existing) {
    const d = new Date(date + "T00:00:00");
    if (
      splitType === "ppl" &&
      !workoutDaysPerWeek &&
      !customSchedule &&
      d.getDay() === 0 &&
      existing.dayType === "rest" &&
      !existing.isCompleted
    ) {
      const template = ROUTINE_TEMPLATES.legs_b;
      const healed: LocalScheduledWorkout = {
        ...existing,
        routineName: template.name,
        dayType: template.dayType,
        focusMuscleGroups: template.focusMuscleGroups,
        exerciseIds: template.exerciseIds,
        durationMinutes: template.defaultDurationMinutes,
        notes: template.description,
        updatedAt: new Date().toISOString(),
      };
      await db.scheduledWorkouts.put(healed);
      return healed;
    }
    return existing;
  }

  const [created] = await ensureWorkoutSchedule(
    userId,
    splitType,
    [date],
    preferredTime,
    workoutDaysPerWeek,
    customSchedule
  );
  return created;
}

/**
 * Updates a scheduled workout (e.g. changing workout name, dayType, time, or completing).
 */
export async function updateScheduledWorkout(
  record: LocalScheduledWorkout
): Promise<void> {
  const updated: LocalScheduledWorkout = {
    ...record,
    updatedAt: new Date().toISOString(),
  };
  await db.scheduledWorkouts.put(updated);
}
