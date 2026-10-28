import { datasetRows, saveRows } from "@/lib/row-store";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const [dataset] = await db
      .select()
      .from(datasets)
      .where(eq(datasets.id, id))
      .limit(1);

    if (!dataset) {
      return NextResponse.json({ error: "Dataset not found" }, { status: 404 });
    }

    const rows = await datasetRows(dataset);

    // Stream the JSON so large datasets are not blocked by the 4.5MB buffered response cap.
    const enc = new TextEncoder();
    const head = `{"totalRows":${JSON.stringify(dataset.rowCount)},"returnedRows":${rows.length},"rows":[`;
    let i = 0;
    const stream = new ReadableStream<Uint8Array>({
      start(c) { c.enqueue(enc.encode(head)); },
      pull(c) {
        if (i >= rows.length) { c.enqueue(enc.encode("]}")); c.close(); return; }
        const part = rows.slice(i, i + 500);
        c.enqueue(enc.encode((i ? "," : "") + part.map((r) => JSON.stringify(r)).join(",")));
        i += 500;
      },
    });
    return new Response(stream, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch rows" },
      { status: 500 }
    );
  }
}

// In-app cell editing. One cell at a time: { rowIndex, column, value }.
// Writes back to wherever the rows live (inline JSON for small datasets, chunk table for large ones).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => null) as { rowIndex?: unknown; column?: unknown; value?: unknown } | null;
    if (!body || !Number.isInteger(body.rowIndex) || (body.rowIndex as number) < 0 || typeof body.column !== "string") {
      return NextResponse.json({ error: "rowIndex (number) and column (string) are required" }, { status: 400 });
    }
    if (typeof body.value !== "string" || body.value.length > 500) {
      return NextResponse.json({ error: "value must be a string up to 500 characters" }, { status: 400 });
    }
    const [dataset] = await db.select().from(datasets).where(eq(datasets.id, id)).limit(1);
    if (!dataset) return NextResponse.json({ error: "Dataset not found" }, { status: 404 });

    const metas = (dataset.columns || []) as { name: string; type: string }[];
    const meta = metas.find((m) => m.name === body.column);
    if (!meta || ["__proto__", "prototype", "constructor"].includes(meta.name)) {
      return NextResponse.json({ error: "Unknown column" }, { status: 400 });
    }

    const rows = await datasetRows(dataset);
    const idx = body.rowIndex as number;
    if (idx >= rows.length) return NextResponse.json({ error: "Row index out of range" }, { status: 400 });

    let value: unknown = body.value;
    if (meta.type === "number" && body.value.trim() !== "") {
      const n = Number(body.value.replace(/[,\s]/g, ""));
      if (!Number.isFinite(n)) return NextResponse.json({ error: "This column is numeric; enter a number." }, { status: 400 });
      value = n;
    }
    rows[idx] = { ...rows[idx], [meta.name]: value };

    if (Array.isArray(dataset.cleanedData) || Array.isArray(dataset.rawData)) {
      await db.update(datasets).set({ cleanedData: rows }).where(eq(datasets.id, id));
    } else {
      await saveRows(id, "cleaned", rows);
    }
    return NextResponse.json({ ok: true, row: rows[idx] });
  } catch {
    return NextResponse.json({ error: "Failed to save edit" }, { status: 500 });
  }
}
