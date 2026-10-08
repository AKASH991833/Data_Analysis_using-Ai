"use client";

import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Table2, Loader2, Download, GripVertical, X, Plus,
  ChevronRight, ChevronDown, Sigma, Hash, Type,
  Percent, Copy, Check, ArrowUpDown, Search,
} from "lucide-react";
import type { ColumnMeta } from "@/db/schema";
import { parseNumeric } from "@/lib/analytics-engine";
import { cn } from "@/lib/utils";

interface PivotTabProps {
  datasetId: string;
  columns: ColumnMeta[];
}

interface PivotField {
  column: string;
  aggregation?: "sum" | "avg" | "count" | "min" | "max";
}

type DropZone = "rows" | "columns" | "values" | "filters";

interface PivotResult {
  colKeys: string[];
  rowKeys: { keys: Record<string, string>; depth: number; count: number }[];
  matrix: Record<string, Record<string, number>>;
  grandTotals: Record<string, number>;
  colTotals: Record<string, number>;
}

const AGG_LABELS: Record<string, string> = {
  sum: "Sum", avg: "Avg", count: "Count", min: "Min", max: "Max",
};

const AGG_OPTIONS: { value: string; label: string }[] = [
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Avg" },
  { value: "count", label: "Count" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
];

const CONDITIONAL_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981", "#06b6d4", "#3b82f6", "#8b5cf6"];

function formatCellValue(val: number, asPercent: boolean, total: number): string {
  if (asPercent && total > 0) return ((val / total) * 100).toFixed(1) + "%";
  if (Math.abs(val) >= 1_000_000) return (val / 1_000_000).toFixed(2) + "M";
  if (Math.abs(val) >= 1_000) return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getConditionalColor(val: number, maxVal: number, minVal: number): string {
  if (maxVal === minVal) return "rgba(59,130,246,0.1)";
  const ratio = (val - minVal) / (maxVal - minVal);
  const r = Math.round(239 - ratio * 195);
  const g = Math.round(68 + ratio * 120);
  const b = Math.round(68 - ratio * 28);
  return `rgba(${r},${g},${b},0.15)`;
}

function ChevronUpIcon() {
  return <ChevronDown className="w-3 h-3 rotate-180" />;
}

const COPY_FEEDBACK_DURATION = 1500;

export function PivotTab({ datasetId, columns }: PivotTabProps) {
  const [allRows, setAllRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [dragField, setDragField] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<DropZone | null>(null);
  const [rowFields, setRowFields] = useState<PivotField[]>([]);
  const [colFields, setColFields] = useState<PivotField[]>([]);
  const [valueFields, setValueFields] = useState<PivotField[]>([]);
  const [filterFields, setFilterFields] = useState<PivotField[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [showPercent, setShowPercent] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [pivotSearch, setPivotSearch] = useState("");

  useEffect(() => {
    fetch(`/api/datasets/${datasetId}/rows`)
      .then((r) => r.json())
      .then((res) => setAllRows(res.rows || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [datasetId]);

  const numericCols = useMemo(
    () => columns.filter((c) =>
      c.type === "number" || c.type === "float" || c.type === "int" ||
      c.semanticType === "currency" || c.semanticType === "numeric"
    ),
    [columns]
  );

  const categoricalCols = useMemo(
    () => columns.filter((c) =>
      c.type === "string" || c.type === "text" ||
      (c.semanticType !== "currency" && c.semanticType !== "numeric")
    ),
    [columns]
  );

  const availableCols = useMemo(() => {
    const used = new Set([
      ...rowFields.map((f) => f.column),
      ...colFields.map((f) => f.column),
      ...valueFields.map((f) => f.column),
      ...filterFields.map((f) => f.column),
    ]);
    return columns.filter((c) => !used.has(c.name));
  }, [columns, rowFields, colFields, valueFields, filterFields]);

  const addField = useCallback((zone: DropZone, col: string) => {
    const isNumeric = numericCols.some((c) => c.name === col);
    const field: PivotField = isNumeric ? { column: col, aggregation: "sum" } : { column: col };
    if (zone === "columns" && colFields.length > 0) return;
    const setter = zone === "rows" ? setRowFields : zone === "columns" ? setColFields : zone === "values" ? setValueFields : setFilterFields;
    setter((prev) => [...prev, field]);
  }, [numericCols, colFields]);

  const removeField = useCallback((zone: DropZone, idx: number) => {
    const setter = zone === "rows" ? setRowFields : zone === "columns" ? setColFields : zone === "values" ? setValueFields : setFilterFields;
    setter((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const moveField = useCallback((zone: DropZone, from: number, to: number) => {
    const setter = zone === "rows" ? setRowFields : zone === "columns" ? setColFields : zone === "values" ? setValueFields : setFilterFields;
    setter((prev) => {
      const arr = [...prev];
      const [moved] = arr.splice(from, 1);
      arr.splice(to, 0, moved);
      return arr;
    });
  }, []);

  const updateAgg = useCallback((idx: number, agg: string) => {
    setValueFields((prev) => prev.map((f, i) =>
      i === idx ? { ...f, aggregation: agg as PivotField["aggregation"] } : f
    ));
  }, []);

  const onDragStart = (col: string) => setDragField(col);
  const onDragEnd = () => { setDragField(null); setDragOverZone(null); };

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const copyToClipboard = useCallback(async (val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(val);
      setTimeout(() => setCopiedKey(null), COPY_FEEDBACK_DURATION);
    } catch {}
  }, []);

  const toggleSort = useCallback((key: string) => {
    setSortCol((prev) => prev === key ? key : key);
    setSortAsc((prev) => sortCol === key ? !prev : false);
  }, [sortCol]);

  const pivotResult = useMemo((): PivotResult | null => {
    if (!valueFields.length || !allRows.length) return null;
    const rowKeyFields = rowFields.map((f) => f.column);
    const colKeyField = colFields[0]?.column;

    const colKeys: string[] = colKeyField
      ? Array.from(new Set(allRows.map((r) => String(r[colKeyField] ?? "(blank)")))).sort()
      : ["(total)"];

    const groups = new Map<string, Record<string, unknown>[]>();
    for (const row of allRows) {
      const key = rowKeyFields.map((f) => String(row[f] ?? "(blank)")).join("|||");
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(row);
    }

    const rowCountMap = new Map<string, number>();
    const matrix: Record<string, Record<string, number>> = {};
    const rowKeys: { keys: Record<string, string>; depth: number; count: number }[] = [];

    for (const [compositeKey, group] of groups) {
      rowCountMap.set(compositeKey, group.length);
      const keyParts = compositeKey.split("|||");
      const keys: Record<string, string> = {};
      rowKeyFields.forEach((f, i) => { keys[f] = keyParts[i]; });
      rowKeys.push({ keys, depth: keyParts.length, count: group.length });
      matrix[compositeKey] = {};

      for (const colKey of colKeys) {
        let subset = group;
        if (colKeyField && colKey !== "(total)") {
          subset = group.filter((r) => String(r[colKeyField]) === colKey);
        }
        for (const vf of valueFields) {
          const aggKey = `${colKey}||${vf.column}`;
          const vals = subset.map((r) => parseNumeric(r[vf.column])).filter((v): v is number => v !== null);
          let result = 0;
          switch (vf.aggregation) {
            case "sum": result = vals.reduce((a, b) => a + b, 0); break;
            case "avg": result = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0; break;
            case "count": result = subset.length; break;
            case "min": result = vals.length ? Math.min(...vals) : 0; break;
            case "max": result = vals.length ? Math.max(...vals) : 0; break;
            default: result = vals.reduce((a, b) => a + b, 0);
          }
          matrix[compositeKey][aggKey] = Math.round(result * 100) / 100;
        }
      }
      for (const vf of valueFields) {
        const allVals = group.map((r) => parseNumeric(r[vf.column])).filter((v): v is number => v !== null);
        let result = 0;
        switch (vf.aggregation) {
          case "sum": result = allVals.reduce((a, b) => a + b, 0); break;
          case "avg": result = allVals.length ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0; break;
          case "count": result = group.length; break;
          case "min": result = allVals.length ? Math.min(...allVals) : 0; break;
          case "max": result = allVals.length ? Math.max(...allVals) : 0; break;
          default: result = allVals.reduce((a, b) => a + b, 0);
        }
        matrix[compositeKey][`_total||${vf.column}`] = Math.round(result * 100) / 100;
      }
    }

    const grandTotals: Record<string, number> = {};
    const colTotals: Record<string, number> = {};
    for (const vf of valueFields) {
      const allVals = allRows.map((r) => parseNumeric(r[vf.column])).filter((v): v is number => v !== null);
      let result = 0;
      switch (vf.aggregation) {
        case "sum": result = allVals.reduce((a, b) => a + b, 0); break;
        case "avg": result = allVals.length ? allVals.reduce((a, b) => a + b, 0) / allVals.length : 0; break;
        case "count": result = allRows.length; break;
        case "min": result = allVals.length ? Math.min(...allVals) : 0; break;
        case "max": result = allVals.length ? Math.max(...allVals) : 0; break;
        default: result = allVals.reduce((a, b) => a + b, 0);
      }
      grandTotals[vf.column] = Math.round(result * 100) / 100;
    }

    for (const colKey of colKeys) {
      for (const vf of valueFields) {
        const aggKey = `${colKey}||${vf.column}`;
        const subset = colKeyField ? allRows.filter((r) => String(r[colKeyField] ?? "(blank)") === colKey) : allRows;
        const vals = subset.map((r) => parseNumeric(r[vf.column])).filter((v): v is number => v !== null);
        const total = vf.aggregation === "count" ? subset.length : vf.aggregation === "avg" ? (vals.length ? vals.reduce((a,b) => a+b,0)/vals.length : 0) : vf.aggregation === "min" ? (vals.length ? vals.reduce((a,b) => Math.min(a,b)) : 0) : vf.aggregation === "max" ? (vals.length ? vals.reduce((a,b) => Math.max(a,b)) : 0) : vals.reduce((a,b) => a+b,0);
        colTotals[aggKey] = Math.round(total * 100) / 100;
      }
    }

    return { colKeys, rowKeys, matrix, grandTotals, colTotals };
  }, [allRows, rowFields, colFields, valueFields]);

  const filteredRowKeys = useMemo(() => {
    if (!pivotResult) return [];
    if (!pivotSearch.trim()) return pivotResult.rowKeys;
    const q = pivotSearch.toLowerCase();
    return pivotResult.rowKeys.filter((rk) =>
      Object.values(rk.keys).some((v) => String(v).toLowerCase().includes(q))
    );
  }, [pivotResult, pivotSearch]);

  const allMatrixValues = useMemo(() => {
    if (!pivotResult) return { min: 0, max: 0 };
    const vals: number[] = [];
    for (const rk of pivotResult.rowKeys) {
      const ck = rowFields.map((f) => rk.keys[f.column]).join("|||");
      for (const col of pivotResult.colKeys) {
        for (const vf of valueFields) {
          const v = pivotResult.matrix[ck]?.[`${col}||${vf.column}`];
          if (v !== undefined) vals.push(v);
        }
      }
    }
    return { min: vals.length ? Math.min(...vals) : 0, max: vals.length ? Math.max(...vals) : 0 };
  }, [pivotResult, rowFields, valueFields]);

  const exportPivot = useCallback(() => {
    if (!pivotResult) return;
    const { colKeys, rowKeys, matrix } = pivotResult;
    const lines: string[] = [];
    const headers = [...rowFields.map((f) => f.column), ...colKeys, "Grand Total"];
    lines.push(headers.join(","));

    for (const rk of rowKeys) {
      const ck = rowFields.map((f) => rk.keys[f.column]).join("|||");
      const row = [...rowFields.map((f) => rk.keys[f.column])];
      for (const col of colKeys) {
        const key = `${col}||${valueFields[0]?.column}`;
        row.push(String(matrix[ck]?.[key] ?? ""));
      }
      row.push(String(matrix[ck]?.[`_total||${valueFields[0]?.column}`] ?? ""));
      lines.push(row.map((v) => `"${v}"`).join(","));
    }

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pivot_${datasetId.slice(0, 8)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pivotResult, rowFields, valueFields, datasetId]);

  const renderDropZone = (zone: DropZone, label: string) => {
    const fields = zone === "rows" ? rowFields : zone === "columns" ? colFields : zone === "values" ? valueFields : filterFields;

    return (
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOverZone(zone); }}
        onDragLeave={() => setDragOverZone(null)}
        onDrop={(e) => { e.preventDefault(); if (dragField) addField(zone, dragField); setDragField(null); setDragOverZone(null); }}
        className={cn(
          "min-h-[64px] rounded-xl border-2 border-dashed p-2.5 transition-all duration-200",
          dragOverZone === zone
            ? "border-blue-500/50 bg-blue-500/10 scale-[1.01]"
            : fields.length > 0
              ? "border-white/10 bg-white/[0.02]"
              : "border-white/5"
        )}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">{label}</span>
          {fields.length > 0 && <span className="ml-auto text-[10px] text-slate-600 bg-white/5 px-1.5 rounded">{fields.length}</span>}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {fields.map((f, idx) => (
            <div key={f.column + idx} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 group hover:bg-white/10 transition-colors">
              <span className="text-[11px] text-slate-300 font-medium">{f.column}</span>
              {zone === "values" && f.aggregation && (
                <select value={f.aggregation} onChange={(e) => updateAgg(idx, e.target.value)}
                  className="bg-transparent text-[10px] text-blue-400 border-none outline-none cursor-pointer font-medium appearance-none"
                >
                  {AGG_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              <button onClick={() => removeField(zone, idx)}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 transition-all p-0.5"
              ><X className="w-3 h-3" /></button>
            </div>
          ))}
          {fields.length === 0 && (
            <span className="text-[10px] text-slate-600 italic px-1">Drag columns here</span>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Table2 className="w-4 h-4 text-blue-400" />
          Pivot Table
        </h3>
        <div className="flex items-center gap-2">
          {pivotResult && (
            <>
              <button onClick={() => setShowPercent(!showPercent)}
                className={cn("flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] transition-all",
                  showPercent
                    ? "bg-blue-500/15 text-blue-400 border-blue-500/30"
                    : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                )}
              ><Percent className="w-3 h-3" /> %</button>
              <button onClick={exportPivot}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 hover:bg-white/10 transition-colors"
              ><Download className="w-3 h-3" /> CSV</button>
            </>
          )}
        </div>
      </div>

      {/* Available Columns */}
      <div className="glass-card p-3">
        <div className="text-[10px] uppercase tracking-widest text-slate-500 mb-2 font-medium">Available Columns</div>
        <div className="flex flex-wrap gap-1.5">
          {availableCols.map((col) => {
            const isNumeric = numericCols.some((c) => c.name === col.name);
            return (
              <div key={col.name} draggable
                onDragStart={() => onDragStart(col.name)}
                onDragEnd={onDragEnd}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 cursor-grab active:cursor-grabbing hover:bg-white/10 hover:border-blue-500/30 transition-all text-[11px] text-slate-300"
              >
                {isNumeric ? <Sigma className="w-3 h-3 text-blue-400" /> : <Type className="w-3 h-3 text-emerald-400" />}
                {col.name}
              </div>
            );
          })}
          {availableCols.length === 0 && (
            <span className="text-[10px] text-slate-600 italic">All columns assigned</span>
          )}
        </div>
      </div>

      {/* Drop Zones */}
      <div className="grid grid-cols-2 gap-3">
        {renderDropZone("rows", "Rows")}
        {renderDropZone("columns", "Columns")}
        {renderDropZone("values", "Values")}
        <p className="text-xs text-slate-500">Pivot supports one column field; use the table filters for row filtering.</p>
      </div>

      {/* Pivot Table */}
      {pivotResult && (
        <div className="glass-card overflow-hidden">
          {/* Search + Info bar */}
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-white/5">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
              <input type="text" value={pivotSearch} onChange={(e) => setPivotSearch(e.target.value)}
                placeholder="Filter rows..."
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 placeholder-slate-600 outline-none focus:border-blue-500/30"
              />
            </div>
            <span className="text-[10px] text-slate-500">
              {filteredRowKeys.length} of {pivotResult.rowKeys.length} rows
            </span>
            <span className="text-[10px] text-slate-500">
              {pivotResult.colKeys.length} columns
            </span>
            <span className="text-[10px] text-slate-500">
              {allRows.length.toLocaleString()} total records
            </span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-dark-card">
                  {rowFields.map((f) => (
                    <th key={f.column}
                      className="sticky top-0 z-10 px-3 py-2.5 text-left text-slate-500 font-medium whitespace-nowrap bg-dark-card border-b border-white/5 text-[10px] uppercase tracking-wider cursor-pointer hover:text-slate-300 select-none"
                      onClick={() => toggleSort(f.column)}
                    >
                      <div className="flex items-center gap-1">
                        {f.column}
                        {sortCol === f.column && <ArrowUpDown className="w-2.5 h-2.5" />}
                      </div>
                    </th>
                  ))}
                  {pivotResult.colKeys.map((col) => (
                    <th key={col}
                      className="sticky top-0 z-10 px-3 py-2.5 text-right text-slate-500 font-medium whitespace-nowrap bg-dark-card border-b border-white/5 text-[10px] uppercase tracking-wider cursor-pointer hover:text-slate-300 select-none"
                      colSpan={valueFields.length}
                      onClick={() => toggleSort(col)}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {col}
                        {sortCol === col && <ArrowUpDown className="w-2.5 h-2.5" />}
                      </div>
                    </th>
                  ))}
                  <th className="sticky top-0 z-10 px-3 py-2.5 text-right text-slate-500 font-medium bg-dark-card border-b border-white/5 text-[10px] uppercase tracking-wider">
                    Grand Total
                  </th>
                </tr>
                {valueFields.length > 1 && (
                  <tr className="bg-dark-card/50">
                    {rowFields.map((f) => <th key={f.column} className="px-3 py-1 text-left text-[10px] text-slate-600 font-mono border-b border-white/5" />)}
                    {pivotResult.colKeys.map((col) => valueFields.map((vf) => (
                      <th key={`${col}-${vf.column}`} className="px-3 py-1 text-right text-[10px] text-slate-600 font-mono border-b border-white/5">{AGG_LABELS[vf.aggregation || "sum"]}</th>
                    )))}
                    <th className="px-3 py-1 text-right text-[10px] text-slate-600 font-mono border-b border-white/5">{AGG_LABELS[valueFields[0]?.aggregation || "sum"]}</th>
                  </tr>
                )}
              </thead>
              <tbody>
                {filteredRowKeys.map((rk) => {
                  const ck = rowFields.map((f) => rk.keys[f.column]).join("|||");
                  const isFirst = rowFields.length > 1;
                  const firstField = rowFields[0]?.column;
                  const firstVal = firstField ? rk.keys[firstField] : "";
                  const isExpanded = expandedKeys.has(ck);

                  // Determine sort order
                  let sortedVals = valueFields;
                  if (sortCol) {
                    const sortedRowKeys = [...filteredRowKeys].sort((a, b) => {
                      const aCk = rowFields.map((f) => a.keys[f.column]).join("|||");
                      const bCk = rowFields.map((f) => b.keys[f.column]).join("|||");
                      const aVal = pivotResult.matrix[aCk]?.[`${sortCol}||${valueFields[0]?.column}`] || 0;
                      const bVal = pivotResult.matrix[bCk]?.[`${sortCol}||${valueFields[0]?.column}`] || 0;
                      return sortAsc ? aVal - bVal : bVal - aVal;
                    });
                    if (sortedRowKeys.indexOf(rk) === -1) return null;
                  }

                  return (
                    <tr key={ck} className="border-b border-white/[0.02] hover:bg-white/[0.03] transition-colors">
                      {rowFields.map((f, i) => (
                        <td key={f.column} className="px-3 py-1.5 text-slate-300 max-w-[180px] truncate">
                          <div className="flex items-center gap-1">
                            {i === 0 && isFirst && (
                              <button onClick={() => toggleExpand(ck)}
                                className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                              >
                                {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                              </button>
                            )}
                            <span style={{ paddingLeft: i * 16 }} className="font-medium text-[11px]">{rk.keys[f.column]}</span>
                          </div>
                        </td>
                      ))}
                      {pivotResult.colKeys.map((col) => valueFields.map((vf) => {
                        const key = `${col}||${vf.column}`;
                        const val = pivotResult.matrix[ck]?.[key] ?? 0;
                        const total = pivotResult.colTotals[key] || 1;
                        const bgColor = getConditionalColor(val, allMatrixValues.max, allMatrixValues.min);
                        return (
                          <td key={key}
                            className="px-3 py-1.5 text-right text-slate-300 font-mono tabular-nums cursor-pointer hover:ring-1 hover:ring-blue-500/30 rounded transition-all relative group/cell"
                            style={{ backgroundColor: bgColor }}
                            onClick={() => copyToClipboard(formatCellValue(val, showPercent, total))}
                            title="Click to copy"
                          >
                            <span className="text-[11px]">{formatCellValue(val, showPercent, total)}</span>
                            {copiedKey === formatCellValue(val, showPercent, total) && (
                              <span className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] px-1 rounded-full">
                                <Check className="w-2.5 h-2.5" />
                              </span>
                            )}
                          </td>
                        );
                      }))}
                      <td className="px-3 py-1.5 text-right text-slate-100 font-semibold font-mono tabular-nums bg-blue-500/5 border-l border-blue-500/10">
                        <span className="text-[11px]">{formatCellValue(
                          pivotResult.matrix[ck]?.[`_total||${valueFields[0]?.column}`] ?? 0,
                          false, 1
                        )}</span>
                      </td>
                    </tr>
                  );
                })}

                {/* Grand Total Row */}
                <tr className="bg-gradient-to-r from-blue-500/10 to-indigo-500/5 border-t-2 border-blue-500/20 sticky bottom-0">
                  <td className="px-3 py-2.5 text-xs font-bold text-blue-400" colSpan={rowFields.length}>
                    Grand Total
                  </td>
                  {pivotResult.colKeys.map((col) => valueFields.map((vf) => {
                    const key = `${col}||${vf.column}`;
                    const total = pivotResult.colTotals[key] || 0;
                    return (
                      <td key={key} className="px-3 py-2.5 text-right text-blue-300 font-bold font-mono tabular-nums">
                        <span className="text-[12px]">{formatCellValue(total, false, 1)}</span>
                      </td>
                    );
                  }))}
                  <td className="px-3 py-2.5 text-right text-blue-200 font-extrabold font-mono tabular-nums bg-blue-500/10 border-l border-blue-500/20">
                    <span className="text-[12px]">
                      {pivotResult.rowKeys.reduce((sum, rk) => {
                        const ck = rowFields.map((f) => rk.keys[f.column]).join("|||");
                        return sum + (pivotResult.matrix[ck]?.[`_total||${valueFields[0]?.column}`] || 0);
                      }, 0).toLocaleString()}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!pivotResult && (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-card">
          <Table2 className="w-12 h-12 text-slate-600 mb-4" />
          <h4 className="text-sm font-semibold text-slate-400 mb-2">Build Your Pivot Table</h4>
          <ol className="text-[11px] text-slate-500 space-y-1.5 text-left">
            <li>1. <span className="text-blue-400">Drag</span> a column from above to <span className="text-white/70">Rows</span></li>
            <li>2. <span className="text-blue-400">Drag</span> a numeric column to <span className="text-white/70">Values</span></li>
            <li>3. Optionally drag to <span className="text-white/70">Columns</span> for cross-tabulation</li>
            <li>4. Click a cell to <span className="text-white/70">copy</span> its value</li>
            <li>5. Click column headers to <span className="text-white/70">sort</span></li>
            <li>6. Toggle <span className="text-white/70">%</span> to show percentages</li>
          </ol>
        </div>
      )}
    </div>
  );
}
