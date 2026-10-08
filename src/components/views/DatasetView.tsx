"use client";

import React, { useEffect, useState } from "react";
import type { ViewType } from "../PlatformShell";
import {
  Loader2,
  ArrowLeft,
  Database,
  Globe,
  Shield,
  Sparkles,
  MessageSquare,
  Table2,
  Columns3,
  LayoutDashboard,
  PanelRight,
  Grid3x3,
} from "lucide-react";
import { OverviewTab } from "../tabs/OverviewTab";
import { ProfileTab } from "../tabs/ProfileTab";
import { CleaningTab } from "../tabs/CleaningTab";
import { InsightsTab } from "../tabs/InsightsTab";
import { NLQueryTab } from "../tabs/NLQueryTab";
import { DataTableTab } from "../tabs/DataTableTab";
import { DashboardTab } from "../tabs/DashboardTab";
import { PivotTab } from "../tabs/PivotTab";
import type {
  ColumnMeta,
  DataProfile,
  CleaningReport,
  KPI,
  Insight,
} from "@/db/schema";

interface DatasetViewProps {
  datasetId: string;
  onNavigate: (view: ViewType) => void;
}

interface DatasetMeta {
  id: string;
  name: string;
  fileName: string;
  fileType: string;
  rowCount: number;
  columnCount: number;
  domain: string;
  domainConfidence: number;
  status: string;
  columns: ColumnMeta[];
  profile: DataProfile;
  cleaningReport: CleaningReport;
  kpis: KPI[];
  insights: Insight[];
  createdAt: string;
}

type TabType =
  | "overview"
  | "dashboard"
  | "pivot"
  | "profile"
  | "cleaning"
  | "insights"
  | "query"
  | "data";

const tabs: { key: TabType; label: string; icon: React.ElementType }[] = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "dashboard", label: "Dashboard", icon: PanelRight },
  { key: "pivot", label: "Pivot", icon: Grid3x3 },
  { key: "profile", label: "Profile", icon: Columns3 },
  { key: "cleaning", label: "Cleaning", icon: Shield },
  { key: "insights", label: "Insights", icon: Sparkles },
  { key: "query", label: "Ask AI", icon: MessageSquare },
  { key: "data", label: "Data", icon: Table2 },
];

export function DatasetView({ datasetId, onNavigate }: DatasetViewProps) {
  const [dataset, setDataset] = useState<DatasetMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  useEffect(() => {
    fetch(`/api/datasets/${datasetId}`)
      .then((r) => r.json())
      .then((data) => setDataset(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [datasetId]);

  if (loading || !dataset) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-40 glass-card border-b border-white/5 px-6 py-4" style={{ borderRadius: 0 }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <button
              onClick={() => onNavigate("datasets")}
              className="p-2 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2 break-all">
                <Database className="w-4 h-4 text-blue-400" />
                {dataset.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 md:gap-3 mt-0.5 text-xs text-slate-400">
                <span>{(dataset.rowCount || 0).toLocaleString()} rows</span>
                <span>•</span>
                <span>{dataset.columnCount} columns</span>
                <span>•</span>
                <span className="uppercase">{dataset.fileType}</span>
                {dataset.domain && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 text-purple-400">
                      <Globe className="w-3 h-3" />
                      {dataset.domain}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
              ✓ Analyzed
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mt-4 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6 animate-fade-in" key={activeTab}>
        {activeTab === "overview" && (
          <OverviewTab dataset={dataset} />
        )}
        {activeTab === "dashboard" && (
          <DashboardTab datasetId={dataset.id} />
        )}
        {activeTab === "pivot" && (
          <PivotTab datasetId={dataset.id} columns={dataset.columns} />
        )}
        {activeTab === "profile" && (
          <ProfileTab columns={dataset.columns} profile={dataset.profile} />
        )}
        {activeTab === "cleaning" && (
          <CleaningTab report={dataset.cleaningReport} />
        )}
        {activeTab === "insights" && (
          <InsightsTab insights={dataset.insights} />
        )}
        {activeTab === "query" && (
          <NLQueryTab datasetId={dataset.id} />
        )}
        {activeTab === "data" && (
          <DataTableTab
            datasetId={dataset.id}
            columns={dataset.columns}
            totalRows={dataset.rowCount}
          />
        )}
      </div>
    </div>
  );
}
