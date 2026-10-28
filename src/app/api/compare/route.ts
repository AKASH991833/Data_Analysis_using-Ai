import { datasetRows } from "@/lib/row-store";
import { parseNumeric } from "@/lib/analytics-engine";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import type { ColumnMeta } from "@/db/schema";

export const maxDuration = 60;

const ID_RE = /^[0-9a-f-]{36}$/;
const MAX_NUMERIC = 6;
const MAX_GROUPS = 5;

interface SideSummary {
  id: string;
  name: string;
  rowCount: number;
  numeric: Record<string, { sum: number; average: number }>;
  groups: Record<string, { value: string; count: number }[]>;
}

function summarize(id: string, name: string, rows: Record<string, unknown>[], numericCols: string[], catCols: string[]): SideSummary {
  const numeric: Record<string, { sum: number; average: number }> = {};
  const sums = new Map<string, { sum: number; n: number }>(numericCols.map((c) => [c, { sum: 0, n: 0 }]));
  const groups = new Map<string, Map<string, number>>(catCols.map((c) => [c, new Map()]));
  for (const row of rows) {
    for (const c of numericCols) {
      const v = parseNumeric(row[c]);
      if (v !== null) { const s = sums.get(c)!; s.sum += v; s.n++; }
    }
    for (const c of catCols) {
      const v = row[c];
      if (v == null) continue;
      const m = groups.get(c)!;
      const k = String(v).slice(0, 60);
      m.set(k, (m.get(k) || 0) + 1);
    }
  }
  for (const c of numericCols) {
    const s = sums.get(c)!;
    numeric[c] = { sum: Math.round(s.sum * 100) / 100, average: s.n ? Math.round((s.sum / s.n) * 100) / 100 : 0 };
  }
  const groupOut: Record<string, { value: string; count: number }[]> = {};
  for (const c of catCols) {
    groupOut[c] = [...groups.get(c)!.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_GROUPS)
      .map(([value, count]) => ({ value, count }));
  }
  return { id, name, rowCount: rows.length, numeric, groups: groupOut };
}

export async function GET(req: NextRequest) {
  try {
    const a = req.nextUrl.searchParams.get("a") || "";
    const b = req.nextUrl.searchParams.get("b") || "";
    if (!ID_RE.test(a) || !ID_RE.test(b) || a === b) {
      return NextResponse.json({ error: "Two different dataset ids are required" }, { status: 400 });
    }
    const found = await db.select().from(datasets).where(inArray(datasets.id, [a, b]));
    const da = found.find((d) => d.id === a);
    const dbb = found.find((d) => d.id === b);
    if (!da || !dbb) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

    const colsA = (da.columns || []) as ColumnMeta[];
    const colsB = (dbb.columns || []) as ColumnMeta[];
    const numB = new Set(colsB.filter((c) => c.type === "number" && c.semanticType !== "identifier").map((c) => c.name));
    const catB = new Set(colsB.filter((c) => c.type === "string" && !c.isKey && c.uniqueCount >= 2 && c.uniqueCount <= 60).map((c) => c.name));
    const commonNumeric = colsA.filter((c) => c.type === "number" && c.semanticType !== "identifier" && numB.has(c.name)).map((c) => c.name).slice(0, MAX_NUMERIC);
    const commonCategorical = colsA.filter((c) => c.type === "string" && !c.isKey && catB.has(c.name)).map((c) => c.name).slice(0, 2);

    if (commonNumeric.length === 0 && commonCategorical.length === 0) {
      return NextResponse.json({ error: "No common columns to compare. The two datasets share no numeric or categorical column names.", a: da.name, b: dbb.name }, { status: 400 });
    }

    const [rowsA, rowsB] = await Promise.all([datasetRows(da), datasetRows(dbb)]);
    return NextResponse.json({
      a: summarize(da.id, da.name, rowsA, commonNumeric, commonCategorical),
      b: summarize(dbb.id, dbb.name, rowsB, commonNumeric, commonCategorical),
      commonNumeric,
      commonCategorical,
    });
  } catch {
    return NextResponse.json({ error: "Failed to compare datasets" }, { status: 500 });
  }
}
