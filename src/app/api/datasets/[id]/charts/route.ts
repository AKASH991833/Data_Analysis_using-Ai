import { datasetRows } from "@/lib/row-store";
import { filterDatasetRows } from "@/lib/dataset-filters";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateChartRecommendations, profileData } from "@/lib/analytics-engine";
import type { ColumnMeta } from "@/db/schema";
import { getDashboardPlan, planCharts } from "@/lib/dashboard-plan";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = req.nextUrl;

    const [dataset] = await db
      .select()
      .from(datasets)
      .where(eq(datasets.id, id))
      .limit(1);

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    let rows = await datasetRows(dataset);

    rows = filterDatasetRows(rows, (dataset.columns || []) as ColumnMeta[], searchParams);

    const names = ((dataset.columns || []) as ColumnMeta[]).map((m) => m.name);
    const { profile, columnMetas } = profileData(rows, names);

    const plan = await getDashboardPlan(dataset.id, (dataset.columns || []) as ColumnMeta[], profile, dataset.domain || "");
    const planned = plan ? planCharts(plan, rows) : [];
    const charts = planned.length >= 3 ? planned : generateChartRecommendations(rows, profile, columnMetas);

    return NextResponse.json(charts);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate charts" },
      { status: 500 }
    );
  }
}
