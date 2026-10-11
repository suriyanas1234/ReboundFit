"use client";

import React, { useState } from "react";
import { X, Scale, Check, Plus, Minus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCloudSync } from "@/hooks/useCloudSync";

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
  const { user } = useAuth();
  const { saveWeighIn } = useCloudSync();
  const [weight, setWeight] = useState<number>(Number(lastWeightLbs) || 175.0);
  const [unit, setUnit] = useState<"lbs" | "kg">("lbs");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  React.useEffect(() => {
    if (lastWeightLbs && lastWeightLbs > 0) {
      setWeight(Number(lastWeightLbs));
    }
  }, [lastWeightLbs, isOpen]);

  if (!isOpen) return null;

  const handleAdjust = (delta: number) => {
    setWeight((prev) => Number((prev + delta).toFixed(1)));
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

      onWeightLogged();
      onClose();
    } catch (err) {
      console.error("Failed to log weigh-in:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm rounded-t-[28px] sm:rounded-3xl bg-[#1C1C1E] border border-[#38383A] p-6 shadow-2xl relative pb-safe animate-slide-up">
        <div className="sm:hidden w-10 h-1 bg-[#38383A] rounded-full mx-auto -mt-2 mb-3" />

        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#2C2C2E] text-[#8E8E93] hover:text-white flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-2xl bg-[#AF52DE]/20 text-[#AF52DE] flex items-center justify-center">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">Morning Weigh-In</h3>
            <p className="text-xs text-[#8E8E93]">Log scale weight to update HealthKit EMA</p>
          </div>
        </div>

        {/* Unit Selector */}
        <div className="flex rounded-xl bg-[#2C2C2E] p-1 mb-5 border border-[#38383A]">
          <button
            onClick={() => setUnit("lbs")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              unit === "lbs" ? "bg-[#AF52DE] text-white font-bold" : "text-[#8E8E93] hover:text-white"
            }`}
          >
            LBS (Pounds)
          </button>
          <button
            onClick={() => setUnit("kg")}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              unit === "kg" ? "bg-[#AF52DE] text-white font-bold" : "text-[#8E8E93] hover:text-white"
            }`}
          >
            KG (Kilograms)
          </button>
        </div>

        {/* Stepper Weight Dial */}
        <div className="flex items-center justify-between my-3 px-2">
          <button
            onClick={() => handleAdjust(-0.5)}
            className="w-11 h-11 rounded-2xl bg-[#2C2C2E] border border-[#38383A] flex items-center justify-center text-white hover:border-[#AF52DE] active:scale-95 transition-all text-lg font-bold"
          >
            <Minus className="w-5 h-5" />
          </button>

          <div className="text-center">
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
              className="w-32 text-center text-4xl font-extrabold bg-transparent font-sans text-white focus:outline-none"
            />
            <div className="text-xs font-semibold text-[#AF52DE] uppercase tracking-wider mt-0.5">
              {unit}
            </div>
          </div>

          <button
            onClick={() => handleAdjust(0.5)}
            className="w-11 h-11 rounded-2xl bg-[#2C2C2E] border border-[#38383A] flex items-center justify-center text-white hover:border-[#AF52DE] active:scale-95 transition-all text-lg font-bold"
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
              className="py-1.5 rounded-xl bg-[#2C2C2E] border border-[#38383A] text-xs font-mono text-gray-300 hover:text-white hover:border-[#AF52DE]/50 active:scale-95 transition-all"
            >
              {delta > 0 ? `+${delta}` : delta}
            </button>
          ))}
        </div>

        {/* Commit Button */}
        <button
          onClick={handleSave}
          disabled={isSubmitting}
          className="w-full mt-2 py-3.5 rounded-2xl bg-[#AF52DE] text-white font-extrabold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-[#AF52DE]/20 hover:opacity-95 active:scale-95 transition-all disabled:opacity-50"
        >
          <Check className="w-4 h-4 stroke-[3]" />
          <span>{isSubmitting ? "Logging..." : "Log to HealthKit"}</span>
        </button>
      </div>
    </div>
  );
}
