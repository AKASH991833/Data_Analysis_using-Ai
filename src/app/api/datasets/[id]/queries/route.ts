import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { queries } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const history = await db
      .select()
      .from(queries)
      .where(eq(queries.datasetId, id))
      .orderBy(desc(queries.createdAt))
      .limit(50);

    return NextResponse.json(history);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch query history" },
      { status: 500 }
    );
  }
}
