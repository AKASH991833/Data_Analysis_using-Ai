import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import type { ColumnMeta, DataProfile } from "@/db/schema";
import { eq } from "drizzle-orm";
import { datasetRows } from "@/lib/row-store";
import { filterDatasetRows } from "@/lib/dataset-filters";
import { getDashboardPlan, planKpis, planCharts } from "@/lib/dashboard-plan";
import { generateChartRecommendations, generateInsights, generateKPIs, profileData } from "@/lib/analytics-engine";
import { shareByToken } from "@/lib/share";

export const maxDuration = 60;

// Public, read-only. Resolves ONE dataset from the unguessable token and returns aggregates
// plus a short row preview. No ids, credentials or other datasets are ever included.
export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    const share = await shareByToken(token);
    if (!share) return NextResponse.json({ error: "This link is invalid or has been revoked." }, { status: 404 });
    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, share.dataset_id)).limit(1);
    if (!dataset) return NextResponse.json({ error: "This link is invalid or has been revoked." }, { status: 404 });

    const all = await datasetRows(dataset);
    const columns = (dataset.columns || []) as ColumnMeta[];
    const rows = filterDatasetRows(all, columns, req.nextUrl.searchParams);
    const names = columns.map((m) => m.name);
    const { profile, columnMetas } = profileData(rows, names);
    const base = profileData(all, names).profile as DataProfile;
    const columnValues: Record<string, string[]> = {};
    for (const col of [...base.categoricalColumns, ...base.locationColumns]) {
      columnValues[col] = [...new Set(all.map((r) => String(r[col] ?? "")).filter(Boolean))].slice(0, 100);
    }
    const domain = dataset.domain || "";
    const plan = await getDashboardPlan(dataset.id, columns, base, domain);
    const plannedCharts = plan ? planCharts(plan, rows) : [];
    const res = NextResponse.json({
      name: dataset.name,
      domain,
      rowCount: rows.length,
      totalRows: all.length,
      columnCount: names.length,
      profile: { qualityScore: profile.qualityScore, categoricalColumns: base.categoricalColumns, locationColumns: base.locationColumns },
      kpis: plan ? planKpis(plan, rows, profile) : generateKPIs(rows, profile, columnMetas, domain),
      insights: generateInsights(rows, profile, columnMetas, domain),
      charts: plannedCharts.length >= 3 ? plannedCharts : generateChartRecommendations(rows, profile, columnMetas),
      columnValues,
      columns: names,
      preview: rows.slice(0, 100),
      sharedAt: share.created_at,
    });
    res.headers.set("Cache-Control", "no-store");
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
    return res;
  } catch (e) {
    const msg = e instanceof Error && /filter|period/i.test(e.message) ? e.message : "Failed to load shared dashboard";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
