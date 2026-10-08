import { datasetRows } from "@/lib/row-store";
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
