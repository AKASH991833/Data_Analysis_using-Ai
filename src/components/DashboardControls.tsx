"use client";

import React, { useState } from "react";
import { Calendar, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── DATE RANGE FILTER ─────────────────────────────────────

export const PERIODS = [
  { label: "All Time", value: "all" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "This Quarter", value: "quarter" },
  { label: "This Year", value: "year" },
] as const;

interface DateRangeFilterProps {
  value: string;
  onChange: (period: string) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
          value !== "all"
            ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
            : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
        )}
      >
        <Calendar className="w-3.5 h-3.5" />
        {PERIODS.find((p) => p.value === value)?.label || "All Time"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 glass-card p-2 min-w-[160px] animate-fade-in" style={{ borderRadius: 10 }}>
            {PERIODS.map((p) => (
              <button
                key={p.value}
                onClick={() => { onChange(p.value); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                  value === p.value
                    ? "bg-blue-500/15 text-blue-400"
                    : "text-slate-300 hover:bg-white/5"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── AUTO REFRESH ──────────────────────────────────────────

interface AutoRefreshProps {
  interval: number;
  onChange: (sec: number) => void;
}

const REFRESH_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
];

export function AutoRefresh({ interval, onChange }: AutoRefreshProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
          interval > 0
            ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
            : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
        )}
      >
        <RefreshCw className={cn("w-3.5 h-3.5", interval > 0 && "animate-spin")} />
        {interval > 0 ? REFRESH_OPTIONS.find((o) => o.value === interval)?.label : "Auto"}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-40 glass-card p-2 min-w-[120px] animate-fade-in" style={{ borderRadius: 10 }}>
            {REFRESH_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg text-xs transition-colors",
                  interval === o.value
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "text-slate-300 hover:bg-white/5"
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── COMPARISON TOGGLE ─────────────────────────────────────

interface ComparisonToggleProps {
  enabled: boolean;
  onChange: (v: boolean) => void;
}

export function ComparisonToggle({ enabled, onChange }: ComparisonToggleProps) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={cn(
        "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
        enabled
          ? "bg-purple-500/15 text-purple-400 border-purple-500/30"
          : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
      )}
    >
      <Clock className="w-3.5 h-3.5" />
      Compare
    </button>
  );
}
