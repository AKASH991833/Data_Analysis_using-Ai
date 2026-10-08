import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/db";
import { ensureRowTables } from "@/lib/row-store";
import { analyzeAndStoreChunked, MAX_ANALYZED_ROWS, UserError } from "@/lib/ingest";

export const maxDuration = 60;

// Large-file upload. The browser streams the file locally and sends parsed rows
// in batches under Vercel's 4.5MB request cap; "finish" analyses and saves them.
const MAX_BATCH_BYTES = 4_000_000;
const MAX_STAGED_BYTES = 90_000_000;
const ID_RE = /^[0-9a-f-]{36}$/;

export async function POST(req: NextRequest) {
  try {
    const raw = await req.text();
    if (raw.length > MAX_BATCH_BYTES + 5000) return NextResponse.json({ error: "Batch too large" }, { status: 413 });
    const body = JSON.parse(raw) as { op?: string; uploadId?: string; idx?: number; rows?: unknown; fileName?: string; sizeBytes?: number; totalRows?: number };
    const uploadId = body.uploadId || "";
    if (!ID_RE.test(uploadId)) return NextResponse.json({ error: "Invalid upload id" }, { status: 400 });
    await ensureRowTables();

    if (body.op === "batch") {
      if (!body.idx) await pool.query("DELETE FROM upload_staging WHERE created_at < (NOW() - INTERVAL 1 DAY)");
      if (!Array.isArray(body.rows) || !Number.isInteger(body.idx) || (body.idx as number) < 0) return NextResponse.json({ error: "Invalid batch" }, { status: 400 });
      if (body.rows.some((r) => !r || typeof r !== "object" || Array.isArray(r))) return NextResponse.json({ error: "Rows must be objects" }, { status: 400 });
      const [sum] = await pool.query("SELECT COALESCE(SUM(bytes),0) AS b FROM upload_staging WHERE upload_id = ?", [uploadId]);
      const staged = Number((sum as { b: number }[])[0].b);
      const data = JSON.stringify(body.rows);
      if (staged + data.length > MAX_STAGED_BYTES) return NextResponse.json({ error: "Too much data for the free database. Only part of the file can be analysed.", full: true }, { status: 413 });
      await pool.query("REPLACE INTO upload_staging (upload_id, idx, data, bytes) VALUES (?, ?, ?, ?)", [uploadId, body.idx, data, data.length]);
      return NextResponse.json({ ok: true });
    }

    if (body.op === "finish") {
      const [res] = await pool.query("SELECT data FROM upload_staging WHERE upload_id = ? ORDER BY idx", [uploadId]);
      let rows: Record<string, unknown>[] = [];
      for (const r of res as { data: unknown }[]) {
        const part = (typeof r.data === "string" ? JSON.parse(r.data) : r.data) as Record<string, unknown>[];
        rows = rows.concat(part);
        if (rows.length >= MAX_ANALYZED_ROWS) break;
      }
      rows = rows.slice(0, MAX_ANALYZED_ROWS);
      const fileName = String(body.fileName || "upload.csv").slice(0, 200);
      const totalRows = Math.max(Number(body.totalRows) || rows.length, rows.length);
      const out = await analyzeAndStoreChunked({ rows, fileName, sizeBytes: Math.min(Number(body.sizeBytes) || 0, 2_000_000_000), totalRows });
      await pool.query("DELETE FROM upload_staging WHERE upload_id = ?", [uploadId]);
      return NextResponse.json(out);
    }

    if (body.op === "abort") {
      await pool.query("DELETE FROM upload_staging WHERE upload_id = ?", [uploadId]);
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Unknown operation" }, { status: 400 });
  } catch (error) {
    if (error instanceof UserError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error("Chunked upload error:", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
  }
}
