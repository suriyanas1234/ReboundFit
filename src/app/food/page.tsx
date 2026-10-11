"use client";

import React, { useState, useEffect } from "react";
import { db, LocalMealLog, LocalProfile } from "@/lib/db";
import {
  UtensilsCrossed,
  Flame,
  Beef,
  Plus,
  Trash2,
  Check,
  Search,
  Sparkles,
  Bookmark,
  ChevronRight,
  Clock,
} from "lucide-react";

const BULK_STAPLES = [
  { name: "Chicken Breast (Cooked)", baseGrams: 100, calories: 165, protein: 31, carbs: 0, fat: 3.6 },
  { name: "Whole Eggs (Large)", baseGrams: 50, calories: 72, protein: 6.3, carbs: 0.4, fat: 4.8 },
  { name: "White Basmati Rice (Cooked)", baseGrams: 150, calories: 195, protein: 4.2, carbs: 43.5, fat: 0.4 },
  { name: "Rolled Oats", baseGrams: 80, calories: 303, protein: 10.5, carbs: 54, fat: 5.3 },
  { name: "Greek Yogurt 0%", baseGrams: 170, calories: 100, protein: 18, carbs: 6, fat: 0 },
  { name: "Whey Protein Isolate", baseGrams: 30, calories: 120, protein: 25, carbs: 2, fat: 1 },
  { name: "Peanut Butter", baseGrams: 32, calories: 190, protein: 8, carbs: 7, fat: 16 },
  { name: "Ground Beef 93/7 (Cooked)", baseGrams: 112, calories: 170, protein: 24, carbs: 0, fat: 8 },
];

const MEAL_TEMPLATES = [
  {
    name: "1,000 kcal Morning Mass Shake",
    description: "Whey, 80g oats, banana, 2tbsp peanut butter, whole milk",
    mealType: "breakfast" as const,
    calories: 980,
    protein: 64,
    carbs: 110,
    fat: 32,
  },
  {
    name: "Standard Chicken & Rice Bulk Bowl",
    description: "200g chicken breast, 300g cooked white rice, olive oil",
    mealType: "lunch" as const,
    calories: 680,
    protein: 65,
    carbs: 87,
    fat: 8,
  },
  {
    name: "Post-Lift Rapid Glycogen Refuel",
    description: "2 scoops whey isolate, 2 ripe bananas, 50g dextrose/honey",
    mealType: "post_workout" as const,
    calories: 520,
    protein: 50,
    carbs: 78,
    fat: 2,
  },
];

