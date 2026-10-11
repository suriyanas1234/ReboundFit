"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { db, LocalProgressPhoto } from "@/lib/db";
import {
  Camera,
  Layers,
  Sparkles,
  RefreshCw,
  Calendar,
  Scale,
  Image as ImageIcon,
} from "lucide-react";

export default function PhotoVaultPage() {
  const { user, profile } = useAuth();
  const [photos, setPhotos] = useState<LocalProgressPhoto[]>([]);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [ghostOpacity, setGhostOpacity] = useState<number>(30); // Default 30%
  const [selectedPose, setSelectedPose] = useState<LocalProgressPhoto["pose"]>("front_relaxed");
  const [sliderPosition, setSliderPosition] = useState<number>(50);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPhotos = async () => {
    if (!user) return;
    const saved = await db.photos.where("userId").equals(user.id).toArray();
    setPhotos(saved.sort((a, b) => a.date.localeCompare(b.date)));
  };

  useEffect(() => {
    loadPhotos();
  }, [user]);

  // Initialize HTML5 getUserMedia Camera
  const startCamera = async () => {
    setIsCameraActive(true);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1080 },
            height: { ideal: 1920 },
          },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }
    } catch (err) {
      console.warn("Direct camera feed restricted, activating file picker fallback:", err);
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  // Capture Photo from Video Stream
  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current || !user) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      const isFirst = photos.length === 0;
      const newPhoto: LocalProgressPhoto = {
        id: `photo-${user.id}-${Date.now()}`,
        userId: user.id,
        date: new Date().toISOString().split("T")[0],
        weekNumber: Math.max(1, Math.ceil(photos.length / 2) + 1),
        pose: selectedPose,
        weightLbs: profile?.currentWeightLbs || 0,
        photoDataUrl: dataUrl,
        isBaseline: isFirst,
        synced: false,
      };

      await db.photos.put(newPhoto);
      await loadPhotos();
      stopCamera();
    }
  };

  // Fallback file input change
  const handleFileFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const isFirst = photos.length === 0;
        const newPhoto: LocalProgressPhoto = {
          id: `photo-${user.id}-${Date.now()}`,
          userId: user.id,
          date: new Date().toISOString().split("T")[0],
          weekNumber: Math.max(1, Math.ceil(photos.length / 2) + 1),
          pose: selectedPose,
          weightLbs: profile?.currentWeightLbs || 0,
          photoDataUrl: dataUrl,
          isBaseline: isFirst,
          synced: false,
        };
        await db.photos.put(newPhoto);
        await loadPhotos();
      };
      reader.readAsDataURL(file);
    }
  };

  // Reference baseline and latest photo for comparison slider
  const baselinePhoto = photos.find((p) => p.isBaseline) || photos[0] || null;
  const latestPhoto = photos.length > 1 ? photos[photos.length - 1] : null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Hidden canvas & fallback file input */}
      <canvas ref={canvasRef} className="hidden" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileFallback}
      />

      {/* Header */}
      <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-brand-emerald">
            Standardized Photo Vault
          </span>
          <h2 className="text-xl font-bold text-white">Ghost Silhouette Alignment</h2>
          <p className="text-xs text-gray-400 mt-1">
            Match silhouette, phone distance, and lighting for 1:1 side-by-side progression.
          </p>
        </div>

        {!isCameraActive ? (
          <button
            onClick={startCamera}
            className="flex items-center justify-center space-x-2 px-5 py-3 rounded-2xl bg-gradient-to-r from-brand-emerald to-brand-cyan text-black font-extrabold text-sm shadow-lg shadow-brand-emerald/20 active:scale-95 transition-all"
          >
            <Camera className="w-5 h-5 stroke-[2.5]" />
            <span>Open Viewfinder</span>
          </button>
        ) : (
          <button
            onClick={stopCamera}
            className="px-4 py-2 rounded-xl bg-surface-elevated text-xs font-semibold text-gray-400 hover:text-white"
          >
            Close Camera
          </button>
        )}
      </div>

      {/* =========================================================================
          VIEWFINDER WITH GHOST OVERLAY
          ========================================================================= */}
      {isCameraActive && (
        <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-2xl relative overflow-hidden space-y-4">
          <div className="relative aspect-[3/4] max-w-sm mx-auto rounded-2xl overflow-hidden bg-black border border-surface-border flex items-center justify-center">
            {/* Live Camera Feed */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />

            {/* Ghost Silhouette Overlay */}
            <div
              className="absolute inset-0 pointer-events-none flex items-center justify-center transition-opacity"
              style={{ opacity: ghostOpacity / 100 }}
            >
              {baselinePhoto ? (
                <img
                  src={baselinePhoto.photoDataUrl}
                  alt="Baseline Ghost"
                  className="w-full h-full object-cover filter contrast-125 brightness-110"
                />
              ) : (
                <svg
                  viewBox="0 0 200 300"
                  className="w-4/5 h-4/5 text-brand-cyan/80 stroke-current fill-none stroke-[2]"
                >
                  <circle cx="100" cy="50" r="22" strokeDasharray="4 4" />
                  <path d="M 60 90 L 140 90 L 125 180 L 75 180 Z" strokeDasharray="4 4" />
                  <line x1="100" y1="180" x2="85" y2="280" strokeDasharray="4 4" />
                  <line x1="100" y1="180" x2="115" y2="280" strokeDasharray="4 4" />
                  <line x1="60" y1="90" x2="45" y2="170" strokeDasharray="4 4" />
                  <line x1="140" y1="90" x2="155" y2="170" strokeDasharray="4 4" />
                </svg>
              )}
            </div>

            {/* HUD Status */}
            <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4">
              <div className="flex justify-between text-[10px] font-mono text-brand-cyan bg-black/40 px-2 py-1 rounded backdrop-blur-sm self-center">
                <span>GHOST ALIGNMENT: {ghostOpacity}% OPACITY</span>
              </div>
            </div>
          </div>

          {/* Opacity Slider Control */}
          <div className="max-w-sm mx-auto space-y-2">
            <div className="flex justify-between text-xs text-gray-400 font-mono">
              <span className="flex items-center space-x-1">
                <Layers className="w-3.5 h-3.5 text-brand-cyan" />
                <span>Ghost Opacity</span>
              </span>
              <span>{ghostOpacity}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={ghostOpacity}
              onChange={(e) => setGhostOpacity(parseInt(e.target.value))}
              className="w-full accent-brand-cyan"
            />
          </div>

          {/* Shutter Button & Fallback Trigger */}
          <div className="flex items-center justify-center space-x-4 pt-2">
            <button
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-brand-cyan shadow-xl shadow-brand-cyan/40 flex items-center justify-center active:scale-90 transition-transform"
            >
              <div className="w-10 h-10 rounded-full bg-brand-cyan" />
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 rounded-2xl bg-surface-elevated border border-surface-border text-gray-400 hover:text-white"
              title="Upload photo directly"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          SIDE-BY-SIDE PROGRESSION SLIDER (CLEAN EMPTY STATE)
          ========================================================================= */}
      <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Side-by-Side Comparison</h3>
            <p className="text-xs text-gray-400">
              Interactive split slider comparing Baseline vs Latest Check-in
            </p>
          </div>
        </div>

        {baselinePhoto && latestPhoto ? (
          <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full rounded-2xl overflow-hidden bg-black border border-surface-border select-none">
            {/* Baseline Image */}
            <div className="absolute inset-0 flex items-center justify-center bg-black">
              <img
                src={baselinePhoto.photoDataUrl}
                alt="Baseline"
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-mono text-white">
                Baseline ({baselinePhoto.date}) • {baselinePhoto.weightLbs} lbs
              </div>
            </div>

            {/* Latest Progress Image (Clipped) */}
            <div
              className="absolute inset-0 bg-black border-r-2 border-brand-cyan"
              style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
            >
              <img
                src={latestPhoto.photoDataUrl}
                alt="Latest"
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-xl text-xs font-mono text-brand-cyan">
                Latest ({latestPhoto.date}) • {latestPhoto.weightLbs} lbs
              </div>
            </div>

            {/* Draggable Divider Line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-brand-cyan cursor-ew-resize flex items-center justify-center"
              style={{ left: `${sliderPosition}%` }}
            >
              <div className="w-7 h-7 rounded-full bg-brand-cyan text-black flex items-center justify-center shadow-lg -translate-x-1/2 text-xs font-black">
                ↔
              </div>
            </div>

            <input
              type="range"
              min="0"
              max="100"
              value={sliderPosition}
              onChange={(e) => setSliderPosition(parseInt(e.target.value))}
              className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
            />
          </div>
        ) : (
          <div className="p-8 rounded-2xl bg-surface-elevated/40 border border-dashed border-surface-border text-center space-y-2">
            <ImageIcon className="w-8 h-8 text-gray-500 mx-auto mb-1" />
            <h4 className="text-sm font-bold text-white">Comparison Unlocked at 2 Photos</h4>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              {baselinePhoto
                ? "1 baseline photo saved. Take your next weekly check-in photo using the viewfinder above to unlock the side-by-side comparison slider."
                : "No progress photos saved yet. Open the viewfinder above to capture your starting Day 1 physique photo."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
