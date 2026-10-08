import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets, queries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { queryWithGemini } from "@/lib/gemini-query";
import { processNLQuery, profileData } from "@/lib/analytics-engine";
import type { ColumnMeta } from "@/db/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { question } = await req.json();

    if (!question || typeof question !== "string" || !question.trim() || question.length > 2000) {
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
    const { profile, columnMetas } = profileData(rows, ((dataset.columns || []) as ColumnMeta[]).map((m) => m.name));

    let result;
    try { result = await queryWithGemini(question, rows, columnMetas); } catch { /* Safe local fallback on service failure; no raw provider errors exposed. */ }
    result ??= { ...processNLQuery(question, rows, profile, columnMetas), engine: "local" };

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
