"use client";

import React, { useState } from "react";
import { X, Scale, Check, Plus, Minus } from "lucide-react";
import { db } from "@/lib/db";
import { calculateWeightTrend } from "@/algorithms/weightTrend";

interface QuickWeighInModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastWeightLbs: number;
  onWeightLogged: () => void;
}

export function QuickWeighInModal({
  isOpen,
  onClose,
  lastWeightLbs,
  onWeightLogged,
}: QuickWeighInModalProps) {
  const [weight, setWeight] = useState<number>(lastWeightLbs || 175.0);
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleAdjust = (delta: number) => {
    setWeight((prev) => Number((prev + delta).toFixed(1)));
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const weightLbs = unit === "lbs" ? weight : Number((weight / 0.45359237).toFixed(1));
      const weightKg = unit === "kg" ? weight : Number((weight * 0.45359237).toFixed(1));

      // 1. Fetch historical weigh-ins to update EMA
      const existing = await db.weighIns.toArray();
      const updatedList = [
        ...existing.filter((w) => w.date !== today),
        {
          id: `weigh-${today}`,
          date: today,
          rawWeightLbs: weightLbs,
          rawWeightKg: weightKg,
          synced: false,
          createdAt: new Date().toISOString(),
        },
      ];

      // 2. Recalculate trend with new entry
      const smoothed = calculateWeightTrend(
        updatedList.map((w) => ({ date: w.date, rawWeightLbs: w.rawWeightLbs }))
      );
      const latestSmoothed = smoothed.find((s) => s.date === today);

      // 3. Save to local IndexedDB
      await db.weighIns.put({
        id: `weigh-${today}`,
        date: today,
        rawWeightLbs: weightLbs,
        rawWeightKg: weightKg,
        trendWeightLbs: latestSmoothed?.trendWeightLbs ?? weightLbs,
        rateOfGainLbsPerWeek: latestSmoothed?.rateOfGainLbsPerWeek ?? 0,
        synced: false,
        createdAt: new Date().toISOString(),
      });

      // 4. Update profile current weight
      const profile = await db.profiles.toCollection().first();
      if (profile) {
        await db.profiles.update(profile.id, {
          currentWeightLbs: weightLbs,
          updatedAt: new Date().toISOString(),
        });
      }

      onWeightLogged();
      onClose();
    } catch (err) {
      console.error("Failed to log weigh-in:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-3xl bg-surface border border-surface-border p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1 rounded-full text-gray-400 hover:text-white hover:bg-surface-elevated"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 rounded-2xl bg-brand-cyan/15 text-brand-cyan">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Morning Weigh-In</h3>
            <p className="text-xs text-gray-400">Step on the scale, log in 3 seconds</p>
          </div>
        </div>

        {/* Unit Selector */}
        <div className="flex rounded-xl bg-surface-elevated p-1 mb-6 border border-surface-border">
          <button
            onClick={() => setUnit("lbs")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              unit === "lbs" ? "bg-brand-cyan text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            LBS (Pounds)
          </button>
          <button
            onClick={() => setUnit("kg")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              unit === "kg" ? "bg-brand-cyan text-black" : "text-gray-400 hover:text-white"
            }`}
          >
            KG (Kilograms)
          </button>
        </div>

        {/* Stepper Weight Dial */}
        <div className="flex items-center justify-between my-4 px-2">
          <button
            onClick={() => handleAdjust(-0.5)}
            className="w-12 h-12 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center text-white hover:border-brand-cyan/40 active:scale-95 transition-all text-lg font-bold"
          >
            <Minus className="w-5 h-5" />
          </button>

          <div className="text-center">
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              className="w-32 text-center text-4xl font-black bg-transparent font-mono text-white focus:outline-none"
            />
            <div className="text-xs font-mono text-brand-cyan uppercase tracking-wider mt-1">
              {unit}
            </div>
          </div>

          <button
            onClick={() => handleAdjust(0.5)}
            className="w-12 h-12 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center text-white hover:border-brand-cyan/40 active:scale-95 transition-all text-lg font-bold"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Micro Adjust Pills */}
        <div className="grid grid-cols-4 gap-2 my-4">
          {[-0.2, -0.1, +0.1, +0.2].map((delta) => (
            <button
              key={delta}
              onClick={() => handleAdjust(delta)}
              className="py-1.5 rounded-xl bg-surface-elevated/80 border border-surface-border/50 text-xs font-mono text-gray-300 hover:text-white hover:border-brand-cyan/30 active:scale-95 transition-all"
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>

        {/* Commit Button */}
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-brand-cyan to-brand-emerald text-black font-extrabold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-brand-cyan/20 hover:opacity-95 active:scale-95 transition-all"
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
          <span>{isSubmitting ? "Saving..." : "Log Morning Weight"}</span>
        </button>
      </div>
    </div>
  );
}
