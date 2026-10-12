"use client";

import React, { useState, useEffect } from "react";
import { X, Scale, Check, Plus, Minus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCloudSync } from "@/hooks/useCloudSync";

export interface WeighInModalProps {
  isOpen: boolean;
  onClose: () => void;
  lastWeightLbs: number;
  onWeightLogged?: () => void;
}

export function WeighInModal({
  isOpen,
  onClose,
  lastWeightLbs,
  onWeightLogged,
}: WeighInModalProps) {
  const { user, profile } = useAuth();
  const { saveWeighIn } = useCloudSync();
  const [weight, setWeight] = useState<number>(Number(lastWeightLbs) || 175.0);
  const [unit, setUnit] = useState<"lbs" | "kg">(profile?.weightUnit || "lbs");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (lastWeightLbs && lastWeightLbs > 0) {
      if (unit === "kg") {
        setWeight(Number((lastWeightLbs * 0.45359237).toFixed(1)));
      } else {
        setWeight(Number(lastWeightLbs));
      }
    }
  }, [lastWeightLbs, isOpen, unit]);

  if (!isOpen) return null;

  const handleAdjust = (delta: number) => {
    setWeight((prev) => Number((Math.max(30, prev + delta)).toFixed(1)));
  };

  const handleUnitToggle = (newUnit: "lbs" | "kg") => {
    if (newUnit === unit) return;
    if (newUnit === "kg") {
      setWeight(Number((weight * 0.45359237).toFixed(1)));
    } else {
      setWeight(Number((weight / 0.45359237).toFixed(1)));
    }
    setUnit(newUnit);
  };

  const handleSave = async () => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const weightLbs = unit === "lbs" ? weight : Number((weight / 0.45359237).toFixed(1));
      const weightKg = unit === "kg" ? weight : Number((weight * 0.45359237).toFixed(1));

      await saveWeighIn({
        date: today,
        rawWeightLbs: weightLbs,
        rawWeightKg: weightKg,
        notes: "Morning Scale Weigh-In",
      });

      if (onWeightLogged) onWeightLogged();
      onClose();
    } catch (err) {
      console.error("Failed to log weigh-in:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-0 sm:p-4">
      {/* Dismiss backdrop overlay on click outside */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="w-full max-w-sm rounded-t-[32px] sm:rounded-3xl bg-[#1C1C1E] border border-[#38383A] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up">
        {/* iOS Drag Handle indicator */}
        <div className="sm:hidden w-10 h-1 bg-[#38383A] rounded-full mx-auto mt-2.5 mb-1" />

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-[#AF52DE]/15 text-[#AF52DE] flex items-center justify-center shadow-inner">
                <Scale className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Morning Weigh-In</h3>
                <p className="text-xs text-[#8E8E93]">Log scale weight to update HealthKit EMA</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#2C2C2E] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Unit Selector Segmented Pill */}
          <div className="flex rounded-xl bg-[#2C2C2E] p-1 border border-[#38383A]">
            <button
              type="button"
              onClick={() => handleUnitToggle("lbs")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                unit === "lbs"
                  ? "bg-[#AF52DE] text-white font-bold shadow-sm"
                  : "text-[#8E8E93] hover:text-white"
              }`}
            >
              LBS (Pounds)
            </button>
            <button
              type="button"
              onClick={() => handleUnitToggle("kg")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                unit === "kg"
                  ? "bg-[#AF52DE] text-white font-bold shadow-sm"
                  : "text-[#8E8E93] hover:text-white"
              }`}
            >
              KG (Kilograms)
            </button>
          </div>

          {/* Stepper Weight Dial with Direct Numeric Input */}
          <div className="flex items-center justify-between py-2 px-1">
            <button
              type="button"
              onClick={() => handleAdjust(-0.5)}
              className="min-w-[44px] min-h-[44px] rounded-2xl bg-[#2C2C2E] border border-[#38383A] flex items-center justify-center text-white hover:border-[#AF52DE] active:scale-95 transition-all text-lg font-bold"
              aria-label="Decrease weight by 0.5"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="text-center flex flex-col items-center">
              <input
                type="number"
                step="0.1"
                value={weight || ""}
                onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                className="w-36 text-center text-4xl font-extrabold bg-transparent font-sans text-white focus:outline-none focus:ring-1 focus:ring-[#AF52DE] rounded-xl py-1"
              />
              <div className="text-xs font-semibold text-[#AF52DE] uppercase tracking-wider mt-0.5">
                {unit}
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleAdjust(0.5)}
              className="min-w-[44px] min-h-[44px] rounded-2xl bg-[#2C2C2E] border border-[#38383A] flex items-center justify-center text-white hover:border-[#AF52DE] active:scale-95 transition-all text-lg font-bold"
              aria-label="Increase weight by 0.5"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Micro Adjust Pills */}
          <div>
            <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1.5 text-center">
              Quick Offset (Tenths)
            </span>
            <div className="grid grid-cols-4 gap-2">
              {[-0.2, -0.1, +0.1, +0.2].map((delta) => (
                <button
                  key={delta}
                  type="button"
                  onClick={() => handleAdjust(delta)}
                  className="py-2 rounded-xl bg-[#2C2C2E] border border-[#38383A] text-xs font-mono font-bold text-gray-300 hover:text-white hover:border-[#AF52DE]/50 active:scale-95 transition-all"
                >
                  {delta > 0 ? `+${delta}` : delta}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Pinned Sticky Bottom Footer: Always visible above bottom dock and safe-area */}
        <div className="sticky bottom-0 bg-[#1C1C1E] border-t border-[#38383A] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:pb-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSubmitting || !weight}
            className="w-full py-3.5 rounded-2xl bg-[#AF52DE] text-white font-extrabold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-[#AF52DE]/25 hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? "Logging..." : "Save Weigh-In"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
