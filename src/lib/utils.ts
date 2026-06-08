import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(1) + "B";
  if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(1) + "M";
  if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + "K";
  return num.toFixed(num % 1 === 0 ? 0 : 2);
}

export function formatPercent(num: number): string {
  return (num * 100).toFixed(1) + "%";
}

export function getQualityColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

export function getQualityBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/20";
  if (score >= 60) return "bg-amber-500/20";
  return "bg-red-500/20";
}
