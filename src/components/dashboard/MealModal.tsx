"use client";

import React, { useState } from "react";
import { X, Flame, Check } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCloudSync } from "@/hooks/useCloudSync";
import { LocalMealLog } from "@/lib/db";

const MEAL_CATEGORIES: { type: LocalMealLog["mealType"]; label: string }[] = [
  { type: "breakfast", label: "Breakfast" },
  { type: "lunch", label: "Lunch" },
  { type: "dinner", label: "Dinner" },
  { type: "post_workout", label: "Pre/Post" },
  { type: "snack", label: "Snack" },
];

export interface MealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMealLogged?: () => void;
  defaultDate?: string;
}

export function MealModal({
  isOpen,
  onClose,
  onMealLogged,
  defaultDate,
}: MealModalProps) {
  const { user } = useAuth();
  const { saveMealLog } = useCloudSync();

  const [mealName, setMealName] = useState<string>("");
  const [mealType, setMealType] = useState<LocalMealLog["mealType"]>("lunch");
  const [calories, setCalories] = useState<number>(550);
  const [proteinG, setProteinG] = useState<number>(45);
  const [carbG, setCarbG] = useState<number>(55);
  const [fatG, setFatG] = useState<number>(15);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const todayStr = defaultDate || new Date().toISOString().split("T")[0];

  const handleSaveMeal = async () => {
    if (!user || !mealName.trim()) return;
    setIsSubmitting(true);
    try {
      await saveMealLog({
        name: mealName.trim(),
        mealType,
        calories: Number(calories) || 0,
        proteinG: Number(proteinG) || 0,
        carbG: Number(carbG) || 0,
        fatG: Number(fatG) || 0,
        isQuickDial: false,
        date: todayStr,
      });

      setMealName("");
      if (onMealLogged) onMealLogged();
      onClose();
    } catch (err) {
      console.error("Failed to save meal:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in p-0 sm:p-4">
      {/* Dismiss backdrop overlay */}
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      <div className="w-full max-w-lg rounded-t-[32px] sm:rounded-3xl bg-[#1C1C1E] border border-[#38383A] shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-slide-up">
        {/* iOS Drag Handle */}
        <div className="sm:hidden w-10 h-1 bg-[#38383A] rounded-full mx-auto mt-2.5 mb-1" />

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#2C2C2E]">
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#FF9500]/15 text-[#FF9500] flex items-center justify-center shadow-inner">
                <Flame className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white tracking-tight">Log Meal Intake</h3>
                <p className="text-xs text-[#8E8E93]">Nutrition tracking for HealthKit dynamic energy</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-[#2C2C2E] text-[#8E8E93] hover:text-white flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Meal Title Input */}
          <div>
            <label className="text-xs font-semibold text-[#8E8E93] block mb-1.5">
              Meal Title / Description
            </label>
            <input
              type="text"
              placeholder="e.g. Grilled Salmon, Brown Rice & Broccoli"
              value={mealName}
              onChange={(e) => setMealName(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[#2C2C2E] border border-[#38383A] text-sm text-white focus:outline-none focus:border-[#FF9500] transition-colors"
              autoFocus
            />
          </div>

          {/* Category Selector */}
          <div>
            <label className="text-xs font-semibold text-[#8E8E93] block mb-1.5">
              Meal Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {MEAL_CATEGORIES.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setMealType(type)}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all ${
                    mealType === type
                      ? "bg-[#FF9500] text-black shadow-md shadow-[#FF9500]/25 font-bold"
                      : "bg-[#2C2C2E] text-[#8E8E93] hover:text-white border border-[#38383A]/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Macro Inputs Grid */}
          <div>
            <label className="text-xs font-semibold text-[#8E8E93] block mb-1.5">
              Nutritional Macros
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3.5 rounded-2xl bg-[#2C2C2E] border border-[#38383A]">
                <label className="text-[10px] font-mono text-[#FF9500] uppercase font-bold block mb-1">
                  Calories
                </label>
                <input
                  type="number"
                  value={calories || ""}
                  onChange={(e) => setCalories(Number(e.target.value))}
                  className="w-full bg-transparent text-xl font-bold font-mono text-white focus:outline-none"
                />
                <span className="text-[10px] text-[#8E8E93]">kcal</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#2C2C2E] border border-[#38383A]">
                <label className="text-[10px] font-mono text-[#FF2D55] uppercase font-bold block mb-1">
                  Protein
                </label>
                <input
                  type="number"
                  value={proteinG || ""}
                  onChange={(e) => setProteinG(Number(e.target.value))}
                  className="w-full bg-transparent text-xl font-bold font-mono text-white focus:outline-none"
                />
                <span className="text-[10px] text-[#8E8E93]">grams</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#2C2C2E] border border-[#38383A]">
                <label className="text-[10px] font-mono text-[#30D158] uppercase font-bold block mb-1">
                  Carbs
                </label>
                <input
                  type="number"
                  value={carbG || ""}
                  onChange={(e) => setCarbG(Number(e.target.value))}
                  className="w-full bg-transparent text-xl font-bold font-mono text-white focus:outline-none"
                />
                <span className="text-[10px] text-[#8E8E93]">grams</span>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#2C2C2E] border border-[#38383A]">
                <label className="text-[10px] font-mono text-[#0A84FF] uppercase font-bold block mb-1">
                  Fat
                </label>
                <input
                  type="number"
                  value={fatG || ""}
                  onChange={(e) => setFatG(Number(e.target.value))}
                  className="w-full bg-transparent text-xl font-bold font-mono text-white focus:outline-none"
                />
                <span className="text-[10px] text-[#8E8E93]">grams</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pinned Sticky Bottom Footer: Fully above navigation dock and safe-area */}
        <div className="sticky bottom-0 bg-[#1C1C1E] border-t border-[#38383A] p-4 pb-[calc(env(safe-area-inset-bottom)+16px)] sm:pb-4 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-3 rounded-2xl text-xs font-semibold text-[#8E8E93] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSaveMeal}
            disabled={isSubmitting || !mealName.trim()}
            className="flex-1 sm:flex-initial px-6 py-3 rounded-2xl bg-[#FF9500] text-black font-extrabold text-xs shadow-lg shadow-[#FF9500]/25 hover:opacity-95 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>{isSubmitting ? "Logging..." : "Log Meal"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default MealModal;
