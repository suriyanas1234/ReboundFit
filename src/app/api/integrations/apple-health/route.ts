import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

function createWebhookSupabaseClient() {
  const cookieStore = cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
  // If service role key is present in environment, use it to bypass RLS for webhook ingestion
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "placeholder-key";

  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });
}

/**
 * Extracts and normalizes health metrics from varying payload schemas:
 * - iOS Shortcuts custom JSON
 * - Health Auto Export JSON format
 * - Raw Apple HealthKit HKQuantityTypeIdentifier keys
 */
function parseHealthPayload(body: any): {
  date: string;
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
} {
  const todayStr = new Date().toISOString().split("T")[0];
  let date = todayStr;
  let weightLbs: number | undefined;
  let weightKg: number | undefined;
  let activeEnergyBurnedKcal: number | undefined;
  let basalEnergyBurnedKcal: number | undefined;
  let totalEnergyBurnedKcal: number | undefined;
  let stepCount: number | undefined;
  let distanceKm: number | undefined;
  let sleepHours: number | undefined;
  let deepSleepHours: number | undefined;
  let restingHeartRateBpm: number | undefined;
  let source = "apple_health";

  if (!body || typeof body !== "object") {
    return { date, source };
  }

  // 1. Check for Health Auto Export structure: body.data.metrics = [...]
  if (body.data && Array.isArray(body.data.metrics)) {
    source = "health_auto_export";
    for (const metric of body.data.metrics) {
      const name = (metric.name || "").toLowerCase();
      const units = (metric.units || "").toLowerCase();
      const dataPoints = Array.isArray(metric.data) ? metric.data : [];
      if (dataPoints.length === 0) continue;

      const latestPoint = dataPoints[dataPoints.length - 1];
      if (latestPoint.date) {
        const pointDate = latestPoint.date.split("T")[0].split(" ")[0];
        if (pointDate && pointDate.length === 10) {
          date = pointDate;
        }
      }

      const qty = typeof latestPoint.qty === "number" ? latestPoint.qty : parseFloat(latestPoint.qty);

      if (name.includes("step") || name.includes("stepcount")) {
        stepCount = Math.round(qty || 0);
      } else if (name.includes("active_energy") || name.includes("activeenergy")) {
        activeEnergyBurnedKcal = Math.round((qty || 0) * 10) / 10;
      } else if (name.includes("basal") || name.includes("resting_energy") || name.includes("basalenergy")) {
        basalEnergyBurnedKcal = Math.round((qty || 0) * 10) / 10;
      } else if (name.includes("heart_rate") || name.includes("heartrate")) {
        restingHeartRateBpm = Math.round(qty || 0);
      } else if (name.includes("weight") || name.includes("body_mass") || name.includes("bodymass")) {
        if (units === "kg") {
          weightKg = Math.round((qty || 0) * 10) / 10;
          weightLbs = Math.round((qty * 2.20462) * 10) / 10;
        } else {
          weightLbs = Math.round((qty || 0) * 10) / 10;
          weightKg = Math.round((qty * 0.453592) * 10) / 10;
        }
      } else if (name.includes("distance")) {
        distanceKm = units.includes("mi") ? Math.round((qty * 1.60934) * 10) / 10 : Math.round((qty || 0) * 10) / 10;
      } else if (name.includes("sleep")) {
        sleepHours = Math.round((latestPoint.asleep || latestPoint.qty || latestPoint.inBed || 0) * 10) / 10;
        if (latestPoint.deep) {
          deepSleepHours = Math.round(latestPoint.deep * 10) / 10;
        }
      }
    }
  }

  // 2. Direct flat fields or iOS Shortcut JSON format
  if (body.date && typeof body.date === "string") {
    const rawDate = body.date.split("T")[0].split(" ")[0];
    if (rawDate && rawDate.length === 10) {
      date = rawDate;
    }
  }

  // Steps
  const rawSteps =
    body.step_count ??
    body.steps ??
    body.stepCount ??
    body.HKQuantityTypeIdentifierStepCount;
  if (rawSteps !== undefined) stepCount = Math.round(Number(rawSteps) || 0);

  // Weight
  const rawWeightLbs =
    body.weight_lbs ??
    body.weightLbs ??
    body.weight ??
    body.HKQuantityTypeIdentifierBodyMass;
  const rawWeightKg = body.weight_kg ?? body.weightKg;

  if (rawWeightLbs !== undefined) {
    weightLbs = Math.round(Number(rawWeightLbs) * 10) / 10;
    weightKg = Math.round(Number(rawWeightLbs) * 0.453592 * 10) / 10;
  } else if (rawWeightKg !== undefined) {
    weightKg = Math.round(Number(rawWeightKg) * 10) / 10;
    weightLbs = Math.round(Number(rawWeightKg) * 2.20462 * 10) / 10;
  }

  // Active Energy Burned
  const rawActive =
    body.active_energy_burned_kcal ??
    body.active_energy_burned ??
    body.active_energy ??
    body.activeCalories ??
    body.activeEnergy ??
    body.HKQuantityTypeIdentifierActiveEnergyBurned;
  if (rawActive !== undefined) activeEnergyBurnedKcal = Math.round(Number(rawActive) * 10) / 10;

  // Basal Energy Burned
  const rawBasal =
    body.basal_energy_burned_kcal ??
    body.basal_energy_burned ??
    body.basal_energy ??
    body.basalCalories ??
    body.restingCalories ??
    body.HKQuantityTypeIdentifierBasalEnergyBurned;
  if (rawBasal !== undefined) basalEnergyBurnedKcal = Math.round(Number(rawBasal) * 10) / 10;

  // Total Energy Burned
  const rawTotal =
    body.total_energy_burned_kcal ??
    body.total_energy ??
    body.totalCalories ??
    body.totalEnergy;
  if (rawTotal !== undefined) {
    totalEnergyBurnedKcal = Math.round(Number(rawTotal) * 10) / 10;
  } else if (activeEnergyBurnedKcal !== undefined || basalEnergyBurnedKcal !== undefined) {
    totalEnergyBurnedKcal =
      Math.round(((activeEnergyBurnedKcal || 0) + (basalEnergyBurnedKcal || 0)) * 10) / 10;
  }

  // Distance
  const rawDist =
    body.distance_km ??
    body.distanceKm ??
    body.distance ??
    body.HKQuantityTypeIdentifierDistanceWalkingRunning;
  if (rawDist !== undefined) distanceKm = Math.round(Number(rawDist) * 10) / 10;

  // Sleep
  const rawSleep =
    body.sleep_hours ??
    body.sleepHours ??
    body.timeAsleep ??
    body.HKCategoryTypeIdentifierSleepAnalysis;
  if (rawSleep !== undefined) sleepHours = Math.round(Number(rawSleep) * 10) / 10;

  const rawDeep = body.deep_sleep_hours ?? body.deepSleepHours ?? body.deepSleep;
  if (rawDeep !== undefined) deepSleepHours = Math.round(Number(rawDeep) * 10) / 10;

  // Resting Heart Rate
  const rawHeart =
    body.resting_heart_rate_bpm ??
    body.resting_heart_rate ??
    body.restingHeartRate ??
    body.heartRate ??
    body.HKQuantityTypeIdentifierRestingHeartRate;
  if (rawHeart !== undefined) restingHeartRateBpm = Math.round(Number(rawHeart));

  if (body.source && typeof body.source === "string") {
    source = body.source;
  }

  return {
    date,
    weightLbs,
    weightKg,
    activeEnergyBurnedKcal,
    basalEnergyBurnedKcal,
    totalEnergyBurnedKcal,
    stepCount,
    distanceKm,
    sleepHours,
    deepSleepHours,
    restingHeartRateBpm,
    source,
  };
}

