"use client";

import React, { useState } from "react";
import { Filter, Plus, X } from "lucide-react";

interface Props {
  filters: Record<string, string>;
  columns: string[];
  columnValues: Record<string, string[]>;
  onChange: (next: Record<string, string>) => void;
  max?: number;
}

/** Active-filter chips plus an "Add filter" picker. Shared by the dashboard and the public share view. */
export function FilterChips({ filters, columns, columnValues, onChange, max = 4 }: Props) {
  const [adding, setAdding] = useState(false);
  const [col, setCol] = useState("");
  const entries = Object.entries(filters);
  const free = columns.filter((c) => !(c in filters) && (columnValues[c]?.length ?? 0) > 0);

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/5" data-testid="filter-chips">
      <div className="flex items-center gap-1.5 text-[10px] text-slate-500 mr-1"><Filter className="w-3 h-3" />FILTERS</div>
      {entries.length === 0 && <span className="text-[11px] text-slate-600">None. Click a bar or slice in any chart, or add one.</span>}
      {entries.map(([c, v]) => (
        <span key={c} className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-[11px] text-blue-200">
          <span className="text-blue-400/80">{c}</span> = <span className="font-semibold">{v}</span>
          <button onClick={() => { const n = { ...filters }; delete n[c]; onChange(n); }} className="p-0.5 rounded-full hover:bg-blue-500/30" aria-label={`Remove filter ${c}`}><X className="w-3 h-3" /></button>
        </span>
      ))}
      {entries.length > 0 && <button onClick={() => onChange({})} className="text-[11px] text-slate-400 hover:text-white underline underline-offset-2">Clear all</button>}
      {entries.length < max && free.length > 0 && !adding && (
        <button onClick={() => { setAdding(true); setCol(free[0]); }} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-white/15 text-[11px] text-slate-400 hover:text-white hover:border-white/30"><Plus className="w-3 h-3" />Add filter</button>
      )}
      {adding && (
        <span className="inline-flex items-center gap-1.5">
          <select value={col} onChange={(e) => setCol(e.target.value)} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 outline-none">
            {free.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select defaultValue="" onChange={(e) => { if (e.target.value) { onChange({ ...filters, [col]: e.target.value }); setAdding(false); } }} className="px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-[11px] text-slate-300 outline-none max-w-[180px]">
            <option value="" disabled>Pick value…</option>
            {(columnValues[col] || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          <button onClick={() => setAdding(false)} className="p-1 text-slate-500 hover:text-white"><X className="w-3 h-3" /></button>
        </span>
      )}
    </div>
  );
}