export default function FoodTrackerPage() {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [meals, setMeals] = useState<LocalMealLog[]>([]);
  const [activeTab, setActiveTab] = useState<"quick_dial" | "staples" | "templates">("quick_dial");

  // Quick Dial Form State
  const [quickCalories, setQuickCalories] = useState<number>(650);
  const [quickProtein, setQuickProtein] = useState<number>(45);
  const [quickName, setQuickName] = useState<string>("Afternoon Bulk Snack");
  const [quickMealType, setQuickMealType] = useState<LocalMealLog["mealType"]>("snack");

  // Search State
  const [searchQuery, setSearchQuery] = useState<string>("");

  const today = new Date().toISOString().split("T")[0];

  const loadMeals = async () => {
    const userProfile = await db.profiles.toCollection().first();
    if (userProfile) setProfile(userProfile);

    const todayMeals = await db.mealLogs.where("date").equals(today).toArray();
    setMeals(todayMeals);
  };

  useEffect(() => {
    loadMeals();
  }, []);

  const totalCalories = meals.reduce((sum, m) => sum + m.calories, 0);
  const totalProtein = meals.reduce((sum, m) => sum + m.proteinG, 0);
  const totalCarbs = meals.reduce((sum, m) => sum + m.carbG, 0);
  const totalFat = meals.reduce((sum, m) => sum + m.fatG, 0);

  const targetCalories = profile?.targetCalories || 2925;
  const targetProtein = profile?.targetProteinG || 167;

  // 1-Tap Quick Dial Commit
  const handleLogQuickDial = async () => {
    const newEntry: LocalMealLog = {
      id: `meal-${Date.now()}`,
      date: today,
      mealType: quickMealType,
      name: quickName || "Quick Calorie Dial",
      calories: quickCalories,
      proteinG: quickProtein,
      carbG: Math.max(0, Math.round((quickCalories - quickProtein * 4 - 15 * 9) / 4)),
      fatG: 15,
      isQuickDial: true,
      synced: false,
      createdAt: new Date().toISOString(),
    };

    await db.mealLogs.put(newEntry);
    await loadMeals();
  };

  // Add bulk staple directly
  const handleAddStaple = async (staple: (typeof BULK_STAPLES)[0]) => {
    const newEntry: LocalMealLog = {
      id: `meal-${Date.now()}`,
      date: today,
      mealType: "lunch",
      name: staple.name,
      calories: staple.calories,
      proteinG: staple.protein,
      carbG: staple.carbs,
      fatG: staple.fat,
      isQuickDial: false,
      synced: false,
      createdAt: new Date().toISOString(),
    };

    await db.mealLogs.put(newEntry);
    await loadMeals();
  };

  // Add template directly
  const handleAddTemplate = async (tmpl: (typeof MEAL_TEMPLATES)[0]) => {
    const newEntry: LocalMealLog = {
      id: `meal-${Date.now()}`,
      date: today,
      mealType: tmpl.mealType,
      name: tmpl.name,
      calories: tmpl.calories,
      proteinG: tmpl.protein,
      carbG: tmpl.carbs,
      fatG: tmpl.fat,
      isQuickDial: false,
      synced: false,
      createdAt: new Date().toISOString(),
    };

    await db.mealLogs.put(newEntry);
    await loadMeals();
  };

  // Delete entry
  const handleDeleteMeal = async (id: string) => {
    await db.mealLogs.delete(id);
    await loadMeals();
  };

  const filteredStaples = BULK_STAPLES.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* =========================================================================
          TOP MACRO HEADER SUMMARY
          ========================================================================= */}
      <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <span className="text-xs font-mono uppercase tracking-wider text-brand-cyan">
              Zero-Friction Nutrition Engine
            </span>
            <h2 className="text-xl font-bold text-white">Daily Calorie & Macro Target</h2>
          </div>
          <div className="text-right">
            <span className="text-xs font-mono text-gray-400">Calories Remaining</span>
            <div className="text-2xl font-black font-mono text-brand-cyan">
              {Math.max(0, targetCalories - totalCalories)} kcal
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-3 w-full rounded-full bg-surface-elevated overflow-hidden mb-4">
          <div
            className="h-full bg-gradient-to-r from-brand-cyan to-brand-emerald transition-all duration-500"
            style={{ width: `${Math.min(100, (totalCalories / targetCalories) * 100)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-2xl bg-surface-elevated border border-surface-border/50">
            <div className="flex items-center space-x-1.5 text-xs text-gray-400">
              <Flame className="w-3.5 h-3.5 text-brand-cyan" />
              <span>Calories</span>
            </div>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {totalCalories} / {targetCalories}
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-surface-elevated border border-surface-border/50">
            <div className="flex items-center space-x-1.5 text-xs text-gray-400">
              <Beef className="w-3.5 h-3.5 text-brand-emerald" />
              <span>Protein</span>
            </div>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {totalProtein}g / {targetProtein}g
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-surface-elevated border border-surface-border/50">
            <div className="text-xs text-gray-400">Carbohydrates</div>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {totalCarbs}g / {profile?.targetCarbG || 390}g
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-surface-elevated border border-surface-border/50">
            <div className="text-xs text-gray-400">Healthy Fats</div>
            <div className="text-sm font-bold font-mono text-white mt-1">
              {totalFat}g / {profile?.targetFatG || 81}g
            </div>
          </div>
        </div>
      </div>

      {/* =========================================================================
          INPUT METHOD TABS
          ========================================================================= */}
      <div className="flex rounded-2xl bg-surface p-1.5 border border-surface-border">
        <button
          onClick={() => setActiveTab("quick_dial")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === "quick_dial"
              ? "bg-brand-cyan text-black shadow-md shadow-brand-cyan/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Quick Calorie + Protein Dial</span>
        </button>

        <button
          onClick={() => setActiveTab("staples")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === "staples"
              ? "bg-brand-cyan text-black shadow-md shadow-brand-cyan/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Whole Food Staples</span>
        </button>

        <button
          onClick={() => setActiveTab("templates")}
          className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
            activeTab === "templates"
              ? "bg-brand-cyan text-black shadow-md shadow-brand-cyan/20"
              : "text-gray-400 hover:text-white"
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>Meal Templates</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: QUICK CALORIE + PROTEIN DIAL
          ========================================================================= */}
      {activeTab === "quick_dial" && (
        <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-bold text-white">Log in 3 Seconds</h3>
            <p className="text-xs text-gray-400">
              Already know your numbers? Skip search and log directly.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Calorie Dial */}
            <div className="p-4 rounded-2xl bg-surface-elevated border border-surface-border">
              <span className="text-xs font-mono uppercase text-gray-400">Calories</span>
              <div className="flex items-center justify-between my-2">
                <input
                  type="number"
                  value={quickCalories}
                  onChange={(e) => setQuickCalories(parseInt(e.target.value) || 0)}
                  className="w-full text-3xl font-black font-mono bg-transparent text-brand-cyan focus:outline-none"
                />
                <span className="text-xs font-mono text-gray-400">kcal</span>
              </div>
              <div className="flex space-x-2 mt-3">
                {[+100, +250, +500].map((delta) => (
                  <button
                    key={delta}
                    onClick={() => setQuickCalories((prev) => Math.max(0, prev + delta))}
                    className="flex-1 py-1.5 rounded-xl bg-surface border border-surface-border/70 text-xs font-mono text-gray-300 hover:text-white hover:border-brand-cyan/40 active:scale-95 transition-all"
                  >
                    +{delta}
                  </button>
                ))}
              </div>
            </div>

            {/* Protein Dial */}
            <div className="p-4 rounded-2xl bg-surface-elevated border border-surface-border">
              <span className="text-xs font-mono uppercase text-gray-400">Protein</span>
              <div className="flex items-center justify-between my-2">
                <input
                  type="number"
                  value={quickProtein}
                  onChange={(e) => setQuickProtein(parseInt(e.target.value) || 0)}
                  className="w-full text-3xl font-black font-mono bg-transparent text-brand-emerald focus:outline-none"
                />
                <span className="text-xs font-mono text-gray-400">grams</span>
              </div>
              <div className="flex space-x-2 mt-3">
                {[+10, +25, +40].map((delta) => (
                  <button
                    key={delta}
                    onClick={() => setQuickProtein((prev) => Math.max(0, prev + delta))}
                    className="flex-1 py-1.5 rounded-xl bg-surface border border-surface-border/70 text-xs font-mono text-gray-300 hover:text-white hover:border-brand-emerald/40 active:scale-95 transition-all"
                  >
                    +{delta}g
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Description & Meal Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Quick Label (Optional)</label>
              <input
                type="text"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                placeholder="e.g., Post-Workout Bulk Shake"
                className="w-full px-4 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm text-white focus:outline-none focus:border-brand-cyan"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Meal Slot</label>
              <select
                value={quickMealType}
                onChange={(e) => setQuickMealType(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm text-white focus:outline-none focus:border-brand-cyan"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="post_workout">Post-Workout</option>
                <option value="snack">Snack</option>
              </select>
            </div>
          </div>

          {/* 1-Tap Commit Button */}
          <button
            onClick={handleLogQuickDial}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-brand-cyan to-brand-emerald text-black font-extrabold text-sm flex items-center justify-center space-x-2 shadow-lg shadow-brand-cyan/20 active:scale-95 transition-all"
          >
            <Check className="w-5 h-5 stroke-[2.5]" />
            <span>Log Quick Meal ({quickCalories} kcal • {quickProtein}g Protein)</span>
          </button>
        </div>
      )}

      {/* =========================================================================
          TAB 2: WHOLE FOOD STAPLES
          ========================================================================= */}
      {activeTab === "staples" && (
        <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-3 px-4 py-2.5 rounded-2xl bg-surface-elevated border border-surface-border">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search whole food staples (chicken, rice, oats)..."
              className="w-full bg-transparent text-sm text-white focus:outline-none"
            />
          </div>

          <div className="divide-y divide-surface-border/60">
            {filteredStaples.map((staple) => (
              <div
                key={staple.name}
                className="py-3 flex items-center justify-between hover:bg-surface-elevated/40 px-2 rounded-xl transition-colors"
              >
                <div>
                  <div className="text-sm font-semibold text-white">{staple.name}</div>
                  <div className="text-xs font-mono text-gray-400">
                    {staple.calories} kcal • {staple.protein}g P • {staple.carbs}g C • {staple.fat}g F
                  </div>
                </div>
                <button
                  onClick={() => handleAddStaple(staple)}
                  className="p-2 rounded-xl bg-brand-cyan/15 text-brand-cyan hover:bg-brand-cyan hover:text-black transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: MEAL TEMPLATES
          ========================================================================= */}
      {activeTab === "templates" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {MEAL_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.name}
              className="p-5 rounded-3xl bg-surface border border-surface-border flex flex-col justify-between space-y-4"
            >
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-brand-cyan">
                  {tmpl.mealType.replace("_", " ")}
                </span>
                <h4 className="text-base font-bold text-white mt-1">{tmpl.name}</h4>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">{tmpl.description}</p>
                <div className="mt-3 p-2.5 rounded-xl bg-surface-elevated border border-surface-border/50 text-xs font-mono text-gray-300">
                  <span className="font-bold text-white">{tmpl.calories} kcal</span> • {tmpl.protein}g Pro
                </div>
              </div>

              <button
                onClick={() => handleAddTemplate(tmpl)}
                className="w-full py-2.5 rounded-xl bg-brand-cyan/15 hover:bg-brand-cyan hover:text-black text-brand-cyan font-bold text-xs transition-all flex items-center justify-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Log Template</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* =========================================================================
          TODAY'S LOGGED MEALS TIMELINE
          ========================================================================= */}
      <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2">
          <span>Today's Logged Meals</span>
          <span className="text-xs font-mono text-gray-400 font-normal">
            ({meals.length} entries)
          </span>
        </h3>

        {meals.length === 0 ? (
          <p className="text-xs text-gray-500 py-4 text-center">
            No meals logged today yet. Use the dial above to add your first meal.
          </p>
        ) : (
          <div className="space-y-3">
            {meals.map((meal) => (
              <div
                key={meal.id}
                className="p-4 rounded-2xl bg-surface-elevated border border-surface-border/70 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-mono uppercase px-2 py-0.5 rounded bg-surface text-gray-400">
                      {meal.mealType.replace("_", " ")}
                    </span>
                    <span className="text-sm font-semibold text-white">{meal.name}</span>
                  </div>
                  <div className="text-xs font-mono text-gray-400 mt-1">
                    <span className="text-brand-cyan font-semibold">{meal.calories} kcal</span> •{" "}
                    <span className="text-brand-emerald font-semibold">{meal.proteinG}g Pro</span> •{" "}
                    {meal.carbG}g Carbs • {meal.fatG}g Fat
                  </div>
                </div>

                <button
                  onClick={() => handleDeleteMeal(meal.id)}
                  className="p-2 text-gray-500 hover:text-brand-rose transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
