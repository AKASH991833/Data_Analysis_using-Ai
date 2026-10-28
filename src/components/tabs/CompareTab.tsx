"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Loader2,
  AlertTriangle,
  Database,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface DatasetListItem {
  id: string;
  name: string;
  rowCount: number;
  fileType: string;
}

interface SideSummary {
  id: string;
  name: string;
  rowCount: number;
  numeric: Record<string, { sum: number; average: number }>;
  groups: Record<string, { value: string; count: number }[]>;
}

interface CompareResult {
  a: SideSummary;
  b: SideSummary;
  commonNumeric: string[];
  commonCategorical: string[];
}

const fmt = (n: number) =>
  Math.abs(n) >= 1_000_000 ? `${(n / 1_000_000).toFixed(2)}M` : Math.abs(n) >= 1_000 ? `${(n / 1_000).toFixed(1)}K` : n.toLocaleString();

export function CompareTab({ datasetId, datasetName }: { datasetId: string; datasetName: string }) {
  const [datasets, setDatasets] = useState<DatasetListItem[]>([]);
  const [otherId, setOtherId] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/datasets")
      .then((r) => r.json())
      .then((list: DatasetListItem[]) => setDatasets(list.filter((d) => d.id !== datasetId)))
      .catch(() => {});
  }, [datasetId]);

  const runCompare = (id: string) => {
    setOtherId(id);
    setResult(null);
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`/api/compare?a=${datasetId}&b=${id}`)
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json.error || "Compare failed");
        setResult(json);
      })
      .catch((e) => { setResult(null); setError(e instanceof Error ? e.message : "Compare failed"); })
      .finally(() => setLoading(false));
  };

  const compareData = useMemo(() => {
    if (!result) return [];
    return result.commonNumeric.map((col) => ({
      column: col.length > 18 ? `${col.slice(0, 18)}…` : col,
      [result.a.name]: result.a.numeric[col]?.sum ?? 0,
      [result.b.name]: result.b.numeric[col]?.sum ?? 0,
    }));
  }, [result]);

  const avgData = useMemo(() => {
    if (!result) return [];
    return result.commonNumeric.map((col) => ({
      column: col.length > 18 ? `${col.slice(0, 18)}…` : col,
      [result.a.name]: result.a.numeric[col]?.average ?? 0,
      [result.b.name]: result.b.numeric[col]?.average ?? 0,
    }));
  }, [result]);

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="glass-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center">
            <ArrowLeftRight className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Compare datasets</h3>
            <p className="text-[10px] text-slate-500">Side-by-side totals, averages and group counts over shared column names</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1 px-3 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-white truncate">
            <Database className="w-3.5 h-3.5 inline mr-2 text-blue-400" />
            {datasetName}
          </div>
          <ArrowLeftRight className="w-4 h-4 text-slate-500 self-center" />
          <select
            value={otherId}
            onChange={(e) => runCompare(e.target.value)}
            className="flex-1 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white outline-none focus:border-cyan-500/30"
          >
            <option value="">Choose a dataset to compare…</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.rowCount.toLocaleString()} rows)
              </option>
            ))}
          </select>
        </div>
        {datasets.length === 0 && (
          <p className="mt-3 text-xs text-slate-500">Upload one more dataset to compare against this one.</p>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {result && !loading && (
        <>
          {/* Totals */}
          <div className="glass-card p-5">
            <h4 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">Totals (shared numeric columns)</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={compareData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="column" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={fmt} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => Number(v).toLocaleString()}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={result.a.name} fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={result.b.name} fill="#06b6d4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Averages */}
          <div className="glass-card p-5">
            <h4 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">Averages</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="column" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={fmt} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => Number(v).toLocaleString()}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey={result.a.name} fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey={result.b.name} fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Group counts */}
          {result.commonCategorical.map((col) => (
            <div key={col} className="glass-card p-5">
              <h4 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wider">Top {col} (row counts)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[result.a, result.b].map((side) => (
                  <div key={side.id}>
                    <p className="text-[11px] text-slate-400 mb-2 truncate">{side.name} · {side.rowCount.toLocaleString()} rows</p>
                    <div className="space-y-1.5">
                      {(side.groups[col] || []).map((g) => {
                        const max = side.groups[col]?.[0]?.count || 1;
                        return (
                          <div key={g.value} className="flex items-center gap-2">
                            <span className="w-24 truncate text-[11px] text-slate-400">{g.value}</span>
                            <div className="flex-1 h-4 rounded bg-white/5 overflow-hidden">
                              <div className="h-full bg-gradient-to-r from-blue-500 to-cyan-500" style={{ width: `${(g.count / max) * 100}%` }} />
                            </div>
                            <span className="w-14 text-right text-[11px] text-slate-300 font-mono">{g.count.toLocaleString()}</span>
                          </div>
                        );
                      })}
                      {(!side.groups[col] || side.groups[col].length === 0) && (
                        <p className="text-[11px] text-slate-600">No values</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
