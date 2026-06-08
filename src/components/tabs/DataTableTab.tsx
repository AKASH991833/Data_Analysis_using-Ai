"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  Table2,
  Filter,
  X,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { ColumnMeta } from "@/db/schema";
import { cn } from "@/lib/utils";

interface DataTableTabProps {
  datasetId: string;
  columns: ColumnMeta[];
  totalRows?: number;
}

interface ColumnFilter {
  column: string;
  value: string;
  operator: "contains" | "equals" | "gt" | "lt";
}

const PAGE_SIZE = 50;

export function DataTableTab({ datasetId, columns, totalRows }: DataTableTabProps) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loadingRows, setLoadingRows] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilter[]>([]);

  useEffect(() => {
    setLoadingRows(true);
    fetch(`/api/datasets/${datasetId}/rows`)
      .then((r) => r.json())
      .then((res) => setData(res.rows || []))
      .catch(() => {})
      .finally(() => setLoadingRows(false));
  }, [datasetId]);

  const columnNames = useMemo(
    () => columns.map((c) => c.name),
    [columns]
  );

  const filtered = useMemo(() => {
    let result = data;

    // Global search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((row) =>
        Object.values(row).some((v) =>
          String(v ?? "").toLowerCase().includes(q)
        )
      );
    }

    // Column filters
    for (const cf of columnFilters) {
      if (!cf.value.trim()) continue;
      const q = cf.value.toLowerCase();
      result = result.filter((row) => {
        const cell = String(row[cf.column] ?? "").toLowerCase();
        switch (cf.operator) {
          case "equals":
            return cell === q;
          case "gt": {
            const num = parseFloat(cell);
            const val = parseFloat(cf.value);
            return !isNaN(num) && !isNaN(val) && num > val;
          }
          case "lt": {
            const num = parseFloat(cell);
            const val = parseFloat(cf.value);
            return !isNaN(num) && !isNaN(val) && num < val;
          }
          default:
            return cell.includes(q);
        }
      });
    }

    return result;
  }, [data, search, columnFilters]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const aVal = a[sortCol];
      const bVal = b[sortCol];
      const aStr = String(aVal ?? "");
      const bStr = String(bVal ?? "");
      const aNum = parseFloat(aStr);
      const bNum = parseFloat(bStr);
      const mult = sortDir === "asc" ? 1 : -1;
      if (!isNaN(aNum) && !isNaN(bNum)) return (aNum - bNum) * mult;
      return aStr.localeCompare(bStr) * mult;
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const exportCSV = () => {
    const header = columnNames.join(",");
    const rows = data.map((row) =>
      columnNames.map((c) => {
        const val = String(row[c] ?? "");
        return val.includes(",") ? `"${val}"` : val;
      }).join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const updateFilter = (col: string, value: string, operator: ColumnFilter["operator"] = "contains") => {
    setColumnFilters((prev) => {
      const existing = prev.findIndex((f) => f.column === col);
      if (!value.trim()) {
        if (existing === -1) return prev;
        return prev.filter((f) => f.column !== col);
      }
      const newFilter: ColumnFilter = { column: col, value, operator };
      if (existing === -1) return [...prev, newFilter];
      const next = [...prev];
      next[existing] = newFilter;
      return next;
    });
    setPage(0);
  };

  const rowsTruncated = totalRows !== undefined && totalRows > data.length;

  if (loadingRows) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-full mx-auto space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search all columns..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowFilters(!showFilters); setColumnFilters([]); }}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all",
              showFilters
                ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
            )}
          >
            <Filter className="w-3.5 h-3.5" />
            Filters
            {columnFilters.length > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-blue-500 text-[9px] text-white flex items-center justify-center font-bold">
                {columnFilters.length}
              </span>
            )}
          </button>
          <span className="text-xs text-slate-400">
            {sorted.length.toLocaleString()} / {data.length.toLocaleString()} rows
          </span>
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Truncation warning */}
      {rowsTruncated && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <div>
            <span className="font-medium">Dataset truncated:</span>{" "}
            {totalRows!.toLocaleString()} total rows — only first {data.length.toLocaleString()} were loaded.
            <br />
            <span className="text-amber-500/70">
              Max analysis limit: 100,000 rows (Excel pivot standard). Upload a smaller file or upgrade for unlimited rows.
            </span>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-360px)]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 z-10">
              <tr className="bg-dark-card border-b border-white/5">
                <th className="px-3 py-3 text-left text-slate-500 font-medium w-12">
                  #
                </th>
                {columnNames.map((col) => (
                  <th
                    key={col}
                    className="px-3 py-3 text-left text-slate-400 font-medium whitespace-nowrap"
                  >
                    <div className="flex items-center gap-1">
                      <span
                        onClick={() => handleSort(col)}
                        className="cursor-pointer hover:text-white transition-colors"
                      >
                        {col}
                      </span>
                      {sortCol === col && (
                        <span className="text-blue-400 text-xs">
                          {sortDir === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
              {/* Filter row */}
              {showFilters && (
                <tr className="bg-dark-surface border-b border-white/5">
                  <th className="px-3 py-2" />
                  {columnNames.map((col) => (
                    <th key={col} className="px-2 py-2">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Filter..."
                          value={columnFilters.find((f) => f.column === col)?.value || ""}
                          onChange={(e) => updateFilter(col, e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/30"
                        />
                        {columnFilters.find((f) => f.column === col) && (
                          <button
                            onClick={() => updateFilter(col, "")}
                            className="absolute right-1 top-1/2 -translate-y-1/2 p-0.5 text-slate-500 hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              )}
            </thead>
            <tbody>
              {pageData.map((row, i) => (
                <tr
                  key={i}
                  className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-3 py-2.5 text-slate-600 font-mono">
                    {page * PAGE_SIZE + i + 1}
                  </td>
                  {columnNames.map((col) => (
                    <td
                      key={col}
                      className="px-3 py-2.5 text-slate-300 max-w-[200px] truncate font-mono"
                    >
                      {String(row[col] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <p className="text-xs text-slate-500">
              Page {page + 1} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from(
                { length: Math.min(5, totalPages) },
                (_, idx) => {
                  const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                  const p = start + idx;
                  if (p >= totalPages) return null;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                        p === page
                          ? "bg-blue-500/20 text-blue-400"
                          : "text-slate-400 hover:bg-white/5"
                      }`}
                    >
                      {p + 1}
                    </button>
                  );
                }
              )}
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {data.length === 0 && (
        <div className="glass-card p-12 text-center">
          <Table2 className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No data available</p>
        </div>
      )}
    </div>
  );
}
