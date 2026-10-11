import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDateDisplay(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export function formatWeight(lbs: number, unit: "imperial" | "metric" = "imperial"): string {
  if (unit === "metric") {
    return `${(lbs * 0.45359237).toFixed(1)} kg`;
  }
  return `${lbs.toFixed(1)} lbs`;
}
