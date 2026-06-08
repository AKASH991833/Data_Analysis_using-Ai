"use client";

import React from "react";
import { Shield, Wrench, CheckCircle, AlertTriangle } from "lucide-react";
import type { CleaningReport } from "@/db/schema";

interface CleaningTabProps {
  report: CleaningReport;
}

export function CleaningTab({ report }: CleaningTabProps) {
  if (!report) {
    return (
      <div className="glass-card p-12 text-center">
        <Shield className="w-12 h-12 text-slate-600 mx-auto mb-3" />
        <p className="text-slate-400">No cleaning report available</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Score Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="glass-card p-5 text-center">
          <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto mb-2" />
          <p className="text-xs text-slate-400 mb-1">Issues Found</p>
          <p className="text-2xl font-bold text-amber-400">
            {report.totalIssues}
          </p>
        </div>
        <div className="glass-card p-5 text-center">
          <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
          <p className="text-xs text-slate-400 mb-1">Issues Fixed</p>
          <p className="text-2xl font-bold text-emerald-400">
            {report.fixedIssues}
          </p>
        </div>
        <div className="glass-card p-5 text-center">
          <p className="text-xs text-slate-400 mb-1">Quality Before</p>
          <p className="text-2xl font-bold text-red-400">
            {report.qualityBefore}%
          </p>
          <div className="h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full"
              style={{ width: `${report.qualityBefore}%` }}
            />
          </div>
        </div>
        <div className="glass-card p-5 text-center">
          <p className="text-xs text-slate-400 mb-1">Quality After</p>
          <p className="text-2xl font-bold text-emerald-400">
            {report.qualityAfter}%
          </p>
          <div className="h-1.5 bg-white/5 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-full"
              style={{ width: `${report.qualityAfter}%` }}
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Wrench className="w-4 h-4 text-blue-400" />
          Cleaning Actions
        </h3>

        {report.actions.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm text-slate-300 font-medium">
              No cleaning issues detected!
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Your data is already clean and ready for analysis.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {report.actions.map((action, i) => (
              <div
                key={i}
                className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/5 hover:border-blue-500/20 transition-all animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <Wrench className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-mono text-purple-400">
                      {action.column}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">
                      {action.issue}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">{action.action}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-semibold text-white">
                    {action.affected}
                  </p>
                  <p className="text-[10px] text-slate-500">affected</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
