import { pool } from "@/db";

// Large datasets exceed TiDB's per-row size limit if stored as one JSON cell,
// so rows live in ~1MB JSON chunks. Tables are created on first use.
let ready: Promise<void> | null = null;
export function ensureRowTables() {
  ready ??= (async () => {
    await pool.query("CREATE TABLE IF NOT EXISTS dataset_row_chunks (dataset_id VARCHAR(36) NOT NULL, kind VARCHAR(8) NOT NULL, idx INT NOT NULL, data JSON NOT NULL, PRIMARY KEY (dataset_id, kind, idx))");
    await pool.query("CREATE TABLE IF NOT EXISTS upload_staging (upload_id VARCHAR(36) NOT NULL, idx INT NOT NULL, data JSON NOT NULL, bytes INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (upload_id, idx))");
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

const CHUNK_BYTES = 1_000_000;

export async function saveRows(datasetId: string, kind: "raw" | "cleaned", rows: Record<string, unknown>[]) {
  await ensureRowTables();
  let batch: Record<string, unknown>[] = [];
  let size = 0;
  let idx = 0;
  const flush = async () => {
    if (!batch.length) return;
    await pool.query("INSERT INTO dataset_row_chunks (dataset_id, kind, idx, data) VALUES (?, ?, ?, ?)", [datasetId, kind, idx++, JSON.stringify(batch)]);
    batch = []; size = 0;
  };
  for (const row of rows) {
    const len = JSON.stringify(row).length;
    if (size + len > CHUNK_BYTES) await flush();
    batch.push(row); size += len;
  }
  await flush();
}

export async function loadRows(datasetId: string, kind: "raw" | "cleaned"): Promise<Record<string, unknown>[]> {
  await ensureRowTables();
  const [res] = await pool.query("SELECT data FROM dataset_row_chunks WHERE dataset_id = ? AND kind = ? ORDER BY idx", [datasetId, kind]);
  const out: Record<string, unknown>[] = [];
  for (const r of res as { data: unknown }[]) {
    const part = (typeof r.data === "string" ? JSON.parse(r.data) : r.data) as Record<string, unknown>[];
    for (const x of part) out.push(x);
  }
  return out;
}

export async function deleteRows(datasetId: string) {
  await ensureRowTables();
  await pool.query("DELETE FROM dataset_row_chunks WHERE dataset_id = ?", [datasetId]);
}

type RowHolder = { id: string; cleanedData?: unknown; rawData?: unknown };
/** Rows for a dataset: inline JSON for older datasets, chunk table for large ones. */
export async function datasetRows(ds: RowHolder, kind: "cleaned" | "raw" = "cleaned"): Promise<Record<string, unknown>[]> {
  const inline = (kind === "cleaned" ? ds.cleanedData || ds.rawData : ds.rawData) as Record<string, unknown>[] | null | undefined;
  if (inline) return inline;
  const stored = await loadRows(ds.id, kind);
  if (stored.length || kind === "raw") return stored;
  return loadRows(ds.id, "raw");
}
