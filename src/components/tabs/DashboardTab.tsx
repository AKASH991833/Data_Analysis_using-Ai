"use client";

import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { toPng } from "html-to-image";
import {
  TrendingUp, TrendingDown, DollarSign, BarChart3, Layers,
  Shield, Database, Zap, Sparkles, Globe, Activity, Users,
  Brain, Download, Edit3, Save, X, Plus, Layout, Loader2,
  Eye, EyeOff, ChevronRight, ChevronDown, Target, LineChart,
  PieChart, AlertTriangle, CheckCircle, Clock, ArrowUpRight,
  Filter, Gauge, Sigma, Minus,
} from "lucide-react";
import type { KPI, Insight } from "@/db/schema";
import { formatNumber, cn } from "@/lib/utils";
import { ExcelChartPro } from "@/components/ExcelChartPro";
import { FilterChips } from "@/components/FilterChips";
import { ShareButton } from "@/components/ShareButton";
import { DateRangeFilter, AutoRefresh, ComparisonToggle } from "@/components/DashboardControls";
import { useTheme } from "@/components/ThemeProvider";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, Area,
  PieChart as RePie, Pie, Cell, AreaChart,
} from "recharts";

interface DashboardTabProps { datasetId: string }

interface FullDashboardData {
  name: string; domain: string; domainConfidence: number;
  rowCount: number; columnCount: number;
  kpis: KPI[];
  profile: {
    qualityScore: number; completeness: number; consistency: number; uniqueness: number;
    numericColumns: string[]; categoricalColumns: string[]; dateColumns: string[];
    currencyColumns: string[]; locationColumns: string[]; statusColumns: string[];
    relationships: { from: string; to: string; type: string; confidence: number }[];
  };
  insights: Insight[];
  cleaningReport: { totalIssues: number; fixedIssues: number; qualityBefore: number; qualityAfter: number; };
  columnValues?: Record<string, string[]>;
}

interface ChartRec {
  type: string; title: string; xKey?: string; yKey?: string; dataKey?: string; filterCol?: string;
  data: Record<string, unknown>[];
}

type DashView = "overview" | "performance" | "distribution";

const EXCEL_COLORS = ["#4472C4", "#5B9BD5", "#ED7D31", "#70AD47", "#FFC000", "#5B9BD5", "#264478", "#9B57A0"];
const iconMap: Record<string, React.ElementType> = {
  dollar: DollarSign, chart: BarChart3, layers: Layers,
  shield: Shield, database: Database, users: Users, activity: Activity,
};
const colorMap: Record<string, string> = {
  blue: "from-blue-500 to-blue-600", green: "from-emerald-500 to-emerald-600",
  emerald: "from-emerald-500 to-emerald-600", amber: "from-amber-500 to-amber-600",
  purple: "from-purple-500 to-purple-600", indigo: "from-indigo-500 to-indigo-600",
  cyan: "from-cyan-500 to-cyan-600", red: "from-red-500 to-red-600",
};

// ─── ANIMATED COUNTER ───────────────────────────────────────
function AnimatedCounter({ value, suffix = "", decimals = 0, duration = 1200 }: { value: number; suffix?: string; decimals?: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(value * eased);
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [value, duration]);
  return <>{display.toFixed(decimals)}{suffix}</>;
}

