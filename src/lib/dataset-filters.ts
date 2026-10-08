import type { ColumnMeta } from "@/db/schema";

export function filterDatasetRows(rows: Record<string, unknown>[], columns: ColumnMeta[], params: URLSearchParams, now = new Date()) {
  const filters: { column: string; value: string }[] = [];
  for (const suffix of ["", "2", "3", "4"]) {
    const column = params.get(`filterCol${suffix}`), value = params.get(`filterVal${suffix}`);
    if (column && value && value !== "All") {
      if (!columns.some((m) => m.name === column)) throw new Error("Unknown filter column");
      filters.push({ column, value });
    }
  }
  let selected = rows.filter((r) => filters.every(({ column, value }) => String(r[column] ?? "").trim().toLowerCase() === value.trim().toLowerCase()));
  const period = params.get("period") || "all";
  if (period !== "all") {
    const dateColumn = columns.find((m) => m.type === "date")?.name;
    if (!dateColumn) throw new Error("No date column available for this period filter");
    const end = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1);
    const start = period === "7d" ? end - 7*86400000 : period === "30d" ? end - 30*86400000 : period === "quarter" ? Date.UTC(now.getUTCFullYear(), Math.floor(now.getUTCMonth()/3)*3,1) : period === "year" ? Date.UTC(now.getUTCFullYear(),0,1) : NaN;
    if (!Number.isFinite(start)) throw new Error("Unsupported period");
    selected = selected.filter((r) => { const t = Date.parse(String(r[dateColumn])); return t >= start && t < end; });
  }
  return selected;
}

export function hasActiveFilters(params: URLSearchParams) {
  for (const suffix of ["", "2", "3", "4"]) {
    const c = params.get(`filterCol${suffix}`), v = params.get(`filterVal${suffix}`);
    if (c && v && v !== "All") return true;
  }
  const period = params.get("period");
  return !!period && period !== "all";
}
