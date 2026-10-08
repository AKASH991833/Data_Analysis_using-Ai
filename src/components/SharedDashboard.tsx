"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Activity, Eye, Globe, Loader2, Lock } from "lucide-react";
import { ExcelChartPro } from "@/components/ExcelChartPro";
import { FilterChips } from "@/components/FilterChips";
import { formatNumber } from "@/lib/utils";

interface Payload {
  name: string; domain: string; rowCount: number; totalRows: number; columnCount: number;
  profile: { qualityScore: number; categoricalColumns: string[]; locationColumns: string[] };
  kpis: { name: string; value: string | number; change?: number }[];
  insights: { title: string; description: string; impact: string }[];
  charts: { type: string; title: string; xKey?: string; yKey?: string; dataKey?: string; filterCol?: string; data: Record<string, unknown>[] }[];
  columnValues: Record<string, string[]>; columns: string[]; preview: Record<string, unknown>[]; sharedAt?: string;
}

export function SharedDashboard({ token }: { token: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);

  const load = useCallback(async (f: Record<string, string>) => {
    setBusy(true);
    const qs = new URLSearchParams();
    Object.entries(f).slice(0, 4).forEach(([c, v], i) => { const s = i === 0 ? "" : String(i + 1); qs.set(`filterCol${s}`, c); qs.set(`filterVal${s}`, v); });
    try {
      const r = await fetch(`/api/share/${encodeURIComponent(token)}?${qs}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) { setError(j.error || "Unavailable"); } else { setData(j); setError(null); }
    } catch { setError("Could not load this dashboard."); }
    setBusy(false);
  }, [token]);

  useEffect(() => { let live = true; Promise.resolve().then(() => { if (live) void load(filters); }); return () => { live = false; }; }, [filters, load]);

  const onPoint = (col: string, val: string) => setFilters((p) => (p[col]?.toLowerCase() === val.toLowerCase() ? Object.fromEntries(Object.entries(p).filter(([k]) => k !== col)) : { ...p, [col]: val }));

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card p-8 max-w-md text-center">
          <Lock className="w-8 h-8 text-slate-500 mx-auto mb-3" />
          <h1 className="text-white font-semibold mb-1">Dashboard unavailable</h1>
          <p className="text-sm text-slate-400">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 text-blue-400 animate-spin" /></div>;

  const filterable = [...data.profile.categoricalColumns, ...data.profile.locationColumns];
  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20"><Activity className="w-5 h-5 text-white" /></div>
            <div>
              <h1 className="text-xl font-bold text-white">{data.name}</h1>
              <p className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                <span>{data.rowCount.toLocaleString()}{data.rowCount !== data.totalRows ? ` of ${data.totalRows.toLocaleString()}` : ""} rows · {data.columnCount} columns</span>
                {data.domain && <span className="flex items-center gap-1 text-purple-400"><Globe className="w-3 h-3" />{data.domain}</span>}
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[11px] text-slate-400"><Eye className="w-3.5 h-3.5" />Read-only shared view · NexusAI</span>
        </div>

        <FilterChips filters={filters} columns={filterable} columnValues={data.columnValues} onChange={setFilters} />
        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className={busy ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {data.kpis.slice(0, 5).map((k) => (
              <div key={k.name} className="glass-card p-4">
                <p className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{k.name}</p>
                <p className="text-2xl font-bold text-white tabular-nums">{typeof k.value === "number" ? formatNumber(k.value) : k.value}</p>
                {k.change !== undefined && k.change !== 0 && <p className={`text-[11px] mt-1 ${k.change > 0 ? "text-emerald-400" : "text-red-400"}`}>{k.change > 0 ? "▲" : "▼"} {Math.abs(k.change)}%</p>}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {data.charts.map((c, i) => (
              <div key={i} className={`glass-card p-4 ${i === 0 ? "lg:col-span-2" : ""}`}>
                <h3 className="text-sm font-semibold text-white mb-2">{c.title}</h3>
                <ExcelChartPro chart={c} height={i === 0 ? 320 : 240} onPointClick={onPoint} activeFilters={filters} />
              </div>
            ))}
          </div>

          {data.insights.length > 0 && (
            <div className="glass-card p-4 mt-4">
              <h3 className="text-sm font-semibold text-white mb-3">Key insights</h3>
              <ul className="space-y-2">{data.insights.slice(0, 6).map((n, i) => <li key={i} className="text-xs text-slate-300"><span className="text-white font-medium">{n.title}.</span> <span className="text-slate-400">{n.description}</span></li>)}</ul>
            </div>
          )}

          <div className="glass-card p-4 mt-4 overflow-x-auto">
            <h3 className="text-sm font-semibold text-white mb-2">Data preview <span className="text-slate-500 font-normal text-xs">(first {data.preview.length} rows)</span></h3>
            <table className="w-full text-xs"><thead><tr className="border-b border-white/5">{data.columns.map((c) => <th key={c} className="text-left px-2 py-2 text-slate-400 font-medium whitespace-nowrap">{c}</th>)}</tr></thead>
              <tbody>{data.preview.map((r, i) => <tr key={i} className="border-b border-white/[0.03]">{data.columns.map((c) => <td key={c} className="px-2 py-1.5 text-slate-300 whitespace-nowrap max-w-[200px] truncate">{String(r[c] ?? "")}</td>)}</tr>)}</tbody></table>
          </div>
        </div>
      </div>
    </div>
  );
}
