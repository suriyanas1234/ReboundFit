"use client";

import React, { useState } from "react";
import { useAuth, OnboardingFormValues } from "@/context/AuthContext";
import {
  Scale,
  Target,
  Dumbbell,
  Camera,
  ArrowRight,
  ArrowLeft,
  Check,
  Upload,
  Sparkles,
  Info,
} from "lucide-react";

export function OnboardingWizard() {
  const { user, completeOnboarding } = useAuth();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Form State
  const [formData, setFormData] = useState<OnboardingFormValues>({
    weight: 175,
    weightUnit: "lbs",
    height: 178,
    heightUnit: "ft_in",
    heightFeet: 5,
    heightInches: 10,
    age: 26,
    gender: "male",
    primaryGoal: "lean_bulk",
    gainRateTier: "moderate",
    targetGainRateLbsPerWeek: 0.50,
    activityLevel: "moderate",
    trainingSplit: "ppl",
    baselinePhotoDataUrl: undefined,
  });

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Step 1 Validation
  const isStep1Valid = formData.weight > 60 && formData.weight < 600 && formData.age >= 14 && formData.age <= 100;

  // Handle Photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setPhotoPreview(url);
        setFormData((prev) => ({ ...prev, baselinePhotoDataUrl: url }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const handleFinish = async () => {
    setIsSubmitting(true);
    try {
      await completeOnboarding(formData);
    } catch (err) {
      console.error("Onboarding submission error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-white selection:bg-brand-cyan/20 selection:text-brand-cyan relative overflow-hidden py-12">
      {/* Background glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-brand-cyan/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl relative z-10 space-y-6">
        {/* Header & Step Indicator */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-wider text-brand-cyan">
                Setup Wizard • Step {currentStep} of 4
              </span>
              <h1 className="text-2xl font-black text-white">
                {currentStep === 1 && "Physical Baseline"}
                {currentStep === 2 && "Goal & Rate of Gain"}
                {currentStep === 3 && "Training Routine"}
                {currentStep === 4 && "Baseline Reference Photo"}
              </h1>
            </div>
            <span className="text-xs font-mono text-gray-500">
              {user?.name ? `Hi, ${user.name}` : ""}
            </span>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  step <= currentStep
                    ? "bg-gradient-to-r from-brand-cyan to-brand-emerald"
                    : "bg-surface-elevated"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Step Card Content */}
        <div className="p-8 rounded-3xl bg-surface border border-surface-border shadow-2xl space-y-6">
          {/* =========================================================================
              STEP 1: PHYSICAL BASELINE
              ========================================================================= */}
          {currentStep === 1 && (
            <div className="space-y-6 animate-fade-in">
              <p className="text-xs text-gray-400">
                Used to compute your base metabolic rate via the Mifflin-St Jeor equation.
              </p>

              {/* Weight with Unit Toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-300">Current Body Weight</label>
                  <div className="flex rounded-lg bg-surface-elevated p-0.5 border border-surface-border text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, weightUnit: "lbs" })}
                      className={`px-2.5 py-1 rounded transition-all ${
                        formData.weightUnit === "lbs" ? "bg-brand-cyan text-black font-bold" : "text-gray-400"
                      }`}
                    >
                      LBS
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, weightUnit: "kg" })}
                      className={`px-2.5 py-1 rounded transition-all ${
                        formData.weightUnit === "kg" ? "bg-brand-cyan text-black font-bold" : "text-gray-400"
                      }`}
                    >
                      KG
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-3 rounded-xl bg-surface-elevated border border-surface-border text-lg font-bold font-mono text-white focus:outline-none focus:border-brand-cyan"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-500 uppercase">
                    {formData.weightUnit}
                  </span>
                </div>
              </div>

              {/* Height with ft/in or cm toggle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-300">Height</label>
                  <div className="flex rounded-lg bg-surface-elevated p-0.5 border border-surface-border text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, heightUnit: "ft_in" })}
                      className={`px-2.5 py-1 rounded transition-all ${
                        formData.heightUnit === "ft_in" ? "bg-brand-cyan text-black font-bold" : "text-gray-400"
                      }`}
                    >
                      FT / IN
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, heightUnit: "cm" })}
                      className={`px-2.5 py-1 rounded transition-all ${
                        formData.heightUnit === "cm" ? "bg-brand-cyan text-black font-bold" : "text-gray-400"
                      }`}
                    >
                      CM
                    </button>
                  </div>
                </div>

                {formData.heightUnit === "ft_in" ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <input
                        type="number"
                        min="3"
                        max="7"
                        value={formData.heightFeet}
                        onChange={(e) => setFormData({ ...formData, heightFeet: parseInt(e.target.value) || 5 })}
                        className="w-full px-4 py-3 rounded-xl bg-surface-elevated border border-surface-border text-base font-bold font-mono text-white focus:outline-none focus:border-brand-cyan"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-500">
                        feet
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="11"
                        value={formData.heightInches}
                        onChange={(e) => setFormData({ ...formData, heightInches: parseInt(e.target.value) || 0 })}
                        className="w-full px-4 py-3 rounded-xl bg-surface-elevated border border-surface-border text-base font-bold font-mono text-white focus:outline-none focus:border-brand-cyan"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-500">
                        inches
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="number"
                      value={formData.height}
                      onChange={(e) => setFormData({ ...formData, height: parseFloat(e.target.value) || 178 })}
                      className="w-full px-4 py-3 rounded-xl bg-surface-elevated border border-surface-border text-lg font-bold font-mono text-white focus:outline-none focus:border-brand-cyan"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-gray-500">
                      cm
                    </span>
                  </div>
                )}
              </div>

              {/* Age and Biological Sex */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-2 block">Age (Years)</label>
                  <input
                    type="number"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: parseInt(e.target.value) || 26 })}
                    className="w-full px-4 py-3 rounded-xl bg-surface-elevated border border-surface-border text-base font-bold font-mono text-white focus:outline-none focus:border-brand-cyan"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-2 block">Biological Sex</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: "male" })}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formData.gender === "male"
                          ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan"
                          : "bg-surface-elevated border-surface-border text-gray-400"
                      }`}
                    >
                      Male
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, gender: "female" })}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formData.gender === "female"
                          ? "bg-brand-cyan/20 border-brand-cyan text-brand-cyan"
                          : "bg-surface-elevated border-surface-border text-gray-400"
                      }`}
                    >
                      Female
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* =========================================================================
              STEP 2: GOAL & TARGET RATE OF GAIN
              ========================================================================= */}
          {currentStep === 2 && (
            <div className="space-y-6 animate-fade-in">
              {/* Primary Goal Selector */}
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-2 block">Primary Focus</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        primaryGoal: "lean_bulk",
                        targetGainRateLbsPerWeek: 0.50,
                        gainRateTier: "moderate",
                      })
                    }
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      formData.primaryGoal === "lean_bulk"
                        ? "bg-brand-cyan/15 border-brand-cyan text-white shadow-md shadow-brand-cyan/10"
                        : "bg-surface-elevated border-surface-border text-gray-400"
                    }`}
                  >
                    <div className="text-sm font-bold text-white">Lean Bulk (Hypertrophy)</div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Caloric surplus prioritized for muscle accretion with minimal fat.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        primaryGoal: "recomp",
                        targetGainRateLbsPerWeek: 0.0,
                        gainRateTier: "maintain",
                      })
                    }
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      formData.primaryGoal === "recomp"
                        ? "bg-brand-cyan/15 border-brand-cyan text-white shadow-md shadow-brand-cyan/10"
                        : "bg-surface-elevated border-surface-border text-gray-400"
                    }`}
                  >
                    <div className="text-sm font-bold text-white">Recomposition / Maintain</div>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Maintenance calories to shed fat and gain muscle simultaneously.
                    </p>
                  </button>
                </div>
              </div>

              {/* Target Rate of Gain Options (if lean bulk) */}
              {formData.primaryGoal === "lean_bulk" && (
                <div>
                  <label className="text-xs font-semibold text-gray-300 mb-2 block">
                    Target Rate of Gain
                  </label>
                  <div className="space-y-2">
                    {[
                      {
                        tier: "conservative",
                        rate: 0.25,
                        label: "Conservative (+0.25 lbs / week)",
                        desc: "Best for advanced lifters seeking near-zero fat gain (+125 kcal surplus).",
                      },
                      {
                        tier: "moderate",
                        rate: 0.50,
                        label: "Moderate (+0.50 lbs / week) • Recommended",
                        desc: "Optimal hypertrophy pace for intermediate lifters (+250 kcal surplus).",
                      },
                      {
                        tier: "aggressive",
                        rate: 0.75,
                        label: "Aggressive (+0.75 lbs / week)",
                        desc: "Fastest recovery and glycogen saturation for hardgainers (+375 kcal surplus).",
                      },
                    ].map((opt) => (
                      <button
                        key={opt.tier}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            gainRateTier: opt.tier as any,
                            targetGainRateLbsPerWeek: opt.rate,
                          })
                        }
                        className={`w-full p-3.5 rounded-2xl border text-left transition-all ${
                          formData.gainRateTier === opt.tier
                            ? "bg-brand-emerald/15 border-brand-emerald text-white"
                            : "bg-surface-elevated border-surface-border text-gray-400 hover:text-white"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-white">{opt.label}</span>
                          {formData.gainRateTier === opt.tier && (
                            <Check className="w-4 h-4 text-brand-emerald" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 mt-0.5">{opt.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Activity Level */}
              <div>
                <label className="text-xs font-semibold text-gray-300 mb-2 block">
                  Weekly Activity Level
                </label>
                <select
                  value={formData.activityLevel}
                  onChange={(e) => setFormData({ ...formData, activityLevel: e.target.value as any })}
                  className="w-full px-4 py-3 rounded-xl bg-surface-elevated border border-surface-border text-sm text-white focus:outline-none focus:border-brand-cyan"
                >
                  <option value="sedentary">Sedentary (Desk job, little intentional exercise)</option>
                  <option value="light">Lightly Active (1–3 training days per week)</option>
                  <option value="moderate">Moderately Active (3–5 lifting days per week)</option>
                  <option value="very_active">Very Active (6–7 intense training days per week)</option>
                </select>
              </div>
            </div>
          )}

          {/* =========================================================================
              STEP 3: TRAINING SPLIT SELECTION
              ========================================================================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-xs text-gray-400">
                Select your preferred training split to scaffold your blank workout logger.
              </p>

              <div className="space-y-3">
                {[
                  {
                    id: "ppl",
                    title: "Push / Pull / Legs (3–6 Days)",
                    desc: "Optimal frequency for upper/lower hypertrophy split. Compound lifts prioritized.",
                  },
                  {
                    id: "upper_lower",
                    title: "Upper / Lower (4 Days)",
                    desc: "High recovery split ideal for full-body progression and joint longevity.",
                  },
                  {
                    id: "full_body",
                    title: "Full Body (3 Days)",
                    desc: "High training efficiency per session. Great for busy schedules.",
                  },
                  {
                    id: "custom",
                    title: "Custom / Blank Slate",
                    desc: "Start with an empty routine and add exercises manually during your workout.",
                  },
                ].map((split) => (
                  <button
                    key={split.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, trainingSplit: split.id as any })}
                    className={`w-full p-4 rounded-2xl border text-left transition-all ${
                      formData.trainingSplit === split.id
                        ? "bg-brand-cyan/15 border-brand-cyan text-white shadow-md shadow-brand-cyan/10"
                        : "bg-surface-elevated border-surface-border text-gray-400 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">{split.title}</span>
                      {formData.trainingSplit === split.id && (
                        <Check className="w-4 h-4 text-brand-cyan" />
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{split.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* =========================================================================
              STEP 4: BASELINE REFERENCE PHOTO (OPTIONAL)
              ========================================================================= */}
          {currentStep === 4 && (
            <div className="space-y-6 animate-fade-in">
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-white">Upload Baseline Physique Photo</h3>
                <p className="text-xs text-gray-400">
                  Used as the ghost alignment overlay and baseline anchor in the Photo Vault.
                </p>
              </div>

              {photoPreview ? (
                <div className="relative aspect-[3/4] max-w-xs mx-auto rounded-2xl overflow-hidden border border-brand-cyan/40 shadow-xl">
                  <img src={photoPreview} alt="Baseline Preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => {
                      setPhotoPreview(null);
                      setFormData({ ...formData, baselinePhotoDataUrl: undefined });
                    }}
                    className="absolute top-3 right-3 px-3 py-1 bg-black/70 backdrop-blur-md rounded-xl text-xs text-gray-300 hover:text-white"
                  >
                    Change Photo
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-surface-border hover:border-brand-cyan/50 rounded-3xl cursor-pointer bg-surface-elevated/40 transition-colors">
                  <div className="p-4 rounded-2xl bg-brand-cyan/15 text-brand-cyan mb-3">
                    <Camera className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-bold text-white">Select Baseline Photo</span>
                  <span className="text-xs text-gray-400 mt-1">Upload from camera roll or file</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                  />
                </label>
              )}

              <p className="text-[11px] text-gray-500 text-center">
                Optional: You can always snap or upload your baseline photo later in the Vault.
              </p>
            </div>
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-4 border-t border-surface-border">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-gray-400 hover:text-white flex items-center space-x-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={handleNext}
              disabled={!isStep1Valid || isSubmitting}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-brand-cyan to-brand-emerald text-black font-extrabold text-xs flex items-center space-x-2 shadow-lg shadow-brand-cyan/20 active:scale-95 disabled:opacity-50 transition-all"
            >
              <span>
                {currentStep === 4
                  ? isSubmitting
                    ? "Initializing App..."
                    : "Launch ReboundFit"
                  : "Next Step"}
              </span>
              <ArrowRight className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
