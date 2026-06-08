import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { datasets } from "@/db/schema";
import { desc } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import Papa from "papaparse";

export async function GET() {
  try {
    const allDatasets = await db
      .select({
        id: datasets.id,
        name: datasets.name,
        fileName: datasets.fileName,
        fileType: datasets.fileType,
        rowCount: datasets.rowCount,
        columnCount: datasets.columnCount,
        domain: datasets.domain,
        domainConfidence: datasets.domainConfidence,
        status: datasets.status,
        createdAt: datasets.createdAt,
      })
      .from(datasets)
      .orderBy(desc(datasets.createdAt));
    return NextResponse.json(allDatasets);
  } catch {
    return NextResponse.json({ error: "Failed to fetch datasets" }, { status: 500 });
  }
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_ANALYZED_ROWS = 100000; // Excel pivot-level: 100K rows typical analyst limit

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Max size is 50MB.` },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "File is empty" },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const text = new TextDecoder().decode(buffer);
    const fileName = file.name;
    const fileType = fileName.split(".").pop()?.toLowerCase() || "csv";

    let rows: Record<string, unknown>[] = [];
    let columns: string[] = [];

    if (fileType === "csv" || fileType === "tsv" || fileType === "txt") {
      const delimiter = fileType === "tsv" ? "\t" : ",";
      const result = Papa.parse(text, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        delimiter,
      });
      rows = result.data as Record<string, unknown>[];
      columns = result.meta.fields || [];
    } else if (fileType === "json") {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        rows = parsed;
        columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      } else if (parsed.data && Array.isArray(parsed.data)) {
        rows = parsed.data;
        columns = rows.length > 0 ? Object.keys(rows[0]) : [];
      }
    } else if (fileType === "xlsx" || fileType === "xls") {
      // Dynamic import for xlsx
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(firstSheet) as Record<string, unknown>[];
      columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    } else {
      return NextResponse.json(
        { error: `Unsupported file type: ${fileType}` },
        { status: 400 }
      );
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No data found in file" }, { status: 400 });
    }

    // Enforce row limit — protect memory & performance
    const rowsTruncated = rows.length > MAX_ANALYZED_ROWS;
    const storedRows = rows.slice(0, MAX_ANALYZED_ROWS);

    // Import analytics engine
    const {
      profileData,
      detectDomain,
      cleanData,
      generateKPIs,
      generateInsights,
    } = await import("@/lib/analytics-engine");

    // Profile data
    const { columnMetas, profile } = profileData(storedRows, columns);

    // Detect domain
    const { domain, confidence } = detectDomain(columns, storedRows);

    // Clean data
    const { cleanedRows, report } = cleanData(storedRows, columnMetas);

    // Generate KPIs
    const kpis = generateKPIs(cleanedRows, profile, columnMetas, domain);

    // Generate insights
    const insights = generateInsights(cleanedRows, profile, columnMetas, domain);

    // Save to database
    const datasetId = uuidv4();
    await db.insert(datasets).values({
      id: datasetId,
      name: fileName.replace(/\.[^.]+$/, ""),
      fileName,
      fileType,
      rowCount: rows.length,
      columnCount: columns.length,
      sizeBytes: buffer.byteLength,
      domain,
      domainConfidence: confidence,
      status: "analyzed",
      columns: columnMetas,
      profile,
      rawData: storedRows,
      cleanedData: cleanedRows,
      cleaningReport: report,
      kpis,
      insights,
    });

    return NextResponse.json({
      id: datasetId,
      name: fileName.replace(/\.[^.]+$/, ""),
      rowCount: rows.length,
      columnCount: columns.length,
      domain,
      domainConfidence: confidence,
      status: "analyzed",
      limitInfo: {
        maxRows: MAX_ANALYZED_ROWS,
        totalRows: rows.length,
        analyzedRows: storedRows.length,
        truncated: rowsTruncated,
      },
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to process file" },
      { status: 500 }
    );
  }
}


