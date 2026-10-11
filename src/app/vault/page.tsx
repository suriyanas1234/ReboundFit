"use client";

import React, { useState, useEffect, useRef } from "react";
import { db, LocalProgressPhoto } from "@/lib/db";
import {
  Camera,
  Layers,
  Sliders,
  Check,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Calendar,
  Scale,
} from "lucide-react";

export default function PhotoVaultPage() {
  const [photos, setPhotos] = useState<LocalProgressPhoto[]>([]);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [ghostOpacity, setGhostOpacity] = useState<number>(30); // Default 30%
  const [selectedPose, setSelectedPose] = useState<LocalProgressPhoto["pose"]>("front_relaxed");
  const [sliderPosition, setSliderPosition] = useState<number>(50); // Split slider 50%

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadPhotos = async () => {
    const saved = await db.photos.toArray();
    setPhotos(saved);
  };

  useEffect(() => {
    loadPhotos();
  }, []);

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
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 1280;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);

      const newPhoto: LocalProgressPhoto = {
        id: `photo-${Date.now()}`,
        date: new Date().toISOString().split("T")[0],
        weekNumber: 6,
        pose: selectedPose,
        weightLbs: 175.5,
        photoDataUrl: dataUrl,
        synced: false,
      };

      await db.photos.put(newPhoto);
      await loadPhotos();
      stopCamera();
    }
  };

  // Fallback file input change
  const handleFileFallback = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const dataUrl = event.target?.result as string;
        const newPhoto: LocalProgressPhoto = {
          id: `photo-${Date.now()}`,
          date: new Date().toISOString().split("T")[0],
          weekNumber: 6,
          pose: selectedPose,
          weightLbs: 175.5,
          photoDataUrl: dataUrl,
          synced: false,
        };
        await db.photos.put(newPhoto);
        await loadPhotos();
      };
      reader.readAsDataURL(file);
    }
  };

  // Previous photo for ghost overlay
  const previousPhoto = photos.length > 0 ? photos[photos.length - 1] : null;

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
          VIEWFINDER WITH GHOST OVERLAY (Active when camera is triggered)
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

            {/* Ghost Silhouette Overlay (Adjustable Opacity) */}
            <div
              className="absolute inset-0 pointer-events-none flex items-center justify-center transition-opacity"
              style={{ opacity: ghostOpacity / 100 }}
            >
              {previousPhoto ? (
                // Overlay previous photo directly
                <img
                  src={previousPhoto.photoDataUrl}
                  alt="Previous Ghost"
                  className="w-full h-full object-cover filter contrast-125 brightness-110"
                />
              ) : (
                // SVG Guide Silhouette
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

            {/* Alignment HUD Crosshairs */}
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
          SIDE-BY-SIDE PROGRESSION SLIDER (Baseline vs Progress)
          ========================================================================= */}
      <div className="rounded-3xl bg-surface border border-surface-border p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Side-by-Side Comparison</h3>
            <p className="text-xs text-gray-400">
              Week 1 Baseline vs Week 6 Progress (1:1 Frame Matched)
            </p>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono text-brand-emerald bg-brand-emerald/10 px-2.5 py-1 rounded-full border border-brand-emerald/30">
            <Scale className="w-3.5 h-3.5" />
            <span>+3.5 lbs Accretion</span>
          </div>
        </div>

        {/* Interactive Split View Slider Container */}
        <div className="relative aspect-[4/3] sm:aspect-[16/9] w-full rounded-2xl overflow-hidden bg-black border border-surface-border select-none">
          {/* Baseline Image (Underneath) */}
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <div className="text-center p-4">
              <span className="text-xs font-mono text-gray-400 uppercase">Baseline</span>
              <div className="text-lg font-bold text-white">Week 1 (172.0 lbs)</div>
              <p className="text-xs text-gray-500 mt-1">Starting Deltoid & Lat Width</p>
            </div>
          </div>

          {/* Progress Image (Clipped by slider position) */}
          <div
            className="absolute inset-0 bg-gradient-to-r from-zinc-800 to-zinc-900 border-r border-brand-cyan"
            style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
          >
            <div className="h-full flex items-center justify-center">
              <div className="text-center p-4">
                <span className="text-xs font-mono text-brand-cyan uppercase">Current Lean Bulk</span>
                <div className="text-lg font-bold text-white">Week 6 (175.5 lbs)</div>
                <p className="text-xs text-brand-emerald mt-1">+0.35 lbs/wk Sweet Spot</p>
              </div>
            </div>
          </div>

          {/* Draggable Vertical Divider Line */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-brand-cyan cursor-ew-resize flex items-center justify-center"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="w-7 h-7 rounded-full bg-brand-cyan text-black flex items-center justify-center shadow-lg -translate-x-1/2 text-xs font-black">
              ↔
            </div>
          </div>

          {/* Slider Input overlay */}
          <input
            type="range"
            min="0"
            max="100"
            value={sliderPosition}
            onChange={(e) => setSliderPosition(parseInt(e.target.value))}
            className="absolute inset-0 opacity-0 cursor-ew-resize w-full h-full"
          />
        </div>

        {/* Metadata Stamping Footnote */}
        <div className="flex flex-wrap items-center justify-between text-xs text-gray-400 pt-2 border-t border-surface-border/50">
          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1">
              <Calendar className="w-3.5 h-3.5 text-gray-500" />
              <span>Oct 11, 2026</span>
            </span>
            <span className="flex items-center space-x-1">
              <Scale className="w-3.5 h-3.5 text-gray-500" />
              <span>Trend: 175.5 lbs</span>
            </span>
          </div>
          <span className="text-[11px] text-gray-500">
            Silhouette ghost stamped for weekly consistency.
          </span>
        </div>
      </div>
    </div>
  );
}
