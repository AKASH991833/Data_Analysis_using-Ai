import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateChartRecommendations } from "@/lib/analytics-engine";
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

    let rows = (dataset.cleanedData || dataset.rawData || []) as Record<string, unknown>[];

    // Apply filters
    if (filterCol && filterVal && filterVal !== "All") {
      rows = rows.filter((r) => String(r[filterCol]).toLowerCase() === filterVal.toLowerCase());
    }

    const profile = dataset.profile as DataProfile;
    const columnMetas = (dataset.columns || []) as ColumnMeta[];

    const charts = generateChartRecommendations(rows, profile, columnMetas);

    return NextResponse.json(charts);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate charts" },
      { status: 500 }
    );
  }
}
