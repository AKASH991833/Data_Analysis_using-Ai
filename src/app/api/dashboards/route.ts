import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { dashboards } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const datasetId = searchParams.get("datasetId");

    const query = db
      .select()
      .from(dashboards)
      .orderBy(desc(dashboards.updatedAt || dashboards.createdAt));

    const allDashboards = datasetId
      ? await query.where(eq(dashboards.datasetId, datasetId))
      : await query;

    return NextResponse.json(allDashboards);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch dashboards" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { datasetId, name, description } = body;

    if (!datasetId || !name) {
      return NextResponse.json(
        { error: "datasetId and name are required" },
        { status: 400 }
      );
    }

    const dashboardId = uuidv4();
    await db.insert(dashboards).values({
      id: dashboardId,
      datasetId,
      name,
      description: description || null,
      widgets: [],
      layout: null,
      isPublic: false,
    });

    return NextResponse.json({ id: dashboardId, name });
  } catch {
    return NextResponse.json(
      { error: "Failed to create dashboard" },
      { status: 500 }
    );
  }
}
