"use client";

import React from "react";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  BarChart3,
  Layers,
  Shield,
  CheckCircle,
  Database,
  Zap,
  Sparkles,
} from "lucide-react";
import type { KPI, DataProfile, Insight, ColumnMeta, CleaningReport } from "@/db/schema";
import { formatNumber } from "@/lib/utils";

interface OverviewTabProps {
  dataset: {
    name: string;
    rowCount: number;
    columnCount: number;
    domain: string;
    domainConfidence: number;
    kpis: KPI[];
    profile: DataProfile;
    insights: Insight[];
    columns: ColumnMeta[];
    cleaningReport: CleaningReport;
  };
}

const iconMap: Record<string, React.ElementType> = {
  dollar: DollarSign,
  chart: BarChart3,
  layers: Layers,
  shield: Shield,
  check: CheckCircle,
  database: Database,
  zap: Zap,
  users: Users,
};

const colorMap: Record<string, string> = {
  blue: "from-blue-500 to-blue-600",
  green: "from-emerald-500 to-emerald-600",
  emerald: "from-emerald-500 to-emerald-600",
  amber: "from-amber-500 to-amber-600",
  purple: "from-purple-500 to-purple-600",
  indigo: "from-indigo-500 to-indigo-600",
  cyan: "from-cyan-500 to-cyan-600",
  red: "from-red-500 to-red-600",
  rose: "from-rose-500 to-rose-600",
};

export function OverviewTab({ dataset }: OverviewTabProps) {
  const { kpis, profile, insights, cleaningReport } = dataset;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => {
          const Icon = iconMap[kpi.icon || "chart"] || BarChart3;
          const gradient = colorMap[kpi.color || "blue"] || colorMap.blue;
          return (
            <div
              key={i}
              className="glass-card-hover p-5 animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center opacity-80`}
                >
                  <Icon className="w-5 h-5 text-white" />
                </div>
                {kpi.change !== undefined && kpi.change !== 0 && (
                  <div
                    className={`flex items-center gap-0.5 text-xs font-medium ${
                      kpi.change > 0
                        ? "text-emerald-400"
                        : "text-red-400"
                    }`}
                  >
                    {kpi.change > 0 ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {Math.abs(kpi.change)}%
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400 mb-1">{kpi.name}</p>
              <p className="text-xl font-bold text-white">
                {typeof kpi.value === "number"
                  ? formatNumber(kpi.value)
                  : kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Quality & Domain Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Data Quality Score */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            Data Quality Score
          </h3>
          <div className="flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="rgba(255,255,255,0.05)"
                  strokeWidth="8"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="url(#qualityGrad)"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(profile.qualityScore / 100) * 251.2} 251.2`}
                />
                <defs>
                  <linearGradient id="qualityGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3b82f6" />
                    <stop offset="100%" stopColor="#8b5cf6" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xl font-bold text-white">
                  {profile.qualityScore.toFixed(0)}
                </span>
              </div>
            </div>
            <div className="space-y-2 flex-1">
              <QualityBar label="Completeness" value={profile.completeness} />
              <QualityBar label="Consistency" value={profile.consistency} />
              <QualityBar label="Uniqueness" value={profile.uniqueness} />
            </div>
          </div>
        </div>

        {/* Cleaning Summary */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            Auto-Cleaning Summary
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Issues Found</span>
              <span className="text-sm font-semibold text-amber-400">
                {cleaningReport?.totalIssues || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Issues Fixed</span>
              <span className="text-sm font-semibold text-emerald-400">
                {cleaningReport?.fixedIssues || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Quality Before</span>
              <span className="text-sm font-semibold text-slate-300">
                {cleaningReport?.qualityBefore || 0}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">Quality After</span>
              <span className="text-sm font-semibold text-emerald-400">
                {cleaningReport?.qualityAfter || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Column Types */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            Column Analysis
          </h3>
          <div className="space-y-2">
            <TypeBadge label="Numeric" count={profile.numericColumns.length} color="blue" />
            <TypeBadge label="Categorical" count={profile.categoricalColumns.length} color="purple" />
            <TypeBadge label="Date/Time" count={profile.dateColumns.length} color="cyan" />
            <TypeBadge label="Currency" count={profile.currencyColumns.length} color="emerald" />
            <TypeBadge label="Location" count={profile.locationColumns.length} color="amber" />
            <TypeBadge label="Status" count={profile.statusColumns.length} color="rose" />
          </div>
        </div>
      </div>

      {/* Top Insights */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          Top AI Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.slice(0, 4).map((insight, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-purple-500/20 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                    insight.impact === "high"
                      ? "bg-red-400"
                      : insight.impact === "medium"
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                />
                <div>
                  <h4 className="text-sm font-medium text-white mb-1">
                    {insight.title}
                  </h4>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {insight.description}
                  </p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[10px] text-slate-500">
                      Confidence: {(insight.confidence * 100).toFixed(0)}%
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        insight.impact === "high"
                          ? "bg-red-500/10 text-red-400"
                          : insight.impact === "medium"
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {insight.impact} impact
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function QualityBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-slate-400">{label}</span>
        <span className="text-slate-300">{value.toFixed(1)}%</span>
      </div>
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-700"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function TypeBadge({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  if (count === 0) return null;
  const colors: Record<string, string> = {
    blue: "bg-blue-500/10 text-blue-400",
    purple: "bg-purple-500/10 text-purple-400",
    cyan: "bg-cyan-500/10 text-cyan-400",
    emerald: "bg-emerald-500/10 text-emerald-400",
    amber: "bg-amber-500/10 text-amber-400",
    rose: "bg-rose-500/10 text-rose-400",
  };
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-400">{label}</span>
      <span
        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          colors[color] || colors.blue
        }`}
      >
        {count}
      </span>
    </div>
  );
}


