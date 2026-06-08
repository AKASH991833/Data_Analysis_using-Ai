"use client";

import React, { useState } from "react";
import {
  Key,
  Hash,
  Calendar,
  Type,
  ArrowUpDown,
  Search,
} from "lucide-react";
import type { ColumnMeta, DataProfile } from "@/db/schema";

interface ProfileTabProps {
  columns: ColumnMeta[];
  profile: DataProfile;
}

export function ProfileTab({ columns, profile }: ProfileTabProps) {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<"name" | "nullPercent" | "uniquePercent">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filtered = columns
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortField === "name") return a.name.localeCompare(b.name) * mult;
      const aVal = a[sortField] ?? 0;
      const bVal = b[sortField] ?? 0;
      return ((aVal as number) - (bVal as number)) * mult;
    });

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const typeIcons: Record<string, React.ElementType> = {
    number: Hash,
    date: Calendar,
    string: Type,
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Total Rows" value={profile.totalRows.toLocaleString()} />
        <StatCard label="Total Columns" value={profile.totalColumns.toString()} />
        <StatCard label="Completeness" value={`${profile.completeness.toFixed(1)}%`} />
        <StatCard label="Quality Score" value={`${profile.qualityScore.toFixed(0)}%`} />
        <StatCard label="Relationships" value={profile.relationships.length.toString()} />
      </div>

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search columns..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/30"
          />
        </div>
      </div>

      {/* Column Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => toggleSort("name")}
                >
                  <div className="flex items-center gap-1">
                    Column <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">
                  Type
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">
                  Semantic
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => toggleSort("nullPercent")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Null % <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-medium text-slate-400 cursor-pointer hover:text-white"
                  onClick={() => toggleSort("uniquePercent")}
                >
                  <div className="flex items-center justify-end gap-1">
                    Unique % <ArrowUpDown className="w-3 h-3" />
                  </div>
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  Min
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  Max
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400">
                  Mean
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400">
                  Top Value
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((col, i) => {
                const Icon = typeIcons[col.type] || Type;
                return (
                  <tr
                    key={col.name}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors animate-fade-in"
                    style={{ animationDelay: `${i * 20}ms` }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {col.isKey && (
                          <Key className="w-3 h-3 text-amber-400" />
                        )}
                        <span className="text-white font-medium">
                          {col.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Icon className="w-3 h-3 text-slate-500" />
                        <span className="text-slate-400 capitalize">
                          {col.type}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-300 capitalize">
                        {col.semanticType || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={`text-xs font-medium ${
                          col.nullPercent > 20
                            ? "text-red-400"
                            : col.nullPercent > 5
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {col.nullPercent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-slate-300">
                      {col.uniquePercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">
                      {col.min !== undefined ? String(col.min) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">
                      {col.max !== undefined ? String(col.max) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">
                      {col.mean !== undefined ? col.mean.toFixed(2) : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs max-w-[120px] truncate">
                      {col.topValues && col.topValues[0]
                        ? `${col.topValues[0].value} (${col.topValues[0].count})`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Relationships */}
      {profile.relationships.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-white mb-4">
            Detected Relationships
          </h3>
          <div className="space-y-2">
            {profile.relationships.map((rel, i) => (
              <div
                key={i}
                className="flex items-center gap-3 text-sm text-slate-300 p-3 rounded-lg bg-white/[0.02]"
              >
                <span className="font-mono text-blue-400">{rel.from}</span>
                <span className="text-slate-500">→</span>
                <span className="font-mono text-purple-400">{rel.to}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                  {rel.type}
                </span>
                <span className="text-xs text-slate-500 ml-auto">
                  {(rel.confidence * 100).toFixed(0)}% confidence
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card p-4 text-center">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </div>
  );
}