// ─── SPARKLINE ──────────────────────────────────────────────
function Sparkline({ data, color = "#4472C4", height = 24 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = data.length * 8;
  const points = data.map((v, i) => `${i * 8 + 4},${height - ((v - min) / range) * (height - 4) - 2}`).join(" ");
  return (
    <svg width={w} height={height} className="w-full">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.6" />
    </svg>
  );
}

// ─── MAIN DASHBOARD ─────────────────────────────────────────
export function DashboardTab({ datasetId }: DashboardTabProps) {
  const [data, setData] = useState<FullDashboardData | null>(null);
  const [charts, setCharts] = useState<ChartRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [datePeriod, setDatePeriod] = useState("all");
  const [refreshInterval, setRefreshInterval] = useState(0);
  const [compareMode, setCompareMode] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [activeView, setActiveView] = useState<DashView>("overview");
  const [chartOrder, setChartOrder] = useState<number[]>([]);
  const [chartSizes, setChartSizes] = useState<Record<number, "1" | "2" | "full">>({});
  const [dashboardId, setDashboardId] = useState<string | null>(null);
  const [savingLayout, setSavingLayout] = useState(false);
  const [showAllKpis, setShowAllKpis] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [baseValues, setBaseValues] = useState<Record<string, string[]>>({});
  const [mountTime] = useState(() => performance.now());
  const [loadTime, setLoadTime] = useState(0);
  const dashRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<FullDashboardData["profile"] | null>(null);
  const { ThemeToggle } = useTheme();

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    Object.entries(filters).slice(0, 4).forEach(([c, v], i) => {
      const sfx = i === 0 ? "" : String(i + 1);
      params.set(`filterCol${sfx}`, c); params.set(`filterVal${sfx}`, v);
    });
    params.set("period", datePeriod);
    const filterQs = params.toString();
    const dsUrl = `/api/datasets/${datasetId}${filterQs ? `?${filterQs}` : ""}`;
    const chUrl = `/api/datasets/${datasetId}/charts${filterQs ? `?${filterQs}` : ""}`;
    const [ds, ch, dashboardsRes] = await Promise.all([
      fetch(dsUrl).then((r) => r.json()),
      fetch(chUrl).then((r) => r.json()),
      fetch(`/api/dashboards?datasetId=${datasetId}`).then((r) => r.json()),
    ]);
    if (ds.profile && !ds.filtered) { profileRef.current = ds.profile; if (ds.columnValues) setBaseValues(ds.columnValues); }
    if (ds.error || !ds.profile) { setLoadError(ds.error || "No profile available"); setLoading(false); return; }
    setLoadError(null);
    setData(ds);
    setCharts(ch);

    const savedDashboards = Array.isArray(dashboardsRes) ? dashboardsRes : [];
    if (savedDashboards.length > 0) {
      const dash = savedDashboards[0];
      setDashboardId(dash.id);
      if (dash.widgets && Array.isArray(dash.widgets)) {
        const order = dash.widgets.map((w: { id: number }) => w.id).filter((id: number) => id < ch.length);
        if (order.length > 0) setChartOrder(order);
        const sizes: Record<number, "1" | "2" | "full"> = {};
        for (const w of dash.widgets) {
          sizes[w.id as number] = w.w >= 3 ? "full" : w.w === 2 ? "2" : "1";
        }
        setChartSizes(sizes);
      }
    } else {
      try {
        const res = await fetch("/api/dashboards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ datasetId, name: ds.name + " Dashboard" }),
        });
        const created = await res.json();
        setDashboardId(created.id);
      } catch {}
    }
    setLastRefresh(new Date());
    setLoadTime(Math.round(performance.now() - mountTime));
    setLoading(false);
  }, [datasetId, filters, datePeriod, mountTime]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => { if (!controller.signal.aborted) void fetchData(); });
    return () => controller.abort();
  }, [fetchData]);

  useEffect(() => {
    if (refreshInterval <= 0) return;
    const id = setInterval(fetchData, refreshInterval * 1000);
    return () => clearInterval(id);
  }, [refreshInterval, fetchData]);

  // Ensure chart order
  const orderedCharts = useMemo(() => {
    if (chartOrder.length === charts.length) return chartOrder.map((i) => charts[i]);
    return charts;
  }, [charts, chartOrder]);

  const saveLayout = useCallback(async () => {
    if (!dashboardId) return;
    setSavingLayout(true);
    try {
      const widgets = orderedCharts.map((ch, i) => ({
        id: i, type: ch.type, title: ch.title,
        config: { xKey: ch.xKey, yKey: ch.yKey, dataKey: ch.dataKey },
        x: 0, y: i * 2, w: chartSizes[i] === "full" ? 4 : chartSizes[i] === "2" ? 2 : 1, h: 2,
      }));
      await fetch(`/api/dashboards/${dashboardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widgets, layout: { chartOrder, chartSizes } }),
      });
    } catch {}
    setSavingLayout(false);
    setEditMode(false);
  }, [dashboardId, orderedCharts, chartOrder, chartSizes]);

  const moveChart = useCallback((from: number, to: number) => {
    setChartOrder((prev) => {
      const arr = prev.length === charts.length ? [...prev] : charts.map((_, i) => i);
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }, [charts]);

  const toggleChartSize = useCallback((idx: number) => {
    setChartSizes((prev) => {
      const current = prev[idx] || "1";
      const next = current === "1" ? "2" : current === "2" ? "full" : "1";
      return { ...prev, [idx]: next };
    });
  }, []);

  const removeChart = useCallback((idx: number) => {
    setCharts((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const onPoint = useCallback((col: string, val: string) => {
    setFilters((p) => p[col]?.toLowerCase() === val.toLowerCase()
      ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== col))
      : { ...p, [col]: val });
  }, []);

  // ⚠️ All hooks must be BEFORE the early return below
  const sparkData = useMemo(() => {
    const line = charts.find((c) => c.type === "line" && c.xKey === "month");
    if (!line?.data?.length) return [];
    return line.data.map((r) => Number(r[line.yKey || ""])) .filter(Number.isFinite);
  }, [charts]);

  const distData = useMemo(() => {
    const pieChart = charts.find((c) => c.type === "pie");
    return pieChart?.data?.slice(0, 6) || [];
  }, [charts]);

  const forecast = useMemo(() => {
    if (sparkData.length < 3) return null;
    return forecastLinear(sparkData, 1);
  }, [sparkData]);

  // geoDataInline populated later after loading check
  let geoDataInline: { name: string; value: number }[] = [];

  const exportDashboard = useCallback(async () => {
    if (!dashRef.current) return;
    try {
      const blob = await toPng(dashRef.current, { quality: 0.95, pixelRatio: 2, backgroundColor: "#0a0a1a" });
      const a = document.createElement("a");
      a.href = blob;
      a.download = `${data?.name || "dashboard"}.png`;
      a.click();
    } catch {}
  }, [data]);

  if (loadError) return <p className="text-sm text-red-400 py-10">{loadError}</p>;
  if (loading || !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/20 flex items-center justify-center mx-auto mb-4">
            <Brain className="w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-48 bg-white/5 rounded-full mx-auto shimmer" />
            <div className="h-2 w-32 bg-white/5 rounded-full mx-auto shimmer" style={{ animationDelay: "200ms" }} />
          </div>
        </div>
      </div>
    );
  }

  const { kpis, profile, insights, cleaningReport, domain, rowCount, columnCount, name, columnValues } = data;
  const kpiData = kpis.slice(0, showAllKpis ? kpis.length : 5);
  const heroKpi = kpis[0];
  const EXCEL_GRADIENTS = ["from-[#4472C4] to-[#5B9BD5]", "from-[#5B9BD5] to-[#4472C4]", "from-[#ED7D31] to-[#F4B183]", "from-[#70AD47] to-[#A9D18E]", "from-[#FFC000] to-[#FFD966]"];

  // Compute geoData
  const locCols = profile?.locationColumns || [];
  const catCols = profile?.categoricalColumns || [];
  const potentialGeoCols = [...locCols, ...catCols.filter((c) =>
    ["region", "country", "city", "state", "area", "zone", "territory"].some((kw) => c.toLowerCase().includes(kw))
  )];
  if (potentialGeoCols.length && charts[0]?.xKey === potentialGeoCols[0] && charts[0]?.data?.length) {
    const geoCol = potentialGeoCols[0];
    const numCol = charts[0]?.yKey || charts[0]?.dataKey || "";
    geoDataInline = charts[0].data.slice(0, 8).map((r) => ({
      name: String(r[geoCol] || r[charts[0]?.xKey || ""] || "Unknown"),
      value: parseFloat(String(r[numCol])) || 0,
    })).filter((r) => r.name !== "Unknown");
  }

  // Compute KPI alerts (now kpis is defined)
  const computedAlerts = kpis.slice(0, 5).map((kpi): { level: string; message: string } | null => {
    if (!kpi.change || Math.abs(kpi.change) < 10) return null;
    const level = Math.abs(kpi.change) >= 30 ? "critical" : Math.abs(kpi.change) >= 20 ? "warning" : "info";
    const dir = kpi.change > 0 ? "surge" : "drop";
    return { level, message: `${dir === "surge" ? "Surge" : "Drop"}: ${Math.abs(kpi.change)}% ${kpi.name}` };
  });

  // Quality score color
  const qColor = profile.qualityScore >= 80 ? "#10b981" : profile.qualityScore >= 60 ? "#f59e0b" : "#ef4444";

  const viewTabs: { key: DashView; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Overview", icon: Eye },
    { key: "performance", label: "Performance", icon: TrendingUp },
    { key: "distribution", label: "Distribution", icon: PieChart },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* ── HEADER ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{name}</h2>
              <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>{rowCount.toLocaleString()} rows · {columnCount} columns</span>
                {domain && <><span>·</span><span className="flex items-center gap-1 text-purple-400"><Globe className="w-3 h-3" />{domain}</span></>}
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter value={datePeriod} onChange={setDatePeriod} />
          <AutoRefresh interval={refreshInterval} onChange={setRefreshInterval} />
          <ComparisonToggle enabled={compareMode} onChange={setCompareMode} />
          {compareMode && <span className="text-xs text-slate-500">Changes compare first and second halves of dated rows, not equal calendar periods.</span>}
          <ShareButton dashboardId={dashboardId} />
          <button onClick={() => setEditMode(!editMode)}
            className={cn("flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs transition-all",
              editMode ? "bg-blue-500/15 text-blue-400 border-blue-500/30" : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10")}
          ><Edit3 className="w-3.5 h-3.5" /> Customize</button>
          <button onClick={exportDashboard}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-xs text-slate-300 hover:bg-white/10 transition-all"
          ><Download className="w-3.5 h-3.5" /> Export</button>
          <ThemeToggle />
        </div>
      </div>

      {/* ── FILTER BAR ── */}
      <FilterChips filters={filters} columns={Object.keys(Object.keys(baseValues).length ? baseValues : (columnValues || {}))} columnValues={Object.keys(baseValues).length ? baseValues : (columnValues || {})} onChange={setFilters} />
      <div className="flex flex-wrap items-center gap-2 -mt-3 px-1">
        <select value={datePeriod} onChange={(e) => setDatePeriod(e.target.value)} className="px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 outline-none focus:border-blue-500/30">
          <option value="all">All Time</option><option value="7d">Last 7 Days</option><option value="30d">Last 30 Days</option><option value="quarter">This Quarter</option><option value="year">This Year</option>
        </select>
        <span className="text-[10px] text-slate-500">{rowCount.toLocaleString()} rows match{Object.keys(filters).length || datePeriod !== "all" ? " the current filters" : ""}</span>
        <div className="ml-auto flex items-center gap-2 text-[10px] text-slate-600">
          <Clock className="w-3 h-3" />
          Last refreshed: {lastRefresh.toLocaleTimeString()}
        </div>
      </div>

      {/* ── POWER BI SMART NARRATIVE ── */}
      {kpis.length > 0 && (
        <div className="px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-transparent border border-blue-500/10">
          <div className="flex items-start gap-3">
            <Brain className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              <span className="text-white font-medium">Smart Narrative: </span>
              {kpis[0]?.name} reached <span className="text-white font-semibold">{typeof kpis[0]?.value === 'number' ? kpis[0].value.toLocaleString() : kpis[0]?.value}</span>
              {kpis[0]?.change !== undefined && (
                <span> — {kpis[0].change > 0 ? 'up' : 'down'} <span className={kpis[0].change > 0 ? 'text-emerald-400' : 'text-red-400'}>{Math.abs(kpis[0].change)}%</span> between dated row halves</span>
              )}
              . Dataset contains <span className="text-white font-semibold">{rowCount.toLocaleString()}</span> rows across <span className="text-white font-semibold">{columnCount}</span> columns.
              {domain && <> Identified domain: <span className="text-purple-400">{domain}</span>.</>}
              {profile.qualityScore > 0 && <> Data quality score: <span className={profile.qualityScore >= 80 ? 'text-emerald-400' : 'text-amber-400'}>{profile.qualityScore.toFixed(0)}/100</span>.</>}
              {insights[0] && <> Key insight: <span className="text-purple-300">{insights[0]?.title}</span></>}
            </p>
          </div>
        </div>
      )}

      {/* ── DASHBOARD CONTENT ── */}
      <div ref={dashRef} className="space-y-6">

        {/* ── EDIT MODE BAR ── */}
        {editMode && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Edit3 className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-blue-300 flex-1">Drag ↕ to reorder · Click size badge to resize · ✕ to remove chart</span>
            <button onClick={() => setChartOrder([])} className="text-[10px] text-slate-400 hover:text-white px-2 py-1 rounded bg-white/5">Reset</button>
            <button onClick={saveLayout} disabled={savingLayout}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500 text-white text-[11px] font-medium hover:bg-blue-600 disabled:opacity-50"
            >{savingLayout ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save Layout</button>
          </div>
        )}

        {/* ── HERO METRIC ── */}
        {heroKpi && (
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-purple-600/20 border border-blue-500/20 p-6">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
            <div className="relative flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-blue-400/70 font-medium mb-1">KEY METRIC</p>
                <p className="text-sm text-slate-400 mb-1">{heroKpi.name}</p>
                <p className="text-4xl font-bold text-white tabular-nums">
                  {typeof heroKpi.value === "number" ? <AnimatedCounter value={heroKpi.value} /> : heroKpi.value}
                </p>
                {heroKpi.change !== undefined && (
                  <div className={cn("flex items-center gap-1.5 mt-2 text-sm font-medium", heroKpi.change > 0 ? "text-emerald-400" : "text-red-400")}>
                    {heroKpi.change > 0 ? <ArrowUpRight className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                    {Math.abs(heroKpi.change)}% between dated row halves
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                {sparkData.length > 0 && (
                  <div className="text-right">
                    <p className="text-[10px] text-slate-500 mb-1">Monthly values (up to 12 months)</p>
                    <Sparkline data={sparkData} color="#4472C4" height={32} />
                  </div>
                )}
                <div className="text-right">
                  <div className="relative w-20 h-20">
                    <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="6" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={qColor} strokeWidth="6" strokeLinecap="round" strokeDasharray={`${(profile.qualityScore / 100) * 263.9} 263.9`} />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-lg font-bold text-white">{profile.qualityScore.toFixed(0)}</span>
                        <p className="text-[7px] text-slate-500 -mt-0.5">quality</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── VIEW TABS ── */}
        <div className="flex items-center gap-1">
          {viewTabs.map((vt) => {
            const Icon = vt.icon;
            return (
              <button key={vt.key} onClick={() => setActiveView(vt.key)}
                className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all",
                  activeView === vt.key
                    ? "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                )}
              ><Icon className="w-3.5 h-3.5" />{vt.label}</button>
            );
          })}
        </div>

        {/* ── OVERVIEW VIEW ── */}
        {activeView === "overview" && (
          <>
            {/* Power BI-style KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {kpiData.map((kpi, i) => {
                const Icon = iconMap[kpi.icon || "chart"] || BarChart3;
                const isPositive = kpi.change !== undefined && kpi.change > 0;
                const isNegative = kpi.change !== undefined && kpi.change < 0;
                const cardBg = isPositive ? "from-emerald-500/10 to-emerald-500/5" : isNegative ? "from-red-500/10 to-red-500/5" : "from-blue-500/10 to-blue-500/5";
                const borderColor = isPositive ? "border-emerald-500/20" : isNegative ? "border-red-500/20" : "border-blue-500/20";
                const alert = computedAlerts[i];
                return (
                  <div key={i} className={`group relative p-4 rounded-xl bg-gradient-to-br ${cardBg} border ${borderColor} animate-slide-up transition-all hover:scale-[1.02] hover:shadow-lg cursor-default overflow-hidden`}
                    style={{ animationDelay: `${i * 60}ms` }}>
                    {alert && (
                      <div className={cn("absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg",
                        alert.level === "critical" ? "bg-red-500" : alert.level === "warning" ? "bg-amber-500" : "bg-blue-500")}>
                        <Gauge className="w-3 h-3 text-white" />
                      </div>
                    )}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-white/[0.02] to-transparent rounded-full blur-2xl" />
                    <div className="relative">
                      <div className="flex items-start justify-between mb-2">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${isPositive ? 'from-emerald-500 to-green-600' : isNegative ? 'from-red-500 to-rose-600' : 'from-blue-500 to-indigo-600'} flex items-center justify-center shadow-lg`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <div className="flex items-center gap-1">
                          {isPositive && <TrendingUp className="w-3 h-3 text-emerald-400" />}
                          {isNegative && <TrendingDown className="w-3 h-3 text-red-400" />}
                          {kpi.change !== undefined && kpi.change !== 0 && (
                            <span className={cn("text-[10px] font-semibold tabular-nums", isPositive ? "text-emerald-400" : "text-red-400")}>
                              {isPositive ? "+" : ""}{kpi.change}%
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 mb-0.5 truncate">{kpi.name}</p>
                      <p className="text-xl font-bold text-white tabular-nums">
                        {typeof kpi.value === "number"
                          ? <AnimatedCounter value={kpi.value} duration={800 + i * 100} />
                          : kpi.value}
                      </p>
                      {alert && (
                        <div className="mt-1 flex items-center gap-1">
                          <span className={cn("text-[8px] font-medium px-1.5 py-0.5 rounded-full",
                            alert.level === "critical" ? "bg-red-500/15 text-red-400" :
                            alert.level === "warning" ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400")}>
                            {alert.message}
                          </span>
                        </div>
                      )}
                      {kpi.change !== undefined && (
                        <div className="mt-2 flex items-center gap-1.5">
                          <div className={`flex-1 h-1 rounded-full ${isPositive ? 'bg-emerald-500/30' : isNegative ? 'bg-red-500/30' : 'bg-blue-500/30'}`}>
                            <div className={`h-full rounded-full ${isPositive ? 'bg-emerald-400' : isNegative ? 'bg-red-400' : 'bg-blue-400'}`}
                              style={{ width: `${Math.min(Math.abs(kpi.change || 0) * 3, 100)}%` }} />
                          </div>
                          <span className={`text-[8px] font-medium ${isPositive ? 'text-emerald-500' : 'text-red-500'}`}>
                            vs target
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {kpis.length > 5 && (
              <button onClick={() => setShowAllKpis(!showAllKpis)}
                className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-300 mx-auto"
              >{showAllKpis ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {showAllKpis ? "Show less" : `Show all ${kpis.length} KPIs`}</button>
            )}

            {/* Main Chart + Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                {/* Charts grid */}
                {orderedCharts.length > 0 && (
                  <>
                    <div className={cn("glass-card p-5 animate-slide-up relative group", editMode && "border-blue-500/20")}>
                      {editMode && (
                        <div className="absolute top-3 right-3 z-10 flex items-center gap-1">
                          <button onClick={() => moveChart(0, 1)} className="p-1 rounded bg-white/10 text-slate-400 hover:text-white" title="Move"><GripVertical className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeChart(0)} className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30" title="Remove"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      )}
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-white">{orderedCharts[0].title}</h3>
                        <span className="text-[10px] text-slate-500 bg-white/5 px-2 py-0.5 rounded">{orderedCharts[0].type}</span>
                      </div>
                      <ExcelChartPro chart={orderedCharts[0]} height={360} onPointClick={onPoint} activeFilters={filters} />
                    </div>
                    {orderedCharts.length > 1 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {orderedCharts.slice(1, 5).map((chart, ci) => {
                          const idx = ci + 1;
                          const size = chartSizes[idx] || "1";
                          return (
                            <div key={idx} className={cn("glass-card p-4 animate-slide-up relative group", 
                              editMode && "border-blue-500/20",
                              size === "full" && "md:col-span-2"
                            )} style={{ animationDelay: `${ci * 80}ms` }}>
                              {editMode && (
                                <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
                                  <button onClick={() => toggleChartSize(idx)}
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-slate-400 hover:text-white"
                                  ><Layout className="w-3 h-3" />{size}</button>
                                  {idx > 1 && <button onClick={() => moveChart(idx, idx - 1)} className="p-1 rounded bg-white/10 text-slate-400 hover:text-white"><GripVertical className="w-3 h-3" /></button>}
                                  <button onClick={() => removeChart(idx)} className="p-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30"><X className="w-3 h-3" /></button>
                                </div>
                              )}
                              <h3 className="text-xs font-semibold text-white mb-2 truncate">{chart.title}</h3>
                              <ExcelChartPro chart={chart} height={size === "full" ? 320 : 220} onPointClick={onPoint} activeFilters={filters} />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Right Panel */}
              <div className="space-y-4">
                {/* Quality */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                      <Shield className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">Data Quality</h3>
                      <p className="text-[9px] text-slate-500">Overall score</p>
                    </div>
                  </div>
                  <div className="relative w-32 h-32 mx-auto mb-4">
                    <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                      <circle cx="50" cy="50" r="42" fill="none" stroke={qColor} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(profile.qualityScore / 100) * 263.9} 263.9`}
                        className="transition-all duration-1000" />
                      <defs>
                        <linearGradient id="qGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor={qColor} />
                          <stop offset="100%" stopColor={qColor} stopOpacity="0.5" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <span className="text-3xl font-bold text-white tabular-nums"><AnimatedCounter value={profile.qualityScore} /></span>
                        <p className="text-[9px] text-slate-500">/ 100</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <QualityBar label="Completeness" value={profile.completeness} color="#4472C4" />
                    <QualityBar label="Consistency" value={profile.consistency} color="#5B9BD5" />
                    <QualityBar label="Uniqueness" value={profile.uniqueness} color="#ED7D31" />
                  </div>
                </div>

                {/* Auto-Cleaning */}
                <div className="glass-card p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold text-white">Auto-Cleaning</h3>
                      <p className="text-[9px] text-slate-500">Data preparation</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-xs text-slate-400 flex items-center gap-2"><AlertTriangle className="w-3.5 h-3.5 text-amber-400" /> Issues found</span>
                      <span className="text-sm font-bold text-amber-400">{(cleaningReport?.totalIssues || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <span className="text-xs text-slate-400 flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Issues fixed</span>
                      <span className="text-sm font-bold text-emerald-400">{(cleaningReport?.fixedIssues || 0).toLocaleString()}</span>
                    </div>
                    <div className="pt-2 border-t border-white/5 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">Before</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-red-500/50" style={{ width: `${cleaningReport?.qualityBefore || 0}%` }} />
                          </div>
                          <span className="text-[10px] font-semibold text-slate-400">{cleaningReport?.qualityBefore || 0}%</span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] text-slate-500">After</span>
                        <div className="flex items-center gap-2">
                          <div className="w-20 h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${cleaningReport?.qualityAfter || 0}%` }} />
                          </div>
                          <span className="text-[10px] font-semibold text-emerald-400">{cleaningReport?.qualityAfter || 0}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Insights */}
                {insights.length > 0 && (
                  <div className="glass-card p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-white">AI Insights</h3>
                        <p className="text-[9px] text-slate-500">Top discoveries</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {insights.slice(0, 4).map((ins, i) => (
                        <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-purple-500/20 transition-all group cursor-default">
                          <div className="flex items-start gap-2.5">
                            <div className={cn("w-2 h-2 rounded-full mt-1 flex-shrink-0 shadow-sm",
                              ins.impact === "high" ? "bg-red-400 shadow-red-400/20" :
                              ins.impact === "medium" ? "bg-amber-400 shadow-amber-400/20" : "bg-emerald-400 shadow-emerald-400/20")} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white group-hover:text-blue-300 transition-colors">{ins.title}</p>
                              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{ins.description}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── PERFORMANCE VIEW ── */}
        {activeView === "performance" && (
          <div className="space-y-6">
            {/* Performance summary cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {kpis.slice(0, 3).map((kpi, i) => {
                const Icon = iconMap[kpi.icon || "chart"] || BarChart3;
                return (
                  <div key={i} className="glass-card p-5 animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
                    <div className="flex items-start justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${EXCEL_GRADIENTS[i]} flex items-center justify-center`}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      {kpi.change !== undefined && (
                        <div className={cn("flex items-center gap-1 text-xs font-medium",
                          kpi.change > 0 ? "text-emerald-400" : "text-red-400")}>
                          <Target className="w-3.5 h-3.5" />
                          {kpi.change > 0 ? "+" : ""}{kpi.change}%
                        </div>
                      )}
                    </div>
                    <h4 className="text-[10px] text-slate-500 uppercase tracking-wider">{kpi.name}</h4>
                    <p className="text-2xl font-bold text-white mt-1 tabular-nums">
                      {typeof kpi.value === "number" ? <AnimatedCounter value={kpi.value} duration={1000 + i * 200} /> : kpi.value}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Trend analysis */}
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <LineChart className="w-4 h-4 text-blue-400" /> Trend Analysis
              </h3>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {orderedCharts.filter((c) => c.type === "line" || c.type === "bar" || c.type === "hbar").slice(0, 4).map((chart, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                    <h4 className="text-[10px] font-medium text-slate-400 mb-2">{chart.title}</h4>
                    <ExcelChartPro chart={chart} height={200} onPointClick={onPoint} activeFilters={filters} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── DISTRIBUTION VIEW ── */}
        {activeView === "distribution" && (
          <div className="space-y-6">
            {/* Distribution Overview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Data composition */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Database className="w-4 h-4 text-cyan-400" /> Data Composition
                </h3>
                <div className="space-y-3">
                  <DistBar label="Numeric" count={profile.numericColumns.length} total={columnCount} color="#4472C4" />
                  <DistBar label="Categorical" count={profile.categoricalColumns.length} total={columnCount} color="#ED7D31" />
                  <DistBar label="Date" count={profile.dateColumns.length} total={columnCount} color="#5B9BD5" />
                  <DistBar label="Currency" count={profile.currencyColumns.length} total={columnCount} color="#70AD47" />
                  <DistBar label="Location" count={profile.locationColumns.length} total={columnCount} color="#FFC000" />
                  <DistBar label="Status" count={profile.statusColumns.length} total={columnCount} color="#9B57A0" />
                </div>
              </div>

              {/* Pie distribution */}
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-amber-400" /> Top Categories
                </h3>
                {distData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <RePie>
                      <Pie data={distData} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={2}>
                        {distData.map((_, i) => <Cell key={i} fill={EXCEL_COLORS[i % EXCEL_COLORS.length]} />)}
                      </Pie>
                      <Tooltip content={(p) => {
                        if (!p.active || !p.payload?.[0]) return null;
                        const d = p.payload[0].payload;
                        return (
                          <div className="glass-card px-3 py-2 text-xs">
                            <p className="text-white font-medium">{d.name}</p>
                            <p className="text-slate-400">{(d as { count?: number }).count?.toLocaleString()}</p>
                          </div>
                        );
                      }} />
                    </RePie>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-slate-600 text-xs">
                    No categorical data found
                  </div>
                )}
              </div>
            </div>

            {/* Geo / Region View */}
            {geoDataInline.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-emerald-400" /> Regional Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    {geoDataInline.sort((a, b) => b.value - a.value).map((item, i) => {
                      const maxVal = Math.max(...geoDataInline.map((g) => g.value));
                      const pct = (item.value / maxVal) * 100;
                      return (
                        <div key={i} className="flex items-center gap-3 group hover:bg-white/[0.02] rounded-lg px-2 py-1.5 transition-colors">
                          <span className="text-[10px] text-slate-500 w-5 text-right font-mono">{i + 1}</span>
                          <div className="flex-1">
                            <div className="flex justify-between items-center mb-0.5">
                              <span className="text-[11px] text-slate-300 font-medium">{item.name}</span>
                              <span className="text-[10px] text-slate-400 font-mono">{item.value.toLocaleString()}</span>
                            </div>
                            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${pct}%`, backgroundColor: i === 0 ? "#4472C4" : i === 1 ? "#5B9BD5" : i === 2 ? "#ED7D31" : "#70AD47" }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-center">
                    <div className="text-center p-8 rounded-xl bg-white/[0.02] border border-white/5 w-full">
                      <Globe className="w-12 h-12 text-emerald-500/30 mx-auto mb-3" />
                      <p className="text-xs text-slate-500">
                        <span className="text-white font-medium">{geoDataInline.length}</span> regions detected
                      </p>
                      <p className="text-[10px] text-slate-600 mt-1">Top region: <span className="text-emerald-400 font-medium">{geoDataInline.sort((a, b) => b.value - a.value)[0]?.name}</span></p>
                      <p className="text-[10px] text-slate-600">Worth: <span className="text-white font-medium">{Math.max(...geoDataInline.map((g) => g.value)).toLocaleString()}</span></p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Relationships */}
            {profile.relationships.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-purple-400" /> Data Relationships
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {profile.relationships.map((rel, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-purple-500/20 transition-all">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{rel.from}</p>
                        <p className="text-[10px] text-slate-500">{rel.type}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowUpRight className="w-3 h-3 text-purple-400" />
                        <span className="text-[10px] font-medium text-purple-400">{rel.to}</span>
                      </div>
                      <div className="text-[9px] text-slate-500 bg-white/5 px-1.5 py-0.5 rounded">
                        {(rel.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All charts */}
            {orderedCharts.length > 0 && (
              <div className="glass-card p-5">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" /> All Visualizations
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {orderedCharts.map((chart, i) => (
                    <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[10px] font-medium text-slate-400 truncate">{chart.title}</h4>
                        <span className="text-[9px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded">{chart.type}</span>
                      </div>
                      <ExcelChartPro chart={chart} height={200} onPointClick={onPoint} activeFilters={filters} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── FORECAST SECTION ── */}
        {activeView === "overview" && forecast && (
          <div className="glass-card p-5 animate-slide-up">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-purple-400" /> Forecast & Projection
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/5 border border-purple-500/20">
                <p className="text-[10px] text-slate-500 mb-1">Next Period Forecast</p>
                <p className="text-2xl font-bold text-white">
                  {forecast.next !== null ? forecast.next.toLocaleString() : "—"}
                </p>
                <div className={cn("flex items-center gap-1 mt-1 text-[11px] font-medium",
                  forecast.trend === "up" ? "text-emerald-400" : forecast.trend === "down" ? "text-red-400" : "text-slate-400")}>
                  {forecast.trend === "up" ? <TrendingUp className="w-3.5 h-3.5" /> : forecast.trend === "down" ? <TrendingDown className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                  Trend: {forecast.trend === "up" ? "Upward" : forecast.trend === "down" ? "Downward" : "Stable"}
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-slate-500 mb-1">Linear fit R² (not forecast accuracy) Score</p>
                <p className="text-2xl font-bold text-white">{forecast.confidence}%</p>
                <div className="mt-2 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-purple-500 to-blue-500" style={{ width: `${forecast.confidence}%` }} />
                </div>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-slate-500 mb-1">Data Points</p>
                <p className="text-2xl font-bold text-white">{sparkData.length}</p>
                <p className="text-[10px] text-slate-500 mt-1">Periods analyzed</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
                <p className="text-[10px] text-slate-500 mb-1">R² Value</p>
                <p className="text-2xl font-bold text-white">{forecast.confidence > 80 ? "Strong" : forecast.confidence > 50 ? "Moderate" : "Weak"}</p>
                <p className="text-[10px] text-slate-500 mt-1">Model fit quality</p>
              </div>
            </div>
            {charts[0]?.data?.length > 0 && (
              <div className="mt-4 h-20">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={charts[0].data.slice(-20)}>
                    <Area type="monotone" dataKey={charts[0]?.yKey || charts[0]?.dataKey || ""} stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.08} strokeWidth={2} dot={false} />
                    <Tooltip content={() => null} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ── DATA COMPOSITION PILLS ── (shown in all views at bottom) */}
        {(activeView === "overview" || activeView === "performance") && (
          <div className="glass-card p-4 animate-slide-up">
            <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-cyan-400" /> Data Profile
            </h3>
            <div className="flex flex-wrap gap-2">
              <Pill label="Numeric" count={profile.numericColumns.length} color="bg-[#4472C4]/20 text-[#4472C4]" />
              <Pill label="Categorical" count={profile.categoricalColumns.length} color="bg-[#ED7D31]/20 text-[#ED7D31]" />
              <Pill label="Date" count={profile.dateColumns.length} color="bg-[#5B9BD5]/20 text-[#5B9BD5]" />
              <Pill label="Currency" count={profile.currencyColumns.length} color="bg-[#70AD47]/20 text-[#70AD47]" />
              <Pill label="Location" count={profile.locationColumns.length} color="bg-[#FFC000]/20 text-[#FFC000]" />
              <Pill label="Status" count={profile.statusColumns.length} color="bg-[#9B57A0]/20 text-[#9B57A0]" />
              {profile.relationships.length > 0 && (
                <Pill label="Relationships" count={profile.relationships.length} color="bg-[#264478]/20 text-[#264478]" />
              )}
            </div>
          </div>
        )}

        {/* ── PERFORMANCE FOOTER ── */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white/[0.02] border border-white/5">
          <div className="flex items-center gap-4 text-[10px] text-slate-600">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Loaded in {loadTime}ms</span>
            <span className="flex items-center gap-1"><Database className="w-3 h-3" /> {rowCount?.toLocaleString()} rows</span>
            <span className="flex items-center gap-1"><Sigma className="w-3 h-3" /> {rowCount?.toLocaleString() || "—"} total records</span>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-slate-600">
            <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> Charts: {charts.length}</span>
            <span className="flex items-center gap-1"><Target className="w-3 h-3" /> KPIs: {kpis?.length}</span>
            <span className="flex items-center gap-1">
              <Shield className="w-3 h-3" /> Quality: {profile?.qualityScore?.toFixed(0) || "—"}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SMALL COMPONENTS ────────────────────────────────────────

function GripVertical({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="5" r="1" /><circle cx="15" cy="5" r="1" />
      <circle cx="9" cy="12" r="1" /><circle cx="15" cy="12" r="1" />
      <circle cx="9" cy="19" r="1" /><circle cx="15" cy="19" r="1" />
    </svg>
  );
}

// ─── FORECAST UTILITY ────────────────────────────────────────
function forecastLinear(data: number[], periods: number = 1): { next: number | null; trend: "up" | "down" | "stable"; confidence: number } {
  if (data.length < 3) return { next: null, trend: "stable", confidence: 0 };
  const n = data.length;
  const indices = data.map((_, i) => i);
  const xMean = (n - 1) / 2;
  const yMean = data.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (data[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  const next = slope * (n - 1 + periods) + intercept;
  const variance = data.reduce((a, b, i) => a + (b - (slope * indices[i] + intercept)) ** 2, 0) / n;
  const totalVariance = data.reduce((a, b) => a + (b - yMean) ** 2, 0) / n;
  const rSquared = totalVariance === 0 ? 1 : 1 - variance / totalVariance;
  return {
    next: Math.round(next * 100) / 100,
    trend: slope > data.reduce((a, b) => a + b, 0) / n * 0.05 ? "up" : slope < -data.reduce((a, b) => a + b, 0) / n * 0.05 ? "down" : "stable",
    confidence: Math.max(0, Math.min(100, Math.round(rSquared * 100))),
  };
}

function QualityBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-slate-500">{label}</span>
        <span className="text-slate-300 font-medium">{value.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

function Pill({ label, count, color }: { label: string; count: number; color: string }) {
  if (count === 0 && !label.includes("Relationship")) return null;
  return (
    <span className={`text-[10px] px-3 py-1 rounded-full font-medium ${color}`}>
      {label} <span className="opacity-60">{count}</span>
    </span>
  );
}

function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-slate-400 w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-[10px] text-slate-500 font-mono w-8 text-right">{count}</span>
    </div>
  );
        }
