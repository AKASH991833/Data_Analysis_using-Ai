import { db } from "@/db";
import { datasets } from "@/db/schema";
import { v4 as uuidv4 } from "uuid";
import { saveRows } from "@/lib/row-store";

export const MAX_ANALYZED_ROWS = 100000;

/** Profile, clean, summarise and store rows in the chunk table (used by large streamed uploads). */
export async function analyzeAndStoreChunked(opts: { rows: Record<string, unknown>[]; fileName: string; sizeBytes: number; totalRows: number }) {
  const { rows, fileName, sizeBytes, totalRows } = opts;
  const fileType = fileName.split(".").pop()?.toLowerCase() || "csv";
  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  if (columns.some((c) => ["__proto__", "prototype", "constructor"].includes(c))) throw new UserError("Unsupported column name");
  if (rows.length === 0) throw new UserError("No data found in file");
  const { profileData, detectDomain, cleanData, generateKPIs, generateInsights } = await import("@/lib/analytics-engine");
  const { columnMetas: rawMetas } = profileData(rows, columns);
  const { domain, confidence } = detectDomain(columns, rows);
  const { cleanedRows, report } = cleanData(rows, rawMetas);
  const { columnMetas, profile } = profileData(cleanedRows, columns);
  const kpis = generateKPIs(cleanedRows, profile, columnMetas, domain);
  const insights = generateInsights(cleanedRows, profile, columnMetas, domain);
  const id = uuidv4();
  await db.insert(datasets).values({
    id, name: fileName.replace(/\.[^.]+$/, ""), fileName, fileType,
    rowCount: totalRows, columnCount: columns.length, sizeBytes,
    domain, domainConfidence: confidence, status: "analyzed",
    columns: columnMetas, profile, rawData: null, cleanedData: null,
    cleaningReport: report, kpis, insights,
  });
  await saveRows(id, "raw", rows);
  await saveRows(id, "cleaned", cleanedRows);
  return {
    id, name: fileName.replace(/\.[^.]+$/, ""), rowCount: totalRows, columnCount: columns.length,
    domain, domainConfidence: confidence, status: "analyzed",
    limitInfo: { maxRows: MAX_ANALYZED_ROWS, totalRows, analyzedRows: rows.length, truncated: totalRows > rows.length },
  };
}

export class UserError extends Error {}
