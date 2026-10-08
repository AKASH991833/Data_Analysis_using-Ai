"use client";

import React, { useMemo } from "react";
import { TrendingUp, TrendingDown, Brain, Zap, AlertTriangle, CheckCircle } from "lucide-react";
import type { KPI, Insight } from "@/db/schema";
import { ExcelChartPro } from "@/components/ExcelChartPro";
import { cn } from "@/lib/utils";

export interface BoardChart {
  type: string; title: string; xKey?: string; yKey?: string; dataKey?: string; filterCol?: string;
  data: Record<string, unknown>[];
}
interface Profile { qualityScore: number; completeness: number; consistency: number; uniqueness: number }
interface Cleaning { totalIssues: number; fixedIssues: number; qualityBefore: number; qualityAfter: number }

export interface ExecutiveBoardProps {
  kpis: KPI[];
  charts: BoardChart[];
  profile: Profile;
  insights: Insight[];
  cleaning?: Cleaning;
  filters: Record<string, string>;
  onPoint: (col: string, val: string) => void;
  plan?: { engine: string; domain?: string };
}

const ACCENTS = ["#5B9BD5", "#ED7D31", "#70AD47", "#FFC000", "#9B57A0", "#4472C4"];

function fmt(v: unknown): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return String(v ?? "-");
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (a >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (a >= 1e4) return (v / 1e3).toFixed(1) + "K";
  if (Number.isInteger(v)) return v.toLocaleString();
  return v.toFixed(a < 10 ? 2 : 1);
}

