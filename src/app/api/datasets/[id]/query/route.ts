import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets, queries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { processNLQuery } from "@/lib/analytics-engine";
import type { ColumnMeta, DataProfile } from "@/db/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { question } = await req.json();

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    const [dataset] = await db
      .select()
      .from(datasets)
      .where(eq(datasets.id, id))
      .limit(1);

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const rows = (dataset.cleanedData || dataset.rawData || []) as Record<string, unknown>[];
    const profile = dataset.profile as DataProfile;
    const columnMetas = (dataset.columns || []) as ColumnMeta[];

    const result = processNLQuery(question, rows, profile, columnMetas);

    // Save query
    await db.insert(queries).values({
      id: uuidv4(),
      datasetId: id,
      question,
      answer: result.answer,
      chartConfig: result.chart ? (result.chart as unknown as Record<string, unknown>) : null,
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to process query" },
      { status: 500 }
    );
  }
}
