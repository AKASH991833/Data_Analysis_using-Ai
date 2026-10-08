"use client";

import React, { useRef, useState, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LabelList, Legend, ReferenceLine,
} from "recharts";
import { toPng } from "html-to-image";
import {
  Download, Maximize2, Minimize2, BarChart3,
  TrendingUp, PieChart as PieIcon, ScatterChart as ScatterIcon,
  Table2, X, Activity, Eye,
} from "lucide-react";

interface ChartData {
  type: string;
  title: string;
  xKey?: string;
  yKey?: string;
  dataKey?: string;
  filterCol?: string;
  data: Record<string, unknown>[];
}

interface Props {
  chart: ChartData;
  height?: number;
  /** Called when a bar or slice is clicked on a chart that maps to a filterable column. */
  onPointClick?: (column: string, value: string) => void;
  /** Currently applied dashboard filters (column -> value); matching points stay highlighted. */
  activeFilters?: Record<string, string>;
}

const compact = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v ?? "");
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + "B";
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (a >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "K";
  return String(Math.round(n * 100) / 100);
};
const trunc = (v: unknown, n = 14) => { const t = String(v ?? ""); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

const EXCEL_COLORS = [
  "#4472C4", "#ED7D31", "#A5A5A5", "#FFC000",
  "#5B9BD5", "#70AD47", "#264478", "#9B57A0",
  "#636363", "#BF8F00", "#2E75B6", "#2EA02E",
];

const CHART_TYPES = [
  { key: "bar", icon: BarChart3, label: "Bar" },
  { key: "line", icon: TrendingUp, label: "Line" },
  { key: "area", icon: Activity, label: "Area" },
  { key: "pie", icon: PieIcon, label: "Pie" },
  { key: "scatter", icon: ScatterIcon, label: "Scatter" },
];

export function ExcelChartPro({ chart, height = 320, onPointClick, activeFilters }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartType, setChartType] = useState(chart.type);
  const [fullscreen, setFullscreen] = useState(false);
  const [drillDown, setDrillDown] = useState<Record<string, unknown>[] | null>(null);
  const [downloading, setDownloading] = useState(false);

  const data = chart.data;
  const xKey = chart.xKey;
  const yKey = chart.yKey;
  const dataKey = chart.dataKey;

  const handleDownload = useCallback(async () => {
    if (!chartRef.current) return;
    setDownloading(true);
    try {
      const blob = await toPng(chartRef.current, { quality: 0.95, pixelRatio: 2 });
      const a = document.createElement("a");
      a.href = blob;
      a.download = `${chart.title.replace(/\s+/g, "_")}.png`;
      a.click();
    } catch {}
    setDownloading(false);
  }, [chart.title]);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!fullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setFullscreen(!fullscreen);
  }, [fullscreen]);

  const handleDrillDown = useCallback((entry: Record<string, unknown> | Record<string, unknown>[]) => {
    setDrillDown(Array.isArray(entry) ? entry : entry ? [entry] : null);
  }, []);

  const clickable = !!(chart.filterCol && onPointClick);
  const activeValue = chart.filterCol ? activeFilters?.[chart.filterCol] : undefined;
  const labelKey = chartType === "pie" ? "name" : xKey;
  const isActive = (row: Record<string, unknown>) => !activeValue || String(row[labelKey || ""] ?? "").toLowerCase() === activeValue.toLowerCase();
  const pick = (d: unknown) => {
    const row = ((d as { payload?: Record<string, unknown> })?.payload ?? d) as Record<string, unknown>;
    if (clickable && chart.filterCol) {
      const v = String(row[labelKey || ""] ?? row["name"] ?? "");
      if (v) onPointClick!(chart.filterCol, v);
    } else if (row) handleDrillDown(row);
  };
  const pointTotal = data.reduce((a, r) => a + (Number(r[chartType === "pie" ? (dataKey || "count") : (yKey || "")]) || 0), 0);
  const avg = data.length && yKey ? data.reduce((a, r) => a + (Number(r[yKey]) || 0), 0) / data.length : 0;
  const isPieLike = chartType === "pie";
  const displayData = isPieLike ? data : data;

  if (displayData.length === 0) {
    return <p className="text-slate-500 text-xs text-center py-10">No data</p>;
  }

  return (
    <div ref={containerRef} className={`relative ${fullscreen ? "fixed inset-0 z-[200] bg-dark-bg p-6" : ""}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1">
          {CHART_TYPES.map((ct) => {
            const Icon = ct.icon;
            return (
              <button
                key={ct.key}
                onClick={() => setChartType(ct.key)}
                className={`p-1.5 rounded-lg transition-all ${
                  chartType === ct.key
                    ? "bg-blue-500/15 text-blue-400"
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
                }`}
                title={ct.label}
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
            title="Download as PNG"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => handleDrillDown(data)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
            title="View data"
          >
            <Table2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleFullscreen}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {clickable && <p className="text-[10px] text-slate-500 -mt-1 mb-1">Click a {chartType === "pie" ? "slice" : "bar"} to filter the whole dashboard</p>}
      {/* Chart */}
      <div
        ref={chartRef}
        className={`chart-container ${downloading ? "p-4 bg-dark-bg" : ""}`}
        style={{ height: fullscreen ? "calc(100vh - 120px)" : height }}
      >
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "bar" ? (
            <BarChart data={displayData} margin={{ top: 16, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => trunc(v, 10)} interval="preserveStartEnd" angle={displayData.length > 6 ? -25 : 0} textAnchor={displayData.length > 6 ? "end" : "middle"} height={displayData.length > 6 ? 50 : 30} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={compact} />
              <Tooltip content={<ProTooltip total={pointTotal} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              {avg > 0 && <ReferenceLine y={avg} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: `avg ${compact(avg)}`, position: "insideTopRight", fill: "#f59e0b", fontSize: 10 }} />}
              <Bar dataKey={yKey!} radius={[4, 4, 0, 0]} maxBarSize={50} cursor={clickable ? "pointer" : "default"} onClick={pick}>
                {displayData.length <= 12 && <LabelList dataKey={yKey!} position="top" formatter={compact} style={{ fontSize: 9, fill: "#94a3b8" }} />}
                {displayData.map((r, idx) =>
                  <Cell key={idx} fill={EXCEL_COLORS[idx % EXCEL_COLORS.length]} fillOpacity={isActive(r) ? 1 : 0.25} />
                )}
              </Bar>
            </BarChart>
          ) : chartType === "hbar" ? (
            <BarChart data={displayData} layout="vertical" margin={{ top: 4, right: 36, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={compact} />
              <YAxis type="category" dataKey={xKey} width={96} tick={{ fontSize: 11, fill: "#cbd5e1" }} tickFormatter={(v) => trunc(v, 14)} interval={0} />
              <Tooltip content={<ProTooltip total={pointTotal} />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
              <Bar dataKey={yKey!} radius={[0, 4, 4, 0]} maxBarSize={26} cursor={clickable ? "pointer" : "default"} onClick={pick}>
                <LabelList dataKey={yKey!} position="right" formatter={compact} style={{ fontSize: 10, fill: "#94a3b8" }} />
                {displayData.map((r, idx) =>
                  <Cell key={idx} fill={EXCEL_COLORS[idx % EXCEL_COLORS.length]} fillOpacity={isActive(r) ? 1 : 0.25} />
                )}
              </Bar>
            </BarChart>
          ) : chartType === "line" ? (
            <LineChart data={displayData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={compact} />
              <Tooltip content={<ProTooltip />} />
              <Line type="monotone" dataKey={yKey!} stroke="#4472C4" strokeWidth={2.5} dot={{ r: 4, fill: "#4472C4" }} activeDot={{ r: 7, stroke: "#fff", strokeWidth: 2, cursor: "pointer", onClick: (_e: unknown, p: unknown) => handleDrillDown(((p as { payload?: Record<string, unknown> })?.payload) ?? {}) }}>
                <LabelList dataKey={yKey!} position="top" style={{ fontSize: 9, fill: "#94a3b8" }} />
              </Line>
            </LineChart>
          ) : chartType === "area" ? (
            <AreaChart data={displayData}>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={xKey || "index"} tick={{ fontSize: 11, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={compact} />
              <Tooltip content={<ProTooltip />} />
              {Object.keys(displayData[0]).filter((k) => k !== "index" && k !== xKey).map((key, idx) => (
                <Area key={key} type="monotone" dataKey={key} stroke={EXCEL_COLORS[idx % EXCEL_COLORS.length]} fill={EXCEL_COLORS[idx % EXCEL_COLORS.length]} fillOpacity={0.08} strokeWidth={2} />
              ))}
            </AreaChart>
          ) : chartType === "pie" ? (
            <PieChart>
              <Pie data={displayData} dataKey={dataKey || "count"} nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={1} stroke="none" cursor={clickable ? "pointer" : "default"} onClick={pick}>
                <LabelList dataKey="name" position="outside" style={{ fontSize: 9, fill: "#94a3b8" }} />
                {displayData.map((r, idx) =>
                  <Cell key={idx} fill={EXCEL_COLORS[idx % EXCEL_COLORS.length]} fillOpacity={isActive(r) ? 1 : 0.25} />
                )}
              </Pie>
              <Tooltip content={<ProTooltip total={pointTotal} />} />
            </PieChart>
          ) : (
            <ScatterChart>
              <CartesianGrid strokeDasharray="4 4" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#94a3b8" }} name={xKey} />
              <YAxis dataKey={yKey} tick={{ fontSize: 11, fill: "#94a3b8" }} name={yKey} />
              <Tooltip content={<ProTooltip />} />
              <Scatter data={displayData} fill="#4472C4" opacity={0.7} />
            </ScatterChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Drill-down modal */}
      {drillDown && (
        <div className="fixed inset-0 z-[300] bg-black/60 flex items-center justify-center p-4" onClick={() => setDrillDown(null)}>
          <div className="glass-card p-6 max-w-3xl w-full max-h-[75vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Table2 className="w-4 h-4 text-blue-400" />
                {drillDown.length > 1 ? "Chart Data" : "Data Point Details"} ({drillDown.length})
              </h3>
              <button onClick={() => setDrillDown(null)} className="p-1 rounded-lg hover:bg-white/5 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            {drillDown.length === 1 ? (
              <div className="space-y-2">
                {Object.entries(drillDown[0] || {}).map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-xs text-slate-400 font-mono">{key}</span>
                    <span className="text-xs text-white font-semibold">{String(val ?? "—")}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-2 py-2 text-slate-400 font-medium">#</th>
                      {Object.keys(drillDown[0] || {}).map((k) => (
                        <th key={k} className="text-left px-2 py-2 text-slate-400 font-medium whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drillDown.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-b border-white/[0.02] hover:bg-white/[0.02]">
                        <td className="px-2 py-1.5 text-slate-500 font-mono">{i + 1}</td>
                        {Object.keys(drillDown[0] || {}).map((k) => (
                          <td key={k} className="px-2 py-1.5 text-slate-300 max-w-[150px] truncate font-mono">
                            {String(row[k] ?? "—")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {drillDown.length > 50 && (
                  <p className="text-center text-[10px] text-slate-500 mt-2">Showing 50 of {drillDown.length} rows</p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ProTooltip({ active, payload, label, total }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string; total?: number }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-[#1a1a3e]/95 border border-white/10 rounded-lg px-3 py-2 shadow-xl backdrop-blur-md">
      <p className="text-[11px] text-slate-400 mb-1 font-medium">{label}{(payload[0] as unknown as { payload?: { name?: string } })?.payload?.name && !label ? (payload[0] as unknown as { payload: { name: string } }).payload.name : ""}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-xs font-semibold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.value}
          {total && total > 0 && typeof p.value === "number" && payload.length === 1 ? <span className="text-slate-400 font-normal"> · {((p.value / total) * 100).toFixed(1)}% of total</span> : null}
        </p>
      ))}
    </div>
  );
}
