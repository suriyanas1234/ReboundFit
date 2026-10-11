"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, LocalProgressPhoto, LocalWeighIn } from "@/lib/db";
import { calculateWeightTrend, SmoothedWeightPoint } from "@/algorithms/weightTrend";
import { QuickWeighInModal } from "@/components/dashboard/QuickWeighInModal";
import {
  Scale,
  Camera,
  Layers,
  Sparkles,
  ChevronRight,
  Plus,
  Sliders,
  Calendar,
  Image as ImageIcon,
  CheckCircle2,
  TrendingUp,
  X,
  Upload,
} from "lucide-react";

export default function BodyMeasurementsPage() {
  const { user, profile } = useAuth();
  const [weighIns, setWeighIns] = useState<LocalWeighIn[]>([]);
  const [trendData, setTrendData] = useState<SmoothedWeightPoint[]>([]);
  const [photos, setPhotos] = useState<LocalProgressPhoto[]>([]);
  const [isWeighInOpen, setIsWeighInOpen] = useState<boolean>(false);
  const [sliderPosition, setSliderPosition] = useState<number>(50); // Ghost slider thumb
  const [comparisonPose, setComparisonPose] = useState<LocalProgressPhoto["pose"]>("front_relaxed");
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const loadBodyData = async () => {
    if (!user) return;
    try {
      // 1. Fetch Weigh-Ins
      const savedWeighIns = await db.weighIns.where("userId").equals(user.id).toArray();
      setWeighIns(savedWeighIns.sort((a, b) => a.date.localeCompare(b.date)));

      if (savedWeighIns.length > 0) {
        const smoothed = calculateWeightTrend(
          savedWeighIns.map((w) => ({ date: w.date, rawWeightLbs: w.rawWeightLbs }))
        );
        setTrendData(smoothed);
      } else if (profile?.currentWeightLbs) {
        const smoothed = calculateWeightTrend([
          { date: todayStr, rawWeightLbs: profile.currentWeightLbs },
        ]);
        setTrendData(smoothed);
      }

      // 2. Fetch Progress Photos
      const savedPhotos = await db.photos.where("userId").equals(user.id).toArray();
      setPhotos(savedPhotos.sort((a, b) => a.date.localeCompare(b.date)));
    } catch (err) {
      console.error("Failed to load body measurements data:", err);
    }
  };

  useEffect(() => {
    loadBodyData();

    const handleSync = () => {
      loadBodyData();
    };

    window.addEventListener("reboundfit_sync", handleSync);
    return () => {
      window.removeEventListener("reboundfit_sync", handleSync);
    };
  }, [user, profile]);

  const latestTrendPoint = trendData[trendData.length - 1] || {
    trendWeightLbs: profile?.currentWeightLbs || 175.0,
    rateOfGainLbsPerWeek: 0,
    gainZone: "stagnant",
  };

  const baselinePhoto =
    photos.find((p) => p.isBaseline && p.pose === comparisonPose) ||
    photos.find((p) => p.isBaseline) ||
    photos[0] ||
    null;

  const latestPhoto =
    photos.filter((p) => p.pose === comparisonPose).slice(-1)[0] ||
    photos.slice(-1)[0] ||
    null;

  // File Upload fallback for photos
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        const isFirst = photos.length === 0;
        const newPhoto: LocalProgressPhoto = {
          id: `photo-${user.id}-${Date.now()}`,
          userId: user.id,
          date: todayStr,
          weekNumber: Math.max(1, Math.ceil(photos.length / 2) + 1),
          pose: comparisonPose,
          weightLbs: latestTrendPoint.trendWeightLbs,
          photoDataUrl: dataUrl,
          isBaseline: isFirst,
          synced: false,
        };
        await db.photos.put(newPhoto);
        await loadBodyData();
      }
    };
    reader.readAsDataURL(file);
  };

  const formattedEyebrowDate = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).toUpperCase();

  return (
    <div className="space-y-6 animate-fade-in pb-16">
      {/* =========================================================================
          APPLE HEALTH LARGE TITLE HEADER
          ========================================================================= */}
      <header className="pt-2 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93] block">
          {formattedEyebrowDate}
        </span>
        <div className="flex items-center justify-between mt-0.5">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Body Measurements
          </h1>
          <button
            onClick={() => setIsWeighInOpen(true)}
            className="w-9 h-9 rounded-full bg-[#AF52DE] text-white flex items-center justify-center font-bold shadow-lg shadow-[#AF52DE]/20 active:scale-95 transition-all"
            title="Log Weigh-In"
          >
            <Plus className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </header>

      {/* =========================================================================
          SECTION 1: WEIGHT TREND & RATE OF GAIN (HealthKit Purple Accent #AF52DE)
          ========================================================================= */}
      <div className="p-6 rounded-[24px] bg-[#1C1C1E] border border-[#2C2C2E]/60 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#AF52DE]/20 text-[#AF52DE] flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-[#AF52DE] tracking-wide uppercase">
              Weight Trend
            </span>
          </div>
          <span className="text-xs font-mono text-[#8E8E93]">SMOOTHED (EMA)</span>
        </div>

        {/* Central Weight Stat */}
        <div className="flex items-baseline justify-between pt-1">
          <div>
            <span className="text-5xl font-black text-white tracking-tight font-sans">
              {latestTrendPoint.trendWeightLbs.toFixed(1)}
            </span>
            <span className="text-lg font-semibold text-[#8E8E93] ml-2">lbs</span>
          </div>

          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#AF52DE]/20 text-[#AF52DE] font-mono">
            {latestTrendPoint.rateOfGainLbsPerWeek > 0 ? "+" : ""}
            {latestTrendPoint.rateOfGainLbsPerWeek.toFixed(2)} lbs / week
          </span>
        </div>

        {/* Apple Health Time-Series Bar / Trend Graph */}
        <div className="space-y-1.5 pt-2">
          <div className="flex items-center justify-between text-[11px] font-mono text-[#8E8E93]">
            <span>Recent Weigh-Ins</span>
            <span>Target Gain: +{profile?.targetGainRateLbsPerWeek || 0.5} lbs/wk</span>
          </div>

          <div className="h-28 rounded-2xl bg-[#2C2C2E]/50 p-3 flex items-end justify-between space-x-1.5">
            {trendData.slice(-14).map((pt, i) => (
              <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group relative">
                <div
                  className="w-full rounded-md bg-[#AF52DE]/40 hover:bg-[#AF52DE] transition-all cursor-pointer"
                  style={{
                    height: `${Math.max(16, Math.min(84, ((pt.trendWeightLbs % 10) + 1) * 7))}px`,
                  }}
                />
                <div className="opacity-0 group-hover:opacity-100 absolute -top-7 bg-black border border-[#38383A] text-white text-[10px] font-mono px-1.5 py-0.5 rounded shadow pointer-events-none transition-opacity">
                  {pt.trendWeightLbs.toFixed(1)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[#8E8E93] pt-2 border-t border-[#2C2C2E]">
          <span>
            {weighIns.length} total entries recorded
          </span>
          <button
            onClick={() => setIsWeighInOpen(true)}
            className="text-xs font-semibold text-[#0A84FF] hover:underline"
          >
            + Add Weigh-In
          </button>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: PHYSIQUE COMPARISON & GHOST SLIDER
          ========================================================================= */}
      <div className="p-6 rounded-[24px] bg-[#1C1C1E] border border-[#2C2C2E]/60 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#0A84FF]/20 text-[#0A84FF] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold text-[#0A84FF] tracking-wide uppercase">
              Physique Split Comparison
            </span>
          </div>

          <label className="cursor-pointer text-xs font-semibold text-[#0A84FF] hover:underline flex items-center space-x-1">
            <Upload className="w-3.5 h-3.5" />
            <span>Upload Photo</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="sr-only"
            />
          </label>
        </div>

        {/* Pose Filter Selector */}
        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 no-scrollbar">
          {[
            { id: "front_relaxed", label: "Front Relaxed" },
            { id: "front_flexed", label: "Front Flexed" },
            { id: "side_left", label: "Side Profile" },
            { id: "back_lat_spread", label: "Back Spread" },
          ].map((pose) => (
            <button
              key={pose.id}
              onClick={() => setComparisonPose(pose.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                comparisonPose === pose.id
                  ? "bg-[#2C2C2E] text-white border border-[#38383A]"
                  : "text-[#8E8E93] hover:text-white"
              }`}
            >
              {pose.label}
            </button>
          ))}
        </div>

        {/* Interactive Comparison Window */}
        {baselinePhoto && latestPhoto ? (
          <div className="space-y-3">
            <div className="relative aspect-[3/4] max-h-[420px] rounded-2xl overflow-hidden bg-black border border-[#2C2C2E] select-none">
              {/* Baseline Photo (Left side / Underlay) */}
              <img
                src={baselinePhoto.photoDataUrl}
                alt="Baseline Physique"
                className="absolute inset-0 w-full h-full object-cover"
              />

              {/* Latest Photo (Right side clipped by Slider Position) */}
              <div
                className="absolute inset-0 overflow-hidden"
                style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
              >
                <img
                  src={latestPhoto.photoDataUrl}
                  alt="Current Physique"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              </div>

              {/* Translucent Divider Line with Thumb */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-2xl z-20 pointer-events-none"
                style={{ left: `${sliderPosition}%` }}
              >
                <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white text-black flex items-center justify-center shadow-2xl font-black text-xs">
                  ⇔
                </div>
              </div>

              {/* Labels */}
              <div className="absolute top-3 left-3 z-10 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-white">
                Baseline (Day 1)
              </div>
              <div className="absolute top-3 right-3 z-10 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-mono text-white">
                Latest Check-in
              </div>
            </div>

            {/* Native iOS Slider Thumb Control */}
            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-[11px] font-mono text-[#8E8E93]">
                <span>Drag to Compare Overload Progression:</span>
                <span>{sliderPosition}% Current</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={sliderPosition}
                onChange={(e) => setSliderPosition(Number(e.target.value))}
                className="w-full accent-[#0A84FF] cursor-pointer"
              />
            </div>
          </div>
        ) : (
          <div className="aspect-[3/4] max-h-[300px] rounded-2xl bg-[#2C2C2E]/40 border border-[#2C2C2E] flex flex-col items-center justify-center text-center p-6 space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#1C1C1E] border border-[#38383A] flex items-center justify-center text-[#8E8E93]">
              <ImageIcon className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">No Physique Photos Yet</div>
              <p className="text-xs text-[#8E8E93] max-w-xs mt-1">
                Upload your Day 1 baseline check-in photo to unlock the split-screen comparison slider.
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 rounded-xl bg-[#0A84FF] text-white text-xs font-bold active:scale-95 transition-all shadow-md"
            >
              Upload Baseline Check-in
            </button>
          </div>
        )}
      </div>

      {/* Quick Weigh-In Modal */}
      <QuickWeighInModal
        isOpen={isWeighInOpen}
        onClose={() => setIsWeighInOpen(false)}
        lastWeightLbs={latestTrendPoint.trendWeightLbs}
        onWeightLogged={loadBodyData}
      />
    </div>
  );
}
