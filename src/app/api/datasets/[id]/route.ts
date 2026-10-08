import { datasetRows, deleteRows } from "@/lib/row-store";
import { filterDatasetRows } from "@/lib/dataset-filters";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateKPIs, profileData, generateInsights } from "@/lib/analytics-engine";
import type { ColumnMeta, DataProfile } from "@/db/schema";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const filterCol = searchParams.get("filterCol");
    const filterVal = searchParams.get("filterVal");

    const [dataset] = await db
      .select()
      .from(datasets)
      .where(eq(datasets.id, id))
      .limit(1);

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    if ((filterCol && filterVal && filterVal !== "All") || searchParams.get("filterCol2") || (searchParams.get("period") && searchParams.get("period") !== "all")) {
      const allRows = await datasetRows(dataset);
      const cleanedRows = allRows;
      const filteredCleaned = filterDatasetRows(cleanedRows, (dataset.columns || []) as ColumnMeta[], searchParams);
      const filteredRaw = filteredCleaned;
      const sourceMetas = (dataset.columns || []) as ColumnMeta[];
      const filteredRows = filteredCleaned;
      const { profile, columnMetas } = profileData(filteredRows, sourceMetas.map((m) => m.name));

      // Recompute KPIs on filtered data
      const filteredKPIs = generateKPIs(filteredRows, profile, columnMetas, dataset.domain || "");

      // Compute columnValues from allRows (unfiltered for slicer options)
      const valCols = [...(profile?.categoricalColumns || []), ...(profile?.locationColumns || [])];
      const colVals: Record<string, string[]> = {};
      for (const col of valCols) {
        const vals = [...new Set(allRows.map((r) => String(r[col] ?? "")).filter(Boolean))] as string[];
        colVals[col] = vals.slice(0, 100);
      }

      // Strip raw data
      const { rawData, cleanedData, ...meta } = dataset;
      return NextResponse.json({
        ...meta,
        kpis: filteredKPIs,
        profile, columns: columnMetas,
        insights: generateInsights(filteredRows, profile, columnMetas, dataset.domain || ""),
        rowCount: filteredRaw.length,
        filtered: true,
        filterApplied: `${filterCol} = ${filterVal}`,
        columnValues: colVals,
      });
    }

    const activeRows = await datasetRows(dataset);
    const recomputed = profileData(activeRows, ((dataset.columns || []) as ColumnMeta[]).map((m) => m.name));
    dataset.columns = recomputed.columnMetas; dataset.profile = recomputed.profile;
    dataset.kpis = generateKPIs(activeRows, recomputed.profile, recomputed.columnMetas, dataset.domain || "");
    dataset.insights = generateInsights(activeRows, recomputed.profile, recomputed.columnMetas, dataset.domain || "");
    // Include distinct values for slicer columns (from raw data)
    const allRows = await datasetRows(dataset, "raw");
    const dsProfile = dataset.profile as DataProfile | null;
    const columnValues: Record<string, string[]> = {};
    const valueCols = [...(dsProfile?.categoricalColumns || []), ...(dsProfile?.locationColumns || [])];
    for (const col of valueCols) {
      const vals = [...new Set(allRows.map((r) => String(r[col] ?? "")).filter(Boolean))] as string[];
      columnValues[col] = vals.slice(0, 100);
    }

    // Strip raw data from response to keep initial load fast
    const { rawData, cleanedData, ...meta } = dataset;
    return NextResponse.json({ ...meta, filtered: false, columnValues });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch dataset" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.delete(datasets).where(eq(datasets.id, id));
    await deleteRows(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete dataset" },
      { status: 500 }
    );
  }
}
