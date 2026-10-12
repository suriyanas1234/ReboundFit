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
  const defaultUnit: "lbs" | "kg" =
    profile?.weightUnit || (profile?.unitPreference === "metric" ? "kg" : "lbs");
  const [unit, setUnit] = useState<"lbs" | "kg">(defaultUnit);
  const [weight, setWeight] = useState<number>(Number(lastWeightLbs) || 175.0);
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
    setWeight((prev) => Number(Math.max(30, prev + delta).toFixed(1)));
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      {/* Dismiss backdrop overlay on click outside */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="w-full max-w-lg bg-[#1C1C1E] border border-[#38383A] rounded-t-3xl sm:rounded-2xl p-6 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] max-h-[85vh] overflow-y-auto shadow-2xl relative animate-slide-up">
        {/* iOS Drag Handle indicator */}
        <div className="sm:hidden w-10 h-1 bg-[#38383A] rounded-full mx-auto -mt-2 mb-4" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Scale className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Morning Weigh-In</h3>
              <p className="text-xs text-[#8E8E93]">Log scale weight to update HealthKit EMA</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#2C2C2E] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Unit Selector Segmented Pill */}
        <div className="flex rounded-xl bg-[#2C2C2E] p-1 mt-4 border border-[#38383A]">
          <button
            type="button"
            onClick={() => handleUnitToggle("lbs")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              unit === "lbs"
                ? "bg-purple-600 text-white font-bold shadow-sm"
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
                ? "bg-purple-600 text-white font-bold shadow-sm"
                : "text-[#8E8E93] hover:text-white"
            }`}
          >
            KG (Kilograms)
          </button>
        </div>

        {/* Stepper Weight Dial with Direct Numeric Input */}
        <div className="flex items-center justify-between py-4 px-2">
          <button
            type="button"
            onClick={() => handleAdjust(-0.5)}
            className="w-12 h-12 rounded-2xl bg-[#2C2C2E] border border-[#38383A] flex items-center justify-center text-white hover:border-purple-500 active:scale-95 transition-all text-lg font-bold"
            aria-label="Decrease weight by 0.5"
          >
            <Minus className="w-5 h-5" />
          </button>

          <div className="text-center flex flex-col items-center">
            <input
              type="number"
              step="0.1"
              inputMode="decimal"
              value={weight || ""}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              className="w-36 text-center text-4xl font-extrabold bg-transparent font-sans text-white focus:outline-none focus:ring-1 focus:ring-purple-500 rounded-xl py-1"
            />
            <div className="text-xs font-semibold text-purple-400 uppercase tracking-wider mt-0.5 font-mono">
              {unit}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleAdjust(0.5)}
            className="w-12 h-12 rounded-2xl bg-[#2C2C2E] border border-[#38383A] flex items-center justify-center text-white hover:border-purple-500 active:scale-95 transition-all text-lg font-bold"
            aria-label="Increase weight by 0.5"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Micro Adjust Pills */}
        <div className="mt-1">
          <span className="text-[10px] font-semibold text-[#8E8E93] uppercase tracking-wider block mb-1.5 text-center">
            Quick Adjustment
          </span>
          <div className="grid grid-cols-4 gap-2">
            {[-0.2, -0.1, +0.1, +0.2].map((delta) => (
              <button
                key={delta}
                type="button"
                onClick={() => handleAdjust(delta)}
                className="py-2 rounded-xl bg-[#2C2C2E] border border-[#38383A] text-xs font-mono font-bold text-gray-300 hover:text-white hover:border-purple-500/50 active:scale-95 transition-all"
              >
                {delta > 0 ? `+${delta}` : delta}
              </button>
            ))}
          </div>
        </div>

        {/* Clearly Visible Save Weigh-In Button */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSubmitting || !weight}
          className="w-full py-4 mt-6 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-center shadow-lg shadow-purple-600/30 flex items-center justify-center space-x-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <Check className="w-5 h-5 stroke-[2.5]" />
          <span>{isSubmitting ? "Logging..." : "Save Weigh-In"}</span>
        </button>
      </div>
    </div>
  );
}

export default WeighInModal;