/**
 * Resolves the authenticated user ID from:
 * 1. Authorization: Bearer <token>
 * 2. x-api-key: <token>
 * 3. Query param ?token=... or ?apiKey=...
 * 4. Body syncToken / api_key / token
 * 5. Supabase Auth session cookies
 */
async function resolveUserId(
  request: Request,
  body: any,
  supabase: any
): Promise<{ userId: string | null; authType: string }> {
  const url = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get("x-api-key");
  const tokenFromHeader = authHeader?.startsWith("Bearer ")
    ? authHeader.substring(7).trim()
    : null;
  const tokenFromQuery =
    url.searchParams.get("token") ||
    url.searchParams.get("apiKey") ||
    url.searchParams.get("key");
  const tokenFromBody = body?.syncToken || body?.api_key || body?.token;

  const providedToken =
    tokenFromHeader || apiKeyHeader || tokenFromQuery || tokenFromBody;

  // 1. Check Global Server Secret (APPLE_HEALTH_SYNC_SECRET)
  const serverSecret = process.env.APPLE_HEALTH_SYNC_SECRET;
  if (serverSecret && providedToken === serverSecret) {
    const explicitUserId =
      url.searchParams.get("userId") || body?.user_id || body?.userId;
    if (explicitUserId) {
      return { userId: explicitUserId, authType: "global_secret" };
    }
    // Default to the first profile in the database
    const { data: firstProfile } = await supabase
      .from("profiles")
      .select("id")
      .limit(1)
      .single();
    if (firstProfile?.id) {
      return { userId: firstProfile.id, authType: "global_secret_default" };
    }
  }

  // 2. Check User-Specific Token in profiles table
  if (providedToken) {
    const { data: profileByToken } = await supabase
      .from("profiles")
      .select("id")
      .eq("apple_health_sync_token", providedToken)
      .maybeSingle();

    if (profileByToken?.id) {
      return { userId: profileByToken.id, authType: "user_sync_token" };
    }

    // Also allow matching profile id directly if providedToken is valid UUID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(providedToken)) {
      const { data: profileById } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", providedToken)
        .maybeSingle();

      if (profileById?.id) {
        return { userId: profileById.id, authType: "user_id_token" };
      }
    }
  }

  // 3. Check Supabase Auth Session
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.user?.id) {
      return { userId: session.user.id, authType: "session" };
    }
  } catch {
    // Session check skipped
  }

  return { userId: null, authType: "none" };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const supabase = createWebhookSupabaseClient();

    // 1. Authenticate Request
    const { userId, authType } = await resolveUserId(request, body, supabase);

    if (!userId) {
      return NextResponse.json(
        {
          success: false,
          error: "UNAUTHORIZED",
          message:
            "Invalid or missing Apple Health Sync Token. Please configure your token in ReboundFit Settings.",
          instructions:
            "Include your token via 'Authorization: Bearer <token>' header or '?token=<token>' query parameter.",
        },
        { status: 401 }
      );
    }

    // 2. Parse Incoming Metrics
    const parsed = parseHealthPayload(body);

    // 3. Upsert into public.health_metrics
    const metricRecord = {
      user_id: userId,
      date: parsed.date,
      weight_lbs: parsed.weightLbs,
      weight_kg: parsed.weightKg,
      active_energy_burned_kcal: parsed.activeEnergyBurnedKcal,
      basal_energy_burned_kcal: parsed.basalEnergyBurnedKcal,
      total_energy_burned_kcal: parsed.totalEnergyBurnedKcal,
      step_count: parsed.stepCount,
      distance_km: parsed.distanceKm,
      sleep_hours: parsed.sleepHours,
      deep_sleep_hours: parsed.deepSleepHours,
      resting_heart_rate_bpm: parsed.restingHeartRateBpm,
      source: parsed.source,
      raw_payload: body,
      updated_at: new Date().toISOString(),
    };

    const { data: upsertedMetric, error: upsertError } = await supabase
      .from("health_metrics")
      .upsert(metricRecord, { onConflict: "user_id,date" })
      .select()
      .maybeSingle();

    if (upsertError) {
      console.error("Health metrics upsert error:", upsertError);
      return NextResponse.json(
        {
          success: false,
          error: "DATABASE_ERROR",
          message: upsertError.message || "Failed to persist health metrics.",
        },
        { status: 500 }
      );
    }

    // 4. If body weight is provided, also automatically record weigh-in
    if (parsed.weightLbs && parsed.weightLbs > 0) {
      try {
        await supabase
          .from("weigh_ins")
          .upsert(
            {
              user_id: userId,
              logged_at: parsed.date,
              raw_weight_lbs: parsed.weightLbs,
              raw_weight_kg: parsed.weightKg || Number((parsed.weightLbs * 0.453592).toFixed(1)),
              notes: "Apple Health Automatic Weigh-In",
            },
            { onConflict: "user_id,logged_at" }
          );

        await supabase
          .from("profiles")
          .update({ current_weight_lbs: parsed.weightLbs })
          .eq("id", userId);
      } catch (weighErr) {
        console.warn("Notice: could not auto-link weigh-in record:", weighErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: "✓ Apple Health metrics synchronized successfully.",
      authType,
      date: parsed.date,
      metrics: {
        steps: parsed.stepCount,
        distanceKm: parsed.distanceKm,
        activeEnergyKcal: parsed.activeEnergyBurnedKcal,
        basalEnergyKcal: parsed.basalEnergyBurnedKcal,
        totalEnergyKcal: parsed.totalEnergyBurnedKcal,
        sleepHours: parsed.sleepHours,
        deepSleepHours: parsed.deepSleepHours,
        restingHeartRateBpm: parsed.restingHeartRateBpm,
        weightLbs: parsed.weightLbs,
      },
      record: upsertedMetric,
    });
  } catch (err: any) {
    console.error("Apple Health webhook exception:", err);
    return NextResponse.json(
      {
        success: false,
        error: "INTERNAL_ERROR",
        message: err.message || "An unexpected error occurred during health ingestion.",
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createWebhookSupabaseClient();
    const { userId, authType } = await resolveUserId(request, null, supabase);

    if (!userId) {
      return NextResponse.json({
        status: "active",
        endpoint: "/api/integrations/apple-health",
        service: "ReboundFit Apple Health Ingestion Webhook",
        description:
          "Push daily steps, sleep analysis, heart rate, and caloric burn directly from iOS Shortcuts or Health Auto Export.",
        authenticated: false,
        instructions:
          "Include your personal sync token in the 'Authorization: Bearer <token>' header or '?token=<token>' query parameter.",
      });
    }

    // Return the latest health metrics for the authenticated user
    const { data: latestMetrics } = await supabase
      .from("health_metrics")
      .select("*")
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .limit(7);

    return NextResponse.json({
      status: "active",
      endpoint: "/api/integrations/apple-health",
      authenticated: true,
      authType,
      userId,
      historyCount: latestMetrics?.length || 0,
      latestMetrics: latestMetrics || [],
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: err.message || "Failed to inspect health webhook status.",
      },
      { status: 500 }
    );
  }
}
