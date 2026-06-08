"use client";

import React from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  Link2,
  ArrowRight,
} from "lucide-react";
import type { Insight } from "@/db/schema";

interface InsightsTabProps {
  insights: Insight[];
}

const typeConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string }
> = {
  trend: {
    icon: TrendingUp,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  anomaly: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  recommendation: {
    icon: Lightbulb,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  correlation: {
    icon: Link2,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
  },
};

export function InsightsTab({ insights }: InsightsTabProps) {
  if (!insights || insights.length === 0) {
    return (
      <div className="glass-card p-12 text-center">
        <Sparkles className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No insights generated yet</p>
      </div>
    );
  }

  const highImpact = insights.filter((i) => i.impact === "high");
  const mediumImpact = insights.filter((i) => i.impact === "medium");
  const lowImpact = insights.filter((i) => i.impact === "low");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-5 text-center">
          <p className="text-2xl font-bold text-red-400">{highImpact.length}</p>
          <p className="text-xs text-slate-400 mt-1">High Impact</p>
        </div>
        <div className="glass-card p-5 text-center">
          <p className="text-2xl font-bold text-amber-400">
            {mediumImpact.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Medium Impact</p>
        </div>
        <div className="glass-card p-5 text-center">
          <p className="text-2xl font-bold text-emerald-400">
            {lowImpact.length}
          </p>
          <p className="text-xs text-slate-400 mt-1">Low Impact</p>
        </div>
      </div>

      {/* Insights List */}
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const config = typeConfig[insight.type] || typeConfig.trend;
          const Icon = config.icon;

          return (
            <div
              key={i}
              className="glass-card-hover p-5 animate-slide-up"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center flex-shrink-0`}
                >
                  <Icon className={`w-5 h-5 ${config.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-semibold text-white">
                      {insight.title}
                    </h3>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          insight.impact === "high"
                            ? "bg-red-500/10 text-red-400"
                            : insight.impact === "medium"
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-emerald-500/10 text-emerald-400"
                        }`}
                      >
                        {insight.impact}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-slate-400 capitalize">
                        {insight.type}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-3">
                    {insight.description}
                  </p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                            style={{
                              width: `${insight.confidence * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {(insight.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {insight.action && (
                      <div className="flex items-center gap-1 text-xs text-blue-400 cursor-pointer hover:text-blue-300 transition-colors">
                        <span>{insight.action.slice(0, 50)}{insight.action.length > 50 ? "..." : ""}</span>
                        <ArrowRight className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