function Gauge({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 40, c = Math.PI * r;
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 58" className="w-full max-w-[120px]" role="img" aria-label={`${label} ${pct.toFixed(0)} percent`}>
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="9" strokeLinecap="round" />
        <path d="M10 50 A40 40 0 0 1 90 50" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`} />
        <text x="50" y="48" textAnchor="middle" className="fill-white" style={{ fontSize: 17, fontWeight: 700 }}>{pct.toFixed(0)}%</text>
      </svg>
      <span className="text-[10px] text-slate-400 -mt-1">{label}</span>
    </div>
  );
}

function Card({ title, sub, children, className }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass-card p-3 sm:p-4 min-w-0", className)}>
      <header className="flex items-baseline justify-between gap-2 mb-2">
        <h3 className="text-xs font-semibold text-white truncate">{title}</h3>
        {sub && <span className="text-[9px] text-slate-500 shrink-0">{sub}</span>}
      </header>
      {children}
    </section>
  );
}

export function ExecutiveBoard({ kpis, charts, profile, insights, cleaning, filters, onPoint, plan }: ExecutiveBoardProps) {
  const layout = useMemo(() => {
    const used = new Set<number>();
    const take = (pred: (c: BoardChart) => boolean) => {
      const i = charts.findIndex((c, idx) => !used.has(idx) && c.data?.length > 0 && pred(c));
      if (i >= 0) used.add(i);
      return i >= 0 ? charts[i] : null;
    };
    const trend = take((c) => c.type === "line" || c.type === "area");
    const donut = take((c) => c.type === "pie");
    const bar = take((c) => c.type === "hbar" || c.type === "bar");
    const rest = charts.filter((c, i) => !used.has(i) && c.data?.length > 0).slice(0, 6);
    return { trend, donut, bar, rest };
  }, [charts]);

  const tiles = kpis.slice(0, 6);
  const qColor = profile.qualityScore >= 80 ? "#70AD47" : profile.qualityScore >= 60 ? "#FFC000" : "#ED7D31";
  const chartCard = (c: BoardChart, h: number, cls?: string) => (
    <Card key={c.title} title={c.title} sub={c.filterCol ? "click to filter" : undefined} className={cls}>
      <ExcelChartPro chart={c} height={h} onPointClick={onPoint} activeFilters={filters} />
    </Card>
  );

  return (
    <div className="space-y-3 sm:space-y-4" data-testid="executive-board">
      {plan?.engine === "gemini" && (
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <Brain className="w-3 h-3 text-purple-400" />
          <span>AI-composed {plan.domain ? `${plan.domain} ` : ""}dashboard: Gemini chose the KPIs and charts from column names only, all numbers are computed from your data.</span>
        </div>
      )}
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2 sm:gap-3">
        {tiles.map((k, i) => {
          const up = typeof k.change === "number" && k.change > 0;
          const down = typeof k.change === "number" && k.change < 0;
          const accent = ACCENTS[i % ACCENTS.length];
          return (
            <div key={k.name + i} className="relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] p-3 min-w-0"
              style={{ borderTop: `3px solid ${accent}` }}>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 truncate">{k.name}</p>
              <p className="text-xl sm:text-2xl font-bold text-white tabular-nums mt-1 truncate">{fmt(k.value)}</p>
              <div className="mt-1 h-4 flex items-center gap-1 text-[10px]">
                {typeof k.change === "number" && k.change !== 0 ? (
                  <span className={cn("flex items-center gap-0.5 font-semibold", up ? "text-emerald-400" : "text-red-400")}>
                    {up ? <TrendingUp className="w-3 h-3" /> : down ? <TrendingDown className="w-3 h-3" /> : null}
                    {up ? "+" : ""}{k.change}%<span className="text-slate-500 font-normal ml-1">vs prior half</span>
                  </span>
                ) : <span className="text-slate-600">no comparison</span>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Gauges + donut + main bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        <Card title="Data health" sub={`score ${profile.qualityScore.toFixed(0)}/100`} className="lg:col-span-3">
          <div className="grid grid-cols-3 lg:grid-cols-2 gap-2">
            <Gauge label="Quality" value={profile.qualityScore} color={qColor} />
            <Gauge label="Complete" value={profile.completeness} color="#5B9BD5" />
            <Gauge label="Consistent" value={profile.consistency} color="#70AD47" />
            <Gauge label="Unique" value={profile.uniqueness} color="#ED7D31" />
          </div>
        </Card>
        {layout.donut && chartCard(layout.donut, 220, "lg:col-span-3")}
        {layout.bar && chartCard(layout.bar, 220, layout.donut ? "lg:col-span-6" : "lg:col-span-9")}
      </div>

      {/* Trend + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4">
        {layout.trend && chartCard(layout.trend, 240, "lg:col-span-8")}
        <Card title="AI insights" sub="auto-detected" className={layout.trend ? "lg:col-span-4" : "lg:col-span-12"}>
          <div className="space-y-2">
            {insights.slice(0, 4).map((ins, i) => (
              <div key={i} className="flex gap-2 p-2 rounded-lg bg-white/[0.03] border border-white/5">
                <Brain className={cn("w-3.5 h-3.5 mt-0.5 shrink-0", ins.impact === "high" ? "text-red-400" : ins.impact === "medium" ? "text-amber-400" : "text-emerald-400")} />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-white">{ins.title}</p>
                  <p className="text-[10px] text-slate-500 line-clamp-2">{ins.description}</p>
                </div>
              </div>
            ))}
            {insights.length === 0 && <p className="text-[11px] text-slate-500">No insights for the current filter.</p>}
          </div>
        </Card>
      </div>

      {/* More charts + data prep */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
        {layout.rest.map((c) => chartCard(c, 220))}
        {cleaning && (
          <Card title="Data preparation" sub="auto-cleaning">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                <p className="text-lg font-bold text-amber-400 tabular-nums">{cleaning.totalIssues.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">issues found</p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
                <CheckCircle className="w-4 h-4 text-emerald-400 mx-auto" />
                <p className="text-lg font-bold text-emerald-400 tabular-nums">{cleaning.fixedIssues.toLocaleString()}</p>
                <p className="text-[10px] text-slate-500">fixed</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-slate-400">
              <Zap className="w-3 h-3 text-amber-400" /> quality {cleaning.qualityBefore}% to {cleaning.qualityAfter}%
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
