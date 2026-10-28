import { datasetRows } from "@/lib/row-store";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets, queries } from "@/db/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { queryWithGemini, resolveFollowUpLocally, validateQueryPlan, type QueryHistoryItem } from "@/lib/gemini-query";
import { processNLQuery, profileData } from "@/lib/analytics-engine";
import type { ColumnMeta } from "@/db/schema";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { question } = body;

    if (!question || typeof question !== "string" || !question.trim() || question.length > 2000) {
      return NextResponse.json(
        { error: "Question is required" },
        { status: 400 }
      );
    }

    // Follow-up context from the client conversation. Validated and capped; treated as untrusted text.
    const history: QueryHistoryItem[] = Array.isArray(body.history)
      ? body.history
          .filter((h: unknown) => h && typeof h === "object" && typeof (h as QueryHistoryItem).question === "string" && typeof (h as QueryHistoryItem).answer === "string")
          .slice(-6)
          .map((h: QueryHistoryItem) => ({ question: h.question.slice(0, 300), answer: h.answer.slice(0, 500) }))
      : [];

    const [dataset] = await db
      .select()
      .from(datasets)
      .where(eq(datasets.id, id))
      .limit(1);

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const rows = await datasetRows(dataset);
    const { profile, columnMetas } = profileData(rows, ((dataset.columns || []) as ColumnMeta[]).map((m) => m.name));

    const previousPlan = body.previousPlan ? validateQueryPlan(body.previousPlan, columnMetas) : null;

    let result;
    // Local follow-up first: "aur North ka?" style questions re-run the previous plan
    // with a matched filter value. Fully local - nothing leaves the server.
    if (previousPlan) {
      const followUp = resolveFollowUpLocally(question, columnMetas, rows, previousPlan);
      if (followUp) {
        const { executeQueryPlan } = await import("@/lib/analytics-engine");
        result = { ...executeQueryPlan(followUp, rows, columnMetas), engine: "local", interpretedPlan: followUp };
      }
    }
    if (!result) {
      try { result = await queryWithGemini(question, rows, columnMetas, history); } catch (error) { console.warn("Gemini fallback", error instanceof Error ? error.name : "unknown"); /* No provider body or secrets logged. */ }
    }
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
